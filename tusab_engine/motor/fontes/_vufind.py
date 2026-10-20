# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Conector genérico para catálogos VuFind (REST API v1) — usado por bdtd.py e
oasisbr.py (ambos mantidos pelo IBICT sobre VuFind). Não é uma fonte: não tem
FONTE_META e não entra no registro de __init__.py.

Endpoint: GET {base}/vufind/api/v1/search?lookfor=<termo>&type=AllFields
          &limit=<n>&page=1&field[]=id&field[]=title&field[]=summary&...
Resposta: {"resultCount": N, "records": [{id, title, summary, urls, ...}]}

Achados do teste ao vivo (20/out/2026):
- Sem `field[]` explícito a API devolve o conjunto padrão de campos, que NÃO
  inclui `summary` (o resumo) — por isso os campos são pedidos um a um.
- `summary` é uma LISTA: normalmente o resumo em português e o abstract em
  inglês. Os itens são juntados num texto só (repetidos são descartados).
- Muitos registros vêm com `summary` vazio (ex.: teses antigas da UECE na
  BDTD) ou com um "resumo" que só repete o título truncado ("Alfabetização é
  ..." na OasisBR). Ambos são descartados — sem texto substantivo não servem
  ao RAG. Por isso a busca pede mais registros do que o usuário quer
  (`_FATOR_SOBREPEDIDO`) e corta no número pedido DEPOIS de filtrar/deduplicar;
  sem isso, "3 resultados" virava 1 salvo com frequência.
- A mesma obra aparece em mais de um repositório agregado (ex.: depósito na
  universidade e na BDTD) com títulos que só diferem em acento/pontuação —
  deduplicação por título normalizado dentro de uma busca.
- `urls[].url` aponta para o texto no repositório de origem (PDF ou página do
  handle); quando ausente, usa a página do registro no próprio VuFind.
"""

import re
import unicodedata

import requests

from ._base import (
    HEADERS_TUSABBOT, executar_busca_generica, exigir_json, html_para_texto,
    resultado_vazio,
)

_CAMPOS = ["id", "title", "summary", "urls", "publicationDates", "authors"]

# Pede N x este fator registros (teto _LIMITE_API) para compensar os que são
# descartados por falta de resumo ou por duplicidade.
_FATOR_SOBREPEDIDO = 3
_LIMITE_API = 100  # teto de `limit` aceito pela API do VuFind

# Resumo com menos que isso é tratado como vazio (eco do título, "...").
_MIN_CHARS_RESUMO = 80


def normalizar_titulo(titulo: str) -> str:
    """Chave de deduplicação: minúsculas, sem acento, sem pontuação, espaços
    colapsados. "Alfabetização: um estudo." == "alfabetizacao um estudo"."""
    sem_acento = unicodedata.normalize("NFKD", titulo or "")
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    sem_pontuacao = re.sub(r"[^\w\s]", " ", sem_acento.lower())
    return re.sub(r"\s+", " ", sem_pontuacao).strip()


def montar_resumo(record: dict) -> str:
    """Junta os itens de `summary` (lista PT/EN) num texto só; "" se não houver
    resumo substantivo."""
    bruto = record.get("summary") or []
    if isinstance(bruto, str):
        bruto = [bruto]
    partes = []
    for item in bruto:
        texto = html_para_texto(str(item or "")).strip()
        if texto and texto not in partes:
            partes.append(texto)
    resumo = "\n\n".join(partes)
    return resumo if len(resumo) >= _MIN_CHARS_RESUMO else ""


def _autores(record: dict) -> list:
    autores = record.get("authors") or {}
    if not isinstance(autores, dict):
        return []
    nomes = []
    for grupo in ("primary", "secondary", "corporate"):
        valor = autores.get(grupo) or {}
        nomes.extend(valor.keys() if isinstance(valor, dict) else valor)
    return [n for n in nomes if isinstance(n, str) and n.strip()]


def _url_origem(base_url: str, record: dict) -> str:
    for u in record.get("urls") or []:
        if isinstance(u, dict) and u.get("url"):
            return u["url"]
    return f"{base_url}/vufind/Record/{record.get('id', '')}"


def buscar_vufind(
    base_url: str, fonte_id: str, fonte_nome: str,
    query: str, max_resultados: int, doc_dir: str,
    timeout=(10, 30), evento_cancelar=None, dispatch_event=None,
) -> dict:
    """Busca no VuFind em `base_url` e salva em `doc_dir` até `max_resultados`
    registros com resumo, sem títulos repetidos. `max_resultados` já deve vir
    limitado pelo chamador (1..MAX_RESULTADOS_PERMITIDO)."""
    limite = min(max_resultados * _FATOR_SOBREPEDIDO, _LIMITE_API)
    params = [
        ("lookfor", query), ("type", "AllFields"),
        ("limit", limite), ("page", 1),
    ] + [("field[]", campo) for campo in _CAMPOS]

    resp = requests.get(
        f"{base_url}/vufind/api/v1/search",
        headers=HEADERS_TUSABBOT, params=params, timeout=timeout,
    )
    resp.raise_for_status()
    records = exigir_json(resp, fonte_nome).get("records") or []

    # Filtra (só registros com resumo) e deduplica por título normalizado,
    # preservando a ordem de relevância da API.
    itens, vistos = [], set()
    for rec in records:
        titulo = (rec.get("title") or "").strip()
        chave = normalizar_titulo(titulo)
        if not chave or chave in vistos or not montar_resumo(rec):
            continue
        vistos.add(chave)
        itens.append(rec)
        if len(itens) >= max_resultados:
            break

    if not itens:
        return resultado_vazio()

    def extrair(rec):
        resumo = montar_resumo(rec)
        if not resumo:
            return None
        cabecalho = []
        autores = _autores(rec)
        if autores:
            cabecalho.append("Autoria: " + "; ".join(autores))
        datas = rec.get("publicationDates") or []
        if datas:
            cabecalho.append(f"Ano: {datas[0]}")
        texto = ("\n".join(cabecalho) + "\n\n" + resumo) if cabecalho else resumo
        return {
            "titulo": rec.get("title", "").strip() or "Sem título",
            "texto": texto,
            "url_origem": _url_origem(base_url, rec),
        }

    return executar_busca_generica(
        itens, extrair, fonte_id, doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
