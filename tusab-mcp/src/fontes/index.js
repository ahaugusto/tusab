// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de tusab_engine/motor/fontes/__init__.py: registro das fontes públicas
// de busca acadêmica/dados abertos (perfis Pesquisador e Professor). Cada
// módulo desta pasta exporta {FONTE_META, buscar()} — ver bcb.js para o
// exemplo mais simples e _base.js para o contrato compartilhado de gravação.
//
// 10 áreas de conhecimento por domínio + 1 área "geral" para os buscadores
// multidisciplinares. Só entram fontes testadas ao vivo, sem cadastro/chave,
// com conteúdo textual substantivo (mesmo critério do desktop).

import * as agencia_brasil from './agencia_brasil.js';
import * as almg from './almg.js';
import * as anvisalegis from './anvisalegis.js';
import * as art_institute_chicago from './art_institute_chicago.js';
import * as arxiv from './arxiv.js';
import * as bcb from './bcb.js';
import * as bdtd from './bdtd.js';
import * as bvs_ms from './bvs_ms.js';
import * as camara from './camara.js';
import * as camara_discursos from './camara_discursos.js';
import * as capes_teses from './capes_teses.js';
import * as cern_opendata from './cern_opendata.js';
import * as cleveland_art from './cleveland_art.js';
import * as clinicaltrials from './clinicaltrials.js';
import * as codeberg from './codeberg.js';
import * as crossref from './crossref.js';
import * as data_europa_eu from './data_europa_eu.js';
import * as data_gov_uk from './data_gov_uk.js';
import * as datacite from './datacite.js';
import * as doaj from './doaj.js';
import * as educapes from './educapes.js';
import * as eric from './eric.js';
import * as europepmc from './europepmc.js';
import * as federal_register from './federal_register.js';
import * as fiocruz_arca from './fiocruz_arca.js';
import * as github from './github.js';
import * as gitlab from './gitlab.js';
import * as govbr_noticias from './govbr_noticias.js';
import * as gutenberg from './gutenberg.js';
import * as hacker_news from './hacker_news.js';
import * as hal from './hal.js';
import * as hf_datasets from './hf_datasets.js';
import * as hf_modelos from './hf_modelos.js';
import * as hf_papers from './hf_papers.js';
import * as ibge_noticias from './ibge_noticias.js';
import * as inca from './inca.js';
import * as inspire_hep from './inspire_hep.js';
import * as ipea from './ipea.js';
import * as nasa_cmr from './nasa_cmr.js';
import * as nasa_ntrs from './nasa_ntrs.js';
import * as oasisbr from './oasisbr.js';
import * as open_library from './open_library.js';
import * as openalex from './openalex.js';
import * as openfda from './openfda.js';
import * as osti from './osti.js';
import * as paho_iris from './paho_iris.js';
import * as portais_br_estados from './portais_br_estados.js';
import * as portais_br_federal from './portais_br_federal.js';
import * as portais_br_municipios from './portais_br_municipios.js';
import * as portais_internacionais from './portais_internacionais.js';
import * as pubmed from './pubmed.js';
import * as senado_discursos from './senado_discursos.js';
import * as senado_leis from './senado_leis.js';
import * as senado_materias from './senado_materias.js';
import * as stackexchange from './stackexchange.js';
import * as stf from './stf.js';
import * as tcu from './tcu.js';
import * as the_met from './the_met.js';
import * as tst from './tst.js';
import * as unasus_ares from './unasus_ares.js';
import * as uniprot from './uniprot.js';
import * as usgs_pubs from './usgs_pubs.js';
import * as who_iris from './who_iris.js';
import * as wikilivros_pt from './wikilivros_pt.js';
import * as wikipedia from './wikipedia.js';
import * as wikisource_pt from './wikisource_pt.js';
import * as wikiversidade_pt from './wikiversidade_pt.js';
import * as wiktionary from './wiktionary.js';
import * as worldbank_wds from './worldbank_wds.js';
import * as zenodo from './zenodo.js';
import { t } from '../nucleo/idioma.js';

