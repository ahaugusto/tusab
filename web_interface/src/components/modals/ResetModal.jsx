import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BTN_FOCUS } from '../../constants';
import { resetTotal } from '../../services/api';
import ModalWrapper from '../shared/ModalWrapper';

export default function ResetModal({ open, darkMode, onClose, onResetDone }) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState('');
  const [resetando, setResetando] = useState(false);

  const handleReset = async () => {
    setResetando(true);
    await resetTotal().catch(() => {});
    setResetando(false);
    setConfirmText('');
    onClose();
    onResetDone();
  };

  const handleClose = () => {
    if (!resetando) {
      setConfirmText('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper key="reset-modal" onClose={handleClose} zIndex="z-[9999]" backdrop="bg-black/55" label="Reset total da base">
          <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <Trash2 size={18} className="text-danger" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Limpar toda a base</h3>
                <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Essa ação não pode ser desfeita</p>
              </div>
            </div>
            <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Remove todos os vídeos, documentos, textos e índices de conhecimento. Os arquivos extraídos do YouTube e os uploads serão apagados permanentemente.
            </p>
            <div>
              <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Digite <span className="font-mono text-danger">RESETAR</span> para confirmar
              </label>
              <input
                type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="RESETAR" autoFocus
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-danger transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleClose} disabled={resetando}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button
                disabled={confirmText !== 'RESETAR' || resetando}
                onClick={handleReset}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-danger/20 text-danger hover:bg-danger/30 ${BTN_FOCUS}`}>
                {resetando ? 'Limpando…' : 'Limpar tudo'}
              </button>
            </div>
          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}
