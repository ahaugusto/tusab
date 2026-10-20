# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Agência Brasil (EBC) — notícias da agência pública de
notícias do governo federal. Sem chave de API.

Endpoint: GET https://busca.ebc.com.br/sites/agenciabrasil/nodes.json?q=<termo>&page=<p>
Resposta: lista JSON de 15 itens por página com `title`, `body` (HTML
completo da matéria), `created_at`, `path` (relativo a
https://agenciabrasil.ebc.com.br), `tags`, `channels` (editoria).

Achados ao vivo (20/out/2026):
- Texto integral já vem no `body` (4-8 mil caracteres) — uma chamada por
  página, nenhuma por item.
- A busca ordena por DATA, não por relevância, e é frouxa: "reforma
  tributária" traz matérias de campanha eleitoral que só citam o tema de
  passagem. O módulo mantém só itens cujo título, tags ou corpo contenham ao
  menos uma palavra significativa do termo (4+ letras, sem acento) e pagina
  até completar max_resultados (no máximo 5 páginas).
- Termo inexistente → lista vazia (HTTP 200).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)
from ._termos_busca import contem_alguma, normalizar, palavras_significativas

FONTE_META = {
    "id": "agencia_brasil",
    "nome": "Agência Brasil (EBC)",
    "area": "geral",
    "descricao": "Notícias da agência pública de notícias do governo federal — texto integral de cada matéria.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://busca.ebc.com.br/sites/agenciabrasil/nodes.json"
SITE_URL = "https://agenciabrasil.ebc.com.br"
_MAX_PAGINAS = 5
_MAX_CHARS_TEXTO = 200_000


def relevante(item: dict, palavras: list) -> bool:
    """Título, tags ou corpo contêm ao menos uma palavra significativa do termo."""
    if not palavras:
        return True
    tags = " ".join(t for t in (item.get("tags") or []) if isinstance(t, str))
    alvo = normalizar(f"{item.get('title') or ''} {tags} {html_para_texto(item.get('body') or '')}")
    return contem_alguma(alvo, palavras)


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    palavras = palavras_significativas(query)

    itens, vistos = [], set()
    for pagina in range(1, _MAX_PAGINAS + 1):
        if evento_cancelar is not None and evento_cancelar.is_set():
            break
        resp = requests.get(SEARCH_URL, params={"q": query, "page": pagina},
                            headers=HEADERS_TUSABBOT, timeout=(10, 30))
        resp.raise_for_status()
        lote = exigir_json(resp, "Agência Brasil")
        if not isinstance(lote, list):
            raise RuntimeError("Agência Brasil mudou o formato da busca (esperada uma lista de matérias)")
        for item in lote:
            chave = isinstance(item, dict) and (item.get("_id") or item.get("path"))
            if chave and chave not in vistos and relevante(item, palavras):
                vistos.add(chave)
                itens.append(item)
        if len(itens) >= max_resultados or len(lote) < 15:
            break
    itens = itens[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        corpo = html_para_texto(item.get("body") or "")
        if not corpo:
            return None
        cabecalho = [f"Publicado em: {item.get('created_at')}" if item.get("created_at") else "",
                     f"Editoria: {', '.join(item.get('channels') or [])}" if item.get("channels") else "",
                     f"Tags: {', '.join(item.get('tags') or [])}" if item.get("tags") else ""]
        texto = "\n".join(c for c in cabecalho if c) + "\n\n" + corpo
        path = item.get("path") or ""
        url = path if path.startswith("http") else (SITE_URL + path if path else "")
        return {"titulo": (item.get("title") or "Notícia Agência Brasil").strip(),
                "texto": texto[:_MAX_CHARS_TEXTO], "url_origem": url}

    return executar_busca_generica(
        itens, extrair, "agencia_brasil", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
