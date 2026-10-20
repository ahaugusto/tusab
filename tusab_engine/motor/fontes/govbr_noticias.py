# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: notícias dos portais gov.br (Plone) de agências reguladoras,
ministérios e órgãos de controle. Sem chave de API.

Endpoint (um por órgão):
GET https://www.gov.br/{orgao}/pt-br/search_rss?SearchableText=<termo>
    &portal_type=collective.nitf.content&sort_on=Date&sort_order=reverse&b_start=0
Resposta RSS 1.0 (RDF/XML), 15 itens fixos por página (`b_start` pagina de 15
em 15). Busca de texto completo do Plone — os itens são relevantes ao termo,
ordenados do mais recente para o mais antigo.

Corpo: `content:encoded` quando o portal publica (CVM e Planalto publicam);
nos demais, GET na página do item e extração do `#parent-fieldname-text`
(corpo da notícia no Plone), convertido com html_para_texto. Fallback para
`description` (linha fina) se a página falhar.

Órgãos consultados em sequência, parando ao atingir max_resultados. Testados
ao vivo em 20/out/2026 — todos responderam RSS válido: anac, anp, antt, ana,
cvm, cgu, agu, mcti, fazenda, mma, secom, planalto. Ficaram de fora ANEEL e
ANATEL (404 com página HTML de manutenção no lugar do RSS). Órgão que
responder HTML, erro HTTP ou XML inválido é pulado sem derrubar a busca.

Achado: o Planalto devolve 403 para o User-Agent padrão do python-requests
e 200 para o TusabBot — todas as chamadas usam HEADERS_TUSABBOT.
"""

import os
import time
import xml.etree.ElementTree as ET

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "govbr_noticias",
    "nome": "Notícias gov.br",
    "area": "direito",
    "descricao": "Notícias de agências reguladoras, ministérios e órgãos de controle nos portais gov.br — texto integral.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

ORGAOS = ["anac", "anp", "antt", "ana", "cvm", "cgu", "agu", "mcti", "fazenda", "mma", "secom", "planalto"]
RSS_URL = "https://www.gov.br/{orgao}/pt-br/search_rss"
_ITENS_POR_PAGINA = 15
_MAX_PAGINAS_POR_ORGAO = 2
_MAX_CHARS_TEXTO = 200_000

_NS = {
    "rss": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
}


def _extrair_div_por_id(html: str, div_id: str) -> str:
    """Devolve o HTML interno da <div id=div_id>, contando aninhamento de <div>."""
    ini = html.find(f'id="{div_id}"')
    if ini < 0:
        return ""
    ini = html.find(">", ini) + 1
    profundidade, pos = 1, ini
    while profundidade and pos < len(html):
        prox_abre = html.find("<div", pos)
        prox_fecha = html.find("</div", pos)
        if prox_fecha < 0:
            return html[ini:]
        if 0 <= prox_abre < prox_fecha:
            profundidade += 1
            pos = prox_abre + 4
        else:
            profundidade -= 1
            pos = prox_fecha + 5
    return html[ini:pos - 5]


def _ler_rss(orgao: str, query: str, b_start: int) -> list:
    """Itens de uma página do RSS do órgão; lista vazia se o órgão estiver
    fora do ar, em manutenção (HTML no lugar do XML) ou sem resultado."""
    try:
        resp = requests.get(RSS_URL.format(orgao=orgao), params={
            "SearchableText": query, "portal_type": "collective.nitf.content",
            "sort_on": "Date", "sort_order": "reverse", "b_start": b_start,
        }, headers=HEADERS_TUSABBOT, timeout=(10, 30))
        if resp.status_code != 200 or "xml" not in resp.headers.get("Content-Type", "").lower():
            return []
        raiz = ET.fromstring(resp.content)
    except (requests.RequestException, ET.ParseError):
        return []

    itens = []
    for item in raiz.findall("rss:item", _NS):
        link = (item.findtext("rss:link", default="", namespaces=_NS) or "").strip()
        if not link:
            continue
        itens.append({
            "orgao": orgao,
            "titulo": (item.findtext("rss:title", default="", namespaces=_NS) or "").strip(),
            "link": link,
            "descricao": (item.findtext("rss:description", default="", namespaces=_NS) or "").strip(),
            "data": (item.findtext("dc:date", default="", namespaces=_NS) or "").strip(),
            "conteudo_html": item.findtext("content:encoded", default="", namespaces=_NS) or "",
        })
    return itens


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    candidatos, vistos = [], set()
    for orgao in ORGAOS:
        for pagina in range(_MAX_PAGINAS_POR_ORGAO):
            if len(candidatos) >= max_resultados:
                break
            if evento_cancelar is not None and evento_cancelar.is_set():
                break
            lote = _ler_rss(orgao, query, pagina * _ITENS_POR_PAGINA)
            for item in lote:
                if item["link"] not in vistos and len(candidatos) < max_resultados:
                    vistos.add(item["link"])
                    candidatos.append(item)
            if len(lote) < _ITENS_POR_PAGINA:
                break
            time.sleep(0.5)
        if len(candidatos) >= max_resultados:
            break
    if not candidatos:
        return resultado_vazio()

    def extrair(item):
        texto = html_para_texto(_extrair_div_por_id(item["conteudo_html"], "parent-fieldname-text") or item["conteudo_html"])
        if not texto:
            try:
                pagina = requests.get(item["link"], headers=HEADERS_TUSABBOT, timeout=(10, 30))
                if pagina.ok and "html" in pagina.headers.get("Content-Type", "").lower():
                    texto = html_para_texto(_extrair_div_por_id(pagina.text, "parent-fieldname-text"))
            except requests.RequestException:
                texto = ""
        if not texto:
            texto = item["descricao"]
        if not texto:
            return None
        cabecalho = [f"Órgão: {item['orgao'].upper()}"]
        if item["data"]:
            cabecalho.append(f"Publicado em: {item['data']}")
        if item["descricao"] and item["descricao"] not in texto[:500]:
            cabecalho.append(f"Resumo: {item['descricao']}")
        corpo = "\n".join(cabecalho) + "\n\n" + texto
        titulo = f"{item['titulo'] or 'Notícia'} ({item['orgao'].upper()})"
        return {"titulo": titulo, "texto": corpo[:_MAX_CHARS_TEXTO], "url_origem": item["link"]}

    return executar_busca_generica(
        candidatos, extrair, "govbr_noticias", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
