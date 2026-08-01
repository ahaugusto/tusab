# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Registro genérico de fontes públicas de busca acadêmica/dados abertos, pro
perfil Pesquisador. Cada módulo desta pasta implementa {FONTE_META, buscar()}
— ver arxiv_adapter.py pro exemplo mais simples e _base.py pro contrato
compartilhado de salvamento.

Mapeado a partir do documento "Bases de Dados Abertas — Consolidação Ampliada
de Endpoints de API" (Equipe NDTI/DECIT/SCTIE, Ministério da Saúde, jul/2026),
9 áreas de conhecimento por domínio + 1 área "geral" pros buscadores
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
    art_institute_chicago, arxiv_adapter, bcb, camara, cern_opendata,
    clinicaltrials, crossref, data_europa_eu, data_gov_uk, datacite, doaj,
    europepmc, github, hacker_news, nasa_cmr, open_library, openalex, openfda,
    pubmed, senado_leis, stackexchange, the_met, uniprot, wikipedia, wiktionary, zenodo,
)

_MODULOS = [
    arxiv_adapter, openalex, datacite, doaj, zenodo,
    crossref, data_europa_eu, data_gov_uk, open_library,
    github, stackexchange, hacker_news,
    bcb,
    camara, senado_leis,
    pubmed, clinicaltrials, uniprot, europepmc, openfda,
    nasa_cmr,
    cern_opendata,
    art_institute_chicago, the_met,
    wikipedia, wiktionary,
]

FONTES = {m.FONTE_META["id"]: m for m in _MODULOS}

# Nome de exibição de cada área — chave bate com FONTE_META["area"] de cada módulo.
AREAS_META = {
    "geral":      "Buscadores gerais e multidisciplinares",
    "tecnologia": "Tecnologia, IA e ciência de dados",
    "economia":   "Economia, finanças e ciências sociais",
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
