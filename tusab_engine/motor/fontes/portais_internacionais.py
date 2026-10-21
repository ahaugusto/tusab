# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: portais nacionais e regionais de dados abertos fora do Brasil
(CKAN, udata, Socrata e OpenDataSoft). A busca é literal e no idioma de cada
portal: "saúde" acha em Portugal, "salud" na América hispânica, "health" nos
de língua inglesa. HDX (ONU/OCHA) inclui conjuntos da OMS e do Banco Mundial.
data.gov dos EUA ficou de fora (CKAN antigo desligado, API nova exige chave),
assim como Nova Zelândia (Imperva), Banco Mundial (Cloudflare, 429) e
open.africa (bloqueia o cliente Python pela assinatura TLS; 200 só via curl).

Consulta todos os portais em paralelo (ver _portais_dados.py); portal lento
ou fora do ar fica de fora sem derrubar a busca. Lista testada ao vivo em
20/out/2026 — só portais com busca real no servidor (termo inexistente = 0).
"""

from ._portais_dados import buscar_portais

FONTE_META = {
    "id": "portais_internacionais",
    "nome": "Dados abertos — portais internacionais",
    "area": "dados",
    "descricao": "Portais nacionais de dados abertos (França, Portugal, Canadá, Austrália, ONU/HDX, Alemanha, Argentina, México e outros) — descrição e arquivos.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

PORTAIS = [
    {"nome": "data.gouv.fr (França)", "plataforma": "udata", "base": "https://www.data.gouv.fr"},
    {"nome": "dados.gov.pt (Portugal)", "plataforma": "udata", "base": "https://dados.gov.pt"},
    {"nome": "Open Government (Canadá)", "plataforma": "ckan", "base": "https://open.canada.ca/data"},
    {"nome": "data.gov.au (Austrália)", "plataforma": "ckan", "base": "https://data.gov.au/data"},
    {"nome": "HDX (ONU/OCHA)", "plataforma": "ckan", "base": "https://data.humdata.org"},
    {"nome": "GovData (Alemanha)", "plataforma": "ckan", "base": "https://ckan.govdata.de"},
    {"nome": "data.overheid.nl (Países Baixos)", "plataforma": "ckan", "base": "https://data.overheid.nl/data"},
    {"nome": "datos.gob.ar (Argentina)", "plataforma": "ckan", "base": "https://datos.gob.ar"},
    {"nome": "Catálogo de Datos (Uruguai)", "plataforma": "ckan", "base": "https://catalogodatos.gub.uy"},
    {"nome": "datos.gob.do (Rep. Dominicana)", "plataforma": "ckan", "base": "https://datos.gob.do"},
    {"nome": "datos.gob.mx (México)", "plataforma": "ckan", "base": "https://www.datos.gob.mx"},
    {"nome": "Données Québec", "plataforma": "ckan", "base": "https://www.donneesquebec.ca/recherche"},
    {"nome": "DataBC (Colúmbia Britânica)", "plataforma": "ckan", "base": "https://catalogue.data.gov.bc.ca"},
    {"nome": "California Open Data", "plataforma": "ckan", "base": "https://data.ca.gov"},
    {"nome": "data.gov.hk (Hong Kong)", "plataforma": "ckan", "base": "https://data.gov.hk/en-data"},
    {"nome": "datos.gov.co (Colômbia)", "plataforma": "socrata", "dominio": "www.datos.gov.co"},
    {"nome": "OpenDataSoft (hub)", "plataforma": "ods", "base": "https://data.opendatasoft.com"},
    {"nome": "Paris Data", "plataforma": "ods", "base": "https://opendata.paris.fr"},
]

# Sub-seleção na modal ("filtrar por países e portais"): a busca consulta só os
# portais marcados. Ids = nome de exibição de cada portal.
FONTE_META["subfontes"] = [p["nome"] for p in PORTAIS]
FONTE_META["subfontes_rotulo"] = "Países e portais"


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None, subfontes=None,
) -> dict:
    portais = [p for p in PORTAIS if p["nome"] in subfontes] if subfontes else PORTAIS
    return buscar_portais(portais or PORTAIS, FONTE_META["id"], query, max_resultados, projeto_nome,
                          evento_cancelar=evento_cancelar, dispatch_event=dispatch_event)
