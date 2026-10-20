# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: ERIC — Education Resources Information Center (Institute of
Education Sciences, Departamento de Educação dos EUA), sem chave de API.
Maior base de literatura em pesquisa educacional: artigos de periódicos
(ids "EJ...") e relatórios, teses e documentos técnicos (ids "ED...").
Conteúdo em inglês.

Endpoint: GET https://api.ies.ed.gov/eric/?search=<consulta>&format=json
          &rows=<n>&start=0&fields=id,title,description,url,e_fulltextauth,...
Resposta: {"response": {"numFound": N, "docs": [...]}}

Achados do teste ao vivo (20/out/2026):
- O operador padrão entre palavras é OR: "reading instruction" → ~528 mil
  registros; "reading AND instruction" → ~72 mil. Por isso as palavras do
  termo são unidas com " AND " — a menos que o usuário já tenha escrito uma
  consulta avançada (aspas, AND/OR/NOT, campo:valor), que vai como está.
- O servidor responde `Content-Type: text/plain` mesmo com format=json, então
  `exigir_json` (que olha o Content-Type) recusaria uma resposta válida — a
  validação aqui é tentar decodificar o JSON e falhar com mensagem clara.
- `title` e `description` vêm com entidades HTML (&apos; &quot;) — são
  decodificadas antes de salvar.
- Filtros na própria sintaxe de busca: `author:"Sobrenome, Nome"` e
  `publicationdateyear:[2015 TO 2020]` (testados ao vivo, combinados com
  AND).
- `e_fulltextauth == 1` indica que o ERIC hospeda o texto integral; para
  documentos "ED..." o PDF fica em files.eric.ed.gov/fulltext/{id}.pdf. O PDF
  NÃO é baixado (fica para uma etapa futura) — só o link entra no texto.
"""

import os
import re
from html import unescape

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio

FONTE_META = {
    "id": "eric",
    "nome": "ERIC (Dep. de Educação dos EUA)",
    "area": "educacao",
    "descricao": "Pesquisa educacional internacional (em inglês) — resumo real de artigos, relatórios e teses.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": True,
}

API_URL = "https://api.ies.ed.gov/eric/"
_CAMPOS = "id,title,description,url,e_fulltextauth,publicationdateyear,author"

# Sinais de consulta avançada já escrita pelo usuário — não reescrever.
_RE_CONSULTA_AVANCADA = re.compile(r'"|\b(AND|OR|NOT)\b|\w:\S')


def montar_consulta(query: str, data_inicio: str = "", data_fim: str = "", autor: str = "") -> str:
    """Termo livre → "palavra1 AND palavra2", mais filtros de autor/ano."""
    termo = (query or "").strip()
    if termo and not _RE_CONSULTA_AVANCADA.search(termo):
        termo = " AND ".join(termo.split())
    partes = [f"({termo})" if " OR " in termo else termo] if termo else []

    autor = (autor or "").strip().replace('"', "")
    if autor:
        partes.append(f'author:"{autor}"')

    ano_ini = (data_inicio or "").strip()[:4]
    ano_fim = (data_fim or "").strip()[:4]
    ano_ini = ano_ini if ano_ini.isdigit() else ""
    ano_fim = ano_fim if ano_fim.isdigit() else ""
    if ano_ini or ano_fim:
        partes.append(f"publicationdateyear:[{ano_ini or '*'} TO {ano_fim or '*'}]")

    return " AND ".join(partes)


def _decodificar(resp) -> dict:
    try:
        return resp.json()
    except ValueError as e:
        raise RuntimeError("ERIC respondeu conteúdo que não é JSON (bloqueio ou manutenção no servidor de origem)") from e


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    consulta = montar_consulta(query, data_inicio, data_fim, autor)
    if not consulta:
        return resultado_vazio()

    resp = requests.get(API_URL, params={
        "search": consulta, "format": "json", "rows": max_resultados,
        "start": 0, "fields": _CAMPOS,
    }, timeout=(10, 30))
    resp.raise_for_status()
    docs = (_decodificar(resp).get("response") or {}).get("docs") or []
    if not docs:
        return resultado_vazio()

    def extrair(doc):
        descricao = unescape(doc.get("description") or "").strip()
        if not descricao:
            return None
        eric_id = str(doc.get("id") or "").strip()
        titulo = unescape(doc.get("title") or "").strip() or "Sem título"

        cabecalho = []
        autores = doc.get("author") or []
        if isinstance(autores, str):
            autores = [autores]
        if autores:
            cabecalho.append("Autoria: " + "; ".join(autores))
        if doc.get("publicationdateyear"):
            cabecalho.append(f"Ano: {doc['publicationdateyear']}")
        if doc.get("url"):
            cabecalho.append(f"Publicação original: {doc['url']}")
        if str(doc.get("e_fulltextauth")) == "1" and eric_id.startswith("ED"):
            cabecalho.append(f"Texto integral (PDF): https://files.eric.ed.gov/fulltext/{eric_id}.pdf")

        texto = ("\n".join(cabecalho) + "\n\n" + descricao) if cabecalho else descricao
        return {"titulo": titulo, "texto": texto, "url_origem": f"https://eric.ed.gov/?id={eric_id}"}

    return executar_busca_generica(
        docs, extrair, "eric", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
