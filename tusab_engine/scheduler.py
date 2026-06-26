# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Digest semanal: sintetiza os arquivos adicionados à base de conhecimento
na última semana e salva um relatório .md em management/.

Uso manual:
    from tusab_engine.scheduler import gerar_digest
    texto = gerar_digest("meu_projeto")

Agendamento automático (opcional — não ativado no startup por padrão):
    from tusab_engine.scheduler import agendar_digest
    agendar_digest()  # CronTrigger: segunda-feira às 8h
"""

import os
import time
import logging

from tusab_engine.storage import NEURAL_DIR, gestao_canal_dir
from tusab_engine.agent.config import carregar_config, SENTINEL_KEY

_log = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────

_JANELA_SEGUNDOS = 7 * 24 * 3600   # 7 dias
_MAX_AMOSTRAS    = 8                # nº máximo de arquivos amostrados
_CHARS_AMOSTRA   = 100             # nº de chars por arquivo no prompt
_TIMEOUT_LLM     = 20              # timeout em segundos para chamada LLM


# ── Coleta de arquivos novos ──────────────────────────────────────────────────

def _arquivos_novos(projeto_prefixo: str) -> list[dict]:
    """Retorna lista de {path, nome} de arquivos com mtime < 7 dias."""
    base = os.path.join(NEURAL_DIR, projeto_prefixo)
    corte = time.time() - _JANELA_SEGUNDOS
    novos = []

    for sub in ('youtube', 'documents', 'texts'):
        pasta = os.path.join(base, sub)
        if not os.path.isdir(pasta):
            continue
        for fname in os.listdir(pasta):
            if fname.startswith('_'):
                continue
            fpath = os.path.join(pasta, fname)
            try:
                if os.path.getmtime(fpath) > corte:
                    novos.append({'path': fpath, 'nome': fname, 'sub': sub})
            except OSError:
                pass

    return novos


def _ler_amostra(fpath: str, n_chars: int = _CHARS_AMOSTRA) -> str:
    """Lê os primeiros n_chars de um arquivo de texto."""
    try:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read(n_chars).strip()
    except Exception:
        return ''


# ── Digest via LLM ────────────────────────────────────────────────────────────

def _prompt_digest(n: int, amostras: str) -> str:
    return (
        "Você é o Tusab. O usuário adicionou novos conteúdos à base de conhecimento nesta semana.\n\n"
        f"Conteúdos adicionados ({n} arquivo(s)):\n"
        f"{amostras}\n\n"
        "Sintetize em 3 a 5 bullet points as principais ideias ou temas encontrados.\n"
        "Seja conciso. Use \"•\" como marcador. Responda em português."
    )


def _chamar_llm(prompt: str, config: dict) -> str | None:
    """Chama o LLM configurado e retorna a resposta ou None em caso de falha."""
    provider = config.get('provider', '')
    api_key  = config.get('api_key', '')

    # Chave inválida (sentinel ou vazia) para providers que precisam de chave
    if provider != 'ollama' and (not api_key or api_key == SENTINEL_KEY):
        return None

    try:
        if provider == 'ollama':
            import requests as _req
            modelo = config.get('ollama_model', 'llama3.2:1b')
            resp = _req.post(
                'http://localhost:11434/api/generate',
                json={'model': modelo, 'prompt': prompt, 'stream': False},
                timeout=_TIMEOUT_LLM,
            )
            resp.raise_for_status()
            return resp.json().get('response', '').strip() or None

        elif provider == 'openai':
            from openai import OpenAI
            resp = OpenAI(api_key=api_key).chat.completions.create(
                model='gpt-4o-mini',
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=_TIMEOUT_LLM,
            )
            return resp.choices[0].message.content.strip() or None

        elif provider == 'anthropic':
            import anthropic
            msg = anthropic.Anthropic(api_key=api_key).messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=400,
                messages=[{'role': 'user', 'content': prompt}],
                timeout=_TIMEOUT_LLM,
            )
            return msg.content[0].text.strip() or None

        elif provider == 'groq':
            from openai import OpenAI
            modelo = config.get('groq_model', 'llama-3.1-8b-instant')
            resp = OpenAI(
                api_key=api_key,
                base_url='https://api.groq.com/openai/v1',
            ).chat.completions.create(
                model=modelo,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=400,
                timeout=_TIMEOUT_LLM,
            )
            return resp.choices[0].message.content.strip() or None

        elif provider in ('gemini', 'google'):
            import google.generativeai as _genai
            _genai.configure(api_key=api_key)
            CANDIDATOS = [
                'gemini-1.5-flash', 'gemini-1.5-flash-latest',
                'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-pro',
            ]
            modelos_ok = [
                m.name.replace('models/', '') for m in _genai.list_models()
                if 'generateContent' in m.supported_generation_methods
            ]
            modelo = next((m for m in CANDIDATOS if m in modelos_ok), modelos_ok[0] if modelos_ok else None)
            if not modelo:
                return None
            resp = _genai.GenerativeModel(modelo).generate_content(prompt)
            return resp.text.strip() or None

    except Exception as e:
        _log.warning("Digest: LLM falhou (%s). Usando fallback sem síntese.", e)
        return None

    return None


# ── Digest sem síntese (fallback) ────────────────────────────────────────────

def _digest_fallback(projeto_prefixo: str, arquivos: list[dict], data_str: str) -> str:
    nomes = '\n'.join(f"• {a['nome']}" for a in arquivos)
    return (
        f"# Digest da semana — {data_str}\n\n"
        f"{len(arquivos)} arquivo(s) adicionado(s) esta semana ao projeto @{projeto_prefixo}.\n\n"
        f"Conteúdos novos:\n{nomes}\n"
    )


# ── Função principal ──────────────────────────────────────────────────────────

def gerar_digest(projeto_prefixo: str) -> str | None:
    """Gera o digest semanal para o projeto.

    - Escaneia youtube/, documents/ e texts/ em busca de arquivos com mtime < 7 dias.
    - Se não houver arquivos novos, retorna None sem gravar nada.
    - Tenta sintetizar via LLM configurado; usa fallback textual se falhar.
    - Salva resultado em data/neural/{projeto}/management/digest_{YYYY-MM-DD}.md.
    - Retorna o texto do digest gerado.
    """
    arquivos = _arquivos_novos(projeto_prefixo)
    if not arquivos:
        return None

    data_str  = time.strftime('%Y-%m-%d')
    mgmt_dir  = gestao_canal_dir(projeto_prefixo)   # cria se não existir
    out_path  = os.path.join(mgmt_dir, f'digest_{data_str}.md')

    # Monta amostras para o prompt
    amostra_itens = arquivos[:_MAX_AMOSTRAS]
    blocos = []
    for a in amostra_itens:
        trecho = _ler_amostra(a['path'])
        if trecho:
            blocos.append(f"[{a['nome']}]: {trecho}")
        else:
            blocos.append(f"[{a['nome']}]: (sem prévia)")
    amostras_str = '\n'.join(blocos)

    config  = carregar_config()
    sintese = None

    if config.get('provider'):
        prompt  = _prompt_digest(len(arquivos), amostras_str)
        sintese = _chamar_llm(prompt, config)

    if sintese:
        digest_texto = (
            f"# Digest da semana — {data_str}\n\n"
            f"> Gerado automaticamente pelo Tusab · {len(arquivos)} arquivo(s) novo(s)\n\n"
            f"{sintese}\n"
        )
    else:
        digest_texto = _digest_fallback(projeto_prefixo, arquivos, data_str)

    # Escrita atômica
    tmp = out_path + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(digest_texto)
        os.replace(tmp, out_path)
    except Exception as e:
        _log.error("Digest: falha ao salvar %s — %s", out_path, e)
        try:
            os.remove(tmp)
        except OSError:
            pass
        return None

    return digest_texto


# ── Listagem de digests ───────────────────────────────────────────────────────

def listar_digests(projeto_prefixo: str) -> list[dict]:
    """Retorna lista de digests salvos em management/, do mais recente para o mais antigo.

    Cada item: {"data": "YYYY-MM-DD", "preview": str, "filename": str}
    """
    mgmt_dir = os.path.join(NEURAL_DIR, projeto_prefixo, 'management')
    if not os.path.isdir(mgmt_dir):
        return []

    digests = []
    for fname in os.listdir(mgmt_dir):
        if not (fname.startswith('digest_') and fname.endswith('.md')):
            continue
        # Extrai data do nome: digest_YYYY-MM-DD.md
        data_parte = fname[len('digest_'):-len('.md')]
        fpath = os.path.join(mgmt_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                conteudo = f.read(300)
            preview = conteudo[:200].strip()
        except Exception:
            preview = ''
        digests.append({'data': data_parte, 'preview': preview, 'filename': fname})

    digests.sort(key=lambda d: d['data'], reverse=True)
    return digests


# ── Agendamento (APScheduler — opcional) ─────────────────────────────────────

def agendar_digest():
    """Registra job semanal (segunda-feira às 8h) usando APScheduler.

    Se APScheduler não estiver instalado, registra aviso e retorna sem erro.
    Para ativar: chame esta função no startup do app (ex.: api_tusab.py).

        # api_tusab.py — ativar digest semanal automático:
        # from tusab_engine.scheduler import agendar_digest
        # agendar_digest()
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        _log.warning(
            "APScheduler não instalado — digest semanal automático desativado. "
            "Instale com: .venv\\Scripts\\python.exe -m pip install apscheduler"
        )
        return

    def _job():
        if not os.path.isdir(NEURAL_DIR):
            return
        for entry in os.scandir(NEURAL_DIR):
            if not entry.is_dir():
                continue
            try:
                resultado = gerar_digest(entry.name)
                if resultado:
                    _log.info("Digest gerado para projeto '%s'.", entry.name)
                else:
                    _log.debug("Digest ignorado para '%s' — sem arquivos novos.", entry.name)
            except Exception as e:
                _log.error("Erro ao gerar digest para '%s': %s", entry.name, e)

    scheduler = BackgroundScheduler()
    scheduler.add_job(_job, CronTrigger(day_of_week='mon', hour=8))
    scheduler.start()
    _log.info("Digest semanal agendado: segunda-feira às 8h.")
