# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: GitHub — repositórios de código aberto. Sem chave de API.
Confirmado ao vivo: descrição, tópicos e linguagem via busca; README completo
via chamada extra por repositório (GET /repos/{owner}/{repo}/readme, base64).

Rate limit sem token: 10 req/min pra busca, 60 req/hora pro resto da API
(inclusive README) — confirmado ao vivo via GET /rate_limit. Uma busca de
20+ resultados já consome boa parte da cota horária só de README. Por isso
o README é best-effort: se a chamada falhar (rate limit, 404 sem README),
cai de volta pra descrição+tópicos+linguagem — nunca derruba o item.
"""

import base64
import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "github",
    "nome": "GitHub",
    "area": "tecnologia",
    "descricao": "Repositórios de código aberto — README, tópicos e linguagem.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.github.com/search/repositories"
_README_URL = "https://api.github.com/repos/{full_name}/readme"
_README_MAX_CHARS = 20_000  # README raramente passa disso; corpo é chunkado na indexação de qualquer forma


def _buscar_readme(full_name: str) -> str:
    """Best-effort — None se não existir README, der 404/403 (rate limit) ou qualquer outra falha."""
    try:
        resp = requests.get(
            _README_URL.format(full_name=full_name),
            headers={"Accept": "application/vnd.github+json"},
            timeout=(10, 20),
        )
        if not resp.ok:
            return None
        dados = resp.json()
        if dados.get("encoding") != "base64":
            return None
        texto = base64.b64decode(dados["content"]).decode("utf-8", errors="replace")
        return texto[:_README_MAX_CHARS]
    except Exception:
        return None


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
        full_name = item.get("full_name") or ""
        readme = _buscar_readme(full_name) if full_name else None

        if not descricao and not readme:
            return None

        partes = [descricao] if descricao else []
        if item.get("topics"):
            partes.append("Tópicos: " + ", ".join(item["topics"]))
        if item.get("language"):
            partes.append(f"Linguagem principal: {item['language']}")
        partes.append(f"{item.get('stargazers_count', 0)} estrelas no GitHub")
        if readme:
            partes.append("--- README ---\n" + readme)

        titulo = full_name or "Sem título"
        return {"titulo": titulo, "texto": "\n\n".join(partes), "url_origem": item.get("html_url", "")}

    # throttle maior que antes: cada item agora faz 1 chamada extra pro README,
    # e o rate limit de 60/h (não o de busca) é o gargalo real aqui.
    return executar_busca_generica(
        itens, extrair, "github", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
