# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Indexação BM25 local — sem dependência de chave de API.

Responsabilidades:
  - _parsear_chunks / _parsear_todos_chunks : lê corpus do cerebro
  - _enriquecer_documento                  : prepara tokens para BM25
  - indexar()                              : constrói e persiste o índice
  - _recuperar_... / cache                 : gerencia _bm25_cache com lock
  - get_agent_status()                     : snapshot do estado do agente
"""

import os
import re
import json
import threading

from tusab_engine.storage import (
    DATA_DIR, NEURAL_DIR, INDEX_DIR,
    TXT_DIR, DOC_DIR, TEXT_DIR,
    salvar_json_atomico,
)
from tusab_engine.agent.config import carregar_config, salvar_config


# ── Helpers de path ───────────────────────────────────────────────────────────

def _get_canal_youtube_dir(prefixo: str) -> str:
    return os.path.join(NEURAL_DIR, prefixo, 'youtube')


def _get_canal_doc_dirs(prefixo: str) -> list:
    """Retorna dirs de documentos/textos do canal + legado."""
    dirs = []
    for sub in ['documents', 'texts']:
        dirs.append(os.path.join(NEURAL_DIR, prefixo, sub))
    dirs += [DOC_DIR, TEXT_DIR]
    return dirs


def _index_path(canal_prefixo: str) -> str:
    return os.path.join(INDEX_DIR, f"{canal_prefixo}_index.json")


# ── Cache BM25 em memória ─────────────────────────────────────────────────────
# _bm25_lock evita dupla reconstrução quando dois chats usam o mesmo canal.

_bm25_cache: dict = {}
_bm25_lock = threading.Lock()


def _invalidar_cache(canal_prefixo: str):
    with _bm25_lock:
        _bm25_cache.pop(canal_prefixo, None)


def _carregar_meta_canal(canal_prefixo: str) -> dict:
    for base in [_get_canal_youtube_dir(canal_prefixo), TXT_DIR]:
        meta_path = os.path.join(base, f'{canal_prefixo}_meta.json')
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
    return {}


# ── Status do agente ──────────────────────────────────────────────────────────

def get_agent_status() -> dict:
    config      = carregar_config()
    provider    = config.get('provider', '')
    canal_nome  = config.get('canal_indexado', '')
    index_count = 0
    canais_indexados = []

    indices_corrompidos = []

    if os.path.exists(INDEX_DIR):
        for fname in os.listdir(INDEX_DIR):
            if fname.endswith('_index.json'):
                fpath = os.path.join(INDEX_DIR, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    chunks = data.get('chunks', [])
                    if not isinstance(chunks, list):
                        raise ValueError("chunks inválidos")
                    nome  = data.get('canal_nome', fname.replace('_index.json', ''))
                    count = len(chunks)
                    indexed_at = data.get('indexed_at', None)
                    canais_indexados.append({'nome': nome, 'chunks': count, 'arquivo': fname, 'indexed_at': indexed_at})
                    if nome == canal_nome:
                        index_count = count
                except Exception:
                    # Índice corrompido — remove o arquivo e invalida o cache
                    try:
                        os.remove(fpath)
                        canal_corrompido = fname.replace('_index.json', '')
                        _invalidar_cache(canal_corrompido)
                        indices_corrompidos.append(canal_corrompido)
                    except Exception:
                        pass

    if not index_count and canais_indexados:
        index_count = sum(c['chunks'] for c in canais_indexados)

    if not provider:
        provider = 'ollama'

    base_desatualizada    = False
    novos_desde_indexacao = 0
    if canal_nome and os.path.exists(INDEX_DIR):
        try:
            canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
            idx_path = _index_path(canal_prefixo)
            if os.path.exists(idx_path):
                idx_mtime = os.path.getmtime(idx_path)
                for youtube_dir in [_get_canal_youtube_dir(canal_prefixo),
                                    os.path.join(NEURAL_DIR, 'youtube')]:
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
        'indices_corrompidos':    indices_corrompidos,
    }


# ── Stopwords PT + EN ─────────────────────────────────────────────────────────

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
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','up','about','into','is','are','was','were','be','been',
    'have','has','had','do','does','did','will','would','could','should',
    'may','might','this','that','these','those','i','you','he','she','it',
    'we','they','what','which','who','when','where','why','how','all','each',
    'every','both','few','more','most','other','some','no','not','only',
    'same','so','than','too','very','just','also','as','if','then',
}


# ── Parser de chunks ──────────────────────────────────────────────────────────

def _parsear_chunks(txt_dir: str, canal_prefixo: str) -> list:
    chunks   = []
    arquivos = sorted([
        f for f in os.listdir(txt_dir)
        if f.startswith(canal_prefixo) and f.endswith('.txt')
    ])

    for arquivo in arquivos:
        caminho = os.path.join(txt_dir, arquivo)
        with open(caminho, 'r', encoding='utf-8-sig', errors='ignore') as f:
            conteudo = f.read()
        # Corrige mojibake latin-1→utf-8 (comum em títulos extraídos pelo yt-dlp)
        try:
            conteudo = conteudo.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass

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
                'aba':      aba.group(1).strip()    if aba    else 'youtube',
                'data':     data.group(1).strip()   if data   else '',
                'link':     link.group(1).strip()   if link   else '',
                'tags':     tags,
                'descricao': desc_m.group(1).strip() if desc_m else '',
                'arquivo':  arquivo,
                'canal':    canal_prefixo,
            })

    return chunks


def _parsear_todos_chunks(canal_prefixo: str) -> list:
    """Lê chunks de todas as fontes: YouTube do canal + docs + avulso + legado."""
    chunks = []
    for yt_dir in [_get_canal_youtube_dir(canal_prefixo), TXT_DIR]:
        if os.path.exists(yt_dir):
            chunks += _parsear_chunks(yt_dir, canal_prefixo)

    seen_files = set()
    for source_dir in _get_canal_doc_dirs(canal_prefixo):
        if not os.path.exists(source_dir):
            continue
        aba_label  = 'texto' if os.path.basename(source_dir) == 'texts' else 'documento'
        canal_dir  = os.path.basename(os.path.dirname(source_dir))
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
                # Overlap de 200 chars entre chunks: evita cortar uma ideia no meio
                # e garante que frases-chave na borda de um chunk apareçam em dois candidatos BM25.
                CHUNK_SIZE, OVERLAP = 2000, 200
                partes = [conteudo[max(0, i - OVERLAP):i + CHUNK_SIZE]
                          for i in range(0, len(conteudo), CHUNK_SIZE)]
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
                        'canal':     canal_dir,
                        'descricao': '',
                    })
            except Exception:
                pass
    return chunks


# ── Enriquecimento BM25 ───────────────────────────────────────────────────────

def _enriquecer_documento(texto: str, tags: list, descricao: str = '', n_keywords: int = 15) -> list:
    palavras = re.findall(r'\b[a-záéíóúàâêôãõçñüäöï]{4,}\b', texto.lower())
    freq: dict = {}
    for p in palavras:
        if p not in _STOPWORDS:
            freq[p] = freq.get(p, 0) + 1
    top_keywords = sorted(freq, key=lambda k: freq[k], reverse=True)[:n_keywords]

    tags_norm = [re.sub(r'[^a-záéíóúàâêôãõç\w]', '_', t.lower()).strip('_')
                 for t in tags if t]

    prefixo = tags_norm * 3 + top_keywords * 2
    desc_tokens = descricao.lower().split() if descricao else []
    return prefixo + desc_tokens + texto.lower().split()


# ── Indexação ─────────────────────────────────────────────────────────────────

FREE_MAX_CANAIS = 2


def _contar_canais_indexados() -> list:
    """Retorna lista de nomes de canais com índice existente."""
    if not os.path.exists(INDEX_DIR):
        return []
    canais = []
    for fname in os.listdir(INDEX_DIR):
        if fname.endswith('_index.json'):
            try:
                with open(os.path.join(INDEX_DIR, fname), 'r', encoding='utf-8') as f:
                    data = __import__('json').load(f)
                canais.append(data.get('canal_nome', fname.replace('_index.json', '')))
            except Exception:
                pass
    return canais


def indexar(canal_nome: str, canal_prefixo: str, callback=None, stop_event=None) -> int:
    config = carregar_config()

    # Limite Free: máximo FREE_MAX_CANAIS canais indexados simultaneamente
    if not config.get('pro', False):
        existentes = _contar_canais_indexados()
        canal_ja_indexado = canal_nome in existentes
        if not canal_ja_indexado and len(existentes) >= FREE_MAX_CANAIS:
            raise ValueError(
                f"PRO_LIMIT:Você já tem {len(existentes)} canais indexados. "
                f"O plano Free permite até {FREE_MAX_CANAIS}. "
                f"Remova um canal ou faça upgrade para o Pro."
            )

    if callback: callback("🔍 Lendo arquivos do corpus...")

    chunks = _parsear_todos_chunks(canal_prefixo)
    if not chunks:
        raise ValueError(f"Nenhum conteúdo encontrado para '{canal_prefixo}'. Faça a extração ou adicione documentos.")

    if stop_event and stop_event.is_set():
        if callback: callback("🛑 Indexação cancelada.")
        return 0

    if callback: callback(f"📦 {len(chunks)} chunks encontrados. Salvando índice local...")

    os.makedirs(INDEX_DIR, exist_ok=True)
    import time as _time
    salvar_json_atomico({'canal_nome': canal_nome, 'chunks': chunks, 'indexed_at': int(_time.time())}, _index_path(canal_prefixo))

    config['canal_indexado'] = canal_nome
    salvar_config(config)

    if callback: callback(f"✅ Indexação concluída! {len(chunks)} chunks prontos para consulta.")
    _invalidar_cache(canal_prefixo)
    return len(chunks)
