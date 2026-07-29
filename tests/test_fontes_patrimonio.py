# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes dos adaptadores da área "Patrimônio cultural, história e arquivos" —
Art Institute of Chicago (descrição curatorial real) e The Met (metadado
estruturado concatenado, sem campo de texto livre — confirmado ao vivo, ver
docstring de the_met.py). Sem chamada de rede real.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import art_institute_chicago, the_met


def test_area_patrimonio_registrada():
    areas = fontes_registry.listar_fontes()
    assert "patrimonio" in areas
    ids = {f["id"] for f in areas["patrimonio"]["fontes"]}
    assert ids == {"art_institute_chicago", "the_met"}


# ─── Art Institute of Chicago ────────────────────────────────────────────────

def test_artic_limpa_html_da_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(art_institute_chicago, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"data": [{"id": 1, "title": "Obra de Teste", "description": "<p>Descrição <em>curatorial</em> real.</p>"}]}

    with patch.object(art_institute_chicago.requests, "get", return_value=mock_resp):
        resultado = art_institute_chicago.buscar(query="samurai", max_resultados=5, projeto_nome="projeto_artic")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_artic" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Descrição curatorial real." in conteudo
    assert "<em>" not in conteudo


def test_artic_pula_obra_sem_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(art_institute_chicago, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"data": [{"id": 1, "title": "Sem descrição"}]}

    with patch.object(art_institute_chicago.requests, "get", return_value=mock_resp):
        resultado = art_institute_chicago.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_artic2")

    assert resultado["total_salvos"] == 0


# ─── The Met ─────────────────────────────────────────────────────────────────

def test_the_met_concatena_campos_estruturados(tmp_path, monkeypatch):
    monkeypatch.setattr(the_met, "NEURAL_DIR", str(tmp_path))
    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"objectIDs": [551786]}
    mock_detalhe = MagicMock()
    mock_detalhe.json.return_value = {
        "title": "Obra Japonesa",
        "culture": "Japão",
        "period": "Edo",
        "medium": "Tinta sobre papel",
        "objectURL": "https://metmuseum.org/art/551786",
    }

    with patch.object(the_met.requests, "get", side_effect=[mock_busca, mock_detalhe]):
        resultado = the_met.buscar(query="samurai", max_resultados=5, projeto_nome="projeto_met")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_met" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Cultura: Japão" in conteudo
    assert "Período: Edo" in conteudo
    assert "TITULO: Obra Japonesa" in conteudo


def test_the_met_pula_objeto_sem_campos(tmp_path, monkeypatch):
    monkeypatch.setattr(the_met, "NEURAL_DIR", str(tmp_path))
    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"objectIDs": [999]}
    mock_detalhe = MagicMock()
    mock_detalhe.json.return_value = {"title": "Vazio"}

    with patch.object(the_met.requests, "get", side_effect=[mock_busca, mock_detalhe]):
        resultado = the_met.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_met2")

    assert resultado["total_salvos"] == 0
