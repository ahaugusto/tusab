# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de status geral, autenticação Drive, histórico e abertura de pastas.
"""

import os
import re
import json
import glob

import pandas as pd
from fastapi import APIRouter, BackgroundTasks

import motor_sebayt
import agent_sebayt
from sebayt_engine.state import state

router = APIRouter()


# ── Background helper ─────────────────────────────────────────────────────────

def run_drive_auth():
    try:
        state.drive_cancel_event.clear()
        motor_sebayt.get_drive_service(stop_event=state.drive_cancel_event)

        if state.drive_cancel_event.is_set():
            print("⚠️ Autenticação do Drive cancelada pelo usuário.")
        else:
            state.drive_auth_error = None
            print("✅ Google Drive autenticado com sucesso!")
    except TimeoutError:
        print("⚠️ Autenticação do Drive cancelada.")
    except Exception as e:
        if not state.drive_cancel_event.is_set():
            state.drive_auth_error = str(e)
            print(f"❌ Falha na autenticação do Drive: {e}")
    finally:
        state.drive_auth_running = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status():
    if state.drive_auth_running:
        drive_status = "em_progresso"
    elif state.drive_auth_error:
        drive_status = "erro"
    else:
        drive_status = motor_sebayt.get_drive_status()

    with state.state_lock:
        stats_snapshot = dict(state.stats)
        logs_snapshot  = state.logs[-50:]

    return {
        "is_running":       state.is_running,
        "is_paused":        state.is_paused,
        "canal_url":        state.canal_url,
        "drive_status":     drive_status,
        "drive_auth_error": state.drive_auth_error,
        "stats":            stats_snapshot,
        "logs":             logs_snapshot
    }


@router.post("/drive-auth")
def start_drive_auth(background_tasks: BackgroundTasks):
    if state.drive_auth_running:
        return {"message": "Autenticação já está em progresso"}
    if state.is_running:
        return {"message": "Não é possível autenticar durante uma extração", "error": True}

    state.drive_auth_running = True
    state.drive_auth_error   = None
    background_tasks.add_task(run_drive_auth)
    return {"message": "Autenticação iniciada. Conclua o login no navegador que foi aberto."}


@router.post("/drive-auth-cancel")
def cancel_drive_auth():
    state.drive_cancel_event.set()
    state.drive_auth_running = False
    return {"message": "Autenticação cancelada"}


@router.get("/history")
def get_history():
    """Retorna resumo de todas as extrações anteriores a partir dos CSVs de gestão."""
    history = []
    pattern = os.path.join(motor_sebayt.GESTAO_DIR, "*_base.csv")
    for csv_path in sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True):
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            prefixo = os.path.basename(csv_path).replace("_base.csv", "")
            total   = len(df)
            sucesso = int((df["Status"] == "Sucesso").sum()) if "Status" in df.columns else 0
            sem_leg = int((df["Status"] == "Sem Legenda").sum()) if "Status" in df.columns else 0
            ultima  = df["Data_Extracao"].max() if "Data_Extracao" in df.columns else ""
            canal_url = f"https://www.youtube.com/@{prefixo}"

            if "Link" in df.columns:
                link = df["Link"].dropna().iloc[0] if len(df) > 0 else ""
                m = re.search(r"@([^/?\s]+)", str(link))
                if m:
                    canal_url = f"https://www.youtube.com/@{m.group(1)}"

            summary_path = csv_path.replace("_base.csv", "_summary.json")
            total_mapeado = total
            if os.path.exists(summary_path):
                try:
                    with open(summary_path, 'r', encoding='utf-8') as _sf:
                        total_mapeado = json.load(_sf).get("total_mapeado", total)
                except Exception:
                    pass

            history.append({
                "canal":           prefixo,
                "canal_url":       canal_url,
                "total":           total,
                "total_mapeado":   total_mapeado,
                "extraidos":       sucesso,
                "sem_legenda":     sem_leg,
                "cobertura":       round(sucesso / total_mapeado * 100) if total_mapeado > 0 else 0,
                "ultima_extracao": str(ultima),
            })
        except Exception:
            pass
    return history


@router.get("/open-folder")
def open_folder(name: str):
    import subprocess
    folders = {
        "data":        motor_sebayt.DATA_DIR,
        "cerebro_txt": motor_sebayt.LOCAL_TXT_DIR,
        "gestao":      motor_sebayt.GESTAO_DIR,
        "agent_index": agent_sebayt.INDEX_DIR,
    }
    target = folders.get(name)
    if not target:
        return {"error": True, "message": "Pasta desconhecida"}
    os.makedirs(target, exist_ok=True)
    subprocess.Popen(["explorer", target])
    return {"ok": True}
