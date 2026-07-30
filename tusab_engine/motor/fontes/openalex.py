# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: OpenAlex — catálogo aberto da produção científica global.
Sem chave de API. Confirmado ao vivo: ~322mi de trabalhos, abstract real
disponível (formato invertido, reconstruído em texto corrido aqui).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "openalex",
    "nome": "OpenAlex",
    "area": "geral",
    "descricao": "Catálogo aberto da produção científica global (~322mi de trabalhos).",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": True,
}

BASE_URL = "https://api.openalex.org/works"


def _reconstruir_abstract(inverted_index: dict) -> str:
    """OpenAlex devolve o abstract como {palavra: [posições]} — reconstrói a ordem original."""
    if not inverted_index:
        return ""
    posicoes = {}
    for palavra, idxs in inverted_index.items():
        for i in idxs:
            posicoes[i] = palavra
    return " ".join(posicoes[i] for i in sorted(posicoes))


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    filtros = [f"fulltext.search:{query}"]
    if autor.strip():
        filtros.append(f"authorships.author.display_name.search:{autor.strip()}")
    if data_inicio:
        filtros.append(f"from_publication_date:{data_inicio}")
    if data_fim:
        filtros.append(f"to_publication_date:{data_fim}")

    resp = requests.get(
        BASE_URL,
        params={"filter": ",".join(filtros), "per-page": max_resultados},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("results", [])

    def extrair(item):
        abstract = _reconstruir_abstract(item.get("abstract_inverted_index"))
        if not abstract:
            return None  # sem abstract disponível — baixo valor pra RAG, pula
        titulo = item.get("title") or item.get("display_name") or "Sem título"
        return {"titulo": titulo, "texto": abstract, "url_origem": item.get("id", "")}

    return executar_busca_generica(
        itens, extrair, "openalex", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.2,
    )
