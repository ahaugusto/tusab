# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Verificação automática de novos vídeos nos canais extraídos.

Lógica:
  - Acionado no startup do app (chamado por api_tusab.py)
  - Respeita a configuração salva em agent_config.json (auto_update)
  - Para cada canal com auto_update ativo, compara a lista remota de vídeos
    com o CSV local (_base.csv) e enfileira extração dos novos
  - A verificação só acontece quando o app está ocioso (não extraindo)
  - Usa yt-dlp --flat-playlist para buscar apenas metadados (sem baixar nada)
"""

import os
import re
import time
import json
import glob
import threading

from tusab_engine.agent.config import carregar_config, salvar_config
from tusab_engine.storage import NEURAL_DIR


# ── Frequência → intervalo em segundos ────────────────────────────────────────

_FREQ_SEGUNDOS = {
    'ao_abrir': 0,       # sempre que abre
    'diario':   86400,
    'semanal':  604800,
    'mensal':   2592000,
}

_CHECK_KEY = 'auto_update_ultima_verificacao'  # timestamp float em agent_config.json


def _segundos_para_proxima_verificacao(config_au: dict) -> float:
    """Retorna quantos segundos faltam para a próxima verificação (0 = já está na hora)."""
    freq      = config_au.get('frequencia', 'semanal')
    intervalo = _FREQ_SEGUNDOS.get(freq, _FREQ_SEGUNDOS['semanal'])
    if intervalo == 0:
        return 0
    cfg       = carregar_config()
    ultima    = cfg.get(_CHECK_KEY, 0)
    agora     = time.time()
    falta     = intervalo - (agora - ultima)
    return max(0.0, falta)


def _listar_videos_remotos(canal_url: str) -> list[str]:
    """
    Usa yt-dlp --flat-playlist para obter IDs dos vídeos do canal.
    Retorna lista de video IDs (strings). Vazio se falhar.
    Apenas metadados — zero download de áudio/vídeo/legenda.
    """
    import subprocess
    import sys

    cmd = [
        sys.executable, '-m', 'yt_dlp',
        '--flat-playlist',
        '--print', 'id',
        '--no-warnings',
        '--quiet',
        '--extractor-args', 'youtube:skip=dash',
        canal_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        return ids
    except Exception:
        return []


def _ids_ja_extraidos(projeto: str, canal: str) -> set[str]:
    """
    Lê neural/{projeto}/management/{canal}_base.csv e retorna o conjunto
    de video IDs já extraídos. Extrai o ID dos links da coluna 'Link'.
    """
    import pandas as pd

    csv_path = os.path.join(NEURAL_DIR, projeto, "management", f"{canal}_base.csv")
    if not os.path.exists(csv_path):
        return set()
    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig")
        if "Link" not in df.columns:
            return set()
        ids = set()
        for link in df["Link"].dropna():
            m = re.search(r"[?&]v=([A-Za-z0-9_-]{11})", str(link))
            if m:
                ids.add(m.group(1))
        return ids
    except Exception:
        return set()


def _canais_com_auto_update() -> list[dict]:
    """
    Varre TODOS os projetos em NEURAL_DIR e, dentro de cada projeto,
    varre TODOS os {canal}_summary.json em management/.
    Auto-update agora é configurado por canal, não por projeto.
    Retorna lista de dicts: { projeto, canal, canal_urls, fontes, frequencia }
    """
    resultado = []
    if not os.path.isdir(NEURAL_DIR):
        return resultado

    for entry in os.scandir(NEURAL_DIR):
        if not entry.is_dir():
            continue
        mgmt_dir = os.path.join(entry.path, 'management')
        for f in glob.glob(os.path.join(mgmt_dir, '*_summary.json')):
            canal_nome = os.path.basename(f).replace('_summary.json', '')
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    summary = json.load(fh)
            except Exception:
                continue

            au = summary.get('auto_update', {})
            if not au.get('enabled'):
                continue

            canal_urls = summary.get('canal_urls') or [summary.get('canal_url', '')]

            resultado.append({
                'projeto':    entry.name,
                'canal':      canal_nome,
                'canal_urls': [u for u in canal_urls if u],
                'fontes':     au.get('fontes', []),
                'frequencia': au.get('frequencia', 'semanal'),
            })

    return resultado


def _gravar_ultimo_check():
    """Atualiza timestamp da última verificação global em agent_config.json."""
    cfg = carregar_config()
    cfg[_CHECK_KEY] = time.time()
    salvar_config(cfg)


def verificar_e_enfileirar(state) -> list[str]:
    """
    Entry point principal — chamado no startup ou sob demanda.

    Para cada canal com auto_update ativo:
      1. Compara IDs remotos vs locais
      2. Se há novos: enfileira extração (state.extraction_queue)
      3. Loga no state.logs

    Retorna lista de prefixos que tinham novos vídeos.
    """
    from tusab_engine.state import state as _state
    if state is None:
        state = _state

    canais = _canais_com_auto_update()
    if not canais:
        return []

    com_novos = []

    for item in canais:
        projeto_nome = item['projeto']
        canal_nome   = item['canal']
        canal_urls   = item['canal_urls']
        fontes       = item['fontes']

        # IDs já extraídos para este canal específico dentro do projeto
        locais = _ids_ja_extraidos(projeto_nome, canal_nome)
        canal_tem_novos = False

        for canal_url in canal_urls:
            print(f"🔄 Auto-update: verificando {canal_url} → projeto '{projeto_nome}' / canal '{canal_nome}'…")

            remotos = _listar_videos_remotos(canal_url)
            if not remotos:
                print(f"⚠️  Auto-update: não foi possível acessar {canal_url} (sem conexão ou canal inválido)")
                continue

            novos = [vid for vid in remotos if vid not in locais]

            if not novos:
                print(f"✅ Auto-update: {canal_url} já está atualizado ({len(remotos)} vídeos)")
                continue

            print(f"🆕 Auto-update: {canal_url} tem {len(novos)} vídeo(s) novo(s) — enfileirando extração")
            canal_tem_novos = True

            with state.queue_lock:
                state.extraction_queue.append({
                    "url":          canal_url,
                    "fontes":       fontes,
                    "projeto_nome": projeto_nome,
                    "_auto_update": True,
                })

        if canal_tem_novos:
            com_novos.append(f"{projeto_nome}/{canal_nome}")

    _gravar_ultimo_check()
    return com_novos


def _deve_verificar_agora(config_au: dict | None) -> bool:
    """Verifica se é hora de rodar o check baseado na frequência configurada."""
    if not config_au or not config_au.get('enabled'):
        return False
    return _segundos_para_proxima_verificacao(config_au) == 0


def startup_check(state=None):
    """
    Chamado no startup do app em background thread.
    Verifica a config global de auto_update e dispara verificação se for a hora.
    """
    # Pequeno delay para o app estar totalmente inicializado
    time.sleep(3)

    try:
        cfg    = carregar_config()
        cfg_au = cfg.get('auto_update', {})

        if not _deve_verificar_agora(cfg_au):
            freq = cfg_au.get('frequencia', 'semanal') if cfg_au else '(não configurado)'
            print(f"ℹ️  Auto-update: próxima verificação ainda não é a hora (frequência: {freq})")
            return

        from tusab_engine.state import state as _state
        novos = verificar_e_enfileirar(state or _state)

        if novos:
            print(f"🔄 Auto-update: {len(novos)} canal(is) com novos vídeos enfileirado(s): {', '.join(novos)}")
        else:
            print("✅ Auto-update: todos os canais estão atualizados")

    except Exception as e:
        print(f"⚠️  Auto-update: erro durante verificação — {e}")


def agendar_startup_check(state=None):
    """Inicia a verificação em background thread para não bloquear o startup."""
    t = threading.Thread(target=startup_check, args=(state,), daemon=True, name="auto-update-check")
    t.start()
