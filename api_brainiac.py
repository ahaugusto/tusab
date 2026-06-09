# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Todos os direitos reservados. Proibida a reprodução sem autorização expressa.
# Protegido pela Lei nº 9.609/1998 (Lei do Software) e Lei nº 9.610/1998.

import threading
import sys
import time
import os
import re
import json
import glob
import motor_brainiac
import agent_brainiac
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse

import logging
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


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


# ==========================================
# --- ESTADO GLOBAL ---
# ==========================================

class AppState:
    def __init__(self):
        # Motor
        self.is_running          = False
        self.is_paused           = False
        self.canal_url           = ""
        self.logs                = []
        self.stats               = {
            "videos_processed":    0,
            "videos_total":        0,
            "videos_sem_legenda":  0,
            "videos_legenda_curta":0,
            "files_generated":     0,
            "status":              "Ocioso",
            "progress":            0,
            "canal_nome":          "",
            "idioma_detectado":    ""
        }
        self.evento_pausa        = threading.Event()
        self.evento_pausa.set()
        self.evento_cancelar     = threading.Event()

        # Drive auth
        self.drive_auth_running  = False
        self.drive_auth_error    = None
        self.drive_cancel_event  = threading.Event()

        # Agente RAG
        self.agent_indexing      = False
        self.agent_index_logs    = []
        self.agent_index_stop    = threading.Event()
        self.agent_chat_lock     = threading.Lock()

        # Filtro de fontes de extração
        self.fontes_filtro: list = []

state = AppState()

# Migra cerebro_txt → cerebro/youtube na primeira execução
try:
    motor_brainiac.migrar_cerebro_txt()
except Exception:
    pass

# Cria base de conhecimento embutida do BrainIAc na primeira execução
try:
    _ajuda_path = os.path.join(motor_brainiac.CEREBRO_DIR, 'textos', '_brainiac_ajuda.txt')
    if not os.path.exists(_ajuda_path):
        import subprocess as _sp
        _sp.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts', 'create_help_base.py')],
                check=False, timeout=10)
except Exception:
    pass


# ==========================================
# --- REDIRECIONADOR DE LOG ---
# ==========================================

class LogRedirector:
    def write(self, text):
        if not text.strip():
            return
        clean = text.strip()
        noise = ["GET /", "POST /", "HTTP/1.1", "127.0.0.1", "INFO:", "WARNING:", "uvicorn"]
        if any(k in clean for k in noise):
            return

        state.logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": clean})

        if "✅" in text or "OK!" in text:
            state.stats["videos_processed"] += 1
            if state.stats["videos_total"] > 0:
                pct = int(state.stats["videos_processed"] / state.stats["videos_total"] * 100)
                state.stats["progress"] = min(pct, 99)

        if "📂" in text or "NOVO ARQUIVO" in text:
            state.stats["files_generated"] += 1

        if "Sem legenda" in clean:
            state.stats["videos_sem_legenda"] += 1

        if "Legenda muito curta" in clean or "Legenda Curta" in clean:
            state.stats["videos_legenda_curta"] += 1

        m_lang = re.search(r'Idiomas configurados:\s*(.+)', clean)
        if m_lang:
            state.stats["idioma_detectado"] = m_lang.group(1).strip()

        m = re.search(r'(\d+)\s+v[íi]deos?\s+mapeados?', clean, re.IGNORECASE)
        if m:
            state.stats["videos_total"] = int(m.group(1))
            state.stats["status"] = "Extraindo legendas"

        if len(state.logs) > 500:
            state.logs.pop(0)

    def flush(self): pass
    def isatty(self): return False

_real_stderr = sys.__stderr__
_orig_excepthook = sys.excepthook
def _debug_excepthook(t, v, tb):
    import traceback
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brainiac_crash.log'), 'w') as _f:
        traceback.print_exception(t, v, tb, file=_f)
    _orig_excepthook(t, v, tb)
