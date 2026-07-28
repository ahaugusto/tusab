# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do leitor de página web avulsa (motor/web_scraper.py) e do endpoint
POST /neural/url. Extração via trafilatura (Apache-2.0). Sem chamada de rede
real — requests e trafilatura são mockados nos testes de módulo.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import web_scraper


# ─── Módulo — robots.txt ────────────────────────────────────────────────────

def test_permitido_por_robots_quando_robots_txt_ausente(monkeypatch):
    """Sem robots.txt acessível, trata como permitido — mesmo default do RobotFileParser."""
    class _RpFalhaLeitura:
        def set_url(self, url): pass
        def read(self): raise Exception("connection refused")

    with patch.object(web_scraper.urllib.robotparser, "RobotFileParser", return_value=_RpFalhaLeitura()):
        assert web_scraper._permitido_por_robots("https://exemplo.com/pagina") is True


def test_bloqueado_por_robots_respeitado():
    mock_rp = MagicMock()
    mock_rp.can_fetch.return_value = False
    with patch.object(web_scraper.urllib.robotparser, "RobotFileParser", return_value=mock_rp):
        assert web_scraper._permitido_por_robots("https://exemplo.com/bloqueada") is False


# ─── Módulo — extrair_pagina ────────────────────────────────────────────────

def test_extrair_pagina_levanta_erro_quando_bloqueado_por_robots():
    import pytest
    with patch.object(web_scraper, "_permitido_por_robots", return_value=False):
        with pytest.raises(web_scraper.RobotsBloqueadoError):
            web_scraper.extrair_pagina("https://exemplo.com/bloqueada")


def test_extrair_pagina_levanta_erro_quando_extracao_vazia():
    import pytest
    mock_resp = MagicMock(text="<html></html>", url="https://exemplo.com/vazia")
    mock_resp.raise_for_status = MagicMock()
    mock_doc = MagicMock(text="")

    with patch.object(web_scraper, "_permitido_por_robots", return_value=True), \
         patch.object(web_scraper.requests, "get", return_value=mock_resp), \
         patch.object(web_scraper.trafilatura, "bare_extraction", return_value=mock_doc):
        with pytest.raises(web_scraper.ExtracaoVaziaError):
            web_scraper.extrair_pagina("https://exemplo.com/vazia")


def test_extrair_pagina_retorna_titulo_texto_e_url():
    mock_resp = MagicMock(text="<html>...</html>", url="https://exemplo.com/artigo")
    mock_resp.raise_for_status = MagicMock()
    mock_doc = MagicMock(text="Conteúdo real extraído.", title="Título do Artigo", hostname="exemplo.com")

    with patch.object(web_scraper, "_permitido_por_robots", return_value=True), \
         patch.object(web_scraper.requests, "get", return_value=mock_resp), \
         patch.object(web_scraper.trafilatura, "bare_extraction", return_value=mock_doc):
        resultado = web_scraper.extrair_pagina("https://exemplo.com/artigo")

    assert resultado["titulo"] == "Título do Artigo"
    assert resultado["texto"] == "Conteúdo real extraído."
    assert resultado["url"] == "https://exemplo.com/artigo"


def test_extrair_pagina_usa_hostname_quando_sem_titulo():
    mock_resp = MagicMock(text="<html>...</html>", url="https://exemplo.com/artigo")
    mock_resp.raise_for_status = MagicMock()
    mock_doc = MagicMock(text="Conteúdo real.", title=None, hostname="exemplo.com")

    with patch.object(web_scraper, "_permitido_por_robots", return_value=True), \
         patch.object(web_scraper.requests, "get", return_value=mock_resp), \
         patch.object(web_scraper.trafilatura, "bare_extraction", return_value=mock_doc):
        resultado = web_scraper.extrair_pagina("https://exemplo.com/artigo")

    assert resultado["titulo"] == "exemplo.com"


# ─── Endpoint /neural/url ────────────────────────────────────────────────────

def test_url_rejeita_sem_projeto(client):
    r = client.post("/neural/url", json={"url": "https://exemplo.com", "canal": "projeto_inexistente_xyz"})
    assert r.status_code == 200
    assert r.json().get("error") is True


def test_url_rejeita_formato_invalido(client):
    nome_projeto = "projeto_url_pytest"
    client.post("/neural/projeto", json={"nome": nome_projeto})
    r = client.post("/neural/url", json={"url": "não é uma url", "canal": nome_projeto})
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True
    assert "válida" in body.get("message", "")


def test_url_salva_documento_e_manifest(client, tmp_path, monkeypatch):
    from tusab_engine.api import router_repositorio

    nome_projeto = "projeto_url_ok_pytest"
    client.post("/neural/projeto", json={"nome": nome_projeto})

    with patch.object(
        router_repositorio.web_scraper, "extrair_pagina",
        return_value={"titulo": "Artigo de Teste", "texto": "Conteúdo real extraído da página.", "url": "https://exemplo.com/artigo", "hostname": "exemplo.com"},
    ):
        r = client.post("/neural/url", json={"url": "https://exemplo.com/artigo", "canal": nome_projeto})

    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
    assert body.get("titulo") == "Artigo de Teste"

    repo = client.get("/repositorio").json()
    canal = next(c for c in repo["canais"] if c["nome"] == nome_projeto)
    doc = next(d for d in canal["documentos"] if d["nome_original"] == "Artigo de Teste")
    assert doc["fonte_externa"] == "web"


def test_url_propaga_erro_de_robots_bloqueado(client):
    from tusab_engine.api import router_repositorio

    nome_projeto = "projeto_url_robots_pytest"
    client.post("/neural/projeto", json={"nome": nome_projeto})

    with patch.object(
        router_repositorio.web_scraper, "extrair_pagina",
        side_effect=router_repositorio.web_scraper.RobotsBloqueadoError("robots.txt de exemplo.com não permite acesso."),
    ):
        r = client.post("/neural/url", json={"url": "https://exemplo.com/bloqueada", "canal": nome_projeto})

    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True
    assert "robots.txt" in body.get("message", "")
