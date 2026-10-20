# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes das fontes de jurisprudência (STF, TCU, TST), legislativas (Senado —
projetos e matérias) e de notícias governamentais (portais gov.br, IBGE,
Agência Brasil). Sem chamada de rede real — requests é mockado.

Foco em LGPD (Lei 13.709/2018): nenhum nome de parte, advogado, CPF ou
signatário pode chegar ao .txt gravado.
"""
import json
from unittest.mock import MagicMock, patch

import pytest

from tusab_engine.motor.fontes import (
    agencia_brasil, govbr_noticias, ibge_noticias, senado_materias, stf, tcu, tst,
)
from tusab_engine.motor.fontes._lgpd_juridico import (
    LIMITE_CHARS_DOCUMENTO, limitar_texto, sanitizar_texto_juridico,
)


def _resp_json(dados, status=200, tipo="application/json"):
    m = MagicMock()
    m.status_code = status
    m.ok = status < 400
    m.headers = {"Content-Type": tipo}
    m.json.return_value = dados
    m.text = json.dumps(dados)
    m.content = m.text.encode("utf-8")
    m.raise_for_status = MagicMock()
    return m


def _resp_texto(texto, status=200, tipo="text/html; charset=utf-8"):
    m = MagicMock()
    m.status_code = status
    m.ok = status < 400
    m.headers = {"Content-Type": tipo}
    m.text = texto
    m.content = texto.encode("utf-8")
    m.json.side_effect = ValueError("não é JSON")
    m.raise_for_status = MagicMock()
    return m


def _ler_txts(tmp_path, projeto):
    return [p.read_text(encoding="utf-8") for p in (tmp_path / projeto / "documents").glob("*.txt")]


@pytest.fixture(autouse=True)
def _sem_espera(monkeypatch):
    monkeypatch.setattr("tusab_engine.motor.fontes._base.time.sleep", lambda *_: None)
    monkeypatch.setattr(govbr_noticias.time, "sleep", lambda *_: None)


# ── _lgpd_juridico ────────────────────────────────────────────────────────────

def test_sanitizador_mascara_cpf_oab_e_qualificacao_tst():
    texto = (
        "Vistos, relatados e discutidos estes autos, em que é AGRAVANTE JOAO DA SILVA e são "
        "AGRAVADOS EMPRESA X LTDA .\nA reclamante interpôs recurso. Responsável: (XXX.956.260-XX), "
        "CPF 123.456.789-01, advogada (26.348/OAB-CE)."
    )
    limpo = sanitizar_texto_juridico(texto)
    assert "JOAO DA SILVA" not in limpo
    assert "XXX.956.260-XX" not in limpo and "123.456.789-01" not in limpo
    assert "26.348/OAB-CE" not in limpo
    assert "qualificação das partes omitida" in limpo
    assert "A reclamante interpôs recurso." in limpo


def test_sanitizador_redige_cabecalho_e_extrato_stf():
    texto = (
        "SEGUNDA TURMA\nAG.REG. NO HABEAS CORPUS 263.994 GOIÁS\nRELATOR\nAGTE.(S)\nADV.(A/S)\n\n"
        ": MIN. FULANO\n: M.X.Q.S.\n: BELTRANA DE TAL E OUTRO(A/S)\n\nEMENTA: DIREITO PROCESSUAL PENAL.\n"
        "EXTRATO DE ATA\nAGTE.(S): M.X.Q.S.\nADV.(A/S): BELTRANA DE TAL (63906/GO)\nDecisão: não conhecido."
    )
    limpo = sanitizar_texto_juridico(texto)
    assert "BELTRANA" not in limpo and "M.X.Q.S." not in limpo
    assert "SEGUNDA TURMA" in limpo and "EMENTA: DIREITO PROCESSUAL PENAL." in limpo
    assert "Decisão: não conhecido." in limpo


def test_sanitizador_redige_nome_com_grafia_diferente_do_campo():
    """Visto ao vivo no TCU: campo traz "Geraldo Antonio"/"Aben-Athar", texto traz "Antônio"/"Aben Athar"."""
    texto = "julgar irregulares as contas de Geraldo Antônio de Oliveira e Reynaldo Aben Athar de Sousa (OAB-DF 22885)."
    limpo = sanitizar_texto_juridico(texto, nomes_extras=["Geraldo Antonio de Oliveira", "Reynaldo Aben-Athar de Sousa"])
    assert "Geraldo" not in limpo and "Athar" not in limpo and "22885" not in limpo
    assert limpo.startswith("julgar irregulares as contas de [nome omitido — LGPD] e [nome omitido — LGPD]")


def test_limitar_texto_respeita_teto():
    assert len(limitar_texto("a" * (LIMITE_CHARS_DOCUMENTO + 5000))) < LIMITE_CHARS_DOCUMENTO + 100


# ── STF ──────────────────────────────────────────────────────────────────────

def _stf_hits(docs):
    return _resp_json({"result": {"hits": {"total": {"value": len(docs)}, "hits": [{"_source": d} for d in docs]}}})


def test_stf_extrai_ementa_e_inteiro_teor_sem_partes(tmp_path, monkeypatch):
    monkeypatch.setattr(stf, "NEURAL_DIR", str(tmp_path))
    candidato = {"id": "sjur1", "ementa_texto": "Saneamento básico. Concessão."}
    documento = {
        "id": "sjur1", "titulo": "ADI 4454", "orgao_julgador": "Tribunal Pleno", "julgamento_data": "2020-05-01",
        "ementa_texto": "Saneamento básico. Concessão.", "acordao_ata": "Julgado procedente.",
        "documental_indexacao_texto": "SANEAMENTO BÁSICO",
        # Cabeçalho com as partes repetido no início de cada seção, como no inteiro teor real.
        "inteiro_teor_texto": (
            "PLENÁRIO\nRELATOR\nREQTE.(S)\nADV.(A/S)\n\n: MIN. FULANO\n: PARTIDO X\n: CICLANO DA SILVA\n\nEmenta: Saneamento.\n"
            "PLENÁRIO\nRELATOR\nREQTE.(S)\nADV.(A/S)\n\n: MIN. FULANO\n: PARTIDO X\n: CICLANO DA SILVA\nRE LAT Ó RI O\n"
            "O advogado Ciclano da Silva sustentou da tribuna.\nVoto do relator."
        ),
        # Mesmo que o servidor ignorasse a lista branca, o campo não é lido:
        "partes_lista_texto": "REQTE.(S): CICLANO DA SILVA\nADV.(A/S): FULANA PEREIRA",
    }
    with patch.object(stf.requests, "post", side_effect=[_stf_hits([candidato]), _stf_hits([documento])]) as mock_post:
        resultado = stf.buscar(query="saneamento", max_resultados=3, projeto_nome="p_stf")

    assert resultado["total_salvos"] == 1
    corpo_fase2 = mock_post.call_args_list[1].kwargs["json"]
    assert "partes_lista_texto" not in corpo_fase2["_source"]
    corpo_fase1 = mock_post.call_args_list[0].kwargs["json"]
    assert corpo_fase1["query"]["bool"]["must"][0]["simple_query_string"]["fields"] == stf._CAMPOS_BUSCA_EXATA

    conteudo = _ler_txts(tmp_path, "p_stf")[0]
    assert "TITULO: STF ADI 4454 — Tribunal Pleno — 2020-05-01" in conteudo
    assert "URL_ORIGEM: https://jurisprudencia.stf.jus.br/pages/search/sjur1/false" in conteudo
    assert "Julgado procedente." in conteudo and "Voto do relator." in conteudo
    assert "CICLANO" not in conteudo.upper() and "FULANA" not in conteudo and "MIN. FULANO" not in conteudo
    assert "sustentou da tribuna" in conteudo and "RE LAT Ó RI O" in conteudo


def test_stf_fallback_com_stemming_filtra_saneador(tmp_path, monkeypatch):
    monkeypatch.setattr(stf, "NEURAL_DIR", str(tmp_path))
    candidatos_radical = [
        {"id": "sjur9", "ementa_texto": "Despacho saneador. Preclusão."},
        {"id": "sjur8", "ementa_texto": "Serviço de saneamento municipal."},
    ]
    documento = {"id": "sjur8", "titulo": "RE 1", "ementa_texto": "Serviço de saneamento municipal."}
    with patch.object(stf.requests, "post", side_effect=[_stf_hits([]), _stf_hits(candidatos_radical), _stf_hits([documento])]) as mock_post:
        resultado = stf.buscar(query="saneamento", max_resultados=3, projeto_nome="p_stf_fb")

    assert resultado["total_salvos"] == 1
    assert mock_post.call_args_list[2].kwargs["json"]["query"]["bool"]["filter"][1] == {"terms": {"id": ["sjur8"]}}


def test_stf_formato_mudado_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(stf, "NEURAL_DIR", str(tmp_path))
    with patch.object(stf.requests, "post", return_value=_resp_json({"resultado": []})):
        with pytest.raises(RuntimeError, match="STF mudou o formato"):
            stf.buscar(query="saneamento", max_resultados=3, projeto_nome="p_stf_err")
    assert not (tmp_path / "p_stf_err").exists()


# ── TCU ──────────────────────────────────────────────────────────────────────

def test_tcu_extrai_secoes_na_ordem_sem_responsaveis(tmp_path, monkeypatch):
    monkeypatch.setattr(tcu, "NEURAL_DIR", str(tmp_path))
    resumidos = _resp_json({"quantidadeEncontrada": 1, "documentos": [
        {"KEY": "ACORDAO-COMPLETO-1", "TITULO": "ACÓRDÃO 10/2026 ATA 1/2026 - PLENÁRIO", "NUMACORDAO": "10", "ANOACORDAO": "2026", "COLEGIADO": "Plenário"},
    ]})
    documento = _resp_json({"documentos": [{
        "KEY": "ACORDAO-COMPLETO-1", "NUMACORDAO": "10", "ANOACORDAO": "2026", "COLEGIADO": "Plenário",
        "SUMARIO": "LICITAÇÃO. SOBREPREÇO.",
        "ACORDAO": "<p>9.1. conhecer da representação;</p>",
        "VOTO": "<p>Voto do relator sobre a licitação.</p>",
        "RELATORIO": "<p>163. Responsável 1: Fulano de Tal Pereira (XXX.956.260-XX)</p>"
                     "<p>Propõe-se a audiência de Fulano Pereira e da Empresa X Ltda.</p>" + "<p>relatório</p>" * 30000,
        "INTERESSADOS": "3. Responsáveis: Fulano de Tal Pereira (XXX.956.260-XX); Empresa X Ltda (XX.XXX.XXX/0001-XX)",
        "ADVOGADO": "Beltrana Souza (26.348/OAB-CE)",
        "RELATOR": "MINISTRO X",
    }]})
    with patch.object(tcu.requests, "get", side_effect=[resumidos, documento]) as mock_get:
        resultado = tcu.buscar(query="licitação", max_resultados=5, projeto_nome="p_tcu")

    assert resultado["total_salvos"] == 1
    assert mock_get.call_args_list[0].kwargs["headers"]["User-Agent"].startswith("Mozilla/5.0")
    assert mock_get.call_args_list[1].kwargs["params"]["termo"] == 'KEY:"ACORDAO-COMPLETO-1"'
    conteudo = _ler_txts(tmp_path, "p_tcu")[0]
    assert "TITULO: TCU Acórdão 10/2026 — Plenário" in conteudo
    pos = [conteudo.index(s) for s in ("--- SUMÁRIO ---", "--- ACÓRDÃO ---", "--- VOTO ---", "--- RELATÓRIO ---")]
    assert pos == sorted(pos)
    assert "Fulano" not in conteudo and "Beltrana" not in conteudo and "MINISTRO X" not in conteudo
    assert "Empresa X Ltda" in conteudo  # pessoa jurídica não é dado pessoal
    assert "XXX.956.260-XX" not in conteudo
    corpo = conteudo.split("-" * 70 + "\n", 1)[1]
    assert len(corpo) <= LIMITE_CHARS_DOCUMENTO + 100


def test_tcu_html_disfarcado_de_200_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(tcu, "NEURAL_DIR", str(tmp_path))
    bloqueio = _resp_texto("<html><body>Requisição rejeitada. ID: 123</body></html>")
    with patch.object(tcu.requests, "get", return_value=bloqueio):
        with pytest.raises(RuntimeError, match="TCU respondeu .* em vez de JSON"):
            tcu.buscar(query="licitação", max_resultados=3, projeto_nome="p_tcu_bloq")
    assert not (tmp_path / "p_tcu_bloq").exists()


def test_tcu_bloqueio_no_documento_vira_erro_do_item_sem_gravar(tmp_path, monkeypatch):
    monkeypatch.setattr(tcu, "NEURAL_DIR", str(tmp_path))
    resumidos = _resp_json({"documentos": [{"KEY": "ACORDAO-COMPLETO-2"}]})
    with patch.object(tcu.requests, "get", side_effect=[resumidos, _resp_texto("Requisição rejeitada")]):
        resultado = tcu.buscar(query="licitação", max_resultados=3, projeto_nome="p_tcu_item")
    assert resultado["total_salvos"] == 0
    assert "em vez de JSON" in resultado["erros"][0]["erro"]


# ── TST ──────────────────────────────────────────────────────────────────────

def _tst_registro(**extra):
    reg = {
        "id": "abc", "numFormatado": "RR - 1454-66.2012.5.06.0013",
        "orgaoJudicante": {"descricao": "2ª Turma"}, "dtaJulgamento": "2026-10-07",
        "ementa": "TERCEIRIZAÇÃO. INTELIGÊNCIA ARTIFICIAL. LICITUDE.",
        "dispositivo": ", por unanimidade, não conhecer do recurso de revista.\n",
        "inteiroTeorHtml": "<html><body><p>Vistos, relatados e discutidos estes autos, em que é Recorrente</p>"
                           "<p>JESSICA DA SILVA MORAES</p><p>e Recorrido</p><p>CONTAX S.A.</p><p>.</p>"
                           "<p>O Tribunal Regional concluiu ser lícita a terceirização.</p></body></html>",
        "codCPFSignatario": "22767746300",
        "nomRelator": "liana chaib",
        "numeracaoUnica": {"numero": 1454, "digito": 66, "ano": 2012, "orgao": 5, "tribunal": 6, "vara": 13},
    }
    reg.update(extra)
    return {"registro": reg, "destaques": {}}


def test_tst_cpf_signatario_e_partes_nunca_chegam_ao_arquivo(tmp_path, monkeypatch):
    monkeypatch.setattr(tst, "NEURAL_DIR", str(tmp_path))
    resp = _resp_json({"totalRegistros": 1, "registros": [_tst_registro()]})
    with patch.object(tst.requests, "post", return_value=resp) as mock_post:
        resultado = tst.buscar(query="inteligência artificial", max_resultados=3, projeto_nome="p_tst")

    assert resultado["total_salvos"] == 1
    corpo = mock_post.call_args.kwargs["json"]
    assert corpo == {"e": '"inteligência artificial"', "tipos": ["ACORDAO"], "orgao": "TST"}
    conteudo = _ler_txts(tmp_path, "p_tst")[0]
    assert "22767746300" not in conteudo
    assert "JESSICA" not in conteudo and "liana chaib" not in conteudo.lower()
    assert "qualificação das partes omitida" in conteudo
    assert "INTELIGÊNCIA ARTIFICIAL" in conteudo and "lícita a terceirização" in conteudo
    assert "não conhecer do recurso de revista" in conteudo
    assert "numeroTst=1454&digitoTst=66&anoTst=2012" in conteudo


def test_tst_frase_sem_resultado_cai_para_todas_as_palavras(tmp_path, monkeypatch):
    monkeypatch.setattr(tst, "NEURAL_DIR", str(tmp_path))
    vazio = _resp_json({"totalRegistros": 0, "registros": []})
    cheio = _resp_json({"totalRegistros": 1, "registros": [_tst_registro()]})
    with patch.object(tst.requests, "post", side_effect=[vazio, cheio]) as mock_post:
        resultado = tst.buscar(query="terceirização call center", max_resultados=3, projeto_nome="p_tst_fb")
    assert resultado["total_salvos"] == 1
    assert mock_post.call_args_list[1].kwargs["json"]["e"] == "terceirização call center"


def test_tst_formato_mudado_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(tst, "NEURAL_DIR", str(tmp_path))
    with patch.object(tst.requests, "post", return_value=_resp_json({"hits": []})):
        with pytest.raises(RuntimeError, match="TST mudou o formato"):
            tst.buscar(query="saneamento", max_resultados=3, projeto_nome="p_tst_err")


# ── gov.br ───────────────────────────────────────────────────────────────────

_RSS = """<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://purl.org/rss/1.0/">
<channel rdf:about="x"><title>pt-br</title></channel>
<item rdf:about="https://www.gov.br/cvm/pt-br/noticia-1">
  <title>CVM regula saneamento</title>
  <link>https://www.gov.br/cvm/pt-br/noticia-1</link>
  <description>Linha fina 1</description>
  <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[<div id="parent-fieldname-text"><div><p>Corpo integral da notícia 1.</p></div></div><div>rodapé</div>]]></content:encoded>
  <dc:date>2026/10/01 10:00:00 GMT-3</dc:date>
