# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do progresso granular de indexação — _contar_unidades_fonte() e
progress_callback em _parsear_todos_chunks(). Garante que a contagem de
progresso não altera o conjunto de chunks retornado (regressão de schema
seria crítica — ver aviso [IMPACTO] em index.py::indexar()).
"""
import os

from tusab_engine.agent import index as index_mod


def _criar_projeto_youtube(base_dir, prefixo, canal, n_videos=2):
    """Cria estrutura data/neural/{prefixo}/youtube/{canal}/*.txt com N vídeos."""
    canal_dir = os.path.join(base_dir, prefixo, "youtube", canal)
    os.makedirs(canal_dir, exist_ok=True)
    for i in range(n_videos):
        conteudo = (
            f"TITULO: Video de teste {i}\n"
            f"ABA: youtube\nDATA: 01/01/2026\nLINK: https://youtube.com/watch?v=abc{i}\n"
            f"TAGS: teste\nVIDEO_ID: abc{i}\nVIEWS: 10\nTIMESTAMP_INICIO: 0\n"
            + "-" * 60 + "\n"
            + ("Conteúdo de teste " * 20)
        )
        path = os.path.join(canal_dir, f"{canal}_video{i}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(conteudo)


def _criar_documento(base_dir, prefixo, nome, texto="Documento de teste " * 30):
    doc_dir = os.path.join(base_dir, prefixo, "documents")
    os.makedirs(doc_dir, exist_ok=True)
    with open(os.path.join(doc_dir, nome), "w", encoding="utf-8") as f:
        f.write(texto)


def test_contar_unidades_fonte_soma_canal_e_documentos(tmp_path, monkeypatch):
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))

    _criar_projeto_youtube(str(tmp_path), "projeto_teste", "canal_a", n_videos=3)
    _criar_documento(str(tmp_path), "projeto_teste", "doc1.txt")
    _criar_documento(str(tmp_path), "projeto_teste", "doc2.txt")

    # 1 unidade (pasta do canal, não por vídeo) + 2 documentos = 3
    total = index_mod._contar_unidades_fonte("projeto_teste")
    assert total == 3


def test_parsear_todos_chunks_chama_progress_callback_ate_o_total(tmp_path, monkeypatch):
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))

    _criar_projeto_youtube(str(tmp_path), "projeto_teste", "canal_a", n_videos=2)
    _criar_documento(str(tmp_path), "projeto_teste", "doc1.txt")

    chamadas = []
    index_mod._parsear_todos_chunks("projeto_teste", progress_callback=lambda p, t: chamadas.append((p, t)))

    assert len(chamadas) == 2  # 1 pasta de canal + 1 documento
    # progresso é monotonicamente crescente e termina no total
    assert chamadas[-1][0] == chamadas[-1][1]
    for i in range(1, len(chamadas)):
        assert chamadas[i][0] >= chamadas[i - 1][0]


def test_parsear_todos_chunks_sem_callback_nao_quebra(tmp_path, monkeypatch):
    """progress_callback é opcional — comportamento padrão preservado."""
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))

    _criar_projeto_youtube(str(tmp_path), "projeto_teste", "canal_a", n_videos=2)
    chunks = index_mod._parsear_todos_chunks("projeto_teste")
    assert len(chunks) == 2  # 2 vídeos, 1 chunk cada


def test_parsear_todos_chunks_com_callback_retorna_mesmos_chunks_que_sem(tmp_path, monkeypatch):
    """Regressão crítica: adicionar progress_callback não pode alterar os
    chunks retornados — schema é consumido diretamente por chat.py."""
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))

    _criar_projeto_youtube(str(tmp_path), "projeto_teste", "canal_a", n_videos=2)
    _criar_documento(str(tmp_path), "projeto_teste", "doc1.txt")

    sem_callback = index_mod._parsear_todos_chunks("projeto_teste")
    com_callback = index_mod._parsear_todos_chunks("projeto_teste", progress_callback=lambda p, t: None)

    assert sem_callback == com_callback


def test_progress_callback_com_arquivo_curto_ainda_conta(tmp_path, monkeypatch):
    """Arquivo com conteúdo < 80 chars é pulado (não vira chunk), mas o
    progresso ainda avança — senão a barra trava sem terminar."""
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))

    _criar_documento(str(tmp_path), "projeto_teste", "curto.txt", texto="muito curto")
    _criar_documento(str(tmp_path), "projeto_teste", "longo.txt")

    chamadas = []
    chunks = index_mod._parsear_todos_chunks("projeto_teste", progress_callback=lambda p, t: chamadas.append((p, t)))

    assert len(chamadas) == 2
    assert chamadas[-1] == (2, 2)
    assert len(chunks) == 1  # só o arquivo longo virou chunk
