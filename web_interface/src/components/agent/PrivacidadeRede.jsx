/**
 * @file PrivacidadeRede.jsx
 * @description Seção colapsável de privacidade e rede na aba Agente.
 *   Exibe transparência sobre quando/por que o app usa internet,
 *   e oferece toggle para desabilitar o electron-updater.
 * @module components/agent/PrivacidadeRede
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ChevronDown, Wifi, WifiOff, Globe, PlayCircle, Download, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BTN_FOCUS } from '../../constants';

const IS_ELECTRON = !!window.tusab?.getUpdatePref;

function PrivacidadeRede({ darkMode }) {
  const { t } = useTranslation();
  const [open, setOpen]               = useState(false);
  const [updateEnabled, setUpdateEnabled] = useState(true);
  const [saving, setSaving]           = useState(false);

  // Carrega a preferência salva ao abrir
  useEffect(() => {
    if (!IS_ELECTRON || !open) return;
    window.tusab.getUpdatePref().then(v => setUpdateEnabled(v));
  }, [open]);

  const handleToggleUpdate = async () => {
    if (!IS_ELECTRON) return;
    setSaving(true);
    const next = !updateEnabled;
    await window.tusab.setUpdatePref(next).catch(() => {});
    setUpdateEnabled(next);
    setSaving(false);
  };

  // Descrição de cada conexão de rede que o app faz
  const CONEXOES = [
    {
      icon: PlayCircle,
      color: 'text-red-500',
      bg: darkMode ? 'bg-red-500/10' : 'bg-red-50',
      title: t('privacy.conn_youtube_title'),
      desc:  t('privacy.conn_youtube_desc'),
      sempre: true,
    },
    {
      icon: Globe,
      color: 'text-violet-500',
      bg: darkMode ? 'bg-violet-500/10' : 'bg-violet-50',
      title: t('privacy.conn_llm_title'),
      desc:  t('privacy.conn_llm_desc'),
      sempre: false,
    },
    {
      icon: Download,
      color: 'text-cyan-500',
      bg: darkMode ? 'bg-cyan-500/10' : 'bg-cyan-50',
      title: t('privacy.conn_update_title'),
      desc:  t('privacy.conn_update_desc'),
      sempre: false,
    },
    {
      icon: KeyRound,
      color: 'text-emerald-500',
      bg: darkMode ? 'bg-emerald-500/10' : 'bg-emerald-50',
      title: t('privacy.conn_drive_title'),
      desc:  t('privacy.conn_drive_desc'),
      sempre: false,
    },
  ];

  return (
    <section
      aria-labelledby="privacy-heading"
      className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}
    >
      {/* Header colapsável */}
      <button
        id="privacy-heading"
        aria-expanded={open}
        aria-controls="privacy-body"
        onClick={() => setOpen(v => !v)}
        className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors
          ${open && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')}
          ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'} ${BTN_FOCUS}`}
      >
        <ShieldCheck size={14} className="text-emerald-500 shrink-0" aria-hidden="true" />
        <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
          {t('privacy.section_title')}
        </h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2
          ${darkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
          {t('privacy.local_first_badge')}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="privacy-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-5 space-y-5">

              {/* Princípio base */}
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('privacy.principle')}
              </p>

              {/* Tabela de conexões */}
              <div className={`rounded-xl border divide-y overflow-hidden
                ${darkMode ? 'border-white/8 divide-white/8' : 'border-slate-100 divide-slate-100'}`}>
                {CONEXOES.map(({ icon: Icon, color, bg, title, desc, sempre }) => (
                  <div key={title} className={`flex items-start gap-3 px-4 py-3 ${darkMode ? 'bg-white/2' : 'bg-white'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                      <Icon size={13} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{title}</p>
                      <p className={`text-[10px] leading-relaxed mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{desc}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-1 uppercase tracking-wide
                      ${sempre
                        ? darkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                        : darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {sempre ? t('privacy.badge_always') : t('privacy.badge_optional')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Toggle electron-updater — só visível dentro do Electron */}
              {IS_ELECTRON && (
                <div className={`rounded-xl border p-4 space-y-3
                  ${darkMode ? 'border-white/8 bg-white/3' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                      ${updateEnabled
                        ? darkMode ? 'bg-cyan-500/15' : 'bg-cyan-50'
                        : darkMode ? 'bg-white/8' : 'bg-slate-100'}`}>
                      {updateEnabled
                        ? <Wifi size={13} className="text-cyan-500" />
                        : <WifiOff size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {t('privacy.updater_title')}
                      </p>
                      <p className={`text-[10px] leading-relaxed mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        {updateEnabled ? t('privacy.updater_desc_on') : t('privacy.updater_desc_off')}
                      </p>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={handleToggleUpdate}
                      disabled={saving}
                      role="switch"
                      aria-checked={updateEnabled}
                      aria-label={t('privacy.updater_aria')}
                      className={`w-9 h-5 rounded-full flex items-center shrink-0 transition-colors px-0.5 disabled:opacity-50 ${BTN_FOCUS}
                        ${updateEnabled
                          ? 'bg-cyan-500 justify-end'
                          : darkMode ? 'bg-white/15 justify-start' : 'bg-slate-300 justify-start'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>

                  {/* Aviso quando desativado */}
                  {!updateEnabled && (
                    <p className={`text-[10px] leading-relaxed pl-10
                      ${darkMode ? 'text-amber-400/80' : 'text-amber-700'}`}>
                      ⚠ {t('privacy.updater_warning')}
                    </p>
                  )}
                </div>
              )}

              {/* Nota final */}
              <p className={`text-[10px] text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('privacy.footer_note')}
              </p>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default PrivacidadeRede;
