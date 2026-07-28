# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: GitHub — repositórios de código aberto. Sem chave de API
(rate limit mais baixo sem token, mas suficiente pra uso pontual de busca).
Confirmado ao vivo: descrição real por repositório (curta, mas substantiva),
tópicos e linguagem principal.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "github",
    "nome": "GitHub",
    "area": "tecnologia",
    "descricao": "Repositórios de código aberto — descrição, tópicos e linguagem.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.github.com/search/repositories"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={"q": query, "per_page": max_resultados},
        headers={"Accept": "application/vnd.github+json"},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("items", [])

    def extrair(item):
        descricao = item.get("description") or ""
        if not descricao:
            return None
        partes = [descricao]
        if item.get("topics"):
            partes.append("Tópicos: " + ", ".join(item["topics"]))
        if item.get("language"):
            partes.append(f"Linguagem principal: {item['language']}")
        partes.append(f"{item.get('stargazers_count', 0)} estrelas no GitHub")
        titulo = item.get("full_name") or "Sem título"
        return {"titulo": titulo, "texto": "\n\n".join(partes), "url_origem": item.get("html_url", "")}

    # Uma única chamada de busca (sem follow-up por item) — o rate limit de
    # 10 req/min sem token só afeta buscas em sequência muito rápida, não
    # o processamento dos itens já retornados.
    return executar_busca_generica(
        itens, extrair, "github", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.1,
    )
