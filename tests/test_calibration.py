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


# ─── Ajuste por feedback negativo (👎) ──────────────────────────────────────────

def test_registrar_feedback_negativo_incrementa_contador(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    calibration.registrar_feedback_negativo("projeto_fb")
    calibration.registrar_feedback_negativo("projeto_fb")
    stats = calibration._carregar_feedback_stats("projeto_fb")
    assert stats["negativos_total"] == 2


def test_registrar_feedback_negativo_isolado_por_projeto(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    calibration.registrar_feedback_negativo("projeto_a")
    assert calibration._carregar_feedback_stats("projeto_b") == {}


def test_feedback_stats_ausente_retorna_dict_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    assert calibration._carregar_feedback_stats("projeto_sem_feedback") == {}


def test_calibrar_corpus_sem_feedback_nao_altera_n_candidatos(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    perfil = calibration._calibrar_corpus("projeto_sem_fb", [_chunk() for _ in range(100)])
    assert perfil["ajuste_por_feedback"] == 0
    assert perfil["n_candidatos_bm25"] == 12


def test_calibrar_corpus_aplica_ajuste_por_marco_de_10_negativos(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    for _ in range(23):  # 23 // 10 = 2 marcos
        calibration.registrar_feedback_negativo("projeto_fb2")

    perfil = calibration._calibrar_corpus("projeto_fb2", [_chunk() for _ in range(100)])
    assert perfil["feedback_negativos"] == 23
    assert perfil["ajuste_por_feedback"] == 16  # 2 marcos * 8
    assert perfil["n_candidatos_bm25"] == 12 + 16


def test_calibrar_corpus_ajuste_por_feedback_tem_teto(tmp_path, monkeypatch):
    # Muitos marcos não devem ultrapassar o teto de +24, mesmo com centenas de 👎.
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    stats_path = calibration._feedback_stats_path("projeto_muitos_fb")
    os.makedirs(os.path.dirname(stats_path), exist_ok=True)
    from tusab_engine.storage import salvar_json_atomico
    salvar_json_atomico({"negativos_total": 500}, stats_path, indent=2)

    perfil = calibration._calibrar_corpus("projeto_muitos_fb", [_chunk() for _ in range(100)])
    assert perfil["ajuste_por_feedback"] == 24


def test_ajuste_por_feedback_nunca_reduz_n_candidatos(tmp_path, monkeypatch):
    """Invariante: feedback negativo só amplia o pool do CrossEncoder, nunca
    reduz — não pode reintroduzir o padrão de corte já descartado (score_minimo)."""
    monkeypatch.setattr(calibration, "NEURAL_DIR", str(tmp_path))
    sem_feedback = calibration._calibrar_corpus("p_a", [_chunk() for _ in range(100)])
    for _ in range(50):
        calibration.registrar_feedback_negativo("p_b")
    com_feedback = calibration._calibrar_corpus("p_b", [_chunk() for _ in range(100)])
    assert com_feedback["n_candidatos_bm25"] >= sem_feedback["n_candidatos_bm25"]


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


# ─── Integração: POST /agent/feedback com util=False alimenta a calibragem ─────

def test_endpoint_feedback_negativo_incrementa_stats_do_projeto(client):
    """Ponta a ponta: POST /agent/feedback (util=False) precisa deixar o
    contador em disco no formato que _calibrar_corpus() espera consumir."""
    projeto = "projeto_feedback_endpoint"

    r = client.post("/agent/feedback", json={
        "projeto_nome": projeto,
        "pergunta": "pergunta de teste",
        "resposta": "resposta de teste",
        "util": False,
    })
    assert r.status_code == 200
    assert r.json() == {"ok": True, "action": "discarded"}

    stats = calibration._carregar_feedback_stats(projeto)
    assert stats["negativos_total"] == 1


def test_endpoint_feedback_util_true_nao_mexe_no_contador_negativo(client):
    projeto = "projeto_feedback_positivo"

    r = client.post("/agent/feedback", json={
        "projeto_nome": projeto,
        "pergunta": "pergunta de teste",
        "resposta": "resposta de teste",
        "util": True,
    })
    assert r.status_code == 200
    assert r.json().get("action") == "saved"

    assert calibration._carregar_feedback_stats(projeto) == {}
