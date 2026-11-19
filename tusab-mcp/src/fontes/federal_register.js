// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de federal_register.py: diário oficial do governo federal dos EUA, sem
// chave — resumo e texto integral (versão HTML do GovInfo) de regras e avisos.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, fatiar, htmlParaTexto, limitarMax, obter, pastaDocumentos,
  resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "federal_register",
  "nome": "Federal Register (EUA)",
  "area": "direito",
  "descricao": "Diário oficial do governo federal dos EUA — resumo e texto integral de regras e avisos.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const API_URL = 'https://www.federalregister.gov/api/v1/documents.json';
const CAMPOS = ['title', 'abstract', 'html_url', 'pdf_url', 'publication_date', 'type'];
const LIMITE_TEXTO_INTEGRAL = 200_000;
const RE_PDF_GOVINFO = /^(https:\/\/www\.govinfo\.gov\/content\/pkg\/FR-[\d-]+)\/pdf\/([^/]+)\.pdf$/;

/** pdf_url do GovInfo → versão HTML equivalente; "" se não reconhecer. */
export function urlHtmlGovinfo(pdfUrl) {
  const m = RE_PDF_GOVINFO.exec(String(pdfUrl || '').trim());
  return m ? `${m[1]}/html/${m[2]}.htm` : '';
}

/** Melhor esforço — "" se falhar ou se não vier HTML. */
async function baixarTextoIntegral(pdfUrl) {
  const url = urlHtmlGovinfo(pdfUrl);
  if (!url) return '';
  try {
    const resp = await obter(url, { headers: HEADERS_TUSABBOT, timeout: [10, 60] });
    resp.raise_for_status();
    if (!(resp.headers.get('content-type') || '').toLowerCase().includes('html')) return '';
    return fatiar(htmlParaTexto(resp.texto), 0, LIMITE_TEXTO_INTEGRAL);
  } catch {
    return '';
  }
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const params = [['conditions[term]', query], ['per_page', max], ...CAMPOS.map((c) => ['fields[]', c])];
  if (data_inicio) params.push(['conditions[publication_date][gte]', data_inicio]);
  if (data_fim) params.push(['conditions[publication_date][lte]', data_fim]);

  const resp = await obter(API_URL, { params, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const itens = (exigirJson(resp, FONTE_META.nome)?.results || []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (doc) => {
    const resumo = String(doc.abstract || '').trim();
    const integral = await baixarTextoIntegral(doc.pdf_url);
    if (!resumo && !integral) return null;
    const meta = [];
    if (doc.type) meta.push(`Tipo: ${doc.type}`);
    if (doc.publication_date) meta.push(`Publicação: ${doc.publication_date}`);
    let texto = resumo;
    if (meta.length) texto = (texto ? `${texto}\n\n` : '') + meta.join('\n');
    if (integral) texto += `\n\n--- TEXTO INTEGRAL ---\n${integral}`;
    return { titulo: String(doc.title || 'Sem título').trim(), texto, url_origem: doc.html_url || '' };
  };

  return executarBuscaGenerica(itens, extrair, 'federal_register', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
