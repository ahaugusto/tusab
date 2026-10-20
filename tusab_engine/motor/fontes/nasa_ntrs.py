# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: NASA Technical Reports Server (NTRS) — relatórios técnicos,
artigos e apresentações produzidos ou financiados pela NASA. Sem chave de API.

Endpoint: GET https://ntrs.nasa.gov/api/citations/search?q=...&page.size=N

Achados do teste ao vivo (20/out/2026):
- Resultados em `results[]`; título em `title`, abstract em `abstract`
  (~1–2 mil caracteres em "climate change").
- `disseminated` distingue registro só de metadado ("METADATA_ONLY", ex.:
  relatório do IPCC indexado sem arquivo) de registro com documento
  ("DOCUMENT_AND_METADATA"). Só no segundo caso há arquivo para baixar.
- `downloads[].links.fulltext` é caminho relativo
  (/api/citations/{id}/downloads/{id}.txt) para o texto já extraído do PDF
  pela própria NASA — text/plain, ~56 mil caracteres num artigo de revisão.
- Página pública do registro: https://ntrs.nasa.gov/citations/{id}.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "nasa_ntrs",
    "nome": "NASA Technical Reports Server",
    "area": "terra",
    "descricao": "Relatórios técnicos e artigos da NASA — abstract e texto integral quando disponível.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE = "https://ntrs.nasa.gov"
API_URL = BASE + "/api/citations/search"
LIMITE_TEXTO_INTEGRAL = 200_000


def _url_texto_integral(item: dict) -> str:
    if item.get("disseminated") != "DOCUMENT_AND_METADATA":
        return ""
    for download in item.get("downloads") or []:
        caminho = ((download or {}).get("links") or {}).get("fulltext") or ""
        if caminho:
            return caminho if caminho.startswith("http") else BASE + caminho
    return ""


def _baixar_texto_integral(url: str) -> str:
    """Best-effort — "" se falhar ou se não vier texto puro."""
    if not url:
        return ""
    try:
        resp = requests.get(url, headers=HEADERS_TUSABBOT, timeout=(10, 60))
        resp.raise_for_status()
        if "text/plain" not in resp.headers.get("Content-Type", "").lower():
            return ""
        texto = resp.content.decode("utf-8", errors="replace").strip()
        return texto[:LIMITE_TEXTO_INTEGRAL]
    except Exception:
        return ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, params={"q": query, "page.size": max_resultados},
        headers=HEADERS_TUSABBOT, timeout=(10, 30),
    )
    resp.raise_for_status()
    itens = (exigir_json(resp, FONTE_META["nome"]).get("results") or [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        resumo = (item.get("abstract") or "").strip()
        if not resumo:
            return None
        titulo = (item.get("title") or "Sem título").strip()
        texto = resumo
        integral = _baixar_texto_integral(_url_texto_integral(item))
        if integral:
            texto += "\n\n--- TEXTO INTEGRAL ---\n" + integral
        return {"titulo": titulo, "texto": texto, "url_origem": f"{BASE}/citations/{item.get('id', '')}"}

    return executar_busca_generica(
        itens, extrair, "nasa_ntrs", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
