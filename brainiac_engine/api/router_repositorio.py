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

import motor_brainiac
from brainiac_engine.state import state

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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/repositorio")
def get_repositorio():
    """Lista arquivos do cerebro agrupados por canal + listas planas para compatibilidade."""
    cerebro_dir = motor_brainiac.CEREBRO_DIR
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
    legacy_yt = motor_brainiac.LOCAL_TXT_DIR
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
    csv_path = os.path.join(motor_brainiac.GESTAO_DIR, f"{canal_safe}_base.csv")
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


@router.post("/cerebro/upload")
async def cerebro_upload(
    arquivo: UploadFile = File(...),
    canal: str = Form(default="")
):
    """Recebe arquivo (PDF, DOCX, MD, TXT) e converte para .txt no cerebro/{canal}/documentos/."""
    import uuid as _uuid

    cerebro_dir = motor_brainiac.CEREBRO_DIR
    canal_prefixo = _get_canal_prefixo_ativo(canal)
    doc_dir = os.path.join(cerebro_dir, canal_prefixo, "documentos")
    os.makedirs(doc_dir, exist_ok=True)

    ext = os.path.splitext(arquivo.filename)[1].lower()
    fid = str(_uuid.uuid4())[:8]
    nome_limpo = re.sub(r'[^a-zA-Z0-9_\-]', '_', os.path.splitext(arquivo.filename)[0])[:40]

    MAX_FILE_SIZE = 50 * 1024 * 1024
    conteudo_bytes = await arquivo.read()
    if len(conteudo_bytes) > MAX_FILE_SIZE:
        return {"error": True, "message": "Arquivo excede o limite de 50 MB"}
    texto = ""

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
        else:
            return {"error": True, "message": f"Formato não suportado: {ext}"}
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
    motor_brainiac.salvar_json_atomico(manifest, manifest_path, indent=2)

    return {"ok": True, "id": fid, "nome": arquivo.filename, "chars": len(texto)}


@router.post("/cerebro/texto")
def cerebro_texto(req: TextoRequest):
    """Salva texto colado pelo usuário no cerebro/{canal}/textos/."""
    import uuid as _uuid

    cerebro_dir = motor_brainiac.CEREBRO_DIR
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
    motor_brainiac.salvar_json_atomico(manifest, manifest_path, indent=2)

    return {"ok": True, "id": fid, "titulo": req.titulo}


@router.delete("/cerebro/arquivo/{tipo}/{fid}")
def cerebro_delete(tipo: str, fid: str):
    """Remove arquivo do cerebro — busca em todos os subdirs de canal."""
    cerebro_dir = motor_brainiac.CEREBRO_DIR

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
        motor_brainiac.salvar_json_atomico(manifest, manifest_path, indent=2)
        return {"ok": True}

    return {"error": True, "message": "Arquivo não encontrado"}


@router.delete("/historico/limpar")
def historico_limpar(req: LimparHistoricoRequest):
    """Remove CSVs e summaries de canais selecionados (ou todos se prefixos vazio)."""
    gestao_dir = motor_brainiac.GESTAO_DIR
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
    cerebro_dir = motor_brainiac.CEREBRO_DIR
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
        deletados['youtube']    += _limpar_dir(motor_brainiac.LOCAL_TXT_DIR)
    if req.documentos:
        deletados['documentos'] += _limpar_dir(os.path.join(cerebro_dir, 'documentos'))
    if req.textos:
        deletados['textos']     += _limpar_dir(os.path.join(cerebro_dir, 'textos'))

    return {'ok': True, 'deletados': deletados}
