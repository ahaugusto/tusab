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
_MAX_POINTS = 60  # últimos 60 snapshots (~60s se polled a cada 1s, ~2min se a cada 2s)

def _snapshot():
    try:
        import psutil
        proc = psutil.Process(os.getpid())
        mem = proc.memory_info()
        cpu = proc.cpu_percent(interval=None)
        ram_mb = mem.rss / 1024 / 1024
        return {"ts": int(time.time()), "ram_mb": round(ram_mb, 1), "cpu_pct": round(cpu, 1)}
    except Exception:
        return {"ts": int(time.time()), "ram_mb": 0.0, "cpu_pct": 0.0}

@router.get("/metrics")
def get_metrics():
    snap = _snapshot()
    with _history_lock:
        _history.append(snap)
        if len(_history) > _MAX_POINTS:
            _history.pop(0)
        hist = list(_history)
    return {"current": snap, "history": hist}
