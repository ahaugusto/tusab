// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _portais_dados.py: consulta VÁRIOS portais de dados abertos em
// paralelo e intercala os resultados. Usado por portais_br_federal,
// portais_br_estados, portais_br_municipios e portais_internacionais.
//
// Quatro plataformas (mapeamento ao vivo de 20/out/2026, mais de 150 portais):
// - CKAN    {base}/api/3/action/package_search?q=&rows= → result.results[]
// - udata   {base}/api/1/datasets/?q=&page_size= → data[]
// - Socrata https://api.us.socrata.com/api/catalog/v1?domains=<domínio>&q=&limit= → results[].resource
// - ODS     {base}/api/explore/v2.1/catalog/datasets?where=search("<termo>")&limit= → results[].metas.default
//
// User-Agent: a palavra "Bot" é bloqueada por alguns portais e o datos.gob.mx
// barra "+http" no UA — aqui é `Tusab/1.0` puro. Portais lentos: timeout curto
// por portal e consulta paralela — um portal lento ou fora do ar só fica de fora.

import {
  MAX_RESULTADOS_PERMITIDO, executarBuscaGenerica, htmlParaTexto, obter, pastaDocumentos, quote, resultadoVazio,
  tamanho, fatiar, aparar,
} from './_base.js';

export const HEADERS_PORTAIS = { 'User-Agent': 'Tusab/1.0', Accept: 'application/json' };
const TIMEOUT_PORTAL = [8, 20];
const MAX_ARQUIVOS_LISTADOS = 15;
const PARALELO = 8;

