// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de bdtd.py: Biblioteca Digital Brasileira de Teses e Dissertações
// (IBICT, VuFind), sem chave. O texto salvo é o resumo (PT + abstract EN).

import { limitarMax, pastaDocumentos } from './_base.js';
import { buscarVufind } from './_vufind.js';

export const FONTE_META = {
  "id": "bdtd",
  "nome": "BDTD — Teses e Dissertações (IBICT)",
  "area": "educacao",
  "descricao": "Teses e dissertações de universidades de todo o Brasil — resumo real de cada trabalho.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://bdtd.ibict.br';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarVufind(BASE_URL, FONTE_META.id, FONTE_META.nome, query, limitarMax(max_resultados), pastaDocumentos(raiz, projeto_nome), {
    timeout: [10, 30], evento_cancelar, dispatch_event,
  });
}
