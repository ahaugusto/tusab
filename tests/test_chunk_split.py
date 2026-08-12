# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do fix de truncamento de capítulos longos (>3000 chars) no índice BM25:
blocos legados (sem PARTE:/TOTAL_PARTES:) precisam ser sub-divididos em vez de
truncados; blocos novos (já pré-divididos por extraction.py) precisam ser lidos
como estão, sem re-split.
"""
import os

import pytest


def _bloco(titulo, texto, ts=0, video_id="abc123", parte_linhas=""):
    return (
        "======================================================================\n"
        f"TITULO: {titulo}\n"
        "ABA: Videos\n"
        "DATA: 01/01/2026\n"
        "LINK: https://www.youtube.com/watch?v=abc123\n"
        f"VIDEO_ID: {video_id}\n"
        "VIEWS: 100\n"
        f"TIMESTAMP_INICIO: {ts}\n"
        f"{parte_linhas}"
        "TAGS: teste\n"
        "DESCRICAO: descricao de teste\n"
        "----------------------------------------------------------------------\n"
        "CONTEUDO:\n"
        f"{texto}\n"
        "======================================================================\n"
    )


def test_parsear_chunks_bloco_legado_maior_que_teto_e_dividido(tmp_path):
    from tusab_engine.agent.index import _parsear_chunks, _LIMITE_CHUNK_CHARS

    palavras = [f"palavra{i}" for i in range(1200)]  # ~9600+ chars, sem PARTE:/TOTAL_PARTES:
    texto_longo = " ".join(palavras)
    assert len(texto_longo) > _LIMITE_CHUNK_CHARS * 2

    arquivo = tmp_path / "prefixo_video.txt"
    arquivo.write_text(_bloco("Video Legado", texto_longo, ts=100), encoding="utf-8")

    chunks = _parsear_chunks(str(tmp_path), "prefixo")

    assert len(chunks) > 1  # foi dividido, não truncado
    total_partes = chunks[0]["total_partes"]
    assert total_partes == len(chunks)

    # nenhuma palavra perdida — a versão antiga truncava em 3000 chars e perdia o resto
    texto_junto = " ".join(c["texto_original"] for c in chunks)
    for p in palavras:
        assert p in texto_junto

    for idx, c in enumerate(chunks, start=1):
        assert c["parte"] == idx
        assert c["total_partes"] == total_partes
        assert c["timestamp_aproximado"] is True  # estimado, não veio de cue real
        assert len(c["texto_original"]) <= _LIMITE_CHUNK_CHARS

    # timestamps não regridem entre as partes
    tss = [c["timestamp_inicio"] for c in chunks]
    assert tss == sorted(tss)
    assert tss[0] == 100  # primeira parte usa o timestamp real do bloco


def test_parsear_chunks_bloco_ja_dividido_por_extraction_nao_e_re_dividido(tmp_path):
    """Bloco no formato NOVO (extraction.py já dividiu, com timestamp real de cue)
    — index.py não deve tentar dividir de novo nem marcar como aproximado."""
    from tusab_engine.agent.index import _parsear_chunks

    texto_curto = "conteudo ja dividido por extraction.py com timestamp real de cue, texto suficientemente longo pra passar do filtro"
    texto_parte2 = "continuacao do capitulo, tambem com texto suficientemente longo pra passar do filtro de oitenta caracteres"
    arquivo = tmp_path / "prefixo_video.txt"
    conteudo = (
        _bloco("Video — Cap (parte 1/2)", texto_curto, ts=200, parte_linhas="PARTE: 1\nTOTAL_PARTES: 2\n")
        + _bloco("Video — Cap (parte 2/2)", texto_parte2, ts=340, parte_linhas="PARTE: 2\nTOTAL_PARTES: 2\n")
    )
    arquivo.write_text(conteudo, encoding="utf-8")

    chunks = _parsear_chunks(str(tmp_path), "prefixo")

    assert len(chunks) == 2  # não virou 4 nem foi truncado/mesclado
    assert chunks[0]["parte"] == 1
    assert chunks[0]["total_partes"] == 2
    assert chunks[0]["timestamp_inicio"] == 200
    assert chunks[0]["timestamp_aproximado"] is False  # veio de cue real, não estimado
    assert chunks[1]["parte"] == 2
    assert chunks[1]["timestamp_inicio"] == 340


def test_parsear_chunks_bloco_curto_sem_parte_fica_com_total_partes_1(tmp_path):
    from tusab_engine.agent.index import _parsear_chunks

    arquivo = tmp_path / "prefixo_video.txt"
    arquivo.write_text(_bloco("Video Normal", "um conteudo curto qualquer, nada de especial por aqui, mas longo o bastante"), encoding="utf-8")

    chunks = _parsear_chunks(str(tmp_path), "prefixo")

    assert len(chunks) == 1
    assert chunks[0]["total_partes"] == 1
    assert chunks[0]["parte"] == 1
    assert chunks[0]["timestamp_aproximado"] is False


def test_cache_version_bumped_para_forcar_reprocessamento():
    """v1→v2: mudança no schema de parsing (split em vez de truncar) precisa
    invalidar cache de projetos já indexados antes deste fix — sem isso, capítulos
    longos continuariam truncados no índice até o .txt ser tocado de novo."""
    from tusab_engine.agent.index import _CACHE_VERSION
    assert _CACHE_VERSION >= 2
