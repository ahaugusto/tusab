// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de cern_opendata.py: conjuntos de dados de colisões do LHC (CERN Open
// Data), sem chave — descrição real de cada dataset.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "cern_opendata",
  "nome": "CERN Open Data",
  "area": "fisica",
  "descricao": "Conjuntos de dados de colisões do LHC — descrição real de cada dataset.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://opendata.cern.ch/api/records/';

const limparHtml = (texto) => String(texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, size: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.hits?.hits || [];

  const extrair = (item) => {
    const meta = item.metadata || {};
    const bruto = meta.abstract;
    const descricao = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto.description : bruto;
    const texto = limparHtml(typeof descricao === 'string' ? descricao : '');
    if (!texto) return null;
    return {
      titulo: meta.title || 'Sem título',
      texto,
      url_origem: item.id ? `https://opendata.cern.ch/record/${item.id}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'cern_opendata', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}
