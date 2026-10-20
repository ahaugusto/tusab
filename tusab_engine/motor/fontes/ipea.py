# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: IPEA — Repositório do Conhecimento do Instituto de Pesquisa
Econômica Aplicada (DSpace 7), sem chave de API. Textos para discussão,
boletins, notas técnicas e livros sobre economia, políticas públicas,
desenvolvimento regional, saneamento, previdência etc.

Endpoint: `GET https://repositorio.ipea.gov.br/server/api/discover/search/objects`
(conector genérico em _dspace7.py). Item público em
`https://repositorio.ipea.gov.br/handle/<handle>`.

Achados do teste ao vivo (20/out/2026):
- Abstract curto (200–900 caracteres; "O PAC e o saneamento básico" tem 169)
  — pouco para RAG. Por isso esta fonte usa o texto integral que o próprio
  DSpace já extraiu do PDF (bundle TEXT): "Saneamento rural no Brasil" →
  41,6 mil caracteres de texto puro em UTF-8.
- Se o item não tiver bundle TEXT (ou ele vier vazio/grande demais), cai
  para o abstract — o documento não é perdido.
- Custo: 2 requisições extras por item (bundles + conteúdo), com throttle de
  1s entre itens.
"""

import os

import requests  # noqa: F401 — exposto para os testes fazerem patch de requests.get

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT
from ._dspace7 import buscar_dspace7

FONTE_META = {
    "id": "ipea",
    "nome": "IPEA — Repositório do Conhecimento",
    "area": "economia",
    "descricao": "Estudos e textos para discussão do IPEA sobre economia e políticas públicas — texto integral.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_API = "https://repositorio.ipea.gov.br/server/api"
FRONT_URL = "https://repositorio.ipea.gov.br"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_dspace7(
        BASE_API, FRONT_URL, FONTE_META, query, max_resultados, doc_dir,
        headers=HEADERS_TUSABBOT, usar_texto_integral=True,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
