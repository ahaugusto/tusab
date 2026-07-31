/**
 * @file ConsentModal.jsx
 * @description Data disclosure notice shown once on first launch.
 *   Covers all three data flows: analytics (opt-in), external APIs, Drive OAuth.
 *   Serves as the product's lightweight privacy notice until a formal policy is published.
 * @module components/shared/ConsentModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BarChart2, Globe, HardDrive, ShieldCheck } from 'lucide-react';
import { acceptAnalytics, declineAnalytics } from '../../services/analytics';
import { useAriaHidden } from '../../hooks/useAriaHidden';

// ─── Data flows disclosed ─────────────────────────────────────────────────────

function getFlows(t) {
  return [
    {
      icon: BarChart2,
      color: 'text-primary',
      bg:    'bg-primary/10',
      title: t('consent.flow_telemetry_title'),
      desc:  t('consent.flow_telemetry_desc'),
    },
    {
      icon: Globe,
      color: 'text-amber-500',
      bg:    'bg-amber-500/10',
      title: t('consent.flow_apis_title'),
      desc:  t('consent.flow_apis_desc'),
    },
    {
      icon: HardDrive,
      color: 'text-emerald-500',
      bg:    'bg-emerald-500/10',
      title: t('consent.flow_drive_title'),
      desc:  t('consent.flow_drive_desc'),
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ConsentModal — data disclosure notice + analytics opt-in
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode  - dark/light theme flag
 * @param {Function} props.onDone    - called after accept or decline
 * @returns {JSX.Element}
 */
function ConsentModal({ darkMode, onDone, zIndex = 'z-50', skipAriaHidden = false }) {
  const { t } = useTranslation();
  const FLOWS = getFlows(t);
  const [expanded, setExpanded] = useState(false);
  const firstBtnRef = useRef(null);
  useAriaHidden(!skipAriaHidden);

  const handleAccept  = () => { acceptAnalytics();  onDone(); };
  const handleDecline = () => { declineAnalytics(); onDone(); };

  // Foca o primeiro botão ao montar e fecha com Escape (decline implícito)
  useEffect(() => {
    firstBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') handleDecline(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const base   = darkMode ? 'bg-[#0C1122] border-white/15 text-white'    : 'bg-white border-slate-200 text-slate-900';
  const muted  = darkMode ? 'text-slate-400'                              : 'text-slate-500';
  const rowBg  = darkMode ? 'bg-white/5'                                  : 'bg-slate-50';

  // Portal para document.body: bottom-sheet deliberado (sem backdrop), mas fora
  // da árvore do #root para nenhum stacking context pai anular o zIndex
  // (classe de bug da v1.0.13 — landing z-[9999] engolia o fixed z-50 interno)
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${zIndex} w-full max-w-md px-4`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className={`rounded-2xl border shadow-2xl overflow-hidden ${base}`}>

        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-3 mb-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-white/8' : 'bg-slate-100'} shrink-0`}>
              <ShieldCheck size={17} className="text-primary" />
            </div>
            <div>
              <p id="consent-title" className="text-sm font-bold">{t('consent.title')}</p>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${muted}`}>
                {t('consent.intro')}
              </p>
            </div>
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={`flex items-center gap-1 text-[11px] font-semibold ${muted} hover:text-primary transition-colors`}>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? t('consent.hide_details') : t('consent.show_details')}
          </button>
        </div>

        {/* Expandable detail rows */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}>
              <div className={`mx-5 mb-4 rounded-xl overflow-hidden border ${darkMode ? 'border-white/8' : 'border-slate-200'}`}>
                {FLOWS.map(({ icon: Icon, color, bg, title, desc }, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 px-3 py-3 ${i < FLOWS.length - 1 ? (darkMode ? 'border-b border-white/8' : 'border-b border-slate-100') : ''}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${bg}`}>
                      <Icon size={12} className={color} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold">{title}</p>
                      <p className={`text-[10px] leading-relaxed mt-0.5 ${muted}`}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics consent question */}
        <div className={`px-5 pt-0 pb-5 border-t ${darkMode ? 'border-white/8' : 'border-slate-100'} mt-1`}>
          <p className={`text-[11px] font-semibold mt-3 mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('consent.question')}
          </p>
          <div className="flex gap-2">
            <button
              ref={firstBtnRef}
              onClick={handleAccept}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30">
              {t('consent.accept')}
            </button>
            <button
              onClick={handleDecline}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              {t('consent.decline')}
            </button>
          </div>
          <p className={`text-[10px] mt-2 text-center ${muted}`}>
            {t('consent.footer_note')}
          </p>
        </div>

      </div>
    </motion.div>,
    document.body
  );
}

export default ConsentModal;
