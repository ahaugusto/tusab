// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de portais_br_municipios.py: portais municipais de dados abertos (CKAN).
// Belo Horizonte bloqueia clientes que não são navegador pela assinatura TLS e
// ficou de fora; Rio e Curitiba não têm API JSON utilizável.

import { criarBuscaPortais } from './_portais_dados.js';

export const FONTE_META = {
  "id": "portais_br_municipios",
  "nome": "Dados abertos — capitais (Brasil)",
  "area": "dados",
  "descricao": "Portais de dados abertos das prefeituras de São Paulo, Recife, Fortaleza e Porto Alegre.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export const PORTAIS = [
  {
    "nome": "Prefeitura de São Paulo",
    "plataforma": "ckan",
    "base": "https://dados.prefeitura.sp.gov.br"
  },
  {
    "nome": "Prefeitura do Recife",
    "plataforma": "ckan",
    "base": "https://dados.recife.pe.gov.br"
  },
  {
    "nome": "Prefeitura de Fortaleza",
    "plataforma": "ckan",
    "base": "https://dados.fortaleza.ce.gov.br"
  },
  {
    "nome": "Prefeitura de Porto Alegre",
    "plataforma": "ckan",
    "base": "https://dadosabertos.poa.br"
  }
];

// Sub-seleção na modal ("filtrar por capitais"): ids = nome de exibição de cada portal.
FONTE_META.subfontes = PORTAIS.map((p) => p.nome);
FONTE_META.subfontes_rotulo = 'Capitais';

export const buscar = criarBuscaPortais(PORTAIS, FONTE_META.id);
