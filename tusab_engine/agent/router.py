# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Roteamento de intenção do chat — Fase 0 da formalização documentada em
"Roteamento de Intenção — Spec de Implementação.md" (13/ago/2026).

Extraído de chat.py sem mudança de comportamento: a cascata de decisão que
antes estava inline e duplicada em chat() e chat_stream() agora vive aqui
como rotear(), chamada uma vez por cada função.

Contrato:
  - rotear() NUNCA lança. Qualquer erro → Rota BUSCA. Comportamento herdado
    do classificador original, não pode regredir.
  - rotear() não faz I/O de disco. Sinais que exigem disco (ex: existência de
    summary.json, usados a partir da Fase 2/METADADOS) chegam via `sinais`,
    montado pelo chamador — nunca lidos aqui.
  - Dependência acíclica preservada: este módulo importa de storage.py/config.py
    (indiretamente via llm_providers), nunca de api/.

Ollama e os demais providers de classificação passam por `_get_llm_client`
(tusab_engine/agent/llm_providers.py) — mesma fábrica usada pelo resto do
pipeline de chat.
"""

import re
import concurrent.futures as _cf
from dataclasses import dataclass

from tusab_engine.agent.llm_providers import _get_llm_client

# ── Rota ──────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Rota:
    nome: str                 # 'BUSCA' | 'CONTEXTO' | 'CONVERSA' | 'TRECHO'
    precisa_retrieval: bool   # se True, o executor recebe contexto BM25
    precisa_llm: bool         # se False, resposta é construída sem chamar o provider
    custo_estimado_ms: int    # para telemetria e decisão de pré-roteamento (Fase 1)


ROTA_BUSCA     = Rota(nome='BUSCA',     precisa_retrieval=True,  precisa_llm=True,  custo_estimado_ms=0)
ROTA_CONTEXTO  = Rota(nome='CONTEXTO',  precisa_retrieval=False, precisa_llm=True,  custo_estimado_ms=0)
ROTA_CONVERSA  = Rota(nome='CONVERSA',  precisa_retrieval=False, precisa_llm=True,  custo_estimado_ms=0)
ROTA_TRECHO    = Rota(nome='TRECHO',    precisa_retrieval=False, precisa_llm=True,  custo_estimado_ms=0)
# METADADOS (Fase 2): resposta montada por template a partir de arquivo real —
# nunca chama LLM pra obter o número, só o roteamento em si usa esta rota
# como sinal pro executor (tusab_engine/agent/metadados.py).
ROTA_METADADOS = Rota(nome='METADADOS', precisa_retrieval=False, precisa_llm=False, custo_estimado_ms=0)

_ROTAS_POR_NOME = {r.nome: r for r in (ROTA_BUSCA, ROTA_CONTEXTO, ROTA_CONVERSA, ROTA_TRECHO, ROTA_METADADOS)}


# Executor compartilhado para classificação de intenção paralela ao BM25.
# max_workers=2: suporta dois chats simultâneos sem criar thread a cada request.
_intent_executor = _cf.ThreadPoolExecutor(max_workers=2, thread_name_prefix='intent')


# ── Classificação de intenção via LLM ─────────────────────────────────────────
#
# Antes de rodar o BM25, classifica a mensagem em:
#   BUSCA    → pergunta nova que requer recuperação na base
#   CONTEXTO → instrução sobre a resposta anterior (traduzir, resumir, reformatar,
#              continuar, explicar de novo, simplificar, etc.)
#   CONVERSA → saudação ou meta-pergunta sobre o assistente
#
# A classificação usa o mesmo LLM configurado com max_tokens=5 — latência típica
# <200ms em cloud, <800ms em Ollama. Roda em paralelo com o BM25 via thread para
# não adicionar latência no caso BUSCA (o mais comum).
# Fallback: qualquer erro → assume BUSCA (comportamento atual preservado).

_INTENCAO_PROMPT = """\
Classifique a mensagem do usuário em uma das três categorias:

BUSCA    = pergunta nova que requer pesquisar em documentos ou vídeos
CONTEXTO = instrução sobre a resposta anterior (ex: traduzir, resumir, reformular,
           explicar melhor, simplificar, continuar, dar mais detalhes, em outro idioma,
           em inglês, em espanhol, em tópicos, em tabela, de forma mais curta, etc.)
CONVERSA = saudação, agradecimento ou pergunta sobre o próprio assistente

Histórico recente da conversa:
{historico}

Mensagem atual do usuário: "{pergunta}"

