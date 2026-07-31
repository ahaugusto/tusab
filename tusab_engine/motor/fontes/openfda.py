# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: openFDA — bulários de medicamentos (FDA/EUA). Sem chave de
API (limite mais baixo sem chave, mas funcional). Confirmado ao vivo: campo
indications_and_usage tem texto narrativo real (bula completa).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "openfda",
    "nome": "openFDA",
    "area": "saude",
    "descricao": "Bulários de medicamentos aprovados pela FDA (indicações, uso, avisos).",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.fda.gov/drug/label.json"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={"search": f"indications_and_usage:{query}", "limit": max_resultados},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("results", [])

    def extrair(item):
        texto_lista = item.get("indications_and_usage") or []
        texto = texto_lista[0] if texto_lista else ""
        if not texto:
            return None
        openfda = item.get("openfda", {})
        titulo = (openfda.get("brand_name") or openfda.get("generic_name") or ["Sem título"])[0]
        set_id = item.get("set_id", "")
        url_origem = f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}" if set_id else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "openfda", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
