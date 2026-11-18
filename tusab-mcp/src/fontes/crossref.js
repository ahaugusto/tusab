// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de crossref.py: metadados de DOIs (150M+ trabalhos), só com abstract, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "crossref",
  "nome": "Crossref",
  "area": "geral",
  "descricao": "Metadados de DOIs — 150M+ trabalhos acadêmicos de qualquer área.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.crossref.org/works';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, {
    params: { query, filter: 'has-abstract:true', rows: max }, timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.message?.items || [];

  const extrair = (item) => {
    const texto = String(item.abstract ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!texto) return null;
    const titulos = item.title || [];
    const doi = item.DOI ?? '';
    return { titulo: titulos.length ? titulos[0] : 'Sem título', texto, url_origem: doi ? `https://doi.org/${doi}` : '' };
  };

  return executarBuscaGenerica(itens, extrair, 'crossref', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
