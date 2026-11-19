// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de camara_discursos.py: discursos de deputados federais em Plenário
// (SitaqWeb da Câmara, páginas HTML), sem chave — texto integral das notas
// taquigráficas. O SitaqWeb só aceita UA de navegador, parâmetros em
// ISO-8859-1 e é sensível a rajadas (1 s entre discursos).

import {
  HEADERS_NAVEGADOR, deIso, dormir, executarBuscaGenerica, fatiar, hoje, htmlParaTexto, limitarMax, obter, paraBr,
  paraLatin1, pastaDocumentos, resultadoVazio, somarDias, tamanho, unescapeHtml, urlencodeLatin1,
} from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "camara_discursos",
  "nome": "Câmara dos Deputados — Discursos em Plenário",
  "area": "direito",
  "descricao": "Discursos de deputados federais em Plenário — texto integral das notas taquigráficas.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const BASE = 'https://www.camara.leg.br/internet/sitaqweb/';
const SEARCH_URL = `${BASE}resultadoPesquisaDiscursos.asp`;
const HEADERS = { ...HEADERS_NAVEGADOR, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const ERRO_LAYOUT = 'SitaqWeb (Câmara) mudou o formato da página de resultados — a busca precisa ser atualizada no Tusab';

const PALAVRAS_VAZIAS = new Set([
  'que', 'para', 'com', 'dos', 'das', 'nos', 'nas', 'uma', 'por', 'pelo', 'pela',
  'the', 'and', 'not', 'near', 'sem', 'sob', 'entre', 'sobre',
]);
const RE_LINHA = /<tr class="(?:even|odd)"\s*>(.*?)<\/tr>/gs;
const RE_SUMARIO = /<tr class="(?:even|odd)"[^>]*id="Suma\d+"[^>]*>\s*<td[^>]*class="Sumario"[^>]*>(.*?)<\/td>/gs;
const RE_TD = /<td\b[^>]*>(.*?)<\/td>/gs;
const RE_LINK = /href="(TextoHTML\.asp\?[^"]*)"/s;
const RE_TOTAL = /name="TotalRecords"\s+value="(\d+)"/;
const RE_TITLE = /<title\b[^>]*>.*?<\/title>/gis;
const RE_COMENTARIO = /<!--.*?-->/gs;
const RE_COMENTARIO_MALFORMADO = /<![^>]*>/g; // "<! comentei o código ... -->" da página
const RE_DATA_CABECALHO = /Data:\s*\d{2}\/\d{2}\/\d{4}/g;

const semAcento = (t) => String(t || '').normalize('NFKD').replace(/\p{Mn}/gu, '');
const capitalizar = (t) => (t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t);

/** 'saúde mental no SUS' → 'saude and mental and SUS'. */
export function montarExpressao(query) {
  const palavras = semAcento(query).match(/[\p{L}\p{N}_]+/gu) || [];
  let uteis = palavras.filter((p) => tamanho(p) >= 3 && !PALAVRAS_VAZIAS.has(p.toLowerCase()));
  if (!uteis.length) uteis = palavras.filter((p) => tamanho(p) >= 2);
  return [...new Set(uteis)].join(' and ');
}

/** Link cru da tabela (quebras de linha, &amp;, espaço e acento) → URL absoluta recodificada. */
export function urlTexto(href) {
  const u = unescapeHtml(href);
  const consulta = u.slice(u.indexOf('?') + 1);
  const pares = [];
  for (let parte of consulta.split('&')) {
    parte = parte.trim();
    const i = parte.indexOf('=');
    if (i >= 0) pares.push([parte.slice(0, i).trim(), paraLatin1(parte.slice(i + 1).trim())]);
  }
  return `${BASE}TextoHTML.asp?${urlencodeLatin1(pares)}`;
}

