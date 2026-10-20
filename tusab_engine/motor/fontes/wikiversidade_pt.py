# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Wikiversidade em português (pt.wikiversity.org, MediaWiki
Action API), sem chave de API. Cursos, aulas e materiais didáticos abertos,
organizados em páginas de curso e subpáginas de lição.

Endpoint: https://pt.wikiversity.org/w/api.php (ver _mediawiki.py para o
fluxo busca → extract → fallback parse e os achados comuns).

Achados do teste ao vivo (20/out/2026): páginas-índice de curso (ex.:
"Alfabetização") voltam com `extract` vazio — são montadas com
predefinições/tabelas que o TextExtracts ignora; o fallback `action=parse`
recupera o conteúdo. As subpáginas de lição ("Alfabetização/Métodos de
alfabetização") costumam ter texto corrido normal.
"""

import os

import requests  # noqa: F401 — exposto para os testes (patch.object(wikiversidade_pt.requests, "get"))

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO
from ._mediawiki import buscar_mediawiki

FONTE_META = {
    "id": "wikiversidade_pt",
    "nome": "Wikiversidade (PT)",
    "area": "educacao",
    "descricao": "Cursos, aulas e materiais didáticos abertos em português — texto integral de cada página.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://pt.wikiversity.org/w/api.php"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_mediawiki(
        API_URL, FONTE_META["id"], FONTE_META["nome"], query, max_resultados, doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
