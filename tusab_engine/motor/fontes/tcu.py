# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: TCU — Acórdãos do Tribunal de Contas da União. Sem chave de
API, mas a API REST é interna do portal de pesquisa e sem documentação —
o módulo valida o formato e falha com RuntimeError descritivo se mudar.

Endpoints (2 chamadas):
1. GET https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/documentosResumidos
   ?termo=<termo>&ordenacao=DTRELEVANCIA desc&quantidade=<n>&inicio=0
   → `documentos[]` com `KEY` (ex.: "ACORDAO-COMPLETO-2771667"), `TITULO`
   ("ACÓRDÃO 2832/2026 ATA 40/2026 - PLENÁRIO"), `NUMACORDAO`, `ANOACORDAO`,
   `COLEGIADO`, `DATASESSAO`.
2. Por item: GET .../acordao-completo/documento?termo=KEY:"<KEY>"&quantidade=1&inicio=0
   → `SUMARIO`, `ACORDAO`, `VOTO`, `RELATORIO` (HTML → html_para_texto).

Achados ao vivo (20/out/2026):
- O firewall do TCU devolve HTTP 200 com uma página HTML "Requisição
  rejeitada" para alguns User-Agents — usa HEADERS_NAVEGADOR e exige JSON
  (exigir_json) em toda resposta.
- O RELATÓRIO passa de 280 mil caracteres em acórdãos de plenário; a ordem
  sumário → acórdão → voto → relatório garante que o essencial cabe no
  limite de 200.000 caracteres por documento.
- URL pública: https://pesquisa.apps.tcu.gov.br/redireciona/acordao-completo/<KEY>.

LGPD (Lei 13.709/2018): o documento completo traz `INTERESSADOS` (nomes e
CPF parcialmente mascarado dos responsáveis), `ADVOGADO` (nomes e OAB),
`QUORUM` e `RELATOR` — nenhum desses campos é gravado. Achado ao vivo: o
RELATÓRIO e o VOTO repetem os responsáveis no texto corrido ("Responsável 1:
Fulano de Tal (XXX.956.260-XX)", "a audiência dos responsáveis Fulano e
Beltrano"). Por isso os nomes de pessoa de `INTERESSADOS` e `ADVOGADO` são
lidos SÓ EM MEMÓRIA, como dicionário de redação: _lgpd_juridico.py troca
cada ocorrência no texto por "[nome omitido — LGPD]" e mascara CPF e OAB.
Pessoas jurídicas (empresas, órgãos) não são dado pessoal e permanecem.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_NAVEGADOR, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)
from ._lgpd_juridico import extrair_nomes_de_campo, limitar_texto, sanitizar_texto_juridico

FONTE_META = {
    "id": "tcu",
    "nome": "TCU — Acórdãos",
    "area": "direito",
    "descricao": "Acórdãos do Tribunal de Contas da União — sumário, acórdão, voto e relatório, sem dados de responsáveis.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

BASE_URL = "https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/"
RESUMIDOS_URL = BASE_URL + "documentosResumidos"
DOCUMENTO_URL = BASE_URL + "documento"
URL_PUBLICA = "https://pesquisa.apps.tcu.gov.br/redireciona/acordao-completo/{key}"

# Ordem de importância — o relatório (o maior) vai por último.
_SECOES = (("SUMÁRIO", "SUMARIO"), ("ACÓRDÃO", "ACORDAO"), ("VOTO", "VOTO"), ("RELATÓRIO", "RELATORIO"))


def _documentos(resp) -> list:
    dados = exigir_json(resp, "TCU")
    docs = dados.get("documentos") if isinstance(dados, dict) else None
    if not isinstance(docs, list):
        raise RuntimeError(
            "TCU mudou o formato da resposta da pesquisa de acórdãos (campo 'documentos' ausente) "
            "— fonte indisponível até o adaptador ser atualizado"
        )
    return docs


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(RESUMIDOS_URL, params={
        "termo": query, "ordenacao": "DTRELEVANCIA desc",
        "quantidade": max_resultados, "inicio": 0,
    }, headers=HEADERS_NAVEGADOR, timeout=(10, 30))
    resp.raise_for_status()
    itens = [d for d in _documentos(resp) if isinstance(d, dict) and d.get("KEY")][:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(resumo):
        key = resumo["KEY"]
        r = requests.get(DOCUMENTO_URL, params={"termo": f'KEY:"{key}"', "quantidade": 1, "inicio": 0},
                         headers=HEADERS_NAVEGADOR, timeout=(10, 60))
        r.raise_for_status()
        docs = _documentos(r)
        if not docs:
            return None
        doc = docs[0]
        if not any(doc.get(campo) for _, campo in _SECOES):
            raise RuntimeError(f"TCU devolveu o acórdão {key} sem SUMARIO/ACORDAO/VOTO/RELATORIO — formato mudou")

        partes = []
        meta = [f"Colegiado: {doc.get('COLEGIADO')}" if doc.get("COLEGIADO") else "",
                f"Data da sessão: {doc.get('DATASESSAO')}" if doc.get("DATASESSAO") else "",
                f"Tipo de processo: {doc.get('TIPOPROCESSO')}" if doc.get("TIPOPROCESSO") else "",
                f"Assunto: {html_para_texto(doc.get('ASSUNTO') or '')}" if doc.get("ASSUNTO") else ""]
        meta = [m for m in meta if m]
        if meta:
            partes.append("\n".join(meta))
        for rotulo, campo in _SECOES:
            valor = html_para_texto(doc.get(campo) or "")
            if valor:
                partes.append(f"--- {rotulo} ---\n\n{valor}")
        # Nomes de responsáveis/advogados: só dicionário de redação, nunca gravados.
        nomes = extrair_nomes_de_campo(doc.get("INTERESSADOS") or "") | extrair_nomes_de_campo(doc.get("ADVOGADO") or "")
        texto = limitar_texto(sanitizar_texto_juridico("\n\n".join(partes), nomes_extras=nomes))

        numero, ano = doc.get("NUMACORDAO") or resumo.get("NUMACORDAO"), doc.get("ANOACORDAO") or resumo.get("ANOACORDAO")
        colegiado = doc.get("COLEGIADO") or resumo.get("COLEGIADO") or ""
        if numero and ano:
            titulo = f"TCU Acórdão {numero}/{ano}" + (f" — {colegiado}" if colegiado else "")
        else:
            titulo = (doc.get("TITULO") or resumo.get("TITULO") or "Acórdão TCU").strip()
        return {"titulo": titulo, "texto": texto, "url_origem": URL_PUBLICA.format(key=key)}

    return executar_busca_generica(
        itens, extrair, "tcu", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
