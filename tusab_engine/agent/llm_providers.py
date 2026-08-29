# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fábrica única de cliente LLM por provider — extraída de chat.py.

Antes de existir, o mesmo bloco "if provider == X: import SDK, configura,
resolve modelo padrão" estava duplicado em 5 pontos de chat.py (é o que
gerou o bug histórico de 3 versões divergentes da lista de fallback do
Gemini) e, de forma independente, reimplementado outra vez em
agent/summarize.py, scheduler.py, api/router_estudo.py e
api/router_agent.py::agent_test_key — cada um com sua própria lista de
candidatos Gemini e modelo padrão, divergentes entre si pelo mesmo motivo.
Este módulo é o ponto único que todos os call-sites acima importam.

Ollama NÃO passa por aqui: usa requests cru direto pra streaming, thinking
e retry — específico demais pra abstrair sem perder a lógica de cada caller.
"""

from tusab_engine.agent.config import SENTINEL_KEY


def _api_key_valida(config: dict) -> bool:
    """Retorna True se há chave de API real configurada (não sentinel, não vazia)."""
    key = config.get('api_key', '')
    return bool(key) and key != SENTINEL_KEY


_MODELO_OPENROUTER = 'meta-llama/llama-3.3-70b-instruct:free'


def _client_openai_compat(provider: str, api_key: str, config: dict):
    """Retorna (client, modelo) para provedores que falam o protocolo OpenAI
    (Groq, OpenRouter e endpoint customizado — ex: 9router,
    github.com/decolua/9router). Centraliza a escolha de base_url pra não
    duplicar o padrão em cada um dos pontos de dispatch por provider.

    Kimi (Moonshot AI), xAI (Grok) e Together AI também falam esse mesmo
    protocolo — não têm card dedicado porque OpenRouter já os cobre como
    agregador (mesma chave, catálogo com todos), mas seguem acessíveis via
    endpoint customizado (ver custom_base_url em AssistenteTab.jsx) para
    quem já tem conta direta com um deles.
    """
    from openai import OpenAI
    if provider == 'custom':
        base_url = config.get('custom_base_url', '').rstrip('/')
        modelo   = config.get('custom_model', '')
        return OpenAI(api_key=api_key or 'local', base_url=base_url), modelo
    if provider == 'openrouter':
        modelo = config.get('openrouter_model', _MODELO_OPENROUTER)
        return OpenAI(api_key=api_key, base_url='https://openrouter.ai/api/v1'), modelo
    modelo = config.get('groq_model', 'llama-3.1-8b-instant')
    return OpenAI(api_key=api_key, base_url='https://api.groq.com/openai/v1'), modelo


# Lista única de fallback do Gemini — antes existiam versões divergentes
# espalhadas pelos pontos de dispatch (uma completa, outras truncadas em
# ordens diferentes). Gemini não tem tiering por finalidade (diferente da
# Anthropic, ver _MODELO_ANTHROPIC_*): mesmo modelo nas chamadas auxiliares
# e na resposta principal.
_GEMINI_CANDIDATOS = [
    'gemini-1.5-flash', 'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002', 'gemini-1.5-pro',
    'gemini-pro', 'gemini-2.0-flash-lite',
]

# Anthropic é o único provider com tiering por finalidade: Haiku (rápido,
# barato) para chamadas auxiliares de baixo risco (expandir query,
# classificar intenção, mensagem de fallback sem contexto); Sonnet (melhor
# qualidade) só na resposta final que o usuário lê. OpenAI/Gemini/Groq usam
# o mesmo modelo padrão nas duas categorias — não há orçamento redundante
# aí que justifique um segundo tier.
_MODELO_ANTHROPIC_AUXILIAR  = 'claude-haiku-4-5-20251001'
_MODELO_ANTHROPIC_PRINCIPAL = 'claude-sonnet-4-6'
_MODELO_OPENAI = 'gpt-4o-mini'


def _get_llm_client(provider: str, api_key: str, config: dict, principal: bool = False):
    """Fábrica única de cliente LLM por provider.

    `principal=True` é a chamada que gera a resposta final que o usuário lê
    (mais tokens/timeout no caller); `principal=False` é uso auxiliar
    (expandir query, classificar intenção, fallback sem contexto) — só
    muda o modelo escolhido para a Anthropic (ver _MODELO_ANTHROPIC_*).

    Retorna (client, modelo). Para Gemini, `client` é o módulo `_genai`
    configurado (não uma instância) — o caller monta
    `client.GenerativeModel(modelo)` porque o SDK não tem um objeto de
    cliente único como openai/anthropic.
    """
    if provider == 'openai':
        from openai import OpenAI
        return OpenAI(api_key=api_key), _MODELO_OPENAI

    if provider == 'anthropic':
        import anthropic
        modelo = _MODELO_ANTHROPIC_PRINCIPAL if principal else _MODELO_ANTHROPIC_AUXILIAR
        return anthropic.Anthropic(api_key=api_key), modelo

    if provider in ('gemini', 'google'):
        import google.generativeai as _genai
        _genai.configure(api_key=api_key)
        modelos_ok = [
            m.name.replace('models/', '') for m in _genai.list_models()
            if 'generateContent' in m.supported_generation_methods
        ]
        modelo = next((m for m in _GEMINI_CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
        return _genai, modelo

    if provider in ('groq', 'openrouter', 'custom'):
        return _client_openai_compat(provider, api_key, config)

    raise ValueError(f"Provedor desconhecido: {provider}")
