# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: OasisBR — Portal Brasileiro de Publicações e Dados Científicos
em Acesso Aberto (IBICT), sem chave de API. Agrega artigos de periódicos
brasileiros, repositórios institucionais e também teses/dissertações — por
isso a sobreposição com a BDTD é esperada (mesma obra nas duas fontes).

Endpoint: GET https://oasisbr.ibict.br/vufind/api/v1/search (ver _vufind.py
para os parâmetros e os achados comuns ao VuFind).

Achados do teste ao vivo (20/out/2026): "alfabetização" → ~25.000 registros,
mas a API é LENTA — 2 a 9 s por busca, mesmo pedindo poucos registros —, daí
o timeout de leitura de 45 s. É comum vir "resumo" que só repete o título
truncado ("Alfabetização é ..."); o filtro de tamanho mínimo de _vufind.py
descarta esses casos.
"""

import os

import requests  # noqa: F401 — exposto para os testes (patch.object(oasisbr.requests, "get"))

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO
from ._vufind import buscar_vufind

FONTE_META = {
    "id": "oasisbr",
    "nome": "OasisBR (IBICT)",
    "area": "educacao",
    "descricao": "Artigos e periódicos científicos brasileiros em acesso aberto — resumo real de cada publicação.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://oasisbr.ibict.br"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_vufind(
        BASE_URL, FONTE_META["id"], FONTE_META["nome"], query, max_resultados, doc_dir,
        timeout=(10, 45), evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
