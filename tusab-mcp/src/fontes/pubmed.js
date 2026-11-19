// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de pubmed.py: literatura médica e biomédica (NCBI/Entrez), sem chave —
// esearch (JSON) para os ids e efetch (XML) em lote para os abstracts.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';
import { fromstring } from './_xml.js';

export const FONTE_META = {
  "id": "pubmed",
  "nome": "PubMed",
  "area": "saude",
  "descricao": "Literatura médica e biomédica (NCBI/Entrez) — abstract completo.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

/** Abstract pode vir em várias seções (Background/Methods/...) — concatena todas. */
export function extrairArtigo(article) {
  const partes = article.findall('.//AbstractText').map((el) => el.text || '');
  const abstract = partes.filter(Boolean).join(' ').trim();
  if (!abstract) return null;
  const titulo = article.findtext('.//ArticleTitle') || 'Sem título';
  const pmid = article.findtext('.//PMID') || '';
  return { titulo, texto: abstract, url_origem: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '' };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(ESEARCH_URL, { params: { db: 'pubmed', term: query, retmax: max, retmode: 'json' }, timeout: [10, 45] });
  resp.raise_for_status();
  const ids = resp.json()?.esearchresult?.idlist || [];

  let itens = [];
  if (ids.length) {
    const resp2 = await obter(EFETCH_URL, {
      params: { db: 'pubmed', id: ids.join(','), rettype: 'abstract', retmode: 'xml' }, timeout: [10, 45],
    });
    resp2.raise_for_status();
    itens = fromstring(resp2.conteudo).findall('.//PubmedArticle');
  }

  // Sem chamada de rede por item (efetch já veio em lote) — sem throttle.
  return executarBuscaGenerica(itens, extrairArtigo, 'pubmed', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
