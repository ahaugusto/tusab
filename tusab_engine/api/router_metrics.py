# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Endpoint de métricas de sistema para o painel de observabilidade.
"""
import os
import time
import threading

from fastapi import APIRouter

router = APIRouter()

_history: list = []
_history_lock = threading.Lock()
_MAX_POINTS = 60

try:
    import psutil as _psutil
    _proc = _psutil.Process(os.getpid())
    # Descarta a primeira leitura (sempre 0.0 — sem janela de medição)
    _proc.cpu_percent(interval=None)
    _psutil.cpu_percent(interval=None)
except Exception:
    _proc = None

# Coleta em background a cada 2s para garantir janela de medição sempre válida
_bg_snap: dict = {}
_bg_lock = threading.Lock()

def _bg_collect():
    while True:
        try:
            if _proc:
                mem      = _proc.memory_info()
                proc_cpu = _proc.cpu_percent(interval=None)
                sys_cpu  = _psutil.cpu_percent(interval=None)
                ram_mb   = mem.rss / 1024 / 1024
                snap = {
                    "ts":       int(time.time()),
                    "ram_mb":   round(ram_mb, 1),
                    "cpu_pct":  round(proc_cpu, 1),
                    "sys_cpu":  round(sys_cpu, 1),
                }
            else:
                snap = {"ts": int(time.time()), "ram_mb": 0.0, "cpu_pct": 0.0, "sys_cpu": 0.0}
            with _bg_lock:
                _bg_snap.update(snap)
            with _history_lock:
                _history.append(snap)
                if len(_history) > _MAX_POINTS:
                    _history.pop(0)
        except Exception:
            pass
        time.sleep(2)

_collector = threading.Thread(target=_bg_collect, daemon=True)
_collector.start()


@router.get("/metrics")
def get_metrics():
    with _bg_lock:
        current = dict(_bg_snap) if _bg_snap else {"ts": int(time.time()), "ram_mb": 0.0, "cpu_pct": 0.0, "sys_cpu": 0.0}
    with _history_lock:
        hist = list(_history)
    # available=False sinaliza psutil ausente — a UI mostra aviso em vez de zeros silenciosos
    return {"current": current, "history": hist, "available": _proc is not None}
