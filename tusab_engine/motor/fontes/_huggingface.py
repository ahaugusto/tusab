# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Auxiliar comum das fontes do Hugging Face Hub (hf_modelos, hf_datasets,
hf_papers). API pública, sem chave — testado ao vivo em 20/out/2026:

- Busca de repositórios: `GET https://huggingface.co/api/{models|datasets}?search=<termo>&limit=<n>&sort=downloads`
  → lista de `{id, downloads, likes, tags, ...}` (sem texto narrativo).
- Card do repositório (o texto que interessa): `GET https://huggingface.co/{prefixo}{id}/raw/main/README.md`
  — Markdown com front matter YAML (licença, idioma, datasets). Model card do
  BERTimbau: ~3,6 KB; card de dataset: até dezenas de KB.
- Repositórios com acesso restrito ("gated", ex.: meta-llama/Llama-3.1-8B)
  respondem 401 no README — o item é pulado, sem derrubar a busca.
- Busca vazia devolve `[]`.
"""

import re

import requests

from ._base import HEADERS_TUSABBOT

HF = "https://huggingface.co"
LIMITE_CARD = 60_000

_RE_FRONT_MATTER = re.compile(r"\A---\s*\n.*?\n---\s*\n", re.DOTALL)
_RE_IMAGEM_MD = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_RE_HTML_TAG = re.compile(r"<[^>]+>")


def limpar_card(markdown: str) -> str:
    """Remove o front matter YAML, imagens e tags HTML soltas do README —
    mantém o Markdown (títulos, listas, tabelas), que o BM25 lê bem."""
    texto = _RE_FRONT_MATTER.sub("", markdown or "", count=1)
    texto = _RE_IMAGEM_MD.sub("", texto)
    texto = _RE_HTML_TAG.sub(" ", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto).strip()
    return texto[:LIMITE_CARD]


def buscar_repos(tipo: str, query: str, limite: int) -> list:
    """tipo: 'models' ou 'datasets'."""
    resp = requests.get(f"{HF}/api/{tipo}", headers=HEADERS_TUSABBOT, params={
        "search": query, "limit": limite, "sort": "downloads", "direction": -1,
    }, timeout=(10, 30))
    resp.raise_for_status()
    dados = resp.json()
    if not isinstance(dados, list):
        raise RuntimeError(f"Hugging Face mudou o formato da busca de {tipo} (esperava uma lista)")
    return dados


def baixar_card(prefixo_url: str, repo_id: str):
    """Devolve o README limpo, ou None se o repositório for restrito (401/403)
    ou não tiver card (404)."""
    resp = requests.get(f"{HF}/{prefixo_url}{repo_id}/raw/main/README.md",
                        headers=HEADERS_TUSABBOT, timeout=(10, 30))
    if resp.status_code in (401, 403, 404):
        return None
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return limpar_card(resp.text)


def cabecalho_repo(item: dict, rotulo: str) -> str:
    """Linha de contexto com popularidade e tags — ajuda a responder "qual o
    modelo mais usado para X" sem depender só do README."""
    tags = [t for t in (item.get("tags") or []) if ":" not in t][:12]
    partes = [f"{rotulo}: {item.get('id', '')}",
              f"Downloads: {item.get('downloads', 0)}", f"Curtidas: {item.get('likes', 0)}"]
    if item.get("pipeline_tag"):
        partes.append(f"Tarefa: {item['pipeline_tag']}")
    if tags:
        partes.append("Tags: " + ", ".join(tags))
    return " | ".join(partes)
