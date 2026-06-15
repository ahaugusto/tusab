/**
 * @file GuideModal.jsx
 * @description Step-by-step usage guide modal overlay
 * @module components/shared/GuideModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * GuideModal — displays a 6-step how-to guide in a modal overlay
 *
 * @param {Object} props
 * @param {Function} props.onClose - callback to close the modal
 * @param {boolean} props.darkMode - dark/light theme flag
 * @returns {JSX.Element}
 */
function GuideModal({ onClose, darkMode }) {
  const { t } = useTranslation();

  const steps = [
    { step: 1, color: 'primary',   text: t('guide.step1') },
    { step: 2, color: 'primary',   text: t('guide.step2') },
    { step: 3, color: 'accent',    text: t('guide.step3') },
    { step: 4, color: 'secondary', text: t('guide.step4') },
    { step: 5, color: 'secondary', text: t('guide.step5') },
    { step: 6, color: 'primary',   text: t('guide.step6') },
  ];

  return (
    <ModalWrapper onClose={onClose} label={t('guide.title')}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-2xl p-6 max-w-2xl w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0" aria-hidden="true">
              <HelpCircle size={16} className="text-primary" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('guide.title')}</h2>
              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('guide.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
            aria-label="Fechar guia">
            <X size={16} />
          </button>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map(({ step, color, text }) => (
            <div key={step} className={`flex gap-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
              <div className={`w-5 h-5 rounded-full bg-${color}/20 text-${color} flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5`} aria-hidden="true">{step}</div>
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </ModalWrapper>
  );
}

export default GuideModal;
