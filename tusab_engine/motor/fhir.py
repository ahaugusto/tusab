# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Leitor de arquivos FHIR (ResearchStudy), para o perfil Pesquisador.

Avaliado em `agents/_historia.md` (seção "FHIR — formato viável para fonte de
dados clínicos"). Escopo deliberadamente restrito ao resource type ResearchStudy
— nunca Patient ou qualquer outro recurso que modele dados de indivíduo, mesmo
sintético/teste: o perfil Pesquisador B2C é "RAG sobre PDFs/docs/arXiv com
privacidade absoluta", sem contexto clínico de paciente.

Este módulo já teve uma busca ao vivo contra o servidor público de referência
HAPI FHIR (hapi.fhir.org/baseR4) — removida em 27/jul/2026 após uso real
confirmar que nenhum servidor FHIR público serve como registro central
pesquisável de estudos clínicos (ver histórico). `ResearchStudy` é um formato
de *interoperabilidade*: cada instituição usa pra expor os próprios estudos,
não existe um "arXiv do FHIR" agregando conteúdo de terceiros.

O que sobrou é o que sempre teve valor real: ler um Bundle FHIR que o próprio
usuário já tem em mãos (export de uma instituição/universidade com acesso
legítimo) — mesmo padrão de leitura de PDF/DOCX/WhatsApp já existente no
Repositório (`router_repositorio.py::cerebro_upload()`). Todo recurso FHIR tem
um campo padronizado `text.div` (Narrative) — resumo em HTML pra leitura
humana — que dispensa parsear o schema JSON tipado inteiro.
"""

import html
import re

RESOURCE_TYPE = "ResearchStudy"

_DIV_TAG_RE = re.compile(r'<[^>]+>')


def _limpar_narrative_html(div: str) -> str:
    """Remove tags do Narrative (text.div) preservando o texto legível."""
    texto = _DIV_TAG_RE.sub(' ', div or '')
    texto = html.unescape(texto)
    return re.sub(r'\s+', ' ', texto).strip()


def _extrair_campo_texto(valor) -> str:
    """FHIR usa tanto string simples quanto CodeableConcept ({text, coding:[...]}) —
    normaliza os dois formatos para texto simples."""
    if not valor:
        return ""
    if isinstance(valor, str):
        return valor.strip()
    if isinstance(valor, dict):
        if valor.get("text"):
            return str(valor["text"]).strip()
        codings = valor.get("coding") or []
        textos = [c.get("display") or c.get("code") for c in codings if c.get("display") or c.get("code")]
        return "; ".join(t for t in textos if t)
    if isinstance(valor, list):
        return "; ".join(_extrair_campo_texto(v) for v in valor if v)
    return ""


def _parsear_resource(resource: dict) -> dict:
    """Extrai {id, titulo, texto, status, publicado} de um resource ResearchStudy.

    Prioriza o Narrative (text.div) quando presente; sempre concatena os campos
    estruturados disponíveis (status, description, condition) — fallback gracioso
    para exports com Narrative ausente ou vazio.
    """
    rid = str(resource.get("id") or "")
    titulo = (resource.get("title") or "").strip()

    partes = []

    narrative = (resource.get("text") or {}).get("div", "")
    narrative_limpo = _limpar_narrative_html(narrative)
    if narrative_limpo and "put rendering here" not in narrative_limpo.lower():
        partes.append(narrative_limpo)

    status = resource.get("status") or ""
    if status:
        partes.append(f"Status: {status}")

    descricao = _extrair_campo_texto(resource.get("description"))
    if descricao:
        partes.append(f"Descrição: {descricao}")

    condicao = _extrair_campo_texto(resource.get("condition"))
    if condicao:
        partes.append(f"Condição estudada: {condicao}")

    publicado = ((resource.get("meta") or {}).get("lastUpdated") or "")[:10]

    return {
        "id": rid,
        "titulo": titulo or f"ResearchStudy {rid}",
        "texto": "\n\n".join(partes),
        "status": status,
        "publicado": publicado,
    }


def processar_bundle_fhir(conteudo_bytes: bytes) -> tuple[str, int]:
    """Extrai texto pesquisável de um arquivo FHIR — Bundle (searchset/collection)
    contendo um ou mais ResearchStudy, ou um resource ResearchStudy isolado.

    [CONTRATO] Chamado por cerebro_upload() (router_repositorio.py) quando o
    arquivo enviado tem extensão .json — mesmo padrão de "extrair todo campo
    disponível com fallback gracioso" usado no parser de WhatsApp/Reuniões.
    Estudos múltiplos no mesmo Bundle viram um único texto concatenado, com
    separador entre eles (um upload = um documento, mesma regra dos demais
    formatos aceitos).

    Retorna (texto, total_estudos). Levanta ValueError se o JSON não for um
    Bundle FHIR nem um ResearchStudy — sinal de que o arquivo não é o que essa
    extensão espera, tratado como erro de upload pelo chamador.
    """
    import json

    dados = json.loads(conteudo_bytes)

    if isinstance(dados, dict) and dados.get("resourceType") == "Bundle":
        resources = [(entry.get("resource") or {}) for entry in dados.get("entry", [])]
    elif isinstance(dados, dict) and dados.get("resourceType") == RESOURCE_TYPE:
        resources = [dados]
    else:
        raise ValueError("Arquivo não reconhecido como Bundle FHIR ou ResearchStudy.")

    estudos = [_parsear_resource(r) for r in resources if r.get("resourceType") == RESOURCE_TYPE]
    if not estudos:
        raise ValueError("Nenhum ResearchStudy encontrado no arquivo FHIR.")

    blocos = [
        f"## {item['titulo']}\n\n{item['texto'] or '[Sem descrição textual disponível no recurso]'}"
        for item in estudos
    ]
    return ("\n\n" + "-" * 40 + "\n\n").join(blocos), len(estudos)
