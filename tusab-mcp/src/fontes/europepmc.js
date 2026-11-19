// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de europepmc.py: literatura biomédica do Europe PMC (EMBL-EBI), sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "europepmc",
  "nome": "Europe PMC",
  "area": "saude",
  "descricao": "Literatura biomédica com camada semântica de anotações.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  // resultType=core é obrigatório pra vir com abstractText (confirmado em teste real).
  const resp = await obter(BASE_URL, {
    params: { query, format: 'json', pageSize: max, resultType: 'core' }, timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.resultList?.result || [];

  const extrair = (item) => {
    const abstract = item.abstractText || '';
    if (!abstract) return null;
    return { titulo: item.title || 'Sem título', texto: abstract, url_origem: item.doi || (item.id ?? '') };
  };

  return executarBuscaGenerica(itens, extrair, 'europepmc', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
