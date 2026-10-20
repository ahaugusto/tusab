# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: OPAS/PAHO IRIS — repositório institucional da Organização
Pan-Americana da Saúde (DSpace 7), sem chave de API. Publicações técnicas,
artigos da Revista Panamericana de Salud Pública, guias e relatórios —
muito conteúdo em português e espanhol, além de inglês.

Endpoint: `GET https://iris.paho.org/server/api/discover/search/objects`
(conector genérico em _dspace7.py). Item público em
`https://iris.paho.org/handle/<handle>`.

Achados do teste ao vivo (20/out/2026):
- Exige User-Agent identificado (HEADERS_TUSABBOT): HTTP 403 tanto com o UA
  padrão do python-requests quanto com UA de Chrome.
- Abstract frequentemente vem em 3 entradas no mesmo item ("[ABSTRACT]",
  "[RESUMEN]", "[RESUMO]") — o conector junta todas, então o corpus recebe
  a versão em português quando existe.
- Itens antigos (anos 1970–90, digitalizados) costumam não ter abstract —
  descartados.
"""

import os

import requests  # noqa: F401 — exposto para os testes fazerem patch de requests.get

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT
from ._dspace7 import buscar_dspace7

FONTE_META = {
    "id": "paho_iris",
    "nome": "OPAS/PAHO IRIS",
    "area": "saude",
    "descricao": "Publicações técnicas e científicas da Organização Pan-Americana da Saúde — resumos em PT/ES/EN.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_API = "https://iris.paho.org/server/api"
FRONT_URL = "https://iris.paho.org"


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
