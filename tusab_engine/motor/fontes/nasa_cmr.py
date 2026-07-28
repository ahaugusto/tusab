# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: NASA Earthdata (CMR — Common Metadata Repository) — catálogo
de coleções de dados de satélites e sensores. Sem chave de API. Único
candidato viável da área "Ciências da Terra, clima e espaço" com busca real
por tema e resumo narrativo: NOAA (Climate Data Online) exige token
cadastrado; Open-Meteo/USGS Earthquake/INMET são dado numérico/geoespacial
estruturado, não texto narrativo; Copernicus/USGS EarthExplorer (M2M) são
catálogos de imagem, não documento.

Diferente da maioria dos bancos geoespaciais (coordenadas, séries temporais),
cada coleção do CMR tem um campo `summary` — resumo real descrevendo o que o
dataset cobre e como foi produzido. Confirmado ao vivo: ~1.3KB de resumo real
por coleção.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "nasa_cmr",
    "nome": "NASA Earthdata",
    "area": "terra",
    "descricao": "Catálogo de coleções de dados de satélites e sensores — resumo real de cada dataset.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://cmr.earthdata.nasa.gov/search/collections.json"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"keyword": query, "page_size": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("feed", {}).get("entry", [])

    def extrair(item):
        resumo = (item.get("summary") or "").strip()
        if not resumo:
            return None
        titulo = item.get("title") or "Sem título"
        url_origem = (item.get("links") or [{}])[0].get("href", "")
        return {"titulo": titulo, "texto": resumo, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "nasa_cmr", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
