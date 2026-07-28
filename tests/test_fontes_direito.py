# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do adaptador da área "Direito, normas, legislação e governo" —
Câmara dos Deputados (único candidato viável, ver docstring de camara.py e
agents/_historia.md — Senado sem busca real, LexML/Datajud já rejeitados).
Sem chamada de rede real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import camara


def test_area_direito_registrada():
    areas = fontes_registry.listar_fontes()
    assert "direito" in areas
    ids = {f["id"] for f in areas["direito"]["fontes"]}
    assert ids == {"camara"}


def test_camara_usa_inteiro_teor_quando_pdf_disponivel(tmp_path, monkeypatch):
    monkeypatch.setattr(camara, "NEURAL_DIR", str(tmp_path))

    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {
        "dados": [{"id": 123, "siglaTipo": "PL", "numero": "759", "ano": "2023", "ementa": "Regulamenta a IA.", "uri": "https://dadosabertos.camara.leg.br/api/v2/proposicoes/123"}]
    }
    mock_detalhe = MagicMock()
    mock_detalhe.json.return_value = {"dados": {"urlInteiroTeor": "https://camara.leg.br/pdf/123"}}
    mock_pdf = MagicMock(ok=True, content=b"%PDF-fake", headers={"content-type": "application/pdf"})

    with patch.object(camara.requests, "get", side_effect=[mock_busca, mock_detalhe, mock_pdf]), \
         patch.object(camara, "_extrair_texto_pdf", return_value="Texto integral extraído do PDF."):
        resultado = camara.buscar(query="inteligencia artificial", max_resultados=5, projeto_nome="projeto_camara")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_camara" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Regulamenta a IA." in conteudo
    assert "--- INTEIRO TEOR ---" in conteudo
    assert "Texto integral extraído do PDF." in conteudo
    assert "TITULO: PL 759/2023" in conteudo


def test_camara_cai_para_ementa_quando_pdf_falha(tmp_path, monkeypatch):
    """Falha em qualquer etapa do inteiro teor não derruba o item — usa só a ementa."""
    monkeypatch.setattr(camara, "NEURAL_DIR", str(tmp_path))

    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {
        "dados": [{"id": 456, "siglaTipo": "PL", "numero": "1", "ano": "2024", "ementa": "Só a ementa mesmo.", "uri": "x"}]
    }

    with patch.object(camara.requests, "get", side_effect=[mock_busca, Exception("timeout no detalhe")]):
        resultado = camara.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_camara_falha")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_camara_falha" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Só a ementa mesmo." in conteudo
    assert "INTEIRO TEOR" not in conteudo


def test_camara_pula_item_sem_ementa_e_sem_teor(tmp_path, monkeypatch):
    monkeypatch.setattr(camara, "NEURAL_DIR", str(tmp_path))
    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"dados": [{"id": 789, "siglaTipo": "PL", "numero": "2", "ano": "2024", "ementa": "", "uri": "x"}]}
    mock_detalhe = MagicMock()
    mock_detalhe.json.return_value = {"dados": {}}

    with patch.object(camara.requests, "get", side_effect=[mock_busca, mock_detalhe]):
        resultado = camara.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_camara_vazio")

    assert resultado["total_salvos"] == 0
