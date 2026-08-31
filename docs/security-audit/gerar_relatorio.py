# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Gera o relatório de auditoria de segurança do Tusab em PDF.

Uso:
    docs\\security-audit\\.venv-report\\Scripts\\python.exe docs\\security-audit\\gerar_relatorio.py

Regenera docs/security-audit/relatorio-auditoria-seguranca.pdf a partir dos
dados em dados_auditoria.py. Não precisa reinstalar dependências se o venv já
existir (docs/security-audit/.venv-report).
"""

import os
import sys
import io
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dados_auditoria import (
    METODOLOGIA, STACK, RESUMO_HANDLERS, ACHADOS, PONTOS_FORTES,
    TOTAIS_SEVERIDADE, TOTAIS_CATEGORIA,
)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, NextPageTemplate, PageBreak, KeepTogether, HRFlowable,
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas as pdfcanvas
from xml.sax.saxutils import escape as _xml_escape


def esc(texto):
    """Escapa entidades XML/HTML em texto livre antes de embutir em markup
    reportlab (ex: '<img src=...>' citado dentro de uma explicação em prosa
    seria interpretado como tag real pelo parser, não como texto)."""
    return _xml_escape(str(texto))


# ── Paleta ────────────────────────────────────────────────────────────────────

COR_CRITICA   = colors.HexColor("#B91C1C")
COR_ALTA      = colors.HexColor("#EA580C")
COR_MEDIA     = colors.HexColor("#D97706")
COR_BAIXA     = colors.HexColor("#2563EB")
COR_PONTOFORTE = colors.HexColor("#059669")
COR_INFO      = colors.HexColor("#64748B")

COR_TEXTO      = colors.HexColor("#1E293B")
COR_TEXTO_SEC  = colors.HexColor("#475569")
COR_FUNDO_CLARO = colors.HexColor("#F8FAFC")
COR_BORDA      = colors.HexColor("#E2E8F0")
COR_MARCA      = colors.HexColor("#4B2E83")  # roxo Tusab

MAPA_COR_SEV = {
    "critica": COR_CRITICA,
    "alta": COR_ALTA,
    "media": COR_MEDIA,
    "baixa": COR_BAIXA,
    "informativa": COR_INFO,
}
MAPA_LABEL_SEV = {
    "critica": "CRÍTICA",
    "alta": "ALTA",
    "media": "MÉDIA",
    "baixa": "BAIXA",
    "informativa": "INFORMATIVA",
}

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(OUT_DIR, "relatorio-auditoria-seguranca.pdf")
DATA_HOJE = datetime.now().strftime("%d/%m/%Y")

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm


# ── Gráficos (matplotlib) ────────────────────────────────────────────────────

def gerar_grafico_rosca():
    labels, sizes, cores = [], [], []
    for sev in ["critica", "alta", "media", "baixa", "informativa"]:
        v = TOTAIS_SEVERIDADE.get(sev, 0)
        if v > 0:
            labels.append(f"{MAPA_LABEL_SEV[sev]} ({v})")
            sizes.append(v)
            cores.append(MAPA_COR_SEV[sev].hexval() if hasattr(MAPA_COR_SEV[sev], 'hexval') else str(MAPA_COR_SEV[sev]))

    cores_hex = []
    for sev in ["critica", "alta", "media", "baixa", "informativa"]:
        v = TOTAIS_SEVERIDADE.get(sev, 0)
        if v > 0:
            c = MAPA_COR_SEV[sev]
            cores_hex.append("#%02X%02X%02X" % (int(c.red*255), int(c.green*255), int(c.blue*255)))

    fig, ax = plt.subplots(figsize=(4.2, 4.2), dpi=200)
    wedges, texts, autotexts = ax.pie(
        sizes, colors=cores_hex, autopct=lambda p: f"{int(round(p*sum(sizes)/100))}",
        pctdistance=0.78, startangle=90, counterclock=False,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
        textprops=dict(color="white", fontsize=13, fontweight="bold"),
    )
    ax.legend(wedges, labels, loc="center", bbox_to_anchor=(0.5, -0.18, 0, 0),
              ncol=2, fontsize=8.5, frameon=False)
    ax.set_title("Achados por severidade", fontsize=12, fontweight="bold", color="#1E293B", pad=10)
    ax.axis("equal")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


def gerar_grafico_barras():
    cats = list(TOTAIS_CATEGORIA.keys())
    vals = list(TOTAIS_CATEGORIA.values())
    cores_barra = ["#4B2E83"] * len(cats)

    fig, ax = plt.subplots(figsize=(6.2, 3.6), dpi=200)
    bars = ax.bar(range(len(cats)), vals, color=cores_barra, width=0.55, zorder=3)
    for i, v in enumerate(vals):
        ax.text(i, v + 0.08, str(v), ha="center", va="bottom", fontsize=11, fontweight="bold", color="#1E293B")

    ax.set_xticks(range(len(cats)))
    wrapped = ["\n".join(c.split(" / ")) if " / " in c else c.replace(" ", "\n", 1) for c in cats]
    ax.set_xticklabels(wrapped, fontsize=8.3, color="#334155")
    ax.set_ylabel("Achados confirmados", fontsize=9.5, color="#334155")
    ax.set_ylim(0, max(vals) + 1.4 if vals else 1)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.8, zorder=0)
    ax.set_title("Achados por categoria (adaptada ao modelo local-first)", fontsize=11.5, fontweight="bold", color="#1E293B", pad=10)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


# ── Estilos ───────────────────────────────────────────────────────────────────

styles = getSampleStyleSheet()

def _style(name, **kw):
    base = dict(fontName="Helvetica", fontSize=10, leading=14, textColor=COR_TEXTO)
    base.update(kw)
    return ParagraphStyle(name, **base)

S_TITULO_CAPA   = _style("TituloCapa", fontName="Helvetica-Bold", fontSize=25, leading=30, textColor=COR_MARCA, alignment=TA_CENTER)
S_SUBTITULO_CAPA = _style("SubtituloCapa", fontName="Helvetica", fontSize=13, leading=18, textColor=COR_TEXTO_SEC, alignment=TA_CENTER)
S_H1 = _style("H1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=COR_MARCA, spaceBefore=6, spaceAfter=10)
S_H2 = _style("H2", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=COR_TEXTO, spaceBefore=14, spaceAfter=6)
S_H3 = _style("H3", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=COR_TEXTO, spaceBefore=8, spaceAfter=4)
S_BODY = _style("Body", fontSize=9.6, leading=13.6, alignment=TA_JUSTIFY, spaceAfter=6)
S_BODY_SM = _style("BodySmall", fontSize=8.6, leading=12.2, alignment=TA_JUSTIFY, textColor=COR_TEXTO_SEC, spaceAfter=4)
S_LABEL = _style("Label", fontName="Helvetica-Bold", fontSize=8.6, leading=11, textColor=COR_TEXTO_SEC)
S_CODE = _style("Code", fontName="Courier", fontSize=7.6, leading=10.2, textColor=colors.HexColor("#0F172A"), backColor=COR_FUNDO_CLARO)
S_CAPA_META = _style("CapaMeta", fontSize=10, leading=15, textColor=COR_TEXTO_SEC, alignment=TA_CENTER)
S_TOC_ENTRY = _style("TocEntry", fontSize=10.5, leading=16, textColor=COR_TEXTO)
S_ISSUE_TITLE = _style("IssueTitle", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=COR_MARCA, spaceBefore=10, spaceAfter=4)
S_MONO_BLOCK = _style("MonoBlock", fontName="Courier", fontSize=7.4, leading=10, textColor=colors.HexColor("#E2E8F0"))


def chip_severidade(sev):
    cor = MAPA_COR_SEV.get(sev, COR_INFO)
    label = MAPA_LABEL_SEV.get(sev, sev.upper())
    t = Table([[label]], colWidths=[2.6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), cor),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


# ── Cabeçalho / rodapé ────────────────────────────────────────────────────────

def _draw_header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setStrokeColor(COR_BORDA)
    canvas_obj.setLineWidth(0.6)
    canvas_obj.line(MARGIN, PAGE_H - 1.35*cm, PAGE_W - MARGIN, PAGE_H - 1.35*cm)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(COR_TEXTO_SEC)
    canvas_obj.drawString(MARGIN, PAGE_H - 1.15*cm, "Relatório de Auditoria de Segurança — Tusab")
    canvas_obj.drawRightString(PAGE_W - MARGIN, PAGE_H - 1.15*cm, DATA_HOJE)

    canvas_obj.line(MARGIN, 1.35*cm, PAGE_W - MARGIN, 1.35*cm)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(MARGIN, 1.0*cm, "CriAugu — confidencial, uso interno")
    canvas_obj.drawRightString(PAGE_W - MARGIN, 1.0*cm, f"Página {doc.page}")
    canvas_obj.restoreState()


def _draw_cover(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(COR_MARCA)
    canvas_obj.rect(0, PAGE_H - 5.2*cm, PAGE_W, 5.2*cm, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 8.5)
    canvas_obj.drawString(MARGIN, PAGE_H - 1.1*cm, "TUSAB")
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawRightString(PAGE_W - MARGIN, PAGE_H - 1.1*cm, "CriAugu")
    canvas_obj.restoreState()


# ── Documento ─────────────────────────────────────────────────────────────────

def build_pdf():
    doc = BaseDocTemplate(
        PDF_PATH, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=1.7*cm, bottomMargin=1.7*cm,
        title="Relatório de Auditoria de Segurança — Tusab",
        author="Claude Sonnet 5 (auditoria assistida)",
    )

    frame_cover = Frame(MARGIN, MARGIN, PAGE_W - 2*MARGIN, PAGE_H - 2*MARGIN - 5.2*cm, id="cover")
    frame_normal = Frame(MARGIN, 1.5*cm, PAGE_W - 2*MARGIN, PAGE_H - 3.2*cm, id="normal")

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[frame_cover], onPage=_draw_cover),
        PageTemplate(id="Normal", frames=[frame_normal], onPage=_draw_header_footer),
    ])

    story = []

    # ── CAPA ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 2.2*cm))
    story.append(Paragraph("Relatório de Auditoria de Segurança", S_TITULO_CAPA))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("Tusab — Sistema de Gestão de Conhecimento Pessoal com IA Local", S_SUBTITULO_CAPA))
    story.append(Spacer(1, 1.3*cm))

    S_META_LABEL = _style("MetaLabel", fontName="Helvetica-Bold", fontSize=9.2, textColor=COR_MARCA, leading=12)
    S_META_VALUE = _style("MetaValue", fontName="Helvetica", fontSize=9.2, textColor=COR_TEXTO, leading=12.5)
    meta_rows = [
        [Paragraph("Data da auditoria", S_META_LABEL), Paragraph(DATA_HOJE, S_META_VALUE)],
        [Paragraph("Escopo", S_META_LABEL), Paragraph("Backend FastAPI (9 routers, ~5.350 linhas), frontend React (chat/estudo), Electron, CI/CD, histórico git", S_META_VALUE)],
        [Paragraph("Metodologia", S_META_LABEL), Paragraph("5 auditores especializados (1 por categoria) + verificação adversarial independente de cada achado — 32 agentes no total", S_META_VALUE)],
        [Paragraph("Handlers verificados", S_META_LABEL), Paragraph("97 rotas (cobertura sistemática, não amostral)", S_META_VALUE)],
        [Paragraph("Achados confirmados", S_META_LABEL), Paragraph("24 de 27 candidatos (3 refutados pela verificação adversarial)", S_META_VALUE)],
    ]
    t = Table(meta_rows, colWidths=[4.4*cm, 10.6*cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, COR_BORDA),
    ]))
    story.append(t)
    story.append(Spacer(1, 1.0*cm))

    story.append(Paragraph("Nota metodológica", S_H3))
    story.append(Paragraph(
        "O Tusab é um aplicativo desktop <b>local-first</b> (Electron + FastAPI), single-user, "
        "sem login, sem sessão e sem conceito de organização/workspace/tenant — modelo "
        "arquiteturalmente distinto de um SaaS multi-tenant. As cinco categorias de auditoria "
        "solicitadas foram adaptadas a esse modelo real, e não aplicadas literalmente:",
        S_BODY_SM,
    ))
    for chave, label in [
        ("banco_sem_tranca", "1. Banco sem tranca → isolamento de escopo de prefixo/projeto (não RLS entre usuários)"),
        ("permissao_navegador", "2. Permissão no navegador → operações destrutivas sem confirmação server-side (não RBAC)"),
        ("idor", "3. IDOR → path traversal sistemático via id/prefixo/fid em disco (não objeto de outro usuário)"),
        ("chaves_expostas", "4. Chaves expostas → aplicado sem adaptação"),
        ("xss", "5. XSS → aplicado ao React/ReactMarkdown do frontend"),
    ]:
        story.append(Paragraph(f"<b>{esc(label)}</b> — {esc(METODOLOGIA[chave])}", S_BODY_SM))

    story.append(NextPageTemplate("Normal"))
    story.append(PageBreak())

    # ── STACK DETECTADA ───────────────────────────────────────────────────────
    story.append(Paragraph("Stack técnica detectada", S_H1))
    S_STACK_LABEL = _style("StackLabel", fontName="Helvetica-Bold", fontSize=8.6, textColor=COR_MARCA, leading=11)
    S_STACK_VALUE = _style("StackValue", fontName="Helvetica", fontSize=8.6, textColor=COR_TEXTO, leading=11.6)
    stack_rows = [[Paragraph(k, S_STACK_LABEL), Paragraph(esc(v), S_STACK_VALUE)] for k, v in STACK.items()]
    t = Table(stack_rows, colWidths=[3.4*cm, 12.9*cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, COR_FUNDO_CLARO]),
        ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COR_BORDA),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.6*cm))

    # ── RESUMO EXECUTIVO ──────────────────────────────────────────────────────
    story.append(Paragraph("Resumo executivo", S_H1))
    story.append(Paragraph(
        "A auditoria cobriu sistematicamente 97 handlers de rota em 9 routers do backend "
        "FastAPI, os 3 componentes frontend que renderizam conteúdo dinâmico do LLM, o "
        "empacotamento Electron e o histórico git completo. Cada achado passou por uma segunda "
        "verificação adversarial independente antes de entrar neste relatório — 3 dos 27 "
        "candidatos originais foram refutados como falsos positivos (path traversal via "
        "artefato_id em router_estudo.py, e dois casos de ReactMarkdown sem risco real de XSS "
        "por ausência de rehype-raw).",
        S_BODY,
    ))

    buf_rosca = gerar_grafico_rosca()
    buf_barras = gerar_grafico_barras()
    img_rosca = Image(buf_rosca, width=8.2*cm, height=8.2*cm)
    img_barras = Image(buf_barras, width=8.6*cm, height=5.0*cm)

    charts_table = Table([[img_rosca, img_barras]], colWidths=[8.4*cm, 8.4*cm])
    charts_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(charts_table)
    story.append(Spacer(1, 0.4*cm))

    total_achados = sum(TOTAIS_SEVERIDADE.values())
    resumo_sev_rows = [["Severidade", "Quantidade", ""]]
    for sev in ["critica", "alta", "media", "baixa", "informativa"]:
        resumo_sev_rows.append([MAPA_LABEL_SEV[sev], str(TOTAIS_SEVERIDADE[sev]), ""])
    t = Table(resumo_sev_rows, colWidths=[4*cm, 3*cm, 9.9*cm])
    style_cmds = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), COR_MARCA),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COR_BORDA),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i, sev in enumerate(["critica", "alta", "media", "baixa", "informativa"], start=1):
        style_cmds.append(("TEXTCOLOR", (0, i), (0, i), MAPA_COR_SEV[sev]))
        style_cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))
    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"<b>Total de achados únicos: {total_achados}</b> — 0 crítica, 2 altas, 5 médias, 2 baixas, 11 "
        "informativas. A categoria Chaves Expostas não teve nenhum achado real. Nota: dos 24 achados "
        "originalmente confirmados pela verificação adversarial, alguns foram reportados de forma "
        "independente por mais de uma categoria (ex: o mesmo endpoint /open-folder apareceu em 3 "
        "categorias) — este relatório consolida cada endpoint numa única entrada, resultando em 20 "
        "achados/notas únicas, das quais 9 têm impacto prático real (severidade média ou acima) e "
        "recebem seção de detalhe completo a seguir.",
        S_BODY_SM,
    ))

    story.append(PageBreak())

    # ── PONTOS FORTES ─────────────────────────────────────────────────────────
    story.append(Paragraph("Pontos fortes — o que está protegido", S_H1))
    story.append(Paragraph(
        "Registrados abaixo como evidência de cobertura da auditoria — cada item foi verificado "
        "lendo o código real, não presumido.",
        S_BODY_SM,
    ))
    for pf in PONTOS_FORTES:
        story.append(Spacer(1, 0.15*cm))
        header = Table([[Paragraph(f"<b>{esc(pf['categoria'])}</b> — {esc(pf['resumo'])}", _style("PFHead", fontName="Helvetica-Bold", fontSize=9.6, textColor=colors.white, leading=12.5))]], colWidths=[16.3*cm])
        header.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COR_PONTOFORTE),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(header)
        body = Table([[Paragraph(esc(pf["evidencia"]), S_BODY_SM)]], colWidths=[16.3*cm])
        body.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COR_FUNDO_CLARO),
            ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(body)

    story.append(PageBreak())

    # ── ACHADOS DETALHADOS ────────────────────────────────────────────────────
    story.append(Paragraph("Achados detalhados", S_H1))
    story.append(Paragraph(
        "Ordenados por severidade (após verificação adversarial — ver nota de ajuste em cada "
        "item quando a severidade original proposta foi revista).",
        S_BODY_SM,
    ))

    ordem_sev = {"critica": 0, "alta": 1, "media": 2, "baixa": 3, "informativa": 4}
    achados_ordenados = sorted(ACHADOS, key=lambda a: ordem_sev[a["severidade_ajustada"]])

    # Tabela-resumo
    story.append(Spacer(1, 0.2*cm))
    resumo_rows = [["Sev.", "Arquivo:linha", "Descrição"]]
    for a in achados_ordenados:
        resumo_rows.append([
            MAPA_LABEL_SEV[a["severidade_ajustada"]],
            Paragraph(f"<font size=7.2>{esc(a['arquivo'].split('/')[-1])}:{esc(a['linhas'])}</font>", S_BODY_SM),
            Paragraph(f"<font size=8>{esc(a['titulo'])}</font>", S_BODY_SM),
        ])
    t = Table(resumo_rows, colWidths=[1.8*cm, 4.5*cm, 10.6*cm], repeatRows=1)
    style_cmds = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), COR_MARCA),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COR_BORDA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, a in enumerate(achados_ordenados, start=1):
        cor = MAPA_COR_SEV[a["severidade_ajustada"]]
        style_cmds.append(("TEXTCOLOR", (0, i), (0, i), cor))
        style_cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))
        style_cmds.append(("FONTSIZE", (0, i), (0, i), 7.8))
    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    story.append(PageBreak())

    # Detalhe completo por achado
    for a in achados_ordenados:
        bloco = []
        cor_sev = MAPA_COR_SEV[a["severidade_ajustada"]]
        header_row = Table(
            [[chip_severidade(a["severidade_ajustada"]),
              Paragraph(f"<b>{esc(a['id'])} — {esc(a['titulo'])}</b>", _style("AchTitle", fontName="Helvetica-Bold", fontSize=11, textColor=COR_TEXTO, leading=14))]],
            colWidths=[2.8*cm, 13.5*cm],
        )
        header_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        bloco.append(header_row)
        bloco.append(Spacer(1, 0.15*cm))

        bloco.append(Paragraph(f"<b>Arquivo:</b> {esc(a['arquivo'])} &nbsp;&nbsp; <b>Linhas:</b> {esc(a['linhas'])} &nbsp;&nbsp; <b>Categorias:</b> {esc(', '.join(a['categorias']))}", S_BODY_SM))
        bloco.append(Paragraph(f"<b>Descrição:</b> {esc(a['descricao'])}", S_BODY))

        trecho_escapado = esc(a["trecho"]).replace("\n", "<br/>").replace(" ", "&nbsp;")
        code_table = Table([[Paragraph(trecho_escapado, S_CODE)]], colWidths=[16.3*cm])
        code_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COR_FUNDO_CLARO),
            ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        bloco.append(code_table)
        bloco.append(Spacer(1, 0.15*cm))

        bloco.append(Paragraph(f"<b>Por que é explorável:</b> {esc(a['explicacao'])}", S_BODY))
        bloco.append(Paragraph(f"<b>Condição de explorabilidade:</b> {esc(a['condicao'])}", S_BODY_SM))
        if a["severidade_original"] != a["severidade_ajustada"]:
            bloco.append(Paragraph(
                f"<b>Verificação adversarial:</b> severidade original <b>{MAPA_LABEL_SEV[a['severidade_original']]}</b> "
                f"ajustada para <b>{MAPA_LABEL_SEV[a['severidade_ajustada']]}</b>. {esc(a['nota_verificacao'])}",
                S_BODY_SM,
            ))
        else:
            bloco.append(Paragraph(f"<b>Verificação adversarial:</b> {esc(a['nota_verificacao'])}", S_BODY_SM))
        bloco.append(Paragraph(f"<b>Recomendação:</b> {esc(a['recomendacao'])}", S_BODY_SM))
        bloco.append(Spacer(1, 0.3*cm))
        bloco.append(HRFlowable(width="100%", thickness=0.5, color=COR_BORDA))
        bloco.append(Spacer(1, 0.3*cm))

        story.append(KeepTogether(bloco))

    story.append(PageBreak())

    # ── RECOMENDAÇÕES PRIORIZADAS ─────────────────────────────────────────────
    story.append(Paragraph("Recomendações priorizadas", S_H1))
    prioridades = [
        ("P1", "Corrigir os 2 achados de severidade alta (A2, A3) — sanitizar canal_prefixo/projeto_prefixo em /auto-update/config e prefixo em /open-folder com o mesmo padrão re.sub já usado em ~50 outros pontos do código. Correção de 1 linha por endpoint."),
        ("P1", "Aplicar os.path.realpath + startswith em /export/base-compartilhavel (A1), replicando a proteção já existente na rota irmã import_base_compartilhavel."),
        ("P2", "Sanitizar projeto_nome em /export/tabela-videos (A4) e corrigir o startswith sem os.sep em cerebro_ler_arquivo (A7)."),
        ("P2", "Adicionar confirmação server-side mínima em DELETE /reset-total (A5) — ex: exigir {\"confirmar\": \"RESET\"} no body."),
        ("P3", "Revisar o contrato de /neural/limpar e /historico/limpar (A8) — trocar 'campo vazio = todos' por escopo explícito."),
        ("P3", "Adicionar allowlist de protocolo (http/https/mailto) no componente `a` do ReactMarkdown e no href de fontes do chat (A9)."),
        ("P3", "Auditoria de hardening: centralizar sanitização de prefixo dentro de storage.py::gestao_canal_dir() para blindar retroativamente todos os chamadores atuais e futuros."),
    ]
    for prio, texto in prioridades:
        row = Table([[Paragraph(f"<b>{esc(prio)}</b>", _style("PrioLabel", fontName="Helvetica-Bold", fontSize=10, textColor=colors.white, alignment=TA_CENTER)), Paragraph(esc(texto), S_BODY_SM)]], colWidths=[1.4*cm, 14.9*cm])
        row.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), COR_MARCA),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (1, 0), (1, -1), 10),
            ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
        ]))
        story.append(row)
        story.append(Spacer(1, 0.12*cm))

    story.append(PageBreak())

    # ── ISSUES PARA O GITHUB ─────────────────────────────────────────────────
    story.append(Paragraph("Issues para o GitHub", S_H1))
    story.append(Paragraph(
        "Texto completo em Markdown, pronto para copiar e colar na criação de issues no "
        "repositório. Achados relacionados (mesma causa raiz de sanitização) foram agrupados.",
        S_BODY_SM,
    ))

    issues_md = gerar_issues_markdown()
    for i, issue_md in enumerate(issues_md, start=1):
        story.append(Paragraph(f"Issue {i}", S_ISSUE_TITLE))
        issue_escapado = esc(issue_md).replace("\n", "<br/>").replace("  ", "&nbsp;&nbsp;")
        block = Table([[Paragraph(issue_escapado, S_MONO_BLOCK)]], colWidths=[16.3*cm])
        block.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#E2E8F0")),
            ("BOX", (0, 0), (-1, -1), 0.5, COR_BORDA),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(block)
        story.append(Spacer(1, 0.4*cm))

    doc.build(story)
    return PDF_PATH


def gerar_issues_markdown():
    """Gera o texto Markdown de cada issue, agrupando achados relacionados."""
    issues = []

    # Issue 1: path traversal em rotas de export (A1)
    a = next(x for x in ACHADOS if x["id"] == "A1")
    issues.append(f"""# [Segurança] Path traversal em GET /export/base-compartilhavel — sem checagem de escopo

