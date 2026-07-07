# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Text-to-speech local para o Modo Estudo — feature de edição Beta/Enterprise.

Usa Pocket TTS (kyutai-labs/pocket-tts): modelo de 100M parâmetros, CPU-only,
streaming, sem chamada de rede após o primeiro download dos pesos (HuggingFace
Hub, cache local). Avaliado em `agents/_historia.md` (seção "Benchmark —
ferramentas open-source avaliadas").

[DECISÃO DE ARQUITETURA] `torch` + `pocket-tts` NUNCA entram no requirements.txt
do instalador B2C — medido em jul/2026: torch sozinho ocupa ~530MB em disco,
mais que a stack semântica inteira (CrossEncoder+KeyBERT, ~2,5GB) que já foi
vetada do B2C pelo mesmo motivo. Ficam em `requirements-enterprise.txt`, junto
com CrossEncoder/KeyBERT, reservados à build Beta/Enterprise. Ver:
`Documentação do Produto/Plano B2B — Tusab Enterprise.md`.

Responsabilidades:
  - tts_disponivel()  : verifica se torch+pocket-tts estão instalados, sem lançar
  - limpar_para_audio(): remove markdown do texto antes de sintetizar
  - sintetizar_audio(): gera WAV a partir de texto, lazy-load do modelo

Regras de dependência (acíclica):
  agent/tts.py → storage.py (nenhum path próprio necessário hoje)
  Não importa nada de api/

Degradação graciosa:
  - Se torch/pocket-tts não estiverem instalados (build B2C padrão),
    tts_disponivel() retorna False e sintetizar_audio() lança RuntimeError
    com mensagem clara — o endpoint da API converte isso em {"error": True}.
  - Modelo carregado uma vez (lazy singleton) e reutilizado entre chamadas.
"""

import io
import re
import threading

_model = None
_model_lock = threading.Lock()

_VOZES_PT = "rafael"  # única voz nativa em português hoje disponível no catálogo Pocket TTS


def tts_disponivel() -> bool:
    """Verifica se a stack de TTS está instalada, sem lançar exceção."""
    try:
        import torch  # noqa: F401
        import pocket_tts  # noqa: F401
        return True
    except ImportError:
        return False


def limpar_para_audio(texto_markdown: str) -> str:
    """Remove marcação markdown antes de sintetizar — TTS lê texto corrido,
    não deve pronunciar '#', '**', '-', etc.
    """
    texto = texto_markdown
    texto = re.sub(r'^#{1,6}\s*', '', texto, flags=re.MULTILINE)       # headings
    texto = re.sub(r'\*\*(.+?)\*\*', r'\1', texto)                      # negrito
    texto = re.sub(r'\*(.+?)\*', r'\1', texto)                          # itálico
    texto = re.sub(r'^[\-\*]\s+', '', texto, flags=re.MULTILINE)        # bullets
    texto = re.sub(r'^\d+\.\s+', '', texto, flags=re.MULTILINE)         # listas numeradas
    texto = re.sub(r'`([^`]+)`', r'\1', texto)                          # code inline
    texto = re.sub(r'\n{2,}', '. ', texto)                              # parágrafos → pausa
    texto = re.sub(r'\n', '. ', texto)                                  # quebra simples (ex: entre bullets) → pausa
    texto = re.sub(r'\.\s*\.', '.', texto)                              # colapsa ".." geradas pelas trocas acima
    texto = re.sub(r'\s{2,}', ' ', texto).strip()
    return texto


def _get_model():
    """Lazy singleton do modelo Pocket TTS — carregado uma vez, reutilizado."""
    global _model
    with _model_lock:
        if _model is None:
            from pocket_tts import TTSModel
            _model = TTSModel.load_model()
        return _model


def sintetizar_audio(texto: str, voz: str = _VOZES_PT) -> bytes:
    """Sintetiza texto em áudio WAV. Levanta RuntimeError se a stack não
    estiver instalada (build B2C padrão) — chamador deve capturar e responder
    com erro claro, nunca deixar propagar como 500 genérico.
    """
    if not tts_disponivel():
        raise RuntimeError(
            "TTS não disponível nesta edição do Tusab. "
            "Recurso reservado à edição Beta/Enterprise (stack torch+pocket-tts)."
        )

    import scipy.io.wavfile as wavfile

    model = _get_model()
    voice_state = model.get_state_for_audio_prompt(voz)
    texto_limpo = limpar_para_audio(texto)
    audio = model.generate_audio(voice_state, texto_limpo)

    buffer = io.BytesIO()
    wavfile.write(buffer, model.sample_rate, audio.numpy())
    return buffer.getvalue()
