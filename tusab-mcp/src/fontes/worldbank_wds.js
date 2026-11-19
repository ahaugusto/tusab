// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de worldbank_wds.py: Banco Mundial — Documents & Reports (API WDS v3),
// sem chave — abstract e texto integral. Documentos de aquisição/licitação são
// descartados (administrativos, quase sempre sem abstract).

import { dataIso } from '../nucleo/caminhos.js';
import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, fatiar, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "worldbank_wds",
  "nome": "Banco Mundial — Documents & Reports",
  "area": "economia",
  "descricao": "Relatórios, working papers e estudos do Banco Mundial — abstract e texto integral.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const API_URL = 'https://search.worldbank.org/api/v3/wds';
const CAMPOS = 'display_title,abstracts,docdt,txturl,docty,url,lang';
const LIMITE_TEXTO_INTEGRAL = 200_000;
const RE_TIPO_PROCUREMENT = /procurement|contract award|bid evaluation|invitation for bids|expression of interest|request for proposals?/i;

const https = (url) => String(url || '').replace(/^http:\/\//, 'https://');
const ehProcurement = (doc) => RE_TIPO_PROCUREMENT.test(doc.docty || '');

export function abstractDe(doc) {
  const a = doc.abstracts;
  if (a && typeof a === 'object' && !Array.isArray(a)) return String(a['cdata!'] || '').trim();
  return '';
}

/** Melhor esforço — "" se falhar ou se não vier texto puro. */
async function baixarTextoIntegral(url) {
  if (!url) return '';
  try {
    const resp = await obter(https(url), { headers: HEADERS_TUSABBOT, timeout: [10, 60] });
    resp.raise_for_status();
    if (!(resp.headers.get('content-type') || '').toLowerCase().includes('text/plain')) return '';
    return fatiar(resp.textoUtf8.trim(), 0, LIMITE_TEXTO_INTEGRAL);
  } catch {
    return '';
  }
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const params = { format: 'json', qterm: query, rows: max * 4, os: 0, fl: CAMPOS };
  if (data_inicio || data_fim) {
    params.strdate = data_inicio || '1900-01-01';
    params.enddate = data_fim || dataIso();
  }

  const resp = await obter(API_URL, { params, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const documentos = exigirJson(resp, FONTE_META.nome)?.documents || {};

  const itens = Object.entries(documentos)
    .filter(([chave, doc]) => chave !== 'facets' && doc && typeof doc === 'object' && !Array.isArray(doc)
      && !ehProcurement(doc) && abstractDe(doc))
    .map(([, doc]) => doc)
    .slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (doc) => {
    const resumo = abstractDe(doc);
    if (!resumo) return null;
    // Abstract sempre primeiro; metadado curto logo depois.
    const meta = [];
    if (doc.docty) meta.push(`Tipo: ${doc.docty}`);
    if (doc.docdt) meta.push(`Data: ${String(doc.docdt).slice(0, 10)}`);
    if (doc.lang) meta.push(`Idioma: ${doc.lang}`);
    let texto = resumo + (meta.length ? `\n\n${meta.join('\n')}` : '');
    const integral = await baixarTextoIntegral(doc.txturl);
    if (integral) texto += `\n\n--- TEXTO INTEGRAL ---\n${integral}`;
    return { titulo: String(doc.display_title || 'Sem título').trim(), texto, url_origem: https(doc.url) };
  };

  return executarBuscaGenerica(itens, extrair, 'worldbank_wds', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
