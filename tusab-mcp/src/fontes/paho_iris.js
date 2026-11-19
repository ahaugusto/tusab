// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de paho_iris.py: repositório institucional da OPAS (DSpace 7), sem
// chave. Exige User-Agent identificado; o abstract vem em PT/ES/EN no mesmo item.

import { HEADERS_TUSABBOT, pastaDocumentos } from './_base.js';
import { buscarDspace7 } from './_dspace7.js';

export const FONTE_META = {
  "id": "paho_iris",
  "nome": "OPAS/PAHO IRIS",
  "area": "saude",
  "descricao": "Publicações técnicas e científicas da Organização Pan-Americana da Saúde — resumos em PT/ES/EN.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_API = 'https://iris.paho.org/server/api';
const FRONT_URL = 'https://iris.paho.org';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarDspace7(BASE_API, FRONT_URL, FONTE_META, query, max_resultados, pastaDocumentos(raiz, projeto_nome), {
    headers: HEADERS_TUSABBOT, evento_cancelar, dispatch_event,
  });
}
