# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Wikisource em português (MediaWiki Action API), sem chave de
API. Biblioteca de textos integrais em domínio público ou licença livre —
literatura brasileira e portuguesa, constituições, leis históricas,
documentos e discursos.

Endpoint: https://pt.wikisource.org/w/api.php (ver _mediawiki.py para o
fluxo busca → extract → fallback parse e os achados comuns).

Achados do teste ao vivo (20/out/2026): a busca full-text mistura obras
literárias com legislação municipal transcrita (ex.: "alfabetização" traz
emendas a leis orgânicas); "BNCC" não retorna nada. Obras longas costumam
vir divididas em subpáginas ("Constituição de 1891.../II") — a maior página
vista no teste tinha ~38 mil caracteres ("O Imperio Brazileiro/VII"). O
limite de 60.000 caracteres por documento (com link para a íntegra) é
proteção para as páginas únicas gigantes que existem no acervo.
"""

import os

import requests  # noqa: F401 — exposto para os testes (patch.object(wikisource_pt.requests, "get"))

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO
from ._mediawiki import buscar_mediawiki

FONTE_META = {
    "id": "wikisource_pt",
    "nome": "Wikisource (PT)",
    "area": "patrimonio",
    "descricao": "Textos integrais em domínio público — literatura, documentos históricos e legislação antiga.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://pt.wikisource.org/w/api.php"


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