sys.excepthook = _debug_excepthook
sys.stdout = LogRedirector()
sys.stderr = sys.stdout


# ==========================================
# --- MOTOR DE EXTRAÇÃO ---
# ==========================================

def run_motor():
    try:
        state.is_running = True
        state.stats["status"] = "Mapeando YouTube"

        motor_brainiac.brainiac_engine(
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

        # Auto-reset para Ocioso após 15s
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


# ==========================================
# --- AUTENTICAÇÃO DO DRIVE ---
# ==========================================

def run_drive_auth():
    try:
        state.drive_cancel_event.clear()
        motor_brainiac.get_drive_service(stop_event=state.drive_cancel_event)

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


# ==========================================
# --- ENDPOINTS ---
# ==========================================

class ChannelRequest(BaseModel):
    canal_url: str


@app.get("/status")
def get_status():
    # Determina drive_status combinando estado dinâmico (auth em progresso) com estado do arquivo
    if state.drive_auth_running:
        drive_status = "em_progresso"
    elif state.drive_auth_error:
        drive_status = "erro"
    else:
        drive_status = motor_brainiac.get_drive_status()

    return {
        "is_running":       state.is_running,
        "is_paused":        state.is_paused,
        "canal_url":        state.canal_url,
        "drive_status":     drive_status,
        "drive_auth_error": state.drive_auth_error,
        "stats":            state.stats,
        "logs":             state.logs[-50:]
    }


@app.post("/drive-auth")
def start_drive_auth(background_tasks: BackgroundTasks):
    if state.drive_auth_running:
        return {"message": "Autenticação já está em progresso"}
    if state.is_running:
        return {"message": "Não é possível autenticar durante uma extração", "error": True}

    state.drive_auth_running = True
    state.drive_auth_error   = None
    background_tasks.add_task(run_drive_auth)
    return {"message": "Autenticação iniciada. Conclua o login no navegador que foi aberto."}


@app.post("/drive-auth-cancel")
def cancel_drive_auth():
    state.drive_cancel_event.set()
    state.drive_auth_running = False
    return {"message": "Autenticação cancelada"}


@app.post("/set-channel")
def set_channel(req: ChannelRequest):
    if state.is_running:
        return {"message": "Não é possível alterar o canal durante a execução", "error": True}
    url = req.canal_url.strip()
    state.canal_url = url
    match = re.search(r'@([^/?\s]+)', url)
    state.stats["canal_nome"] = match.group(1) if match else url.rstrip('/').split('/')[-1]
    return {"message": "Canal configurado", "canal_nome": state.stats["canal_nome"]}


class StartRequest(BaseModel):
    fontes: list = []

@app.post("/start")
def start_engine(background_tasks: BackgroundTasks, req: StartRequest = None):
    if not state.canal_url:
        return {"message": "Configure a URL do canal antes de iniciar", "error": True}
    if not state.is_running:
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


@app.post("/pause")
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


@app.post("/cancel")
def cancel_engine():
    if state.is_running:
        state.evento_cancelar.set()
        state.evento_pausa.set()
        state.stats["status"] = "Cancelando..."
        return {"message": "Cancelando"}
    return {"message": "Motor não está rodando"}


@app.get("/history")
def get_history():
    """Retorna resumo de todas as extrações anteriores a partir dos CSVs de gestão."""
    import glob
    import pandas as pd
    history = []
    pattern = os.path.join(motor_brainiac.GESTAO_DIR, "*_base.csv")
    for csv_path in sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True):
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            prefixo = os.path.basename(csv_path).replace("_base.csv", "")
            total   = len(df)
            sucesso = int((df["Status"] == "Sucesso").sum()) if "Status" in df.columns else 0
            sem_leg = int((df["Status"] == "Sem Legenda").sum()) if "Status" in df.columns else 0
            ultima  = df["Data_Extracao"].max() if "Data_Extracao" in df.columns else ""
            canal_url = f"https://www.youtube.com/@{prefixo}"

            # Tenta recuperar a URL real do primeiro registro
            if "Link" in df.columns:
                link = df["Link"].dropna().iloc[0] if len(df) > 0 else ""
                m = re.search(r"@([^/?\s]+)", str(link))
                if m:
                    canal_url = f"https://www.youtube.com/@{m.group(1)}"

            history.append({
                "canal":          prefixo,
                "canal_url":      canal_url,
                "total":          total,
                "extraidos":      sucesso,
                "sem_legenda":    sem_leg,
                "cobertura":      round(sucesso / total * 100) if total > 0 else 0,
                "ultima_extracao": str(ultima),
            })
        except Exception:
            pass
    return history


