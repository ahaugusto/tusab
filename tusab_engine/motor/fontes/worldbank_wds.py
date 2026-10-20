# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Banco Mundial — Documents & Reports (WDS, World Bank Documents
and Reports API v3), sem chave de API.

Endpoint: GET https://search.worldbank.org/api/v3/wds?format=json&qterm=...
          &rows=N&os=0&fl=display_title,abstracts,docdt,txturl,docty,url,lang

Achados do teste ao vivo (20/out/2026):
- `documents` é um dict id → documento, com uma chave extra `facets` (não é
  documento — ignorada).
- Abstract em `abstracts["cdata!"]`; texto integral em `txturl` (.txt já
  extraído pelo próprio Banco Mundial — ~105 mil caracteres num Policy
  Research Working Paper). O `txturl` vem em http:// e redireciona para
  documents1.worldbank.org em https; pedimos direto em https.
- Sem filtro, buscas genéricas ("water") trazem muitos tipos administrativos
  sem abstract (Procurement Plan, Project Information Document, ESRS). Tipos
  de aquisição/licitação são excluídos e documentos sem abstract
  descartados — por isso a busca pede 4x mais linhas e corta no limite
  depois do filtro.
- Há conteúdo em português (`lang` = "Portuguese"); não filtramos idioma.
- Filtro de data `strdate`/`enddate` (YYYY-MM-DD) funciona, MAS só com os
  dois juntos: `strdate` sozinho restringe ao ano daquela data (strdate=
  2015-01-01 devolveu só documentos de 2015) e `enddate` sozinho também muda
  o total de forma inconsistente. Por isso o lado ausente é preenchido
  (1900-01-01 / hoje).
"""

import os
import re
from datetime import date

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "worldbank_wds",
    "nome": "Banco Mundial — Documents & Reports",
    "area": "economia",
    "descricao": "Relatórios, working papers e estudos do Banco Mundial — abstract e texto integral.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

API_URL = "https://search.worldbank.org/api/v3/wds"
_CAMPOS = "display_title,abstracts,docdt,txturl,docty,url,lang"
LIMITE_TEXTO_INTEGRAL = 200_000

# Tipos de documento de aquisição/licitação — administrativos, sem conteúdo
# analítico útil para RAG (e quase sempre sem abstract).
_RE_TIPO_PROCUREMENT = re.compile(
    r"procurement|contract award|bid evaluation|invitation for bids|"
    r"expression of interest|request for proposals?",
    re.IGNORECASE,
)


def _https(url: str) -> str:
    return re.sub(r"^http://", "https://", url or "")


def _eh_procurement(doc: dict) -> bool:
    return bool(_RE_TIPO_PROCUREMENT.search(doc.get("docty") or ""))


def _abstract(doc: dict) -> str:
    abstracts = doc.get("abstracts")
    if isinstance(abstracts, dict):
        return (abstracts.get("cdata!") or "").strip()
    return ""


def _baixar_texto_integral(url: str) -> str:
    """Best-effort — "" se falhar ou se não vier texto puro."""
    if not url:
        return ""
    try:
        resp = requests.get(_https(url), headers=HEADERS_TUSABBOT, timeout=(10, 60))
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

    params = {
        "format": "json", "qterm": query, "rows": max_resultados * 4, "os": 0, "fl": _CAMPOS,
    }
    if data_inicio or data_fim:
        params["strdate"] = data_inicio or "1900-01-01"
        params["enddate"] = data_fim or date.today().isoformat()

    resp = requests.get(API_URL, params=params, headers=HEADERS_TUSABBOT, timeout=(10, 30))
    resp.raise_for_status()
    documentos = exigir_json(resp, FONTE_META["nome"]).get("documents") or {}

    itens = [
        doc for chave, doc in documentos.items()
        if chave != "facets" and isinstance(doc, dict)
        and not _eh_procurement(doc) and _abstract(doc)
    ][:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(doc):
        resumo = _abstract(doc)
        if not resumo:
            return None
        titulo = (doc.get("display_title") or "Sem título").strip()
        # Abstract sempre primeiro; metadado curto logo depois.
        meta = []
        if doc.get("docty"):
            meta.append(f"Tipo: {doc['docty']}")
        if doc.get("docdt"):
            meta.append(f"Data: {doc['docdt'][:10]}")
        if doc.get("lang"):
            meta.append(f"Idioma: {doc['lang']}")
        texto = resumo + ("\n\n" + "\n".join(meta) if meta else "")
        integral = _baixar_texto_integral(doc.get("txturl"))
        if integral:
            texto += "\n\n--- TEXTO INTEGRAL ---\n" + integral
        return {"titulo": titulo, "texto": texto, "url_origem": _https(doc.get("url"))}

    return executar_busca_generica(
        itens, extrair, "worldbank_wds", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
