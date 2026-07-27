# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do registro genérico de fontes públicas (perfil Pesquisador) e dos
adaptadores da área "Produção científica e literatura" — OpenAlex, Europe PMC,
DataCite, DOAJ, Zenodo (arXiv já coberto em test_arxiv.py; o adapter aqui só
testa a ponte de eventos, não repete os testes do módulo).

Sem chamada de rede real — requests é mockado em todos os testes de módulo.
"""
import json
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import arxiv_adapter, datacite, doaj, europepmc, openalex, zenodo


# ─── Registro ────────────────────────────────────────────────────────────────

def test_listar_fontes_agrupa_por_area():
    areas = fontes_registry.listar_fontes()
    assert "cientifica" in areas
    ids = {f["id"] for f in areas["cientifica"]["fontes"]}
    assert ids == {"arxiv", "openalex", "europepmc", "datacite", "doaj", "zenodo"}


def test_obter_fonte_existente_e_inexistente():
    assert fontes_registry.obter_fonte("openalex") is openalex
    assert fontes_registry.obter_fonte("fonte_que_nao_existe") is None


def test_toda_fonte_registrada_tem_meta_completo():
    for fonte_id, modulo in fontes_registry.FONTES.items():
        meta = modulo.FONTE_META
        assert meta["id"] == fonte_id
        assert meta["area"] in fontes_registry.AREAS_META
        assert isinstance(meta["requer_auth"], bool)
        assert callable(modulo.buscar)


# ─── Endpoints genéricos ────────────────────────────────────────────────────

def test_get_fontes_retorna_areas(client):
    r = client.get("/fontes")
    assert r.status_code == 200
    body = r.json()
    assert "cientifica" in body["areas"]


def test_fonte_search_rejeita_fonte_desconhecida(client):
    r = client.post("/fontes/inexistente/search", json={"query": "hiv", "projeto_nome": "qualquer"})
    assert r.status_code == 200
    assert r.json().get("error") is True


def test_fonte_search_rejeita_sem_projeto(client):
    r = client.post("/fontes/openalex/search", json={"query": "hiv", "projeto_nome": "projeto_inexistente_xyz"})
    assert r.status_code == 200
    assert r.json().get("error") is True


def test_fonte_search_rejeita_query_curta(client):
    r = client.post("/fontes/openalex/search", json={"query": "a", "projeto_nome": "qualquer"})
    assert r.status_code == 422


def test_fonte_status_retorna_estrutura_para_fonte_nunca_usada(client):
    r = client.get("/fontes/doaj/status")
    assert r.status_code == 200
    body = r.json()
    assert "running" in body
    assert "status" in body


def test_fonte_cancel_sem_busca_em_andamento(client):
    r = client.post("/fontes/zenodo/cancel")
    assert r.status_code == 200
    assert "Nenhuma busca" in r.json()["message"]


# ─── OpenAlex ────────────────────────────────────────────────────────────────

_OPENALEX_MOCK = {
    "results": [
        {
            "id": "https://openalex.org/W123",
            "title": "Attention Is All You Need Again",
            "abstract_inverted_index": {"A": [0], "study": [1], "on": [2], "attention": [3]},
        },
        {
            "id": "https://openalex.org/W456",
            "title": "Paper sem abstract",
            "abstract_inverted_index": None,
        },
    ]
}


def test_openalex_reconstroi_abstract_e_pula_sem_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(openalex, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = _OPENALEX_MOCK

    with patch.object(openalex.requests, "get", return_value=mock_resp):
        resultado = openalex.buscar(query="attention", max_resultados=5, projeto_nome="projeto_openalex")

    assert resultado["total_encontrados"] == 2
    assert resultado["total_salvos"] == 1  # o segundo item (sem abstract) foi pulado, não é erro
    assert resultado["erros"] == []

    txt_files = list((tmp_path / "projeto_openalex" / "documents").glob("*.txt"))
    assert len(txt_files) == 1
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "A study on attention" in conteudo
    assert "FONTE: openalex" in conteudo


def test_openalex_inclui_filtro_autor_e_data_na_query(tmp_path, monkeypatch):
    monkeypatch.setattr(openalex, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"results": []}

    with patch.object(openalex.requests, "get", return_value=mock_resp) as mock_get:
        openalex.buscar(
            query="attention", max_resultados=5, projeto_nome="projeto_openalex2",
            autor="Vaswani", data_inicio="2024-01-01", data_fim="2024-06-30",
        )

    filtro = mock_get.call_args.kwargs["params"]["filter"]
    assert "fulltext.search:attention" in filtro
    assert "authorships.author.display_name.search:Vaswani" in filtro
    assert "from_publication_date:2024-01-01" in filtro
    assert "to_publication_date:2024-06-30" in filtro


# ─── Europe PMC ──────────────────────────────────────────────────────────────

def test_europepmc_extrai_abstract_e_pula_sem_texto(tmp_path, monkeypatch):
    monkeypatch.setattr(europepmc, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "resultList": {"result": [
            {"title": "HIV Stigma Study", "abstractText": "Texto real do abstract.", "doi": "10.1/xyz"},
            {"title": "Sem abstract", "abstractText": ""},
        ]}
    }

    with patch.object(europepmc.requests, "get", return_value=mock_resp):
        resultado = europepmc.buscar(query="hiv stigma", max_resultados=5, projeto_nome="projeto_epmc")

    assert resultado["total_encontrados"] == 2
    assert resultado["total_salvos"] == 1

    txt_files = list((tmp_path / "projeto_epmc" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Texto real do abstract." in conteudo
    assert "FONTE: europepmc" in conteudo


# ─── DataCite ────────────────────────────────────────────────────────────────

def test_datacite_prioriza_descricao_tipo_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(datacite, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "data": [{
            "attributes": {
                "titles": [{"title": "Dataset de Teste"}],
                "descriptions": [
                    {"descriptionType": "Other", "description": "Nota irrelevante"},
                    {"descriptionType": "Abstract", "description": "Resumo real do dataset."},
                ],
                "url": "https://doi.org/10.1/abc",
            }
        }]
    }

    with patch.object(datacite.requests, "get", return_value=mock_resp):
        resultado = datacite.buscar(query="hiv", max_resultados=5, projeto_nome="projeto_datacite")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_datacite" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Resumo real do dataset." in conteudo
    assert "Nota irrelevante" not in conteudo


def test_datacite_pula_registro_sem_nenhuma_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(datacite, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"data": [{"attributes": {"titles": [{"title": "Sem descrição"}], "descriptions": []}}]}

    with patch.object(datacite.requests, "get", return_value=mock_resp):
        resultado = datacite.buscar(query="hiv", max_resultados=5, projeto_nome="projeto_datacite2")

    assert resultado["total_salvos"] == 0


# ─── DOAJ ────────────────────────────────────────────────────────────────────

def test_doaj_extrai_abstract_real(tmp_path, monkeypatch):
    monkeypatch.setattr(doaj, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "results": [{
            "bibjson": {
                "title": "Artigo Aberto de Teste",
                "abstract": "Resumo do artigo de acesso aberto.",
                "link": [{"url": "https://doaj.org/article/xyz"}],
            }
        }]
    }

    with patch.object(doaj.requests, "get", return_value=mock_resp):
        resultado = doaj.buscar(query="hiv", max_resultados=5, projeto_nome="projeto_doaj")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_doaj" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Resumo do artigo de acesso aberto." in conteudo
    assert "URL_ORIGEM: https://doaj.org/article/xyz" in conteudo


# ─── Zenodo ──────────────────────────────────────────────────────────────────

def test_zenodo_limpa_html_da_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(zenodo, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "hits": {"hits": [{
            "metadata": {"title": "Dataset Zenodo", "description": "<p>Descrição <b>com</b> HTML.</p>"},
            "links": {"self_html": "https://zenodo.org/record/123"},
        }]}
    }

    with patch.object(zenodo.requests, "get", return_value=mock_resp):
        resultado = zenodo.buscar(query="hiv", max_resultados=5, projeto_nome="projeto_zenodo")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_zenodo" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Descrição com HTML." in conteudo
    assert "<b>" not in conteudo


# ─── Adapter do arXiv (ponte de eventos, não repete testes do módulo) ─────────

def test_arxiv_adapter_traduz_eventos_para_contrato_generico():
    eventos_recebidos = []

    def dispatch_generico(event, **kwargs):
        eventos_recebidos.append((event, kwargs))

    with patch.object(arxiv_adapter._arxiv_motor, "buscar_arxiv") as mock_buscar:
        def fake_buscar(*, dispatch_event, **kwargs):
            dispatch_event("arxiv_total", total=3)
            dispatch_event("arxiv_processed", processed=1, total=3)
            return {"ok": True, "total_encontrados": 3, "total_salvos": 1, "erros": []}
        mock_buscar.side_effect = fake_buscar

        resultado = arxiv_adapter.buscar(
            query="attention", max_resultados=5, projeto_nome="projeto_arxiv_adapter",
            dispatch_event=dispatch_generico,
        )

    assert resultado["ok"] is True
    assert eventos_recebidos == [("total", {"total": 3}), ("processed", {"processed": 1, "total": 3})]
