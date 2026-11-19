// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _vufind.py: conector genérico para catálogos VuFind (REST API v1)
// — usado por bdtd e oasisbr (ambos do IBICT). Não é uma fonte (sem FONTE_META).
//
// GET {base}/vufind/api/v1/search?lookfor=<termo>&type=AllFields&limit=<n>&page=1&field[]=id&...
// → {"resultCount": N, "records": [{id, title, summary, urls, ...}]}
//
// Achados do teste ao vivo (20/out/2026): sem field[] explícito a API não traz
// `summary`; `summary` é LISTA (PT + EN); muitos registros vêm sem resumo ou com
// eco do título — descartados, por isso pede-se mais (fator 3) e corta depois;
// a mesma obra aparece em mais de um repositório — dedup por título normalizado.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, htmlParaTexto, obter, resultadoVazio, tamanho,
} from './_base.js';

const CAMPOS = ['id', 'title', 'summary', 'urls', 'publicationDates', 'authors'];
const FATOR_SOBREPEDIDO = 3;
const LIMITE_API = 100;
const MIN_CHARS_RESUMO = 80;

/** Chave de dedup: minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalizarTitulo(titulo) {
  const semAcento = String(titulo || '').normalize('NFKD').replace(/\p{Mn}/gu, '');
  const semPontuacao = semAcento.toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, ' ');
  return semPontuacao.replace(/\s+/g, ' ').trim();
}

/** Junta os itens de `summary` (lista PT/EN) num texto só; "" se não houver resumo substantivo. */
export function montarResumo(record) {
  let bruto = record?.summary || [];
  if (typeof bruto === 'string') bruto = [bruto];
  const partes = [];
  for (const item of bruto) {
    const texto = htmlParaTexto(String(item || '')).trim();
    if (texto && !partes.includes(texto)) partes.push(texto);
  }
  const resumo = partes.join('\n\n');
  return tamanho(resumo) >= MIN_CHARS_RESUMO ? resumo : '';
}

function autores(record) {
  const a = record?.authors || {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return [];
  const nomes = [];
  for (const grupo of ['primary', 'secondary', 'corporate']) {
    const valor = a[grupo] || {};
    nomes.push(...(Array.isArray(valor) ? valor : Object.keys(valor)));
  }
  return nomes.filter((n) => typeof n === 'string' && n.trim());
}

function urlOrigem(baseUrl, record) {
  for (const u of record?.urls || []) {
    if (u && typeof u === 'object' && u.url) return u.url;
  }
  return `${baseUrl}/vufind/Record/${record?.id ?? ''}`;
}

/** Busca no VuFind em `baseUrl` e salva até `maxResultados` registros com resumo, sem títulos repetidos. */
export async function buscarVufind(baseUrl, fonteId, fonteNome, query, maxResultados, docDir, {
  timeout = [10, 30], evento_cancelar, dispatch_event,
} = {}) {
  const limite = Math.min(maxResultados * FATOR_SOBREPEDIDO, LIMITE_API);
  const params = [['lookfor', query], ['type', 'AllFields'], ['limit', limite], ['page', 1],
    ...CAMPOS.map((c) => ['field[]', c])];

  const resp = await obter(`${baseUrl}/vufind/api/v1/search`, { headers: HEADERS_TUSABBOT, params, timeout });
  resp.raise_for_status();
  const records = exigirJson(resp, fonteNome)?.records || [];

  const itens = [];
  const vistos = new Set();
  for (const rec of records) {
    const titulo = String(rec?.title || '').trim();
    const chave = normalizarTitulo(titulo);
    if (!chave || vistos.has(chave) || !montarResumo(rec)) continue;
    vistos.add(chave);
    itens.push(rec);
    if (itens.length >= maxResultados) break;
  }

  if (!itens.length) return resultadoVazio();

  const extrair = (rec) => {
    const resumo = montarResumo(rec);
    if (!resumo) return null;
    const cabecalho = [];
    const nomes = autores(rec);
    if (nomes.length) cabecalho.push(`Autoria: ${nomes.join('; ')}`);
    const datas = rec.publicationDates || [];
    if (datas.length) cabecalho.push(`Ano: ${datas[0]}`);
    const texto = cabecalho.length ? `${cabecalho.join('\n')}\n\n${resumo}` : resumo;
    return { titulo: String(rec.title ?? '').trim() || 'Sem título', texto, url_origem: urlOrigem(baseUrl, rec) };
  };

  return executarBuscaGenerica(itens, extrair, fonteId, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
