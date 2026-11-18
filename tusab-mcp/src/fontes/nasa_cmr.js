// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de nasa_cmr.py: catálogo de coleções de dados de satélite (NASA
// Earthdata CMR), sem chave — resumo real de cada dataset.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "nasa_cmr",
  "nome": "NASA Earthdata",
  "area": "terra",
  "descricao": "Catálogo de coleções de dados de satélites e sensores — resumo real de cada dataset.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://cmr.earthdata.nasa.gov/search/collections.json';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { keyword: query, page_size: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.feed?.entry || [];

  const extrair = (item) => {
    const resumo = String(item.summary || '').trim();
    if (!resumo) return null;
    const links = item.links?.length ? item.links : [{}];
    return { titulo: item.title || 'Sem título', texto: resumo, url_origem: links[0]?.href ?? '' };
  };

  return executarBuscaGenerica(itens, extrair, 'nasa_cmr', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}
