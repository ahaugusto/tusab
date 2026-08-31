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
import json
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


# ── Tabelas GFM coladas ────────────────────────────────────────────────────────
# Achado real (31/ago/2026): mesmo padrão de bullets colados, mas em tabelas —
# "| A | B || --- | --- || 1 | 2 |" sem quebra de linha entre as linhas da
# tabela. remark-gfm exige cada linha em uma linha própria; sem isso vira
# texto corrido com "|" literais em vez de tabela renderizada.

def test_normalizar_markdown_separa_linhas_de_tabela_coladas():
    texto = (
        "Aqui estão os resultados:"
        "| Dataset | RAG | Auxiliar |"
        "| --- | --- | --- |"
        "| COVID-19 | 74,3% | 92,1% |"
        "| Notícias | 72,1% | 89,6% |"
        "Os resultados mostram uma melhoria."
    )
    resultado = chat_mod._normalizar_markdown(texto)

    linhas_tabela = [l for l in resultado.split('\n') if l.strip().startswith('|')]
    assert len(linhas_tabela) == 4
    assert linhas_tabela[0] == "| Dataset | RAG | Auxiliar |"
    assert linhas_tabela[1] == "| --- | --- | --- |"
    assert linhas_tabela[2] == "| COVID-19 | 74,3% | 92,1% |"
    assert linhas_tabela[3] == "| Notícias | 72,1% | 89,6% |"
    # Texto antes/depois da tabela permanece fora dela, separado por linha em branco
    assert "resultados:\n\n|" in resultado
    assert "89,6% |\n\nOs resultados" in resultado


def test_normalizar_markdown_tabela_ja_formatada_e_idempotente():
    texto = "Resultado:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nFim."
    assert chat_mod._normalizar_markdown(texto) == texto


def test_normalizar_markdown_sem_pipe_nao_e_afetado():
    texto = "- **Tópico**: valor sem barra vertical nenhuma no meio do texto."
    resultado = chat_mod._normalizar_markdown(texto)
    assert "|" not in resultado


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


# ── Protocolo NDJSON do chat_stream() preserva '\n' embutido ──────────────────
# Achado real (30/ago/2026): chat_stream() emitia pedaços de resposta como
# TEXTO PURO (não-JSON). O router (router_agent.py::_gen) delimita mensagens
# por '\n', e o frontend faz buffer.split('\n') pra separar eventos — um
# chunk de texto puro com '\n' embutido (tabela/bullets já normalizados por
# _normalizar_markdown) quebrava em "linhas" falsas, perdendo a quebra
# original: a tabela chegava colada na tela mesmo com o backend corrigido.
# Todo yield de texto em chat_stream() agora é json.dumps({'texto': ...}) —
# o '\n' fica protegido dentro da string JSON.

def test_chat_stream_calculo_emite_texto_como_json_preservando_quebra_de_linha():
    texto_multilinha = "Resultado:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |"

    with patch.object(chat_mod, "responder_calculo", return_value=texto_multilinha), \
         patch.object(chat_mod, "carregar_config", return_value={"provider": "ollama"}):
        pedacos = list(chat_mod.chat_stream("quanto é 1+1", "ProjetoTeste"))

    # Nenhum yield de texto pode ser a string crua — todos devem ser JSON válido.
    textos_json = []
    for p in pedacos:
        obj = json.loads(p)  # levanta JSONDecodeError se algum yield voltar a ser texto puro
        if "texto" in obj:
            textos_json.append(obj["texto"])

    assert "".join(textos_json) == texto_multilinha
    assert "\n\n|" in "".join(textos_json)
