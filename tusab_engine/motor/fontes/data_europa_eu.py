# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: data.europa.eu — Portal de Dados Abertos da União Europeia.
Sem chave de API. Confirmado ao vivo: busca full-text real, descrição
narrativa real (título/descrição vêm como dict multilíngue {"en": ..., "pt": ...}).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "data_europa_eu",
    "nome": "data.europa.eu",
    "area": "geral",
    "descricao": "Portal de dados abertos da União Europeia — datasets de instituições e países-membros.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://data.europa.eu/api/hub/search/search"


def _texto_multilingue(campo, idioma_preferido="en") -> str:
    """title/description vêm como {"en": ..., "pt": ..., ...} — nem todo
    registro tem o idioma preferido, então cai pro primeiro disponível."""
    if isinstance(campo, dict):
        if idioma_preferido in campo and campo[idioma_preferido]:
            return campo[idioma_preferido]
        for valor in campo.values():
            if valor:
                return valor
        return ""
    return campo or ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"q": query, "limit": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("result", {}).get("results", [])

    def extrair(item):
        texto = _texto_multilingue(item.get("description"))
        if not texto:
            return None
        titulo = _texto_multilingue(item.get("title")) or "Sem título"
        id_ = item.get("id", "")
        url_origem = f"https://data.europa.eu/data/datasets/{id_}" if id_ else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "data_europa_eu", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
