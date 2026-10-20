# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Senado Federal — discursos (pronunciamentos) em Plenário,
com o texto integral das notas taquigráficas. Sem chave de API. Diferente de
senado_leis.py (normas publicadas): aqui é o debate parlamentar.

Endpoints (Dados Abertos do Senado):
  - GET https://legis.senado.leg.br/dadosabertos/plenario/lista/discursos/<AAAAMMDD>/<AAAAMMDD>
    com Accept: application/json → {"DiscursosSessao": {"Sessoes": {"Sessao":
    [{..., "Pronunciamentos": {"Pronunciamento": [{CodigoPronunciamento,
    Data, Resumo, Indexacao, NomeAutor, TipoAutor, Partido, UF, ...}]}}]}}};
  - GET https://legis.senado.leg.br/dadosabertos/discurso/texto-integral/<CodigoPronunciamento>
    → text/plain UTF-8 com a íntegra.

Achados do teste ao vivo (20/out/2026):
  - NÃO há busca por palavra no servidor — só lista por período, e o período
    máximo é 1 mês (01/31 → 02/28 passa; 01/31 → 03/02 dá HTTP 400 "Período
    máximo de 1 mês"). Por isso varremos janelas de 1 mês, da mais recente
    para a mais antiga, e paramos assim que juntamos resultados suficientes.
  - Período padrão: últimos 3 meses (até 3 chamadas). Com data_inicio/
    data_fim do usuário, limitado a 12 meses (até 12 chamadas).
  - Um mês típico tem ~180–350 pronunciamentos (~350 KB de JSON).
  - Filtro local nos campos Resumo + Indexacao: todas as palavras
    significativas do termo (4+ letras; se não houver nenhuma, as de 2+, para
    siglas como "SUS"), sem acento/caixa, casando no início de palavra
    ("vacina" acha "vacinação").
  - Sessao/Pronunciamento vêm como objeto quando há um só (conversão XML→JSON).
  - Mês sem sessão: "Sessoes": null.

LGPD: nome, partido e UF do orador entram no título quando é parlamentar
(agente público no exercício do mandato; o discurso é ato público). Para
autor externo (convidado em sessão especial), o título usa só "Autor
externo" — o nome dele continua na íntegra taquigráfica, que é publicação
oficial do Senado.

Por que é frágil: depende da estrutura JSON acima e do limite de período,
que o Senado já mudou antes (ver senado_leis.py). Estrutura inesperada vira
RuntimeError com mensagem clara.
"""

import os
import re
import time
import unicodedata
from datetime import date, datetime, timedelta

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, resultado_vazio,
)

FONTE_META = {
    "id": "senado_discursos",
    "nome": "Senado Federal — Discursos em Plenário",
    "area": "direito",
    "descricao": "Pronunciamentos de senadores em Plenário — texto integral das notas taquigráficas.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

LISTA_URL = "https://legis.senado.leg.br/dadosabertos/plenario/lista/discursos/{ini}/{fim}"
TEXTO_URL = "https://legis.senado.leg.br/dadosabertos/discurso/texto-integral/{codigo}"
_TIMEOUT = (10, 30)
_MAX_CHARS = 200_000
_MESES_PADRAO = 3
_MESES_MAXIMO = 12
_ERRO_FORMATO = "Dados Abertos do Senado mudou o formato da lista de discursos — a busca precisa ser atualizada no Tusab"


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in sem_acento if not unicodedata.combining(c)).lower()


def termos_significativos(query: str) -> list:
    palavras = re.findall(r"\w+", _normalizar(query))
    longas = [p for p in palavras if len(p) >= 4]
    return longas or [p for p in palavras if len(p) >= 2]


def casa_termos(termos: list, texto: str) -> bool:
    """Palavras de 4+ letras casam no início de palavra ("vacina" acha
    "vacinação"); siglas curtas só como palavra inteira ("sus" não acha
    "suscitada")."""
    alvo = _normalizar(texto)
    return all(
        re.search(r"\b" + re.escape(t) + (r"" if len(t) >= 4 else r"\b"), alvo)
        for t in termos
    )


def _menos_um_mes(d: date) -> date:
    """Mesmo dia do mês anterior (dia ajustado ao fim do mês se preciso)."""
    ano, mes = (d.year, d.month - 1) if d.month > 1 else (d.year - 1, 12)
    for dia in (d.day, 30, 29, 28):
        try:
            return date(ano, mes, dia)
        except ValueError:
            continue
    return date(ano, mes, 28)


def janelas_mensais(inicio: date, fim: date) -> list:
    """[(ini, fim)] de até 1 mês cada, da mais recente para a mais antiga."""
    janelas = []
    atual_fim = fim
    while atual_fim >= inicio and len(janelas) < _MESES_MAXIMO:
        atual_ini = max(_menos_um_mes(atual_fim) + timedelta(days=1), inicio)
        janelas.append((atual_ini, atual_fim))
        atual_fim = atual_ini - timedelta(days=1)
    return janelas


def _periodo(data_inicio: str, data_fim: str) -> tuple:
    hoje = date.today()
    fim = datetime.strptime(data_fim, "%Y-%m-%d").date() if data_fim else hoje
    fim = min(fim, hoje)
    if data_inicio:
        inicio = datetime.strptime(data_inicio, "%Y-%m-%d").date()
    else:
        inicio = fim
        for _ in range(_MESES_PADRAO):
            inicio = _menos_um_mes(inicio)
        inicio += timedelta(days=1)
    if inicio > fim:
        raise ValueError("Data inicial posterior à data final.")
    return inicio, fim


def _como_lista(valor) -> list:
    if valor is None:
        return []
    return valor if isinstance(valor, list) else [valor]


def pronunciamentos_do_json(dados) -> list:
    if not isinstance(dados, dict) or "DiscursosSessao" not in dados:
        raise RuntimeError(_ERRO_FORMATO)
    sessoes = (dados["DiscursosSessao"] or {}).get("Sessoes")
    if sessoes is None:
        return []  # período sem sessões
    if not isinstance(sessoes, dict) or "Sessao" not in sessoes:
        raise RuntimeError(_ERRO_FORMATO)
    pronunciamentos = []
    for sessao in _como_lista(sessoes.get("Sessao")):
        for p in _como_lista((sessao.get("Pronunciamentos") or {}).get("Pronunciamento")):
            if not p.get("CodigoPronunciamento"):
                raise RuntimeError(_ERRO_FORMATO)
            pronunciamentos.append(p)
    return pronunciamentos


def titulo_pronunciamento(p: dict) -> str:
    if "senador" in (p.get("TipoAutor") or "").lower():
        orador = p.get("NomeAutor") or "Senador(a)"
        filiacao = "/".join(x for x in (p.get("Partido"), p.get("UF")) if x)
        if filiacao:
            orador += f" ({filiacao})"
    else:
        orador = "Autor externo"
    data_br = ""
    if p.get("Data"):
        try:
            data_br = datetime.strptime(p["Data"], "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            data_br = p["Data"]
    resumo = re.sub(r"\s+", " ", p.get("Resumo") or "").strip()
    resumo_curto = (resumo[:90].rsplit(" ", 1)[0] + "…") if len(resumo) > 90 else resumo
    return " — ".join(x for x in (orador, data_br, resumo_curto) if x)


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")
    termos = termos_significativos(query)
    if not termos:
        return resultado_vazio()

    inicio, fim = _periodo(data_inicio, data_fim)
    cabecalho = dict(HEADERS_TUSABBOT, Accept="application/json")
    candidatos = []
    for i, (ini, fim_janela) in enumerate(janelas_mensais(inicio, fim)):
        if evento_cancelar is not None and evento_cancelar.is_set():
            break
        if i:
            time.sleep(0.5)
        resp = requests.get(
            LISTA_URL.format(ini=ini.strftime("%Y%m%d"), fim=fim_janela.strftime("%Y%m%d")),
            headers=cabecalho, timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        achados = [
            p for p in pronunciamentos_do_json(exigir_json(resp, FONTE_META["nome"]))
            if casa_termos(termos, f"{p.get('Resumo', '')} {p.get('Indexacao', '')}")
        ]
        achados.sort(key=lambda p: p.get("Data", ""), reverse=True)
        candidatos.extend(achados)
        if len(candidatos) >= max_resultados:
            break

    candidatos = candidatos[:max_resultados]
    if not candidatos:
        return resultado_vazio()

    def extrair(p):
        time.sleep(0.5)
        r = requests.get(TEXTO_URL.format(codigo=p["CodigoPronunciamento"]), headers=HEADERS_TUSABBOT, timeout=_TIMEOUT)
        r.raise_for_status()
        r.encoding = "utf-8"
        if "html" in r.headers.get("Content-Type", "").lower():
            raise RuntimeError("Senado devolveu HTML no lugar do texto integral do discurso")
        integra = re.sub(r"\n{3,}", "\n\n", "\n".join(l.strip() for l in r.text.splitlines())).strip()
        resumo = (p.get("Resumo") or "").strip()
        if not integra and not resumo:
            return None
        partes = [f"Resumo: {resumo}"] if resumo else []
        if p.get("Indexacao"):
            partes.append(f"Indexação: {p['Indexacao'].strip()}")
        if integra:
            partes.append(f"--- TEXTO INTEGRAL ---\n\n{integra}")
        return {
            "titulo": titulo_pronunciamento(p),
            "texto": "\n\n".join(partes)[:_MAX_CHARS],
            "url_origem": p.get("TextoIntegral") or TEXTO_URL.format(codigo=p["CodigoPronunciamento"]),
        }

    return executar_busca_generica(
        candidatos, extrair, FONTE_META["id"], doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
