# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: data.gov.uk — portal de dados abertos do governo do Reino
Unido (CKAN, mesmo padrão técnico do Banco Central do Brasil — ver bcb.py).
Sem chave de API. Confirmado ao vivo: campo "notes" com descrição real.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "data_gov_uk",
    "nome": "data.gov.uk",
    "area": "geral",
    "descricao": "Portal de dados abertos do governo do Reino Unido — qualquer área temática.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://data.gov.uk/api/3/action/package_search"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"q": query, "rows": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("result", {}).get("results", [])

    def extrair(item):
        texto = item.get("notes") or ""
        if not texto:
            return None
        titulo = item.get("title") or "Sem título"
        nome_dataset = item.get("name") or ""
        url_origem = f"https://data.gov.uk/dataset/{nome_dataset}" if nome_dataset else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "data_gov_uk", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