@app.get("/open-folder")
def open_folder(name: str):
    import subprocess
    folders = {
        "data":        motor_brainiac.DATA_DIR,
        "cerebro_txt": motor_brainiac.LOCAL_TXT_DIR,
        "gestao":      motor_brainiac.GESTAO_DIR,
        "agent_index": agent_brainiac.INDEX_DIR,
    }
    target = folders.get(name)
    if not target:
        return {"error": True, "message": "Pasta desconhecida"}
    os.makedirs(target, exist_ok=True)
    subprocess.Popen(["explorer", target])
    return {"ok": True}


# ==========================================
# --- AGENTE RAG ---
# ==========================================

class AgentConfigRequest(BaseModel):
    provider:      str
    api_key:       str
    embed_api_key: str = ""
    groq_model:    str = ""
    ollama_model:  str = ""

class AgentChatRequest(BaseModel):
    mensagem:      str
    canal_nome:    str
    historico:     list = []
    canais_extras: list = []
    busca_ampla:   bool = False

def _run_indexacao(canal_nome: str, canal_prefixo: str):
    try:
        state.agent_indexing   = True
        state.agent_index_logs = []
        state.agent_index_stop.clear()

        def cb(msg):
            state.agent_index_logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": msg})

        agent_brainiac.indexar(
            canal_nome=canal_nome,
            canal_prefixo=canal_prefixo,
            callback=cb,
            stop_event=state.agent_index_stop,
        )
    except Exception as e:
        state.agent_index_logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": f"❌ Erro na indexação: {e}"})
    finally:
        state.agent_indexing = False


@app.get("/agent/status")
def agent_status():
    status = agent_brainiac.get_agent_status()
    status["indexing"]    = state.agent_indexing
    status["index_logs"]  = state.agent_index_logs[-30:]
    return status


@app.get("/agent/ollama/status")
def ollama_status():
    """Verifica se Ollama está rodando e quais modelos estão instalados."""
    import requests as _req
    try:
        r = _req.get('http://localhost:11434/api/tags', timeout=3)
        models = [m['name'] for m in r.json().get('models', [])]
        return {'running': True, 'models': models}
    except Exception:
        return {'running': False, 'models': []}


@app.post("/agent/ollama/pull")
async def ollama_pull(background_tasks: BackgroundTasks):
    """Inicia o download do modelo padrão llama3.2:1b em background."""
    if not hasattr(state, 'ollama_pull_progress'):
        state.ollama_pull_progress = {'status': 'idle', 'pct': 0, 'message': ''}

    def _pull():
        import requests as _req
        state.ollama_pull_progress = {'status': 'pulling', 'pct': 0, 'message': 'Iniciando download...'}
        try:
            with _req.post(
                'http://localhost:11434/api/pull',
                json={'name': 'llama3.2:1b', 'stream': True},
                stream=True, timeout=600
            ) as resp:
                for line in resp.iter_lines():
                    if not line:
                        continue
                    import json as _json
                    data = _json.loads(line)
                    status = data.get('status', '')
                    completed = data.get('completed', 0)
                    total = data.get('total', 0)
                    pct = int(completed / total * 100) if total > 0 else 0
                    state.ollama_pull_progress = {
                        'status': 'pulling', 'pct': pct,
                        'message': status[:80] if status else ''
                    }
            state.ollama_pull_progress = {'status': 'done', 'pct': 100, 'message': 'Modelo pronto!'}
        except Exception as e:
            state.ollama_pull_progress = {'status': 'error', 'pct': 0, 'message': str(e)[:120]}

    background_tasks.add_task(_pull)
    return {'message': 'Download iniciado.'}


