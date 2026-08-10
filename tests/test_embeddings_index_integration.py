# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de integração entre embeddings.py e o cache incremental de index.py —
foco no backfill dirigido (Decisão B do plano): arquivo com chunk-hit (mtime
igual) mas sem 'embeddings' cacheado ainda deve gerar o vetor sem reprocessar
KeyBERT/parsing, e nunca mais recalcular depois disso.

Sem chamada de rede real — tusab_engine.agent.embeddings.gerar_embeddings_lote/
modelo_disponivel são mockados em todos os testes.
"""
import os
import threading
from unittest.mock import MagicMock, patch

from tusab_engine.agent import index as index_mod
from tusab_engine.agent import embeddings as embeddings_mod


def _criar_projeto_youtube(base_dir, prefixo, canal, n_videos=2):
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


def _fake_lote(textos, **_kw):
    return [[0.1] * embeddings_mod.EMBED_DIM for _ in textos]


def _isolar_paths(monkeypatch, tmp_path):
    monkeypatch.setattr(index_mod, "NEURAL_DIR", str(tmp_path / "neural"))
    monkeypatch.setattr(index_mod, "TXT_DIR", str(tmp_path / "nao_existe_legado"))
    monkeypatch.setattr(index_mod, "DOC_DIR", str(tmp_path / "nao_existe_doc_legado"))
    monkeypatch.setattr(index_mod, "TEXT_DIR", str(tmp_path / "nao_existe_texto_legado"))
    idx_dir = str(tmp_path / "idx")
    # _parsear_todos_chunks() chamado direto (sem indexar()) nunca cria o
    # INDEX_DIR — só indexar() faz isso hoje (os.makedirs antes de salvar o
    # índice principal). _salvar_cache_chunks() engole silenciosamente o erro
    # de diretório ausente (cache é otimização, não pode quebrar indexação),
    # então sem criar o dir aqui o cache nunca persistiria entre as chamadas.
    os.makedirs(idx_dir, exist_ok=True)
    monkeypatch.setattr(index_mod, "INDEX_DIR", idx_dir)
    monkeypatch.setattr(embeddings_mod, "INDEX_DIR", idx_dir)


# ─── _parsear_todos_chunks(embeddings_out=...) ──────────────────────────────

def test_embeddings_out_preenchido_na_mesma_ordem_e_tamanho_dos_chunks(tmp_path, monkeypatch):
    _isolar_paths(monkeypatch, tmp_path)
    _criar_projeto_youtube(str(tmp_path / "neural"), "projeto_ord", "canal_a", n_videos=3)

    with patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote):
        embeddings_out = []
        chunks = index_mod._parsear_todos_chunks("projeto_ord", embeddings_out=embeddings_out)

    assert len(chunks) == 3
    assert len(embeddings_out) == 3
    assert all(v == [0.1] * embeddings_mod.EMBED_DIM for v in embeddings_out)


def test_embeddings_out_none_quando_nao_solicitado(tmp_path, monkeypatch):
    """Sem embeddings_out, nenhuma chamada a Ollama acontece — zero overhead
    quando o modelo não está disponível (comportamento padrão hoje)."""
    _isolar_paths(monkeypatch, tmp_path)
    _criar_projeto_youtube(str(tmp_path / "neural"), "projeto_sem_emb", "canal_a", n_videos=2)

    with patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote) as mock_gerar:
        chunks = index_mod._parsear_todos_chunks("projeto_sem_emb")

    assert len(chunks) == 2
    mock_gerar.assert_not_called()


# ─── Backfill dirigido (Decisão B) ───────────────────────────────────────────

def test_reindexar_sem_tocar_arquivos_nao_regera_embeddings_ja_cacheados(tmp_path, monkeypatch):
    _isolar_paths(monkeypatch, tmp_path)
    _criar_projeto_youtube(str(tmp_path / "neural"), "projeto_cache", "canal_a", n_videos=2)

    with patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote) as mock_gerar:
        index_mod._parsear_todos_chunks("projeto_cache", embeddings_out=[])
        assert mock_gerar.call_count == 2  # 2 arquivos, 1 chamada em lote cada

        mock_gerar.reset_mock()
        # 2ª rodada, nenhum arquivo tocado — cache já tem 'embeddings' alinhado
        embeddings_out_2 = []
        chunks_2 = index_mod._parsear_todos_chunks("projeto_cache", embeddings_out=embeddings_out_2)

    assert mock_gerar.call_count == 0
    assert len(embeddings_out_2) == len(chunks_2) == 2


def test_backfill_dirigido_preenche_lacuna_sem_reprocessar_keybert(tmp_path, monkeypatch):
    """Simula o estado de uma base indexada ANTES desta feature existir: cache
    de chunks populado, mas sem a chave 'embeddings'. A próxima indexação deve
    preencher só a lacuna (chamar o Ollama), sem reprocessar KeyBERT/parsing
    daquele arquivo (cache-hit de chunk continua valendo)."""
    _isolar_paths(monkeypatch, tmp_path)
    _criar_projeto_youtube(str(tmp_path / "neural"), "projeto_backfill", "canal_a", n_videos=2)

    # 1ª rodada: SEM embeddings_out — popula o cache de chunks, sem chave 'embeddings'
    # (mesmo estado que uma base indexada antes desta feature existir).
    chunks_v1 = index_mod._parsear_todos_chunks("projeto_backfill")
    assert len(chunks_v1) == 2

    keybert_mock = MagicMock(side_effect=lambda textos: list(textos))
    monkeypatch.setattr(index_mod, "_enriquecer_com_keywords_lote", keybert_mock)

    with patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote) as mock_gerar:
        embeddings_out = []
        chunks_v2 = index_mod._parsear_todos_chunks("projeto_backfill", embeddings_out=embeddings_out)

    assert chunks_v2 == chunks_v1  # backfill nunca altera os chunks retornados
    assert len(embeddings_out) == len(chunks_v2) == 2
    assert mock_gerar.call_count == 2  # 1 chamada por arquivo, backfill dirigido
    keybert_mock.assert_not_called()  # cache-hit de chunk não reprocessa KeyBERT


# ─── indexar() fim-a-fim ─────────────────────────────────────────────────────

def test_indexar_completo_com_ollama_mockado_gera_npy_alinhado():
    from tusab_engine.storage import NEURAL_DIR

    prefixo = "projeto_embeddings_e2e_teste"
    youtube_dir = os.path.join(NEURAL_DIR, prefixo, "youtube", "canal_x")
    os.makedirs(youtube_dir, exist_ok=True)
    for i in range(2):
        conteudo = (
            f"TITULO: Video embeddings {i}\n"
            "ABA: youtube\nDATA: 01/01/2026\nLINK: https://youtube.com/watch?v=emb\n"
            "TAGS: teste\nVIDEO_ID: emb\nVIEWS: 1\nTIMESTAMP_INICIO: 0\n"
            + "-" * 60 + "\n"
            + ("Conteúdo de embeddings de teste. " * 15)
        )
        with open(os.path.join(youtube_dir, f"canal_x_video{i}.txt"), "w", encoding="utf-8") as f:
            f.write(conteudo)

    with patch.object(embeddings_mod, "modelo_disponivel", return_value=True), \
         patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote):
        n = index_mod.indexar(prefixo, prefixo)

    matriz = embeddings_mod.carregar_matriz(prefixo, n_chunks_esperado=n)
    assert matriz is not None
    assert matriz.shape == (n, embeddings_mod.EMBED_DIM)


def test_indexar_sem_modelo_disponivel_nao_gera_npy_nem_quebra():
    from tusab_engine.storage import NEURAL_DIR

    prefixo = "projeto_embeddings_sem_modelo_teste"
    youtube_dir = os.path.join(NEURAL_DIR, prefixo, "youtube", "canal_y")
    os.makedirs(youtube_dir, exist_ok=True)
    conteudo = (
        "TITULO: Video sem modelo\n"
        "ABA: youtube\nDATA: 01/01/2026\nLINK: https://youtube.com/watch?v=xx\n"
        "TAGS: teste\nVIDEO_ID: xx\nVIEWS: 1\nTIMESTAMP_INICIO: 0\n"
        + "-" * 60 + "\n"
        + ("Conteúdo sem modelo de teste. " * 15)
    )
    with open(os.path.join(youtube_dir, "canal_y_video0.txt"), "w", encoding="utf-8") as f:
        f.write(conteudo)

    with patch.object(embeddings_mod, "modelo_disponivel", return_value=False):
        n = index_mod.indexar(prefixo, prefixo)

    assert n >= 1
    assert not embeddings_mod.embeddings_existe(prefixo)


# ─── Regressão: falha total do Ollama não pode envenenar o cache pra sempre ──

def test_backfill_retenta_apos_falha_total_do_ollama(tmp_path, monkeypatch):
    """Regressão: uma entrada de cache com embeddings=[None,...] (falha total
    numa indexação anterior) não pode ser tratada como 'já processada' — senão
    o arquivo nunca mais ganharia embedding, mesmo com o Ollama de volta,
    até o mtime mudar de novo. Ver _obter_embeddings_cache em index.py."""
    _isolar_paths(monkeypatch, tmp_path)
    _criar_projeto_youtube(str(tmp_path / "neural"), "projeto_retry", "canal_a", n_videos=1)

    with patch.object(embeddings_mod, "gerar_embeddings_lote", return_value=None):
        embeddings_out_1 = []
        chunks_1 = index_mod._parsear_todos_chunks("projeto_retry", embeddings_out=embeddings_out_1)
    assert embeddings_out_1 == [None]

    with patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote) as mock_gerar:
        embeddings_out_2 = []
        chunks_2 = index_mod._parsear_todos_chunks("projeto_retry", embeddings_out=embeddings_out_2)

    assert chunks_2 == chunks_1
    assert mock_gerar.call_count == 1  # reprocessou o arquivo, não aceitou o [None] cacheado
    assert embeddings_out_2 == [[0.1] * embeddings_mod.EMBED_DIM]


# ─── GET /agent/status expõe embeddings_disponivel via API real ─────────────

def test_get_agent_status_expoe_embeddings_disponivel_via_api(client):
    from tusab_engine.storage import NEURAL_DIR

    prefixo = "projeto_status_embeddings_teste"
    youtube_dir = os.path.join(NEURAL_DIR, prefixo, "youtube", "canal_z")
    os.makedirs(youtube_dir, exist_ok=True)
    conteudo = (
        "TITULO: Video status embeddings\n"
        "ABA: youtube\nDATA: 01/01/2026\nLINK: https://youtube.com/watch?v=st\n"
        "TAGS: teste\nVIDEO_ID: st\nVIEWS: 1\nTIMESTAMP_INICIO: 0\n"
        + "-" * 60 + "\n"
        + ("Conteúdo de status de embeddings de teste. " * 15)
    )
    with open(os.path.join(youtube_dir, "canal_z_video0.txt"), "w", encoding="utf-8") as f:
        f.write(conteudo)

    with patch.object(embeddings_mod, "modelo_disponivel", return_value=True), \
         patch.object(embeddings_mod, "gerar_embeddings_lote", side_effect=_fake_lote):
        index_mod.indexar(prefixo, prefixo)

    r = client.get("/agent/status")
    assert r.status_code == 200
    canais = r.json()["canais_indexados"]
    entrada = next(c for c in canais if c["nome"] == prefixo)
    assert entrada["embeddings_disponivel"] is True


# ─── Concorrência: leitura da matriz durante escrita não corrompe/quebra ─────

def test_concorrencia_leitura_e_escrita_da_matriz_sem_corrupcao(tmp_path, monkeypatch):
    monkeypatch.setattr(embeddings_mod, "INDEX_DIR", str(tmp_path), raising=False)
    dim = embeddings_mod.EMBED_DIM
    embeddings_mod.salvar_matriz("projeto_concorrencia", [[0.1] * dim, [0.2] * dim])
    embeddings_mod._matriz_cache.clear()

    erros = []

    def escritor():
        for i in range(20):
            try:
                embeddings_mod.salvar_matriz("projeto_concorrencia", [[float(i)] * dim, [float(i + 1)] * dim])
            except Exception as e:
                erros.append(e)

    def leitor():
        for _ in range(40):
            try:
                m = embeddings_mod.carregar_matriz("projeto_concorrencia", n_chunks_esperado=2)
                if m is not None:
                    assert m.shape == (2, dim)  # nunca lê shape parcial/corrompido
            except Exception as e:
                erros.append(e)

    threads = [threading.Thread(target=escritor)] + [threading.Thread(target=leitor) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not erros
