# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da correção de conflação entre documentos com vocabulário parecido
(ex: leis diferentes sobre "crimes hediondos") — bug real reportado por
Augusto: pergunta sobre a Lei 14.688 trouxe conteúdo real de outra lei
retornada pelo BM25 na resposta. Ver agents/_historia.md, 29/jul/2026.

Duas partes da correção:
1. index.py::_parsear_todos_chunks() — passa a parsear TITULO/DATA/URL_ORIGEM
   do cabeçalho de documents/texts/ (antes usava nome de arquivo sanitizado
   como título e deixava data/link sempre vazios).
2. chat.py::_recuperar_contexto() — filtro S3.4: quando a pergunta cita um
   identificador tipo "14.688", restringe aos chunks cujo título bate.

Sem chamada de rede real — tudo com arquivos reais em tmp_path (BM25 e
índice são estado interno do próprio módulo, não filesystem externo).
"""
import os

from tusab_engine.agent import index as index_mod
from tusab_engine.agent import lance_store


def _criar_documento(base_dir, prefixo, nome, titulo, texto, fonte="senado_leis", data="28/07/2026", url=""):
    doc_dir = os.path.join(base_dir, prefixo, "documents")
    os.makedirs(doc_dir, exist_ok=True)
    conteudo = f"TITULO: {titulo}\nFONTE: {fonte}\nDATA: {data}\n"
    if url:
        conteudo += f"URL_ORIGEM: {url}\n"
    conteudo += "-" * 60 + "\n" + texto
    with open(os.path.join(doc_dir, nome), "w", encoding="utf-8") as f:
        f.write(conteudo)


# ── Parsing do cabeçalho em documents/texts/ ──────────────────────────────────

def test_parsear_todos_chunks_le_titulo_data_link_do_cabecalho(tmp_path, monkeypatch):
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe2"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe3"))

    _criar_documento(
        str(tmp_path), "projeto_teste", "abc123_Lei_n__14_688.txt",
        titulo="Lei nº 14.688 de 20/09/2023",
        texto="Altera o Decreto-Lei nº 1.001, de 21 de outubro de 1969. " * 5,
        data="20/09/2023",
        url="https://normas.leg.br/?urn=urn:lex:br:federal:lei:2023-09-20;14688",
    )

    chunks = index_mod._parsear_todos_chunks("projeto_teste")
    assert len(chunks) == 1
    assert chunks[0]["titulo"] == "Lei nº 14.688 de 20/09/2023"
    assert chunks[0]["data"] == "20/09/2023"
    assert chunks[0]["link"] == "https://normas.leg.br/?urn=urn:lex:br:federal:lei:2023-09-20;14688"


def test_parsear_todos_chunks_usa_nome_arquivo_se_sem_cabecalho(tmp_path, monkeypatch):
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe2"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe3"))

    doc_dir = os.path.join(str(tmp_path), "projeto_teste", "documents")
    os.makedirs(doc_dir, exist_ok=True)
    with open(os.path.join(doc_dir, "arquivo_sem_cabecalho.txt"), "w", encoding="utf-8") as f:
        f.write("Texto solto sem nenhum cabeçalho estruturado. " * 10)

    chunks = index_mod._parsear_todos_chunks("projeto_teste")
    assert len(chunks) == 1
    assert chunks[0]["titulo"] == "arquivo_sem_cabecalho"  # fallback, comportamento preservado


# ── Filtro por identificador literal em _recuperar_contexto ──────────────────

def _construir_indice_real(tmp_path, index_dir, prefixo, docs):
    """docs: lista de (titulo, texto). Constrói uma tabela LanceDB real e aponta
    INDEX_DIR pra lá — _recuperar_contexto lê do disco de verdade."""
    os.makedirs(index_dir, exist_ok=True)
    chunks = [
        {"texto": texto, "texto_original": texto, "titulo": titulo, "aba": "documento",
         "data": "", "link": "", "tags": [], "descricao": "", "arquivo": f"{i}.txt", "canal": prefixo}
        for i, (titulo, texto) in enumerate(docs)
    ]
    assert lance_store.gravar_chunks(prefixo, chunks)


def test_filtro_identificador_restringe_a_documento_com_titulo_correspondente(tmp_path, monkeypatch):
    from tusab_engine.agent.chat import _recuperar_contexto, _bm25_cache

    index_dir = str(tmp_path / "indexes")
    monkeypatch.setattr(index_mod, "INDEX_DIR", index_dir, raising=False)
    monkeypatch.setattr(lance_store, "INDEX_DIR", index_dir, raising=False)
    _bm25_cache.clear()

    _construir_indice_real(tmp_path, index_dir, "projeto_teste", [
        ("Lei nº 14.688 de 20/09/2023", "Altera o Código Penal Militar e a Lei dos Crimes Hediondos " * 8),
        ("Lei nº 14.344 de 24/05/2022", "Altera o Código Penal e a Lei dos Crimes Hediondos " * 8),
        ("Lei nº 13.769 de 19/12/2018", "Altera o Código de Processo Penal e a Lei dos Crimes Hediondos " * 8),
    ])

    contexto = _recuperar_contexto(
        "O que a Lei 14.688 alterou?", "projeto_teste", n=4,
        config={"provider": "ollama", "query_expansion": False},
    )

    assert len(contexto) == 1
    assert "14.688" in contexto[0]["titulo"]


def test_filtrar_por_identificador_sem_numero_na_pergunta_nao_altera_resultados():
    # Testado direto na função extraída (não via BM25 real) — BM25 degenera
    # com corpus sintético de 2-3 documentos onde o termo aparece em quase
    # todos (IDF fica negativo/perto de zero), o que tornava esse cenário
    # difícil de isolar passando pelo pipeline completo de retrieval.
    from tusab_engine.agent.chat import _filtrar_por_identificador

    resultados = [
        {"titulo": "Lei nº 14.688 de 20/09/2023", "score": 5.0},
        {"titulo": "Lei nº 14.344 de 24/05/2022", "score": 3.0},
    ]
    saida = _filtrar_por_identificador("O que essas leis alteram sobre crimes hediondos?", resultados)
    assert saida == resultados


def test_filtrar_por_identificador_com_numero_restringe_ao_titulo_correspondente():
    from tusab_engine.agent.chat import _filtrar_por_identificador

    resultados = [
        {"titulo": "Lei nº 14.688 de 20/09/2023", "score": 5.0},
        {"titulo": "Lei nº 14.344 de 24/05/2022", "score": 3.0},
        {"titulo": "Lei nº 13.769 de 19/12/2018", "score": 2.0},
    ]
    saida = _filtrar_por_identificador("O que a Lei 14.688 alterou?", resultados)
    assert len(saida) == 1
    assert saida[0]["titulo"] == "Lei nº 14.688 de 20/09/2023"


def test_filtrar_por_identificador_sem_match_no_titulo_mantem_todos():
    from tusab_engine.agent.chat import _filtrar_por_identificador

    # Pergunta cita um número que não corresponde a nenhum título — sem match
    # real, filtro não aplica (fallback seguro, não zera os resultados).
    resultados = [
        {"titulo": "Lei nº 14.688 de 20/09/2023", "score": 5.0},
        {"titulo": "Lei nº 14.344 de 24/05/2022", "score": 3.0},
    ]
    saida = _filtrar_por_identificador("O que a Lei 99.999 alterou?", resultados)
    assert saida == resultados
