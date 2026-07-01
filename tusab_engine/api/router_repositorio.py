# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas do repositório: listagem, relatório, upload, textos e limpeza do cérebro.
"""

import os
import re
import json
import glob

from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel, Field

import motor_tusab
from tusab_engine.state import state

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_canal_prefixo_ativo(canal_form: str = "") -> str | None:
    """Retorna o prefixo de canal ativo (form > state). Retorna None se não houver projeto."""
    raw = canal_form or state.stats.get("canal_nome", "") or ""
    if not raw:
        return None
    return re.sub(r'[<>:"/\\|?*\s]', '_', raw).strip('_') or None


# ── Models ────────────────────────────────────────────────────────────────────

class TextoRequest(BaseModel):
    titulo:   str = Field(max_length=200)
    conteudo: str = Field(max_length=500_000)
    canal:    str = Field(default="", max_length=120)

class LimparRequest(BaseModel):
    youtube:    bool = False
    documentos: bool = False
    textos:     bool = False
    canal:      str  = Field(default="", max_length=120)

class LimparHistoricoRequest(BaseModel):
    prefixos: list = []

class BuscarPayload(BaseModel):
    query: str = Field(max_length=500)
    canal: str = Field(default='', max_length=120)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/repositorio")
def get_repositorio():
    """Lista arquivos do neural agrupados por canal + listas planas para compatibilidade."""
    neural_dir = motor_tusab.NEURAL_DIR
    result = {"youtube": [], "documentos": [], "textos": [], "canais": []}

    def _read_manifest(path):
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _list_youtube(yt_dir, canal_nome):
        arquivos = []
        if not os.path.exists(yt_dir):
            return arquivos
        # Nova estrutura: youtube/{canal_slug}/*.txt — varre um nível de subpastas
        txts = glob.glob(os.path.join(yt_dir, '**', '*.txt'), recursive=True)
        for fpath in sorted(txts):
            fname = os.path.basename(fpath)
            if fname.startswith('_'):
                continue
            stat = os.stat(fpath)
            arquivos.append({
                "nome": fname, "canal": canal_nome,
                "tamanho": stat.st_size,
                "data": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y"),
            })
        return arquivos

    def _count_csv_videos(canal_prefixo, mgmt_dir):
        """Conta linhas no CSV de gestão — vídeos mapeados mesmo sem .txt."""
        csv_path = os.path.join(mgmt_dir, f"{canal_prefixo}_base.csv")
        if not os.path.exists(csv_path):
            return 0
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                return max(0, sum(1 for _ in f) - 1)  # desconta header
        except Exception:
            return 0

    seen_yt = set()

    if os.path.exists(neural_dir):
        for entry in sorted(os.scandir(neural_dir), key=lambda e: e.name):
            if not entry.is_dir():
                continue
            canal_nome    = entry.name
            canal_yt_dir  = os.path.join(entry.path, 'youtube')
            canal_doc_dir = os.path.join(entry.path, 'documents')
            canal_txt_dir = os.path.join(entry.path, 'texts')
            canal_mgmt_dir = os.path.join(entry.path, 'management')

            yt_files  = _list_youtube(canal_yt_dir, canal_nome)
            docs      = _read_manifest(os.path.join(canal_doc_dir, '_manifest.json'))
            textos    = _read_manifest(os.path.join(canal_txt_dir, '_manifest.json'))
            videos_mapeados = _count_csv_videos(canal_nome, canal_mgmt_dir)

            for item in docs:   item['canal'] = canal_nome
            for item in textos: item['canal'] = canal_nome

            # Inclui canal mesmo sem .txt, se tiver CSV ou docs/textos
            if yt_files or docs or textos or videos_mapeados > 0:
                result["canais"].append({
                    "nome": canal_nome, "youtube": yt_files,
                    "documentos": docs, "textos": textos,
                    "videos_mapeados": videos_mapeados,
                })
                for f in yt_files:
                    key = f["nome"]
                    if key not in seen_yt:
                        seen_yt.add(key)
                        result["youtube"].append(f)
                result["documentos"] += docs
                result["textos"]     += textos

    # Legado: cerebro/youtube/ flat
    legacy_yt = motor_tusab.LOCAL_TXT_DIR
    if os.path.exists(legacy_yt):
        for fname in sorted(os.listdir(legacy_yt)):
            if fname.endswith('.txt') and not fname.startswith('_') and fname not in seen_yt:
                fpath = os.path.join(legacy_yt, fname)
                stat  = os.stat(fpath)
                result["youtube"].append({
                    "nome": fname, "canal": "",
                    "tamanho": stat.st_size,
                    "data": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y"),
                })

    result["documentos"] += _read_manifest(os.path.join(neural_dir, "documents", "_manifest.json"))
    result["textos"]     += _read_manifest(os.path.join(neural_dir, "texts",     "_manifest.json"))

    return result


@router.get("/relatorio/{canal}")
def get_relatorio(canal: str):
    """Retorna dados do CSV de gestão para o canal especificado."""
    import re as _re
    canal_safe = _re.sub(r'[<>:"/\\|?*\s]', '_', canal).strip('_')
    csv_path = os.path.join(motor_tusab.gestao_canal_dir(canal_safe), f"{canal_safe}_base.csv")
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


_EXTS_IMAGEM = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}
_EXTS_AUDIO  = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".opus", ".aac"}
_MAX_IMAGEM  = 20 * 1024 * 1024   # 20 MB
_MAX_AUDIO   = 100 * 1024 * 1024  # 100 MB
_MAX_DOC     = 50 * 1024 * 1024   # 50 MB


# ── Parsers de formatos especiais ─────────────────────────────────────────────

def _detectar_formato_especial(texto: str, filename: str) -> str | None:
    """Detecta se o texto é um export de WhatsApp ou transcrição de reunião.
    Retorna: 'whatsapp_android' | 'whatsapp_ios' | 'otter' | 'zoom' | 'teams' | None
    """
    linhas = texto.strip().splitlines()
    if not linhas:
        return None

    cabecalho = '\n'.join(linhas[:5]).lower()
    nome_lower = filename.lower()

    # Zoom — primeira linha típica "Meeting ID:" ou header CSV com colunas Zoom
    if 'meeting id:' in cabecalho or 'zoom meeting' in cabecalho:
        return 'zoom'
    if 'zoom_' in nome_lower or nome_lower.startswith('gmt'):
        # arquivos Zoom têm padrão GMT20240101_... ou zoom_...
        if re.search(r'\d{2}:\d{2}:\d{2}', linhas[0] if linhas else ''):
            return 'zoom'

    # Otter.ai — "Otter.ai" no cabeçalho ou padrão "Speaker X  HH:MM"
    if 'otter.ai' in cabecalho or 'otter' in nome_lower:
        return 'otter'

    # Teams — padrão "Nome Sobrenome   HH:MM" ou header com "Microsoft Teams"
    if 'microsoft teams' in cabecalho or 'teams meeting' in cabecalho:
        return 'teams'

    # WhatsApp Android: "[DD/MM/AAAA, HH:MM:SS] Nome: mensagem"
    # ou "DD/MM/AA HH:MM - Nome: mensagem"
    wapp_android = re.compile(
        r'^\[?\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]\s*.+?:',
        re.MULTILINE
    )
    if wapp_android.search('\n'.join(linhas[:20])):
        return 'whatsapp_android'

    # WhatsApp iOS: "DD/MM/AAAA HH:MM - Nome: mensagem"
    wapp_ios = re.compile(
        r'^\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}\s*[-–]\s*.+?:',
        re.MULTILINE
    )
    if wapp_ios.search('\n'.join(linhas[:20])):
        return 'whatsapp_ios'

    return None


def _parsear_whatsapp(texto: str, formato: str) -> str:
    """Estrutura export de WhatsApp por dia e participante.

    Itera linha a linha para capturar mensagens multilinha corretamente:
    linhas que não começam com o padrão de cabeçalho são continuação da
    mensagem anterior, não uma nova entrada.
    """
    if formato == 'whatsapp_android':
        padrao_cabecalho = re.compile(
            r'^\[?(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]\s*([^:]+):\s*(.+)'
        )
    else:
        padrao_cabecalho = re.compile(
            r'^(\d{1,2}/\d{1,2}/\d{2,4})\s+(\d{1,2}:\d{2})\s*[-–]\s*([^:]+):\s*(.+)'
        )

    mensagens: list[tuple[str, str, str, list[str]]] = []  # (data, hora, remetente, linhas)

    for linha in texto.splitlines():
        m = padrao_cabecalho.match(linha)
        if m:
            data, hora, remetente, primeira_linha = m.groups()
            # Ignora mensagens de sistema (caractere invisível WhatsApp)
            if primeira_linha.strip().startswith('‎'):
                mensagens.append((data, hora, remetente.strip(), []))
            else:
                mensagens.append((data, hora, remetente.strip(), [primeira_linha.strip()]))
        elif mensagens:
            # Continuação da mensagem anterior
            linha_strip = linha.strip()
            if linha_strip and mensagens[-1][3] is not None:
                mensagens[-1][3].append(linha_strip)

    # Filtra entradas vazias (mensagens de sistema sem conteúdo)
    mensagens = [(d, h, r, ls) for d, h, r, ls in mensagens if ls]

    if not mensagens:
        return texto

    por_dia: dict = {}
    participantes: set = set()
    for data, hora, remetente, linhas in mensagens:
        participantes.add(remetente)
        conteudo = ' '.join(linhas)
        por_dia.setdefault(data, []).append(f"[{hora}] {remetente}: {conteudo}")

    blocos = [
        "Conversa do WhatsApp",
        f"Participantes: {', '.join(sorted(participantes))}",
        f"Total de mensagens: {len(mensagens)}",
        "-" * 60,
    ]
    for data, msgs in por_dia.items():
        blocos.append(f"\n--- {data} ---")
        blocos.extend(msgs)

    return '\n'.join(blocos)


def _parsear_reuniao(texto: str, formato: str) -> str:
    """Estrutura transcrição de reunião (Zoom, Otter, Teams) com falantes."""
    linhas = texto.splitlines()

    if formato == 'zoom':
        # Formato Zoom VTT: "Nome Sobrenome\nHH:MM:SS --> HH:MM:SS\nTexto"
        # Ou formato Zoom TXT simples: "HH:MM:SS Nome Sobrenome: texto"
        padrao_simples = re.compile(r'^(\d{2}:\d{2}:\d{2})\s+(.+?):\s*(.+)')
        blocos = []
        for linha in linhas:
            m = padrao_simples.match(linha.strip())
            if m:
                hora, falante, fala = m.groups()
                blocos.append(f"[{hora}] {falante.strip()}: {fala.strip()}")
            elif linha.strip() and not re.match(r'^\d{2}:\d{2}:\d{2}\s*-->', linha):
                blocos.append(linha)
        return '\n'.join(blocos) if blocos else texto

    elif formato == 'otter':
        # Otter: "Nome Sobrenome  HH:MM\nTexto da fala"
        padrao_falante = re.compile(r'^(.+?)\s{2,}(\d{1,2}:\d{2})\s*$')
        blocos = []
        i = 0
        while i < len(linhas):
            m = padrao_falante.match(linhas[i].strip())
            if m and i + 1 < len(linhas):
                falante, hora = m.groups()
                fala_linhas = []
                i += 1
                while i < len(linhas) and not padrao_falante.match(linhas[i].strip()):
                    if linhas[i].strip():
                        fala_linhas.append(linhas[i].strip())
                    i += 1
                if fala_linhas:
                    blocos.append(f"[{hora}] {falante.strip()}: {' '.join(fala_linhas)}")
            else:
                if linhas[i].strip():
                    blocos.append(linhas[i])
                i += 1
        return '\n'.join(blocos) if blocos else texto

    elif formato == 'teams':
        # Teams: "Nome Sobrenome   HH:MM\nTexto" (similar ao Otter)
        padrao_falante = re.compile(r'^(.+?)\s{3,}(\d{1,2}:\d{2}(?::\d{2})?)\s*$')
        blocos = []
        i = 0
        while i < len(linhas):
            m = padrao_falante.match(linhas[i].strip())
            if m and i + 1 < len(linhas):
                falante, hora = m.groups()
                fala_linhas = []
                i += 1
                while i < len(linhas) and not padrao_falante.match(linhas[i].strip()):
                    if linhas[i].strip():
                        fala_linhas.append(linhas[i].strip())
                    i += 1
                if fala_linhas:
                    blocos.append(f"[{hora}] {falante.strip()}: {' '.join(fala_linhas)}")
            else:
                if linhas[i].strip():
                    blocos.append(linhas[i])
                i += 1
        return '\n'.join(blocos) if blocos else texto

    return texto


def _processar_formato_especial(texto: str, filename: str) -> tuple[str, str | None]:
    """Detecta e processa formato especial. Retorna (texto_processado, tipo_detectado)."""
    fmt = _detectar_formato_especial(texto, filename)
    if fmt in ('whatsapp_android', 'whatsapp_ios'):
        return _parsear_whatsapp(texto, fmt), fmt
    elif fmt in ('zoom', 'otter', 'teams'):
        return _parsear_reuniao(texto, fmt), fmt
    return texto, None


def _extrair_imagem(conteudo_bytes: bytes, filename: str) -> str:
    """Extrai texto de imagem: tenta Ollama multimodal, fallback Tesseract OCR."""
    import io, base64

    # ── Caminho 1: Ollama multimodal (llava / gemma3) ─────────────────────────
    try:
        import json as _json
        import urllib.request as _ur
        b64 = base64.b64encode(conteudo_bytes).decode()
        payload = _json.dumps({
            "model": "llava",
            "prompt": (
                "Descreva em detalhes o conteúdo desta imagem. "
                "Se houver texto visível, transcreva-o na íntegra. "
                "Responda em português."
            ),
            "images": [b64],
            "stream": False,
        }).encode()
        req = _ur.Request(
            "http://localhost:11434/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with _ur.urlopen(req, timeout=60) as resp:
            resultado = _json.loads(resp.read())
            texto = resultado.get("response", "").strip()
            if texto:
                return f"[Descrição gerada por Ollama multimodal]\n\n{texto}"
    except Exception:
        pass  # Ollama indisponível ou modelo não instalado → tenta Tesseract

    # ── Caminho 2: Tesseract OCR ──────────────────────────────────────────────
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(conteudo_bytes))
        texto = pytesseract.image_to_string(img, lang="por+eng")
        if texto.strip():
            return f"[Texto extraído por OCR (Tesseract)]\n\n{texto.strip()}"
    except ImportError:
        raise RuntimeError(
            "Nenhum extrator de imagem disponível. "
            "Instale pytesseract (pip install pytesseract) e o Tesseract binário, "
            "ou inicie o Ollama com um modelo multimodal (llava ou gemma3:12b)."
        )
    except Exception as e:
        raise RuntimeError(f"Erro no OCR: {e}")

    raise RuntimeError("Imagem sem conteúdo extraível (nenhum texto detectado).")


def _extrair_audio(conteudo_bytes: bytes, filename: str) -> str:
    """Transcreve áudio com faster-whisper (modelo 'base', CPU)."""
    import io, tempfile, os as _os

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError(
            "faster-whisper não instalado. "
            "Execute: .venv\\Scripts\\python.exe -m pip install faster-whisper"
        )

    ext = _os.path.splitext(filename)[1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(conteudo_bytes)
        tmp_path = tmp.name

    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, info = model.transcribe(tmp_path, language="pt", beam_size=5)
        texto = " ".join(seg.text.strip() for seg in segments).strip()
        idioma = info.language
    finally:
        _os.unlink(tmp_path)

    if not texto:
        raise RuntimeError("Áudio sem conteúdo transcrito.")

    return f"[Transcrição gerada por Whisper — idioma detectado: {idioma}]\n\n{texto}"


@router.post("/neural/upload")
async def cerebro_upload(
    arquivo: UploadFile = File(...),
    canal: str = Form(default="")
):
    """Recebe arquivo (PDF, DOCX, MD, TXT, imagem ou áudio) e converte para .txt no neural/{canal}/documentos/.

    [CONTRATO CRÍTICO] O projeto (canal_prefixo) DEVE existir antes de chamar este endpoint.
    Upload sem projeto registrado cria a pasta em disco mas o arquivo NÃO aparece no /repositorio
    porque o scan em get_repositorio() só lista pastas com CSV de gestão, docs ou textos via manifest.
    A UI deve bloquear o botão de upload até POST /neural/projeto retornar ok:true.
    Ver: Documentação do Produto/Mapa de Impacto de Dependências.md §5
    """
    import uuid as _uuid

    neural_dir = motor_tusab.NEURAL_DIR
    canal_prefixo = _get_canal_prefixo_ativo(canal)
    if not canal_prefixo:
        return {"error": True, "message": "Selecione um projeto antes de enviar arquivos."}
    doc_dir = os.path.join(neural_dir, canal_prefixo, "documents")
    os.makedirs(doc_dir, exist_ok=True)

    ext = os.path.splitext(arquivo.filename)[1].lower()
    fid = str(_uuid.uuid4())[:8]
    nome_limpo = re.sub(r'[^a-zA-Z0-9_\-]', '_', os.path.splitext(arquivo.filename)[0])[:40]

    eh_imagem = ext in _EXTS_IMAGEM
    eh_audio  = ext in _EXTS_AUDIO
    limite    = _MAX_IMAGEM if eh_imagem else (_MAX_AUDIO if eh_audio else _MAX_DOC)

    conteudo_bytes = await arquivo.read()
    if len(conteudo_bytes) > limite:
        return {"error": True, "message": f"Arquivo excede o limite de {limite // 1024 // 1024} MB"}

    texto = ""
    aviso_extracao = None  # mensagem opcional quando extração parcial/indisponível
    try:
        if ext == ".pdf":
            import pdfplumber, io as _io
            paginas = []
            with pdfplumber.open(_io.BytesIO(conteudo_bytes)) as pdf:
                for pagina in pdf.pages:
                    # extract_text_simple preserva espaçamento horizontal melhor que o padrão
                    txt = pagina.extract_text(x_tolerance=3, y_tolerance=3) or ""
                    # corrige quebras de linha no meio de palavras (hifenização automática de PDFs)
                    txt = re.sub(r'(?<=[a-záàâãéêíóôõúç])-\n(?=[a-záàâãéêíóôõúç])', '', txt, flags=re.IGNORECASE)
                    # colapsa espaços múltiplos em um
                    txt = re.sub(r'[ \t]{2,}', ' ', txt)
                    txt = txt.strip()
                    if txt:
                        paginas.append(txt)
            texto = "\n\n".join(paginas)
            if not texto.strip():
                # PDF escaneado sem camada de texto — registra com aviso em vez de rejeitar
                aviso_extracao = (
                    "⚠️ PDF sem camada de texto detectado (possivelmente escaneado). "
                    "O arquivo foi salvo no repositório, mas o texto não pôde ser extraído. "
                    "Para indexar o conteúdo, instale Ollama com modelo multimodal (llava ou gemma3) "
                    "e reindexe a base."
                )
                texto = (
                    f"[PDF registrado sem extração de texto — possível documento escaneado]\n"
                    f"Arquivo: {arquivo.filename}\n"
                    f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
                    f"Para extrair o conteúdo, instale Ollama com modelo multimodal (llava ou gemma3) "
                    f"e reindexe a base após a instalação."
                )
        elif ext in (".docx",):
            import docx, io
            doc = docx.Document(io.BytesIO(conteudo_bytes))
            texto = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif ext == ".xlsx":
            import openpyxl, io
            wb = openpyxl.load_workbook(io.BytesIO(conteudo_bytes), data_only=True)
            blocos = []
            for sheet in wb.worksheets:
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue
                blocos.append(f"[Planilha: {sheet.title}]")
                # Primeira linha como cabeçalho se tiver conteúdo
                headers = [str(c) if c is not None else "" for c in rows[0]]
                for row in rows[1:]:
                    cells = [str(c) if c is not None else "" for c in row]
                    if any(c.strip() for c in cells):
                        blocos.append(" | ".join(
                            f"{h}: {v}" for h, v in zip(headers, cells) if h or v
                        ))
            texto = "\n".join(blocos)
        elif ext == ".csv":
            import csv, io as _io
            texto_raw = conteudo_bytes.decode("utf-8-sig", errors="replace")
            reader = csv.reader(_io.StringIO(texto_raw))
            rows = list(reader)
            if rows:
                headers = rows[0]
                blocos = []
                for row in rows[1:]:
                    if any(c.strip() for c in row):
                        blocos.append(" | ".join(
                            f"{h}: {v}" for h, v in zip(headers, row) if h or v
                        ))
                texto = "\n".join(blocos)
            else:
                texto = texto_raw
        elif ext in (".txt", ".md"):
            texto_raw = conteudo_bytes.decode("utf-8", errors="replace")
            texto, fmt_especial = _processar_formato_especial(texto_raw, arquivo.filename)
            if fmt_especial:
                _LABEL = {
                    'whatsapp_android': 'WhatsApp (Android)',
                    'whatsapp_ios':     'WhatsApp (iOS)',
                    'zoom':             'Zoom',
                    'otter':            'Otter.ai',
                    'teams':            'Microsoft Teams',
                }
                aviso_extracao = f"✅ Formato detectado: {_LABEL.get(fmt_especial, fmt_especial)} — estrutura aplicada automaticamente."
        elif eh_imagem:
            try:
                texto = _extrair_imagem(conteudo_bytes, arquivo.filename)
            except RuntimeError as e:
                # Salva a imagem no repositório sem texto extraído.
                # O usuário pode reindexar após instalar Ollama/Tesseract.
                aviso_extracao = str(e)
                texto = (
                    f"[Imagem registrada sem extração de texto]\n"
                    f"Arquivo: {arquivo.filename}\n"
                    f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
                    f"Para extrair o conteúdo desta imagem, instale Ollama com modelo "
                    f"multimodal (llava ou gemma3) ou Tesseract OCR e reindexe a base."
                )
        elif eh_audio:
            texto = _extrair_audio(conteudo_bytes, arquivo.filename)
        else:
            return {"error": True, "message": f"Formato não suportado: {ext}"}
    except RuntimeError as e:
        return {"error": True, "message": str(e)}
    except Exception as e:
        return {"error": True, "message": f"Erro ao processar arquivo: {e}"}

    if not texto.strip():
        return {"error": True, "message": "Arquivo sem conteúdo extraível"}

    txt_path = os.path.join(doc_dir, f"{fid}_{nome_limpo}.txt")
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(f"TITULO: {arquivo.filename}\nFONTE: documento\nDATA: {datetime.now().strftime('%d/%m/%Y')}\n")
        if ext == ".pdf":
            qualidade = "escaneado_sem_ocr" if aviso_extracao and "sem camada" in aviso_extracao else "texto_nativo"
            f.write(f"QUALIDADE_PDF: {qualidade}\n")
        f.write("-" * 70 + "\n")
        f.write(texto)

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
    motor_tusab.salvar_json_atomico(manifest, manifest_path, indent=2)

    resp = {"ok": True, "id": fid, "nome": arquivo.filename, "chars": len(texto)}
    if aviso_extracao:
        resp["aviso"] = aviso_extracao
    return resp


@router.post("/neural/texto")
def cerebro_texto(req: TextoRequest):
    """Salva texto colado pelo usuário no neural/{canal}/textos/.

    [CONTRATO CRÍTICO] Mesma restrição de /neural/upload — projeto deve existir previamente.
    Ver: Documentação do Produto/Mapa de Impacto de Dependências.md §5
    """
    import uuid as _uuid

    neural_dir = motor_tusab.NEURAL_DIR
    canal_prefixo = _get_canal_prefixo_ativo(req.canal)
    if not canal_prefixo:
        return {"error": True, "message": "Selecione um projeto antes de salvar texto."}
    txt_dir2 = os.path.join(neural_dir, canal_prefixo, "texts")
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
    motor_tusab.salvar_json_atomico(manifest, manifest_path, indent=2)

    return {"ok": True, "id": fid, "titulo": req.titulo}


@router.delete("/neural/arquivo/{tipo}/{fid}")
def cerebro_delete(tipo: str, fid: str):
    """Remove arquivo do neural — busca em todos os subdirs de canal."""
    neural_dir = motor_tusab.NEURAL_DIR

    # Normaliza aliases legados para os nomes canônicos em inglês
    _alias = {"documentos": "documents", "textos": "texts"}
    tipo = _alias.get(tipo, tipo)
    if tipo not in ("documents", "texts"):
        return {"error": True, "message": "Tipo inválido"}

    candidate_dirs = []
    if os.path.exists(neural_dir):
        for entry in os.scandir(neural_dir):
            if entry.is_dir():
                candidate_dirs.append(os.path.join(entry.path, tipo))
    candidate_dirs.append(os.path.join(neural_dir, tipo))

    for subdir in candidate_dirs:
        manifest_path = os.path.join(subdir, "_manifest.json")
        if not os.path.exists(manifest_path):
            continue
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
        except Exception:
            continue

        entry = next((e for e in manifest if e["id"] == fid), None)
        if not entry:
            continue

        txt_path = os.path.join(subdir, entry["nome_txt"])
        real_path   = os.path.realpath(txt_path)
        real_subdir = os.path.realpath(subdir)
        if not real_path.startswith(real_subdir + os.sep):
            return {"error": True, "message": "Caminho inválido"}
        if os.path.exists(txt_path):
            os.remove(txt_path)

        manifest = [e for e in manifest if e["id"] != fid]
        motor_tusab.salvar_json_atomico(manifest, manifest_path, indent=2)
        return {"ok": True}

    return {"error": True, "message": "Arquivo não encontrado"}


@router.delete("/historico/limpar")
def historico_limpar(req: LimparHistoricoRequest):
    """Remove CSVs e summaries de canais selecionados (ou todos se prefixos vazio)."""
    pattern = os.path.join(motor_tusab.NEURAL_DIR, "*", "management", "*_base.csv")
    todos   = sorted(glob.glob(pattern))
    removidos = 0

    for csv_path in todos:
        prefixo = os.path.basename(csv_path).replace("_base.csv", "")
        if req.prefixos and prefixo not in req.prefixos:
            continue
        gestao_dir = motor_tusab.gestao_canal_dir(prefixo)
        for ext in ("_base.csv", "_summary.json"):
            p = os.path.join(gestao_dir, f"{prefixo}{ext}")
            if os.path.exists(p):
                try:
                    os.remove(p)
                    removidos += 1
                except Exception:
                    pass

    return {"ok": True, "removidos": removidos}


@router.delete("/neural/limpar")
def cerebro_limpar(req: LimparRequest):
    """Remove arquivos selecionados de pastas do neural.

    Se `canal` for informado, limpa apenas aquele projeto.
    Se omitido, limpa todos (comportamento legado — use com cuidado).
    """
    neural_dir = motor_tusab.NEURAL_DIR
    deletados  = {'youtube': 0, 'documentos': 0, 'textos': 0}

    def _limpar_dir(path: str) -> int:
        count = 0
        if not os.path.exists(path):
            return count
        for fname in os.listdir(path):
            fpath = os.path.join(path, fname)
            try:
                os.remove(fpath)
                count += 1
            except Exception:
                pass
        return count

    canal_paths = []
    if os.path.exists(neural_dir):
        if req.canal:
            # Limpa apenas o projeto especificado
            canal_safe = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal).strip('_')
            candidate = os.path.join(neural_dir, canal_safe)
            # Proteção contra path traversal
            if (canal_safe
                    and os.path.normpath(candidate).startswith(
                        os.path.normpath(neural_dir) + os.sep)
                    and os.path.isdir(candidate)):
                canal_paths.append(candidate)
        else:
            for entry in os.scandir(neural_dir):
                if entry.is_dir():
                    canal_paths.append(entry.path)

    excluir_pasta = req.canal and req.youtube and req.documentos and req.textos

    for canal_path in canal_paths:
        if req.youtube:
            # Nova estrutura: youtube/{canal_slug}/*.txt — apaga em cada subpasta de canal
            yt_base = os.path.join(canal_path, 'youtube')
            if os.path.exists(yt_base):
                for sub in os.scandir(yt_base):
                    if sub.is_dir():
                        deletados['youtube'] += _limpar_dir(sub.path)
                    elif sub.is_file() and sub.name.endswith('.txt') and not sub.name.startswith('_'):
                        try:
                            os.remove(sub.path)
                            deletados['youtube'] += 1
                        except Exception:
                            pass
        if req.documentos:
            deletados['documentos'] += _limpar_dir(os.path.join(canal_path, 'documents'))
        if req.textos:
            deletados['textos']     += _limpar_dir(os.path.join(canal_path, 'texts'))

        # Exclusão total do projeto: remove a pasta inteira quando todas as fontes são limpas
        if excluir_pasta:
            try:
                import shutil as _shutil
                _shutil.rmtree(canal_path, ignore_errors=True)
            except Exception:
                pass

    if req.youtube:
        deletados['youtube']    += _limpar_dir(motor_tusab.LOCAL_TXT_DIR)
    if req.documentos:
        deletados['documentos'] += _limpar_dir(os.path.join(neural_dir, 'documents'))
    if req.textos:
        deletados['textos']     += _limpar_dir(os.path.join(neural_dir, 'texts'))

    return {'ok': True, 'deletados': deletados}


@router.delete("/reset-total")
def reset_total():
    """Apaga todo o cérebro, histórico de gestão e índices BM25 — reset completo."""
    import shutil
    import agent_tusab

    neural_dir = motor_tusab.NEURAL_DIR
    gestao_dir = motor_tusab.GESTAO_DIR
    from tusab_engine.storage import INDEX_DIR
    index_dir  = INDEX_DIR

    removidos = {"cerebro": 0, "indices": 0}

    # 1. Neural + aliases legados — apaga conteúdo mas mantém pastas raiz
    for data_dir in [neural_dir, motor_tusab.CEREBRO_DIR, gestao_dir]:
        if not os.path.exists(data_dir):
            continue
        # Evita apagar duas vezes se CEREBRO_DIR == NEURAL_DIR
        for entry in os.scandir(data_dir):
            try:
                if entry.is_dir():
                    shutil.rmtree(entry.path)
                else:
                    os.remove(entry.path)
                removidos["cerebro"] += 1
            except Exception:
                pass

    # 2. Índices BM25
    if os.path.exists(index_dir):
        for fname in os.listdir(index_dir):
            fpath = os.path.join(index_dir, fname)
            try:
                os.remove(fpath)
                removidos["indices"] += 1
            except Exception:
                pass

    # 4. Invalida cache BM25 em memória e limpa config de canal indexado
    try:
        agent_tusab._bm25_cache.clear()
    except Exception:
        pass
    try:
        cfg = agent_tusab.carregar_config()
        cfg["canal_indexado"] = ""
        agent_tusab.salvar_config(cfg)
    except Exception:
        pass

    # 5. Limpa histórico de chat em memória
    with state.hist_lock:
        state.chat_histories.clear()

    # 6. Reseta estado de extração em memória
    with state.state_lock:
        state.logs = []
        state.stats["canal_nome"]          = ""
        state.stats["status"]              = "Ocioso"
        state.stats["progress"]            = 0
        state.stats["videos_processed"]    = 0
        state.stats["videos_total"]        = 0
        state.stats["videos_mapeados"]     = 0
        state.stats["videos_sem_legenda"]  = 0
        state.stats["videos_legenda_curta"]= 0
        state.stats["files_generated"]     = 0
        state.stats["idioma_detectado"]    = ""
    state.canal_url   = ""
    state.projeto_nome = ""
    with state.queue_lock:
        state.extraction_queue.clear()

    # 7. Reseta estado do agente RAG em memória
    state.perguntas_sugeridas = {}
    state.agent_index_logs    = []

    return {"ok": True, "removidos": removidos}


@router.post("/neural/buscar")
def cerebro_buscar(req: BuscarPayload):
    """Busca por texto nos arquivos .txt do neural, retornando até 20 resultados com trecho."""
    neural_dir = motor_tusab.NEURAL_DIR
    query = req.query.strip()

    if not query:
        return {"resultados": [], "total": 0, "query": query}

    query_lower = query.lower()
    resultados = []

    # Determina raiz de busca: todo o neural_dir, ou subdir do canal filtrado
    if req.canal:
        canal_safe = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal).strip('_')
        search_root = os.path.join(neural_dir, canal_safe)
    else:
        search_root = neural_dir

    if not os.path.exists(search_root):
        return {"resultados": [], "total": 0, "query": query}

    def _inferir_tipo(rel_path: str) -> str:
        parts = rel_path.replace("\\", "/").split("/")
        for part in parts:
            if part == "youtube":
                return "youtube"
            if part in ("documentos", "documents"):
                return "documento"
            if part in ("textos", "texts"):
                return "texto"
        return "youtube"

    def _inferir_canal(rel_path: str) -> str:
        parts = rel_path.replace("\\", "/").split("/")
        # Se há ao menos dois segmentos e o segundo é um subdir conhecido,
        # o primeiro segmento é o canal
        subdirs_conhecidos = {"youtube", "documentos", "textos", "documents", "texts", "management", "gestao"}
        if len(parts) >= 2 and parts[-2] in subdirs_conhecidos:
            return parts[0] if len(parts) >= 3 else ""
        if len(parts) >= 2:
            return parts[0]
        return ""

    def _montar_trecho(content: str, pos: int) -> str:
        start = max(0, pos - 80)
        end = min(len(content), pos + 120)
        trecho = content[start:end]
        trecho = trecho.replace("\n", " ").replace("\r", " ")
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(content) else ""
        return prefix + trecho + suffix

    # Percorre recursivamente todos os .txt exceto os que começam com '_'
    for dirpath, _dirnames, filenames in os.walk(search_root):
        for fname in sorted(filenames):
            if not fname.endswith(".txt"):
                continue
            if fname.startswith("_"):
                continue

            fpath = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(fpath, neural_dir)

            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                continue

            pos = content.lower().find(query_lower)
            if pos == -1:
                continue

            trecho = _montar_trecho(content, pos)
            canal_inferido = _inferir_canal(rel_path)
            tipo = _inferir_tipo(rel_path)

            resultados.append({
                "arquivo": fname,
                "caminho": rel_path.replace("\\", "/"),
                "trecho": trecho,
                "canal": canal_inferido,
                "tipo": tipo,
            })

            if len(resultados) >= 20:
                break

        if len(resultados) >= 20:
            break

    return {"resultados": resultados, "total": len(resultados), "query": query}


class LerArquivoPayload(BaseModel):
    caminho: str = Field(max_length=500)

class CriarProjetoPayload(BaseModel):
    nome: str = Field(max_length=120)


@router.get("/neural/projetos")
def cerebro_listar_projetos():
    """Lista todos os projetos (subdirs) no neural_dir, classificando por tipo.

    Exclui pastas internas que não representam projetos criados pelo usuário:
    - 'youtube': pasta legada de migração, não é um canal extraído válido.
    Um projeto válido deve ter pelo menos um arquivo em youtube/, documents/ ou texts/.
    """
    _PASTAS_INTERNAS = {"youtube"}
    neural_dir = motor_tusab.NEURAL_DIR
    projetos = []
    if not os.path.exists(neural_dir):
        return {"projetos": projetos}
    for entry in sorted(os.scandir(neural_dir), key=lambda e: e.name):
        if not entry.is_dir():
            continue
        if entry.name in _PASTAS_INTERNAS:
            continue
        # Tipo: youtube = tem subdir youtube/ com arquivos; projeto = criado manualmente
        yt_dir = os.path.join(entry.path, "youtube")
        # Nova estrutura: youtube/{canal_slug}/*.txt — verifica recursivamente
        yt_files = glob.glob(os.path.join(yt_dir, '**', '*.txt'), recursive=True) if os.path.isdir(yt_dir) else []
        has_youtube = bool(yt_files)
        tipo = "youtube" if has_youtube else "projeto"
        # Contar arquivos de conteúdo indexável (.txt em documents/ e texts/)
        doc_files = glob.glob(os.path.join(entry.path, 'documents', '*.txt'))
        txt_files = glob.glob(os.path.join(entry.path, 'texts', '*.txt'))
        n_docs = len([f for f in doc_files if not os.path.basename(f).startswith('_')])
        n_txts = len([f for f in txt_files if not os.path.basename(f).startswith('_')])
        n_youtube = len(yt_files)
        # Canais extraídos: subpastas de youtube/ (cada uma é um slug de canal)
        canais = []
        if os.path.isdir(yt_dir):
            canais = [e.name for e in os.scandir(yt_dir) if e.is_dir()]
        projetos.append({
            "nome": entry.name,
            "tipo": tipo,
            "n_arquivos": n_docs + n_txts + n_youtube,
            "canais": canais,
        })
    return {"projetos": projetos}


@router.post("/neural/projeto")
def cerebro_criar_projeto(req: CriarProjetoPayload):
    """Cria um novo subdiretório de projeto no neural_dir."""
    neural_dir = motor_tusab.NEURAL_DIR
    nome_raw = req.nome.strip()
    if not nome_raw:
        return {"error": True, "message": "Nome não pode ser vazio"}
    nome_safe = re.sub(r'[<>:"/\\|?*\s]', '_', nome_raw).strip('_')
    if not nome_safe:
        return {"error": True, "message": "Nome inválido"}
    projeto_dir = os.path.join(neural_dir, nome_safe)
    # Proteção contra path traversal
    if not os.path.normpath(projeto_dir).startswith(os.path.normpath(neural_dir) + os.sep):
        return {"error": True, "message": "Caminho inválido"}
    if os.path.exists(projeto_dir):
        return {"ok": True, "nome": nome_safe, "criado": False, "message": "Já existe"}
    os.makedirs(os.path.join(projeto_dir, "documents"), exist_ok=True)
    os.makedirs(os.path.join(projeto_dir, "texts"), exist_ok=True)
    return {"ok": True, "nome": nome_safe, "criado": True}


@router.post("/neural/ler-arquivo")
def cerebro_ler_arquivo(req: LerArquivoPayload):
    """Lê o conteúdo completo de um arquivo .txt do neural pelo caminho relativo."""
    neural_dir = motor_tusab.NEURAL_DIR
    # Sanitiza para evitar path traversal
    caminho_limpo = req.caminho.replace("\\", "/").lstrip("/")
    caminho_abs = os.path.normpath(os.path.join(neural_dir, caminho_limpo))
    # Garante que o arquivo está dentro do neural_dir
    if not caminho_abs.startswith(os.path.normpath(neural_dir)):
        return {"error": True, "message": "Acesso negado"}
    if not caminho_abs.endswith(".txt"):
        return {"error": True, "message": "Apenas arquivos .txt são suportados"}
    if not os.path.isfile(caminho_abs):
        return {"error": True, "message": "Arquivo não encontrado"}
    try:
        with open(caminho_abs, "r", encoding="utf-8", errors="replace") as f:
            conteudo = f.read()
        return {"ok": True, "conteudo": conteudo, "arquivo": os.path.basename(caminho_abs)}
    except Exception as e:
        return {"error": True, "message": str(e)}
