# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: OMS/WHO IRIS — repositório institucional da Organização
Mundial da Saúde (DSpace 7), sem chave de API. Relatórios técnicos,
diretrizes, Weekly Epidemiological Record e documentos de governança da OMS.

Endpoint: `GET https://iris.who.int/server/api/discover/search/objects`
(conector genérico em _dspace7.py). Item público em
`https://iris.who.int/handle/<handle>`.

Achados do teste ao vivo (20/out/2026):
- Exige User-Agent identificado (HEADERS_TUSABBOT): HTTP 403 tanto com o UA
  padrão do python-requests quanto com UA de Chrome.
- Grande parte dos itens não tem abstract: sem filtro, os 20 primeiros de
  "dengue" eram fascículos do Weekly Epidemiological Record sem resumo e a
  busca salvava 0 documentos. O conector agora filtra no Solr
  (`dc.description.abstract:*`) — "dengue" passa a trazer 3/3 com resumo.
"""

import os

import requests  # noqa: F401 — exposto para os testes fazerem patch de requests.get

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT
from ._dspace7 import buscar_dspace7

FONTE_META = {
    "id": "who_iris",
    "nome": "OMS/WHO IRIS",
    "area": "saude",
    "descricao": "Relatórios técnicos, diretrizes e publicações da Organização Mundial da Saúde — resumo de cada documento.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_API = "https://iris.who.int/server/api"
FRONT_URL = "https://iris.who.int"


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
