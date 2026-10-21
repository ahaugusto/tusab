# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: portais estaduais de dados abertos (CKAN). Atenção aos
endereços novos: dados.sp.gov.br e dados.rj.gov.br morreram — os portais
vivos são dadosabertos.sp.gov.br e dadosabertos.rj.gov.br. PR e DF não têm
API de busca; CE, AM, PA e outros não têm portal CKAN encontrado; BA, AC,
PB, RO e RN têm acervo ínfimo (até 20 conjuntos).

Consulta todos os portais em paralelo (ver _portais_dados.py); portal lento
ou fora do ar fica de fora sem derrubar a busca. Lista testada ao vivo em
20/out/2026 — só portais com busca real no servidor (termo inexistente = 0).
"""

from ._portais_dados import buscar_portais

FONTE_META = {
    "id": "portais_br_estados",
    "nome": "Dados abertos — estados (Brasil)",
    "area": "dados",
    "descricao": "Portais de dados abertos de SP, RJ, MG, RS, SC, PE, ES, GO e AL — descrição e arquivos de cada conjunto.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

PORTAIS = [
    {"nome": "São Paulo", "plataforma": "ckan", "base": "https://dadosabertos.sp.gov.br"},
    {"nome": "SEADE (SP)", "plataforma": "ckan", "base": "https://repositorio.seade.gov.br"},
    {"nome": "Rio de Janeiro", "plataforma": "ckan", "base": "https://dadosabertos.rj.gov.br"},
    {"nome": "Minas Gerais", "plataforma": "ckan", "base": "https://dados.mg.gov.br"},
    {"nome": "Rio Grande do Sul", "plataforma": "ckan", "base": "https://dados.rs.gov.br"},
    {"nome": "Santa Catarina", "plataforma": "ckan", "base": "https://dados.sc.gov.br"},
    {"nome": "Pernambuco", "plataforma": "ckan", "base": "https://dados.pe.gov.br"},
    {"nome": "Espírito Santo", "plataforma": "ckan", "base": "https://dados.es.gov.br"},
    {"nome": "Goiás", "plataforma": "ckan", "base": "https://dadosabertos.go.gov.br"},
    {"nome": "Alagoas", "plataforma": "ckan", "base": "https://dados.al.gov.br/catalogo"},
]


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    return buscar_portais(PORTAIS, FONTE_META["id"], query, max_resultados, projeto_nome,
                          evento_cancelar=evento_cancelar, dispatch_event=dispatch_event)
