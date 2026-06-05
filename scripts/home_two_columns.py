# -*- coding: utf-8 -*-
"""Refactors HomeScreen to two-column layout: logo left, cards right"""

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# Find the HomeScreen render block boundaries
start = src.find("    <div className={`flex-1 flex flex-col items-center justify-center")
end   = src.find("\nfunction ", start)

old_block = src[start:end]

new_block = r"""    <div className={`flex-1 flex overflow-hidden ${darkMode ? 'bg-[#080C18]' : 'bg-slate-50'}`}>

      {/* Left — Logo */}
      <div className={`hidden lg:flex flex-col items-center justify-center w-1/2 px-12 border-r ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
        <button onClick={() => {}}
          className="focus-visible:outline-none rounded-2xl transition-opacity hover:opacity-90">
          <img
            src={darkMode ? '/logo_dark.png' : '/logo_light.png'}
            alt="BrainIAc — Intelligence Engine"
            style={{ width: 340, height: 340, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </button>
        <p className={`mt-4 text-sm text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Seu cérebro digital — YouTube, PDFs, documentos e anotações em uma base consultável
        </p>
      </div>

      {/* Right — Cards + footer */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-10 overflow-y-auto">

        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center mb-8">
          <img
            src={darkMode ? '/logo_dark.png' : '/logo_light.png'}
            alt="BrainIAc"
            style={{ width: 140, height: 140, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>

        <div className="w-full max-w-md space-y-3">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className={`relative w-full p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnFocus}
                ${card.primary
                  ? darkMode ? 'bg-primary/15 border-primary/30 hover:bg-primary/20' : 'bg-violet-50 border-violet-200 hover:bg-violet-100'
                  : darkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
              {card.badge && (
                <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full
                  ${card.color === 'secondary' ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
                    : darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                  {card.badge}
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{card.icon}</span>
                <div>
                  <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer controls */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`flex items-center rounded-lg border px-2 py-1.5 gap-1.5 ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-slate-500' : 'text-slate-500'}>
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
              </svg>
              <select value={currentLang} onChange={e => onChangeLang(e.target.value)}
                className={`text-[11px] font-bold bg-transparent border-none outline-none cursor-pointer pr-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <option value="pt">PT</option>
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </div>
            <button onClick={onToggleTheme}
              className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              {darkMode
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
          </div>
          <p className={`text-[11px] ${darkMode ? 'text-slate-700' : 'text-slate-400'}`}>
            Produzido por CriAugu
          </p>
        </div>

      </div>
    </div>

"""

src = src[:start] + new_block + src[end:]

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("Done. Lines:", src.count('\n'))
