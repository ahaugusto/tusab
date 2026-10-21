# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Hugging Face — Datasets. Busca conjuntos de dados no Hub
(ordenados por downloads) e salva o dataset card de cada um: conteúdo,
origem, formato, licença e usos previstos. Sem chave de API — ver
_huggingface.py (cards de dataset chegam a dezenas de KB; limite de 60 mil
caracteres por documento). Datasets com acesso restrito são pulados.
"""

import os

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio
from ._huggingface import HF, baixar_card, buscar_repos, cabecalho_repo

FONTE_META = {
    "id": "hf_datasets",
    "nome": "Hugging Face — Datasets",
    "area": "tecnologia",
    "descricao": "Conjuntos de dados abertos do Hugging Face Hub — dataset card completo (conteúdo, origem, licença).",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    itens = buscar_repos("datasets", query, min(max_resultados * 2, 100))
    if not itens:
        return resultado_vazio()
    salvos = {"n": 0}

    def extrair(item):
        if salvos["n"] >= max_resultados:
            return None
        card = baixar_card("datasets/", item.get("id", ""))
        if not card or len(card) < 200:
            return None
        salvos["n"] += 1
        return {
            "titulo": f"Dataset {item['id']}",
            "texto": cabecalho_repo(item, "Dataset") + "\n\n" + card,
            "url_origem": f"{HF}/datasets/{item['id']}",
        }

    return executar_busca_generica(
        itens, extrair, "hf_datasets", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
