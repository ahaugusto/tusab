/**
 * @file RedesCorporativas.jsx
 * @description Accordion com diagnóstico e orientações para uso do Tusab em redes corporativas.
 * @module components/agent/RedesCorporativas
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, CheckSquare, AlertTriangle, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BTN_FOCUS } from '../../constants';

const CHECKLIST = [
  { key: 'port_8001',  severity: 'high'   },
  { key: 'port_11434', severity: 'high'   },
  { key: 'youtube',    severity: 'medium' },
  { key: 'github',     severity: 'low'    },
  { key: 'antivirus',  severity: 'high'   },
  { key: 'gpo',        severity: 'medium' },
];

const SEVERITY_COLORS = {
  high:   { dot: 'bg-red-500',    badge: 'text-red-500',    badgeBg: 'bg-red-500/10'    },
  medium: { dot: 'bg-amber-500',  badge: 'text-amber-500',  badgeBg: 'bg-amber-500/10'  },
  low:    { dot: 'bg-slate-400',  badge: 'text-slate-400',  badgeBg: 'bg-slate-500/10'  },
};

function RedesCorporativas({ darkMode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="corp-heading"
      className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}
    >
      {/* Header colapsável */}
      <button
        id="corp-heading"
        aria-expanded={open}
        aria-controls="corp-body"
        onClick={() => setOpen(v => !v)}
        className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors
          ${open && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')}
          ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'} ${BTN_FOCUS}`}
      >
        <Building2 size={14} className="text-amber-500 shrink-0" aria-hidden="true" />
        <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
          {t('corp.section_title')}
        </h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mr-2
          ${darkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
          {t('corp.badge')}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="corp-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-5 space-y-5">

              {/* Intro */}
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('corp.intro')}
              </p>

              {/* Checklist de diagnóstico */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckSquare size={12} className="text-amber-500" />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('corp.checklist_title')}
                  </p>
                </div>
                <div className={`rounded-xl border divide-y overflow-hidden
                  ${darkMode ? 'border-white/8 divide-white/8' : 'border-slate-100 divide-slate-100'}`}>
                  {CHECKLIST.map(({ key, severity }) => {
                    const colors = SEVERITY_COLORS[severity];
                    return (
                      <div key={key} className={`flex items-start gap-3 px-4 py-3 ${darkMode ? 'bg-white/2' : 'bg-white'}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {t(`corp.check_${key}_title`)}
                          </p>
                          <p className={`text-[10px] leading-relaxed mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            {t(`corp.check_${key}_desc`)}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-1 uppercase tracking-wide ${colors.badge} ${colors.badgeBg}`}>
                          {t(`corp.severity_${severity}`)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* O que pedir ao TI */}
              <div className={`rounded-xl border p-4 space-y-2
                ${darkMode ? 'border-white/8 bg-white/3' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <ClipboardList size={12} className={darkMode ? 'text-slate-400' : 'text-slate-500'} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('corp.it_title')}
                  </p>
                </div>
                {['it_item1', 'it_item2', 'it_item3'].map(k => (
                  <div key={k} className="flex items-start gap-2">
                    <span className={`text-[10px] mt-0.5 shrink-0 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>→</span>
                    <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t(`corp.${k}`)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Aviso de limitação */}
              <div className={`flex items-start gap-2 p-3 rounded-xl
                ${darkMode ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-amber-400/80' : 'text-amber-700'}`}>
                  {t('corp.disclaimer')}
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default RedesCorporativas;
