# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Todos os direitos reservados. Proibida a reprodução sem autorização expressa.
# Protegido pela Lei nº 9.609/1998 (Lei do Software) e Lei nº 9.610/1998.

import os
import sys
import re
import json
import time

# ==========================================
# --- CAMINHOS ---
# ==========================================

def obter_caminho_dados():
    if os.environ.get('BRAINIAC_DATA_DIR'):
        return os.environ['BRAINIAC_DATA_DIR']
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

DADOS_DIR   = obter_caminho_dados()
DATA_DIR    = os.path.join(DADOS_DIR, 'data')
CONFIG_PATH = os.path.join(DATA_DIR, 'config', 'agent_config.json')
INDEX_DIR   = os.path.join(DATA_DIR, 'agent_index')
CEREBRO_DIR  = os.path.join(DATA_DIR, 'cerebro')
TXT_DIR      = os.path.join(CEREBRO_DIR, 'youtube')      # legado
DOC_DIR      = os.path.join(CEREBRO_DIR, 'documentos')   # legado
TEXT_DIR     = os.path.join(CEREBRO_DIR, 'textos')       # legado


def _get_canal_youtube_dir(prefixo: str) -> str:
    return os.path.join(CEREBRO_DIR, prefixo, 'youtube')

def _get_canal_doc_dirs(prefixo: str) -> list:
    """Retorna dirs de documentos/textos do canal + _avulso + legado."""
    dirs = []
    for canal in [prefixo, '_avulso']:
        for sub in ['documentos', 'textos']:
            dirs.append(os.path.join(CEREBRO_DIR, canal, sub))
    dirs += [DOC_DIR, TEXT_DIR]   # legado
    return dirs


# ==========================================
# --- CONFIG ---
# ==========================================

def carregar_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def salvar_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def _index_path(canal_prefixo: str) -> str:
    return os.path.join(INDEX_DIR, f"{canal_prefixo}_index.json")


# Cache em memória: {canal_prefixo: {'chunks': [...], 'bm25': BM25Okapi, 'mtime': float}}
_bm25_cache: dict = {}

def _invalidar_cache(canal_prefixo: str):
    _bm25_cache.pop(canal_prefixo, None)


def _carregar_meta_canal(canal_prefixo: str) -> dict:
    """Carrega metadados do canal se disponível."""
    for base in [_get_canal_youtube_dir(canal_prefixo), TXT_DIR]:
        meta_path = os.path.join(base, f'{canal_prefixo}_meta.json')
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
    return {}


