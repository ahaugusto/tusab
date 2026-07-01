# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas do agente RAG: configuração, indexação, chat e integrações Ollama.
"""

import os
import re
import sys
import json
import time

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

import agent_tusab
from tusab_engine.state import state

router = APIRouter()

_MAX_HIST_MSGS = 12  # 6 trocas user+assistant
_test_key_last: float = 0.0  # rate-limit: máx 1 chamada por 5s


# ── Background helper ─────────────────────────────────────────────────────────

def _fix_encoding(texto: str) -> str:
    """Corrige mojibake latin-1→utf-8 comum em títulos extraídos do YouTube."""
    try:
        return texto.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return texto


def _gerar_perguntas_sugeridas(canal_prefixo: str, n: int = 3) -> list:
    """Gera até n perguntas sugeridas a partir dos títulos dos chunks indexados."""
    import random
    from tusab_engine.agent.index import _index_path
    from tusab_engine.storage import INDEX_DIR

    idx_path = _index_path(canal_prefixo)
    if not os.path.exists(idx_path):
        return []
    try:
        with open(idx_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        chunks = data.get('chunks', [])
        if not chunks:
            return []

        # Extrai títulos únicos não vazios
        titulos = list({c['titulo'] for c in chunks if c.get('titulo') and len(c['titulo']) > 10})
        if not titulos:
            return []

        # Escolhe n títulos aleatórios e formula perguntas
        amostra = random.sample(titulos, min(n, len(titulos)))
        templates = [
            "O que foi discutido sobre {}?",
            "Quais são os principais pontos sobre {}?",
            "Me explique o conteúdo de {}.",
        ]
        perguntas = []
        for i, titulo in enumerate(amostra):
            tmpl = templates[i % len(templates)]
            # Limpa o título (remove extensão .txt, underscores, etc.) e corrige encoding
            titulo_limpo = re.sub(r'\.txt$', '', titulo).replace('_', ' ').strip()
            titulo_limpo = _fix_encoding(titulo_limpo)
            perguntas.append(tmpl.format(titulo_limpo))
        return perguntas
    except Exception:
        return []


def _run_indexacao(canal_nome: str, canal_prefixo: str):
    try:
        state.agent_indexing   = True
        state.agent_index_logs = []
        state.agent_index_stop.clear()
        def cb(msg):
            state.agent_index_logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": msg})

        agent_tusab.indexar(
            canal_nome=canal_nome,
            canal_prefixo=canal_prefixo,
            callback=cb,
            stop_event=state.agent_index_stop,
        )
        state.perguntas_sugeridas[canal_prefixo] = _gerar_perguntas_sugeridas(canal_prefixo)
    except Exception as e:
        state.agent_index_logs.append({"timestamp": time.strftime("%H:%M:%S"), "message": f"❌ Erro na indexação: {e}"})
    finally:
        state.agent_indexing = False


# ── Models ────────────────────────────────────────────────────────────────────

_PERSONAS_VALIDAS = {'', 'objetivo', 'tecnico', 'didatico', 'descontraido', 'socratico'}

class AgentConfigRequest(BaseModel):
    provider:      str  = Field(max_length=30)
    api_key:       str  = Field(max_length=300)
    embed_api_key: str  = Field(default="", max_length=300)
    groq_model:    str  = Field(default="", max_length=80)
    ollama_model:  str  = Field(default="", max_length=80)
    persona:       str  = Field(default="", max_length=30)
    idioma:        str  = Field(default="pt", max_length=10)

class AgentChatRequest(BaseModel):
    mensagem:       str  = Field(max_length=4000)
    canal_nome:     str  = Field(max_length=120)
    historico:      list = []
    canais_extras:  list = []
    busca_ampla:    bool = False
    fontes_fixadas: list = []
    perfil:         str  = Field(default='', max_length=30)

class BuscarTrechosRequest(BaseModel):
    query:       str  = Field(max_length=1000)
    canais:      list = []   # lista de nomes de canal/projeto para buscar
    n:           int  = Field(default=8, ge=1, le=30)
    busca_ampla: bool = True  # CrossEncoder ativo por padrão na busca manual

class AgentIndexRequest(BaseModel):
    canal_nome: str = Field(default="", max_length=120)

class FeedbackRequest(BaseModel):
    canal_nome: str  = Field(max_length=120)
    pergunta:   str  = Field(max_length=4000)
    resposta:   str  = Field(max_length=20000)
    util:       bool = True   # True = salva; False = descarta (apenas registra log)

class SalvarHistoricoRequest(BaseModel):
    canal_nome: str  = Field(max_length=120)
    mensagens:  list = []

class TestKeyRequest(BaseModel):
    provider: str = Field(default='', max_length=30)
    api_key:  str = Field(default='', max_length=300)

class AgentChatStreamRequest(BaseModel):
    mensagem:       str  = Field(max_length=4000)
    canal_nome:     str  = Field(max_length=120)
    historico:      list = []
    canais_extras:  list = []
    busca_ampla:    bool = False
    fontes_fixadas: list = []
    perfil:         str  = Field(default='', max_length=30)


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _bases_com_arquivos_novos(canais_indexados: list) -> list[str]:
    """Retorna nomes de canais cujo índice está desatualizado (arquivo mais novo que indexed_at)."""
    from tusab_engine.storage import NEURAL_DIR
    desatualizadas = []
    for canal in canais_indexados:
        indexed_at = canal.get("indexed_at")
        if not indexed_at:
            continue
        nome = canal["nome"]
        prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', nome).strip('_')
        canal_dir = os.path.join(NEURAL_DIR, prefixo)
        for sub in ['documents', 'texts', 'youtube']:
            pasta = os.path.join(canal_dir, sub)
            if not os.path.isdir(pasta):
                continue
            for fname in os.listdir(pasta):
                if fname.startswith('_'):
                    continue
                fpath = os.path.join(pasta, fname)
                try:
                    if os.path.getmtime(fpath) > indexed_at + 5:
                        desatualizadas.append(nome)
                        break
                except OSError:
                    pass
            else:
                continue
            break
    return desatualizadas


@router.get("/agent/status")
def agent_status(canal: str = ""):
    from tusab_engine.agent.config import registrar_primeiro_uso
    import re as _re
    status = agent_tusab.get_agent_status()
    status["indexing"]   = state.agent_indexing
    status["index_logs"] = state.agent_index_logs[-30:]
    try:
        from tusab_engine.agent.chat import cross_encoder_loading
        status["cross_encoder_loading"] = cross_encoder_loading
    except Exception:
        status["cross_encoder_loading"] = False
    if not state.agent_indexing and canal:
        prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal).strip('_')
        status["perguntas_sugeridas"] = state.perguntas_sugeridas.get(prefixo, [])
    else:
        status["perguntas_sugeridas"] = []
    retencao = registrar_primeiro_uso()
    status["primeiro_uso"]       = retencao["primeiro_uso"]
    status["dias_desde_install"] = retencao["dias_desde_install"]
    status["retencao_dia"]       = retencao["retencao_dia"]   # 1 | 7 | 30 | None
    status["bases_desatualizadas"] = _bases_com_arquivos_novos(status.get("canais_indexados", []))
    # Sumarização assíncrona
    status["summarizing"]        = state.summarizing
    status["summarize_logs"]     = state.summarize_logs[-20:]
    # Converte dict {prefixo: {n, total}} em percentual agregado 0-100
    prog = state.summarize_progress
    if prog:
        total_all = sum(v.get('total', 0) for v in prog.values())
        done_all  = sum(v.get('n', 0)     for v in prog.values())
        status["summarize_progress"] = int(done_all / total_all * 100) if total_all else 0
    else:
        status["summarize_progress"] = 0
    return status


@router.get("/agent/base-summary")
def agent_base_summary():
    """Agrega métricas de inventário por projeto para o painel de visibilidade da base."""
    import time
    from tusab_engine.storage import NEURAL_DIR, INDEX_DIR

    status = agent_tusab.get_agent_status()
    canais_indexados = {c["nome"]: c for c in status.get("canais_indexados", [])}

    projetos = []
    if os.path.isdir(NEURAL_DIR):
        for prefixo in sorted(os.listdir(NEURAL_DIR)):
            pasta = os.path.join(NEURAL_DIR, prefixo)
            if not os.path.isdir(pasta):
                continue

            contagens = {}
            ultima_adicao = 0
            for sub in ['youtube', 'documents', 'texts']:
                sub_dir = os.path.join(pasta, sub)
                if not os.path.isdir(sub_dir):
                    contagens[sub] = 0
                    continue
                arquivos = [f for f in os.listdir(sub_dir) if not f.startswith('_')]
                contagens[sub] = len(arquivos)
                for f in arquivos:
                    try:
                        mt = os.path.getmtime(os.path.join(sub_dir, f))
                        if mt > ultima_adicao:
                            ultima_adicao = mt
                    except OSError:
                        pass

            total = sum(contagens.values())
            if total == 0:
                continue

            idx_path = os.path.join(INDEX_DIR, f"{prefixo}.json")
            idx_mtime = None
            try:
                idx_mtime = int(os.path.getmtime(idx_path))
            except OSError:
                pass

            nome_canal = next(
                (n for n in canais_indexados if re.sub(r'[<>:"/\\|?*\s]', '_', n).strip('_') == prefixo),
                prefixo
            )
            info = canais_indexados.get(nome_canal, {})

            projetos.append({
                "prefixo":       prefixo,
                "nome":          nome_canal,
                "n_youtube":     contagens.get('youtube', 0),
                "n_documents":   contagens.get('documents', 0),
                "n_texts":       contagens.get('texts', 0),
                "total":         total,
                "indexado":      idx_mtime is not None,
                "indexed_at":    idx_mtime,
                "ultima_adicao": int(ultima_adicao) if ultima_adicao else None,
                "n_chunks":      info.get("n_chunks", 0),
            })

    return {"projetos": projetos}


@router.get("/agent/mencoes/{canal_nome}")
def agent_mencoes(canal_nome: str):
    """Lista itens mencionáveis via @ no chat: bases indexadas + documentos do canal ativo."""
    from tusab_engine.storage import NEURAL_DIR

    # Bases indexadas (canais com índice BM25)
    bases = []
    status = agent_tusab.get_agent_status()
    for c in status.get("canais_indexados", []):
        bases.append({
            "tipo":   "base",
            "id":     c["nome"],
            "label":  c["nome"],
            "emoji":  "🗂",
            "chunks": c.get("chunks", 0),
        })

    # Documentos do canal ativo
    documentos = []
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    canal_dir = os.path.join(NEURAL_DIR, canal_prefixo)

    _EMOJIS = {
        "youtube":      "🎬",
        "documents":    "📄",
        "documentos":   "📄",
        "texts":        "📝",
        "textos":       "📝",
        "conversas":    "💬",
        "transcricoes": "🎙",
    }

    def _listar_pasta(pasta_path, pasta_id, emoji):
        if not os.path.isdir(pasta_path):
            return
        for fname in sorted(os.listdir(pasta_path)):
            if not fname.endswith(".txt") or fname.startswith("_"):
                continue
            label = fname.replace(".txt", "")
            documentos.append({
                "tipo":    "documento",
                "id":      f"{pasta_id}/{fname}",
                "label":   label,
                "emoji":   emoji,
                "pasta":   pasta_id,
                "arquivo": fname,
            })

    if os.path.isdir(canal_dir):
        for sub in sorted(os.listdir(canal_dir)):
            sub_path = os.path.join(canal_dir, sub)
            if os.path.isdir(sub_path):
                _listar_pasta(sub_path, sub, _EMOJIS.get(sub, "📁"))

    return {"bases": bases, "documentos": documentos}


@router.get("/log", response_class=HTMLResponse)
def log_viewer():
    """Página HTML standalone com log de indexação em tempo real."""
    return HTMLResponse("""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Tusab — Log de Indexação</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;padding:1.5rem;min-height:100vh}
    h1{font-size:1rem;font-weight:700;color:#a78bfa;margin-bottom:.25rem}
    .sub{font-size:.75rem;color:#475569;margin-bottom:1.5rem}
    #log{background:#020817;border:1px solid #1e293b;border-radius:.75rem;padding:1rem;min-height:200px;max-height:80vh;overflow-y:auto;font-size:.78rem;line-height:1.7}
    .entry{color:#94a3b8}
    .entry.ok{color:#34d399}
    .entry.err{color:#f87171}
    .entry.info{color:#a78bfa}
    #status{margin-top:.75rem;font-size:.72rem;color:#334155}
  </style>
</head>
<body>
  <h1>Tusab — Log de Indexação</h1>
  <div class="sub">Atualização automática a cada 1 s &nbsp;·&nbsp; <a href="javascript:void(0)" onclick="clearLog()" style="color:#475569">limpar</a></div>
  <div id="log"><span style="color:#334155">Aguardando logs...</span></div>
  <div id="status"></div>
  <script>
    const el = document.getElementById('log');
    const st = document.getElementById('status');
    let seen = 0;
    function clearLog(){ el.innerHTML=''; seen=0; }
    function colorClass(msg){
      if(msg.includes('✅')||msg.includes('concluí')) return 'ok';
      if(msg.includes('❌')||msg.includes('Erro')) return 'err';
      if(msg.includes('🔍')||msg.includes('📦')||msg.includes('📄')) return 'info';
      return '';
    }
    async function poll(){
      try{
        const r = await fetch('/agent/status');
        const d = await r.json();
        const logs = d.index_logs || [];
        if(logs.length > seen){
          if(seen === 0) el.innerHTML = '';
          logs.slice(seen).forEach(l=>{
            const div = document.createElement('div');
            div.className = 'entry ' + colorClass(l.message);
            div.textContent = '[' + l.timestamp + '] ' + l.message;
            el.appendChild(div);
          });
          seen = logs.length;
          el.scrollTop = el.scrollHeight;
        }
        st.textContent = d.indexing ? '⏳ Indexação em andamento…' : (seen > 0 ? '✅ Indexação concluída.' : 'Sem atividade de indexação.');
      }catch(e){ st.textContent = '⚠ Sem conexão com o backend.'; }
    }
    poll();
    setInterval(poll, 1000);
  </script>
</body>
</html>""")


@router.get("/agent/ollama/status")
def ollama_status():
    """Verifica se Ollama está rodando e quais modelos estão instalados."""
    import requests as _req
    try:
        r = _req.get('http://localhost:11434/api/tags', timeout=3)
        models = [m['name'] for m in r.json().get('models', [])]
        return {'running': True, 'models': models}
    except Exception:
        return {'running': False, 'models': []}


class OllamaPullRequest(BaseModel):
    model: str = 'llama3.2:1b'

@router.post("/agent/ollama/pull")
async def ollama_pull(payload: OllamaPullRequest = None, background_tasks: BackgroundTasks = None):
    """Inicia o download de um modelo Ollama em background."""
    model_name = (payload.model if payload else None) or 'llama3.2:1b'
    if not hasattr(state, 'ollama_pull_progress'):
        state.ollama_pull_progress = {'status': 'idle', 'pct': 0, 'message': '', 'model': ''}

    def _pull(name: str):
        import requests as _req
        state.ollama_pull_progress = {'status': 'pulling', 'pct': 0, 'message': 'Iniciando download...', 'model': name}
        try:
            with _req.post(
                'http://localhost:11434/api/pull',
                json={'name': name, 'stream': True},
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
                        'message': status[:80] if status else '',
                        'model': name,
                    }
            state.ollama_pull_progress = {'status': 'done', 'pct': 100, 'message': 'Modelo pronto!', 'model': name}
        except Exception as e:
            state.ollama_pull_progress = {'status': 'error', 'pct': 0, 'message': str(e)[:120], 'model': name}

    background_tasks.add_task(_pull, model_name)
    return {'message': 'Download iniciado.', 'model': model_name}


@router.get("/agent/ollama/pull-progress")
def ollama_pull_progress():
    """Retorna o progresso do download do modelo."""
    if not hasattr(state, 'ollama_pull_progress'):
        return {'status': 'idle', 'pct': 0, 'message': ''}
    return state.ollama_pull_progress


@router.get("/agent/canal-meta")
def agent_canal_meta():
    config = agent_tusab.carregar_config()
    canal_nome = state.stats.get("canal_nome", "") or config.get("canal_indexado", "")
    if not canal_nome:
        return {}
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    return agent_tusab._carregar_meta_canal(canal_prefixo)


@router.get("/agent/config")
def get_agent_config():
    config = agent_tusab.carregar_config()
    raw_key = config.get("api_key", "")
    return {
        "provider":     config.get("provider", "gemini"),
        "api_key":      "***" if raw_key else "",
        "ollama_model": config.get("ollama_model", "llama3.2:1b"),
        "persona":      config.get("persona", ""),
        "query_expansion": config.get("query_expansion", False),
    }


@router.post("/agent/config")
def agent_config(req: AgentConfigRequest):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação em andamento. Aguarde."}
    config = agent_tusab.carregar_config()
    config["provider"] = req.provider
    # '__keep__' é sentinel do frontend para sincronizações parciais (ex.: troca de idioma)
    # que não devem sobrescrever a chave já persistida (WARN-19).
    if req.api_key and req.api_key != '__keep__':
        config["api_key"] = req.api_key
    elif req.provider == "ollama" and req.api_key != '__keep__':
        config["api_key"] = ""
    if req.embed_api_key:
        config["embed_api_key"] = req.embed_api_key
    if req.groq_model:
        config["groq_model"] = req.groq_model
    if req.ollama_model:
        config["ollama_model"] = req.ollama_model
    if req.persona in _PERSONAS_VALIDAS:
        config["persona"] = req.persona
    if req.idioma in ("pt", "en", "es"):
        config["idioma"] = req.idioma
    agent_tusab.salvar_config(config)
    return {"message": "Configuração salva com sucesso."}


@router.post("/agent/index")
def agent_index(background_tasks: BackgroundTasks, req: AgentIndexRequest = None):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação já está em andamento."}
    if state.is_running:
        return {"error": True, "message": "Aguarde a extração terminar antes de indexar."}

    # req.canal_nome tem prioridade — usuário escolheu explicitamente no modal.
    # Fallback para state.stats só quando o request não especifica canal.
    canal_nome = (req.canal_nome if req and req.canal_nome else "") or state.stats.get("canal_nome", "")
    if not canal_nome:
        canal_nome = "repositorio"
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')

    background_tasks.add_task(_run_indexacao, canal_nome, canal_prefixo)
    msg = f"Indexação iniciada para @{canal_nome}." if canal_nome != "repositorio" else "Indexação do repositório iniciada."
    return {"message": msg}


@router.post("/agent/test-key")
def agent_test_key(req: TestKeyRequest = None):
    global _test_key_last
    now = time.time()
    if now - _test_key_last < 5.0:
        return {"error": True, "message": "Aguarde alguns segundos antes de testar novamente."}
    _test_key_last = now
    if req and req.provider and req.api_key:
        config = {"provider": req.provider, "api_key": req.api_key}
    else:
        config = agent_tusab.carregar_config()
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


@router.post("/agent/index-cancel")
def agent_index_cancel():
    state.agent_index_stop.set()
    return {"message": "Indexação cancelada."}


def _atualizar_chat_stats(canal_nome: str, n_refs: int = 0):
    """Incrementa contadores de interações em _chat_stats.json do projeto."""
    import re as _re
    from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    if not canal_prefixo:
        return
    stats_path = os.path.join(NEURAL_DIR, canal_prefixo, 'management', '_chat_stats.json')
    mgmt_dir = os.path.dirname(stats_path)
    os.makedirs(mgmt_dir, exist_ok=True)

    stats = {}
    if os.path.exists(stats_path):
        try:
            with open(stats_path, 'r', encoding='utf-8') as f:
                stats = json.load(f)
        except Exception:
            stats = {}

    stats['total_interactions'] = stats.get('total_interactions', 0) + 1
    stats['total_refs_used']    = stats.get('total_refs_used', 0) + n_refs
    stats['last_interaction']   = time.strftime('%Y-%m-%d')
    salvar_json_atomico(stats, stats_path, indent=2)


@router.get("/agent/chat-stats")
def agent_chat_stats():
    """Retorna stats de interações por projeto (lê _chat_stats.json de cada projeto)."""
    from tusab_engine.storage import NEURAL_DIR

    result = {}
    if not os.path.isdir(NEURAL_DIR):
        return result
    for projeto in os.listdir(NEURAL_DIR):
        stats_path = os.path.join(NEURAL_DIR, projeto, 'management', '_chat_stats.json')
        if os.path.exists(stats_path):
            try:
                with open(stats_path, 'r', encoding='utf-8') as f:
                    result[projeto] = json.load(f)
            except Exception:
                pass
    return result


def _serializar_historico_bm25(mensagens: list, canal_nome: str, titulo: str) -> str:
    """Serializa histórico de chat no formato par P+R otimizado para BM25.

    Cada par user+assistant vira um bloco separado com TEMA, DATA, PERGUNTA,
    RESPOSTA e FONTES. O indexador BM25 recupera por qualquer um desses campos.
    Respostas incluídas para rastreabilidade: 'de onde veio essa informação?'
    """
    from datetime import datetime as _dt

    data_str = _dt.now().strftime("%d/%m/%Y")
    header = (
        f"TITULO: {titulo}\n"
        f"FONTE: historico_chat\n"
        f"CANAL: {canal_nome}\n"
        f"DATA: {data_str}\n"
        + "-" * 70 + "\n\n"
    )

    # Emparelha user → assistant
    blocos = []
    i = 0
    while i < len(mensagens):
        msg = mensagens[i]
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role != "user" or not content:
            i += 1
            continue

        pergunta = content.strip()

        # Procura a resposta imediatamente seguinte
        resposta = ""
        fontes_txt = ""
        if i + 1 < len(mensagens):
            prox = mensagens[i + 1]
            if prox.get("role") == "assistant":
                resposta = prox.get("content", "").strip()
                fontes = prox.get("fontes", [])
                if fontes:
                    nomes = []
                    for f in fontes:
                        nome = f.get("titulo") or f.get("arquivo") or ""
                        if nome and nome not in nomes:
                            nomes.append(nome)
                    fontes_txt = " · ".join(nomes)
                i += 1  # consome a resposta

        # Deriva tema a partir das primeiras palavras da pergunta
        palavras = pergunta.split()
        tema = " ".join(palavras[:8]) + ("…" if len(palavras) > 8 else "")

        bloco = f"TEMA: {tema}\n"
        bloco += f"PERGUNTA: {pergunta}\n"
        if resposta:
            bloco += f"RESPOSTA: {resposta[:1200]}\n"
        if fontes_txt:
            bloco += f"FONTES: {fontes_txt}\n"
        bloco += "\n"
        blocos.append(bloco)
        i += 1

    return header + "\n".join(blocos) if blocos else ""


def _auto_salvar_historico(canal_nome: str, mensagens: list) -> None:
    """Salva histórico em texts/_chat_history/ no formato BM25-friendly.

    Chamado automaticamente ao limpar/trocar canal. Silencioso em caso de erro.
    Arquivo salvo com prefixo '_' — ignorado pelo indexador por padrão.
    Mínimo de 2 mensagens (1 par P+R) para salvar.
    """
    import uuid as _uuid
    import re as _re
    from datetime import datetime as _dt
    from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

    msgs_validas = [
        m for m in mensagens
        if m.get("role") in ("user", "assistant") and m.get("content", "").strip()
    ]
    if len(msgs_validas) < 2:
        return

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    if not canal_prefixo:
        return

    try:
        hist_dir = os.path.join(NEURAL_DIR, canal_prefixo, "texts", "_chat_history")
        os.makedirs(hist_dir, exist_ok=True)

        ts  = _dt.now().strftime("%Y%m%d_%H%M%S")
        fid = str(_uuid.uuid4())[:8]
        titulo = f"Chat — {canal_nome} — {_dt.now().strftime('%d/%m/%Y %H:%M')}"
        nome_arquivo = f"_hist_{fid}_{ts}.txt"
        txt_path = os.path.join(hist_dir, nome_arquivo)

        conteudo = _serializar_historico_bm25(msgs_validas, canal_nome, titulo)
        if not conteudo:
            return

        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(conteudo)

        # Manifesto local em _chat_history/_index.json
        idx_path = os.path.join(hist_dir, "_index.json")
        idx = []
        if os.path.exists(idx_path):
            try:
                with open(idx_path, "r", encoding="utf-8") as f:
                    idx = json.load(f)
            except Exception:
                pass
        idx.insert(0, {
            "id":           fid,
            "titulo":       titulo,
            "nome_arquivo": nome_arquivo,
            "canal":        canal_nome,
            "data":         _dt.now().strftime("%d/%m/%Y"),
            "ts":           ts,
            "n_pares":      sum(1 for m in msgs_validas if m.get("role") == "user"),
            "chars":        len(conteudo),
            "indexado":     False,
        })
        # Mantém no máximo 200 entradas
        idx = idx[:200]
        salvar_json_atomico(idx, idx_path, indent=2)
    except Exception:
        pass  # nunca bloqueia o clear


@router.post("/agent/feedback")
def agent_feedback(req: FeedbackRequest):
    """Registra feedback do usuário sobre uma resposta do agente.

    util=True  → salva o par pergunta+resposta em texts/ do canal como corpus BM25.
                 Entra na base na próxima indexação — RLHF local.
    util=False → descarta silenciosamente (sem side-effects no corpus).
    """
    import time as _time
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal_nome).strip('_')

    if not req.util:
        return {"ok": True, "action": "discarded"}

    texts_dir = os.path.join(
        __import__('tusab_engine.storage', fromlist=['NEURAL_DIR']).NEURAL_DIR,
        canal_prefixo, 'texts'
    )
    os.makedirs(texts_dir, exist_ok=True)

    ts = int(_time.time())
    fname = f"feedback_{ts}.txt"
    conteudo = (
        f"PERGUNTA: {req.pergunta.strip()}\n\n"
        f"RESPOSTA ÚTIL:\n{req.resposta.strip()}\n"
    )
    caminho = os.path.join(texts_dir, fname)
    try:
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(conteudo)
    except Exception as e:
        return {"ok": False, "error": str(e)}

    # Invalida cache BM25 para que o novo arquivo seja lido na próxima query
    agent_tusab._invalidar_cache(canal_prefixo)
    return {"ok": True, "action": "saved", "arquivo": fname}


@router.post("/agent/chat/clear")
def agent_chat_clear(req: AgentChatRequest):
    """Limpa histórico de conversa do lado do servidor e auto-salva em _chat_history/."""
    with state.hist_lock:
        hist = list(state.chat_histories.pop(req.canal_nome, []))
    # Auto-save silencioso fora do lock
    if hist:
        _auto_salvar_historico(req.canal_nome, hist)
    return {"message": "Histórico limpo."}


class ResumeConversationRequest(BaseModel):
    canal_nome: str  = Field(max_length=120)
    historico:  list = []


@router.post("/agent/chat/resume")
def agent_chat_resume(req: ResumeConversationRequest):
    """Restaura o contexto de uma conversa salva no servidor.

    Recebe as últimas N mensagens do localStorage e as carrega em
    state.chat_histories para que o próximo /chat/stream as use como contexto.
    Limita ao máximo de _MAX_HIST_MSGS mensagens (mesmo limite do chat normal).
    """
    # Sanitiza: aceita apenas role user/assistant e content string
    msgs_validas = [
        {"role": m.get("role", ""), "content": str(m.get("content", ""))[:4000]}
        for m in req.historico
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    with state.hist_lock:
        state.chat_histories[req.canal_nome] = msgs_validas[-_MAX_HIST_MSGS:]
    return {"restored": len(msgs_validas), "canal": req.canal_nome}


@router.post("/agent/chat/salvar-historico")
def agent_chat_salvar_historico(req: SalvarHistoricoRequest):
    """Serializa as mensagens do chat em Markdown e salva no repositório de textos do canal."""
    import uuid as _uuid
    import re as _re
    from datetime import datetime as _dt
    from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

    if not req.mensagens:
        return {"error": True, "message": "Nenhuma mensagem para salvar"}

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', req.canal_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Canal não especificado."}
    txt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "texts")
    os.makedirs(txt_dir, exist_ok=True)

    ts = _dt.now().strftime("%Y%m%d_%H%M%S")
    fid = str(_uuid.uuid4())[:8]
    titulo = f"Histórico do chat — {req.canal_nome} — {_dt.now().strftime('%d/%m/%Y %H:%M')}"
    nome_arquivo = f"{fid}_historico_chat_{ts}.txt"
    txt_path = os.path.join(txt_dir, nome_arquivo)

    linhas = [f"TITULO: {titulo}", f"FONTE: historico_chat", f"DATA: {_dt.now().strftime('%d/%m/%Y')}", "-" * 70, ""]
    for msg in req.mensagens:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            linhas.append(f"**Você:** {content}\n")
        elif role == "assistant":
            linhas.append(f"**Tusab:** {content}\n")
        # ignora role=error, role=export, role=streaming

    conteudo = "\n".join(linhas)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(conteudo)

    manifest_path = os.path.join(txt_dir, "_manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            pass
    manifest.append({
        "id": fid,
        "titulo": titulo,
        "nome_txt": nome_arquivo,
        "tipo": "historico_chat",
        "chars": len(conteudo),
        "data": _dt.now().strftime("%d/%m/%Y"),
    })
    salvar_json_atomico(manifest, manifest_path, indent=2)

    return {"ok": True, "id": fid, "titulo": titulo}


@router.get("/agent/chat/historicos/{canal_nome}")
def agent_chat_historicos(canal_nome: str):
    """Lista arquivos de histórico de chat salvos para o canal."""
    import re as _re
    from tusab_engine.storage import NEURAL_DIR

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    if not canal_prefixo:
        return {"historicos": []}
    manifest_path = os.path.join(NEURAL_DIR, canal_prefixo, "texts", "_manifest.json")

    if not os.path.exists(manifest_path):
        return {"historicos": []}
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception:
        return {"historicos": []}

    historicos = [e for e in manifest if e.get("tipo") == "historico_chat"]
    historicos.sort(key=lambda e: e.get("data", ""), reverse=True)
    return {"historicos": historicos}


@router.get("/agent/chat/historicos-salvos/{canal_nome}")
def agent_chat_historicos_salvos(canal_nome: str):
    """Lista históricos auto-salvos em texts/_chat_history/ (fora do corpus BM25)."""
    import re as _re
    from tusab_engine.storage import NEURAL_DIR

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    if not canal_prefixo:
        return {"historicos": []}

    idx_path = os.path.join(NEURAL_DIR, canal_prefixo, "texts", "_chat_history", "_index.json")
    if not os.path.exists(idx_path):
        return {"historicos": []}
    try:
        with open(idx_path, "r", encoding="utf-8") as f:
            idx = json.load(f)
        return {"historicos": idx}
    except Exception:
        return {"historicos": []}


class InjetarHistoricoRequest(BaseModel):
    canal_nome: str = Field(max_length=120)
    hist_id:    str = Field(max_length=20)


@router.post("/agent/chat/injetar-historico")
def agent_chat_injetar_historico(req: InjetarHistoricoRequest):
    """Move um histórico de _chat_history/ para texts/ — torna-o indexável pelo BM25.

    Após a injeção marca o item como indexado=True no _index.json.
    O usuário ainda precisa clicar em 'Indexar base' para reconstruir o índice BM25.
    """
    import re as _re
    import shutil
    from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', req.canal_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Canal não especificado."}

    hist_dir = os.path.join(NEURAL_DIR, canal_prefixo, "texts", "_chat_history")
    idx_path = os.path.join(hist_dir, "_index.json")
    if not os.path.exists(idx_path):
        return {"error": True, "message": "Nenhum histórico salvo encontrado."}

    try:
        with open(idx_path, "r", encoding="utf-8") as f:
            idx = json.load(f)
    except Exception:
        return {"error": True, "message": "Erro ao ler índice de históricos."}

    entrada = next((e for e in idx if e.get("id") == req.hist_id), None)
    if not entrada:
        return {"error": True, "message": "Histórico não encontrado."}

    if entrada.get("indexado"):
        return {"ok": True, "message": "Histórico já está no corpus.", "ja_indexado": True}

    src = os.path.join(hist_dir, entrada["nome_arquivo"])
    if not os.path.exists(src):
        return {"error": True, "message": "Arquivo de histórico não encontrado em disco."}

    # Copia para texts/ sem o prefixo '_hist_' — torna-o visível ao indexador
    txt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "texts")
    nome_destino = entrada["nome_arquivo"].lstrip("_").replace("hist_", "chat_hist_", 1)
    dst = os.path.join(txt_dir, nome_destino)
    shutil.copy2(src, dst)

    # Atualiza manifesto de textos do canal
    manifest_path = os.path.join(txt_dir, "_manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            pass
    manifest.insert(0, {
        "id":       entrada["id"],
        "titulo":   entrada["titulo"],
        "nome_txt": nome_destino,
        "tipo":     "historico_chat",
        "chars":    entrada.get("chars", 0),
        "data":     entrada.get("data", ""),
    })
    salvar_json_atomico(manifest, manifest_path, indent=2)

    # Marca como indexado no _index.json
    for e in idx:
        if e.get("id") == req.hist_id:
            e["indexado"] = True
            e["nome_destino"] = nome_destino
    salvar_json_atomico(idx, idx_path, indent=2)

    return {"ok": True, "message": "Histórico adicionado ao corpus. Indexe a base para ativá-lo."}


@router.post("/agent/buscar-trechos")
def agent_buscar_trechos(req: BuscarTrechosRequest):
    """Pipeline completo de recuperação (BM25 + query expansion + CrossEncoder) sem LLM.

    Retorna chunks ranqueados de uma ou mais bases para o usuário selecionar e injetar no chat.
    """
    from tusab_engine.agent.chat import buscar_trechos
    if not req.query.strip():
        return {"trechos": [], "total": 0}
    try:
        trechos = buscar_trechos(
            query=req.query.strip(),
            canais=req.canais,
            n=req.n,
            busca_ampla=req.busca_ampla,
        )
        return {"trechos": trechos, "total": len(trechos)}
    except Exception as e:
        return {"trechos": [], "total": 0, "erro": str(e)}


@router.post("/agent/chat")
def agent_chat(req: AgentChatRequest):
    if state.agent_indexing:
        return {"error": True, "message": "Indexação em andamento. Aguarde."}
    mensagem = req.mensagem[:2000].strip()
    try:
        # hist_lock DENTRO do agent_chat_lock — leitura+LLM+escrita como operação atômica
        with state.agent_chat_lock:
            with state.hist_lock:
                hist = list(state.chat_histories.get(req.canal_nome, []))
            resultado = agent_tusab.chat(mensagem, req.canal_nome, hist, req.canais_extras, req.busca_ampla, getattr(req, 'fontes_fixadas', []), getattr(req, 'perfil', ''))
            if not resultado.get("error"):
                novo_hist = hist + [
                    {"role": "user",      "content": mensagem},
                    {"role": "assistant", "content": resultado.get("resposta", "")},
                ]
                with state.hist_lock:
                    state.chat_histories[req.canal_nome] = novo_hist[-_MAX_HIST_MSGS:]
        if not resultado.get("error"):
            try:
                n_refs = len(resultado.get("fontes", []))
                _atualizar_chat_stats(req.canal_nome, n_refs)
            except Exception:
                pass
        return resultado
    except Exception as e:
        return {"error": True, "message": str(e)}


@router.post("/agent/chat/stream")
def agent_chat_stream(req: AgentChatStreamRequest):
    if state.agent_indexing:
        def _err():
            yield json.dumps({'error': 'Indexação em andamento. Aguarde.'})
        return StreamingResponse(_err(), media_type='text/plain')

    mensagem = req.mensagem[:2000].strip()

    # Serializa streaming: captura hist antes, escreve de volta depois de concluir.
    # agent_chat_lock garante que dois streams do mesmo canal não entrelacem histórico.
    with state.agent_chat_lock:
        with state.hist_lock:
            hist = list(state.chat_histories.get(req.canal_nome, []))

    resposta_acumulada = []
    refs_acumuladas = []

    def _gen():
        try:
            for chunk in agent_tusab.chat_stream(mensagem, req.canal_nome, hist, req.canais_extras, req.busca_ampla, getattr(req, 'fontes_fixadas', []), getattr(req, 'perfil', '')):
                try:
                    data = json.loads(chunk)
                    if data.get("texto"):
                        resposta_acumulada.append(data["texto"])
                    if data.get("fontes"):
                        refs_acumuladas.extend(data["fontes"])
                except Exception:
                    # chunk é texto puro (não JSON) — acumula para histórico e last_chat_response
                    if chunk.strip():
                        resposta_acumulada.append(chunk)
                yield chunk + '\n'
        except Exception as e:
            yield json.dumps({'error': str(e)}) + '\n'
        finally:
            if resposta_acumulada:
                resposta_completa = "".join(resposta_acumulada)
                novo_hist = hist + [
                    {"role": "user",      "content": mensagem},
                    {"role": "assistant", "content": resposta_completa},
                ]
                with state.hist_lock:
                    state.chat_histories[req.canal_nome] = novo_hist[-_MAX_HIST_MSGS:]
                # Persiste resposta completa para o classificador de intenção
                try:
                    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal_nome).strip('_')
                    state.last_chat_response[canal_prefixo] = {
                        'pergunta': mensagem,
                        'resposta': resposta_completa,
                        'fontes':   refs_acumuladas,
                    }
                except Exception:
                    pass
                try:
                    _atualizar_chat_stats(req.canal_nome, len(refs_acumuladas))
                except Exception:
                    pass

    return StreamingResponse(_gen(), media_type='text/plain')


# ── Sumarização ──────────────────────────────────────────────────────────────

def _run_summarize(canal_prefixo: str):
    """Dispara resumir_canal() em background e atualiza state.summarize_*."""
    from tusab_engine.agent.summarize import resumir_canal

    try:
        state.summarizing = True
        state.summarize_logs = []
        state.summarize_stop.clear()
        state.summarize_progress[canal_prefixo] = {'n': 0, 'total': 0}

        def _cb(n, total):
            state.summarize_progress[canal_prefixo] = {'n': n, 'total': total}
            state.summarize_logs.append({
                'timestamp': time.strftime('%H:%M:%S'),
                'message': f'Resumindo vídeos: {n}/{total}',
            })
            if len(state.summarize_logs) > 100:
                state.summarize_logs = state.summarize_logs[-100:]

        resumir_canal(
            canal_prefixo=canal_prefixo,
            callback=_cb,
            stop_event=state.summarize_stop,
        )
        state.summarize_logs.append({
            'timestamp': time.strftime('%H:%M:%S'),
            'message': f'✅ Sumarização de {canal_prefixo} concluída.',
        })
        if len(state.summarize_logs) > 100:
            state.summarize_logs = state.summarize_logs[-100:]
    except Exception as e:
        state.summarize_logs.append({
            'timestamp': time.strftime('%H:%M:%S'),
            'message': f'❌ Erro na sumarização: {e}',
        })
        if len(state.summarize_logs) > 100:
            state.summarize_logs = state.summarize_logs[-100:]
    finally:
        state.summarizing = False


@router.get('/agent/summarize/pending')
def agent_summarize_pending():
    """Conta vídeos sem _resumo.json por canal.

    Retorna {'total': int, 'canais': [{'prefixo': str, 'pendentes': int}]}.
    O frontend usa esta rota após salvar config LLM para decidir se oferece
    sumarização em modal.
    """
    from tusab_engine.agent.summarize import pending_por_canal
    try:
        return pending_por_canal()
    except Exception as e:
        return {'total': 0, 'canais': [], 'error': str(e)}


@router.post('/agent/summarize/{canal_prefixo}')
def agent_summarize_start(canal_prefixo: str, background_tasks: BackgroundTasks):
    """Dispara sumarização assíncrona de vídeos de um canal em background.

    Progresso disponível em GET /agent/status (campos summarizing + summarize_logs
    + summarize_progress). Cancelamento via POST /agent/summarize/cancel.
    """
    if state.summarizing:
        return {'error': True, 'message': 'Sumarização já em andamento. Aguarde ou cancele.'}
    # Sanitiza o prefixo recebido (defesa em profundidade — path param)
    prefixo_safe = re.sub(r'[<>:"/\\|?*\s]', '_', canal_prefixo).strip('_')
    if not prefixo_safe:
        return {'error': True, 'message': 'Prefixo de canal inválido.'}
    # Valida LLM configurado
    _cfg = agent_tusab.carregar_config()
    if _cfg.get('provider') and _cfg['provider'] != 'ollama' and not _cfg.get('api_key'):
        return {'error': True, 'message': 'Configure um modelo de IA antes de aprofundar a base.'}
    # Valida que há vídeos pendentes
    from tusab_engine.agent.summarize import pending_por_canal
    _pendentes = pending_por_canal()
    _canal_info = next((c for c in _pendentes.get('canais', []) if c.get('prefixo') == prefixo_safe), None)
    if not _canal_info or _canal_info.get('pendentes', 0) == 0:
        return {'error': True, 'message': 'Nenhum vídeo pendente de análise neste projeto.'}
    background_tasks.add_task(_run_summarize, prefixo_safe)
    return {'message': f'Sumarização iniciada para {prefixo_safe}.'}


@router.post('/agent/summarize/cancel')
def agent_summarize_cancel():
    """Cancela a sumarização em andamento cooperativamente."""
    state.summarize_stop.set()
    return {'message': 'Sumarização cancelada.'}


@router.delete("/agent/canal/{canal_nome}")
def agent_canal_delete(canal_nome: str):
    import re as _re
    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    agent_tusab._invalidar_cache(canal_prefixo)
    # Remove índice BM25 se existir
    idx_path = agent_tusab._index_path(canal_prefixo)
    if os.path.exists(idx_path):
        try:
            os.remove(idx_path)
        except Exception:
            pass
    # Remove banco FTS5 se existir
    from tusab_engine.agent.fts import _fts_path, _sanitizar_prefixo
    fts_path = _fts_path(canal_prefixo)
    if os.path.exists(fts_path):
        try:
            os.remove(fts_path)
        except Exception:
            pass
    # Limpa config se este era o canal ativo
    config = agent_tusab.carregar_config()
    if config.get('canal_indexado') == canal_nome:
        config['canal_indexado'] = ''
        agent_tusab.salvar_config(config)
    return {"ok": True}

