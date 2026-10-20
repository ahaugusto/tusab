# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes dos adaptadores internacionais adicionados em out/2026 — Banco
Mundial (WDS), NASA NTRS, OSTI.gov, USGS Publications Warehouse,
INSPIRE-HEP, HAL, Cleveland Museum of Art, Project Gutenberg e Federal
Register. Sem chamada de rede real — requests é mockado por URL.
"""
from unittest.mock import MagicMock, patch

import pytest

from tusab_engine.motor.fontes import (
    _base, cleveland_art, federal_register, gutenberg, hal, inspire_hep,
    nasa_ntrs, osti, usgs_pubs, worldbank_wds,
)


def _resp(json_data=None, texto=None, tipo="application/json", status=200):
    r = MagicMock()
    r.status_code = status
    r.headers = {"Content-Type": tipo}
    r.raise_for_status = MagicMock()
    if status >= 400:
        r.raise_for_status.side_effect = Exception(f"HTTP {status}")
    r.json.return_value = json_data
    if texto is not None:
        r.text = texto
        r.content = texto.encode("utf-8")
    return r


def _roteador(rotas):
    """fake de requests.get: devolve a resposta da 1ª rota cujo prefixo casa
    com a URL e registra cada chamada (url, params, headers)."""
    chamadas = []

    def fake_get(url, params=None, headers=None, timeout=None, **kw):
        chamadas.append({"url": url, "params": params, "headers": headers})
        for prefixo, resposta in rotas:
            if url.startswith(prefixo):
                return resposta
        raise AssertionError(f"URL inesperada: {url}")

    return fake_get, chamadas


def _txts(tmp_path, projeto):
    return [p.read_text(encoding="utf-8") for p in (tmp_path / projeto / "documents").glob("*.txt")]


@pytest.fixture(autouse=True)
def _sem_throttle(monkeypatch):
    monkeypatch.setattr(_base.time, "sleep", lambda s: None)


# ─── Banco Mundial (WDS) ─────────────────────────────────────────────────────

def test_wds_filtra_procurement_e_sem_abstract_e_baixa_texto_integral(tmp_path, monkeypatch):
    monkeypatch.setattr(worldbank_wds, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"documents": {
        "facets": {"docty": []},
        "D1": {"display_title": "Plano de aquisição", "docty": "Procurement Plan",
               "abstracts": {"cdata!": "Resumo de procurement que não deve entrar."}},
        "D2": {"display_title": "Sem resumo", "docty": "Project Information Document", "abstracts": {}},
        "D3": {"display_title": "Inflação no Brasil", "docty": "Working Paper", "lang": "Portuguese",
               "docdt": "2023-09-01T00:00:00Z", "abstracts": {"cdata!": "Resumo real do estudo."},
               "txturl": "http://documents.worldbank.org/curated/en/123/text/doc.txt",
               "url": "http://documents.worldbank.org/curated/en/123"},
    }})
    integral = _resp(texto="x" * 250_000, tipo="text/plain; charset=utf-8")
    fake_get, chamadas = _roteador([
        ("https://search.worldbank.org/", busca),
        ("https://documents.worldbank.org/", integral),
    ])

    with patch.object(worldbank_wds.requests, "get", side_effect=fake_get):
        resultado = worldbank_wds.buscar("inflação", 5, "proj_wds")

    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 1
    [conteudo] = _txts(tmp_path, "proj_wds")
    corpo = conteudo.split("-" * 70 + "\n", 1)[1]
    assert corpo.startswith("Resumo real do estudo.")  # abstract sempre primeiro
    assert "procurement" not in conteudo.lower()
    assert "Idioma: Portuguese" in conteudo
    assert "--- TEXTO INTEGRAL ---" in conteudo
    assert corpo.count("x") == worldbank_wds.LIMITE_TEXTO_INTEGRAL
    assert "URL_ORIGEM: https://documents.worldbank.org/curated/en/123" in conteudo
    # txturl http:// é pedido direto em https://
    assert any(c["url"].startswith("https://documents.worldbank.org/") for c in chamadas)


def test_wds_data_preenche_lado_ausente(tmp_path, monkeypatch):
    monkeypatch.setattr(worldbank_wds, "NEURAL_DIR", str(tmp_path))
    fake_get, chamadas = _roteador([("https://search.worldbank.org/", _resp({"documents": {}}))])

    with patch.object(worldbank_wds.requests, "get", side_effect=fake_get):
        resultado = worldbank_wds.buscar("inflation", 3, "proj_wds2", data_inicio="2015-01-01")

    assert resultado["total_salvos"] == 0
    params = chamadas[0]["params"]
    assert params["strdate"] == "2015-01-01"
    assert params["enddate"]  # strdate sozinho restringe ao ano — sempre manda os dois


def test_wds_resposta_html_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(worldbank_wds, "NEURAL_DIR", str(tmp_path))
    fake_get, _ = _roteador([("https://search.worldbank.org/", _resp(texto="<html>", tipo="text/html"))])

    with patch.object(worldbank_wds.requests, "get", side_effect=fake_get):
        with pytest.raises(RuntimeError, match="em vez de JSON"):
            worldbank_wds.buscar("inflation", 3, "proj_wds3")


# ─── NASA NTRS ───────────────────────────────────────────────────────────────

def test_ntrs_baixa_texto_integral_so_quando_disseminado(tmp_path, monkeypatch):
    monkeypatch.setattr(nasa_ntrs, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"results": [
        {"id": 1, "title": "Só metadado", "abstract": "Resumo A.", "disseminated": "METADATA_ONLY",
         "downloads": [{"links": {"fulltext": "/api/citations/1/downloads/1.txt"}}]},
        {"id": 2, "title": "Com documento", "abstract": "Resumo B.", "disseminated": "DOCUMENT_AND_METADATA",
         "downloads": [{"links": {"fulltext": "/api/citations/2/downloads/2.txt"}}]},
        {"id": 3, "title": "Sem abstract", "abstract": "", "disseminated": "DOCUMENT_AND_METADATA"},
    ]})
    fake_get, chamadas = _roteador([
        ("https://ntrs.nasa.gov/api/citations/search", busca),
        ("https://ntrs.nasa.gov/api/citations/2/downloads/2.txt", _resp(texto="Texto integral B.", tipo="text/plain")),
    ])

    with patch.object(nasa_ntrs.requests, "get", side_effect=fake_get):
        resultado = nasa_ntrs.buscar("climate change", 5, "proj_ntrs")

    assert resultado["total_salvos"] == 2
    downloads = [c["url"] for c in chamadas if "/downloads/" in c["url"]]
    assert downloads == ["https://ntrs.nasa.gov/api/citations/2/downloads/2.txt"]
    conteudos = _txts(tmp_path, "proj_ntrs")
    com_doc = next(c for c in conteudos if "Resumo B." in c)
    assert com_doc.index("Resumo B.") < com_doc.index("Texto integral B.")
    assert "URL_ORIGEM: https://ntrs.nasa.gov/citations/2" in com_doc
    assert not any("Sem abstract" in c for c in conteudos)


# ─── OSTI.gov ────────────────────────────────────────────────────────────────

def test_osti_pede_json_e_descarta_sem_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(osti, "NEURAL_DIR", str(tmp_path))
    busca = _resp([
        {"osti_id": "10", "title": "Grafeno", "description": "Descrição real.",
         "links": [{"rel": "fulltext", "href": "https://www.osti.gov/servlets/purl/10"},
                   {"rel": "citation", "href": "https://www.osti.gov/biblio/10"}]},
        {"osti_id": "11", "title": "Sem descrição", "description": ""},
    ])
    fake_get, chamadas = _roteador([("https://www.osti.gov/api/v1/records", busca)])

    with patch.object(osti.requests, "get", side_effect=fake_get):
        resultado = osti.buscar("graphene", 5, "proj_osti")

    assert resultado["total_salvos"] == 1
    assert chamadas[0]["headers"]["Accept"] == "application/json"
    assert "TusabBot" in chamadas[0]["headers"]["User-Agent"]
    [conteudo] = _txts(tmp_path, "proj_osti")
    assert "Descrição real." in conteudo
    assert "URL_ORIGEM: https://www.osti.gov/biblio/10" in conteudo


# ─── USGS Publications Warehouse ─────────────────────────────────────────────

def test_usgs_converte_abstract_html_e_descarta_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(usgs_pubs, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"records": [
        {"indexId": "sir20265060", "title": "Água subterrânea",
         "docAbstract": "<p><span>Estudo do aqu&iacute;fero.</span></p><p>Segundo par&aacute;grafo.</p>"},
        {"indexId": "x1", "title": "Sem resumo", "docAbstract": "<p> </p>"},
    ]})
    fake_get, _ = _roteador([("https://pubs.usgs.gov/pubs-services/publication/", busca)])

    with patch.object(usgs_pubs.requests, "get", side_effect=fake_get):
        resultado = usgs_pubs.buscar("groundwater", 5, "proj_usgs")

    assert resultado["total_salvos"] == 1
    [conteudo] = _txts(tmp_path, "proj_usgs")
    assert "Estudo do aquífero.\nSegundo parágrafo." in conteudo
    assert "<p>" not in conteudo
    assert "URL_ORIGEM: https://pubs.usgs.gov/publication/sir20265060" in conteudo


# ─── INSPIRE-HEP ─────────────────────────────────────────────────────────────

def test_inspire_inclui_link_arxiv_e_descarta_sem_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(inspire_hep, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"hits": {"hits": [
        {"metadata": {"control_number": 1327351, "titles": [{"title": "Dirac Fermions"}],
                      "abstracts": [{"value": "Resumo de física."}],
                      "arxiv_eprints": [{"value": "1306.4804"}]}},
        {"metadata": {"control_number": 2, "titles": [{"title": "Sem abstract"}]}},
    ]}})
    fake_get, chamadas = _roteador([("https://inspirehep.net/api/literature", busca)])

    with patch.object(inspire_hep.requests, "get", side_effect=fake_get):
        resultado = inspire_hep.buscar("dark matter detection", 5, "proj_inspire")

    assert resultado["total_salvos"] == 1
    assert chamadas[0]["params"]["q"] == "dark matter detection"  # texto livre, sem SPIRES
    [conteudo] = _txts(tmp_path, "proj_inspire")
    assert "Resumo de física." in conteudo
    assert "arXiv: https://arxiv.org/abs/1306.4804" in conteudo
    assert "URL_ORIGEM: https://inspirehep.net/literature/1327351" in conteudo


# ─── HAL ─────────────────────────────────────────────────────────────────────

def test_hal_campos_em_lista_e_linha_do_pdf(tmp_path, monkeypatch):
    monkeypatch.setattr(hal, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"response": {"numFound": 2, "docs": [
        {"title_s": ["Énergie éolienne"], "abstract_s": ["Résumé réel."], "language_s": ["fr"],
         "uri_s": "https://hal.science/hal-1v1", "fileMain_s": "https://hal.science/hal-1/document",
         "producedDateY_i": 2021},
        {"title_s": ["Sem resumo"], "uri_s": "https://hal.science/hal-2v1"},
    ]}})
    fake_get, chamadas = _roteador([("https://api.archives-ouvertes.fr/search/", busca)])

    with patch.object(hal.requests, "get", side_effect=fake_get):
        resultado = hal.buscar("renewable energy", 5, "proj_hal")

    assert resultado["total_salvos"] == 1
    assert chamadas[0]["params"]["fq"] == "submitType_s:file"
    [conteudo] = _txts(tmp_path, "proj_hal")
    assert "TITULO: Énergie éolienne" in conteudo
    assert "Résumé réel." in conteudo
    assert "PDF: https://hal.science/hal-1/document" in conteudo
    assert "URL_ORIGEM: https://hal.science/hal-1v1" in conteudo


# ─── Cleveland Museum of Art ─────────────────────────────────────────────────

def test_cleveland_descricao_com_contexto_e_descarta_sem_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(cleveland_art, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"info": {"total": 2}, "data": [
        {"title": "River Goddess Ganga", "description": "Texto curatorial real.",
         "tombstone": "River Goddess Ganga, c. 700. Sandstone.", "culture": ["Northern India"],
         "technique": "sandstone", "url": "https://clevelandart.org/art/1966.119"},
        {"title": "Sem descrição", "description": None, "url": "https://clevelandart.org/art/x"},
    ]})
    fake_get, _ = _roteador([("https://openaccess-api.clevelandart.org/api/artworks/", busca)])

    with patch.object(cleveland_art.requests, "get", side_effect=fake_get):
        resultado = cleveland_art.buscar("river", 5, "proj_cma")

    assert resultado["total_salvos"] == 1
    [conteudo] = _txts(tmp_path, "proj_cma")
    corpo = conteudo.split("-" * 70 + "\n", 1)[1]
    assert corpo.startswith("Texto curatorial real.")
    assert "Cultura: Northern India" in conteudo
    assert "Técnica: sandstone" in conteudo
    assert "URL_ORIGEM: https://clevelandart.org/art/1966.119" in conteudo


# ─── Project Gutenberg ───────────────────────────────────────────────────────

_OPDS = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<link rel="next" href="/ebooks/search.opds/?query=economics&amp;start_index=26"/>
<entry><id>https://www.gutenberg.org/ebooks/authors/search.opds/?query=economics</id>
<title>Authors</title><content type="text">9 author names match your search.</content></entry>
<entry><id>https://www.gutenberg.org/ebooks/subjects/search.opds/?query=economics</id>
<title>Subjects</title><content type="text">137 subject headings match your search.</content></entry>
<entry><id>https://www.gutenberg.org/ebooks/3300.opds</id>
<title>The Wealth of Nations</title><content type="text">Adam Smith</content></entry>
<entry><id>https://www.gutenberg.org/ebooks/13701.opds</id>
<title>Volume 07
</title><content type="text">5464 downloads</content></entry>
<entry><id>https://www.gutenberg.org/ebooks/999.opds</id>
<title>Sem txt</title><content type="text">Alguém</content></entry>
</feed>"""

