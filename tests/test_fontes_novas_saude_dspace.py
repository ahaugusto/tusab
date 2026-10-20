# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes das fontes institucionais sobre DSpace 7 (OPAS/PAHO IRIS, OMS/WHO
IRIS, Fiocruz ARCA, UNA-SUS ARES, IPEA) e da BVS do Ministério da Saúde
(WordPress REST). Sem chamada de rede real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor.fontes import (
    _base, bvs_ms, fiocruz_arca, ipea, paho_iris, unasus_ares, who_iris,
)


def _resp_json(payload, content_type="application/hal+json;charset=UTF-8"):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.headers = {"Content-Type": content_type}
    resp.json.return_value = payload
    return resp


def _resp_texto(texto, content_type="text/plain;charset=UTF-8"):
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.headers = {"Content-Type": content_type}
    resp.text = texto
    resp.content = texto.encode("utf-8")
    return resp


def _item(uuid, titulo, abstracts, handle=None):
    metadata = {"dc.title": [{"value": titulo, "language": None}]}
    if abstracts:
        metadata["dc.description.abstract"] = [{"value": a, "language": "pt_BR"} for a in abstracts]
    return {"_embedded": {"indexableObject": {"uuid": uuid, "handle": handle, "metadata": metadata}}}


def _busca_dspace(*itens):
    return _resp_json({"_embedded": {"searchResult": {"_embedded": {"objects": list(itens)}}}})


def _ler_txts(tmp_path, projeto):
    pasta = tmp_path / projeto / "documents"
    return [p.read_text(encoding="utf-8") for p in sorted(pasta.glob("*.txt"))]


# ─── Conector DSpace 7 ───────────────────────────────────────────────────────

def test_dspace_extrai_abstract_multilingue_e_url_por_handle(tmp_path, monkeypatch):
    monkeypatch.setattr(fiocruz_arca, "NEURAL_DIR", str(tmp_path))
    busca = _busca_dspace(_item(
        "u-1", "Dengue no Brasil",
        ["[RESUMO]. Estudo sobre dengue.", "[ABSTRACT]. Dengue study.", "[RESUMO]. Estudo sobre dengue."],
        handle="icict/24063",
    ))

    with patch.object(fiocruz_arca.requests, "get", return_value=busca) as mock_get:
        resultado = fiocruz_arca.buscar(query="dengue", max_resultados=3, projeto_nome="p_arca")

    assert resultado["total_salvos"] == 1
    url_chamada = mock_get.call_args.args[0]
    assert url_chamada == "https://api.arca.fiocruz.br/api/discover/search/objects"
    assert mock_get.call_args.kwargs["params"]["dsoType"] == "ITEM"
    conteudo = _ler_txts(tmp_path, "p_arca")[0]
    assert "TITULO: Dengue no Brasil" in conteudo
    assert "[RESUMO]. Estudo sobre dengue." in conteudo
    assert "[ABSTRACT]. Dengue study." in conteudo
    assert conteudo.count("[RESUMO]. Estudo sobre dengue.") == 1  # duplicata removida
    assert "URL_ORIGEM: https://arca.fiocruz.br/handle/icict/24063" in conteudo


def test_dspace_descarta_item_sem_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(unasus_ares, "NEURAL_DIR", str(tmp_path))
    busca = _busca_dspace(
        _item("u-1", "Sem resumo", []),
        _item("u-2", "Com resumo", ["Cobertura vacinal na ESF."]),
    )

    with patch.object(unasus_ares.requests, "get", return_value=busca):
        resultado = unasus_ares.buscar(query="vacina", max_resultados=5, projeto_nome="p_ares")

    assert resultado["total_salvos"] == 1
    conteudos = _ler_txts(tmp_path, "p_ares")
    assert len(conteudos) == 1
    assert "TITULO: Com resumo" in conteudos[0]
    # Sem handle → URL do item pelo uuid no front.
    assert "URL_ORIGEM: https://ares.unasus.gov.br/items/u-2" in conteudos[0]


def test_dspace_respeita_max_resultados_mesmo_buscando_candidatos_extras(tmp_path, monkeypatch):
    monkeypatch.setattr(fiocruz_arca, "NEURAL_DIR", str(tmp_path))
    busca = _busca_dspace(*[_item(f"u-{i}", f"Item {i}", [f"Resumo {i}"]) for i in range(6)])

    with patch.object(fiocruz_arca.requests, "get", return_value=busca) as mock_get:
        resultado = fiocruz_arca.buscar(query="x", max_resultados=2, projeto_nome="p_max")

    assert mock_get.call_args.kwargs["params"]["size"] == 4   # 2× o pedido
    assert resultado["total_salvos"] == 2


