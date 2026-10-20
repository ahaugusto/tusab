# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: OSTI.gov (Office of Scientific and Technical Information, do
Departamento de Energia dos EUA) — relatórios técnicos e artigos de pesquisa
financiada pelo DOE (energia, física, materiais). Sem chave de API.

Endpoint: GET https://www.osti.gov/api/v1/records?q=...&rows=N
          com header `Accept: application/json`.

Achados do teste ao vivo (20/out/2026):
- Sem `Accept: application/json` a API responde XML.
- Resposta é uma lista JSON (não um objeto). Resumo em `description`
  (~1,1–1,5 mil caracteres em "graphene"); registros sem descrição são
  descartados.
- `links[]` traz rel "citation" (página do registro), "fulltext" (servlet
  de PDF) e "citation_doe_pages". Só usamos a página de citação; o PDF não
  é baixado (sem texto puro disponível).
- Conexão instável: em 1 de 5 buscas o connect estourou os 10 s; nas outras
  respondeu entre 0,8 s e 18 s. O erro chega ao usuário como timeout normal
  (mensagem_erro_busca_externa).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "osti",
    "nome": "OSTI.gov (Departamento de Energia dos EUA)",
    "area": "fisica",
    "descricao": "Relatórios técnicos e artigos de pesquisa financiada pelo DOE — resumo real de cada registro.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://www.osti.gov/api/v1/records"
_HEADERS = {**HEADERS_TUSABBOT, "Accept": "application/json"}


def _url_citacao(item: dict) -> str:
    for link in item.get("links") or []:
        if (link or {}).get("rel") == "citation" and link.get("href"):
            return link["href"]
    osti_id = item.get("osti_id")
    return f"https://www.osti.gov/biblio/{osti_id}" if osti_id else ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, params={"q": query, "rows": max_resultados},
        headers=_HEADERS, timeout=(10, 30),
    )
    resp.raise_for_status()
    dados = exigir_json(resp, FONTE_META["nome"])
    itens = (dados if isinstance(dados, list) else [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        resumo = (item.get("description") or "").strip()
        if not resumo:
            return None
        titulo = (item.get("title") or "Sem título").strip()
        return {"titulo": titulo, "texto": resumo, "url_origem": _url_citacao(item)}

    return executar_busca_generica(
        itens, extrair, "osti", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
