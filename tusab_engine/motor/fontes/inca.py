# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: INCA — Repositório Institucional "Ninho" do Instituto
Nacional de Câncer (livros, manuais técnicos, artigos, relatórios, material
educativo sobre câncer). Sem chave de API.

O repositório roda DSpace 6 (JSPUI) SEM a API REST habilitada — por isso é
raspagem de HTML:
  - busca: GET https://ninho.inca.gov.br/jspui/simple-search?query=<termo>&rpp=<n>&start=0
    → links /jspui/handle/123456789/<id> na tabela de resultados;
  - registro: GET https://ninho.inca.gov.br/jspui/handle/123456789/<id>?mode=full
    → tabela Dublin Core com células metadataFieldLabel / metadataFieldValue
    (dc.title, dc.description.abstract — pode haver mais de um —, dc.subject,
    dc.Type, dc.date.issued).

Achados do teste ao vivo (20/out/2026): "câncer de mama" → 863 registros.
Só ~metade tem dc.description.abstract (cartazes e folhetos costumam vir sem)
— por isso pedimos o dobro de candidatos e paramos ao atingir o limite.
Registros sem resumo são descartados (só título não ajuda o RAG).

Por que é frágil: depende das classes CSS do tema JSPUI (metadataFieldLabel/
Value) e do padrão de link /jspui/handle/. Se a página de resultados vier sem
links mas sem a mensagem de "nenhum resultado", ou se o registro vier sem a
tabela de metadados, levantamos RuntimeError com mensagem clara.
"""

import os
import re
import time

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "inca",
    "nome": "INCA — Repositório Institucional",
    "area": "saude",
    "descricao": "Publicações do Instituto Nacional de Câncer (manuais, livros, artigos) — resumo de cada obra.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE = "https://ninho.inca.gov.br/jspui"
SEARCH_URL = BASE + "/simple-search"
ITEM_URL = BASE + "/handle/123456789/{id}"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_MAX_CANDIDATOS = 100

_RE_HANDLE = re.compile(r'href="/jspui/handle/123456789/(\d+)"')
_RE_TOTAL = re.compile(r'(?:Results?|Resultados?)\s+\d+-\d+\s+(?:of|de)\s+(\d+)')
_RE_CAMPO = re.compile(
    r'<td[^>]*class="metadataFieldLabel"[^>]*>\s*([^<]*?)\s*</td>\s*'
    r'<td[^>]*class="metadataFieldValue"[^>]*>(.*?)</td>',
    re.DOTALL,
)


def _ids_resultado(pagina: str) -> list:
    """Links de registro na ordem da página. Sem links, só aceitamos "zero
    resultados" se a página ainda for a de busca e não anunciar resultados
    ("Results 1-10 of 863" sem nenhum link = os links mudaram de formato)."""
    ids = list(dict.fromkeys(_RE_HANDLE.findall(pagina)))
    if not ids and (_RE_TOTAL.search(pagina) or 'name="query"' not in pagina):
        raise RuntimeError("INCA mudou o formato da página de busca do repositório — a busca precisa ser atualizada no Tusab")
    return ids


def _metadados(pagina: str) -> dict:
    campos = {}
    for rotulo, valor in _RE_CAMPO.findall(pagina):
        texto = html_para_texto(valor)
        if texto:
            campos.setdefault(rotulo.strip().lower(), []).append(texto)
    if not campos:
        raise RuntimeError("INCA mudou o formato da página do registro (tabela de metadados não encontrada)")
    return campos


def montar_documento(campos: dict, url: str):
    """Metadados DC → {titulo, texto, url_origem}, ou None sem resumo."""
    titulos = campos.get("dc.title") or []
    resumos = list(dict.fromkeys(campos.get("dc.description.abstract") or []))
    if not titulos or not resumos:
        return None
    partes = [titulos[0]]
    tipo = (campos.get("dc.type") or [""])[0]
    ano = (campos.get("dc.date.issued") or [""])[0]
    if tipo or ano:
        partes.append(" · ".join(p for p in (tipo, ano) if p))
    assuntos = list(dict.fromkeys(campos.get("dc.subject") or []))
    if assuntos:
        partes.append("Assuntos: " + "; ".join(assuntos))
    partes.append("Resumo:\n" + "\n\n".join(resumos))
    return {"titulo": titulos[0], "texto": "\n\n".join(partes)[:_MAX_CHARS], "url_origem": url}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        SEARCH_URL,
        params={"query": query, "rpp": min(max_resultados * 2, _MAX_CANDIDATOS), "start": 0},
        headers=HEADERS_TUSABBOT, timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    ids = _ids_resultado(resp.text)
    if not ids:
        return resultado_vazio()

    salvos = {"n": 0}

    def extrair(item_id):
        # Pedimos o dobro de candidatos (metade costuma vir sem resumo); ao
        # atingir o limite, os restantes são pulados sem chamada de rede.
        if salvos["n"] >= max_resultados:
            return None
        time.sleep(0.5)
        url = ITEM_URL.format(id=item_id)
        r = requests.get(url, params={"mode": "full"}, headers=HEADERS_TUSABBOT, timeout=_TIMEOUT)
        r.raise_for_status()
        doc = montar_documento(_metadados(r.text), url)
        if doc:
            salvos["n"] += 1
        return doc

    return executar_busca_generica(
        ids, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
