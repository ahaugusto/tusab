# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Sumarização assíncrona de vídeos via LLM configurado.

Responsabilidades:
  - resumir_video()   : gera resumo estruturado de um único vídeo via LLM
  - resumir_canal()   : percorre todos os .txt do canal e gera _resumo.json
                        para os vídeos que ainda não têm resumo
  - pending_por_canal(): conta quantos vídeos ainda não têm _resumo.json

Regras de dependência (acíclica):
  agent/summarize.py → agent/config.py → storage.py   ✓
  Não importa nada de api/                             ✓

Degradação graciosa:
  - Se o LLM não estiver configurado, resumir_video() retorna None.
  - Erros de rede ou timeout (30s) são capturados silenciosamente.
  - A extração e o chat nunca são bloqueados por falhas aqui.
"""

import os
import re
import json
import glob
import threading

from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico
from tusab_engine.agent.config import carregar_config, SENTINEL_KEY

# ── Constantes ─────────────────────────────────────────────────────────────────

_SUMMARIZE_TIMEOUT = 30  # segundos — nunca pode travar indefinidamente

_PROMPT_RESUMO = """\
Leia a transcrição abaixo do vídeo intitulado "{titulo}" e gere um resumo estruturado em JSON.
Responda APENAS com JSON válido, sem markdown, sem explicação, sem prefixo.

Formato esperado (todos os campos em português):
{{
  "tema": "tema central em uma frase curta",
  "subtemas": ["subtema 1", "subtema 2", "subtema 3"],
  "entidades": ["pessoa, empresa ou conceito relevante mencionado"],
  "conclusao": "principal aprendizado ou conclusão do vídeo em uma frase"
}}

