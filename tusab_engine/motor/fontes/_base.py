# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Helpers compartilhados por todos os adaptadores de fonte pública em fontes/.

Cada adaptador (openalex.py, europepmc.py, ...) só implementa a parte
específica da API (montar a query, extrair {titulo, texto, url_origem} de um
item bruto) — a parte comum (salvar .txt com cabeçalho padrão, atualizar
manifest, throttle, cancelamento, progresso) vive aqui uma única vez.

Mesmo contrato de arquivo/manifest usado por arxiv.py e fhir.py — reaproveita
o mesmo formato TITULO/FONTE/DATA lido por cerebro_upload() (router_repositorio.py).
"""

import json
import os
import re
import time
import uuid
from datetime import datetime

import requests

from tusab_engine.storage import salvar_json_atomico

MAX_RESULTADOS_PERMITIDO = 50


def mensagem_erro_busca_externa(e: Exception, fonte_nome: str) -> str:
    """Traduz erros comuns de API externa em mensagem acionável — o texto cru
    de HTTPError (URL completa + status) não ajuda o usuário a saber se deve
    só tentar de novo ou se é um problema real."""
    if isinstance(e, requests.exceptions.HTTPError) and e.response is not None and e.response.status_code == 429:
        return f"{fonte_nome} está limitando o número de buscas no momento — aguarde alguns segundos e tente novamente."
    if isinstance(e, requests.exceptions.Timeout):
        return f"{fonte_nome} demorou demais para responder — tente novamente."
    return f"Erro ao buscar em {fonte_nome}: {e}"


def sanitizar_nome_arquivo(nome: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', nome)[:40]


def _carregar_manifest(doc_dir: str):
    manifest_path = os.path.join(doc_dir, "_manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f), manifest_path
    return [], manifest_path


def _salvar_documento(doc_dir: str, fonte_id: str, titulo: str, texto: str, url_origem: str) -> dict:
    fid = str(uuid.uuid4())[:8]
    nome_limpo = sanitizar_nome_arquivo(titulo)
    txt_path = os.path.join(doc_dir, f"{fid}_{nome_limpo}.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(f"TITULO: {titulo}\n")
        f.write(f"FONTE: {fonte_id}\n")
        f.write(f"DATA: {datetime.now().strftime('%d/%m/%Y')}\n")
        f.write(f"URL_ORIGEM: {url_origem}\n")
        f.write("-" * 70 + "\n")
        f.write(texto)
    return {
        "id": fid,
        "nome_original": titulo,
        "nome_txt": os.path.basename(txt_path),
        "tipo": fonte_id,
        "tamanho": len(texto.encode("utf-8")),
        "data": datetime.now().strftime("%d/%m/%Y"),
        "chars": len(texto),
        "fonte_externa": fonte_id,
    }


def executar_busca_generica(
    itens: list,
    extrair_item_fn,
    fonte_id: str,
    doc_dir: str,
    evento_cancelar=None,
    dispatch_event=None,
    throttle: float = 1.0,
) -> dict:
    """Laço comum de "pra cada item bruto da API: extrai texto, salva, avança".

    extrair_item_fn(item) -> {"titulo", "texto", "url_origem"} ou None (pula o
    item sem contar como erro — ex: resultado sem abstract, baixo valor pra RAG).
    Um item que levanta exceção vira entrada em "erros" e não derruba o lote
    (mesmo padrão de arxiv.py/fhir.py).
    """
    os.makedirs(doc_dir, exist_ok=True)
    manifest, manifest_path = _carregar_manifest(doc_dir)

    if dispatch_event:
        dispatch_event("total", total=len(itens))

    total_salvos = 0
    erros = []

    for i, item in enumerate(itens):
        if evento_cancelar is not None and evento_cancelar.is_set():
            break

        try:
            extraido = extrair_item_fn(item)
            if extraido:
                entry = _salvar_documento(
                    doc_dir, fonte_id,
                    extraido["titulo"], extraido["texto"], extraido.get("url_origem", ""),
                )
                manifest.append(entry)
                total_salvos += 1
                if dispatch_event:
                    dispatch_event("processed", processed=total_salvos, total=len(itens))
        except Exception as e:
            erros.append({"titulo": str(item)[:80], "erro": str(e)})

        if throttle and i < len(itens) - 1:
            time.sleep(throttle)

    salvar_json_atomico(manifest, manifest_path, indent=2)

    return {
        "ok": True,
        "total_encontrados": len(itens),
        "total_salvos": total_salvos,
        "erros": erros,
    }