def get_agent_status() -> dict:
    config      = carregar_config()
    provider    = config.get('provider', '')
    canal_nome  = config.get('canal_indexado', '')
    index_count = 0
    canais_indexados = []

    # Scans all index files in INDEX_DIR
    if os.path.exists(INDEX_DIR):
        for fname in os.listdir(INDEX_DIR):
            if fname.endswith('_index.json'):
                fpath = os.path.join(INDEX_DIR, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    nome = data.get('canal_nome', fname.replace('_index.json', ''))
                    count = len(data.get('chunks', []))
                    canais_indexados.append({'nome': nome, 'chunks': count, 'arquivo': fname})
                    if nome == canal_nome:
                        index_count = count
                except Exception:
                    pass

    # If canal_indexado not found specifically, use total
    if not index_count and canais_indexados:
        index_count = sum(c['chunks'] for c in canais_indexados)

    # Sem config salvo, Ollama é o padrão — sempre configurado
    if not provider:
        provider = 'ollama'

    # Detecta se a base está desatualizada:
    # compara mtime do índice com a data de extração mais recente no CSV
    base_desatualizada = False
    novos_desde_indexacao = 0
    if canal_nome and os.path.exists(INDEX_DIR):
        try:
            canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
            idx_path = _index_path(canal_prefixo)
            if os.path.exists(idx_path):
                idx_mtime = os.path.getmtime(idx_path)
                # Verifica arquivos .txt do canal mais novos que o índice (novo dir e legado)
                for youtube_dir in [_get_canal_youtube_dir(canal_prefixo),
                                    os.path.join(CEREBRO_DIR, 'youtube')]:
                    if not os.path.exists(youtube_dir):
                        continue
                    for fname in os.listdir(youtube_dir):
                        if fname.startswith(canal_prefixo) and fname.endswith('.txt'):
                            fmtime = os.path.getmtime(os.path.join(youtube_dir, fname))
                            if fmtime > idx_mtime:
                                novos_desde_indexacao += 1
                base_desatualizada = novos_desde_indexacao > 0
        except Exception:
            pass

    return {
        'configured':             bool(provider and (config.get('api_key') or provider == 'ollama')),
        'provider':               provider,
        'canal_indexado':         canal_nome,
        'index_count':            index_count,
        'indexed':                len(canais_indexados) > 0,
        'canais_indexados':       canais_indexados,
        'base_desatualizada':     base_desatualizada,
        'novos_desde_indexacao':  novos_desde_indexacao,
    }


# ==========================================
# --- STOPWORDS (PT + EN) ---
# ==========================================

_STOPWORDS = {
    'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
    'se','na','por','mais','as','dos','como','mas','ao','ele','das','seu',
    'sua','ou','ser','quando','muito','nos','já','também','só','pelo','pela',
    'até','isso','ela','entre','era','depois','sem','mesmo','aos','ter','seus',
    'quem','nas','me','esse','eles','estão','você','tinha','foram','essa','num',
    'nem','suas','meu','às','minha','têm','numa','pelos','elas','havia','seja',
    'qual','será','nós','tenho','lhe','deles','essas','esses','pelas','este',
    'fosse','dele','tu','te','vocês','vos','lhes','meus','minhas','teu','tua',
    'teus','tuas','nosso','nossa','nossos','nossas','dela','delas','esta',
    'estes','estas','aquele','aquela','aqueles','aquelas','isto','aquilo',
    'estou','está','estamos','estavam','esteve','sou','somos','são','fui',
    'foi','fomos','temos','tem','têm','não','sim','né','pra','pro','uns',
    'umas','porque','então','então','bem','aqui','ali','lá','vai','vou',
    'fazer','feito','pode','podem','quero','gente','coisa','coisas','agora',
    # EN
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','up','about','into','is','are','was','were','be','been',
    'have','has','had','do','does','did','will','would','could','should',
    'may','might','this','that','these','those','i','you','he','she','it',
    'we','they','what','which','who','when','where','why','how','all','each',
    'every','both','few','more','most','other','some','no','not','only',
    'same','so','than','too','very','just','also','as','if','then',
}


# ==========================================
# --- PARSER DE CHUNKS ---
# ==========================================

def _parsear_chunks(txt_dir: str, canal_prefixo: str) -> list[dict]:
    chunks   = []
    arquivos = sorted([
        f for f in os.listdir(txt_dir)
        if f.startswith(canal_prefixo) and f.endswith('.txt')
    ])

    for arquivo in arquivos:
        caminho = os.path.join(txt_dir, arquivo)
        with open(caminho, 'r', encoding='utf-8-sig', errors='ignore') as f:
            conteudo = f.read()

        blocos = re.split(r'={50,}', conteudo)
        for bloco in blocos:
            bloco = bloco.strip()
            if not bloco or len(bloco) < 100:
                continue

            titulo = re.search(r'TITULO:\s*(.+)', bloco)
            aba    = re.search(r'ABA:\s*(.+)',    bloco)
            data   = re.search(r'DATA:\s*(.+)',   bloco)
            link   = re.search(r'LINK:\s*(.+)',   bloco)
            tags_m = re.search(r'TAGS:\s*(.+)',   bloco)
            desc_m = re.search(r'DESCRICAO:\s*(.+)', bloco)

            partes = re.split(r'-{50,}', bloco)
            texto  = partes[-1].strip() if len(partes) > 1 else bloco

            if len(texto) < 80:
                continue

            tags = []
            if tags_m:
                tags = [t.strip() for t in tags_m.group(1).split(',') if t.strip()]

            chunks.append({
                'texto':    texto[:8000],
                'titulo':   titulo.group(1).strip() if titulo else '',
                'aba':      aba.group(1).strip()    if aba    else '',
                'data':     data.group(1).strip()   if data   else '',
                'link':     link.group(1).strip()   if link   else '',
                'tags':     tags,
                'descricao': desc_m.group(1).strip() if desc_m else '',
                'arquivo':  arquivo,
            })

    return chunks


def _parsear_todos_chunks(canal_prefixo: str) -> list[dict]:
    """Lê chunks de todas as fontes: YouTube do canal + arquivos do canal + avulso + legado."""
    # YouTube: dir novo por canal (prioritário) + legado flat
    chunks = []
    for yt_dir in [_get_canal_youtube_dir(canal_prefixo), TXT_DIR]:
        if os.path.exists(yt_dir):
            chunks += _parsear_chunks(yt_dir, canal_prefixo)

    # Docs/textos: canal próprio + avulso + legado (deduplicados por caminho real)
    seen_files = set()
    for source_dir in _get_canal_doc_dirs(canal_prefixo):
        if not os.path.exists(source_dir):
            continue
        aba_label = 'texto' if os.path.basename(source_dir) == 'textos' else 'documento'
        for fname in sorted(os.listdir(source_dir)):
            if not fname.endswith('.txt') or fname.startswith('_'):
                continue
            caminho = os.path.realpath(os.path.join(source_dir, fname))
            if caminho in seen_files:
                continue
            seen_files.add(caminho)
            try:
                with open(caminho, 'r', encoding='utf-8-sig', errors='ignore') as f:
                    conteudo = f.read().strip()
                if len(conteudo) < 80:
                    continue
                partes = [conteudo[i:i+2000] for i in range(0, len(conteudo), 2000)]
                for parte in partes:
                    if len(parte) < 80:
                        continue
                    chunks.append({
                        'texto':     parte,
                        'titulo':    fname.replace('.txt', ''),
                        'aba':       aba_label,
                        'data':      '',
                        'link':      '',
                        'tags':      [],
                        'arquivo':   fname,
                        'descricao': '',
                    })
            except Exception:
                pass
    return chunks


# ==========================================
# --- ENRIQUECIMENTO BM25 ---
# ==========================================

def _enriquecer_documento(texto: str, tags: list, descricao: str = '', n_keywords: int = 15) -> list[str]:
    """Retorna tokens enriquecidos: tags + top keywords do texto + texto completo.
    Tags e keywords são repetidos para dar peso extra no BM25 sem quebrar a saturação."""
    # Extrai palavras relevantes do texto (4+ chars, sem stopwords)
    palavras = re.findall(r'\b[a-záéíóúàâêôãõçñüäöï]{4,}\b', texto.lower())
    freq: dict = {}
    for p in palavras:
        if p not in _STOPWORDS:
            freq[p] = freq.get(p, 0) + 1
    top_keywords = sorted(freq, key=lambda k: freq[k], reverse=True)[:n_keywords]

    # Normaliza tags: remove #, substitui espaços por _
    tags_norm = [re.sub(r'[^a-záéíóúàâêôãõç\w]', '_', t.lower()).strip('_')
                 for t in tags if t]

    # Prefixo com peso dobrado: tags têm sinal mais forte que keywords
    prefixo = tags_norm * 3 + top_keywords * 2

    desc_tokens = descricao.lower().split() if descricao else []
    return prefixo + desc_tokens + texto.lower().split()


# ==========================================
# --- INDEXAÇÃO (local, sem API) ---
# ==========================================

def indexar(canal_nome: str, canal_prefixo: str, callback=None, stop_event=None) -> int:
    # Indexação BM25 é 100% local — não requer chave de API.
    config = carregar_config()

    if callback: callback("🔍 Lendo arquivos do corpus...")

    chunks = _parsear_todos_chunks(canal_prefixo)
    if not chunks:
        raise ValueError(f"Nenhum conteúdo encontrado para '{canal_prefixo}'. Faça a extração ou adicione documentos.")

    if stop_event and stop_event.is_set():
        if callback: callback("🛑 Indexação cancelada.")
        return 0

    if callback: callback(f"📦 {len(chunks)} chunks encontrados. Salvando índice local...")

    os.makedirs(INDEX_DIR, exist_ok=True)
    with open(_index_path(canal_prefixo), 'w', encoding='utf-8') as f:
        json.dump({'canal_nome': canal_nome, 'chunks': chunks}, f, ensure_ascii=False)

    config['canal_indexado'] = canal_nome
    salvar_config(config)

    if callback: callback(f"✅ Indexação concluída! {len(chunks)} chunks prontos para consulta.")
    _invalidar_cache(canal_prefixo)
    return len(chunks)


# ==========================================
# --- QUERY EXPANSION ---
# ==========================================

def _expandir_query(pergunta: str, config: dict) -> list[str]:
    """Gera variações da pergunta para aumentar o recall do BM25.
    Retorna lista com a pergunta original + até 2 variações."""
    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    prompt_expansion = (
        f"Gere 2 reformulações curtas e diferentes desta pergunta para busca em transcrições de vídeos do YouTube. "
        f"Responda APENAS com as 2 reformulações, uma por linha, sem numeração nem explicação.\n"
        f"Pergunta original: {pergunta}"
    )

    variacoes = []
    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            r = _req.post('http://localhost:11434/api/generate',
                json={'model': modelo, 'prompt': prompt_expansion, 'stream': False},
                timeout=15)
            r.raise_for_status()
            linhas = r.json().get('response', '').strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = ['gemini-1.5-flash','gemini-1.5-flash-latest','gemini-1.5-flash-002','gemini-1.5-pro','gemini-pro','gemini-2.0-flash-lite']
            modelos_ok = [m.name.replace('models/','') for m in _genai.list_models() if 'generateContent' in m.supported_generation_methods]
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
                max_tokens=100,
            )
            linhas = resp.choices[0].message.content.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key).messages.create(
                model='claude-haiku-4-5-20251001', max_tokens=100,
                messages=[{'role': 'user', 'content': prompt_expansion}],
            )
            linhas = msg.content[0].text.strip().splitlines()
            variacoes = [l.strip() for l in linhas if l.strip()][:2]

    except Exception:
        pass  # se falhar, retorna só a pergunta original

    return [pergunta] + variacoes


