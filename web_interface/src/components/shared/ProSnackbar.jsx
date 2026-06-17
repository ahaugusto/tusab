/**
 * @file ProSnackbar.jsx
 * @description Snackbar informativo para features Pro — aparece quando o usuário
 * tenta usar uma feature exclusiva do plano Pro. Não bloqueia o uso na v1.0
 * (sistema de licença ainda não ativo); informa e apresenta CTA de interesse.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

/**
 * ProSnackbar
 *
 * @param {Object}   props
 * @param {boolean}  props.visible      - controla exibição
 * @param {Function} props.onClose      - callback ao fechar
 * @param {string}   props.feature      - nome da feature Pro (ex: "Fila de Extração")
 * @param {boolean}  props.darkMode
 * @param {number}   [props.autoClose]  - ms para fechar automaticamente (padrão: 6000)
 */
function ProSnackbar({ visible, onClose, feature, darkMode, autoClose = 6000 }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, autoClose);
    return () => clearTimeout(t);
  }, [visible, autoClose, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`fixed bottom-24 right-5 z-[200] w-80 rounded-2xl border shadow-2xl p-4 flex gap-3
            ${darkMode
              ? 'bg-[#0C1122] border-primary/30 shadow-primary/10'
              : 'bg-white border-violet-200 shadow-violet-100'}`}
          role="status"
          aria-live="polite">

          {/* Ícone */}
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
            ${darkMode ? 'bg-primary/15' : 'bg-violet-50'}`}>
            <Sparkles size={15} className="text-primary" />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Feature Pro{feature ? ` — ${feature}` : ''}
            </p>
            <p className={`text-[11px] mt-0.5 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Disponível no plano Pro. Fique de olho no lançamento!
            </p>
            <a
              href="mailto:augusto.brasil@criaugu.com.br?subject=Interesse%20no%20Tusab%20Pro"
              className={`inline-flex items-center gap-1 mt-2 text-[11px] font-bold transition-colors
                ${darkMode ? 'text-primary hover:text-primary/80' : 'text-violet-600 hover:text-violet-800'}`}>
              Quero ser avisado →
            </a>
          </div>

          {/* Fechar */}
          <button
            onClick={onClose}
            className={`p-1 rounded-lg self-start transition-colors shrink-0
              ${darkMode ? 'text-slate-500 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'}`}
            aria-label="Fechar">
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ProSnackbar;
