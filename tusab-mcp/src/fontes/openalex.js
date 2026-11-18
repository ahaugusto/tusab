// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de openalex.py: catálogo aberto da produção científica global, sem
// chave. Aceita filtro de autor e de período.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "openalex",
  "nome": "OpenAlex",
  "area": "geral",
  "descricao": "Catálogo aberto da produção científica global (~322mi de trabalhos).",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": true
};

const BASE_URL = 'https://api.openalex.org/works';

/** OpenAlex devolve o abstract como {palavra: [posições]} — reconstrói a ordem original. */
export function reconstruirAbstract(invertido) {
  if (!invertido || typeof invertido !== 'object' || !Object.keys(invertido).length) return '';
  const posicoes = new Map();
  for (const [palavra, idxs] of Object.entries(invertido)) for (const i of idxs || []) posicoes.set(i, palavra);
  return [...posicoes.keys()].sort((a, b) => a - b).map((i) => posicoes.get(i)).join(' ');
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', autor = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const filtros = [`fulltext.search:${query}`];
  if (autor.trim()) filtros.push(`authorships.author.display_name.search:${autor.trim()}`);
  if (data_inicio) filtros.push(`from_publication_date:${data_inicio}`);
  if (data_fim) filtros.push(`to_publication_date:${data_fim}`);

  const resp = await obter(BASE_URL, { params: { filter: filtros.join(','), 'per-page': max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.results || [];

  const extrair = (item) => {
    const abstract = reconstruirAbstract(item.abstract_inverted_index);
    if (!abstract) return null; // sem abstract — baixo valor pra RAG, pula
    return { titulo: item.title || item.display_name || 'Sem título', texto: abstract, url_origem: item.id ?? '' };
  };

  return executarBuscaGenerica(itens, extrair, 'openalex', docDir, { evento_cancelar, dispatch_event, throttle: 0.2 });
}
