# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do adaptador da área "Física, química e materiais" — CERN Open Data
(único candidato viável, ver docstring de cern_opendata.py e
agents/_historia.md — PubChem só faz lookup por nome exato, NOMAD é dado de
cálculo sem narrativa). Sem chamada de rede real.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import cern_opendata


def test_area_fisica_registrada():
    areas = fontes_registry.listar_fontes()
    assert "fisica" in areas
    ids = {f["id"] for f in areas["fisica"]["fontes"]}
    assert ids == {"cern_opendata"}


def test_cern_opendata_limpa_html_do_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(cern_opendata, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "hits": {"hits": [{
            "id": "123",
            "metadata": {
                "title": "Higgs to two photons from 2011",
                "abstract": {"description": "<p>Documento com <b>eventos</b> reais de candidatos Higgs.</p>"},
            },
        }]}
    }

    with patch.object(cern_opendata.requests, "get", return_value=mock_resp):
        resultado = cern_opendata.buscar(query="higgs", max_resultados=5, projeto_nome="projeto_cern")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_cern" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Documento com eventos reais de candidatos Higgs." in conteudo
    assert "<b>" not in conteudo
    assert "URL_ORIGEM: https://opendata.cern.ch/record/123" in conteudo


def test_cern_opendata_pula_registro_sem_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(cern_opendata, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"hits": {"hits": [{"id": "1", "metadata": {"title": "Sem abstract"}}]}}

    with patch.object(cern_opendata.requests, "get", return_value=mock_resp):
        resultado = cern_opendata.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_cern2")

    assert resultado["total_salvos"] == 0
