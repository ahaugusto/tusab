// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de wikisource_pt.py: Wikisource em português, sem chave — textos
// integrais em domínio público (literatura, documentos históricos, legislação antiga).

import { limitarMax, pastaDocumentos } from './_base.js';
import { buscarMediawiki } from './_mediawiki.js';

export const FONTE_META = {
  "id": "wikisource_pt",
  "nome": "Wikisource (PT)",
  "area": "patrimonio",
  "descricao": "Textos integrais em domínio público — literatura, documentos históricos e legislação antiga.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://pt.wikisource.org/w/api.php';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarMediawiki(API_URL, FONTE_META.id, FONTE_META.nome, query, limitarMax(max_resultados), pastaDocumentos(raiz, projeto_nome), {
    evento_cancelar, dispatch_event,
  });
}
