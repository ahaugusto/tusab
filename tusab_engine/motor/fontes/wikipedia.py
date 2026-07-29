# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Wikipédia em português (MediaWiki Action API), sem chave de
API. Busca real por palavra-chave (`list=search`, full-text — confirmado ao
vivo, ex: "xenotransplante" retorna artigos por relevância, não só título
exato) + resumo real do artigo (`prop=extracts`, texto corrido em prosa,
não wikitext bruto).

Achado: Wikidata (candidato natural pra "conhecimento estruturado") foi
testado e descartado — o campo `description` retornado pela busca é um
rótulo curtíssimo ("species of big cat native to the Americas"), sem
narrativa real; o dado de fato narrativo mora na Wikipédia, não no
Wikidata. DBpedia foi descartado pelo mesmo motivo (abstracts em pt/BR
frequentemente vazios via SPARQL, e quando existem são os mesmos textos da
Wikipédia, só que atrás de um pipeline SPARQL mais frágil). GeoNames exige
conta cadastrada. Getty Vocabularies e Glottolog são vocabulário/metadado
estruturado (termos, classificação), sem campo de texto narrativo — Glottolog
confirmado ao vivo com `description` vazio no idioma testado.

Busca em 2 chamadas totais (não por item): `list=search` pra obter os
títulos relevantes, depois um único `prop=extracts` batelado com todos os
títulos de uma vez (mesmo padrão de pubmed.py — um efetch só pra todos os
IDs).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "wikipedia",
    "nome": "Wikipédia (PT)",
    "area": "antropologia",
    "descricao": "Busca textual completa na Wikipédia em português — resumo real de cada artigo.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://pt.wikipedia.org/w/api.php"
_HEADERS = {"User-Agent": "TusabBot/1.0 (+local personal knowledge tool; contato via github.com/ahaugusto/tusab)"}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp_busca = requests.get(API_URL, headers=_HEADERS, params={
        "action": "query", "list": "search", "srsearch": query,
        "srlimit": max_resultados, "format": "json",
    }, timeout=(10, 30))
    resp_busca.raise_for_status()
    resultados = resp_busca.json().get("query", {}).get("search", [])
    if not resultados:
        return {"ok": True, "total_encontrados": 0, "total_salvos": 0, "erros": []}

    titulos = [r["title"] for r in resultados]
    resp_extrai = requests.get(API_URL, headers=_HEADERS, params={
        "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
        "titles": "|".join(titulos), "format": "json",
    }, timeout=(10, 45))
    resp_extrai.raise_for_status()
    paginas = resp_extrai.json().get("query", {}).get("pages", {})
    extratos_por_titulo = {p.get("title"): p.get("extract", "") for p in paginas.values()}

    def extrair(titulo):
        texto = (extratos_por_titulo.get(titulo) or "").strip()
        if not texto:
            return None
        url_origem = "https://pt.wikipedia.org/wiki/" + titulo.replace(" ", "_")
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        titulos, extrair, "wikipedia", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
