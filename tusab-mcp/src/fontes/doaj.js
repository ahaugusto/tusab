// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de doaj.py: Directory of Open Access Journals — artigos de acesso
// aberto com abstract, sem chave. O termo vai no caminho da URL.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos, quote } from './_base.js';

export const FONTE_META = {
  "id": "doaj",
  "nome": "DOAJ",
  "area": "geral",
  "descricao": "Diretório de periódicos e artigos de acesso aberto.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://doaj.org/api/search/articles/';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL + quote(query), { params: { pageSize: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.results || [];

  const extrair = (item) => {
    const bib = item.bibjson || {};
    const texto = bib.abstract || '';
    if (!texto) return null;
    const links = bib.link || [];
    return { titulo: bib.title ?? 'Sem título', texto, url_origem: links.length ? (links[0]?.url ?? '') : '' };
  };

  return executarBuscaGenerica(itens, extrair, 'doaj', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
