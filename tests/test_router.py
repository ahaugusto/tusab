# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.router — Fase 0 da formalização do roteamento
de intenção ("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Critério de aceite da Fase 0 (cobrindo, com LLM mockado):
  - saudação → CONVERSA
  - trecho injetado → TRECHO
  - exceção do provider (classificação) → BUSCA
  - histórico vazio → BUSCA
  - CONTEXTO sem last_chat_response → degrada para BUSCA
"""
import concurrent.futures as _cf
from unittest.mock import patch

from tusab_engine.agent import router


def _future_com_resultado(valor):
    """Future já resolvido, sem precisar de thread real — imita
    iniciar_classificacao_intencao() já concluído no momento de rotear()."""
    f = _cf.Future()
    f.set_result(valor)
    return f


def _future_com_excecao():
    f = _cf.Future()
    f.set_exception(RuntimeError("provider indisponível"))
    return f


# ── extrair_trecho_injetado ───────────────────────────────────────────────────

def test_extrair_trecho_injetado_reconhece_formato_arquivo():
    arquivo, conteudo = router.extrair_trecho_injetado("[relatorio.pdf]\nEste é o conteúdo do trecho.")
    assert arquivo == "relatorio.pdf"
    assert conteudo == "Este é o conteúdo do trecho."


def test_extrair_trecho_injetado_sem_match_retorna_none():
    arquivo, conteudo = router.extrair_trecho_injetado("qual o resumo do vídeo sobre bitcoin?")
    assert arquivo is None
    assert conteudo is None


# ── rotear() — critério de aceite da Fase 0 ───────────────────────────────────

def test_rotear_saudacao_forca_conversa_mesmo_com_future_busca():
    # O classificador (future) diz BUSCA, mas "oi" está em _SAUDACOES —
    # o override de saudação deve vencer, exatamente como no comportamento herdado.
    rota = router.rotear(
        "oi", historico=[{'role': 'user', 'content': 'msg anterior'}], config={},
        sinais={'intencao_future': _future_com_resultado('BUSCA')},
    )
    assert rota.nome == 'CONVERSA'
    assert rota.precisa_retrieval is False


def test_rotear_trecho_injetado_retorna_rota_trecho_sem_consultar_future():
    # arq_injetado presente → TRECHO imediato, nem olha o future (simula não
    # ter sido passado, como o caller faz de verdade quando trecho_mode=True).
    rota = router.rotear(
        "[arquivo.txt]\nconteúdo", historico=[], config={},
        sinais={'arq_injetado': 'arquivo.txt'},
    )
    assert rota.nome == 'TRECHO'
    assert rota.precisa_retrieval is False


def test_rotear_excecao_do_provider_degrada_para_busca():
    rota = router.rotear(
        "pergunta nova sobre o conteúdo", historico=[{'role': 'user', 'content': 'oi'}], config={},
        sinais={'intencao_future': _future_com_excecao()},
    )
    assert rota.nome == 'BUSCA'
    assert rota.precisa_retrieval is True


def test_rotear_sem_future_e_sem_historico_e_busca():
    rota = router.rotear("pergunta qualquer", historico=[], config={}, sinais={})
    assert rota.nome == 'BUSCA'


def test_rotear_contexto_sem_ultima_resposta_degrada_para_busca():
    rota = router.rotear(
        "traduz isso pra inglês", historico=[{'role': 'user', 'content': 'oi'}], config={},
        sinais={'intencao_future': _future_com_resultado('CONTEXTO'), 'ultima_resposta': {}},
    )
    assert rota.nome == 'BUSCA'


def test_rotear_contexto_com_ultima_resposta_mantem_contexto():
    rota = router.rotear(
        "traduz isso pra inglês", historico=[{'role': 'user', 'content': 'oi'}], config={},
        sinais={
            'intencao_future': _future_com_resultado('CONTEXTO'),
            'ultima_resposta': {'resposta': 'resposta anterior', 'fontes': []},
        },
    )
    assert rota.nome == 'CONTEXTO'
    assert rota.precisa_retrieval is False


def test_rotear_trechos_fixados_forca_busca_mesmo_se_classificador_disser_conversa():
    rota = router.rotear(
        "e sobre isso, o que você acha?", historico=[{'role': 'user', 'content': 'oi'}], config={},
        sinais={'intencao_future': _future_com_resultado('CONVERSA'), 'trechos_fixados': [{'texto': 'x'}]},
    )
    assert rota.nome == 'BUSCA'


def test_rotear_nunca_lanca_mesmo_com_sinais_malformados():
    # sinais.get() em algo que não é dict deveria estourar — rotear() precisa
    # engolir isso e cair no fallback, nunca propagar a exceção pro chamador.
    rota = router.rotear("pergunta", historico=[], config={}, sinais=None)
    assert rota.nome == 'BUSCA'


def test_rotear_intencao_desconhecida_do_classificador_cai_para_busca():
    # Defesa em profundidade: se o LLM devolver algo fora do enum esperado
    # (não deveria, mas _classificar_intencao já normaliza), rotear() não quebra.
    rota = router.rotear(
        "pergunta", historico=[{'role': 'user', 'content': 'oi'}], config={},
        sinais={'intencao_future': _future_com_resultado('ALGO_INESPERADO')},
    )
    assert rota.nome == 'BUSCA'


# ── _classificar_intencao — preservado de test_llm_client_factory.py-style ───

def test_classificar_intencao_sem_historico_e_busca_sem_chamar_llm():
    with patch('tusab_engine.agent.router._get_llm_client') as mock_client:
        resultado = router._classificar_intencao("pergunta", historico=[], config={'provider': 'openai'})
    assert resultado == 'BUSCA'
    mock_client.assert_not_called()


def test_classificar_intencao_provider_desconhecido_retorna_busca():
    resultado = router._classificar_intencao(
        "pergunta", historico=[{'role': 'user', 'content': 'oi'}], config={'provider': 'inexistente'},
    )
    assert resultado == 'BUSCA'


def test_classificar_intencao_excecao_do_client_retorna_busca():
    with patch('tusab_engine.agent.router._get_llm_client', side_effect=RuntimeError("boom")):
        resultado = router._classificar_intencao(
            "pergunta", historico=[{'role': 'user', 'content': 'oi'}], config={'provider': 'openai'},
        )
    assert resultado == 'BUSCA'


# ── iniciar_classificacao_intencao — integração real com o executor ─────────

def test_iniciar_classificacao_intencao_retorna_future_resolvivel():
    with patch('tusab_engine.agent.router._get_llm_client') as mock_client:
        mock_client.return_value = (None, None)  # provider desconhecido cai antes de usar isso
        future = router.iniciar_classificacao_intencao("pergunta", [], {'provider': 'inexistente'})
        assert future.result(timeout=5) == 'BUSCA'


# ── pre_rotear() — Fase 1: pré-roteamento determinístico ─────────────────────
# Critério de aceite do spec: suite rotulada pt/en/es com PRECISÃO 100% nos
# matchers (falso positivo é pior que falso negativo — recall baixo é aceitável
# por design, ver docstring de pre_rotear()).

_FRASES_SAUDACAO = [
    # PT-BR
    "oi", "Olá", "opa", "bom dia", "boa tarde!", "boa noite.", "tudo bem?",
    "como vai", "e aí", "salve", "fala aí",
    # EN
    "hi", "Hello!", "hey", "good morning", "how are you?", "what's up", "sup",
    # ES
    "hola", "buenas", "buenos días", "¿qué tal?", "cómo estás", "saludos",
    # Neutras
    "teste", "ok", "ping",
]

_FRASES_NAO_SAUDACAO = [
    # PT-BR — perguntas reais que não podem virar CONVERSA por engano
    "qual foi o resultado do último balanço da empresa?",
    "resuma o vídeo sobre inflação",
    "quantos vídeos tem nessa base?",
    "o que ele falou sobre bitcoin em 2024?",
    "explica de novo isso, mas mais simples",
    "traduz a resposta anterior pra inglês",
    "boa análise sobre a selic essa",  # contém "boa" mas não é saudação isolada
    # EN
    "what did she say about interest rates?",
    "summarize the last video",
    "how does the halving affect bitcoin price?",
    # ES
    "¿cuál es el resumen del video sobre economía?",
    "explica de nuevo con más detalle",
    "¿cómo funciona el bitcoin?",  # contém "cómo" mas é pergunta temática real
]


def test_pre_rotear_precisao_100_por_cento_em_frases_de_saudacao():
    for frase in _FRASES_SAUDACAO:
        rota = router.pre_rotear(frase, sinais={})
        assert rota is not None and rota.nome == 'CONVERSA', f"falhou para: {frase!r}"


def test_pre_rotear_nao_confunde_pergunta_real_com_saudacao():
    for frase in _FRASES_NAO_SAUDACAO:
        rota = router.pre_rotear(frase, sinais={})
        assert rota is None, f"falso positivo em: {frase!r} -> {rota}"


def test_pre_rotear_trecho_injetado_vence_qualquer_outro_matcher():
    rota = router.pre_rotear("oi", sinais={'arq_injetado': 'notas.txt'})
    assert rota.nome == 'TRECHO'


def test_pre_rotear_trechos_fixados_impede_saudacao_virar_conversa():
    # Mesma precedência de rotear(): trecho fixado pelo usuário (@@) nunca
    # pode ser descartado silenciosamente por um "oi" solto na mensagem.
    rota = router.pre_rotear("oi", sinais={'trechos_fixados': [{'texto': 'x'}]})
    assert rota is None  # cai pro classificador, que aplicará o mesmo override


def test_pre_rotear_sem_sinais_nao_lanca():
    rota = router.pre_rotear("oi")
    assert rota.nome == 'CONVERSA'


def test_pre_rotear_nunca_lanca_com_pergunta_vazia():
    assert router.pre_rotear("", sinais={}) is None
    assert router.pre_rotear("   ", sinais={}) is None
