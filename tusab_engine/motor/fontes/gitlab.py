# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: GitLab.com — projetos de código aberto. Sem chave de API.

Testado ao vivo (20/out/2026):
- Busca: `GET https://gitlab.com/api/v4/projects?search=<termo>&order_by=star_count&sort=desc&per_page=<n>&simple=true`
  → lista com `path_with_namespace`, `description`, `topics`, `star_count`,
  `default_branch`, `web_url` e `readme_url` (ex.: `.../-/blob/main/README.md`).
  Busca sem resultado devolve `[]`.
- README: `GET /api/v4/projects/{id}/repository/files/{caminho}/raw?ref={branch}`
  — o caminho sai do próprio `readme_url` (pega README.md, README.rst,
  readme.md...). Ex.: projeto Inkscape NextGenerator → 5,2 KB.
Mesmo padrão do github.py: README é best-effort — se falhar, fica com
descrição + tópicos, nunca derruba o item. Item sem nenhum texto é pulado.
"""

import os
import urllib.parse

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica, resultado_vazio

FONTE_META = {
    "id": "gitlab",
    "nome": "GitLab",
    "area": "tecnologia",
    "descricao": "Projetos de código aberto no GitLab.com — README, descrição e tópicos.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API = "https://gitlab.com/api/v4"
LIMITE_README = 60_000


def _baixar_readme(projeto: dict) -> str:
    readme_url = projeto.get("readme_url") or ""
    branch = projeto.get("default_branch") or ""
    marcador = f"/-/blob/{branch}/"
    if not branch or marcador not in readme_url:
        return ""
    caminho = readme_url.split(marcador, 1)[1]
    try:
        resp = requests.get(
            f"{API}/projects/{projeto['id']}/repository/files/{urllib.parse.quote(caminho, safe='')}/raw",
            headers=HEADERS_TUSABBOT, params={"ref": branch}, timeout=(10, 30),
        )
        if resp.status_code != 200:
            return ""
        resp.encoding = "utf-8"
        return resp.text[:LIMITE_README]
    except requests.RequestException:
        return ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(f"{API}/projects", headers=HEADERS_TUSABBOT, params={
        "search": query, "order_by": "star_count", "sort": "desc",
        "per_page": max_resultados, "simple": "true",
    }, timeout=(10, 30))
    resp.raise_for_status()
    projetos = resp.json()
    if not isinstance(projetos, list):
        raise RuntimeError("GitLab mudou o formato da busca de projetos (esperava uma lista)")
    if not projetos:
        return resultado_vazio()

    def extrair(p):
        descricao = (p.get("description") or "").strip()
        topicos = p.get("topics") or p.get("tag_list") or []
        readme = _baixar_readme(p).strip()
        if not readme and len(descricao) < 40:
            return None
        cabecalho = [f"Projeto: {p.get('path_with_namespace', '')}", f"Estrelas: {p.get('star_count', 0)}"]
        if topicos:
            cabecalho.append("Tópicos: " + ", ".join(topicos[:12]))
        partes = [" | ".join(cabecalho)]
        if descricao:
            partes.append(descricao)
        if readme:
            partes.append(readme)
        return {"titulo": p.get("name_with_namespace") or p.get("path_with_namespace", ""),
                "texto": "\n\n".join(partes), "url_origem": p.get("web_url", "")}

    return executar_busca_generica(
        projetos, extrair, "gitlab", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
