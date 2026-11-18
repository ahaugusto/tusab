// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de gutenberg.py: livros integrais em domínio público do Project
// Gutenberg, sem chave. Busca pelo feed OPDS (Atom XML) e baixa o .txt de
// cada livro, sem o cabeçalho e o rodapé de licença. Até 10 livros por busca.

import {
  HEADERS_TUSABBOT, colapsarEspacos, executarBuscaGenerica, fatiar, obter, pastaDocumentos, resultadoVazio,
  MAX_RESULTADOS_PERMITIDO,
} from './_base.js';
import { fromstring } from './_xml.js';

export const FONTE_META = {
  "id": "gutenberg",
  "nome": "Project Gutenberg",
  "area": "patrimonio",
  "descricao": "Livros integrais em domínio público — texto completo de cada obra (até 10 por busca).",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BUSCA_URL = 'https://www.gutenberg.org/ebooks/search.opds/';
const MAX_LIVROS_POR_BUSCA = 10;
const THROTTLE_SEGUNDOS = 2.0;
const LIMITE_TEXTO_INTEGRAL = 200_000;

const RE_ID_LIVRO = /\/ebooks\/(\d+)\.opds$/;
const RE_INICIO = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$/im;
const RE_FIM = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$/im;
const RE_SO_DOWNLOADS = /^\d+\s+downloads?$/i;

/** Corta o cabeçalho (antes de *** START ...) e o rodapé de licença (a partir de *** END ...). */
export function removerLicencaGutenberg(texto) {
  let t = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const inicio = RE_INICIO.exec(t);
  if (inicio) t = t.slice(inicio.index + inicio[0].length);
  const fim = RE_FIM.exec(t);
  if (fim) t = t.slice(0, fim.index);
  return t.trim();
}

/** Entradas de livro do feed OPDS: [{id, titulo, autor}], sem as entradas de navegação. */
export function livrosDoFeed(xml) {
  const raiz = fromstring(xml);
  const livros = [];
  for (const entrada of raiz.findall('entry')) {
    const m = RE_ID_LIVRO.exec((entrada.findtext('id', '') || '').trim());
    if (!m) continue;
    const titulo = colapsarEspacos(entrada.findtext('title', '') || '');
    let autor = colapsarEspacos(entrada.findtext('content', '') || '');
    if (RE_SO_DOWNLOADS.test(autor)) autor = '';
    livros.push({ id: m[1], titulo: titulo || 'Sem título', autor });
  }
  return livros;
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const n = Math.trunc(Number(max_resultados));
  const max = Math.max(1, Math.min(Number.isFinite(n) ? n : 1, MAX_RESULTADOS_PERMITIDO, MAX_LIVROS_POR_BUSCA));
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BUSCA_URL, { params: { query }, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  resp.raise_for_status();
  const tipo = (resp.headers.get('content-type') || '').toLowerCase();
  if (!tipo.includes('xml')) {
    throw new Error(`${FONTE_META.nome} respondeu ${tipo || 'sem tipo'} em vez de XML (bloqueio ou manutenção no servidor de origem)`);
  }
  const livros = livrosDoFeed(resp.conteudo).slice(0, max);
  if (!livros.length) return resultadoVazio();

  const extrair = async (livro) => {
    const r = await obter(`https://www.gutenberg.org/cache/epub/${livro.id}/pg${livro.id}.txt`, {
      headers: HEADERS_TUSABBOT, timeout: [10, 60],
    });
    if (r.status === 404) return null; // livro sem versão .txt (ex.: só áudio)
    r.raise_for_status();
    let corpo = removerLicencaGutenberg(r.textoUtf8);
    if (!corpo) return null;
    corpo = fatiar(corpo, 0, LIMITE_TEXTO_INTEGRAL);
    const texto = (livro.autor ? `Autor: ${livro.autor}\n\n` : '') + corpo;
    return { titulo: livro.titulo, texto, url_origem: `https://www.gutenberg.org/ebooks/${livro.id}` };
  };

  return executarBuscaGenerica(livros, extrair, 'gutenberg', docDir, { evento_cancelar, dispatch_event, throttle: THROTTLE_SEGUNDOS });
}