def test_dspace_repete_sem_filtro_quando_solr_rejeita_a_sintaxe(tmp_path, monkeypatch):
    import requests as _requests
    monkeypatch.setattr(fiocruz_arca, "NEURAL_DIR", str(tmp_path))
    rejeitada = MagicMock()
    rejeitada.raise_for_status.side_effect = _requests.exceptions.HTTPError("400")
    busca = _busca_dspace(_item("u-1", "Item", ["Resumo."]))

    with patch.object(fiocruz_arca.requests, "get", side_effect=[rejeitada, busca]) as mock_get:
        resultado = fiocruz_arca.buscar(query="dengue (", max_resultados=1, projeto_nome="p_solr")

    assert mock_get.call_args_list[0].kwargs["params"]["query"] == "(dengue () AND dc.description.abstract:*"
    assert mock_get.call_args_list[1].kwargs["params"]["query"] == "dengue ("
    assert resultado["total_salvos"] == 1


def test_dspace_sem_resultados_retorna_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(paho_iris, "NEURAL_DIR", str(tmp_path))
    with patch.object(paho_iris.requests, "get", return_value=_busca_dspace()):
        resultado = paho_iris.buscar(query="nada", max_resultados=3, projeto_nome="p_vazio")
    assert resultado == {"ok": True, "total_encontrados": 0, "total_salvos": 0, "erros": []}


def test_who_e_paho_usam_user_agent_tusabbot(tmp_path, monkeypatch):
    for modulo, base in ((who_iris, "https://iris.who.int/server/api"),
                         (paho_iris, "https://iris.paho.org/server/api")):
        monkeypatch.setattr(modulo, "NEURAL_DIR", str(tmp_path))
        busca = _busca_dspace(_item("u-1", "Doc", ["Resumo."], handle="10665/1"))
        with patch.object(modulo.requests, "get", return_value=busca) as mock_get:
            modulo.buscar(query="dengue", max_resultados=1, projeto_nome=f"p_{modulo.FONTE_META['id']}")
        assert mock_get.call_args.args[0] == f"{base}/discover/search/objects"
        assert mock_get.call_args.kwargs["params"]["query"] == "(dengue) AND dc.description.abstract:*"
        assert mock_get.call_args.kwargs["headers"] == _base.HEADERS_TUSABBOT
        assert mock_get.call_args.kwargs["headers"]["User-Agent"].startswith("TusabBot/")


def test_dspace_html_no_lugar_de_json_falha_com_mensagem_clara(tmp_path, monkeypatch):
    monkeypatch.setattr(who_iris, "NEURAL_DIR", str(tmp_path))
    bloqueio = _resp_json({}, content_type="text/html")
    with patch.object(who_iris.requests, "get", return_value=bloqueio):
        try:
            who_iris.buscar(query="dengue", max_resultados=1, projeto_nome="p_bloq")
            assert False, "deveria ter levantado RuntimeError"
        except RuntimeError as e:
            assert "OMS/WHO IRIS" in str(e)


# ─── IPEA (texto integral do bundle TEXT) ────────────────────────────────────

