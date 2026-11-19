// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de art_institute_chicago.py: coleção do Art Institute of Chicago com
// descrição curatorial narrativa real, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "art_institute_chicago",
  "nome": "Art Institute of Chicago",
  "area": "patrimonio",
  "descricao": "Coleção de obras com descrição curatorial narrativa real.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.artic.edu/api/v1/artworks/search';

const limparHtml = (texto) => String(texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, limit: max, fields: 'id,title,description' }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.data || [];

  const extrair = (item) => {
    const texto = limparHtml(item.description);
    if (!texto) return null;
    return {
      titulo: item.title || 'Sem título',
      texto,
      url_origem: item.id ? `https://www.artic.edu/artworks/${item.id}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'art_institute_chicago', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}
