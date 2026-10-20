# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Conector genérico para wikis MediaWiki (Action API) — usado por
wikisource_pt.py, wikilivros_pt.py e wikiversidade_pt.py. Não é uma fonte:
não tem FONTE_META e não entra no registro de __init__.py. wikipedia.py
continua com a sua própria implementação (não foi migrado para cá).

Busca:  action=query&list=search&srsearch=<termo>&srnamespace=0&srlimit=<n>
Texto:  action=query&prop=extracts&explaintext=1&titles=<UM título>
Fallback: action=parse&page=<título>&prop=text → parse.text["*"] (HTML)

Achados do teste ao vivo (20/out/2026):
- Nesses wikis (pt.wikisource, pt.wikibooks, pt.wikiversity) o `prop=extracts`
  em lote é rebaixado para 1 título por resposta — por isso a extração é feita
  UM título por chamada (diferente de wikipedia.py, que bateia).
- Ao contrário da Wikipédia, aqui o texto INTEGRAL interessa (livro didático,
  aula, obra em domínio público), então não se usa `exintro`.
- Algumas páginas devolvem `extract` vazio (ex.: página-índice
  "Alfabetização" da Wikiversidade, montada com predefinições/tabelas) —
  fallback para `action=parse`, convertendo o HTML em texto. O fallback
  também é tentado quando o extract é muito curto (< 300 caracteres), e
  páginas que continuam com menos de 150 caracteres (portais/índices só com
  links, ex.: "Departamento:Matemática Elementar" = 85) são descartadas.
- Textos do Wikisource podem ser enormes (constituições, romances inteiros
  numa página) — o texto salvo é cortado em _LIMITE_CHARS com aviso e link
  para a íntegra.
- A Wikimedia aplica limite de requisições por User-Agent (HTTP 429 com
  `Retry-After` de 15–50 s, corpo text/plain, header `x-envoy-ratelimited`).
  Com o User-Agent antigo ("... contato via github.com/ahaugusto/tusab",
  URL SEM esquema) o balde é de ~10 requisições a cada ~45–60 s — mesmo com
  2 s entre chamadas. O mesmo texto com "https://github.com/ahaugusto/tusab"
  passou 30/30 chamadas seguidas sem 429 (medido em 20/out/2026): a Wikimedia
  só reconhece o contato com URL completa. Corrigido em _base.py (e em
  wikipedia.py/wiktionary.py) no mesmo dia; WHO e PAHO IRIS revalidadas
  com o UA novo.
  Aqui: uma única nova tentativa respeitando `Retry-After` (com teto);
  persistindo, o erro sobe e vira mensagem de "aguarde e tente de novo".