@app.get("/agent/ollama/pull-progress")
def ollama_pull_progress():
    """Retorna o progresso do download do modelo."""
    if not hasattr(state, 'ollama_pull_progress'):
        return {'status': 'idle', 'pct': 0, 'message': ''}
    return state.ollama_pull_progress


@app.get("/agent/canal-meta")
def agent_canal_meta():
    config = agent_brainiac.carregar_config()
    canal_nome = state.stats.get("canal_nome", "") or config.get("canal_indexado", "")
    if not canal_nome:
        return {}
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    return agent_brainiac._carregar_meta_canal(canal_prefixo)


@app.get("/agent/config")
def get_agent_config():
    config = agent_brainiac.carregar_config()
    return {
        "provider":     config.get("provider", "gemini"),
        "api_key":      config.get("api_key", ""),
        "ollama_model": config.get("ollama_model", "llama3.2:1b"),
    }


@app.post("/agent/config")
def agent_config(req: AgentConfigRequest):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação em andamento. Aguarde."}
    config = agent_brainiac.carregar_config()
    config["provider"] = req.provider
    if req.api_key:
        config["api_key"] = req.api_key
    elif req.provider == "ollama":
        config["api_key"] = ""
    if req.embed_api_key:
        config["embed_api_key"] = req.embed_api_key
    if req.groq_model:
        config["groq_model"] = req.groq_model
    if req.ollama_model:
        config["ollama_model"] = req.ollama_model
    agent_brainiac.salvar_config(config)
    return {"message": "Configuração salva com sucesso."}


class AgentIndexRequest(BaseModel):
    canal_nome: str = ""

@app.post("/agent/index")
def agent_index(background_tasks: BackgroundTasks, req: AgentIndexRequest = None):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação já está em andamento."}
    if state.is_running:
        return {"error": True, "message": "Aguarde a extração terminar antes de indexar."}

    # Aceita canal do estado global ou do corpo da requisição (fallback pós-restart)
    canal_nome = state.stats.get("canal_nome", "") or (req.canal_nome if req else "")
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_') if canal_nome else ""

    if not canal_nome:
        return {"error": True, "message": "Nenhum canal configurado."}

    # Indexação BM25 é 100% local — não requer chave de API.

    background_tasks.add_task(_run_indexacao, canal_nome, canal_prefixo)
    return {"message": f"Indexação iniciada para @{canal_nome}."}


