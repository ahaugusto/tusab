# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de status geral, autenticação Drive, histórico e abertura de pastas.
"""

import os

from fastapi import APIRouter, BackgroundTasks

import motor_tusab
import agent_tusab
from tusab_engine.state import state

router = APIRouter()



# ── Background helper ─────────────────────────────────────────────────────────

def run_drive_auth():
    try:
        state.drive_cancel_event.clear()
        motor_tusab.get_drive_service(stop_event=state.drive_cancel_event)

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

def _count_files_on_disk() -> int:
    """Conta arquivos .txt extraídos que realmente existem no disco."""
    from tusab_engine.storage import NEURAL_DIR
    count = 0
    if os.path.isdir(NEURAL_DIR):
        for canal_dir in os.scandir(NEURAL_DIR):
            if not canal_dir.is_dir():
                continue
            yt_dir = os.path.join(canal_dir.path, "youtube")
            if os.path.isdir(yt_dir):
                # nova estrutura: youtube/{canal}/*.txt (um nível abaixo)
                for sub in os.scandir(yt_dir):
                    if sub.is_dir():
                        count += sum(
                            1 for f in os.listdir(sub.path)
                            if f.endswith(".txt") and not f.startswith("_")
                        )
                    elif sub.name.endswith(".txt") and not sub.name.startswith("_"):
                        count += 1  # legado flat dentro de youtube/
    # Legado: neural/youtube/ flat
    legacy = os.path.join(NEURAL_DIR, "youtube")
    if os.path.isdir(legacy):
        count += sum(
            1 for f in os.listdir(legacy)
            if f.endswith(".txt") and not f.startswith("_")
        )
    return count


@router.get("/status")
def get_status():
    if state.drive_auth_running:
        drive_status = "em_progresso"
    elif state.drive_auth_error:
        drive_status = "erro"
    else:
        drive_status = motor_tusab.get_drive_status()

    with state.state_lock:
        stats_snapshot = dict(state.stats)
        logs_snapshot  = state.logs[-50:]

    # Substituir o contador em memória pelo total real no disco
    # (para ficar consistente com o Repositório após limpeza)
    if not state.is_running:
        stats_snapshot["files_generated"] = _count_files_on_disk()
        # projeto_nome não deve ser exposto quando idle — evita restauração automática no frontend
        stats_snapshot["projeto_nome"] = ""

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
    if motor_tusab.get_drive_status() == 'sem_credenciais':
        state.drive_auth_error = "Credenciais do Drive ausentes da instalação. Reinstale o Tusab."
        return {"message": state.drive_auth_error, "error": True}
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


@router.post("/drive-disconnect")
def disconnect_drive():
    from tusab_engine.storage import TOKEN_PATH
    try:
        if os.path.exists(TOKEN_PATH):
            os.remove(TOKEN_PATH)
        state.drive_auth_error = None
        return {"ok": True}
    except Exception as e:
        return {"error": True, "message": str(e)}


@router.get("/history")
def get_history():
    """Retorna resumo de todas as extrações anteriores a partir dos CSVs de gestão."""
    from tusab_engine.storage import resumir_projetos_youtube
    return resumir_projetos_youtube()


@router.post("/log/clear")
def clear_log():
    with state.state_lock:
        state.logs.clear()
    return {"ok": True}


@router.get("/open-folder")
def open_folder(name: str, prefixo: str = ""):
    import subprocess
    import sys
    from tusab_engine.storage import NEURAL_DIR
    folders = {
        "data":            motor_tusab.DATA_DIR,
        "gestao":          motor_tusab.gestao_canal_dir(prefixo) if prefixo else motor_tusab.GESTAO_DIR,
        "agent_index":     agent_tusab.INDEX_DIR,
        # Pasta raiz do projeto — contém youtube/, documents/, texts/ juntos.
        # É o que o botão "Abrir pasta" do Repositório deve abrir por padrão:
        # o usuário quer ver TUDO que foi indexado daquele projeto, não só o
        # conteúdo do YouTube (indexar() já cobre as 3 subpastas — ver
        # agent/index.py).
        "projeto":         os.path.join(NEURAL_DIR, prefixo) if prefixo else NEURAL_DIR,
        "canal_youtube":   os.path.join(NEURAL_DIR, prefixo, "youtube") if prefixo else NEURAL_DIR,
        "canal_documents": os.path.join(NEURAL_DIR, prefixo, "documents") if prefixo else NEURAL_DIR,
    }
    target = folders.get(name)
    if not target:
        return {"error": True, "message": "Pasta desconhecida"}
    os.makedirs(target, exist_ok=True)
    if sys.platform == "darwin":
        subprocess.Popen(["open", target])
    else:
        subprocess.Popen(["explorer", target])
    return {"ok": True}


@router.get("/agent/mcp/config")
def agent_mcp_config():
    """Retorna o JSON de configuração do servidor MCP para Claude Code / Cursor.

    Cole o conteúdo retornado em ~/.claude.json (Claude Code) ou
    .cursor/mcp.json (Cursor) para habilitar as tools do Tusab no editor.
    """
    import sys as _sys
    mcp_server_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "tusab_engine",
        "mcp_server.py",
    )
    return {
        "mcpServers": {
            "tusab": {
                "command": _sys.executable,
                "args": [mcp_server_path],
            }
        }
    }
