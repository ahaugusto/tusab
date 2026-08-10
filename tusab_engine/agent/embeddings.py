# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Busca vetorial (embeddings) via Ollama — complemento semântico ao BM25+FTS5.

Responsabilidade: gerar, persistir e consultar embeddings dos chunks indexados.
Mesma filosofia de degradação graciosa do KeyBERT/CrossEncoder (agent/index.py,
agent/chat.py): qualquer indisponibilidade (Ollama offline, timeout, modelo
ausente, dimensão incompatível) retorna sentinel (None/[]/False), nunca lança
exceção — a ausência do .npy é sempre um estado válido, equivalente a "esta
base não tem busca vetorial ainda".

Persistência: data/agent_index/{prefixo}_embeddings.npy (float32, linhas
L2-normalizadas na escrita — cosseno na query vira produto escalar direto) +
{prefixo}_embeddings_meta.json (modelo, dim, n_chunks, gerado_em). Ordem
posicional idêntica a chunks[i] do índice principal — mesmo contrato do rowid
no FTS5 (ver fts.py).

Pipeline de uso:
  1. index.py::indexar() chama gerar_embeddings_lote() por arquivo-fonte e
     salvar_matriz() ao final.
  2. chat.py::_recuperar_contexto() chama buscar_vetorial() (só quando
     busca_ampla=True) e mescla os candidatos no mesmo ponto onde o FTS5 é
     mesclado hoje.
