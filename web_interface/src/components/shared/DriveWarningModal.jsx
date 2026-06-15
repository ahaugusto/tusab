/**
 * @file DriveWarningModal.jsx
 * @description One-time security warning modal shown before first Google Drive authentication
 * @module components/shared/DriveWarningModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, FolderOpen, FolderX, ArrowRight, X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

const STORAGE_KEY = 'sebayt_drive_security_warned';

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Returns whether the user has already seen the Drive warning */
export function useDriveWarning() {
  const hasSeenWarning = () => localStorage.getItem(STORAGE_KEY) === '1';
  const markWarningShown = () => localStorage.setItem(STORAGE_KEY, '1');
  return { hasSeenWarning, markWarningShown };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * DriveWarningModal — security warning shown once before Google Drive auth.
 * Explains which folders are safe to share and which contain sensitive data.
 *
 * @param {Object}   props
 * @param {boolean}  props.open          - whether the modal is visible
 * @param {boolean}  props.darkMode      - dark/light theme flag
 * @param {Function} props.onConfirm     - called when user clicks "Entendi, continuar"
 * @param {Function} props.onCancel      - called when user closes without confirming
 * @returns {JSX.Element}
 */
function DriveWarningModal({ open, darkMode, onConfirm, onCancel }) {
  const base = darkMode
    ? 'bg-slate-900 border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper onClose={onCancel} zIndex="z-50" backdrop="bg-black/50 backdrop-blur-sm" label="Aviso de segurança">

          {/* Panel */}
          <motion.div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-5 ${base}`}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}>

            {/* Close */}
            <button
              onClick={onCancel}
              className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <X size={15} />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 shrink-0">
                <ShieldAlert size={20} className="text-amber-500" />
              </div>
              <div>
                <h2 className="font-bold text-base">Aviso de segurança</h2>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Leia antes de conectar o Google Drive
                </p>
              </div>
            </div>

            {/* Body */}
            <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              A pasta de dados do Sebayt contém arquivos sensíveis.
              Se você sincronizar a pasta errada com o Drive, suas
              chaves de API podem ser expostas.
            </p>

            {/* Folder info */}
            <div className="space-y-2">
              <div className={`flex items-start gap-3 rounded-xl p-3 ${darkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <FolderOpen size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-600">Seguro para sincronizar</p>
                  <p className={`text-xs mt-0.5 font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>cerebro/</p>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Só contém texto extraído — sem dados sensíveis</p>
                </div>
              </div>

              <div className={`flex items-start gap-3 rounded-xl p-3 ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                <FolderX size={15} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-600">Não sincronize</p>
                  <p className={`text-xs mt-0.5 font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>config/</p>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Contém suas chaves de API em texto simples</p>
                </div>
              </div>
            </div>

            <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              O Sebayt usa o Drive apenas para salvar a pasta{' '}
              <span className="font-mono">cerebro/</span>.
              Este aviso é exibido uma única vez.
            </p>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onCancel}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${darkMode ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                Entendi, continuar <ArrowRight size={12} />
              </button>
            </div>

          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}

export default DriveWarningModal;
