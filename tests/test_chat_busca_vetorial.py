# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do merge de busca vetorial (embeddings) em chat.py::_recuperar_contexto
— Fase 1 de embeddings como complemento ao BM25+FTS5.

Sem chamada de rede real — Ollama é mockado (gerar_embedding_query). O .npy é
real (numpy em tmp_path), o índice BM25 é real (JSON em tmp_path) — mesmo
padrão de tests/test_fidelidade_identificador.py.
"""
import os
from unittest.mock import patch

from tusab_engine.agent import index as index_mod
from tusab_engine.agent import embeddings as embeddings_mod
from tusab_engine.agent import lance_store


def _construir_indice_real(index_dir, prefixo, docs):
    """docs: lista de (titulo, texto). Constrói uma tabela LanceDB real."""
    os.makedirs(index_dir, exist_ok=True)
    chunks = [
        {"texto": texto, "texto_original": texto, "titulo": titulo, "aba": "documento",
         "data": "", "link": "", "tags": [], "descricao": "", "arquivo": f"{i}.txt",
         "canal": prefixo, "timestamp_inicio": 0}
        for i, (titulo, texto) in enumerate(docs)
    ]
    assert lance_store.gravar_chunks(prefixo, chunks)
    return chunks


def _preparar(tmp_path, monkeypatch, prefixo, docs):
    from tusab_engine.agent.chat import _bm25_cache

    index_dir = str(tmp_path / "indexes")
    monkeypatch.setattr(index_mod, "INDEX_DIR", index_dir, raising=False)
    monkeypatch.setattr(embeddings_mod, "INDEX_DIR", index_dir, raising=False)
    monkeypatch.setattr(lance_store, "INDEX_DIR", index_dir, raising=False)
    _bm25_cache.clear()
    embeddings_mod._matriz_cache.clear()
    return _construir_indice_real(index_dir, prefixo, docs)


def test_busca_vetorial_entra_no_pool_apenas_em_busca_ampla(tmp_path, monkeypatch):
    from tusab_engine.agent.chat import _recuperar_contexto

    chunks = _preparar(tmp_path, monkeypatch, "projeto_vet", [
        ("Documento sobre maçãs", "Conteúdo qualquer sobre maçãs " * 8),
        ("Documento sobre carros", "Conteúdo qualquer sobre carros " * 8),
    ])
    # Vetor do chunk 1 ("carros") deliberadamente distante do vocabulário BM25
    # da pergunta ("fruta vermelha e doce") — só a busca vetorial o recupera.
    dim = embeddings_mod.EMBED_DIM
    v0, v1 = [0.0] * dim, [0.0] * dim
    v0[0], v1[1] = 1.0, 1.0
    embeddings_mod.salvar_matriz("projeto_vet", [v0, v1])
    embeddings_mod._matriz_cache.clear()

    with patch.object(embeddings_mod, "gerar_embedding_query", return_value=v1) as mock_query:
        contexto_restrita = _recuperar_contexto(
            "fruta vermelha e doce", "projeto_vet", n=1,
            config={"provider": "ollama", "query_expansion": False}, busca_ampla=False,
        )
    mock_query.assert_not_called()  # Busca Restrita não paga custo de embedding query
    assert not any(c.get("vetorial_match") for c in contexto_restrita)

    # n=1 -> top_k=1 na busca vetorial: só o candidato mais similar ao vetor
    # da query (v1, igual ao chunk "carros") deve entrar no pool.
    with patch.object(embeddings_mod, "gerar_embedding_query", return_value=v1) as mock_query:
        contexto_ampla = _recuperar_contexto(
            "fruta vermelha e doce", "projeto_vet", n=1,
            config={"provider": "ollama", "query_expansion": False}, busca_ampla=True,
        )
    mock_query.assert_called_once()
    vetoriais = [c for c in contexto_ampla if c.get("vetorial_match")]
    assert len(vetoriais) == 1
    assert vetoriais[0]["titulo"] == "Documento sobre carros"
    assert vetoriais[0]["score"] == 0.15
    assert "_cos_sim" in vetoriais[0]


def test_busca_vetorial_nao_duplica_chunk_ja_recuperado_pelo_bm25(tmp_path, monkeypatch):
    from tusab_engine.agent.chat import _recuperar_contexto

    chunks = _preparar(tmp_path, monkeypatch, "projeto_dedup", [
        ("Guia de investimentos", "Como investir em renda fixa e ações " * 8),
    ])
    dim = embeddings_mod.EMBED_DIM
    v0 = [0.3] * dim
    embeddings_mod.salvar_matriz("projeto_dedup", [v0])
    embeddings_mod._matriz_cache.clear()

    with patch.object(embeddings_mod, "gerar_embedding_query", return_value=v0):
        contexto = _recuperar_contexto(
            "Como investir em renda fixa e ações", "projeto_dedup", n=4,
            config={"provider": "ollama", "query_expansion": False}, busca_ampla=True,
        )

    titulos = [c["titulo"] for c in contexto]
    assert titulos.count("Guia de investimentos") == 1  # sem duplicata BM25+vetorial


def test_busca_vetorial_ausencia_de_npy_nao_quebra_busca_ampla(tmp_path, monkeypatch):
    from tusab_engine.agent.chat import _recuperar_contexto

    _preparar(tmp_path, monkeypatch, "projeto_sem_npy", [
        ("Documento único", "Conteúdo qualquer para teste de ausência de embeddings " * 8),
    ])
    # Nenhum .npy foi criado — degradação graciosa, comportamento idêntico ao BM25 puro.
    contexto = _recuperar_contexto(
        "Conteúdo qualquer", "projeto_sem_npy", n=4,
        config={"provider": "ollama", "query_expansion": False}, busca_ampla=True,
    )
    assert len(contexto) == 1
    assert not any(c.get("vetorial_match") for c in contexto)


def test_busca_vetorial_nao_atua_no_ramo_multiprojeto_merged(tmp_path, monkeypatch):
    """Mesma restrição de escopo do FTS5 (ver chat.py): o merge vetorial só
    existe no ramo 'modo single' de _recuperar_contexto — o ramo de corpus
    merged multi-projeto (projetos_extras) continua sem busca vetorial. Este
    teste documenta essa limitação intencional e guarda contra regressão
    silenciosa (ex.: alguém estender o vetorial pro ramo merged sem decisão)."""
    from tusab_engine.agent.chat import _recuperar_contexto

    index_dir = str(tmp_path / "indexes")
    docs_a = _preparar(tmp_path, monkeypatch, "projeto_multi_a", [
        ("Documento A", "Conteúdo do projeto A sobre finanças " * 8),
    ])
    _construir_indice_real(index_dir, "projeto_multi_b", [
        ("Documento B", "Conteúdo do projeto B sobre saúde " * 8),
    ])

    dim = embeddings_mod.EMBED_DIM
    embeddings_mod.salvar_matriz("projeto_multi_a", [[0.5] * dim])
    embeddings_mod._matriz_cache.clear()

    with patch.object(embeddings_mod, "gerar_embedding_query", return_value=[0.5] * dim) as mock_query:
        contexto = _recuperar_contexto(
            "Conteúdo do projeto A sobre finanças", "projeto_multi_a", n=4,
            config={"provider": "ollama", "query_expansion": False},
            projetos_extras=["projeto_multi_b"], busca_ampla=True,
        )

    mock_query.assert_not_called()  # ramo merged não tenta busca vetorial
    # BM25 pode legitimamente retornar vazio com corpus sintético de 2 docs
    # (IDF degenera com poucos documentos — mesma observação de
    # test_fidelidade_identificador.py). O que este teste garante é que o
    # vetorial nunca aparece nesse ramo, não que o BM25 retorne resultado.
    assert not any(c.get("vetorial_match") for c in contexto)
