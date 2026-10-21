# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Codeberg — forja Git sem fins lucrativos (Forgejo/Gitea),
projetos de software livre. Sem chave de API.

Testado ao vivo (20/out/2026):
- Busca: `GET https://codeberg.org/api/v1/repos/search?q=<termo>&limit=<n>&sort=stars&order=desc`
  → `{"ok": true, "data": [{full_name, description, default_branch,
  stars_count, html_url, topics...}]}`.
- README: `GET /api/v1/repos/{owner}/{repo}/raw/README.md?ref={branch}`
  (ex.: forgejo/forgejo → 2,8 KB). Tenta também readme.md e README.
README best-effort, como em github.py e gitlab.py.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica, exigir_json, resultado_vazio

FONTE_META = {
    "id": "codeberg",
    "nome": "Codeberg",
    "area": "tecnologia",
    "descricao": "Projetos de software livre no Codeberg (forja Git sem fins lucrativos) — README e descrição.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

API = "https://codeberg.org/api/v1"
LIMITE_README = 60_000
_NOMES_README = ("README.md", "readme.md", "README", "README.rst")


def _baixar_readme(repo: dict) -> str:
    branch = repo.get("default_branch") or ""
    for nome in _NOMES_README:
        try:
            resp = requests.get(f"{API}/repos/{repo['full_name']}/raw/{nome}", headers=HEADERS_TUSABBOT,
                                params={"ref": branch} if branch else None, timeout=(10, 30))
        except requests.RequestException:
            return ""
        if resp.status_code == 200:
            resp.encoding = "utf-8"
            return resp.text[:LIMITE_README]
    return ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(f"{API}/repos/search", headers=HEADERS_TUSABBOT, params={
        "q": query, "limit": max_resultados, "sort": "stars", "order": "desc",
    }, timeout=(10, 30))
    resp.raise_for_status()
    corpo = exigir_json(resp, FONTE_META["nome"])
    repos = corpo.get("data") if isinstance(corpo, dict) else None
    if repos is None:
        raise RuntimeError("Codeberg mudou o formato da busca de repositórios (sem o campo 'data')")
    if not repos:
        return resultado_vazio()

    def extrair(r):
        descricao = (r.get("description") or "").strip()
        readme = _baixar_readme(r).strip()
        if not readme and len(descricao) < 40:
            return None
        cabecalho = [f"Repositório: {r.get('full_name', '')}", f"Estrelas: {r.get('stars_count', 0)}"]
        if r.get("topics"):
            cabecalho.append("Tópicos: " + ", ".join(r["topics"][:12]))
        partes = [" | ".join(cabecalho)] + [p for p in (descricao, readme) if p]
        return {"titulo": r.get("full_name", ""), "texto": "\n\n".join(partes), "url_origem": r.get("html_url", "")}

    return executar_busca_generica(
        repos, extrair, "codeberg", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
