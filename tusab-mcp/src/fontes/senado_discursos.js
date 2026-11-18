// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de senado_discursos.py: pronunciamentos de senadores em Plenário
// (Dados Abertos do Senado), sem chave — texto integral das notas
// taquigráficas. A lista vem por janelas de 1 mês (padrão: últimos 3 meses,
// teto de 12) e o filtro pelo termo é local (resumo + indexação).

import {
  HEADERS_TUSABBOT, deIso, dormir, executarBuscaGenerica, exigirJson, fatiar, hoje, limitarMax, obter, paraBr,
  paraCompacta, pastaDocumentos, resultadoVazio, somarDias, tamanho,
  separarLinhas,
} from './_base.js';

export const FONTE_META = {
  "id": "senado_discursos",
  "nome": "Senado Federal — Discursos em Plenário",
  "area": "direito",
  "descricao": "Pronunciamentos de senadores em Plenário — texto integral das notas taquigráficas.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const TEXTO_URL = 'https://legis.senado.leg.br/dadosabertos/discurso/texto-integral/';
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const MESES_PADRAO = 3;
const MESES_MAXIMO = 12;
const ERRO_FORMATO = 'Dados Abertos do Senado mudou o formato da lista de discursos — a busca precisa ser atualizada no Tusab';
const W = '[\\p{L}\\p{N}_]';

const normalizar = (t) => String(t || '').normalize('NFKD').replace(/\p{Mn}/gu, '').toLowerCase();
const escapar = (s) => s.replace(/[\^$\\.*+?()[\]{}|/]/g, '\\$&');

export function termosSignificativos(query) {
  const palavras = normalizar(query).match(/[\p{L}\p{N}_]+/gu) || [];
  const longas = palavras.filter((p) => tamanho(p) >= 4);
  return longas.length ? longas : palavras.filter((p) => tamanho(p) >= 2);
}

/** 4+ letras casam no início de palavra ("vacina" acha "vacinação"); siglas curtas só inteiras. */
export function casaTermos(termos, texto) {
  const alvo = normalizar(texto);
  return termos.every((t) => new RegExp(`(?<!${W})${escapar(t)}${tamanho(t) >= 4 ? '' : `(?!${W})`}`, 'u').test(alvo));
}

const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

/** Mesmo dia do mês anterior (dia ajustado ao fim do mês se preciso). */
export function menosUmMes(d) {
  let ano = d.getUTCFullYear();
  let mes = d.getUTCMonth() - 1;
  if (mes < 0) { mes = 11; ano -= 1; }
  for (const dia of [d.getUTCDate(), 30, 29, 28]) {
    if (dia <= ultimoDia(ano, mes)) return new Date(Date.UTC(ano, mes, dia));
  }
  return new Date(Date.UTC(ano, mes, 28));
}

/** [[ini, fim]] de até 1 mês cada, da mais recente para a mais antiga. */
export function janelasMensais(inicio, fim) {
  const janelas = [];
  let atualFim = fim;
  while (atualFim >= inicio && janelas.length < MESES_MAXIMO) {
    const atualIni = new Date(Math.max(somarDias(menosUmMes(atualFim), 1).getTime(), inicio.getTime()));
    janelas.push([atualIni, atualFim]);
    atualFim = somarDias(atualIni, -1);
  }
  return janelas;
}

function periodo(dataInicio, dataFim) {
  const h = hoje();
  let fim = dataFim ? deIso(dataFim) : h;
  if (fim > h) fim = h;
  let inicio;
  if (dataInicio) {
    inicio = deIso(dataInicio);
  } else {
    inicio = fim;
    for (let i = 0; i < MESES_PADRAO; i++) inicio = menosUmMes(inicio);
    inicio = somarDias(inicio, 1);
  }
  if (inicio > fim) throw new Error('Data inicial posterior à data final.');
  return [inicio, fim];
}

const comoLista = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function pronunciamentosDoJson(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || !('DiscursosSessao' in dados)) throw new Error(ERRO_FORMATO);
  const sessoes = (dados.DiscursosSessao || {}).Sessoes;
  if (sessoes === null || sessoes === undefined) return []; // período sem sessões
  if (typeof sessoes !== 'object' || Array.isArray(sessoes) || !('Sessao' in sessoes)) throw new Error(ERRO_FORMATO);
  const lista = [];
  for (const sessao of comoLista(sessoes.Sessao)) {
    for (const p of comoLista((sessao?.Pronunciamentos || {}).Pronunciamento)) {
      if (!p?.CodigoPronunciamento) throw new Error(ERRO_FORMATO);
      lista.push(p);
    }
  }
  return lista;
}

