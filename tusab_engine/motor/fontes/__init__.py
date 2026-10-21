# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Registro genérico de fontes públicas de busca acadêmica/dados abertos, pro
perfil Pesquisador. Cada módulo desta pasta implementa {FONTE_META, buscar()}
— ver arxiv_adapter.py pro exemplo mais simples e _base.py pro contrato
compartilhado de salvamento.

Mapeado a partir do documento "Bases de Dados Abertas — Consolidação Ampliada
de Endpoints de API" (Equipe NDTI/DECIT/SCTIE, Ministério da Saúde, jul/2026),
10 áreas de conhecimento por domínio (Educação desde out/2026) + 1 área "geral" pros buscadores
multidisciplinares (arXiv, OpenAlex, DataCite, DOAJ, Zenodo) — esses não
"pertencem" a uma área de domínio como PubMed pertence a saúde ou CERN Open
Data pertence a física; indexam produção de qualquer campo, então ficavam
soterrados dentro de "Produção científica e literatura" mesmo cobrindo muito
mais que isso (decisão de 30/jul/2026, ver agents/_historia.md).

Só entram fontes testadas ao vivo, sem cadastro/chave, com conteúdo textual
substantivo (não apenas metadado) — mesmo critério usado pra FHIR/
ClinicalTrials.gov (ver agents/_historia.md).

arXiv (arxiv_adapter.py) está no registro ativo — não fica exclusivo do
futuro vertical Tusab Saúde: a mesma base técnica atende os dois (decisão de
27/jul/2026, ver _historia.md).
"""

from . import (
    agencia_brasil, almg, anvisalegis, art_institute_chicago, arxiv_adapter, bcb,
    bdtd, bvs_ms, camara, camara_discursos, capes_teses, cern_opendata,
    cleveland_art, clinicaltrials, codeberg, crossref, data_europa_eu, data_gov_uk, datacite,
    doaj, educapes, eric, europepmc, federal_register, fiocruz_arca, github,
    gitlab, govbr_noticias, gutenberg, hacker_news, hal, hf_datasets, hf_modelos, hf_papers, ibge_noticias, inca, inspire_hep,
    ipea, nasa_cmr, nasa_ntrs, oasisbr, open_library, openalex, openfda, osti,
    paho_iris, pubmed, senado_discursos, senado_leis, senado_materias,
    stackexchange, stf, tcu, the_met, tst, unasus_ares, uniprot, usgs_pubs,
    who_iris, wikilivros_pt, wikipedia, wikisource_pt, wikiversidade_pt,
    wiktionary, worldbank_wds, zenodo,
)

_MODULOS = [
    # Ordem = ordem de exibição: a área aparece na posição do seu 1º módulo, e
    # dentro de cada área as fontes brasileiras vêm primeiro (Brazil First).
    arxiv_adapter, openalex, datacite, doaj, zenodo,
    crossref, hal, data_europa_eu, data_gov_uk, open_library, agencia_brasil,
    github, gitlab, codeberg, hf_modelos, hf_datasets, hf_papers, stackexchange, hacker_news,
    bcb, ipea, ibge_noticias, worldbank_wds,
    # Educação — área criada em out/2026 (perfis Professor e Estudante não
    # tinham nenhuma fonte própria). MEC, CNE, BNCC e INEP não têm API
    # utilizável (testado ao vivo): o acervo brasileiro chega por IBICT e CAPES.
    bdtd, oasisbr, capes_teses, educapes, wikilivros_pt, wikiversidade_pt, eric,
    camara, camara_discursos, senado_leis, senado_materias, senado_discursos,
    stf, tcu, tst, govbr_noticias, almg, federal_register,
    bvs_ms, anvisalegis, fiocruz_arca, inca, unasus_ares, paho_iris, who_iris,
    pubmed, clinicaltrials, uniprot, europepmc, openfda,
    nasa_cmr, nasa_ntrs, usgs_pubs,
    cern_opendata, osti, inspire_hep,
    wikisource_pt, art_institute_chicago, the_met, cleveland_art, gutenberg,
    wikipedia, wiktionary,
]

FONTES = {m.FONTE_META["id"]: m for m in _MODULOS}

# Nome de exibição de cada área — chave bate com FONTE_META["area"] de cada módulo.
AREAS_META = {
    "geral":      "Buscadores gerais e multidisciplinares",
    "tecnologia": "Tecnologia, IA e ciência de dados",
    "economia":   "Economia, finanças e ciências sociais",
    "educacao":   "Educação, ensino e material didático",
    "direito":    "Direito, normas, legislação e governo",
    "saude":      "Saúde, biologia e genética",
    "terra":      "Ciências da Terra, clima e espaço",
    "fisica":     "Física, química e materiais",
    "patrimonio": "Patrimônio cultural, história e arquivos",
    "antropologia": "Antropologia, linguística e conhecimento estruturado",
}


def listar_fontes() -> dict:
    """Retorna {area_id: {"nome": ..., "fontes": [FONTE_META, ...]}}."""
    areas = {}
    for m in _MODULOS:
        area_id = m.FONTE_META["area"]
        areas.setdefault(area_id, {"nome": AREAS_META.get(area_id, area_id), "fontes": []})
        areas[area_id]["fontes"].append(m.FONTE_META)
    return areas


def obter_fonte(fonte_id: str):
    return FONTES.get(fonte_id)
