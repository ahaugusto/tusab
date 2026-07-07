# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do TTS local (Pocket TTS) — feature reservada à build Beta/Enterprise.
Sem chamada de síntese real (evita baixar pesos de modelo em CI).
"""
from unittest.mock import patch

from tusab_engine.agent import tts as tts_mod


def test_limpar_para_audio_remove_markdown():
    texto = "# Resumo\n\n**Tema central**: Testes.\n\n- Ponto 1\n- Ponto 2\n\nConclusao final."
    limpo = tts_mod.limpar_para_audio(texto)
    assert "#" not in limpo
    assert "**" not in limpo
    assert "- Ponto" not in limpo
    assert "Ponto 1" in limpo
    assert "Conclusao final" in limpo


def test_tts_status_endpoint_retorna_bool(client):
    r = client.get("/agent/tts/status")
    assert r.status_code == 200
    assert isinstance(r.json().get("disponivel"), bool)


def test_agent_tts_retorna_erro_quando_stack_ausente(client):
    with patch.object(tts_mod, "tts_disponivel", return_value=False):
        r = client.post("/agent/tts", json={"texto": "Ola mundo"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True
    assert "Beta/Enterprise" in body.get("message", "") or "não disponível" in body.get("message", "").lower()


def test_agent_tts_rejeita_texto_vazio(client):
    r = client.post("/agent/tts", json={"texto": ""})
    assert r.status_code == 422  # Pydantic Field(min_length=1)
