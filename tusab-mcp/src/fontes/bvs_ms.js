// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de bvs_ms.py: notas temáticas da Biblioteca Virtual em Saúde do
// Ministério da Saúde (WordPress REST), sem chave — texto completo em português.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, htmlParaTexto, limitarMax, obter, pastaDocumentos,
  resultadoVazio, unescapeHtml,
} from './_base.js';

export const FONTE_META = {
  "id": "bvs_ms",
  "nome": "BVS Ministério da Saúde",
  "area": "saude",
  "descricao": "Notas temáticas da Biblioteca Virtual em Saúde do Ministério da Saúde — texto completo em português.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://bvsms.saude.gov.br/wp-json/wp/v2/posts';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  // per_page do WordPress aceita até 100; o teto do projeto é menor.
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, { headers: HEADERS_TUSABBOT, params: { search: query, per_page: max }, timeout: [10, 30] });
  resp.raise_for_status();
  const posts = exigirJson(resp, FONTE_META.nome);
  if (!Array.isArray(posts) || !posts.length) return resultadoVazio();

  const extrair = (post) => {
    const texto = htmlParaTexto(post.content?.rendered ?? '');
    if (!texto) return null;
    const titulo = unescapeHtml(post.title?.rendered ?? '').trim() || 'Sem título';
    return { titulo, texto, url_origem: post.link ?? '' };
  };

  return executarBuscaGenerica(posts, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
