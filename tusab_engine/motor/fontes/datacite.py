# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: DataCite — DOIs de datasets, software e produção de pesquisa.
Sem chave de API. Confirmado ao vivo: descrições reais (descriptionType=Abstract
quando disponível, senão a primeira descrição do registro).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "datacite",
    "nome": "DataCite",
    "area": "cientifica",
    "descricao": "DOIs de datasets, software e produção de pesquisa.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.datacite.org/dois"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={"query": query, "page[size]": max_resultados},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("data", [])

    def extrair(item):
        attrs = item.get("attributes", {})
        descricoes = attrs.get("descriptions", [])
        texto = next((d.get("description", "") for d in descricoes if d.get("descriptionType") == "Abstract"), "")
        if not texto and descricoes:
            texto = descricoes[0].get("description", "")
        if not texto:
            return None
        titulo = (attrs.get("titles") or [{}])[0].get("title", "Sem título")
        url_origem = attrs.get("url") or attrs.get("doi", "")
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "datacite", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
