# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: ClinicalTrials.gov (API v2, NIH/NLM) — registro de ensaios
clínicos com cobertura genuinamente mundial. Sem chave de API.

Avaliado extensamente em agents/_historia.md junto com a decisão do vertical
Tusab Saúde: confirmado ao vivo escala mundial real (10.094 resultados só pra
"HIV", locais em Tanzânia/Uganda/Romênia/EUA) e texto substantivo
(briefSummary/detailedDescription, não só metadado — diferente do Datajud).
Escopo restrito a estudos (nunca dado de paciente individual).
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "clinicaltrials",
    "nome": "ClinicalTrials.gov",
    "area": "saude",
    "descricao": "Registro mundial de ensaios clínicos (NIH/NLM) — resumo e descrição detalhada.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://clinicaltrials.gov/api/v2/studies"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    # query.term é busca geral (título/descrição/condição/intervenção) — mais
    # abrangente que query.cond (restrito a condição/doença), confirmado ao
    # vivo com termos não-clínicos ("machine learning" trouxe resultados reais).
    resp = requests.get(BASE_URL, params={"query.term": query, "pageSize": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("studies", [])

    def extrair(item):
        proto = item.get("protocolSection", {})
        ident = proto.get("identificationModule", {})
        desc = proto.get("descriptionModule", {})

        partes = []
        if desc.get("briefSummary"):
            partes.append(desc["briefSummary"])
        if desc.get("detailedDescription"):
            partes.append(desc["detailedDescription"])
        texto = "\n\n".join(partes)
        if not texto.strip():
            return None

        titulo = ident.get("briefTitle") or ident.get("officialTitle") or "Sem título"
        nct_id = ident.get("nctId", "")
        url_origem = f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "clinicaltrials", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.3,
    )