# ==========================================
# --- RETRIEVAL (BM25) ---
# ==========================================

def _recuperar_contexto(pergunta: str, canal_nome: str, n: int = 6, config: dict = None, canais_extras: list = None) -> list[dict]:
    from rank_bm25 import BM25Okapi

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    idx_path      = _index_path(canal_prefixo)

    if not os.path.exists(idx_path):
        raise ValueError(f"Índice não encontrado para '{canal_nome}'. Clique em Indexar Agora.")

    mtime = os.path.getmtime(idx_path)
    cached = _bm25_cache.get(canal_prefixo)

    if cached is None or cached['mtime'] != mtime:
        with open(idx_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        chunks = data['chunks']
        corpus = [_enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', '')) for c in chunks]
        _bm25_cache[canal_prefixo] = {
            'chunks': chunks,
            'bm25':   BM25Okapi(corpus),
            'mtime':  mtime,
        }

    cached  = _bm25_cache[canal_prefixo]

    # Query expansion: só ativa em provedores rápidos (Groq, OpenAI, Anthropic)
    # Para Ollama local o custo de latência supera o ganho de qualidade
    PROVEDORES_RAPIDOS = {'groq', 'openai', 'anthropic'}
    queries = [pergunta]
    if config and config.get('provider') in PROVEDORES_RAPIDOS:
        queries = _expandir_query(pergunta, config)

    # Combina scores de todas as queries (média)
    import numpy as np
    all_scores = []
    for q in queries:
        all_scores.append(cached['bm25'].get_scores(q.lower().split()))
    scores = np.mean(all_scores, axis=0) if len(all_scores) > 1 else all_scores[0]

    top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:n]

    resultados = [
        {**cached['chunks'][i], 'score': round(float(scores[i]), 3), 'canal': canal_nome}
        for i in top_idx if scores[i] > 0
    ]

    # Busca em canais extras se solicitado
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
                cached_e = _bm25_cache.get(prefixo_extra)
                if cached_e is None or cached_e['mtime'] != mtime_e:
                    with open(idx_extra, 'r', encoding='utf-8') as f:
                        data_e = json.load(f)
                    chunks_e = data_e['chunks']
                    corpus_e = [_enriquecer_documento(c['texto'], c.get('tags', []), c.get('descricao', '')) for c in chunks_e]
                    _bm25_cache[prefixo_extra] = {'chunks': chunks_e, 'bm25': BM25Okapi(corpus_e), 'mtime': mtime_e}
                cached_e = _bm25_cache[prefixo_extra]
                scores_e = cached_e['bm25'].get_scores(pergunta.lower().split())
                top_e = sorted(range(len(scores_e)), key=lambda i: scores_e[i], reverse=True)[:3]
                for i in top_e:
                    if scores_e[i] > 0:
                        resultados.append({**cached_e['chunks'][i], 'score': round(float(scores_e[i]), 3), 'canal': canal_extra})
            except Exception:
                pass

    # Re-ordena todos por score e retorna top-n
    resultados.sort(key=lambda x: x['score'], reverse=True)
    top = resultados[:n]

    # Threshold mínimo: se o melhor score for muito baixo, não há conteúdo relevante
    # Evita que o LLM receba contexto irrelevante e invente respostas externas
    SCORE_MINIMO = 0.5
    top = [r for r in top if r['score'] >= SCORE_MINIMO]

    return top


# ==========================================
# --- CHAT ---
# ==========================================

def _verificar_alucinacao(resposta: str, contexto: list[dict], canal_nome: str) -> str:
    """
    Camada de segurança pós-geração.
    Verifica se a resposta contém conteúdo que não pode ser rastreado aos chunks recuperados.
    Usa sobreposição de palavras-chave como heurística.
    Se a taxa de cobertura for muito baixa, substitui por mensagem de segurança.
    """
    FRASES_NAO_ENCONTRADO = [
        'não encontrei', 'nao encontrei', 'not found',
        'não há informação', 'nao ha informacao',
        'não consta', 'nao consta',
    ]
    resposta_lower = resposta.lower()

    # Se o modelo já indicou que não encontrou, aceita diretamente
    if any(f in resposta_lower for f in FRASES_NAO_ENCONTRADO):
        return resposta

    # Extrai palavras significativas da resposta (5+ chars, sem stopwords)
    palavras_resposta = set(re.findall(r'\b[a-záéíóúàâêôãõç]{5,}\b', resposta_lower))
    palavras_resposta -= _STOPWORDS

    if not palavras_resposta:
        return resposta

    # Cria corpus dos chunks recuperados
    corpus_chunks = ' '.join(c['texto'].lower() for c in contexto)

    # Conta quantas palavras da resposta aparecem no corpus
    encontradas = sum(1 for p in palavras_resposta if p in corpus_chunks)
    cobertura = encontradas / len(palavras_resposta)

    # Se menos de 20% das palavras-chave aparecem nos chunks → provável alucinação
    if cobertura < 0.20:
        handle = f'@{canal_nome}' if canal_nome else 'este canal'
        return (
            f'Não encontrei informações suficientes sobre esse tema no conteúdo de {handle}. '
            f'Tente reformular a pergunta ou verifique se o canal aborda esse assunto.'
        )

    return resposta


def _montar_prompt(pergunta: str, contexto: list[dict], meta_canal: dict = None, historico: list = None, busca_ampla: bool = False) -> str:
    canal_info = ""
    if meta_canal:
        handle    = meta_canal.get('canal_handle', '')
        nome      = meta_canal.get('canal_nome', '')
        inscritos = meta_canal.get('inscritos', '')
        canal_info = (
            f"Canal: {nome} ({handle})"
            + (f" · {inscritos} inscritos" if inscritos else "")
            + "\n"
        )

    blocos = []
    for i, c in enumerate(contexto, 1):
        blocos.append(
            f"[Fonte {i}] {c['titulo']} ({c['data']})\n"
            f"Canal: {meta_canal.get('canal_handle', '') if meta_canal else ''}\n"
            f"Link: {c['link']}\n"
            f"{c['texto']}"
        )
    contexto_str = "\n\n---\n\n".join(blocos)

    hist_str = ''
    if historico:
        trocas = []
        for h in historico[-6:]:  # últimas 3 trocas (user+assistant)
            role = 'Usuário' if h['role'] == 'user' else 'Assistente'
            trocas.append(f"{role}: {h['content'][:300]}")
        if trocas:
            hist_str = "HISTÓRICO DA CONVERSA:\n" + "\n".join(trocas) + "\n\n"

    handle = meta_canal.get('canal_handle', 'este canal') if meta_canal else 'este canal'

    if busca_ampla:
        instrucoes = (
            f"Você é o Brain'IAC em modo de Busca Ampla.\n\n"
            f"TAREFA: responda à pergunta usando os trechos abaixo como referência principal.\n"
            f"Quando os trechos contiverem a informação, cite-os como fonte.\n"
            f"Quando os trechos forem insuficientes, você pode complementar com seu conhecimento geral "
            f"— mas deixe claro que essa parte não vem da base: use expressões como "
            f"'além do que está na base...' ou 'de forma geral...'.\n"
            f"Seja sempre honesto sobre a origem de cada informação.\n\n"
        )
    else:
        instrucoes = (
            f"Você é o Brain'IAC, um assistente que responde EXCLUSIVAMENTE com base nos trechos abaixo.\n\n"
            f"TAREFA: leia os trechos e extraia as informações que respondam à pergunta do usuário.\n"
            f"NÃO use nenhum conhecimento próprio, externo ou de treinamento.\n"
            f"CADA afirmação da sua resposta deve poder ser rastreada a um dos trechos abaixo.\n"
            f"Se os trechos não contiverem a informação, responda APENAS:\n"
            f"'Não encontrei esse tema no conteúdo do {handle}.'\n\n"
        )

    return (
        instrucoes
        + hist_str
        + f"TRECHOS DO CANAL {handle.upper()}:\n{contexto_str}\n\n"
        + f"PERGUNTA: {pergunta}\n\nRESPOSTA:"
    )


def chat(pergunta: str, canal_nome: str, historico: list = None, canais_extras: list = None, busca_ampla: bool = False) -> dict:
    config = carregar_config()
    provider = config.get('provider', '')
    if not provider or (not config.get('api_key') and provider != 'ollama'):
        raise ValueError("Configure a chave de API antes de usar o chat.")

    # Ollama local usa menos chunks para reduzir latência
    n_chunks = 4 if config.get('provider') == 'ollama' else 6
    contexto = _recuperar_contexto(pergunta, canal_nome, n=n_chunks, config=config, canais_extras=canais_extras)
    if not contexto:
        return {
            'resposta': 'Não encontrei conteúdo relevante para essa pergunta no índice do canal.',
            'fontes':   []
        }

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    prompt        = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla)
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
        'fontes':   [{'titulo': c['titulo'], 'data': c['data'],
                      'link': c['link'], 'score': c['score']} for c in contexto],
    }


