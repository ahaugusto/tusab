# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""Testes do conector de portais de dados abertos (_portais_dados.py) e da
área "dados". Sem rede — requests mockado."""
from unittest.mock import MagicMock, patch

import pytest

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import _portais_dados as pd


def _resp(json_data):
    r = MagicMock(status_code=200)
    r.json.return_value = json_data
    r.raise_for_status = MagicMock()
    return r


def _ckan(n, prefixo):
    return {"result": {"count": n, "results": [{
        "title": f"{prefixo} conjunto {i}", "name": f"{prefixo.lower()}-{i}",
        "notes": f"Descrição **real** do conjunto {i} de {prefixo}, com [link](http://x) e texto suficiente.",
        "organization": {"title": f"Secretaria {prefixo}"},
        "resources": [{"name": f"Planilha {i}", "format": "csv", "url": f"https://{prefixo}.br/{i}.csv"}],
    } for i in range(n)]}}


def test_area_dados_registrada():
    areas = fontes_registry.listar_fontes()
    ids = {f["id"] for f in areas["dados"]["fontes"]}
    assert ids == {"portais_br_federal", "portais_br_estados", "portais_br_municipios",
                   "portais_internacionais", "data_europa_eu", "data_gov_uk"}


def test_intercala_portais_e_lista_arquivos(tmp_path, monkeypatch):
    monkeypatch.setattr(pd, "NEURAL_DIR", str(tmp_path))
    portais = [{"nome": "SP", "plataforma": "ckan", "base": "https://sp"},
               {"nome": "RJ", "plataforma": "ckan", "base": "https://rj"}]

    def fake_get(url, **kw):
        return _resp(_ckan(3, "SP" if "//sp" in url else "RJ"))

    with patch.object(pd.requests, "get", side_effect=fake_get):
        r = pd.buscar_portais(portais, "portais_teste", "saude", 4, "proj")
    assert r["total_salvos"] == 4
    textos = [p.read_text(encoding="utf-8") for p in (tmp_path / "proj" / "documents").glob("*.txt")]
    assert sum("Portal: SP" in t for t in textos) == 2 and sum("Portal: RJ" in t for t in textos) == 2
    amostra = next(t for t in textos if "Portal: SP" in t)
    assert "Planilha 0 [CSV] https://SP.br/0.csv" in amostra or "[CSV]" in amostra
    assert "**" not in amostra and "(http://x)" not in amostra   # Markdown limpo


def test_portal_fora_do_ar_nao_derruba_a_busca(tmp_path, monkeypatch):
    monkeypatch.setattr(pd, "NEURAL_DIR", str(tmp_path))
    portais = [{"nome": "Lento", "plataforma": "ckan", "base": "https://lento"},
               {"nome": "Ok", "plataforma": "ckan", "base": "https://ok"}]

    def fake_get(url, **kw):
        if "lento" in url:
            raise pd.requests.exceptions.ConnectTimeout("timeout")
        return _resp(_ckan(2, "OK"))

    with patch.object(pd.requests, "get", side_effect=fake_get):
        r = pd.buscar_portais(portais, "portais_teste", "x", 5, "proj2")
    assert r["total_salvos"] == 2
    assert r["portais_sem_resposta"] == ["Lento: ConnectTimeout"]


def test_todos_os_portais_fora_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(pd, "NEURAL_DIR", str(tmp_path))
    with patch.object(pd.requests, "get", side_effect=pd.requests.exceptions.ConnectTimeout("t")):
        with pytest.raises(RuntimeError, match="Nenhum portal respondeu"):
            pd.buscar_portais([{"nome": "A", "plataforma": "ckan", "base": "https://a"}], "f", "x", 3, "p3")


def test_adaptadores_udata_socrata_ods():
    udata = {"data": [{"title": "Santé", "description": "Descrição udata longa o bastante para entrar no corpus.",
                       "organization": {"name": "Ministère"}, "page": "https://fr/ds", "resources": []}]}
    socrata = {"results": [{"resource": {"name": "Salud", "description": "Descrição socrata longa o bastante.", "attribution": "MinSalud"},
                            "link": "https://co/ds"}]}
    ods = {"results": [{"dataset_id": "x y", "metas": {"default": {"title": "Écoles", "description": "<p>Descrição <b>ODS</b></p>", "publisher": "Paris"}}}]}
    with patch.object(pd.requests, "get", side_effect=[_resp(udata), _resp(socrata), _resp(ods)]) as g:
        u = pd._udata({"nome": "FR", "base": "https://fr"}, "santé", 3)
        s = pd._socrata({"nome": "CO", "dominio": "www.datos.gov.co"}, "salud", 3)
        o = pd._ods({"nome": "Paris", "base": "https://paris"}, 'escola "x"', 3)
    assert u[0]["titulo"] == "Santé" and u[0]["orgao"] == "Ministère"
    assert s[0]["url"] == "https://co/ds" and s[0]["orgao"] == "MinSalud"
    assert o[0]["descricao"] == "Descrição ODS" and o[0]["url"] == "https://paris/explore/dataset/x%20y/"
    assert g.call_args_list[2].kwargs["params"]["where"] == 'search("escola  x ")'   # aspas do termo neutralizadas


def test_ua_dos_portais_nao_tem_bot():
    assert "bot" not in pd.HEADERS_PORTAIS["User-Agent"].lower()
