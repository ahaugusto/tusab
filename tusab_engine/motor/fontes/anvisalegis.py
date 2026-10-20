# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: ANVISA — AnvisaLegis (plataforma Datalegis), legislação
sanitária federal: RDCs, Resoluções-RE, Instruções Normativas, consultas e
audiências públicas, votos da Diretoria Colegiada, manuais. Sem chave de API
e SEM API: é raspagem do mesmo fluxo AJAX que o site usa.

Endpoints (todos em https://anvisalegis.datalegis.net):
  1. GET  /action/ActionDatalegis.php?acao=abrirLegislacao&cod_modulo=134&cod_menu=1696
     → só para receber o cookie PHPSESSID;
  2. POST /action/ActionDatalegis.php?acao=consultarAtosInicial&...&buscaGeral=true
     (form com txt_texto=<termo>) → grava a consulta na sessão PHP;
  3. POST /action/ActionDatalegis.php?acao=abrirPagina&pagina=1&legisjuris=L
     (mesmo form + cod_local=BR, header X-Requested-With: XMLHttpRequest)
     → JSON {"total_pagina", "resultado": "<div class='ato'>...</div>..."}:
     até 50 atos por página, cada um com link `abrirTextoAto`, título e ementa;
  4. GET  /action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=...&sgl_tipo=...
     &sgl_orgao=...&vlr_ano=...&seq_ato=... → página pública do ato, com o
     texto integral dentro de <div id="conteudo"> … </article>.

Achados do teste ao vivo (20/out/2026):
  - Sem o cookie de sessão a etapa 3 devolve HTTP 500 — por isso
    requests.Session() e as três chamadas em sequência.
  - O formulário precisa ir codificado em ISO-8859-1: "boas práticas" em
    UTF-8 devolve 5 atos, em Latin-1 devolve 50 (o PHP compara bytes).
  - A página do ato vem em ISO-8859-1 e traz ~145 KB de menu do gov.br antes
    do corpo; isolamos <div id="conteudo"> até </article>. RDC 327/2019
    (cannabis) → ~51 mil caracteres de texto limpo; voto da Diretoria → ~69 mil.
  - Atos do tipo MAN (manual) só têm um link para PDF no corpo — salvamos a
    ementa, sem baixar o PDF.

Por que é frágil: depende de HTML gerado pelo servidor (classe 'ato', link
`abrirTextoAto`, `id="conteudo"`), de sessão PHP e de parâmetros internos de
menu (cod_modulo=134, cod_menu=1696). Qualquer mudança vira RuntimeError com
mensagem clara — nunca gravamos o menu do portal no lugar do ato.
"""

import html
import os
import re
import time
import unicodedata
from urllib.parse import parse_qs, urlencode, urlsplit

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "anvisalegis",
    "nome": "ANVISA — Legislação Sanitária (AnvisaLegis)",
    "area": "saude",
    "descricao": "Atos normativos da ANVISA (RDCs, resoluções, instruções normativas) — texto integral de cada ato.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE = "https://anvisalegis.datalegis.net"
ACTION_URL = BASE + "/action/ActionDatalegis.php"
ATO_PUBLICO_URL = BASE + "/action/UrlPublicasAction.php"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_ERRO_LAYOUT = "AnvisaLegis mudou o formato da página de resultados — a busca precisa ser atualizada no Tusab"

_RE_ATO = re.compile(r"<div class='ato'>(.*?)</a>\s*</div>", re.DOTALL)
_RE_LINK = re.compile(r"href='([^']*acao=abrirTextoAto[^']*)'")
_RE_TITULO = re.compile(r"<strong>(.*?)</strong>", re.DOTALL)
_RE_EMENTA = re.compile(r"<p>(.*?)</p>", re.DOTALL)
_RE_SITUACAO = re.compile(r"<span[^>]*ico-situacao[^>]*>.*?</span>", re.DOTALL)


def _form_latin1(campos: dict) -> str:
    """Codifica o form em ISO-8859-1 (ver docstring). Caracteres fora do
    Latin-1 (aspas tipográficas, emoji) perdem só o acento/são descartados."""
    def _latin1(v: str) -> str:
        try:
            v.encode("latin-1")
            return v
        except UnicodeEncodeError:
            sem_acento = unicodedata.normalize("NFKD", v)
            return sem_acento.encode("latin-1", "ignore").decode("latin-1")
    return urlencode({k: _latin1(str(v)) for k, v in campos.items()}, encoding="latin-1")


def _parse_resultado(resultado_html: str) -> list:
    """HTML da etapa 3 → [{titulo, ementa, tipo, numero, seq, ano, orgao}]."""
    atos = []
    for bloco in _RE_ATO.findall(resultado_html):
        m_link = _RE_LINK.search(bloco)
        m_tit = _RE_TITULO.search(bloco)
        if not m_link or not m_tit:
            continue
        q = {k: v[0] for k, v in parse_qs(urlsplit(html.unescape(m_link.group(1))).query, keep_blank_values=True).items()}
        if not all(q.get(c) for c in ("tipo", "numeroAto", "valorAno", "orgao")):
            continue
        titulo = html_para_texto(_RE_SITUACAO.sub(" ", m_tit.group(1)))
        m_em = _RE_EMENTA.search(bloco)
        atos.append({
            "titulo": titulo,
            "ementa": html_para_texto(m_em.group(1)) if m_em else "",
            "tipo": q["tipo"],
            "numero": q["numeroAto"],
            "seq": q.get("seqAto", "000"),
            "ano": q["valorAno"],
            "orgao": q["orgao"],
        })
    return atos


def _url_publica(ato: dict) -> str:
    return ATO_PUBLICO_URL + "?" + urlencode({
        "acao": "abrirAtoPublico", "num_ato": ato["numero"], "sgl_tipo": ato["tipo"],
        "sgl_orgao": ato["orgao"], "vlr_ano": ato["ano"], "seq_ato": ato["seq"],
        "cod_modulo": "134", "cod_menu": "1696",
    })


def _extrair_corpo_ato(pagina: str) -> str:
    """Isola o corpo do ato (sem o menu do gov.br). RuntimeError se o
    marcador sumiu — melhor falhar do que gravar o menu do portal."""
    ini = pagina.find('<div id="conteudo">')
    if ini < 0:
        raise RuntimeError("AnvisaLegis mudou o formato da página do ato (bloco 'conteudo' não encontrado)")
    fim = pagina.find("</article>", ini)
    return html_para_texto(pagina[ini:fim if fim > 0 else None])


def _buscar_atos(query: str) -> list:
    sessao = requests.Session()
    sessao.headers.update(HEADERS_TUSABBOT)
    form = {
        "txt_texto": query, "redirect_consultaato": "apresentarAtos",
        "in_pesquisa_avancada": "N", "inApsModuloBase": "S", "ind_legis_juris": "L",
        "cod_modulo": "134", "cod_menu": "1696",
    }
    cabecalho_form = {"Content-Type": "application/x-www-form-urlencoded"}

    sessao.get(ACTION_URL, params={"acao": "abrirLegislacao", "cod_modulo": "134", "cod_menu": "1696"},
               timeout=_TIMEOUT).raise_for_status()
    sessao.post(ACTION_URL + "?acao=consultarAtosInicial&cod_modulo=134&cod_menu=1696&buscaGeral=true",
                data=_form_latin1(form), headers=cabecalho_form, timeout=_TIMEOUT).raise_for_status()
    resp = sessao.post(ACTION_URL + "?acao=abrirPagina&pagina=1&legisjuris=L",
                       data=_form_latin1(dict(form, cod_local="BR")),
                       headers=dict(cabecalho_form, **{"X-Requested-With": "XMLHttpRequest"}),
                       timeout=_TIMEOUT)
    resp.raise_for_status()
    try:
        dados = resp.json()
    except ValueError:
        raise RuntimeError(_ERRO_LAYOUT + " (resposta não é JSON)")
    if not isinstance(dados, dict) or "resultado" not in dados:
        raise RuntimeError(_ERRO_LAYOUT + " (campo 'resultado' ausente)")

    resultado_html = dados.get("resultado") or ""
    atos = _parse_resultado(resultado_html)
    if not atos and "class='ato'" in resultado_html:
        # Havia atos na página mas nenhum casou com o padrão — layout mudou.
        raise RuntimeError(_ERRO_LAYOUT)
    return atos


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    atos = _buscar_atos(query)[:max_resultados]
    if not atos:
        return resultado_vazio()

    def extrair(ato):
        url = _url_publica(ato)
        ementa_util = ato["ementa"] and ato["ementa"] != ato["titulo"]
        cabecalho = ato["titulo"] + (f"\n\nEmenta: {ato['ementa']}" if ementa_util else "")
        if ato["tipo"] == "MAN":
            # Manuais: o corpo é só um link para PDF — fica a ementa.
            return {"titulo": ato["titulo"], "texto": cabecalho, "url_origem": url} if ato["ementa"] else None

        time.sleep(0.5)
        resp = requests.get(url, headers=HEADERS_TUSABBOT, timeout=_TIMEOUT)
        resp.raise_for_status()
        resp.encoding = "ISO-8859-1"
        corpo = _extrair_corpo_ato(resp.text)
        texto = f"{cabecalho}\n\n--- TEXTO INTEGRAL ---\n\n{corpo}" if corpo else cabecalho
        if not texto.strip():
            return None
        return {"titulo": ato["titulo"], "texto": texto[:_MAX_CHARS], "url_origem": url}

    return executar_busca_generica(
        atos, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
