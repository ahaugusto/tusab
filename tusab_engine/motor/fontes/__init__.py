# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Registro genérico de fontes públicas de busca acadêmica/dados abertos, pro
perfil Pesquisador. Cada módulo desta pasta implementa {FONTE_META, buscar()}
— ver arxiv_adapter.py pro exemplo mais simples e _base.py pro contrato
compartilhado de salvamento.

Mapeado a partir do documento "Bases de Dados Abertas — Consolidação Ampliada
de Endpoints de API" (Equipe NDTI/DECIT/SCTIE, Ministério da Saúde, jul/2026),
9 áreas de conhecimento. Implementação começa pela área 1 (Produção científica,
acadêmica e literatura) — as demais entram incrementalmente, mesma arquitetura.

Só entram fontes testadas ao vivo, sem cadastro/chave, com conteúdo textual
substantivo (não apenas metadado) — mesmo critério usado pra FHIR/
ClinicalTrials.gov (ver agents/_historia.md).

arXiv (arxiv_adapter.py) está no registro ativo — não fica exclusivo do
futuro vertical Tusab Saúde: a mesma base técnica atende os dois (decisão de
27/jul/2026, ver _historia.md).
"""

from . import (
    arxiv_adapter, bcb, camara, clinicaltrials, datacite, doaj, europepmc,
    github, nasa_cmr, openalex, pubmed, senado_leis, stackexchange, uniprot, zenodo,
)

_MODULOS = [
    arxiv_adapter, openalex, europepmc, datacite, doaj, zenodo,
    github, stackexchange,
    bcb,
    camara, senado_leis,
    pubmed, clinicaltrials, uniprot,
    nasa_cmr,
]

FONTES = {m.FONTE_META["id"]: m for m in _MODULOS}

# Nome de exibição de cada área — chave bate com FONTE_META["area"] de cada módulo.
AREAS_META = {
    "cientifica": "Produção científica e literatura",
    "tecnologia": "Tecnologia, IA e ciência de dados",
    "economia":   "Economia, finanças e ciências sociais",
    "direito":    "Direito, normas, legislação e governo",
    "saude":      "Saúde, biologia e genética",
    "terra":      "Ciências da Terra, clima e espaço",
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
