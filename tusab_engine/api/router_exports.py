# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Endpoints de export — feature Pro.

  POST /export/base           → ZIP com cerebro/ + CSVs de gestão
  POST /export/historico      → Markdown do histórico de chat de um projeto
  POST /export/resumo-canal   → DOCX com mensagens do assistente + fontes
  POST /export/tabela-videos  → XLSX com dados do CSV de gestão do projeto
  POST /export/relatorio-pdf  → PDF com pares de Q&A do histórico
  POST /export/tabela-xlsx    → XLSX com as tabelas de uma resposta do chat (uma aba por tabela)
"""

import os
import io
import re as _re
import json
import zipfile
import shutil
import tempfile
from datetime import datetime, date as _date
from typing import Annotated

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, model_validator

import motor_tusab
from tusab_engine.state import state
from tusab_engine.storage import NEURAL_DIR, GESTAO_DIR, DATA_DIR, INDEX_DIR, gestao_canal_dir, salvar_json_atomico

router = APIRouter()


# ── Export da base (ZIP) ──────────────────────────────────────────────────────

@router.post("/export/base")
def export_base():
    """Gera ZIP com cerebro/ + CSVs de gestão e serve como download."""
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # cerebro/
        if os.path.exists(NEURAL_DIR):
            for root, _, files in os.walk(NEURAL_DIR):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.relpath(fpath, os.path.dirname(NEURAL_DIR))
                    zf.write(fpath, arcname)

        # gestao/ já está dentro de cerebro/{prefixo}/gestao/ — incluído no walk acima

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
    projeto_nome: str = Field(default="", max_length=120)

    # campo legado — normalizado via model_validator:
    canal_nome: str = Field(default="", max_length=120)

    @model_validator(mode='after')
    def _normalizar(self):
        if not self.projeto_nome and self.canal_nome:
            self.projeto_nome = self.canal_nome
        return self


@router.post("/export/historico")
def export_historico(req: ExportHistoricoRequest):
    """Exporta o histórico de chat de um projeto como Markdown."""
    canal = req.projeto_nome or state.stats.get("projeto_nome", "") or "chat"

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
    projeto_nome: str = Field(default="", max_length=120)
    mensagens:  list = Field(default_factory=list)  # histórico do frontend (fallback ao state)

    # campo legado — normalizado via model_validator:
    canal_nome: str = Field(default="", max_length=120)

    @model_validator(mode='after')
    def _normalizar(self):
        if not self.projeto_nome and self.canal_nome:
            self.projeto_nome = self.canal_nome
        return self


@router.post("/export/resumo-canal")
def export_resumo_canal(req: ExportResumoCanalRequest):
    """Exporta as respostas do assistente para um projeto como documento Word (.docx)."""
    try:
        from docx import Document
        from docx.shared import Pt
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: python-docx. Execute: pip install python-docx"
        })

    canal = req.projeto_nome or state.stats.get("projeto_nome", "") or "chat"

    # Prioriza mensagens enviadas pelo frontend; fallback ao histórico server-side
    if req.mensagens:
        hist = req.mensagens
    else:
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
    projeto_nome: str = Field(default="", max_length=120)

    # campo legado — normalizado via model_validator:
    canal: str = Field(default="", max_length=120)

    @model_validator(mode='after')
    def _normalizar(self):
        if not self.projeto_nome and self.canal:
            self.projeto_nome = self.canal
        return self


@router.post("/export/tabela-videos")
def export_tabela_videos(req: ExportTabelaVideosRequest):
    """Exporta o CSV de gestão de um projeto como planilha Excel (.xlsx)."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: openpyxl. Execute: pip install openpyxl"
        })

    canal = req.projeto_nome or state.stats.get("projeto_nome", "") or ""
    if not canal:
        return JSONResponse({"error": True, "message": "Nome do projeto não informado."})

    csv_path = os.path.join(gestao_canal_dir(canal), f"{canal}_base.csv")
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


# ── Export de tabela(s) de uma resposta do chat (XLSX) ──────────────────────
#
# O frontend lê as tabelas Markdown já renderizadas numa resposta do
# assistente (texto das células, como o usuário vê) e manda aqui; o backend
# tipa cada coluna (número/data/texto) e monta uma planilha organizada.
# Feito no backend (openpyxl já é dependência) e não no front: gerar .xlsx no
# navegador exigiria uma lib npm pesada (SheetJS/ExcelJS) só pra isso, e a
# conversão de números pt-BR/en fica testável em pytest.
# Sem gating: os demais /export/* também não têm (o "Pro" do docstring do
# módulo é rótulo, não verificação) — mesmo contrato.

