# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Senado Federal — projetos e matérias (proposições
legislativas). Complementa senado_leis.py (leis já publicadas) e camara.py
(proposições da Câmara). Sem chave de API.

Endpoint: GET https://legis.senado.leg.br/dadosabertos/processo?termo=<termo>
com `Accept: application/json` (sem o cabeçalho a resposta vem em XML).
Detalhe por item: GET .../dadosabertos/processo/{id} (traz `documento.indexacao`).

Achados ao vivo (20/out/2026) — corrigem a nota antiga de camara.py, que
dava este endpoint como "sem filtro por palavra-chave":
- `termo` FILTRA de verdade: "saneamento" → 53 matérias; termo inexistente → 0.
- Sem datas, o servidor devolve só matérias EM TRAMITAÇÃO (todas com
  `tramitando: "Sim"`, de 2001 a 2026) — exatamente o recorte desta fonte.
- Com `dataInicioApresentacao`/`dataFimApresentacao`, devolve matérias
  apresentadas no período (tramitando ou não), mas o período máximo é de UM
  ano (HTTP 400 "Limite o período a um ano"). Quando o usuário informa
  datas, o módulo percorre janelas de 1 ano, da mais recente para a mais
  antiga (até 10 janelas).
- Resultado vem em ordem crescente de data: o módulo reordena pelas mais
  recentes, com proposições normativas (PL, PLP, PEC, MPV, PDL, PRS) antes
  de requerimentos, ofícios e mensagens.
- Ementa curta (~300 caracteres). Texto = ementa + indexação temática do
  detalhe + link do texto oficial em PDF (`urlDocumento`, não baixado).

LGPD (Lei 13.709/2018): autoria e signatários (`autoria`, `autoriaIniciativa`)
não são gravados — só o conteúdo da proposição, mesmo critério de camara.py.
"""

import os
from datetime import date, timedelta

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, exigir_json, resultado_vazio

FONTE_META = {
    "id": "senado_materias",
    "nome": "Senado Federal — Projetos e matérias",
    "area": "direito",
    "descricao": "Projetos de lei, PECs, MPs e demais matérias em tramitação no Senado — ementa e indexação temática.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

PROCESSO_URL = "https://legis.senado.leg.br/dadosabertos/processo"
DETALHE_URL = "https://legis.senado.leg.br/dadosabertos/processo/{id}"
URL_PUBLICA = "https://www25.senado.leg.br/web/atividade/materias/-/materia/{codigo}"
_HEADERS = {"Accept": "application/json"}
_MAX_JANELAS = 10
_SIGLAS_NORMATIVAS = ("PL ", "PLS ", "PLP ", "PEC ", "MPV ", "PDL ", "PRS ", "PLV ", "PDS ")


def _consultar(params: dict) -> list:
    resp = requests.get(PROCESSO_URL, params=params, headers=_HEADERS, timeout=(10, 30))
    resp.raise_for_status()
    dados = exigir_json(resp, "Senado Federal")
    if not isinstance(dados, list):
        raise RuntimeError("Senado Federal mudou o formato de /dadosabertos/processo (esperada uma lista de matérias)")
    return [d for d in dados if isinstance(d, dict)]


def _janelas(data_inicio: str, data_fim: str) -> list:
    """Janelas de até 1 ano (limite do servidor), da mais recente para a mais antiga."""
    fim = date.fromisoformat(data_fim) if data_fim else date.today()
    ini = date.fromisoformat(data_inicio) if data_inicio else fim - timedelta(days=364)
    janelas = []
    while fim >= ini and len(janelas) < _MAX_JANELAS:
        comeco = max(ini, fim - timedelta(days=364))
        janelas.append((comeco.isoformat(), fim.isoformat()))
        fim = comeco - timedelta(days=1)
    return janelas


def _ordenar(materias: list) -> list:
    """Mais recentes primeiro; proposições normativas antes de requerimentos,
    ofícios e mensagens (sort estável em duas passadas)."""
    por_data = sorted(materias, key=lambda m: m.get("dataApresentacao") or "", reverse=True)
    return sorted(por_data, key=lambda m: 0 if (m.get("identificacao") or "").startswith(_SIGLAS_NORMATIVAS) else 1)


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    if data_inicio or data_fim:
        materias, vistos = [], set()
        for ini, fim in _janelas(data_inicio, data_fim):
            if evento_cancelar is not None and evento_cancelar.is_set():
                break
            lote = _consultar({"termo": query, "dataInicioApresentacao": ini, "dataFimApresentacao": fim})
            novos = [m for m in lote if m.get("id") not in vistos]
            vistos.update(m.get("id") for m in novos)
            materias.extend(_ordenar(novos))
            if len(materias) >= max_resultados:
                break
    else:
        materias = _ordenar(_consultar({"termo": query}))

    itens = materias[:max_resultados]
    if not itens:
        return resultado_vazio()

    def extrair(item):
        ementa = (item.get("ementa") or "").strip()
        if not ementa:
            return None
        indexacao, explicacao = "", ""
        try:
            det = requests.get(DETALHE_URL.format(id=item["id"]), headers=_HEADERS, timeout=(10, 30))
            if det.ok and "json" in det.headers.get("Content-Type", "").lower():
                d = det.json()
                indexacao = ((d.get("documento") or {}).get("indexacao") or "").strip()
                explicacao = ((d.get("conteudo") or {}).get("explicacaoEmenta") or "").strip()
        except (requests.RequestException, ValueError, AttributeError):
            pass  # detalhe é enriquecimento — sem ele, fica a ementa

        linhas = [
            f"Tipo: {item.get('tipoDocumento')}" if item.get("tipoDocumento") else "",
            f"Apresentação: {item.get('dataApresentacao')}" if item.get("dataApresentacao") else "",
            f"Situação atual: {item.get('situacaoAtual')}" if item.get("situacaoAtual") else "",
            f"Em tramitação: {item.get('tramitando')}" if item.get("tramitando") else "",
        ]
        partes = ["\n".join(l for l in linhas if l), f"--- EMENTA ---\n\n{ementa}"]
        if explicacao:
            partes.append(f"--- EXPLICAÇÃO DA EMENTA ---\n\n{explicacao}")
        if indexacao:
            partes.append(f"--- INDEXAÇÃO ---\n\n{indexacao.strip(' .')}")
        if item.get("urlDocumento"):
            partes.append(f"Texto (PDF): {item['urlDocumento']}")

        titulo = f"Senado {item.get('identificacao') or 'Matéria'}"
        codigo = item.get("codigoMateria")
        url = URL_PUBLICA.format(codigo=codigo) if codigo else (item.get("urlDocumento") or "")
        return {"titulo": titulo, "texto": "\n\n".join(p for p in partes if p), "url_origem": url}

    return executar_busca_generica(
        itens, extrair, "senado_materias", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0.5,
    )