_LIVRO = (
    "The Project Gutenberg eBook of The Wealth of Nations\r\n"
    "This eBook is for the use of anyone anywhere...\r\n"
    "*** START OF THE PROJECT GUTENBERG EBOOK THE WEALTH OF NATIONS ***\r\n"
    "\r\nBOOK I. Of the causes of improvement.\r\nCorpo real do livro.\r\n\r\n"
    "*** END OF THE PROJECT GUTENBERG EBOOK THE WEALTH OF NATIONS ***\r\n"
    "Updated editions will replace the previous one... Project Gutenberg License\r\n"
)


def test_gutenberg_remover_licenca_corta_cabecalho_e_rodape():
    corpo = gutenberg.remover_licenca_gutenberg(_LIVRO)
    assert corpo.startswith("BOOK I. Of the causes of improvement.")
    assert corpo.endswith("Corpo real do livro.")
    assert "Project Gutenberg" not in corpo
    # livros antigos usam "THIS" no marcador
    antigo = "lixo\n*** START OF THIS PROJECT GUTENBERG EBOOK X ***\nmiolo\n*** END OF THIS PROJECT GUTENBERG EBOOK X ***\nlicença"
    assert gutenberg.remover_licenca_gutenberg(antigo) == "miolo"


def test_gutenberg_filtra_navegacao_e_pula_livro_sem_txt(tmp_path, monkeypatch):
    monkeypatch.setattr(gutenberg, "NEURAL_DIR", str(tmp_path))
    fake_get, chamadas = _roteador([
        ("https://www.gutenberg.org/ebooks/search.opds/", _resp(texto=_OPDS, tipo="application/atom+xml; charset=UTF-8")),
        ("https://www.gutenberg.org/cache/epub/3300/", _resp(texto=_LIVRO, tipo="text/plain; charset=utf-8")),
        ("https://www.gutenberg.org/cache/epub/13701/", _resp(texto="sem marcadores " * 20_000, tipo="text/plain")),
        ("https://www.gutenberg.org/cache/epub/999/", _resp(texto="", tipo="text/html", status=404)),
    ])

    with patch.object(gutenberg.requests, "get", side_effect=fake_get):
        resultado = gutenberg.buscar("economics", 50, "proj_gut")

    assert resultado["total_encontrados"] == 3  # só entradas /ebooks/{n}.opds
    assert resultado["total_salvos"] == 2       # 999 sem .txt (404) é pulado
    assert resultado["erros"] == []
    conteudos = _txts(tmp_path, "proj_gut")
    smith = next(c for c in conteudos if "TITULO: The Wealth of Nations" in c)
    assert "Autor: Adam Smith" in smith
    assert "Corpo real do livro." in smith
    assert "License" not in smith and "START OF THE PROJECT" not in smith
    assert "URL_ORIGEM: https://www.gutenberg.org/ebooks/3300" in smith
    volume = next(c for c in conteudos if "TITULO: Volume 07" in c)
    assert "downloads" not in volume.split("-" * 70 + "\n", 1)[1][:50]  # "5464 downloads" não vira autor
    assert len(volume.split("-" * 70 + "\n", 1)[1]) == gutenberg.LIMITE_TEXTO_INTEGRAL