_TABELA_MAX_TABELAS = 10
_TABELA_MAX_COLUNAS = 30
_TABELA_MAX_LINHAS = 2000
_TABELA_MAX_CELULA = 2000
_TABELA_MAX_CELULAS_TOTAL = 20000

_Celula = Annotated[str, Field(max_length=_TABELA_MAX_CELULA)]


class TabelaPlanilha(BaseModel):
    nome: str = Field(default="", max_length=60)
    cabecalho: list[_Celula] = Field(..., min_length=1, max_length=_TABELA_MAX_COLUNAS)
    linhas: list[Annotated[list[_Celula], Field(max_length=_TABELA_MAX_COLUNAS)]] = Field(
        default_factory=list, max_length=_TABELA_MAX_LINHAS)


class ExportTabelaXlsxRequest(BaseModel):
    titulo: str = Field(default="", max_length=200)
    idioma: str = Field(default="pt", max_length=8)
    tabelas: list[TabelaPlanilha] = Field(..., min_length=1, max_length=_TABELA_MAX_TABELAS)

    @model_validator(mode='after')
    def _limitar_total(self):
        total = sum(len(t.cabecalho) * (len(t.linhas) + 1) for t in self.tabelas)
        if total > _TABELA_MAX_CELULAS_TOTAL:
            raise ValueError(f"Tabelas grandes demais ({total} células; máximo {_TABELA_MAX_CELULAS_TOTAL}).")
        return self


_PLACEHOLDERS_CELULA = {'', '-', '—', '–', 'n/d', 'n/a', 'nd', 'na', 's/d', '?'}
_RE_MOEDA = _re.compile(r'^(R\$|US\$|U\$|\$|€|£|¥)\s*', _re.IGNORECASE)
_RE_NUM_LIMPO = _re.compile(r'^\d[\d.,]*$')


def _decompor_numero(texto: str):
    """'R$ -1.234,56' → dict(sinal, moeda, pct, corpo='1.234,56') ou None."""
    s = (texto or '').strip().replace(' ', ' ').replace('**', '')
    if not s:
        return None
    negativo = False
    if s.startswith('(') and s.endswith(')'):
        negativo, s = True, s[1:-1].strip()
    if s[:1] in '-−':
        negativo, s = True, s[1:].strip()
    elif s[:1] == '+':
        s = s[1:].strip()
    moeda = ''
    m = _RE_MOEDA.match(s)
    if m:
        moeda, s = m.group(1), s[m.end():]
        if s[:1] in '-−':
            negativo, s = True, s[1:].strip()
    pct = False
    if s.endswith('%'):
        pct, s = True, s[:-1].strip()
    # espaço como separador de milhar ("1 234 567"), só em grupos de 3
    if _re.fullmatch(r'\d{1,3}( \d{3})+([.,]\d+)?', s):
        s = s.replace(' ', '')
    if not _RE_NUM_LIMPO.match(s):
        return None
    return {'negativo': negativo, 'moeda': moeda, 'pct': pct, 'corpo': s}


def _evidencia_decimal(corpo: str):
    """',' / '.' quando o formato do número revela o separador decimal; None se ambíguo."""
    tem_v, tem_p = ',' in corpo, '.' in corpo
    if tem_v and tem_p:
        return ',' if corpo.rfind(',') > corpo.rfind('.') else '.'
    for sep in (',', '.'):
        if sep in corpo:
            partes = corpo.split(sep)
            if len(partes) > 2:          # "1.234.567" → sep é milhar → o outro é decimal
                return ',' if sep == '.' else '.'
            int_, frac = partes
            if len(frac) != 3 or int_ == '0' or len(int_) > 3:
                return sep               # "12,5", "0.125", "1234.567" → sep é decimal
            return None                  # "1.234" / "1,234" — ambíguo
    return None


