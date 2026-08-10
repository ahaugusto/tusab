# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.chat::_get_llm_client() — fábrica única de
cliente LLM por provider, que substituiu a construção de client+modelo
duplicada em 5 pontos do módulo (_expandir_query, _classificar_intencao,
_responder_sem_contexto, _gerar_resposta_llm, chat_stream).

Sem chamada de rede real. OpenAI/Anthropic/Groq/custom só instanciam o
client (nunca chamam a rede na construção) — seguro chamar de verdade.
Gemini chama _genai.list_models() na resolução do modelo — mockado.
"""
import importlib
from unittest.mock import MagicMock, patch

# `from tusab_engine.agent import chat as chat_mod` pegaria a FUNÇÃO `chat`
# reexportada por tusab_engine/agent/__init__.py, não o módulo — mesmo nome,
# sombreamento real. importlib pega o módulo direto, sem ambiguidade.
chat_mod = importlib.import_module('tusab_engine.agent.chat')


def test_get_llm_client_openai_retorna_modelo_padrao():
    client, modelo = chat_mod._get_llm_client('openai', 'sk-fake', {})
    assert modelo == chat_mod._MODELO_OPENAI
    assert client.api_key == 'sk-fake'


def test_get_llm_client_anthropic_auxiliar_usa_haiku():
    client, modelo = chat_mod._get_llm_client('anthropic', 'sk-fake', {}, principal=False)
    assert modelo == chat_mod._MODELO_ANTHROPIC_AUXILIAR
    assert 'haiku' in modelo


def test_get_llm_client_anthropic_principal_usa_sonnet():
    client, modelo = chat_mod._get_llm_client('anthropic', 'sk-fake', {}, principal=True)
    assert modelo == chat_mod._MODELO_ANTHROPIC_PRINCIPAL
    assert 'sonnet' in modelo


def test_get_llm_client_groq_delega_para_client_openai_compat():
    client, modelo = chat_mod._get_llm_client('groq', 'gsk-fake', {'groq_model': 'llama-3.1-8b-instant'})
    assert modelo == 'llama-3.1-8b-instant'
    assert str(client.base_url).startswith('https://api.groq.com')


def test_get_llm_client_custom_usa_base_url_e_modelo_do_config():
    config = {'custom_base_url': 'http://localhost:20128/v1', 'custom_model': 'qwen3:4b'}
    client, modelo = chat_mod._get_llm_client('custom', '', config)
    assert modelo == 'qwen3:4b'
    assert str(client.base_url).startswith('http://localhost:20128')


def test_get_llm_client_gemini_resolve_modelo_da_lista_de_candidatos():
    # patch.object sobre o módulo já importado — não patch('google.generativeai.x') por
    # string: pkgutil.resolve_name (usado pelo unittest.mock pra resolver strings) exige
    # que 'google.generativeai' já esteja no atributo do pacote 'google', o que só é
    # garantido depois de um import real. Localmente colava por acidente (outro teste já
    # tinha importado antes); em CI com ambiente limpo quebrava com AttributeError.
    import google.generativeai as _genai

    modelo_fake = MagicMock(name='models/gemini-1.5-flash')
    modelo_fake.name = 'models/gemini-1.5-flash'
    modelo_fake.supported_generation_methods = ['generateContent']

    with patch.object(_genai, 'configure') as mock_configure, \
         patch.object(_genai, 'list_models', return_value=[modelo_fake]):
        client, modelo = chat_mod._get_llm_client('gemini', 'AIza-fake', {})

    mock_configure.assert_called_once_with(api_key='AIza-fake')
    assert modelo == 'gemini-1.5-flash'
    assert client is _genai  # client é o próprio módulo _genai configurado, não uma instância


def test_get_llm_client_gemini_sem_modelo_suportado_retorna_none():
    import google.generativeai as _genai

    modelo_fake = MagicMock()
    modelo_fake.name = 'models/algum-outro-modelo'
    modelo_fake.supported_generation_methods = ['generateContent']

    with patch.object(_genai, 'configure'), \
         patch.object(_genai, 'list_models', return_value=[modelo_fake]):
        client, modelo = chat_mod._get_llm_client('gemini', 'AIza-fake', {})

    # Nenhum candidato da _GEMINI_CANDIDATOS bate -> cai no fallback (1º da lista real)
    assert modelo == 'algum-outro-modelo'


def test_get_llm_client_provider_desconhecido_levanta_valueerror():
    import pytest
    with pytest.raises(ValueError, match='Provedor desconhecido'):
        chat_mod._get_llm_client('provedor-inexistente', 'chave', {})


def test_gemini_candidatos_e_lista_unica_sem_duplicatas():
    """Regressão: antes existiam 3 versões divergentes desta lista espalhadas
    pelo módulo (uma completa, duas truncadas em ordens diferentes) — garante
    que a lista única não tem duplicata e cobre os modelos mais comuns."""
    assert len(chat_mod._GEMINI_CANDIDATOS) == len(set(chat_mod._GEMINI_CANDIDATOS))
    assert 'gemini-1.5-flash' in chat_mod._GEMINI_CANDIDATOS
