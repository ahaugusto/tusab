# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: BDTD — Biblioteca Digital Brasileira de Teses e Dissertações
(IBICT), sem chave de API. Agrega teses e dissertações de programas de
pós-graduação de todo o Brasil (USP, UFRGS, UNICAMP, UFMG, federais e
estaduais) num catálogo VuFind único.

Endpoint: GET https://bdtd.ibict.br/vufind/api/v1/search (ver _vufind.py
para os parâmetros e os achados comuns ao VuFind).

Achados do teste ao vivo (20/out/2026): "alfabetização" → ~7.700 registros,
resposta em ~1 s. O texto salvo é o resumo (PT + abstract EN quando houver);
a íntegra fica no repositório da universidade, apontado em URL_ORIGEM.
Registros antigos sem resumo cadastrado são descartados.
"""

import os

import requests  # noqa: F401 — exposto para os testes (patch.object(bdtd.requests, "get"))

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO
from ._vufind import buscar_vufind

FONTE_META = {
    "id": "bdtd",
    "nome": "BDTD — Teses e Dissertações (IBICT)",
    "area": "educacao",
    "descricao": "Teses e dissertações de universidades de todo o Brasil — resumo real de cada trabalho.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://bdtd.ibict.br"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_vufind(
        BASE_URL, FONTE_META["id"], FONTE_META["nome"], query, max_resultados, doc_dir,
        timeout=(10, 30), evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
