# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de extração: configurar canal, iniciar/pausar/cancelar motor.
"""

import re
import time
import threading

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

import motor_tusab
from tusab_engine.state import state

router = APIRouter()


# ── Background helper ─────────────────────────────────────────────────────────

def _reset_stats():
    """Zera contadores de progresso antes de cada extração."""
    with state.state_lock:
        state.logs                           = []
        state.stats["videos_processed"]     = 0
        state.stats["videos_total"]         = 0
        state.stats["videos_mapeados"]      = 0
        state.stats["videos_sem_legenda"]   = 0
        state.stats["videos_legenda_curta"] = 0
        state.stats["files_generated"]      = 0
        state.stats["progress"]             = 0
        state.stats["idioma_detectado"]     = ""


def run_motor():
    """Executa a extração do canal atual e, ao terminar, consome a fila."""
    while True:
        try:
            state.is_running = True
            state.stats["status"] = "Mapeando YouTube"
            _reset_stats()

            import time as _time
            state.extraction_start_time = _time.time()

            motor_tusab.tusab_engine(
                canal_url=state.canal_url,
                evento_pausa=state.evento_pausa,
                evento_cancelar=state.evento_cancelar,
                fontes_filtro=state.fontes_filtro or None,
                projeto_nome=state.projeto_nome,
            )

            cancelado = state.evento_cancelar.is_set()
            if cancelado:
                state.stats["status"] = "Interrompido"
                # Cancelamento limpa a fila — o usuário abortou tudo
                with state.queue_lock:
                    state.extraction_queue.clear()
                break

            state.stats["status"]   = "Finalizado ✓"
            state.stats["progress"] = 100

        except Exception as e:
            print(f"❌ ERRO NO MOTOR: {e}")
            state.stats["status"] = "Erro"
            # Erro num canal não cancela a fila; continua para o próximo
        finally:
            state.is_running = False
            state.is_paused  = False

        # Verifica fila antes de decidir se terminou
        with state.queue_lock:
            proximo = state.extraction_queue.pop(0) if state.extraction_queue else None

        if proximo is None:
            # Fila vazia — aguarda 15s e reseta status
            def _reset_status():
                time.sleep(15)
                if not state.is_running:
                    state.stats["status"]   = "Ocioso"
                    state.stats["progress"] = 0
            threading.Thread(target=_reset_status, daemon=True).start()
            break

        # Próximo canal da fila — configura e continua o loop
        url = proximo["url"]
        match = re.search(r'@([^/?\s]+)', url)
        state.canal_url             = url
        state.stats["canal_nome"]   = match.group(1) if match else url.rstrip('/').split('/')[-1]
        state.stats["status"]       = "Na fila"
        state.fontes_filtro         = proximo.get("fontes", [])
        raw_proj = proximo.get("projeto_nome", "")
        state.projeto_nome = re.sub(r'[<>:"/\\|?*\s]', '_', raw_proj).strip('_') if raw_proj else ""
        state.evento_cancelar.clear()
        state.evento_pausa.set()
        state.is_paused             = False


# ── Models ────────────────────────────────────────────────────────────────────

class ChannelRequest(BaseModel):
    canal_url:    str = Field(max_length=300)
    projeto_nome: str = Field(default="", max_length=120)

class StartRequest(BaseModel):
    fontes: list = []

class QueueAddRequest(BaseModel):
    canal_url:    str = Field(max_length=300)
    fontes:       list = []
    projeto_nome: str = Field(default="", max_length=120)


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
    if req.projeto_nome:
        state.projeto_nome = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome).strip('_')
    else:
        state.projeto_nome = ""
    return {"message": "Canal configurado", "canal_nome": state.stats["canal_nome"]}


@router.post("/start")
def start_engine(background_tasks: BackgroundTasks, req: StartRequest = None):
    if not state.canal_url:
        return {"message": "Configure a URL do canal antes de iniciar", "error": True}
    if not state.is_running:
        state.stats["status"]   = "Iniciando"
        state.fontes_filtro     = (req.fontes if req else [])
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


@router.post("/queue/add")
def queue_add(req: QueueAddRequest):
    """Adiciona um canal à fila de extração sequencial."""
    url = req.canal_url.strip()
    if not url or not _YT_URL_RE.match(url):
        return {"error": True, "message": "URL inválida. Use o formato: https://www.youtube.com/@canal"}
    with state.queue_lock:
        state.extraction_queue.append({"url": url, "fontes": req.fontes, "projeto_nome": req.projeto_nome})
        tamanho = len(state.extraction_queue)
    return {"ok": True, "queue_size": tamanho}


@router.delete("/queue/clear")
def queue_clear():
    """Remove todos os itens pendentes da fila (não afeta a extração em curso)."""
    with state.queue_lock:
        state.extraction_queue.clear()
    return {"ok": True}


@router.get("/queue")
def queue_status():
    """Retorna os itens atualmente na fila."""
    with state.queue_lock:
        itens = list(state.extraction_queue)
    return {"queue": itens}
