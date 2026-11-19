// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de data_europa_eu.py: Portal de Dados Abertos da União Europeia, sem
// chave. Título e descrição vêm como dict multilíngue {"en": ..., "pt": ...}.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "data_europa_eu",
  "nome": "data.europa.eu",
  "area": "dados",
  "descricao": "Portal de dados abertos da União Europeia — datasets de instituições e países-membros.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://data.europa.eu/api/hub/search/search';

/** Nem todo registro tem o idioma preferido — cai pro primeiro disponível. */
export function textoMultilingue(campo, idiomaPreferido = 'en') {
  if (campo && typeof campo === 'object' && !Array.isArray(campo)) {
    if (campo[idiomaPreferido]) return campo[idiomaPreferido];
    for (const valor of Object.values(campo)) if (valor) return valor;
    return '';
  }
  return campo || '';
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, limit: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.result?.results || [];

  const extrair = (item) => {
    const texto = textoMultilingue(item.description);
    if (!texto) return null;
    const id = item.id ?? '';
    return {
      titulo: textoMultilingue(item.title) || 'Sem título',
      texto,
      url_origem: id ? `https://data.europa.eu/data/datasets/${id}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'data_europa_eu', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