**Labels sugeridas:** `security`, `severity:medium`

## Descrição do problema
O path param `projeto` em `GET /export/base-compartilhavel/{{projeto}}` é usado diretamente em
`os.path.join(NEURAL_DIR, projeto)` sem sanitização nem checagem de `os.path.realpath` contra
`NEURAL_DIR`. A rota irmã `import_base_compartilhavel` (mesmo arquivo) já implementa essa
proteção corretamente — a ausência no export é uma omissão isolada.

## Evidência
`{a['arquivo']}:{a['linhas']}`
```python
{a['trecho']}
```

## Impacto
Path traversal real, comprovado via análise do roteador FastAPI (rota de único segmento —
múltiplos '../../..' codificados são bloqueados pelo próprio roteador). O único traversal
executável hoje (`projeto='..'`) resulta em ZIP vazio dado o layout atual de `data/`, mas a
falha é estrutural e se torna perigosa se a árvore de diretórios mudar no futuro.

## Sugestão de correção
Replicar a proteção já existente em `import_base_compartilhavel` (linhas 493-496):
```python
neural_path = os.path.realpath(os.path.join(NEURAL_DIR, projeto))
if not neural_path.startswith(os.path.realpath(NEURAL_DIR) + os.sep):
    return JSONResponse({{"error": True, "message": "Projeto inválido."}})
```

