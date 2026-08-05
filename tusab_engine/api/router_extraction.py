# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de extração: configurar canal, iniciar/pausar/cancelar motor.
"""

import os
import re
import time
import threading

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

import motor_tusab
from tusab_engine.state import state
from tusab_engine.api.router_agent import disparar_reindexacao_incremental

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
                dispatch_event=state.dispatch_event,
                playlists_filtro=state.playlists_filtro or None,
                data_inicio=state.data_inicio,
                data_fim=state.data_fim,
            )

            cancelado = state.evento_cancelar.is_set()
            if cancelado:
                state.stats["status"] = "Interrompido"
                # Cancela só o canal atual — continua para o próximo da fila
            else:
                state.stats["status"]   = "Finalizado ✓"
                state.stats["progress"] = 100

        except Exception as e:
            print(f"❌ ERRO NO MOTOR: {e}")
            state.stats["status"] = "Erro"
            # Erro num canal não cancela a fila; continua para o próximo
        finally:
            state.is_running = False
            state.is_paused  = False
            # Reindexação incremental em background — em thread própria pra não
            # atrasar o consumo da fila (run_motor já é a thread de background
            # da extração; indexar aqui de forma síncrona travaria o próximo
            # canal até terminar). Mesmo em extração cancelada no meio, o que
            # já foi salvo vale a pena indexar. Cache por arquivo (agent/index.py)
            # garante que isso não vira um rebuild caro do corpus inteiro a
            # cada canal da fila.
            if state.stats.get("files_generated", 0) > 0 and state.projeto_nome:
                _nome_display = state.stats.get("projeto_nome", "")
                _prefixo_atual = state.projeto_nome
                threading.Thread(
                    target=disparar_reindexacao_incremental,
                    args=(_nome_display, _prefixo_atual),
                    daemon=True,
                ).start()

        # Verifica fila antes de decidir se terminou
        with state.queue_lock:
            proximo = state.extraction_queue.pop(0) if state.extraction_queue else None
            state.salvar_fila()

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
        state.canal_url             = url
        raw_proj = proximo.get("projeto_nome", "")
        if raw_proj:
            # Mesmo fix de /set-channel: nome real já conhecido (item da fila
            # veio com projeto_nome) tem prioridade sobre a derivação por
            # regex, que cai no ID cru pra URLs /channel/UCxxxx.
            state.stats["projeto_nome"] = raw_proj.strip()
            state.projeto_nome = re.sub(r'[<>:"/\\|?*\s]', '_', raw_proj).strip('_')
        else:
            match = re.search(r'@([^/?\s]+)', url)
            state.stats["projeto_nome"] = match.group(1) if match else url.rstrip('/').split('/')[-1]
            state.projeto_nome = ""
        state.stats["status"]       = "Na fila"
        state.fontes_filtro         = proximo.get("fontes", [])
        state.playlists_filtro      = proximo.get("playlists", [])
        state.data_inicio           = proximo.get("data_inicio", "")
        state.data_fim              = proximo.get("data_fim", "")
        state.evento_cancelar.clear()
        state.evento_pausa.set()
        state.is_paused             = False


# ── Models ────────────────────────────────────────────────────────────────────

class ChannelRequest(BaseModel):
    canal_url:    str = Field(max_length=300)
    projeto_nome: str = Field(default="", max_length=120)

class StartRequest(BaseModel):
    fontes:       list = []
    playlists:    list = []              # ids de playlist específicas — vazio = todas
    data_inicio:  str  = Field(default="", max_length=10)  # YYYY-MM-DD
    data_fim:     str  = Field(default="", max_length=10)

class QueueAddRequest(BaseModel):
    canal_url:    str = Field(max_length=300)
    fontes:       list = []
    projeto_nome: str = Field(default="", max_length=120)
    playlists:    list = []
    data_inicio:  str  = Field(default="", max_length=10)
    data_fim:     str  = Field(default="", max_length=10)


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
    if req.projeto_nome:
        # Nome real já conhecido pelo frontend (ex: escolhido via busca por
        # nome ou vindo do histórico) — usa direto em vez de derivar da URL.
        # Necessário pra canais sem @handle público (/channel/UCxxxx): sem
        # isso, o fallback abaixo usaria o ID cru como "nome" do canal em
        # todo lugar que lê state.stats["projeto_nome"] (status, logs,
        # resposta deste endpoint).
        state.stats["projeto_nome"] = req.projeto_nome.strip()
        state.projeto_nome = re.sub(r'[<>:"/\\|?*\s]', '_', req.projeto_nome).strip('_')
    else:
        match = re.search(r'@([^/?\s]+)', url)
        state.stats["projeto_nome"] = match.group(1) if match else url.rstrip('/').split('/')[-1]
        state.projeto_nome = ""
    # Campo de resposta "canal_nome" mantido (não "projeto_nome") porque este
    # endpoint é especificamente sobre configurar um canal do YouTube — a URL
    # já foi validada por _YT_URL_RE acima. Valor vem de state.stats["projeto_nome"]
    # (contrato genérico), mas o nome do campo aqui é legitimamente sobre canal.
    return {"message": "Canal configurado", "canal_nome": state.stats["projeto_nome"]}


@router.post("/start")
def start_engine(background_tasks: BackgroundTasks, req: StartRequest = None):
    if not state.canal_url:
        return {"message": "Configure a URL do canal antes de iniciar", "error": True}
    if not state.is_running:
        state.stats["status"]   = "Iniciando"
        state.fontes_filtro     = (req.fontes if req else [])
        state.playlists_filtro  = (req.playlists if req else [])
        state.data_inicio       = (req.data_inicio if req else "")
        state.data_fim          = (req.data_fim if req else "")
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
        state.extraction_queue.append({
            "url": url, "fontes": req.fontes, "projeto_nome": req.projeto_nome,
            "playlists": req.playlists, "data_inicio": req.data_inicio, "data_fim": req.data_fim,
        })
        tamanho = len(state.extraction_queue)
        state.salvar_fila()
    return {"ok": True, "queue_size": tamanho}


@router.delete("/queue/clear")
def queue_clear():
    """Remove todos os itens pendentes da fila (não afeta a extração em curso)."""
    with state.queue_lock:
        state.extraction_queue.clear()
        state.salvar_fila()
    return {"ok": True}


@router.delete("/queue/item/{index}")
def queue_remove_item(index: int):
    """Remove um item específico da fila pelo índice (0-based)."""
    with state.queue_lock:
        if index < 0 or index >= len(state.extraction_queue):
            return {"error": True, "message": "Índice fora do intervalo"}
        state.extraction_queue.pop(index)
        state.salvar_fila()
    return {"ok": True}


@router.get("/canal-info")
def canal_info(url: str):
    """Mapa de cobertura pré-extração: títulos e tópicos do canal sem baixar transcrições.

    Usa yt-dlp --flat-playlist para obter apenas metadados (título, views).
    Retorna contagem de vídeos e os tópicos mais frequentes extraídos dos títulos.
    Rápido: sem download de legendas ou transcrições.
    """
    import sys as _sys

    url = url.strip()
    if not url or not _YT_URL_RE.match(url):
        return {"error": True, "message": "URL inválida"}

    try:
        import subprocess as _sp
        import json as _json

        resultado = _sp.run(
            [_sys.executable, '-m', 'yt_dlp',
             '--flat-playlist', '--ignore-errors', '--no-warnings',
             '--print', '%(title)s|||%(view_count)s',
             '--playlist-end', '500',
             url],
            stdout=_sp.PIPE, stderr=_sp.DEVNULL,
            text=False, check=False,
            creationflags=getattr(_sp, 'CREATE_NO_WINDOW', 0),
            timeout=60,
            # PYTHONUTF8: no Windows, a saída do processo filho (yt-dlp via
            # sys.executable -m yt_dlp) cai no codepage padrão do console em
            # vez de UTF-8 — títulos com acento viravam "�" mesmo com
            # errors='replace' no decode abaixo. Mesmo fix de buscar_canais_youtube().
            env={**os.environ, 'PYTHONUTF8': '1'},
        )
        linhas = resultado.stdout.decode('utf-8', errors='replace').strip().splitlines()
    except Exception as e:
        return {"error": True, "message": f"Erro ao consultar canal: {e}"}

    titulos = []
    views_total = 0
    for linha in linhas:
        partes = linha.split('|||')
        titulo = partes[0].strip()
        if titulo and titulo not in ('[Private video]', '[Deleted video]'):
            titulos.append(titulo)
            try:
                views_total += int(partes[1].strip()) if len(partes) > 1 else 0
            except (ValueError, IndexError):
                pass

    if not titulos:
        return {"error": True, "message": "Nenhum vídeo encontrado. Verifique a URL do canal."}

    # Extrai tópicos por frequência de termos nos títulos (sem stopwords)
    _STOP = {
        'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
        'se','na','por','mais','as','dos','como','mas','ao','ele','das','seu',
        'sua','ou','ser','quando','muito','nos','já','também','só','pelo','pela',
        'até','isso','ela','entre','era','depois','sem','mesmo','aos','ter','seus',
        'quem','nas','me','esse','eles','vocé','você','essa','nem','suas','meu',
        'the','a','an','and','or','but','in','on','at','to','for','of','with',
        'by','from','is','are','was','were','be','have','has','do','does','did',
        'will','would','could','should','this','that','not','what','how','all',
        'ep','ft','part','parte','vol','vs','feat',
    }
    freq: dict = {}
    for t in titulos:
        for palavra in re.findall(r'[a-záéíóúàâêôãõç]{4,}', t.lower()):
            if palavra not in _STOP:
                freq[palavra] = freq.get(palavra, 0) + 1

    topicos = [
        {'termo': termo, 'frequencia': count}
        for termo, count in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:20]
        if count >= 2
    ]

    return {
        "ok": True,
        "total_videos": len(titulos),
        "views_total": views_total,
        "topicos": topicos,
        "amostra_titulos": titulos[:10],
    }


@router.get("/playlists-canal")
def playlists_canal(url: str):
    """Lista as playlists de um canal (id + título), sem expandir os vídeos de cada uma.

    Mesma primeira chamada usada dentro de tusab_engine() pra descobrir
    playlists (yt-dlp --flat-playlist --get-id --get-title .../playlists) —
    rápida porque não baixa a lista de vídeos de cada playlist, só o índice
    da aba Playlists do canal. Alimenta a seleção de playlists específicas
    no modal de extração (em vez de sempre extrair todas).
    """
    import sys as _sys
    import subprocess as _sp

    url = url.strip()
    if not url or not _YT_URL_RE.match(url):
        return {"error": True, "message": "URL inválida"}

    base = url.rstrip('/')
    try:
        resultado = _sp.run(
            [_sys.executable, '-m', 'yt_dlp',
             '--flat-playlist', '--ignore-errors', '--no-warnings',
             '--get-id', '--get-title',
             f"{base}/playlists"],
            stdout=_sp.PIPE, stderr=_sp.DEVNULL,
            text=False, check=False,
            creationflags=getattr(_sp, 'CREATE_NO_WINDOW', 0),
            timeout=30,
            # PYTHONUTF8: mesmo fix de canal_info()/buscar_canais_youtube() —
            # sem isso, títulos de playlist com acento saem como "�" no Windows.
            env={**os.environ, 'PYTHONUTF8': '1'},
        )
        linhas = [l for l in resultado.stdout.decode('utf-8', errors='replace').strip().splitlines() if l.strip()]
    except Exception as e:
        return {"error": True, "message": f"Erro ao consultar playlists: {e}"}

    playlists = []
    # yt-dlp --get-id --get-title imprime título e id alternados, título primeiro
    for i in range(0, len(linhas), 2):
        if i + 1 < len(linhas):
            titulo, playlist_id = linhas[i].strip(), linhas[i + 1].strip()
            if re.match(r'^[A-Za-z0-9_\-]{10,50}$', playlist_id) and titulo:
                playlists.append({"id": playlist_id, "titulo": titulo})

    return {"ok": True, "playlists": playlists}


@router.get("/canal-search")
def canal_search(q: str):
    """Busca canais do YouTube por nome/termo — sem API key, via yt-dlp local.

    Complementa o fluxo de colar URL: usuário digita um nome e escolhe entre
    os candidatos retornados em vez de precisar copiar a URL do canal.
    """
    from tusab_engine.motor.extraction import buscar_canais_youtube

    q = (q or '').strip()
    if not q:
        return {"canais": []}
    if len(q) > 200:
        return {"error": True, "message": "Termo de busca muito longo"}

    canais = buscar_canais_youtube(q, max_resultados=10)
    return {"canais": canais}


class QueueMoveRequest(BaseModel):
    from_index: int
    to_index: int


@router.post("/queue/move")
def queue_move_item(req: QueueMoveRequest):
    """Move um item da fila de from_index para to_index."""
    with state.queue_lock:
        n = len(state.extraction_queue)
        if req.from_index < 0 or req.from_index >= n or req.to_index < 0 or req.to_index >= n:
            return {"error": True, "message": "Índice fora do intervalo"}
        item = state.extraction_queue.pop(req.from_index)
        state.extraction_queue.insert(req.to_index, item)
        state.salvar_fila()
    return {"ok": True}


@router.get("/queue")
def queue_status():
    """Retorna os itens atualmente na fila."""
    with state.queue_lock:
        itens = list(state.extraction_queue)
    return {"queue": itens}


class AutoUpdateConfigRequest(BaseModel):
    canal_prefixo: str    # CANAL (ex: CanaldoCortella)
    projeto_prefixo: str  # PROJETO — pasta pai (ex: Filosofia)
    enabled: bool
    frequencia: str = "semanal"   # 'ao_abrir' | 'diario' | 'semanal' | 'mensal'
    fontes: list = []
    canal_url: str = ""


@router.post("/auto-update/config")
def auto_update_config(req: AutoUpdateConfigRequest):
    """Salva configuração de auto-update no summary.json do canal dentro do projeto."""
    import json as _json
    from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

    canal_prefixo   = req.canal_prefixo.strip()
    projeto_prefixo = req.projeto_prefixo.strip()

    # Caminho: neural/{projeto}/management/{canal}_summary.json
    summary_path = os.path.join(
        NEURAL_DIR, projeto_prefixo, "management", f"{canal_prefixo}_summary.json"
    )

    summary = {}
    if os.path.exists(summary_path):
        try:
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary = _json.load(f)
        except Exception:
            pass

    # Guarda a URL do canal se fornecida
    if req.canal_url:
        summary['canal_url'] = req.canal_url

    summary['auto_update'] = {
        'enabled':    req.enabled,
        'frequencia': req.frequencia,
        'fontes':     req.fontes,
    }

    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    salvar_json_atomico(summary, summary_path, indent=2)
    return {"ok": True}


@router.get("/auto-update/config/{canal_prefixo}")
def auto_update_get_config(canal_prefixo: str, projeto_prefixo: str = ""):
    """Retorna configuração de auto-update do canal.

    Se projeto_prefixo fornecido, lê neural/{projeto_prefixo}/management/{canal_prefixo}_summary.json.
    Caso contrário (comportamento legado), varre todos os projetos em NEURAL_DIR buscando
    o primeiro summary que contenha auto_update para este canal.
    """
    import json as _json
    from tusab_engine.storage import NEURAL_DIR

    def _ler_auto_update(path: str) -> dict | None:
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r', encoding='utf-8') as f:
                summary = _json.load(f)
            cfg = summary.get("auto_update")
            return cfg if cfg is not None else None
        except Exception:
            return None

    if projeto_prefixo:
        # Caminho direto: neural/{projeto}/management/{canal}_summary.json
        summary_path = os.path.join(
            NEURAL_DIR, projeto_prefixo, "management", f"{canal_prefixo}_summary.json"
        )
        cfg = _ler_auto_update(summary_path)
        return {"auto_update": cfg if cfg is not None else {"enabled": False}}

    # Comportamento legado: busca em qualquer projeto dentro de NEURAL_DIR
    try:
        for projeto in os.listdir(NEURAL_DIR):
            candidate = os.path.join(
                NEURAL_DIR, projeto, "management", f"{canal_prefixo}_summary.json"
            )
            cfg = _ler_auto_update(candidate)
            if cfg is not None:
                return {"auto_update": cfg}
    except Exception:
        pass

    return {"auto_update": {"enabled": False}}


@router.post("/auto-update/run")
def auto_update_run(background_tasks: BackgroundTasks):
    """Dispara verificação imediata de novos vídeos em todos os canais com auto-update ativo."""
    if state.is_running:
        return {"error": True, "message": "Extração em andamento. Aguarde para verificar atualizações."}

    def _run():
        try:
            from tusab_engine.motor.auto_update import verificar_e_enfileirar
            novos = verificar_e_enfileirar(state)
            if novos:
                print(f"🔄 Auto-update manual: {len(novos)} canal(is) com novos vídeos enfileirado(s)")
            else:
                print("✅ Auto-update manual: todos os canais estão atualizados")
        except Exception as e:
            print(f"⚠️  Auto-update manual: erro — {e}")

    background_tasks.add_task(_run)
    return {"ok": True, "message": "Verificação iniciada em background"}
