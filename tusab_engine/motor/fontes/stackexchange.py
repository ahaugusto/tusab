# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Stack Exchange (Stack Overflow) — perguntas e respostas
técnicas. Sem chave de API (quota de 300 req/dia por IP, suficiente pra uso
pontual de busca — confirmado ao vivo: quota_remaining consumida normalmente).
Confirmado ao vivo: corpo real da pergunta disponível via filter=withbody.
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "stackexchange",
    "nome": "Stack Overflow",
    "area": "tecnologia",
    "descricao": "Perguntas e respostas técnicas da comunidade Stack Overflow.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.stackexchange.com/2.3/search/advanced"
_TAG_RE = re.compile(r'<[^>]+>')


def _limpar_html(texto: str) -> str:
    texto = _TAG_RE.sub(' ', texto or '')
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        BASE_URL,
        params={
            "order": "desc", "sort": "relevance", "q": query,
            "site": "stackoverflow", "pagesize": max_resultados, "filter": "withbody",
        },
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("items", [])

    def extrair(item):
        corpo = _limpar_html(item.get("body", ""))
        if not corpo:
            return None
        partes = [corpo]
        if item.get("tags"):
            partes.append("Tags: " + ", ".join(item["tags"]))
        partes.append(f"{item.get('score', 0)} votos · {item.get('answer_count', 0)} resposta(s)")
        titulo = item.get("title") or "Sem título"
        return {"titulo": titulo, "texto": "\n\n".join(partes), "url_origem": item.get("link", "")}

    return executar_busca_generica(
        itens, extrair, "stackexchange", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
