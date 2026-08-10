# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine/agent/embeddings.py — busca vetorial via Ollama.

Sem chamada de rede real — requests é mockado em todos os testes (mesmo padrão
de tests/test_fontes.py / tests/test_arxiv.py: patch.object(modulo.requests, ...)).
"""
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from tusab_engine.agent import embeddings


def _resp(json_data, status_ok=True):
    m = MagicMock()
    m.json.return_value = json_data
    if status_ok:
        m.raise_for_status = MagicMock()
    else:
        m.raise_for_status.side_effect = Exception("HTTP error")
    return m


# ─── gerar_embeddings_lote ──────────────────────────────────────────────────

def test_gerar_embeddings_lote_retorna_vetores_na_ordem_certa():
    vetores_esperados = [[0.1] * embeddings.EMBED_DIM, [0.2] * embeddings.EMBED_DIM]
    with patch.object(embeddings.requests, "post", return_value=_resp({"embeddings": vetores_esperados})):
        resultado = embeddings.gerar_embeddings_lote(["texto a", "texto b"])
    assert resultado == vetores_esperados


def test_gerar_embeddings_lote_vazio_retorna_lista_vazia():
    assert embeddings.gerar_embeddings_lote([]) == []


def test_gerar_embeddings_lote_retorna_none_em_timeout():
    with patch.object(embeddings.requests, "post", side_effect=embeddings.requests.exceptions.Timeout()):
        assert embeddings.gerar_embeddings_lote(["texto"]) is None


def test_gerar_embeddings_lote_retorna_none_em_connection_error():
    with patch.object(embeddings.requests, "post", side_effect=embeddings.requests.exceptions.ConnectionError()):
        assert embeddings.gerar_embeddings_lote(["texto"]) is None


def test_gerar_embeddings_lote_retorna_none_quando_tamanho_diverge():
    with patch.object(embeddings.requests, "post", return_value=_resp({"embeddings": [[0.1] * embeddings.EMBED_DIM]})):
        assert embeddings.gerar_embeddings_lote(["texto a", "texto b"]) is None


def test_gerar_embeddings_lote_retorna_none_quando_dimensao_errada():
    with patch.object(embeddings.requests, "post", return_value=_resp({"embeddings": [[0.1] * 10]})):
        assert embeddings.gerar_embeddings_lote(["texto"]) is None


def test_gerar_embedding_query_caso_especial_de_lote_1():
    vetor = [0.5] * embeddings.EMBED_DIM
    with patch.object(embeddings.requests, "post", return_value=_resp({"embeddings": [vetor]})):
        assert embeddings.gerar_embedding_query("pergunta") == vetor


def test_gerar_embedding_query_retorna_none_quando_lote_falha():
    with patch.object(embeddings.requests, "post", side_effect=Exception("boom")):
        assert embeddings.gerar_embedding_query("pergunta") is None


# ─── modelo_disponivel / ollama_tags ────────────────────────────────────────

def test_modelo_disponivel_reconhece_tag_exata():
    with patch.object(embeddings.requests, "get", return_value=_resp({"models": [{"name": "nomic-embed-text"}]})):
        assert embeddings.modelo_disponivel() is True


def test_modelo_disponivel_reconhece_tag_com_sufixo_latest():
    with patch.object(embeddings.requests, "get", return_value=_resp({"models": [{"name": "nomic-embed-text:latest"}]})):
        assert embeddings.modelo_disponivel() is True


def test_modelo_disponivel_falso_quando_ollama_offline():
    with patch.object(embeddings.requests, "get", side_effect=embeddings.requests.exceptions.ConnectionError()):
        assert embeddings.modelo_disponivel() is False


def test_modelo_disponivel_falso_quando_modelo_nao_instalado():
    with patch.object(embeddings.requests, "get", return_value=_resp({"models": [{"name": "llama3.2:1b"}]})):
        assert embeddings.modelo_disponivel() is False


def test_ollama_tags_vazio_quando_offline():
    with patch.object(embeddings.requests, "get", side_effect=Exception("boom")):
        assert embeddings.ollama_tags() == []


# ─── salvar_matriz / carregar_matriz ────────────────────────────────────────

def test_salvar_e_carregar_matriz_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    vetores = [[float(i)] * embeddings.EMBED_DIM for i in range(3)]

    assert embeddings.salvar_matriz("projeto_teste", vetores) is True
    assert embeddings.embeddings_existe("projeto_teste") is True

    matriz = embeddings.carregar_matriz("projeto_teste", n_chunks_esperado=3)
    assert matriz is not None
    assert matriz.shape == (3, embeddings.EMBED_DIM)
    # Linhas devem estar L2-normalizadas (norma ~1, exceto linha 0 que é toda zero)
    for i in range(1, 3):
        assert np.isclose(np.linalg.norm(matriz[i]), 1.0, atol=1e-5)


def test_salvar_matriz_com_todas_linhas_none_nao_grava_nada(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    assert embeddings.salvar_matriz("projeto_vazio", [None, None]) is False
    assert embeddings.embeddings_existe("projeto_vazio") is False


def test_carregar_matriz_ausente_retorna_none(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    assert embeddings.carregar_matriz("projeto_inexistente") is None


def test_carregar_matriz_rejeita_meta_com_dim_divergente(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    vetores = [[0.1] * embeddings.EMBED_DIM]
    embeddings.salvar_matriz("projeto_dim", vetores)

    import json
    meta_path = embeddings._meta_path("projeto_dim")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    meta["dim"] = 999
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f)

    embeddings._matriz_cache.clear()
    assert embeddings.carregar_matriz("projeto_dim") is None


def test_carregar_matriz_rejeita_n_chunks_esperado_divergente(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    vetores = [[0.1] * embeddings.EMBED_DIM, [0.2] * embeddings.EMBED_DIM]
    embeddings.salvar_matriz("projeto_dessinc", vetores)
    embeddings._matriz_cache.clear()
    # índice principal tem 5 chunks agora, mas o .npy só cobre 2 (desatualizado)
    assert embeddings.carregar_matriz("projeto_dessinc", n_chunks_esperado=5) is None


# ─── buscar_vetorial ─────────────────────────────────────────────────────────

def test_buscar_vetorial_ordena_por_cosseno_e_ignora_nan(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))

    # 3 vetores conhecidos: v0 ortogonal-ish, v1 quase igual à query, v2 None (fica NaN)
    dim = embeddings.EMBED_DIM
    v0 = [0.0] * dim
    v0[0] = 1.0
    v1 = [0.0] * dim
    v1[1] = 1.0
    embeddings.salvar_matriz("projeto_busca", [v0, v1, None])
    embeddings._matriz_cache.clear()

    query_vetor = [0.0] * dim
    query_vetor[1] = 1.0  # igual a v1 → deve rankear primeiro

    with patch.object(embeddings, "gerar_embedding_query", return_value=query_vetor):
        resultado = embeddings.buscar_vetorial("pergunta", "projeto_busca", n_chunks_index=3, top_k=3)

    assert len(resultado) == 2  # linha NaN (índice 2) nunca aparece
    indices = [idx for idx, _score in resultado]
    assert indices[0] == 1
    assert resultado[0][1] > resultado[1][1]


def test_buscar_vetorial_vazio_quando_npy_ausente(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    assert embeddings.buscar_vetorial("pergunta", "projeto_sem_indice", n_chunks_index=10) == []


def test_buscar_vetorial_vazio_quando_ollama_indisponivel_na_query(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings, "INDEX_DIR", str(tmp_path))
    embeddings.salvar_matriz("projeto_ollama_off", [[0.1] * embeddings.EMBED_DIM])
    embeddings._matriz_cache.clear()

    with patch.object(embeddings, "gerar_embedding_query", return_value=None):
        assert embeddings.buscar_vetorial("pergunta", "projeto_ollama_off", n_chunks_index=1) == []