const RE_MD_LINK = /\[([^\]]+)\]\([^)]+\)/g;
const RE_MD_ENFASE = /\*\*|__|`+/g;
const RE_MD_INICIO = /^[ \t]*(#{1,6}|>|[*-])[ \t]+/gm;

/** Descrições vêm em texto puro, Markdown (HDX, MG) ou HTML (ODS). */
export function limparTexto(texto) {
  if (texto && typeof texto === 'object' && !Array.isArray(texto)) { // campos multilíngues: prefere pt, en, es
    texto = texto.pt || texto.en || texto.es || (Object.values(texto)[0] ?? '');
  }
  texto = texto ? String(texto) : '';
  if (texto.includes('<') && texto.includes('>')) texto = htmlParaTexto(texto);
  texto = texto.replace(RE_MD_LINK, '$1').replace(RE_MD_ENFASE, '').replace(RE_MD_INICIO, '');
  return texto.replace(/[ \t]+/g, ' ').trim();
}

async function get(url, params) {
  const resp = await obter(url, { headers: HEADERS_PORTAIS, params, timeout: TIMEOUT_PORTAL });
  resp.raise_for_status();
  return resp.json();
}

function linhasArquivos(recursos) {
  const linhas = [];
  for (const r of (Array.isArray(recursos) ? recursos : []).slice(0, MAX_ARQUIVOS_LISTADOS)) {
    const nome = limparTexto(r?.name || r?.title || 'arquivo');
    const fmt = aparar(String(r?.format || '').toUpperCase(), '.') || '?';
    const url = r?.url || r?.latest || '';
    const desc = fatiar(limparTexto(r?.description || ''), 0, 200);
    linhas.push(`- ${nome} [${fmt}] ${url}${desc ? ` — ${desc}` : ''}`);
  }
  return linhas;
}

function item(titulo, descricao, orgao, recursos, url, portalNome) {
  return { titulo, descricao, orgao, arquivos: linhasArquivos(recursos), url, portal: portalNome };
}

// ── Adaptadores por plataforma ───────────────────────────────────────────────

async function ckan(portal, query, n) {
  const base = portal.base.replace(/\/+$/, '');
  const dados = await get(`${base}/api/3/action/package_search`, { q: query, rows: n });
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || !('result' in dados)) {
    throw new Error("resposta CKAN sem 'result'");
  }
  const urlPublica = portal.url_dataset ?? `${base}/dataset/{name}`;
  return (dados.result?.results || []).map((p) => item(
    p.title || (p.name ?? ''),
    limparTexto(p.notes || p.notes_translated || p.description || ''),
    p.organization?.title || '',
    p.resources, urlPublica.replace(/\{name\}/g, p.name ?? ''), portal.nome,
  ));
}

async function udata(portal, query, n) {
  const base = portal.base.replace(/\/+$/, '');
  const dados = await get(`${base}/api/1/datasets/`, { q: query, page_size: n });
  return (dados?.data || []).map((d) => item(
    d.title ?? '', limparTexto(d.description || ''), d.organization?.name || '', d.resources, d.page || '', portal.nome,
  ));
}

async function socrata(portal, query, n) {
  const dados = await get('https://api.us.socrata.com/api/catalog/v1', { domains: portal.dominio, q: query, limit: n });
  return (dados?.results || []).map((r) => {
    const res = r?.resource || {};
    return item(res.name ?? '', limparTexto(res.description || ''), res.attribution || '', [],
      r.link || r.permalink || '', portal.nome);
  });
}

async function ods(portal, query, n) {
  const base = portal.base.replace(/\/+$/, '');
  const termo = query.replace(/"/g, ' ');
  const dados = await get(`${base}/api/explore/v2.1/catalog/datasets`, { where: `search("${termo}")`, limit: n });
  return (dados?.results || []).map((d) => {
    const meta = d?.metas?.default || {};
    const dsId = d?.dataset_id ?? '';
    return item(meta.title || dsId, limparTexto(meta.description || ''), meta.publisher || '', [],
      `${base}/explore/dataset/${quote(dsId)}/`, portal.nome);
  });
}

export const ADAPTADORES = { ckan, udata, socrata, ods };

/** Uma de cada portal por rodada — nenhum portal grande monopoliza o resultado. */
export function intercalar(listas, limite) {
  const saida = [];
  let i = 0;
  while (saida.length < limite && listas.some((l) => i < l.length)) {
    for (const l of listas) if (i < l.length && saida.length < limite) saida.push(l[i]);
    i += 1;
  }
  return saida;
}

/** Roda as tarefas com no máximo `n` em paralelo (o ThreadPoolExecutor(max_workers=8) do Python). */
async function emParalelo(tarefas, n) {
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < tarefas.length) {
      const t = tarefas[proxima++];
      await t();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, trabalhador));
}

export async function buscarPortais(portais, fonteId, query, maxResultados, projetoNome, {
  raiz, evento_cancelar, dispatch_event,
} = {}) {
  const max = Math.max(1, Math.min(Math.trunc(Number(maxResultados)), MAX_RESULTADOS_PERMITIDO));
  const docDir = pastaDocumentos(raiz, projetoNome);
  const porPortal = Math.max(3, Math.min(10, max));

  const resultados = {};
  const falhas = [];
  await emParalelo(portais.map((p) => async () => {
    try {
      const itens = await ADAPTADORES[p.plataforma](p, query, porPortal);
      // descarta descrição vazia/curta demais: não ajuda a busca no chat
      resultados[p.nome] = itens.filter((it) => tamanho(it.descricao) >= 40 || it.arquivos.length);
    } catch (e) { // portal fora do ar/lento: fica de fora, não derruba a busca
      falhas.push(`${p.nome}: ${e?.name === 'Error' ? 'RuntimeError' : (e?.name || 'Error')}`);
    }
  }), PARALELO);

  if (!Object.keys(resultados).length && falhas.length) {
    throw new Error(`Nenhum portal respondeu — ${falhas.slice(0, 5).join('; ')}`);
  }

  const ordenados = portais.filter((p) => resultados[p.nome]?.length).map((p) => resultados[p.nome]);
  const itens = intercalar(ordenados, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (it) => {
    const partes = [`Portal: ${it.portal}${it.orgao ? ` | Publicado por: ${it.orgao}` : ''}`];
    if (it.descricao) partes.push(it.descricao);
    if (it.arquivos.length) partes.push(`Arquivos do conjunto de dados:\n${it.arquivos.join('\n')}`);
    return { titulo: it.titulo, texto: partes.join('\n\n'), url_origem: it.url };
  };

  const resultado = await executarBuscaGenerica(itens, extrair, fonteId, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
  resultado.portais_sem_resposta = falhas;
  return resultado;
}

/** buscar() comum às quatro fontes de portais: filtra pelos portais marcados na modal. */
export function criarBuscaPortais(PORTAIS, fonteId) {
  return function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, subfontes, raiz }) {
    const escolhidos = subfontes && subfontes.length ? PORTAIS.filter((p) => subfontes.includes(p.nome)) : PORTAIS;
    return buscarPortais(escolhidos.length ? escolhidos : PORTAIS, fonteId, query, max_resultados, projeto_nome, {
      raiz, evento_cancelar, dispatch_event,
    });
  };
}
