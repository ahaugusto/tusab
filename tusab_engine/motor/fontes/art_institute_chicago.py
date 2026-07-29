# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Art Institute of Chicago — coleção com descrições curatoriais
reais e ricas. Sem chave de API. Confirmado ao vivo: descrição narrativa de
~2.700 caracteres por obra (HTML, limpo aqui), sobre artista/contexto/
história — melhor qualidade textual da área "Patrimônio cultural, história e
arquivos" encontrada nesta rodada.
"""

import os
import re

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "art_institute_chicago",
    "nome": "Art Institute of Chicago",
    "area": "patrimonio",
    "descricao": "Coleção de obras com descrição curatorial narrativa real.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://api.artic.edu/api/v1/artworks/search"
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

    resp = requests.get(
        BASE_URL,
        params={"q": query, "limit": max_resultados, "fields": "id,title,description"},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("data", [])

    def extrair(item):
        texto = _limpar_html(item.get("description"))
        if not texto:
            return None
        titulo = item.get("title") or "Sem título"
        url_origem = f"https://www.artic.edu/artworks/{item.get('id', '')}" if item.get("id") else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "art_institute_chicago", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
