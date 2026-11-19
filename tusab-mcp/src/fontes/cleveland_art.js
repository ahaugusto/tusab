// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de cleveland_art.py: coleção aberta (CC0) do Cleveland Museum of Art,
// sem chave — texto curatorial de cada obra.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, htmlParaTexto, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "cleveland_art",
  "nome": "Cleveland Museum of Art",
  "area": "patrimonio",
  "descricao": "Coleção aberta (CC0) do museu de Cleveland — texto curatorial de cada obra.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://openaccess-api.clevelandart.org/api/artworks/';

function comoTexto(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean).map((v) => String(v).trim()).join('; ');
  return typeof valor === 'string' ? valor.trim() : '';
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, {
    params: { q: query, limit: max, has_image: 1 }, headers: HEADERS_TUSABBOT, timeout: [10, 30],
  });
  resp.raise_for_status();
  const itens = (exigirJson(resp, FONTE_META.nome)?.data || []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (obra) => {
    const descricao = htmlParaTexto(obra.description || '');
    if (!descricao) return null;
    const contexto = [];
    for (const [rotulo, campo] of [['Ficha', 'tombstone'], ['Cultura', 'culture'], ['Técnica', 'technique']]) {
      const valor = comoTexto(obra[campo]);
      if (valor) contexto.push(`${rotulo}: ${valor}`);
    }
    const texto = descricao + (contexto.length ? `\n\n${contexto.join('\n')}` : '');
    return { titulo: String(obra.title || 'Sem título').trim(), texto, url_origem: obra.url || '' };
  };

  return executarBuscaGenerica(itens, extrair, 'cleveland_art', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}
