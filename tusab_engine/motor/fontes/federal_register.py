# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Federal Register — diário oficial do governo federal dos EUA
(regras, propostas de regra, avisos, atos presidenciais). Sem chave de API.

Endpoint: GET https://www.federalregister.gov/api/v1/documents.json
          ?conditions[term]=...&per_page=N&fields[]=title&fields[]=abstract
          &fields[]=html_url&fields[]=pdf_url&fields[]=publication_date&fields[]=type

Achados do teste ao vivo (20/out/2026):
- Resultados em `results[]`; `abstract` é o resumo oficial do ato (~0,3–1
  mil caracteres em "renewable energy").
- Os links de texto integral do próprio federalregister.gov
  (`raw_text_url`, `body_html_url`) caem numa página "Request Access" para
  clientes automatizados — inutilizáveis.
- Caminho que funciona: a versão HTML do GovInfo, derivada de `pdf_url`
  (https://www.govinfo.gov/content/pkg/FR-AAAA-MM-DD/pdf/{doc}.pdf →
  .../html/{doc}.htm). Responde text/html com o texto do ato num <pre>
  (~19–22 mil caracteres por regra testada). Extraído com html_para_texto;
  se falhar, fica só o abstract.
- Filtro de data `conditions[publication_date][gte]`/`[lte]` (YYYY-MM-DD)
  funciona, inclusive só um dos lados (2020-01-01..2020-12-31 → 401
  documentos, todos de 2020).
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "federal_register",
    "nome": "Federal Register (EUA)",
    "area": "direito",
    "descricao": "Diário oficial do governo federal dos EUA — resumo e texto integral de regras e avisos.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

API_URL = "https://www.federalregister.gov/api/v1/documents.json"
_CAMPOS = ["title", "abstract", "html_url", "pdf_url", "publication_date", "type"]
LIMITE_TEXTO_INTEGRAL = 200_000
_RE_PDF_GOVINFO = re.compile(r"^(https://www\.govinfo\.gov/content/pkg/FR-[\d-]+)/pdf/([^/]+)\.pdf$")


def url_html_govinfo(pdf_url: str) -> str:
    """pdf_url do GovInfo → versão HTML equivalente; "" se não reconhecer."""
    m = _RE_PDF_GOVINFO.match((pdf_url or "").strip())
    return f"{m.group(1)}/html/{m.group(2)}.htm" if m else ""


def _baixar_texto_integral(pdf_url: str) -> str:
    """Best-effort — "" se falhar ou se não vier HTML."""
    url = url_html_govinfo(pdf_url)
    if not url:
        return ""
    try:
        resp = requests.get(url, headers=HEADERS_TUSABBOT, timeout=(10, 60))
        resp.raise_for_status()
        if "html" not in resp.headers.get("Content-Type", "").lower():
            return ""
        return html_para_texto(resp.text)[:LIMITE_TEXTO_INTEGRAL]
    except Exception:
        return ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    params = [("conditions[term]", query), ("per_page", max_resultados)]
    params += [("fields[]", c) for c in _CAMPOS]
    if data_inicio:
        params.append(("conditions[publication_date][gte]", data_inicio))
    if data_fim:
        params.append(("conditions[publication_date][lte]", data_fim))

    resp = requests.get(API_URL, params=params, headers=HEADERS_TUSABBOT, timeout=(10, 30))
    resp.raise_for_status()
    itens = (exigir_json(resp, FONTE_META["nome"]).get("results") or [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(doc):
        resumo = (doc.get("abstract") or "").strip()
        integral = _baixar_texto_integral(doc.get("pdf_url"))
        if not resumo and not integral:
            return None
        titulo = (doc.get("title") or "Sem título").strip()
        meta = []
        if doc.get("type"):
            meta.append(f"Tipo: {doc['type']}")
        if doc.get("publication_date"):
            meta.append(f"Publicação: {doc['publication_date']}")
        texto = resumo
        if meta:
            texto = (texto + "\n\n" if texto else "") + "\n".join(meta)
        if integral:
            texto += "\n\n--- TEXTO INTEGRAL ---\n" + integral
        return {"titulo": titulo, "texto": texto, "url_origem": doc.get("html_url") or ""}

    return executar_busca_generica(
        itens, extrair, "federal_register", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
