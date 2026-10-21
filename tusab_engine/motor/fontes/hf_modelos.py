# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Hugging Face — Modelos. Busca modelos de IA no Hub (ordenados
por downloads) e salva o model card de cada um: descrição, uso, dados de
treino, limitações e avaliação. Sem chave de API — ver _huggingface.py para o
contrato e os achados do teste ao vivo (20/out/2026). Modelos com acesso
restrito (gated) são pulados.
"""

import os

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio
from ._huggingface import HF, baixar_card, buscar_repos, cabecalho_repo

FONTE_META = {
    "id": "hf_modelos",
    "nome": "Hugging Face — Modelos",
    "area": "tecnologia",
    "descricao": "Modelos de IA abertos do Hugging Face Hub — model card completo de cada um (uso, treino, limitações).",
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

    # Pede o dobro: parte dos mais baixados é gated (sem card) e é pulada.
    itens = buscar_repos("models", query, min(max_resultados * 2, 100))
    if not itens:
        return resultado_vazio()
    salvos = {"n": 0}

    def extrair(item):
        if salvos["n"] >= max_resultados:
            return None
        card = baixar_card("", item.get("id", ""))
        if not card or len(card) < 200:
            return None
        salvos["n"] += 1
        return {
            "titulo": f"Modelo {item['id']}",
            "texto": cabecalho_repo(item, "Modelo") + "\n\n" + card,
            "url_origem": f"{HF}/{item['id']}",
        }

    return executar_busca_generica(
        itens, extrair, "hf_modelos", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