@app.post("/agent/test-key")
def agent_test_key():
    config = agent_brainiac.carregar_config()
    provider = config.get("provider", "")
    if not provider or (not config.get("api_key") and provider != "ollama"):
        return {"error": True, "message": "Nenhuma chave configurada."}
    try:
        provider = config["provider"]
        api_key  = config["api_key"]
        if provider == "ollama":
            import requests as _req
            r = _req.get('http://localhost:11434/api/tags', timeout=3)
            models = [m['name'] for m in r.json().get('models', [])]
            if not models:
                return {"error": True, "message": "Ollama rodando mas nenhum modelo instalado. Instale um modelo primeiro."}
            return {"ok": True, "message": f"Ollama ativo! Modelos: {', '.join(models[:3])}"}
        if provider == "groq":
            from openai import OpenAI
            modelo = config.get("groq_model", "llama-3.1-8b-instant")
            OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1").chat.completions.create(
                model=modelo,
                messages=[{"role": "user", "content": "ok"}],
                max_tokens=1,
            )
            return {"ok": True, "message": f"Groq ativo! Modelo: {modelo}"}
        if provider == "openai":
            from openai import OpenAI
            OpenAI(api_key=api_key).chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "ok"}],
                max_tokens=1,
            )
        elif provider == "anthropic":
            import anthropic
            anthropic.Anthropic(api_key=api_key).messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "ok"}],
            )
        elif provider in ("gemini", "google"):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            modelos_disponiveis = [
                m.name.replace("models/", "")
                for m in _genai.list_models()
                if "generateContent" in m.supported_generation_methods
            ]
            CANDIDATOS = [
                "gemini-1.5-flash", "gemini-1.5-flash-latest",
                "gemini-1.5-flash-002", "gemini-1.5-pro",
                "gemini-pro", "gemini-2.0-flash-lite",
            ]
            modelo_escolhido = next(
                (m for m in CANDIDATOS if m in modelos_disponiveis), None
            )
            if not modelo_escolhido:
                return {
                    "error": True,
                    "message": f"Nenhum modelo compatível encontrado. Disponíveis: {', '.join(modelos_disponiveis[:5])}"
                }
            _genai.GenerativeModel(modelo_escolhido).generate_content("ok")
            return {"ok": True, "message": f"Chave válida! Modelo: {modelo_escolhido}"}
        return {"ok": True, "message": "Chave válida! Conexão estabelecida com sucesso."}
    except Exception as e:
        return {"error": True, "message": f"Chave inválida: {e}"}


@app.post("/agent/index-cancel")
def agent_index_cancel():
    state.agent_index_stop.set()
    return {"message": "Indexação cancelada."}


@app.post("/agent/chat")
def agent_chat(req: AgentChatRequest):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação em andamento. Aguarde."}
    try:
        with state.agent_chat_lock:
            resultado = agent_brainiac.chat(req.mensagem, req.canal_nome, req.historico, req.canais_extras, req.busca_ampla)
        return resultado
    except Exception as e:
        return {"error": True, "message": str(e)}


class AgentChatStreamRequest(BaseModel):
    mensagem:      str
    canal_nome:    str
    historico:     list = []
    canais_extras: list = []
    busca_ampla:   bool = False

@app.post("/agent/chat/stream")
def agent_chat_stream(req: AgentChatStreamRequest):
    if state.agent_indexing:
        def _err():
            yield json.dumps({'error': 'Indexação em andamento. Aguarde.'})
        return StreamingResponse(_err(), media_type='text/plain')

    def _gen():
        try:
            for chunk in agent_brainiac.chat_stream(req.mensagem, req.canal_nome, req.historico, req.canais_extras, req.busca_ampla):
                yield chunk + '\n'
        except Exception as e:
            yield json.dumps({'error': str(e)}) + '\n'

    return StreamingResponse(_gen(), media_type='text/plain')


@app.delete("/agent/canal/{canal_nome}")
def agent_canal_delete(canal_nome: str):
    import re as _re
    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    idx_path = agent_brainiac._index_path(canal_prefixo)
    agent_brainiac._invalidar_cache(canal_prefixo)
    if os.path.exists(idx_path):
        os.remove(idx_path)
        # Remove from config if it was the active canal
        config = agent_brainiac.carregar_config()
        if config.get('canal_indexado') == canal_nome:
            config['canal_indexado'] = ''
            agent_brainiac.salvar_config(config)
        return {"ok": True}
    return {"error": True, "message": "Índice não encontrado"}


# ==========================================
# --- REPOSITÓRIO / CEREBRO ---
# ==========================================

