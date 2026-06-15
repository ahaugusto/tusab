# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de extração: configurar canal, iniciar/pausar/cancelar motor.
"""

import re
import time
import threading

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

import motor_sebayt
from sebayt_engine.state import state

router = APIRouter()


# ── Background helper ─────────────────────────────────────────────────────────

def run_motor():
    try:
        state.is_running = True
        state.stats["status"] = "Mapeando YouTube"

        motor_sebayt.sebayt_engine(
            canal_url=state.canal_url,
            evento_pausa=state.evento_pausa,
            evento_cancelar=state.evento_cancelar,
            fontes_filtro=state.fontes_filtro or None
        )

        if state.evento_cancelar.is_set():
            state.stats["status"] = "Interrompido"
        else:
            state.stats["status"] = "Finalizado ✓"
            state.stats["progress"] = 100

        def _reset_status():
            time.sleep(15)
            if not state.is_running:
                state.stats["status"]   = "Ocioso"
                state.stats["progress"] = 0
        threading.Thread(target=_reset_status, daemon=True).start()
    except Exception as e:
        print(f"❌ ERRO NO MOTOR: {e}")
        state.stats["status"] = "Erro"
    finally:
        state.is_running = False
        state.is_paused  = False


# ── Models ────────────────────────────────────────────────────────────────────

class ChannelRequest(BaseModel):
    canal_url: str

class StartRequest(BaseModel):
    fontes: list = []


# ── Endpoints ─────────────────────────────────────────────────────────────────

_YT_URL_RE = re.compile(
    r'^https://(www\.)?youtube\.com/'
    r'(@[a-zA-Z0-9_.\-]{1,100}|channel/[a-zA-Z0-9_\-]{1,64}|c/[a-zA-Z0-9_.\-]{1,100})/?$'
)

@router.post("/set-channel")
def set_channel(req: ChannelRequest):
    if state.is_running:
        return {"message": "Não é possível alterar o canal durante a execução", "error": True}
    url = req.canal_url.strip()
    if url and not _YT_URL_RE.match(url):
        return {"error": True, "message": "URL inválida. Use o formato: https://www.youtube.com/@canal"}
    state.canal_url = url
    match = re.search(r'@([^/?\s]+)', url)
    state.stats["canal_nome"] = match.group(1) if match else url.rstrip('/').split('/')[-1]
    return {"message": "Canal configurado", "canal_nome": state.stats["canal_nome"]}


@router.post("/start")
def start_engine(background_tasks: BackgroundTasks, req: StartRequest = None):
    if not state.canal_url:
        return {"message": "Configure a URL do canal antes de iniciar", "error": True}
    if not state.is_running:
        with state.state_lock:
            state.logs                             = []
            state.stats["videos_processed"]       = 0
            state.stats["videos_total"]           = 0
            state.stats["videos_sem_legenda"]     = 0
            state.stats["videos_legenda_curta"]   = 0
            state.stats["files_generated"]        = 0
            state.stats["progress"]               = 0
            state.stats["status"]                 = "Iniciando"
            state.stats["idioma_detectado"]       = ""
        state.fontes_filtro                   = (req.fontes if req else [])
        state.evento_cancelar.clear()
        state.evento_pausa.set()
        state.is_paused = False
        background_tasks.add_task(run_motor)
        return {"message": "Motor iniciado"}
    return {"message": "Motor já está rodando"}


@router.post("/pause")
def pause_engine():
    if state.is_running:
        if state.evento_pausa.is_set():
            state.evento_pausa.clear()
            state.is_paused          = True
            state.stats["status"]    = "Em Pausa"
            return {"message": "Pausado"}
        else:
            state.evento_pausa.set()
            state.is_paused          = False
            state.stats["status"]    = "Minerando YouTube"
            return {"message": "Retomado"}
    return {"message": "Motor não está rodando"}


@router.post("/cancel")
def cancel_engine():
    if state.is_running:
        state.evento_cancelar.set()
        state.evento_pausa.set()
        state.stats["status"] = "Cancelando..."
        return {"message": "Cancelando"}
    return {"message": "Motor não está rodando"}
