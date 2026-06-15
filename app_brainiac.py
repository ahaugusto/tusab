import customtkinter as ctk
import threading
import sys
import os
import re
import json
from datetime import datetime
from PIL import Image
import motor_sebayt

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# ==========================================
# --- PALETA DE CORES (Navy + Red) ---
# ==========================================
C = {
    "bg":       "#08101F",
    "sidebar":  "#0C1628",
    "card":     "#112038",
    "card2":    "#172944",
    "border":   "#1E3A5C",
    "red":      "#E8334A",
    "red_dk":   "#BE1F37",
    "red_lt":   "#FF5468",
    "green":    "#10B981",
    "yellow":   "#F59E0B",
    "purple":   "#A78BFA",
    "cyan":     "#22D3EE",
    "orange":   "#FB923C",
    "txt":      "#EEF2FF",
    "txt2":     "#7B93CC",
    "txt3":     "#3D5280",
}

CONFIG_FILE = "brainiac_config.json"

LOG_COLOR_RULES = [
    (r"✅|OK!|SUCESSO|CUMPRIDA|FINALIZADO",              C["green"]),
    (r"❌|ERRO|Erro|erro|CRÍTICO",                        C["red"]),
    (r"⚠️|WARN|INTERROMPIDO",                            C["yellow"]),
    (r"\[SISTEMA\]|conectado|Inicia|BrainIAc",           C["red"]),
    (r"🎬|Extraindo",                                     C["purple"]),
    (r"⬆️|🔄|Drive|Sincronizado|Atualizado|DRIVE",       C["cyan"]),
    (r"📡|Mapeando|canal|Canal",                          "#C084FC"),
    (r"🏆|MISSÃO|CONCLUÍDO|100%",                         C["green"]),
    (r"📂|NOVO ARQUIVO",                                  C["orange"]),
    (r"📊|Relatório|auditoria",                           C["cyan"]),
    (r"🔐|CONECTANDO|GOOGLE",                             C["red"]),
    (r"={3,}|[-]{3,}",                                    C["border"]),
]


class SmartLogViewer(ctk.CTkFrame):
    def __init__(self, master, on_success=None, on_new_file=None, **kwargs):
        super().__init__(master, fg_color=C["bg"], **kwargs)
        self.on_success = on_success
        self.on_new_file = on_new_file
        self._buffer = ""
        self._row = 0

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color=C["bg"],
            scrollbar_button_color=C["border"],
            scrollbar_button_hover_color=C["txt3"],
        )
        self._scroll.grid(row=0, column=0, sticky="nsew")
        self._scroll.grid_columnconfigure(1, weight=1)

    def _color_for(self, text):
        for pattern, color in LOG_COLOR_RULES:
            if re.search(pattern, text):
                return color
        return C["txt2"]

    def append_text(self, text):
        self._buffer += text
        lines = self._buffer.split("\n")
        self._buffer = lines[-1]
        for line in lines[:-1]:
            stripped = line.strip()
            if stripped:
                self._add_entry(stripped)

    def _add_entry(self, line):
        color = self._color_for(line)
        ts = datetime.now().strftime("%H:%M:%S")

        if self.on_success and re.search(r"✅|OK!", line):
            self.after(0, self.on_success)
        if self.on_new_file and re.search(r"📂|NOVO ARQUIVO", line):
            self.after(0, self.on_new_file)

        row_bg = C["card"] if self._row % 2 == 0 else "transparent"
        frame = ctk.CTkFrame(self._scroll, fg_color=row_bg, corner_radius=4)
        frame.grid(row=self._row, column=0, columnspan=2, sticky="ew", pady=1, padx=2)
        frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            frame, text=ts,
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=C["txt3"], width=65, anchor="w"
        ).grid(row=0, column=0, padx=(10, 6), pady=3, sticky="w")

        ctk.CTkLabel(
            frame, text=line,
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color=color, anchor="w", justify="left", wraplength=680
        ).grid(row=0, column=1, pady=3, padx=(0, 10), sticky="ew")

        self._row += 1
        self.after(20, lambda: self._scroll._parent_canvas.yview_moveto(1.0))

    def clear(self):
        for w in self._scroll.winfo_children():
            w.destroy()
        self._row = 0
        self._buffer = ""


class SmartPrintRedirector:
    def __init__(self, viewer):
        self.viewer = viewer

    def write(self, text):
        if text:
            self.viewer.after(0, self.viewer.append_text, text)

    def flush(self):
        pass


