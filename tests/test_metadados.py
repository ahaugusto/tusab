# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.metadados — Fase 2 do spec de roteamento
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Critério de aceite:
  - zero chamada de LLM pra obter o dado (só usa arquivo real)
  - base vazia ou summary.json ausente → degrada para None (BUSCA), sem exceção
  - contagem usa a MESMA fonte que GET /history (resumir_projetos_youtube),
    por construção não pode divergir da aba Relatório
"""
import os
import json
import pandas as pd

from tusab_engine.agent.metadados import (
    _classificar_pergunta_metadados, responder_metadados, _resumo_do_projeto,
)
from tusab_engine.storage import NEURAL_DIR, INDEX_DIR


def _criar_projeto_com_csv(prefixo: str, n_sucesso: int = 5, n_sem_legenda: int = 1):
    """Monta um projeto mínimo com CSV de gestão real, no mesmo formato que
    extraction.py grava — pra testar contra a mesma fonte que /history usa."""
    mgmt_dir = os.path.join(NEURAL_DIR, prefixo, 'management')
    os.makedirs(mgmt_dir, exist_ok=True)
    linhas = (
        [{'Status': 'Sucesso', 'Data_Extracao': '2026-08-10', 'Link': f'https://youtube.com/@{prefixo}/watch?v=x{i}'} for i in range(n_sucesso)]
        + [{'Status': 'Sem Legenda', 'Data_Extracao': '2026-08-11', 'Link': f'https://youtube.com/@{prefixo}'} for _ in range(n_sem_legenda)]
    )
    df = pd.DataFrame(linhas)
    csv_path = os.path.join(mgmt_dir, f'{prefixo}_base.csv')
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    return csv_path


# ── Classificador de pergunta ──────────────────────────────────────────────────

def test_classificar_pergunta_metadados_contagem_pt_en_es():
    assert _classificar_pergunta_metadados("quantos vídeos tem essa base?") == 'CONTAGEM'
    assert _classificar_pergunta_metadados("how many videos are indexed?") == 'CONTAGEM'
    assert _classificar_pergunta_metadados("¿cuántos videos hay?") == 'CONTAGEM'


def test_classificar_pergunta_metadados_recencia():
    assert _classificar_pergunta_metadados("qual o vídeo mais recente?") == 'RECENCIA'
    assert _classificar_pergunta_metadados("what's the latest video?") == 'RECENCIA'


def test_classificar_pergunta_metadados_indexacao():
    assert _classificar_pergunta_metadados("quando essa base foi indexada?") == 'INDEXACAO'
    assert _classificar_pergunta_metadados("when was this last indexed?") == 'INDEXACAO'


def test_classificar_pergunta_metadados_pergunta_tematica_retorna_none():
    # Falso positivo aqui seria pior que falso negativo — perguntas reais
    # sobre o CONTEÚDO nunca podem ser confundidas com pergunta de metadado.
    assert _classificar_pergunta_metadados("o que ele falou sobre a Selic em 2024?") is None
    assert _classificar_pergunta_metadados("resume o vídeo sobre bitcoin") is None
    assert _classificar_pergunta_metadados("como funciona o halving?") is None


# ── responder_metadados — degradação graciosa ─────────────────────────────────

def test_responder_metadados_pergunta_nao_e_metadado_retorna_none():
    assert responder_metadados("me explica o conteúdo do vídeo", "proj", "proj", "pt") is None


def test_responder_metadados_projeto_inexistente_degrada_para_none():
    # Sem CSV, sem summary.json — o executor não pode chutar um número.
    assert responder_metadados("quantos vídeos tem essa base?", "projeto_que_nao_existe_de_verdade", "projeto_que_nao_existe_de_verdade", "pt") is None


def test_responder_metadados_pergunta_indexacao_sem_indice_degrada_para_none(tmp_path, monkeypatch):
    # Projeto com CSV mas SEM {prefixo}_index.json — não há como responder
    # "quando foi indexado" sem inventar. Precisa cair pra None (BUSCA).
    prefixo = 'proj_sem_indice'
    _criar_projeto_com_csv(prefixo)
    resultado = responder_metadados("quando essa base foi indexada?", prefixo, prefixo, "pt")
    assert resultado is None


# ── responder_metadados — resposta real, com dado de verdade ─────────────────

def test_responder_metadados_contagem_usa_mesma_fonte_que_history():
    from tusab_engine.storage import resumir_projetos_youtube
    prefixo = 'proj_contagem_real'
    _criar_projeto_com_csv(prefixo, n_sucesso=7, n_sem_legenda=2)

    resposta = responder_metadados("quantos vídeos tem essa base?", prefixo, prefixo, "pt")
    assert resposta is not None
    assert "7" in resposta  # extraidos == Status == 'Sucesso'

    # Mesma fonte que GET /history (router_status.py) usa — por construção
    # não pode divergir do que a aba Relatório mostra pro mesmo projeto.
    historico = [r for r in resumir_projetos_youtube() if r['projeto'] == prefixo]
    assert historico[0]['extraidos'] == 7


def test_responder_metadados_recencia_com_dado_real():
    prefixo = 'proj_recencia_real'
    _criar_projeto_com_csv(prefixo, n_sucesso=3)
    resposta = responder_metadados("qual foi a extração mais recente?", prefixo, prefixo, "pt")
    assert resposta is not None
    assert "2026-08" in resposta


def test_responder_metadados_indexacao_com_indice_real():
    from tusab_engine.agent import lance_store
    import time

    prefixo = 'proj_indexacao_real'
    _criar_projeto_com_csv(prefixo, n_sucesso=2)
    os.makedirs(INDEX_DIR, exist_ok=True)
    chunk = {"texto": "conteudo", "texto_original": "conteudo", "titulo": "t", "aba": "documento",
             "data": "", "link": "", "tags": [], "descricao": "", "arquivo": "a.txt", "canal": prefixo}
    assert lance_store.gravar_chunks(prefixo, [chunk])
    lance_store.salvar_meta(prefixo, prefixo, int(time.time()))

    resposta = responder_metadados("quando essa base foi indexada?", prefixo, prefixo, "pt")
    assert resposta is not None
    assert prefixo in resposta


def test_responder_metadados_idioma_ingles_retorna_template_em_ingles():
    prefixo = 'proj_ingles'
    _criar_projeto_com_csv(prefixo, n_sucesso=4)
    resposta = responder_metadados("how many videos are there?", prefixo, prefixo, "en")
    assert resposta is not None
    assert "video" in resposta.lower()
    assert "vídeo" not in resposta.lower()


def test_resumo_do_projeto_agrega_multiplas_entradas_de_canal():
    # Um projeto pode ter mais de um _base.csv (multi-fonte) — o resumo
    # precisa somar, não pegar só o primeiro que encontrar.
    prefixo = 'proj_multi_canal'
    mgmt_dir = os.path.join(NEURAL_DIR, prefixo, 'management')
    os.makedirs(mgmt_dir, exist_ok=True)
    for canal in ('canalA', 'canalB'):
        df = pd.DataFrame([{'Status': 'Sucesso', 'Data_Extracao': '2026-08-10', 'Link': f'https://youtube.com/@{canal}'}] * 3)
        df.to_csv(os.path.join(mgmt_dir, f'{canal}_base.csv'), index=False, encoding='utf-8-sig')

    resumo = _resumo_do_projeto(prefixo)
    assert resumo['extraidos'] == 6


def test_responder_metadados_nunca_lanca_com_config_malformada():
    # projeto_prefixo com caracteres que poderiam quebrar glob/path — não
    # pode propagar exceção pro chamador, tem que degradar como qualquer
    # outro caso sem dado.
    resultado = responder_metadados("quantos vídeos tem?", None, None, "pt")
    assert resultado is None
