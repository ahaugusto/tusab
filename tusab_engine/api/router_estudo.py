# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de Modo Estudo: geração de flashcards e resumo estruturado via LLM.
"""

import os
import re
import json
import time
import random

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

import agent_tusab
from tusab_engine.storage import NEURAL_DIR, salvar_json_atomico

router = APIRouter()


class StudyRequest(BaseModel):
    canal_nome: str = Field(max_length=120)
    tipo:       str = Field(default="flashcards", max_length=20)  # flashcards | resumo | ambos
    n_cards:    int = Field(default=10, ge=1, le=30)


class TTSRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=10000)


def _chamar_llm_estudo(prompt: str) -> str:
    """Chama o LLM configurado com o prompt e retorna a resposta como string."""
    config = agent_tusab.carregar_config()
    provider = config.get("provider", "gemini")
    api_key  = config.get("api_key", "")

    if provider == "ollama":
        import requests as _req
        model = config.get("ollama_model", "llama3.2:1b")
        resp = _req.post(
            "http://localhost:11434/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=300,
        )
        return resp.json().get("response", "")

    if provider in ("gemini", "google"):
        import google.generativeai as _genai
        _genai.configure(api_key=api_key)
        model = _genai.GenerativeModel("gemini-1.5-flash")
        return model.generate_content(prompt).text

    if provider in ("openai", "groq"):
        from openai import OpenAI
        base_url = "https://api.groq.com/openai/v1" if provider == "groq" else None
        llm_model = config.get("groq_model", "llama-3.1-8b-instant") if provider == "groq" else "gpt-4o-mini"
        client = OpenAI(api_key=api_key, **({"base_url": base_url} if base_url else {}))
        resp = client.chat.completions.create(
            model=llm_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
        )
        return resp.choices[0].message.content or ""

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text if msg.content else ""

    raise ValueError(f"Provider não configurado: {provider}")


def _parsear_flashcards_json(texto: str, n_esperado: int) -> list:
    """Extrai flashcards de uma resposta LLM que deveria conter um array JSON.

    Tenta três estratégias em cascata:
    1. json.loads direto (resposta limpa)
    2. Extrai primeiro bloco [...] da resposta (LLM adicionou texto antes/depois)
    3. Fallback para regex Q:/A: (LLM ignorou a instrução de JSON)
    """
    texto = texto.strip()

    # Estratégia 1: JSON direto
    try:
        data = json.loads(texto)
        if isinstance(data, list):
            return _validar_cards(data)
    except (json.JSONDecodeError, ValueError):
        pass

    # Estratégia 2: extrai bloco JSON [...] do meio do texto
    match = re.search(r'\[\s*\{.*?\}\s*\]', texto, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return _validar_cards(data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Estratégia 3: fallback Q:/A: linha a linha (LLM ignorou JSON)
    pares = re.findall(r'Q:\s*(.+?)\nA:\s*(.+?)(?=\n(?:\d+\.|Q:)|\Z)', texto + '\n', re.DOTALL)
    if pares:
        return [{"pergunta": q.strip(), "resposta": a.strip()} for q, a in pares]

    return []


def _validar_cards(data: list) -> list:
    """Filtra e normaliza itens do array JSON — descarta entradas sem pergunta/resposta."""
    resultado = []
    for item in data:
        if not isinstance(item, dict):
            continue
        pergunta = str(item.get("pergunta") or item.get("question") or item.get("front") or "").strip()
        resposta  = str(item.get("resposta")  or item.get("answer")   or item.get("back")  or "").strip()
        if pergunta and resposta:
            resultado.append({"pergunta": pergunta, "resposta": resposta})
    return resultado


@router.post("/agent/study")
def agent_study(req: StudyRequest):
    """Gera flashcards e/ou resumo estruturado a partir do índice BM25 do projeto."""
    if req.tipo not in ("flashcards", "resumo", "ambos"):
        return {"error": True, "message": "Tipo inválido. Use: flashcards, resumo ou ambos."}

    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal_nome).strip('_')
    if not canal_prefixo:
        return {"error": True, "message": "Canal não especificado."}

    from tusab_engine.agent.index import _index_path
    idx_path = _index_path(canal_prefixo)
    if not os.path.exists(idx_path):
        return {"error": True, "message": f"Índice não encontrado para '{req.canal_nome}'. Indexe a base primeiro."}

    try:
        with open(idx_path, 'r', encoding='utf-8') as f:
            idx_data = json.load(f)
    except Exception as e:
        return {"error": True, "message": f"Erro ao carregar índice: {e}"}

    chunks = idx_data.get("chunks", [])
    if not chunks:
        return {"error": True, "message": "Índice vazio. Adicione conteúdo e indexe novamente."}

    # Amostra distribuída: sorteia aleatoriamente de todo o índice (não só do início).
    # Flashcards precisam de mais diversidade; resumo precisa de menos tokens no prompt.
    n_amostras = min(req.n_cards * 3, 60, len(chunks))
    amostra = random.sample(chunks, n_amostras)
    # Amostra menor dedicada ao resumo — reduz contexto enviado ao LLM (~18k→4k chars)
    n_resumo = min(15, len(chunks))
    amostra_resumo = random.sample(chunks, n_resumo)

    mgmt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "management")
    os.makedirs(mgmt_dir, exist_ok=True)

    flashcards_resultado = []
    resumo_resultado = ""

    if req.tipo in ("flashcards", "ambos"):
        trechos = "\n\n".join(
            f"[{c.get('titulo', '')}]: {str(c.get('texto', ''))[:300]}"
            for c in amostra
        )
        prompt_fc = (
            f"Você é um tutor especializado. Com base nos trechos abaixo de \"{req.canal_nome}\", "
            f"gere exatamente {req.n_cards} flashcards de estudo.\n\n"
            "RESPONDA APENAS com um array JSON válido. Nenhum texto antes ou depois.\n"
            "Formato:\n"
            '[\n'
            '  {"pergunta": "texto da pergunta", "resposta": "texto da resposta"},\n'
            '  ...\n'
            ']\n\n'
            "Regras:\n"
            f"- Exatamente {req.n_cards} objetos no array\n"
            "- Cada pergunta deve ser específica e clara\n"
            "- Cada resposta deve ser direta e concisa (1-3 frases)\n"
            "- Cubra conceitos variados dos trechos fornecidos\n\n"
            f"TRECHOS:\n{trechos}"
        )
        try:
            resposta_fc = _chamar_llm_estudo(prompt_fc)
            # Parser robusto: extrai o primeiro array JSON da resposta
            flashcards_resultado = _parsear_flashcards_json(resposta_fc, req.n_cards)
            if not flashcards_resultado:
                return {"error": True, "message": "O modelo não retornou flashcards no formato esperado. Tente novamente."}
            fc_path = os.path.join(mgmt_dir, "flashcards.json")
            salvar_json_atomico({
                "canal": req.canal_nome,
                "gerado_em": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "flashcards": flashcards_resultado,
            }, fc_path, indent=2)
        except Exception as e:
            return {"error": True, "message": f"Erro ao gerar flashcards: {e}"}

    if req.tipo in ("resumo", "ambos"):
        # Usa amostra_resumo (15 chunks × 250 chars = ~3.750 chars) — viável para Ollama local
        trechos_resumo = "\n\n".join(
            f"[{c.get('titulo', '')}]: {str(c.get('texto', ''))[:250]}"
            for c in amostra_resumo
        )
        prompt_rs = (
            f"Com base nos trechos abaixo de {req.canal_nome}, crie um resumo estruturado de estudo.\n\n"
            "Inclua:\n"
            "1. Tema central (1 frase)\n"
            "2. Conceitos-chave (3-5 bullet points)\n"
            "3. Insights principais (2-3 parágrafos)\n"
            "4. Lacunas identificadas (o que o conteúdo não cobre)\n\n"
            f"TRECHOS:\n{trechos_resumo}"
        )
        try:
            resumo_resultado = _chamar_llm_estudo(prompt_rs)
            rs_path = os.path.join(mgmt_dir, "resumo_estudo.md")
            with open(rs_path, "w", encoding="utf-8") as f:
                f.write(resumo_resultado)
        except Exception as e:
            return {"error": True, "message": f"Erro ao gerar resumo: {e}"}

    return {
        "ok": True,
        "flashcards": flashcards_resultado,
        "resumo": resumo_resultado,
        "total": len(flashcards_resultado),
    }


@router.get("/agent/study/{canal_nome}")
def agent_study_get(canal_nome: str):
    """Retorna flashcards e resumo salvos para o projeto."""
    canal_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', canal_nome).strip('_')
    if not canal_prefixo:
        return {"flashcards": [], "resumo": None, "total": 0}

    mgmt_dir = os.path.join(NEURAL_DIR, canal_prefixo, "management")
    fc_path = os.path.join(mgmt_dir, "flashcards.json")
    rs_path = os.path.join(mgmt_dir, "resumo_estudo.md")

    flashcards = []
    if os.path.exists(fc_path):
        try:
            with open(fc_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            flashcards = data.get("flashcards", [])
        except Exception:
            pass

    resumo = None
    if os.path.exists(rs_path):
        try:
            with open(rs_path, 'r', encoding='utf-8') as f:
                resumo = f.read()
        except Exception:
            pass

    return {"flashcards": flashcards, "resumo": resumo, "total": len(flashcards)}


@router.get("/agent/tts/status")
def agent_tts_status():
    """Verifica se o TTS local está disponível nesta instalação (build Beta/Enterprise).

    Build B2C padrão não tem torch/pocket-tts — retorna disponivel=False,
    frontend deve ocultar o botão "Ouvir resumo" nesse caso.
    """
    from tusab_engine.agent.tts import tts_disponivel
    return {"disponivel": tts_disponivel()}


@router.post("/agent/tts")
def agent_tts(req: TTSRequest):
    """Sintetiza texto em áudio via Pocket TTS (kyutai-labs) — build Beta/Enterprise.

    Reservado: torch+pocket-tts não fazem parte do requirements.txt do B2C
    (medição real: ~530MB em disco, ver `tusab_engine/agent/tts.py`). Retorna
    erro claro em vez de 500 quando a stack não está instalada.
    """
    from tusab_engine.agent.tts import sintetizar_audio

    try:
        audio_bytes = sintetizar_audio(req.texto)
    except RuntimeError as e:
        return {"error": True, "message": str(e)}
    except Exception as e:
        return {"error": True, "message": f"Erro ao gerar áudio: {e}"}

    return Response(content=audio_bytes, media_type="audio/wav")
