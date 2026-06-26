# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Todos os direitos reservados. Proibida a reprodução sem autorização expressa.
# Protegido pela Lei nº 9.609/1998 (Lei do Software) e Lei nº 9.610/1998.

import sys
import os
import warnings

# Garante que o diretório do próprio script está no sys.path
# Necessário no Python embarcado (python_env) onde o cwd pode não ser adicionado automaticamente
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

# Suprime warnings do SDK Gemini clássico (google-generativeai deprecado pelo Google)
# Migração para google-genai pendente — manter até atualizar o SDK
warnings.filterwarnings("ignore", category=FutureWarning, module="google")
warnings.filterwarnings("ignore", category=UserWarning, module="google")

import motor_tusab
import agent_tusab

# Garante UTF-8 no stdout/stderr do Windows (evita UnicodeEncodeError no banner)
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import logging
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# Banner de boas-vindas — impresso antes do LogRedirector redirecionar sys.stdout
print(r"""
  ████████╗██╗   ██╗███████╗ █████╗ ██████╗
  ╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔══██╗
     ██║   ██║   ██║███████╗███████║██████╔╝
     ██║   ██║   ██║╚════██║██╔══██║██╔══██╗
     ██║   ╚██████╔╝███████║██║  ██║██████╔╝
     ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝
  v1.0.1 · Indexe. Aprenda. Consulte.
  © 2026 CriAugu — CNPJ 65.131.075/0001-57
""")

# AppState singleton + LogRedirector (redirects sys.stdout/stderr on import)
from tusab_engine.state import state, _real_stderr  # noqa: E402

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from tusab_engine.api import router_status, router_extraction, router_agent, router_repositorio, router_exports
from tusab_engine.api.router_metrics import router as router_metrics
from tusab_engine.api.router_estudo import router as router_estudo
from tusab_engine.api.router_digest import router as router_digest


def _criar_aviso_seguranca():
    """Cria LEIA-ME-SEGURANCA.txt na pasta de dados na primeira execução."""
    aviso_path = os.path.join(motor_tusab.DATA_DIR, 'LEIA-ME-SEGURANCA.txt')
    if os.path.exists(aviso_path):
        return
    os.makedirs(motor_tusab.DATA_DIR, exist_ok=True)
    conteudo = """\
AVISO DE SEGURANÇA — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
═══════════════════════════════════════════════════════════

Esta pasta contém dados sensíveis do Tusab.

O QUE TEM AQUI
───────────────
  neural/        → sua base de conhecimento (YouTube, PDFs, documentos)
  config/        → configurações do app, incluindo chaves de API
  temp/          → arquivos temporários

⚠️  ATENÇÃO — NÃO COMPARTILHE ESTA PASTA INTEIRA

O arquivo config/agent_config.json pode conter chaves de API
(Groq, OpenAI, Gemini, Anthropic) em texto simples.

Se você compartilhar ou fazer backup desta pasta sem cuidado,
suas chaves de API podem ser expostas.

O QUE É SEGURO COMPARTILHAR
─────────────────────────────
  ✓ A pasta neural/ pode ser compartilhada — só tem texto extraído
  ✗ A pasta config/ NÃO deve ser compartilhada

RECOMENDAÇÕES
─────────────
  • Se usar backup em nuvem (OneDrive, Google Drive, iCloud),
    exclua a pasta config/ das sincronizações automáticas.
  • Se for migrar para outro computador, copie apenas a pasta neural/.
  • Suas chaves de API podem ser reconfiguradas no app a qualquer momento.

Mais informações: consulte a documentação em Documentação do Produto/Segurança.txt
"""
    with open(aviso_path, 'w', encoding='utf-8') as f:
        f.write(conteudo)


_criar_aviso_seguranca()

# Restaura fila de extração que estava pendente antes do último encerramento
try:
    state.restaurar_fila()
except Exception:
    pass

# Dispara verificação de auto-update em background (não bloqueia startup)
try:
    from tusab_engine.motor.auto_update import agendar_startup_check
    agendar_startup_check()
except Exception:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001", "http://127.0.0.1:8001"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

BASE_PATH = get_base_path()

frontend_dist = os.path.join(BASE_PATH, "web_interface", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

# Migração legada: data/cerebro/ → data/neural/ (pré-renomeação, idempotente)
try:
    from tusab_engine.storage import migrar_cerebro_para_neural
    migrar_cerebro_para_neural()
except Exception:
    pass

# Migração legada: data/cerebro_txt/ → data/neural/{canal}/youtube/ (pré-v1.0, idempotente)
try:
    motor_tusab.migrar_cerebro_txt()
except Exception:
    pass

# Migração legada: data/gestao/{prefixo}_* → data/neural/{prefixo}/management/ (pré-v1.0, idempotente)
try:
    from tusab_engine.storage import migrar_gestao_para_cerebro
    migrar_gestao_para_cerebro()
except Exception:
    pass

# Renomeia subpastas legadas (documentos→documents, textos→texts, gestao→management)
try:
    from tusab_engine.storage import migrar_pastas_para_ingles
    migrar_pastas_para_ingles()
except Exception:
    pass


# ── Roteadores ────────────────────────────────────────────────────────────────
app.include_router(router_status.router)
app.include_router(router_extraction.router)
app.include_router(router_agent.router)
app.include_router(router_repositorio.router)
app.include_router(router_exports.router)
app.include_router(router_metrics)
app.include_router(router_estudo)
app.include_router(router_digest)


# ── Frontend estático (catch-all — deve ser o último) ─────────────────────────
@app.get("/{file_path:path}")
async def serve_static(file_path: str):
    if os.path.exists(frontend_dist):
        full_path = os.path.realpath(os.path.join(frontend_dist, file_path))
        safe_root = os.path.realpath(frontend_dist)
        if not full_path.startswith(safe_root + os.sep) and full_path != safe_root:
            return FileResponse(os.path.join(frontend_dist, "index.html"))
        if os.path.isfile(full_path):
            return FileResponse(full_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
    return {"error": "Frontend não compilado. Execute: cd web_interface && npm run build"}


if __name__ == "__main__":
    import uvicorn
    import subprocess
    from threading import Timer

    if not os.environ.get("ELECTRON_RUN"):
        def open_app_window():
            url = "http://127.0.0.1:8001"
            app_flags = [f"--app={url}", "--start-maximized"]
            launched = False
            for browser_path in [
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            ]:
                if os.path.exists(browser_path):
                    subprocess.Popen([browser_path] + app_flags)
                    launched = True
                    break
            if not launched:
                import webbrowser
                webbrowser.open(url)

        Timer(2.0, open_app_window).start()

    try:
        uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")
    except Exception as _e:
        import traceback
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tusab_crash.log'), 'w') as _f:
            traceback.print_exc(file=_f)
            _f.write(f"\nError: {_e}\n")
        raise
