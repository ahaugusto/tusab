# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.lance_store — armazenamento LanceDB dos chunks
indexados (substitui {prefixo}_index.json). Ver docstring do módulo para o
raciocínio de escopo (só storage, ranking continua BM25Okapi em memória).
"""
import os

from tusab_engine.agent import lance_store


def _chunk(titulo="t", texto="conteudo de teste " * 10, **overrides):
    base = {
        "texto": texto, "texto_original": texto, "titulo": titulo, "aba": "youtube",
        "data": "", "link": "", "tags": [], "descricao": "", "arquivo": "a.txt",
        "canal": "proj", "video_id": "", "views": 0, "timestamp_inicio": 0,
        "parte": 1, "total_partes": 1, "timestamp_aproximado": False,
    }
    base.update(overrides)
    return base


def _prep(tmp_path, monkeypatch):
    monkeypatch.setattr(lance_store, "INDEX_DIR", str(tmp_path), raising=False)


def test_gravar_chunks_e_carregar_chunks_roundtrip(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    chunks = [_chunk(titulo=f"Titulo {i}", tags=["a", "b"]) for i in range(3)]
    assert lance_store.gravar_chunks("proj", chunks) is True

    carregados = lance_store.carregar_chunks("proj")
    assert carregados is not None
    assert len(carregados) == 3
    assert {c["titulo"] for c in carregados} == {"Titulo 0", "Titulo 1", "Titulo 2"}
    assert carregados[0]["tags"] == ["a", "b"]


def test_carregar_chunks_tabela_inexistente_retorna_none(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    assert lance_store.carregar_chunks("nao_existe") is None


def test_gravar_chunks_lista_vazia_retorna_false_sem_gravar(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    assert lance_store.gravar_chunks("proj", []) is False
    assert lance_store.tabela_existe("proj") is False


def test_tabela_existe_reflete_gravacao(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    assert lance_store.tabela_existe("proj") is False
    lance_store.gravar_chunks("proj", [_chunk()])
    assert lance_store.tabela_existe("proj") is True


def test_mtime_none_quando_tabela_ausente(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    assert lance_store.mtime("proj") is None


def test_mtime_muda_apos_regravar(tmp_path, monkeypatch):
    import time
    _prep(tmp_path, monkeypatch)
    lance_store.gravar_chunks("proj", [_chunk()])
    m1 = lance_store.mtime("proj")
    assert m1 is not None
    time.sleep(0.05)
    lance_store.gravar_chunks("proj", [_chunk(titulo="outro")])
    m2 = lance_store.mtime("proj")
    assert m2 is not None and m2 >= m1


def test_regravar_substitui_conteudo_anterior(tmp_path, monkeypatch):
    """Rebuild completo (não append) — mesma semântica do salvar_json_atomico
    que esta função substitui: a segunda gravação apaga a primeira."""
    _prep(tmp_path, monkeypatch)
    lance_store.gravar_chunks("proj", [_chunk(titulo="Primeira versão")])
    lance_store.gravar_chunks("proj", [_chunk(titulo="Segunda versão")])
    chunks = lance_store.carregar_chunks("proj")
    assert len(chunks) == 1
    assert chunks[0]["titulo"] == "Segunda versão"


def test_remover_tabela_apaga_diretorio_e_meta(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    lance_store.gravar_chunks("proj", [_chunk()])
    lance_store.salvar_meta("proj", "Projeto Real", 123)
    assert lance_store.tabela_existe("proj")
    assert lance_store.carregar_meta("proj").get("projeto_nome") == "Projeto Real"

    lance_store.remover_tabela("proj")
    assert lance_store.tabela_existe("proj") is False
    assert lance_store.carregar_meta("proj") == {}


def test_remover_tabela_inexistente_nao_lanca(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    lance_store.remover_tabela("nunca_existiu")  # não deve lançar


def test_salvar_meta_e_carregar_meta_roundtrip(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    lance_store.salvar_meta("proj", "Ciência Hoje", 999)
    meta = lance_store.carregar_meta("proj")
    assert meta == {"projeto_nome": "Ciência Hoje", "indexed_at": 999}


def test_carregar_meta_ausente_retorna_dict_vazio(tmp_path, monkeypatch):
    _prep(tmp_path, monkeypatch)
    assert lance_store.carregar_meta("proj") == {}


def test_sanitizar_prefixo_bloqueia_path_traversal():
    assert "/" not in lance_store._sanitizar_prefixo("../../etc/passwd")
    assert ".." not in lance_store._sanitizar_prefixo("../../etc/passwd") or \
        lance_store._sanitizar_prefixo("../../etc/passwd") == "______etc_passwd"


def test_gravar_chunks_com_lancedb_indisponivel_retorna_false(tmp_path, monkeypatch):
    """Simula ImportError no import de lancedb dentro de gravar_chunks —
    degradação graciosa, nunca lança."""
    import builtins
    _prep(tmp_path, monkeypatch)

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "lancedb":
            raise ImportError("simulado")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    assert lance_store.gravar_chunks("proj", [_chunk()]) is False


def test_carregar_chunks_com_lancedb_indisponivel_retorna_none(tmp_path, monkeypatch):
    import builtins
    _prep(tmp_path, monkeypatch)
    lance_store.gravar_chunks("proj", [_chunk()])

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "lancedb":
            raise ImportError("simulado")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    assert lance_store.carregar_chunks("proj") is None


def test_normalizar_chunk_preenche_defaults_para_campos_ausentes():
    chunk_minimo = {"texto": "oi", "titulo": "t"}
    normalizado = lance_store._normalizar_chunk(chunk_minimo)
    assert normalizado["views"] == 0
    assert normalizado["timestamp_aproximado"] is False
    assert normalizado["tags"] == []
    assert normalizado["texto_original"] == ""


def test_gravar_chunks_com_campos_heterogeneos_nao_lanca(tmp_path, monkeypatch):
    """Chunk de vídeo YouTube (tem video_id/views) e chunk de documento (não
    tem) devem coexistir na mesma gravação sem erro de schema Arrow —
    _normalizar_chunk garante colunas homogêneas antes de pa.Table.from_pylist."""
    _prep(tmp_path, monkeypatch)
    chunk_youtube = _chunk(video_id="abc123", views=500, aba="youtube")
    chunk_doc = {
        "texto": "documento pdf", "texto_original": "documento pdf", "titulo": "Doc",
        "aba": "documento", "data": "", "link": "", "tags": [], "descricao": "",
        "arquivo": "d.txt", "canal": "proj",
    }
    assert lance_store.gravar_chunks("proj", [chunk_youtube, chunk_doc]) is True
    chunks = lance_store.carregar_chunks("proj")
    assert len(chunks) == 2
