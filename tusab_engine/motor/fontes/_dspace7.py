# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Conector genérico para repositórios institucionais DSpace 7 (REST API
"Server"). Não é uma fonte por si só (sem FONTE_META, não entra em _MODULOS
do __init__.py — mesmo papel de _base.py): paho_iris.py, who_iris.py, fiocruz_arca.py,
unasus_ares.py e ipea.py só declaram a base da API, o host do front e o
FONTE_META, e delegam a busca pra cá.

Endpoint de busca (mesmo em todas as instâncias testadas em 20/out/2026):
    GET {base}/discover/search/objects?query=<termo>&dsoType=ITEM&size=<n>&page=0
Resposta HAL+JSON (Content-Type `application/hal+json` — passa no
exigir_json). Os itens ficam em
`_embedded.searchResult._embedded.objects[]._embedded.indexableObject`, com
os metadados Dublin Core em `metadata["dc.title"]` e
`metadata["dc.description.abstract"]` (lista de {value, language}).

Achados do teste ao vivo:
- O abstract pode vir em várias entradas, uma por idioma (PAHO IRIS devolve
  "[ABSTRACT]...", "[RESUMEN]...", "[RESUMO]..." no mesmo item) — juntamos
  todas, sem repetir valores idênticos.
- Parte relevante dos itens não tem abstract — no WHO IRIS os 20 primeiros
  de "dengue" eram fascículos do Weekly Epidemiological Record sem resumo,
  e a busca ingênua salvava 0 documentos. Solução: a query vai ao Solr como
  `(<termo>) AND dc.description.abstract:*`, que funcionou nas 5 instâncias
  (WHO "dengue": 9.542 → 1.153 itens, 10/10 da 1ª página com abstract;
  PAHO 6/10 → 10/10; ARCA 4/10 → 10/10). Se o Solr rejeitar a sintaxe do
  termo (HTTP 4xx/5xx), repete sem o filtro. Em qualquer caso, item sem
  abstract é descartado localmente; pedimos 2× o max (teto de 100, limite de
  página do DSpace) e cortamos em max_resultados — nunca salva mais que o
  pedido.
- Texto integral opcional: o DSpace já extrai o texto dos PDFs no bundle
  `TEXT` (`GET {base}/core/items/{uuid}/bundles?embed=bitstreams` → bundle
  "TEXT" → `_links.content.href` do 1º bitstream, `text/plain` UTF-8).
  Testado: IPEA "Saneamento rural no Brasil" → 41,6 mil chars de texto puro,
  contra 931 chars de abstract. Se o bundle não existir, falhar, vier vazio
  ou grande demais, cai para o abstract.
