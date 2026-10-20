# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Wikilivros em português (pt.wikibooks.org, MediaWiki Action
API), sem chave de API. Livros didáticos abertos escritos colaborativamente
— matemática, línguas, programação, ciências —, organizados em capítulos
(subpáginas "Livro/Capítulo").

Endpoint: https://pt.wikibooks.org/w/api.php (ver _mediawiki.py para o
fluxo busca → extract → fallback parse e os achados comuns).

Achados do teste ao vivo (20/out/2026): a busca devolve tanto a página
principal do livro quanto capítulos/subpáginas (ex.: "Aquisição e
Desenvolvimento da Leitura e da Escrita" e ".../Bibliografia"); cada página
vira um documento próprio, com o texto integral (não só a introdução).
"""

import os

import requests  # noqa: F401 — exposto para os testes (patch.object(wikilivros_pt.requests, "get"))

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO
from ._mediawiki import buscar_mediawiki

FONTE_META = {
    "id": "wikilivros_pt",
    "nome": "Wikilivros (PT)",
    "area": "educacao",
    "descricao": "Livros didáticos abertos em português — texto integral de cada capítulo.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://pt.wikibooks.org/w/api.php"


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
