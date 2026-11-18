// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de oasisbr.py: Portal Brasileiro de Publicações e Dados Científicos em
// Acesso Aberto (IBICT, VuFind), sem chave. API lenta (2 a 9 s): leitura de 45 s.

import { limitarMax, pastaDocumentos } from './_base.js';
import { buscarVufind } from './_vufind.js';

export const FONTE_META = {
  "id": "oasisbr",
  "nome": "OasisBR (IBICT)",
  "area": "educacao",
  "descricao": "Artigos e periódicos científicos brasileiros em acesso aberto — resumo real de cada publicação.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://oasisbr.ibict.br';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarVufind(BASE_URL, FONTE_META.id, FONTE_META.nome, query, limitarMax(max_resultados), pastaDocumentos(raiz, projeto_nome), {
    timeout: [10, 45], evento_cancelar, dispatch_event,
  });
}