class StatCard(ctk.CTkFrame):
    def __init__(self, master, icon, label, value="0", accent=C["red"], **kwargs):
        super().__init__(master, fg_color=C["card"], corner_radius=10, **kwargs)
        self.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(self, text=icon, font=ctk.CTkFont(size=22), width=36, text_color=accent).grid(
            row=0, column=0, rowspan=2, padx=(14, 6), pady=12)
        ctk.CTkLabel(self, text=label, font=ctk.CTkFont(size=10, weight="bold"), text_color=C["txt3"]).grid(
            row=0, column=1, sticky="sw", padx=(0, 12), pady=(10, 0))
        self._val_lbl = ctk.CTkLabel(self, text=value, font=ctk.CTkFont(size=22, weight="bold"), text_color=C["txt"])
        self._val_lbl.grid(row=1, column=1, sticky="nw", padx=(0, 12), pady=(0, 10))

    def set_value(self, v):
        self._val_lbl.configure(text=str(v))


class AccordionItem(ctk.CTkFrame):
    def __init__(self, master, title, body):
        super().__init__(master, fg_color=C["card"], corner_radius=10)
        self.grid_columnconfigure(0, weight=1)
        self._open = False
        self._title = title

        self._btn = ctk.CTkButton(
            self, text=f"  ▶   {title}", anchor="w",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="transparent", hover_color=C["card2"],
            text_color=C["txt"], command=self._toggle
        )
        self._btn.grid(row=0, column=0, sticky="ew", padx=4, pady=4)

        self._body_frame = ctk.CTkFrame(self, fg_color=C["sidebar"], corner_radius=8)
        ctk.CTkLabel(
            self._body_frame, text=body,
            font=ctk.CTkFont(size=12), text_color=C["txt2"],
            justify="left", wraplength=720, anchor="w"
        ).pack(padx=16, pady=14, fill="x")

    def _toggle(self):
        if self._open:
            self._body_frame.grid_forget()
            self._btn.configure(text=f"  ▶   {self._title}")
        else:
            self._body_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 10))
            self._btn.configure(text=f"  ▼   {self._title}")
        self._open = not self._open


class BrainIAcApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Brain'IAc — Intelligence Engine")
        self.geometry("1280x820")
        self.minsize(1080, 700)
        self.configure(fg_color=C["bg"])

        self.evento_pausa = threading.Event()
        self.evento_pausa.set()
        self.evento_cancelar = threading.Event()
        self._n_videos = 0
        self._n_arquivos = 0

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)

        self._build_sidebar()
        self._build_main()

        sys.stdout = SmartPrintRedirector(self.log_viewer)
        sys.stderr = sys.stdout

        self.log_viewer.append_text("[SISTEMA] Brain'IAc Intelligence Engine conectado.\n")
        self.log_viewer.append_text("[SISTEMA] Configure a URL do canal e clique em Ligar Motor.\n")
        self._carregar_config()

    def _salvar_config(self):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump({"canal_url": self.entry_url.get().strip()}, f)
        except Exception:
            pass

    def _carregar_config(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    dados = json.load(f)
                url = dados.get("canal_url", "")
                if url:
                    self.entry_url.insert(0, url)
                    self._atualizar_canal_detectado(url)
        except Exception:
            pass

    def _atualizar_canal_detectado(self, url):
        nome = motor_sebayt.extrair_nome_canal(url) if url.strip() else "—"
        self._lbl_canal_detectado.configure(text=f"@{nome}" if url.strip() else "—")

    def _build_sidebar(self):
        sb = ctk.CTkFrame(self, width=290, corner_radius=0, fg_color=C["sidebar"])
        sb.grid(row=0, column=0, sticky="nsew")
        sb.grid_propagate(False)
        sb.grid_columnconfigure(0, weight=1)

        try:
            p = os.path.join(os.path.dirname(__file__), "logo_brainiac.png")
            img = ctk.CTkImage(Image.open(p), Image.open(p), size=(180, 110))
            ctk.CTkLabel(sb, image=img, text="").grid(row=0, column=0, pady=(24, 4))
        except Exception:
            ctk.CTkLabel(sb, text="Brain'IAc", font=ctk.CTkFont(size=26, weight="bold"), text_color=C["txt"]).grid(row=0, column=0, pady=(28, 0))
            ctk.CTkLabel(sb, text="INTELLIGENCE ENGINE", font=ctk.CTkFont(size=10, weight="bold"), text_color=C["red"]).grid(row=1, column=0, pady=(0, 2))

        ctk.CTkLabel(sb, text="by Augusto Brasil · CriAugu", font=ctk.CTkFont(size=10), text_color=C["txt3"]).grid(row=2, column=0, pady=(0, 16))
        ctk.CTkFrame(sb, height=1, fg_color=C["border"]).grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 14))

        # Canal input
        ctk.CTkLabel(sb, text="⚙  CANAL DO YOUTUBE", font=ctk.CTkFont(size=10, weight="bold"), text_color=C["txt3"]).grid(
            row=4, column=0, sticky="w", padx=18, pady=(0, 5))

        self.entry_url = ctk.CTkEntry(
            sb, placeholder_text="https://www.youtube.com/@Canal",
            fg_color=C["card"], border_color=C["border"],
            text_color=C["txt"], placeholder_text_color=C["txt3"],
            font=ctk.CTkFont(size=11), height=36, corner_radius=8
        )
        self.entry_url.grid(row=5, column=0, sticky="ew", padx=18, pady=(0, 5))
        self.entry_url.bind("<KeyRelease>", lambda e: self._atualizar_canal_detectado(self.entry_url.get()))

        self._lbl_canal_detectado = ctk.CTkLabel(sb, text="—", font=ctk.CTkFont(size=12, weight="bold"), text_color=C["red"])
        self._lbl_canal_detectado.grid(row=6, column=0, sticky="w", padx=20, pady=(0, 14))

        ctk.CTkFrame(sb, height=1, fg_color=C["border"]).grid(row=7, column=0, sticky="ew", padx=16, pady=(0, 14))

        self._card_videos = StatCard(sb, "🎬", "VÍDEOS PROCESSADOS", accent=C["purple"])
        self._card_videos.grid(row=8, column=0, sticky="ew", padx=18, pady=(0, 10))

        self._card_files = StatCard(sb, "📁", "ARQUIVOS GERADOS", accent=C["cyan"])
        self._card_files.grid(row=9, column=0, sticky="ew", padx=18, pady=(0, 16))

        ctk.CTkFrame(sb, height=1, fg_color=C["border"]).grid(row=10, column=0, sticky="ew", padx=16, pady=(0, 14))

        self.btn_start = ctk.CTkButton(
            sb, text="⚡  LIGAR MOTOR",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=C["red"], hover_color=C["red_dk"],
            height=46, corner_radius=10, command=self.iniciar_extracao
        )
        self.btn_start.grid(row=11, column=0, padx=18, pady=(0, 10), sticky="ew")

        self.btn_pause = ctk.CTkButton(
            sb, text="⏸  PAUSAR",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#7C3E00", hover_color="#5C2D00",
            height=40, corner_radius=10, command=self.pausar_extracao, state="disabled"
        )
        self.btn_pause.grid(row=12, column=0, padx=18, pady=(0, 8), sticky="ew")

        self.btn_cancel = ctk.CTkButton(
            sb, text="⏹  CANCELAR",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#4A0010", hover_color="#6B0017",
            height=40, corner_radius=10, command=self.cancelar_extracao, state="disabled"
        )
        self.btn_cancel.grid(row=13, column=0, padx=18, pady=(0, 0), sticky="ew")

        sb.grid_rowconfigure(14, weight=1)
        ctk.CTkLabel(sb, text="Brain'IAc v1.0  ·  CriAugu", font=ctk.CTkFont(size=10), text_color=C["txt3"]).grid(
            row=15, column=0, pady=(0, 14))

    def _build_main(self):
        main = ctk.CTkFrame(self, corner_radius=0, fg_color=C["bg"])
        main.grid(row=0, column=1, sticky="nsew")
        main.grid_rowconfigure(2, weight=1)
        main.grid_columnconfigure(0, weight=1)

        sc = ctk.CTkFrame(main, fg_color=C["card"], corner_radius=14)
        sc.grid(row=0, column=0, sticky="ew", padx=22, pady=(22, 12))
        sc.grid_columnconfigure(0, weight=1)

        header = ctk.CTkFrame(sc, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=22, pady=(18, 6))

        self._dot = ctk.CTkLabel(header, text="●", font=ctk.CTkFont(size=13), text_color=C["green"])
        self._dot.pack(side="left")

        self._status_title = ctk.CTkLabel(header, text="  Ocioso", font=ctk.CTkFont(size=20, weight="bold"), text_color=C["txt"])
        self._status_title.pack(side="left")

        self._status_desc = ctk.CTkLabel(sc, text="Insira a URL do canal e clique em Ligar Motor para iniciar.",
                                          font=ctk.CTkFont(size=13), text_color=C["txt2"])
        self._status_desc.grid(row=1, column=0, sticky="w", padx=22, pady=(0, 6))

        self._progress = ctk.CTkProgressBar(sc, height=5, corner_radius=4, progress_color=C["red"], fg_color=C["border"])
        self._progress.grid(row=2, column=0, sticky="ew", padx=22, pady=(4, 18))
        self._progress.set(0)

        self.tabview = ctk.CTkTabview(
            main, fg_color=C["card"], corner_radius=14,
            segmented_button_fg_color=C["sidebar"],
            segmented_button_selected_color=C["red"],
            segmented_button_selected_hover_color=C["red_dk"],
            segmented_button_unselected_color=C["sidebar"],
            segmented_button_unselected_hover_color=C["card2"],
            text_color=C["txt"],
        )
        self.tabview.grid(row=2, column=0, sticky="nsew", padx=22, pady=(0, 22))

        tab_log = self.tabview.add("  📋 Atividade  ")
        tab_faq = self.tabview.add("  🧠 Como funciona  ")

        tab_log.grid_rowconfigure(0, weight=1)
        tab_log.grid_columnconfigure(0, weight=1)
        self.log_viewer = SmartLogViewer(tab_log, on_success=self._inc_videos, on_new_file=self._inc_files)
        self.log_viewer.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)

        tab_faq.grid_rowconfigure(0, weight=1)
        tab_faq.grid_columnconfigure(0, weight=1)
        scroll = ctk.CTkScrollableFrame(tab_faq, fg_color="transparent",
                                         scrollbar_button_color=C["border"],
                                         scrollbar_button_hover_color=C["txt3"])
        scroll.grid(row=0, column=0, sticky="nsew")
        scroll.grid_columnconfigure(0, weight=1)

        FAQ = [
            ("O que é o BrainIAc?",
             "O BrainIAc é um motor de extração de conhecimento para YouTube. Você informa a URL de qualquer canal "
             "público e a ferramenta varre automaticamente Vídeos, Shorts, Podcasts, Lives, Cursos e Playlists — "
             "baixando apenas as legendas (sem baixar os vídeos) e organizando tudo em arquivos prontos para IA."),
            ("Etapa 1 — Mapeamento do Canal",
             "O motor usa o yt-dlp para mapear todas as seções do canal (Vídeos, Shorts, Podcasts, Lives, Cursos, "
             "Playlists) e monta uma lista completa com ID, título, data e visualizações de cada vídeo. "
             "Compara com o banco local e processa somente o conteúdo inédito — nunca duplica trabalho."),
            ("Etapa 2 — Extração e Chunking Local",
             "Para cada vídeo novo, baixa apenas a legenda VTT — sem baixar o arquivo de vídeo. O texto é limpo "
             "de timestamps e tags HTML, depois particionado em arquivos de até 40.000 palavras localmente. "
             "Esse fluxo evita bloqueios do YouTube e garante cópia local antes de qualquer envio para a nuvem."),
            ("Etapa 3 — Upload para o Google Drive",
             "Somente após toda a extração local estar concluída, o motor conecta ao Google Drive e sobe os "
             "arquivos como Google Docs na pasta 'BrainIAc — NomeDoCanal'. Também sincroniza o CSV de controle "
             "e um relatório de cobertura com estatísticas de cada seção do canal."),
            ("Etapa 4 — Controle Total",
             "Pausar ou Cancelar a qualquer momento pelos botões da sidebar. No cancelamento, o sistema faz "
             "Graceful Shutdown: finaliza o ciclo atual, salva o CSV e sincroniza com o Drive antes de encerrar."),
            ("Como usar com NotebookLM (gratuito)?",
             "Acesse notebooklm.google.com, crie um notebook e importe os arquivos da pasta 'Cerebro_Docs' do "
             "seu Drive. O NotebookLM cria um índice semântico com citações exatas da fonte e garante zero "
             "alucinações — pois opera exclusivamente na base que você importou."),
            ("Como usar com API Gemini (gratuita)?",
             "Os arquivos .txt gerados localmente podem ser enviados ao Google AI Studio (aistudio.google.com) "
             "sem custo. A API gratuita do Gemini suporta janelas de contexto massivas — ideal para construir "
             "agentes RAG personalizados sem nenhum custo adicional."),
            ("Configuração do Google Drive (primeira vez)",
             "Na primeira vez que clicar em Ligar Motor, uma janela do navegador abrirá pedindo autorização do "
             "Google Drive. Após autorizar, o token é salvo localmente em token.json para as próximas execuções "
             "— você não precisará reautorizar. Veja o README para criar as credenciais OAuth."),
        ]

        for i, (t, b) in enumerate(FAQ):
            AccordionItem(scroll, t, b).grid(row=i, column=0, sticky="ew", padx=10, pady=6)

    def _inc_videos(self):
        self._n_videos += 1
        self._card_videos.set_value(self._n_videos)

    def _inc_files(self):
        self._n_arquivos += 1
        self._card_files.set_value(self._n_arquivos)

    def iniciar_extracao(self):
        canal_url = self.entry_url.get().strip()
        if not canal_url:
            self._set_status("URL necessária", C["yellow"], "Insira a URL do canal antes de iniciar.")
            return
        if "youtube.com" not in canal_url and "youtu.be" not in canal_url:
            self._set_status("URL inválida", C["red"], "Use uma URL de canal do YouTube (ex: https://www.youtube.com/@Canal).")
            return

        self._salvar_config()
        self.tabview.set("  📋 Atividade  ")
        self.log_viewer.clear()
        self._n_videos = 0
        self._n_arquivos = 0
        self._card_videos.set_value(0)
        self._card_files.set_value(0)
        self.evento_cancelar.clear()
        self.evento_pausa.set()

        nome = motor_sebayt.extrair_nome_canal(canal_url)
        self.btn_start.configure(state="disabled", text="⚙  RODANDO...", fg_color=C["border"], text_color=C["txt3"])
        self.btn_pause.configure(state="normal", text="⏸  PAUSAR", fg_color="#7C3E00")
        self.btn_cancel.configure(state="normal")
        self._set_status(f"Extraindo @{nome}", C["yellow"], "Motor em operação. Use Pausar ou Cancelar a qualquer momento.")
        self._progress.configure(progress_color=C["yellow"])
        self._progress.start()

        threading.Thread(target=self._rodar_motor, args=(canal_url,), daemon=True).start()

    def pausar_extracao(self):
        if self.evento_pausa.is_set():
            self.evento_pausa.clear()
            self.btn_pause.configure(text="▶  RETOMAR", fg_color="#14532D", hover_color="#166534")
            self._set_status("Em Pausa", C["yellow"], "Motor pausado. Clique em Retomar para continuar.")
            self._progress.stop()
        else:
            self.evento_pausa.set()
            self.btn_pause.configure(text="⏸  PAUSAR", fg_color="#7C3E00", hover_color="#5C2D00")
            nome = motor_sebayt.extrair_nome_canal(self.entry_url.get().strip())
            self._set_status(f"Extraindo @{nome}", C["yellow"], "Motor em operação. Use Pausar ou Cancelar a qualquer momento.")
            self._progress.start()

    def cancelar_extracao(self):
        self.evento_cancelar.set()
        self.evento_pausa.set()
        self.btn_pause.configure(state="disabled")
        self.btn_cancel.configure(state="disabled", text="CANCELANDO...")
        self._set_status("Cancelando...", C["red"], "Fechando ciclo atual e sincronizando. Aguarde.")

    def _rodar_motor(self, canal_url):
        try:
            motor_sebayt.sebayt_engine(
                canal_url=canal_url,
                evento_pausa=self.evento_pausa,
                evento_cancelar=self.evento_cancelar
            )
            if self.evento_cancelar.is_set():
                self.after(0, self._set_status, "Interrompido", C["yellow"],
                           "Extração cancelada. Todo o progresso foi salvo no Drive.")
            else:
                self.after(0, self._set_status, "Finalizado ✓", C["green"],
                           "Base de conhecimento atualizada com sucesso no Google Drive!")
                self.after(0, lambda: self._progress.set(1))
        except Exception as e:
            self.after(0, self._set_status, "Erro Crítico", C["red"], "Falha inesperada. Consulte o log.")
            self.log_viewer.after(0, self.log_viewer.append_text, f"\n❌ ERRO CRÍTICO: {e}\n")
        finally:
            self.after(0, self._progress.stop)
            self.after(0, self._reset_ui)

    def _reset_ui(self):
        self.btn_start.configure(state="normal", text="⚡  REINICIAR MOTOR", fg_color=C["red"], text_color=C["txt"])
        self.btn_pause.configure(state="disabled", text="⏸  PAUSAR", fg_color="#7C3E00")
        self.btn_cancel.configure(state="disabled", text="⏹  CANCELAR")

    def _set_status(self, title, color, desc):
        self._dot.configure(text_color=color)
        self._status_title.configure(text=f"  {title}", text_color=color)
        self._status_desc.configure(text=desc)
        self._progress.configure(progress_color=color)


if __name__ == "__main__":
    app = BrainIAcApp()
    app.mainloop()