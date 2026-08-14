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
from tusab_engine.agent.llm_providers import (
    _api_key_valida, _client_openai_compat, _get_llm_client,
    _GEMINI_CANDIDATOS, _MODELO_ANTHROPIC_AUXILIAR, _MODELO_ANTHROPIC_PRINCIPAL, _MODELO_OPENAI,
)
from tusab_engine.agent.router import (
    rotear, pre_rotear, iniciar_classificacao_intencao, extrair_trecho_injetado,
    _SAUDACOES, _normalizar_saudacao,
)
from tusab_engine.agent.metadados import responder_metadados
from tusab_engine.agent.calculo import responder_calculo
from tusab_engine.agent.critique import (
    Critica, avaliar_relevancia_contexto,
    tem_lacuna_numerica, verificar_alucinacao, avaliar_confianca_por_sentenca,
    GAP_RELEVANCIA_CE, RATIO_RELEVANCIA_BM25,
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
        # Guarda o score bruto do CrossEncoder (não o BM25) — usado depois em
        # _recuperar_contexto() pra filtrar candidatos irrelevantes por lacuna
        # de relevância real, não só reordenar e descartar o número.
        for c, s in zip(chunks, scores):
            c['_ce_score'] = float(s)
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
# 'custom' entra aqui porque fala o mesmo protocolo síncrono OpenAI-compatible
# do Groq — a latência real depende do que está atrás do endpoint, mas o
# público dessa opção (perfil técnico, servidor próprio) já assume esse risco.
PROVEDORES_COM_EXPANSION = {'groq', 'openai', 'anthropic', 'gemini', 'google', 'custom'}

# Providers que não exigem api_key real — Ollama roda sem chave por natureza;
# 'custom' cobre servidores locais tipo 9router que tipicamente não pedem chave.
_PROVEDORES_SEM_CHAVE_OBRIGATORIA = {'ollama', 'custom'}

# ── Personas ──────────────────────────────────────────────────────────────────

PERSONAS = {
    'objetivo':      'Use linguagem direta e objetiva, sem floreios ou rodeios. Vá direto ao ponto.',
    'tecnico':       'Use terminologia técnica precisa, dados exatos e nomenclaturas corretas. Assuma que o usuário tem conhecimento da área.',
    'didatico':      'Explique com exemplos concretos, analogias e passo a passo. Priorize a compreensão.',
    'descontraido':  'Use um tom leve e conversacional, como uma conversa entre amigos. Pode usar linguagem informal.',
    'socratico':     'Ao final de cada resposta, inclua uma pergunta que aprofunde o raciocínio do usuário sobre o tema.',
}


def _resolver_instrucao_tom(persona: str, persona_custom: str = '') -> str:
    """Resolve a linha 'TOM DE RESPOSTA' injetada no fim do prompt.

    'custom' usa o texto livre definido pelo usuário (persona_custom) em vez
    de um preset de PERSONAS — mesmo mecanismo de injeção, só troca a fonte
    do texto. Sem sanitização especial: já é limitado a 300 chars pelo
    Pydantic (AgentConfigRequest) e só alimenta o prompt do LLM, nunca
    comando de shell, path de arquivo ou query — não há superfície de SQL/
    command injection aqui, só o mesmo risco de prompt injection que
    qualquer texto livre do usuário já tem no RAG (mitigado a jusante pela
    verificação anti-alucinação).
    """
    if persona == 'custom' and persona_custom.strip():
        return f'TOM DE RESPOSTA: {persona_custom.strip()}\n\n'
    if persona and persona in PERSONAS:
        return f'TOM DE RESPOSTA: {PERSONAS[persona]}\n\n'
    return ''

# Instrução de formato compartilhada por todos os prompt builders (_montar_prompt,
# _montar_prompt_contexto, _montar_prompt_trecho) — o ChatDrawer já renderiza
# ReactMarkdown com remark-gfm (tabelas, negrito, listas) e components estilizados
# para cada elemento; sem esta instrução o LLM tende a devolver texto corrido sem
# nenhuma estrutura, mesmo com o pipeline de renderização pronto para recebê-la.
_FMT_INSTR = (
    "FORMATO: escreva em Markdown limpo, pensado para leitura confortável no chat.\n"
    "- Parágrafos separados por linha em branco — nunca um bloco único de texto corrido.\n"
    "- Para listar tópicos, use UMA linha por item começando com \"- \" (lista Markdown) — nunca junte vários tópicos na mesma linha.\n"
    "- Use **negrito** para destacar termos-chave, nomes e dados importantes — não frases inteiras.\n"
    "- Quando a resposta comparar itens ou apresentar dados estruturados (preços, datas, categorias, prós/contras), use uma tabela Markdown (cabeçalho + linhas com \"|\").\n"
    "- Emojis com moderação: só quando reforçam a organização visual (ex.: ✅ ❌ 📌 ⚠️) ou o tema pede — nunca um emoji decorativo por frase.\n"
    "- Não repita pontuação (nunca escreva \"..\" ou \":.\" — use apenas \".\" ou \":\").\n"
    "- Não coloque \":\" logo após um termo em **negrito** seguido de texto na mesma linha de outros tópicos; cada tópico em negrito deve abrir sua própria linha de lista.\n\n"
)


# RAM do sistema (não CPU) é o sinal usado pra alertar sobrecarga durante
# geração local via Ollama — CPU alta é esperada em qualquer geração e não
# diferencia uso normal de sobrecarga real; RAM alta indica risco real de
# swap/lentidão no resto da máquina do usuário.
_RAM_ALERTA_PCT = 88.0
_RAM_CRITICO_PCT = 95.0


def _checar_sobrecarga_recursos():
    """Amostra RAM do sistema; retorna dict de alerta se acima do limiar, senão None.
    Degradação graciosa se psutil ausente (não deveria ocorrer — é dependência
    obrigatória do projeto, mas o padrão de checagem defensiva segue router_metrics.py)."""
    try:
        import psutil as _psutil
        ram_pct = _psutil.virtual_memory().percent
    except Exception:
        return None
    if ram_pct >= _RAM_ALERTA_PCT:
        return {
            'ram_pct': round(ram_pct, 1),
            'nivel': 'critico' if ram_pct >= _RAM_CRITICO_PCT else 'alerta',
        }
    return None


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
            client, modelo = _get_llm_client(provider, api_key, config)
            if modelo:
                resp = client.GenerativeModel(modelo).generate_content(prompt_expansion)
                linhas = resp.text.strip().splitlines()
                variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'openai':
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt_expansion}],
                max_tokens=120,
                timeout=8,
            )
            linhas = resp.choices[0].message.content.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'anthropic':
            client, modelo = _get_llm_client(provider, api_key, config)
            msg = client.messages.create(
                model=modelo,
                max_tokens=120,
                messages=[{'role': 'user', 'content': prompt_expansion}],
                timeout=8,
            )
            linhas = msg.content[0].text.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider in ('groq', 'custom'):
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
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


