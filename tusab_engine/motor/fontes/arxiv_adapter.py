# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Adaptador do arXiv (tusab_engine/motor/arxiv.py) pro registro genérico de
fontes públicas. Não reimplementa nada — só traduz o contrato de eventos
específico do arxiv.py ("arxiv_total"/"arxiv_processed") pro contrato
genérico ("total"/"processed") usado por executar_busca_generica() nas
demais fontes, pra caber no mesmo endpoint /fontes/{id}/search.
"""

from tusab_engine.motor import arxiv as _arxiv_motor

FONTE_META = {
    "id": "arxiv",
    "nome": "arXiv",
    "area": "geral",
    "descricao": "Preprints de física, matemática, ciência da computação e áreas correlatas.",
    "requer_auth": False,
    "suporta_data": True,
    "suporta_autor": True,
}


def buscar(
    query: str, max_resultados: int, projeto_nome: str,
    data_inicio: str = "", data_fim: str = "", autor: str = "",
    evento_cancelar=None, dispatch_event=None,
) -> dict:
    def _bridge(event, **kwargs):
        if not dispatch_event:
            return
        if event == "arxiv_total":
            dispatch_event("total", **kwargs)
        elif event == "arxiv_processed":
            dispatch_event("processed", **kwargs)

    return _arxiv_motor.buscar_arxiv(
        query=query, max_resultados=max_resultados, projeto_nome=projeto_nome,
        data_inicio=data_inicio, data_fim=data_fim, autor=autor,
        evento_cancelar=evento_cancelar, dispatch_event=_bridge,
    )
