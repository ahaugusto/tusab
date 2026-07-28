# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Banco Central do Brasil (portal de dados abertos, CKAN) — o
único candidato da área "Economia, finanças e ciências sociais" com busca
real por palavra-chave e conteúdo narrativo (descrição do conjunto de dados).
Sem chave de API.

Os demais candidatos mapeados da área (World Bank, IBGE, Ipeadata, UN Data,
dados.gov.br) foram testados ao vivo e descartados nesta rodada: World Bank
não tem endpoint de busca (só listagem paginada dos ~29.500 indicadores,
exigiria baixar tudo e filtrar localmente — arquitetura diferente da busca ao
vivo usada aqui); IBGE/Ipeadata expõem agregados por código, não por tema;
UN Data (handlers legados) respondeu com erro de servidor; dados.gov.br
retornou 401 no endpoint de busca. Ver agents/_historia.md.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "bcb",
    "nome": "Banco Central do Brasil",
    "area": "economia",
    "descricao": "Conjuntos de dados econômicos e monetários — séries, relatórios e estatísticas do BCB.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://dadosabertos.bcb.gov.br/api/3/action/package_search"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(BASE_URL, params={"q": query, "rows": max_resultados}, timeout=(10, 45))
    resp.raise_for_status()
    itens = resp.json().get("result", {}).get("results", [])

    def extrair(item):
        texto = item.get("notes") or ""
        if not texto:
            return None
        titulo = item.get("title") or "Sem título"
        nome_dataset = item.get("name") or ""
        url_origem = f"https://dadosabertos.bcb.gov.br/dataset/{nome_dataset}" if nome_dataset else ""
        return {"titulo": titulo, "texto": texto, "url_origem": url_origem}

    return executar_busca_generica(
        itens, extrair, "bcb", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
