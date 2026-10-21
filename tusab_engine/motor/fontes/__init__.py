# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Registro genérico de fontes públicas de busca acadêmica/dados abertos, pro
perfil Pesquisador. Cada módulo desta pasta implementa {FONTE_META, buscar()}
— ver arxiv_adapter.py pro exemplo mais simples e _base.py pro contrato
compartilhado de salvamento.

Mapeado a partir do documento "Bases de Dados Abertas — Consolidação Ampliada
de Endpoints de API" (Equipe NDTI/DECIT/SCTIE, Ministério da Saúde, jul/2026),
10 áreas de conhecimento por domínio (Educação desde out/2026) + 1 área "geral" pros buscadores
multidisciplinares (arXiv, OpenAlex, DataCite, DOAJ, Zenodo) — esses não
"pertencem" a uma área de domínio como PubMed pertence a saúde ou CERN Open
Data pertence a física; indexam produção de qualquer campo, então ficavam
soterrados dentro de "Produção científica e literatura" mesmo cobrindo muito
mais que isso (decisão de 30/jul/2026, ver agents/_historia.md).

Só entram fontes testadas ao vivo, sem cadastro/chave, com conteúdo textual
substantivo (não apenas metadado) — mesmo critério usado pra FHIR/
ClinicalTrials.gov (ver agents/_historia.md).

