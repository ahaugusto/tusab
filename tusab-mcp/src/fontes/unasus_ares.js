// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de unasus_ares.py: Acervo de Recursos Educacionais em Saúde da UNA-SUS
// (DSpace 7), sem chave — materiais educacionais e TCCs de atenção primária.

import { HEADERS_TUSABBOT, pastaDocumentos } from './_base.js';
import { buscarDspace7 } from './_dspace7.js';

export const FONTE_META = {
  "id": "unasus_ares",
  "nome": "UNA-SUS ARES",
  "area": "saude",
  "descricao": "Materiais educacionais e TCCs da UNA-SUS sobre atenção primária — resumo de cada recurso.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_API = 'https://ares.unasus.gov.br/server/api';
const FRONT_URL = 'https://ares.unasus.gov.br';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarDspace7(BASE_API, FRONT_URL, FONTE_META, query, max_resultados, pastaDocumentos(raiz, projeto_nome), {
    headers: HEADERS_TUSABBOT, evento_cancelar, dispatch_event,
  });
}