/** Tabela de resultados → [{data, sessao, fase, orador, sumario, url}]. */
export function parseResultados(pagina) {
  const sumarios = [...pagina.matchAll(RE_SUMARIO)].map((m) => htmlParaTexto(m[1]));
  const itens = [];
  for (const [, linha] of pagina.matchAll(RE_LINHA)) {
    const mLink = RE_LINK.exec(linha);
    if (!mLink) continue;
    const tds = [...linha.matchAll(RE_TD)].map((m) => m[1]);
    if (tds.length < 6) throw new Error(`${ERRO_LAYOUT} (colunas da tabela mudaram)`);
    itens.push({
      data: htmlParaTexto(tds[0]),
      sessao: htmlParaTexto(tds[1]),
      fase: capitalizar(htmlParaTexto(tds[2])),
      orador: htmlParaTexto(tds[5]),
      sumario: '',
      url: urlTexto(mLink[1]),
    });
  }
  if (sumarios.length === itens.length) itens.forEach((item, i) => { item.sumario = sumarios[i]; });
  const mTotal = RE_TOTAL.exec(pagina);
  if (!itens.length && mTotal && Number(mTotal[1]) > 0) {
    throw new Error(`${ERRO_LAYOUT} (há resultados, mas nenhum link de discurso foi reconhecido)`);
  }
  if (!itens.length && !mTotal && !pagina.includes('Nenhum discurso encontrado')) {
    if (pagina.includes('verificar os padr')) throw new Error('SitaqWeb (Câmara) recusou a expressão de busca — tente termos mais simples');
    throw new Error(ERRO_LAYOUT);
  }
  return itens;
}

/**
 * Página TextoHTML.asp → cabeçalho DETAQ (sessão, fase, orador, data) + texto
 * do discurso. A âncora é "CÂMARA DOS DEPUTADOS - DETAQ" … "Data: dd/mm/aaaa".
 */
export function extrairDiscurso(conteudo) {
  let pagina = new TextDecoder('utf-8').decode(conteudo);
  pagina = pagina.replace(RE_TITLE, ' ').replace(RE_COMENTARIO, ' ').replace(RE_COMENTARIO_MALFORMADO, ' ');
  const texto = htmlParaTexto(pagina).replace(/�/g, '');
  const ini = texto.indexOf('DETAQ');
  RE_DATA_CABECALHO.lastIndex = ini >= 0 ? ini : 0;
  const mData = RE_DATA_CABECALHO.exec(texto);
  if (ini < 0 || !mData || texto.slice(mData.index + mData[0].length).trim().length < 50) {
    throw new Error(t('SitaqWeb (Câmara) mudou o formato da página do discurso (corpo não encontrado)'));
  }
  const quebra = ini > 0 ? texto.lastIndexOf('\n', ini - 1) : -1;
  return texto.slice(quebra + 1);
}

function periodo(dataInicio, dataFim) {
  const fim = dataFim ? deIso(dataFim) : hoje();
  const inicio = dataInicio ? deIso(dataInicio) : somarDias(fim, -365);
  if (inicio > fim) throw new Error('Data inicial posterior à data final.');
  return [paraBr(inicio), paraBr(fim)];
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);
  const expressao = montarExpressao(query);
  if (!expressao) return resultadoVazio();

  const [dtIni, dtFim] = periodo(data_inicio, data_fim);
  const params = {
    txTexto: expressao, dtInicio: dtIni, dtFim, BasePesq: 'plenario',
    CampoOrdenacao: 'dtSessao', TipoOrdenacao: 'DESC', PageSize: max,
  };
  const resp = await obter(`${SEARCH_URL}?${urlencodeLatin1(params)}`, { headers: HEADERS, timeout: TIMEOUT });
  resp.raise_for_status();
  const itens = parseResultados(resp.textoUtf8).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (item) => {
    await dormir(1.0); // servidor sensível a rajadas
    const r = await obter(item.url, { headers: HEADERS, timeout: TIMEOUT });
    r.raise_for_status();
    const discurso = extrairDiscurso(r.conteudo);
    const partes = item.sumario ? [`Sumário: ${item.sumario}`] : [];
    partes.push(`--- TEXTO INTEGRAL ---\n\n${discurso}`);
    const titulo = [item.orador, item.data, item.fase].filter(Boolean).join(' — ') || 'Discurso';
    return { titulo, texto: fatiar(partes.join('\n\n'), 0, MAX_CHARS), url_origem: item.url };
  };

  return executarBuscaGenerica(itens, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
