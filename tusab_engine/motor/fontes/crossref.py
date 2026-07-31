# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Crossref — metadados de DOIs (150M+ trabalhos). Sem chave de
API. Confirmado ao vivo: abstract real só vem com filter=has-abstract:true
(cobertura parcial — nem todo registro tem abstract, mesmo padrão de
cobertura incompleta já aceito em DataCite). Abstract vem em tags JATS
(<jats:p>...</jats:p>), limpo aqui.
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "crossref",
    "nome": "Crossref",
    "area": "geral",
    "descricao": "Metadados de DOIs — 150M+ trabalhos acadêmicos de qualquer área.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.crossref.org/works"
_TAG_RE = re.compile(r'<[^>]+>')


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={"query": query, "filter": "has-abstract:true", "rows": max_resultados},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("message", {}).get("items", [])

    def extrair(item):
        texto = item.get("abstract", "")
        texto = _TAG_RE.sub(' ', texto)
        texto = re.sub(r'\s+', ' ', texto).strip()
        if not texto:
            return None
        titulos = item.get("title") or []
        titulo = titulos[0] if titulos else "Sem título"
        doi = item.get("DOI", "")
        url_origem = f"https://doi.org/{doi}" if doi else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "crossref", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
