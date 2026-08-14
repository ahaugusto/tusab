# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da correção de fidelidade numérica no chat —
tusab_engine/agent/critique.py::tem_lacuna_numerica() +
tusab_engine/agent/chat.py::_gerar_com_fidelidade_numerica().

Bug real (29/jul/2026, ver agents/_historia.md): llama3.2:1b apagava
números/datas ao parafrasear chunk denso ("Decreto-Lei nº 1.001, de 21 de
outubro de 1969" virava "Decreto-Lei nº., de de outubro de"). Sem chamada
de rede real — _gerar_resposta_llm é mockado.
"""
import importlib
from unittest.mock import patch

from tusab_engine.agent.critique import tem_lacuna_numerica as _tem_lacuna_numerica
from tusab_engine.agent.chat import _gerar_com_fidelidade_numerica

# import tusab_engine.agent.chat as chat_mod resolveria a FUNÇÃO chat, não o
# módulo — tusab_engine/agent/__init__.py faz "from .chat import chat", que
# sombreia o atributo "chat" do pacote pai (usado pela resolução de "import
# a.b.c as x", que é via atributo, não sys.modules direto).
chat_mod = importlib.import_module("tusab_engine.agent.chat")


def test_tem_lacuna_numerica_detecta_de_de():
    assert _tem_lacuna_numerica("Decreto-Lei nº., de de outubro de 1969")


def test_tem_lacuna_numerica_detecta_no_seguido_de_pontuacao():
    assert _tem_lacuna_numerica("A Lei nº., assinada em março")


def test_tem_lacuna_numerica_falso_quando_numero_presente():
    assert not _tem_lacuna_numerica("Decreto-Lei nº 1.001, de 21 de outubro de 1969")


def test_tem_lacuna_numerica_nao_falseia_positivo_em_texto_normal():
    assert not _tem_lacuna_numerica("O relatório de vendas de outubro foi positivo.")


def test_retenta_uma_vez_quando_primeira_resposta_tem_lacuna():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]
    respostas = iter([
        "Decreto-Lei nº., de de outubro de 1969.",          # 1a tentativa: com lacuna
        "Decreto-Lei nº 1.001, de 21 de outubro de 1969.",  # retry: corrigida
    ])

    with patch.object(chat_mod, "_gerar_resposta_llm", side_effect=lambda *a, **k: next(respostas)) as mock_gerar:
        resposta = _gerar_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto)

    assert resposta == "Decreto-Lei nº 1.001, de 21 de outubro de 1969."
    assert mock_gerar.call_count == 2


def test_nao_retenta_quando_primeira_resposta_ja_esta_correta():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]

    with patch.object(chat_mod, "_gerar_resposta_llm", return_value="Decreto-Lei nº 1.001, de 21 de outubro de 1969.") as mock_gerar:
        resposta = _gerar_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto)

    assert mock_gerar.call_count == 1
    assert resposta == "Decreto-Lei nº 1.001, de 21 de outubro de 1969."


def test_nao_retenta_sem_contexto():
    with patch.object(chat_mod, "_gerar_resposta_llm", return_value="Decreto-Lei nº., de de outubro.") as mock_gerar:
        resposta = _gerar_com_fidelidade_numerica("ollama", "", "prompt", {}, [])

    assert mock_gerar.call_count == 1
    assert resposta == "Decreto-Lei nº., de de outubro."


def test_mantem_resposta_original_se_retry_tambem_falhar():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]
    with patch.object(chat_mod, "_gerar_resposta_llm", return_value="Decreto-Lei nº., de de outubro.") as mock_gerar:
        resposta = _gerar_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto)

    assert mock_gerar.call_count == 2
    assert resposta == "Decreto-Lei nº., de de outubro."  # pior que nada, mas não trava o chat


def test_nao_derruba_chat_se_retry_lancar_excecao():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]
    respostas = iter([
        "Decreto-Lei nº., de de outubro.",
    ])

    def fake_gerar(*a, **k):
        try:
            return next(respostas)
        except StopIteration:
            raise ConnectionError("Ollama indisponível")

    with patch.object(chat_mod, "_gerar_resposta_llm", side_effect=fake_gerar):
        resposta = _gerar_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto)

    assert resposta == "Decreto-Lei nº., de de outubro."
