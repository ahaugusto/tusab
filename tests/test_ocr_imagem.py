# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes de _extrair_imagem() — tusab_engine/api/router_repositorio.py.

Substitui pytesseract por RapidOCR (jul/2026): pytesseract exigia o binário
Tesseract instalado à parte no sistema, gerando erro técnico pro usuário não-
técnico quando ausente. RapidOCR é Python+ONNX puro, sem instalação externa.

Sem chamada de rede real (Ollama) nem carregamento de modelo ONNX real —
_get_rapidocr_engine é mockado, seguindo o padrão do projeto de não mockar
filesystem mas mockar chamadas externas/carregamento de modelo pesado.
"""
import io
from unittest.mock import MagicMock, patch

from PIL import Image

from tusab_engine.api import router_repositorio


def _png_bytes() -> bytes:
    """Imagem real mínima (10x10 branca) — Image.open() precisa de bytes
    válidos antes mesmo de chegar no mock do RapidOCR."""
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="white").save(buf, format="PNG")
    return buf.getvalue()


def test_extrai_imagem_via_rapidocr_quando_ollama_indisponivel():
    with patch("urllib.request.urlopen", side_effect=ConnectionRefusedError("Ollama offline")):
        with patch.object(
            router_repositorio, "_get_rapidocr_engine",
            return_value=MagicMock(return_value=(
                [[[[0, 0], [10, 0], [10, 10], [0, 10]], "Texto real da imagem", "0.95"]],
                [0.1, 0.01, 0.05],
            )),
        ):
            texto = router_repositorio._extrair_imagem(_png_bytes(), "teste.png")

    assert "RapidOCR" in texto
    assert "Texto real da imagem" in texto


def test_extrai_imagem_prefere_ollama_multimodal_quando_disponivel():
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"response": "Uma foto de um gato laranja."}'
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False

    with patch("urllib.request.urlopen", return_value=mock_resp):
        with patch.object(router_repositorio, "_get_rapidocr_engine") as mock_rapidocr:
            texto = router_repositorio._extrair_imagem(_png_bytes(), "teste.png")

    assert "Ollama multimodal" in texto
    assert "gato laranja" in texto
    mock_rapidocr.assert_not_called()  # RapidOCR nem deve ser chamado se Ollama respondeu


def test_extrai_imagem_lanca_erro_quando_rapidocr_nao_encontra_texto():
    with patch("urllib.request.urlopen", side_effect=ConnectionRefusedError("Ollama offline")):
        with patch.object(
            router_repositorio, "_get_rapidocr_engine",
            return_value=MagicMock(return_value=(None, [0.1, 0.0, 0.0])),
        ):
            try:
                router_repositorio._extrair_imagem(_png_bytes(), "teste.png")
                assert False, "deveria ter levantado RuntimeError"
            except RuntimeError as e:
                assert "sem conteúdo extraível" in str(e)


def test_extrai_imagem_mensagem_erro_menciona_rapidocr_nao_pytesseract():
    with patch("urllib.request.urlopen", side_effect=ConnectionRefusedError("Ollama offline")):
        with patch.object(router_repositorio, "_get_rapidocr_engine", side_effect=ImportError("no module")):
            try:
                router_repositorio._extrair_imagem(_png_bytes(), "teste.png")
                assert False, "deveria ter levantado RuntimeError"
            except RuntimeError as e:
                assert "rapidocr" in str(e).lower()
                assert "pytesseract" not in str(e).lower()
