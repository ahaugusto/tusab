// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de portais_br_estados.py: portais estaduais de dados abertos (CKAN).
// dados.sp.gov.br e dados.rj.gov.br morreram — os vivos são dadosabertos.*.
// Consulta todos os portais em paralelo (ver _portais_dados.js).

import { criarBuscaPortais } from './_portais_dados.js';

export const FONTE_META = {
  "id": "portais_br_estados",
  "nome": "Dados abertos — estados (Brasil)",
  "area": "dados",
  "descricao": "Portais de dados abertos de SP, RJ, MG, RS, SC, PE, ES, GO e AL — descrição e arquivos de cada conjunto.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export const PORTAIS = [
  {
    "nome": "São Paulo",
    "plataforma": "ckan",
    "base": "https://dadosabertos.sp.gov.br"
  },
  {
    "nome": "SEADE (SP)",
    "plataforma": "ckan",
    "base": "https://repositorio.seade.gov.br"
  },
  {
    "nome": "Rio de Janeiro",
    "plataforma": "ckan",
    "base": "https://dadosabertos.rj.gov.br"
  },
  {
    "nome": "Minas Gerais",
    "plataforma": "ckan",
    "base": "https://dados.mg.gov.br"
  },
  {
    "nome": "Rio Grande do Sul",
    "plataforma": "ckan",
    "base": "https://dados.rs.gov.br"
  },
  {
    "nome": "Santa Catarina",
    "plataforma": "ckan",
    "base": "https://dados.sc.gov.br"
  },
  {
    "nome": "Pernambuco",
    "plataforma": "ckan",
    "base": "https://dados.pe.gov.br"
  },
  {
    "nome": "Espírito Santo",
    "plataforma": "ckan",
    "base": "https://dados.es.gov.br"
  },
  {
    "nome": "Goiás",
    "plataforma": "ckan",
    "base": "https://dadosabertos.go.gov.br"
  },
  {
    "nome": "Alagoas",
    "plataforma": "ckan",
    "base": "https://dados.al.gov.br/catalogo"
  }
];

// Sub-seleção na modal ("filtrar por estados"): ids = nome de exibição de cada portal.
FONTE_META.subfontes = PORTAIS.map((p) => p.nome);
FONTE_META.subfontes_rotulo = 'Estados';

export const buscar = criarBuscaPortais(PORTAIS, FONTE_META.id);
