# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: portais municipais de dados abertos (CKAN). Belo Horizonte
(dados.pbh.gov.br) ficou de fora: bloqueia o cliente Python pela assinatura
TLS (403 "Acesso Bloqueado" com qualquer cabeçalho, 200 via curl) — contornar
exigiria dependência nova. Rio (data.rio, ArcGIS Hub) e Curitiba (sem API JSON) ficaram
de fora; Natal, João Pessoa, Salvador e outras não têm portal utilizável.

Consulta todos os portais em paralelo (ver _portais_dados.py); portal lento
ou fora do ar fica de fora sem derrubar a busca. Lista testada ao vivo em
20/out/2026 — só portais com busca real no servidor (termo inexistente = 0).
"""

from ._portais_dados import buscar_portais

FONTE_META = {
    "id": "portais_br_municipios",
    "nome": "Dados abertos — capitais (Brasil)",
    "area": "dados",
    "descricao": "Portais de dados abertos das prefeituras de São Paulo, Recife, Fortaleza e Porto Alegre.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

PORTAIS = [
    {"nome": "Prefeitura de São Paulo", "plataforma": "ckan", "base": "https://dados.prefeitura.sp.gov.br"},
    {"nome": "Prefeitura do Recife", "plataforma": "ckan", "base": "https://dados.recife.pe.gov.br"},
    {"nome": "Prefeitura de Fortaleza", "plataforma": "ckan", "base": "https://dados.fortaleza.ce.gov.br"},
    {"nome": "Prefeitura de Porto Alegre", "plataforma": "ckan", "base": "https://dadosabertos.poa.br"},
]

# Sub-seleção na modal ("filtrar por capitais"): a busca consulta só os
# portais marcados. Ids = nome de exibição de cada portal.
FONTE_META["subfontes"] = [p["nome"] for p in PORTAIS]
FONTE_META["subfontes_rotulo"] = "Capitais"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None, subfontes=None,
) -> dict:
    portais = [p for p in PORTAIS if p["nome"] in subfontes] if subfontes else PORTAIS
    return buscar_portais(portais or PORTAIS, FONTE_META["id"], query, max_resultados, projeto_nome,
                          evento_cancelar=evento_cancelar, dispatch_event=dispatch_event)
