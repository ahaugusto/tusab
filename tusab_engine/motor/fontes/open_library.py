# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Open Library — metadados de livros. Sem chave de API.
Confirmado ao vivo: a busca (search.json) não traz descrição, só o endpoint
de detalhe da obra (/works/{id}.json) tem texto narrativo real — mesmo
padrão de 2 chamadas por item já usado em Câmara dos Deputados/PubMed.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "open_library",
    "nome": "Open Library",
    "area": "geral",
    "descricao": "Metadados e descrições de livros — projeto da Internet Archive.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://openlibrary.org/search.json"
WORK_URL = "https://openlibrary.org{key}.json"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(SEARCH_URL, params={"q": query, "limit": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("docs", [])

    def extrair(item):
        key = item.get("key", "")
        if not key:
            return None
        detalhe = requests.get(WORK_URL.format(key=key), timeout=(10, 30))
        detalhe.raise_for_status()
        desc = detalhe.json().get("description")
        if isinstance(desc, dict):
            desc = desc.get("value", "")
        if not desc:
            return None
        titulo = item.get("title", "Sem título")
        url_origem = f"https://openlibrary.org{key}"
        return {"titulo": titulo, "texto": desc, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "open_library", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
