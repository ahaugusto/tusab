// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de inca.py: Repositório Institucional do INCA (DSpace JSPUI), sem
// chave. A busca é a página HTML do simple-search; o resumo vem da tabela de
// metadados completa (mode=full) de cada registro.

import {
  HEADERS_TUSABBOT, dormir, executarBuscaGenerica, fatiar, htmlParaTexto, limitarMax, obter, pastaDocumentos,
  resultadoVazio,
} from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "inca",
  "nome": "INCA — Repositório Institucional",
  "area": "saude",
  "descricao": "Publicações do Instituto Nacional de Câncer (manuais, livros, artigos) — resumo de cada obra.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE = 'https://ninho.inca.gov.br/jspui';
const SEARCH_URL = `${BASE}/simple-search`;
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const MAX_CANDIDATOS = 100;

const RE_HANDLE = /href="\/jspui\/handle\/123456789\/(\d+)"/g;
const RE_TOTAL = /(?:Results?|Resultados?)\s+\d+-\d+\s+(?:of|de)\s+(\d+)/;
const RE_CAMPO = /<td[^>]*class="metadataFieldLabel"[^>]*>\s*([^<]*?)\s*<\/td>\s*<td[^>]*class="metadataFieldValue"[^>]*>(.*?)<\/td>/gs;

const unicos = (lista) => [...new Set(lista)];

/**
 * Links de registro na ordem da página. Sem links, só aceitamos "zero
 * resultados" se a página ainda for a de busca e não anunciar resultados.
 */
export function idsResultado(pagina) {
  const ids = unicos([...pagina.matchAll(RE_HANDLE)].map((m) => m[1]));
  if (!ids.length && (RE_TOTAL.test(pagina) || !pagina.includes('name="query"'))) {
    throw new Error('INCA mudou o formato da página de busca do repositório — a busca precisa ser atualizada no Tusab');
  }
  return ids;
}

export function metadados(pagina) {
  const campos = {};
  for (const [, rotulo, valor] of pagina.matchAll(RE_CAMPO)) {
    const texto = htmlParaTexto(valor);
    if (texto) (campos[rotulo.trim().toLowerCase()] ||= []).push(texto);
  }
  if (!Object.keys(campos).length) {
    throw new Error(t('INCA mudou o formato da página do registro (tabela de metadados não encontrada)'));
  }
  return campos;
}

/** Metadados DC → {titulo, texto, url_origem}, ou null sem resumo. */
export function montarDocumento(campos, url) {
  const titulos = campos['dc.title'] || [];
  const resumos = unicos(campos['dc.description.abstract'] || []);
  if (!titulos.length || !resumos.length) return null;
  const partes = [titulos[0]];
  const tipo = (campos['dc.type'] || [''])[0];
  const ano = (campos['dc.date.issued'] || [''])[0];
  if (tipo || ano) partes.push([tipo, ano].filter(Boolean).join(' · '));
  const assuntos = unicos(campos['dc.subject'] || []);
  if (assuntos.length) partes.push(`Assuntos: ${assuntos.join('; ')}`);
  partes.push(`Resumo:\n${resumos.join('\n\n')}`);
  return { titulo: titulos[0], texto: fatiar(partes.join('\n\n'), 0, MAX_CHARS), url_origem: url };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, {
    params: { query, rpp: Math.min(max * 2, MAX_CANDIDATOS), start: 0 }, headers: HEADERS_TUSABBOT, timeout: TIMEOUT,
  });
  resp.raise_for_status();
  const ids = idsResultado(resp.texto);
  if (!ids.length) return resultadoVazio();

  let salvos = 0;
  const extrair = async (itemId) => {
    // Pedimos o dobro de candidatos; ao atingir o limite, os restantes são pulados sem rede.
    if (salvos >= max) return null;
    await dormir(0.5);
    const url = `${BASE}/handle/123456789/${itemId}`;
    const r = await obter(url, { params: { mode: 'full' }, headers: HEADERS_TUSABBOT, timeout: TIMEOUT });
    r.raise_for_status();
    const doc = montarDocumento(metadados(r.texto), url);
    if (doc) salvos += 1;
    return doc;
  };

  return executarBuscaGenerica(ids, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