## Critérios de aceite
- [ ] `os.path.realpath` + `startswith(NEURAL_DIR + os.sep)` aplicado antes do `os.walk`
- [ ] Teste automatizado cobrindo `projeto='..'` e `projeto='../../etc'` retornando erro, não ZIP
- [ ] `pytest tests/` verde
""")

    # Issue 2: agrupada — falta de sanitização em rotas de auto-update, exports, open-folder
    a2 = next(x for x in ACHADOS if x["id"] == "A2")
    a3 = next(x for x in ACHADOS if x["id"] == "A3")
    a4 = next(x for x in ACHADOS if x["id"] == "A4")
    a6 = next(x for x in ACHADOS if x["id"] == "A6")
    issues.append(f"""# [Segurança] Falta de sanitização de prefixo/projeto em 4 endpoints (write/read fora do escopo)

**Labels sugeridas:** `security`, `severity:high`

## Descrição do problema
4 endpoints recebem `canal_prefixo`/`projeto_prefixo`/`projeto_nome` do cliente e os usam em
`os.path.join` sem aplicar o padrão `re.sub(r'[<>:"/\\\\|?*\\s]', '_', nome).strip('_')` já usado
em ~50 outros pontos do código-base. É uma inconsistência real (o padrão correto existe e é
aplicado no resto do projeto), não uma decisão deliberada.

