# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes das fontes públicas baseadas em raspagem de HTML ou sessão — as mais
frágeis do registro: AnvisaLegis, INCA, CAPES Teses, EduCAPES, Discursos do
Senado, Discursos da Câmara (SitaqWeb) e ALMG.

Para cada fonte: (1) a extração principal com uma resposta realista
(recortada do HTML/JSON real de 20/out/2026) e (2) o caso "página mudou" —
tem de virar erro claro ou zero resultados, nunca um .txt com lixo (menu do
portal, página de bloqueio). Sem chamada de rede real — requests é mockado.
"""
import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from tusab_engine.motor.fontes import (
    almg, anvisalegis, camara_discursos, capes_teses, educapes, inca,
    senado_discursos,
)


def _resp(texto="", json_data=None, content_type="text/html; charset=UTF-8", content=None):
    r = MagicMock()
    r.raise_for_status = MagicMock()
    r.status_code = 200
    r.headers = {"Content-Type": content_type}
    r.text = texto
    r.content = content if content is not None else texto.encode("utf-8")
    if json_data is not None:
        r.json.return_value = json_data
    else:
        r.json.side_effect = ValueError("não é JSON")
    return r


def _txts(tmp_path, projeto):
    return sorted((tmp_path / projeto / "documents").glob("*.txt"))


@pytest.fixture(autouse=True)
def _sem_espera(monkeypatch):
    for mod in (almg, anvisalegis, camara_discursos, capes_teses, educapes, inca, senado_discursos):
        monkeypatch.setattr(mod.time, "sleep", lambda *_: None)


# ---------------------------------------------------------------- AnvisaLegis

_ANVISA_RESULTADO = (
    "<div class='ato'><a href='/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000327"
    "&seqAto=000&valorAno=2019&orgao=RDC/DC/ANVISA/MS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134"
    "&pesquisa=true' target='_blank'><strong><i class='fas fa-chevron-down'></i> <span class=\"ico-situacao revogado"
    " status-2\" title=\"Revogado\">Revogado</span> RDC nº 327, de 9 de dezembro de 2019</strong><p>Dispõe sobre "
    "produtos de Cannabis para fins medicinais.\n</p></a></div>"
    "<div class='ato'><a href='/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=MAN&numeroAto=00002021"
    "&seqAto=TCV&valorAno=2021&orgao=ANVISA/MS&cod_menu=1696&cod_modulo=134&pesquisa=true' target='_blank'>"
    "<strong>Manual de Tecnovigilância</strong><p>Manual de Tecnovigilância - 2021\n</p></a></div>"
)

_ANVISA_ATO = (
    "<html><body><nav>Menu gov.br Acesso à informação Ouvidoria</nav>"
    "<article class=\"article\"><div id=\"conteudo\"><div class=\"ato\">"
    "<p>RESOLU&Ccedil;&Atilde;O DA DIRETORIA COLEGIADA - RDC N&ordm; 327</p>"
    "<p>Art. 1&ordm; Esta Resolu&ccedil;&atilde;o disp&otilde;e sobre Cannabis.</p></div></div></article>"
    "<footer>Rodapé do portal</footer></body></html>"
)


def _sessao_anvisa(json_pagina):
    sessao = MagicMock()
    sessao.headers = {}
    sessao.get.return_value = _resp("<html>form</html>")
    sessao.post.side_effect = [_resp("<html>ok</html>"), _resp(json_data=json_pagina, content_type="text/html; charset=ISO-8859-1")]
    return sessao


def test_anvisalegis_extrai_texto_integral_e_ementa_de_manual(tmp_path, monkeypatch):
    monkeypatch.setattr(anvisalegis, "NEURAL_DIR", str(tmp_path))
    sessao = _sessao_anvisa({"total_pagina": 2, "resultado": _ANVISA_RESULTADO})
    with patch.object(anvisalegis.requests, "Session", return_value=sessao), \
         patch.object(anvisalegis.requests, "get", return_value=_resp(_ANVISA_ATO)) as get_ato:
        resultado = anvisalegis.buscar("cannabis", 5, "proj_anvisa")

    assert resultado["total_salvos"] == 2
    # Termo enviado em Latin-1 (ver docstring do módulo), não UTF-8.
    corpo_post = sessao.post.call_args_list[0].kwargs["data"]
    assert "txt_texto=cannabis" in corpo_post
    # Só o RDC busca texto integral; o manual (MAN) fica na ementa, sem rede.
    assert get_ato.call_count == 1
    url_ato = get_ato.call_args.args[0]
    assert "num_ato=00000327" in url_ato and "sgl_tipo=RDC" in url_ato

    conteudos = [p.read_text(encoding="utf-8") for p in _txts(tmp_path, "proj_anvisa")]
    rdc = next(c for c in conteudos if "RDC nº 327" in c.splitlines()[0])
    assert "TITULO: RDC nº 327, de 9 de dezembro de 2019" in rdc  # sem o selo "Revogado"
    assert "Art. 1º Esta Resolução dispõe sobre Cannabis." in rdc
    assert "Menu gov.br" not in rdc and "Rodapé do portal" not in rdc
    manual = next(c for c in conteudos if "Tecnovigilância" in c.splitlines()[0])
    assert "Manual de Tecnovigilância - 2021" in manual and "TEXTO INTEGRAL" not in manual


def test_anvisalegis_form_latin1():
    assert "txt_texto=boas+pr%E1ticas" in anvisalegis._form_latin1({"txt_texto": "boas práticas"})


def test_anvisalegis_layout_mudou_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(anvisalegis, "NEURAL_DIR", str(tmp_path))
    html_novo = "<div class='ato'><section data-ato='1'>RDC 1</section></div>"
    sessao = _sessao_anvisa({"total_pagina": 1, "resultado": html_novo})
    with patch.object(anvisalegis.requests, "Session", return_value=sessao), \
         pytest.raises(RuntimeError, match="AnvisaLegis mudou o formato"):
        anvisalegis.buscar("cannabis", 5, "proj_anvisa_layout")
    assert not (tmp_path / "proj_anvisa_layout").exists()


def test_anvisalegis_pagina_do_ato_sem_corpo_nao_grava_menu(tmp_path, monkeypatch):
    monkeypatch.setattr(anvisalegis, "NEURAL_DIR", str(tmp_path))
    so_rdc = _ANVISA_RESULTADO[:_ANVISA_RESULTADO.index("<div class='ato'>", 1)]
    sessao = _sessao_anvisa({"total_pagina": 1, "resultado": so_rdc})
    pagina_sem_corpo = "<html><nav>Menu gov.br</nav><main>Página em manutenção</main></html>"
    with patch.object(anvisalegis.requests, "Session", return_value=sessao), \
         patch.object(anvisalegis.requests, "get", return_value=_resp(pagina_sem_corpo)):
        resultado = anvisalegis.buscar("cannabis", 1, "proj_anvisa_corpo")
    assert resultado["total_salvos"] == 0
    assert "formato da página do ato" in resultado["erros"][0]["erro"]
    assert _txts(tmp_path, "proj_anvisa_corpo") == []


# ----------------------------------------------------------------------- INCA

_INCA_BUSCA = (
    '<form action="/jspui/simple-search"><input name="query" value="câncer de mama"/></form>'
    '<div>Results 1-2 of 863</div><table><tr><td><a href="/jspui/handle/123456789/3604">A mulher</a></td></tr>'
    '<tr><td><a href="/jspui/handle/123456789/7426">Cartaz</a></td></tr>'
    '<tr><td><a href="/jspui/handle/123456789/3604">A mulher (repetido)</a></td></tr></table>'
)


def _inca_item(titulo, abstract=None):
    linhas = [
        f'<tr><td headers="s1" class="metadataFieldLabel">dc.title</td><td headers="s2" class="metadataFieldValue">{titulo}</td><td>pt_BR</td></tr>',
        '<tr><td headers="s1" class="metadataFieldLabel">dc.Type</td><td headers="s2" class="metadataFieldValue">Livro</td><td>-</td></tr>',
        '<tr><td headers="s1" class="metadataFieldLabel">dc.subject</td><td headers="s2" class="metadataFieldValue">Neoplasias&#x20;da&#x20;Mama</td><td>-</td></tr>',
    ]
    if abstract:
        linhas.append(f'<tr><td headers="s1" class="metadataFieldLabel">dc.description.abstract</td><td headers="s2" class="metadataFieldValue">{abstract}</td><td>pt_BR</td></tr>')
    return "<table>" + "".join(linhas) + "</table>"


def test_inca_extrai_resumo_e_descarta_sem_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(inca, "NEURAL_DIR", str(tmp_path))
    respostas = [
        _resp(_INCA_BUSCA),
        _resp(_inca_item("A mulher e o câncer de mama no Brasil", "De doença mutiladora a bom prognóstico.")),
        _resp(_inca_item("Câncer de mama: vamos falar sobre isso?")),  # cartaz sem resumo
    ]
    with patch.object(inca.requests, "get", side_effect=respostas) as get:
        resultado = inca.buscar("câncer de mama", 1, "proj_inca")

    assert get.call_args_list[0].kwargs["params"]["rpp"] == 2  # pede o dobro de candidatos
    assert resultado["total_encontrados"] == 2  # handle repetido deduplicado
    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_inca")[0].read_text(encoding="utf-8")
    assert "TITULO: A mulher e o câncer de mama no Brasil" in conteudo
    assert "De doença mutiladora a bom prognóstico." in conteudo
    assert "Assuntos: Neoplasias da Mama" in conteudo


def test_inca_busca_com_resultados_mas_sem_links_vira_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(inca, "NEURAL_DIR", str(tmp_path))
    pagina = '<input name="query"/><div>Results 1-10 of 863</div><a href="/items/7426">novo layout</a>'
    with patch.object(inca.requests, "get", return_value=_resp(pagina)), \
         pytest.raises(RuntimeError, match="INCA mudou o formato"):
        inca.buscar("câncer", 3, "proj_inca_layout")


def test_inca_sem_resultados_nao_e_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(inca, "NEURAL_DIR", str(tmp_path))
    pagina = '<input name="query" value="xqz"/><p>Search produced no results.</p>'
    with patch.object(inca.requests, "get", return_value=_resp(pagina)):
        assert inca.buscar("xqz", 3, "proj_inca_vazio")["total_salvos"] == 0


def test_inca_registro_sem_tabela_de_metadados_nao_grava(tmp_path, monkeypatch):
    monkeypatch.setattr(inca, "NEURAL_DIR", str(tmp_path))
    with patch.object(inca.requests, "get", side_effect=[_resp(_INCA_BUSCA), _resp("<div>outro tema</div>"), _resp("<div>outro tema</div>")]):
        resultado = inca.buscar("câncer", 1, "proj_inca_tabela")
    assert resultado["total_salvos"] == 0
    assert "tabela de metadados" in resultado["erros"][0]["erro"]
    assert _txts(tmp_path, "proj_inca_tabela") == []


# ---------------------------------------------------------------- CAPES Teses

_CAPES_JSON = {
    "pagina": 1, "registrosPorPagina": 1, "total": 10058,
    "tesesDissertacoes": [{
        "id": "13221798", "instituicao": "UNIVERSIDADE DO ESTADO DE MATO GROSSO", "nomePrograma": "Educação",
        "titulo": "PACTO NACIONAL PELA ALFABETIZAÇÃO NA IDADE CERTA (PNAIC)", "autor": "FULANA DE TAL",
        "dataDefesa": "2022-08-15T00:00:00.000Z", "grauAcademico": "Mestrado",
        "link": "https://sucupira.capes.gov.br/sucupira/public/consultas/coleta/trabalhoConclusao/viewTrabalhoConclusao.jsf?popup=true&id_trabalho=13221798",
    }],
}

_SUCUPIRA = (
    '<span id="autor">FULANA DE TAL</span><span id="orientador">CICRANO</span>'
    '<span id="tp_vinc">Servidor P&uacute;blico</span>'
    '<p align="justify"><span id="resumo">Esta disserta&ccedil;&atilde;o analisa o PNAIC\r\nentre 2015 e 2021.</span></p>'
    '<span id="palavras">Pol&iacute;tica P&uacute;blica;PNAIC</span>'
)


def test_capes_teses_monta_texto_sem_dados_pessoais(tmp_path, monkeypatch):
    monkeypatch.setattr(capes_teses, "NEURAL_DIR", str(tmp_path))
    with patch.object(capes_teses.requests, "post", return_value=_resp(json_data=_CAPES_JSON, content_type="application/json")) as post, \
         patch.object(capes_teses.requests, "get", return_value=_resp(_SUCUPIRA)):
        resultado = capes_teses.buscar("alfabetização", 3, "proj_capes")

    assert post.call_args.kwargs["json"]["termo"] == "alfabetização"
    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_capes")[0].read_text(encoding="utf-8")
    for esperado in ("Grau: Mestrado", "Programa: Educação", "Instituição: UNIVERSIDADE DO ESTADO DE MATO GROSSO",
                     "Ano de defesa: 2022", "Palavras-chave: Política Pública; PNAIC",
                     "Esta dissertação analisa o PNAIC entre 2015 e 2021."):
        assert esperado in conteudo
    for pessoal in ("FULANA", "CICRANO", "Servidor Público"):
        assert pessoal not in conteudo


def test_capes_teses_sucupira_sem_resumo_vira_erro_claro(tmp_path, monkeypatch):
    monkeypatch.setattr(capes_teses, "NEURAL_DIR", str(tmp_path))
    with patch.object(capes_teses.requests, "post", return_value=_resp(json_data=_CAPES_JSON, content_type="application/json")), \
         patch.object(capes_teses.requests, "get", return_value=_resp("<div>Nova Plataforma Sucupira (SPA)</div>")), \
         pytest.raises(RuntimeError, match="Sucupira mudou o formato"):
        capes_teses.buscar("alfabetização", 3, "proj_capes_layout")
    assert _txts(tmp_path, "proj_capes_layout") == []


def test_capes_teses_catalogo_devolve_html(tmp_path, monkeypatch):
    monkeypatch.setattr(capes_teses, "NEURAL_DIR", str(tmp_path))
    with patch.object(capes_teses.requests, "post", return_value=_resp("<html>manutenção</html>")), \
         pytest.raises(RuntimeError, match="em vez de JSON"):
        capes_teses.buscar("alfabetização", 3, "proj_capes_html")


# ------------------------------------------------------------------- EduCAPES

_EDU_BUSCA = (
    '<input type="text" id="query" name="query" value="BNCC matemática"/>Resultado 1-2 de 41649.'
    '<a href="/handle/capes/745474">Letramento</a><a href="/handle/11449/302033">Pensar algébrico</a>'
    '<a href="/handle/capes/745474">Letramento (miniatura)</a>'
)

_EDU_ITEM_OK = (
    '<meta name="DC.title" content="Letramento matemático e a Base Nacional Comum Curricular" xml:lang="pt_BR" />'
    '<meta name="DC.description" content="Universidade Estadual Paulista" />'
    '<meta content="' + "A matemática é uma ciência presente em todos os contextos da vida diária. " * 3 + '" name="DC.description" xml:lang="pt_BR" />'
    '<meta name="DC.subject" content="BNCC" /><meta name="DC.type" content="Artigo" />'
)
_EDU_ITEM_SO_AFILIACAO = (
    '<meta name="DC.title" content="Pensar algébrico" /><meta name="DC.description" content="Universidade Estadual Paulista" />'
)


def test_educapes_extrai_descricao_e_ignora_afiliacao(tmp_path, monkeypatch):
    monkeypatch.setattr(educapes, "NEURAL_DIR", str(tmp_path))
    with patch.object(educapes.requests, "get", side_effect=[_resp(_EDU_BUSCA), _resp(_EDU_ITEM_OK), _resp(_EDU_ITEM_SO_AFILIACAO)]):
        resultado = educapes.buscar("BNCC matemática", 2, "proj_edu")

    assert resultado["total_encontrados"] == 2
    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_edu")[0].read_text(encoding="utf-8")
    assert "TITULO: Letramento matemático e a Base Nacional Comum Curricular" in conteudo
    assert "URL_ORIGEM: https://educapes.capes.gov.br/handle/capes/745474" in conteudo
    assert "A matemática é uma ciência" in conteudo
    assert "Universidade Estadual Paulista" not in conteudo
    assert "Tipo: Artigo" in conteudo


def test_educapes_registro_sem_meta_dc_nao_grava(tmp_path, monkeypatch):
    monkeypatch.setattr(educapes, "NEURAL_DIR", str(tmp_path))
    with patch.object(educapes.requests, "get", side_effect=[_resp(_EDU_BUSCA), _resp("<html>novo tema</html>"), _resp("<html>novo tema</html>")]):
        resultado = educapes.buscar("BNCC", 2, "proj_edu_layout")
    assert resultado["total_salvos"] == 0
    assert all("DC.title ausente" in e["erro"] for e in resultado["erros"])
    assert _txts(tmp_path, "proj_edu_layout") == []


def test_educapes_pagina_de_busca_irreconhecivel_vira_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(educapes, "NEURAL_DIR", str(tmp_path))
    with patch.object(educapes.requests, "get", return_value=_resp("<html>Acesso negado</html>")), \
         pytest.raises(RuntimeError, match="EduCAPES mudou o formato"):
        educapes.buscar("BNCC", 2, "proj_edu_bloqueio")


# ----------------------------------------------------------- Senado Discursos

def _senado_lista(pronunciamentos):
    return {"DiscursosSessao": {"Metadados": {}, "Sessoes": {"Sessao": [
        {"CodigoSessao": "1", "DataSessao": "2026-09-25", "Pronunciamentos": {"Pronunciamento": pronunciamentos}},
    ]}}}


_PRON_VACINA = {
    "CodigoPronunciamento": "524245", "Data": "2026-09-25", "TipoAutor": "Senador(a)",
    "NomeAutor": "Fulano Senador", "Partido": "PL", "UF": "DF",
    "Resumo": "Defesa da ampliação da vacinação infantil no SUS.",
    "Indexacao": "VACINAÇÃO, CRIANÇA, SISTEMA UNICO DE SAUDE (SUS).",
    "TextoIntegral": "https://www25.senado.leg.br/web/atividade/pronunciamentos/-/p/texto/524245",
}
_PRON_OUTRO = dict(_PRON_VACINA, CodigoPronunciamento="1", Resumo="Comentários sobre a reforma tributária.", Indexacao="REFORMA TRIBUTARIA.")
_PRON_EXTERNO = dict(_PRON_VACINA, CodigoPronunciamento="2", TipoAutor="Autor Externo", NomeAutor="Convidado Particular",
                     Resumo="Sessão especial sobre vacinação.")


def test_senado_discursos_filtra_localmente_e_salva_integra(tmp_path, monkeypatch):
    monkeypatch.setattr(senado_discursos, "NEURAL_DIR", str(tmp_path))
    lista = _resp(json_data=_senado_lista([_PRON_VACINA, _PRON_OUTRO]), content_type="application/json")
    integra = _resp("    O SR. FULANO SENADOR (PL - DF. Para discursar.) – Sr. Presidente, a vacinação salva vidas.\n\n\n\n    Obrigado.",
                    content_type="text/plain;charset=UTF-8")
    vazio = _resp(json_data={"DiscursosSessao": {"Sessoes": None}}, content_type="application/json")
    with patch.object(senado_discursos.requests, "get", side_effect=[lista, vazio, vazio, integra]) as get:
        resultado = senado_discursos.buscar("Vacinação", 5, "proj_senado")

    urls = [c.args[0] for c in get.call_args_list]
    assert sum("/plenario/lista/discursos/" in u for u in urls) == 3  # padrão: 3 meses = 3 janelas
    assert urls[-1].endswith("/discurso/texto-integral/524245")
    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_senado")[0].read_text(encoding="utf-8")
    assert "TITULO: Fulano Senador (PL/DF) — 25/09/2026 — Defesa da ampliação da vacinação infantil no SUS." in conteudo
    assert "a vacinação salva vidas." in conteudo
    assert "reforma tributária" not in conteudo


def test_senado_discursos_autor_externo_sem_nome_no_titulo():
    assert senado_discursos.titulo_pronunciamento(_PRON_EXTERNO).startswith("Autor externo — 25/09/2026")


def test_senado_discursos_casamento_de_termos():
    termos = senado_discursos.termos_significativos("vacina no SUS")
    assert termos == ["vacina"]  # "no"/"SUS" < 4 letras saem quando há palavra longa
    assert senado_discursos.casa_termos(termos, "Defesa da VACINAÇÃO")
    siglas = senado_discursos.termos_significativos("SUS")
    assert senado_discursos.casa_termos(siglas, "atendimento no SUS")
    assert not senado_discursos.casa_termos(siglas, "questão de ordem suscitada")


def test_senado_discursos_janelas_respeitam_limite_de_um_mes():
    janelas = senado_discursos.janelas_mensais(date(2026, 1, 31), date(2026, 3, 31))
    assert janelas == [(date(2026, 3, 1), date(2026, 3, 31)), (date(2026, 1, 31), date(2026, 2, 28))]
    assert len(senado_discursos.janelas_mensais(date(2020, 1, 1), date(2026, 3, 31))) == 12


def test_senado_discursos_json_inesperado_vira_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(senado_discursos, "NEURAL_DIR", str(tmp_path))
    with patch.object(senado_discursos.requests, "get", return_value=_resp(json_data={"Discursos": []}, content_type="application/json")), \
         pytest.raises(RuntimeError, match="mudou o formato da lista de discursos"):
        senado_discursos.buscar("vacina", 3, "proj_senado_layout")
    assert not (tmp_path / "proj_senado_layout").exists()


# ----------------------------------------------------------- Câmara Discursos

_SITAQ_BUSCA = """
<input type="hidden" name="TotalRecords" value="107" />
<table><tbody class="coresAlternadas">
\t\t\t<tr class="even">
\t\t\t\t<td>14/10/2026</td>
\t\t\t\t<td>164.2026       </td>
\t\t\t\t<td>BREVES COMUNICAÇÕES           </td>
                    <td align="center">
                        <a\t
                            href="TextoHTML.asp?etapa=5