def chat_stream(pergunta: str, canal_nome: str, historico: list = None, canais_extras: list = None, busca_ampla: bool = False):
    """
    Versão streaming de chat(). Yields chunks de texto conforme o LLM gera.
    Primeiro yield é um JSON com as fontes, depois yields são texto puro.
    """
    config = carregar_config()
    if not config.get('provider') or (not config.get('api_key') and config.get('provider') != 'ollama'):
        yield json.dumps({'error': 'Configure a chave de API antes de usar o chat.'})
        return

    try:
        # Ollama local usa menos chunks para reduzir latência
        n_chunks = 4 if config.get('provider') == 'ollama' else 6
        contexto = _recuperar_contexto(pergunta, canal_nome, n=n_chunks, config=config, canais_extras=canais_extras)
    except Exception as e:
        yield json.dumps({'error': str(e)})
        return

    if not contexto:
        yield json.dumps({'fontes': [], 'done': False})
        yield 'Não encontrei conteúdo relevante para essa pergunta no índice do canal.'
        yield json.dumps({'done': True})
        return

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    meta_canal    = _carregar_meta_canal(canal_prefixo)
    prompt        = _montar_prompt(pergunta, contexto, meta_canal, historico, busca_ampla)
    provider      = config['provider']
    api_key       = config.get('api_key', '')

    fontes = [{'titulo': c['titulo'], 'data': c['data'], 'link': c['link'], 'score': c['score']} for c in contexto]
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
