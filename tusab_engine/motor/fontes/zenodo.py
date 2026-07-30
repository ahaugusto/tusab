# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Zenodo — repositório do CERN/OpenAIRE para datasets, código e
artefatos de pesquisa com DOI. Busca básica não exige autenticação (OAuth
é só pra operações de escrita/limites maiores). Confirmado ao vivo:
descrição real disponível (em HTML, limpa aqui).
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "zenodo",
    "nome": "Zenodo",
    "area": "geral",
    "descricao": "Repositório do CERN/OpenAIRE — datasets, código e artefatos com DOI.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://zenodo.org/api/records"
_TAG_RE = re.compile(r'<[^>]+>')


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"q": query, "size": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("hits", {}).get("hits", [])

    def extrair(item):
        meta = item.get("metadata", {})
        texto = meta.get("description", "")
        texto = _TAG_RE.sub(' ', texto)
        texto = re.sub(r'\s+', ' ', texto).strip()
        if not texto:
            return None
        titulo = meta.get("title", "Sem título")
        url_origem = item.get("links", {}).get("self_html", "")
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "zenodo", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
