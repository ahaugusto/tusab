# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Fiocruz ARCA — repositório institucional da Fundação
Oswaldo Cruz (DSpace 7), sem chave de API. Artigos, teses, dissertações e
livros da Fiocruz, majoritariamente em português.

Endpoint: `GET https://api.arca.fiocruz.br/api/discover/search/objects`
(conector genérico em _dspace7.py). Item público em
`https://arca.fiocruz.br/handle/<handle>`.

Achados do teste ao vivo (20/out/2026):
- A API mora num host diferente do front: `api.arca.fiocruz.br/api`. O
  caminho padrão do DSpace 7 no host do front (`arca.fiocruz.br/server/api`)
  devolve 404.
- Aceita o UA padrão; usamos o TusabBot por consistência com as demais
  fontes institucionais.
- Parte dos itens não tem abstract (ex.: "Dengue Situation in Brazil by Year
  2000") — descartados.
"""

import os

import requests  # noqa: F401 — exposto para os testes fazerem patch de requests.get

from tusab_engine.storage import NEURAL_DIR
from ._base import HEADERS_TUSABBOT
from ._dspace7 import buscar_dspace7

FONTE_META = {
    "id": "fiocruz_arca",
    "nome": "Fiocruz ARCA",
    "area": "saude",
    "descricao": "Repositório institucional da Fiocruz — artigos, teses e livros em saúde pública, com resumo em português.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_API = "https://api.arca.fiocruz.br/api"
FRONT_URL = "https://arca.fiocruz.br"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    return buscar_dspace7(
        BASE_API, FRONT_URL, FONTE_META, query, max_resultados, doc_dir,
        headers=HEADERS_TUSABBOT,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event,
    )
