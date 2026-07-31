# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes dos adaptadores da área "Saúde, biologia e genética" — PubMed,
ClinicalTrials.gov, UniProt. Escopo restrito a literatura/estudos/proteínas
— nunca dado de paciente individual (mesmo invariante de fhir.py). Sem
chamada de rede real — requests é mockado.
"""
from unittest.mock import MagicMock, patch

from tusab_engine.motor import fontes as fontes_registry
from tusab_engine.motor.fontes import clinicaltrials, pubmed, uniprot


def test_area_saude_registrada():
    areas = fontes_registry.listar_fontes()
    assert "saude" in areas
    ids = {f["id"] for f in areas["saude"]["fontes"]}
    assert ids == {"pubmed", "clinicaltrials", "uniprot", "europepmc", "openfda"}


# ─── PubMed ──────────────────────────────────────────────────────────────────

_PUBMED_XML_MOCK = b"""<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>12345</PMID>
      <Article>
        <ArticleTitle>HIV Stigma Study</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Contexto real do estudo.</AbstractText>
          <AbstractText Label="RESULTS">Resultados reais encontrados.</AbstractText>
        </Abstract>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>
"""


def test_pubmed_concatena_secoes_do_abstract(tmp_path, monkeypatch):
    monkeypatch.setattr(pubmed, "NEURAL_DIR", str(tmp_path))
    mock_esearch = MagicMock()
    mock_esearch.raise_for_status = MagicMock()
    mock_esearch.json.return_value = {"esearchresult": {"idlist": ["12345"]}}
    mock_efetch = MagicMock(content=_PUBMED_XML_MOCK)
    mock_efetch.raise_for_status = MagicMock()

    with patch.object(pubmed.requests, "get", side_effect=[mock_esearch, mock_efetch]):
        resultado = pubmed.buscar(query="hiv stigma", max_resultados=5, projeto_nome="projeto_pubmed")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_pubmed" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Contexto real do estudo." in conteudo
    assert "Resultados reais encontrados." in conteudo
    assert "URL_ORIGEM: https://pubmed.ncbi.nlm.nih.gov/12345/" in conteudo


def test_pubmed_sem_resultados_nao_chama_efetch(tmp_path, monkeypatch):
    monkeypatch.setattr(pubmed, "NEURAL_DIR", str(tmp_path))
    mock_esearch = MagicMock()
    mock_esearch.raise_for_status = MagicMock()
    mock_esearch.json.return_value = {"esearchresult": {"idlist": []}}

    with patch.object(pubmed.requests, "get", return_value=mock_esearch) as mock_get:
        resultado = pubmed.buscar(query="termo_sem_resultado_nenhum", max_resultados=5, projeto_nome="projeto_pubmed2")

    assert resultado["total_salvos"] == 0
    assert mock_get.call_count == 1  # só o esearch, sem efetch


# ─── ClinicalTrials.gov ──────────────────────────────────────────────────────

def test_clinicaltrials_junta_summary_e_detailed(tmp_path, monkeypatch):
    monkeypatch.setattr(clinicaltrials, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "studies": [{
            "protocolSection": {
                "identificationModule": {"briefTitle": "Estudo de Teste", "nctId": "NCT001"},
                "descriptionModule": {"briefSummary": "Resumo breve.", "detailedDescription": "Descrição detalhada."},
            }
        }]
    }

    with patch.object(clinicaltrials.requests, "get", return_value=mock_resp):
        resultado = clinicaltrials.buscar(query="hiv", max_resultados=5, projeto_nome="projeto_ct")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_ct" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Resumo breve." in conteudo
    assert "Descrição detalhada." in conteudo
    assert "URL_ORIGEM: https://clinicaltrials.gov/study/NCT001" in conteudo


def test_clinicaltrials_pula_estudo_sem_descricao(tmp_path, monkeypatch):
    monkeypatch.setattr(clinicaltrials, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"studies": [{"protocolSection": {"identificationModule": {}, "descriptionModule": {}}}]}

    with patch.object(clinicaltrials.requests, "get", return_value=mock_resp):
        resultado = clinicaltrials.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_ct2")

    assert resultado["total_salvos"] == 0


# ─── UniProt ─────────────────────────────────────────────────────────────────

def test_uniprot_extrai_comentario_de_funcao(tmp_path, monkeypatch):
    monkeypatch.setattr(uniprot, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "results": [{
            "primaryAccession": "P01308",
            "proteinDescription": {"recommendedName": {"fullName": {"value": "Insulin"}}},
            "comments": [
                {"commentType": "SUBUNIT", "texts": [{"value": "Irrelevante."}]},
                {"commentType": "FUNCTION", "texts": [{"value": "Decreases blood glucose concentration."}]},
            ],
        }]
    }

    with patch.object(uniprot.requests, "get", return_value=mock_resp):
        resultado = uniprot.buscar(query="insulin", max_resultados=5, projeto_nome="projeto_uniprot")

    assert resultado["total_salvos"] == 1
    txt_files = list((tmp_path / "projeto_uniprot" / "documents").glob("*.txt"))
    conteudo = txt_files[0].read_text(encoding="utf-8")
    assert "Decreases blood glucose concentration." in conteudo
    assert "Irrelevante." not in conteudo
    assert "TITULO: Insulin" in conteudo


def test_uniprot_pula_proteina_sem_comentario_de_funcao(tmp_path, monkeypatch):
    monkeypatch.setattr(uniprot, "NEURAL_DIR", str(tmp_path))
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"results": [{"primaryAccession": "X1", "comments": []}]}

    with patch.object(uniprot.requests, "get", return_value=mock_resp):
        resultado = uniprot.buscar(query="qualquer", max_resultados=5, projeto_nome="projeto_uniprot2")

    assert resultado["total_salvos"] == 0
