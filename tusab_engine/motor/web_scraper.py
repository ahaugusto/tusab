# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Leitor de página web avulsa, para o Repositório (qualquer perfil).

Extração de conteúdo principal via trafilatura (Adrien Barbaresi,
licença Apache-2.0) — biblioteca open-source de extração de texto de páginas
web, amplamente usada em pipelines de NLP/pesquisa (inclusive nos datasets do
Common Crawl). Ver CHANGELOG.md e https://github.com/adbar/trafilatura.

Avaliado em `agents/_historia.md` junto com Anakin-Inc (rejeitado — AGPL-3.0
incompatível com a edição Enterprise + evasão de bot deliberada) e Crawl4AI
(mais robusto pra páginas com JavaScript, mas exige browser headless —
candidato futuro se trafilatura sozinho não bastar). Escopo deliberado desta
implementação: só páginas estáticas (HTML servido de cara) — sem browser
headless, sem bypass de proteção anti-bot. Respeita robots.txt antes de
buscar, sempre.

Diferente do registro de fontes em motor/fontes/ (busca por tema em várias
fontes por área de conhecimento), aqui o usuário já sabe a URL exata que quer
trazer pra base — mesma lógica de "colar texto" (POST /neural/texto), só que
o texto vem de uma página em vez de ser digitado.
"""

import urllib.robotparser
from urllib.parse import urlparse

import requests
import trafilatura

USER_AGENT = "TusabBot/1.0 (+local personal knowledge tool; respects robots.txt)"


class RobotsBloqueadoError(Exception):
    """A URL está bloqueada por robots.txt para o nosso user-agent."""


class ExtracaoVaziaError(Exception):
    """trafilatura não conseguiu extrair conteúdo principal da página."""


def _permitido_por_robots(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        # robots.txt inacessível/inexistente — mesmo comportamento padrão do
        # RobotFileParser quando não há regras: trata como permitido.
        return True
    return rp.can_fetch(USER_AGENT, url)


def extrair_pagina(url: str) -> dict:
    """Busca uma URL e extrai o conteúdo principal como texto pesquisável.

    Retorna {titulo, texto, url, hostname}. Levanta RobotsBloqueadoError ou
    ExtracaoVaziaError quando não é possível trazer conteúdo real — o
    chamador decide como comunicar isso ao usuário (mesmo padrão de
    aviso_extracao usado em cerebro_upload(), router_repositorio.py).
    """
    if not _permitido_por_robots(url):
        raise RobotsBloqueadoError(
            f"robots.txt de {urlparse(url).netloc} não permite acesso automatizado a esta página."
        )

    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=(10, 30))
    resp.raise_for_status()

    doc = trafilatura.bare_extraction(
        resp.text, url=resp.url, favor_recall=True,
        with_metadata=True, include_comments=False,
    )
    if not doc or not (doc.text or "").strip():
        raise ExtracaoVaziaError(
            "Não foi possível extrair conteúdo legível desta página — pode exigir "
            "JavaScript para renderizar (não suportado nesta versão)."
        )

    titulo = doc.title or doc.hostname or urlparse(resp.url).netloc
    return {"titulo": titulo, "texto": doc.text, "url": resp.url, "hostname": doc.hostname or ""}
