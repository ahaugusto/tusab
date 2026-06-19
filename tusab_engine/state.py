# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
AppState (singleton) e LogRedirector.

AppState centraliza todo o estado mutável da aplicação que é compartilhado
entre threads (motor de extração, API, Drive auth). Os locks definem as
fronteiras de acesso seguro:

  state_lock  — RLock (reentrante): protege stats e logs.
                Reentrante porque print() dentro de região com lock reentra
                no LogRedirector — com Lock simples seria deadlock.
  hist_lock   — Lock: protege chat_histories (sem risco de reentrada).

LogRedirector captura sys.stdout/stderr e converte print() do motor em
entradas de log na UI. O contrato de parsing (emojis ✅ 📂 "Sem legenda")
é implícito com motor_tusab.py e NÃO pode ser quebrado em refactors.
"""

import os
import sys
import re
import time
import threading

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class AppState:
    def __init__(self):
        # Locks: state_lock protege stats+logs (escritos pelo LogRedirector na
        # thread do motor e lidos pela API); hist_lock protege chat_histories.
        # RLock pois um print() dentro de região com lock reentra no LogRedirector.
        self.state_lock          = threading.RLock()
        self.hist_lock           = threading.Lock()

        # Motor
        self.is_running          = False
        self.is_paused           = False
        self.canal_url           = ""
        self.logs                = []
        self.stats               = {
            "videos_processed":    0,
            "videos_total":        0,
            "videos_mapeados":     0,
            "videos_sem_legenda":  0,
            "videos_legenda_curta":0,
            "files_generated":     0,
            "status":              "Ocioso",
            "progress":            0,
            "canal_nome":          "",
            "idioma_detectado":    "",
            "eta_segundos":        0
        }
        self.evento_pausa        = threading.Event()
        self.evento_pausa.set()
        self.evento_cancelar     = threading.Event()

        # Drive auth
        self.drive_auth_running  = False
        self.drive_auth_error    = None
        self.drive_cancel_event  = threading.Event()

        # Agente RAG
        self.agent_indexing       = False
        self.agent_index_logs     = []
        self.agent_index_stop     = threading.Event()
        self.agent_chat_lock      = threading.Lock()
        self.perguntas_sugeridas: list = []
        # Histórico server-side: canal_nome -> list[{role, content}]
        self.chat_histories: dict = {}

        # Filtro de fontes de extração
        self.fontes_filtro: list = []

        # ETA de extração
        self.extraction_start_time: float = 0.0   # timestamp unix quando extração começou

        # Fila de extração sequencial: lista de {"url": str, "fontes": list}
        self.extraction_queue: list = []
        self.queue_lock = threading.Lock()


# Singleton — importado diretamente por api_tusab e pelos routers
state = AppState()


class LogRedirector:
    """Intercepta sys.stdout/stderr e converte prints do motor em log da UI.

    ATENÇÃO: os padrões de emoji e string abaixo (✅, 📂, "Sem legenda", etc.)
    formam um contrato implícito com motor_tusab.py. Alterar as strings de
    print no motor sem ajustar aqui (ou vice-versa) silencia os logs na UI.
    """

    def write(self, text):
        if not text.strip():
            return
        clean = text.strip()
        noise = ["GET /", "POST /", "HTTP/1.1", "127.0.0.1", "INFO:", "WARNING:", "uvicorn"]
        if any(k in clean for k in noise):
            return

        with state.state_lock:
            state.logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": clean})

            if "✅" in text or "OK!" in text:
                state.stats["videos_processed"] += 1
                if state.stats["videos_total"] > 0:
                    pct = int(state.stats["videos_processed"] / state.stats["videos_total"] * 100)
                    state.stats["progress"] = min(pct, 99)

                elapsed = time.time() - state.extraction_start_time
                processed = state.stats["videos_processed"]
                total = state.stats["videos_total"]
                if processed > 0 and total > 0 and elapsed > 0 and state.extraction_start_time > 0:
                    rate = processed / elapsed  # videos por segundo
                    remaining = total - processed
                    state.stats["eta_segundos"] = int(remaining / rate) if rate > 0 else 0
                else:
                    state.stats["eta_segundos"] = 0

            if "📂" in text or "NOVO ARQUIVO" in text:
                state.stats["files_generated"] += 1

            if "Sem legenda" in clean:
                state.stats["videos_sem_legenda"] += 1

            if "Legenda muito curta" in clean or "Legenda Curta" in clean:
                state.stats["videos_legenda_curta"] += 1

            m_lang = re.search(r'Idiomas configurados:\s*(.+)', clean)
            if m_lang:
                state.stats["idioma_detectado"] = m_lang.group(1).strip()

            # Print incremental por fonte: "📋 Videos: 2173 vídeos mapeados (2173 no total)"
            m_inc = re.search(r'(\d+)\s+v[íi]deos?\s+mapeados?\s+\((\d+)\s+no\s+total\)', clean, re.IGNORECASE)
            if m_inc:
                state.stats["videos_mapeados"] = int(m_inc.group(2))
                state.stats["status"] = "Mapeando YouTube"

            # Print final: "✅ 2173 vídeos mapeados no canal."
            m = re.search(r'(\d+)\s+v[íi]deos?\s+mapeados?\s+no\s+canal', clean, re.IGNORECASE)
            if m:
                state.stats["videos_total"] = int(m.group(1))
                state.stats["videos_mapeados"] = int(m.group(1))
                state.stats["status"] = "Extraindo legendas"

            if len(state.logs) > 500:
                state.logs.pop(0)

    def flush(self): pass
    def isatty(self): return False


# ── Side effects ao importar ──────────────────────────────────────────────────
_real_stderr = sys.__stderr__
_orig_excepthook = sys.excepthook


def _debug_excepthook(t, v, tb):
    import traceback
    crash_path = os.path.join(_ROOT, 'tusab_crash.log')
    with open(crash_path, 'w') as _f:
        traceback.print_exception(t, v, tb, file=_f)
    _orig_excepthook(t, v, tb)


sys.excepthook = _debug_excepthook
sys.stdout = LogRedirector()
sys.stderr = sys.stdout