"""

import os
import json
import time
import threading

import requests

from tusab_engine.storage import INDEX_DIR, salvar_json_atomico, salvar_npy_atomico

EMBED_MODEL = 'nomic-embed-text'
EMBED_DIM = 768

_OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags'
_OLLAMA_EMBED_URL = 'http://localhost:11434/api/embed'

# Cache em memória da matriz carregada, chaveado por prefixo — evita reler o
# .npy do disco a cada pergunta do chat quando nada mudou (mesmo padrão de
# _carregar_projeto_cache em chat.py).
_matriz_cache: dict = {}
_matriz_lock = threading.Lock()


def _npy_path(prefixo: str) -> str:
    return os.path.join(INDEX_DIR, f"{prefixo}_embeddings.npy")


def _meta_path(prefixo: str) -> str:
    return os.path.join(INDEX_DIR, f"{prefixo}_embeddings_meta.json")


# ── Disponibilidade do modelo ─────────────────────────────────────────────────

def ollama_tags(timeout: float = 3.0) -> list:
    """Lista de nomes de modelos instalados no Ollama local. [] se Ollama não
    estiver rodando. Duplicado de router_agent.py::ollama_status() porque
    agent/ não pode depender de api/ (regra de dependência acíclica:
    api → agent|motor → storage, nunca o contrário)."""
    try:
        resp = requests.get(_OLLAMA_TAGS_URL, timeout=timeout)
        resp.raise_for_status()
        return [m.get('name', '') for m in resp.json().get('models', [])]
    except Exception:
        return []


def modelo_disponivel(modelo: str = EMBED_MODEL) -> bool:
    """True se `modelo` (tolerante a sufixo ':latest') está entre os tags
    instalados no Ollama local."""
    alvo = modelo.split(':')[0]
    return any(t.split(':')[0] == alvo for t in ollama_tags())


# ── Geração ────────────────────────────────────────────────────────────────────

def gerar_embeddings_lote(textos: list, modelo: str = EMBED_MODEL, timeout: float = 30.0):
    """POST /api/embed em lote nativo (mesma unidade de lote de
    _enriquecer_com_keywords_lote em index.py: um arquivo-fonte por chamada).
    Retorna lista de vetores na MESMA ORDEM de `textos`, ou None se Ollama não
    respondeu a tempo, houve erro de conexão/HTTP, a resposta não trouxe
    'embeddings' com o tamanho esperado, ou algum vetor tem dimensão errada.
    Nunca lança exceção — sentinel de falha, mesma filosofia de
    _enriquecer_com_keywords_lote/_get_cross_encoder."""
    if not textos:
        return []
    try:
        resp = requests.post(
            _OLLAMA_EMBED_URL,
            json={'model': modelo, 'input': textos},
            timeout=timeout,
        )
        resp.raise_for_status()
        vetores = resp.json().get('embeddings')
        if not vetores or len(vetores) != len(textos):
            return None
        if any(len(v) != EMBED_DIM for v in vetores):
            return None
        return vetores
    except Exception:
        return None


def gerar_embedding_query(pergunta: str, modelo: str = EMBED_MODEL, timeout: float = 5.0):
    """Caso especial de lote=1, usado em retrieval (chat.py). Timeout menor que
    o de indexação (5s vs 30s) — no chat, uma Ollama lenta não pode travar a
    resposta; se exceder, o chamador cai no fallback (busca sem vetorial)."""
    vetores = gerar_embeddings_lote([pergunta], modelo=modelo, timeout=timeout)
    if not vetores:
        return None
    return vetores[0]


# ── Persistência ──────────────────────────────────────────────────────────────

def salvar_matriz(prefixo: str, vetores: list, modelo: str = EMBED_MODEL) -> bool:
    """Constrói o array (float32, linhas L2-normalizadas; NaN nas linhas sem
    embedding válido), grava .npy + .meta.json via storage.salvar_npy_atomico/
    salvar_json_atomico. Retorna False sem escrever nada se todas as linhas
    forem None (Ollama nunca respondeu — não há sentido em persistir um
    arquivo 100% NaN)."""
    import numpy as np

    if not vetores or all(v is None for v in vetores):
        return False

    matriz = np.full((len(vetores), EMBED_DIM), np.nan, dtype=np.float32)
    for i, v in enumerate(vetores):
        if v is None or len(v) != EMBED_DIM:
            continue
        arr = np.asarray(v, dtype=np.float32)
        norma = np.linalg.norm(arr)
        if norma > 0:
            matriz[i] = arr / norma

    try:
        salvar_npy_atomico(matriz, _npy_path(prefixo))
        salvar_json_atomico({
            'modelo': modelo,
            'dim': EMBED_DIM,
            'n_chunks': len(vetores),
            'gerado_em': int(time.time()),
        }, _meta_path(prefixo))
    except Exception:
        return False

    with _matriz_lock:
        _matriz_cache.pop(prefixo, None)
    return True


def carregar_matriz(prefixo: str, n_chunks_esperado: int = None):
    """Carrega .npy validando contra .meta.json (modelo/dim/n_chunks). Cache em
    memória por mtime do .npy. Retorna None em qualquer inconsistência — nunca
    lança, e nunca deixa um matmul de shape incompatível quebrar o chat."""
    import numpy as np

    npy_path = _npy_path(prefixo)
    meta_path = _meta_path(prefixo)
    if not os.path.exists(npy_path) or not os.path.exists(meta_path):
        return None

    try:
        mtime = os.path.getmtime(npy_path)
    except OSError:
        return None

    with _matriz_lock:
        cached = _matriz_cache.get(prefixo)
        if cached and cached[0] == mtime:
            matriz = cached[1]
        else:
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                if meta.get('modelo') != EMBED_MODEL or meta.get('dim') != EMBED_DIM:
                    return None
                matriz = np.load(npy_path)
                if matriz.ndim != 2 or matriz.shape[1] != EMBED_DIM or matriz.shape[0] != meta.get('n_chunks'):
                    return None
                _matriz_cache[prefixo] = (mtime, matriz)
            except Exception:
                return None

    if n_chunks_esperado is not None and matriz.shape[0] != n_chunks_esperado:
        return None

    return matriz


# ── Busca ──────────────────────────────────────────────────────────────────────

def buscar_vetorial(pergunta: str, prefixo: str, n_chunks_index: int, top_k: int = 6) -> list:
    """Retorna até top_k pares (indice_do_chunk, similaridade_cosseno), ordenados
    por similaridade desc. [] se .npy ausente, Ollama indisponível na hora da
    query, ou n_chunks_index != linhas do .npy (índice dessincronizado —
    reindexação pendente). Ignora linhas NaN (chunks sem embedding válido)
    antes do top-k."""
    import numpy as np

    matriz = carregar_matriz(prefixo, n_chunks_esperado=n_chunks_index)
    if matriz is None:
        return []

    vetor_query = gerar_embedding_query(pergunta)
    if vetor_query is None:
        return []

    q = np.asarray(vetor_query, dtype=np.float32)
    norma_q = np.linalg.norm(q)
    if norma_q == 0:
        return []
    q = q / norma_q

    validos = ~np.isnan(matriz).any(axis=1)
    if not validos.any():
        return []

    scores = np.full(matriz.shape[0], -np.inf, dtype=np.float32)
    scores[validos] = matriz[validos] @ q

    top_idx = np.argsort(scores)[::-1][:top_k]
    return [(int(i), float(scores[i])) for i in top_idx if scores[i] > -np.inf]


def embeddings_existe(prefixo: str) -> bool:
    """Verdadeiro se o .npy existe para este projeto — usado por
    get_agent_status() para expor 'embeddings_disponivel' sem custo de I/O
    além de um exists()."""
    return os.path.exists(_npy_path(prefixo))
