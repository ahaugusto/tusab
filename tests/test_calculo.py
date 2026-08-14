# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.calculo — Fase 3 do spec de roteamento
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Revisado por /seguranca em 14/ago/2026 — 2 correções obrigatórias aplicadas
(checagem de Pow antes de computar; checagem de tipo em Constant). Os testes
de payload malicioso abaixo cobrem exatamente os vetores achados nessa
revisão, não uma lista genérica — cada um tem uma exploração concreta por trás.

Critério de aceite do spec:
  - suite de payloads maliciosos (import, dunder, bomba de expoente, acesso
    a atributo) → todos rejeitados sem exceção não tratada
  - cálculo legítimo confere com resultado calculado à mão
  - falha de parse → degrada para BUSCA, silenciosamente
"""
import ast
import time

from tusab_engine.agent.calculo import (
    avaliar_expressao, responder_calculo, _extrair_expressao,
    _validar_e_contar_profundidade,
)


# ── Payloads maliciosos — cada um é a exploração concreta achada na revisão ──

def test_bomba_de_expoente_rejeitada_rapido_sem_travar():
    # Achado real da revisão de /seguranca: checar magnitude do RESULTADO de
    # Pow é tarde demais — Python tenta computar 9**(9**9) (~370 milhões de
    # dígitos) antes de qualquer check pós-resultado rodar. O fix precisa
    # rejeitar ANTES de executar **, então isso tem que voltar em < 1s.
    t0 = time.time()
    resultado = avaliar_expressao("9**9**9")
    dt = time.time() - t0
    assert resultado is None
    assert dt < 1.0, f"demorou {dt}s — o pre-check de Pow não está funcionando"


def test_bomba_de_expoente_variantes():
    for expr in ("99**99", "2**999999", "(-9)**9**9", "10**100**2"):
        assert avaliar_expressao(expr) is None, f"deveria rejeitar: {expr}"


def test_string_constant_nao_passa_na_validacao():
    # Defesa em profundidade: mesmo que algo (fora do matcher normal)
    # produza uma árvore com Constant de string, o avaliador não pode
    # tratar como número — 'a' * 999999999 seria memory bomb se aceito.
    arvore = ast.parse("'a' * 999999999", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_bool_constant_nao_passa_na_validacao():
    # bool é subclasse de int em Python — precisa ser rejeitado explicitamente.
    arvore = ast.parse("True + 1", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_name_lookup_rejeitado():
    # Sem ast.Name na whitelist — não há variável, não há lookup de nome,
    # então nem __builtins__ nem qualquer identificador é alcançável.
    arvore = ast.parse("__import__('os')", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_call_rejeitado():
    # Sem ast.Call na whitelist — nenhuma função é chamável, nem round/abs.
    arvore = ast.parse("abs(-5)", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_attribute_access_rejeitado():
    arvore = ast.parse("(1).__class__", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_subscript_rejeitado():
    arvore = ast.parse("[1,2,3][0]", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_lambda_rejeitado():
    arvore = ast.parse("(lambda: 1)()", mode='eval')
    assert not _validar_e_contar_profundidade(arvore, 0)


def test_arvore_muito_profunda_rejeitada():
    # 15 níveis de parênteses/soma > _MAX_DEPTH=10.
    expr = "1" + "+1" * 20
    assert avaliar_expressao(expr) is None


def test_expressao_muito_longa_rejeitada():
    expr = "1+" * 150 + "1"  # > _MAX_EXPR_LEN=200
    assert avaliar_expressao(expr) is None


def test_divisao_por_zero_retorna_none_sem_lancar():
    assert avaliar_expressao("10/0") is None
    assert avaliar_expressao("10%0") is None


def test_resultado_alem_do_limite_de_magnitude_rejeitado():
    assert avaliar_expressao("999999999999999 * 999999999999999") is None


# ── Cálculo legítimo — confere com resultado calculado à mão ─────────────────

def test_soma_simples():
    assert avaliar_expressao("2+2") == 4


def test_operacoes_mistas_com_parenteses():
    assert avaliar_expressao("(10+5)*2") == 30


def test_decimal():
    assert avaliar_expressao("15*3.5") == 52.5


def test_potencia_dentro_do_limite():
    assert avaliar_expressao("2**10") == 1024


def test_modulo():
    assert avaliar_expressao("17 % 5") == 2


def test_divisao_inteira():
    assert avaliar_expressao("17 // 5") == 3


def test_negativo_unario():
    assert avaliar_expressao("-5 + 10") == 5


# ── Matcher / extração da expressão ──────────────────────────────────────────

def test_extrair_expressao_remove_gatilho_pt():
    assert _extrair_expressao("quanto é 15 + 27?") == "15 + 27"
    assert _extrair_expressao("calcule (100-25)*2") == "(100-25)*2"


def test_extrair_expressao_remove_gatilho_en_es():
    assert _extrair_expressao("how much is 5 + 5?") == "5 + 5"
    assert _extrair_expressao("cuánto es 8 * 3?") == "8 * 3"


def test_extrair_expressao_pergunta_tematica_retorna_none():
    assert _extrair_expressao("me fala sobre o bitcoin") is None
    assert _extrair_expressao("qual o resultado da eleição?") is None  # tem letras — não é aritmética


def test_extrair_expressao_sem_operador_retorna_none():
    # "quanto é 42" sozinho não é uma operação — não deveria disparar a rota.
    assert _extrair_expressao("quanto é 42") is None


def test_extrair_expressao_numero_do_contexto_nao_e_possivel():
    # Não existe caminho pra número vindo de fora da pergunta — a função só
    # enxerga o texto que passa nela. Documentando a garantia arquitetural:
    # responder_calculo() nunca recebe contexto BM25 como argumento.
    import inspect
    assinatura = inspect.signature(responder_calculo)
    assert 'contexto' not in assinatura.parameters
    assert 'chunks' not in assinatura.parameters


# ── responder_calculo — degradação graciosa ───────────────────────────────────

def test_responder_calculo_pergunta_nao_e_calculo_retorna_none():
    assert responder_calculo("me explica o vídeo sobre bitcoin", "pt") is None


def test_responder_calculo_resposta_formatada_pt():
    resposta = responder_calculo("quanto é 15 + 27?", "pt")
    assert resposta is not None
    assert "42" in resposta


def test_responder_calculo_resultado_inteiro_sem_casas_decimais_espurias():
    resposta = responder_calculo("quanto é 10 / 2?", "pt")
    assert "5" in resposta
    assert "5.0" not in resposta


def test_responder_calculo_payload_malicioso_nunca_lanca():
    # Mesmo que o matcher de alguma forma deixasse passar algo malicioso,
    # responder_calculo() tem seu próprio try/except — nunca propaga exceção.
    for pergunta in ("quanto é 9**9**9", "calcule __import__('os')", "quanto é 1/0"):
        resultado = responder_calculo(pergunta, "pt")
        assert resultado is None