</item>
<item rdf:about="https://www.gov.br/cvm/pt-br/noticia-2">
  <title>Outra notícia</title>
  <link>https://www.gov.br/cvm/pt-br/noticia-2</link>
  <description>Linha fina 2</description>
  <dc:date>2026/09/01 10:00:00 GMT-3</dc:date>
</item>
</rdf:RDF>"""

_PAGINA_PLONE = ('<html><body><div id="content-core"><div id="parent-fieldname-text" class="">'
                 '<div property="rnews:articleBody"><p>Corpo da página 2.</p></div></div>'
                 '<div class="documentByLine">Compartilhe esta página</div></div></body></html>')


def test_govbr_pula_orgao_em_manutencao_e_extrai_corpo(tmp_path, monkeypatch):
    monkeypatch.setattr(govbr_noticias, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(govbr_noticias, "ORGAOS", ["aneel", "cvm"])
    manutencao = _resp_texto("<!doctype html><title>Em manutenção</title>", status=404)
    rss = _resp_texto(_RSS, tipo="application/atom+xml; charset=utf-8")
    pagina = _resp_texto(_PAGINA_PLONE)
    with patch.object(govbr_noticias.requests, "get", side_effect=[manutencao, rss, pagina]) as mock_get:
        resultado = govbr_noticias.buscar(query="saneamento", max_resultados=5, projeto_nome="p_gov")

    assert resultado["total_salvos"] == 2
    urls = [c.args[0] for c in mock_get.call_args_list]
    assert urls[0].endswith("/aneel/pt-br/search_rss") and urls[1].endswith("/cvm/pt-br/search_rss")
    conteudos = "\n".join(_ler_txts(tmp_path, "p_gov"))
    assert "Corpo integral da notícia 1." in conteudos and "rodapé" not in conteudos
    assert "Corpo da página 2." in conteudos and "Compartilhe" not in conteudos
    assert "TITULO: CVM regula saneamento (CVM)" in conteudos


def test_govbr_orgao_com_xml_invalido_e_pulado(tmp_path, monkeypatch):
    monkeypatch.setattr(govbr_noticias, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(govbr_noticias, "ORGAOS", ["anac"])
    quebrado = _resp_texto("<rdf:RDF><item>", tipo="application/atom+xml")
    with patch.object(govbr_noticias.requests, "get", return_value=quebrado):
        resultado = govbr_noticias.buscar(query="saneamento", max_resultados=5, projeto_nome="p_gov_xml")
    assert resultado["total_salvos"] == 0 and resultado["ok"]


# ── Senado — matérias ────────────────────────────────────────────────────────

def test_senado_materias_prioriza_projetos_e_nao_grava_autoria(tmp_path, monkeypatch):
    monkeypatch.setattr(senado_materias, "NEURAL_DIR", str(tmp_path))
    lista = _resp_json([
        {"id": 1, "codigoMateria": 11, "identificacao": "REQ 2/2026 - CTFC", "ementa": "Requer audiência sobre reforma tributária.",
         "dataApresentacao": "2026-05-01", "tipoDocumento": "Requerimento", "autoria": "Senador Fulano"},
        {"id": 2, "codigoMateria": 22, "identificacao": "PLP 45/2026", "ementa": "Altera a reforma tributária.",
         "dataApresentacao": "2026-02-01", "tipoDocumento": "Projeto de Lei Complementar", "tramitando": "Sim",
         "autoria": "Senador Fulano", "urlDocumento": "https://legis.senado.gov.br/doc/abc"},
    ])
    detalhe = _resp_json({"documento": {"indexacao": " ALTERAÇÃO , IBS , CBS ."}, "conteudo": {},
                          "autoriaIniciativa": [{"autor": "Fulano"}]})
    with patch.object(senado_materias.requests, "get", side_effect=[lista, detalhe]) as mock_get:
        resultado = senado_materias.buscar(query="reforma tributária", max_resultados=1, projeto_nome="p_sen")

    assert resultado["total_salvos"] == 1
    assert mock_get.call_args_list[0].kwargs["params"] == {"termo": "reforma tributária"}
    assert mock_get.call_args_list[0].kwargs["headers"]["Accept"] == "application/json"
    conteudo = _ler_txts(tmp_path, "p_sen")[0]
    assert "TITULO: Senado PLP 45/2026" in conteudo
    assert "Altera a reforma tributária." in conteudo and "IBS , CBS" in conteudo
    assert "Texto (PDF): https://legis.senado.gov.br/doc/abc" in conteudo
    assert "materia/22" in conteudo
    assert "Fulano" not in conteudo


def test_senado_materias_periodo_longo_vira_janelas_de_um_ano():
    janelas = senado_materias._janelas("2023-01-01", "2026-06-30")
    assert janelas[0][1] == "2026-06-30"
    assert janelas[-1][0] == "2023-01-01"
    from datetime import date
    for ini, fim in janelas:
        assert (date.fromisoformat(fim) - date.fromisoformat(ini)).days <= 364


# ── IBGE ─────────────────────────────────────────────────────────────────────

def test_ibge_extrai_texto_integral_e_cai_para_introducao_no_cloudflare(tmp_path, monkeypatch):
    monkeypatch.setattr(ibge_noticias, "NEURAL_DIR", str(tmp_path))
    api = _resp_json({"count": 3, "totalPages": 1, "items": [
        {"titulo": "PNAD saneamento", "introducao": "Intro 1...", "link": "http://agenciadenoticias.ibge.gov.br/n1.html", "data_publicacao": "01/10/2026 10:00:00"},
        {"titulo": "Censo esgoto", "introducao": "Intro 2...", "link": "http://agenciadenoticias.ibge.gov.br/n2.html"},
        {"titulo": "Terceira", "introducao": "Intro 3...", "link": "http://agenciadenoticias.ibge.gov.br/n3.html"},
    ]})
    pagina_ok = _resp_texto('<div class="texto--single"><p>Texto integral da PNAD.</p></div><div class="lista-noticias">outras</div>')
    desafio = _resp_texto("<title>Just a moment...</title>", status=403)
    with patch.object(ibge_noticias.requests, "get", side_effect=[api, pagina_ok, desafio]) as mock_get:
        resultado = ibge_noticias.buscar(query="saneamento", max_resultados=3, projeto_nome="p_ibge")

    assert resultado["total_salvos"] == 3
    # Depois do desafio Cloudflare, não tenta mais as páginas (3 chamadas, não 4).
    assert mock_get.call_count == 3
    assert mock_get.call_args_list[1].args[0].startswith("https://")
    conteudos = "\n".join(_ler_txts(tmp_path, "p_ibge"))
    assert "Texto integral da PNAD." in conteudos and "outras" not in conteudos
    assert "Intro 2..." in conteudos and "Intro 3..." in conteudos


# ── Agência Brasil ───────────────────────────────────────────────────────────

def test_agencia_brasil_filtro_de_relevancia(tmp_path, monkeypatch):
    monkeypatch.setattr(agencia_brasil, "NEURAL_DIR", str(tmp_path))
    pagina = _resp_json([
        {"_id": "1", "title": "Reforma Tributária: 86% das notas destacam a CBS", "body": "<p>Texto sobre CBS.</p>",
         "path": "/economia/noticia/2026-10/reforma", "created_at": "2026-10-09T17:59:00-03:00", "tags": []},
        {"_id": "2", "title": "Candidato faz campanha no interior", "body": "<p>Comício sem relação.</p>",
         "path": "/politica/noticia/2026-10/campanha", "tags": ["Eleições 2026"]},
        {"_id": "3", "title": "Prazo do Simples acaba", "body": "<p>Mudanças tributárias afetam empresas.</p>",
         "path": "/economia/noticia/2026-10/simples", "tags": []},
    ])
    with patch.object(agencia_brasil.requests, "get", return_value=pagina):
        resultado = agencia_brasil.buscar(query="reforma tributária", max_resultados=10, projeto_nome="p_ab")

    assert resultado["total_salvos"] == 2
    conteudos = "\n".join(_ler_txts(tmp_path, "p_ab"))
    assert "Texto sobre CBS." in conteudos and "Mudanças tributárias" in conteudos
    assert "Comício" not in conteudos
    assert "URL_ORIGEM: https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/reforma" in conteudos


def test_agencia_brasil_ignora_palavras_curtas():
    item = {"title": "Lei de cotas", "body": "<p>Texto de cotas</p>"}
    # "de" e "IA" (< 4 letras) não contam como correspondência
    assert not agencia_brasil.relevante(item, ["inteligencia"])
    from tusab_engine.motor.fontes._termos_busca import palavras_significativas
    assert palavras_significativas("IA de ponta") == ["ponta"]
