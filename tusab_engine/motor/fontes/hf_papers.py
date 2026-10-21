# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Hugging Face — Papers. Busca de artigos de IA curados pela
comunidade do Hugging Face (Daily Papers), sem chave de API.

Testado ao vivo (20/out/2026): `GET https://huggingface.co/api/papers/search?q=<termo>`
devolve até ~120 itens sem paginação, cada um com `paper.title`,
`paper.summary` (abstract completo), `paper.publishedAt`, `paper.id` (id do
arXiv) e, em parte deles, `paper.ai_keywords`. Uma chamada só, sem request
por item. Complementa o arXiv: aqui entram os artigos que a comunidade de IA
destacou e discutiu, com a mesma URL canônica do arXiv para o texto integral.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio
from ._huggingface import HF

FONTE_META = {
    "id": "hf_papers",
    "nome": "Hugging Face — Papers",
    "area": "tecnologia",
    "descricao": "Artigos de IA destacados pela comunidade do Hugging Face — abstract completo e link do arXiv.",
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

    resp = requests.get(f"{HF}/api/papers/search", headers=HEADERS_TUSABBOT,
                        params={"q": query}, timeout=(10, 30))
    resp.raise_for_status()
    dados = resp.json()
    if not isinstance(dados, list):
        raise RuntimeError("Hugging Face mudou o formato da busca de papers (esperava uma lista)")
    itens = [d for d in dados if (d.get("paper") or {}).get("summary")][:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        p = item["paper"]
        titulo = " ".join((p.get("title") or "").split())
        resumo = " ".join((p.get("summary") or "").split())
        if not titulo or len(resumo) < 100:
            return None
        autores = [a.get("name", "") for a in (p.get("authors") or [])][:8]
        linhas = [resumo]
        if autores:
            linhas.append("Autores: " + ", ".join(a for a in autores if a))
        if p.get("publishedAt"):
            linhas.append("Publicado em: " + p["publishedAt"][:10])
        if p.get("ai_keywords"):
            linhas.append("Palavras-chave: " + ", ".join(p["ai_keywords"][:10]))
        if p.get("id"):
            linhas.append(f"arXiv: https://arxiv.org/abs/{p['id']}")
        return {"titulo": titulo, "texto": "\n\n".join(linhas), "url_origem": f"{HF}/papers/{p.get('id', '')}"}

    return executar_busca_generica(
        itens, extrair, "hf_papers", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
