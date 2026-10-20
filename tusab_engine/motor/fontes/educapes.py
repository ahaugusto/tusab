# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: EduCAPES — repositório de recursos educacionais abertos da
CAPES (livros digitais, artigos, sequências didáticas, produtos educacionais
de mestrados profissionais, vídeoaulas). Sem chave de API.

Roda DSpace 6 (JSPUI) com tema próprio e sem API REST pública, então é
raspagem de HTML:
  - busca: GET https://educapes.capes.gov.br/simple-search?query=<termo>&rpp=<n>
    → links href="/handle/<prefixo>/<id>" (prefixos "capes", "11449", ...);
  - registro: GET https://educapes.capes.gov.br/handle/<prefixo>/<id>
    → tags <meta name="DC.title"> e <meta name="DC.description"> no <head>
    (padrão Highwire/Dublin Core que o DSpace gera para o Google Scholar).

Achados do teste ao vivo (20/out/2026): "BNCC matemática" → ~41 mil
registros (a busca é OR entre as palavras, ordenada por relevância). Há
vários DC.description por registro: resumo em PT, abstract em EN e também
linhas curtas de afiliação ("Universidade Estadual Paulista"). Por isso só
contam como descrição as de 100+ caracteres; registros sem nenhuma são
descartados. Como parte dos resultados cai nesse filtro, pedimos o dobro de
candidatos e paramos ao atingir o limite.

Por que é frágil: tema JSPUI customizado (o padrão de link /handle/ e as
meta tags DC.* são a única âncora). Página de busca que anuncia resultados
("Resultado 1-10 de N") sem nenhum link, ou registro sem DC.title, viram
RuntimeError com mensagem clara.
"""

import html
import os
import re
import time

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    resultado_vazio,
)

FONTE_META = {
    "id": "educapes",
    "nome": "EduCAPES — Recursos Educacionais",
    "area": "educacao",
    "descricao": "Recursos educacionais abertos da CAPES (livros, artigos, materiais didáticos) — descrição de cada recurso.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE = "https://educapes.capes.gov.br"
SEARCH_URL = BASE + "/simple-search"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_MAX_CANDIDATOS = 100
_MIN_CHARS_DESCRICAO = 100

_RE_HANDLE = re.compile(r'href="(/handle/[\w.\-]+/\d+)"')
_RE_TOTAL = re.compile(r'(?:Results?|Resultados?)\s+\d+-\d+\s+(?:of|de)\s+(\d+)')
_RE_META = re.compile(r'<meta\b([^>]*)>', re.IGNORECASE)
_RE_ATTR = re.compile(r'([\w:.\-]+)\s*=\s*"([^"]*)"')


def _handles(pagina: str) -> list:
    handles = list(dict.fromkeys(_RE_HANDLE.findall(pagina)))
    if not handles and (_RE_TOTAL.search(pagina) or 'name="query"' not in pagina):
        raise RuntimeError("EduCAPES mudou o formato da página de busca — a busca precisa ser atualizada no Tusab")
    return handles


def _metas_dc(pagina: str) -> dict:
    """Todas as <meta name="DC.*" content="..."> da página, na ordem."""
    metas = {}
    for attrs in _RE_META.findall(pagina):
        a = {k.lower(): v for k, v in _RE_ATTR.findall(attrs)}
        nome, conteudo = a.get("name", ""), html.unescape(a.get("content", "")).strip()
        if nome.startswith("DC.") and conteudo:
            metas.setdefault(nome, []).append(re.sub(r"\s+", " ", conteudo))
    return metas


def montar_documento(metas: dict, url: str):
    titulos = metas.get("DC.title") or []
    if not titulos:
        raise RuntimeError("EduCAPES mudou o formato da página do recurso (meta DC.title ausente)")
    descricoes = [d for d in dict.fromkeys(metas.get("DC.description") or []) if len(d) >= _MIN_CHARS_DESCRICAO]
    if not descricoes:
        return None
    linhas = [titulos[0], ""]
    tipo = (metas.get("DC.type") or [""])[0]
    if tipo:
        linhas.append(f"Tipo: {tipo}")
    assuntos = list(dict.fromkeys(metas.get("DC.subject") or []))
    if assuntos:
        linhas.append("Assuntos: " + "; ".join(assuntos))
    linhas += ["", "Descrição:", "\n\n".join(descricoes)]
    return {"titulo": titulos[0], "texto": "\n".join(linhas)[:_MAX_CHARS], "url_origem": url}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        SEARCH_URL,
        params={"query": query, "rpp": min(max_resultados * 2, _MAX_CANDIDATOS)},
        headers=HEADERS_TUSABBOT, timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    handles = _handles(resp.text)
    if not handles:
        return resultado_vazio()

    salvos = {"n": 0}

    def extrair(handle):
        if salvos["n"] >= max_resultados:
            return None  # limite atingido — candidatos extras pulados sem rede
        time.sleep(0.5)
        url = BASE + handle
        r = requests.get(url, headers=HEADERS_TUSABBOT, timeout=_TIMEOUT)
        r.raise_for_status()
        doc = montar_documento(_metas_dc(r.text), url)
        if doc:
            salvos["n"] += 1
        return doc

    return executar_busca_generica(
        handles, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
