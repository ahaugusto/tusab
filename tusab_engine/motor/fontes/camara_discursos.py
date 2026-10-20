# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Câmara dos Deputados — discursos em Plenário (notas
taquigráficas do DETAQ, sistema SitaqWeb). Sem chave de API e SEM API: é
raspagem de páginas ASP clássicas. Diferente de camara.py (proposições).

Endpoints (https://www.camara.leg.br/internet/sitaqweb/):
  - busca: GET resultadoPesquisaDiscursos.asp?txTexto=<termo>&dtInicio=<dd/mm/aaaa>
    &dtFim=<dd/mm/aaaa>&BasePesq=plenario&CampoOrdenacao=dtSessao&TipoOrdenacao=DESC
    &PageSize=<n> → tabela HTML; cada linha tem data, sessão, fase, link
    "TextoHTML.asp?etapa=5&nuDiscurso=..&nuSessao=..&nuQuarto=..&..." (quebrado
    em várias linhas com tabulação dentro do href), orador e publicação; a
    linha seguinte (id="SumaN") traz o sumário, às vezes vazio;
  - íntegra: GET TextoHTML.asp?<os mesmos parâmetros> → página pequena (~8–14 KB),
    sem <body>, com cabeçalho "CÂMARA DOS DEPUTADOS - DETAQ" (sessão, fase,
    orador, data) e o discurso em <p class="principalStyle"> (taquigrafia) ou
    <p class="DISCURSO">/"Normal--Web-" (discurso encaminhado por escrito).

Achados do teste ao vivo (20/out/2026) — por que é a fonte mais frágil:
  - User-Agent "TusabBot" leva HTTP 429 na hora (bloqueio por UA, não por
    volume: o UA padrão do python-requests e o de navegador passam). Usamos
    HEADERS_NAVEGADOR.
  - O índice de texto é SEM acento e a página é ISO-8859-1: "saúde" → 0
    resultados (qualquer codificação), "saude" → 1.565; "vacinação" em UTF-8
    → "Nenhum discurso encontrado". Por isso tiramos os acentos do termo.
  - Duas palavras separadas por espaço dão "Não foi possível realizar a
    pesquisa. Favor verificar os padrões de busca." — a sintaxe exige
    operador: "saude and mental" → 107 discursos. Montamos "<p1> and <p2>"
    com as palavras de 3+ letras (sem artigos/preposições).
  - Os parâmetros do link TextoHTML.asp vêm com espaço e acento crus
    (txFaseSessao=Breves Comunicações); recodificamos em percent-encoding
    Latin-1 (UTF-8 devolve a mesma página — o servidor ignora esses campos).
  - A página da íntegra declara charset utf-8 no <meta>, mas o header HTTP
    não diz nada (requests assume ISO-8859-1) e o <title> já vem com "�"
    gravado; decodificamos os bytes como UTF-8, descartamos <title> e
    comentários e ancoramos o texto no cabeçalho DETAQ.
  - Período padrão: último ano. Com data_inicio/data_fim do usuário, usa o
    período informado.

Mudança de layout (tabela sem links mas com "TotalRecords", ou íntegra sem o
corpo do discurso) vira RuntimeError com mensagem clara — nunca gravamos o
menu do portal como se fosse discurso.
"""

import html
import os
import re
import time
import unicodedata
from datetime import date, datetime, timedelta
from urllib.parse import urlencode

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_NAVEGADOR, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    html_para_texto, resultado_vazio,
)

FONTE_META = {
    "id": "camara_discursos",
    "nome": "Câmara dos Deputados — Discursos em Plenário",
    "area": "direito",
    "descricao": "Discursos de deputados federais em Plenário — texto integral das notas taquigráficas.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

BASE = "https://www.camara.leg.br/internet/sitaqweb/"
SEARCH_URL = BASE + "resultadoPesquisaDiscursos.asp"
_HEADERS = dict(HEADERS_NAVEGADOR, Accept="text/html,application/xhtml+xml,*/*;q=0.8")
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_ERRO_LAYOUT = "SitaqWeb (Câmara) mudou o formato da página de resultados — a busca precisa ser atualizada no Tusab"

_PALAVRAS_VAZIAS = {
    "que", "para", "com", "dos", "das", "nos", "nas", "uma", "por", "pelo", "pela",
    "the", "and", "not", "near", "sem", "sob", "entre", "sobre",
}
_RE_LINHA = re.compile(r'<tr class="(?:even|odd)"\s*>(.*?)</tr>', re.DOTALL)
_RE_SUMARIO = re.compile(r'<tr class="(?:even|odd)"[^>]*id="Suma\d+"[^>]*>\s*<td[^>]*class="Sumario"[^>]*>(.*?)</td>', re.DOTALL)
_RE_TD = re.compile(r"<td\b[^>]*>(.*?)</td>", re.DOTALL)
_RE_LINK = re.compile(r'href="(TextoHTML\.asp\?[^"]*)"', re.DOTALL)
_RE_TOTAL = re.compile(r'name="TotalRecords"\s+value="(\d+)"')
_RE_TITLE = re.compile(r"<title\b[^>]*>.*?</title>", re.IGNORECASE | re.DOTALL)
_RE_COMENTARIO = re.compile(r"<!--.*?-->", re.DOTALL)
_RE_COMENTARIO_MALFORMADO = re.compile(r"<![^>]*>")  # "<! comentei o código ... -->" da página
_RE_DATA_CABECALHO = re.compile(r"Data:\s*\d{2}/\d{2}/\d{4}")


def _sem_acento(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def montar_expressao(query: str) -> str:
    """'saúde mental no SUS' → 'saude and mental and SUS' (ver docstring)."""
    palavras = re.findall(r"\w+", _sem_acento(query))
    uteis = [p for p in palavras if len(p) >= 3 and p.lower() not in _PALAVRAS_VAZIAS]
    uteis = uteis or [p for p in palavras if len(p) >= 2]
    return " and ".join(dict.fromkeys(uteis))


def _para_latin1(valor: str) -> str:
    try:
        valor.encode("latin-1")
        return valor
    except UnicodeEncodeError:
        return _sem_acento(valor).encode("latin-1", "ignore").decode("latin-1")


def url_texto(href: str) -> str:
    """Link cru da tabela (com quebras de linha, &amp;, espaço e acento) →
    URL absoluta com os parâmetros recodificados."""
    consulta = html.unescape(href).split("?", 1)[1]
    pares = []
    for parte in consulta.split("&"):
        parte = parte.strip()
        if "=" in parte:
            chave, valor = parte.split("=", 1)
            pares.append((chave.strip(), _para_latin1(valor.strip())))
    return BASE + "TextoHTML.asp?" + urlencode(pares, encoding="latin-1")


def parse_resultados(pagina: str) -> list:
    """Tabela de resultados → [{data, sessao, fase, orador, sumario, url}]."""
    sumarios = [html_para_texto(s) for s in _RE_SUMARIO.findall(pagina)]
    itens = []
    for linha in _RE_LINHA.findall(pagina):
        m_link = _RE_LINK.search(linha)
        if not m_link:
            continue
        tds = _RE_TD.findall(linha)
        if len(tds) < 6:
            raise RuntimeError(_ERRO_LAYOUT + " (colunas da tabela mudaram)")
        itens.append({
            "data": html_para_texto(tds[0]),
            "sessao": html_para_texto(tds[1]),
            "fase": html_para_texto(tds[2]).capitalize(),
            "orador": html_para_texto(tds[5]),
            "sumario": "",
            "url": url_texto(m_link.group(1)),
        })
    if len(sumarios) == len(itens):
        for item, sumario in zip(itens, sumarios):
            item["sumario"] = sumario
    m_total = _RE_TOTAL.search(pagina)
    if not itens and m_total and int(m_total.group(1)) > 0:
        raise RuntimeError(_ERRO_LAYOUT + " (há resultados, mas nenhum link de discurso foi reconhecido)")
    if not itens and not m_total and "Nenhum discurso encontrado" not in pagina:
        if "verificar os padr" in pagina:
            raise RuntimeError("SitaqWeb (Câmara) recusou a expressão de busca — tente termos mais simples")
        raise RuntimeError(_ERRO_LAYOUT)
    return itens


def extrair_discurso(conteudo: bytes) -> str:
    """Página TextoHTML.asp → cabeçalho DETAQ (sessão, fase, orador, data) +
    texto do discurso. A página não tem <body> e o corpo usa classes
    diferentes conforme a origem (principalStyle na taquigrafia, DISCURSO /
    Normal--Web- no "discurso encaminhado"), então a âncora é o cabeçalho
    "CÂMARA DOS DEPUTADOS - DETAQ" … "Data: dd/mm/aaaa" seguido do texto."""
    pagina = conteudo.decode("utf-8", errors="replace")
    pagina = _RE_TITLE.sub(" ", pagina)
    pagina = _RE_COMENTARIO.sub(" ", pagina)
    pagina = _RE_COMENTARIO_MALFORMADO.sub(" ", pagina)
    texto = html_para_texto(pagina).replace("�", "")
    ini = texto.find("DETAQ")
    m_data = _RE_DATA_CABECALHO.search(texto, ini if ini >= 0 else 0)
    if ini < 0 or not m_data or len(texto[m_data.end():].strip()) < 50:
        raise RuntimeError("SitaqWeb (Câmara) mudou o formato da página do discurso (corpo não encontrado)")
    return texto[texto.rfind("\n", 0, ini) + 1:]


def _periodo(data_inicio: str, data_fim: str) -> tuple:
    fim = datetime.strptime(data_fim, "%Y-%m-%d").date() if data_fim else date.today()
    inicio = datetime.strptime(data_inicio, "%Y-%m-%d").date() if data_inicio else fim - timedelta(days=365)
    if inicio > fim:
        raise ValueError("Data inicial posterior à data final.")
    return inicio.strftime("%d/%m/%Y"), fim.strftime("%d/%m/%Y")


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    expressao = montar_expressao(query)
    if not expressao:
        return resultado_vazio()

    dt_ini, dt_fim = _periodo(data_inicio, data_fim)
    params = {
        "txTexto": expressao, "dtInicio": dt_ini, "dtFim": dt_fim, "BasePesq": "plenario",
        "CampoOrdenacao": "dtSessao", "TipoOrdenacao": "DESC", "PageSize": max_resultados,
    }
    resp = requests.get(SEARCH_URL + "?" + urlencode(params, encoding="latin-1"), headers=_HEADERS, timeout=_TIMEOUT)
    resp.raise_for_status()
    itens = parse_resultados(resp.content.decode("utf-8", errors="replace"))[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        time.sleep(1.0)  # servidor sensível a rajadas (ver docstring)
        r = requests.get(item["url"], headers=_HEADERS, timeout=_TIMEOUT)
        r.raise_for_status()
        discurso = extrair_discurso(r.content)
        partes = [f"Sumário: {item['sumario']}"] if item["sumario"] else []
        partes.append(f"--- TEXTO INTEGRAL ---\n\n{discurso}")
        titulo = " — ".join(x for x in (item["orador"], item["data"], item["fase"]) if x) or "Discurso"
        return {"titulo": titulo, "texto": "\n\n".join(partes)[:_MAX_CHARS], "url_origem": item["url"]}

    return executar_busca_generica(
        itens, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
