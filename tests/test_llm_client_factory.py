# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.chat::_get_llm_client() — fábrica única de
cliente LLM por provider, que substituiu a construção de client+modelo
duplicada em 5 pontos do módulo (_expandir_query, _classificar_intencao,
_responder_sem_contexto, _gerar_resposta_llm, chat_stream).

Sem chamada de rede real. OpenAI/Anthropic/Groq/custom só instanciam o
client (nunca chamam a rede na construção) — seguro chamar de verdade.
Gemini lista os modelos na resolução do modelo (google.genai.Client) — mockado.
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


def test_get_llm_client_openrouter_delega_para_client_openai_compat():
    client, modelo = chat_mod._get_llm_client('openrouter', 'sk-or-fake', {})
    assert modelo == 'meta-llama/llama-3.3-70b-instruct:free'
    assert str(client.base_url).startswith('https://openrouter.ai/api/v1')


def test_get_llm_client_openrouter_usa_modelo_customizado_do_config():
    client, modelo = chat_mod._get_llm_client('openrouter', 'sk-or-fake', {'openrouter_model': 'anthropic/claude-3.5-sonnet'})
    assert modelo == 'anthropic/claude-3.5-sonnet'


def _modelo_gemini_fake(nome, acoes=('generateContent',)):
    m = MagicMock()
    m.name = f'models/{nome}'
    m.supported_actions = list(acoes)
    return m


def test_get_llm_client_gemini_resolve_modelo_da_lista_de_candidatos():
    modelos = [_modelo_gemini_fake('text-embedding-004', ('embedContent',)),
               _modelo_gemini_fake('gemini-1.5-flash')]
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.list.return_value = modelos
        client, modelo = chat_mod._get_llm_client('gemini', 'AIza-fake', {})

    mock_client.assert_called_once_with(api_key='AIza-fake')
    assert modelo == 'gemini-1.5-flash'
    assert hasattr(client, 'GenerativeModel')  # mesma interface do SDK legado


def test_get_llm_client_gemini_sem_modelo_suportado_retorna_none():
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.list.return_value = [_modelo_gemini_fake('algum-outro-modelo')]
        client, modelo = chat_mod._get_llm_client('gemini', 'AIza-fake', {})

    # Nenhum candidato da _GEMINI_CANDIDATOS bate -> cai no fallback (1º da lista real)
    assert modelo == 'algum-outro-modelo'


def test_gemini_generate_content_repassa_config_e_garante_texto():
    with patch('google.genai.Client') as mock_client:
        api = mock_client.return_value
        api.models.list.return_value = [_modelo_gemini_fake('gemini-1.5-flash')]
        api.models.generate_content.return_value = MagicMock(text=None)
        api.models.generate_content_stream.return_value = iter([MagicMock(text='a'), MagicMock(text='b')])
        client, modelo = chat_mod._get_llm_client('gemini', 'AIza-fake', {})

        resp = client.GenerativeModel(modelo).generate_content(
            'oi', generation_config={'max_output_tokens': 5, 'temperature': 0.0})
        chunks = [c.text for c in client.GenerativeModel(modelo).generate_content('oi', stream=True)]

    # texto None do SDK novo vira '' (callers fazem resp.text.strip())
    assert resp.text == ''
    kwargs = api.models.generate_content.call_args.kwargs
    assert kwargs['model'] == 'gemini-1.5-flash' and kwargs['contents'] == 'oi'
    assert kwargs['config'].max_output_tokens == 5 and kwargs['config'].temperature == 0.0
    assert chunks == ['a', 'b']


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
