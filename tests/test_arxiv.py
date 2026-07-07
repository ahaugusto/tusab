# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da busca acadêmica no arXiv (perfil Pesquisador).
Sem chamada de rede real — requests é mockado.
"""
from unittest.mock import patch, MagicMock

from tusab_engine.motor import arxiv as arxiv_motor


# ─── Endpoint ──────────────────────────────────────────────────────────────────

def test_arxiv_search_rejeita_sem_projeto(client):
    r = client.post("/arxiv/search", json={"query": "transformers", "projeto_nome": "projeto_inexistente_xyz"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True


def test_arxiv_search_rejeita_query_curta(client):
    r = client.post("/arxiv/search", json={"query": "a", "projeto_nome": "qualquer"})
    assert r.status_code == 422  # Pydantic Field(min_length=2)


def test_arxiv_status_retorna_estrutura(client):
    r = client.get("/arxiv/status")
    assert r.status_code == 200
    body = r.json()
    assert "running" in body
    assert "status" in body


# ─── Módulo (mockado, sem rede) ────────────────────────────────────────────────

_ATOM_FEED_MOCK = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>Attention Is All You Need Again</title>
    <summary>A follow-up study on transformer attention mechanisms.</summary>
    <published>2024-01-15T00:00:00Z</published>
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" rel="related"/>
  </entry>
</feed>
"""


def test_parsear_entradas_extrai_campos_esperados():
    entradas = arxiv_motor._parsear_entradas(_ATOM_FEED_MOCK)
    assert len(entradas) == 1
    assert entradas[0]["id"] == "http://arxiv.org/abs/2401.12345v1"
    assert entradas[0]["titulo"] == "Attention Is All You Need Again"
    assert entradas[0]["pdf_url"] == "http://arxiv.org/pdf/2401.12345v1"


def test_buscar_arxiv_salva_documento_e_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(arxiv_motor, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(arxiv_motor, "_INTERVALO_ENTRE_REQUISICOES", 0)

    mock_search_resp = MagicMock(content=_ATOM_FEED_MOCK)
    mock_search_resp.raise_for_status = MagicMock()

    mock_pdf_resp = MagicMock(content=b"%PDF-fake-content")
    mock_pdf_resp.raise_for_status = MagicMock()

    with patch.object(arxiv_motor.requests, "get", side_effect=[mock_search_resp, mock_pdf_resp]), \
         patch.object(arxiv_motor, "_extrair_texto_pdf", return_value="Texto extraído do paper de teste."):
        resultado = arxiv_motor.buscar_arxiv(
            query="transformers",
            max_resultados=5,
            projeto_nome="projeto_teste_arxiv",
        )

    assert resultado["ok"] is True
    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 1
    assert resultado["erros"] == []

    doc_dir = tmp_path / "projeto_teste_arxiv" / "documents"
    manifest_path = doc_dir / "_manifest.json"
    assert manifest_path.exists()

    import json
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert len(manifest) == 1
    assert manifest[0]["fonte_externa"] == "arxiv"

    txt_files = list(doc_dir.glob("*.txt"))
    assert len(txt_files) == 1
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "FONTE: arxiv" in conteudo
    assert "Texto extraído do paper de teste." in conteudo


def test_buscar_arxiv_continua_apos_erro_em_um_paper(tmp_path, monkeypatch):
    """Um paper que falha no download não derruba o lote inteiro."""
    monkeypatch.setattr(arxiv_motor, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(arxiv_motor, "_INTERVALO_ENTRE_REQUISICOES", 0)

    mock_search_resp = MagicMock(content=_ATOM_FEED_MOCK)
    mock_search_resp.raise_for_status = MagicMock()

    with patch.object(arxiv_motor.requests, "get", side_effect=[mock_search_resp, Exception("boom")]):
        resultado = arxiv_motor.buscar_arxiv(
            query="transformers",
            max_resultados=5,
            projeto_nome="projeto_teste_arxiv_erro",
        )

    assert resultado["ok"] is True
    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 0
    assert len(resultado["erros"]) == 1
