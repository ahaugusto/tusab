# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: portais de dados abertos de órgãos federais brasileiros (CKAN).
O portal central dados.gov.br exige token desde 2023 (401 confirmado ao vivo)
e fica de fora; os órgãos com CKAN próprio continuam abertos.
ANTT e TCE-RS ficaram de fora: descrições quase vazias (ANTT) ou 73 mil
conjuntos gerados por template município × ano (TCE-RS), ruído para o chat.

Consulta todos os portais em paralelo (ver _portais_dados.py); portal lento
ou fora do ar fica de fora sem derrubar a busca. Lista testada ao vivo em
20/out/2026 — só portais com busca real no servidor (termo inexistente = 0).
"""

from ._portais_dados import buscar_portais

FONTE_META = {
    "id": "portais_br_federal",
    "nome": "Dados abertos — órgãos federais (Brasil)",
    "area": "dados",
    "descricao": "Catálogos de dados de IPEA, CVM, ANEEL, IBAMA, CAPES, TSE, Turismo e outros órgãos federais — descrição e arquivos de cada conjunto.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

PORTAIS = [
    {"nome": "IPEA", "plataforma": "ckan", "base": "https://dados.ipea.gov.br"},
    {"nome": "CVM", "plataforma": "ckan", "base": "https://dados.cvm.gov.br"},
    {"nome": "ANEEL", "plataforma": "ckan", "base": "https://dadosabertos.aneel.gov.br"},
    {"nome": "IBAMA", "plataforma": "ckan", "base": "https://dadosabertos.ibama.gov.br"},
    {"nome": "CAPES", "plataforma": "ckan", "base": "https://dadosabertos.capes.gov.br"},
    {"nome": "TSE", "plataforma": "ckan", "base": "https://dadosabertos.tse.jus.br"},
    {"nome": "Ministério do Turismo", "plataforma": "ckan", "base": "https://dados.turismo.gov.br"},
    {"nome": "Ministério de Minas e Energia", "plataforma": "ckan", "base": "https://dadosabertos.mme.gov.br"},
    {"nome": "Ministério da Cultura", "plataforma": "ckan", "base": "https://dados.cultura.gov.br"},
]


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    return buscar_portais(PORTAIS, FONTE_META["id"], query, max_resultados, projeto_nome,
                          evento_cancelar=evento_cancelar, dispatch_event=dispatch_event)
