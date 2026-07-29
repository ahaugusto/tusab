# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas genéricas de busca em fontes públicas (perfil Pesquisador), organizadas
por área de conhecimento — ver tusab_engine/motor/fontes/ pro registro e o
contrato de cada adaptador.

Substitui o padrão anterior de um endpoint dedicado por fonte (POST /arxiv/
search, POST /fhir/search) — que não escala pras dezenas de fontes mapeadas
em agents/_historia.md. Um único endpoint genérico (/fontes/{fonte_id}/search)
atende qualquer fonte registrada.
"""

import os
import re

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

import motor_tusab
from tusab_engine.state import state
from tusab_engine.motor.fontes import listar_fontes, obter_fonte
from tusab_engine.motor.fontes._base import mensagem_erro_busca_externa

router = APIRouter()


@router.get("/fontes")
def fontes_disponiveis():
    """Lista as fontes públicas registradas, agrupadas por área de conhecimento."""
    return {"areas": listar_fontes()}


class FonteSearchRequest(BaseModel):
    query:          str = Field(min_length=2, max_length=300)
    max_resultados: int = Field(default=20, ge=1, le=50)
    projeto_nome:   str = Field(max_length=120)
    data_inicio:    str = Field(default="", pattern=r'^\d{4}-\d{2}-\d{2}$|^$')
    data_fim:       str = Field(default="", pattern=r'^\d{4}-\d{2}-\d{2}$|^$')
    autor:          str = Field(default="", max_length=120)


def _estado_fonte(fonte_id: str) -> dict:
    """Estado por fonte é criado sob demanda — evita pré-popular um dict pras
    dezenas de fontes que ainda vão ser adicionadas nas próximas áreas."""
    if fonte_id not in state.fontes_publicas_state:
        import threading
        state.fontes_publicas_state[fonte_id] = {
            "running": False,
            "cancel": threading.Event(),
            "stats": {"status": "Ocioso", "total": 0, "processed": 0},
        }
    return state.fontes_publicas_state[fonte_id]


def _run_fonte_search(fonte_id: str, query: str, max_resultados: int, projeto_nome: str,
                       data_inicio: str, data_fim: str, autor: str):
    fonte = obter_fonte(fonte_id)
    fstate = _estado_fonte(fonte_id)
    nome_fonte = fonte.FONTE_META["nome"]

    # Tag temporária pra os prints abaixo aparecerem sob o projeto certo no
    # filtro do log — mesmo padrão de _run_arxiv_search (removido, migrado pra cá).
    canal_nome_anterior = state.stats.get("canal_nome", "")
    try:
        fstate["running"] = True
        fstate["stats"] = {"status": f"Buscando em {nome_fonte}", "total": 0, "processed": 0, "itens": []}
        fstate["cancel"].clear()
        state.stats["canal_nome"] = projeto_nome

        filtro_autor = f" do(a) autor(a) {autor}" if autor.strip() else ""
        periodo = f" entre {data_inicio or '...'} e {data_fim or 'hoje'}" if (data_inicio or data_fim) else ""
        print(f"🔎 Buscando \"{query}\"{filtro_autor} em {nome_fonte}{periodo} (até {max_resultados} resultados)...")

        def _dispatch(event, **kwargs):
            if event == "total":
                total = kwargs.get("total", 0)
                fstate["stats"]["total"] = total
                fstate["stats"]["status"] = "Baixando resultados"
                print(f"📄 {total} resultado(s) encontrado(s) em {nome_fonte} — salvando...")
            elif event == "processed":
                processed = kwargs.get("processed", 0)
                fstate["stats"]["processed"] = processed
                titulo = kwargs.get("titulo", "")
                if titulo:
                    fstate["stats"]["itens"].append(titulo)
                print(f"💾 Resultado {processed}/{fstate['stats']['total']} salvo no projeto ({nome_fonte})")

        resultado = fonte.buscar(
            query=query, max_resultados=max_resultados, projeto_nome=projeto_nome,
            data_inicio=data_inicio, data_fim=data_fim, autor=autor,
            evento_cancelar=fstate["cancel"], dispatch_event=_dispatch,
        )
        fstate["stats"]["status"] = "Finalizado ✓" if resultado.get("ok") else "Erro"
        if resultado.get("ok"):
            print(f"🏁 Busca em {nome_fonte} concluída — {resultado.get('total_salvos', 0)} resultado(s) salvos.")
    except Exception as e:
        mensagem = mensagem_erro_busca_externa(e, nome_fonte)
        print(f"❌ ERRO NA BUSCA {fonte_id.upper()}: {mensagem}")
        fstate["stats"]["status"] = "Erro"
        fstate["stats"]["message"] = mensagem
    finally:
        fstate["running"] = False
        state.stats["canal_nome"] = canal_nome_anterior


@router.post("/fontes/{fonte_id}/search")
def fonte_search(fonte_id: str, req: FonteSearchRequest, background_tasks: BackgroundTasks):
    """Busca numa fonte pública registrada e indexa como documentos do projeto.

    [CONTRATO] Assim como POST /neural/upload, o projeto (projeto_nome) deve já
    existir — ver POST /neural/projeto. Não reindexa automaticamente; indexação
    continua sendo POST /agent/index, ação explícita do usuário.
    """
    fonte = obter_fonte(fonte_id)
    if not fonte:
        return {"error": True, "message": "Fonte desconhecida"}

    fstate = _estado_fonte(fonte_id)
    if fstate["running"]:
        return {"error": True, "message": f"Já há uma busca em {fonte.FONTE_META['nome']} em andamento"}

    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome.strip()).strip('_')
    if not projeto_prefixo:
        return {"error": True, "message": "Selecione um projeto antes de buscar"}

    projeto_dir = os.path.join(motor_tusab.NEURAL_DIR, projeto_prefixo)
    if not os.path.exists(projeto_dir):
        return {"error": True, "message": "Projeto não encontrado. Crie o projeto antes de buscar."}

    background_tasks.add_task(
        _run_fonte_search, fonte_id, req.query.strip(), req.max_resultados,
        projeto_prefixo, req.data_inicio, req.data_fim, req.autor.strip(),
    )
    return {"ok": True, "message": "Busca iniciada"}


@router.post("/fontes/{fonte_id}/cancel")
def fonte_cancel(fonte_id: str):
    """Cancela a busca em andamento na fonte (não desfaz resultados já salvos)."""
    fstate = _estado_fonte(fonte_id)
    if fstate["running"]:
        fstate["cancel"].set()
        return {"message": "Cancelando"}
    return {"message": "Nenhuma busca em andamento"}


@router.get("/fontes/{fonte_id}/status")
def fonte_status(fonte_id: str):
    """Status da busca em andamento na fonte (polling)."""
    fstate = _estado_fonte(fonte_id)
    return {"running": fstate["running"], **fstate["stats"]}
