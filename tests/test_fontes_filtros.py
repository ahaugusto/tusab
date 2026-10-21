# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da taxonomia de filtros das fontes públicas (TAXONOMIA em
tusab_engine/motor/fontes/__init__.py) e da sub-seleção de portais
(subfontes) — o que a modal usa para filtrar por região, tipo de conteúdo e
instituição, agrupar variantes e escolher estados/países/órgãos.
"""
from unittest.mock import patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import portais_br_estados


def test_toda_fonte_tem_taxonomia_valida():
    for m in fontes_registry._MODULOS:
        fid = m.FONTE_META["id"]
        tax = fontes_registry.TAXONOMIA.get(fid)
        assert tax, f"{fid} sem entrada em TAXONOMIA"
        assert tax["regiao"] in ("br", "int"), fid
        assert tax["tipos"] and all(t in fontes_registry.TIPOS_CONTEUDO for t in tax["tipos"]), fid
        assert tax["instituicao"], fid
        assert bool(tax["grupo"]) == bool(tax["variante"]), f"{fid}: grupo e variante andam juntos"
    assert set(fontes_registry.TAXONOMIA) == set(fontes_registry.FONTES), "taxonomia com id órfão"


def test_listar_fontes_entrega_taxonomia_sem_mutar_o_modulo():
    areas = fontes_registry.listar_fontes()
    hf = [f for f in areas["tecnologia"]["fontes"] if f["grupo"] == "Hugging Face"]
    assert {(f["id"], f["variante"]) for f in hf} == {("hf_modelos", "Modelos"), ("hf_datasets", "Datasets"), ("hf_papers", "Papers")}
    assert "grupo" not in fontes_registry.FONTES["hf_modelos"].FONTE_META   # cópia, não mutação


def test_area_traz_rotulos_dos_tipos_presentes():
    areas = fontes_registry.listar_fontes()
    tipos_direito = areas["direito"]["tipos"]
    assert tipos_direito["jurisprudencia"] == "Jurisprudência"
    assert "acervo" not in tipos_direito   # só tipos que existem na área


def test_grupos_nao_cruzam_regiao_dentro_da_area():
    """Um grupo mostrado como linha única não pode misturar Brasil e exterior —
    o filtro de região esconderia metade da linha."""
    for area in fontes_registry.listar_fontes().values():
        grupos = {}
        for f in area["fontes"]:
            if f["grupo"]:
                grupos.setdefault(f["grupo"], set()).add(f["regiao"])
        for grupo, regioes in grupos.items():
            if grupo != "Wikimedia em português":   # Wiktionary é multilíngue, aceito
                assert len(regioes) == 1, grupo


def test_portais_filtram_pela_subselecao():
    meta = portais_br_estados.FONTE_META
    assert meta["subfontes_rotulo"] == "Estados" and "São Paulo" in meta["subfontes"]
    with patch.object(portais_br_estados, "buscar_portais", return_value={"ok": True}) as mock:
        portais_br_estados.buscar(query="saúde", max_resultados=5, projeto_nome="p", subfontes=["São Paulo", "Goiás"])
    nomes = [p["nome"] for p in mock.call_args.args[0]]
    assert nomes == ["São Paulo", "Goiás"]


def test_subselecao_vazia_ou_invalida_consulta_todos():
    with patch.object(portais_br_estados, "buscar_portais", return_value={"ok": True}) as mock:
        portais_br_estados.buscar(query="x", max_resultados=5, projeto_nome="p", subfontes=["Atlântida"])
    assert len(mock.call_args.args[0]) == len(portais_br_estados.PORTAIS)


def test_router_so_repassa_subfontes_validas_a_quem_declara(monkeypatch):
    from tusab_engine.api import router_fontes
    chamadas = {}

    class FonteFake:
        FONTE_META = {"id": "fake", "nome": "Fake", "subfontes": ["A", "B"]}

        @staticmethod
        def buscar(**kw):
            chamadas.update(kw)
            return {"ok": True, "total_salvos": 0}

    class FonteSemSub:
        FONTE_META = {"id": "fake2", "nome": "Fake2"}

        @staticmethod
        def buscar(**kw):
            chamadas["sem_sub"] = kw
            return {"ok": True, "total_salvos": 0}

    monkeypatch.setattr(router_fontes, "obter_fonte", lambda fid: FonteFake if fid == "fake" else FonteSemSub)
    router_fontes._run_fonte_search("fake", "q", 3, "proj", "", "", "", ["A", "Z"])
    assert chamadas["subfontes"] == ["A"]
    router_fontes._run_fonte_search("fake2", "q", 3, "proj", "", "", "", ["A"])
    assert "subfontes" not in chamadas["sem_sub"]
