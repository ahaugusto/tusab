# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do leitor de arquivos FHIR (ResearchStudy), para o perfil Pesquisador.
Escopo restrito a ResearchStudy — nunca Patient ou outro recurso de indivíduo.

A busca ao vivo (POST /fhir/search) foi removida em 27/jul/2026 — nenhum
servidor FHIR público serve como registro central pesquisável de estudos
clínicos (ver agents/_historia.md). O que sobrou é a leitura de um Bundle
que o usuário já tem em mãos, via upload no Repositório.
"""
import json

from tusab_engine.motor import fhir as fhir_motor


# ─── Módulo — parser de Narrative (text.div) ───────────────────────────────────

def test_limpar_narrative_html_remove_tags():
    div = '<div xmlns="http://www.w3.org/1999/xhtml"><p>Estudo sobre <b>diabetes</b></p></div>'
    limpo = fhir_motor._limpar_narrative_html(div)
    assert "<" not in limpo
    assert "Estudo sobre" in limpo
    assert "diabetes" in limpo


def test_extrair_campo_texto_lida_com_codeable_concept():
    # FHIR usa tanto string simples quanto {text, coding:[...]}
    assert fhir_motor._extrair_campo_texto("texto simples") == "texto simples"
    assert fhir_motor._extrair_campo_texto({"text": "descrição direta"}) == "descrição direta"
    assert fhir_motor._extrair_campo_texto({"coding": [{"display": "Diabetes Mellitus"}]}) == "Diabetes Mellitus"
    assert fhir_motor._extrair_campo_texto(None) == ""
    assert fhir_motor._extrair_campo_texto({}) == ""


def test_parsear_resource_prioriza_narrative_quando_presente():
    resource = {
        "id": "131284841",
        "title": "Estudo de Teste",
        "status": "active",
        "text": {"status": "generated", "div": '<div xmlns="http://www.w3.org/1999/xhtml">Resumo legível do estudo.</div>'},
    }
    item = fhir_motor._parsear_resource(resource)
    assert item["id"] == "131284841"
    assert item["titulo"] == "Estudo de Teste"
    assert "Resumo legível do estudo." in item["texto"]
    assert "Status: active" in item["texto"]


def test_parsear_resource_ignora_narrative_placeholder():
    """Exports com Narrative ausente frequentemente têm um placeholder vazio
    em vez de resumo real — não deve ser indexado como conteúdo."""
    resource = {
        "id": "137048861",
        "status": "completed",
        "text": {"status": "generated", "div": '<div xmlns="http://www.w3.org/1999/xhtml">[Put rendering here]</div>'},
    }
    item = fhir_motor._parsear_resource(resource)
    assert "Put rendering here" not in item["texto"]
    assert "Status: completed" in item["texto"]


def test_parsear_resource_sem_narrative_usa_campos_estruturados():
    resource = {
        "id": "132047712",
        "title": "MemoryLab",
        "status": "active",
        "description": "Estudo sobre memória de curto prazo",
        "condition": [{"text": "Comprometimento cognitivo leve"}],
    }
    item = fhir_motor._parsear_resource(resource)
    assert item["titulo"] == "MemoryLab"
    assert "Descrição: Estudo sobre memória de curto prazo" in item["texto"]
    assert "Condição estudada: Comprometimento cognitivo leve" in item["texto"]


def test_parsear_resource_sem_titulo_usa_fallback_com_id():
    resource = {"id": "999", "status": "active"}
    item = fhir_motor._parsear_resource(resource)
    assert "999" in item["titulo"]


# ─── Módulo — processar_bundle_fhir (leitura de arquivo, sem rede) ─────────────

_BUNDLE_MOCK = {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
        {
            "resource": {
                "resourceType": "ResearchStudy",
                "id": "131284841",
                "title": "Estudo de Teste",
                "status": "active",
                "text": {"status": "generated", "div": '<div xmlns="http://www.w3.org/1999/xhtml">Resumo do estudo de teste.</div>'},
            },
        }
    ],
}


def test_processar_bundle_fhir_extrai_texto_e_total():
    texto, total = fhir_motor.processar_bundle_fhir(json.dumps(_BUNDLE_MOCK).encode("utf-8"))
    assert total == 1
    assert "Estudo de Teste" in texto
    assert "Resumo do estudo de teste." in texto


def test_processar_bundle_fhir_aceita_resource_isolado_sem_bundle():
    resource_isolado = _BUNDLE_MOCK["entry"][0]["resource"]
    texto, total = fhir_motor.processar_bundle_fhir(json.dumps(resource_isolado).encode("utf-8"))
    assert total == 1
    assert "Estudo de Teste" in texto


def test_processar_bundle_fhir_ignora_resource_de_outro_tipo():
    """Defesa em profundidade: um resource fora do resourceType esperado
    (ex: OperationOutcome) dentro do Bundle não é indexado."""
    bundle_com_ruido = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "OperationOutcome", "id": "err1"}},
            _BUNDLE_MOCK["entry"][0],
        ],
    }
    texto, total = fhir_motor.processar_bundle_fhir(json.dumps(bundle_com_ruido).encode("utf-8"))
    assert total == 1
    assert "Estudo de Teste" in texto


def test_processar_bundle_fhir_multiplos_estudos_concatena_com_separador():
    bundle_multiplo = {
        "resourceType": "Bundle",
        "entry": [
            _BUNDLE_MOCK["entry"][0],
            {"resource": {"resourceType": "ResearchStudy", "id": "999", "title": "Segundo Estudo", "status": "completed"}},
        ],
    }
    texto, total = fhir_motor.processar_bundle_fhir(json.dumps(bundle_multiplo).encode("utf-8"))
    assert total == 2
    assert "Estudo de Teste" in texto
    assert "Segundo Estudo" in texto


def test_processar_bundle_fhir_rejeita_json_nao_fhir():
    import pytest
    with pytest.raises(ValueError):
        fhir_motor.processar_bundle_fhir(json.dumps({"foo": "bar"}).encode("utf-8"))


def test_processar_bundle_fhir_rejeita_bundle_sem_researchstudy():
    import pytest
    bundle_vazio = {"resourceType": "Bundle", "entry": [{"resource": {"resourceType": "Patient", "id": "1"}}]}
    with pytest.raises(ValueError):
        fhir_motor.processar_bundle_fhir(json.dumps(bundle_vazio).encode("utf-8"))


# ─── Integração — upload de .json no Repositório ───────────────────────────────

def test_upload_json_fhir_bundle_persiste_formato_detectado_no_manifest(client):
    nome_projeto = "projeto_fhir_pytest"
    client.post("/neural/projeto", json={"nome": nome_projeto})

    r = client.post(
        "/neural/upload",
        data={"canal": nome_projeto},
        files={"arquivo": ("estudo.json", json.dumps(_BUNDLE_MOCK).encode("utf-8"), "application/json")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
    assert "Bundle FHIR" in body.get("aviso", "")

    repo = client.get("/repositorio").json()
    canal = next(c for c in repo["canais"] if c["nome"] == nome_projeto)
    doc = next(d for d in canal["documentos"] if d["nome_original"] == "estudo.json")
    assert doc["formato_detectado"] == "fhir_bundle"


def test_upload_json_nao_fhir_retorna_erro(client):
    nome_projeto = "projeto_json_generico_pytest"
    client.post("/neural/projeto", json={"nome": nome_projeto})

    r = client.post(
        "/neural/upload",
        data={"canal": nome_projeto},
        files={"arquivo": ("config.json", json.dumps({"foo": "bar"}).encode("utf-8"), "application/json")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True
