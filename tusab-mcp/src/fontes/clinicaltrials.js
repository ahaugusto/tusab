// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de clinicaltrials.py: registro mundial de ensaios clínicos (NIH/NLM),
// sem chave — resumo e descrição detalhada. query.term é a busca geral (mais
// abrangente que query.cond), confirmado ao vivo.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "clinicaltrials",
  "nome": "ClinicalTrials.gov",
  "area": "saude",
  "descricao": "Registro mundial de ensaios clínicos (NIH/NLM) — resumo e descrição detalhada.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { 'query.term': query, pageSize: max }, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.studies || [];

  const extrair = (item) => {
    const proto = item.protocolSection || {};
    const ident = proto.identificationModule || {};
    const desc = proto.descriptionModule || {};
    const partes = [];
    if (desc.briefSummary) partes.push(desc.briefSummary);
    if (desc.detailedDescription) partes.push(desc.detailedDescription);
    const texto = partes.join('\n\n');
    if (!texto.trim()) return null;
    const nctId = ident.nctId ?? '';
    return {
      titulo: ident.briefTitle || ident.officialTitle || 'Sem título',
      texto,
      url_origem: nctId ? `https://clinicaltrials.gov/study/${nctId}` : '',
    };
  };

  return executarBuscaGenerica(itens, extrair, 'clinicaltrials', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}
