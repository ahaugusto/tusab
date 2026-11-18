// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de anvisalegis.py: atos normativos da ANVISA (AnvisaLegis/Datalegis),
// sem chave — texto integral de cada ato. O sistema exige sessão (cookie) e
// três etapas: abrir a legislação, enviar a consulta (form em ISO-8859-1) e
// pedir a página de resultados (JSON com HTML dentro).

import {
  HEADERS_TUSABBOT, Sessao, dormir, executarBuscaGenerica, fatiar, htmlParaTexto, limitarMax, obter, paraLatin1,
  pastaDocumentos, resultadoVazio, unescapeHtml, urlencodeLatin1,
} from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "anvisalegis",
  "nome": "ANVISA — Legislação Sanitária (AnvisaLegis)",
  "area": "saude",
  "descricao": "Atos normativos da ANVISA (RDCs, resoluções, instruções normativas) — texto integral de cada ato.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE = 'https://anvisalegis.datalegis.net';
const ACTION_URL = `${BASE}/action/ActionDatalegis.php`;
const ATO_PUBLICO_URL = `${BASE}/action/UrlPublicasAction.php`;
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const ERRO_LAYOUT = 'AnvisaLegis mudou o formato da página de resultados — a busca precisa ser atualizada no Tusab';

const RE_ATO = /<div class='ato'>(.*?)<\/a>\s*<\/div>/gs;
const RE_LINK = /href='([^']*acao=abrirTextoAto[^']*)'/;
const RE_TITULO = /<strong>(.*?)<\/strong>/s;
const RE_EMENTA = /<p>(.*?)<\/p>/s;
const RE_SITUACAO = /<span[^>]*ico-situacao[^>]*>.*?<\/span>/gs;

/** Form em ISO-8859-1; caracteres fora do Latin-1 perdem só o acento ou são descartados. */
export function formLatin1(campos) {
  return urlencodeLatin1(Object.entries(campos).map(([k, v]) => [k, paraLatin1(String(v))]));
}

/** HTML da etapa 3 → [{titulo, ementa, tipo, numero, seq, ano, orgao}]. */
export function parseResultado(resultadoHtml) {
  const atos = [];
  for (const [, bloco] of resultadoHtml.matchAll(RE_ATO)) {
    const mLink = RE_LINK.exec(bloco);
    const mTit = RE_TITULO.exec(bloco);
    if (!mLink || !mTit) continue;
    const href = unescapeHtml(mLink[1]);
    const i = href.indexOf('?');
    const busca = new URLSearchParams(i >= 0 ? href.slice(i + 1).split('#')[0] : '');
    const q = {};
    for (const [k, v] of busca) if (!(k in q)) q[k] = v;
    if (!['tipo', 'numeroAto', 'valorAno', 'orgao'].every((c) => q[c])) continue;
    const mEm = RE_EMENTA.exec(bloco);
    atos.push({
      titulo: htmlParaTexto(mTit[1].replace(RE_SITUACAO, ' ')),
      ementa: mEm ? htmlParaTexto(mEm[1]) : '',
      tipo: q.tipo,
      numero: q.numeroAto,
      seq: q.seqAto ?? '000',
      ano: q.valorAno,
      orgao: q.orgao,
    });
  }
  return atos;
}

export function urlPublica(ato) {
  return `${ATO_PUBLICO_URL}?${new URLSearchParams({
    acao: 'abrirAtoPublico', num_ato: ato.numero, sgl_tipo: ato.tipo, sgl_orgao: ato.orgao, vlr_ano: ato.ano,
    seq_ato: ato.seq, cod_modulo: '134', cod_menu: '1696',
  })}`;
}

/** Isola o corpo do ato (sem o menu do gov.br). Falha se o marcador sumiu. */
export function extrairCorpoAto(pagina) {
  const ini = pagina.indexOf('<div id="conteudo">');
  if (ini < 0) throw new Error(t('AnvisaLegis mudou o formato da página do ato (bloco \'conteudo\' não encontrado)'));
  const fim = pagina.indexOf('</article>', ini);
  return htmlParaTexto(fim > 0 ? pagina.slice(ini, fim) : pagina.slice(ini));
}

async function buscarAtos(query) {
  const sessao = new Sessao(HEADERS_TUSABBOT);
  const form = {
    txt_texto: query, redirect_consultaato: 'apresentarAtos', in_pesquisa_avancada: 'N', inApsModuloBase: 'S',
    ind_legis_juris: 'L', cod_modulo: '134', cod_menu: '1696',
  };
  const cabecalhoForm = { 'Content-Type': 'application/x-www-form-urlencoded' };

  (await sessao.get(ACTION_URL, { params: { acao: 'abrirLegislacao', cod_modulo: '134', cod_menu: '1696' }, timeout: TIMEOUT }))
    .raise_for_status();
  (await sessao.post(`${ACTION_URL}?acao=consultarAtosInicial&cod_modulo=134&cod_menu=1696&buscaGeral=true`, {
    dados: formLatin1(form), headers: cabecalhoForm, timeout: TIMEOUT,
  })).raise_for_status();
  const resp = await sessao.post(`${ACTION_URL}?acao=abrirPagina&pagina=1&legisjuris=L`, {
    dados: formLatin1({ ...form, cod_local: 'BR' }),
    headers: { ...cabecalhoForm, 'X-Requested-With': 'XMLHttpRequest' },
    timeout: TIMEOUT,
  });
  resp.raise_for_status();
  let dados;
  try {
    dados = resp.json();
  } catch {
    throw new Error(`${ERRO_LAYOUT} (resposta não é JSON)`);
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || !('resultado' in dados)) {
    throw new Error(`${ERRO_LAYOUT} (campo 'resultado' ausente)`);
  }
  const resultadoHtml = dados.resultado || '';
  const atos = parseResultado(resultadoHtml);
  // Havia atos na página mas nenhum casou com o padrão — layout mudou.
  if (!atos.length && resultadoHtml.includes("class='ato'")) throw new Error(ERRO_LAYOUT);
  return atos;
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const atos = (await buscarAtos(query)).slice(0, max);
  if (!atos.length) return resultadoVazio();

  const extrair = async (ato) => {
    const url = urlPublica(ato);
    const ementaUtil = ato.ementa && ato.ementa !== ato.titulo;
    const cabecalho = ato.titulo + (ementaUtil ? `\n\nEmenta: ${ato.ementa}` : '');
    if (ato.tipo === 'MAN') {
      // Manuais: o corpo é só um link para PDF — fica a ementa.
      return ato.ementa ? { titulo: ato.titulo, texto: cabecalho, url_origem: url } : null;
    }
    await dormir(0.5);
    const resp = await obter(url, { headers: HEADERS_TUSABBOT, timeout: TIMEOUT });
    resp.raise_for_status();
    const corpo = extrairCorpoAto(new TextDecoder('latin1').decode(resp.conteudo));
    const texto = corpo ? `${cabecalho}\n\n--- TEXTO INTEGRAL ---\n\n${corpo}` : cabecalho;
    if (!texto.trim()) return null;
    return { titulo: ato.titulo, texto: fatiar(texto, 0, MAX_CHARS), url_origem: url };
  };

  return executarBuscaGenerica(atos, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