@app.get("/repositorio")
def get_repositorio():
    """Lista todos os arquivos do cerebro por tipo."""
    cerebro_dir = motor_brainiac.CEREBRO_DIR

    result = {"youtube": [], "documentos": [], "textos": []}

    # YouTube files
    yt_dir = motor_brainiac.LOCAL_TXT_DIR
    if os.path.exists(yt_dir):
        for fname in sorted(os.listdir(yt_dir)):
            if fname.endswith('.txt') and not fname.startswith('_'):
                fpath = os.path.join(yt_dir, fname)
                stat = os.stat(fpath)
                result["youtube"].append({
                    "nome": fname,
                    "tamanho": stat.st_size,
                    "data": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y"),
                    "caminho": fpath,
                })

    # Documentos
    doc_dir = os.path.join(cerebro_dir, "documentos")
    manifest_doc = os.path.join(doc_dir, "_manifest.json")
    if os.path.exists(manifest_doc):
        with open(manifest_doc, 'r', encoding='utf-8') as f:
            result["documentos"] = json.load(f)

    # Textos
    txt_dir2 = os.path.join(cerebro_dir, "textos")
    manifest_txt = os.path.join(txt_dir2, "_manifest.json")
    if os.path.exists(manifest_txt):
        with open(manifest_txt, 'r', encoding='utf-8') as f:
            result["textos"] = json.load(f)

    return result


@app.get("/relatorio/{canal}")
def get_relatorio(canal: str):
    """Retorna dados do CSV de gestão para o canal especificado."""
    import re as _re
    canal_safe = _re.sub(r'[<>:"/\\|?*\s]', '_', canal).strip('_')
    csv_path = os.path.join(motor_brainiac.GESTAO_DIR, f"{canal_safe}_base.csv")
    if not os.path.exists(csv_path):
        return {"error": True, "message": "Relatório não encontrado"}
    try:
        import pandas as _pd
        df = _pd.read_csv(csv_path, encoding='utf-8-sig')
        stats = {
            "total": len(df),
            "sucesso": int((df["Status"] == "Sucesso").sum()) if "Status" in df.columns else 0,
            "sem_legenda": int((df["Status"] == "Sem Legenda").sum()) if "Status" in df.columns else 0,
            "legenda_curta": int((df["Status"] == "Legenda Curta").sum()) if "Status" in df.columns else 0,
            "cobertura": 0,
        }
        if stats["total"] > 0:
            stats["cobertura"] = round(stats["sucesso"] / stats["total"] * 100, 1)
        videos = df.fillna('').to_dict('records')
        return {"stats": stats, "videos": videos[:500]}
    except Exception as e:
        return {"error": True, "message": str(e)}


