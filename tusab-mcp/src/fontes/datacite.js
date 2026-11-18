// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de datacite.py: DOIs de datasets, software e produção de pesquisa, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "datacite",
  "nome": "DataCite",
  "area": "geral",
  "descricao": "DOIs de datasets, software e produção de pesquisa.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.datacite.org/dois';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { query, 'page[size]': max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.data || [];

  const extrair = (item) => {
    const attrs = item.attributes || {};
    const descricoes = attrs.descriptions || [];
    let texto = descricoes.find((d) => d?.descriptionType === 'Abstract')?.description ?? '';
    if (!texto && descricoes.length) texto = descricoes[0]?.description ?? '';
    if (!texto) return null;
    const titulos = attrs.titles?.length ? attrs.titles : [{}];
    return { titulo: titulos[0]?.title ?? 'Sem título', texto, url_origem: attrs.url || (attrs.doi ?? '') };
  };

  return executarBuscaGenerica(itens, extrair, 'datacite', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
