// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de inspire_hep.py: literatura de física de altas energias (INSPIRE —
// CERN, DESY, Fermilab, SLAC), sem chave — resumo e link do arXiv.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "inspire_hep",
  "nome": "INSPIRE-HEP",
  "area": "fisica",
  "descricao": "Literatura de física de altas energias (CERN, DESY, Fermilab, SLAC) — resumo e link do arXiv.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://inspirehep.net/api/literature';
const CAMPOS = 'titles,abstracts,arxiv_eprints,control_number';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, { params: { q: query, size: max, fields: CAMPOS }, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const hits = exigirJson(resp, FONTE_META.nome)?.hits?.hits || [];
  const itens = hits.map((h) => h?.metadata || {}).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (meta) => {
    const abstracts = meta.abstracts || [];
    const resumo = abstracts.length ? String(abstracts[0]?.value || '').trim() : '';
    if (!resumo) return null;
    const titulos = meta.titles || [];
    const titulo = String((titulos.length ? titulos[0]?.title : '') || 'Sem título').trim();
    let texto = resumo;
    const eprints = meta.arxiv_eprints || [];
    const arxivId = eprints.length ? eprints[0]?.value : '';
    if (arxivId) texto += `\n\narXiv: https://arxiv.org/abs/${arxivId}`;
    return { titulo, texto, url_origem: `https://inspirehep.net/literature/${meta.control_number ?? ''}` };
  };

  return executarBuscaGenerica(itens, extrair, 'inspire_hep', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
