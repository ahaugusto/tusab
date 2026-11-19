// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de hacker_news.py: discussões Ask HN/Show HN pela API Algolia, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "hacker_news",
  "nome": "Hacker News",
  "area": "tecnologia",
  "descricao": "Discussões Ask HN/Show HN — comunidade de tecnologia e startups.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://hn.algolia.com/api/v1/search';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, {
    params: { query, tags: '(ask_hn,show_hn)', hitsPerPage: max }, timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.hits || [];

  const extrair = (item) => {
    const texto = item.story_text || '';
    if (!texto) return null;
    const objectId = item.objectID ?? '';
    return {
      titulo: item.title ?? 'Sem título',
      texto,
      url_origem: objectId ? `https://news.ycombinator.com/item?id=${objectId}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'hacker_news', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
