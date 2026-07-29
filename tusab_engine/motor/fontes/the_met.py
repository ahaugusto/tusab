# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: The Metropolitan Museum of Art (The Met) — coleção com mais
de 470 mil obras, CC0, sem chave de API. Diferente do Art Institute of
Chicago (descrição curatorial livre), o Met não tem campo de texto narrativo
— confirmado ao vivo inspecionando um objeto completo (todos os ~50 campos
são estruturados: cultura, período, meio, dimensões, crédito). Conteúdo
montado por concatenação dos campos disponíveis, mesmo padrão usado em
github.py antes do enriquecimento com README — real, mas mais raso que
Art Institute of Chicago.

Busca em 2 chamadas por item (lista de IDs → detalhe por objectID).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "the_met",
    "nome": "The Metropolitan Museum of Art",
    "area": "patrimonio",
    "descricao": "Coleção de +470 mil obras — metadado curatorial (cultura, período, meio).",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://collectionapi.metmuseum.org/public/collection/v1/search"
OBJECT_URL = "https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(SEARCH_URL, params={"q": query, "hasImages": "true"}, timeout=(10, 45))
    resp.raise_for_status()
    ids = (resp.json().get("objectIDs") or [])[:max_resultados]

    def extrair(object_id):
        try:
            detalhe = requests.get(OBJECT_URL.format(id=object_id), timeout=(10, 20)).json()
        except Exception:
            return None

        partes = []
        for label, campo in [
            ("Nome do objeto", "objectName"), ("Cultura", "culture"), ("Período", "period"),
            ("Data", "objectDate"), ("Meio", "medium"), ("Dimensões", "dimensions"),
            ("Origem", "creditLine"), ("Classificação", "classification"),
        ]:
            valor = detalhe.get(campo)
            if valor:
                partes.append(f"{label}: {valor}")
        if not partes:
            return None

        titulo = detalhe.get("title") or "Sem título"
        return {"titulo": titulo, "texto": "\n".join(partes), "url_origem": detalhe.get("objectURL", "")}

    return executar_busca_generica(
        ids, extrair, "the_met", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