arXiv (arxiv_adapter.py) está no registro ativo — não fica exclusivo do
futuro vertical Tusab Saúde: a mesma base técnica atende os dois (decisão de
27/jul/2026, ver _historia.md).
"""

from . import (
    agencia_brasil, almg, anvisalegis, art_institute_chicago, arxiv_adapter, bcb,
    bdtd, bvs_ms, camara, camara_discursos, capes_teses, cern_opendata,
    cleveland_art, clinicaltrials, codeberg, crossref, data_europa_eu, data_gov_uk, datacite,
    doaj, educapes, eric, europepmc, federal_register, fiocruz_arca, github,
    gitlab, govbr_noticias, gutenberg, hacker_news, hal, hf_datasets, hf_modelos, hf_papers, ibge_noticias, inca, inspire_hep,
    ipea, nasa_cmr, nasa_ntrs, oasisbr, open_library, openalex, openfda, osti,
    paho_iris, portais_br_estados, portais_br_federal, portais_br_municipios,
    portais_internacionais, pubmed, senado_discursos, senado_leis, senado_materias,
    stackexchange, stf, tcu, the_met, tst, unasus_ares, uniprot, usgs_pubs,
    who_iris, wikilivros_pt, wikipedia, wikisource_pt, wikiversidade_pt,
    wiktionary, worldbank_wds, zenodo,
)

_MODULOS = [
    # Ordem = ordem de exibição: a área aparece na posição do seu 1º módulo, e
    # dentro de cada área as fontes brasileiras vêm primeiro (Brazil First).
    arxiv_adapter, openalex, datacite, doaj, zenodo,
    crossref, hal, open_library, agencia_brasil,
    github, gitlab, codeberg, hf_modelos, hf_datasets, hf_papers, stackexchange, hacker_news,
    bcb, ipea, ibge_noticias, worldbank_wds,
    # Dados abertos (out/2026): ~40 portais agrupados em 4 fontes que consultam
    # em paralelo — uma caixa por portal deixaria a modal ilegível.
    portais_br_federal, portais_br_estados, portais_br_municipios,
    portais_internacionais, data_europa_eu, data_gov_uk,
    # Educação — área criada em out/2026 (perfis Professor e Estudante não
    # tinham nenhuma fonte própria). MEC, CNE, BNCC e INEP não têm API
    # utilizável (testado ao vivo): o acervo brasileiro chega por IBICT e CAPES.
    bdtd, oasisbr, capes_teses, educapes, wikilivros_pt, wikiversidade_pt, eric,
    camara, camara_discursos, senado_leis, senado_materias, senado_discursos,
    stf, tcu, tst, govbr_noticias, almg, federal_register,
    bvs_ms, anvisalegis, fiocruz_arca, inca, unasus_ares, paho_iris, who_iris,
    pubmed, clinicaltrials, uniprot, europepmc, openfda,
    nasa_cmr, nasa_ntrs, usgs_pubs,
    cern_opendata, osti, inspire_hep,
    wikisource_pt, art_institute_chicago, the_met, cleveland_art, gutenberg,
    wikipedia, wiktionary,
]

FONTES = {m.FONTE_META["id"]: m for m in _MODULOS}

# Nome de exibição de cada área — chave bate com FONTE_META["area"] de cada módulo.
AREAS_META = {
    "geral":      "Buscadores gerais e multidisciplinares",
    "tecnologia": "Tecnologia, IA e ciência de dados",
    "economia":   "Economia, finanças e ciências sociais",
    "dados":      "Dados abertos e portais de governo",
    "educacao":   "Educação, ensino e material didático",
    "direito":    "Direito, normas, legislação e governo",
    "saude":      "Saúde, biologia e genética",
    "terra":      "Ciências da Terra, clima e espaço",
    "fisica":     "Física, química e materiais",
    "patrimonio": "Patrimônio cultural, história e arquivos",
    # id "antropologia" mantido por compatibilidade; o nome mudou em out/2026
    # (a área só tem Wikipédia e Wiktionary — referência, não antropologia).
    "antropologia": "Enciclopédias, dicionários e referência",
}


# ─── Taxonomia para os filtros da modal (out/2026) ───────────────────────────
# Fica aqui, num lugar só, em vez de espalhada pelos FONTE_META: é vocabulário
# de INTERFACE (como o usuário filtra e agrupa), não contrato da fonte.
#   regiao          "br" | "int"            → filtro Brasil / Internacional
#   tipos           chaves de TIPOS_CONTEUDO → filtro por tipo de conteúdo
#   instituicao     quem publica             → filtro por texto
#   grupo/variante  fontes da mesma instituição com recortes diferentes viram
#                   uma linha só na modal (ex.: Hugging Face → Modelos/Datasets/Papers)
TIPOS_CONTEUDO = {
    "artigos": "Artigos científicos", "teses": "Teses e dissertações",
    "relatorios": "Relatórios e documentos técnicos", "livros": "Livros e textos integrais",
    "didatico": "Material didático", "legislacao": "Legislação e atos normativos",
    "jurisprudencia": "Jurisprudência", "parlamento": "Projetos e debates legislativos",
    "noticias": "Notícias", "dados": "Conjuntos de dados", "codigo": "Código e modelos de IA",
    "referencia": "Enciclopédias e dicionários", "acervo": "Acervos de museus",
    "comunidade": "Perguntas e discussões", "clinico": "Ensaios clínicos e medicamentos",
}


def _t(regiao, instituicao, tipos, grupo="", variante=""):
    return {"regiao": regiao, "instituicao": instituicao, "tipos": tipos, "grupo": grupo, "variante": variante}


TAXONOMIA = {
    # geral
    "arxiv": _t("int", "arXiv (Cornell)", ["artigos"]),
    "openalex": _t("int", "OpenAlex", ["artigos"]),
    "datacite": _t("int", "DataCite", ["dados"]),
    "doaj": _t("int", "DOAJ", ["artigos"]),
    "zenodo": _t("int", "Zenodo (CERN/OpenAIRE)", ["dados", "artigos"]),
    "crossref": _t("int", "Crossref", ["artigos"]),
    "hal": _t("int", "HAL (França)", ["artigos"]),
    "open_library": _t("int", "Internet Archive", ["livros"]),
    "agencia_brasil": _t("br", "EBC", ["noticias"]),
    # tecnologia
    "github": _t("int", "GitHub", ["codigo"]),
    "gitlab": _t("int", "GitLab", ["codigo"]),
    "codeberg": _t("int", "Codeberg", ["codigo"]),
    "hf_modelos": _t("int", "Hugging Face", ["codigo"], "Hugging Face", "Modelos"),
    "hf_datasets": _t("int", "Hugging Face", ["dados"], "Hugging Face", "Datasets"),
    "hf_papers": _t("int", "Hugging Face", ["artigos"], "Hugging Face", "Papers"),
    "stackexchange": _t("int", "Stack Exchange", ["comunidade"]),
    "hacker_news": _t("int", "Y Combinator", ["comunidade"]),
    # economia
    "bcb": _t("br", "Banco Central do Brasil", ["dados"]),
    "ipea": _t("br", "IPEA", ["relatorios"]),
    "ibge_noticias": _t("br", "IBGE", ["noticias"]),
    "worldbank_wds": _t("int", "Banco Mundial", ["relatorios"]),
    # dados abertos
    "portais_br_federal": _t("br", "Governo federal", ["dados"], "Portais de dados abertos do Brasil", "Órgãos federais"),
    "portais_br_estados": _t("br", "Governos estaduais", ["dados"], "Portais de dados abertos do Brasil", "Estados"),
    "portais_br_municipios": _t("br", "Prefeituras", ["dados"], "Portais de dados abertos do Brasil", "Capitais"),
    "portais_internacionais": _t("int", "Governos nacionais", ["dados"], "Portais de dados abertos do exterior", "Vários países"),
    "data_europa_eu": _t("int", "União Europeia", ["dados"], "Portais de dados abertos do exterior", "União Europeia"),
    "data_gov_uk": _t("int", "Governo do Reino Unido", ["dados"], "Portais de dados abertos do exterior", "Reino Unido"),
    # educação
    "bdtd": _t("br", "IBICT", ["teses"], "IBICT", "Teses e dissertações (BDTD)"),
    "oasisbr": _t("br", "IBICT", ["artigos"], "IBICT", "Artigos em acesso aberto (OasisBR)"),
    "capes_teses": _t("br", "CAPES", ["teses"], "CAPES", "Catálogo de Teses"),
    "educapes": _t("br", "CAPES", ["didatico"], "CAPES", "EduCAPES"),
    "wikilivros_pt": _t("br", "Wikimedia", ["didatico"], "Wikimedia em português", "Wikilivros"),
    "wikiversidade_pt": _t("br", "Wikimedia", ["didatico"], "Wikimedia em português", "Wikiversidade"),
    "eric": _t("int", "Departamento de Educação dos EUA", ["artigos"]),
    # direito, legislação e governo
    "camara": _t("br", "Câmara dos Deputados", ["parlamento"], "Câmara dos Deputados", "Proposições"),
    "camara_discursos": _t("br", "Câmara dos Deputados", ["parlamento"], "Câmara dos Deputados", "Discursos"),
    "senado_leis": _t("br", "Senado Federal", ["legislacao"], "Senado Federal", "Leis federais"),
    "senado_materias": _t("br", "Senado Federal", ["parlamento"], "Senado Federal", "Projetos e matérias"),
    "senado_discursos": _t("br", "Senado Federal", ["parlamento"], "Senado Federal", "Discursos"),
    "stf": _t("br", "Supremo Tribunal Federal", ["jurisprudencia"], "Tribunais e controle", "STF"),
    "tcu": _t("br", "Tribunal de Contas da União", ["jurisprudencia"], "Tribunais e controle", "TCU"),
    "tst": _t("br", "Tribunal Superior do Trabalho", ["jurisprudencia"], "Tribunais e controle", "TST"),
    "govbr_noticias": _t("br", "Portais gov.br", ["noticias"]),
    "almg": _t("br", "Assembleia Legislativa de Minas Gerais", ["parlamento"]),
    "federal_register": _t("int", "Governo dos EUA", ["legislacao"]),
    # saúde
    "bvs_ms": _t("br", "Ministério da Saúde", ["relatorios"]),
    "anvisalegis": _t("br", "ANVISA", ["legislacao"]),
    "fiocruz_arca": _t("br", "Fiocruz", ["artigos", "teses"]),
    "inca": _t("br", "INCA", ["relatorios"]),
    "unasus_ares": _t("br", "UNA-SUS", ["didatico"]),
    "paho_iris": _t("int", "OPAS", ["relatorios"], "OMS e OPAS (IRIS)", "OPAS"),
    "who_iris": _t("int", "OMS", ["relatorios"], "OMS e OPAS (IRIS)", "OMS"),
    "pubmed": _t("int", "NIH/NLM (EUA)", ["artigos"], "NIH/NLM (EUA)", "PubMed"),
    "clinicaltrials": _t("int", "NIH/NLM (EUA)", ["clinico"], "NIH/NLM (EUA)", "ClinicalTrials.gov"),
    "uniprot": _t("int", "UniProt", ["dados"]),
    "europepmc": _t("int", "EMBL-EBI", ["artigos"]),
    "openfda": _t("int", "FDA (EUA)", ["clinico"]),
    # ciências da Terra
    "nasa_cmr": _t("int", "NASA", ["dados"], "NASA", "Earthdata (dados de satélite)"),
    "nasa_ntrs": _t("int", "NASA", ["relatorios"], "NASA", "Relatórios técnicos (NTRS)"),
    "usgs_pubs": _t("int", "Serviço Geológico dos EUA", ["relatorios"]),
    # física
    "cern_opendata": _t("int", "CERN", ["dados"]),
    "osti": _t("int", "Departamento de Energia dos EUA", ["relatorios"]),
    "inspire_hep": _t("int", "INSPIRE (CERN, DESY, Fermilab, SLAC)", ["artigos"]),
    # patrimônio
    "wikisource_pt": _t("br", "Wikimedia", ["livros"]),
    "art_institute_chicago": _t("int", "Art Institute of Chicago", ["acervo"]),
    "the_met": _t("int", "The Metropolitan Museum of Art", ["acervo"]),
    "cleveland_art": _t("int", "Cleveland Museum of Art", ["acervo"]),
    "gutenberg": _t("int", "Project Gutenberg", ["livros"]),
    # referência
    "wikipedia": _t("br", "Wikimedia", ["referencia"], "Wikimedia em português", "Wikipédia"),
    "wiktionary": _t("int", "Wikimedia", ["referencia"], "Wikimedia em português", "Wiktionary"),
}


def listar_fontes() -> dict:
    """Retorna {area_id: {"nome": ..., "fontes": [FONTE_META + taxonomia, ...]}}.
    Devolve cópias (nunca muta o FONTE_META do módulo) com os campos de
    TAXONOMIA usados pelos filtros da modal."""
    areas = {}
    for m in _MODULOS:
        area_id = m.FONTE_META["area"]
        area = areas.setdefault(area_id, {"nome": AREAS_META.get(area_id, area_id), "fontes": [], "tipos": {}})
        meta = {**m.FONTE_META, **TAXONOMIA.get(m.FONTE_META["id"], {})}
        area["fontes"].append(meta)
        # rótulos só dos tipos presentes na área — o front monta os chips de filtro daqui
        for tipo in meta.get("tipos", []):
            area["tipos"][tipo] = TIPOS_CONTEUDO.get(tipo, tipo)
    return areas


def listar_tipos_conteudo() -> dict:
    return dict(TIPOS_CONTEUDO)


def obter_fonte(fonte_id: str):
    return FONTES.get(fonte_id)
