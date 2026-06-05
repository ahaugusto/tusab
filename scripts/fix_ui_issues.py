# -*- coding: utf-8 -*-
"""Fix UI issues: guide update, select spacing, canal feedback"""

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1. Fix select icon spacing (add pr-8 to all <select> elements) ──────────
import re
# Find all <select> elements and ensure they have pr-8 padding
def fix_select(m):
    s = m.group(0)
    # Add pr-8 if not already present
    if 'pr-8' not in s:
        s = s.replace('px-3 py-2', 'px-3 py-2 pr-8')
    return s

src = re.sub(r'<select[^>]*>', fix_select, src)
print("Select spacing fixed")

# ── 2. Update the guide instructions ────────────────────────────────────────
OLD_STEPS = """  const steps = [
    { step: 1, color: 'primary',   text: 'Cole a URL de qualquer canal do YouTube no campo "Canal YouTube" e clique em Confirmar.' },
    { step: 2, color: 'primary',   text: 'Clique em Iniciar Extração e escolha os tipos de conteúdo. O motor baixa as legendas automaticamente.' },
    { step: 3, color: 'secondary', text: 'Na aba Agente IA, clique em Indexar Agora. Usa o Ollama local — sem chave de API necessária.' },
    { step: 4, color: 'secondary', text: 'Faça perguntas sobre o canal no chat. As respostas são baseadas exclusivamente no conteúdo extraído.' },
  ];"""

NEW_STEPS = """  const steps = [
    { step: 1, color: 'primary',   text: 'Na aba Extração, cole a URL de qualquer canal do YouTube e clique em Confirmar Canal.' },
    { step: 2, color: 'primary',   text: 'Clique em Iniciar Extração e escolha os tipos de conteúdo (vídeos, shorts, lives...). O motor baixa as legendas automaticamente.' },
    { step: 3, color: 'accent',    text: 'Na aba Repositório, veja os arquivos extraídos. Você também pode adicionar PDFs, documentos e textos à sua base de conhecimento.' },
    { step: 4, color: 'secondary', text: 'Na aba Configurar Agente, clique em Indexar Agora. O Ollama local processa tudo — sem chave de API necessária.' },
    { step: 5, color: 'secondary', text: 'Use o botão de chat (canto inferior direito) para fazer perguntas. As respostas citam sempre o vídeo de origem com data e link.' },
    { step: 6, color: 'primary',   text: 'Na aba Relatório, veja a cobertura de cada canal: quantos vídeos foram extraídos, quais falharam e por quê.' },
  ];"""

if OLD_STEPS in src:
    src = src.replace(OLD_STEPS, NEW_STEPS, 1)
    print("Guide steps updated")
else:
    print("WARNING: guide steps not found")

# Also update grid to 3 columns since we have 6 steps
src = src.replace(
    'className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl"',
    'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl"',
    1
)

# ── 3. Fix RelatorioTab: add canal feedback and fix loading state ─────────────
# The RelatorioTab already works but needs a better "canal selected" feedback
# Find the single-canal display and enhance it
OLD_SINGLE = """      {history.length === 1 && (
        <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal}</p>
      )}"""

NEW_SINGLE = """      {history.length === 1 && canal && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
            {canal[0]?.toUpperCase()}
          </div>
          <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal}</p>
        </div>
      )}"""

if OLD_SINGLE in src:
    src = src.replace(OLD_SINGLE, NEW_SINGLE, 1)
    print("Canal feedback added")
else:
    print("WARNING: single canal display not found")

# ── 4. Fix RelatorioTab loading spinner (using Loader2 instead of custom SVG) ──
OLD_SPINNER = """      {loading && (
        <div className="flex justify-center py-8">
          <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      )}"""

NEW_SPINNER = """      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}"""

if OLD_SPINNER in src:
    src = src.replace(OLD_SPINNER, NEW_SPINNER, 1)
    print("Spinner fixed")

# ── 5. Add Loader2 to GuideModal (if not already available globally) ──────────
# Loader2 is already imported globally, so no need to add it

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("All UI fixes applied. Lines:", src.count('\n'))
