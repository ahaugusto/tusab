# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: CAPES — Catálogo de Teses e Dissertações + resumo na
Plataforma Sucupira. Sem chave de API. Cobre teses e dissertações defendidas
em todos os programas de pós-graduação reconhecidos pela CAPES.

Endpoints:
  1. POST https://catalogodeteses.capes.gov.br/catalogo-teses/rest/busca
     JSON {"termo", "filtros": [], "pagina": 1, "registrosPorPagina": n}
     → {"total", "tesesDissertacoes": [{id, titulo, autor, nomePrograma,
       instituicao, grauAcademico, dataDefesa, link}]} — API REST interna do
       front Angular do catálogo, não documentada como API pública.
  2. GET <link> (Sucupira, viewTrabalhoConclusao.jsf?popup=true&id_trabalho=<id>)
     → redireciona (301) para sucupira-legado.capes.gov.br; a página JSF traz o
     resumo em <span id="resumo"> e as palavras-chave em <span id="palavras">.

Achados do teste ao vivo (20/out/2026): "alfabetização" → 10.058 registros;
sem acento ("alfabetizacao") → 9.044, então o acento importa e o termo vai
como está — requests.post(json=...) envia UTF-8 escapado (\\u00e7), aceito
pelo servidor. Resumos de 2–4 mil caracteres.

LGPD: o catálogo traz nome do autor, do orientador e vínculo empregatício do
autor (tp_vinc). Só usamos o que descreve o trabalho (grau, programa, IES,
ano, resumo, palavras-chave) — nenhum dado pessoal vai para o .txt.

Por que é frágil: a chamada 1 é API interna (pode mudar sem aviso) e a 2 é
raspagem de página JSF do Sucupira "legado" (ids de <span> do tema). Sem o
<span id="resumo"> o item é descartado; se NENHUM item da página tiver o
resumo, levantamos RuntimeError — sinal de que o layout mudou.
"""

import os
import re
import time

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "capes_teses",
    "nome": "CAPES — Catálogo de Teses e Dissertações",
    "area": "educacao",
    "descricao": "Teses e dissertações de programas de pós-graduação reconhecidos pela CAPES — resumo de cada trabalho.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://catalogodeteses.capes.gov.br/catalogo-teses/rest/busca"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000

_RE_RESUMO = re.compile(r'<span[^>]*\bid="resumo"[^>]*>(.*?)</span>', re.DOTALL)
_RE_PALAVRAS = re.compile(r'<span[^>]*\bid="palavras"[^>]*>(.*?)</span>', re.DOTALL)


def _extrair_resumo(pagina: str) -> tuple:
    """Página do Sucupira → (resumo, palavras-chave). ('', '') se não houver."""
    def _campo(regex):
        m = regex.search(pagina)
        # A página quebra linhas no meio da frase (texto colado do formulário
        # da Coleta) — normaliza os espaços do HTML antes; quebras reais vêm
        # de <br>/<p> e são preservadas por html_para_texto.
        return html_para_texto(re.sub(r"\s+", " ", m.group(1))) if m else ""
    return _campo(_RE_RESUMO), _campo(_RE_PALAVRAS)


def montar_documento(item: dict, resumo: str, palavras: str):
    if not resumo:
        return None
    titulo = (item.get("titulo") or "").strip() or "Trabalho de conclusão"
    ano = (item.get("dataDefesa") or "")[:4]
    linhas = [titulo, ""]
    for rotulo, valor in (
        ("Grau", item.get("grauAcademico")),
        ("Programa", item.get("nomePrograma")),
        ("Instituição", item.get("instituicao")),
        ("Ano de defesa", ano),
    ):
        if valor:
            linhas.append(f"{rotulo}: {valor}")
    if palavras:
        linhas.append(f"Palavras-chave: {palavras.replace(';', '; ')}")
    linhas += ["", "Resumo:", resumo]
    return {"titulo": titulo, "texto": "\n".join(linhas)[:_MAX_CHARS], "url_origem": item.get("link", "")}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.post(
        SEARCH_URL,
        json={"termo": query, "filtros": [], "pagina": 1, "registrosPorPagina": max_resultados},
        headers=dict(HEADERS_TUSABBOT, Accept="application/json"),
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    dados = exigir_json(resp, FONTE_META["nome"])
    if not isinstance(dados, dict) or "tesesDissertacoes" not in dados:
        raise RuntimeError("Catálogo de Teses da CAPES mudou o formato da resposta (campo 'tesesDissertacoes' ausente)")
    itens = [i for i in (dados.get("tesesDissertacoes") or []) if i.get("link")][:max_resultados]
    if not itens:
        return resultado_vazio()

    paginas_sem_resumo = {"n": 0}

    def extrair(item):
        time.sleep(0.5)
        r = requests.get(item["link"], headers=HEADERS_TUSABBOT, timeout=_TIMEOUT, allow_redirects=True)
        r.raise_for_status()
        resumo, palavras = _extrair_resumo(r.text)
        if not resumo:
            paginas_sem_resumo["n"] += 1
        return montar_documento(item, resumo, palavras)

    resultado = executar_busca_generica(
        itens, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
    if resultado["total_salvos"] == 0 and paginas_sem_resumo["n"] == len(itens):
        raise RuntimeError("Plataforma Sucupira mudou o formato da página do trabalho (resumo não encontrado em nenhum resultado)")
    return resultado
