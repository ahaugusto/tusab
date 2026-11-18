// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de motor/arxiv.py + fontes/arxiv_adapter.py: busca acadêmica no arXiv
// (export.arxiv.org/api/query, Atom XML, sem autenticação), baixa os PDFs e
// salva como documentos do projeto. No desktop o motor emitia eventos próprios
// ("arxiv_total"/"arxiv_processed") que o adaptador traduzia; aqui o motor já
// emite "total"/"processed" direto.
//
// Diferenças de arquivo em relação às outras fontes (mantidas do desktop):
// "Resumo: ..." logo abaixo do cabeçalho, manifest com tipo "pdf" e tamanho =
// bytes do PDF baixado, erros por item com {id, titulo, erro}.

import fs from 'node:fs';
import { dataIso } from '../nucleo/caminhos.js';
import {
  carregarManifest, dormir, limitarMax, obter, pastaDocumentos, salvarDocumento, salvarManifest,
} from './_base.js';
import { extrairTextoPdf } from './_pdf.js';
import { fromstring } from './_xml.js';

export const FONTE_META = {
  "id": "arxiv",
  "nome": "arXiv",
  "area": "geral",
  "descricao": "Preprints de física, matemática, ciência da computação e áreas correlatas.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": true
};

const ARXIV_API_URL = 'https://export.arxiv.org/api/query';
// arXiv pede um intervalo mínimo de 3s entre requisições.
const INTERVALO_ENTRE_REQUISICOES = 3;

/** Extrai {id, titulo, resumo, pdf_url, publicado} de cada <entry> do feed Atom. */
export function parsearEntradas(atomXml) {
  const root = fromstring(atomXml);
  const entradas = [];
  for (const entry of root.findall('entry')) {
    const arxivId = (entry.findtext('id', '') || '').trim();
    const titulo = (entry.findtext('title', '') || '').trim().replace(/\s+/g, ' ');
    const resumo = (entry.findtext('summary', '') || '').trim();
    const publicado = (entry.findtext('published', '') || '').slice(0, 10);
    let pdfUrl = '';
    for (const link of entry.findall('link')) {
      if (link.get('title') === 'pdf') { pdfUrl = link.get('href', ''); break; }
    }
    if (arxivId && pdfUrl) entradas.push({ id: arxivId, titulo: titulo || arxivId, resumo, pdf_url: pdfUrl, publicado });
  }
  return entradas;
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', autor = '',
  evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);
  fs.mkdirSync(docDir, { recursive: true });

  let searchQuery = `all:${query}`;
  if (autor.trim()) searchQuery = `(${searchQuery}) AND au:${autor.trim()}`;
  if (data_inicio || data_fim) {
    const ini = data_inicio ? data_inicio.replace(/-/g, '') : '19910101';
    const fim = data_fim ? data_fim.replace(/-/g, '') : dataIso().replace(/-/g, '');
    searchQuery = `(${searchQuery}) AND submittedDate:[${ini} TO ${fim}]`;
  }

  // (connect, read) — a busca do arXiv pode legitimamente passar de 30 s.
  const resp = await obter(ARXIV_API_URL, {
    params: { search_query: searchQuery, start: 0, max_results: max }, timeout: [10, 45],
  });
  resp.raise_for_status();
  const entradas = parsearEntradas(resp.conteudo);

  if (dispatch_event) dispatch_event('total', { total: entradas.length });

  const [manifest, manifestPath] = carregarManifest(docDir);
  let totalSalvos = 0;
  const erros = [];

  for (let i = 0; i < entradas.length; i++) {
    if (evento_cancelar && evento_cancelar.is_set()) break;
    const item = entradas[i];
    try {
      const pdfResp = await obter(item.pdf_url, { timeout: [60, 60] });
      pdfResp.raise_for_status();
      let texto = await extrairTextoPdf(pdfResp.conteudo);
      if (!texto.trim()) {
        // PDF sem camada de texto — registra com aviso em vez de descartar.
        texto = `[PDF registrado sem extração de texto — possível documento escaneado]\nFonte: arXiv (${item.id})\n`;
      }
      const entry = salvarDocumento(docDir, 'arxiv', item.titulo, texto, item.id, {
        tipo: 'pdf', tamanhoBytes: pdfResp.conteudo.length, cabecalhoExtra: item.resumo ? `Resumo: ${item.resumo}\n\n` : '',
      });
      manifest.push(entry);
      totalSalvos += 1;
      if (dispatch_event) dispatch_event('processed', { processed: totalSalvos, total: entradas.length, titulo: item.titulo });
    } catch (e) {
      erros.push({ id: item.id ?? '?', titulo: item.titulo ?? '?', erro: String(e?.message ?? e) });
    }
    // Throttle entre requisições — não aplicar após o último item
    if (i < entradas.length - 1) await dormir(INTERVALO_ENTRE_REQUISICOES);
  }

  salvarManifest(manifest, manifestPath);
  return { ok: true, total_encontrados: entradas.length, total_salvos: totalSalvos, erros };
}
