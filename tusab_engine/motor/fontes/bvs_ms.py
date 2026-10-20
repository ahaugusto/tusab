# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: BVS MS — Biblioteca Virtual em Saúde do Ministério da Saúde,
sem chave de API. Notas temáticas em português (datas comemorativas de
saúde, descritores DeCS comentados, campanhas), de 2 a 7 mil caracteres.

O portal é WordPress, então a busca usa a REST API padrão:
    GET https://bvsms.saude.gov.br/wp-json/wp/v2/posts?search=<termo>&per_page=<n>
Uma única chamada já traz o conteúdo completo de cada post — sem requisição
por item.

Achados do teste ao vivo (20/out/2026):
- Texto em `content.rendered` (HTML de blocos Gutenberg) → html_para_texto.
- Título em `title.rendered` com entidades HTML (ex.: "&#8211;") → unescape.
- URL pública do post em `link`. Busca sem resultado devolve `[]` (HTTP 200).
- Aceita o UA padrão; usamos o TusabBot por consistência.
"""

import html
import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "bvs_ms",
    "nome": "BVS Ministério da Saúde",
    "area": "saude",
    "descricao": "Notas temáticas da Biblioteca Virtual em Saúde do Ministério da Saúde — texto completo em português.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://bvsms.saude.gov.br/wp-json/wp/v2/posts"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    # per_page do WordPress aceita até 100; o teto do projeto é menor.
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        API_URL, headers=HEADERS_TUSABBOT,
        params={"search": query, "per_page": max_resultados},
        timeout=(10, 30),
    )
    resp.raise_for_status()
    posts = exigir_json(resp, FONTE_META["nome"])
    if not isinstance(posts, list) or not posts:
        return resultado_vazio()

    def extrair(post):
        texto = html_para_texto((post.get("content") or {}).get("rendered", ""))
        if not texto:
            return None
        titulo = html.unescape((post.get("title") or {}).get("rendered", "")).strip() or "Sem título"
        return {"titulo": titulo, "texto": texto, "url_origem": post.get("link", "")}

    return executar_busca_generica(
        posts, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
