# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: UniProt — sequências e funções de proteínas. Sem chave de
API. Diferente da maioria dos bancos de bioinformática (estruturados/
numéricos), UniProt tem um campo narrativo real: o comentário `FUNCTION`,
texto corrido descrevendo o papel biológico da proteína — confirmado ao
vivo (ex: função real da insulina).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "uniprot",
    "nome": "UniProt",
    "area": "saude",
    "descricao": "Sequências e funções biológicas de proteínas.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://rest.uniprot.org/uniprotkb/search"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"query": query, "size": max_resultados, "format": "json"}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("results", [])

    def extrair(item):
        comentarios = item.get("comments", [])
        funcao = next((c for c in comentarios if c.get("commentType") == "FUNCTION"), None)
        if not funcao:
            return None
        textos = funcao.get("texts", [])
        descricao = " ".join(t.get("value", "") for t in textos if t.get("value")).strip()
        if not descricao:
            return None

        nome_proteina = (
            item.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value")
            or item.get("primaryAccession", "Sem título")
        )
        acc = item.get("primaryAccession", "")
        url_origem = f"https://www.uniprot.org/uniprotkb/{acc}" if acc else ""
        return {"titulo": nome_proteina, "texto": descricao, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "uniprot", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
