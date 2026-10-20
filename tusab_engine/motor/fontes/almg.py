# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Assembleia Legislativa de Minas Gerais (ALMG) — proposições
estaduais (projetos de lei, PECs, requerimentos). Sem chave de API.

Endpoints (Dados Abertos da ALMG, API v2):
  - busca: GET https://dadosabertos.almg.gov.br/api/v2/proposicoes/pesquisa/avancada
    ?expr=<termo>&ord=0&tp=<n>&formato=json → {"resultado": {"noOcorrencias",
    "listaItem": [{siglaTipoProjeto, numero, ano, tipoProjeto, ementa,
    indexacao, situacao, dataPublicacao, autor, linksTextos: [{descricao,
    url}]}]}};
  - texto integral: GET https://dadosabertos.almg.gov.br/api/v2<linksTextos[].url>&formato=json
    → {"resultado": {"listaItem": [{"texto": "<html com <style> embutido>"}]}}.

Achados do teste ao vivo (20/out/2026):
  - "saúde mental" → 948 proposições, mais recentes primeiro (ord=0). O
    endpoint `/pesquisa/direcionada` IGNORA o termo (devolve sempre a mesma
    lista) — não usar.
  - Tamanho da página: parâmetro `tp` (o padrão é 20; `tamanhoPagina` é
    ignorado).
  - O texto integral vem em HTML com quebras de linha no meio das frases
    (texto exportado do editor da ALMG); normalizamos os espaços do HTML antes
    de converter — PL 6.174/2026 → ~6,9 mil caracteres limpos.
  - Requerimentos (RQC/RQN) trazem "assunto" no lugar de "ementa" e em geral
    não têm linksTextos; para eles fica o assunto + indexação.
  - A resposta traz campos internos de servidor (usuario, matricula) — não
    vão para o .txt.

Por que é frágil: API v2 sem documentação de contrato estável; o formato do
link de texto ("/proposicoes/pesquisa/avancada?expr=(PL.…[codi])[txmt]") é
uma expressão de busca interna. Resposta sem "resultado"/"listaItem" vira
RuntimeError; falha no texto integral cai de volta para a ementa.
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
    "id": "almg",
    "nome": "Assembleia Legislativa de Minas Gerais",
    "area": "direito",
    "descricao": "Proposições da Assembleia de Minas Gerais — ementa e texto integral de cada proposição.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API_BASE = "https://dadosabertos.almg.gov.br/api/v2"
SEARCH_URL = API_BASE + "/proposicoes/pesquisa/avancada"
PAGINA_PROPOSICAO = "https://www.almg.gov.br/projetos-de-lei/{sigla}/{numero}/{ano}"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_ERRO_FORMATO = "Dados Abertos da ALMG mudou o formato da resposta — a busca precisa ser atualizada no Tusab"


def _lista_itens(dados) -> list:
    resultado = dados.get("resultado") if isinstance(dados, dict) else None
    if not isinstance(resultado, dict) or "listaItem" not in resultado and "noOcorrencias" not in resultado:
        raise RuntimeError(_ERRO_FORMATO)
    if resultado.get("erro") is True:
        raise RuntimeError("Dados Abertos da ALMG recusou a busca (erro na expressão de pesquisa)")
    return resultado.get("listaItem") or []


def html_almg_para_texto(conteudo: str) -> str:
    # Quebras de linha no HTML da ALMG são quebra de exportação, não de
    # parágrafo — parágrafos reais vêm de </p>/<br>, preservados abaixo.
    return html_para_texto(re.sub(r"\s+", " ", conteudo or ""))


def _texto_integral(link: dict) -> str:
    url = link.get("url") or ""
    if not url.startswith("/"):
        return ""
    r = requests.get(API_BASE + url, params={"formato": "json"},
                     headers=dict(HEADERS_TUSABBOT, Accept="application/json"), timeout=_TIMEOUT)
    r.raise_for_status()
    itens = _lista_itens(exigir_json(r, FONTE_META["nome"]))
    return "\n\n".join(html_almg_para_texto(i.get("texto", "")) for i in itens if i.get("texto")).strip()


def montar_documento(item: dict, integra: str):
    sigla, numero, ano = item.get("siglaTipoProjeto", ""), item.get("numero", ""), item.get("ano", "")
    # Projetos trazem "ementa"; requerimentos trazem "assunto" no lugar.
    ementa = re.sub(r"\s+", " ", item.get("ementa") or item.get("assunto") or "").strip()
    if not ementa and not integra:
        return None
    titulo = f"{sigla} {numero}/{ano}".strip(" /") or "Proposição"
    if ementa:
        titulo += " — " + ((ementa[:80].rsplit(" ", 1)[0] + "…") if len(ementa) > 80 else ementa)
    linhas = []
    if ementa:
        linhas.append(f"{'Ementa' if item.get('ementa') else 'Assunto'}: {ementa}")
    for rotulo, chave in (("Autoria", "autor"), ("Situação", "situacao"), ("Publicação", "dataPublicacao")):
        valor = re.sub(r"\s+", " ", item.get(chave) or "").strip()
        if valor:
            linhas.append(f"{rotulo}: {valor}")
    indexacao = [t.strip("/ ").replace("/", " › ") for t in (item.get("indexacao") or "").splitlines() if t.strip()]
    if indexacao:
        linhas.append("Indexação: " + "; ".join(indexacao))
    texto = "\n".join(linhas)
    if integra:
        texto += f"\n\n--- TEXTO INTEGRAL ---\n\n{integra}"
    url = PAGINA_PROPOSICAO.format(sigla=sigla, numero=numero, ano=ano) if sigla and numero and ano else ""
    return {"titulo": titulo, "texto": texto[:_MAX_CHARS], "url_origem": url}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        SEARCH_URL,
        params={"expr": query, "ord": 0, "tp": max_resultados, "formato": "json"},
        headers=dict(HEADERS_TUSABBOT, Accept="application/json"),
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    itens = _lista_itens(exigir_json(resp, FONTE_META["nome"]))[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        integra = ""
        links = item.get("linksTextos") or []
        if links:
            time.sleep(0.5)
            # Best-effort: falha no texto integral não derruba o item — fica a ementa.
            try:
                integra = _texto_integral(links[0])
            except Exception:
                integra = ""
        return montar_documento(item, integra)

    return executar_busca_generica(
        itens, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
