# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes das fontes do Hugging Face Hub (hf_modelos, hf_datasets, hf_papers).
Sem rede — requests mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor.fontes import _huggingface, hf_datasets, hf_modelos, hf_papers


def _resp(json_data=None, text="", status=200):
    r = MagicMock(status_code=status, text=text)
    r.json.return_value = json_data
    r.raise_for_status = MagicMock()
    return r


_CARD = "---\nlicense: mit\nlanguage: pt\n---\n\n# BERTimbau\n\n![logo](https://x/y.png)\n\n" + ("Modelo BERT pré-treinado para o português brasileiro. " * 10)


def test_limpar_card_tira_front_matter_e_imagens():
    texto = _huggingface.limpar_card(_CARD)
    assert not texto.startswith("---") and "license: mit" not in texto
    assert "![logo]" not in texto and "# BERTimbau" in texto


def test_hf_modelos_salva_card_e_pula_repositorio_restrito(tmp_path, monkeypatch):
    monkeypatch.setattr(hf_modelos, "NEURAL_DIR", str(tmp_path))
    busca = _resp([
        {"id": "meta-llama/Llama-3.1-8B", "downloads": 9, "likes": 1, "tags": []},
        {"id": "neuralmind/bert-base-portuguese-cased", "downloads": 5, "likes": 2, "tags": ["bert", "pt", "license:mit"], "pipeline_tag": "fill-mask"},
    ])
    gated = _resp(status=401)
    card = _resp(text=_CARD)
    with patch.object(_huggingface.requests, "get", side_effect=[busca, gated, card]):
        r = hf_modelos.buscar(query="bert portuguese", max_resultados=1, projeto_nome="p_hf")
    assert r["total_salvos"] == 1
    conteudo = next((tmp_path / "p_hf" / "documents").glob("*.txt")).read_text(encoding="utf-8")
    assert "Modelo: neuralmind/bert-base-portuguese-cased" in conteudo
    assert "Tarefa: fill-mask" in conteudo and "license:mit" not in conteudo
    assert "URL_ORIGEM: https://huggingface.co/neuralmind/bert-base-portuguese-cased" in conteudo


def test_hf_datasets_usa_prefixo_datasets_na_url_do_card(tmp_path, monkeypatch):
    monkeypatch.setattr(hf_datasets, "NEURAL_DIR", str(tmp_path))
    busca = _resp([{"id": "eduagarcia/portuguese_benchmark", "downloads": 3, "likes": 8, "tags": []}])
    card = _resp(text=_CARD)
    with patch.object(_huggingface.requests, "get", side_effect=[busca, card]) as mock_get:
        r = hf_datasets.buscar(query="portuguese", max_resultados=3, projeto_nome="p_hfd")
    assert r["total_salvos"] == 1
    assert mock_get.call_args_list[1].args[0] == "https://huggingface.co/datasets/eduagarcia/portuguese_benchmark/raw/main/README.md"


def test_hf_busca_vazia_nao_baixa_cards(tmp_path, monkeypatch):
    monkeypatch.setattr(hf_modelos, "NEURAL_DIR", str(tmp_path))
    with patch.object(_huggingface.requests, "get", return_value=_resp([])) as mock_get:
        r = hf_modelos.buscar(query="xyzzy", max_resultados=3, projeto_nome="p_vazio")
    assert r["total_salvos"] == 0 and mock_get.call_count == 1


def test_hf_papers_salva_abstract_e_link_do_arxiv(tmp_path, monkeypatch):
    monkeypatch.setattr(hf_papers, "NEURAL_DIR", str(tmp_path))
    dados = [
        {"paper": {"id": "2005.11401", "title": "Retrieval-Augmented Generation\nfor NLP",
                   "summary": "Large pre-trained language models store factual knowledge. " * 4,
                   "authors": [{"name": "Patrick Lewis"}], "publishedAt": "2020-05-22T00:00:00.000Z",
                   "ai_keywords": ["RAG", "retrieval"]}},
        {"paper": {"id": "9999.0", "title": "Sem resumo", "summary": ""}},
    ]
    with patch.object(hf_papers.requests, "get", return_value=_resp(dados)):
        r = hf_papers.buscar(query="rag", max_resultados=5, projeto_nome="p_hfp")
    assert r["total_salvos"] == 1
    conteudo = next((tmp_path / "p_hfp" / "documents").glob("*.txt")).read_text(encoding="utf-8")
    assert "TITULO: Retrieval-Augmented Generation for NLP" in conteudo
    assert "arXiv: https://arxiv.org/abs/2005.11401" in conteudo and "Patrick Lewis" in conteudo
