# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte de extração: busca acadêmica no arXiv, para o perfil Pesquisador.

Feature inspirada no projeto open-source OpenScience (synthetic-sciences/openscience),
um workbench de agente de pesquisa científica avaliado em `agents/_historia.md`
(seção "Benchmark — ferramentas open-source avaliadas", jul/2026). Diferente do
OpenScience, o Tusab não roda hipótese/experimento — apenas busca, baixa e indexa
papers como qualquer outro documento do Repositório, preservando o pipeline BM25
local-first existente.

Usa a API pública do arXiv (export.arxiv.org/api/query, Atom XML, sem autenticação).
Resultados são salvos em data/neural/{projeto}/documents/ com o mesmo formato de
cabeçalho (TITULO/FONTE/DATA) e contrato de _manifest.json do upload manual — ver
tusab_engine/api/router_repositorio.py::cerebro_upload().
"""

import io
import os
import re
import time
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime

import requests

from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

ARXIV_API_URL = "http://export.arxiv.org/api/query"
_ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}

# arXiv pede um intervalo mínimo de 3s entre requisições — mesmo padrão de
# time.sleep() usado em motor/extraction.py (linha ~1014) para o yt-dlp.
_INTERVALO_ENTRE_REQUISICOES = 3

MAX_RESULTADOS_PERMITIDO = 50


def _sanitizar_nome_arquivo(nome: str) -> str:
    """Mesma sanitização usada no upload manual (router_repositorio.py)."""
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', nome)[:40]


def _extrair_texto_pdf(conteudo_bytes: bytes) -> str:
    """Extrai texto de um PDF via pdfplumber — mesmo padrão de cerebro_upload()."""
    import pdfplumber

    paginas = []
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for pagina in pdf.pages:
            txt = pagina.extract_text(x_tolerance=3, y_tolerance=3) or ""
            txt = re.sub(r'(?<=[a-záàâãéêíóôõúç])-\n(?=[a-záàâãéêíóôõúç])', '', txt, flags=re.IGNORECASE)
            txt = re.sub(r'[ \t]{2,}', ' ', txt).strip()
            if txt:
                paginas.append(txt)
    return "\n\n".join(paginas)


def _parsear_entradas(atom_xml: bytes) -> list:
    """Extrai {id, titulo, resumo, pdf_url, publicado} de cada <entry> do feed Atom."""
    root = ET.fromstring(atom_xml)
    entradas = []
    for entry in root.findall("atom:entry", _ATOM_NS):
        arxiv_id = (entry.findtext("atom:id", default="", namespaces=_ATOM_NS) or "").strip()
        titulo = (entry.findtext("atom:title", default="", namespaces=_ATOM_NS) or "").strip()
        titulo = re.sub(r'\s+', ' ', titulo)
        resumo = (entry.findtext("atom:summary", default="", namespaces=_ATOM_NS) or "").strip()
        publicado = (entry.findtext("atom:published", default="", namespaces=_ATOM_NS) or "")[:10]

        pdf_url = ""
        for link in entry.findall("atom:link", _ATOM_NS):
            if link.attrib.get("title") == "pdf":
                pdf_url = link.attrib.get("href", "")
                break

        if arxiv_id and pdf_url:
            entradas.append({
                "id": arxiv_id,
                "titulo": titulo or arxiv_id,
                "resumo": resumo,
                "pdf_url": pdf_url,
                "publicado": publicado,
            })
    return entradas


def buscar_arxiv(
    query: str,
    max_resultados: int,
    projeto_nome: str,
    evento_cancelar=None,
    dispatch_event=None,
) -> dict:
    """Busca papers no arXiv por tema, baixa os PDFs e indexa como documentos do projeto.

    [CONTRATO] Segue o mesmo padrão de cerebro_upload() (router_repositorio.py):
    salva .txt com cabeçalho TITULO/FONTE/DATA em documents/ e atualiza _manifest.json.
    Não reindexa automaticamente — indexação continua sendo ação explícita do usuário
    via POST /agent/index, igual a qualquer outro documento.

    Retorna {ok, total_encontrados, total_salvos, erros: [...]}.
    """
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))

    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    os.makedirs(doc_dir, exist_ok=True)

    resp = requests.get(
        ARXIV_API_URL,
        params={
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": max_resultados,
        },
        timeout=30,
    )
    resp.raise_for_status()
    entradas = _parsear_entradas(resp.content)

    if dispatch_event:
        dispatch_event("arxiv_total", total=len(entradas))

    manifest_path = os.path.join(doc_dir, "_manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        import json
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    total_salvos = 0
    erros = []

    for i, item in enumerate(entradas):
        if evento_cancelar is not None and evento_cancelar.is_set():
            break

        try:
            pdf_resp = requests.get(item["pdf_url"], timeout=60)
            pdf_resp.raise_for_status()
            texto = _extrair_texto_pdf(pdf_resp.content)

            if not texto.strip():
                # PDF sem camada de texto — mesmo comportamento do upload manual:
                # registra com aviso em vez de descartar o resultado.
                texto = (
                    f"[PDF registrado sem extração de texto — possível documento escaneado]\n"
                    f"Fonte: arXiv ({item['id']})\n"
                )

            fid = str(uuid.uuid4())[:8]
            nome_limpo = _sanitizar_nome_arquivo(item["titulo"])
            txt_path = os.path.join(doc_dir, f"{fid}_{nome_limpo}.txt")

            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"TITULO: {item['titulo']}\n")
                f.write(f"FONTE: arxiv\n")
                f.write(f"DATA: {datetime.now().strftime('%d/%m/%Y')}\n")
                f.write(f"URL_ORIGEM: {item['id']}\n")
                f.write("-" * 70 + "\n")
                if item["resumo"]:
                    f.write(f"Resumo: {item['resumo']}\n\n")
                f.write(texto)

            manifest.append({
                "id": fid,
                "nome_original": item["titulo"],
                "nome_txt": os.path.basename(txt_path),
                "tipo": "pdf",
                "tamanho": len(pdf_resp.content),
                "data": datetime.now().strftime("%d/%m/%Y"),
                "chars": len(texto),
                "fonte_externa": "arxiv",
            })
            total_salvos += 1

            if dispatch_event:
                dispatch_event("arxiv_processed", processed=total_salvos, total=len(entradas))

        except Exception as e:
            erros.append({"id": item.get("id", "?"), "titulo": item.get("titulo", "?"), "erro": str(e)})

        # Throttle entre requisições — não aplicar após o último item
        if i < len(entradas) - 1:
            time.sleep(_INTERVALO_ENTRE_REQUISICOES)

    salvar_json_atomico(manifest, manifest_path, indent=2)

    return {
        "ok": True,
        "total_encontrados": len(entradas),
        "total_salvos": total_salvos,
        "erros": erros,
    }
