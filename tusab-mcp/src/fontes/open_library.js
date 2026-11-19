// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de open_library.py: metadados e descrições de livros (Internet Archive),
// sem chave. A descrição vem do registro da obra (/works/{id}.json).

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "open_library",
  "nome": "Open Library",
  "area": "geral",
  "descricao": "Metadados e descrições de livros — projeto da Internet Archive.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://openlibrary.org/search.json';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, { params: { q: query, limit: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.docs || [];

  const extrair = async (item) => {
    const key = item.key ?? '';
    if (!key) return null;
    const detalhe = await obter(`https://openlibrary.org${key}.json`, { timeout: [10, 30] });
    detalhe.raise_for_status();
    let desc = detalhe.json()?.description;
    if (desc && typeof desc === 'object') desc = desc.value ?? '';
    if (!desc) return null;
    return { titulo: item.title ?? 'Sem título', texto: desc, url_origem: `https://openlibrary.org${key}` };
  };

  return executarBuscaGenerica(itens, extrair, 'open_library', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
