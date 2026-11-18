// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de data_gov_uk.py: portal de dados abertos do governo do Reino Unido
// (CKAN, mesmo padrão do Banco Central), sem chave. "notes" traz a descrição.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "data_gov_uk",
  "nome": "data.gov.uk",
  "area": "dados",
  "descricao": "Portal de dados abertos do governo do Reino Unido — qualquer área temática.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://data.gov.uk/api/3/action/package_search';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, rows: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.result?.results || [];

  const extrair = (item) => {
    const texto = item.notes || '';
    if (!texto) return null;
    const nome = item.name || '';
    return { titulo: item.title || 'Sem título', texto, url_origem: nome ? `https://data.gov.uk/dataset/${nome}` : '' };
  };

  return executarBuscaGenerica(itens, extrair, 'data_gov_uk', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
