import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { motion, animate } from 'framer-motion';
import { LANGS, BTN_FOCUS } from '../../constants';
import CircuitBackground from './CircuitBackground';

function usePulseLogo() {
  const [glowOpacity, setGlowOpacity] = useState(0);
  const [scale, setScale]             = useState(1);

  useEffect(() => {
    let cancelled = false;
    const pulse = async () => {
      if (cancelled) return;
      setGlowOpacity(1); setScale(1.025);
      await new Promise(r => setTimeout(r, 150));
      if (cancelled) return;
      setGlowOpacity(0.85); setScale(1.018);
      await new Promise(r => setTimeout(r, 600));
      if (cancelled) return;
      setGlowOpacity(0.5); setScale(1.010);
      await new Promise(r => setTimeout(r, 500));
      if (cancelled) return;
      setGlowOpacity(0); setScale(1);
      const pause = 2500 + Math.random() * 2500;
      await new Promise(r => setTimeout(r, pause));
      pulse();
    };
    const timer = setTimeout(pulse, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return { glowOpacity, scale };
}

function LandingScreen({ darkMode, onToggleDark, onEnter, appUpdateInfo }) {
  const { t, i18n } = useTranslation();
  const { glowOpacity, scale } = usePulseLogo();

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-[#080C18]' : 'bg-slate-100'}`}>
      <CircuitBackground darkMode={darkMode} />

      <div className="relative z-10 flex flex-col items-center gap-5 px-8 text-center">

        {/* Language + theme — acima do logo */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {LANGS.map(lng => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${BTN_FOCUS} ${
                  i18n.language?.startsWith(lng)
                    ? 'bg-primary/20 text-primary'
                    : darkMode
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>
          <span className={`w-px h-3.5 ${darkMode ? 'bg-white/10' : 'bg-slate-300'}`} />
          <button
            onClick={onToggleDark}
            aria-label={darkMode ? 'Modo claro' : 'Modo escuro'}
            className={`p-1 rounded-lg transition-colors ${BTN_FOCUS} ${
              darkMode
                ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
            }`}
          >
            {darkMode ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        {/* Logo com pulso */}
        <div className="relative" style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease-out' }}>
          <img
            src={darkMode ? '/logo_dark_mode.svg' : '/logo_light_mode.svg'}
            alt="Tusab"
            className="w-48 sm:w-64 lg:w-72 max-w-xs object-contain relative z-10"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              opacity: glowOpacity,
              transition: 'opacity 0.4s ease-out',
              background: darkMode
                ? 'radial-gradient(ellipse at center, rgba(75,159,232,0.35) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, rgba(21,88,176,0.25) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        <p className={`text-sm max-w-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('home.tagline')}
        </p>
        <button
          onClick={onEnter}
          className={`mt-1 px-8 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
            ${darkMode
              ? 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-offset-[#080C18]'
              : 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-offset-slate-100'}`}
        >
          {t('landing.enter')}
        </button>

        {/* Badge de update disponível — aparece abaixo do botão quando há nova versão */}
        {appUpdateInfo && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
            darkMode
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-amber-50 border-amber-300 text-amber-700'
          }`}>
            <span aria-hidden="true">⬆</span>
            {appUpdateInfo.downloaded
              ? `v${appUpdateInfo.version} pronto para instalar`
              : `v${appUpdateInfo.version} disponível`}
          </div>
        )}
      </div>

      <p className={`absolute bottom-6 z-10 text-[11px] ${darkMode ? 'text-slate-700' : 'text-slate-400'}`}>
        {t('home.by')}
      </p>
    </div>
  );
}

export default LandingScreen;