def _converter_numero(corpo: str, decimal: str):
    """Converte o corpo ('1.234,56') dado o separador decimal; None se inválido."""
    milhar = '.' if decimal == ',' else ','
    if corpo.count(decimal) > 1:
        return None
    int_, _, frac = corpo.partition(decimal)
    if milhar in int_:
        grupos = int_.split(milhar)
        if not (1 <= len(grupos[0]) <= 3 and all(len(g) == 3 for g in grupos[1:])):
            return None
        int_ = ''.join(grupos)
    if not int_.isdigit() or (frac and not frac.isdigit()):
        return None
    # Zero à esquerda ("007", "0123") e dígitos demais (CNPJ, nº de processo)
    # são identificadores — virar número apagaria zeros / perderia precisão.
    if (len(int_) > 1 and int_.startswith('0')) or len(int_) > 15:
        return None
    if frac:
        return float(f"{int_}.{frac}"), len(frac)
    return int(int_), 0


_RE_DATA_ISO = _re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')
_RE_DATA_BARRA = _re.compile(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$')


def _converter_coluna_datas(valores: list, idioma: str):
    """Lista de date (ou None p/ vazio) se a coluna inteira é de datas inequívocas; senão None."""
    partes = []
    for v in valores:
        if v is None:
            partes.append(None)
            continue
        m = _RE_DATA_ISO.match(v)
        if m:
            partes.append(('iso', int(m.group(1)), int(m.group(2)), int(m.group(3))))
            continue
        m = _RE_DATA_BARRA.match(v)
        if not m:
            return None
        partes.append(('br', int(m.group(1)), int(m.group(2)), int(m.group(3))))
    if not any(p for p in partes):
        return None
    barras = [p for p in partes if p and p[0] == 'br']
    ordem = 'dmy'
    if barras:
        dmy_obrig = any(p[1] > 12 for p in barras)
        mdy_obrig = any(p[2] > 12 for p in barras)
        if dmy_obrig and mdy_obrig:
            return None
        if mdy_obrig:
            ordem = 'mdy'
        elif not dmy_obrig and idioma.startswith('en'):
            return None  # "03/04/2024" em inglês é ambíguo de verdade — fica texto
    saida = []
    for p in partes:
        if p is None:
            saida.append(None)
            continue
        try:
            if p[0] == 'iso':
                saida.append(_date(p[1], p[2], p[3]))
            elif ordem == 'dmy':
                saida.append(_date(p[3], p[2], p[1]))
            else:
                saida.append(_date(p[3], p[1], p[2]))
        except ValueError:
            return None
    return saida, ('yyyy-mm-dd' if all(p is None or p[0] == 'iso' for p in partes)
                   else ('mm/dd/yyyy' if ordem == 'mdy' else 'dd/mm/yyyy'))


def _tipar_coluna(valores: list, idioma: str):
    """Recebe as strings de uma coluna (sem o cabeçalho) e devolve
    [(valor, number_format|None)] — números como int/float, datas como date,
    o resto como texto. A coluna é tipada como um todo: basta uma célula não
    numérica (fora placeholders tipo "-"/"n/d") pra ela ficar texto — evita
    coluna meio número meio texto e "001" virando 1."""
    limpos = [v.strip() if (v or '').strip() else None for v in valores]
    eh_vazio = lambda v: v is None or v.lower() in _PLACEHOLDERS_CELULA
    nao_vazios = [v for v in limpos if not eh_vazio(v)]
    texto = [(v, None) for v in limpos]
    if not nao_vazios:
        return texto

    datas = _converter_coluna_datas([None if eh_vazio(v) else v for v in limpos], idioma)
    if datas is not None:
        convertidas, fmt = datas
        return [(d, fmt) if d is not None else (v, None) for d, v in zip(convertidas, limpos)]

    decomp = [_decompor_numero(v) for v in nao_vazios]
    if any(d is None for d in decomp):
        return texto
    votos = [e for e in (_evidencia_decimal(d['corpo']) for d in decomp) if e]
    if votos:
        decimal = max(set(votos), key=votos.count)
    else:
        decimal = '.' if idioma.startswith('en') else ','
    milhar = '.' if decimal == ',' else ','

    convertidos = {}
    for i, v in enumerate(limpos):
        if eh_vazio(v):
            continue
        d = _decompor_numero(v)
        conv = _converter_numero(d['corpo'], decimal)
        if conv is None:
            return texto   # um valor inválido → coluna inteira texto
        num, casas = conv
        convertidos[i] = (-num if d['negativo'] else num, casas, d)

    # Formato uniforme por coluna: mesmas casas decimais, separador de milhar
    # se algum valor tinha, moeda/% se algum valor tinha.
    casas = max(c for _, c, _ in convertidos.values())
    tem_milhar = (any(milhar in d['corpo'] for _, _, d in convertidos.values())
                  or any(_re.search(r'\d \d{3}', v or '') for v in nao_vazios))
    moedas = {d['moeda'] for _, _, d in convertidos.values() if d['moeda']}
    moeda = moedas.pop() if len(moedas) == 1 else ''
    pct = all(d['pct'] for _, _, d in convertidos.values())
    dec = ('.' + '0' * casas) if casas else ''
    if pct:
        fmt = '0' + dec + '%'
    elif moeda:
        fmt = f'"{moeda}" #,##0' + ('.00' if not casas else dec)
    elif tem_milhar:
        fmt = '#,##0' + dec
    elif casas:
        fmt = '0' + dec
    else:
        fmt = None  # inteiro "cru" (ex.: ano 2024) — formato Geral do Excel

    resultado = []
    for i, v in enumerate(limpos):
        if i not in convertidos:
            resultado.append((v, None))
            continue
        num, _, d = convertidos[i]
        if pct:
            num = num / 100
        elif d['pct']:
            return texto   # % misturado com não-% → ambíguo, fica texto
        resultado.append((num, fmt))
    return resultado


def _nome_aba(nome: str, indice: int, usados: set) -> str:
    base = _re.sub(r'[\[\]:*?/\\]', ' ', nome or '').strip().strip("'")[:31] or f"Tabela {indice}"
    candidato, n = base, 2
    while candidato.lower() in usados:
        sufixo = f" ({n})"
        candidato = base[:31 - len(sufixo)] + sufixo
        n += 1
    usados.add(candidato.lower())
    return candidato


def _slug_arquivo(texto: str, max_len: int = 40) -> str:
    import unicodedata
    s = unicodedata.normalize('NFD', texto or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    s = _re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:max_len].rstrip('-')


def montar_planilha_tabelas(req: ExportTabelaXlsxRequest):
    """Monta o Workbook (openpyxl) a partir das tabelas — separado do handler pra teste."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)
    usados = set()
    negrito = Font(bold=True)
    fundo_cab = PatternFill('solid', start_color='E2E8F0')   # slate-200
    borda_cab = Border(bottom=Side(style='thin', color='94A3B8'))

    for idx, tab in enumerate(req.tabelas, start=1):
        ws = wb.create_sheet(_nome_aba(tab.nome, idx, usados))
        n_cols = len(tab.cabecalho)
        linhas = [(list(l) + [''] * n_cols)[:n_cols] for l in tab.linhas]

        for c, titulo in enumerate(tab.cabecalho, start=1):
            cel = ws.cell(row=1, column=c, value=titulo.strip())
            if isinstance(cel.value, str) and cel.value.startswith('='):
                cel.data_type = 's'
            cel.font = negrito
            cel.fill = fundo_cab
            cel.border = borda_cab
            cel.alignment = Alignment(vertical='center', wrap_text=True)

        larguras = [len(t.strip()) for t in tab.cabecalho]
        for c in range(n_cols):
            tipados = _tipar_coluna([l[c] for l in linhas], req.idioma)
            for r, (valor, fmt) in enumerate(tipados, start=2):
                cel = ws.cell(row=r, column=c + 1, value=valor)
                if isinstance(valor, str):
                    # Texto que começa com "=" seria gravado como fórmula pelo
                    # openpyxl — conteúdo vem do LLM/corpus de terceiros, então
                    # força string (anti-injeção de fórmula).
                    if valor.startswith('='):
                        cel.data_type = 's'
                    if len(valor) > 60:
                        cel.alignment = Alignment(wrap_text=True, vertical='top')
                    larguras[c] = max(larguras[c], min(len(valor), 60))
                elif valor is not None:
                    if fmt:
                        cel.number_format = fmt
                    larguras[c] = max(larguras[c], len(str(linhas[r - 2][c]).strip()))
                    if isinstance(valor, (int, float)):
                        cel.alignment = Alignment(horizontal='right')
        for c, larg in enumerate(larguras, start=1):
            ws.column_dimensions[get_column_letter(c)].width = max(8, min(larg + 2, 62))

        ws.freeze_panes = 'A2'
        if linhas:
            ws.auto_filter.ref = f"A1:{get_column_letter(n_cols)}{len(linhas) + 1}"
    return wb


@router.post("/export/tabela-xlsx")
def export_tabela_xlsx(req: ExportTabelaXlsxRequest):
    """Exporta tabela(s) de uma resposta do chat como planilha .xlsx (uma aba por tabela)."""
    try:
        wb = montar_planilha_tabelas(req)
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Dependência não instalada: openpyxl. Execute: pip install openpyxl"
        })
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    slug = _slug_arquivo(req.titulo) or 'tabela'
    filename = f"tusab_{slug}_{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Export de relatório de pesquisa (PDF) ─────────────────────────────────────

class ExportRelatorioPdfRequest(BaseModel):
    projeto_nome: str = Field(default="", max_length=120)
    mensagens:  list = Field(default_factory=list)  # histórico do frontend (fallback ao state)

    # campo legado — normalizado via model_validator:
    canal_nome: str = Field(default="", max_length=120)

    @model_validator(mode='after')
    def _normalizar(self):
        if not self.projeto_nome and self.canal_nome:
            self.projeto_nome = self.canal_nome
        return self


@router.post("/export/relatorio-pdf")
def export_relatorio_pdf(req: ExportRelatorioPdfRequest):
    """Exporta os pares de Q&A do histórico de um projeto como PDF (.pdf)."""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.units import mm
    except ImportError:
        return JSONResponse({
            "error": True,
            "message": "Recurso de exportação PDF não disponível. Reinstale a aplicação ou contacte o suporte em tusab@tusab.solutions"
        })

    canal = req.projeto_nome or state.stats.get("projeto_nome", "") or "chat"

    # Prioriza mensagens enviadas pelo frontend; fallback ao histórico server-side
    if req.mensagens:
        hist = req.mensagens
    else:
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


# ── Export de base compartilhável (.tusab) ────────────────────────────────────

_TUSAB_FORMAT_VERSION = 1


@router.get("/export/base-compartilhavel/{projeto}")
def export_base_compartilhavel(projeto: str):
    """Empacota textos processados + índice BM25 de um projeto num arquivo .tusab."""
    projeto = projeto.strip()
    if not projeto:
        return JSONResponse({"error": True, "message": "Nome do projeto não informado."})

    neural_path = os.path.join(NEURAL_DIR, projeto)
    from tusab_engine.agent import lance_store
    lancedb_path = lance_store.caminho_tabela(projeto)

    if not os.path.exists(neural_path):
        return JSONResponse({"error": True, "message": f"Projeto '{projeto}' não encontrado."})

    buf = io.BytesIO()
    chunk_count = 0

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Textos processados — apenas subpastas de conteúdo (sem arquivos originais grandes)
        for subdir in ('youtube', 'documents', 'texts', 'management'):
            subpath = os.path.join(neural_path, subdir)
            if not os.path.exists(subpath):
                continue
            for root, _, files in os.walk(subpath):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.join('neural', projeto, os.path.relpath(fpath, neural_path))
                    zf.write(fpath, arcname)
                    if fname.endswith('.txt'):
                        chunk_count += 1

        # Índice BM25 serializado (aluno não precisa reindexar) — LanceDB é um
        # diretório (dataset Arrow), não um arquivo único: percorre recursivamente.
        tem_indice = os.path.isdir(lancedb_path)
        if tem_indice:
            for root, _, files in os.walk(lancedb_path):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.join('agent_index', f"{projeto}.lancedb", os.path.relpath(fpath, lancedb_path))
                    zf.write(fpath, arcname)

        # Manifest — somente_leitura: True marca a base como recebida/protegida no destino
        manifest = {
            "format": "tusab-base",
            "version": _TUSAB_FORMAT_VERSION,
            "projeto": projeto,
            "exportado_em": datetime.now().isoformat(),
            "chunks": chunk_count,
            "tem_indice": tem_indice,
            "somente_leitura": True,
        }
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    buf.seek(0)
    safe_name = projeto.replace(' ', '_')
    filename = f"{safe_name}.tusab"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Import de base compartilhável (.tusab) ────────────────────────────────────

@router.post("/import/base-compartilhavel")
async def import_base_compartilhavel(arquivo: UploadFile = File(...)):
    """Importa um arquivo .tusab — descompacta neural/ e indexes/ na pasta de dados."""
    if not arquivo.filename.endswith('.tusab'):
        return JSONResponse({"error": True, "message": "Arquivo deve ter extensão .tusab"})

    conteudo = await arquivo.read()
    buf = io.BytesIO(conteudo)

    try:
        with zipfile.ZipFile(buf, 'r') as zf:
            nomes = zf.namelist()

            # Valida manifest
            if 'manifest.json' not in nomes:
                return JSONResponse({"error": True, "message": "Arquivo .tusab inválido: manifest.json ausente."})

            manifest = json.loads(zf.read('manifest.json'))
            if manifest.get('format') != 'tusab-base':
                return JSONResponse({"error": True, "message": "Formato de arquivo não reconhecido."})

            projeto = manifest.get('projeto', '').strip()
            if not projeto:
                return JSONResponse({"error": True, "message": "Manifest sem nome de projeto."})

            # Extrai apenas neural/ e agent_index/ — ignora qualquer outro caminho (segurança)
            for name in nomes:
                if not (name.startswith('neural/') or name.startswith('agent_index/')):
                    continue
                # Proteção contra path traversal
                dest = os.path.join(DATA_DIR, name)
                dest = os.path.realpath(dest)
                if not dest.startswith(os.path.realpath(DATA_DIR)):
                    continue
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with zf.open(name) as src, open(dest, 'wb') as dst:
                    shutil.copyfileobj(src, dst)

            # Salva flag de readonly se manifest indica somente_leitura
            somente_leitura = manifest.get("somente_leitura", False)
            if somente_leitura:
                readonly_path = os.path.join(NEURAL_DIR, projeto, '_readonly.json')
                salvar_json_atomico(
                    {"somente_leitura": True, "importado_em": datetime.now().isoformat()},
                    readonly_path
                )

    except zipfile.BadZipFile:
        return JSONResponse({"error": True, "message": "Arquivo corrompido ou não é um .tusab válido."})

    return {
        "ok": True,
        "projeto": projeto,
        "chunks": manifest.get("chunks", 0),
        "tem_indice": manifest.get("tem_indice", False),
        "somente_leitura": manifest.get("somente_leitura", False),
        "message": f"Base '{projeto}' importada com sucesso.",
    }


# ── Export de flashcards Anki (.csv) ─────────────────────────────────────────

@router.get("/export/flashcards/{projeto_nome}")
def export_flashcards_anki(projeto_nome: str):
    """Exporta flashcards salvos de um projeto como CSV compatível com Anki (frente;verso)."""
    import re as _re
    from tusab_engine.storage import NEURAL_DIR

    canal_prefixo = _re.sub(r'[<>:"/\\|?*\s]', '_', projeto_nome).strip('_')
    if not canal_prefixo:
        return JSONResponse({"error": True, "message": "Projeto não especificado."})

    fc_path = os.path.join(NEURAL_DIR, canal_prefixo, "management", "flashcards.json")
    if not os.path.exists(fc_path):
        return JSONResponse({"error": True, "message": f"Nenhum flashcard encontrado para '{projeto_nome}'. Gere os flashcards primeiro."})

    try:
        with open(fc_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return JSONResponse({"error": True, "message": f"Erro ao ler flashcards: {e}"})

    flashcards = data.get("flashcards", [])
    if not flashcards:
        return JSONResponse({"error": True, "message": "Nenhum flashcard para exportar."})

    linhas = []
    for fc in flashcards:
        pergunta = str(fc.get("pergunta", "")).replace(";", ",").replace("\n", " ")
        resposta  = str(fc.get("resposta",  "")).replace(";", ",").replace("\n", " ")
        linhas.append(f"{pergunta};{resposta}")

    csv_content = "\n".join(linhas)
    buf = io.BytesIO(csv_content.encode("utf-8"))
    safe_canal = canal_prefixo
    filename = f"tusab_{safe_canal}_flashcards.csv"

    return StreamingResponse(
        buf,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Status de readonly por projeto ───────────────────────────────────────────

@router.get("/export/readonly-status")
def readonly_status():
    """Retorna dict { projeto: bool } com quais projetos são somente leitura."""
    resultado = {}
    if not os.path.exists(NEURAL_DIR):
        return resultado
    for entry in os.scandir(NEURAL_DIR):
        if not entry.is_dir():
            continue
        readonly_path = os.path.join(entry.path, '_readonly.json')
        resultado[entry.name] = os.path.exists(readonly_path)
    return resultado
