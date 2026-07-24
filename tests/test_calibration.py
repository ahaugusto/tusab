# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da calibragem dinâmica de corpus (P0-c) — tusab_engine/agent/calibration.py.

Invariante crítica: nunca reintroduzir score_minimo (removido em v1.0.26,
ver agents/_historia.md) — a suite verifica explicitamente sua ausência.
"""
import json
import os

from tusab_engine.agent import calibration


def _chunk(aba='youtube', texto='conteúdo de teste ' * 10):
    return {'aba': aba, 'texto_original': texto, 'texto': texto}


def test_calibrar_corpus_vazio_retorna_dict_vazio():
    assert calibration._calibrar_corpus("projeto", []) == {}


def test_calibrar_corpus_nunca_inclui_score_minimo():
    """Invariante v1.0.26 — score_minimo (fixo ou adaptativo) foi removido
    deliberadamente. Qualquer reintrodução é regressão."""
    chunks = [_chunk() for _ in range(100)]
    perfil = calibration._calibrar_corpus("projeto", chunks)
    assert "score_minimo" not in perfil


def test_calibrar_corpus_identifica_tipo_dominante():
    chunks = [_chunk(aba='documento') for _ in range(8)] + [_chunk(aba='youtube') for _ in range(2)]
    perfil = calibration._calibrar_corpus("projeto", chunks)
    assert perfil["tipo_dominante"] == "documento"
    assert perfil["n_chunks_total"] == 10


def test_calibrar_corpus_n_candidatos_cresce_com_tamanho():
    pequeno = calibration._calibrar_corpus("p1", [_chunk() for _ in range(100)])
    medio   = calibration._calibrar_corpus("p2", [_chunk() for _ in range(2000)])
    grande  = calibration._calibrar_corpus("p3", [_chunk() for _ in range(6000)])

    assert pequeno["n_candidatos_bm25"] < medio["n_candidatos_bm25"] < grande["n_candidatos_bm25"]


def test_salvar_e_carregar_profile_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    chunks = [_chunk() for _ in range(50)]

    perfil_salvo = calibration._salvar_profile("projeto_teste", chunks)
    assert perfil_salvo["n_chunks_total"] == 50

    path = calibration._profile_path("projeto_teste")
    assert os.path.exists(path)
    with open(path, encoding="utf-8") as f:
        conteudo_disco = json.load(f)
    assert conteudo_disco == perfil_salvo

    perfil_lido = calibration._carregar_profile("projeto_teste")
    assert perfil_lido == perfil_salvo


def test_carregar_profile_ausente_retorna_dict_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    assert calibration._carregar_profile("projeto_inexistente") == {}


def test_salvar_profile_com_corpus_vazio_nao_cria_arquivo(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    perfil = calibration._salvar_profile("projeto_vazio", [])
    assert perfil == {}
    assert not os.path.exists(calibration._profile_path("projeto_vazio"))


# ─── Integração: indexar() real persiste o perfil ──────────────────────────────

def test_indexar_persiste_corpus_profile_de_verdade():
    """indexar() real (sem mock) deve deixar um corpus_profile.json válido —
    usa o TUSAB_DATA_DIR isolado já configurado pelo conftest.py."""
    from tusab_engine.agent import index as index_mod
    from tusab_engine.storage import NEURAL_DIR

    prefixo = "projeto_calibracao_teste"
    youtube_dir = os.path.join(NEURAL_DIR, prefixo, "youtube", "canal_x")
    os.makedirs(youtube_dir, exist_ok=True)
    conteudo = (
        "TITULO: Video teste calibracao\n"
        "ABA: youtube\nDATA: 01/01/2026\nLINK: https://youtube.com/watch?v=xyz\n"
        "TAGS: teste\nVIDEO_ID: xyz\nVIEWS: 5\nTIMESTAMP_INICIO: 0\n"
        + "-" * 60 + "\n"
        + ("Conteúdo de calibração de teste. " * 15)
    )
    with open(os.path.join(youtube_dir, "canal_x_video0.txt"), "w", encoding="utf-8") as f:
        f.write(conteudo)

    index_mod.indexar("Canal X", prefixo)

    perfil = calibration._carregar_profile(prefixo)
    assert perfil.get("n_chunks_total", 0) >= 1
    assert "score_minimo" not in perfil
