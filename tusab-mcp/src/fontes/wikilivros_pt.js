// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de wikilivros_pt.py: Wikilivros em português (pt.wikibooks.org), sem
// chave — livros didáticos abertos, texto integral de cada capítulo.

import { limitarMax, pastaDocumentos } from './_base.js';
import { buscarMediawiki } from './_mediawiki.js';

export const FONTE_META = {
  "id": "wikilivros_pt",
  "nome": "Wikilivros (PT)",
  "area": "educacao",
  "descricao": "Livros didáticos abertos em português — texto integral de cada capítulo.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://pt.wikibooks.org/w/api.php';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarMediawiki(API_URL, FONTE_META.id, FONTE_META.nome, query, limitarMax(max_resultados), pastaDocumentos(raiz, projeto_nome), {
    evento_cancelar, dispatch_event,
  });
}
