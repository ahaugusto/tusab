// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de ipea.py: Repositório do Conhecimento do IPEA (DSpace 7), sem chave.
// O abstract é curto demais para RAG: usa o texto integral que o próprio DSpace
// já extraiu do PDF (bundle TEXT), com o abstract como reserva.

import { HEADERS_TUSABBOT, pastaDocumentos } from './_base.js';
import { buscarDspace7 } from './_dspace7.js';

export const FONTE_META = {
  "id": "ipea",
  "nome": "IPEA — Repositório do Conhecimento",
  "area": "economia",
  "descricao": "Estudos e textos para discussão do IPEA sobre economia e políticas públicas — texto integral.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_API = 'https://repositorio.ipea.gov.br/server/api';
const FRONT_URL = 'https://repositorio.ipea.gov.br';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarDspace7(BASE_API, FRONT_URL, FONTE_META, query, max_resultados, pastaDocumentos(raiz, projeto_nome), {
    headers: HEADERS_TUSABBOT, usarTextoIntegral: true, evento_cancelar, dispatch_event,
  });
}
