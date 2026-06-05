# -*- coding: utf-8 -*-
"""Refactors layout: hide sidebar on home, collapsible sidebar on tabs"""

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# ── 1. Add sidebarCollapsed state ─────────────────────────────────────────────
src = src.replace(
    "  const [showHome,         setShowHome]         = useState(true);",
    "  const [showHome,         setShowHome]         = useState(true);\n"
    "  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);",
    1
)
print("State added:", "sidebarCollapsed" in src)

# ── 2. Update sidebar desktop: hide on home, collapsible ─────────────────────
OLD_SIDEBAR_DESKTOP = '''        {/* Sidebar desktop */}
        <aside aria-label="Painel de controle"
          className={`hidden lg:flex w-72 shrink-0 border-r flex-col px-4 pt-2 pb-3 overflow-y-auto custom-scrollbar ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <SidebarCon'''

NEW_SIDEBAR_DESKTOP = '''        {/* Sidebar desktop — hidden on home */}
        {!showHome && (
        <aside aria-label="Painel de controle"
          className={`hidden lg:flex shrink-0 border-r flex-col overflow-y-auto custom-scrollbar transition-all duration-200
            ${sidebarCollapsed ? 'w-16 px-2 pt-2 pb-3' : 'w-72 px-4 pt-2 pb-3'}
            ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          {/* Collapse toggle */}
          <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'} mb-1 shrink-0`}>
            <button onClick={() => setSidebarCollapsed(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>
              {sidebarCollapsed
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              }
            </button>
          </div>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3 pt-2">
              <button onClick={() => { setSidebarCollapsed(false); setShowHome(true); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity">
                <img src={darkMode ? '/logo_dark.png' : '/logo_light.png'} alt="Home"
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              </button>
              {['1','2','3'].map(n => (
                <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border
                  ${darkMode ? 'border-white/15 text-slate-400' : 'border-slate-200 text-slate-500'}`}>{n}</div>
              ))}
            </div>
          ) : (
          <SidebarCon'''

if OLD_SIDEBAR_DESKTOP in src:
    src = src.replace(OLD_SIDEBAR_DESKTOP, NEW_SIDEBAR_DESKTOP, 1)
    print("Sidebar desktop updated")
else:
    print("WARNING: sidebar desktop not found")
    idx = src.find('Sidebar desktop')
    print(repr(src[idx:idx+200]))

# ── 3. Close the new wrappers after SidebarContent ────────────────────────────
OLD_SIDEBAR_END = '''          <SidebarContent />
        </aside>'''

NEW_SIDEBAR_END = '''          <SidebarContent />
          )}
        </aside>
        )}'''

if OLD_SIDEBAR_END in src:
    src = src.replace(OLD_SIDEBAR_END, NEW_SIDEBAR_END, 1)
    print("Sidebar end updated")
else:
    print("WARNING: sidebar end not found")

# ── 4. Update home screen: update subtitle and center layout ──────────────────
OLD_SUBTITLE = '''        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Transforme qualquer canal do YouTube em conhecimento consultável
        </p>'''

NEW_SUBTITLE = '''        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Seu cérebro digital — YouTube, PDFs, documentos e anotações em uma base consultável
        </p>'''

if OLD_SUBTITLE in src:
    src = src.replace(OLD_SUBTITLE, NEW_SUBTITLE, 1)
    print("Subtitle updated")
else:
    # Try to find and update
    idx = src.find('Transforme qualquer canal do YouTube em conhecimento consultável')
    if idx >= 0:
        src = src.replace(
            'Transforme qualquer canal do YouTube em conhecimento consultável',
            'Seu cérebro digital — YouTube, PDFs, documentos e anotações em uma base consultável',
            1
        )
        print("Subtitle updated (simple replace)")

# ── 5. Home screen: use logo instead of emoji ─────────────────────────────────
OLD_HOME_HEADER = '''      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>BrainIAc</h1>
        </div>'''

NEW_HOME_HEADER = '''      <div className="text-center mb-10">
        <div className="flex flex-col items-center gap-2 mb-4">
          <img
            src={darkMode ? '/logo_dark.png' : '/logo_light.png'}
            alt="BrainIAc"
            style={{ width: 140, height: 140, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>'''

if OLD_HOME_HEADER in src:
    src = src.replace(OLD_HOME_HEADER, NEW_HOME_HEADER, 1)
    print("Home header updated with logo")
else:
    print("WARNING: home header not found")

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("Done. Lines:", src.count('\n'))
