// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de wikiversidade_pt.py: Wikiversidade em português (pt.wikiversity.org),
// sem chave — cursos e aulas abertos, texto integral de cada página.

import { limitarMax, pastaDocumentos } from './_base.js';
import { buscarMediawiki } from './_mediawiki.js';

export const FONTE_META = {
  "id": "wikiversidade_pt",
  "nome": "Wikiversidade (PT)",
  "area": "educacao",
  "descricao": "Cursos, aulas e materiais didáticos abertos em português — texto integral de cada página.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://pt.wikiversity.org/w/api.php';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarMediawiki(API_URL, FONTE_META.id, FONTE_META.nome, query, limitarMax(max_resultados), pastaDocumentos(raiz, projeto_nome), {
    evento_cancelar, dispatch_event,
  });
}
