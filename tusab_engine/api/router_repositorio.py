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
from pydantic import BaseModel

import motor_tusab
from tusab_engine.state import state

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_canal_prefixo_ativo(canal_form: str = "") -> str:
    """Retorna o prefixo de canal ativo (form > state > '_avulso')."""
    raw = canal_form or state.stats.get("canal_nome", "") or ""
    if not raw:
        return "_avulso"
    return re.sub(r'[<>:"/\\|?*\s]', '_', raw).strip('_') or "_avulso"


# ── Models ────────────────────────────────────────────────────────────────────

class TextoRequest(BaseModel):
    titulo: str
    conteudo: str
    canal: str = ""

class LimparRequest(BaseModel):
    youtube:    bool = False
    documentos: bool = False
    textos:     bool = False

class LimparHistoricoRequest(BaseModel):
    prefixos: list = []

class BuscarPayload(BaseModel):
    query: str
    canal: str = ''


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/repositorio")
def get_repositorio():
    """Lista arquivos do cerebro agrupados por canal + listas planas para compatibilidade."""
    cerebro_dir = motor_tusab.CEREBRO_DIR
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
        for fname in sorted(os.listdir(yt_dir)):
            if fname.endswith('.txt') and not fname.startswith('_'):
                fpath = os.path.join(yt_dir, fname)
                stat = os.stat(fpath)
                arquivos.append({
                    "nome": fname, "canal": canal_nome,
                    "tamanho": stat.st_size,
                    "data": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y"),
                })
        return arquivos

    seen_yt = set()

    if os.path.exists(cerebro_dir):
        for entry in sorted(os.scandir(cerebro_dir), key=lambda e: e.name):
            if not entry.is_dir():
                continue
            canal_nome = entry.name
            canal_yt_dir  = os.path.join(entry.path, 'youtube')
            canal_doc_dir = os.path.join(entry.path, 'documentos')
            canal_txt_dir = os.path.join(entry.path, 'textos')

            yt_files  = _list_youtube(canal_yt_dir, canal_nome)
            docs      = _read_manifest(os.path.join(canal_doc_dir, '_manifest.json'))
            textos    = _read_manifest(os.path.join(canal_txt_dir, '_manifest.json'))

            for item in docs:   item['canal'] = canal_nome
            for item in textos: item['canal'] = canal_nome

            if yt_files or docs or textos:
                result["canais"].append({
                    "nome": canal_nome, "youtube": yt_files,
                    "documentos": docs, "textos": textos,
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

    result["documentos"] += _read_manifest(os.path.join(cerebro_dir, "documentos", "_manifest.json"))
    result["textos"]     += _read_manifest(os.path.join(cerebro_dir, "textos",     "_manifest.json"))

    return result


@router.get("/relatorio/{canal}")
def get_relatorio(canal: str):
    """Retorna dados do CSV de gestão para o canal especificado."""
    import re as _re
    canal_safe = _re.sub(r'[<>:"/\\|?*\s]', '_', canal).strip('_')
    csv_path = os.path.join(motor_tusab.GESTAO_DIR, f"{canal_safe}_base.csv")
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


@router.post("/cerebro/upload")
async def cerebro_upload(
    arquivo: UploadFile = File(...),
    canal: str = Form(default="")
):
    """Recebe arquivo (PDF, DOCX, MD, TXT, imagem ou áudio) e converte para .txt no cerebro/{canal}/documentos/."""
    import uuid as _uuid

    cerebro_dir = motor_tusab.CEREBRO_DIR
    canal_prefixo = _get_canal_prefixo_ativo(canal)
    doc_dir = os.path.join(cerebro_dir, canal_prefixo, "documentos")
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
            import pdfplumber, io
            with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
                texto = "\n".join(p.extract_text() or "" for p in pdf.pages)
        elif ext in (".docx",):
            import docx, io
            doc = docx.Document(io.BytesIO(conteudo_bytes))
            texto = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif ext in (".txt", ".md"):
            texto = conteudo_bytes.decode("utf-8", errors="replace")
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


@router.post("/cerebro/texto")
def cerebro_texto(req: TextoRequest):
    """Salva texto colado pelo usuário no cerebro/{canal}/textos/."""
    import uuid as _uuid

    cerebro_dir = motor_tusab.CEREBRO_DIR
    canal_prefixo = _get_canal_prefixo_ativo(req.canal)
    txt_dir2 = os.path.join(cerebro_dir, canal_prefixo, "textos")
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


@router.delete("/cerebro/arquivo/{tipo}/{fid}")
def cerebro_delete(tipo: str, fid: str):
    """Remove arquivo do cerebro — busca em todos os subdirs de canal."""
    cerebro_dir = motor_tusab.CEREBRO_DIR

    if tipo not in ("documentos", "textos"):
        return {"error": True, "message": "Tipo inválido"}

    candidate_dirs = []
    if os.path.exists(cerebro_dir):
        for entry in os.scandir(cerebro_dir):
            if entry.is_dir():
                candidate_dirs.append(os.path.join(entry.path, tipo))
    candidate_dirs.append(os.path.join(cerebro_dir, tipo))

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
    gestao_dir = motor_tusab.GESTAO_DIR
    pattern    = os.path.join(gestao_dir, "*_base.csv")
    todos      = sorted(glob.glob(pattern))
    removidos  = 0

    for csv_path in todos:
        prefixo = os.path.basename(csv_path).replace("_base.csv", "")
        if req.prefixos and prefixo not in req.prefixos:
            continue
        for ext in ("_base.csv", "_summary.json"):
            p = os.path.join(gestao_dir, f"{prefixo}{ext}")
            if os.path.exists(p):
                try:
                    os.remove(p)
                    removidos += 1
                except Exception:
                    pass

    return {"ok": True, "removidos": removidos}


@router.delete("/cerebro/limpar")
def cerebro_limpar(req: LimparRequest):
    """Remove arquivos selecionados de todas as pastas do cerebro."""
    cerebro_dir = motor_tusab.CEREBRO_DIR
    deletados   = {'youtube': 0, 'documentos': 0, 'textos': 0}

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
    if os.path.exists(cerebro_dir):
        for entry in os.scandir(cerebro_dir):
            if entry.is_dir():
                canal_paths.append(entry.path)

    for canal_path in canal_paths:
        if req.youtube:
            deletados['youtube']    += _limpar_dir(os.path.join(canal_path, 'youtube'))
        if req.documentos:
            deletados['documentos'] += _limpar_dir(os.path.join(canal_path, 'documentos'))
        if req.textos:
            deletados['textos']     += _limpar_dir(os.path.join(canal_path, 'textos'))

    if req.youtube:
        deletados['youtube']    += _limpar_dir(motor_tusab.LOCAL_TXT_DIR)
    if req.documentos:
        deletados['documentos'] += _limpar_dir(os.path.join(cerebro_dir, 'documentos'))
    if req.textos:
        deletados['textos']     += _limpar_dir(os.path.join(cerebro_dir, 'textos'))

    return {'ok': True, 'deletados': deletados}


@router.post("/cerebro/buscar")
def cerebro_buscar(req: BuscarPayload):
    """Busca por texto nos arquivos .txt do cerebro, retornando até 20 resultados com trecho."""
    cerebro_dir = motor_tusab.CEREBRO_DIR
    query = req.query.strip()

    if not query:
        return {"resultados": [], "total": 0, "query": query}

    query_lower = query.lower()
    resultados = []

    # Determina raiz de busca: todo o cerebro_dir, ou subdir do canal filtrado
    if req.canal:
        canal_safe = re.sub(r'[<>:"/\\|?*\s]', '_', req.canal).strip('_')
        search_root = os.path.join(cerebro_dir, canal_safe)
    else:
        search_root = cerebro_dir

    if not os.path.exists(search_root):
        return {"resultados": [], "total": 0, "query": query}

    def _inferir_tipo(rel_path: str) -> str:
        parts = rel_path.replace("\\", "/").split("/")
        for part in parts:
            if part == "youtube":
                return "youtube"
            if part == "documentos":
                return "documento"
            if part == "textos":
                return "texto"
        return "youtube"

    def _inferir_canal(rel_path: str) -> str:
        parts = rel_path.replace("\\", "/").split("/")
        # Se há ao menos dois segmentos e o segundo é um subdir conhecido,
        # o primeiro segmento é o canal
        subdirs_conhecidos = {"youtube", "documentos", "textos"}
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
            rel_path = os.path.relpath(fpath, cerebro_dir)

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