def _montar_prompt_contexto(pergunta: str, historico: list, ultima_resposta: dict,
                             persona: str = '', idioma: str = 'pt', persona_custom: str = '') -> str:
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

    instrucao_tom = _resolver_instrucao_tom(persona, persona_custom)

    return (
        f'Você é o Tusab, um assistente de gestão de conhecimento.\n\n'
        f'O usuário fez uma instrução sobre a resposta anterior da conversa.\n'
        f'NÃO busque novos documentos — opere sobre o conteúdo já apresentado.\n\n'
        f'IDIOMA: responda SEMPRE em {lang_label}.\n\n'
        + _FMT_INSTR
        + instrucao_tom
        + hist_str
        + f'<previous_question>{pergunta_anterior}</previous_question>\n\n'
        + f'<previous_answer>{resposta_anterior}</previous_answer>\n\n'
        + f'<instruction>{pergunta}</instruction>\n\nRESPOSTA:'
    )


# ── Recuperação BM25 ──────────────────────────────────────────────────────────

_PONTUACAO_BORDA = '.,!?;:()[]{}"\'`¿¡”“‘’'


def _tokenizar_query(texto: str) -> list:
    """Tokeniza a pergunta do usuário pra busca BM25: mesma base (.lower().split(),
    compatível com a tokenização do corpus em index.py::_enriquecer_documento),
    mas removendo pontuação de borda e stopwords antes de pontuar.

    Sem isso, palavras funcionais de invólucro conversacional ("me", "sobre",
    "o", "que"...) da própria pergunta acumulam score BM25 alto em corpus com
    muito texto formal/repetitivo (ex: leis), competindo — e às vezes vencendo —
    contra o termo real da pergunta. Achado ao vivo em 14/ago/2026: "Me fale
    sobre self-rag. O que é?" numa base com papers de RAG + leis recuperava só
    leis, porque "sobre" sozinho pontuava mais alto que "self-rag" (IDF alto
    por termo raro por-documento, TF alto dentro de cada lei longa).
    """
    tokens = (texto or '').lower().split()
    limpos = [t.strip(_PONTUACAO_BORDA) for t in tokens]
    filtrados = [t for t in limpos if t and t not in _STOPWORDS]
    return filtrados or limpos or tokens


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


# S3.4 — Filtro por identificador literal: quando a pergunta cita um número
# específico no formato "nº de lei" (ex: "14.688"), restringe aos chunks cujo
# TÍTULO contém esse mesmo identificador. Sem isso, BM25 recupera outros
# documentos que só compartilham vocabulário genérico (ex: "crimes hediondos",
# "Código Penal") com score bem mais baixo mas ainda dentro do top-n — e o LLM
# confunde o conteúdo deles com o do documento perguntado (confirmado ao vivo,
# 29/jul/2026: pergunta sobre a Lei 14.688 trouxe conteúdo real da Lei 14.344
# na resposta, não invenção — conflação entre chunks, ver agents/_historia.md).
# Extraído como função própria (não inline em _recuperar_contexto) pra ser
# testável sem precisar de um corpus BM25 real — BM25 degenera com corpus
# sintético pequeno (IDF fica negativo quando um termo aparece na maioria dos
# poucos documentos), o que tornava esse trecho difícil de testar isolado.
_RE_IDENTIFICADOR = re.compile(r'\b\d{1,3}(?:\.\d{3})+\b')


def _filtrar_por_identificador(pergunta: str, resultados: list) -> list:
    """Só aplica quando há match real; sem match, retorna resultados inalterado."""
    identificadores_pergunta = set(_RE_IDENTIFICADOR.findall(pergunta))
    if not identificadores_pergunta:
        return resultados
    com_identificador = [
        r for r in resultados
        if identificadores_pergunta & set(_RE_IDENTIFICADOR.findall(r.get('titulo', '')))
    ]
    return com_identificador if com_identificador else resultados


_RE_SUFIXO_PARTE = re.compile(r'\s*\(parte \d+/\d+\)$')


def _titulo_base(titulo: str) -> str:
    """Remove o sufixo ' (parte N/M)' que extraction.py anexa ao título de cada
    sub-parte de um capítulo dividido (ver _LIMITE_CHUNK_CHARS) — necessário pra
    identificar partes irmãs do MESMO capítulo em _recuperar_contexto(), já que
    o título completo difere entre elas (parte 1/2 != parte 2/2)."""
    return _RE_SUFIXO_PARTE.sub('', titulo or '')


