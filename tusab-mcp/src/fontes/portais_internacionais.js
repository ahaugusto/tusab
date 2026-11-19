// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de portais_internacionais.py: portais nacionais e regionais de dados
// abertos fora do Brasil (CKAN, udata, Socrata e OpenDataSoft). A busca é
// literal e no idioma de cada portal. Consulta em paralelo (ver _portais_dados.js).

import { criarBuscaPortais } from './_portais_dados.js';

export const FONTE_META = {
  "id": "portais_internacionais",
  "nome": "Dados abertos — portais internacionais",
  "area": "dados",
  "descricao": "Portais nacionais de dados abertos (França, Portugal, Canadá, Austrália, ONU/HDX, Alemanha, Argentina, México e outros) — descrição e arquivos.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export const PORTAIS = [
  {
    "nome": "data.gouv.fr (França)",
    "plataforma": "udata",
    "base": "https://www.data.gouv.fr"
  },
  {
    "nome": "dados.gov.pt (Portugal)",
    "plataforma": "udata",
    "base": "https://dados.gov.pt"
  },
  {
    "nome": "Open Government (Canadá)",
    "plataforma": "ckan",
    "base": "https://open.canada.ca/data"
  },
  {
    "nome": "data.gov.au (Austrália)",
    "plataforma": "ckan",
    "base": "https://data.gov.au/data"
  },
  {
    "nome": "HDX (ONU/OCHA)",
    "plataforma": "ckan",
    "base": "https://data.humdata.org"
  },
  {
    "nome": "GovData (Alemanha)",
    "plataforma": "ckan",
    "base": "https://ckan.govdata.de"
  },
  {
    "nome": "data.overheid.nl (Países Baixos)",
    "plataforma": "ckan",
    "base": "https://data.overheid.nl/data"
  },
  {
    "nome": "datos.gob.ar (Argentina)",
    "plataforma": "ckan",
    "base": "https://datos.gob.ar"
  },
  {
    "nome": "Catálogo de Datos (Uruguai)",
    "plataforma": "ckan",
    "base": "https://catalogodatos.gub.uy"
  },
  {
    "nome": "datos.gob.do (Rep. Dominicana)",
    "plataforma": "ckan",
    "base": "https://datos.gob.do"
  },
  {
    "nome": "datos.gob.mx (México)",
    "plataforma": "ckan",
    "base": "https://www.datos.gob.mx"
  },
  {
    "nome": "Données Québec",
    "plataforma": "ckan",
    "base": "https://www.donneesquebec.ca/recherche"
  },
  {
    "nome": "DataBC (Colúmbia Britânica)",
    "plataforma": "ckan",
    "base": "https://catalogue.data.gov.bc.ca"
  },
  {
    "nome": "California Open Data",
    "plataforma": "ckan",
    "base": "https://data.ca.gov"
  },
  {
    "nome": "data.gov.hk (Hong Kong)",
    "plataforma": "ckan",
    "base": "https://data.gov.hk/en-data"
  },
  {
    "nome": "datos.gov.co (Colômbia)",
    "plataforma": "socrata",
    "dominio": "www.datos.gov.co"
  },
  {
    "nome": "OpenDataSoft (hub)",
    "plataforma": "ods",
    "base": "https://data.opendatasoft.com"
  },
  {
    "nome": "Paris Data",
    "plataforma": "ods",
    "base": "https://opendata.paris.fr"
  }
];

// Sub-seleção na modal ("filtrar por países e portais"): ids = nome de exibição de cada portal.
FONTE_META.subfontes = PORTAIS.map((p) => p.nome);
FONTE_META.subfontes_rotulo = 'Países e portais';

export const buscar = criarBuscaPortais(PORTAIS, FONTE_META.id);
