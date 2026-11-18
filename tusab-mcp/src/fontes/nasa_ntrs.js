// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de nasa_ntrs.py: NASA Technical Reports Server, sem chave — abstract
// e, quando disponível, texto integral (text/plain) do relatório.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, fatiar, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "nasa_ntrs",
  "nome": "NASA Technical Reports Server",
  "area": "terra",
  "descricao": "Relatórios técnicos e artigos da NASA — abstract e texto integral quando disponível.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE = 'https://ntrs.nasa.gov';
const API_URL = `${BASE}/api/citations/search`;
const LIMITE_TEXTO_INTEGRAL = 200_000;

function urlTextoIntegral(item) {
  if (item.disseminated !== 'DOCUMENT_AND_METADATA') return '';
  for (const download of item.downloads || []) {
    const caminho = download?.links?.fulltext || '';
    if (caminho) return caminho.startsWith('http') ? caminho : BASE + caminho;
  }
  return '';
}

/** Melhor esforço — "" se falhar ou se não vier texto puro. */
async function baixarTextoIntegral(url) {
  if (!url) return '';
  try {
    const resp = await obter(url, { headers: HEADERS_TUSABBOT, timeout: [10, 60] });
    resp.raise_for_status();
    if (!(resp.headers.get('content-type') || '').toLowerCase().includes('text/plain')) return '';
    return fatiar(resp.textoUtf8.trim(), 0, LIMITE_TEXTO_INTEGRAL);
  } catch {
    return '';
  }
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, { params: { q: query, 'page.size': max }, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const itens = (exigirJson(resp, FONTE_META.nome)?.results || []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (item) => {
    const resumo = String(item.abstract || '').trim();
    if (!resumo) return null;
    let texto = resumo;
    const integral = await baixarTextoIntegral(urlTextoIntegral(item));
    if (integral) texto += `\n\n--- TEXTO INTEGRAL ---\n${integral}`;
    return { titulo: String(item.title || 'Sem título').trim(), texto, url_origem: `${BASE}/citations/${item.id ?? ''}` };
  };

  return executarBuscaGenerica(itens, extrair, 'nasa_ntrs', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}
