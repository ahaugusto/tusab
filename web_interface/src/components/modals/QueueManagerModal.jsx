import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BTN_FOCUS } from '../../constants';
import { queueMoveItem, queueRemoveItem, fetchQueue, queueClear } from '../../services/api';
import ModalWrapper from '../shared/ModalWrapper';

export default function QueueManagerModal({ open, darkMode, extractionQueue, setExtractionQueue, onClose }) {
  const { t } = useTranslation();

  const handleMover = async (fromIdx, toIdx) => {
    await queueMoveItem(fromIdx, toIdx).catch(() => {});
    const res = await fetchQueue().catch(() => null);
    if (res) setExtractionQueue(res.data.queue || []);
  };

  const handleRemover = async (idx) => {
    await queueRemoveItem(idx).catch(() => {});
    const res = await fetchQueue().catch(() => null);
    if (res) setExtractionQueue(res.data.queue || []);
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper key="queue-modal" onClose={onClose} zIndex="z-50" backdrop="bg-black/60 backdrop-blur-sm" label="Gerenciar fila de extração">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            className={`rounded-2xl p-5 max-w-sm w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('ops.queue_title')}</h2>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  {extractionQueue.length === 0 ? 'Fila vazia.' : `${extractionQueue.length} ${extractionQueue.length === 1 ? 'canal aguardando' : 'canais aguardando'}`}
                </p>
              </div>
              <button onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}
                aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {extractionQueue.length === 0 ? (
              <p className={`text-center text-xs py-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum canal na fila.</p>
            ) : (
              <div className="space-y-1 mb-4 max-h-72 overflow-y-auto custom-scrollbar">
                {extractionQueue.map((item, i) => {
                  const m = item.url?.match(/@([^/?]+)/);
                  const nome = item.projeto_nome || (m ? `@${m[1]}` : item.url?.split('/').pop() || '—');
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${darkMode ? 'border-white/8 bg-white/3' : 'border-slate-100 bg-slate-50'}`}>
                      {/* Reorder arrows */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMover(i, i - 1)}
                          disabled={i === 0}
                          aria-label="Mover para cima"
                          className={`p-0.5 rounded transition-colors disabled:opacity-20 ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'} ${BTN_FOCUS}`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                        <button
                          onClick={() => handleMover(i, i + 1)}
                          disabled={i === extractionQueue.length - 1}
                          aria-label="Mover para baixo"
                          className={`p-0.5 rounded transition-colors disabled:opacity-20 ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'} ${BTN_FOCUS}`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                      </div>
                      <span className={`text-[10px] font-mono w-4 text-center shrink-0 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{nome}</p>
                        {item.projeto_nome && m && (
                          <p className={`text-[10px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{m[1]}</p>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        {(item.fontes || []).length > 0 ? (item.fontes || []).length + ' tipos' : 'todos'}
                      </span>
                      <button
                        onClick={() => handleRemover(i)}
                        aria-label="Remover da fila"
                        className={`p-1 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-600 hover:text-danger hover:bg-danger/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'} ${BTN_FOCUS}`}>
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {extractionQueue.length > 0 && (
              <button
                onClick={() => { queueClear(); setExtractionQueue([]); }}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'border-danger/30 text-danger hover:bg-danger/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                Limpar fila
              </button>
            )}
          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}