Transcrição (até 4000 caracteres):
{texto}
"""

# ── Helpers de path ───────────────────────────────────────────────────────────

def _resumo_path(canal_prefixo: str, video_id: str) -> str:
    """Caminho do arquivo _resumo.json para um vídeo."""
    return os.path.join(NEURAL_DIR, canal_prefixo, 'youtube', f'{video_id}_resumo.json')


def _resumos_path_legado(canal_prefixo: str) -> str:
    """Pasta de resumos na estrutura legada (youtube plano)."""
    return os.path.join(NEURAL_DIR, 'youtube')


def _extrair_video_id_de_txt(txt_path: str) -> str:
    """Lê um .txt de vídeo e extrai o VIDEO_ID. Retorna '' se não encontrado."""
    try:
        with open(txt_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
            conteudo = f.read(8000)
        m = re.search(r'VIDEO_ID:\s*([A-Za-z0-9_\-]{11})', conteudo)
        return m.group(1).strip() if m else ''
    except Exception:
        return ''


def _extrair_texto_e_titulo_de_bloco(bloco: str) -> tuple:
    """Extrai (titulo, texto_limpo) de um bloco de vídeo no .txt."""
    titulo_m = re.search(r'TITULO:\s*(.+)', bloco)
    titulo = titulo_m.group(1).strip() if titulo_m else ''
    partes = re.split(r'-{50,}', bloco)
    texto = partes[-1].strip() if len(partes) > 1 else bloco
    return titulo, texto


# ── Chamadas LLM ──────────────────────────────────────────────────────────────

def _api_key_valida(config: dict) -> bool:
    key = config.get('api_key', '')
    return bool(key) and key != SENTINEL_KEY


def resumir_video(texto_completo: str, titulo: str, config: dict) -> dict | None:
    """Gera resumo estruturado de um vídeo via LLM.

    Args:
        texto_completo: texto da transcrição (pode ser longo; truncado internamente).
        titulo: título do vídeo.
        config: dict retornado por carregar_config().

    Returns:
        dict com {tema, subtemas, entidades, conclusao} ou None se falhar/LLM ausente.
    """
    provider = config.get('provider', '')
    if not provider:
        return None
    if provider != 'ollama' and not _api_key_valida(config):
        return None

    api_key = config.get('api_key', '')
    prompt = _PROMPT_RESUMO.format(
        titulo=titulo[:200],
        texto=texto_completo[:4000],
    )

    resposta_raw = None
    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            r = _req.post(
                'http://localhost:11434/api/generate',
                json={'model': modelo, 'prompt': prompt, 'stream': False,
                      'options': {'temperature': 0.1, 'num_predict': 300}},
                timeout=_SUMMARIZE_TIMEOUT,
            )
            r.raise_for_status()
            resposta_raw = r.json().get('response', '').strip()

        elif provider == 'openai':
            from openai import OpenAI
            resp = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=300,
                timeout=_SUMMARIZE_TIMEOUT,
            )
            resposta_raw = resp.choices[0].message.content.strip()

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key).messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=300,
                messages=[{'role': 'user', 'content': prompt}],
                timeout=_SUMMARIZE_TIMEOUT,
            )
            resposta_raw = msg.content[0].text.strip()

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            resp = OpenAI(
                api_key=api_key,
                base_url='https://api.groq.com/openai/v1',
            ).chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=300,
                timeout=_SUMMARIZE_TIMEOUT,
            )
            resposta_raw = resp.choices[0].message.content.strip()

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-lite']
            modelos_ok = [
                m.name.replace('models/', '') for m in _genai.list_models()
                if 'generateContent' in m.supported_generation_methods
            ]
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if modelo:
                resp = _genai.GenerativeModel(modelo).generate_content(prompt)
                resposta_raw = resp.text.strip()

    except Exception:
        return None

    if not resposta_raw:
        return None

    # Tenta parsear o JSON — o LLM às vezes embrulha em ```json ... ```
    try:
        # Remove blocos de código markdown se presentes
        limpo = re.sub(r'^```(?:json)?\s*', '', resposta_raw, flags=re.MULTILINE)
        limpo = re.sub(r'```\s*$', '', limpo, flags=re.MULTILINE).strip()
        data = json.loads(limpo)
        # Valida campos mínimos
        if not isinstance(data, dict) or 'tema' not in data:
            return None
        return {
            'tema':       str(data.get('tema', '')),
            'subtemas':   [str(s) for s in data.get('subtemas', []) if s][:5],
            'entidades':  [str(e) for e in data.get('entidades', []) if e][:10],
            'conclusao':  str(data.get('conclusao', '')),
        }
    except Exception:
        return None


# ── Sumarização de canal ──────────────────────────────────────────────────────

def resumir_canal(canal_prefixo: str, callback=None, stop_event: threading.Event = None):
    """Gera _resumo.json para cada vídeo do canal que ainda não tem resumo.

    Percorre neural/{prefixo}/youtube/**/*.txt (nova estrutura) e
    neural/youtube/{prefixo}_*.txt (legado).

    Salva: neural/{prefixo}/youtube/{video_id}_resumo.json

    Args:
        canal_prefixo: prefixo sanitizado do projeto.
        callback(n_processados, n_total): função de progresso opcional.
        stop_event: threading.Event para cancelamento cooperativo.
    """
    config = carregar_config()
    provider = config.get('provider', '')
    if not provider or (provider != 'ollama' and not _api_key_valida(config)):
        if callback:
            callback(0, 0)
        return

    # Coleta pares (txt_path, canal_sub_dir) de todas as fontes
    pares: list[tuple[str, str]] = []  # (txt_path, pasta_base_para_resumo)

    # Nova estrutura: neural/{prefixo}/youtube/{canal_sub}/*.txt
    youtube_base = os.path.join(NEURAL_DIR, canal_prefixo, 'youtube')
    if os.path.isdir(youtube_base):
        for canal_sub_entry in os.scandir(youtube_base):
            if canal_sub_entry.is_dir():
                for fname in os.listdir(canal_sub_entry.path):
                    if fname.endswith('.txt') and not fname.startswith('_'):
                        pares.append((os.path.join(canal_sub_entry.path, fname), canal_sub_entry.path))
            elif (canal_sub_entry.name.endswith('.txt')
                  and not canal_sub_entry.name.startswith('_')):
                # Flat legado dentro do próprio youtube_base
                pares.append((canal_sub_entry.path, youtube_base))

    # Legado: neural/youtube/{prefixo}_*.txt
    legacy_dir = os.path.join(NEURAL_DIR, 'youtube')
    if os.path.isdir(legacy_dir):
        for fname in os.listdir(legacy_dir):
            if fname.startswith(canal_prefixo) and fname.endswith('.txt') and not fname.startswith('_'):
                pares.append((os.path.join(legacy_dir, fname), legacy_dir))

    if not pares:
        if callback:
            callback(0, 0)
        return

    n_total = len(pares)
    n_processados = 0

    for txt_path, pasta_base in pares:
        if stop_event and stop_event.is_set():
            break

        try:
            with open(txt_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
                conteudo = f.read()
        except Exception:
            continue

        # Cada .txt pode ter múltiplos blocos (vídeos separados por ===)
        blocos = re.split(r'={50,}', conteudo)
        for bloco in blocos:
            if stop_event and stop_event.is_set():
                break

            bloco = bloco.strip()
            if len(bloco) < 100:
                continue

            vid_id_m = re.search(r'VIDEO_ID:\s*([A-Za-z0-9_\-]{11})', bloco)
            if not vid_id_m:
                continue
            video_id = vid_id_m.group(1).strip()

            # Verifica se já tem resumo — salvo diretamente na pasta_base
            resumo_destino = os.path.join(pasta_base, f'{video_id}_resumo.json')
            if os.path.exists(resumo_destino):
                continue

            titulo_m = re.search(r'TITULO:\s*(.+)', bloco)
            titulo = titulo_m.group(1).strip() if titulo_m else video_id

            partes = re.split(r'-{50,}', bloco)
            texto = partes[-1].strip() if len(partes) > 1 else bloco

            if len(texto) < 80:
                continue

            resumo = resumir_video(texto, titulo, config)
            if resumo:
                resumo['video_id'] = video_id
                resumo['titulo'] = titulo
                try:
                    salvar_json_atomico(resumo, resumo_destino, indent=2)
                except Exception:
                    pass

        n_processados += 1
        if callback:
            callback(n_processados, n_total)


# ── Pendências ────────────────────────────────────────────────────────────────

def pending_por_canal() -> dict:
    """Conta vídeos sem _resumo.json por canal.

    Retorna dict {'total': int, 'canais': [{'prefixo': str, 'pendentes': int}]}.
    Percorre a mesma estrutura de diretórios que resumir_canal().
    """
    total = 0
    canais = []

    if not os.path.isdir(NEURAL_DIR):
        return {'total': 0, 'canais': []}

    for prefixo in sorted(os.listdir(NEURAL_DIR)):
        pasta = os.path.join(NEURAL_DIR, prefixo)
        if not os.path.isdir(pasta):
            continue

        youtube_base = os.path.join(pasta, 'youtube')
        if not os.path.isdir(youtube_base):
            continue

        pendentes = 0

        for entry in os.scandir(youtube_base):
            if entry.is_dir():
                for fname in os.listdir(entry.path):
                    if fname.endswith('.txt') and not fname.startswith('_'):
                        # Conta blocos VIDEO_ID sem _resumo.json correspondente
                        try:
                            with open(os.path.join(entry.path, fname), 'r',
                                      encoding='utf-8-sig', errors='ignore') as f:
                                conteudo = f.read()
                            for bloco in re.split(r'={50,}', conteudo):
                                m = re.search(r'VIDEO_ID:\s*([A-Za-z0-9_\-]{11})', bloco)
                                if m:
                                    vid = m.group(1).strip()
                                    if not os.path.exists(os.path.join(entry.path, f'{vid}_resumo.json')):
                                        pendentes += 1
                        except Exception:
                            pass
            elif entry.name.endswith('.txt') and not entry.name.startswith('_'):
                try:
                    with open(entry.path, 'r', encoding='utf-8-sig', errors='ignore') as f:
                        conteudo = f.read()
                    for bloco in re.split(r'={50,}', conteudo):
                        m = re.search(r'VIDEO_ID:\s*([A-Za-z0-9_\-]{11})', bloco)
                        if m:
                            vid = m.group(1).strip()
                            if not os.path.exists(os.path.join(youtube_base, f'{vid}_resumo.json')):
                                pendentes += 1
                except Exception:
                    pass

        if pendentes > 0:
            canais.append({'prefixo': prefixo, 'pendentes': pendentes})
            total += pendentes

    return {'total': total, 'canais': canais}
