# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: PubMed/MEDLINE (NCBI Entrez) — literatura médica e biomédica.
Sem chave de API. Busca em 2 chamadas (esearch → efetch em lote, um único
efetch pra todos os PMIDs encontrados, não um por item) — confirmado ao vivo.
Escopo: artigos científicos (resumo/abstract), nunca dado de paciente — mesmo
invariante já aplicado em fhir.py (só ResearchStudy, nunca Patient).
"""

import os
import xml.etree.ElementTree as ET

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "pubmed",
    "nome": "PubMed",
    "area": "saude",
    "descricao": "Literatura médica e biomédica (NCBI/Entrez) — abstract completo.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        ESEARCH_URL,
        params={"db": "pubmed", "term": query, "retmax": max_resultados, "retmode": "json"},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    ids = resp.json().get("esearchresult", {}).get("idlist", [])

    itens = []
    if ids:
        resp2 = requests.get(
            EFETCH_URL,
            params={"db": "pubmed", "id": ",".join(ids), "rettype": "abstract", "retmode": "xml"},
            timeout=(10, 45),
        )
        resp2.raise_for_status()
        root = ET.fromstring(resp2.content)
        itens = root.findall(".//PubmedArticle")

    def extrair(article):
        # Abstract pode vir em múltiplas seções (Background/Methods/Results/Conclusion) — concatena todas.
        partes = [(el.text or "") for el in article.findall(".//AbstractText")]
        abstract = " ".join(p for p in partes if p).strip()
        if not abstract:
            return None
        titulo = article.findtext(".//ArticleTitle") or "Sem título"
        pmid = article.findtext(".//PMID") or ""
        url_origem = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else ""
        return {"titulo": titulo, "texto": abstract, "url_origem": url_origem}

    # Sem chamada de rede por item (efetch já veio em lote) — sem throttle necessário.
    return executar_busca_generica(
        itens, extrair, "pubmed", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
