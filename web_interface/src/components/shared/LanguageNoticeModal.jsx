/**
 * @file LanguageNoticeModal.jsx
 * @description Notice shown when the user switches UI language, explaining that
 *   already-extracted content isn't translated and that chat replies follow the
 *   language the user writes in, not the UI language. Shown every time the
 *   language changes until the user clicks "Ciente" (localStorage flag).
 * @module components/shared/LanguageNoticeModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

const STORAGE_KEY = 'tusab_language_notice_ciente';

/** Returns whether the user already acknowledged the language notice */
export function hasAckedLanguageNotice() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

/** Marks the language notice as acknowledged — never shown again */
export function markLanguageNoticeAcked() {
  localStorage.setItem(STORAGE_KEY, '1');
}

function LanguageNoticeModal({ open, darkMode, onClose }) {
  const { t } = useTranslation();
  const base = darkMode
    ? 'bg-slate-900 border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const handleCiente = () => {
    markLanguageNoticeAcked();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper onClose={onClose} zIndex="z-50" backdrop="bg-black/50 backdrop-blur-sm" label={t('language_notice.aria_label')}>
          <motion.div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${base}`}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/15 shrink-0">
                <Languages size={20} className="text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold text-base">{t('language_notice.title')}</h2>
              </div>
            </div>

            <ul className="space-y-2.5">
              <li className={`text-sm leading-relaxed flex gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className="text-primary shrink-0">•</span>
                {t('language_notice.content_not_translated')}
              </li>
              <li className={`text-sm leading-relaxed flex gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className="text-primary shrink-0">•</span>
                {t('language_notice.chat_follows_input')}
              </li>
            </ul>

            <button
              onClick={handleCiente}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
              {t('language_notice.ciente')}
            </button>

          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}

export default LanguageNoticeModal;
