# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Wiktionary (edição em inglês), sem chave de API. Mesmo
mecanismo de wikipedia.py (MediaWiki Action API — busca full-text +
`prop=extracts&explaintext=1` pra texto já limpo, sem wikitext bruto), mas
conteúdo lexicográfico: etimologia, pronúncia, definições por idioma.

Escolha deliberada de en.wiktionary.org em vez de pt.wiktionary.org: a
edição em português tem cobertura muito menor (ex: "samurai" — 6 resultados
em pt.wiktionary vs 342 em en.wiktionary, confirmado ao vivo) e cada artigo
do Wiktionary em inglês já cobre a palavra em múltiplos idiomas (seção
"Portuguese" própria quando aplicável — confirmado ao vivo: termo em
português "inteligencia" encontrado com 118 resultados na edição inglesa).
Prioriza cobertura sobre alinhamento de idioma da UI.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "wiktionary",
    "nome": "Wiktionary",
    "area": "antropologia",
    "descricao": "Dicionário multilíngue livre — etimologia, pronúncia e definições reais por idioma.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://en.wiktionary.org/w/api.php"
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
        "action": "query", "prop": "extracts", "explaintext": 1,
        "titles": "|".join(titulos), "format": "json",
    }, timeout=(10, 45))
    resp_extrai.raise_for_status()
    paginas = resp_extrai.json().get("query", {}).get("pages", {})
    extratos_por_titulo = {p.get("title"): p.get("extract", "") for p in paginas.values()}

    def extrair(titulo):
        texto = (extratos_por_titulo.get(titulo) or "").strip()
        if not texto:
            return None
        url_origem = "https://en.wiktionary.org/wiki/" + titulo.replace(" ", "_")
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        titulos, extrair, "wiktionary", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
