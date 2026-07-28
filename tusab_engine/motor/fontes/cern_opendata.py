# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: CERN Open Data — conjuntos de dados de colisões do LHC. Sem
chave de API. Único candidato viável da área "Física, química e materiais"
com busca real por tema e texto narrativo real: PubChem só faz lookup por
nome exato de composto (não busca por tema — mesmo problema do PyPI, ver
agents/_historia.md); NOMAD é repositório de cálculo computacional, campos
puramente estruturados/numéricos, sem narrativa; The Materials Project exige
chave; NIST Chemistry WebBook não tem API, só páginas HTML; Crystallography
Open DB não testado nesta rodada.

Confirmado ao vivo: abstract real em HTML por dataset (limpo aqui, mesmo
padrão de zenodo.py/stackexchange.py).
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "cern_opendata",
    "nome": "CERN Open Data",
    "area": "fisica",
    "descricao": "Conjuntos de dados de colisões do LHC — descrição real de cada dataset.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://opendata.cern.ch/api/records/"
_TAG_RE = re.compile(r'<[^>]+>')


def _limpar_html(texto: str) -> str:
    texto = _TAG_RE.sub(' ', texto or '')
    return re.sub(r'\s+', ' ', texto).strip()


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"q": query, "size": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("hits", {}).get("hits", [])

    def extrair(item):
        meta = item.get("metadata", {})
        abstract_raw = meta.get("abstract")
        descricao = abstract_raw.get("description") if isinstance(abstract_raw, dict) else abstract_raw
        texto = _limpar_html(descricao)
        if not texto:
            return None
        titulo = meta.get("title") or "Sem título"
        url_origem = f"https://opendata.cern.ch/record/{item.get('id', '')}" if item.get("id") else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "cern_opendata", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
