# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes da busca de estudos clínicos via FHIR (perfil Pesquisador).
Sem chamada de rede real — requests é mockado.
Escopo restrito a ResearchStudy — nunca Patient ou outro recurso de indivíduo.
"""
import json
from unittest.mock import patch, MagicMock

from tusab_engine.motor import fhir as fhir_motor


# ─── Endpoint ──────────────────────────────────────────────────────────────────

def test_fhir_search_rejeita_sem_projeto(client):
    r = client.post("/fhir/search", json={"query": "diabetes", "projeto_nome": "projeto_inexistente_xyz"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("error") is True


def test_fhir_search_rejeita_query_curta(client):
    r = client.post("/fhir/search", json={"query": "a", "projeto_nome": "qualquer"})
    assert r.status_code == 422  # Pydantic Field(min_length=2)


def test_fhir_status_retorna_estrutura(client):
    r = client.get("/fhir/status")
    assert r.status_code == 200
    body = r.json()
    assert "running" in body
    assert "status" in body


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
    """Servidores de sandbox público frequentemente têm um placeholder vazio
    em vez de narrative real — não deve ser indexado como conteúdo."""
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


# ─── Módulo — buscar_fhir (mockado, sem rede) ──────────────────────────────────

_BUNDLE_MOCK = {
    "resourceType": "Bundle",
    "type": "searchset",
    "total": 1,
    "entry": [
        {
            "fullUrl": "https://hapi.fhir.org/baseR4/ResearchStudy/131284841",
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


def test_buscar_fhir_salva_documento_e_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(fhir_motor, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(fhir_motor, "_INTERVALO_ENTRE_REQUISICOES", 0)

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = _BUNDLE_MOCK

    with patch.object(fhir_motor.requests, "get", return_value=mock_resp):
        resultado = fhir_motor.buscar_fhir(
            query="teste",
            max_resultados=5,
            projeto_nome="projeto_teste_fhir",
        )

    assert resultado["ok"] is True
    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 1
    assert resultado["erros"] == []

    doc_dir = tmp_path / "projeto_teste_fhir" / "documents"
    manifest_path = doc_dir / "_manifest.json"
    assert manifest_path.exists()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert len(manifest) == 1
    assert manifest[0]["fonte_externa"] == "fhir"

    txt_files = list(doc_dir.glob("*.txt"))
    assert len(txt_files) == 1
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "FONTE: fhir" in conteudo
    assert "Resumo do estudo de teste." in conteudo


def test_buscar_fhir_ignora_resource_de_outro_tipo(tmp_path, monkeypatch):
    """Defesa em profundidade: mesmo que o servidor retorne um resource fora do
    resourceType esperado (ex: OperationOutcome de erro), o motor não indexa."""
    monkeypatch.setattr(fhir_motor, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(fhir_motor, "_INTERVALO_ENTRE_REQUISICOES", 0)

    bundle_com_ruido = {
        "resourceType": "Bundle",
        "entry": [
            {"resource": {"resourceType": "OperationOutcome", "id": "err1"}},
            _BUNDLE_MOCK["entry"][0],
        ],
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = bundle_com_ruido

    with patch.object(fhir_motor.requests, "get", return_value=mock_resp):
        resultado = fhir_motor.buscar_fhir(
            query="teste",
            max_resultados=5,
            projeto_nome="projeto_teste_fhir_ruido",
        )

    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 1


def test_buscar_fhir_continua_apos_erro_em_um_item(tmp_path, monkeypatch):
    """Um estudo que falha ao salvar não derruba o lote inteiro."""
    monkeypatch.setattr(fhir_motor, "NEURAL_DIR", str(tmp_path))
    monkeypatch.setattr(fhir_motor, "_INTERVALO_ENTRE_REQUISICOES", 0)

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = _BUNDLE_MOCK

    with patch.object(fhir_motor.requests, "get", return_value=mock_resp), \
         patch.object(fhir_motor, "_sanitizar_nome_arquivo", side_effect=Exception("boom")):
        resultado = fhir_motor.buscar_fhir(
            query="teste",
            max_resultados=5,
            projeto_nome="projeto_teste_fhir_erro",
        )

    assert resultado["ok"] is True
    assert resultado["total_encontrados"] == 1
    assert resultado["total_salvos"] == 0
    assert len(resultado["erros"]) == 1
