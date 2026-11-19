// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de usgs_pubs.py: USGS Publications Warehouse (Serviço Geológico dos
// EUA), sem chave — resumo de cada estudo.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, htmlParaTexto, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "usgs_pubs",
  "nome": "USGS Publications Warehouse",
  "area": "terra",
  "descricao": "Publicações do Serviço Geológico dos EUA (água, geologia, riscos naturais) — resumo de cada estudo.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://pubs.usgs.gov/pubs-services/publication/';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, { params: { q: query, page_size: max }, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const itens = (exigirJson(resp, FONTE_META.nome)?.records || []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (item) => {
    const resumo = htmlParaTexto(item.docAbstract || '');
    if (!resumo) return null;
    const indexId = item.indexId || '';
    return {
      titulo: String(item.title || 'Sem título').trim(),
      texto: resumo,
      url_origem: indexId ? `https://pubs.usgs.gov/publication/${indexId}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'usgs_pubs', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
