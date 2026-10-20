# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: STF — Jurisprudência (acórdãos do Supremo Tribunal Federal).
Sem chave de API, mas a API é interna do portal e não tem documentação
oficial — o formato pode mudar sem aviso. Por isso o módulo valida a
estrutura da resposta e falha com RuntimeError descritivo, nunca grava lixo.

Endpoint: POST https://jurisprudencia.stf.jus.br/api/search/search com corpo
Elasticsearch em JSON (enviado com `json=`, UTF-8 — o corpo em latin-1 deu
403). Hits em `result.hits.hits[]._source`.

Achados ao vivo (20/out/2026):
- A busca é restrita aos campos `ementa_texto` e `documental_indexacao_texto`;
  buscar também no inteiro teor traz acórdãos fora do tema.
- O analisador padrão faz stemming agressivo: "saneamento" casa "despacho
  SANEADOR" (1.021 hits; nos 100 primeiros, só 3 citam saneamento). Achado:
  existe o subcampo `.standard` (sem stemming, sem acento, sem caixa) — em
  `ementa_texto.standard` + `documental_indexacao_texto.standard` a mesma
  busca dá 380 hits, 100% sobre saneamento. É a busca principal. Se ela não
  achar nada (ex.: termo no plural e ementa no singular), cai para os campos
  com stemming com filtro local pelo radical de cada palavra (_termos_busca.py).
- Busca em duas fases: (1) candidatos leves (só id/ementa/indexação);
  (2) documento completo só dos escolhidos, por id.
- `inteiro_teor_texto` já vem na resposta (10-70 mil caracteres por acórdão
  recente; nulo em acórdãos antigos, que ficam só com ementa).
- Título montado de `titulo` (ex.: "ARE 1527985 RG") + órgão julgador + data.
- URL pública da decisão: https://jurisprudencia.stf.jus.br/pages/search/{id}/false.

LGPD (Lei 13.709/2018): a resposta traz `partes_lista_texto` (nomes de
recorrentes, recorridos e advogados). Esse campo é excluído já na consulta
(lista branca em `_source`) e nunca chega ao módulo; nomes de relator/revisor
também não são gravados. Achado ao vivo: o inteiro teor repete o cabeçalho
com as partes em colunas no início de CADA seção (relatório, voto, votos dos
demais ministros) e de novo no extrato de ata — _lgpd_juridico.py remove
todos esses blocos, usa os nomes de pessoa colhidos neles para redigir as
menções no texto corrido e mascara CPF e números de OAB. Texto limitado a
200.000 caracteres.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica, exigir_json, resultado_vazio
from ._lgpd_juridico import limitar_texto, sanitizar_texto_juridico
from ._termos_busca import contem_todas, normalizar, palavras_significativas

FONTE_META = {
    "id": "stf",
    "nome": "STF — Jurisprudência",
    "area": "direito",
    "descricao": "Acórdãos do Supremo Tribunal Federal — ementa, decisão e inteiro teor, sem dados das partes.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": False,
}

SEARCH_URL = "https://jurisprudencia.stf.jus.br/api/search/search"
URL_PUBLICA = "https://jurisprudencia.stf.jus.br/pages/search/{id}/false"
_CAMPOS_BUSCA_EXATA = ["ementa_texto.standard", "documental_indexacao_texto.standard"]
_CAMPOS_BUSCA_RADICAL = ["ementa_texto", "documental_indexacao_texto"]

# Lista branca: só estes campos saem do servidor do STF (LGPD — nada de partes).
_CAMPOS_DOCUMENTO = [
    "id", "titulo", "processo_classe_processual_unificada_extenso", "orgao_julgador",
    "julgamento_data", "publicacao_data", "ementa_texto", "acordao_ata",
    "documental_indexacao_texto", "documental_tese_texto", "inteiro_teor_texto",
]
_CAMPOS_CANDIDATO = ["id", "ementa_texto", "documental_indexacao_texto"]


def _corpo(query: str, data_inicio: str, data_fim: str, tamanho: int, campos: list,
           ids: list = None, campos_busca: list = None) -> dict:
    filtros = [{"term": {"base": "acordaos"}}]
    if ids:
        filtros.append({"terms": {"id": ids}})
    if data_inicio or data_fim:
        faixa = {}
        if data_inicio:
            faixa["gte"] = data_inicio
        if data_fim:
            faixa["lte"] = data_fim
        filtros.append({"range": {"julgamento_data": faixa}})
    corpo = {"query": {"bool": {"filter": filtros}}, "size": tamanho, "_source": campos}
    if not ids:
        corpo["query"]["bool"]["must"] = [{"simple_query_string": {
            "query": query, "fields": campos_busca or _CAMPOS_BUSCA_EXATA, "default_operator": "and",
        }}]
    return corpo


