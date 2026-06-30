# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
SQLite FTS5 — camada de busca exata sobre o corpus indexado.

Responsabilidade: garantir recall para termos literalmente presentes nos arquivos.
O BM25 cuida do ranqueamento; o FTS5 cuida de não perder nada.

Pipeline de uso:
  1. buscar_fts(query, canal_prefixo, n) → candidatos com exact-match
  2. chat.py mescla candidatos FTS5 com candidatos BM25 (deduplicado por chunk)
  3. CrossEncoder reordena o pool mesclado

Banco de dados: data/indexes/{canal_prefixo}_fts.db (SQLite, criado ao indexar)
Schema FTS5:
  CREATE VIRTUAL TABLE chunks USING fts5(
      texto,          -- texto_original sem enriquecimento KeyBERT
      titulo,
      tags,
      tokenize='unicode61 remove_diacritics 2'
  )
  -- rowid é implícito no SQLite FTS5 (não declarado como coluna, mas acessível em INSERT/SELECT)

Tokenizador unicode61: suporte nativo a UTF-8, acentos e maiúsculas/minúsculas.
remove_diacritics=2: trata "ação" e "acao" como equivalentes — busca robusta para
usuários que digitam sem acentos.
"""

import os
import re
import sqlite3
import threading

from tusab_engine.storage import INDEX_DIR

def _sanitizar_prefixo(canal_prefixo: str) -> str:
    """Garante que o prefixo não contenha path traversal — defesa em profundidade."""
    return re.sub(r'[^\w\-]', '_', canal_prefixo)

_fts_lock = threading.Lock()


def _fts_path(canal_prefixo: str) -> str:
    return os.path.join(INDEX_DIR, f"{_sanitizar_prefixo(canal_prefixo)}_fts.db")


def construir_fts(canal_prefixo: str, chunks: list) -> None:
    """Cria ou reconstrói o banco FTS5 a partir dos chunks do JSON de índice.

    Chamado pelo indexar() em index.py após salvar o JSON — sem custo extra
    de I/O porque os chunks já estão em memória.
    """
    os.makedirs(INDEX_DIR, exist_ok=True)
    db_path = _fts_path(canal_prefixo)

    with _fts_lock:
        con = sqlite3.connect(db_path)
        try:
            cur = con.cursor()
            cur.execute("DROP TABLE IF EXISTS chunks")
            cur.execute("""
                CREATE VIRTUAL TABLE chunks USING fts5(
                    texto,
                    titulo,
                    tags,
                    tokenize='unicode61 remove_diacritics 2'
                )
            """)
            rows = [
                (
                    c.get('texto_original') or c.get('texto', ''),
                    c.get('titulo', ''),
                    ' '.join(c.get('tags', [])),
                )
                for c in chunks
            ]
            cur.executemany("INSERT INTO chunks(rowid, texto, titulo, tags) VALUES (?, ?, ?, ?)",
                            [(i, *r) for i, r in enumerate(rows)])
            con.commit()
        finally:
            con.close()


def buscar_fts(query: str, canal_prefixo: str, n: int = 10) -> list[int]:
    """Retorna rowids dos chunks que contêm a query como exact-match FTS5.

    Usa MATCH com aspas para busca de frase quando a query tem múltiplas palavras,
    e sem aspas (OR implícito) quando é um único termo — maximiza recall.

    Retorna lista de rowids (inteiros) que indexam diretamente nos chunks do JSON,
    ordenados por rank FTS5 (mais relevante primeiro).
    Retorna [] se banco não existir ou query vazia.
    """
    db_path = _fts_path(canal_prefixo)
    if not query or not query.strip() or not os.path.exists(db_path):
        return []

    # Sanitiza a query para FTS5: remove caracteres especiais que quebram a sintaxe
    clean = query.strip().replace('"', '').replace("'", '').replace('*', '')
    if not clean:
        return []

    # Duas estratégias: frase exata primeiro, depois termos individuais OR
    palavras = clean.split()
    estrategias = []
    if len(palavras) > 1:
        estrategias.append(f'"{clean}"')          # frase exata
    estrategias.append(' OR '.join(palavras))       # termos individuais (OR)

    rowids: list[int] = []
    seen: set[int] = set()

    try:
        with _fts_lock:
            con = sqlite3.connect(db_path, timeout=5)
            try:
                cur = con.cursor()
                for fts_query in estrategias:
                    try:
                        cur.execute(
                            "SELECT rowid FROM chunks WHERE chunks MATCH ? ORDER BY rank LIMIT ?",
                            (fts_query, n),
                        )
                        for (rid,) in cur.fetchall():
                            if rid not in seen:
                                seen.add(rid)
                                rowids.append(rid)
                        if len(rowids) >= n:
                            break
                    except sqlite3.OperationalError:
                        # Sintaxe FTS5 inválida para esta estratégia — tenta a próxima
                        continue
            finally:
                con.close()
    except Exception:
        return []

    return rowids[:n]


def fts_existe(canal_prefixo: str) -> bool:
    """Verdadeiro se o banco FTS5 existe para este canal."""
    return os.path.exists(_fts_path(canal_prefixo))
