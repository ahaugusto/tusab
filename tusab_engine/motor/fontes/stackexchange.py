# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Stack Exchange (Stack Overflow) — perguntas e respostas
técnicas. Sem chave de API (quota de 300 req/dia por IP, suficiente pra uso
pontual de busca — confirmado ao vivo: quota_remaining consumida normalmente).
Confirmado ao vivo: corpo real da pergunta disponível via filter=withbody.
"""

import html
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


# O conteúdo do Stack Overflow é CC BY-SA e pede crédito ao autor: nome, link do perfil, link do
# post e a licença, que depende da data (2.5 até 08/04/2011, 3.0 até 02/05/2018, depois 4.0).
def licenca_stack_overflow(criado_em_segundos) -> str:
    try:
        t = float(criado_em_segundos or 0)
    except (TypeError, ValueError):
        t = 0
    if t < 1302220800:   # 2011-04-08 00:00 UTC
        return "CC BY-SA 2.5"
    if t < 1525219200:   # 2018-05-02 00:00 UTC
        return "CC BY-SA 3.0"
    return "CC BY-SA 4.0"


def extrair_item(item):
    """Item da API → documento, com a atribuição exigida pela licença no fim do texto."""
    corpo = _limpar_html(item.get("body", ""))
    if not corpo:
        return None
    partes = [corpo]
    if item.get("tags"):
        partes.append("Tags: " + ", ".join(item["tags"]))
    partes.append(f"{item.get('score', 0)} votos · {item.get('answer_count', 0)} resposta(s)")
    dono = item.get("owner") or {}
    autor = html.unescape(dono.get("display_name") or "") or "autor não informado"
    perfil = f" ({dono['link']})" if dono.get("link") else ""
    partes.append(f"Autor: {autor}{perfil} · Stack Overflow · Licença: {licenca_stack_overflow(item.get('creation_date'))}")
    titulo = html.unescape(item.get("title") or "") or "Sem título"
    return {"titulo": titulo, "texto": "\n\n".join(partes), "url_origem": item.get("link", "")}


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

    return executar_busca_generica(
        itens, extrair_item, "stackexchange", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
