# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de tusab_engine.agent.chat::_tokenizar_query.

Bug real (14/ago/2026, ver agents/_historia.md): a query do BM25 nunca
filtrava stopword/pontuação antes de pontuar — "Me fale sobre self-rag.
O que é?" numa base com papers de RAG + leis recuperava só leis, porque
"sobre" sozinho (não filtrado, alta frequência em texto jurídico formal)
pontuava mais alto que "self-rag" (termo real da pergunta). "sobre" também
não estava na lista _STOPWORDS — corrigido junto.
"""
from tusab_engine.agent.chat import _tokenizar_query


def test_remove_stopwords_pt():
    assert _tokenizar_query("Me fale sobre self-rag. O que e?") == ["fale", "self-rag"]


def test_remove_pontuacao_de_borda():
    assert _tokenizar_query("O que e BM25?") == ["bm25"]


def test_remove_stopword_e_acentuada():
    # "é" (verbo ser) tem o mesmo efeito de ruído que "sobre" — mesmo
    # achado do bug real. Usa um termo de conteúdo real na frase pra não
    # cair no fallback de "só stopwords" (ver test abaixo para esse caso).
    assert "é" not in _tokenizar_query("o que é self-rag")


def test_preserva_hifen_interno():
    # Não separa "self-rag" em dois tokens — mantém compatível com a
    # tokenização do corpus (index.py::_enriquecer_documento usa o mesmo
    # .lower().split(), sem separar hífen).
    tokens = _tokenizar_query("explique o self-rag")
    assert "self-rag" in tokens


def test_sobre_e_stopword():
    # "sobre" foi o termo que causou o bug real — precisa estar filtrado.
    assert "sobre" not in _tokenizar_query("fale sobre self-rag")


def test_pergunta_so_com_stopwords_nao_fica_vazia():
    # Fallback: se filtrar tudo, degrada pra tokens sem filtro em vez de
    # buscar com lista vazia (que o BM25 trata como "nenhum termo").
    tokens = _tokenizar_query("o que é isso")
    assert tokens != []


def test_string_vazia_nao_lanca():
    assert _tokenizar_query("") == []


def test_none_nao_lanca():
    assert _tokenizar_query(None) == []