## Evidência

**1. `{a2['arquivo']}:{a2['linhas']}`** (severidade ALTA — escrita arbitrária de JSON)
```python
{a2['trecho']}
```

**2. `{a3['arquivo']}:{a3['linhas']}`** (severidade ALTA — mkdir + abertura de Explorer fora do escopo)
```python
{a3['trecho']}
```

**3. `{a4['arquivo']}:{a4['linhas']}`** (severidade MÉDIA — mkdir + leitura condicionada)
```python
{a4['trecho']}
```

**4. `{a6['arquivo']}:{a6['linhas']}`** (severidade MÉDIA — leitura fora do escopo)
```python
{a6['trecho']}
```

## Impacto
Escrita/leitura de arquivos fora de `data/neural/`, e no caso do `/open-folder`, abertura do
Explorer/Finder do sistema operacional apontando para um diretório arbitrário criado pelo
próprio backend. `/open-folder` é a mais grave: é um GET disparável sem interação do usuário
por qualquer página web aberta no navegador enquanto o backend roda em background (CORS não
bloqueia o envio do GET, só a leitura da resposta via JS).

## Sugestão de correção
Aplicar `re.sub(r'[<>:"/\\\\|?*\\s]', '_', valor).strip('_')` em todos os 4 parâmetros antes de
qualquer `os.path.join`, no mesmo padrão já usado no restante do projeto (ex: `router_agent.py`,
`router_estudo.py`).

