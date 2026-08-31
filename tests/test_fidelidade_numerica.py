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


# ── _fatiar_para_pseudo_stream ────────────────────────────────────────────────
# Achado real (30/ago/2026): _gerar_com_fidelidade_numerica() nunca era chamada
# no caminho de streaming (chat_stream() emitia token a token direto do
# Ollama), então o retry de fidelidade numérica nunca corrigia o que o usuário
# via na tela. _gerar_stream_com_fidelidade_numerica() fecha esse gap: gera a
# resposta completa (com retry) e re-emite em pedaços — só pra Ollama sem
# 'mostrar_raciocinio', ver chat_stream().

def test_fatiar_para_pseudo_stream_preserva_texto_completo():
    texto = "A Lei nº 14.688, de 20 de setembro de 2023 altera o Código Penal Militar."
    pedacos = list(chat_mod._fatiar_para_pseudo_stream(texto))
    assert "".join(pedacos) == texto


def test_fatiar_para_pseudo_stream_gera_mais_de_um_pedaco_para_texto_longo():
    texto = " ".join(f"palavra{i}" for i in range(20))
    pedacos = list(chat_mod._fatiar_para_pseudo_stream(texto))
    assert len(pedacos) > 1


def test_fatiar_para_pseudo_stream_texto_vazio_nao_gera_pedacos():
    assert list(chat_mod._fatiar_para_pseudo_stream("")) == []


def test_fatiar_para_pseudo_stream_texto_curto_gera_um_pedaco():
    texto = "Oi tudo bem"
    pedacos = list(chat_mod._fatiar_para_pseudo_stream(texto, tamanho_grupo=10))
    assert len(pedacos) == 1
    assert pedacos[0] == texto


def test_fatiar_para_pseudo_stream_espera_entre_pedacos_mas_nao_antes_do_primeiro():
    """Achado real (31/ago/2026): sem atraso entre pedaços, o gerador é
    consumido pela rede em milissegundos e a resposta 'aparece de uma vez'
    em vez de parecer sendo digitada — exatamente o efeito que o pseudo-
    stream deveria evitar. time.sleep mockado para não gastar tempo real
    de execução da suíte."""
    texto = " ".join(f"palavra{i}" for i in range(12))  # 3 pedaços de 4 palavras
    with patch("time.sleep") as mock_sleep:
        pedacos = list(chat_mod._fatiar_para_pseudo_stream(texto))

    assert len(pedacos) == 3
    # 2 esperas entre os 3 pedaços — nunca antes do primeiro
    assert mock_sleep.call_count == 2
    for chamada in mock_sleep.call_args_list:
        assert chamada.args[0] == chat_mod._PSEUDO_STREAM_DELAY_SEGUNDOS


def test_fatiar_para_pseudo_stream_texto_com_um_pedaco_nao_espera():
    texto = "Oi tudo bem"
    with patch("time.sleep") as mock_sleep:
        list(chat_mod._fatiar_para_pseudo_stream(texto, tamanho_grupo=10))
    mock_sleep.assert_not_called()


# ── _gerar_stream_com_fidelidade_numerica ─────────────────────────────────────

def test_gerar_stream_com_fidelidade_numerica_corrige_lacuna_antes_de_emitir():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]
    respostas = iter([
        "Decreto-Lei nº., de de outubro de 1969.",          # 1a tentativa: com lacuna
        "Decreto-Lei nº 1.001, de 21 de outubro de 1969.",  # retry: corrigida
    ])

    with patch.object(chat_mod, "_gerar_resposta_llm", side_effect=lambda *a, **k: next(respostas)):
        pedacos = list(chat_mod._gerar_stream_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto))

    texto_emitido = "".join(pedacos)
    assert texto_emitido == "Decreto-Lei nº 1.001, de 21 de outubro de 1969."
    # A lacuna nunca deve aparecer em NENHUM pedaço emitido — é exatamente o
    # bug real que o usuário via na tela antes desta correção.
    assert not chat_mod.tem_lacuna_numerica(texto_emitido)


def test_gerar_stream_com_fidelidade_numerica_sem_contexto_nao_retenta():
    with patch.object(chat_mod, "_gerar_resposta_llm", return_value="Resposta direta.") as mock_gerar:
        pedacos = list(chat_mod._gerar_stream_com_fidelidade_numerica("ollama", "", "prompt", {}, []))

    assert mock_gerar.call_count == 1
    assert "".join(pedacos) == "Resposta direta."
