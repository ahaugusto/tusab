# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: HAL (Hyper Articles en Ligne) — arquivo aberto francês de
produção científica de todas as áreas, mantido pelo CCSD/CNRS. Sem chave de
API.

Endpoint: GET https://api.archives-ouvertes.fr/search/?q=...
          &fq=submitType_s:file
          &fl=title_s,abstract_s,uri_s,fileMain_s,language_s,producedDateY_i
          &rows=N&wt=json

Achados do teste ao vivo (20/out/2026):
- Solr: resultados em `response.docs[]` (`numFound` = 6.367 para
  "renewable energy" só com depósito de arquivo).
- `fq=submitType_s:file` restringe a registros com documento depositado
  (exclui notícias só de metadado).
- `title_s` e `abstract_s` são listas (uma entrada por idioma); usamos a
  primeira. ~1,5–2,5 mil caracteres de resumo.
- `fileMain_s` aponta para o PDF principal; não baixamos (sem texto puro),
  só registramos o link no texto.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "hal",
    "nome": "HAL (Archive Ouverte)",
    "area": "geral",
    "descricao": "Arquivo aberto francês multidisciplinar — resumo de cada artigo com PDF depositado.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://api.archives-ouvertes.fr/search/"
_CAMPOS = "title_s,abstract_s,uri_s,fileMain_s,language_s,producedDateY_i"


def _primeiro(valor) -> str:
    if isinstance(valor, list):
        valor = valor[0] if valor else ""
    return (valor or "").strip() if isinstance(valor, str) else ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(API_URL, params={
        "q": query, "fq": "submitType_s:file", "fl": _CAMPOS,
        "rows": max_resultados, "wt": "json",
    }, headers=HEADERS_TUSABBOT, timeout=(10, 30))
    resp.raise_for_status()
    itens = ((exigir_json(resp, FONTE_META["nome"]).get("response") or {}).get("docs") or [])[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(doc):
        resumo = _primeiro(doc.get("abstract_s"))
        if not resumo:
            return None
        titulo = _primeiro(doc.get("title_s")) or "Sem título"
        texto = resumo
        meta = []
        if doc.get("producedDateY_i"):
            meta.append(f"Ano: {doc['producedDateY_i']}")
        idioma = _primeiro(doc.get("language_s"))
        if idioma:
            meta.append(f"Idioma: {idioma}")
        if doc.get("fileMain_s"):
            meta.append(f"PDF: {doc['fileMain_s']}")
        if meta:
            texto += "\n\n" + "\n".join(meta)
        return {"titulo": titulo, "texto": texto, "url_origem": doc.get("uri_s") or ""}

    return executar_busca_generica(
        itens, extrair, "hal", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
