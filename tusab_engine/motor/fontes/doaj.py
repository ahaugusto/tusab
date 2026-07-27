# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: DOAJ (Directory of Open Access Journals) — diretório de
periódicos e artigos de acesso aberto. Sem chave de API. Confirmado ao vivo:
abstract real disponível.
"""

import os
import urllib.parse

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "doaj",
    "nome": "DOAJ",
    "area": "cientifica",
    "descricao": "Diretório de periódicos e artigos de acesso aberto.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://doaj.org/api/search/articles/{query}"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    url = BASE_URL.format(query=urllib.parse.quote(query))
    resp = requests.get(url, params={"pageSize": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("results", [])

    def extrair(item):
        bib = item.get("bibjson", {})
        texto = bib.get("abstract", "")
        if not texto:
            return None
        titulo = bib.get("title", "Sem título")
        links = bib.get("link", [])
        url_origem = links[0].get("url", "") if links else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "doaj", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
