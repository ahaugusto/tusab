# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Calibragem dinâmica de parâmetros de RAG por corpus (P0-c, perfil Especialista).

Ao final de cada indexação, calcula estatísticas reais do corpus (tamanho,
tipo dominante, densidade média) e persiste em corpus_profile.json. Consumido
por chat.py::_recuperar_contexto() para ajustar n_candidatos_bm25 (quantos
candidatos o CrossEncoder recebe na Busca Ampla) ao tamanho real da base —
corpus grande tem IDF menor por termo, mais candidatos dão ao CrossEncoder
mais chance de achar o chunk certo.

[INVARIANTE] Nunca incluir score_minimo aqui. Removido deliberadamente em
v1.0.26 (ver agents/_historia.md, "Score mínimo BM25 adaptativo por tamanho
de corpus" na seção "O que funcionou bem" — substituído por score>0 + FTS5
como rede de segurança). Qualquer threshold arbitrário, fixo ou adaptativo,
já foi tentado e cortava resultados válidos em corpus grande. Não reintroduzir.

chunk_size/overlap são calculados aqui só como METADADO informativo (exibido
no card "Perfil do corpus" da UI) — não realimentam o chunking real, que
continua com a lógica por tipo de aba já existente em index.py. Alimentar de
volta criaria um problema de ovo-e-galinha (precisa dos chunks pra calibrar,
mas calibra o tamanho do próximo chunk) e duplicaria lógica já correta.
"""

import os
from datetime import datetime

from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico


def _profile_path(canal_prefixo: str) -> str:
    return os.path.join(NEURAL_DIR, canal_prefixo, "management", "corpus_profile.json")


def _calibrar_corpus(canal_prefixo: str, chunks: list) -> dict:
    """Calcula o perfil do corpus a partir dos chunks já indexados.
    Retorna {} se não houver chunks (nada a calibrar)."""
    n_chunks = len(chunks)
    if n_chunks == 0:
        return {}

    contagem_aba = {}
    total_chars = 0
    for c in chunks:
        aba = c.get('aba') or 'youtube'
        contagem_aba[aba] = contagem_aba.get(aba, 0) + 1
        total_chars += len(c.get('texto_original') or c.get('texto') or '')

    tipo_dominante = max(contagem_aba, key=contagem_aba.get)
    densidade_media = total_chars / n_chunks

    # Metadado informativo — não realimenta a indexação (ver docstring do módulo)
    if tipo_dominante == 'documento':
        chunk_size_ref, overlap_ref = 1500, 300
    else:
        chunk_size_ref, overlap_ref = 1200, 250

    # Único parâmetro efetivamente consumido em retrieval — ver chat.py.
    # Corpus grande: mais candidatos pro CrossEncoder ter mais chance de
    # achar o chunk certo (IDF por termo cai conforme o corpus cresce).
    if n_chunks > 5000:
        n_candidatos_bm25 = 30
    elif n_chunks > 1000:
        n_candidatos_bm25 = 20
    else:
        n_candidatos_bm25 = 12  # equivalente ao n*2 default atual (n=6)

    return {
        "canal_prefixo":         canal_prefixo,
        "calibrado_em":          datetime.now().isoformat(),
        "n_chunks_total":        n_chunks,
        "tipo_dominante":        tipo_dominante,
        "densidade_media_chars": round(densidade_media, 1),
        "chunk_size_ref":        chunk_size_ref,
        "overlap_ref":           overlap_ref,
        "n_candidatos_bm25":     n_candidatos_bm25,
    }


def _salvar_profile(canal_prefixo: str, chunks: list) -> dict:
    """Calibra e persiste o corpus_profile.json (escrita atômica). Retorna o
    perfil salvo, ou {} se não houve nada a calibrar."""
    perfil = _calibrar_corpus(canal_prefixo, chunks)
    if not perfil:
        return {}
    path = _profile_path(canal_prefixo)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    salvar_json_atomico(perfil, path, indent=2)
    return perfil


def _carregar_profile(canal_prefixo: str) -> dict:
    """Lê o corpus_profile.json do projeto. Retorna {} se ausente ou corrompido
    — degradação graciosa, mesmo padrão já usado em todo o projeto."""
    import json
    path = _profile_path(canal_prefixo)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
