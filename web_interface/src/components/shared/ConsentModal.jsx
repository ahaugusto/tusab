/**
 * @file ConsentModal.jsx
 * @description Analytics consent modal — shown once on first launch.
 *   User must explicitly accept or decline before any tracking occurs.
 * @module components/shared/ConsentModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { motion } from 'framer-motion';
import { acceptAnalytics, declineAnalytics } from '../../services/analytics';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ConsentModal — opt-in analytics consent dialog
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode  - dark/light theme flag
 * @param {Function} props.onDone    - called after accept or decline
 * @returns {JSX.Element}
 */
function ConsentModal({ darkMode, onDone }) {
  const handleAccept = () => { acceptAnalytics(); onDone(); };
  const handleDecline = () => { declineAnalytics(); onDone(); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div className={`rounded-2xl border p-5 shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xl shrink-0">📊</span>
          <div>
            <p className={`text-sm font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Ajude a melhorar o BrainIAc
            </p>
            <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Podemos coletar dados anônimos de uso (quais funcionalidades você usa,
              onde trava) para melhorar o produto. <strong>Nenhum conteúdo da sua base
              é enviado.</strong> Você pode mudar essa decisão a qualquer momento.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30">
            Aceitar
          </button>
          <button
            onClick={handleDecline}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
            Recusar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ConsentModal;