"""

import requests

from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, exigir_json, resultado_vazio

_TAMANHO_PAGINA_MAX = 100          # limite de `size` aceito pelo DSpace 7
_FATOR_SOBRA = 2                   # folga de candidatos por resultado pedido (abstract só com espaços etc.)
# Cláusula Solr acrescentada ao termo do usuário: só itens com abstract.
_FILTRO_COM_ABSTRACT = "dc.description.abstract:*"
_TEXTO_INTEGRAL_MAX_BYTES = 5 * 1024 * 1024   # evita baixar livro de centenas de MB de texto
_TEXTO_INTEGRAL_MIN_CHARS = 500    # abaixo disso o "texto extraído" costuma ser lixo de OCR/capa


def _valores(metadata: dict, campo: str) -> list:
    """Lista de valores não vazios de um campo DC, sem duplicatas, na ordem."""
    vistos = []
    for entrada in metadata.get(campo) or []:
        valor = (entrada.get("value") or "").strip()
        if valor and valor not in vistos:
            vistos.append(valor)
    return vistos


def _url_item(item: dict, front_url: str) -> str:
    handle = item.get("handle")
    if handle:
        return f"{front_url}/handle/{handle}"
    return f"{front_url}/items/{item.get('uuid', '')}"


def _baixar_texto_integral(base_api: str, uuid: str, headers: dict) -> str:
    """Texto puro já extraído pelo DSpace (bundle TEXT). Devolve "" se não
    houver — o chamador cai para o abstract."""
    resp = requests.get(
        f"{base_api}/core/items/{uuid}/bundles",
        params={"embed": "bitstreams"}, headers=headers, timeout=(10, 30),
    )
    resp.raise_for_status()
    bundles = exigir_json(resp, "DSpace").get("_embedded", {}).get("bundles", [])
    bundle_texto = next((b for b in bundles if b.get("name") == "TEXT"), None)
    if not bundle_texto:
        return ""
    bitstreams = bundle_texto.get("_embedded", {}).get("bitstreams", {}).get("_embedded", {}).get("bitstreams", [])
    if not bitstreams:
        return ""
    bitstream = bitstreams[0]
    if (bitstream.get("sizeBytes") or 0) > _TEXTO_INTEGRAL_MAX_BYTES:
        return ""
    href = bitstream.get("_links", {}).get("content", {}).get("href")
    if not href:
        return ""
    resp_txt = requests.get(href, headers=headers, timeout=(10, 60))
    resp_txt.raise_for_status()
    tipo = resp_txt.headers.get("Content-Type", "").lower()
    if "text/plain" not in tipo:
        return ""
    # Sem charset no header o requests assume ISO-8859-1 para text/* — o
    # DSpace grava esses .txt em UTF-8.
    texto = resp_txt.text if "charset" in tipo else resp_txt.content.decode("utf-8", errors="replace")
    texto = texto.strip()
    return texto if len(texto) >= _TEXTO_INTEGRAL_MIN_CHARS else ""


def buscar_dspace7(
    base_api: str,
    front_url: str,
    fonte_meta: dict,
    query: str,
    max_resultados: int,
    doc_dir: str,
    headers: dict = None,
    usar_texto_integral: bool = False,
    evento_cancelar=None,
    dispatch_event=None,
) -> dict:
    """Busca itens num DSpace 7, salva título + abstract (ou texto integral,
    se `usar_texto_integral`) como .txt em doc_dir.

    `base_api` sem barra final (ex.: "https://iris.paho.org/server/api");
    `front_url` é o host público usado para montar a URL do item.
    """
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    headers = headers or {}
    tamanho = min(max_resultados * _FATOR_SOBRA, _TAMANHO_PAGINA_MAX)
    url_busca = f"{base_api}/discover/search/objects"

    def _pesquisar(q):
        r = requests.get(
            url_busca, params={"query": q, "dsoType": "ITEM", "size": tamanho, "page": 0},
            headers=headers, timeout=(10, 60),
        )
        r.raise_for_status()
        return r

    try:
        resp = _pesquisar(f"({query}) AND {_FILTRO_COM_ABSTRACT}")
    except requests.exceptions.HTTPError:
        # Termo com sintaxe que o Solr rejeita (parêntese solto, ":" no fim...)
        # → repete sem o filtro; o descarte local de itens sem abstract segue valendo.
        resp = _pesquisar(query)
    dados = exigir_json(resp, fonte_meta["nome"])
    objetos = dados.get("_embedded", {}).get("searchResult", {}).get("_embedded", {}).get("objects", [])

    candidatos = []
    for obj in objetos:
        item = obj.get("_embedded", {}).get("indexableObject") or {}
        metadata = item.get("metadata") or {}
        abstract = "\n\n".join(_valores(metadata, "dc.description.abstract"))
        if not abstract:
            continue
        titulos = _valores(metadata, "dc.title")
        candidatos.append({
            "uuid": item.get("uuid", ""),
            "titulo": titulos[0] if titulos else (item.get("name") or "Sem título"),
            "abstract": abstract,
            "url_origem": _url_item(item, front_url),
        })
        if len(candidatos) >= max_resultados:
            break

    if not candidatos:
        return resultado_vazio()

    def extrair(cand):
        texto = ""
        if usar_texto_integral and cand["uuid"]:
            try:
                texto = _baixar_texto_integral(base_api, cand["uuid"], headers)
            except Exception:
                texto = ""   # bundle ausente/erro → fallback silencioso para o abstract
        return {
            "titulo": cand["titulo"],
            "texto": texto or cand["abstract"],
            "url_origem": cand["url_origem"],
        }

    return executar_busca_generica(
        candidatos, extrair, fonte_meta["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
        # Só há requisição por item quando busca o texto integral.
        throttle=1.0 if usar_texto_integral else 0,
    )