\t\t\t\t\t\t\t&amp;nuDiscurso=1
\t\t\t\t\t\t\t&amp;nuSessao=164.2026
\t\t\t\t\t\t\t&amp;nuQuarto=5466814
\t\t\t\t\t\t\t&amp;Data=14/10/2026
\t\t\t\t\t\t\t&amp;txApelido=Welter
\t\t\t\t\t\t\t&amp;txFaseSessao=Breves Comunicações
\t\t\t\t\t\t\t&amp;txEtapa="
\t\t\t\t\t\t\ttitle="Íntegra do Discurso"><span class="glyphicon glyphicon-file"></span></a>
                    </td>
                    <td align="center"><a class="linkSumario" id="Img1">x</a></td>
                    <td>
                        Welter, PT-PR
                    </td>
\t\t\t\t<td>14h48</td>
\t\t\t\t<td>DCD 15/10/2026</td>
\t\t\t</tr>
\t\t\t<tr class="even" id="Suma1" name="Suma1" style="display: none">
\t\t\t\t<td colspan="8" class="Sumario">Defesa da saúde mental no SUS.</td>
\t\t\t</tr>
</tbody></table>
"""

_SITAQ_TEXTO = (
    "<title>Discurso do(a) Deputado(a) Welter em 14/10/2026 �s 14:48</title>"
    "<! comentei o c�digo abaixo -->"
    "<table><tr><td><h2>C&Acirc;MARA DOS DEPUTADOS - DETAQ</h2></td></tr>"
    "<tr><td> Sess&atilde;o: 164.2026 </td><td>Hora: 14:48</td><td>Fase: BC</td></tr>"
    "<tr><td>Orador: Welter, PT-PR</td><td>Data: 14/10/2026</td></tr></table><hr>"
    "<P align=\"justify\"><p class=\"principalStyle\"><strong>O SR. WELTER </strong>(Bloco/PT - PR.) - "
    "Sr. Presidente, a saúde mental é prioridade do SUS.</p></P>"
)


def test_camara_discursos_monta_busca_e_extrai_integra(tmp_path, monkeypatch):
    monkeypatch.setattr(camara_discursos, "NEURAL_DIR", str(tmp_path))
    busca = _resp(content=_SITAQ_BUSCA.encode("utf-8"))
    texto = _resp(content=_SITAQ_TEXTO.encode("utf-8"))
    with patch.object(camara_discursos.requests, "get", side_effect=[busca, texto]) as get:
        resultado = camara_discursos.buscar("saúde mental", 3, "proj_camara_disc")

    url_busca = get.call_args_list[0].args[0]
    assert "txTexto=saude+and+mental" in url_busca  # sem acento + operador "and"
    assert "TusabBot" not in get.call_args_list[0].kwargs["headers"]["User-Agent"]  # TusabBot leva 429
    url_texto = get.call_args_list[1].args[0]
    assert "txFaseSessao=Breves+Comunica%E7%F5es" in url_texto and "\n" not in url_texto and "\t" not in url_texto

    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_camara_disc")[0].read_text(encoding="utf-8")
    assert "TITULO: Welter, PT-PR — 14/10/2026 — Breves comunicações" in conteudo
    assert "Sumário: Defesa da saúde mental no SUS." in conteudo
    assert "Orador: Welter, PT-PR" in conteudo
    assert "a saúde mental é prioridade do SUS." in conteudo
    assert "�" not in conteudo and "comentei" not in conteudo


def test_camara_discursos_resultados_sem_links_vira_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(camara_discursos, "NEURAL_DIR", str(tmp_path))
    pagina = '<input type="hidden" name="TotalRecords" value="107" /><table><tr class="even"><td>novo layout</td></tr></table>'
    with patch.object(camara_discursos.requests, "get", return_value=_resp(content=pagina.encode())), \
         pytest.raises(RuntimeError, match="SitaqWeb .*mudou o formato"):
        camara_discursos.buscar("vacina", 3, "proj_camara_layout")


def test_camara_discursos_nenhum_resultado(tmp_path, monkeypatch):
    monkeypatch.setattr(camara_discursos, "NEURAL_DIR", str(tmp_path))
    pagina = '<p><span class="labelInfo">Nenhum discurso encontrado.</span></p>'
    with patch.object(camara_discursos.requests, "get", return_value=_resp(content=pagina.encode())):
        assert camara_discursos.buscar("xqz", 3, "proj_camara_vazio")["total_salvos"] == 0


def test_camara_discursos_pagina_de_texto_sem_discurso_nao_grava(tmp_path, monkeypatch):
    monkeypatch.setattr(camara_discursos, "NEURAL_DIR", str(tmp_path))
    with patch.object(camara_discursos.requests, "get", side_effect=[
        _resp(content=_SITAQ_BUSCA.encode("utf-8")), _resp(content=b"<html>Portal da Camara - menu</html>"),
    ]):
        resultado = camara_discursos.buscar("vacina", 3, "proj_camara_texto")
    assert resultado["total_salvos"] == 0
    assert "página do discurso" in resultado["erros"][0]["erro"]
    assert _txts(tmp_path, "proj_camara_texto") == []


# ----------------------------------------------------------------------- ALMG

_ALMG_BUSCA = {"resultado": {"noOcorrencias": 948, "erro": False, "listaItem": [
    {"siglaTipoProjeto": "PL", "numero": "6174", "ano": "2026", "tipoProjeto": "PROJETO DE LEI",
     "ementa": "Institui a política estadual de comunicação acessível.", "autor": "Deputada Fulana                PT\n",
     "situacao": "Anexado", "dataPublicacao": "2026-10-16", "usuario": "m20725", "matricula": "19150\n",
     "indexacao": "/Tema/Direitos Humanos/Acessibilidade\n/Tema/Saúde Pública/Saúde Mental\n",
     "linksTextos": [{"descricao": "Proposição", "url": "/proposicoes/pesquisa/avancada?expr=%28PL.20260617401%5Bcodi%5D%29%5Btxmt%5D&pesqProp=true"}]},
    {"siglaTipoProjeto": "RQC", "numero": "22829", "ano": "2026", "assunto": "Requer audiência pública sobre saúde mental.",
     "indexacao": "/Tema/Saúde Pública\n"},
]}}
_ALMG_TEXTO = {"resultado": {"listaItem": [{"texto": "<style>p{margin:0}</style><p>Projeto\nde Lei nº 6.174/2026</p><p>Art.\n1º – Fica instituída a política.</p>"}]}}


def test_almg_ementa_mais_texto_integral(tmp_path, monkeypatch):
    monkeypatch.setattr(almg, "NEURAL_DIR", str(tmp_path))
    with patch.object(almg.requests, "get", side_effect=[
        _resp(json_data=_ALMG_BUSCA, content_type="application/json"),
        _resp(json_data=_ALMG_TEXTO, content_type="application/json"),
    ]) as get:
        resultado = almg.buscar("saúde mental", 5, "proj_almg")

    assert get.call_args_list[0].kwargs["params"]["expr"] == "saúde mental"
    assert get.call_args_list[1].args[0].startswith("https://dadosabertos.almg.gov.br/api/v2/proposicoes/pesquisa/avancada?expr=")
    assert resultado["total_salvos"] == 2
    conteudos = {p.read_text(encoding="utf-8").splitlines()[0]: p.read_text(encoding="utf-8") for p in _txts(tmp_path, "proj_almg")}
    pl = next(c for t, c in conteudos.items() if "PL 6174/2026" in t)
    assert "Ementa: Institui a política estadual de comunicação acessível." in pl
    assert "Projeto de Lei nº 6.174/2026" in pl and "Art. 1º – Fica instituída a política." in pl
    assert "margin" not in pl and "m20725" not in pl and "19150" not in pl
    assert "URL_ORIGEM: https://www.almg.gov.br/projetos-de-lei/PL/6174/2026" in pl
    rqc = next(c for t, c in conteudos.items() if "RQC 22829/2026" in t)
    assert "Assunto: Requer audiência pública sobre saúde mental." in rqc and "TEXTO INTEGRAL" not in rqc


def test_almg_texto_integral_falha_cai_para_ementa(tmp_path, monkeypatch):
    monkeypatch.setattr(almg, "NEURAL_DIR", str(tmp_path))
    busca = {"resultado": {"noOcorrencias": 1, "listaItem": [_ALMG_BUSCA["resultado"]["listaItem"][0]]}}
    with patch.object(almg.requests, "get", side_effect=[
        _resp(json_data=busca, content_type="application/json"), _resp("<html>erro</html>"),
    ]):
        resultado = almg.buscar("saúde", 5, "proj_almg_falha")
    assert resultado["total_salvos"] == 1
    conteudo = _txts(tmp_path, "proj_almg_falha")[0].read_text(encoding="utf-8")
    assert "Ementa: Institui" in conteudo and "TEXTO INTEGRAL" not in conteudo


def test_almg_resposta_inesperada_vira_erro(tmp_path, monkeypatch):
    monkeypatch.setattr(almg, "NEURAL_DIR", str(tmp_path))
    with patch.object(almg.requests, "get", return_value=_resp(json_data={"dados": []}, content_type="application/json")), \
         pytest.raises(RuntimeError, match="ALMG mudou o formato"):
        almg.buscar("saúde", 3, "proj_almg_layout")
    assert not (tmp_path / "proj_almg_layout").exists()


def test_fonte_meta_completo():
    for mod, area in ((anvisalegis, "saude"), (inca, "saude"), (capes_teses, "educacao"), (educapes, "educacao"),
                      (senado_discursos, "direito"), (camara_discursos, "direito"), (almg, "direito")):
        meta = mod.FONTE_META
        assert meta["area"] == area and meta["requer_auth"] is False
        assert set(meta) == {"id", "nome", "area", "descricao", "requer_auth", "suporta_data", "suporta_autor"}
    assert senado_discursos.FONTE_META["suporta_data"] and camara_discursos.FONTE_META["suporta_data"]
    json.dumps([m.FONTE_META for m in (anvisalegis, inca, capes_teses, educapes, senado_discursos, camara_discursos, almg)])
