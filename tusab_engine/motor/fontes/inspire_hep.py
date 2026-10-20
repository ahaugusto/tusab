# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: INSPIRE-HEP — base de literatura de física de altas energias
(partículas, cosmologia, astrofísica, instrumentação) mantida por CERN,
DESY, Fermilab, IHEP e SLAC. Sem chave de API.

Endpoint: GET https://inspirehep.net/api/literature?q=...&size=N
          &fields=titles,abstracts,arxiv_eprints,control_number

Achados do teste ao vivo (20/out/2026):
- Registros em `hits.hits[].metadata`; `fields=` reduz a resposta ao que
  usamos.
- Título em `titles[0].title`, resumo em `abstracts[0].value` (~0,6–1,5 mil
  caracteres em "graphene"); `abstracts` pode ter mais de uma fonte (editora
  + arXiv) — usamos a primeira.
- A query vai como texto livre: buscas com várias palavras ("dark matter
  detection") funcionam sem sintaxe SPIRES (`find t ...`).
- Muitos registros têm `arxiv_eprints[0].value` — acrescentamos o link do
  arXiv ao texto (o texto integral não é baixado daqui).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "inspire_hep",
    "nome": "INSPIRE-HEP",
    "area": "fisica",
    "descricao": "Literatura de física de altas energias (CERN, DESY, Fermilab, SLAC) — resumo e link do arXiv.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://inspirehep.net/api/literature"
_CAMPOS = "titles,abstracts,arxiv_eprints,control_number"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, params={"q": query, "size": max_resultados, "fields": _CAMPOS},
        headers=HEADERS_TUSABBOT, timeout=(10, 30),
    )
    resp.raise_for_status()
    hits = (exigir_json(resp, FONTE_META["nome"]).get("hits") or {}).get("hits") or []
    itens = [h.get("metadata") or {} for h in hits][:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(meta):
        abstracts = meta.get("abstracts") or []
        resumo = ((abstracts[0] or {}).get("value") or "").strip() if abstracts else ""
        if not resumo:
            return None
        titulos = meta.get("titles") or []
        titulo = (((titulos[0] or {}).get("title") if titulos else "") or "Sem título").strip()
        texto = resumo
        eprints = meta.get("arxiv_eprints") or []
        arxiv_id = (eprints[0] or {}).get("value") if eprints else ""
        if arxiv_id:
            texto += f"\n\narXiv: https://arxiv.org/abs/{arxiv_id}"
        url_origem = f"https://inspirehep.net/literature/{meta.get('control_number', '')}"
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "inspire_hep", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
