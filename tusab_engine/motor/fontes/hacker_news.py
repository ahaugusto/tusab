# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Hacker News (via Algolia HN Search API). Sem chave de API.
Confirmado ao vivo: só posts do tipo Ask HN/Show HN têm corpo de texto real
(story_text) — posts de link (a maioria) não têm. Filtro tags=(ask_hn,show_hn)
restringe a busca a esse tipo, mesmo padrão de filtro obrigatório já usado em
Crossref (has-abstract:true).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "hacker_news",
    "nome": "Hacker News",
    "area": "tecnologia",
    "descricao": "Discussões Ask HN/Show HN — comunidade de tecnologia e startups.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://hn.algolia.com/api/v1/search"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={"query": query, "tags": "(ask_hn,show_hn)", "hitsPerPage": max_resultados},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("hits", [])

    def extrair(item):
        texto = item.get("story_text") or ""
        if not texto:
            return None
        titulo = item.get("title", "Sem título")
        object_id = item.get("objectID", "")
        url_origem = f"https://news.ycombinator.com/item?id={object_id}" if object_id else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "hacker_news", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
