# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da confiança graduada por sentença (P1-e) —
tusab_engine/agent/chat.py::_calcular_confianca_por_sentenca().

Complementa _verificar_alucinacao() (binária) com um sinal graduado por
trecho — nunca substitui a checagem binária existente, só adiciona metadado.
"""
from tusab_engine.agent.chat import _calcular_confianca_por_sentenca


def test_confianca_vazia_sem_resposta_ou_contexto():
    assert _calcular_confianca_por_sentenca("", [{"texto": "algo"}]) == []
    assert _calcular_confianca_por_sentenca("resposta", []) == []


def test_confianca_separa_sentencas_corretamente():
    contexto = [{"texto": "juros compostos incidem sobre o valor acumulado"}]
    resposta = "Juros compostos incidem sobre o total. Isso é bem interessante mesmo."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert len(r) == 2
    assert r[0]["texto"].startswith("Juros compostos")
    assert r[1]["texto"].startswith("Isso é")


def test_confianca_alta_quando_sentenca_apoiada_pelo_corpus():
    contexto = [{"texto": "juros compostos incidem sobre valor acumulado investimento"}]
    resposta = "Juros compostos incidem sobre o valor acumulado do investimento."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert r[0]["confianca"] > 0.8


def test_confianca_baixa_quando_sentenca_nao_apoiada():
    contexto = [{"texto": "juros compostos incidem sobre valor acumulado"}]
    resposta = "Batatas fritas combinam perfeitamente com refrigerante gelado."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert r[0]["confianca"] < 0.3


def test_confianca_aceita_campo_texto_original():
    contexto = [{"texto_original": "juros compostos incidem sobre valor acumulado"}]
    resposta = "Juros compostos incidem sobre o valor acumulado."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert r[0]["confianca"] > 0.5


def test_confianca_aceita_campo_trecho_fontes_do_streaming():
    """Endpoint de streaming passa fontes já formatadas (campo 'trecho',
    não 'texto') — a função precisa aceitar os dois formatos."""
    contexto = [{"trecho": "juros compostos incidem sobre valor acumulado"}]
    resposta = "Juros compostos incidem sobre o valor acumulado."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert r[0]["confianca"] > 0.5


def test_confianca_offsets_batem_com_a_resposta_original():
    contexto = [{"texto": "conteúdo de apoio qualquer"}]
    resposta = "Primeira frase aqui. Segunda frase diferente."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    for item in r:
        assert resposta[item["inicio"]:item["fim"]] == item["texto"]


def test_confianca_sentenca_sem_palavras_verificaveis_recebe_1():
    """Sentença só com conectivos/números curtos (sem palavras de 5+ letras)
    não pode ser penalizada — não há o que verificar."""
    contexto = [{"texto": "qualquer coisa"}]
    resposta = "Ok."
    r = _calcular_confianca_por_sentenca(resposta, contexto)
    assert r[0]["confianca"] == 1.0
