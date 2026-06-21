# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Recuperação de contexto (BM25), expansão de query e geração de resposta
via múltiplos provedores de LLM (OpenAI, Anthropic, Gemini, Groq, Ollama).
"""

import os
import re
import json

from tusab_engine.storage import INDEX_DIR
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

def _get_cross_encoder():
    """Retorna o CrossEncoder carregado (lazy, singleton). Retorna None se indisponível."""
    global _cross_encoder
    if _cross_encoder is not None:
        return _cross_encoder
    with _cross_encoder_lock:
        if _cross_encoder is not None:
            return _cross_encoder
        try:
            from sentence_transformers import CrossEncoder as _CE
            _cross_encoder = _CE('cross-encoder/ms-marco-MiniLM-L-6-v2')
        except Exception:
            _cross_encoder = False  # sentinel: tentativa feita, indisponível
    return _cross_encoder if _cross_encoder else None


def _rerankar(pergunta: str, chunks: list) -> list:
    """Re-ordena chunks por relevância semântica usando CrossEncoder.

    Se o modelo não estiver disponível, retorna os chunks na ordem original.
    """
    ce = _get_cross_encoder()
    if not ce or not chunks:
        return chunks
    try:
        pares = [(pergunta, c['texto'][:512]) for c in chunks]
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


# ── Recuperação BM25 ──────────────────────────────────────────────────────────

_PERFIS_RERANK = {'pesquisador', 'profissional'}  # slug 'profissional' = Especialista na UI

def _recuperar_contexto(pergunta: str, canal_nome: str, n: int = 6, config: dict = None, canais_extras: list = None, fontes_fixadas: list = None, busca_ampla: bool = False, perfil: str = '') -> list:
    from rank_bm25 import BM25Okapi

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    idx_path      = _index_path(canal_prefixo)

    if not os.path.exists(idx_path):
        raise ValueError(f"Índice não encontrado para '{canal_nome}'. Clique em Indexar Agora.")

    mtime = os.path.getmtime(idx_path)

    with _bm25_lock:
        cached = _bm25_cache.get(canal_prefixo)

        if cached is None or cached['mtime'] != mtime:
            try:
                with open(idx_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                chunks = data['chunks']
                if not isinstance(chunks, list) or not chunks:
                    raise ValueError("índice sem chunks")
            except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                raise ValueError(
                    f"O índice de '{canal_nome}' está corrompido ou vazio. "
                    f"Vá em Configurar Agente e clique em 'Indexar Agora' para recriá-lo."
                )
            corpus = [_enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', '')) for c in chunks]
            _bm25_cache[canal_prefixo] = {
                'chunks': chunks,
                'bm25':   BM25Okapi(corpus),
                'mtime':  mtime,
            }

        cached = _bm25_cache[canal_prefixo]

    usar_expansion = config.get('query_expansion', False) if config else False
    queries = _expandir_query(pergunta, config) if (config and usar_expansion) else [pergunta]

    import numpy as np

    # Separa fontes_fixadas em bases (@canal) e arquivos individuais
    bases_fixadas   = [f[1:] for f in (fontes_fixadas or []) if f.startswith('@')]
    arquivos_fixados = [f for f in (fontes_fixadas or []) if not f.startswith('@')]

    # Filtra chunks pelos arquivos fixados (se houver)
    chunks_ativos = cached['chunks']
    if arquivos_fixados:
        chunks_ativos = [c for c in chunks_ativos if c.get('arquivo', '') in arquivos_fixados]

    def _scores_para_queries(bm25_obj, qs, indices_ativos):
        """Roda BM25 para os índices ativos e retorna scores mapeados."""
        all_s = [bm25_obj.get_scores(q.lower().split()) for q in qs]
        scores_full = np.mean(all_s, axis=0) if len(all_s) > 1 else all_s[0]
        return scores_full

    scores_full = _scores_para_queries(cached['bm25'], queries, [])

    # Aplica filtragem: usa só os índices dos chunks ativos
    if arquivos_fixados and chunks_ativos:
        chunk_indices = [i for i, c in enumerate(cached['chunks']) if c.get('arquivo', '') in arquivos_fixados]
        top_idx = sorted(chunk_indices, key=lambda i: scores_full[i], reverse=True)[:n]
    else:
        top_idx = sorted(range(len(scores_full)), key=lambda i: scores_full[i], reverse=True)[:n]

    resultados = [
        {**cached['chunks'][i], 'score': round(float(scores_full[i]), 3), 'canal': canal_nome}
        for i in top_idx if scores_full[i] > 0
    ]

    if canais_extras:
        for canal_extra in canais_extras:
            if canal_extra == canal_nome:
                continue
            try:
                prefixo_extra = re.sub(r'[<>:"/\\|?*\s]', '_', canal_extra).strip('_')
                idx_extra = _index_path(prefixo_extra)
                if not os.path.exists(idx_extra):
                    continue
                mtime_e = os.path.getmtime(idx_extra)
                with _bm25_lock:
                    cached_e = _bm25_cache.get(prefixo_extra)
                    if cached_e is None or cached_e['mtime'] != mtime_e:
                        with open(idx_extra, 'r', encoding='utf-8') as f:
                            data_e = json.load(f)
                        chunks_e = data_e['chunks']
                        corpus_e = [_enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', '')) for c in chunks_e]
                        _bm25_cache[prefixo_extra] = {'chunks': chunks_e, 'bm25': BM25Okapi(corpus_e), 'mtime': mtime_e}
                    cached_e = _bm25_cache[prefixo_extra]
                scores_e = _scores_para_queries(cached_e['bm25'], queries, [])
                top_e = sorted(range(len(scores_e)), key=lambda i: scores_e[i], reverse=True)[:3]
                for i in top_e:
                    if scores_e[i] > 0:
                        resultados.append({**cached_e['chunks'][i], 'score': round(float(scores_e[i]), 3), 'canal': canal_extra})
            except Exception:
                pass

    resultados.sort(key=lambda x: x['score'], reverse=True)

    SCORE_MINIMO = 0.5
    resultados = [r for r in resultados if r['score'] >= SCORE_MINIMO]

    # Re-rankeamento semântico com CrossEncoder — ativado quando busca_ampla=True.
    # O toggle de Busca Ampla é a decisão consciente do usuário de querer mais profundidade:
    # BM25 recupera top-2n candidatos, CrossEncoder reordena por relevância semântica real.
    # BM25 puro quando busca_ampla=False — mais rápido, suficiente para busca restrita.
    top = _rerankar(pergunta, resultados[:n * 2])[:n] if busca_ampla else resultados[:n]

    return top


# ── Verificação de alucinação ─────────────────────────────────────────────────

def _verificar_alucinacao(resposta: str, contexto: list, canal_nome: str) -> str:
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

    if cobertura < 0.20:
        handle = f'@{canal_nome}' if canal_nome else 'este canal'
        return (
            f'Não encontrei informações suficientes sobre esse tema no conteúdo de {handle}. '
            f'Tente reformular a pergunta ou verifique se o canal aborda esse assunto.'
        )

    return resposta


# ── Montagem do prompt ────────────────────────────────────────────────────────

def _montar_prompt(pergunta: str, contexto: list, meta_canal: dict = None, historico: list = None, busca_ampla: bool = False, persona: str = '') -> str:
    pergunta = pergunta[:2000].strip()
    handle   = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'

    blocos = []
    for i, c in enumerate(contexto, 1):
        blocos.append(
            f"<source id=\"{i}\">\n"
            f"<title>{c['titulo']}</title>\n"
            f"<date>{c['data']}</date>\n"
            f"<link>{c['link']}</link>\n"
            f"<content>{c['texto'][:3000]}</content>\n"
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

    if busca_ampla:
        instrucoes = (
            f"Você é o Tusab em modo de Busca Ampla.\n\n"
            f"TAREFA: responda à pergunta usando as fontes abaixo como referência principal.\n"
            f"Quando as fontes contiverem a informação, cite-as. "
            f"Quando forem insuficientes, você pode complementar com conhecimento geral "
            f"— mas deixe claro: use 'além do que está na base...' ou 'de forma geral...'.\n"
            f"Seja sempre honesto sobre a origem de cada informação.\n\n"
            + instrucao_tom
        )
    else:
        instrucoes = (
            f"Você é o Tusab, um assistente que responde EXCLUSIVAMENTE com base nas fontes abaixo.\n\n"
            f"TAREFA: leia as fontes e extraia as informações que respondam à pergunta.\n"
            f"NÃO use nenhum conhecimento próprio, externo ou de treinamento.\n"
            f"CADA afirmação deve poder ser rastreada a uma das fontes.\n"
            f"Se as fontes não contiverem a informação, responda APENAS:\n"
            f"'Não encontrei esse tema no conteúdo do {handle}.'\n\n"
            + instrucao_tom
        )

    return (
        instrucoes
        + hist_str
        + f"<sources canal=\"{handle}\">\n{contexto_str}\n</sources>\n\n"
        + f"<question>{pergunta}</question>\n\nRESPOSTA:"
    )


# ── Resposta sem contexto ────────────────────────────────────────────────────

_SAUDACOES = {
    'oi', 'olá', 'ola', 'opa', 'eai', 'e ai', 'e aí',
    'boa tarde', 'bom dia', 'boa noite', 'boa',
    'tudo bem', 'tudo bom', 'como vai', 'como você vai',
    'hello', 'hi', 'hey', 'good morning', 'good afternoon',
    'teste', 'test', 'ping', 'ok', 'okay',
}

_PROMPT_SEM_CONTEXTO = (
    "Você é o Tusab, um assistente de gestão de conhecimento.\n\n"
    "A busca na base de conhecimento não retornou trechos relevantes para a mensagem do usuário.\n\n"
    "Regras:\n"
    "1. Se for uma saudação, cumprimento ou teste (ex: 'oi', 'olá', 'teste'), responda de forma breve "
    "e simpática, apresentando-se como Tusab e explicando como pode ajudar com a base de conhecimento.\n"
    "2. Se for uma pergunta temática real, explique educadamente que não encontrou informações "
    "relevantes no índice atual. Mencione que a base pode conter:\n"
    "   - Transcrições de vídeos do YouTube\n"
    "   - Documentos enviados (PDF, DOCX, planilhas, imagens, áudios)\n"
    "   - Textos colados pelo usuário\n"
    "   E que todos precisam estar indexados para aparecer na busca.\n"
    "3. Convide o usuário a reformular a pergunta, verificar se o conteúdo foi indexado "
    "ou adicionar mais arquivos à base.\n"
    "4. Seja conciso (máximo 3 parágrafos), em português, sem mencionar BM25 ou termos técnicos.\n\n"
    f"Mensagem do usuário: {{mensagem}}\n\nRESPOSTA:"
)


def _responder_sem_contexto(pergunta: str, config: dict, canal_nome: str) -> str:
    """Gera resposta inteligente quando o BM25 não retorna contexto relevante."""
    pergunta_lower = pergunta.strip().lower().rstrip('!?.')

    # Saudação simples: responde sem chamar LLM
    if pergunta_lower in _SAUDACOES:
        return (
            "Olá! Sou o Tusab, seu assistente de base de conhecimento. "
            "Posso responder perguntas sobre os vídeos, documentos e textos que você adicionou ao repositório. "
            "Para começar, certifique-se de que o conteúdo está indexado e faça uma pergunta específica."
        )

    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    # Sem LLM configurado: mensagem estática melhorada
    if not provider or (not api_key and provider != 'ollama'):
        return (
            f"Não encontrei conteúdo relevante para essa pergunta na base de conhecimento.\n\n"
            f"Isso pode acontecer porque:\n"
            f"• O conteúdo ainda não foi indexado — use o botão **Indexar Agora** nas configurações do agente\n"
            f"• A pergunta usa termos diferentes dos que aparecem nos seus arquivos — tente reformular\n"
            f"• O tema não está coberto pelos vídeos, documentos ou textos da sua base\n\n"
            f"Lembre-se: a base pode incluir transcrições do YouTube, PDFs, planilhas, imagens e textos colados."
        )

    prompt = _PROMPT_SEM_CONTEXTO.format(mensagem=pergunta[:1000])

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
        f"Verifique se o conteúdo foi indexado ou tente reformular a pergunta usando "
        f"termos que aparecem nos seus vídeos, documentos ou textos."
    )


# ── Chat (sync) ───────────────────────────────────────────────────────────────

def chat(pergunta: str, canal_nome: str, historico: list = None, canais_extras: list = None, busca_ampla: bool = False, fontes_fixadas: list = None, perfil: str = '') -> dict:
    config   = carregar_config()
    provider = config.get('provider', '')
    if not provider or (not _api_key_valida(config) and provider != 'ollama'):
        raise ValueError("Configure a chave de API antes de usar o chat.")

    n_chunks = 4 if config.get('provider') == 'ollama' else 6
    contexto = _recuperar_contexto(pergunta, canal_nome, n=n_chunks, config=config, canais_extras=canais_extras, fontes_fixadas=fontes_fixadas, busca_ampla=busca_ampla, perfil=perfil)
    if not contexto:
        resposta_vazia = _responder_sem_contexto(pergunta, config, canal_nome)
        return {'resposta': resposta_vazia, 'fontes': [], 'sem_contexto': True}

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    persona       = config.get('persona', '')
    prompt        = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona)
    provider      = config['provider']
    api_key       = config['api_key']

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
            json={'model': modelo, 'prompt': prompt, 'stream': False},
            timeout=120,
        )
        resp.raise_for_status()
        resposta = resp.json().get('response', '')

    else:
        raise ValueError(f"Provedor desconhecido: {provider}")

    resposta = _verificar_alucinacao(resposta, contexto, canal_nome)

    return {
        'resposta': resposta,
        'meta_canal': meta_canal,
        'fontes': [{
            'titulo':  c['titulo'],
            'aba':     c.get('aba', 'youtube'),
            'data':    c['data'],
            'link':    c['link'],
            'arquivo': c.get('arquivo', ''),
            'canal':   c.get('canal', ''),
            'score':   c['score'],
        } for c in contexto],
    }


# ── Chat (streaming) ──────────────────────────────────────────────────────────

def chat_stream(pergunta: str, canal_nome: str, historico: list = None, canais_extras: list = None, busca_ampla: bool = False, fontes_fixadas: list = None, perfil: str = ''):
    """Yields chunks de texto. Primeiro yield: JSON com fontes; demais: texto puro."""
    config = carregar_config()
    if not config.get('provider') or (not _api_key_valida(config) and config.get('provider') != 'ollama'):
        yield json.dumps({'error': 'Configure a chave de API antes de usar o chat.'})
        return

    try:
        n_chunks = 4 if config.get('provider') == 'ollama' else 6
        contexto = _recuperar_contexto(pergunta, canal_nome, n=n_chunks, config=config, canais_extras=canais_extras, fontes_fixadas=fontes_fixadas, busca_ampla=busca_ampla, perfil=perfil)
    except Exception as e:
        yield json.dumps({'error': str(e)})
        return

    if not contexto:
        config_s = carregar_config()
        resposta_vazia = _responder_sem_contexto(pergunta, config_s, canal_nome)
        yield json.dumps({'fontes': [], 'done': False, 'sem_contexto': True})
        yield resposta_vazia
        yield json.dumps({'done': True})
        return

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    persona       = config.get('persona', '')
    prompt        = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla, persona)
    provider      = config['provider']
    api_key       = config.get('api_key', '')

    fontes = [{
        'titulo':  c['titulo'],
        'aba':     c.get('aba', 'youtube'),
        'data':    c['data'],
        'link':    c['link'],
        'arquivo': c.get('arquivo', ''),
        'canal':   c.get('canal', ''),
        'score':   c['score'],
    } for c in contexto]
    yield json.dumps({'fontes': fontes, 'done': False})

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            with _req.post('http://localhost:11434/api/generate',
                    json={'model': modelo, 'prompt': prompt, 'stream': True},
                    stream=True, timeout=120) as r:
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
