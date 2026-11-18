// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de the_met.py: coleção do Metropolitan Museum of Art (+470 mil obras),
// sem chave — metadado curatorial (cultura, período, meio).

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "the_met",
  "nome": "The Metropolitan Museum of Art",
  "area": "patrimonio",
  "descricao": "Coleção de +470 mil obras — metadado curatorial (cultura, período, meio).",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://collectionapi.metmuseum.org/public/collection/v1/search';
const OBJECT_URL = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';

const CAMPOS = [
  ['Nome do objeto', 'objectName'], ['Cultura', 'culture'], ['Período', 'period'],
  ['Data', 'objectDate'], ['Meio', 'medium'], ['Dimensões', 'dimensions'],
  ['Origem', 'creditLine'], ['Classificação', 'classification'],
];

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, { params: { q: query, hasImages: 'true' }, timeout: [10, 45] });
  resp.raise_for_status();
  const ids = (resp.json()?.objectIDs || []).slice(0, max);

  const extrair = async (objectId) => {
    let detalhe;
    try {
      detalhe = (await obter(OBJECT_URL + objectId, { timeout: [10, 20] })).json();
    } catch {
      return null;
    }
    const partes = [];
    for (const [rotulo, campo] of CAMPOS) {
      const valor = detalhe?.[campo];
      if (valor) partes.push(`${rotulo}: ${valor}`);
    }
    if (!partes.length) return null;
    return { titulo: detalhe.title || 'Sem título', texto: partes.join('\n'), url_origem: detalhe.objectURL ?? '' };
  };

  return executarBuscaGenerica(ids, extrair, 'the_met', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}
