# -*- coding: utf-8 -*-
"""Adds Home screen, Repositorio tab, Relatorio tab to BrainIAc App.jsx"""
import re, sys

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 0. Add new states ────────────────────────────────────────────────────────
src = src.replace(
    "  const [showHome,         setChatOpen]         = useState(false);",
    "",  # remove if duplicate from prior attempt
    1
)
src = src.replace(
    "  const [chatOpen,         setChatOpen]         = useState(false);",
    "  const [showHome,         setShowHome]         = useState(true);\n"
    "  const [chatOpen,         setChatOpen]         = useState(false);\n"
    "  const [repositorio,      setRepositorio]      = useState({ youtube: [], documentos: [], textos: [] });\n"
    "  const [relatorioCanal,   setRelatorioCanal]   = useState('');\n"
    "  const [relatorioData,    setRelatorioData]    = useState(null);\n"
    "  const [showAddDoc,       setShowAddDoc]       = useState(false);\n"
    "  const [pasteTitle,       setPasteTitle]       = useState('');\n"
    "  const [pasteText,        setPasteText]        = useState('');",
    1
)
print("States added:", "showHome" in src)

# ── 1. Fetch repositorio on mount ────────────────────────────────────────────
OLD_HIST = "  useEffect(() => {\n    axios.get(`${API_BASE}/history`).then(r => setHistory(r.data)).catch(() => {});\n  }, []);"
NEW_HIST = (
    "  useEffect(() => {\n"
    "    axios.get(`${API_BASE}/history`).then(r => setHistory(r.data)).catch(() => {});\n"
    "    axios.get(`${API_BASE}/repositorio`).then(r => setRepositorio(r.data)).catch(() => {});\n"
    "  }, []);"
)
src = src.replace(OLD_HIST, NEW_HIST, 1)
print("Fetch repositorio:", "repositorio" in src)

# ── 2. Update tabs array ─────────────────────────────────────────────────────
OLD_TABS = "{ id: 'extracao', label: t('tabs.extraction'), icon: Zap,  panel: 'panel-extracao' },\n              { id: 'agente',   label: t('tabs.agent'),      icon: Settings,  panel: 'panel-agente'   },"
NEW_TABS = (
    "{ id: 'extracao',    label: t('tabs.extraction'), icon: Zap,       panel: 'panel-extracao'    },\n"
    "              { id: 'repositorio', label: 'Repositório',           icon: BookOpen,  panel: 'panel-repositorio' },\n"
    "              { id: 'relatorio',   label: 'Relatório',             icon: BarChart3, panel: 'panel-relatorio'   },\n"
    "              { id: 'agente',      label: t('tabs.agent'),         icon: Settings,  panel: 'panel-agente'      },"
)
src = src.replace(OLD_TABS, NEW_TABS, 1)
print("Tabs updated:", "repositorio" in src)

# ── 3. Add handleUseCanal (refactor for use from home) ────────────────────────
# Already handled inline in history cards

print("Writing file...")
with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("Phase 1 done. Lines:", src.count('\n'))
