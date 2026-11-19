// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de bcb.py: portal de dados abertos do Banco Central do Brasil (CKAN),
// sem chave. O campo "notes" traz a descrição real de cada conjunto.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "bcb",
  "nome": "Banco Central do Brasil",
  "area": "economia",
  "descricao": "Conjuntos de dados econômicos e monetários — séries, relatórios e estatísticas do BCB.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://dadosabertos.bcb.gov.br/api/3/action/package_search';

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
    return {
      titulo: item.title || 'Sem título',
      texto,
      url_origem: nome ? `https://dadosabertos.bcb.gov.br/dataset/${nome}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'bcb', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