def _hits(resp) -> list:
    """Extrai result.hits.hits[]._source validando o formato — API sem documentação."""
    dados = exigir_json(resp, "STF")
    try:
        hits = dados["result"]["hits"]["hits"]
        if not isinstance(hits, list):
            raise TypeError
        return [h["_source"] for h in hits]
    except (KeyError, TypeError) as e:
        raise RuntimeError(
            "STF mudou o formato da resposta da busca de jurisprudência "
            "(esperado result.hits.hits[]._source) — fonte indisponível até o adaptador ser atualizado"
        ) from e


def _post(corpo: dict, timeout):
    resp = requests.post(SEARCH_URL, json=corpo, headers={"Accept": "application/json"}, timeout=timeout)
    resp.raise_for_status()
    return _hits(resp)


def _montar_texto(doc: dict) -> str:
    partes = []
    classe = (doc.get("processo_classe_processual_unificada_extenso") or "").strip()
    meta = [f"Classe: {classe}" if classe else "",
            f"Órgão julgador: {doc.get('orgao_julgador')}" if doc.get("orgao_julgador") else "",
            f"Julgamento: {doc.get('julgamento_data')}" if doc.get("julgamento_data") else "",
            f"Publicação: {doc.get('publicacao_data')}" if doc.get("publicacao_data") else ""]
    meta = [m for m in meta if m]
    if meta:
        partes.append("\n".join(meta))
    for rotulo, campo in (("EMENTA", "ementa_texto"), ("DECISÃO", "acordao_ata"),
                          ("TESE", "documental_tese_texto"), ("INDEXAÇÃO", "documental_indexacao_texto"),
                          ("INTEIRO TEOR", "inteiro_teor_texto")):
        valor = doc.get(campo)
        if isinstance(valor, list):
            valor = "\n".join(str(v) for v in valor if v)
        valor = (valor or "").strip()
        if valor:
            partes.append(f"--- {rotulo} ---\n\n{valor}")
    return limitar_texto(sanitizar_texto_juridico("\n\n".join(partes)))


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    # Fase 1 — candidatos leves (sem inteiro teor). Principal: campos .standard (sem stemming).
    candidatos = _post(_corpo(query, data_inicio, data_fim, max_resultados, _CAMPOS_CANDIDATO), timeout=(10, 30))
    ids = [c["id"] for c in candidatos if c.get("id")][:max_resultados]
    if not ids:
        # Fallback: campos com stemming + filtro local pelo radical (descarta "saneador").
        candidatos = _post(
            _corpo(query, data_inicio, data_fim, min(max_resultados * 4, 100), _CAMPOS_CANDIDATO,
                   campos_busca=_CAMPOS_BUSCA_RADICAL),
            timeout=(10, 30),
        )
        palavras = palavras_significativas(query)
        for c in candidatos:
            texto_c = normalizar(f"{c.get('ementa_texto') or ''} {c.get('documental_indexacao_texto') or ''}")
            if (not palavras or contem_todas(texto_c, palavras)) and c.get("id"):
                ids.append(c["id"])
            if len(ids) >= max_resultados:
                break
    if not ids:
        return resultado_vazio()

    # Fase 2 — documento completo dos escolhidos (inteiro teor vem junto).
    docs = _post(_corpo(query, "", "", len(ids), _CAMPOS_DOCUMENTO, ids=ids), timeout=(10, 60))
    por_id = {d.get("id"): d for d in docs}
    itens = [por_id[i] for i in ids if i in por_id]

    def extrair(doc):
        texto = _montar_texto(doc)
        if not texto.strip():
            return None
        titulo = (doc.get("titulo") or "Acórdão STF").strip()
        complemento = " — ".join(x for x in (doc.get("orgao_julgador"), doc.get("julgamento_data")) if x)
        if complemento:
            titulo = f"STF {titulo} — {complemento}"
        return {"titulo": titulo, "texto": texto, "url_origem": URL_PUBLICA.format(id=doc.get("id"))}

    # Sem rede por item (tudo veio na fase 2) — sem throttle.
    return executar_busca_generica(
        itens, extrair, "stf", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
