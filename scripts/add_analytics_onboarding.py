# -*- coding: utf-8 -*-
"""
Adds Posthog analytics (opt-in) and contextual onboarding to App.jsx.
Run once from the project root.
"""
import re

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1. Imports ────────────────────────────────────────────────────────────────
src = src.replace(
    "import { API_BASE, BTN_FOCUS } from './constants';",
    "import { API_BASE, BTN_FOCUS } from './constants';\n"
    "import { initAnalytics, getConsent, Analytics } from './services/analytics';\n"
    "import { useOnboarding } from './hooks/useOnboarding';\n"
    "import ConsentModal from './components/shared/ConsentModal';\n"
    "import ProgressToast from './components/shared/ProgressToast';",
    1
)

# ── 2. States ─────────────────────────────────────────────────────────────────
src = src.replace(
    "  const [buscaAmpla,       setBuscaAmpla]       = useState(false);",
    "  const [buscaAmpla,       setBuscaAmpla]       = useState(false);\n"
    "  const [showConsent,      setShowConsent]      = useState(() => getConsent() === null);\n"
    "  const [progressToast,    setProgressToast]    = useState(null);\n"
    "  const { seen, markSeen, KEYS } = useOnboarding();",
    1
)

# ── 3. Init analytics on mount ────────────────────────────────────────────────
src = src.replace(
    "  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);",
    "  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);\n\n"
    "  useEffect(() => { initAnalytics(); Analytics.appOpened(); }, []);",
    1
)

# ── 4. Track canal configurado ────────────────────────────────────────────────
src = src.replace(
    "    Analytics.canalConfigurado(canalInput);\n    setConfigurando(false);\n  };",
    "    Analytics.canalConfigurado(canalInput);\n    setConfigurando(false);\n  };",
    1
)
# Add tracking if not already there
if "Analytics.canalConfigurado" not in src:
    src = src.replace(
        "    setConfigurando(false);\n  };",
        "    Analytics.canalConfigurado(canalInput);\n    setConfigurando(false);\n  };",
        1
    )

# ── 5. Fix indexing useEffect: add toast + analytics ─────────────────────────
OLD_EFFECT = (
    "    if (!agentStatus.indexing && agentStatus.index_logs.length > 0) {\n"
    "      setLastIndexLogs(agentStatus.index_logs);\n"
    "    }\n"
    "  }, [agentStatus.indexing, agentStatus.index_logs]);"
)
NEW_EFFECT = (
    "    if (!agentStatus.indexing && agentStatus.index_logs.length > 0) {\n"
    "      setLastIndexLogs(agentStatus.index_logs);\n"
    "      if (!seen(KEYS.indexDone)) {\n"
    "        markSeen(KEYS.indexDone);\n"
    "        Analytics.baseIndexada(agentStatus.index_count);\n"
    "        setProgressToast({\n"
    "          message: `Base indexada — ${agentStatus.index_count} chunks prontos!`,\n"
    "          nextStep: 'Abrir chat',\n"
    "          onNext: () => setChatOpen(true),\n"
    "        });\n"
    "      }\n"
    "    }\n"
    "  }, [agentStatus.indexing, agentStatus.index_logs]);"
)
if OLD_EFFECT in src:
    src = src.replace(OLD_EFFECT, NEW_EFFECT, 1)
    print("Indexing effect: OK")
else:
    print("WARNING: indexing effect not found")

# ── 6. Track tab navigation ───────────────────────────────────────────────────
OLD_TAB = (
    "                  if (id === 'agente' && !localStorage.getItem('brainiac_agent_visited')) {\n"
    "                    setShowAgentHint(true);\n"
    "                    localStorage.setItem('brainiac_agent_visited', '1');\n"
    "                  }\n"
    "                }}"
)
NEW_TAB = (
    "                  if (id === 'agente' && !localStorage.getItem('brainiac_agent_visited')) {\n"
    "                    setShowAgentHint(true);\n"
    "                    localStorage.setItem('brainiac_agent_visited', '1');\n"
    "                  }\n"
    "                  if (id === 'repositorio') { Analytics.repositorioAcessado(); }\n"
    "                  if (id === 'relatorio')   { Analytics.relatorioAcessado(); }\n"
    "                }}"
)
if OLD_TAB in src:
    src = src.replace(OLD_TAB, NEW_TAB, 1)
    print("Tab tracking: OK")
else:
    print("WARNING: tab tracking not found")

# ── 7. ConsentModal + ProgressToast in render ─────────────────────────────────
CONSENT_BLOCK = (
    "      {/* Analytics consent — shown once on first launch */}\n"
    "      <AnimatePresence>\n"
    "        {showConsent && (\n"
    "          <ConsentModal key=\"consent\" darkMode={darkMode} onDone={() => setShowConsent(false)} />\n"
    "        )}\n"
    "      </AnimatePresence>\n\n"
    "      {/* Progress toast — contextual next-step guidance */}\n"
    "      <AnimatePresence>\n"
    "        {progressToast && (\n"
    "          <ProgressToast\n"
    "            key=\"progress-toast\"\n"
    "            darkMode={darkMode}\n"
    "            message={progressToast.message}\n"
    "            nextStep={progressToast.nextStep}\n"
    "            onNext={progressToast.onNext}\n"
    "            onClose={() => setProgressToast(null)}\n"
    "          />\n"
    "        )}\n"
    "      </AnimatePresence>\n\n"
)
INSERT_BEFORE = "      <AnimatePresence>\n        {showOnboarding && <Onboarding"
if INSERT_BEFORE in src:
    src = src.replace(INSERT_BEFORE, CONSENT_BLOCK + INSERT_BEFORE, 1)
    print("Consent+Toast render: OK")
else:
    print("WARNING: insert point for modals not found")

# ── 8. Repositório contextual hint ────────────────────────────────────────────
REPO_HINT = (
    "                {!seen(KEYS.repositorio) && (\n"
    "                  <div className={`mb-4 p-3 rounded-xl border flex items-start gap-2.5 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>\n"
    "                    <span className=\"text-base shrink-0\">\U0001f4a1</span>\n"
    "                    <div className=\"flex-1\">\n"
    "                      <p className={`text-xs font-bold mb-0.5 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Seu repositório de conhecimento</p>\n"
    "                      <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Aqui ficam os arquivos do YouTube. Use <strong>+ Adicionar</strong> para incluir PDFs, Word, Markdown ou colar texto.</p>\n"
    "                    </div>\n"
    "                    <button onClick={() => markSeen(KEYS.repositorio)} className={`p-1 rounded text-xs shrink-0 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>\n"
    "                  </div>\n"
    "                )}\n"
)
INSERT_REPO = "                <RepositorioTab"
if INSERT_REPO in src:
    src = src.replace(INSERT_REPO, REPO_HINT + INSERT_REPO, 1)
    print("Repositório hint: OK")
else:
    print("WARNING: RepositorioTab insert point not found")

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print(f"\nDone. Lines: {src.count(chr(10))}")
