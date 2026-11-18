// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de uniprot.py: sequências e funções de proteínas (UniProtKB), sem chave.
// O texto salvo é o comentário FUNCTION de cada entrada.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "uniprot",
  "nome": "UniProt",
  "area": "saude",
  "descricao": "Sequências e funções biológicas de proteínas.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://rest.uniprot.org/uniprotkb/search';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { query, size: max, format: 'json' }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.results || [];

  const extrair = (item) => {
    const funcao = (item.comments || []).find((c) => c?.commentType === 'FUNCTION');
    if (!funcao) return null;
    const descricao = (funcao.texts || []).filter((t) => t?.value).map((t) => t.value).join(' ').trim();
    if (!descricao) return null;
    const nome = item.proteinDescription?.recommendedName?.fullName?.value || (item.primaryAccession ?? 'Sem título');
    const acc = item.primaryAccession ?? '';
    return { titulo: nome, texto: descricao, url_origem: acc ? `https://www.uniprot.org/uniprotkb/${acc}` : '' };
  };

  return executarBuscaGenerica(itens, extrair, 'uniprot', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}
