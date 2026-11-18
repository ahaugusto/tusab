// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de portais_br_federal.py: portais de dados abertos de órgãos federais
// brasileiros (CKAN). O dados.gov.br exige token desde 2023 e fica de fora.
// Consulta todos os portais em paralelo (ver _portais_dados.js).

import { criarBuscaPortais } from './_portais_dados.js';

export const FONTE_META = {
  "id": "portais_br_federal",
  "nome": "Dados abertos — órgãos federais (Brasil)",
  "area": "dados",
  "descricao": "Catálogos de dados de IPEA, CVM, ANEEL, IBAMA, CAPES, TSE, Turismo e outros órgãos federais — descrição e arquivos de cada conjunto.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export const PORTAIS = [
  {
    "nome": "IPEA",
    "plataforma": "ckan",
    "base": "https://dados.ipea.gov.br"
  },
  {
    "nome": "CVM",
    "plataforma": "ckan",
    "base": "https://dados.cvm.gov.br"
  },
  {
    "nome": "ANEEL",
    "plataforma": "ckan",
    "base": "https://dadosabertos.aneel.gov.br"
  },
  {
    "nome": "IBAMA",
    "plataforma": "ckan",
    "base": "https://dadosabertos.ibama.gov.br"
  },
  {
    "nome": "CAPES",
    "plataforma": "ckan",
    "base": "https://dadosabertos.capes.gov.br"
  },
  {
    "nome": "TSE",
    "plataforma": "ckan",
    "base": "https://dadosabertos.tse.jus.br"
  },
  {
    "nome": "Ministério do Turismo",
    "plataforma": "ckan",
    "base": "https://dados.turismo.gov.br"
  },
  {
    "nome": "Ministério de Minas e Energia",
    "plataforma": "ckan",
    "base": "https://dadosabertos.mme.gov.br"
  },
  {
    "nome": "Ministério da Cultura",
    "plataforma": "ckan",
    "base": "https://dados.cultura.gov.br"
  }
];

// Sub-seleção na modal ("filtrar por órgãos"): ids = nome de exibição de cada portal.
FONTE_META.subfontes = PORTAIS.map((p) => p.nome);
FONTE_META.subfontes_rotulo = 'Órgãos';

export const buscar = criarBuscaPortais(PORTAIS, FONTE_META.id);