def test_ipea_usa_texto_integral_do_bundle_text(tmp_path, monkeypatch):
    monkeypatch.setattr(ipea, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr("tusab_engine.motor.fontes._base.time.sleep", lambda s: None)
    texto_integral = "SANEAMENTO RURAL NO BRASIL. " * 100
    busca = _busca_dspace(_item("u-1", "Saneamento rural", ["Resumo curto."], handle="11058/12900"))
    bundles = _resp_json({"_embedded": {"bundles": [
        {"name": "ORIGINAL", "_embedded": {"bitstreams": {"_embedded": {"bitstreams": [
            {"sizeBytes": 339282, "_links": {"content": {"href": "https://x/pdf/content"}}}]}}}},
        {"name": "TEXT", "_embedded": {"bitstreams": {"_embedded": {"bitstreams": [
            {"sizeBytes": 41596, "_links": {"content": {"href": "https://x/txt/content"}}}]}}}},
    ]}})

    with patch.object(ipea.requests, "get", side_effect=[busca, bundles, _resp_texto(texto_integral)]) as mock_get:
        resultado = ipea.buscar(query="saneamento", max_resultados=1, projeto_nome="p_ipea")

    assert resultado["total_salvos"] == 1
    assert mock_get.call_args_list[1].args[0] == "https://repositorio.ipea.gov.br/server/api/core/items/u-1/bundles"
    assert mock_get.call_args_list[2].args[0] == "https://x/txt/content"
    conteudo = _ler_txts(tmp_path, "p_ipea")[0]
    assert texto_integral.strip() in conteudo
    assert "Resumo curto." not in conteudo
    assert "URL_ORIGEM: https://repositorio.ipea.gov.br/handle/11058/12900" in conteudo


def test_ipea_cai_para_abstract_sem_bundle_text(tmp_path, monkeypatch):
    monkeypatch.setattr(ipea, "NEURAL_DIR", str(tmp_path))
    busca = _busca_dspace(_item("u-1", "O PAC e o saneamento", ["Resumo do PAC."]))
    bundles = _resp_json({"_embedded": {"bundles": [
        {"name": "ORIGINAL", "_embedded": {"bitstreams": {"_embedded": {"bitstreams": []}}}},
    ]}})

    with patch.object(ipea.requests, "get", side_effect=[busca, bundles]):
        resultado = ipea.buscar(query="saneamento", max_resultados=1, projeto_nome="p_ipea2")

    assert resultado["total_salvos"] == 1
    assert resultado["erros"] == []
    assert "Resumo do PAC." in _ler_txts(tmp_path, "p_ipea2")[0]


def test_ipea_cai_para_abstract_quando_bundle_falha(tmp_path, monkeypatch):
    monkeypatch.setattr(ipea, "NEURAL_DIR", str(tmp_path))
    busca = _busca_dspace(_item("u-1", "Doc", ["Resumo de reserva."]))

    with patch.object(ipea.requests, "get", side_effect=[busca, RuntimeError("timeout")]):
        resultado = ipea.buscar(query="saneamento", max_resultados=1, projeto_nome="p_ipea3")

    assert resultado["total_salvos"] == 1
    assert "Resumo de reserva." in _ler_txts(tmp_path, "p_ipea3")[0]


# ─── BVS MS (WordPress) ──────────────────────────────────────────────────────

def test_bvs_ms_limpa_html_e_entidades_do_titulo(tmp_path, monkeypatch):
    monkeypatch.setattr(bvs_ms, "NEURAL_DIR", str(tmp_path))
    posts = [
        {
            "link": "https://bvsms.saude.gov.br/17-10-dia-nacional-da-vacinacao-2026/",
            "title": {"rendered": "17/10 &#8211; Dia Nacional da Vacina&ccedil;&atilde;o"},
            "content": {"rendered": '<p class="wp-block-paragraph">As vacinas <strong>salvam</strong> vidas.</p>'
                                    "<script>alert(1)</script><ul><li>Item um</li><li>Item dois</li></ul>"},
        },
        {"link": "https://bvsms.saude.gov.br/vazio/", "title": {"rendered": "Vazio"}, "content": {"rendered": "<p> </p>"}},
    ]
    resp = _resp_json(posts, content_type="application/json; charset=UTF-8")

    with patch.object(bvs_ms.requests, "get", return_value=resp) as mock_get:
        resultado = bvs_ms.buscar(query="vacina", max_resultados=999, projeto_nome="p_bvs")

    assert mock_get.call_args.args[0] == "https://bvsms.saude.gov.br/wp-json/wp/v2/posts"
    assert mock_get.call_args.kwargs["params"] == {"search": "vacina", "per_page": _base.MAX_RESULTADOS_PERMITIDO}
    assert resultado["total_encontrados"] == 2
    assert resultado["total_salvos"] == 1   # post sem texto descartado
    conteudo = _ler_txts(tmp_path, "p_bvs")[0]
    assert "TITULO: 17/10 – Dia Nacional da Vacinação" in conteudo
    assert "As vacinas salvam vidas." in conteudo
    assert "Item um\nItem dois" in conteudo
    assert "<" not in conteudo.split("-" * 70)[1]
    assert "alert" not in conteudo
    assert "URL_ORIGEM: https://bvsms.saude.gov.br/17-10-dia-nacional-da-vacinacao-2026/" in conteudo


def test_bvs_ms_sem_resultados(tmp_path, monkeypatch):
    monkeypatch.setattr(bvs_ms, "NEURAL_DIR", str(tmp_path))
    with patch.object(bvs_ms.requests, "get", return_value=_resp_json([], "application/json")):
        resultado = bvs_ms.buscar(query="xyz", max_resultados=3, projeto_nome="p_bvs2")
    assert resultado["total_salvos"] == 0


def test_fonte_meta_das_novas_fontes():
    for modulo, area in ((paho_iris, "saude"), (who_iris, "saude"), (fiocruz_arca, "saude"),
                         (unasus_ares, "saude"), (ipea, "economia"), (bvs_ms, "saude")):
        meta = modulo.FONTE_META
        assert meta["area"] == area
        assert meta["requer_auth"] is False
        assert {"id", "nome", "descricao", "suporta_data", "suporta_autor"} <= set(meta)
