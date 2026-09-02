# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
LanceDB — armazenamento columnar dos chunks indexados (substitui {prefixo}_index.json).

Arquitetura definitiva desde v1.0.55: troca o backend de armazenamento DIRETO,
sem migração de dado legado nem fallback para o JSON antigo.

Responsabilidade: só armazenamento. O ranking continua 100% BM25Okapi (rank_bm25,
Python, em memória) — chat.py::_carregar_projeto_cache lê os chunks desta tabela
em vez do JSON e reconstrói o BM25Okapi exatamente como antes. Decisão validada
com benchmark real de qualidade (01-02/set/2026, ver `agents/_historia.md`): o
FTS nativo do LanceDB (`tbl.search(query, query_type='fts')`) foi testado contra
20 perguntas reais e perdeu em título exato (8/11 vs 10/11 do BM25 atual) sem
ganhar em paráfrase (0/6 em ambos) — não usar aqui não é cautela teórica, é
resultado medido. Ganho real desta migração de armazenamento: append incremental
sem reescrever o corpus inteiro, leitura columnar (mmap) em vez de carregar um
JSON gigante pra RAM a cada rebuild de cache.

Armazenamento: data/agent_index/{prefixo}.lancedb/ (diretório — dataset Lance).
Escrita atômica: grava em {prefixo}.lancedb.tmp e promove via os.replace() do
diretório inteiro — mesma primitiva de salvar_json_atomico, adaptada pra diretório.

