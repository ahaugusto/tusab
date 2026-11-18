// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de camara.py: proposições legislativas federais (Dados Abertos da
// Câmara dos Deputados), sem chave — ementa e, quando houver, inteiro teor em PDF.

import { executarBuscaGenerica, fatiar, limitarMax, obter, pastaDocumentos } from './_base.js';
import { extrairTextoPdf } from './_pdf.js';

export const FONTE_META = {
  "id": "camara",
  "nome": "Câmara dos Deputados",
  "area": "direito",
  "descricao": "Proposições legislativas federais — inteiro teor em PDF quando disponível.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes';
const DETAIL_URL = 'https://dadosabertos.camara.leg.br/api/v2/proposicoes/';
const MAX_PAGINAS_PDF = 20; // teto defensivo — proposições muito longas (ex: LOA) não precisam entrar inteiras
const MAX_CHARS_TEOR = 15_000;

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, {
    params: { keywords: query, itens: max, ordem: 'DESC', ordenarPor: 'id' },
    headers: { Accept: 'application/json' },
    timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.dados || [];

  const extrair = async (item) => {
    const ementa = String(item.ementa || '').trim();
    let texto = ementa;
    // Melhor esforço: inteiro teor em PDF. Se qualquer etapa falhar, fica a ementa.
    try {
      const detalhe = (await obter(DETAIL_URL + item.id, { timeout: [10, 30] })).json()?.dados || {};
      const urlPdf = detalhe.urlInteiroTeor;
      if (urlPdf) {
        const pdfResp = await obter(urlPdf, { timeout: [30, 30] });
        if (pdfResp.ok && (pdfResp.headers.get('content-type') || '').toLowerCase().includes('pdf')) {
          const teor = await extrairTextoPdf(pdfResp.conteudo, { maxPaginas: MAX_PAGINAS_PDF, juntarHifen: false });
          if (teor.trim()) texto = `${ementa}\n\n--- INTEIRO TEOR ---\n\n${fatiar(teor, 0, MAX_CHARS_TEOR)}`;
        }
      }
    } catch { /* volta para a ementa sozinha */ }

    if (!texto.trim()) return null;
    const titulo = `${item.siglaTipo ?? ''} ${item.numero ?? ''}/${item.ano ?? ''}`.trim() || 'Proposição';
    return { titulo, texto, url_origem: item.uri ?? '' };
  };

  return executarBuscaGenerica(itens, extrair, 'camara', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}
