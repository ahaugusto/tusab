// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de zenodo.py: repositório do CERN/OpenAIRE — datasets, código e
// artefatos com DOI, sem chave. A descrição vem em HTML.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "zenodo",
  "nome": "Zenodo",
  "area": "geral",
  "descricao": "Repositório do CERN/OpenAIRE — datasets, código e artefatos com DOI.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://zenodo.org/api/records';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, size: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.hits?.hits || [];

  const extrair = (item) => {
    const meta = item.metadata || {};
    const texto = String(meta.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!texto) return null;
    return { titulo: meta.title ?? 'Sem título', texto, url_origem: item.links?.self_html ?? '' };
  };

  return executarBuscaGenerica(itens, extrair, 'zenodo', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
