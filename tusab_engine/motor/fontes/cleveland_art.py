# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Cleveland Museum of Art — Open Access API (coleção CC0 com
mais de 60 mil obras), sem chave de API.

Endpoint: GET https://openaccess-api.clevelandart.org/api/artworks/?q=...
          &limit=N&has_image=1

Achados do teste ao vivo (20/out/2026):
- Itens em `data[]` (+ `info` com totais).
- Diferente do The Met (só campos estruturados), há texto curatorial real em
  `description` (~500–700 caracteres em "river": contexto histórico e
  iconográfico da obra). Obras sem `description` são descartadas.
- `tombstone` é a ficha catalográfica em uma linha (título, data, autor,
  técnica, dimensões); `culture` é lista; `technique` é string. Entram como
  contexto depois da descrição.
- Página pública da obra em `url` (https://clevelandart.org/art/{accession}).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "cleveland_art",
    "nome": "Cleveland Museum of Art",
    "area": "patrimonio",
    "descricao": "Coleção aberta (CC0) do museu de Cleveland — texto curatorial de cada obra.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://openaccess-api.clevelandart.org/api/artworks/"


def _como_texto(valor) -> str:
    if isinstance(valor, list):
        return "; ".join(str(v).strip() for v in valor if v)
    return (valor or "").strip() if isinstance(valor, str) else ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, params={"q": query, "limit": max_resultados, "has_image": 1},
        headers=HEADERS_TUSABBOT, timeout=(10, 30),
    )
    resp.raise_for_status()
    itens = (exigir_json(resp, FONTE_META["nome"]).get("data") or [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(obra):
        descricao = html_para_texto(obra.get("description") or "")
        if not descricao:
            return None
        titulo = (obra.get("title") or "Sem título").strip()
        contexto = []
        for rotulo, campo in [("Ficha", "tombstone"), ("Cultura", "culture"), ("Técnica", "technique")]:
            valor = _como_texto(obra.get(campo))
            if valor:
                contexto.append(f"{rotulo}: {valor}")
        texto = descricao + ("\n\n" + "\n".join(contexto) if contexto else "")
        return {"titulo": titulo, "texto": texto, "url_origem": obra.get("url") or ""}

    return executar_busca_generica(
        itens, extrair, "cleveland_art", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