@app.post("/cerebro/upload")
async def cerebro_upload(
    arquivo: UploadFile = File(...),
    canal: str = Form(default="")
):
    """Recebe arquivo (PDF, DOCX, MD, TXT) e converte para .txt no cerebro/documentos/."""
    import uuid as _uuid

    cerebro_dir = motor_brainiac.CEREBRO_DIR
    doc_dir = os.path.join(cerebro_dir, "documentos")
    os.makedirs(doc_dir, exist_ok=True)

    ext = os.path.splitext(arquivo.filename)[1].lower()
    fid = str(_uuid.uuid4())[:8]
    nome_limpo = re.sub(r'[^a-zA-Z0-9_\-]', '_', os.path.splitext(arquivo.filename)[0])[:40]

    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    conteudo_bytes = await arquivo.read()
    if len(conteudo_bytes) > MAX_FILE_SIZE:
        return {"error": True, "message": "Arquivo excede o limite de 50 MB"}
    texto = ""

    try:
        if ext == ".pdf":
            import pdfplumber, io
            with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
                texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
        elif ext in (".docx",):
            import docx, io
            doc = docx.Document(io.BytesIO(conteudo_bytes))
            texto = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif ext in (".txt", ".md"):
            texto = conteudo_bytes.decode("utf-8", errors="replace")
        else:
            return {"error": True, "message": f"Formato não suportado: {ext}"}
    except Exception as e:
        return {"error": True, "message": f"Erro ao processar arquivo: {e}"}

    if not texto.strip():
        return {"error": True, "message": "Arquivo sem conteúdo extraível"}

    txt_path = os.path.join(doc_dir, f"{fid}_{nome_limpo}.txt")
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(f"TITULO: {arquivo.filename}\nFONTE: documento\nDATA: {datetime.now().strftime('%d/%m/%Y')}\n")
        f.write("-" * 70 + "\n")
        f.write(texto)

    # Update manifest
    manifest_path = os.path.join(doc_dir, "_manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

    entry = {
        "id": fid,
        "nome_original": arquivo.filename,
        "nome_txt": os.path.basename(txt_path),
        "tipo": ext.lstrip("."),
        "tamanho": len(conteudo_bytes),
        "data": datetime.now().strftime("%d/%m/%Y"),
        "chars": len(texto),
    }
    manifest.append(entry)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return {"ok": True, "id": fid, "nome": arquivo.filename, "chars": len(texto)}


class TextoRequest(BaseModel):
    titulo: str
    conteudo: str

@app.post("/cerebro/texto")
def cerebro_texto(req: TextoRequest):
    """Salva texto colado pelo usuário no cerebro/textos/."""
    import uuid as _uuid

    cerebro_dir = motor_brainiac.CEREBRO_DIR
    txt_dir2 = os.path.join(cerebro_dir, "textos")
    os.makedirs(txt_dir2, exist_ok=True)

    if not req.conteudo.strip():
        return {"error": True, "message": "Conteúdo vazio"}

    fid = str(_uuid.uuid4())[:8]
    nome_limpo = re.sub(r'[^a-zA-Z0-9_\-]', '_', req.titulo)[:40] if req.titulo else "texto"
    txt_path = os.path.join(txt_dir2, f"{fid}_{nome_limpo}.txt")

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(f"TITULO: {req.titulo}\nFONTE: texto\nDATA: {datetime.now().strftime('%d/%m/%Y')}\n")
        f.write("-" * 70 + "\n")
        f.write(req.conteudo)

    manifest_path = os.path.join(txt_dir2, "_manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

    entry = {
        "id": fid,
        "titulo": req.titulo,
        "nome_txt": os.path.basename(txt_path),
        "tipo": "texto",
        "chars": len(req.conteudo),
        "data": datetime.now().strftime("%d/%m/%Y"),
    }
    manifest.append(entry)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return {"ok": True, "id": fid, "titulo": req.titulo}


@app.delete("/cerebro/arquivo/{tipo}/{fid}")
def cerebro_delete(tipo: str, fid: str):
    """Remove arquivo do cerebro (documentos ou textos)."""
    cerebro_dir = motor_brainiac.CEREBRO_DIR

    if tipo not in ("documentos", "textos"):
        return {"error": True, "message": "Tipo inválido"}

    subdir = os.path.join(cerebro_dir, tipo)
    manifest_path = os.path.join(subdir, "_manifest.json")

    if not os.path.exists(manifest_path):
        return {"error": True, "message": "Manifesto não encontrado"}

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    entry = next((e for e in manifest if e["id"] == fid), None)
    if not entry:
        return {"error": True, "message": "Arquivo não encontrado"}

    txt_path = os.path.join(subdir, entry["nome_txt"])
    real_path = os.path.realpath(txt_path)
    real_subdir = os.path.realpath(subdir)
    if not real_path.startswith(real_subdir + os.sep):
        return {"error": True, "message": "Caminho inválido"}
    if os.path.exists(txt_path):
        os.remove(txt_path)

    manifest = [e for e in manifest if e["id"] != fid]
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return {"ok": True}


# ==========================================
# --- SERVIR FRONTEND ESTÁTICO ---
# ==========================================

@app.get("/{file_path:path}")
async def serve_static(file_path: str):
    if os.path.exists(frontend_dist):
        full_path = os.path.join(frontend_dist, file_path)
        if os.path.isfile(full_path):
            return FileResponse(full_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
    return {"error": "Frontend não compilado. Execute: cd web_interface && npm run build"}


if __name__ == "__main__":
    import uvicorn
    import subprocess
    from threading import Timer
    try:
        _real_stderr
    except NameError:
        _real_stderr = sys.__stderr__

    # Quando rodando dentro do Electron a janela é gerenciada pelo main.js
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