def test_gutenberg_limita_a_10_livros(tmp_path, monkeypatch):
    monkeypatch.setattr(gutenberg, "NEURAL_DIR", str(tmp_path))
    entradas = "".join(
        f"<entry><id>https://www.gutenberg.org/ebooks/{i}.opds</id><title>Livro {i}</title></entry>"
        for i in range(1, 16)
    )
    feed = f'<feed xmlns="http://www.w3.org/2005/Atom">{entradas}</feed>'
    fake_get, _ = _roteador([
        ("https://www.gutenberg.org/ebooks/search.opds/", _resp(texto=feed, tipo="application/atom+xml")),
        ("https://www.gutenberg.org/cache/epub/", _resp(texto="miolo", tipo="text/plain")),
    ])

    with patch.object(gutenberg.requests, "get", side_effect=fake_get):
        resultado = gutenberg.buscar("x", 50, "proj_gut2")

    assert resultado["total_encontrados"] == gutenberg.MAX_LIVROS_POR_BUSCA == 10


# ─── Federal Register ────────────────────────────────────────────────────────

def test_federal_register_url_html_govinfo():
    assert federal_register.url_html_govinfo(
        "https://www.govinfo.gov/content/pkg/FR-2026-05-20/pdf/2026-10064.pdf"
    ) == "https://www.govinfo.gov/content/pkg/FR-2026-05-20/html/2026-10064.htm"
    assert federal_register.url_html_govinfo("https://example.com/x.pdf") == ""
    assert federal_register.url_html_govinfo(None) == ""