def _ja_incluido(resultados: list, chunk: dict, indice: int) -> bool:
    """Dedup por título+timestamp — mesma chave usada pelo bloco FTS5 e pelo
    bloco de busca vetorial em _recuperar_contexto(), extraída aqui pra não
    duplicar a comparação em cada um dos dois blocos de merge. `indice` é a
    posição do chunk em sua lista de origem (rowid no FTS5, índice no .npy
    vetorial) — usado só como fallback de identidade quando não há título."""
    chave_titulo = chunk.get('titulo') or f'chunk_{indice}'
    chave_ts = chunk.get('timestamp_inicio') if chunk.get('timestamp_inicio') is not None else ''
    return any(
        (r.get('titulo') or f'chunk_{i}') == chave_titulo and
        (r.get('timestamp_inicio') if r.get('timestamp_inicio') is not None else '') == chave_ts
        for i, r in enumerate(resultados)
    )


def _recuperar_contexto(pergunta: str, projeto_nome: str, n: int = 6, config: dict = None, projetos_extras: list = None, fontes_fixadas: list = None, busca_ampla: bool = False, perfil: str = '', trechos_fixados: list = None) -> list:
    # Trechos fixados via @@ já passaram pelo pipeline BM25+CrossEncoder no momento da busca.
    # Retorná-los diretamente evita dupla pesquisa e garante que o LLM vê exatamente o que o usuário selecionou.
    if trechos_fixados:
        return [
            {
                'texto_original': t.get('texto', ''),
                'texto':          t.get('texto', ''),
                'titulo':         t.get('titulo', t.get('arquivo', '')),
                'arquivo':        t.get('arquivo', t.get('titulo', '')),
                'canal':          projeto_nome,
                'score':          1.0,
                'aba':            'documento',
            }
            for t in trechos_fixados if t.get('texto')
        ]

    import numpy as np

    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')

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
        all_s = [bm25_obj.get_scores(_tokenizar_query(q)) for q in qs]
        return np.max(all_s, axis=0) if len(all_s) > 1 else all_s[0]

    # ── Modo unificado: corpus merged quando há múltiplos projetos ────────────
    # Constrói um único BM25 sobre todos os chunks de todos os projetos ativos.
    # Scores são comparáveis porque o IDF é calculado sobre o vocabulário completo.
    todos_projetos = [projeto_prefixo] + [
        re.sub(r'[<>:"/\\|?*\s]', '_', e).strip('_')
        for e in (projetos_extras or []) if e != projeto_nome
    ]

    if len(todos_projetos) > 1 and not arquivos_fixados:
        merged = _obter_corpus_merged(todos_projetos)
        if merged is None:
            raise ValueError(f"Índice não encontrado para '{projeto_nome}'. Clique em Indexar Agora.")

        scores = _scores_para_queries(merged['bm25'], queries)
        # Recupera top-2n para o CrossEncoder ter candidatos suficientes de todos os projetos
        top_n = n * 2
        top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_n]
        resultados = [
            {**merged['chunks'][i], 'score': round(float(scores[i]), 3),
             'canal': merged['chunks'][i].get('_prefixo', projeto_prefixo)}
            for i in top_idx if scores[i] > 0
        ]
        # Normaliza '_prefixo' → nome legível do projeto
        prefixo_para_nome = {projeto_prefixo: projeto_nome}
        for extra in (projetos_extras or []):
            p = re.sub(r'[<>:"/\\|?*\s]', '_', extra).strip('_')
            prefixo_para_nome[p] = extra
        for r in resultados:
            r['canal'] = prefixo_para_nome.get(r['canal'], r['canal'])
        resultados.sort(key=lambda x: x['score'], reverse=True)

    else:
        # ── Modo single: BM25 no projeto principal (comportamento original) ───
        cached = _carregar_projeto_cache(projeto_prefixo)
        if cached is None:
            raise ValueError(f"Índice não encontrado para '{projeto_nome}'. Clique em Indexar Agora.")

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
            {**cached['chunks'][i], 'score': round(float(scores_full[i]), 3), 'canal': projeto_nome}
            for i in top_idx if scores_full[i] > 0
        ]

        # FTS5 exact-match no projeto principal
        try:
            from tusab_engine.agent.fts import buscar_fts, fts_existe
            if fts_existe(projeto_prefixo):
                fts_rowids = buscar_fts(pergunta, projeto_prefixo, n=n)
                chunks_result = cached['chunks']
                for rid in fts_rowids:
                    if rid < len(chunks_result):
                        c = chunks_result[rid]
                        if not _ja_incluido(resultados, c, rid):
                            resultados.append({
                                **c,
                                'score': 0.1,
                                'canal': projeto_nome,
                                'fts_match': True,
                            })
        except Exception:
            pass

        # Busca vetorial (embeddings) — só em Busca Ampla, mesma razão pela
        # qual o CrossEncoder já é gateado assim: match semântico aproximado
        # precisa de um validador de relevância real (o CrossEncoder, chamado
        # depois em _rerankar), que não existe em Busca Restrita. Diferente
        # do FTS5 (exact-match, mesclado sempre), este bloco só entra quando
        # busca_ampla=True. Ver agents/_historia.md sobre a Fase 1 de
        # embeddings — complemento ao BM25, nunca substituição.
        if busca_ampla:
            try:
                from tusab_engine.agent.embeddings import buscar_vetorial
                chunks_result = cached['chunks']
                for idx, cos_sim in buscar_vetorial(pergunta, projeto_prefixo, len(chunks_result), top_k=n):
                    c = chunks_result[idx]
                    if not _ja_incluido(resultados, c, idx):
                        resultados.append({
                            **c,
                            'score': 0.15,
                            'canal': projeto_nome,
                            'vetorial_match': True,
                            '_cos_sim': cos_sim,
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

    resultados = _filtrar_por_identificador(pergunta, resultados)

    # Re-rankeamento semântico com CrossEncoder — ativado quando busca_ampla=True.
    # O toggle de Busca Ampla é a decisão consciente do usuário de querer mais profundidade:
    # BM25 recupera top-N candidatos, CrossEncoder reordena por relevância semântica real.
    # BM25 puro quando busca_ampla=False — mais rápido, suficiente para busca restrita.
    # N é calibrado por corpus_profile.json (P0-c) quando disponível — corpus maior
    # tem IDF menor por termo, mais candidatos dão ao CrossEncoder mais chance de
    # achar o chunk certo. Fallback para n*2 (comportamento original) sem perfil.
    if busca_ampla:
        from tusab_engine.agent.calibration import _carregar_profile
        n_candidatos = _carregar_profile(projeto_prefixo).get('n_candidatos_bm25', n * 2)
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
        top = [{**cached['chunks'][0], 'score': 0.0, 'canal': projeto_nome}]

    # Continuidade de capítulo dividido: quando um capítulo do YouTube passou de
    # 3000 chars, ele virou várias partes (index.py::_parsear_chunks). Se o BM25
    # selecionou só uma parte, o LLM pode perder o fio da meada de um capítulo
    # que continua fora do chunk recuperado. Best-effort: inclui a parte seguinte
    # quando existir, sem deslocar nenhum candidato já selecionado — só em modo
    # single (mesma restrição de escopo do FTS5/embeddings, ver acima), e com
    # teto pra não inflar o prompt em capítulos com muitas partes.
    if 'cached' in locals() and cached and cached.get('chunks'):
        _TETO_PARTES_IRMAS = 2
        corpus_completo = cached['chunks']
        extras = []
        for c in top:
            if len(extras) >= _TETO_PARTES_IRMAS:
                break
            if c.get('total_partes', 1) <= 1:
                continue
            titulo_base_c = _titulo_base(c.get('titulo', ''))
            irma = next((
                x for x in corpus_completo
                if x.get('video_id') == c.get('video_id')
                and _titulo_base(x.get('titulo', '')) == titulo_base_c
                and x.get('parte') == c.get('parte', 1) + 1
            ), None)
            if irma and not _ja_incluido(top + extras, irma, -1):
                extra = {**irma, 'score': c['score'], 'canal': c.get('canal', projeto_nome), 'parte_irma': True}
                # Herda _ce_score do irmão pra não quebrar o `all('_ce_score' in c
                # for c in top)` do filtro de lacuna logo abaixo — sem isso, o
                # filtro trocaria de critério (CE→BM25) pra lista inteira quando
                # busca_ampla=True, só por causa de 1 chunk sem rerank.
                if '_ce_score' in c:
                    extra['_ce_score'] = c['_ce_score']
                extras.append(extra)
        top = top + extras

    # Filtro de lacuna de relevância: BM25/CrossEncoder sempre completam até
    # `n` candidatos, mesmo quando só o 1º é de fato relevante e o resto é
    # "o menos ruim entre o que sobrou" (ex.: pergunta conceitual genérica
    # tipo "o que é RAG" puxando leis sem nenhuma relação, só porque nada
    # mais no corpus teve overlap melhor). Corta por LACUNA em relação ao
    # melhor candidato — nunca por valor absoluto, porque BM25 puro e
    # CrossEncoder estão em escalas diferentes — e nunca remove o 1º
    # colocado, então sempre sobra ao menos 1 fonte quando houve algum match.
    if len(top) > 1:
        if busca_ampla and all('_ce_score' in c for c in top):
            melhor_ce = top[0]['_ce_score']
            top = [top[0]] + [c for c in top[1:] if c['_ce_score'] >= melhor_ce - GAP_RELEVANCIA_CE]
        else:
            melhor_score = top[0]['score']
            if melhor_score > 0:
                top = [top[0]] + [c for c in top[1:] if c['score'] >= melhor_score * RATIO_RELEVANCIA_BM25]

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

    for projeto_nome in lista_projetos:
        try:
            chunks = _recuperar_contexto(
                pergunta=query,
                projeto_nome=projeto_nome,
                n=n,
                config=config,
                projetos_extras=[],
                busca_ampla=busca_ampla,
                perfil='',
            )
            for c in chunks:
                resultados.append({
                    'titulo':            c.get('titulo', ''),
                    'trecho':            c.get('texto_original') or c.get('texto', ''),
                    'score':             c.get('score', 0.0),
                    'canal':             projeto_nome,
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


def _carregar_resumos_relevantes(chunks: list, projeto_prefixo: str) -> list:
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
        youtube_base = os.path.join(NEURAL_DIR, projeto_prefixo, 'youtube')
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


# ── Fidelidade numérica ────────────────────────────────────────────────────────
#
# Modelos locais pequenos (ex: llama3.2:1b) podem preservar a estrutura de uma
# frase ao parafrasear um chunk denso em números mas apagar os números em si —
# "Decreto-Lei nº 1.001, de 21 de outubro de 1969" vira "Decreto-Lei nº., de
# de outubro de" na resposta (confirmado ao vivo, 29/jul/2026, ver
# agents/_historia.md). Não é alucinação (não inventa número errado) nem é
# pego por verificar_alucinacao/avaliar_confianca_por_sentenca (nenhum dos
# dois lê o texto pra achar lacuna estrutural, só cobertura de vocabulário).
# tem_lacuna_numerica() e as demais funções de crítica (verificação de
# alucinação, confiança por sentença) vivem em agent/critique.py desde a
# Fase 5 da formalização do roteamento — ver import no topo do arquivo.


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


def _montar_prompt_trecho(arquivo: str, trecho: str, meta_canal: dict = None, historico: list = None, persona: str = '', idioma: str = 'pt', persona_custom: str = '') -> str:
    """Prompt especializado para análise de trecho injetado sem pergunta explícita."""
    handle = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'
    lang_label = _IDIOMA_LABEL.get(idioma, 'português')
    lang_instr = f"IDIOMA: responda SEMPRE em {lang_label}.\n\n"

    instrucao_tom = _resolver_instrucao_tom(persona, persona_custom)

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
        + _FMT_INSTR
        + instrucao_tom
        + hist_str
        + f"<trecho arquivo=\"{arquivo}\">\n{trecho[:3000]}\n</trecho>\n\nRESPOSTA:"
    )


# ── Montagem do prompt ────────────────────────────────────────────────────────

_IDIOMA_LABEL = {"pt": "português", "en": "English", "es": "español"}

def _montar_prompt(pergunta: str, contexto: list, meta_canal: dict = None, historico: list = None, busca_ampla: bool = False, persona: str = '', idioma: str = 'pt', projeto_prefixo: str = '', persona_custom: str = '') -> str:
    pergunta = pergunta[:2000].strip()
    handle   = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'

    _max_chunk = 1500 if (carregar_config().get('provider') == 'ollama') else 3000

    # Tenta carregar resumos dos vídeos mais relevantes para dar visão macro ao LLM
    resumo_str = ''
    if projeto_prefixo:
        try:
            resumos = _carregar_resumos_relevantes(contexto, projeto_prefixo)
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

    instrucao_tom = _resolver_instrucao_tom(persona, persona_custom)

    lang_label = _IDIOMA_LABEL.get(idioma, "português")
    lang_instr = f"IDIOMA: responda SEMPRE em {lang_label}, independentemente do idioma das fontes.\n\n"

    fmt_instr = _FMT_INSTR

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


def _responder_sem_contexto(pergunta: str, config: dict, projeto_nome: str) -> str:
    """Gera resposta inteligente quando o BM25 não retorna contexto relevante."""
    pergunta_lower = _normalizar_saudacao(pergunta)
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
    if not provider or (not api_key and provider not in _PROVEDORES_SEM_CHAVE_OBRIGATORIA):
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
                json={'model': modelo, 'prompt': prompt, 'stream': False, 'think': False},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json().get('response', '').strip() or _fallback_sem_contexto(projeto_nome)

        elif provider == 'openai':
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=15,
            )
            return resp.choices[0].message.content.strip()

        elif provider == 'anthropic':
            client, modelo = _get_llm_client(provider, api_key, config)
            msg = client.messages.create(
                model=modelo,
                max_tokens=400,
                messages=[{'role': 'user', 'content': prompt}],
            )
            return msg.content[0].text.strip()

        elif provider in ('groq', 'custom'):
            client, modelo = _get_llm_client(provider, api_key, config)
            resp = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=15,
            )
            return resp.choices[0].message.content.strip()

        elif provider in ('gemini', 'google'):
            client, modelo = _get_llm_client(provider, api_key, config)
            if modelo:
                resp = client.GenerativeModel(modelo).generate_content(prompt)
                return resp.text.strip()

    except Exception:
        pass

    return _fallback_sem_contexto(projeto_nome)


def _fallback_sem_contexto(projeto_nome: str) -> str:
    handle = f'@{projeto_nome}' if projeto_nome else 'esta base'
    return (
        f"Não encontrei conteúdo relevante para essa pergunta em {handle}.\n\n"
        f"**Dica:** vá ao Repositório, busque pelo tema e clique em **\"Referenciar no chat\"** "
        f"para injetar o trecho ou vídeo diretamente aqui — assim consigo responder com precisão."
    )


def _gerar_resposta_llm(provider: str, api_key: str, prompt: str, config: dict) -> str:
    """Chama o provedor configurado e retorna o texto da resposta — sem
    formatação/verificação pós-geração (isso é responsabilidade do caller).
    Extraído de chat() pra poder ser chamado 2x (original + retry de
    fidelidade numérica) sem duplicar o dispatch de provider."""
    if provider == 'openai':
        client, modelo = _get_llm_client(provider, api_key, config, principal=True)
        resp = client.chat.completions.create(
            model=modelo,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        return resp.choices[0].message.content

    if provider == 'anthropic':
        client, modelo = _get_llm_client(provider, api_key, config, principal=True)
        msg = client.messages.create(
            model=modelo,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text

    if provider in ('gemini', 'google'):
        client, modelo = _get_llm_client(provider, api_key, config, principal=True)
        if not modelo:
            raise ValueError('Nenhum modelo Gemini disponível para esta chave.')
        resp = client.GenerativeModel(modelo).generate_content(prompt)
        return resp.text

    if provider in ('groq', 'custom'):
        client, modelo = _get_llm_client(provider, api_key, config, principal=True)
        resp = client.chat.completions.create(
            model=modelo,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        return resp.choices[0].message.content

    if provider == 'ollama':
        import requests as _req
        modelo = config.get('ollama_model', 'llama3.2:1b')
        resp = _req.post(
            'http://localhost:11434/api/generate',
            json={
                'model':   modelo,
                'prompt':  prompt,
                'stream':  False,
                'think':   False,
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
        return resp.json().get('response', '')

    raise ValueError(f"Provedor desconhecido: {provider}")


def _gerar_com_fidelidade_numerica(provider: str, api_key: str, prompt: str, config: dict, contexto: list) -> str:
    """Chama _gerar_resposta_llm() e, se a resposta tiver assinatura de número/
    data apagado (ver critique.tem_lacuna_numerica), tenta 1 vez mais com instrução
    reforçada de fidelidade — confirmado ao vivo que reduz (não elimina
    sozinha) a perda de dígitos em modelos locais pequenos ao parafrasear
    contexto denso em números (ver agents/_historia.md, 29/jul/2026).

    Não tenta de novo se não há contexto (nada pra ser fiel a) ou se a
    segunda tentativa falhar — evita loop e latência sem ganho; a resposta
    com lacuna ainda é melhor que travar o chat.
    """
    resposta = _gerar_resposta_llm(provider, api_key, prompt, config)

    if contexto and tem_lacuna_numerica(resposta):
        prompt_reforcado = (
            prompt + "\n\nATENÇÃO: a resposta anterior a essa pergunta omitiu números, "
            "datas ou valores do contexto. Responda novamente preservando TODOS os "
            "números, datas e valores EXATAMENTE como aparecem no contexto acima — "
            "nunca substitua um número por espaço em branco ou omita uma data."
        )
        try:
            resposta_retry = _gerar_resposta_llm(provider, api_key, prompt_reforcado, config)
            if not tem_lacuna_numerica(resposta_retry):
                resposta = resposta_retry
        except Exception:
            pass  # mantém a resposta original — retry é best-effort, nunca derruba o chat

    return resposta


# ── Compartilhado entre chat() e chat_stream() ────────────────────────────────
# Formato de "fontes" citadas — a decisão de roteamento em si (rotear(),
# Rota) vive em agent/router.py desde a Fase 0 da formalização
# ("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

def _montar_fontes_de_contexto(contexto: list) -> list:
    """Formato de 'fontes' citadas a partir dos chunks recuperados pelo BM25 —
    consumido pelo frontend (ChatDrawer, link ▶ MM:SS)."""
    return [{
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


# ── Chat (sync) ───────────────────────────────────────────────────────────────

def chat(pergunta: str, projeto_nome: str, historico: list = None, projetos_extras: list = None, busca_ampla: bool = False, fontes_fixadas: list = None, perfil: str = '', trechos_fixados: list = None) -> dict:
    projetos_extras = projetos_extras or []
    config   = carregar_config()
    provider = config.get('provider', '')
    if not provider or (not _api_key_valida(config) and provider not in _PROVEDORES_SEM_CHAVE_OBRIGATORIA):
        raise ValueError("Configure a chave de API antes de usar o chat.")

    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    meta_canal    = _carregar_meta_canal(projeto_prefixo)
    persona       = config.get('persona', '')
    persona_custom = config.get('persona_custom', '')
    idioma        = config.get('idioma', 'pt')

    # Detecta trecho injetado: usa prompt especializado sem precisar do BM25
    arq_injetado, trecho_injetado = extrair_trecho_injetado(pergunta)
    trecho_mode = bool(arq_injetado)

    if trecho_mode:
        contexto = []
        prompt   = _montar_prompt_trecho(arq_injetado, trecho_injetado, meta_canal, historico, persona, idioma, persona_custom)
    else:
        # Fase 3 — CALCULO: expressão aritmética pura, resolvida por AST
        # sandboxed (nunca eval/exec, ver agent/calculo.py) sobre números só
        # do texto da pergunta — nunca do contexto recuperado. None = não é
        # expressão aritmética (ou o avaliador rejeitou por segurança).
        resposta_calculo = responder_calculo(pergunta, idioma)
        if resposta_calculo is not None:
            return {'resposta': resposta_calculo, 'fontes': [], 'sem_contexto': False}

        # Fase 2 — METADADOS: pergunta sobre a própria base ("quantos vídeos",
        # "qual o mais recente", "quando indexei") resolvida por arquivo real,
        # nunca por LLM/BM25. None = não é pergunta de metadado (ou o executor
        # não tem certeza do valor) — segue o fluxo normal abaixo.
        resposta_metadados = responder_metadados(pergunta, projeto_nome, projeto_prefixo, idioma)
        if resposta_metadados is not None:
            return {'resposta': resposta_metadados, 'fontes': [], 'sem_contexto': False}

        from tusab_engine.state import state as _state
        ultima = _state.last_chat_response.get(projeto_prefixo, {})

        # Fase 1 — pré-roteamento determinístico: saudação conhecida resolve
        # sem chamar o classificador LLM nem o BM25 (custo ~0ms vs. ~800ms
        # percebidos no Ollama quando a rota final não é BUSCA).
        rota_pre = pre_rotear(pergunta, sinais={'trechos_fixados': trechos_fixados})
        if rota_pre is not None:
            rota, contexto_bm25 = rota_pre, []
        else:
            # Classifica intenção em paralelo com o BM25 — sem latência extra no caso BUSCA
            intencao_future = iniciar_classificacao_intencao(pergunta, historico, config)
            n_chunks = 4 if config.get('provider') == 'ollama' else 6
            try:
                contexto_bm25 = _recuperar_contexto(
                    pergunta, projeto_nome, n=n_chunks, config=config,
                    projetos_extras=projetos_extras, fontes_fixadas=fontes_fixadas,
                    busca_ampla=busca_ampla, perfil=perfil,
                    trechos_fixados=trechos_fixados or [],
                )
            except Exception:
                contexto_bm25 = []

            rota = rotear(pergunta, historico, config, sinais={
                'arq_injetado':     arq_injetado,
                'intencao_future':  intencao_future,
                'ultima_resposta':  ultima,
                'trechos_fixados':  trechos_fixados,
            })
        intencao = rota.nome

        if intencao == 'CONTEXTO':
            # Bypass total do BM25 — opera sobre a resposta anterior
            contexto = []
            prompt   = _montar_prompt_contexto(pergunta, historico or [], ultima, persona, idioma, persona_custom)
        elif intencao == 'CONVERSA':
            contexto = []
            resposta_vazia = _responder_sem_contexto(pergunta, config, projeto_nome)
            return {'resposta': resposta_vazia, 'fontes': [], 'sem_contexto': False}
        else:
            contexto = contexto_bm25
            critica = avaliar_relevancia_contexto(contexto, busca_ampla_ja_tentada=busca_ampla)
            if critica.acao == 'retry_busca_ampla':
                # Fase 5 — antes de devolver sem_contexto, tenta 1x com busca
                # ampla forçada (BM25 top-12 → CrossEncoder → top-6, +236ms
                # medido), mesmo que o usuário não tenha ativado. Só entra
                # aqui quando a Busca Restrita não achou NADA — o custo extra
                # só é pago no pior caso, nunca no caminho feliz.
                try:
                    contexto = _recuperar_contexto(
                        pergunta, projeto_nome, n=n_chunks, config=config,
                        projetos_extras=projetos_extras, fontes_fixadas=fontes_fixadas,
                        busca_ampla=True, perfil=perfil,
                        trechos_fixados=trechos_fixados or [],
                    )
                except Exception:
                    contexto = []
                critica = avaliar_relevancia_contexto(contexto, busca_ampla_ja_tentada=True)

            if critica.acao == 'sem_contexto':
                resposta_vazia = _responder_sem_contexto(pergunta, config, projeto_nome)
                return {'resposta': resposta_vazia, 'fontes': [], 'sem_contexto': True}
            prompt = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona, idioma, projeto_prefixo=projeto_prefixo, persona_custom=persona_custom)

    provider = config['provider']
    api_key  = config['api_key']

    resposta = _gerar_com_fidelidade_numerica(provider, api_key, prompt, config, contexto)

    resposta, _issup = verificar_alucinacao(resposta, contexto, projeto_nome, trecho_injetado=trecho_mode)
    resposta = _normalizar_markdown(resposta)

    # Confiança graduada por sentença (P1-e) — sinal visual opcional para o
    # frontend, não bloqueia nada. Mesma exceção do trecho injetado usada em
    # verificar_alucinacao(): vocabulário do usuário não bate com o corpus
    # por natureza, não é indício de alucinação.
    confianca_sentencas = [] if trecho_mode else avaliar_confianca_por_sentenca(resposta, contexto)

    if not trecho_mode and intencao == 'CONTEXTO' and ultima:
        fontes = ultima.get('fontes', [])
    else:
        fontes = _montar_fontes_de_contexto(contexto)

    if trecho_mode and not fontes:
        fontes = [{'titulo': arq_injetado, 'aba': 'documento', 'data': '', 'link': '', 'arquivo': arq_injetado, 'canal': projeto_nome, 'score': 1.0}]

    # Persiste resposta para uso pelo classificador de intenção na próxima mensagem
    try:
        from tusab_engine.state import state as _state
        _state.last_chat_response[projeto_prefixo] = {
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
    projetos_extras = projetos_extras or []
    config = carregar_config()
    if not config.get('provider') or (not _api_key_valida(config) and config.get('provider') not in _PROVEDORES_SEM_CHAVE_OBRIGATORIA):
        yield json.dumps({'error': 'Configure a chave de API antes de usar o chat.'})
        return

    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    meta_canal    = _carregar_meta_canal(projeto_prefixo)
    persona       = config.get('persona', '')
    persona_custom = config.get('persona_custom', '')
    idioma        = config.get('idioma', 'pt')

    # Detecta trecho injetado: bypass do BM25, prompt especializado de análise
    arq_injetado, trecho_injetado = extrair_trecho_injetado(pergunta)
    trecho_mode = bool(arq_injetado)

    if trecho_mode:
        contexto = []
        prompt   = _montar_prompt_trecho(arq_injetado, trecho_injetado, meta_canal, historico, persona, idioma, persona_custom)
        fontes   = [{'titulo': arq_injetado, 'aba': 'documento', 'data': '', 'link': '', 'arquivo': arq_injetado, 'canal': projeto_nome, 'score': 1.0}]
    else:
        # Fase 3 — CALCULO. Ver comentário equivalente em chat().
        resposta_calculo = responder_calculo(pergunta, idioma)
        if resposta_calculo is not None:
            yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': False})
            yield resposta_calculo
            yield json.dumps({'done': True})
            return

        # Fase 2 — METADADOS: pergunta sobre a própria base resolvida por
        # arquivo real, sem LLM/BM25. Ver comentário equivalente em chat().
        resposta_metadados = responder_metadados(pergunta, projeto_nome, projeto_prefixo, idioma)
        if resposta_metadados is not None:
            yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': False})
            yield resposta_metadados
            yield json.dumps({'done': True})
            return

        from tusab_engine.state import state as _state
        ultima = _state.last_chat_response.get(projeto_prefixo, {})

        # Fase 1 — pré-roteamento determinístico: saudação conhecida resolve
        # sem chamar o classificador LLM nem o BM25.
        rota_pre = pre_rotear(pergunta, sinais={'trechos_fixados': trechos_fixados})
        if rota_pre is not None:
            rota, contexto_bm25 = rota_pre, []
        else:
            # Classificação de intenção paralela ao BM25 — sem latência extra no caso BUSCA
            intencao_future = iniciar_classificacao_intencao(pergunta, historico, config)
            n_chunks = 4 if config.get('provider') == 'ollama' else 6
            try:
                contexto_bm25 = _recuperar_contexto(
                    pergunta, projeto_nome, n=n_chunks, config=config,
                    projetos_extras=projetos_extras, fontes_fixadas=fontes_fixadas,
                    busca_ampla=busca_ampla, perfil=perfil,
                    trechos_fixados=trechos_fixados or [],
                )
            except Exception as e:
                yield json.dumps({'error': str(e)})
                return

            rota = rotear(pergunta, historico, config, sinais={
                'arq_injetado':     arq_injetado,
                'intencao_future':  intencao_future,
                'ultima_resposta':  ultima,
                'trechos_fixados':  trechos_fixados,
            })
        intencao = rota.nome

        if intencao == 'CONTEXTO':
            contexto = []
            prompt   = _montar_prompt_contexto(pergunta, historico or [], ultima, persona, idioma, persona_custom)
            fontes   = ultima.get('fontes', [])  # reusar fontes da resposta anterior
        elif intencao == 'CONVERSA':
            config_s = carregar_config()
            resposta_vazia = _responder_sem_contexto(pergunta, config_s, projeto_nome)
            yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': False})
            yield resposta_vazia
            yield json.dumps({'done': True})
            return
        else:
            contexto = contexto_bm25
            critica = avaliar_relevancia_contexto(contexto, busca_ampla_ja_tentada=busca_ampla)
            if critica.acao == 'retry_busca_ampla':
                # Fase 5 — mesmo retry de chat(), ver comentário lá.
                try:
                    contexto = _recuperar_contexto(
                        pergunta, projeto_nome, n=n_chunks, config=config,
                        projetos_extras=projetos_extras, fontes_fixadas=fontes_fixadas,
                        busca_ampla=True, perfil=perfil,
                        trechos_fixados=trechos_fixados or [],
                    )
                except Exception:
                    contexto = []
                critica = avaliar_relevancia_contexto(contexto, busca_ampla_ja_tentada=True)

            if critica.acao == 'sem_contexto':
                config_s = carregar_config()
                resposta_vazia = _responder_sem_contexto(pergunta, config_s, projeto_nome)
                yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': True})
                yield resposta_vazia
                yield json.dumps({'done': True})
                return
            prompt = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona, idioma, projeto_prefixo=projeto_prefixo, persona_custom=persona_custom)
            fontes = _montar_fontes_de_contexto(contexto)

    provider = config['provider']
    api_key  = config.get('api_key', '')

    yield json.dumps({'fontes': fontes, 'done': False})

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            # Opt-in do usuário (Configurar Agente → "Mostrar raciocínio do
            # modelo") — só tem efeito real em modelos com thinking nativo
            # (qwen3, deepseek-r1); modelos sem essa arquitetura ignoram o
            # parâmetro silenciosamente. Default False preserva o comportamento
            # antigo (raciocínio sempre suprimido).
            mostrar_raciocinio = bool(config.get('mostrar_raciocinio', False))
            # num_predict é um orçamento ÚNICO pra thinking + resposta combinados
            # (o runtime só separa os dois depois, no parsing do stream) — com o
            # valor fixo de 512, um modelo que "pensa" muito podia consumir 100%
            # do orçamento só no raciocínio e nunca chegar a gerar a resposta em
            # si (usuário via o bloco de raciocínio truncado e nada depois).
            # num_ctx sobe também porque o prompt (RAG) + geração maior precisam
            # caber na mesma janela de contexto.
            num_predict = 2048 if mostrar_raciocinio else 512
            num_ctx     = 4096 if mostrar_raciocinio else 2048
            with _req.post('http://localhost:11434/api/generate',
                    json={
                        'model':   modelo,
                        'prompt':  prompt,
                        'stream':  True,
                        'think':   mostrar_raciocinio,
                        'options': {
                            'num_ctx':     num_ctx,
                            'num_predict': num_predict,
                            'num_thread':  8,
                            'temperature': 0.3,
                        },
                    },
                    stream=True, timeout=300) as r:
                import time as _time
                _ultimo_check_recursos = 0.0
                _alerta_recursos_emitido = False
                _teve_resposta = False
                for line in r.iter_lines():
                    if line:
                        data = json.loads(line)
                        # thinking chega separado de response — repassa como
                        # controle JSON (mesmo padrão de 'fontes'/'done') pra
                        # não confundir com texto puro da resposta final.
                        pensando = data.get('thinking', '')
                        if pensando:
                            yield json.dumps({'thinking': pensando})
                        chunk = data.get('response', '')
                        if chunk:
                            _teve_resposta = True
                            yield chunk
                        # Checagem throttled (a cada ~4s, não por linha) — no
                        # máximo 1 alerta por resposta, pra não spammar o chat
                        # numa geração longa que já está sob sobrecarga.
                        if not _alerta_recursos_emitido:
                            _agora = _time.time()
                            if _agora - _ultimo_check_recursos >= 4:
                                _ultimo_check_recursos = _agora
                                _alerta = _checar_sobrecarga_recursos()
                                if _alerta:
                                    _alerta_recursos_emitido = True
                                    yield json.dumps({'alerta_recursos': _alerta})
                        if data.get('done'):
                            break

            # Modelos pequenos com thinking (ex.: qwen3:4b) às vezes "pensam"
            # e terminam a geração sem nunca escrever a resposta em si — não é
            # só estouro de num_predict, o modelo pode parar naturalmente logo
            # depois do raciocínio. Repete a chamada sem think pra garantir uma
            # resposta de verdade em vez de deixar o usuário só com o raciocínio.
            if not _teve_resposta and mostrar_raciocinio:
                with _req.post('http://localhost:11434/api/generate',
                        json={
                            'model':   modelo,
                            'prompt':  prompt,
                            'stream':  True,
                            'think':   False,
                            'options': {
                                'num_ctx':     2048,
                                'num_predict': 512,
                                'num_thread':  8,
                                'temperature': 0.3,
                            },
                        },
                        stream=True, timeout=300) as r2:
                    for line in r2.iter_lines():
                        if line:
                            data2 = json.loads(line)
                            chunk2 = data2.get('response', '')
                            if chunk2:
                                yield chunk2
                            if data2.get('done'):
                                break

        elif provider in ('gemini', 'google'):
            client, modelo = _get_llm_client(provider, api_key, config, principal=True)
            if modelo:
                for chunk in client.GenerativeModel(modelo).generate_content(prompt, stream=True):
                    if chunk.text:
                        yield chunk.text

        elif provider in ('groq', 'custom'):
            client, modelo = _get_llm_client(provider, api_key, config, principal=True)
            stream = client.chat.completions.create(
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
            client, modelo = _get_llm_client(provider, api_key, config, principal=True)
            stream = client.chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=1500,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta

        elif provider == 'anthropic':
            client, modelo = _get_llm_client(provider, api_key, config, principal=True)
            with client.messages.stream(
                model=modelo,
                max_tokens=1500,
                messages=[{'role': 'user', 'content': prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield text

    except Exception as e:
        yield json.dumps({'error': str(e)})
        return

    yield json.dumps({'done': True})
