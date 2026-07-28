# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte pública: Câmara dos Deputados — proposições legislativas federais.
Sem chave de API. Único candidato viável da área "Direito, normas,
legislação e governo": Senado Federal tem endpoint depreciado sem busca
real (o substituto oficial ignora o parâmetro de busca — total idêntico
pra qualquer termo, confirmado ao vivo); LexML/Datajud já rejeitados
antes (sem REST/metadado sem texto integral, ver agents/_historia.md).

Diferente do Datajud (só metadado processual), a Câmara disponibiliza o
inteiro teor em PDF (`urlInteiroTeor`) — texto integral real da proposição,
não só a ementa. Extraído com pdfplumber (mesmo padrão de arxiv.py e do
upload de PDF em router_repositorio.py). 3 chamadas por item (busca →
detalhe → PDF) — mais pesado que as demais fontes, mas o conteúdo vale:
confirmado ao vivo, um PL sobre IA virou 7 páginas de texto real.
"""

import io
import os

import requests

from tusab_engine.storage import NEURAL_DIR
from ._base import MAX_RESULTADOS_PERMITIDO, executar_busca_generica

FONTE_META = {
    "id": "camara",
    "nome": "Câmara dos Deputados",
    "area": "direito",
    "descricao": "Proposições legislativas federais — inteiro teor em PDF quando disponível.",
    "requer_auth": False,
    "suporta_data": False,
    "suporta_autor": False,
}

SEARCH_URL = "https://dadosabertos.camara.leg.br/api/v2/proposicoes"
DETAIL_URL = "https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}"
_MAX_PAGINAS_PDF = 20  # cap defensivo — proposições muito longas (ex: LOA) não precisam entrar inteiras
_MAX_CHARS_TEOR = 15_000


def _extrair_texto_pdf(conteudo_bytes: bytes) -> str:
    import pdfplumber
    paginas = []
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for pagina in pdf.pages[:_MAX_PAGINAS_PDF]:
            txt = pagina.extract_text() or ""
            if txt.strip():
                paginas.append(txt.strip())
    return "\n\n".join(paginas)


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    max_resultados = max(1, min(int(max_resultados), MAX_RESULTADOS_PERMITIDO))
    doc_dir = os.path.join(NEURAL_DIR, projeto_nome, "documents")

    resp = requests.get(
        SEARCH_URL,
        params={"keywords": query, "itens": max_resultados, "ordem": "DESC", "ordenarPor": "id"},
        headers={"Accept": "application/json"},
        timeout=(10, 45),
    )
    resp.raise_for_status()
    itens = resp.json().get("dados", [])

    def extrair(item):
        pid = item.get("id")
        ementa = (item.get("ementa") or "").strip()
        texto = ementa

        # Best-effort: inteiro teor em PDF. Se qualquer etapa falhar, cai de
        # volta pra ementa sozinha — nunca derruba o item por causa disso.
        try:
            detalhe = requests.get(DETAIL_URL.format(id=pid), timeout=(10, 30)).json().get("dados", {})
            url_pdf = detalhe.get("urlInteiroTeor")
            if url_pdf:
                pdf_resp = requests.get(url_pdf, timeout=30)
                if pdf_resp.ok and "pdf" in pdf_resp.headers.get("content-type", "").lower():
                    teor = _extrair_texto_pdf(pdf_resp.content)
                    if teor.strip():
                        texto = f"{ementa}\n\n--- INTEIRO TEOR ---\n\n{teor[:_MAX_CHARS_TEOR]}"
        except Exception:
            pass

        if not texto.strip():
            return None

        sigla = item.get("siglaTipo", "")
        numero = item.get("numero", "")
        ano = item.get("ano", "")
        titulo = f"{sigla} {numero}/{ano}".strip() or "Proposição"
        return {"titulo": titulo, "texto": texto, "url_origem": item.get("uri", "")}

    return executar_busca_generica(
        itens, extrair, "camara", doc_dir,
        evento_cancelar=evento_cancelar, dispatch_event=dispatch_event, throttle=1.0,
    )