## Critérios de aceite
- [ ] Sanitização aplicada nos 4 endpoints listados
- [ ] Teste automatizado por endpoint cobrindo payload com `'../'` retornando erro
- [ ] `pytest tests/` verde
- [ ] `smoke.ps1 -Suite full` verde
""")

    # Issue 3: DELETE /reset-total sem confirmação
    a5 = next(x for x in ACHADOS if x["id"] == "A5")
    issues.append(f"""# [Segurança] DELETE /reset-total executa sem qualquer confirmação server-side

**Labels sugeridas:** `security`, `severity:medium`

## Descrição do problema
`reset_total()` não declara nenhum parâmetro de confirmação — qualquer `DELETE /reset-total`
apaga incondicionalmente `neural/`, `gestao/`, índices BM25/LanceDB e histórico em memória. É a
única rota destrutiva do produto sem seletor de escopo algum.

## Evidência
`{a5['arquivo']}:{a5['linhas']}`
```python
{a5['trecho']}
```

## Impacto
Irreversível (sem lixeira/soft-delete/backup) e sem qualquer barreira além da confirmação
visual no frontend. No modelo de ameaça local-first isso é aceitável para "falta de
autenticação" genérica, mas não para ausência total de confirmação numa operação de destruição
completa e irreversível.

## Sugestão de correção
Exigir um campo de confirmação explícito no body, ex:
```python
class ResetTotalRequest(BaseModel):
    confirmar: str

@router.delete("/reset-total")
def reset_total(req: ResetTotalRequest):
    if req.confirmar != "RESET":
        return {{"error": True, "message": "Confirmação inválida."}}
    ...
```

