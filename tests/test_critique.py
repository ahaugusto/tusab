# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.critique — Fase 5 do spec de roteamento
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Critério de aceite:
  - retry automático não pode dobrar a latência p95 do caminho BUSCA no
    caminho feliz (contexto não vazio nunca dispara retry — coberto abaixo)
  - caso que hoje retorna sem_contexto mas a busca ampla acharia → passa a
    responder (coberto na integração de chat.py, ver test_router.py/smoke)
"""
from tusab_engine.agent import critique


# ── avaliar_relevancia_contexto — decisão de retry ───────────────────────────

def test_avaliar_relevancia_contexto_vazio_primeira_tentativa_sinaliza_retry():
    c = critique.avaliar_relevancia_contexto([], busca_ampla_ja_tentada=False)
    assert c.isrel == 0.0
    assert c.acao == 'retry_busca_ampla'


def test_avaliar_relevancia_contexto_vazio_apos_busca_ampla_desiste():
    c = critique.avaliar_relevancia_contexto([], busca_ampla_ja_tentada=True)
    assert c.acao == 'sem_contexto'


def test_avaliar_relevancia_contexto_nao_vazio_nunca_dispara_retry():
    # Caminho feliz — não pode custar latência extra nenhuma.
    c = critique.avaliar_relevancia_contexto([{'texto': 'algo'}], busca_ampla_ja_tentada=False)
    assert c.isrel == 1.0
    assert c.acao == 'ok'


# ── tem_lacuna_numerica ────────────────────────────────────────────────────────

def test_tem_lacuna_numerica_detecta_de_de():
    assert critique.tem_lacuna_numerica("Decreto-Lei nº., de de outubro de")


def test_tem_lacuna_numerica_texto_normal_nao_detecta():
    assert not critique.tem_lacuna_numerica("Decreto-Lei nº 1.001, de 21 de outubro de 1969")


# ── verificar_alucinacao (ISSUP) ──────────────────────────────────────────────

def test_verificar_alucinacao_trecho_injetado_nao_avalia():
    resposta, issup = critique.verificar_alucinacao("qualquer coisa", [], "projeto", trecho_injetado=True)
    assert resposta == "qualquer coisa"
    assert issup is None


def test_verificar_alucinacao_cobertura_baixa_substitui_resposta_e_retorna_issup():
    contexto = [{'texto': 'o gato subiu no telhado'}]
    resposta, issup = critique.verificar_alucinacao(
        "elefantes voadores dominam marte completamente", contexto, "meucanal",
    )
    assert "Não encontrei" in resposta
    assert issup is not None and issup < 0.12


def test_verificar_alucinacao_cobertura_alta_mantem_resposta():
    contexto = [{'texto': 'o mercado financeiro brasileiro teve volatilidade em agosto'}]
    resposta, issup = critique.verificar_alucinacao(
        "o mercado financeiro brasileiro teve volatilidade", contexto, "meucanal",
    )
    assert "Não encontrei" not in resposta
    assert issup is not None and issup >= 0.12


def test_verificar_alucinacao_frase_ja_nao_encontrado_nao_reavalia():
    resposta, issup = critique.verificar_alucinacao("não encontrei nada sobre isso", [{'texto': 'x'}], "c")
    assert issup is None


# ── avaliar_confianca_por_sentenca ────────────────────────────────────────────

def test_avaliar_confianca_por_sentenca_vazio_sem_contexto():
    assert critique.avaliar_confianca_por_sentenca("resposta", []) == []
    assert critique.avaliar_confianca_por_sentenca("", [{'texto': 'x'}]) == []


def test_avaliar_confianca_por_sentenca_retorna_offsets_validos():
    contexto = [{'texto': 'python é uma linguagem de programação popular'}]
    resposta = "Python é uma linguagem popular. Isso é interessante."
    resultado = critique.avaliar_confianca_por_sentenca(resposta, contexto)
    assert len(resultado) == 2
    for item in resultado:
        assert resposta[item['inicio']:item['fim']] == item['texto']
        assert 0.0 <= item['confianca'] <= 1.0
