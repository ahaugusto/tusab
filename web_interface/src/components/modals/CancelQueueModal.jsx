import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BTN_FOCUS } from '../../constants';

export default function CancelQueueModal({ open, darkMode, extractionQueue, onKeepQueue, onClearQueue, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="cancel-queue-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onCancel}>
          <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            className={`rounded-2xl border p-6 max-w-sm w-full shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Cancelar extração</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {extractionQueue.length} canal{extractionQueue.length !== 1 ? 'is' : ''} na fila
                </p>
              </div>
            </div>

            <p className={`text-xs mb-5 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              O que deve acontecer com os canais que ainda estão na fila de extração?
            </p>

            <div className="space-y-2 mb-5">
              <button onClick={onKeepQueue}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'border-primary/30 bg-primary/10 hover:bg-primary/15 text-white' : 'border-violet-200 bg-violet-50 hover:bg-violet-100 text-slate-800'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary mt-0.5 shrink-0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <div>
                  <p className="text-xs font-bold">Cancelar e continuar fila</p>
                  <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Para este canal e inicia o próximo automaticamente
                  </p>
                </div>
              </button>

              <button onClick={onClearQueue}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'border-danger/30 bg-danger/10 hover:bg-danger/15 text-white' : 'border-red-200 bg-red-50 hover:bg-red-100 text-slate-800'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger mt-0.5 shrink-0"><path d="M18 6L6 18M6 6l12 12"/></svg>
                <div>
                  <p className="text-xs font-bold">Cancelar e limpar fila</p>
                  <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Para este canal e descarta todos os {extractionQueue.length} da fila
                  </p>
                </div>
              </button>
            </div>

            <button onClick={onCancel}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                ${darkMode ? 'bg-white/6 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              Voltar — não cancelar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
