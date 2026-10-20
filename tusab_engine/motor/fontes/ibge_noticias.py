# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: IBGE — Agência de Notícias (notícias e releases de pesquisas
e indicadores oficiais). Sem chave de API.

Endpoint: GET https://servicodados.ibge.gov.br/api/v3/noticias/?busca=<termo>&qtd=<n>&page=<p>
Resposta: `count`, `totalPages`, `items[]` com `titulo`, `introducao`
(~250 caracteres, cortada com "..."), `link`, `data_publicacao`, `tipo`
("Notícia"/"Release"), `editorias`.

Texto integral: GET no `link` (http → https) e extração do trecho entre
`class="texto--single"` e `lista-noticias` com html_para_texto. Fallback
para `introducao`.

Achado ao vivo (20/out/2026): a busca da API funciona ("saneamento" → 104
itens), mas as páginas de agenciadenoticias.ibge.gov.br estão atrás de um
desafio Cloudflare ("Just a moment...", HTTP 403) para qualquer User-Agent —
o texto integral não está acessível hoje e cada item fica com título +
introdução. O módulo detecta o desafio na primeira página e não tenta as
demais (evita N requisições inúteis); se o bloqueio cair, volta a gravar o
texto integral sem mudança de código.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_NAVEGADOR, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "ibge_noticias",
    "nome": "IBGE — Notícias e releases",
    "area": "economia",
    "descricao": "Notícias e releases da Agência IBGE sobre pesquisas e indicadores oficiais.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_URL = "https://servicodados.ibge.gov.br/api/v3/noticias/"
_MAX_PAGINAS = 5
_MAX_CHARS_TEXTO = 200_000
_HEADERS_PAGINA = {**HEADERS_NAVEGADOR, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}


def _trecho_integral(html: str) -> str:
    ini = html.find('class="texto--single"')
    if ini < 0:
        return ""
    ini = html.find(">", ini) + 1
    fim = html.find("lista-noticias", ini)
    if fim < 0:
        return ""
    fim = html.rfind("<", ini, fim)  # volta ao início da tag que contém a classe
    return html_para_texto(html[ini:fim if fim > ini else None])


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    itens, pagina = [], 1
    while len(itens) < max_resultados and pagina <= _MAX_PAGINAS:
        resp = requests.get(API_URL, params={"busca": query, "qtd": max_resultados, "page": pagina},
                            timeout=(10, 30))
        resp.raise_for_status()
        dados = exigir_json(resp, "IBGE")
        lote = dados.get("items") if isinstance(dados, dict) else None
        if not isinstance(lote, list):
            raise RuntimeError("IBGE mudou o formato da API de notícias (campo 'items' ausente)")
        itens.extend(i for i in lote if isinstance(i, dict))
        if not lote or pagina >= int(dados.get("totalPages") or 1):
            break
        pagina += 1
    itens = itens[:max_resultados]
    if not itens:
        return resultado_vazio()

    estado = {"bloqueado": False}

    def extrair(item):
        link = (item.get("link") or "").replace("http://", "https://", 1)
        introducao = (item.get("introducao") or "").strip()
        texto = ""
        if link and not estado["bloqueado"]:
            try:
                r = requests.get(link, headers=_HEADERS_PAGINA, timeout=(10, 30))
                if r.status_code == 403 or "Just a moment" in r.text[:2000]:
                    estado["bloqueado"] = True  # desafio Cloudflare — não insiste nos demais
                elif r.ok:
                    texto = _trecho_integral(r.text)
            except requests.RequestException:
                texto = ""
        texto = texto or introducao
        if not texto:
            return None
        cabecalho = [f"Tipo: {item.get('tipo')}" if item.get("tipo") else "",
                     f"Publicado em: {item.get('data_publicacao')}" if item.get("data_publicacao") else "",
                     f"Editorias: {item.get('editorias')}" if item.get("editorias") else ""]
        corpo = "\n".join(c for c in cabecalho if c) + "\n\n" + texto
        return {"titulo": (item.get("titulo") or "Notícia IBGE").strip(),
                "texto": corpo[:_MAX_CHARS_TEXTO], "url_origem": link}

    return executar_busca_generica(
        itens, extrair, "ibge_noticias", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
