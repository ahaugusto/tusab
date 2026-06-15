# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Todos os direitos reservados. Proibida a reprodução sem autorização expressa.
# Protegido pela Lei nº 9.609/1998 (Lei do Software) e Lei nº 9.610/1998.

import sys
import os

import motor_brainiac
import agent_brainiac

import logging
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# AppState singleton + LogRedirector (redirects sys.stdout/stderr on import)
from brainiac_engine.state import state, _real_stderr  # noqa: E402

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from brainiac_engine.api import router_status, router_extraction, router_agent, router_repositorio


def _criar_aviso_seguranca():
    """Cria LEIA-ME-SEGURANCA.txt na pasta de dados na primeira execução."""
    aviso_path = os.path.join(motor_brainiac.DATA_DIR, 'LEIA-ME-SEGURANCA.txt')
    if os.path.exists(aviso_path):
        return
    os.makedirs(motor_brainiac.DATA_DIR, exist_ok=True)
    conteudo = """\
AVISO DE SEGURANÇA — Brain'IAC
© 2026 CriAugu — CNPJ 65.131.075/0001-57
═══════════════════════════════════════════════════════════

Esta pasta contém dados sensíveis do Brain'IAC.

O QUE TEM AQUI
───────────────
  cerebro/       → sua base de conhecimento (YouTube, PDFs, documentos)
  config/        → configurações do app, incluindo chaves de API
  gestao/        → metadados de extração
  temp/          → arquivos temporários

⚠️  ATENÇÃO — NÃO COMPARTILHE ESTA PASTA INTEIRA

O arquivo config/agent_config.json pode conter chaves de API
(Groq, OpenAI, Gemini, Anthropic) em texto simples.

Se você compartilhar ou fazer backup desta pasta sem cuidado,
suas chaves de API podem ser expostas.

O QUE É SEGURO COMPARTILHAR
─────────────────────────────
  ✓ A pasta cerebro/ pode ser compartilhada — só tem texto extraído
  ✗ A pasta config/ NÃO deve ser compartilhada

RECOMENDAÇÕES
─────────────
  • Se usar backup em nuvem (OneDrive, Google Drive, iCloud),
    exclua a pasta config/ das sincronizações automáticas.
  • Se for migrar para outro computador, copie apenas a pasta cerebro/.
  • Suas chaves de API podem ser reconfiguradas no app a qualquer momento.

Mais informações: consulte a documentação em Documentação do Produto/Segurança.txt
"""
    with open(aviso_path, 'w', encoding='utf-8') as f:
        f.write(conteudo)


_criar_aviso_seguranca()

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

# Migra cerebro_txt → cerebro/youtube na primeira execução
try:
    motor_brainiac.migrar_cerebro_txt()
except Exception:
    pass

# Cria base de conhecimento embutida do BrainIAC na primeira execução
try:
    _ajuda_path = os.path.join(motor_brainiac.CEREBRO_DIR, 'textos', '_brainiac_ajuda.txt')
    if not os.path.exists(_ajuda_path):
        import subprocess as _sp
        _sp.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts', 'create_help_base.py')],
                check=False, timeout=10)
except Exception:
    pass

# ── Roteadores ────────────────────────────────────────────────────────────────
app.include_router(router_status.router)
app.include_router(router_extraction.router)
app.include_router(router_agent.router)
app.include_router(router_repositorio.router)


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
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brainiac_crash.log'), 'w') as _f:
            traceback.print_exc(file=_f)
            _f.write(f"\nError: {_e}\n")
        raise
