# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes dos adaptadores da área "Direito, normas, legislação e governo" —
Câmara dos Deputados (proposições em tramitação) e Senado Federal/Legislação
(leis já publicadas). LexML (bloqueado por verificação anti-bot ao vivo) e
Datajud (já rejeitado antes) ficam de fora — ver docstrings dos módulos e
agents/_historia.md. Sem chamada de rede real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import camara, senado_leis


def test_area_direito_registrada():
    areas = fontes_registry.listar_fontes()
    assert "direito" in areas
    ids = {f["id"] for f in areas["direito"]["fontes"]}
    assert ids == {"camara", "senado_leis"}


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


# ─── Senado Federal — Legislação ────────────────────────────────────────────

_XML_LEIS_MOCK = b"""<?xml version='1.0' encoding='UTF-8'?>
<ListaDocumento>
  <documentos>
    <documento id="1">
      <tipo>LEI-n</tipo>
      <numero>15476</numero>
      <normaNome>Lei n\xc2\xba 15.476 de 23/07/2026</normaNome>
      <ementa>Cria o t\xc3\xadtulo Cidade Amiga do Idoso para cidades com pol\xc3\xadticas de prote\xc3\xa7\xc3\xa3o ao idoso.</ementa>
      <dataassinatura>23/07/2026</dataassinatura>
    </documento>
    <documento id="2">
      <tipo>LEI-n</tipo>
      <numero>15474</numero>
      <normaNome>Lei n\xc2\xba 15.474 de 23/07/2026</normaNome>
      <ementa>Disp\xc3\xb5e sobre a comercializa\xc3\xa7\xc3\xa3o de aerossol de defesa pessoal.</ementa>
      <dataassinatura>23/07/2026</dataassinatura>
    </documento>
  </documentos>
</ListaDocumento>
"""


def test_senado_leis_filtra_por_palavra_na_ementa(tmp_path, monkeypatch):
    monkeypatch.setattr(senado_leis, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock(content=_XML_LEIS_MOCK)
    mock_resp.raise_for_status = MagicMock()

    with patch.object(senado_leis.requests, "get", return_value=mock_resp):
        resultado = senado_leis.buscar(query="idoso", max_resultados=5, projeto_nome="projeto_senado")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_senado" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Cidade Amiga do Idoso" in conteudo
    assert "FONTE: senado_leis" in conteudo
    assert "URL_ORIGEM: https://normas.leg.br/?urn=urn:lex:br:federal:lei:2026-07-23;15476" in conteudo


def test_senado_leis_todos_termos_precisam_bater(tmp_path, monkeypatch):
    """Query com múltiplas palavras exige todas presentes na ementa (AND, não OR)."""
    monkeypatch.setattr(senado_leis, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock(content=_XML_LEIS_MOCK)
    mock_resp.raise_for_status = MagicMock()

    with patch.object(senado_leis.requests, "get", return_value=mock_resp):
        resultado = senado_leis.buscar(query="idoso aerossol", max_resultados=5, projeto_nome="projeto_senado2")

    assert resultado["total_salvos"] == 0


def test_senado_leis_sem_correspondencia_nao_salva_nada(tmp_path, monkeypatch):
    monkeypatch.setattr(senado_leis, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock(content=_XML_LEIS_MOCK)
    mock_resp.raise_for_status = MagicMock()

    with patch.object(senado_leis.requests, "get", return_value=mock_resp):
        resultado = senado_leis.buscar(query="termo_que_nao_existe_em_nenhuma_ementa", max_resultados=5, projeto_nome="projeto_senado3")

    assert resultado["total_salvos"] == 0
