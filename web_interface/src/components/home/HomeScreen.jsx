/**
 * @file HomeScreen.jsx
 * @description Landing / home screen with two source paths and utility navigation cards
 * @module components/home/HomeScreen
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

function HomeScreen({ darkMode, history, repositorio, agentStatus, btnFocus, onNavigate, onAddFiles, onToggleTheme, onChangeLang }) {
  const { t, i18n: homeI18n } = useTranslation();
  const currentLang = homeI18n.language.startsWith('pt') ? 'pt' : homeI18n.language.startsWith('en') ? 'en' : 'es';

  const totalDocs    = (repositorio.documentos?.length || 0) + (repositorio.textos?.length || 0);
  const totalArquivos = (repositorio.youtube?.length || 0) + totalDocs;
  const totalCanais  = history.length;
  const configured   = agentStatus.configured;
  const indexed      = agentStatus.canais_indexados?.length > 0;

  // ── Source cards (top, side-by-side) ──────────────────────────────────────
  const sourcePrimary = darkMode
    ? 'bg-primary/15 border-primary/30 hover:bg-primary/20'
    : 'bg-violet-50 border-violet-200 hover:bg-violet-100';
  const sourceSecondary = darkMode
    ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20'
    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300';

  const sourceCards = [
    {
      id:     'youtube',
      icon:   '📺',
      title:  t('home.source_youtube_title'),
      desc:   totalCanais > 0
        ? t('home.card_extract_done', { count: totalCanais })
        : t('home.source_youtube_desc'),
      badge:  totalCanais > 0 ? String(totalCanais) : null,
      style:  sourcePrimary,
      action: () => onNavigate('extracao'),
    },
    {
      id:     'arquivos',
      icon:   '📄',
      title:  t('home.source_files_title'),
      desc:   totalDocs > 0
        ? t('home.card_repo_done', { count: totalDocs })
        : t('home.source_files_desc'),
      badge:  totalDocs > 0 ? String(totalDocs) : null,
      style:  sourceSecondary,
      action: onAddFiles,
    },
  ];

  // ── Utility cards (below) ─────────────────────────────────────────────────
  const utilityCards = [
    {
      id:     'repositorio',
      icon:   '📚',
      title:  t('home.card_repo_title'),
      desc:   totalArquivos > 0 ? t('home.card_repo_done', { count: totalArquivos }) : t('home.card_repo_desc'),
      badge:  totalArquivos > 0 ? String(totalArquivos) : null,
      color:  'accent',
    },
    {
      id:     'relatorio',
      icon:   '📊',
      title:  t('home.card_report_title'),
      desc:   totalCanais > 0 ? t('home.card_report_done', { count: totalCanais }) : t('home.card_report_desc'),
      badge:  totalCanais > 0 ? String(totalCanais) : null,
      color:  'secondary',
    },
    {
      id:     'agente',
      icon:   '⚙️',
      title:  t('home.card_agent_title'),
      desc:   configured ? (indexed ? t('home.card_agent_ready') : t('home.card_agent_index')) : t('home.card_agent_desc'),
      badge:  configured ? '✓' : null,
      color:  configured && indexed ? 'secondary' : 'primary',
    },
  ];

  const badgeClass = (color) => color === 'secondary'
    ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
    : darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700';

  return (
    <div className={`flex-1 flex overflow-hidden ${darkMode ? 'bg-[#080C18]' : 'bg-slate-50'}`}>

      {/* Left — logo (desktop only) */}
      <div className={`hidden lg:flex flex-col items-center justify-center w-1/2 px-12 border-r ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
        <button onClick={() => {}} className="focus-visible:outline-none rounded-2xl transition-opacity hover:opacity-90">
          <img
            src={darkMode ? '/logo_dark.png?v=2' : '/logo_light.png?v=2'}
            alt="Brain'IAC — Index.Augment.Converse"
            style={{ width: 340, height: 340, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </button>
        <p className={`mt-4 text-sm text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('home.tagline')}
        </p>
      </div>

      {/* Right — cards + footer */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-10 overflow-y-auto">

        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center mb-8">
          <img
            src={darkMode ? '/logo_dark.png?v=2' : '/logo_light.png?v=2'}
            alt="Brain'IAC"
            style={{ width: 140, height: 140, objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>

        <div className="w-full max-w-md space-y-4">

          {/* ── Source section ── */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('home.section_source')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {sourceCards.map(card => (
                <button
                  key={card.id}
                  onClick={card.action}
                  className={`relative p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${btnFocus} ${card.style}`}>
                  {card.badge && (
                    <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass('primary')}`}>
                      {card.badge}
                    </span>
                  )}
                  <span className="text-2xl block mb-2">{card.icon}</span>
                  <p className={`text-xs font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
                  <p className={`text-[10px] mt-1 leading-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Utility section ── */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('home.section_manage')}
            </p>
            <div className="space-y-2">
              {utilityCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => onNavigate(card.id)}
                  className={`relative w-full p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnFocus}
                    ${darkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                  {card.badge && (
                    <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass(card.color)}`}>
                      {card.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{card.icon}</span>
                    <div>
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
                      <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

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
              aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              {darkMode
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
          </div>
          <p className={`text-[11px] ${darkMode ? 'text-slate-700' : 'text-slate-400'}`}>
            {t('home.by')}
          </p>
        </div>

      </div>
    </div>
  );
}

export default HomeScreen;