## Critérios de aceite
- [ ] Endpoint exige campo de confirmação explícito
- [ ] Frontend atualizado para enviar o campo
- [ ] Teste automatizado cobrindo chamada sem confirmação retornando erro sem apagar nada
""")

    # Issue 4: agrupada — cerebro_ler_arquivo (os.sep) + neural/limpar + historico/limpar
    a7 = next(x for x in ACHADOS if x["id"] == "A7")
    a8 = next(x for x in ACHADOS if x["id"] == "A8")
    issues.append(f"""# [Segurança] Hardening: checagem de path sem separador + contrato de API de "limpar" ambíguo

**Labels sugeridas:** `security`, `severity:low`

## Descrição do problema
Dois achados de baixo risco relacionados a robustez de validação:

**1. `cerebro_ler_arquivo` (`{a7['arquivo']}:{a7['linhas']}`)** — checagem de escopo usa
`startswith()` sem `+ os.sep`, permitindo bypass teórico via diretório irmão com prefixo
textual coincidente (não existe hoje no layout do Tusab):
```python
{a7['trecho']}
```

**2. `DELETE /neural/limpar` e `/historico/limpar` (`{a8['arquivo']}:{a8['linhas']}`)** — quando
o campo de escopo vem vazio/omitido, o comportamento é "limpar tudo" em vez de "não fazer nada":
```python
{a8['trecho']}
```

