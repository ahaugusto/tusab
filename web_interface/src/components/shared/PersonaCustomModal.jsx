/**
 * @file PersonaCustomModal.jsx
 * @description Modal for defining a free-text custom response tone for the
 *   agent — injected into the LLM prompt the same way as the preset personas
 *   (objetivo, tecnico, didatico, descontraido, socratico), works identically
 *   for Ollama and every other provider since it's the same prompt text.
 * @module components/shared/PersonaCustomModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

const MAX_LEN = 300;

function PersonaCustomModal({ open, darkMode, valorInicial, onSave, onClose }) {
  const { t } = useTranslation();
  const [texto, setTexto] = React.useState(valorInicial || '');

  React.useEffect(() => {
    if (open) setTexto(valorInicial || '');
  }, [open, valorInicial]);

  const base = darkMode
    ? 'bg-slate-900 border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const podeSalvar = texto.trim().length >= 3;

  const handleSalvar = () => {
    if (!podeSalvar) return;
    onSave(texto.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper onClose={onClose} zIndex="z-50" backdrop="bg-black/50 backdrop-blur-sm" label={t('persona.custom_aria_label')}>
          <motion.div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${base}`}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/15 shrink-0">
                <Sparkles size={20} className="text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold text-base">{t('persona.custom_title')}</h2>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('persona.custom_subtitle')}
                </p>
              </div>
            </div>

            <div>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value.slice(0, MAX_LEN))}
                placeholder={t('persona.custom_placeholder')}
                rows={4}
                autoFocus
                maxLength={MAX_LEN}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
              />
              <p className={`text-[10px] mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {texto.length}/{MAX_LEN}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${darkMode ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {t('repo.cancel')}
              </button>
              <button
                onClick={handleSalvar}
                disabled={!podeSalvar}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary-button text-white hover:bg-primary-button/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t('persona.custom_save')}
              </button>
            </div>

          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}

export default PersonaCustomModal;
