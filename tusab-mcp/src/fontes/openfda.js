// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de openfda.py: bulários de medicamentos aprovados pela FDA, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "openfda",
  "nome": "openFDA",
  "area": "saude",
  "descricao": "Bulários de medicamentos aprovados pela FDA (indicações, uso, avisos).",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.fda.gov/drug/label.json';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, {
    params: { search: `indications_and_usage:${query}`, limit: max }, timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.results || [];

  const extrair = (item) => {
    const lista = item.indications_and_usage || [];
    const texto = lista.length ? lista[0] : '';
    if (!texto) return null;
    const openfda = item.openfda || {};
    const nomes = (openfda.brand_name?.length && openfda.brand_name)
      || (openfda.generic_name?.length && openfda.generic_name) || ['Sem título'];
    const setId = item.set_id ?? '';
    return {
      titulo: nomes[0],
      texto,
      url_origem: setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'openfda', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