"""

import time
import urllib.parse

import requests

from ._base import (
    HEADERS_TUSABBOT, executar_busca_generica, exigir_json, html_para_texto,
    resultado_vazio,
)

_LIMITE_CHARS = 60_000
_THROTTLE = 0.3
_TIMEOUT = (10, 30)
_ESPERA_MAX_429 = 15.0  # teto da espera antes da nova tentativa após HTTP 429

# Extract abaixo disso → tenta também o `parse` e fica com o mais longo.
_MIN_CHARS_EXTRACT = 300
# Texto final abaixo disso → página descartada (índice/portal só com links,
# ex.: "Departamento:Matemática Elementar" com 85 caracteres — sem valor p/ RAG).
_MIN_CHARS_TEXTO = 150


def _get_json(api_url: str, params: dict, fonte_nome: str, evento_cancelar=None) -> dict:
    for tentativa in range(2):
        resp = requests.get(api_url, headers=HEADERS_TUSABBOT, params=params, timeout=_TIMEOUT)
        if resp.status_code == 429 and tentativa == 0:
            try:
                espera = float(resp.headers.get("Retry-After", 5))
            except (TypeError, ValueError):
                espera = 5.0
            espera = max(1.0, min(espera, _ESPERA_MAX_429))
            if evento_cancelar is not None:
                if evento_cancelar.wait(espera):
                    break
            else:
                time.sleep(espera)
            continue
        resp.raise_for_status()
        dados = exigir_json(resp, fonte_nome)
        if "error" in dados:
            erro = dados["error"]
            raise RuntimeError(f"{fonte_nome}: {erro.get('code', '')} — {erro.get('info', '')}")
        return dados
    resp.raise_for_status()
    return exigir_json(resp, fonte_nome)


def limitar_texto(texto: str, url_origem: str) -> str:
    """Corta o texto em _LIMITE_CHARS (total, já contando o aviso)."""
    if len(texto) <= _LIMITE_CHARS:
        return texto
    aviso = f"\n\n[Texto truncado em {_LIMITE_CHARS:,} caracteres — íntegra em {url_origem}]".replace(",", ".")
    corte = texto[: _LIMITE_CHARS - len(aviso)]
    # Evita cortar no meio de uma palavra quando houver espaço perto do fim.
    ultimo_espaco = corte.rfind(" ", len(corte) - 200)
    if ultimo_espaco > 0:
        corte = corte[:ultimo_espaco]
    return corte.rstrip() + aviso


def url_pagina(api_url: str, titulo: str) -> str:
    """https://pt.wikibooks.org/w/api.php + "Cálculo/Limites" →
    https://pt.wikibooks.org/wiki/C%C3%A1lculo/Limites"""
    raiz = api_url.rsplit("/w/api.php", 1)[0]
    return f"{raiz}/wiki/" + urllib.parse.quote(titulo.replace(" ", "_"), safe="/:()")


def _texto_por_extract(api_url, titulo, fonte_nome, evento_cancelar) -> str:
    dados = _get_json(api_url, {
        "action": "query", "prop": "extracts", "explaintext": 1, "redirects": 1,
        "titles": titulo, "format": "json",
    }, fonte_nome, evento_cancelar)
    paginas = (dados.get("query") or {}).get("pages") or {}
    for pagina in paginas.values():
        return (pagina.get("extract") or "").strip()
    return ""


def _texto_por_parse(api_url, titulo, fonte_nome, evento_cancelar) -> str:
    dados = _get_json(api_url, {
        "action": "parse", "page": titulo, "prop": "text", "redirects": 1,
        "disableeditsection": 1, "disabletoc": 1, "format": "json",
    }, fonte_nome, evento_cancelar)
    html = ((dados.get("parse") or {}).get("text") or {}).get("*", "")
    return html_para_texto(html)


def buscar_mediawiki(
    api_url: str, fonte_id: str, fonte_nome: str,
    query: str, max_resultados: int, doc_dir: str,
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    """Busca no wiki em `api_url` e salva o texto de cada página em `doc_dir`.
    `max_resultados` já deve vir limitado pelo chamador."""
    dados = _get_json(api_url, {
        "action": "query", "list": "search", "srsearch": query,
        "srnamespace": 0, "srlimit": max_resultados, "format": "json",
    }, fonte_nome, evento_cancelar)
    titulos = [r["title"] for r in (dados.get("query") or {}).get("search", []) if r.get("title")]
    if not titulos:
        return resultado_vazio()

    def extrair(titulo):
        texto = _texto_por_extract(api_url, titulo, fonte_nome, evento_cancelar)
        if len(texto) < _MIN_CHARS_EXTRACT:
            # Vazio ou quase: página montada com predefinições/tabelas que o
            # TextExtracts ignora — o HTML renderizado costuma ter mais.
            texto_parse = _texto_por_parse(api_url, titulo, fonte_nome, evento_cancelar)
            if len(texto_parse) > len(texto):
                texto = texto_parse
        if len(texto) < _MIN_CHARS_TEXTO:
            return None
        url_origem = url_pagina(api_url, titulo)
        return {"titulo": titulo, "texto": limitar_texto(texto, url_origem), "url_origem": url_origem}

    return executar_busca_generica(
        titulos, extrair, fonte_id, doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=_THROTTLE,
    )
