# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte de extração: busca de estudos clínicos (FHIR ResearchStudy), para o perfil Pesquisador.

Avaliado em `agents/_historia.md` (seção "Benchmark — ferramentas open-source avaliadas",
jul/2026). Escopo deliberadamente restrito ao resource type ResearchStudy — nunca Patient
ou qualquer outro recurso que modele dados de indivíduo, mesmo sintético/teste: o perfil
Pesquisador B2C é "RAG sobre PDFs/docs/arXiv com privacidade absoluta", sem contexto
clínico de paciente. Dados de saúde individual via FHIR ficam reservados ao futuro
vertical Tusab Saúde (B2B Enterprise) — ver `Documentação do Produto/Tusab Saúde —
Proposta Estratégica.md`.

Usa o servidor público de referência HAPI FHIR (hapi.fhir.org/baseR4, R4, sem
autenticação). Todo recurso FHIR tem um campo padronizado text.div (Narrative) —
resumo em HTML feito para leitura humana; quando presente, é extraído como texto
principal. Demais campos estruturados (title, status, description, condition) são
concatenados como texto corrido — mesma lógica de "extrair todo campo disponível com
fallback gracioso" usada no parser de WhatsApp/Reuniões (router_repositorio.py).

Resultados são salvos em data/neural/{projeto}/documents/ com o mesmo formato de
cabeçalho (TITULO/FONTE/DATA) e contrato de _manifest.json do upload manual e do
arXiv — ver tusab_engine/motor/arxiv.py e router_repositorio.py::cerebro_upload().
"""

import html
import os
import re
import time
import uuid
from datetime import datetime

import requests

from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

FHIR_BASE_URL = "https://hapi.fhir.org/baseR4"
RESOURCE_TYPE = "ResearchStudy"

# Servidor público compartilhado — mesmo espírito de throttle do arXiv
# (motor/arxiv.py), evita sobrecarregar um recurso comunitário gratuito.
_INTERVALO_ENTRE_REQUISICOES = 1

MAX_RESULTADOS_PERMITIDO = 50

_DIV_TAG_RE = re.compile(r'<[^>]+>')


def _limpar_narrative_html(div: str) -> str:
    """Remove tags do Narrative (text.div) preservando o texto legível."""
    texto = _DIV_TAG_RE.sub(' ', div or '')
    texto = html.unescape(texto)
    return re.sub(r'\s+', ' ', texto).strip()


def _sanitizar_nome_arquivo(nome: str) -> str:
    """Mesma sanitização usada no arXiv e no upload manual (router_repositorio.py)."""
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', nome)[:40]


def _extrair_campo_texto(valor) -> str:
    """FHIR usa tanto string simples quanto CodeableConcept ({text, coding:[...]}) —
    normaliza os dois formatos para texto simples."""
    if not valor:
        return ""
    if isinstance(valor, str):
        return valor.strip()
    if isinstance(valor, dict):
        if valor.get("text"):
            return str(valor["text"]).strip()
        codings = valor.get("coding") or []
        textos = [c.get("display") or c.get("code") for c in codings if c.get("display") or c.get("code")]
        return "; ".join(t for t in textos if t)
    if isinstance(valor, list):
        return "; ".join(_extrair_campo_texto(v) for v in valor if v)
    return ""


def _parsear_resource(resource: dict) -> dict:
    """Extrai {id, titulo, texto, status, publicado} de um resource ResearchStudy.

    Prioriza o Narrative (text.div) quando presente; sempre concatena os campos
    estruturados disponíveis (status, description, condition) — fallback gracioso
    para servidores/sandboxes com Narrative ausente ou vazio (comum em dados de teste).
    """
    rid = str(resource.get("id") or "")
    titulo = (resource.get("title") or "").strip()

    partes = []

    narrative = (resource.get("text") or {}).get("div", "")
    narrative_limpo = _limpar_narrative_html(narrative)
    if narrative_limpo and "put rendering here" not in narrative_limpo.lower():
        partes.append(narrative_limpo)

    status = resource.get("status") or ""
    if status:
        partes.append(f"Status: {status}")

    descricao = _extrair_campo_texto(resource.get("description"))
    if descricao:
        partes.append(f"Descrição: {descricao}")

    condicao = _extrair_campo_texto(resource.get("condition"))
    if condicao:
        partes.append(f"Condição estudada: {condicao}")

    publicado = ((resource.get("meta") or {}).get("lastUpdated") or "")[:10]

    return {
        "id": rid,
        "titulo": titulo or f"ResearchStudy {rid}",
        "texto": "\n\n".join(partes),
        "status": status,
        "publicado": publicado,
    }


def _buscar_bundle(query: str, max_resultados: int) -> list:
    resp = requests.get(
        f"{FHIR_BASE_URL}/{RESOURCE_TYPE}",
        params={
            "title:contains": query,
            "_count": max_resultados,
            "_format": "json",
        },
        headers={"Accept": "application/fhir+json"},
        timeout=30,
    )
    resp.raise_for_status()
    bundle = resp.json()
    entradas = []
    for entry in bundle.get("entry", []):
        resource = entry.get("resource") or {}
        if resource.get("resourceType") != RESOURCE_TYPE:
            continue
        entradas.append(_parsear_resource(resource))
    return entradas


def buscar_fhir(
    query: str,
    max_resultados: int,
    projeto_nome: str,
    evento_cancelar=None,
    dispatch_event=None,
) -> dict:
    """Busca estudos clínicos (ResearchStudy) via FHIR e indexa como documentos do projeto.

    [CONTRATO] Mesmo padrão de buscar_arxiv() (motor/arxiv.py) e cerebro_upload()
    (router_repositorio.py): salva .txt com cabeçalho TITULO/FONTE/DATA em documents/
    e atualiza _manifest.json. Não reindexa automaticamente.

    Escopo restrito a ResearchStudy — nunca outro resource type (ver docstring do módulo).

    Retorna {ok, total_encontrados, total_salvos, erros: [...]}.
    """
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))

    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    os.makedirs(doc_dir, exist_ok=True)

    entradas = _buscar_bundle(query, max_resultados)

    if dispatch_event:
        dispatch_event("fhir_total", total=len(entradas))

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
            texto = item["texto"] or (
                f"[Estudo registrado sem descrição textual disponível no servidor FHIR]\n"
                f"Fonte: FHIR ResearchStudy ({item['id']})\n"
            )

            fid = str(uuid.uuid4())[:8]
            nome_limpo = _sanitizar_nome_arquivo(item["titulo"])
            txt_path = os.path.join(doc_dir, f"{fid}_{nome_limpo}.txt")

            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"TITULO: {item['titulo']}\n")
                f.write(f"FONTE: fhir\n")
                f.write(f"DATA: {datetime.now().strftime('%d/%m/%Y')}\n")
                f.write(f"URL_ORIGEM: {FHIR_BASE_URL}/{RESOURCE_TYPE}/{item['id']}\n")
                f.write("-" * 70 + "\n")
                f.write(texto)

            manifest.append({
                "id": fid,
                "nome_original": item["titulo"],
                "nome_txt": os.path.basename(txt_path),
                "tipo": "fhir",
                "tamanho": len(texto.encode("utf-8")),
                "data": datetime.now().strftime("%d/%m/%Y"),
                "chars": len(texto),
                "fonte_externa": "fhir",
            })
            total_salvos += 1

            if dispatch_event:
                dispatch_event("fhir_processed", processed=total_salvos, total=len(entradas))

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
