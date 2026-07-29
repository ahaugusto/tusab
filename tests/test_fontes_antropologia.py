# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do adaptador da área "Antropologia, linguística e conhecimento
estruturado" — Wikipédia PT (busca real + resumo real, ver docstring de
wikipedia.py sobre por que Wikidata/DBpedia/GeoNames/Getty/Glottolog foram
descartados). Sem chamada de rede real.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import wikipedia


def test_area_antropologia_registrada():
    areas = fontes_registry.listar_fontes()
    assert "antropologia" in areas
    ids = {f["id"] for f in areas["antropologia"]["fontes"]}
    assert ids == {"wikipedia"}


def test_wikipedia_busca_e_extrai_resumo(tmp_path, monkeypatch):
    monkeypatch.setattr(wikipedia, "NEURAL_DIR", str(tmp_path))

    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"query": {"search": [{"title": "Xenotransplante", "pageid": 1}]}}

    mock_extrai = MagicMock()
    mock_extrai.raise_for_status = MagicMock()
    mock_extrai.json.return_value = {
        "query": {"pages": {"1": {"title": "Xenotransplante", "extract": "Resumo real do artigo em prosa."}}}
    }

    with patch.object(wikipedia.requests, "get", side_effect=[mock_busca, mock_extrai]):
        resultado = wikipedia.buscar(query="xenotransplante", max_resultados=5, projeto_nome="projeto_wiki")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_wiki" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Resumo real do artigo em prosa." in conteudo
    assert "URL_ORIGEM: https://pt.wikipedia.org/wiki/Xenotransplante" in conteudo


def test_wikipedia_sem_resultados_nao_quebra(tmp_path, monkeypatch):
    monkeypatch.setattr(wikipedia, "NEURAL_DIR", str(tmp_path))
    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"query": {"search": []}}

    with patch.object(wikipedia.requests, "get", return_value=mock_busca):
        resultado = wikipedia.buscar(query="termoinexistentequalquercoisa", max_resultados=5, projeto_nome="projeto_wiki2")

    assert resultado["total_salvos"] == 0
    assert resultado["total_encontrados"] == 0


def test_wikipedia_pula_pagina_sem_extract(tmp_path, monkeypatch):
    monkeypatch.setattr(wikipedia, "NEURAL_DIR", str(tmp_path))
    mock_busca = MagicMock()
    mock_busca.raise_for_status = MagicMock()
    mock_busca.json.return_value = {"query": {"search": [{"title": "Página desambiguação", "pageid": 2}]}}

    mock_extrai = MagicMock()
    mock_extrai.raise_for_status = MagicMock()
    mock_extrai.json.return_value = {"query": {"pages": {"2": {"title": "Página desambiguação", "extract": ""}}}}

    with patch.object(wikipedia.requests, "get", side_effect=[mock_busca, mock_extrai]):
        resultado = wikipedia.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_wiki3")

    assert resultado["total_salvos"] == 0
