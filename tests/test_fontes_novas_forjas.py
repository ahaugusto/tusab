# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""Testes das forjas Git GitLab e Codeberg (sem rede — requests mockado)."""
from unittest.mock import MagicMock, patch

from tusab_engine.motor.fontes import codeberg, gitlab


def _resp(json_data=None, text="", status=200, ctype="application/json"):
    r = MagicMock(status_code=status, text=text, headers={"Content-Type": ctype})
    r.json.return_value = json_data
    r.raise_for_status = MagicMock()
    return r


def test_gitlab_baixa_readme_pelo_caminho_do_readme_url(tmp_path, monkeypatch):
    monkeypatch.setattr(gitlab, "NEURAL_DIR", str(tmp_path))
    busca = _resp([{
        "id": 42, "path_with_namespace": "grupo/proj", "name_with_namespace": "Grupo / Proj",
        "description": "Projeto de teste", "topics": ["rag", "llm"], "star_count": 7,
        "default_branch": "main", "web_url": "https://gitlab.com/grupo/proj",
        "readme_url": "https://gitlab.com/grupo/proj/-/blob/main/docs/README.rst",
    }])
    readme = _resp(text="Instalação e uso do projeto. " * 5, ctype="text/plain")
    with patch.object(gitlab.requests, "get", side_effect=[busca, readme]) as mock_get:
        r = gitlab.buscar(query="rag", max_resultados=3, projeto_nome="p_gl")
    assert r["total_salvos"] == 1
    assert mock_get.call_args_list[1].args[0] == "https://gitlab.com/api/v4/projects/42/repository/files/docs%2FREADME.rst/raw"
    conteudo = next((tmp_path / "p_gl" / "documents").glob("*.txt")).read_text(encoding="utf-8")
    assert "Tópicos: rag, llm" in conteudo and "Instalação e uso" in conteudo


def test_gitlab_sem_readme_e_descricao_curta_e_pulado(tmp_path, monkeypatch):
    monkeypatch.setattr(gitlab, "NEURAL_DIR", str(tmp_path))
    busca = _resp([{"id": 1, "path_with_namespace": "a/b", "description": "x", "default_branch": "main", "readme_url": None}])
    with patch.object(gitlab.requests, "get", return_value=busca):
        r = gitlab.buscar(query="x", max_resultados=3, projeto_nome="p_gl2")
    assert r["total_salvos"] == 0


def test_codeberg_tenta_nomes_de_readme_e_salva(tmp_path, monkeypatch):
    monkeypatch.setattr(codeberg, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"ok": True, "data": [{"full_name": "org/repo", "description": "Ferramenta livre", "default_branch": "main",
                                         "stars_count": 3, "html_url": "https://codeberg.org/org/repo", "topics": []}]})
    with patch.object(codeberg.requests, "get", side_effect=[busca, _resp(status=404), _resp(text="# Repo\n\nConteúdo do readme minúsculo. " * 3)]):
        r = codeberg.buscar(query="ferramenta", max_resultados=3, projeto_nome="p_cb")
    assert r["total_salvos"] == 1
    conteudo = next((tmp_path / "p_cb" / "documents").glob("*.txt")).read_text(encoding="utf-8")
    assert "Repositório: org/repo" in conteudo and "Conteúdo do readme" in conteudo


def test_codeberg_formato_mudado_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(codeberg, "NEURAL_DIR", str(tmp_path))
    import pytest
    with patch.object(codeberg.requests, "get", return_value=_resp({"resultados": []})):
        with pytest.raises(RuntimeError, match="mudou o formato"):
            codeberg.buscar(query="x", max_resultados=3, projeto_nome="p_cb2")
