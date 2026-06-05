# -*- coding: utf-8 -*-
"""Adds HomeScreen render, new tab panels, and wires everything in App.jsx"""

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1. Wire showHome into the main render ─────────────────────────────────────
# Find the main return — right before the tabs header, insert home screen
# The main content area starts with <main id="main-content"

OLD_MAIN = '        {/* Main */}\n        <main id="main-content" aria-label="Área principal" className="flex-1 flex flex-col overflow-hidden relative min-w-0">'
NEW_MAIN = '''        {/* Main */}
        <main id="main-content" aria-label="Área principal" className="flex-1 flex flex-col overflow-hidden relative min-w-0">

          {/* ── Home Screen ── */}
          {showHome && (
            <HomeScreen
              darkMode={darkMode}
              history={history}
              repositorio={repositorio}
              agentStatus={agentStatus}
              btnFocus={btnFocus}
              onNavigate={(id) => { setActiveTab(id); setShowHome(false); }}
            />
          )}

          {/* ── App com Abas ── */}
          <div className={showHome ? 'hidden' : 'flex flex-col flex-1 overflow-hidden'}>'''

src = src.replace(OLD_MAIN, NEW_MAIN, 1)
print("Home wrapper added:", "showHome" in src and "Home Screen" in src)

# ── 2. Close the new wrapper div before </main> ───────────────────────────────
# Find </main> that closes the main-content
OLD_CLOSE = '        </main>'
NEW_CLOSE = '          </div>{/* end app com abas */}\n        </main>'
# Replace only the first occurrence (there should be only one)
src = src.replace(OLD_CLOSE, NEW_CLOSE, 1)
print("Close wrapper added")

# ── 3. Add Repositório and Relatório tab panels ───────────────────────────────
# Find the insertion point — after the extraction tab panel, before the agente tab
INSERT_AFTER = '''          {/* ── ABA AGENTE ── */}
          {activeTab === 'agente' && ('''

NEW_TABS_HTML = '''          {/* ── ABA REPOSITORIO ── */}
          {activeTab === 'repositorio' && (
            <div id="panel-repositorio" role="tabpanel" aria-labelledby="tab-repositorio"
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 custom-scrollbar">
              <RepositorioTab
                darkMode={darkMode}
                repositorio={repositorio}
                setRepositorio={setRepositorio}
                history={history}
                btnFocus={btnFocus}
                apiBase={API_BASE}
                onSetCanal={(url) => { setCanalInput(url); }}
              />
            </div>
          )}

          {/* ── ABA RELATORIO ── */}
          {activeTab === 'relatorio' && (
            <div id="panel-relatorio" role="tabpanel" aria-labelledby="tab-relatorio"
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 custom-scrollbar">
              <RelatorioTab
                darkMode={darkMode}
                history={history}
                btnFocus={btnFocus}
                apiBase={API_BASE}
              />
            </div>
          )}

          {/* ── ABA AGENTE ── */}
          {activeTab === 'agente' && ('''

src = src.replace(INSERT_AFTER, NEW_TABS_HTML, 1)
print("New tab panels added:", "panel-repositorio" in src)

# ── 4. Update onboarding steps ────────────────────────────────────────────────
OLD_ONBOARD = "onboarding.s1_title"
# The onboarding uses i18n keys, so we'll update locale files instead
# For now just check it's there
print("Onboarding check:", OLD_ONBOARD in src)

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("Done. Lines:", src.count('\n'))
