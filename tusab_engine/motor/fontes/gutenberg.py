# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Project Gutenberg — livros integrais em domínio público
(literatura, filosofia, economia clássica, história). Sem chave de API.

Endpoints:
- Busca: GET https://www.gutenberg.org/ebooks/search.opds/?query=...
  (feed Atom/OPDS do próprio site).
- Texto: GET https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt

Achados do teste ao vivo (20/out/2026):
- O Gutendex (API JSON não oficial) deu timeout em 4 de 6 tentativas —
  descartado em favor do OPDS oficial.
- O feed OPDS de busca traz 25 livros por página e, ANTES deles, 3 entradas
  de navegação ("Authors", "Subjects", "Bookshelves" — id
  .../ebooks/authors/search.opds/?query=...). Paginação vem como
  <link rel="next"> no feed, não como entrada. Só são aceitas entradas cujo
  <id> termina em /ebooks/{número}.opds.
- <content> da entrada de livro traz o autor (ex.: "Adam Smith"), mas às
  vezes é só a contagem ("5464 downloads") — nesse caso é ignorado.
- O .txt vem em UTF-8 com cabeçalho e rodapé de licença; o conteúdo do livro
  fica entre "*** START OF THE PROJECT GUTENBERG EBOOK ... ***" e
  "*** END OF THE PROJECT GUTENBERG EBOOK ... ***" (livros antigos usam
  "THIS" no lugar de "THE"). "The Theory of the Leisure Class" tem ~672 mil
  caracteres — o corte de 200 mil por documento é aplicado.
- Política do site pede volume baixo para robôs: no máximo 10 livros por
  busca e 2 s entre downloads.
"""

import os
import re
import xml.etree.ElementTree as ET

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio

FONTE_META = {
    "id": "gutenberg",
    "nome": "Project Gutenberg",
    "area": "patrimonio",
    "descricao": "Livros integrais em domínio público — texto completo de cada obra (até 10 por busca).",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BUSCA_URL = "https://www.gutenberg.org/ebooks/search.opds/"
TEXTO_URL = "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt"
LIVRO_URL = "https://www.gutenberg.org/ebooks/{id}"
MAX_LIVROS_POR_BUSCA = 10
THROTTLE_SEGUNDOS = 2.0
LIMITE_TEXTO_INTEGRAL = 200_000

_NS = {"a": "http://www.w3.org/2005/Atom"}
_RE_ID_LIVRO = re.compile(r"/ebooks/(\d+)\.opds$")
_RE_INICIO = re.compile(r"^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$", re.IGNORECASE | re.MULTILINE)
_RE_FIM = re.compile(r"^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$", re.IGNORECASE | re.MULTILINE)
_RE_SO_DOWNLOADS = re.compile(r"^\d+\s+downloads?$", re.IGNORECASE)


def remover_licenca_gutenberg(texto: str) -> str:
    """Corta o cabeçalho (antes de *** START ...) e o rodapé de licença
    (a partir de *** END ...). Sem marcadores, devolve o texto inteiro."""
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    inicio = _RE_INICIO.search(texto)
    if inicio:
        texto = texto[inicio.end():]
    fim = _RE_FIM.search(texto)
    if fim:
        texto = texto[:fim.start()]
    return texto.strip()


def _livros_do_feed(xml_bytes: bytes) -> list:
    """Entradas de livro do feed OPDS: [{"id", "titulo", "autor"}], sem as
    entradas de navegação (Authors/Subjects/Bookshelves)."""
    raiz = ET.fromstring(xml_bytes)
    livros = []
    for entrada in raiz.findall("a:entry", _NS):
        m = _RE_ID_LIVRO.search((entrada.findtext("a:id", default="", namespaces=_NS) or "").strip())
        if not m:
            continue
        titulo = " ".join((entrada.findtext("a:title", default="", namespaces=_NS) or "").split())
        autor = " ".join((entrada.findtext("a:content", default="", namespaces=_NS) or "").split())
        if _RE_SO_DOWNLOADS.match(autor):
            autor = ""
        livros.append({"id": m.group(1), "titulo": titulo or "Sem título", "autor": autor})
    return livros


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO, MAX_LIVROS_POR_BUSCA))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BUSCA_URL, params={"query": query}, headers=HEADERS_TUSABBOT, timeout=(10, 30))
    resp.raise_for_status()
    tipo = resp.headers.get("Content-Type", "").lower()
    if "xml" not in tipo:
        raise RuntimeError(f"{FONTE_META['nome']} respondeu {tipo or 'sem tipo'} em vez de XML (bloqueio ou manutenção no servidor de origem)")
    livros = _livros_do_feed(resp.content)[:max_resultados]
    if not livros:
        return resultado_vazio()

    def extrair(livro):
        r = requests.get(TEXTO_URL.format(id=livro["id"]), headers=HEADERS_TUSABBOT, timeout=(10, 60))
        if r.status_code == 404:
            return None  # livro sem versão .txt (ex.: só áudio)
        r.raise_for_status()
        corpo = remover_licenca_gutenberg(r.content.decode("utf-8", errors="replace"))
        if not corpo:
            return None
        corpo = corpo[:LIMITE_TEXTO_INTEGRAL]
        texto = (f"Autor: {livro['autor']}\n\n" if livro["autor"] else "") + corpo
        return {"titulo": livro["titulo"], "texto": texto, "url_origem": LIVRO_URL.format(id=livro["id"])}

    return executar_busca_generica(
        livros, extrair, "gutenberg", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=THROTTLE_SEGUNDOS,
    )