def test_federal_register_texto_integral_govinfo_e_fallbacks(tmp_path, monkeypatch):
    monkeypatch.setattr(federal_register, "NEURAL_DIR", str(tmp_path))
    busca = _resp({"results": [
        {"title": "Regra com HTML", "abstract": "Resumo oficial A.", "type": "Rule",
         "publication_date": "2026-05-20", "html_url": "https://www.federalregister.gov/documents/a",
         "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2026-05-20/pdf/2026-1.pdf"},
        {"title": "GovInfo fora do ar", "abstract": "Resumo oficial B.",
         "html_url": "https://www.federalregister.gov/documents/b",
         "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2026-05-21/pdf/2026-2.pdf"},
        {"title": "Sem nada", "abstract": None, "html_url": "https://www.federalregister.gov/documents/c",
         "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2026-05-22/pdf/2026-3.pdf"},
    ]})
    html = "<html><body><pre>[Federal Register]\nDEPARTMENT OF ENERGY\n&sect; 451.1 Texto da regra.</pre></body></html>"
    fake_get, chamadas = _roteador([
        ("https://www.federalregister.gov/api/v1/documents.json", busca),
        ("https://www.govinfo.gov/content/pkg/FR-2026-05-20/html/2026-1.htm", _resp(texto=html, tipo="text/html")),
        ("https://www.govinfo.gov/content/pkg/FR-2026-05-21/html/", _resp(texto="", tipo="text/html", status=503)),
        ("https://www.govinfo.gov/content/pkg/FR-2026-05-22/html/", _resp(texto="", tipo="text/html", status=404)),
    ])

    with patch.object(federal_register.requests, "get", side_effect=fake_get):
        resultado = federal_register.buscar("renewable energy", 5, "proj_fr", data_inicio="2026-01-01")

    assert resultado["total_salvos"] == 2
    assert ("conditions[publication_date][gte]", "2026-01-01") in chamadas[0]["params"]
    conteudos = _txts(tmp_path, "proj_fr")
    a = next(c for c in conteudos if "Regra com HTML" in c)
    corpo_a = a.split("-" * 70 + "\n", 1)[1]
    assert corpo_a.startswith("Resumo oficial A.")
    assert "--- TEXTO INTEGRAL ---" in a and "§ 451.1 Texto da regra." in a
    b = next(c for c in conteudos if "GovInfo fora do ar" in c)
    assert "Resumo oficial B." in b and "TEXTO INTEGRAL" not in b
    assert not any("Sem nada" in c for c in conteudos)