Responda APENAS com uma palavra: BUSCA, CONTEXTO ou CONVERSA."""


def _classificar_intencao(pergunta: str, historico: list, config: dict) -> str:
    """Classifica a intenção da mensagem. Retorna 'BUSCA', 'CONTEXTO' ou 'CONVERSA'.

    Sempre retorna 'BUSCA' em caso de falha — comportamento atual preservado.
    Sem histórico ou com histórico vazio: sempre BUSCA (sem contexto para transformar).
    """
    if not historico:
        return 'BUSCA'

    # Resume as últimas 3 trocas para o prompt de classificação
    trocas = []
    for h in historico[-6:]:
        role = 'Usuário' if h.get('role') == 'user' else 'Assistente'
        content = str(h.get('content', ''))[:200]
        trocas.append(f"{role}: {content}")
    hist_resumido = '\n'.join(trocas) if trocas else '(sem histórico)'

    prompt = _INTENCAO_PROMPT.format(
        historico=hist_resumido,
        pergunta=pergunta[:300],
    )

    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            resp = _req.post(
                'http://localhost:11434/api/generate',
                # think=False: modelos com raciocínio nativo (qwen3, deepseek-r1)
                # gastariam o num_predict=5 todo pensando, sem sobrar token pra
                # resposta — e vazaria <think> pro classificador de intenção.
                json={'model': modelo, 'prompt': prompt, 'stream': False, 'think': False,
                      'options': {'num_predict': 5, 'temperature': 0.0, 'stop': ['\n']}},
                timeout=15,
            )
            resultado = resp.json().get('response', '').strip().upper()

        elif provider in ('gemini', 'google'):
            client, modelo = _get_llm_client(provider, api_key, config)
            if not modelo:
                return 'BUSCA'
            resp = client.GenerativeModel(modelo).generate_content(
                prompt,
                generation_config={'max_output_tokens': 5, 'temperature': 0.0},
            )
            resultado = resp.text.strip().upper()

        elif provider == 'openai':
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=5, temperature=0.0, timeout=8,
            )
            resultado = resp.choices[0].message.content.strip().upper()

        elif provider == 'anthropic':
            client, modelo = _get_llm_client(provider, api_key, config)
            msg = client.messages.create(
                model=modelo,
                max_tokens=5,
                messages=[{'role': 'user', 'content': prompt}],
                timeout=8,
            )
            resultado = msg.content[0].text.strip().upper()

        elif provider in ('groq', 'custom'):
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=5, temperature=0.0, timeout=8,
            )
            resultado = resp.choices[0].message.content.strip().upper()

        else:
            return 'BUSCA'

        # Normaliza — LLM pode retornar "BUSCA." ou "**BUSCA**" etc.
        for cat in ('CONTEXTO', 'CONVERSA', 'BUSCA'):
            if cat in resultado:
                return cat
        return 'BUSCA'

    except Exception:
        return 'BUSCA'  # fallback seguro


def iniciar_classificacao_intencao(pergunta: str, historico: list, config: dict):
    """Submete a classificação de intenção ao executor compartilhado.

    O chamador deve rodar o BM25 (_recuperar_contexto) logo em seguida, no
    mesmo thread, e só então passar o future resultante para rotear() via
    sinais['intencao_future'] — é isso que garante latência zero no caso
    BUSCA (classificação e retrieval acontecem em paralelo).
    """
    return _intent_executor.submit(_classificar_intencao, pergunta, historico or [], config)


# ── Detecção de trecho injetado ───────────────────────────────────────────────

_RE_TRECHO_INJETADO = re.compile(r'^\[([^\]]+\.(?:txt|pdf|docx|xlsx|csv|md))\]\s*\n(.+)', re.DOTALL | re.IGNORECASE)


def extrair_trecho_injetado(pergunta: str):
    """Detecta se a mensagem é um trecho injetado do Repositório.

    Formato: '[arquivo.txt]\\nconteúdo...'
    Retorna (arquivo, conteudo) ou (None, None).
    """
    m = _RE_TRECHO_INJETADO.match(pergunta.strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None, None


def _normalizar_saudacao(pergunta: str) -> str:
    """Normaliza a mensagem pra comparação contra _SAUDACOES.

    lstrip('¿¡') remove a pontuação de abertura do espanhol ('¿qué tal?',
    '¡hola!') — sem isso, toda saudação digitada com a abertura gramaticalmente
    correta do espanhol nunca batia com o set (só a forma sem abertura estava
    cadastrada). Achado pelo teste de precisão da Fase 1 (pré-roteamento).
    """
    return pergunta.strip().lower().lstrip('¿¡').rstrip('!?.')


# ── Saudações conhecidas (força CONVERSA sem precisar do classificador) ───────

_SAUDACOES = {
    # PT-BR
    'oi', 'olá', 'ola', 'opa', 'eai', 'e ai', 'e aí', 'ei',
    'bom dia', 'boa tarde', 'boa noite', 'boa',
    'tudo bem', 'tudo bom', 'tudo certo', 'tudo ótimo', 'tudo otimo',
    'como vai', 'como você está', 'como voce esta', 'como você tá', 'como voce ta',
    'como está', 'como ta', 'como tá', 'e então', 'e entao',
    'salve', 'salve salve', 'fala', 'fala aí', 'fala ai',
    # EN
    'hello', 'hi', 'hey', 'howdy', 'greetings',
    'good morning', 'good afternoon', 'good evening', 'good night',
    'how are you', 'how are you doing', "how's it going", 'how is it going',
    "what's up", 'whats up', 'sup',
    # ES
    'hola', 'buenas', 'buenos días', 'buenos dias',
    'buenas tardes', 'buenas noches',
    'cómo estás', 'como estas', 'cómo está', 'como esta',
    'qué tal', 'que tal', 'qué hay', 'que hay',
    'saludos', 'hey', 'ey',
    # Neutras (qualquer idioma)
    'teste', 'test', 'ping', 'ok', 'okay',
}


# ── pre_rotear() — Fase 1: pré-roteamento determinístico ──────────────────────
#
# Matchers de custo ~0ms (regex/set, sem chamar LLM nem BM25) que resolvem a
# rota ANTES de submeter a classificação. Hoje toda mensagem paga a chamada
# ao classificador mesmo quando "oi"/trecho injetado já bastam pra decidir —
# no Ollama isso custa ~800ms percebidos sempre que a rota final não é BUSCA
# (o paralelismo com o BM25 só esconde o custo no caminho BUSCA).
#
# Cobre só as 2 categorias com executor pronto hoje (CONVERSA via saudação,
# TRECHO via arquivo injetado). METADADOS (Fase 2) e CALCULO (Fase 3) entram
# aqui quando os executores existirem — matchear pra uma rota sem quem execute
# só empurraria a pergunta pro fallback BUSCA de qualquer forma, sem ganho.
#
# Conservador por design (spec, Fase 1): falso positivo aqui é pior que falso
# negativo — se render dúvida, retorna None e deixa o classificador LLM decidir.

def pre_rotear(pergunta: str, sinais: dict = None) -> Rota:
    """Retorna a Rota se um matcher determinístico bater, senão None — nesse
    caso o chamador segue o fluxo normal (classificação LLM + BM25 em
    paralelo, via iniciar_classificacao_intencao() + rotear()).

    NUNCA lança. sinais aceita 'arq_injetado' (já resolvido pelo chamador via
    extrair_trecho_injetado()) e 'trechos_fixados' — mesma precedência de
    rotear(): trecho fixado pelo usuário sempre vence saudação, pra nunca
    descartar contexto que o usuário fixou explicitamente.
    """
    try:
        sinais = sinais or {}

        if sinais.get('arq_injetado'):
            return ROTA_TRECHO

        if not sinais.get('trechos_fixados'):
            if _normalizar_saudacao(pergunta) in _SAUDACOES:
                return ROTA_CONVERSA

        return None
    except Exception:
        return None


# ── rotear() ──────────────────────────────────────────────────────────────────

def rotear(pergunta: str, historico: list, config: dict, *, sinais: dict) -> Rota:
    """Retorna a Rota escolhida para a mensagem. NUNCA lança — fallback
    obrigatório é ROTA_BUSCA em qualquer exceção não prevista.

    Encapsula a cascata de decisão que antes estava inline e duplicada em
    chat() e chat_stream(): trecho injetado → CONTEXTO sem resposta anterior
    degrada para BUSCA → saudação força CONVERSA → trecho fixado (@@) força
    BUSCA.

    sinais esperados (montados pelo chamador, nunca lidos do disco aqui):
      - 'arq_injetado' (str|None): resultado de extrair_trecho_injetado()
      - 'intencao_future' (Future|None): resultado de iniciar_classificacao_intencao(),
        já submetido em paralelo ao BM25 pelo chamador
      - 'ultima_resposta' (dict): state.last_chat_response.get(projeto_prefixo, {})
      - 'trechos_fixados' (list): trechos fixados pelo usuário via @@
    """
    try:
        if sinais.get('arq_injetado'):
            return ROTA_TRECHO

        intencao_future = sinais.get('intencao_future')
        try:
            intencao = intencao_future.result(timeout=20) if intencao_future is not None else 'BUSCA'
        except Exception:
            intencao = 'BUSCA'

        ultima = sinais.get('ultima_resposta') or {}
        if intencao == 'CONTEXTO' and not ultima:
            intencao = 'BUSCA'

        # Saudações conhecidas são sempre CONVERSA — mesmo sem histórico o classificador
        # retorna BUSCA por design, mas "oi"/"olá" nunca deve disparar BM25 nem mostrar fontes.
        if _normalizar_saudacao(pergunta) in _SAUDACOES:
            intencao = 'CONVERSA'

        # Trechos fixados pelo usuário (@@): forçar BUSCA para não descartar o contexto
        if sinais.get('trechos_fixados') and intencao != 'CONTEXTO':
            intencao = 'BUSCA'

        return _ROTAS_POR_NOME.get(intencao, ROTA_BUSCA)

    except Exception:
        return ROTA_BUSCA
