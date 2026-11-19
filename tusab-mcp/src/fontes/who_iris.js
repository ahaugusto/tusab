// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de who_iris.py: repositório institucional da OMS (DSpace 7), sem chave.
// Exige User-Agent identificado (403 para UA genérico e para UA de navegador).

import { HEADERS_TUSABBOT, pastaDocumentos } from './_base.js';
import { buscarDspace7 } from './_dspace7.js';

export const FONTE_META = {
  "id": "who_iris",
  "nome": "OMS/WHO IRIS",
  "area": "saude",
  "descricao": "Relatórios técnicos, diretrizes e publicações da Organização Mundial da Saúde — resumo de cada documento.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_API = 'https://iris.who.int/server/api';
const FRONT_URL = 'https://iris.who.int';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarDspace7(BASE_API, FRONT_URL, FONTE_META, query, max_resultados, pastaDocumentos(raiz, projeto_nome), {
    headers: HEADERS_TUSABBOT, evento_cancelar, dispatch_event,
  });
}
