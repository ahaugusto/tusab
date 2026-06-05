/**
 * @file ProgressToast.jsx
 * @description Contextual progress toast — shown after key actions to guide
 *   the user to the next step in the onboarding flow.
 * @module components/shared/ProgressToast
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ProgressToast — contextual "next step" notification after a key action
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode      - dark/light theme flag
 * @param {string}   props.message       - success message
 * @param {string}   [props.nextStep]    - optional next action label
 * @param {Function} [props.onNext]      - callback for next action button
 * @param {Function} props.onClose       - callback to dismiss
 * @param {number}   [props.autoClose=6000] - ms before auto-dismiss (0 = manual)
 * @returns {JSX.Element}
 */
function ProgressToast({ darkMode, message, nextStep, onNext, onClose, autoClose = 6000 }) {
  useEffect(() => {
    if (!autoClose) return;
    const t = setTimeout(onClose, autoClose);
    return () => clearTimeout(t);
  }, [autoClose, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-24 right-6 z-50 max-w-xs rounded-2xl border p-4 shadow-2xl
        ${darkMode ? 'bg-[#0C1122] border-secondary/30' : 'bg-white border-emerald-200 shadow-emerald-100/60'}`}>
      <div className="flex items-start gap-3">
        <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-slate-800'}`}>{message}</p>
          {nextStep && (
            <button
              onClick={() => { onNext?.(); onClose(); }}
              className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
              {nextStep} <ArrowRight size={10} />
            </button>
          )}
        </div>
        <button onClick={onClose}
          className={`p-0.5 rounded transition-colors shrink-0 ${darkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export default ProgressToast;