// Ordem = ordem de exibição: a área aparece na posição do seu 1º módulo, e
// dentro de cada área as fontes brasileiras vêm primeiro (Brazil First).
export const MODULOS = [
  arxiv, openalex, datacite, doaj, zenodo,
  crossref, hal, open_library, agencia_brasil,
  github, gitlab, codeberg, hf_modelos, hf_datasets, hf_papers, stackexchange, hacker_news,
  bcb, ipea, ibge_noticias, worldbank_wds,
  // Dados abertos: ~40 portais agrupados em fontes que consultam em paralelo.
  portais_br_federal, portais_br_estados, portais_br_municipios,
  portais_internacionais, data_europa_eu, data_gov_uk,
  // Educação: MEC, CNE, BNCC e INEP não têm API utilizável — o acervo brasileiro chega por IBICT e CAPES.
  bdtd, oasisbr, capes_teses, educapes, wikilivros_pt, wikiversidade_pt, eric,
  camara, camara_discursos, senado_leis, senado_materias, senado_discursos,
  stf, tcu, tst, govbr_noticias, almg, federal_register,
  bvs_ms, anvisalegis, fiocruz_arca, inca, unasus_ares, paho_iris, who_iris,
  pubmed, clinicaltrials, uniprot, europepmc, openfda,
  nasa_cmr, nasa_ntrs, usgs_pubs,
  cern_opendata, osti, inspire_hep,
  wikisource_pt, art_institute_chicago, the_met, cleveland_art, gutenberg,
  wikipedia, wiktionary,
];

export const FONTES = new Map(MODULOS.map((m) => [m.FONTE_META.id, m]));

// Nome de exibição de cada área — chave bate com FONTE_META.area de cada módulo.
export const AREAS_META = {
  geral: 'Buscadores gerais e multidisciplinares',
  tecnologia: 'Tecnologia, IA e ciência de dados',
  economia: 'Economia, finanças e ciências sociais',
  dados: 'Dados abertos e portais de governo',
  educacao: 'Educação, ensino e material didático',
  direito: 'Direito, normas, legislação e governo',
  saude: 'Saúde, biologia e genética',
  terra: 'Ciências da Terra, clima e espaço',
  fisica: 'Física, química e materiais',
  patrimonio: 'Patrimônio cultural, história e arquivos',
  // id "antropologia" mantido por compatibilidade; o nome mudou em out/2026.
  antropologia: 'Enciclopédias, dicionários e referência',
};

// Taxonomia para os filtros da modal: vocabulário de INTERFACE (como o usuário
// filtra e agrupa), não contrato da fonte — por isso fica aqui, num lugar só.
//   regiao "br" | "int" · tipos (chaves de TIPOS_CONTEUDO) · instituicao ·
//   grupo/variante (fontes da mesma instituição viram uma linha só na modal)
export const TIPOS_CONTEUDO = {
  artigos: 'Artigos científicos',
  teses: 'Teses e dissertações',
  relatorios: 'Relatórios e documentos técnicos',
  livros: 'Livros e textos integrais',
  didatico: 'Material didático',
  legislacao: 'Legislação e atos normativos',
  jurisprudencia: 'Jurisprudência',
  parlamento: 'Projetos e debates legislativos',
  noticias: 'Notícias',
  dados: 'Conjuntos de dados',
  codigo: 'Código e modelos de IA',
  referencia: 'Enciclopédias e dicionários',
  acervo: 'Acervos de museus',
  comunidade: 'Perguntas e discussões',
  clinico: 'Ensaios clínicos e medicamentos',
};

