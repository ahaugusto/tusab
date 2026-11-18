// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de educapes.py: recursos educacionais abertos da CAPES (EduCAPES,
// DSpace com JSPUI), sem chave. A busca é a página HTML do simple-search; a
// descrição vem das <meta name="DC.*"> da página de cada recurso.

import {
  HEADERS_TUSABBOT, dormir, executarBuscaGenerica, fatiar, limitarMax, obter, pastaDocumentos, resultadoVazio,
  tamanho, unescapeHtml,
} from './_base.js';

export const FONTE_META = {
  "id": "educapes",
  "nome": "EduCAPES — Recursos Educacionais",
  "area": "educacao",
  "descricao": "Recursos educacionais abertos da CAPES (livros, artigos, materiais didáticos) — descrição de cada recurso.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE = 'https://educapes.capes.gov.br';
const SEARCH_URL = `${BASE}/simple-search`;
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const MAX_CANDIDATOS = 100;
const MIN_CHARS_DESCRICAO = 100;

const RE_HANDLE = /href="(\/handle\/[\p{L}\p{N}_.-]+\/\d+)"/gu;
const RE_TOTAL = /(?:Results?|Resultados?)\s+\d+-\d+\s+(?:of|de)\s+(\d+)/;
const RE_META = /<meta\b([^>]*)>/gi;
const RE_ATTR = /([\p{L}\p{N}_:.-]+)\s*=\s*"([^"]*)"/gu;

const unicos = (lista) => [...new Set(lista)];

export function handles(pagina) {
  const lista = unicos([...pagina.matchAll(RE_HANDLE)].map((m) => m[1]));
  if (!lista.length && (RE_TOTAL.test(pagina) || !pagina.includes('name="query"'))) {
    throw new Error('EduCAPES mudou o formato da página de busca — a busca precisa ser atualizada no Tusab');
  }
  return lista;
}

/** Todas as <meta name="DC.*" content="..."> da página, na ordem. */
export function metasDc(pagina) {
  const metas = {};
  for (const [, attrs] of pagina.matchAll(RE_META)) {
    const a = {};
    for (const [, k, v] of attrs.matchAll(RE_ATTR)) a[k.toLowerCase()] = v;
    const nome = a.name ?? '';
    const conteudo = unescapeHtml(a.content ?? '').trim();
    if (nome.startsWith('DC.') && conteudo) (metas[nome] ||= []).push(conteudo.replace(/\s+/g, ' '));
  }
  return metas;
}

export function montarDocumento(metas, url) {
  const titulos = metas['DC.title'] || [];
  if (!titulos.length) throw new Error('EduCAPES mudou o formato da página do recurso (meta DC.title ausente)');
  const descricoes = unicos(metas['DC.description'] || []).filter((d) => tamanho(d) >= MIN_CHARS_DESCRICAO);
  if (!descricoes.length) return null;
  const linhas = [titulos[0], ''];
  const tipo = (metas['DC.type'] || [''])[0];
  if (tipo) linhas.push(`Tipo: ${tipo}`);
  const assuntos = unicos(metas['DC.subject'] || []);
  if (assuntos.length) linhas.push(`Assuntos: ${assuntos.join('; ')}`);
  linhas.push('', 'Descrição:', descricoes.join('\n\n'));
  return { titulo: titulos[0], texto: fatiar(linhas.join('\n'), 0, MAX_CHARS), url_origem: url };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, {
    params: { query, rpp: Math.min(max * 2, MAX_CANDIDATOS) }, headers: HEADERS_TUSABBOT, timeout: TIMEOUT,
  });
  resp.raise_for_status();
  const lista = handles(resp.texto);
  if (!lista.length) return resultadoVazio();

  let salvos = 0;
  const extrair = async (handle) => {
    if (salvos >= max) return null; // limite atingido — candidatos extras pulados sem rede
    await dormir(0.5);
    const url = BASE + handle;
    const r = await obter(url, { headers: HEADERS_TUSABBOT, timeout: TIMEOUT });
    r.raise_for_status();
    const doc = montarDocumento(metasDc(r.texto), url);
    if (doc) salvos += 1;
    return doc;
  };

  return executarBuscaGenerica(lista, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
