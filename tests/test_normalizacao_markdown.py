# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine/agent/chat.py::_normalizar_markdown() e da sua
aplicação no caminho de streaming (_gerar_stream_com_fidelidade_numerica).

Bug real (31/ago/2026, ver agents/_historia.md): resposta sobre a Lei nº
14.344 saiu com bullets "- **Tópico**: texto" todos colados numa linha só,
sem quebra entre eles — legível como parágrafo corrido, não como lista.
_normalizar_markdown() já existia (criada em v1.0.26 pra esse mesmo padrão),
mas só era chamada em chat() síncrono, nunca em chat_stream() — mesma classe
de gap já corrigida para fidelidade numérica. Além disso, _RE_BOLD_INLINE
tinha bug próprio: duplicava o marcador de bullet ("-\n- **Tópico**...")
quando o bullet já vinha formatado como "- **Tópico**: ...".

Sem chamada de rede real — _gerar_resposta_llm é mockado.
"""
import importlib
from unittest.mock import patch

chat_mod = importlib.import_module("tusab_engine.agent.chat")


def test_normalizar_markdown_quebra_bullets_colados_com_hifen():
    texto = (
        "- **Lei nº 14.344 de 24/05/2022**: A Lei nº 14.344 é uma lei brasileira."
        "- **Objetivos**: O objetivo principal é proteger os direitos dos usuários."
        "- **Regras**: A Lei estabelece regras para a criação."
    )
    resultado = chat_mod._normalizar_markdown(texto)

    assert "\n\n- **Objetivos**" in resultado
    assert "\n\n- **Regras**" in resultado


def test_normalizar_markdown_nao_duplica_hifen_do_primeiro_bullet():
    """Achado real: _RE_BOLD_INLINE batia no espaço logo após o '-' do próprio
    bullet (já que '-' conta como não-espaço), inserindo um marcador extra
    ("-\\n- **Lei...**") no início do texto."""
    texto = "- **Lei nº 14.344 de 24/05/2022**: texto da lei."
    resultado = chat_mod._normalizar_markdown(texto)

    assert not resultado.startswith("-\n")
    assert resultado.startswith("- **Lei")


def test_normalizar_markdown_preserva_numeros_com_ponto():
    """'14.344' não pode ser tratado como fim de frase (o '.' interno ao
    número não deve disparar quebra de linha antes de '**')."""
    texto = "- **Lei nº 14.344**: texto sobre a lei 14.344 completo."
    resultado = chat_mod._normalizar_markdown(texto)

    assert "14.344" in resultado
    assert "14\n- .344" not in resultado  # nunca quebra dentro do número


def test_normalizar_markdown_idempotente_em_texto_ja_bem_formatado():
    texto = "- **Tópico A**: primeira ideia.\n\n- **Tópico B**: segunda ideia."
    resultado = chat_mod._normalizar_markdown(texto)
    assert resultado == texto


# ── Integração com o streaming ────────────────────────────────────────────────

def test_gerar_stream_com_fidelidade_numerica_tambem_normaliza_bullets_colados():
    contexto = [{"texto": "Decreto-Lei nº 1.001, de 21 de outubro de 1969"}]
    texto_colado = (
        "- **Decreto-Lei nº 1.001, de 21 de outubro de 1969**: primeira ideia."
        "- **Segundo tópico**: segunda ideia."
    )

    with patch.object(chat_mod, "_gerar_resposta_llm", return_value=texto_colado):
        pedacos = list(chat_mod._gerar_stream_com_fidelidade_numerica("ollama", "", "prompt", {}, contexto))

    texto_emitido = "".join(pedacos)
    assert "\n\n- **Segundo tópico**" in texto_emitido
    assert not texto_emitido.startswith("-\n")
