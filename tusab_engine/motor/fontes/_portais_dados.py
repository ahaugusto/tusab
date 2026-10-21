# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Conector genérico de portais de dados abertos — consulta VÁRIOS portais em
paralelo e intercala os resultados. Usado por portais_br_federal.py,
portais_br_estados.py, portais_br_municipios.py e portais_internacionais.py.

Mapeamento ao vivo (20/out/2026, mais de 150 portais testados; detalhes em
agents/_historia.md). Quatro plataformas, quatro adaptadores:
- CKAN   `{base}/api/3/action/package_search?q=&rows=` → result.results[]
         (`title`, `notes`, `organization.title`, `resources[]`, `name`).
         O path base varia (`/data`, `/catalogo`, `/opendata`...).
- udata  `{base}/api/1/datasets/?q=&page_size=` → data[] (`title`,
         `description`, `organization.name`, `resources[]`, `page`).
- Socrata `https://api.us.socrata.com/api/catalog/v1?domains=<domínio>&q=&limit=`
         → results[].resource (`name`, `description`, `id`), link em `link`.
- ODS    `{base}/api/explore/v2.1/catalog/datasets?where=search("<termo>")&limit=`
         (o parâmetro `q=` é IGNORADO e devolve tudo) → results[].metas.default.

Achados que moldam o código:
- User-Agent: a palavra "Bot" é bloqueada por alguns portais (data.gov.ie 429,
  dados.pbh.gov.br 403, dadosabertos.mme.gov.br 403) e o datos.gob.mx (Akamai)
  barra também URL "+http" no UA. Aqui usamos `Tusab/1.0` puro — não o
  HEADERS_TUSABBOT das outras fontes.
- Portais lentos (MG, RJ, SP capital: até 15–17 s em algumas chamadas):
  timeout curto por portal e consulta paralela — um portal lento ou fora do
  ar não segura nem derruba a busca; só fica de fora do resultado.
- O texto salvo é a descrição do catálogo (o que o conjunto É) + a lista de
  arquivos com formato e URL — os dados em si não são baixados aqui.
