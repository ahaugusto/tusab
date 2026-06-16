/**
 * @file ExtractionModal.jsx
 * @description Content-type selection modal shown before starting an extraction
 * @module components/extraction/ExtractionModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ExtractionModal — checkbox list for selecting which content types to extract
 *
 * @param {Object}   props
 * @param {Function} props.onClose   - callback to dismiss the modal without confirming
 * @param {Function} props.onConfirm - callback(fontes: string[]) when user confirms
 * @param {boolean}  props.darkMode  - dark/light theme flag
 * @returns {JSX.Element}
 */
function ExtractionModal({ onClose, onConfirm, darkMode }) {
  const { t } = useTranslation();

  const ALL_TYPES = [
    { id: 'Videos',    label: t('ops.type_videos'),    icon: '🎬' },
    { id: 'Shorts',    label: t('ops.type_shorts'),    icon: '⚡' },
    { id: 'Ao_Vivo',  label: t('ops.type_lives'),     icon: '🔴' },
    { id: 'Podcasts',  label: t('ops.type_podcasts'),  icon: '🎙️' },
    { id: 'Cursos',    label: t('ops.type_courses'),   icon: '📚' },
    { id: 'Playlists', label: t('ops.type_playlists'), icon: '▶️' },
  ];

  const [selected, setSelected] = React.useState(ALL_TYPES.map(t => t.id));
  const allSelected = selected.length === ALL_TYPES.length;

  /** Toggles a content-type id in/out of the selection (keeps at least one) */
  const toggle = (id) => setSelected(prev =>
    prev.includes(id)
      ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
      : [...prev, id]
  );

  return (
    <ModalWrapper onClose={onClose} label={t('ops.types_modal_title')}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-2xl p-6 max-w-sm w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('ops.types_modal_title')}
            </h2>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('ops.types_modal_subtitle')}
            </p>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}
            aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Select-all toggle */}
        <button
          onClick={() => setSelected(allSelected ? [ALL_TYPES[0].id] : ALL_TYPES.map(t => t.id))}
          className={`w-full text-left text-[11px] font-bold flex items-center gap-2 mb-3 px-1 transition-colors ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'} ${BTN_FOCUS}`}>
          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
            ${allSelected ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
            {allSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          {t('ops.types_select_all')}
        </button>

        {/* Checkbox list */}
        <div className="space-y-1 mb-5">
          {ALL_TYPES.map(({ id, label, icon }) => {
            const checked = selected.includes(id);
            return (
              <button key={id} onClick={() => toggle(id)}
                role="checkbox" aria-checked={checked}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                  ${checked
                    ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                    : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${checked ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                  {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
                <span className={`text-xs font-semibold ${checked ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <button onClick={() => onConfirm(selected)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${BTN_FOCUS}`}>
          <Zap size={15} aria-hidden="true" />
          {t('ops.start_confirm')}
        </button>
      </motion.div>
    </ModalWrapper>
  );
}

export default ExtractionModal;
