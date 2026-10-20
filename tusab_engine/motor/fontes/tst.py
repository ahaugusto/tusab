# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: TST — Jurisprudência (acórdãos do Tribunal Superior do
Trabalho). Sem chave de API, mas a API é interna do portal e sem
documentação — o módulo valida o formato e falha com RuntimeError
descritivo se mudar.

Endpoint: POST https://jurisprudencia-backend.tst.jus.br/rest/pesquisa-textual/1/<n>
(página 1, <n> itens por página) com JSON {"e": <termo>, "tipos": ["ACORDAO"],
"orgao": "TST"}. Resposta: `totalRegistros`, `registros[].registro`.

Achados ao vivo (20/out/2026):
- Corpo mínimo: sem `tipos` o servidor ignora o termo e devolve o acervo
  inteiro (8,6 milhões); `orgao` sozinho não filtra, mas é mantido.
- `e` é "todas as palavras" em qualquer ponto do inteiro teor: "inteligência
  artificial" → 5.243 acórdãos, a maioria só citando "inteligência do art.";
  entre aspas (frase exata) → 327. Por isso termo de várias palavras é
  enviado primeiro como frase; se a frase não acha nada, cai para "todas
  as palavras". Termos genéricos ("saneamento", 106 mil) inflam o total —
  comportamento do servidor, não do módulo.
- Cada registro pesa ~250 KB (inteiro teor em HTML duas vezes, com e sem
  destaque) — o módulo pede no máximo 5 por página e pagina.
- Texto: `ementa` (texto puro) + `dispositivo` + `inteiroTeorHtml` (→ html_para_texto).

LGPD (Lei 13.709/2018): o registro traz `codCPFSignatario` (CPF do ministro
signatário) e o nome do relator — nenhum dos dois é lido. O inteiro teor
repete a qualificação das partes ("em que é Recorrente FULANO e Recorrido
EMPRESA"): o bloco é redigido por _lgpd_juridico.py, que também mascara CPF
e números de OAB. Texto limitado a 200.000 caracteres.
"""

import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import (
    HEADERS_TUSABBOT, MAX_RESULTADOS_PERMITIDO, executar_busca_generica,
    exigir_json, html_para_texto, resultado_vazio,
)
from ._lgpd_juridico import limitar_texto, sanitizar_texto_juridico

FONTE_META = {
    "id": "tst",
    "nome": "TST — Jurisprudência",
    "area": "direito",
    "descricao": "Acórdãos do Tribunal Superior do Trabalho — ementa, dispositivo e inteiro teor, sem dados das partes.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://jurisprudencia-backend.tst.jus.br/rest/pesquisa-textual/{pagina}/{tamanho}"
URL_PROCESSO = (
    "https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do"
    "?consulta=Consultar&conscsjt=&numeroTst={numero}&digitoTst={digito:02d}&anoTst={ano}"
    "&orgaoTst={orgao}&tribunalTst={tribunal:02d}&varaTst={vara:04d}&submit=Consultar"
)
URL_FALLBACK = "https://jurisprudencia.tst.jus.br/"
_TAMANHO_PAGINA = 5


def _pesquisar(termo: str, pagina: int, tamanho: int) -> tuple:
    resp = requests.post(
        SEARCH_URL.format(pagina=pagina, tamanho=tamanho),
        json={"e": termo, "tipos": ["ACORDAO"], "orgao": "TST"},
        headers={**HEADERS_TUSABBOT, "Accept": "application/json"},
        timeout=(10, 60),
    )
    resp.raise_for_status()
    dados = exigir_json(resp, "TST")
    registros = dados.get("registros") if isinstance(dados, dict) else None
    if not isinstance(registros, list):
        raise RuntimeError(
            "TST mudou o formato da resposta da pesquisa textual (campo 'registros' ausente) "
            "— fonte indisponível até o adaptador ser atualizado"
        )
    out = []
    for r in registros:
        reg = r.get("registro") if isinstance(r, dict) else None
        if not isinstance(reg, dict):
            raise RuntimeError("TST mudou o formato de 'registros[].registro' — fonte indisponível até o adaptador ser atualizado")
        out.append(reg)
    return out, int(dados.get("totalRegistros") or 0)


def _coletar(termo: str, max_resultados: int, evento_cancelar=None) -> list:
    itens, pagina = [], 1
    while len(itens) < max_resultados:
        if evento_cancelar is not None and evento_cancelar.is_set():
            break
        lote, total = _pesquisar(termo, pagina, _TAMANHO_PAGINA)
        itens.extend(lote)
        if len(lote) < _TAMANHO_PAGINA or len(itens) >= total:
            break
        pagina += 1
    return itens[:max_resultados]


def _url_processo(reg: dict) -> str:
    """Consulta processual pública montada da numeração única CNJ do registro."""
    n = reg.get("numeracaoUnica")
    try:
        return URL_PROCESSO.format(**{k: int(n[k]) for k in ("numero", "digito", "ano", "orgao", "tribunal", "vara")})
    except Exception:
        return URL_FALLBACK


def _limpar(valor) -> str:
    """Campos que o backend esvaziou vêm como 'removido no backend'."""
    valor = (valor or "").strip() if isinstance(valor, str) else ""
    return "" if valor.lower() == "removido no backend" else valor


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    termo = query.strip()
    itens = []
    if len(termo.split()) > 1 and '"' not in termo:
        itens = _coletar(f'"{termo}"', max_resultados, evento_cancelar)
    if not itens:
        itens = _coletar(termo, max_resultados, evento_cancelar)
    if not itens:
        return resultado_vazio()

    def extrair(reg):
        # Lista branca de campos — codCPFSignatario e nomes nunca são lidos.
        ementa = _limpar(reg.get("ementa"))
        dispositivo = _limpar(reg.get("dispositivo"))
        teor = html_para_texto(_limpar(reg.get("inteiroTeorHtml")))
        if not (ementa or teor):
            return None
        orgao = (reg.get("orgaoJudicante") or {}).get("descricao", "") if isinstance(reg.get("orgaoJudicante"), dict) else ""
        meta = [f"Órgão julgador: {orgao}" if orgao else "",
                f"Julgamento: {reg.get('dtaJulgamento')}" if reg.get("dtaJulgamento") else "",
                f"Publicação: {reg.get('dtaPublicacao')}" if reg.get("dtaPublicacao") else ""]
        partes = ["\n".join(m for m in meta if m)]
        if ementa:
            partes.append(f"--- EMENTA ---\n\n{ementa}")
        if dispositivo:
            partes.append(f"--- DISPOSITIVO ---\n\nO colegiado decidiu{dispositivo if dispositivo.startswith(',') else ': ' + dispositivo}")
        if teor:
            partes.append(f"--- INTEIRO TEOR ---\n\n{teor}")
        texto = limitar_texto(sanitizar_texto_juridico("\n\n".join(p for p in partes if p)))

        numero = (reg.get("numFormatado") or "").strip()
        titulo = f"TST {numero}" if numero else "Acórdão TST"
        if orgao:
            titulo += f" — {orgao}"
        if reg.get("dtaJulgamento"):
            titulo += f" — {reg['dtaJulgamento']}"
        return {"titulo": titulo, "texto": texto, "url_origem": _url_processo(reg)}

    return executar_busca_generica(
        itens, extrair, "tst", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=0,
    )
