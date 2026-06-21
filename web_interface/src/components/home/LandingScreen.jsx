import React from 'react';
import { useTranslation } from 'react-i18next';

function LandingScreen({ darkMode, onEnter }) {
  const { t } = useTranslation();

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-[#080C18]' : 'bg-slate-50'}`}>
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <img
          src={darkMode ? '/logo_dark_mode.svg' : '/logo_light_mode.svg'}
          alt="Tusab"
          className="w-48 sm:w-64 lg:w-72 max-w-xs object-contain"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <p className={`text-sm max-w-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('home.tagline')}
        </p>
        <button
          onClick={onEnter}
          autoFocus
          className={`mt-2 px-8 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
            ${darkMode
              ? 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-offset-[#080C18]'
              : 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-offset-slate-50'}`}>
          {t('landing.enter')}
        </button>
      </div>
      <p className={`absolute bottom-6 text-[11px] ${darkMode ? 'text-slate-700' : 'text-slate-400'}`}>
        {t('home.by')}
      </p>
    </div>
  );
}

export default LandingScreen;
