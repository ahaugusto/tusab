// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de fiocruz_arca.py: repositório institucional da Fiocruz (DSpace 7),
// sem chave. A API mora num host diferente do front (api.arca.fiocruz.br/api).

import { HEADERS_TUSABBOT, pastaDocumentos } from './_base.js';
import { buscarDspace7 } from './_dspace7.js';

export const FONTE_META = {
  "id": "fiocruz_arca",
  "nome": "Fiocruz ARCA",
  "area": "saude",
  "descricao": "Repositório institucional da Fiocruz — artigos, teses e livros em saúde pública, com resumo em português.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_API = 'https://api.arca.fiocruz.br/api';
const FRONT_URL = 'https://arca.fiocruz.br';

export function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  return buscarDspace7(BASE_API, FRONT_URL, FONTE_META, query, max_resultados, pastaDocumentos(raiz, projeto_nome), {
    headers: HEADERS_TUSABBOT, evento_cancelar, dispatch_event,
  });
}