## Impacto
Ambos de exploração prática limitada hoje (sem diretório irmão explorável; frontend sempre
popula o campo), mas são inconsistências reais de padrão — o código correto (`+ os.sep`,
escopo explícito) já existe em rotas vizinhas no mesmo arquivo.

## Sugestão de correção
1. Trocar `startswith(X)` por `startswith(X + os.sep)` em `cerebro_ler_arquivo`, replicando o
   padrão de `cerebro_delete`/`cerebro_criar_projeto` no mesmo arquivo.
2. Exigir valor explícito (ex: `{{"escopo": "tudo"}}`) quando a intenção for limpar todos os
   projetos, em vez de inferir isso de um campo vazio.

## Critérios de aceite
- [ ] `+ os.sep` aplicado em `cerebro_ler_arquivo`
- [ ] Contrato de `/neural/limpar` e `/historico/limpar` revisado
- [ ] `pytest tests/` verde
""")

    # Issue 5: XSS href
    a9 = next(x for x in ACHADOS if x["id"] == "A9")
    issues.append(f"""# [Segurança] href sem allowlist de protocolo em links de fonte e markdown do LLM

**Labels sugeridas:** `security`, `severity:low`

## Descrição do problema
O link de fonte do chat (`f.link`) e o componente `a` customizado do ReactMarkdown (que
renderiza links de respostas do LLM) não validam o esquema da URL antes de usá-la em `href`.

