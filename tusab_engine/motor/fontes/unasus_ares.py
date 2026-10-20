# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: UNA-SUS ARES — Acervo de Recursos Educacionais em Saúde da
Universidade Aberta do SUS (DSpace 7), sem chave de API. Materiais
educacionais e TCCs de especialização, com forte foco em atenção primária
e Estratégia Saúde da Família.

Endpoint: `GET https://ares.unasus.gov.br/server/api/discover/search/objects`
(conector genérico em _dspace7.py). Item público em
`https://ares.unasus.gov.br/handle/<handle>`.

Achados do teste ao vivo (20/out/2026):
- Abstracts em português, ~2 mil caracteres, com `language` vazio.
- Há TCCs com título e resumo idênticos publicados como itens distintos
  (ex.: "Ampliação da cobertura vacinal infantil: projeto de intervenção",
  ARES/34424 e ARES/34373) — cada um é salvo como documento próprio, como o
  repositório os expõe.
"""

import os

import requests  # noqa: F401 — exposto para os testes fazerem patch de requests.get

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT
from ._dspace7 import buscar_dspace7

FONTE_META = {
    "id": "unasus_ares",
    "nome": "UNA-SUS ARES",
    "area": "saude",
    "descricao": "Materiais educacionais e TCCs da UNA-SUS sobre atenção primária — resumo de cada recurso.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_API = "https://ares.unasus.gov.br/server/api"
FRONT_URL = "https://ares.unasus.gov.br"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_dspace7(
        BASE_API, FRONT_URL, FONTE_META, query, max_resultados, doc_dir,
        headers=HEADERS_TUSABBOT,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
