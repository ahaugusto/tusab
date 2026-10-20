# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: USGS Publications Warehouse — publicações do Serviço
Geológico dos EUA (hidrologia, geologia, ecossistemas, riscos naturais). Sem
chave de API.

Endpoint: GET https://pubs.usgs.gov/pubs-services/publication/?q=...&page_size=N

Achados do teste ao vivo (20/out/2026):
- Itens em `records[]` (com `recordCount` no topo — 8.383 para
  "groundwater").
- Resumo em `docAbstract`, em HTML (<p><span>...) — convertido com
  html_para_texto. ~2–4 mil caracteres por publicação.
- Página pública: https://pubs.usgs.gov/publication/{indexId}. Alguns
  registros têm "HTML Document"/PDF em `links[]`, mas não de forma
  consistente — ficamos com o resumo.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "usgs_pubs",
    "nome": "USGS Publications Warehouse",
    "area": "terra",
    "descricao": "Publicações do Serviço Geológico dos EUA (água, geologia, riscos naturais) — resumo de cada estudo.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://pubs.usgs.gov/pubs-services/publication/"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, params={"q": query, "page_size": max_resultados},
        headers=HEADERS_TUSABBOT, timeout=(10, 30),
    )
    resp.raise_for_status()
    itens = (exigir_json(resp, FONTE_META["nome"]).get("records") or [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        resumo = html_para_texto(item.get("docAbstract") or "")
        if not resumo:
            return None
        titulo = (item.get("title") or "Sem título").strip()
        index_id = item.get("indexId") or ""
        url_origem = f"https://pubs.usgs.gov/publication/{index_id}" if index_id else ""
        return {"titulo": titulo, "texto": resumo, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "usgs_pubs", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
