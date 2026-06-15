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
    import motor_brainiac
    df = pd.DataFrame([{"ID": "abc123", "Status": "Sucesso"}])
    alvo = str(tmp_path / "base.csv")
    motor_brainiac.salvar_csv_atomico(df, alvo)
    assert os.path.exists(alvo)
    assert not os.path.exists(alvo + ".tmp")
    relido = pd.read_csv(alvo)
    assert relido.iloc[0]["ID"] == "abc123"


def test_salvar_json_atomico_sobrescreve_sem_corromper(client, tmp_path):
    import motor_brainiac
    alvo = str(tmp_path / "meta.json")
    motor_brainiac.salvar_json_atomico({"v": 1}, alvo)
    motor_brainiac.salvar_json_atomico({"v": 2}, alvo, indent=2)
    with open(alvo, encoding="utf-8") as f:
        assert json.load(f)["v"] == 2
    assert not os.path.exists(alvo + ".tmp")


def test_salvar_config_atomico(client):
    import agent_brainiac
    agent_brainiac.salvar_config({"provider": "ollama", "api_key": ""})
    assert os.path.exists(agent_brainiac.CONFIG_PATH)
    assert not os.path.exists(agent_brainiac.CONFIG_PATH + ".tmp")
    assert agent_brainiac.carregar_config()["provider"] == "ollama"


# ─── Índice corrompido → erro claro, não crash ────────────────────────────────

def test_indice_corrompido_gera_erro_orientando_reindexacao(client):
    import agent_brainiac
    canal = "canal_corrompido_teste"
    prefixo = "canal_corrompido_teste"
    os.makedirs(agent_brainiac.INDEX_DIR, exist_ok=True)
    idx = agent_brainiac._index_path(prefixo)
    with open(idx, "w", encoding="utf-8") as f:
        f.write('{"canal_nome": "x", "chunks": [TRUNCADO')  # JSON inválido

    try:
        with pytest.raises(ValueError, match="corrompido"):
            agent_brainiac._recuperar_contexto("pergunta", canal)
    finally:
        os.remove(idx)
        agent_brainiac._invalidar_cache(prefixo)


def test_indice_vazio_gera_erro_claro(client):
    import agent_brainiac
    canal = "canal_vazio_teste"
    prefixo = "canal_vazio_teste"
    os.makedirs(agent_brainiac.INDEX_DIR, exist_ok=True)
    idx = agent_brainiac._index_path(prefixo)
    with open(idx, "w", encoding="utf-8") as f:
        json.dump({"canal_nome": "x", "chunks": []}, f)

    try:
        with pytest.raises(ValueError, match="corrompido ou vazio"):
            agent_brainiac._recuperar_contexto("pergunta", canal)
    finally:
        os.remove(idx)
        agent_brainiac._invalidar_cache(prefixo)


# ─── Locks: escrita concorrente não perde incrementos ─────────────────────────

def test_log_redirector_concorrente_nao_perde_incrementos(client):
    import api_brainiac
    from brainiac_engine.state import LogRedirector
    state = api_brainiac.state

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
    import api_brainiac
    state = api_brainiac.state
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
