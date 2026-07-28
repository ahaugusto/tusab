# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes dos adaptadores da área "Tecnologia, IA e ciência de dados" — GitHub,
Stack Overflow. Mesmo registro genérico da área "Produção científica e
literatura" (ver tests/test_fontes.py) — arquivo separado só por organização.

Sem chamada de rede real — requests é mockado em todos os testes.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import github, stackexchange


def test_area_tecnologia_registrada():
    areas = fontes_registry.listar_fontes()
    assert "tecnologia" in areas
    ids = {f["id"] for f in areas["tecnologia"]["fontes"]}
    assert ids == {"github", "stackexchange"}


# ─── GitHub ──────────────────────────────────────────────────────────────────

def test_github_extrai_descricao_topicos_e_linguagem(tmp_path, monkeypatch):
    monkeypatch.setattr(github, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "items": [{
            "full_name": "org/repo-rag",
            "description": "Um framework de RAG local-first.",
            "topics": ["rag", "llm"],
            "language": "Python",
            "stargazers_count": 42,
            "html_url": "https://github.com/org/repo-rag",
        }]
    }

    with patch.object(github.requests, "get", return_value=mock_resp):
        resultado = github.buscar(query="rag llm", max_resultados=5, projeto_nome="projeto_github")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_github" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Um framework de RAG local-first." in conteudo
    assert "Tópicos: rag, llm" in conteudo
    assert "Linguagem principal: Python" in conteudo
    assert "FONTE: github" in conteudo


def test_github_pula_repositorio_sem_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(github, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"items": [{"full_name": "org/vazio", "description": None}]}

    with patch.object(github.requests, "get", return_value=mock_resp):
        resultado = github.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_github2")

    assert resultado["total_salvos"] == 0


# ─── Stack Overflow ──────────────────────────────────────────────────────────

def test_stackexchange_limpa_html_do_corpo(tmp_path, monkeypatch):
    monkeypatch.setattr(stackexchange, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "items": [{
            "title": "Como implementar attention?",
            "body": "<p>Preciso de <code>ajuda</code> com attention.</p>",
            "tags": ["python", "pytorch"],
            "score": 12,
            "answer_count": 3,
            "link": "https://stackoverflow.com/q/123",
        }]
    }

    with patch.object(stackexchange.requests, "get", return_value=mock_resp):
        resultado = stackexchange.buscar(query="attention", max_resultados=5, projeto_nome="projeto_se")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_se" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Preciso de ajuda com attention." in conteudo
    assert "<code>" not in conteudo
    assert "Tags: python, pytorch" in conteudo
    assert "FONTE: stackexchange" in conteudo


def test_stackexchange_pula_pergunta_sem_corpo(tmp_path, monkeypatch):
    monkeypatch.setattr(stackexchange, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"items": [{"title": "Sem corpo", "body": ""}]}

    with patch.object(stackexchange.requests, "get", return_value=mock_resp):
        resultado = stackexchange.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_se2")

    assert resultado["total_salvos"] == 0