export const TAXONOMIA = {
  "arxiv": {
    "regiao": "int",
    "instituicao": "arXiv (Cornell)",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "openalex": {
    "regiao": "int",
    "instituicao": "OpenAlex",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "datacite": {
    "regiao": "int",
    "instituicao": "DataCite",
    "tipos": [
      "dados"
    ],
    "grupo": "",
    "variante": ""
  },
  "doaj": {
    "regiao": "int",
    "instituicao": "DOAJ",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "zenodo": {
    "regiao": "int",
    "instituicao": "Zenodo (CERN/OpenAIRE)",
    "tipos": [
      "dados",
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "crossref": {
    "regiao": "int",
    "instituicao": "Crossref",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "hal": {
    "regiao": "int",
    "instituicao": "HAL (França)",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "open_library": {
    "regiao": "int",
    "instituicao": "Internet Archive",
    "tipos": [
      "livros"
    ],
    "grupo": "",
    "variante": ""
  },
  "agencia_brasil": {
    "regiao": "br",
    "instituicao": "EBC",
    "tipos": [
      "noticias"
    ],
    "grupo": "",
    "variante": ""
  },
  "github": {
    "regiao": "int",
    "instituicao": "GitHub",
    "tipos": [
      "codigo"
    ],
    "grupo": "",
    "variante": ""
  },
  "gitlab": {
    "regiao": "int",
    "instituicao": "GitLab",
    "tipos": [
      "codigo"
    ],
    "grupo": "",
    "variante": ""
  },
  "codeberg": {
    "regiao": "int",
    "instituicao": "Codeberg",
    "tipos": [
      "codigo"
    ],
    "grupo": "",
    "variante": ""
  },
  "hf_modelos": {
    "regiao": "int",
    "instituicao": "Hugging Face",
    "tipos": [
      "codigo"
    ],
    "grupo": "Hugging Face",
    "variante": "Modelos"
  },
  "hf_datasets": {
    "regiao": "int",
    "instituicao": "Hugging Face",
    "tipos": [
      "dados"
    ],
    "grupo": "Hugging Face",
    "variante": "Datasets"
  },
  "hf_papers": {
    "regiao": "int",
    "instituicao": "Hugging Face",
    "tipos": [
      "artigos"
    ],
    "grupo": "Hugging Face",
    "variante": "Papers"
  },
  "stackexchange": {
    "regiao": "int",
    "instituicao": "Stack Exchange",
    "tipos": [
      "comunidade"
    ],
    "grupo": "",
    "variante": ""
  },
  "hacker_news": {
    "regiao": "int",
    "instituicao": "Y Combinator",
    "tipos": [
      "comunidade"
    ],
    "grupo": "",
    "variante": ""
  },
  "bcb": {
    "regiao": "br",
    "instituicao": "Banco Central do Brasil",
    "tipos": [
      "dados"
    ],
    "grupo": "",
    "variante": ""
  },
  "ipea": {
    "regiao": "br",
    "instituicao": "IPEA",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "ibge_noticias": {
    "regiao": "br",
    "instituicao": "IBGE",
    "tipos": [
      "noticias"
    ],
    "grupo": "",
    "variante": ""
  },
  "worldbank_wds": {
    "regiao": "int",
    "instituicao": "Banco Mundial",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "portais_br_federal": {
    "regiao": "br",
    "instituicao": "Governo federal",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do Brasil",
    "variante": "Órgãos federais"
  },
  "portais_br_estados": {
    "regiao": "br",
    "instituicao": "Governos estaduais",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do Brasil",
    "variante": "Estados"
  },
  "portais_br_municipios": {
    "regiao": "br",
    "instituicao": "Prefeituras",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do Brasil",
    "variante": "Capitais"
  },
  "portais_internacionais": {
    "regiao": "int",
    "instituicao": "Governos nacionais",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do exterior",
    "variante": "Vários países"
  },
  "data_europa_eu": {
    "regiao": "int",
    "instituicao": "União Europeia",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do exterior",
    "variante": "União Europeia"
  },
  "data_gov_uk": {
    "regiao": "int",
    "instituicao": "Governo do Reino Unido",
    "tipos": [
      "dados"
    ],
    "grupo": "Portais de dados abertos do exterior",
    "variante": "Reino Unido"
  },
  "bdtd": {
    "regiao": "br",
    "instituicao": "IBICT",
    "tipos": [
      "teses"
    ],
    "grupo": "IBICT",
    "variante": "Teses e dissertações (BDTD)"
  },
  "oasisbr": {
    "regiao": "br",
    "instituicao": "IBICT",
    "tipos": [
      "artigos"
    ],
    "grupo": "IBICT",
    "variante": "Artigos em acesso aberto (OasisBR)"
  },
  "capes_teses": {
    "regiao": "br",
    "instituicao": "CAPES",
    "tipos": [
      "teses"
    ],
    "grupo": "CAPES",
    "variante": "Catálogo de Teses"
  },
  "educapes": {
    "regiao": "br",
    "instituicao": "CAPES",
    "tipos": [
      "didatico"
    ],
    "grupo": "CAPES",
    "variante": "EduCAPES"
  },
  "wikilivros_pt": {
    "regiao": "br",
    "instituicao": "Wikimedia",
    "tipos": [
      "didatico"
    ],
    "grupo": "Wikimedia em português",
    "variante": "Wikilivros"
  },
  "wikiversidade_pt": {
    "regiao": "br",
    "instituicao": "Wikimedia",
    "tipos": [
      "didatico"
    ],
    "grupo": "Wikimedia em português",
    "variante": "Wikiversidade"
  },
  "eric": {
    "regiao": "int",
    "instituicao": "Departamento de Educação dos EUA",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "camara": {
    "regiao": "br",
    "instituicao": "Câmara dos Deputados",
    "tipos": [
      "parlamento"
    ],
    "grupo": "Câmara dos Deputados",
    "variante": "Proposições"
  },
  "camara_discursos": {
    "regiao": "br",
    "instituicao": "Câmara dos Deputados",
    "tipos": [
      "parlamento"
    ],
    "grupo": "Câmara dos Deputados",
    "variante": "Discursos"
  },
  "senado_leis": {
    "regiao": "br",
    "instituicao": "Senado Federal",
    "tipos": [
      "legislacao"
    ],
    "grupo": "Senado Federal",
    "variante": "Leis federais"
  },
  "senado_materias": {
    "regiao": "br",
    "instituicao": "Senado Federal",
    "tipos": [
      "parlamento"
    ],
    "grupo": "Senado Federal",
    "variante": "Projetos e matérias"
  },
  "senado_discursos": {
    "regiao": "br",
    "instituicao": "Senado Federal",
    "tipos": [
      "parlamento"
    ],
    "grupo": "Senado Federal",
    "variante": "Discursos"
  },
  "stf": {
    "regiao": "br",
    "instituicao": "Supremo Tribunal Federal",
    "tipos": [
      "jurisprudencia"
    ],
    "grupo": "Tribunais e controle",
    "variante": "STF"
  },
  "tcu": {
    "regiao": "br",
    "instituicao": "Tribunal de Contas da União",
    "tipos": [
      "jurisprudencia"
    ],
    "grupo": "Tribunais e controle",
    "variante": "TCU"
  },
  "tst": {
    "regiao": "br",
    "instituicao": "Tribunal Superior do Trabalho",
    "tipos": [
      "jurisprudencia"
    ],
    "grupo": "Tribunais e controle",
    "variante": "TST"
  },
  "govbr_noticias": {
    "regiao": "br",
    "instituicao": "Portais gov.br",
    "tipos": [
      "noticias"
    ],
    "grupo": "",
    "variante": ""
  },
  "almg": {
    "regiao": "br",
    "instituicao": "Assembleia Legislativa de Minas Gerais",
    "tipos": [
      "parlamento"
    ],
    "grupo": "",
    "variante": ""
  },
  "federal_register": {
    "regiao": "int",
    "instituicao": "Governo dos EUA",
    "tipos": [
      "legislacao"
    ],
    "grupo": "",
    "variante": ""
  },
  "bvs_ms": {
    "regiao": "br",
    "instituicao": "Ministério da Saúde",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "anvisalegis": {
    "regiao": "br",
    "instituicao": "ANVISA",
    "tipos": [
      "legislacao"
    ],
    "grupo": "",
    "variante": ""
  },
  "fiocruz_arca": {
    "regiao": "br",
    "instituicao": "Fiocruz",
    "tipos": [
      "artigos",
      "teses"
    ],
    "grupo": "",
    "variante": ""
  },
  "inca": {
    "regiao": "br",
    "instituicao": "INCA",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "unasus_ares": {
    "regiao": "br",
    "instituicao": "UNA-SUS",
    "tipos": [
      "didatico"
    ],
    "grupo": "",
    "variante": ""
  },
  "paho_iris": {
    "regiao": "int",
    "instituicao": "OPAS",
    "tipos": [
      "relatorios"
    ],
    "grupo": "OMS e OPAS (IRIS)",
    "variante": "OPAS"
  },
  "who_iris": {
    "regiao": "int",
    "instituicao": "OMS",
    "tipos": [
      "relatorios"
    ],
    "grupo": "OMS e OPAS (IRIS)",
    "variante": "OMS"
  },
  "pubmed": {
    "regiao": "int",
    "instituicao": "NIH/NLM (EUA)",
    "tipos": [
      "artigos"
    ],
    "grupo": "NIH/NLM (EUA)",
    "variante": "PubMed"
  },
  "clinicaltrials": {
    "regiao": "int",
    "instituicao": "NIH/NLM (EUA)",
    "tipos": [
      "clinico"
    ],
    "grupo": "NIH/NLM (EUA)",
    "variante": "ClinicalTrials.gov"
  },
  "uniprot": {
    "regiao": "int",
    "instituicao": "UniProt",
    "tipos": [
      "dados"
    ],
    "grupo": "",
    "variante": ""
  },
  "europepmc": {
    "regiao": "int",
    "instituicao": "EMBL-EBI",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "openfda": {
    "regiao": "int",
    "instituicao": "FDA (EUA)",
    "tipos": [
      "clinico"
    ],
    "grupo": "",
    "variante": ""
  },
  "nasa_cmr": {
    "regiao": "int",
    "instituicao": "NASA",
    "tipos": [
      "dados"
    ],
    "grupo": "NASA",
    "variante": "Earthdata (dados de satélite)"
  },
  "nasa_ntrs": {
    "regiao": "int",
    "instituicao": "NASA",
    "tipos": [
      "relatorios"
    ],
    "grupo": "NASA",
    "variante": "Relatórios técnicos (NTRS)"
  },
  "usgs_pubs": {
    "regiao": "int",
    "instituicao": "Serviço Geológico dos EUA",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "cern_opendata": {
    "regiao": "int",
    "instituicao": "CERN",
    "tipos": [
      "dados"
    ],
    "grupo": "",
    "variante": ""
  },
  "osti": {
    "regiao": "int",
    "instituicao": "Departamento de Energia dos EUA",
    "tipos": [
      "relatorios"
    ],
    "grupo": "",
    "variante": ""
  },
  "inspire_hep": {
    "regiao": "int",
    "instituicao": "INSPIRE (CERN, DESY, Fermilab, SLAC)",
    "tipos": [
      "artigos"
    ],
    "grupo": "",
    "variante": ""
  },
  "wikisource_pt": {
    "regiao": "br",
    "instituicao": "Wikimedia",
    "tipos": [
      "livros"
    ],
    "grupo": "",
    "variante": ""
  },
  "art_institute_chicago": {
    "regiao": "int",
    "instituicao": "Art Institute of Chicago",
    "tipos": [
      "acervo"
    ],
    "grupo": "",
    "variante": ""
  },
  "the_met": {
    "regiao": "int",
    "instituicao": "The Metropolitan Museum of Art",
    "tipos": [
      "acervo"
    ],
    "grupo": "",
    "variante": ""
  },
  "cleveland_art": {
    "regiao": "int",
    "instituicao": "Cleveland Museum of Art",
    "tipos": [
      "acervo"
    ],
    "grupo": "",
    "variante": ""
  },
  "gutenberg": {
    "regiao": "int",
    "instituicao": "Project Gutenberg",
    "tipos": [
      "livros"
    ],
    "grupo": "",
    "variante": ""
  },
  "wikipedia": {
    "regiao": "br",
    "instituicao": "Wikimedia",
    "tipos": [
      "referencia"
    ],
    "grupo": "Wikimedia em português",
    "variante": "Wikipédia"
  },
  "wiktionary": {
    "regiao": "int",
    "instituicao": "Wikimedia",
    "tipos": [
      "referencia"
    ],
    "grupo": "Wikimedia em português",
    "variante": "Wiktionary"
  }
};

/**
 * {area_id: {nome, fontes: [FONTE_META + taxonomia, ...], tipos: {tipo: rótulo}}} —
 * mesma forma do listar_fontes() do desktop (GET /fontes devolve {areas: isto}).
 * Devolve cópias: nunca muta o FONTE_META do módulo.
 */
const CAMPOS_TRADUZIDOS = ['nome', 'descricao', 'instituicao', 'grupo', 'variante'];

/** Todos os textos do catálogo que passam por t() (o teste confere as traduções). */
export function textosDoCatalogo() {
  const textos = new Set([...Object.values(AREAS_META), ...Object.values(TIPOS_CONTEUDO)]);
  for (const m of MODULOS) {
    const meta = { ...m.FONTE_META, ...(TAXONOMIA[m.FONTE_META.id] || {}) };
    for (const campo of CAMPOS_TRADUZIDOS) if (meta[campo]) textos.add(meta[campo]);
  }
  return [...textos];
}

export function listarFontes() {
  const areas = {};
  for (const m of MODULOS) {
    const areaId = m.FONTE_META.area;
    if (!areas[areaId]) areas[areaId] = { nome: t(AREAS_META[areaId] ?? areaId), fontes: [], tipos: {} };
    const area = areas[areaId];
    const meta = structuredClone({ ...m.FONTE_META, ...(TAXONOMIA[m.FONTE_META.id] || {}) });
    // Textos do catálogo no idioma da tela (nomes próprios sem tradução ficam como estão).
    for (const campo of CAMPOS_TRADUZIDOS) if (meta[campo]) meta[campo] = t(meta[campo]);
    area.fontes.push(meta);
    // rótulos só dos tipos presentes na área — o front monta os chips de filtro daqui
    for (const tipo of meta.tipos || []) area.tipos[tipo] = t(TIPOS_CONTEUDO[tipo] ?? tipo);
  }
  return areas;
}

export function listarTiposConteudo() {
  return { ...TIPOS_CONTEUDO };
}

/** Módulo da fonte ({FONTE_META, buscar}) ou null. */
export function obterFonte(fonteId) {
  return FONTES.get(fonteId) ?? null;
}