export function tituloPronunciamento(p) {
  let orador;
  if (String(p.TipoAutor || '').toLowerCase().includes('senador')) {
    orador = p.NomeAutor || 'Senador(a)';
    const filiacao = [p.Partido, p.UF].filter(Boolean).join('/');
    if (filiacao) orador += ` (${filiacao})`;
  } else {
    orador = 'Autor externo';
  }
  let dataBr = '';
  if (p.Data) {
    try { dataBr = paraBr(deIso(p.Data)); } catch { dataBr = p.Data; }
  }
  const resumo = String(p.Resumo || '').replace(/\s+/g, ' ').trim();
  let curto = resumo;
  if (tamanho(resumo) > 90) {
    const corte = fatiar(resumo, 0, 90);
    const i = corte.lastIndexOf(' ');
    curto = `${i >= 0 ? corte.slice(0, i) : corte}…`;
  }
  return [orador, dataBr, curto].filter(Boolean).join(' — ');
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);
  const termos = termosSignificativos(query);
  if (!termos.length) return resultadoVazio();

  const [inicio, fim] = periodo(data_inicio, data_fim);
  const cabecalho = { ...HEADERS_TUSABBOT, Accept: 'application/json' };
  let candidatos = [];
  const janelas = janelasMensais(inicio, fim);
  for (let i = 0; i < janelas.length; i++) {
    if (evento_cancelar && evento_cancelar.is_set()) break;
    if (i) await dormir(0.5);
    const [ini, fimJanela] = janelas[i];
    const resp = await obter(
      `https://legis.senado.leg.br/dadosabertos/plenario/lista/discursos/${paraCompacta(ini)}/${paraCompacta(fimJanela)}`,
      { headers: cabecalho, timeout: TIMEOUT },
    );
    resp.raise_for_status();
    const achados = pronunciamentosDoJson(exigirJson(resp, FONTE_META.nome))
      .filter((p) => casaTermos(termos, `${p.Resumo ?? ''} ${p.Indexacao ?? ''}`));
    const data = (p) => p.Data ?? '';
    achados.sort((a, b) => (data(a) < data(b) ? 1 : data(a) > data(b) ? -1 : 0));
    candidatos.push(...achados);
    if (candidatos.length >= max) break;
  }

  candidatos = candidatos.slice(0, max);
  if (!candidatos.length) return resultadoVazio();

  const extrair = async (p) => {
    await dormir(0.5);
    const r = await obter(TEXTO_URL + p.CodigoPronunciamento, { headers: HEADERS_TUSABBOT, timeout: TIMEOUT });
    r.raise_for_status();
    if ((r.headers.get('content-type') || '').toLowerCase().includes('html')) {
      throw new Error('Senado devolveu HTML no lugar do texto integral do discurso');
    }
    const integra = separarLinhas(r.textoUtf8).map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const resumo = String(p.Resumo || '').trim();
    if (!integra && !resumo) return null;
    const partes = resumo ? [`Resumo: ${resumo}`] : [];
    if (p.Indexacao) partes.push(`Indexação: ${String(p.Indexacao).trim()}`);
    if (integra) partes.push(`--- TEXTO INTEGRAL ---\n\n${integra}`);
    return {
      titulo: tituloPronunciamento(p),
      texto: fatiar(partes.join('\n\n'), 0, MAX_CHARS),
      url_origem: p.TextoIntegral || TEXTO_URL + p.CodigoPronunciamento,
    };
  };

  return executarBuscaGenerica(candidatos, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
