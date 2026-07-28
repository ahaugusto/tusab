# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do adaptador da área "Ciências da Terra, clima e espaço" — NASA
Earthdata/CMR (único candidato com resumo narrativo real, ver docstring de
nasa_cmr.py e agents/_historia.md — NOAA exige token, demais candidatos são
dado numérico/geoespacial estruturado). Sem chamada de rede real.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import nasa_cmr


def test_area_terra_registrada():
    areas = fontes_registry.listar_fontes()
    assert "terra" in areas
    ids = {f["id"] for f in areas["terra"]["fontes"]}
    assert ids == {"nasa_cmr"}


def test_nasa_cmr_extrai_summary_real(tmp_path, monkeypatch):
    monkeypatch.setattr(nasa_cmr, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "feed": {"entry": [{
            "title": "West Africa Coastal Vulnerability Mapping",
            "summary": "Resumo real descrevendo o dataset de desmatamento.",
            "links": [{"href": "https://cmr.earthdata.nasa.gov/search/concepts/C1.html"}],
        }]}
    }

    with patch.object(nasa_cmr.requests, "get", return_value=mock_resp):
        resultado = nasa_cmr.buscar(query="deforestation", max_resultados=5, projeto_nome="projeto_nasa")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_nasa" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Resumo real descrevendo o dataset de desmatamento." in conteudo
    assert "FONTE: nasa_cmr" in conteudo


def test_nasa_cmr_pula_colecao_sem_summary(tmp_path, monkeypatch):
    monkeypatch.setattr(nasa_cmr, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"feed": {"entry": [{"title": "Sem resumo", "summary": ""}]}}

    with patch.object(nasa_cmr.requests, "get", return_value=mock_resp):
        resultado = nasa_cmr.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_nasa2")

    assert resultado["total_salvos"] == 0
