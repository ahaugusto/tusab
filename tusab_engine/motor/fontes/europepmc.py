# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Europe PMC — literatura biomédica com camada semântica de
anotações (SciLite). Sem chave de API. Confirmado ao vivo: abstract real
disponível via resultType=core.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "europepmc",
    "nome": "Europe PMC",
    "area": "saude",
    "descricao": "Literatura biomédica com camada semântica de anotações.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        # resultType=core é obrigatório pra vir com abstractText — sem isso a
        # API devolve só metadado (title/id), confirmado em teste real.
        params={"query": query, "format": "json", "pageSize": max_resultados, "resultType": "core"},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("resultList", {}).get("result", [])

    def extrair(item):
        abstract = item.get("abstractText") or ""
        if not abstract:
            return None
        titulo = item.get("title") or "Sem título"
        url_origem = item.get("doi") or item.get("id", "")
        return {"titulo": titulo, "texto": abstract, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "europepmc", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