"""

import os
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, html_para_texto, resultado_vazio

HEADERS_PORTAIS = {"User-Agent": "Tusab/1.0", "Accept": "application/json"}
TIMEOUT_PORTAL = (8, 20)
MAX_ARQUIVOS_LISTADOS = 15

_RE_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_RE_MD_ENFASE = re.compile(r"\*\*|__|`+")                                # negrito/código em qualquer posição
_RE_MD_INICIO = re.compile(r"^[ \t]*(#{1,6}|>|[*-])[ \t]+", re.MULTILINE)  # título, citação, lista no início da linha


def _limpar_texto(texto) -> str:
    """Descrições vêm em texto puro, Markdown (HDX, MG) ou HTML (ODS)."""
    if isinstance(texto, dict):   # campos multilíngues: prefere pt, en, es
        texto = texto.get("pt") or texto.get("en") or texto.get("es") or next(iter(texto.values()), "")
    texto = texto or ""
    if "<" in texto and ">" in texto:
        texto = html_para_texto(texto)
    texto = _RE_MD_LINK.sub(r"\1", texto)
    texto = _RE_MD_ENFASE.sub("", texto)
    texto = _RE_MD_INICIO.sub("", texto)
    return re.sub(r"[ \t]+", " ", texto).strip()


def _get(url: str, params: dict):
    resp = requests.get(url, headers=HEADERS_PORTAIS, params=params, timeout=TIMEOUT_PORTAL)
    resp.raise_for_status()
    return resp.json()


def _linhas_arquivos(recursos: list) -> list:
    linhas = []
    for r in (recursos or [])[:MAX_ARQUIVOS_LISTADOS]:
        nome = _limpar_texto(r.get("name") or r.get("title") or "arquivo")
        fmt = (r.get("format") or "").upper().strip(".") or "?"
        url = r.get("url") or r.get("latest") or ""
        desc = _limpar_texto(r.get("description") or "")[:200]
        linhas.append(f"- {nome} [{fmt}] {url}" + (f" — {desc}" if desc else ""))
    return linhas


def _item(titulo, descricao, orgao, recursos, url, portal_nome) -> dict:
    return {"titulo": titulo, "descricao": descricao, "orgao": orgao,
            "arquivos": _linhas_arquivos(recursos), "url": url, "portal": portal_nome}


# ─── Adaptadores por plataforma ──────────────────────────────────────────────

def _ckan(portal: dict, query: str, n: int) -> list:
    base = portal["base"].rstrip("/")
    dados = _get(f"{base}/api/3/action/package_search", {"q": query, "rows": n})
    if not isinstance(dados, dict) or "result" not in dados:
        raise RuntimeError("resposta CKAN sem 'result'")
    url_publica = portal.get("url_dataset", base + "/dataset/{name}")
    return [_item(p.get("title") or p.get("name", ""),
                  _limpar_texto(p.get("notes") or p.get("notes_translated") or p.get("description") or ""),
                  ((p.get("organization") or {}).get("title") or ""),
                  p.get("resources"), url_publica.format(name=p.get("name", "")), portal["nome"])
            for p in dados["result"].get("results", [])]


def _udata(portal: dict, query: str, n: int) -> list:
    base = portal["base"].rstrip("/")
    dados = _get(f"{base}/api/1/datasets/", {"q": query, "page_size": n})
    return [_item(d.get("title", ""), _limpar_texto(d.get("description") or ""),
                  ((d.get("organization") or {}).get("name") or ""),
                  d.get("resources"), d.get("page") or "", portal["nome"])
            for d in dados.get("data", [])]


def _socrata(portal: dict, query: str, n: int) -> list:
    dados = _get("https://api.us.socrata.com/api/catalog/v1", {"domains": portal["dominio"], "q": query, "limit": n})
    itens = []
    for r in dados.get("results", []):
        res = r.get("resource") or {}
        itens.append(_item(res.get("name", ""), _limpar_texto(res.get("description") or ""),
                           res.get("attribution") or "", [],
                           r.get("link") or r.get("permalink") or "", portal["nome"]))
    return itens


def _ods(portal: dict, query: str, n: int) -> list:
    base = portal["base"].rstrip("/")
    termo = query.replace('"', " ")
    dados = _get(f"{base}/api/explore/v2.1/catalog/datasets", {"where": f'search("{termo}")', "limit": n})
    itens = []
    for d in dados.get("results", []):
        meta = ((d.get("metas") or {}).get("default") or {})
        ds_id = d.get("dataset_id", "")
        itens.append(_item(meta.get("title") or ds_id, _limpar_texto(meta.get("description") or ""),
                           meta.get("publisher") or "", [],
                           f"{base}/explore/dataset/{urllib.parse.quote(ds_id)}/", portal["nome"]))
    return itens


_ADAPTADORES = {"ckan": _ckan, "udata": _udata, "socrata": _socrata, "ods": _ods}


# ─── Busca agregada ──────────────────────────────────────────────────────────

def _intercalar(listas: list, limite: int) -> list:
    """Uma de cada portal por rodada — nenhum portal grande monopoliza o
    resultado. A ordem interna de cada portal (relevância do servidor) é
    preservada."""
    saida, i = [], 0
    while len(saida) < limite and any(i < len(l) for l in listas):
        for l in listas:
            if i < len(l) and len(saida) < limite:
                saida.append(l[i])
        i += 1
    return saida


def buscar_portais(portais: list, fonte_id: str, query: str, max_resultados: int, projeto_nome: str,
                   evento_cancelar=None, dispatch_event=None) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    por_portal = max(3, min(10, max_resultados))

    resultados, falhas = {}, []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futuros = {pool.submit(_ADAPTADORES[p["plataforma"]], p, query, por_portal): p for p in portais}
        for fut in as_completed(futuros):
            p = futuros[fut]
            try:
                # descarta descrição vazia/curta demais: não ajuda a busca no chat
                resultados[p["nome"]] = [it for it in fut.result() if len(it["descricao"]) >= 40 or it["arquivos"]]
            except Exception as e:   # portal fora do ar/lento: fica de fora, não derruba a busca
                falhas.append(f"{p['nome']}: {type(e).__name__}")
    if not resultados and falhas:
        raise RuntimeError("Nenhum portal respondeu — " + "; ".join(falhas[:5]))

    ordenados = [resultados[p["nome"]] for p in portais if resultados.get(p["nome"])]
    itens = _intercalar(ordenados, max_resultados)
    if not itens:
        return resultado_vazio()

    def extrair(it):
        partes = [f"Portal: {it['portal']}" + (f" | Publicado por: {it['orgao']}" if it["orgao"] else "")]
        if it["descricao"]:
            partes.append(it["descricao"])
        if it["arquivos"]:
            partes.append("Arquivos do conjunto de dados:\n" + "\n".join(it["arquivos"]))
        return {"titulo": it["titulo"], "texto": "\n\n".join(partes), "url_origem": it["url"]}

    resultado = executar_busca_generica(itens, extrair, fonte_id, doc_dir,
                                        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0)
    resultado["portais_sem_resposta"] = falhas
    return resultado
