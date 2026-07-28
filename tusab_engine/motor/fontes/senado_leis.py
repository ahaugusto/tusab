# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Senado Federal — Legislação Federal publicada (leis já
sancionadas/em vigor, não projetos em tramitação — diferente do módulo
camara.py, que cobre proposições). Sem chave de API.

Achado importante: este endpoint (`/dadosabertos/legislacao/lista`) é
diferente do `/dadosabertos/processo` (rejeitado — não filtra por palavra-
chave, ver camara.py) e do LexML (bloqueado por verificação anti-bot ao
vivo). Retorna ementa real de cada lei publicada — confirmado ao vivo com
leis recentes (nº 15.476/2026, 23/jul/2026).

Sem busca por palavra-chave no servidor — só filtro por `tipo`. Sem texto
integral disponível via API (o link de detalhe aponta pra uma SPA em
Angular, `normas.leg.br`, que não renderiza sem JS — trafilatura não
resolve; Diário Oficial exige credencial INLABS). Solução: busca inteira
(~17mil leis, ~8,5MB, uma chamada só — bem menor que os ~29,5mil
indicadores do World Bank, que precisariam de paginação) e filtro por
palavra no campo `ementa`, feito localmente. Trade-off aceito: mais lento
que busca server-side, mas é o único jeito real de "buscar por tema" nessa
fonte.
"""

import os
import xml.etree.ElementTree as ET

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "senado_leis",
    "nome": "Senado Federal — Legislação",
    "area": "direito",
    "descricao": "Leis federais já publicadas (sancionadas) — ementa oficial de cada norma.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

LISTA_URL = "https://legis.senado.leg.br/dadosabertos/legislacao/lista"


def _data_para_urn(data_assinatura: str) -> str:
    """'23/07/2026' -> '2026-07-23' (formato exigido pela URN de normas.leg.br)."""
    try:
        dia, mes, ano = data_assinatura.split("/")
        return f"{ano}-{mes}-{dia}"
    except Exception:
        return ""


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(LISTA_URL, params={"tipo": "LEI"}, timeout=(15, 60))
    resp.raise_for_status()
    root = ET.fromstring(resp.content)

    termos = [t for t in query.lower().split() if t]
    candidatos = []
    for doc in root.iter("documento"):
        ementa = (doc.findtext("ementa") or "").strip()
        if not ementa:
            continue
        ementa_lower = ementa.lower()
        if termos and not all(t in ementa_lower for t in termos):
            continue
        candidatos.append({
            "numero": doc.findtext("numero") or "",
            "normaNome": doc.findtext("normaNome") or "Lei",
            "ementa": ementa,
            "dataassinatura": doc.findtext("dataassinatura") or "",
        })
        if len(candidatos) >= max_resultados:
            break

    def extrair(item):
        urn_data = _data_para_urn(item["dataassinatura"])
        url_origem = (
            f"https://normas.leg.br/?urn=urn:lex:br:federal:lei:{urn_data};{item['numero']}"
            if urn_data and item["numero"] else ""
        )
        texto = item["ementa"]
        if item["dataassinatura"]:
            texto += f"\n\nData de assinatura: {item['dataassinatura']}"
        return {"titulo": item["normaNome"], "texto": texto, "url_origem": url_origem}

    # Sem chamada de rede por item (tudo já veio na busca inicial) — sem
    # necessidade de throttle entre salvamentos.
    return executar_busca_generica(
        candidatos, extrair, "senado_leis", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