## Evidência
`{a9['arquivo']}:{a9['linhas']}`
```jsx
{a9['trecho']}
```

## Impacto
`rehype-raw` está ausente do projeto, então HTML/script bruto embutido em markdown não é
renderizado como DOM — isso elimina o vetor clássico de XSS. O que resta é um `href` com
esquema `javascript:` sendo aceito sem allowlist. Exploração exige que o próprio LLM do usuário
produza esse link (self-XSS, sem multi-tenant) e que o usuário clique explicitamente — risco
baixo, mas correção é barata.

## Sugestão de correção
```jsx
const PROTOCOLOS_PERMITIDOS = ['http:', 'https:', 'mailto:'];
const hrefSeguro = (url) => {{
  try {{ return PROTOCOLOS_PERMITIDOS.includes(new URL(url).protocol) ? url : '#'; }}
  catch {{ return '#'; }}
}};
```
Aplicar em `ChatDrawer.jsx` no componente `a` customizado do ReactMarkdown e no `href` de
`f.link`.

## Critérios de aceite
- [ ] Allowlist de protocolo aplicada nos dois pontos
- [ ] Teste manual: link com `javascript:` no markdown renderiza como `#`, não executa
""")

    return issues


if __name__ == "__main__":
    path = build_pdf()
    print(f"PDF gerado em: {path}")
    print(f"Tamanho: {os.path.getsize(path) / 1024:.1f} KB")