Degradação graciosa total: toda função aqui retorna None/False/[] em qualquer
falha (lancedb ausente, pyarrow indisponível, dataset corrompido) — nunca lança.
"""

import os
import re
import shutil
import threading

from tusab_engine.storage import INDEX_DIR

_TABLE_NAME = "chunks"
_lance_lock = threading.Lock()

# Schema espelha 1:1 os campos hoje presentes no dict de chunk gerado por
# index.py (_parsear_um_arquivo/_parsear_todos_chunks) — nenhum campo novo,
# nenhum removido. Campos ausentes num chunk (ex: vídeo YouTube não tem
# 'total_partes') recebem default explícito antes da gravação (ver
# _normalizar_chunk) porque Arrow exige colunas homogêneas.
_CAMPOS_STR   = ['titulo', 'aba', 'data', 'link', 'descricao', 'arquivo', 'canal',
                 'video_id', 'texto', 'texto_original']
_CAMPOS_INT   = ['views', 'timestamp_inicio', 'parte', 'total_partes']
_CAMPOS_BOOL  = ['timestamp_aproximado']


def _sanitizar_prefixo(prefixo: str) -> str:
    """Garante que o prefixo não contenha path traversal — defesa em profundidade,
    mesmo padrão de fts.py::_sanitizar_prefixo (duplicado, não extraído para
    storage.py, porque agent/ não pode depender de api/ nem vice-versa e ambos
    precisam da função sem criar acoplamento novo)."""
    return re.sub(r'[^\w\-]', '_', prefixo)


def caminho_tabela(prefixo: str) -> str:
    """Path absoluto do diretório da tabela — exposto para callers que
    precisam do caminho bruto (ex: export/import de base .tusab, que
    percorre o diretório recursivamente para empacotar em zip)."""
    return os.path.join(INDEX_DIR, f"{_sanitizar_prefixo(prefixo)}.lancedb")


_lancedb_path = caminho_tabela  # alias interno — mantém os call-sites já escritos neste módulo


def _meta_path(prefixo: str) -> str:
    """Sidecar JSON pequeno (só {projeto_nome, indexed_at}) — o nome de exibição
    do projeto pode ter espaços/acentos que o prefixo sanitizado não preserva
    (ex: 'Ciência Hoje' -> prefixo 'Ciência_Hoje' já sanitizado, mas o valor
    ORIGINAL antes de qualquer sanitização adicional é o que a UI deve mostrar).
    Não duplica os chunks — só o metadado que a tabela Arrow não guarda de
    forma prática (schema homogêneo por linha, sem 'header' de tabela)."""
    return os.path.join(INDEX_DIR, f"{_sanitizar_prefixo(prefixo)}.lancedb_meta.json")


def salvar_meta(prefixo: str, projeto_nome: str, indexed_at: int) -> None:
    from tusab_engine.storage import salvar_json_atomico
    try:
        salvar_json_atomico({'projeto_nome': projeto_nome, 'indexed_at': indexed_at}, _meta_path(prefixo))
    except Exception:
        pass  # metadado de exibição — falha aqui não pode quebrar a indexação


def carregar_meta(prefixo: str) -> dict:
    caminho = _meta_path(prefixo)
    if not os.path.exists(caminho):
        return {}
    try:
        import json
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _normalizar_chunk(chunk: dict) -> dict:
    """Preenche defaults pros campos que Arrow exige presentes e tipados —
    um dict de chunk YouTube não tem os mesmos campos que um dict de
    documento/texto (ver index.py). Não muta o chunk original."""
    normalizado = {}
    for campo in _CAMPOS_STR:
        v = chunk.get(campo, '')
        normalizado[campo] = v if isinstance(v, str) else ('' if v is None else str(v))
    for campo in _CAMPOS_INT:
        v = chunk.get(campo)
        normalizado[campo] = int(v) if isinstance(v, (int, float)) else 0
    for campo in _CAMPOS_BOOL:
        normalizado[campo] = bool(chunk.get(campo, False))
    tags = chunk.get('tags', [])
    normalizado['tags'] = [str(t) for t in tags] if isinstance(tags, list) else []
    return normalizado


def tabela_existe(prefixo: str) -> bool:
    return os.path.isdir(_lancedb_path(prefixo))


def gravar_chunks(prefixo: str, chunks: list) -> bool:
    """Grava a tabela inteira (rebuild completo — equivalente ao
    salvar_json_atomico(..., _index_path(...)) que esta função substitui).
    Retorna False em qualquer falha, sem lançar — chamador (index.py::indexar())
    trata False como 'LanceDB indisponível nesta indexação', sem quebrar o resto
    do pipeline (FTS5/embeddings/calibragem continuam rodando normalmente)."""
    if not chunks:
        return False
    try:
        import lancedb
        import pyarrow as pa
    except Exception:
        return False

    try:
        registros = [_normalizar_chunk(c) for c in chunks]
        tabela_arrow = pa.Table.from_pylist(registros)

        os.makedirs(INDEX_DIR, exist_ok=True)
        destino = _lancedb_path(prefixo)
        temp = destino + '.tmp'

        with _lance_lock:
            if os.path.isdir(temp):
                shutil.rmtree(temp, ignore_errors=True)
            db = lancedb.connect(temp)
            db.create_table(_TABLE_NAME, data=tabela_arrow)
            # os.replace() em diretório: atômico no mesmo volume, mesma garantia
            # de salvar_json_atomico/salvar_npy_atomico — nunca deixa o destino
            # num estado parcial visível a um leitor concorrente.
            if os.path.isdir(destino):
                antigo = destino + '.old'
                if os.path.isdir(antigo):
                    shutil.rmtree(antigo, ignore_errors=True)
                os.replace(destino, antigo)
                os.replace(temp, destino)
                shutil.rmtree(antigo, ignore_errors=True)
            else:
                os.replace(temp, destino)
        return True
    except Exception:
        return False


def carregar_chunks(prefixo: str) -> list | None:
    """Lê todos os chunks da tabela, na ordem de gravação. Retorna None se a
    tabela não existir ou estiver corrompida — chamador (chat.py) trata None
    exatamente como hoje trata '_index.json ausente' (ValueError 'Índice não
    encontrado', mensagem já existente e testada)."""
    if not tabela_existe(prefixo):
        return None
    try:
        import lancedb
    except Exception:
        return None
    try:
        with _lance_lock:
            db = lancedb.connect(_lancedb_path(prefixo))
            tbl = db.open_table(_TABLE_NAME)
            # LanceTable não tem .to_list() direto (só LanceQueryBuilder, vindo
            # de .search()) — to_pandas().to_dict('records') é o caminho real
            # pra despejar a tabela inteira como lista de dicts, confirmado
            # contra a API real (dir(tbl) não lista to_list em lancedb 0.34).
            registros = tbl.to_pandas().to_dict('records')
        if not registros:
            return None
        # tags vem de volta como numpy.ndarray (Arrow list<string> via pandas)
        # — normaliza pra list[str] puro, contrato que chat.py/_enriquecer_documento
        # espera (c.get('tags', []) usado como lista Python).
        for r in registros:
            tags = r.get('tags')
            if tags is not None and not isinstance(tags, list):
                r['tags'] = list(tags)
        return registros
    except Exception:
        return None


def mtime(prefixo: str) -> float | None:
    """mtime do diretório da tabela — usado por chat.py pra invalidar o cache
    em memória do BM25Okapi, mesmo papel que os.path.getmtime(_index_path(...))
    tinha antes (ver chat.py::_carregar_projeto_cache)."""
    caminho = _lancedb_path(prefixo)
    if not os.path.isdir(caminho):
        return None
    try:
        return os.path.getmtime(caminho)
    except OSError:
        return None


def remover_tabela(prefixo: str) -> None:
    """Remove a tabela (e o sidecar de metadata) do disco — usado por fluxos de
    reset/exclusão de projeto. Nunca lança; ausência do diretório não é erro."""
    caminho = _lancedb_path(prefixo)
    if os.path.isdir(caminho):
        shutil.rmtree(caminho, ignore_errors=True)
    meta = _meta_path(prefixo)
    if os.path.exists(meta):
        try:
            os.remove(meta)
        except Exception:
            pass
