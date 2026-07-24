# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Recuperação de contexto (BM25), expansão de query e geração de resposta
via múltiplos provedores de LLM (OpenAI, Anthropic, Gemini, Groq, Ollama).

[IMPACTO] Este módulo tem dois contratos críticos com o frontend:
1. Formato do stream em chat_stream(): o frontend (useChatEngine.js:parseMessageStream)
   espera yield de JSON {fontes, done:False} seguido de chunks de texto e JSON {done:True}.
   Qualquer mudança nesse protocolo congela o chat na UI.
2. Campo `sem_contexto: True` no retorno de chat(): o ChatDrawer usa esse campo para
   exibir o botão "Indexar base agora". Remover quebra o fluxo de onboarding do chat.
Ver: Documentação do Produto/Mapa de Impacto de Dependências.md §5.2
"""

import os
import re
import json

from tusab_engine.storage import INDEX_DIR, NEURAL_DIR
from tusab_engine.agent.config import carregar_config, SENTINEL_KEY
from tusab_engine.agent.index import (
    _bm25_cache, _bm25_lock,
    _enriquecer_documento, _index_path,
    _carregar_meta_canal, _STOPWORDS,
)

# ── CrossEncoder (re-rankeamento semântico pós-BM25) ─────────────────────────
#
# O BM25 recupera candidatos por overlap de tokens. O CrossEncoder compara
# a pergunta com cada chunk diretamente e produz um score de relevância semântica.
# Resultado: chunks mais relevantes chegam ao topo mesmo com vocabulário diferente.
#
# Modelo: ms-marco-MiniLM-L-6-v2 (~80 MB, CPU-only, sem GPU necessária).
# Lazy load: carregado na primeira chamada, mantido em memória até reiniciar.
# Fallback: se o modelo não estiver disponível (sem sentence-transformers),
# o re-rankeamento é silenciosamente ignorado — BM25 puro continua funcionando.

_cross_encoder = None
_cross_encoder_lock = __import__('threading').Lock()
cross_encoder_loading = False  # True enquanto o modelo está sendo carregado pela primeira vez

def _get_cross_encoder():
    """Retorna o CrossEncoder carregado (lazy, singleton). Retorna None se indisponível."""
    global _cross_encoder, cross_encoder_loading
    if _cross_encoder is not None:
        return _cross_encoder
    with _cross_encoder_lock:
        if _cross_encoder is not None:
            return _cross_encoder
        cross_encoder_loading = True
        try:
            from sentence_transformers import CrossEncoder as _CE
            _cross_encoder = _CE('cross-encoder/ms-marco-MiniLM-L-6-v2')
        except Exception:
            _cross_encoder = False  # sentinel: tentativa feita, indisponível
        finally:
            cross_encoder_loading = False
    return _cross_encoder if _cross_encoder else None


def _rerankar(pergunta: str, chunks: list) -> list:
    """Re-ordena chunks por relevância semântica usando CrossEncoder.

    Se o modelo não estiver disponível, retorna os chunks na ordem original.
    """
    ce = _get_cross_encoder()
    if not ce or not chunks:
        return chunks
    try:
        pares = [(pergunta, c['texto'][:768]) for c in chunks]
        scores = ce.predict(pares)
        reordenados = sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)
        return [c for _, c in reordenados]
    except Exception:
        return chunks


# ── Query expansion ───────────────────────────────────────────────────────────
#
# Objetivo: ampliar a cobertura do BM25 gerando variações da pergunta original.
#
# O BM25 é puramente léxico — compara tokens. Se o usuário pergunta "retorno"
# e o documento usa "rendimento", o score cai mesmo que o significado seja o mesmo.
# A query expansion pede ao LLM para gerar 2 reformulações sinônimas; o BM25
# é rodado para cada variação e os scores são combinados por média.
#
# Habilitada apenas para provedores rápidos (Groq, OpenAI, Anthropic, Gemini):
# latência típica ~0.3–1s. Desabilitada para Ollama: modelos pequenos
# (llama3.2:1b) geram expansões de baixa qualidade e adicionam 10–15s de latência.
#
# Em caso de falha (timeout, API error) a função retorna apenas a pergunta
# original — o chat nunca é bloqueado por falha na expansão.

# Provedores rápidos o suficiente para query expansion sem degradar UX
PROVEDORES_COM_EXPANSION = {'groq', 'openai', 'anthropic', 'gemini', 'google'}

# ── Personas ──────────────────────────────────────────────────────────────────

PERSONAS = {
    'objetivo':      'Use linguagem direta e objetiva, sem floreios ou rodeios. Vá direto ao ponto.',
    'tecnico':       'Use terminologia técnica precisa, dados exatos e nomenclaturas corretas. Assuma que o usuário tem conhecimento da área.',
    'didatico':      'Explique com exemplos concretos, analogias e passo a passo. Priorize a compreensão.',
    'descontraido':  'Use um tom leve e conversacional, como uma conversa entre amigos. Pode usar linguagem informal.',
    'socratico':     'Ao final de cada resposta, inclua uma pergunta que aprofunde o raciocínio do usuário sobre o tema.',
}


def _api_key_valida(config: dict) -> bool:
    """Retorna True se há chave de API real configurada (não sentinel, não vazia)."""
    key = config.get('api_key', '')
    return bool(key) and key != SENTINEL_KEY


def _expandir_query(pergunta: str, config: dict) -> list:
    """Retorna [pergunta_original, variacao1, variacao2] usando o LLM configurado.

    Sempre retorna ao menos [pergunta] — nunca lança exceção.
    """
    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    if provider not in PROVEDORES_COM_EXPANSION:
        return [pergunta]

    prompt_expansion = (
        "Gere 2 reformulações curtas e diferentes desta pergunta para busca "
        "em transcrições de vídeos e documentos. Use sinônimos e variações "
        "de vocabulário. Responda APENAS com as 2 reformulações, uma por linha, "
        "sem numeração, sem explicação e sem prefixo.\n"
        f"Pergunta original: {pergunta}"
    )

    variacoes = []
    try:
        if provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = [
                'gemini-1.5-flash', 'gemini-1.5-flash-latest',
                'gemini-1.5-flash-002', 'gemini-1.5-pro',
                'gemini-pro', 'gemini-2.0-flash-lite',
            ]
            modelos_ok = [
                m.name.replace('models/', '') for m in _genai.list_models()
                if 'generateContent' in m.supported_generation_methods
            ]
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if modelo:
                resp = _genai.GenerativeModel(modelo).generate_content(prompt_expansion)
                linhas = resp.text.strip().splitlines()
                variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'openai':
            from openai import OpenAI
            resp = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt_expansion}],
                max_tokens=120,
                timeout=8,
            )
            linhas = resp.choices[0].message.content.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key).messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=120,
                messages=[{'role': 'user', 'content': prompt_expansion}],
                timeout=8,
            )
            linhas = msg.content[0].text.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            resp = OpenAI(
                api_key=api_key,
                base_url='https://api.groq.com/openai/v1',
            ).chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt_expansion}],
                max_tokens=120,
                timeout=8,
            )
            linhas = resp.choices[0].message.content.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

    except Exception:
        pass  # expansão é best-effort; falha silenciosa, pergunta original é suficiente

    return [pergunta] + variacoes


# Executor compartilhado para classificação de intenção paralela ao BM25.
# max_workers=2: suporta dois chats simultâneos sem criar thread a cada request.
import concurrent.futures as _cf
_intent_executor = _cf.ThreadPoolExecutor(max_workers=2, thread_name_prefix='intent')

# ── Classificação de intenção ────────────────────────────────────────────────
#
# Antes de rodar o BM25, classifica a mensagem em:
#   BUSCA    → pergunta nova que requer recuperação na base
#   CONTEXTO → instrução sobre a resposta anterior (traduzir, resumir, reformatar,
#              continuar, explicar de novo, simplificar, etc.)
#   CONVERSA → saudação ou meta-pergunta sobre o assistente
#
# Para CONTEXTO: pula o BM25 e usa a última resposta salva em state como contexto.
# Para CONVERSA: pula o BM25 e responde diretamente.
# Para BUSCA: fluxo normal.
#
# A classificação usa o mesmo LLM configurado com max_tokens=5 — latência típica
# <200ms em cloud, <800ms em Ollama. Roda em paralelo com o BM25 via thread para
# não adicionar latência no caso BUSCA.
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
                json={'model': modelo, 'prompt': prompt, 'stream': False,
                      'options': {'num_predict': 5, 'temperature': 0.0, 'stop': ['\n']}},
                timeout=15,
            )
            resultado = resp.json().get('response', '').strip().upper()

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            modelos_ok = [
                m.name.replace('models/', '') for m in _genai.list_models()
                if 'generateContent' in m.supported_generation_methods
            ]
            CANDIDATOS = ['gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest']
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if not modelo:
                return 'BUSCA'
            resp = _genai.GenerativeModel(modelo).generate_content(
                prompt,
                generation_config={'max_output_tokens': 5, 'temperature': 0.0},
            )
            resultado = resp.text.strip().upper()

        elif provider == 'openai':
            from openai import OpenAI
            resp = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=5, temperature=0.0, timeout=8,
            )
            resultado = resp.choices[0].message.content.strip().upper()

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key, timeout=8).messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=5,
                messages=[{'role': 'user', 'content': prompt}],
            )
            resultado = msg.content[0].text.strip().upper()

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            resp = OpenAI(api_key=api_key, base_url='https://api.groq.com/openai/v1').chat.completions.create(
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


def _montar_prompt_contexto(pergunta: str, historico: list, ultima_resposta: dict,
                             persona: str = '', idioma: str = 'pt') -> str:
    """Prompt para intenção CONTEXTO — opera sobre a resposta anterior, sem BM25."""
    lang_label = _IDIOMA_LABEL.get(idioma, 'português')

    hist_str = ''
    if historico:
        trocas = []
        for h in historico[-6:]:
            role    = 'user' if h.get('role') == 'user' else 'assistant'
            content = str(h.get('content', ''))[:800]
            trocas.append(f"<{role}>{content}</{role}>")
        if trocas:
            hist_str = '<conversation_history>\n' + '\n'.join(trocas) + '\n</conversation_history>\n\n'

    resposta_anterior = ultima_resposta.get('resposta', '')
    pergunta_anterior = ultima_resposta.get('pergunta', '')

    instrucao_tom = ''
    if persona and persona in PERSONAS:
        instrucao_tom = f'TOM DE RESPOSTA: {PERSONAS[persona]}\n\n'

    return (
        f'Você é o Tusab, um assistente de gestão de conhecimento.\n\n'
        f'O usuário fez uma instrução sobre a resposta anterior da conversa.\n'
        f'NÃO busque novos documentos — opere sobre o conteúdo já apresentado.\n\n'
        f'IDIOMA: responda SEMPRE em {lang_label}.\n\n'
        + instrucao_tom
        + hist_str
        + f'<previous_question>{pergunta_anterior}</previous_question>\n\n'
        + f'<previous_answer>{resposta_anterior}</previous_answer>\n\n'
        + f'<instruction>{pergunta}</instruction>\n\nRESPOSTA:'
    )


# ── Recuperação BM25 ──────────────────────────────────────────────────────────

_PERFIS_RERANK = {'pesquisador', 'profissional'}  # slug 'profissional' = Especialista na UI

# Cache de corpus merged: keyed por frozenset de (prefixo, mtime) de todos os projetos.
# Evita reconstruir o BM25 unificado a cada query quando os índices não mudaram.
_merged_cache: dict = {}
_merged_lock = __import__('threading').Lock()


def _carregar_projeto_cache(prefixo: str) -> dict | None:
    """Carrega (ou retorna do cache) o índice de um projeto. Retorna None se não existir."""
    from rank_bm25 import BM25Okapi
    idx_path = _index_path(prefixo)
    if not os.path.exists(idx_path):
        return None
    mtime = os.path.getmtime(idx_path)
    with _bm25_lock:
        cached = _bm25_cache.get(prefixo)
        if cached is None or cached['mtime'] != mtime:
            try:
                with open(idx_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                chunks = data['chunks']
                if not isinstance(chunks, list) or not chunks:
                    return None
            except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                return None
            corpus = [_enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', ''), titulo=c.get('titulo', '')) for c in chunks]
            _bm25_cache[prefixo] = {'chunks': chunks, 'bm25': BM25Okapi(corpus), 'mtime': mtime}
        return _bm25_cache[prefixo]


def _obter_corpus_merged(prefixos: list[str]) -> dict | None:
    """Constrói (ou retorna do cache) um BM25 unificado sobre todos os prefixos.

    Quando há múltiplos projetos, indexar separadamente torna os scores BM25
    incomparáveis — um corpus de 400 chunks tem IDF muito menor que um de 50.
    O merge resolve isso: todos os chunks entram no mesmo vocabulário, os scores
    são calculados sobre o mesmo IDF global e o CrossEncoder reordena com justiça.
    """
    from rank_bm25 import BM25Okapi

    projetos = []
    cache_key_parts = []
    for prefixo in prefixos:
        c = _carregar_projeto_cache(prefixo)
        if c:
            projetos.append((prefixo, c))
            cache_key_parts.append((prefixo, c['mtime']))

    if not projetos:
        return None

    cache_key = frozenset(cache_key_parts)
    with _merged_lock:
        if cache_key in _merged_cache:
            return _merged_cache[cache_key]

        # Concatena todos os chunks marcando a origem de cada um
        chunks_merged = []
        for prefixo, c in projetos:
            for chunk in c['chunks']:
                chunks_merged.append({**chunk, '_prefixo': prefixo})

        corpus_merged = [
            _enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', ''), titulo=c.get('titulo', ''))
            for c in chunks_merged
        ]
        bm25_merged = BM25Okapi(corpus_merged)
        entry = {'chunks': chunks_merged, 'bm25': bm25_merged}
        _merged_cache[cache_key] = entry
        # Limita o cache a 8 corpora merged para não explodir memória
        if len(_merged_cache) > 8:
            oldest = next(iter(_merged_cache))
            del _merged_cache[oldest]
        return entry


def _recuperar_contexto(pergunta: str, canal_nome: str, n: int = 6, config: dict = None, canais_extras: list = None, fontes_fixadas: list = None, busca_ampla: bool = False, perfil: str = '', trechos_fixados: list = None) -> list:
    # Trechos fixados via @@ já passaram pelo pipeline BM25+CrossEncoder no momento da busca.
    # Retorná-los diretamente evita dupla pesquisa e garante que o LLM vê exatamente o que o usuário selecionou.
    if trechos_fixados:
        return [
            {
                'texto_original': t.get('texto', ''),
                'texto':          t.get('texto', ''),
                'titulo':         t.get('titulo', t.get('arquivo', '')),
                'arquivo':        t.get('arquivo', t.get('titulo', '')),
                'canal':          canal_nome,
                'score':          1.0,
                'aba':            'documento',
            }
            for t in trechos_fixados if t.get('texto')
        ]

    import numpy as np

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')

    # Separa fontes_fixadas em três categorias:
    #   @@pasta/arquivo.txt  → arquivo específico (@ no chat → dropdown de arquivos)
    #   @@fts:termo          → busca por termo/título (@@ no chat → FTS5 direto)
    #   @projeto             → base inteira de outro projeto (legado)
    #   arquivo.txt          → arquivo sem prefixo (retrocompat)
    fts_termos    = [f[6:] for f in (fontes_fixadas or []) if f.startswith('@@fts:')]
    arquivos_fixados = [f[2:].split('/', 1)[-1] for f in (fontes_fixadas or [])
                        if f.startswith('@@') and not f.startswith('@@fts:')]
    if not arquivos_fixados and not fts_termos:
        arquivos_fixados = [f for f in (fontes_fixadas or []) if not f.startswith('@')]
    bases_fixadas = [f[1:] for f in (fontes_fixadas or []) if f.startswith('@') and not f.startswith('@@')]

    usar_expansion = config.get('query_expansion', False) if config else False
    queries = _expandir_query(pergunta, config) if (config and usar_expansion) else [pergunta]

    def _scores_para_queries(bm25_obj, qs):
        all_s = [bm25_obj.get_scores(q.lower().split()) for q in qs]
        return np.max(all_s, axis=0) if len(all_s) > 1 else all_s[0]

    # ── Modo unificado: corpus merged quando há múltiplos projetos ────────────
    # Constrói um único BM25 sobre todos os chunks de todos os projetos ativos.
    # Scores são comparáveis porque o IDF é calculado sobre o vocabulário completo.
    todos_projetos = [canal_prefixo] + [
        re.sub(r'[<>:"/\\|?*\s]', '_', e).strip('_')
        for e in (canais_extras or []) if e != canal_nome
    ]

    if len(todos_projetos) > 1 and not arquivos_fixados:
        merged = _obter_corpus_merged(todos_projetos)
        if merged is None:
            raise ValueError(f"Índice não encontrado para '{canal_nome}'. Clique em Indexar Agora.")

        scores = _scores_para_queries(merged['bm25'], queries)
        # Recupera top-2n para o CrossEncoder ter candidatos suficientes de todos os projetos
        top_n = n * 2
        top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_n]
        resultados = [
            {**merged['chunks'][i], 'score': round(float(scores[i]), 3),
             'canal': merged['chunks'][i].get('_prefixo', canal_prefixo)}
            for i in top_idx if scores[i] > 0
        ]
        # Normaliza '_prefixo' → nome legível do projeto
        prefixo_para_nome = {canal_prefixo: canal_nome}
        for extra in (canais_extras or []):
            p = re.sub(r'[<>:"/\\|?*\s]', '_', extra).strip('_')
            prefixo_para_nome[p] = extra
        for r in resultados:
            r['canal'] = prefixo_para_nome.get(r['canal'], r['canal'])
        resultados.sort(key=lambda x: x['score'], reverse=True)

    else:
        # ── Modo single: BM25 no projeto principal (comportamento original) ───
        cached = _carregar_projeto_cache(canal_prefixo)
        if cached is None:
            raise ValueError(f"Índice não encontrado para '{canal_nome}'. Clique em Indexar Agora.")

        chunks_ativos = cached['chunks']
        if arquivos_fixados:
            chunks_ativos = [c for c in chunks_ativos if c.get('arquivo', '') in arquivos_fixados]

        # @@fts:termo — filtra chunks por título/label que contenha o termo
        if fts_termos:
            termos_lower = [t.lower() for t in fts_termos]
            chunks_fts = [c for c in cached['chunks']
                          if any(t in (c.get('titulo', '') or c.get('arquivo', '')).lower() for t in termos_lower)]
            if chunks_fts:
                chunks_ativos = chunks_fts

        scores_full = _scores_para_queries(cached['bm25'], queries)

        if (arquivos_fixados or fts_termos) and chunks_ativos:
            chunk_indices = [i for i, c in enumerate(cached['chunks']) if c in chunks_ativos]
            top_idx = sorted(chunk_indices, key=lambda i: scores_full[i], reverse=True)[:n]
        else:
            top_idx = sorted(range(len(scores_full)), key=lambda i: scores_full[i], reverse=True)[:n]

        resultados = [
            {**cached['chunks'][i], 'score': round(float(scores_full[i]), 3), 'canal': canal_nome}
            for i in top_idx if scores_full[i] > 0
        ]

        # FTS5 exact-match no projeto principal
        try:
            from tusab_engine.agent.fts import buscar_fts, fts_existe
            if fts_existe(canal_prefixo):
                fts_rowids = buscar_fts(pergunta, canal_prefixo, n=n)
                chunks_result = cached['chunks']
                for rid in fts_rowids:
                    if rid < len(chunks_result):
                        c = chunks_result[rid]
                        chave_titulo = c.get('titulo') or f'chunk_{rid}'
                        chave_ts     = c.get('timestamp_inicio') if c.get('timestamp_inicio') is not None else ''
                        ja_incluido = any(
                            (r.get('titulo') or f'chunk_{i}') == chave_titulo and
                            (r.get('timestamp_inicio') if r.get('timestamp_inicio') is not None else '') == chave_ts
                            for i, r in enumerate(resultados)
                        )
                        if not ja_incluido:
                            resultados.append({
                                **chunks_result[rid],
                                'score': 0.1,
                                'canal': canal_nome,
                                'fts_match': True,
                            })
        except Exception:
            pass

    resultados.sort(key=lambda x: x['score'], reverse=True)

    # Score mínimo adaptativo: corpora grandes (>2k chunks) têm IDF menor por documento
    # — textos informais/WhatsApp sofrem mais porque termos são menos únicos.
    # Reduz o threshold progressivamente para não silenciar resultados válidos.
    # Score mínimo: apenas remove scores zero — sem threshold arbitrário que corta resultados válidos.
    # Termos literalmente presentes no arquivo sempre têm score > 0 no BM25.
    resultados = [r for r in resultados if r['score'] > 0]

    # S3.2 — Filtro de data: quando a query contém termos temporais, prioriza conteúdo recente.
    # Detecta anos explícitos (ex: "2024") ou palavras como "recente", "último", "agora".
    # Filtra chunks sem data válida apenas quando há candidatos suficientes com data.
    _TERMOS_RECENTE = {'recente', 'recentes', 'último', 'últimos', 'última', 'últimas',
                       'atual', 'atualmente', 'agora', 'hoje', 'novo', 'novos', 'nova'}
    pergunta_lower = pergunta.lower()
    ano_explicito  = re.search(r'\b(20\d{2})\b', pergunta_lower)
    quer_recente   = any(t in pergunta_lower for t in _TERMOS_RECENTE) or ano_explicito

    if quer_recente:
        def _data_para_ano(data_str: str) -> int:
            try:
                return int(data_str.split('/')[-1])  # DD/MM/AAAA → AAAA
            except Exception:
                return 0

        if ano_explicito:
            ano_alvo = int(ano_explicito.group(1))
            com_data = [r for r in resultados if _data_para_ano(r.get('data', '')) == ano_alvo]
        else:
            ano_max  = max((_data_para_ano(r.get('data', '')) for r in resultados), default=0)
            com_data = [r for r in resultados if _data_para_ano(r.get('data', '')) >= ano_max - 1]

        # Só aplica filtro se houver candidatos suficientes (≥ n/2), senão usa todos
        if len(com_data) >= max(n // 2, 2):
            resultados = com_data + [r for r in resultados if r not in com_data]

    # S3.3 — Boost de engajamento: pondera score pelo log de views.
    # Efeito suave: um vídeo com 100k views tem boost de ~1.17x sobre um com 1k views.
    # Aplicado antes do CrossEncoder para não distorcer o reranking semântico.
    import math as _math
    views_max = max((r.get('views', 0) for r in resultados), default=1) or 1
    for r in resultados:
        views = r.get('views', 0)
        if views > 0:
            # Normaliza pelo máximo do conjunto e aplica boost logarítmico
            boost = 1.0 + 0.2 * (_math.log1p(views) / _math.log1p(views_max))
            r['score'] = round(r['score'] * boost, 3)

    resultados.sort(key=lambda x: x['score'], reverse=True)

    # Re-rankeamento semântico com CrossEncoder — ativado quando busca_ampla=True.
    # O toggle de Busca Ampla é a decisão consciente do usuário de querer mais profundidade:
    # BM25 recupera top-N candidatos, CrossEncoder reordena por relevância semântica real.
    # BM25 puro quando busca_ampla=False — mais rápido, suficiente para busca restrita.
    # N é calibrado por corpus_profile.json (P0-c) quando disponível — corpus maior
    # tem IDF menor por termo, mais candidatos dão ao CrossEncoder mais chance de
    # achar o chunk certo. Fallback para n*2 (comportamento original) sem perfil.
    if busca_ampla:
        from tusab_engine.agent.calibration import _carregar_profile
        n_candidatos = _carregar_profile(canal_prefixo).get('n_candidatos_bm25', n * 2)
        candidatos = _rerankar(pergunta, resultados[:n_candidatos])
    else:
        candidatos = resultados

    # Deduplicação semântica: remove chunks com sobreposição de tokens > threshold.
    # Jaccard sobre tokens BM25 (sem stopwords) — rápido, sem modelo extra.
    # Preserva o chunk de maior score quando há duplicata detectada.
    top = _deduplicar_chunks(candidatos, n, threshold=0.85)
    # Fallback: garante ao menos 1 chunk em corpora muito pequenos
    if not top and resultados:
        top = resultados[:1]
    elif not top and 'cached' in locals() and cached and cached.get('chunks'):
        top = [{**cached['chunks'][0], 'score': 0.0, 'canal': canal_nome}]

    return top


def buscar_trechos(query: str, canais: list = None, n: int = 8, busca_ampla: bool = True, projetos: list = None) -> list:
    """Pipeline completo de recuperação (BM25 + query expansion + CrossEncoder) sem gerar resposta.

    Retorna lista de chunks ranqueados prontos para o usuário selecionar e injetar no chat.
    Cada item: {titulo, texto_original, score, canal, aba, link, data, arquivo, timestamp_inicio}
    `projetos` é o nome novo para o parâmetro; `canais` mantido para retrocompatibilidade.
    """
    config = carregar_config()
    resultados = []
    # Normaliza: projetos tem prioridade sobre canais (legado)
    lista_projetos = projetos if projetos is not None else (canais or [])

    for canal_nome in lista_projetos:
        try:
            chunks = _recuperar_contexto(
                pergunta=query,
                canal_nome=canal_nome,
                n=n,
                config=config,
                canais_extras=[],
                busca_ampla=busca_ampla,
                perfil='',
            )
            for c in chunks:
                resultados.append({
                    'titulo':            c.get('titulo', ''),
                    'trecho':            c.get('texto_original') or c.get('texto', ''),
                    'score':             c.get('score', 0.0),
                    'canal':             canal_nome,
                    'aba':               c.get('aba', ''),
                    'link':              c.get('link', ''),
                    'data':              c.get('data', ''),
                    'arquivo':           c.get('arquivo', ''),
                    'timestamp_inicio':  c.get('timestamp_inicio', ''),
                    'fts_match':         c.get('fts_match', False),
                })
        except Exception:
            pass

    # Ordena globalmente por score — melhor trecho de qualquer base aparece primeiro
    resultados.sort(key=lambda x: x['score'], reverse=True)
    return resultados


def _carregar_resumos_relevantes(chunks: list, canal_prefixo: str) -> list:
    """Carrega _resumo.json dos vídeos mais relevantes recuperados pelo BM25.

    Percorre os chunks em ordem de relevância, carrega até 2 resumos distintos.
    Retorna lista de dicts {tema, subtemas, entidades, conclusao, titulo, video_id}.
    Falha silenciosa: se nenhum resumo existir, retorna [].
    """
    resumos = []
    vistos = set()

    for chunk in chunks:
        video_id = chunk.get('video_id', '')
        if not video_id or video_id in vistos:
            continue
        vistos.add(video_id)

        # Tenta localizar o _resumo.json: nova estrutura ou legado
        # Nova estrutura: neural/{prefixo}/youtube/{canal_sub}/{video_id}_resumo.json
        youtube_base = os.path.join(NEURAL_DIR, canal_prefixo, 'youtube')
        candidatos = []

        if os.path.isdir(youtube_base):
            for entry in os.scandir(youtube_base):
                if entry.is_dir():
                    candidatos.append(os.path.join(entry.path, f'{video_id}_resumo.json'))
            # Também flat dentro de youtube_base (legado de migração)
            candidatos.append(os.path.join(youtube_base, f'{video_id}_resumo.json'))
        # Legado: neural/youtube/
        candidatos.append(os.path.join(NEURAL_DIR, 'youtube', f'{video_id}_resumo.json'))

        for rpath in candidatos:
            if os.path.exists(rpath):
                try:
                    with open(rpath, 'r', encoding='utf-8') as f:
                        resumo = json.load(f)
                    if isinstance(resumo, dict) and resumo.get('tema'):
                        resumos.append(resumo)
                        break
                except Exception:
                    pass

        if len(resumos) >= 2:
            break

    return resumos


def _deduplicar_chunks(chunks: list, n: int, threshold: float = 0.85) -> list:
    """Remove chunks semanticamente redundantes usando similaridade Jaccard de tokens.

    Percorre os chunks em ordem de score (maior primeiro) e descarta qualquer
    chunk cuja sobreposição com um já selecionado supere `threshold`.
    Retorna no máximo `n` chunks.
    """
    def _tokens(texto: str) -> set:
        return {w for w in re.findall(r'\b[a-záéíóúàâêôãõç]{4,}\b', texto.lower())
                if w not in _STOPWORDS}

    selecionados = []
    tokens_selecionados = []

    for chunk in chunks:
        toks = _tokens(chunk.get('texto', ''))
        if not toks:
            selecionados.append(chunk)
            tokens_selecionados.append(toks)
            if len(selecionados) >= n:
                break
            continue
        redundante = False
        for toks_sel in tokens_selecionados:
            if not toks_sel:
                continue
            intersecao = len(toks & toks_sel)
            uniao = len(toks | toks_sel)
            if uniao > 0 and intersecao / uniao >= threshold:
                redundante = True
                break
        if not redundante:
            selecionados.append(chunk)
            tokens_selecionados.append(toks)
        if len(selecionados) >= n:
            break

    return selecionados


# ── Verificação de alucinação ─────────────────────────────────────────────────

def _verificar_alucinacao(resposta: str, contexto: list, canal_nome: str, trecho_injetado: bool = False) -> str:
    # Quando há trecho injetado, não filtramos: o usuário enviou conteúdo próprio da base
    # e o LLM sempre vai usar vocabulário analítico diferente do corpus original.
    if trecho_injetado:
        return resposta

    FRASES_NAO_ENCONTRADO = [
        'não encontrei', 'nao encontrei', 'not found',
        'não há informação', 'nao ha informacao',
        'não consta', 'nao consta',
    ]
    resposta_lower = resposta.lower()

    if any(f in resposta_lower for f in FRASES_NAO_ENCONTRADO):
        return resposta

    palavras_resposta = set(re.findall(r'\b[a-záéíóúàâêôãõç]{5,}\b', resposta_lower))
    palavras_resposta -= _STOPWORDS

    if not palavras_resposta:
        return resposta

    corpus_chunks = ' '.join(c['texto'].lower() for c in contexto)
    encontradas   = sum(1 for p in palavras_resposta if p in corpus_chunks)
    cobertura     = encontradas / len(palavras_resposta)

    # 0.12 em vez de 0.20 — LLMs legítimos usam sinônimos e paráfrases;
    # threshold muito alto descartar respostas corretas que só parafraseiam.
    if cobertura < 0.12:
        handle = f'@{canal_nome}' if canal_nome else 'este canal'
        return (
            f'Não encontrei informações suficientes sobre esse tema no conteúdo de {handle}. '
            f'Tente reformular a pergunta ou verifique se o canal aborda esse assunto.'
        )

    return resposta


def _calcular_confianca_por_sentenca(resposta: str, contexto: list) -> list:
    """Mede a confiança de cada sentença da resposta contra o corpus recuperado.

    Complementa _verificar_alucinacao() (que é binária: passa inteira ou é
    trocada por "não encontrei") com um sinal graduado por trecho — permite
    ao frontend destacar visualmente afirmações com baixo apoio no corpus,
    sem suprimir a resposta inteira. Mesma técnica de cobertura de vocabulário
    de _verificar_alucinacao(), aplicada por sentença em vez de na resposta toda.

    Aceita tanto chunks de retrieval (campo 'texto'/'texto_original') quanto
    fontes já formatadas para o frontend (campo 'trecho', truncado a 600
    chars) — usado tanto pelo chat() quanto pelo endpoint de streaming.

    Retorna [{"texto", "confianca", "inicio", "fim"}, ...] — offsets de
    caractere na resposta original, para o frontend fazer highlight sem
    reprocessar a string. Lista vazia se não houver contexto ou resposta.
    """
    if not resposta or not contexto:
        return []

    sentencas = re.split(r'(?<=[.!?])\s+', resposta)
    corpus_texto = ' '.join(
        (c.get('texto') or c.get('texto_original') or c.get('trecho') or '').lower()
        for c in contexto
    )

    resultado = []
    cursor = 0
    for sent in sentencas:
        if not sent.strip():
            continue
        try:
            inicio = resposta.index(sent, cursor)
        except ValueError:
            continue  # sentença não encontrada no texto original — pula (não deveria ocorrer)
        fim = inicio + len(sent)
        cursor = fim

        palavras = set(re.findall(r'\b[a-záéíóúàâêôãõç]{5,}\b', sent.lower())) - _STOPWORDS
        if not palavras:
            confianca = 1.0  # sentença sem conteúdo verificável (conectivo, transição)
        else:
            encontradas = sum(1 for p in palavras if p in corpus_texto)
            confianca = round(encontradas / len(palavras), 3)

        resultado.append({"texto": sent, "confianca": confianca, "inicio": inicio, "fim": fim})

    return resultado


# Normalização de markdown gerado por LLMs — corrige padrões comuns de saída malformada
_RE_PONTUACAO_DUPLICADA = re.compile(r'([.!?]){2,}')
_RE_DOISPONTOS_PONTO    = re.compile(r':\s*\.')
# "texto.- **Tópico**" ou "texto.**Tópico**" → quebra antes do bold (padrão Ollama)
_RE_BOLD_COLADO         = re.compile(r'([.!?,;])\s*-?\s*(?=\*\*)', re.UNICODE)
# "- **Tópico**: texto **OutroTópico**:" na mesma linha → quebra antes do segundo bold com ":"
_RE_BOLD_INLINE         = re.compile(r'(?<=\S)\s+(?=\*\*[^*\n]+\*\*\s*:)', re.UNICODE)

def _normalizar_markdown(resposta: str) -> str:
    resposta = _RE_DOISPONTOS_PONTO.sub(':', resposta)
    resposta = _RE_PONTUACAO_DUPLICADA.sub(r'\1', resposta)
    # Quebra tópicos bold colados na mesma linha em itens de lista separados
    resposta = _RE_BOLD_COLADO.sub(r'\1\n- ', resposta)
    resposta = _RE_BOLD_INLINE.sub('\n- ', resposta)
    # Garante linha em branco antes de cada item de lista para separar blocos
    resposta = re.sub(r'([^\n])\n(- )', r'\1\n\n\2', resposta)
    # Fecha ** não fechado no final de linha (modelo às vezes esquece o fechamento)
    resposta = re.sub(r'\*\*([^*\n]+)\n-\s\*\*', r'**\1**\n- ', resposta)
    return resposta


# ── Detecção de trecho injetado ───────────────────────────────────────────────

_RE_TRECHO_INJETADO = re.compile(r'^\[([^\]]+\.(?:txt|pdf|docx|xlsx|csv|md))\]\s*\n(.+)', re.DOTALL | re.IGNORECASE)

def _extrair_trecho_injetado(pergunta: str):
    """Detecta se a mensagem é um trecho injetado do Repositório.

    Formato: '[arquivo.txt]\\nconteúdo...'
    Retorna (arquivo, conteudo) ou (None, None).
    """
    m = _RE_TRECHO_INJETADO.match(pergunta.strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None, None


def _montar_prompt_trecho(arquivo: str, trecho: str, meta_canal: dict = None, historico: list = None, persona: str = '', idioma: str = 'pt') -> str:
    """Prompt especializado para análise de trecho injetado sem pergunta explícita."""
    handle = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'
    lang_label = _IDIOMA_LABEL.get(idioma, 'português')
    lang_instr = f"IDIOMA: responda SEMPRE em {lang_label}.\n\n"

    instrucao_tom = ''
    if persona and persona in PERSONAS:
        instrucao_tom = f"TOM DE RESPOSTA: {PERSONAS[persona]}\n\n"

    hist_str = ''
    if historico:
        trocas = []
        for h in historico[-6:]:
            role    = 'user' if h.get('role') == 'user' else 'assistant'
            content = str(h.get('content', ''))[:300]
            trocas.append(f"<{role}>{content}</{role}>")
        if trocas:
            hist_str = "<conversation_history>\n" + "\n".join(trocas) + "\n</conversation_history>\n\n"

    return (
        f"Você é o Tusab, assistente de gestão de conhecimento de {handle}.\n\n"
        f"O usuário compartilhou o trecho abaixo, extraído do arquivo **{arquivo}** da sua base.\n"
        f"Ele não fez uma pergunta explícita — isso significa que quer reflexão, análise ou aprofundamento sobre o conteúdo.\n\n"
        f"TAREFA:\n"
        f"1. Identifique o tema central do trecho.\n"
        f"2. Reflita sobre as ideias apresentadas, expandindo-as com profundidade.\n"
        f"3. Se identificar uma pergunta implícita no conteúdo, responda-a.\n"
        f"4. Convide o usuário a continuar a conversa com uma pergunta específica sobre o tema.\n\n"
        f"NÃO diga que não encontrou informações — o trecho É a fonte.\n\n"
        + lang_instr
        + instrucao_tom
        + hist_str
        + f"<trecho arquivo=\"{arquivo}\">\n{trecho[:3000]}\n</trecho>\n\nRESPOSTA:"
    )


# ── Montagem do prompt ────────────────────────────────────────────────────────

_IDIOMA_LABEL = {"pt": "português", "en": "English", "es": "español"}

def _montar_prompt(pergunta: str, contexto: list, meta_canal: dict = None, historico: list = None, busca_ampla: bool = False, persona: str = '', idioma: str = 'pt', canal_prefixo: str = '') -> str:
    pergunta = pergunta[:2000].strip()
    handle   = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'

    _max_chunk = 1500 if (carregar_config().get('provider') == 'ollama') else 3000

    # Tenta carregar resumos dos vídeos mais relevantes para dar visão macro ao LLM
    resumo_str = ''
    if canal_prefixo:
        try:
            resumos = _carregar_resumos_relevantes(contexto, canal_prefixo)
            if resumos:
                partes_resumo = []
                for r in resumos:
                    r_titulo = r.get('titulo', r.get('video_id', ''))
                    partes_resumo.append(
                        f"• **{r_titulo}**: {r.get('tema', '')}. "
                        f"Subtemas: {', '.join(r.get('subtemas', [])[:3])}. "
                        f"Conclusão: {r.get('conclusao', '')}"
                    )
                resumo_str = "## Visão geral dos vídeos mais relevantes\n" + "\n".join(partes_resumo) + "\n\n"
        except Exception:
            pass  # degradação graciosa

    blocos = []
    for i, c in enumerate(contexto, 1):
        # Usa texto_original (sem keywords KeyBERT) para exibição ao LLM
        texto_display = c.get('texto_original') or c.get('texto', '')
        blocos.append(
            f"<source id=\"{i}\">\n"
            f"<title>{c['titulo']}</title>\n"
            f"<date>{c['data']}</date>\n"
            f"<link>{c['link']}</link>\n"
            f"<content>{texto_display[:_max_chunk]}</content>\n"
            f"</source>"
        )
    contexto_str = "\n".join(blocos)

    hist_str = ''
    if historico:
        trocas = []
        for h in historico[-6:]:
            role    = 'user' if h.get('role') == 'user' else 'assistant'
            content = str(h.get('content', ''))[:300]
            trocas.append(f"<{role}>{content}</{role}>")
        if trocas:
            hist_str = "<conversation_history>\n" + "\n".join(trocas) + "\n</conversation_history>\n\n"

    instrucao_tom = ''
    if persona and persona in PERSONAS:
        instrucao_tom = f"TOM DE RESPOSTA: {PERSONAS[persona]}\n\n"

    lang_label = _IDIOMA_LABEL.get(idioma, "português")
    lang_instr = f"IDIOMA: responda SEMPRE em {lang_label}, independentemente do idioma das fontes.\n\n"

    fmt_instr = (
        "FORMATO: escreva em Markdown limpo.\n"
        "- Parágrafos separados por linha em branco.\n"
        "- Para listar tópicos, use UMA linha por item começando com \"- \" (lista Markdown) — nunca junte vários tópicos na mesma linha.\n"
        "- Não repita pontuação (nunca escreva \"..\" ou \":.\" — use apenas \".\" ou \":\").\n"
        "- Não coloque \":\" logo após um termo em **negrito** seguido de texto na mesma linha de outros tópicos; cada tópico em negrito deve abrir sua própria linha de lista.\n\n"
    )

    if busca_ampla:
        instrucoes = (
            f"Você é o Tusab em modo de Busca Ampla.\n\n"
            f"TAREFA: responda à pergunta usando as fontes abaixo como referência principal.\n"
            f"Quando as fontes contiverem a informação, cite-as. "
            f"Quando forem insuficientes, você pode complementar com conhecimento geral "
            f"— mas deixe claro: use 'além do que está na base...' ou 'de forma geral...'.\n"
            f"Seja sempre honesto sobre a origem de cada informação.\n\n"
            + fmt_instr
            + lang_instr
            + instrucao_tom
        )
    else:
        instrucoes = (
            f"Você é o Tusab, um assistente que responde com base nas fontes abaixo.\n\n"
            f"TAREFA: leia TODAS as fontes com atenção e extraia as informações que respondam à pergunta.\n"
            f"IMPORTANTE: se qualquer fonte contiver informação relevante — mesmo parcialmente — USE-A para responder.\n"
            f"NÃO use conhecimento externo ou de treinamento além do que está nas fontes.\n"
            f"CADA afirmação deve poder ser rastreada a uma das fontes pelo campo <title> ou <content>.\n"
            f"SOMENTE se nenhuma fonte contiver absolutamente nenhuma informação relevante, responda:\n"
            f"'Não encontrei esse tema no conteúdo do {handle}.'\n\n"
            + fmt_instr
            + lang_instr
            + instrucao_tom
        )

    return (
        instrucoes
        + hist_str
        + resumo_str
        + f"<sources canal=\"{handle}\">\n{contexto_str}\n</sources>\n\n"
        + f"<question>{pergunta}</question>\n\nRESPOSTA:"
    )


# ── Resposta sem contexto ────────────────────────────────────────────────────

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

def _prompt_sem_contexto(idioma: str = 'pt') -> str:
    lang_label = _IDIOMA_LABEL.get(idioma, "português")
    return (
        "Você é o Tusab, um assistente de gestão de conhecimento pessoal.\n\n"
        "A busca na base de conhecimento NÃO retornou trechos relevantes para a pergunta do usuário.\n\n"
        f"Responda SEMPRE em {lang_label}. Seja conciso (máximo 2 parágrafos).\n\n"
        "REGRAS ABSOLUTAS:\n"
        "- NUNCA invente nomes, pessoas, fatos ou informações — você não tem acesso ao conteúdo da base agora.\n"
        "- NUNCA elabore sobre o tema perguntado — você não tem essa informação.\n"
        "- Se for saudação simples, apresente-se brevemente como Tusab.\n"
        "- Se for pergunta temática, informe claramente que não encontrou esse tema na base atual.\n"
        "  Não especule, não liste possibilidades, não invente subtópicos relacionados.\n\n"
        "Mensagem do usuário: {mensagem}\n\nRESPOSTA:"
    )


def _responder_sem_contexto(pergunta: str, config: dict, canal_nome: str) -> str:
    """Gera resposta inteligente quando o BM25 não retorna contexto relevante."""
    pergunta_lower = pergunta.strip().lower().rstrip('!?.')
    idioma = config.get('idioma', 'pt')

    # Saudação simples: responde sem chamar LLM (via LLM seria overkill para um "oi")
    if pergunta_lower in _SAUDACOES:
        _saudacoes_i18n = {
            'en': (
                "Hi! I'm Tusab, your knowledge base assistant. "
                "I can answer questions about the videos, documents, and texts you've added to your repository. "
                "To get started, make sure your content is indexed and ask a specific question."
            ),
            'es': (
                "¡Hola! Soy Tusab, tu asistente de base de conocimiento. "
                "Puedo responder preguntas sobre los videos, documentos y textos que agregaste a tu repositorio. "
                "Para comenzar, asegúrate de que el contenido esté indexado y haz una pregunta específica."
            ),
        }
        return _saudacoes_i18n.get(idioma, (
            "Olá! Sou o Tusab, seu assistente de base de conhecimento. "
            "Posso responder perguntas sobre os vídeos, documentos e textos que você adicionou ao repositório. "
            "Para começar, certifique-se de que o conteúdo está indexado e faça uma pergunta específica."
        ))

    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    # Sem LLM configurado: mensagem estática melhorada
    if not provider or (not api_key and provider != 'ollama'):
        _sem_llm_i18n = {
            'en': (
                "No relevant content found for this question in the knowledge base.\n\n"
                "This may happen because:\n"
                "• Content hasn't been indexed yet — use the **Index Now** button in agent settings\n"
                "• The question uses different terms than those in your files — try rephrasing\n"
                "• The topic isn't covered by your videos, documents, or texts\n\n"
                "Remember: the base can include YouTube transcripts, PDFs, spreadsheets, and pasted texts."
            ),
            'es': (
                "No encontré contenido relevante para esta pregunta en la base de conocimiento.\n\n"
                "Esto puede suceder porque:\n"
                "• El contenido aún no fue indexado — usa el botón **Indexar Ahora** en la configuración del agente\n"
                "• La pregunta usa términos distintos a los de tus archivos — intenta reformularla\n"
                "• El tema no está cubierto por tus videos, documentos o textos\n\n"
                "Recuerda: la base puede incluir transcripciones de YouTube, PDFs, planillas y textos pegados."
            ),
        }
        return _sem_llm_i18n.get(idioma, (
            f"Não encontrei conteúdo relevante para essa pergunta na base de conhecimento.\n\n"
            f"**Dica:** vá ao Repositório, busque pelo tema e clique em **\"Referenciar no chat\"** "
            f"para injetar o trecho ou vídeo diretamente aqui — assim consigo responder com precisão."
        ))

    prompt = _prompt_sem_contexto(idioma).format(mensagem=pergunta[:1000])

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            resp = _req.post(
                'http://localhost:11434/api/generate',
                json={'model': modelo, 'prompt': prompt, 'stream': False},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json().get('response', '').strip() or _fallback_sem_contexto(canal_nome)

        elif provider == 'openai':
            from openai import OpenAI
            resp = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=15,
            )
            return resp.choices[0].message.content.strip()

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key).messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=400,
                messages=[{'role': 'user', 'content': prompt}],
            )
            return msg.content[0].text.strip()

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            resp = OpenAI(api_key=api_key, base_url='https://api.groq.com/openai/v1').chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=15,
            )
            return resp.choices[0].message.content.strip()

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-lite']
            modelos_ok = [m.name.replace('models/', '') for m in _genai.list_models()
                          if 'generateContent' in m.supported_generation_methods]
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if modelo:
                resp = _genai.GenerativeModel(modelo).generate_content(prompt)
                return resp.text.strip()

    except Exception:
        pass

    return _fallback_sem_contexto(canal_nome)


def _fallback_sem_contexto(canal_nome: str) -> str:
    handle = f'@{canal_nome}' if canal_nome else 'esta base'
    return (
        f"Não encontrei conteúdo relevante para essa pergunta em {handle}.\n\n"
        f"**Dica:** vá ao Repositório, busque pelo tema e clique em **\"Referenciar no chat\"** "
        f"para injetar o trecho ou vídeo diretamente aqui — assim consigo responder com precisão."
    )


# ── Chat (sync) ───────────────────────────────────────────────────────────────

def chat(pergunta: str, projeto_nome: str, historico: list = None, projetos_extras: list = None, busca_ampla: bool = False, fontes_fixadas: list = None, perfil: str = '', trechos_fixados: list = None) -> dict:
    canal_nome = projeto_nome          # alias interno — não altera o restante do código
    canais_extras = projetos_extras or []
    config   = carregar_config()
    provider = config.get('provider', '')
    if not provider or (not _api_key_valida(config) and provider != 'ollama'):
        raise ValueError("Configure a chave de API antes de usar o chat.")

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    persona       = config.get('persona', '')
    idioma        = config.get('idioma', 'pt')

    # Detecta trecho injetado: usa prompt especializado sem precisar do BM25
    arq_injetado, trecho_injetado = _extrair_trecho_injetado(pergunta)
    trecho_mode = bool(arq_injetado)

    if trecho_mode:
        contexto = []
        prompt   = _montar_prompt_trecho(arq_injetado, trecho_injetado, meta_canal, historico, persona, idioma)
    else:
        from tusab_engine.state import state as _state

        # Classifica intenção em paralelo com o BM25 — sem latência extra no caso BUSCA
        intencao_future = _intent_executor.submit(_classificar_intencao, pergunta, historico or [], config)
        n_chunks = 4 if config.get('provider') == 'ollama' else 6
        try:
            contexto_bm25 = _recuperar_contexto(
                pergunta, canal_nome, n=n_chunks, config=config,
                canais_extras=canais_extras, fontes_fixadas=fontes_fixadas,
                busca_ampla=busca_ampla, perfil=perfil,
                trechos_fixados=trechos_fixados or [],
            )
        except Exception:
            contexto_bm25 = []
        try:
            intencao = intencao_future.result(timeout=20)
        except Exception:
            intencao = 'BUSCA'

        ultima = _state.last_chat_response.get(canal_prefixo, {})

        if intencao == 'CONTEXTO' and not ultima:
            intencao = 'BUSCA'

        # Saudações conhecidas são sempre CONVERSA — mesmo sem histórico o classificador
        # retorna BUSCA por design, mas "oi"/"olá" nunca deve disparar BM25 nem mostrar fontes.
        pergunta_lower_strip = pergunta.strip().lower().rstrip('!?.')
        if pergunta_lower_strip in _SAUDACOES:
            intencao = 'CONVERSA'

        # Trechos fixados pelo usuário (@@): forçar BUSCA para não descartar o contexto
        if trechos_fixados and intencao != 'CONTEXTO':
            intencao = 'BUSCA'

        if intencao == 'CONTEXTO':
            # Bypass total do BM25 — opera sobre a resposta anterior
            contexto = []
            prompt   = _montar_prompt_contexto(pergunta, historico or [], ultima, persona, idioma)
        elif intencao == 'CONVERSA':
            contexto = []
            resposta_vazia = _responder_sem_contexto(pergunta, config, canal_nome)
            return {'resposta': resposta_vazia, 'fontes': [], 'sem_contexto': False}
        else:
            contexto = contexto_bm25
            if not contexto:
                resposta_vazia = _responder_sem_contexto(pergunta, config, canal_nome)
                return {'resposta': resposta_vazia, 'fontes': [], 'sem_contexto': True}
            prompt = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona, idioma, canal_prefixo=canal_prefixo)

    provider = config['provider']
    api_key  = config['api_key']

    if provider == 'openai':
        from openai import OpenAI
        resp     = OpenAI(api_key=api_key).chat.completions.create(
            model='gpt-4o-mini',
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        resposta = resp.choices[0].message.content

    elif provider == 'anthropic':
        import anthropic
        msg      = anthropic.Anthropic(api_key=api_key).messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        resposta = msg.content[0].text

    elif provider in ('gemini', 'google'):
        import google.generativeai as _genai
        _genai.configure(api_key=api_key)
        CANDIDATOS = [
            'gemini-1.5-flash', 'gemini-1.5-flash-latest',
            'gemini-1.5-flash-002', 'gemini-1.5-pro',
            'gemini-pro', 'gemini-2.0-flash-lite',
        ]
        modelos_ok = [
            m.name.replace('models/', '') for m in _genai.list_models()
            if 'generateContent' in m.supported_generation_methods
        ]
        modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
        if not modelo:
            raise ValueError('Nenhum modelo Gemini disponível para esta chave.')
        resp     = _genai.GenerativeModel(modelo).generate_content(prompt)
        resposta = resp.text

    elif provider == 'groq':
        from openai import OpenAI
        modelo   = config.get('groq_model', 'llama-3.1-8b-instant')
        resp     = OpenAI(api_key=api_key, base_url='https://api.groq.com/openai/v1').chat.completions.create(
            model=modelo,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        resposta = resp.choices[0].message.content

    elif provider == 'ollama':
        import requests as _req
        modelo = config.get('ollama_model', 'llama3.2:1b')
        resp = _req.post(
            'http://localhost:11434/api/generate',
            json={
                'model':   modelo,
                'prompt':  prompt,
                'stream':  False,
                'options': {
                    'num_ctx':     2048,
                    'num_predict': 512,
                    'num_thread':  8,
                    'temperature': 0.3,
                },
            },
            timeout=300,
        )
        resp.raise_for_status()
        resposta = resp.json().get('response', '')

    else:
        raise ValueError(f"Provedor desconhecido: {provider}")

    resposta = _verificar_alucinacao(resposta, contexto, canal_nome, trecho_injetado=trecho_mode)
    resposta = _normalizar_markdown(resposta)

    # Confiança graduada por sentença (P1-e) — sinal visual opcional para o
    # frontend, não bloqueia nada. Mesma exceção do trecho injetado usada em
    # _verificar_alucinacao(): vocabulário do usuário não bate com o corpus
    # por natureza, não é indício de alucinação.
    confianca_sentencas = [] if trecho_mode else _calcular_confianca_por_sentenca(resposta, contexto)

    if not trecho_mode and intencao == 'CONTEXTO' and ultima:
        fontes = ultima.get('fontes', [])
    else:
        fontes = [{
            'titulo':            c.get('titulo', ''),
            'aba':               c.get('aba', 'youtube'),
            'data':              c.get('data', ''),
            'link':              c.get('link', ''),
            'arquivo':           c.get('arquivo', ''),
            'canal':             c.get('canal', ''),
            'score':             c.get('score', 0.0),
            'trecho':            (c.get('texto_original') or c.get('texto', ''))[:600],
            'video_id':          c.get('video_id', ''),
            'timestamp_inicio':  c.get('timestamp_inicio', 0),
        } for c in contexto]

    if trecho_mode and not fontes:
        fontes = [{'titulo': arq_injetado, 'aba': 'documento', 'data': '', 'link': '', 'arquivo': arq_injetado, 'canal': canal_nome, 'score': 1.0}]

    # Persiste resposta para uso pelo classificador de intenção na próxima mensagem
    try:
        from tusab_engine.state import state as _state
        _state.last_chat_response[canal_prefixo] = {
            'pergunta': pergunta,
            'resposta': resposta,
            'fontes':   fontes,
        }
    except Exception:
        pass

    return {
        'resposta':             resposta,
        'meta_canal':           meta_canal,
        'fontes':               fontes,
        'confianca_sentencas':  confianca_sentencas,
    }


# ── Chat (streaming) ──────────────────────────────────────────────────────────

def chat_stream(pergunta: str, projeto_nome: str, historico: list = None, projetos_extras: list = None, busca_ampla: bool = False, fontes_fixadas: list = None, perfil: str = '', trechos_fixados: list = None):
    """Yields chunks de texto. Primeiro yield: JSON com fontes; demais: texto puro."""
    canal_nome = projeto_nome          # alias interno — não altera o restante do código
    canais_extras = projetos_extras or []
    config = carregar_config()
    if not config.get('provider') or (not _api_key_valida(config) and config.get('provider') != 'ollama'):
        yield json.dumps({'error': 'Configure a chave de API antes de usar o chat.'})
        return

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    persona       = config.get('persona', '')
    idioma        = config.get('idioma', 'pt')

    # Detecta trecho injetado: bypass do BM25, prompt especializado de análise
    arq_injetado, trecho_injetado = _extrair_trecho_injetado(pergunta)
    trecho_mode = bool(arq_injetado)

    if trecho_mode:
        contexto = []
        prompt   = _montar_prompt_trecho(arq_injetado, trecho_injetado, meta_canal, historico, persona, idioma)
        fontes   = [{'titulo': arq_injetado, 'aba': 'documento', 'data': '', 'link': '', 'arquivo': arq_injetado, 'canal': canal_nome, 'score': 1.0}]
    else:
        from tusab_engine.state import state as _state

        # Classificação de intenção paralela ao BM25 — sem latência extra no caso BUSCA
        intencao_future = _intent_executor.submit(_classificar_intencao, pergunta, historico or [], config)
        n_chunks = 4 if config.get('provider') == 'ollama' else 6
        try:
            contexto_bm25 = _recuperar_contexto(
                pergunta, canal_nome, n=n_chunks, config=config,
                canais_extras=canais_extras, fontes_fixadas=fontes_fixadas,
                busca_ampla=busca_ampla, perfil=perfil,
                trechos_fixados=trechos_fixados or [],
            )
        except Exception as e:
            yield json.dumps({'error': str(e)})
            return
        try:
            intencao = intencao_future.result(timeout=20)
        except Exception:
            intencao = 'BUSCA'

        ultima = _state.last_chat_response.get(canal_prefixo, {})

        if intencao == 'CONTEXTO' and not ultima:
            intencao = 'BUSCA'

        # Saudações conhecidas são sempre CONVERSA — mesmo sem histórico o classificador
        # retorna BUSCA por design, mas "oi"/"olá" nunca deve disparar BM25 nem mostrar fontes.
        pergunta_lower_strip = pergunta.strip().lower().rstrip('!?.')
        if pergunta_lower_strip in _SAUDACOES:
            intencao = 'CONVERSA'

        # Trechos fixados pelo usuário (@@): forçar BUSCA para não descartar o contexto
        if trechos_fixados and intencao != 'CONTEXTO':
            intencao = 'BUSCA'

        if intencao == 'CONTEXTO':
            contexto = []
            prompt   = _montar_prompt_contexto(pergunta, historico or [], ultima, persona, idioma)
            fontes   = ultima.get('fontes', [])  # reusar fontes da resposta anterior
        elif intencao == 'CONVERSA':
            config_s = carregar_config()
            resposta_vazia = _responder_sem_contexto(pergunta, config_s, canal_nome)
            yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': False})
            yield resposta_vazia
            yield json.dumps({'done': True})
            return
        else:
            contexto = contexto_bm25
            if not contexto:
                config_s = carregar_config()
                resposta_vazia = _responder_sem_contexto(pergunta, config_s, canal_nome)
                yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': True})
                yield resposta_vazia
                yield json.dumps({'done': True})
                return
            prompt = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona, idioma, canal_prefixo=canal_prefixo)
            fontes = [{
                'titulo':            c['titulo'],
                'aba':               c.get('aba', 'youtube'),
                'data':              c['data'],
                'link':              c['link'],
                'arquivo':           c.get('arquivo', ''),
                'canal':             c.get('canal', ''),
                'score':             c['score'],
                'trecho':            (c.get('texto_original') or c.get('texto', ''))[:600],
                'video_id':          c.get('video_id', ''),
                'timestamp_inicio':  c.get('timestamp_inicio', 0),
            } for c in contexto]

    provider = config['provider']
    api_key  = config.get('api_key', '')

    yield json.dumps({'fontes': fontes, 'done': False})

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            with _req.post('http://localhost:11434/api/generate',
                    json={
                        'model':   modelo,
                        'prompt':  prompt,
                        'stream':  True,
                        'options': {
                            'num_ctx':     2048,
                            'num_predict': 512,
                            'num_thread':  8,
                            'temperature': 0.3,
                        },
                    },
                    stream=True, timeout=300) as r:
                for line in r.iter_lines():
                    if line:
                        data = json.loads(line)
                        chunk = data.get('response', '')
                        if chunk:
                            yield chunk
                        if data.get('done'):
                            break

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = ['gemini-1.5-flash','gemini-1.5-flash-latest','gemini-1.5-flash-002','gemini-1.5-pro','gemini-pro','gemini-2.0-flash-lite']
            modelos_ok = [m.name.replace('models/','') for m in _genai.list_models() if 'generateContent' in m.supported_generation_methods]
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if modelo:
                for chunk in _genai.GenerativeModel(modelo).generate_content(prompt, stream=True):
                    if chunk.text:
                        yield chunk.text

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            stream = OpenAI(api_key=api_key, base_url='https://api.groq.com/openai/v1').chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=1500,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta

        elif provider == 'openai':
            from openai import OpenAI
            stream = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=1500,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta

        elif provider == 'anthropic':
            import anthropic
            with anthropic.Anthropic(api_key=api_key).messages.stream(
                model='claude-sonnet-4-6',
                max_tokens=1500,
                messages=[{'role': 'user', 'content': prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield text

    except Exception as e:
        yield json.dumps({'error': str(e)})
        return

    yield json.dumps({'done': True})
