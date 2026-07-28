# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do adaptador da área "Economia, finanças e ciências sociais" — Banco
Central do Brasil (único candidato com busca real por tema, ver docstring de
bcb.py e agents/_historia.md). Sem chamada de rede real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import bcb


def test_area_economia_registrada():
    areas = fontes_registry.listar_fontes()
    assert "economia" in areas
    ids = {f["id"] for f in areas["economia"]["fontes"]}
    assert ids == {"bcb"}


def test_bcb_extrai_notes_como_texto(tmp_path, monkeypatch):
    monkeypatch.setattr(bcb, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "result": {"results": [{
            "title": "Relatórios de inflação publicados",
            "notes": "Em 1999, com a publicação do Decreto nº 3.088, foi implementado o regime de metas para a inflação.",
            "name": "relatorios-de-inflacao",
        }]}
    }

    with patch.object(bcb.requests, "get", return_value=mock_resp):
        resultado = bcb.buscar(query="inflação", max_resultados=5, projeto_nome="projeto_bcb")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_bcb" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "regime de metas para a inflação" in conteudo
    assert "FONTE: bcb" in conteudo
    assert "URL_ORIGEM: https://dadosabertos.bcb.gov.br/dataset/relatorios-de-inflacao" in conteudo


def test_bcb_pula_dataset_sem_notes(tmp_path, monkeypatch):
    monkeypatch.setattr(bcb, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"result": {"results": [{"title": "Sem descrição", "notes": "", "name": "x"}]}}

    with patch.object(bcb.requests, "get", return_value=mock_resp):
        resultado = bcb.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_bcb2")

    assert resultado["total_salvos"] == 0
