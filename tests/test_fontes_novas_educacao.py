# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes das novas fontes públicas da área "educacao" (BDTD, OasisBR,
Wikilivros, Wikiversidade, ERIC) e do Wikisource (área "patrimonio"), mais
os conectores genéricos _vufind.py e _mediawiki.py. Sem chamada de rede
real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor.fontes import (
    _mediawiki, _vufind, bdtd, eric, oasisbr, wikilivros_pt, wikisource_pt,
    wikiversidade_pt,
)


def _resp_json(dados, content_type="application/json", status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.headers = {"Content-Type": content_type}
    resp.raise_for_status = MagicMock()
    resp.json.return_value = dados
    return resp


def _ler_docs(tmp_path, projeto):
    arquivos = sorted((tmp_path / projeto / "documents").glob("*.txt"))
    return [a.read_text(encoding="utf-8") for a in arquivos]


_RESUMO_PT = "Este estudo investiga práticas de alfabetização em escolas públicas do Nordeste brasileiro, com professores do 1º ano."
_TEXTO_WIKI = "Conteúdo didático de exemplo com texto corrido suficiente para o corpus. " * 6  # ~430 chars
_RESUMO_EN = "This study investigates literacy practices in public schools in Northeastern Brazil, with first-grade teachers."


# ─── FONTE_META ──────────────────────────────────────────────────────────────

def test_fonte_meta_areas():
    for modulo in (bdtd, oasisbr, wikilivros_pt, wikiversidade_pt, eric):
        assert modulo.FONTE_META["area"] == "educacao"
        assert modulo.FONTE_META["requer_auth"] is False
    assert wikisource_pt.FONTE_META["area"] == "patrimonio"
    ids = [m.FONTE_META["id"] for m in (bdtd, oasisbr, wikisource_pt, wikilivros_pt, wikiversidade_pt, eric)]
    assert len(ids) == len(set(ids))


# ─── VuFind (BDTD / OasisBR) ─────────────────────────────────────────────────

def test_vufind_junta_summary_em_lista_e_descarta_vazios(tmp_path, monkeypatch):
    monkeypatch.setattr(bdtd, "NEURAL_DIR", str(tmp_path))
    registros = {"records": [
        {"id": "A1", "title": "Sem resumo", "summary": [], "urls": []},
        {"id": "A2", "title": "Resumo eco do título", "summary": ["Alfabetização é ..."], "urls": []},
        {"id": "A3", "title": "Práticas de alfabetização", "summary": [_RESUMO_PT, _RESUMO_EN],
         "urls": [{"url": "https://repositorio.exemplo.br/handle/123", "desc": "x"}],
         "publicationDates": ["2019"],
         "authors": {"primary": {"Silva, Maria": []}, "secondary": [], "corporate": []}},
        {"id": "A4", "title": "Sem URL externa", "summary": [_RESUMO_EN], "urls": []},
    ]}

    with patch.object(bdtd.requests, "get", return_value=_resp_json(registros)) as mock_get:
        resultado = bdtd.buscar(query="alfabetização", max_resultados=5, projeto_nome="p_bdtd")

    assert resultado["total_salvos"] == 2
    assert resultado["total_encontrados"] == 2  # vazios descartados antes de salvar

    # Campos pedidos explicitamente (o padrão do VuFind não traz summary)
    params = mock_get.call_args.kwargs["params"]
    campos = [v for k, v in params if k == "field[]"]
    assert "summary" in campos and "urls" in campos
    assert ("lookfor", "alfabetização") in params
    assert mock_get.call_args.args[0] == "https://bdtd.ibict.br/vufind/api/v1/search"

    docs = _ler_docs(tmp_path, "p_bdtd")
    completo = next(d for d in docs if "Práticas de alfabetização" in d)
    assert _RESUMO_PT in completo and _RESUMO_EN in completo
    assert "Silva, Maria" in completo and "Ano: 2019" in completo
    assert "URL_ORIGEM: https://repositorio.exemplo.br/handle/123" in completo
    sem_url = next(d for d in docs if "Sem URL externa" in d)
    assert "URL_ORIGEM: https://bdtd.ibict.br/vufind/Record/A4" in sem_url


def test_vufind_deduplica_por_titulo_normalizado(tmp_path, monkeypatch):
    monkeypatch.setattr(oasisbr, "NEURAL_DIR", str(tmp_path))
    registros = {"records": [
        {"id": "B1", "title": "Alfabetização: um estudo de caso.", "summary": [_RESUMO_PT]},
        {"id": "B2", "title": "alfabetizacao - um estudo de caso", "summary": [_RESUMO_EN]},
        {"id": "B3", "title": "ALFABETIZAÇÃO, UM ESTUDO DE CASO", "summary": [_RESUMO_PT]},
        {"id": "B4", "title": "Outro trabalho", "summary": [_RESUMO_EN]},
    ]}

    with patch.object(oasisbr.requests, "get", return_value=_resp_json(registros)) as mock_get:
        resultado = oasisbr.buscar(query="alfabetização", max_resultados=10, projeto_nome="p_oasis")

    assert resultado["total_salvos"] == 2
    assert mock_get.call_args.kwargs["timeout"] == (10, 45)
    assert _vufind.normalizar_titulo("Alfabetização: um estudo de caso.") == "alfabetizacao um estudo de caso"


def test_vufind_prefere_duplicata_com_resumo_e_corta_no_maximo(tmp_path, monkeypatch):
    monkeypatch.setattr(bdtd, "NEURAL_DIR", str(tmp_path))
    registros = {"records": [
        {"id": "C1", "title": "Mesmo título", "summary": []},
        {"id": "C2", "title": "Mesmo Título!", "summary": [_RESUMO_PT]},
        {"id": "C3", "title": "Segundo", "summary": [_RESUMO_PT]},
        {"id": "C4", "title": "Terceiro", "summary": [_RESUMO_PT]},
    ]}
    with patch.object(bdtd.requests, "get", return_value=_resp_json(registros)) as mock_get:
        resultado = bdtd.buscar(query="x", max_resultados=2, projeto_nome="p_corte")

    assert resultado["total_salvos"] == 2
    assert ("limit", 6) in mock_get.call_args.kwargs["params"]  # sobrepedido 3x
    docs = _ler_docs(tmp_path, "p_corte")
    assert any("TITULO: Mesmo Título!" in d for d in docs)  # a duplicata COM resumo
    assert not any("Terceiro" in d for d in docs)


def test_vufind_resposta_html_falha_com_mensagem_clara(tmp_path, monkeypatch):
    monkeypatch.setattr(bdtd, "NEURAL_DIR", str(tmp_path))
    with patch.object(bdtd.requests, "get", return_value=_resp_json({}, content_type="text/html")):
        try:
            bdtd.buscar(query="x", max_resultados=3, projeto_nome="p_html")
            assert False, "deveria ter levantado"
        except RuntimeError as e:
            assert "em vez de JSON" in str(e)


# ─── MediaWiki (Wikisource / Wikilivros / Wikiversidade) ─────────────────────

def _busca_mw(*titulos):
    return _resp_json({"query": {"search": [{"title": t} for t in titulos]}})


def _extract_mw(titulo, texto):
    return _resp_json({"query": {"pages": {"1": {"title": titulo, "extract": texto}}}})


def test_mediawiki_fallback_parse_quando_extract_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(wikiversidade_pt, "NEURAL_DIR", str(tmp_path))
    respostas = [
        _busca_mw("Alfabetização", "Alfabetização/Métodos"),
        _extract_mw("Alfabetização", ""),  # índice de curso: extract vazio
        _resp_json({"parse": {"title": "Alfabetização", "text": {
            "*": "<div><p>Curso de <b>alfabetização</b> &amp; letramento.</p><ul><li>Lição 1</li></ul><p>" + _TEXTO_WIKI + "</p></div>"}}}),
        _extract_mw("Alfabetização/Métodos", "Método sintético e método analítico. " + _TEXTO_WIKI),
    ]
    with patch.object(_mediawiki.time, "sleep"), \
         patch.object(wikiversidade_pt.requests, "get", side_effect=respostas) as mock_get:
        resultado = wikiversidade_pt.buscar(query="alfabetização", max_resultados=2, projeto_nome="p_wv")

    assert resultado["total_salvos"] == 2
    chamadas = [c.kwargs["params"] for c in mock_get.call_args_list]
    assert chamadas[0]["list"] == "search" and chamadas[0]["srnamespace"] == 0
    # UM título por chamada de extract
    assert chamadas[1]["titles"] == "Alfabetização"
    assert chamadas[2]["action"] == "parse" and chamadas[2]["page"] == "Alfabetização"
    assert chamadas[3]["titles"] == "Alfabetização/Métodos"
    assert all(c.kwargs["headers"]["User-Agent"].startswith("TusabBot") for c in mock_get.call_args_list)

    docs = _ler_docs(tmp_path, "p_wv")
    indice = next(d for d in docs if "TITULO: Alfabetização\n" in d)
    assert "Curso de alfabetização & letramento." in indice and "Lição 1" in indice
    assert "<p>" not in indice
    assert "URL_ORIGEM: https://pt.wikiversity.org/wiki/Alfabetiza%C3%A7%C3%A3o" in indice


def test_mediawiki_limita_texto_em_60k(tmp_path, monkeypatch):
    monkeypatch.setattr(wikisource_pt, "NEURAL_DIR", str(tmp_path))
    enorme = ("Palavra " * 20_000).strip()  # ~160k chars
    respostas = [_busca_mw("Constituição de 1824"), _extract_mw("Constituição de 1824", enorme)]
    with patch.object(wikisource_pt.requests, "get", side_effect=respostas):
        resultado = wikisource_pt.buscar(query="constituição", max_resultados=1, projeto_nome="p_ws")

    assert resultado["total_salvos"] == 1
    conteudo = _ler_docs(tmp_path, "p_ws")[0]
    corpo = conteudo.split("-" * 70 + "\n", 1)[1]
    assert len(corpo) <= 60_000
    assert "Texto truncado" in corpo and "https://pt.wikisource.org/wiki/Constitui" in corpo


def test_mediawiki_pula_pagina_sem_texto_e_sem_resultados(tmp_path, monkeypatch):
    monkeypatch.setattr(wikilivros_pt, "NEURAL_DIR", str(tmp_path))
    respostas = [_busca_mw("Vazia"), _extract_mw("Vazia", ""), _resp_json({"parse": {"text": {"*": ""}}})]
    with patch.object(wikilivros_pt.requests, "get", side_effect=respostas):
        resultado = wikilivros_pt.buscar(query="x", max_resultados=1, projeto_nome="p_wl")
    assert resultado["total_salvos"] == 0 and resultado["total_encontrados"] == 1

    with patch.object(wikilivros_pt.requests, "get", return_value=_busca_mw()) as mock_get:
        resultado = wikilivros_pt.buscar(query="nada", max_resultados=1, projeto_nome="p_wl2")
    assert resultado["total_encontrados"] == 0 and mock_get.call_count == 1


def test_mediawiki_429_tenta_de_novo_uma_vez(tmp_path, monkeypatch):
    monkeypatch.setattr(wikilivros_pt, "NEURAL_DIR", str(tmp_path))
    limitado = _resp_json({}, content_type="text/plain", status=429)
    limitado.headers["Retry-After"] = "33"
    respostas = [limitado, _busca_mw("Cálculo"), _extract_mw("Cálculo", _TEXTO_WIKI)]
    with patch.object(_mediawiki.time, "sleep") as mock_sleep, \
         patch.object(wikilivros_pt.requests, "get", side_effect=respostas):
        resultado = wikilivros_pt.buscar(query="cálculo", max_resultados=1, projeto_nome="p_429")
    assert resultado["total_salvos"] == 1
    mock_sleep.assert_called_once_with(_mediawiki._ESPERA_MAX_429)  # Retry-After com teto


def test_mediawiki_extract_curto_tenta_parse_e_descarta_pagina_minima(tmp_path, monkeypatch):
    monkeypatch.setattr(wikiversidade_pt, "NEURAL_DIR", str(tmp_path))
    respostas = [
        _busca_mw("Portal curto", "Índice"),
        _extract_mw("Portal curto", "Resumo curto."),          # < 300 → tenta parse
        _resp_json({"parse": {"text": {"*": "<p>" + _TEXTO_WIKI + "</p>"}}}),  # parse mais longo vence
        _extract_mw("Índice", "Departamento:Matemática"),        # < 300 → tenta parse
        _resp_json({"parse": {"text": {"*": "<ul><li>Link</li></ul>"}}}),      # ainda < 150 → descarta
    ]
    with patch.object(_mediawiki.time, "sleep"),          patch.object(wikiversidade_pt.requests, "get", side_effect=respostas):
        resultado = wikiversidade_pt.buscar(query="x", max_resultados=2, projeto_nome="p_curto")
    assert resultado["total_salvos"] == 1
    assert _TEXTO_WIKI.strip()[:40] in _ler_docs(tmp_path, "p_curto")[0]


# ─── ERIC ────────────────────────────────────────────────────────────────────

def test_eric_monta_and_entre_palavras_e_filtros():
    assert eric.montar_consulta("reading instruction") == "reading AND instruction"
    assert eric.montar_consulta('"reading instruction"') == '"reading instruction"'
    assert eric.montar_consulta("phonics OR fluency") == "(phonics OR fluency)"
    assert eric.montar_consulta("reading", data_inicio="2015-01-01", data_fim="2020-12-31",
                                autor="Shanahan, Timothy") == \
        'reading AND author:"Shanahan, Timothy" AND publicationdateyear:[2015 TO 2020]'
    assert eric.montar_consulta("reading", data_inicio="2018") == "reading AND publicationdateyear:[2018 TO *]"


def test_eric_texto_com_linha_do_pdf(tmp_path, monkeypatch):
    monkeypatch.setattr(eric, "NEURAL_DIR", str(tmp_path))
    dados = {"response": {"numFound": 3, "docs": [
        {"id": "ED123456", "title": "Reading &amp; Writing Report", "description": "A report on &quot;reading&quot;.",
         "e_fulltextauth": 1, "publicationdateyear": 2021, "author": ["Doe, Jane"]},
        {"id": "EJ999", "title": "Journal Article", "description": "Peer-reviewed study.",
         "e_fulltextauth": 1, "url": "https://doi.org/10.1/x"},
        {"id": "ED000", "title": "Sem descrição", "description": ""},
    ]}}
    # ERIC responde text/plain mesmo com format=json
    with patch.object(eric.requests, "get", return_value=_resp_json(dados, content_type="text/plain;charset=utf-8")) as mock_get:
        resultado = eric.buscar(query="reading instruction", max_resultados=3, projeto_nome="p_eric")

    assert mock_get.call_args.kwargs["params"]["search"] == "reading AND instruction"
    assert mock_get.call_args.kwargs["params"]["rows"] == 3
    assert resultado["total_salvos"] == 2

    docs = _ler_docs(tmp_path, "p_eric")
    relatorio = next(d for d in docs if "ED123456" in d)
    assert "TITULO: Reading & Writing Report" in relatorio
    assert 'A report on "reading".' in relatorio
    assert "Texto integral (PDF): https://files.eric.ed.gov/fulltext/ED123456.pdf" in relatorio
    assert "URL_ORIGEM: https://eric.ed.gov/?id=ED123456" in relatorio
    artigo = next(d for d in docs if "EJ999" in d)
    assert "Texto integral (PDF)" not in artigo  # EJ não tem PDF no files.eric.ed.gov


def test_eric_resposta_nao_json(tmp_path, monkeypatch):
    monkeypatch.setattr(eric, "NEURAL_DIR", str(tmp_path))
    resp = _resp_json(None, content_type="text/html")
    resp.json.side_effect = ValueError("not json")
    with patch.object(eric.requests, "get", return_value=resp):
        try:
            eric.buscar(query="x", max_resultados=1, projeto_nome="p_eric2")
            assert False, "deveria ter levantado"
        except RuntimeError as e:
            assert "não é JSON" in str(e)


def test_area_educacao_registrada():
    from tusab_engine.motor import fontes as fontes_registry
    areas = fontes_registry.listar_fontes()
    assert "educacao" in areas
    assert areas["educacao"]["nome"] == "Educação, ensino e material didático"
    ids = {f["id"] for f in areas["educacao"]["fontes"]}
    assert ids == {"bdtd", "oasisbr", "capes_teses", "educapes", "wikilivros_pt", "wikiversidade_pt", "eric"}


def test_registro_tem_61_fontes_com_ids_unicos_e_areas_conhecidas():
    from tusab_engine.motor import fontes as fontes_registry
    ids = [m.FONTE_META["id"] for m in fontes_registry._MODULOS]
    assert len(ids) == len(set(ids)) == 64
    for m in fontes_registry._MODULOS:
        meta = m.FONTE_META
        assert meta["area"] in fontes_registry.AREAS_META, meta["id"]
        assert meta["requer_auth"] is False, meta["id"]
        assert meta["descricao"].strip() and meta["nome"].strip(), meta["id"]
