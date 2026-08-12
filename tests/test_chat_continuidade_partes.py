# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Teste da inclusão best-effort de parte irmã em chat.py::_recuperar_contexto —
quando um capítulo dividido (>3000 chars, ver index.py::_LIMITE_CHUNK_CHARS)
tem só uma de suas partes recuperada pelo BM25, a parte seguinte deve entrar
no contexto do LLM mesmo sem pontuar bem sozinha, pra não perder a continuidade
da explicação.
"""
import json
import os

from tusab_engine.agent import index as index_mod


def _construir_indice_com_partes(index_dir, prefixo):
    os.makedirs(index_dir, exist_ok=True)
    chunks = [
        {
            "texto": "assunto principal halving bitcoin explicado em detalhes tecnicos " * 4,
            "texto_original": "assunto principal halving bitcoin explicado em detalhes tecnicos " * 4,
            "titulo": "Video Cripto — Halving (parte 1/2)",
            "aba": "youtube", "data": "01/01/2026", "link": "https://youtube.com/watch?v=vid1",
            "tags": [], "descricao": "", "arquivo": "v.txt", "canal": prefixo,
            "video_id": "vid1", "views": 10, "timestamp_inicio": 100,
            "parte": 1, "total_partes": 2, "timestamp_aproximado": False,
        },
        {
            "texto": "continuacao da explicacao sobre o proximo halving previsto para o futuro " * 4,
            "texto_original": "continuacao da explicacao sobre o proximo halving previsto para o futuro " * 4,
            "titulo": "Video Cripto — Halving (parte 2/2)",
            "aba": "youtube", "data": "01/01/2026", "link": "https://youtube.com/watch?v=vid1",
            "tags": [], "descricao": "", "arquivo": "v.txt", "canal": prefixo,
            "video_id": "vid1", "views": 10, "timestamp_inicio": 340,
            "parte": 2, "total_partes": 2, "timestamp_aproximado": False,
        },
        {
            "texto": "video totalmente nao relacionado sobre receitas de bolo de chocolate " * 4,
            "texto_original": "video totalmente nao relacionado sobre receitas de bolo de chocolate " * 4,
            "titulo": "Receita de Bolo",
            "aba": "youtube", "data": "01/01/2026", "link": "https://youtube.com/watch?v=vid2",
            "tags": [], "descricao": "", "arquivo": "v2.txt", "canal": prefixo,
            "video_id": "vid2", "views": 5, "timestamp_inicio": 0,
            "parte": 1, "total_partes": 1, "timestamp_aproximado": False,
        },
    ]
    idx_path = os.path.join(index_dir, f"{prefixo}_index.json")
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump({"projeto_nome": prefixo, "chunks": chunks, "indexed_at": 0}, f)
    return chunks


def _preparar(tmp_path, monkeypatch, prefixo):
    from tusab_engine.agent.chat import _bm25_cache
    index_dir = str(tmp_path / "indexes")
    monkeypatch.setattr(index_mod, "INDEX_DIR", index_dir, raising=False)
    _bm25_cache.clear()
    return _construir_indice_com_partes(index_dir, prefixo)


def test_recuperar_contexto_inclui_parte_irma_quando_so_uma_parte_pontua(tmp_path, monkeypatch):
    from tusab_engine.agent.chat import _recuperar_contexto

    _preparar(tmp_path, monkeypatch, "projeto_partes")

    # Query bate só com o vocabulário da parte 1 ("halving bitcoin explicado
    # detalhes tecnicos") — a parte 2 sozinha não tem esses termos.
    contexto = _recuperar_contexto(
        "halving bitcoin explicado detalhes tecnicos", "projeto_partes", n=1,
        config={"provider": "ollama", "query_expansion": False}, busca_ampla=False,
    )

    titulos = [c["titulo"] for c in contexto]
    assert "Video Cripto — Halving (parte 1/2)" in titulos
    assert "Video Cripto — Halving (parte 2/2)" in titulos  # incluída por continuidade
    assert "Receita de Bolo" not in titulos  # não relacionado, não deveria entrar


def test_parte_irma_nao_quebra_filtro_de_lacuna_em_busca_ampla(tmp_path, monkeypatch):
    """A parte irmã não tem _ce_score (não passou pelo CrossEncoder) — precisa
    herdar o score/critério do irmão selecionado pra não corromper o filtro de
    lacuna de relevância (que muda de critério CE→BM25 se algum chunk não tiver
    _ce_score em busca_ampla=True). n=1 força o BM25 a trazer só 1 candidato —
    a parte irmã só pode chegar ao resultado final via a injeção por continuidade,
    isolando o mecanismo do caso em que o BM25 já traria as duas partes sozinho."""
    from tusab_engine.agent.chat import _recuperar_contexto

    _preparar(tmp_path, monkeypatch, "projeto_partes_ampla")

    contexto = _recuperar_contexto(
        "halving bitcoin explicado detalhes tecnicos", "projeto_partes_ampla", n=1,
        config={"provider": "ollama", "query_expansion": False}, busca_ampla=True,
    )
    # não deve lançar exceção nem quebrar — se chegou aqui, o teste já passou
    # a parte principal do que importa; confirma que a irmã sobrevive ao filtro
    # de lacuna de relevância (CE) por herdar o _ce_score do irmão selecionado.
    titulos = [c["titulo"] for c in contexto]
    assert "Video Cripto — Halving (parte 1/2)" in titulos
    assert "Video Cripto — Halving (parte 2/2)" in titulos


def test_titulo_base_remove_sufixo_de_parte():
    from tusab_engine.agent.chat import _titulo_base
    assert _titulo_base("Video — Cap (parte 1/2)") == "Video — Cap"
    assert _titulo_base("Video — Cap (parte 12/34)") == "Video — Cap"
    assert _titulo_base("Video sem partes") == "Video sem partes"
    assert _titulo_base("") == ""
    assert _titulo_base(None) == ""
