# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Endpoints de export — feature Pro.

  POST /export/base           → ZIP com cerebro/ + CSVs de gestão
  POST /export/historico      → Markdown do histórico de chat de um canal
  POST /export/resumo-canal   → DOCX com mensagens do assistente + fontes
  POST /export/tabela-videos  → XLSX com dados do CSV de gestão do canal
  POST /export/relatorio-pdf  → PDF com pares de Q&A do histórico
"""

import os
import io
import zipfile
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

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
    canal_nome: str = Field(default="", max_length=120)


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


# ── Export de resumo do canal (DOCX) ─────────────────────────────────────────

class ExportResumoCanalRequest(BaseModel):
    canal_nome: str = Field(default="", max_length=120)


@router.post("/export/resumo-canal")
def export_resumo_canal(req: ExportResumoCanalRequest):
    """Exporta as respostas do assistente para um canal como documento Word (.docx)."""
    try:
        from docx import Document
        from docx.shared import Pt
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: python-docx. Execute: pip install python-docx"
        })

    canal = req.canal_nome or state.stats.get("canal_nome", "") or "chat"

    with state.hist_lock:
        hist = list(state.chat_histories.get(canal, []))

    if not hist:
        return JSONResponse({"error": True, "message": "Sem histórico para exportar"})

    doc = Document()

    # Título e cabeçalho
    doc.add_heading(f"Resumo — @{canal}", level=0)
    subtitulo = doc.add_paragraph("Gerado pelo Tusab")
    subtitulo.runs[0].italic = True
    doc.add_paragraph(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    doc.add_paragraph("")

    for msg in hist:
        if msg.get("role") != "assistant":
            continue

        content = msg.get("content", "").strip()
        if not content:
            continue

        heading = doc.add_paragraph("Tusab:", style="Heading 2")

        doc.add_paragraph(content)

        fontes = msg.get("fontes", [])
        if fontes:
            doc.add_paragraph("Fontes:", style="Heading 3")
            for fonte in fontes:
                titulo = fonte.get("titulo") or fonte.get("arquivo", "")
                link = fonte.get("link", "")
                bullet = doc.add_paragraph(style="List Bullet")
                run = bullet.add_run(f"{titulo}" + (f" — {link}" if link else ""))
                run.font.size = Pt(10)

        doc.add_paragraph("")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    ts = datetime.now().strftime('%Y%m%d_%H%M')
    filename = f"tusab_resumo_{canal}_{ts}.docx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Export de tabela de vídeos (XLSX) ────────────────────────────────────────

class ExportTabelaVideosRequest(BaseModel):
    canal: str = Field(default="", max_length=120)


@router.post("/export/tabela-videos")
def export_tabela_videos(req: ExportTabelaVideosRequest):
    """Exporta o CSV de gestão de um canal como planilha Excel (.xlsx)."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: openpyxl. Execute: pip install openpyxl"
        })

    canal = req.canal or state.stats.get("canal_nome", "") or ""
    if not canal:
        return JSONResponse({"error": True, "message": "Nome do canal não informado."})

    csv_path = os.path.join(GESTAO_DIR, f"{canal}_base.csv")
    if not os.path.exists(csv_path):
        return JSONResponse({"error": True, "message": f"CSV não encontrado para o canal '{canal}'."})

    import csv

    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        rows = list(reader)

    if not rows:
        return JSONResponse({"error": True, "message": "CSV vazio."})

    wb = Workbook()
    ws = wb.active
    ws.title = f"@{canal}"[:31]  # openpyxl limita nome de aba a 31 caracteres

    header = rows[0] if rows else []
    bold_font = Font(bold=True)

    for col_idx, cell_value in enumerate(header, start=1):
        cell = ws.cell(row=1, column=col_idx, value=cell_value)
        cell.font = bold_font

    for row_idx, row in enumerate(rows[1:], start=2):
        for col_idx, cell_value in enumerate(row, start=1):
            ws.cell(row=row_idx, column=col_idx, value=cell_value)

    # Congelar linha do cabeçalho
    ws.freeze_panes = "A2"

    # Largura automática aproximada
    for col_idx, col_header in enumerate(header, start=1):
        col_letter = ws.cell(row=1, column=col_idx).column_letter
        approx_width = min(len(str(col_header)) * 1.2 + 2, 50)
        ws.column_dimensions[col_letter].width = approx_width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    ts = datetime.now().strftime('%Y%m%d_%H%M')
    filename = f"tusab_videos_{canal}_{ts}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Export de relatório de pesquisa (PDF) ─────────────────────────────────────

class ExportRelatorioPdfRequest(BaseModel):
    canal_nome: str = Field(default="", max_length=120)


@router.post("/export/relatorio-pdf")
def export_relatorio_pdf(req: ExportRelatorioPdfRequest):
    """Exporta os pares de Q&A do histórico de um canal como PDF (.pdf)."""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.units import mm
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: reportlab. Execute: pip install reportlab"
        })

    canal = req.canal_nome or state.stats.get("canal_nome", "") or "chat"

    with state.hist_lock:
        hist = list(state.chat_histories.get(canal, []))

    if not hist:
        return JSONResponse({"error": True, "message": "Sem histórico para exportar"})

    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    # Título e cabeçalho
    story.append(Paragraph(f"Relatório de Pesquisa — @{canal}", styles["Title"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Gerado pelo Tusab", styles["Italic"]))
    story.append(Paragraph(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    # Pares Q&A
    pending_question = None
    for msg in hist:
        role = msg.get("role", "")
        content = msg.get("content", "").strip()

        if role == "user":
            pending_question = content

        elif role == "assistant":
            if pending_question:
                story.append(Paragraph(f"<b>Pergunta:</b> {pending_question}", styles["Normal"]))
                story.append(Spacer(1, 2 * mm))
                pending_question = None

            story.append(Paragraph(f"<b>Tusab:</b> {content}", styles["Normal"]))

            fontes = msg.get("fontes", [])
            if fontes:
                story.append(Spacer(1, 2 * mm))
                for fonte in fontes:
                    titulo = fonte.get("titulo") or fonte.get("arquivo", "")
                    link = fonte.get("link", "")
                    texto_fonte = f"&nbsp;&nbsp;• {titulo}" + (f" — {link}" if link else "")
                    story.append(Paragraph(f'<font size="9">{texto_fonte}</font>', styles["Normal"]))

            story.append(Spacer(1, 6 * mm))

    doc.build(story)
    buf.seek(0)

    ts = datetime.now().strftime('%Y%m%d_%H%M')
    filename = f"tusab_relatorio_{canal}_{ts}.pdf"

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
