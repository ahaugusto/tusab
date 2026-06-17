# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Endpoints de export — feature Pro.

  POST /export/base          → ZIP com cerebro/ + CSVs de gestão
  GET  /export/historico     → Markdown do histórico de chat de um canal
"""

import os
import io
import zipfile
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import motor_tusab
from tusab_engine.state import state
from tusab_engine.storage import CEREBRO_DIR, GESTAO_DIR

router = APIRouter()


# ── Export da base (ZIP) ──────────────────────────────────────────────────────

@router.post("/export/base")
def export_base():
    """Gera ZIP com cerebro/ + CSVs de gestão e serve como download."""
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # cerebro/
        if os.path.exists(CEREBRO_DIR):
            for root, _, files in os.walk(CEREBRO_DIR):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.relpath(fpath, os.path.dirname(CEREBRO_DIR))
                    zf.write(fpath, arcname)

        # gestao/ (CSVs de extração)
        if os.path.exists(GESTAO_DIR):
            for root, _, files in os.walk(GESTAO_DIR):
                for fname in files:
                    if fname.endswith('.csv') or fname.endswith('.json'):
                        fpath = os.path.join(root, fname)
                        arcname = os.path.relpath(fpath, os.path.dirname(GESTAO_DIR))
                        zf.write(fpath, arcname)

    buf.seek(0)
    ts = datetime.now().strftime('%Y%m%d_%H%M')
    filename = f"tusab_base_{ts}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Export do histórico de chat ───────────────────────────────────────────────

class ExportHistoricoRequest(BaseModel):
    canal_nome: str = ""


@router.post("/export/historico")
def export_historico(req: ExportHistoricoRequest):
    """Exporta o histórico de chat de um canal como Markdown."""
    canal = req.canal_nome or state.stats.get("canal_nome", "") or "chat"

    with state.hist_lock:
        hist = list(state.chat_histories.get(canal, []))

    if not hist:
        return JSONResponse({"error": True, "message": "Nenhum histórico encontrado para este canal."})

    linhas = [f"# Histórico de Chat — @{canal}", f"_Exportado em {datetime.now().strftime('%d/%m/%Y %H:%M')}_\n"]
    for msg in hist:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            linhas.append(f"**Você:** {content}\n")
        elif role == "assistant":
            linhas.append(f"**Tusab:** {content}\n")
            fontes = msg.get("fontes", [])
            if fontes:
                linhas.append("_Fontes:_")
                for f in fontes:
                    titulo = f.get("titulo") or f.get("arquivo", "")
                    link = f.get("link", "")
                    if link:
                        linhas.append(f"- [{titulo}]({link})")
                    else:
                        linhas.append(f"- {titulo}")
                linhas.append("")

    md = "\n".join(linhas)
    buf = io.BytesIO(md.encode("utf-8"))
    ts = datetime.now().strftime('%Y%m%d_%H%M')
    filename = f"tusab_historico_{canal}_{ts}.md"

    return StreamingResponse(
        buf,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
