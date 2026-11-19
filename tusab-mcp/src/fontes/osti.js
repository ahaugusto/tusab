// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de osti.py: OSTI.gov (Departamento de Energia dos EUA), sem chave —
// relatórios técnicos e artigos de pesquisa financiada pelo DOE.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "osti",
  "nome": "OSTI.gov (Departamento de Energia dos EUA)",
  "area": "fisica",
  "descricao": "Relatórios técnicos e artigos de pesquisa financiada pelo DOE — resumo real de cada registro.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://www.osti.gov/api/v1/records';
const HEADERS = { ...HEADERS_TUSABBOT, Accept: 'application/json' };

function urlCitacao(item) {
  for (const link of item.links || []) {
    if (link?.rel === 'citation' && link.href) return link.href;
  }
  return item.osti_id ? `https://www.osti.gov/biblio/${item.osti_id}` : '';
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, { params: { q: query, rows: max }, headers: HEADERS, timeout: [10, 30] });
  resp.raise_for_status();
  const dados = exigirJson(resp, FONTE_META.nome);
  const itens = (Array.isArray(dados) ? dados : []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (item) => {
    const resumo = String(item.description || '').trim();
    if (!resumo) return null;
    return { titulo: String(item.title || 'Sem título').trim(), texto: resumo, url_origem: urlCitacao(item) };
  };

  return executarBuscaGenerica(itens, extrair, 'osti', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
