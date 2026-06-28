# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do sprint de confiabilidade:
escrita atômica (CSV/JSON), validação de índice corrompido e locks.
"""
import json
import os
import threading

import pandas as pd
import pytest


# ─── Escrita atômica ──────────────────────────────────────────────────────────

def test_salvar_csv_atomico_escreve_e_nao_deixa_tmp(client, data_dir, tmp_path):
    import motor_tusab
    df = pd.DataFrame([{"ID": "abc123", "Status": "Sucesso"}])
    alvo = str(tmp_path / "base.csv")
    motor_tusab.salvar_csv_atomico(df, alvo)
    assert os.path.exists(alvo)
    assert not os.path.exists(alvo + ".tmp")
    relido = pd.read_csv(alvo)
    assert relido.iloc[0]["ID"] == "abc123"


def test_salvar_json_atomico_sobrescreve_sem_corromper(client, tmp_path):
    import motor_tusab
    alvo = str(tmp_path / "meta.json")
    motor_tusab.salvar_json_atomico({"v": 1}, alvo)
    motor_tusab.salvar_json_atomico({"v": 2}, alvo, indent=2)
    with open(alvo, encoding="utf-8") as f:
        assert json.load(f)["v"] == 2
    assert not os.path.exists(alvo + ".tmp")


def test_salvar_config_atomico(client):
    import agent_tusab
    agent_tusab.salvar_config({"provider": "ollama", "api_key": ""})
    assert os.path.exists(agent_tusab.CONFIG_PATH)
    assert not os.path.exists(agent_tusab.CONFIG_PATH + ".tmp")
    assert agent_tusab.carregar_config()["provider"] == "ollama"


# ─── Índice corrompido → erro claro, não crash ────────────────────────────────

def test_indice_corrompido_gera_erro_orientando_reindexacao(client):
    import agent_tusab
    canal = "canal_corrompido_teste"
    prefixo = "canal_corrompido_teste"
    os.makedirs(agent_tusab.INDEX_DIR, exist_ok=True)
    idx = agent_tusab._index_path(prefixo)
    with open(idx, "w", encoding="utf-8") as f:
        f.write('{"canal_nome": "x", "chunks": [TRUNCADO')  # JSON inválido

    try:
        with pytest.raises(ValueError, match="corrompido"):
            agent_tusab._recuperar_contexto("pergunta", canal)
    finally:
        os.remove(idx)
        agent_tusab._invalidar_cache(prefixo)


def test_indice_vazio_gera_erro_claro(client):
    import agent_tusab
    canal = "canal_vazio_teste"
    prefixo = "canal_vazio_teste"
    os.makedirs(agent_tusab.INDEX_DIR, exist_ok=True)
    idx = agent_tusab._index_path(prefixo)
    with open(idx, "w", encoding="utf-8") as f:
        json.dump({"canal_nome": "x", "chunks": []}, f)

    try:
        with pytest.raises(ValueError, match="corrompido ou vazio"):
            agent_tusab._recuperar_contexto("pergunta", canal)
    finally:
        os.remove(idx)
        agent_tusab._invalidar_cache(prefixo)


# ─── Locks: escrita concorrente não perde incrementos ─────────────────────────

def test_log_redirector_concorrente_nao_perde_incrementos(client):
    import api_tusab
    from tusab_engine.state import LogRedirector
    state = api_tusab.state

    with state.state_lock:
        state.stats["videos_processed"] = 0
        state.stats["videos_total"] = 0

    redirector = LogRedirector()
    N_THREADS, N_WRITES = 8, 50

    def escreve():
        for _ in range(N_WRITES):
            redirector.write("✅ OK! (2026-01-01)")

    threads = [threading.Thread(target=escreve) for _ in range(N_THREADS)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert state.stats["videos_processed"] == N_THREADS * N_WRITES

    with state.state_lock:
        state.stats["videos_processed"] = 0
        state.logs.clear()


def test_chat_histories_concorrente_sem_excecao(client):
    """Leitura/escrita/limpeza simultâneas do histórico não podem lançar exceção."""
    import api_tusab
    state = api_tusab.state
    erros = []

    def escreve(i):
        try:
            for j in range(100):
                with state.hist_lock:
                    state.chat_histories[f"canal{i}"] = [{"role": "user", "content": str(j)}]
                with state.hist_lock:
                    state.chat_histories.pop(f"canal{i}", None)
        except Exception as e:  # pragma: no cover
            erros.append(e)

    threads = [threading.Thread(target=escreve, args=(i,)) for i in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert not erros


# ── _vtt_por_capitulo ─────────────────────────────────────────────────────────

def test_vtt_por_capitulo_sem_arquivo_retorna_lista_com_um_item(tmp_path):
    from tusab_engine.motor.extraction import _vtt_por_capitulo
    resultado = _vtt_por_capitulo(str(tmp_path / "inexistente.vtt"), [])
    assert isinstance(resultado, list)
    assert len(resultado) == 1


def test_vtt_por_capitulo_sem_capitulos_retorna_lista_com_um_item(tmp_path):
    from tusab_engine.motor.extraction import _vtt_por_capitulo
    vtt = tmp_path / "v.vtt"
    vtt.write_text("WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nOlá mundo\n", encoding="utf-8")
    resultado = _vtt_por_capitulo(str(vtt), [])
    assert len(resultado) == 1
    assert resultado[0]["capitulo"] == ""


def test_vtt_por_capitulo_um_capitulo_retorna_segmento(tmp_path):
    from tusab_engine.motor.extraction import _vtt_por_capitulo
    vtt = tmp_path / "v.vtt"
    vtt.write_text(
        "WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nIntrodução\n\n00:00:11.000 --> 00:00:20.000\nDesenvolvimento\n",
        encoding="utf-8"
    )
    caps = [{"start_time": 0, "title": "Intro"}, {"start_time": 10, "title": "Dev"}]
    resultado = _vtt_por_capitulo(str(vtt), caps)
    assert len(resultado) >= 1
    for seg in resultado:
        assert "texto" in seg
        assert "capitulo" in seg


# ── _deduplicar_chunks ────────────────────────────────────────────────────────

def test_deduplicar_chunks_remove_duplicata_exata(client):
    from tusab_engine.agent.chat import _deduplicar_chunks
    chunks = [
        {"texto": "inteligência artificial aprendizado de máquina redes neurais", "score": 1.0},
        {"texto": "inteligência artificial aprendizado de máquina redes neurais", "score": 0.9},
        {"texto": "mercado financeiro bolsa de valores investimentos", "score": 0.8},
    ]
    resultado = _deduplicar_chunks(chunks, n=3, threshold=0.85)
    textos = [r["texto"] for r in resultado]
    assert len(resultado) == 2
    assert textos[0] == chunks[0]["texto"]


def test_deduplicar_chunks_preserva_diversidade(client):
    from tusab_engine.agent.chat import _deduplicar_chunks
    chunks = [
        {"texto": "python programação backend apis rest fastapi", "score": 1.0},
        {"texto": "javascript frontend react componentes hooks", "score": 0.9},
        {"texto": "banco de dados sql postgresql queries index", "score": 0.8},
    ]
    resultado = _deduplicar_chunks(chunks, n=3, threshold=0.85)
    assert len(resultado) == 3


def test_deduplicar_chunks_fallback_corpus_vazio(client):
    from tusab_engine.agent.chat import _deduplicar_chunks
    resultado = _deduplicar_chunks([], n=3, threshold=0.85)
    assert resultado == []
