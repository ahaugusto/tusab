/**
 * @file PostExtractionModal.jsx
 * @description Success modal shown after extraction completes; prompts Drive or Agent next steps
 * @module components/extraction/PostExtractionModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Trophy, X, CheckCircle2, CloudOff, ShieldCheck, ExternalLink, Bot, Info } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PostExtractionModal — presents Drive sync and Agent IA options after a successful extraction
 *
 * @param {Object}   props
 * @param {Function} props.onClose          - callback to dismiss the modal
 * @param {string}   props.driveStatus      - current drive authentication state
 * @param {boolean}  props.agentConfigured  - whether the agent has been configured
 * @param {Function} props.onGoToAgent      - callback to navigate to agent tab
 * @param {Function} props.onDriveAuth      - callback to initiate Drive OAuth flow
 * @param {boolean}  props.darkMode         - dark/light theme flag
 * @returns {JSX.Element}
 */
function PostExtractionModal({ onClose, driveStatus, agentConfigured, onGoToAgent, onDriveAuth, darkMode }) {
  const { t } = useTranslation();
  const driveConnected = driveStatus === 'autenticado';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onClick={e => e.stopPropagation()}
        className={`rounded-2xl p-6 max-w-lg w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-secondary" aria-hidden="true" />
              <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {t('modal.title_finished')}
              </h2>
            </div>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('modal.subtitle')}
            </p>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}
            aria-label={t('modal.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Drive / NotebookLM option */}
          <div className={`rounded-2xl p-4 border flex flex-col gap-3 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2">
              {driveConnected
                ? <CheckCircle2 size={16} className="text-secondary shrink-0" aria-hidden="true" />
                : <CloudOff size={16} className="text-slate-400 shrink-0" aria-hidden="true" />}
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {t('modal.drive_title')}
              </h3>
            </div>
            <p className={`text-[11px] leading-relaxed flex-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}
              dangerouslySetInnerHTML={{ __html: driveConnected ? t('modal.drive_desc_connected') : t('modal.drive_desc_local') }} />
            <div className="space-y-1.5">
              {driveConnected
                ? <p className="text-[10px] flex items-center gap-1 font-bold text-secondary">
                    <CheckCircle2 size={10} aria-hidden="true" /> {t('drive.connected')}
                  </p>
                : <button onClick={() => { onDriveAuth(); onClose(); }}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors
                      ${darkMode ? 'border-primary/40 text-primary hover:bg-primary/10' : 'border-primary/30 text-primary hover:bg-primary/5'} ${BTN_FOCUS}`}>
                    <ShieldCheck size={13} className="shrink-0" aria-hidden="true" />
                    <span>{t('modal.drive_enable')}</span>
                  </button>}
              <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer"
                aria-disabled={!driveConnected}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors
                  ${driveConnected
                    ? darkMode ? 'border-white/20 text-slate-300 hover:bg-white/10' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    : 'border-dashed opacity-40 cursor-not-allowed ' + (darkMode ? 'border-white/15 text-slate-500' : 'border-slate-300 text-slate-400')} ${BTN_FOCUS}`}
                onClick={e => { if (!driveConnected) e.preventDefault(); }}>
                <ExternalLink size={12} aria-hidden="true" /> {t('modal.drive_notebooklm')}
              </a>
            </div>
          </div>

          {/* Agent IA option */}
          <div className={`rounded-2xl p-4 border flex flex-col gap-3 ${darkMode ? 'bg-primary/8 border-primary/20' : 'bg-violet-50 border-violet-200'}`}>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-primary shrink-0" aria-hidden="true" />
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {t('modal.agent_title')}
              </h3>
            </div>
            <p className={`text-[11px] leading-relaxed flex-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('modal.agent_desc')}
            </p>
            <div className="space-y-1.5">
              {agentConfigured
                ? <p className="text-[10px] flex items-start gap-1.5 font-bold text-secondary">
                    <CheckCircle2 size={12} className="shrink-0 mt-px" aria-hidden="true" />
                    <span>{t('modal.agent_configured')}</span>
                  </p>
                : <p className={`text-[10px] flex items-start gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Info size={12} className="shrink-0 mt-px" aria-hidden="true" />
                    <span>{t('modal.agent_not_configured')}</span>
                  </p>}
              <button onClick={() => { onGoToAgent(); onClose(); }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors bg-primary text-white hover:bg-primary/85 shadow-sm ${BTN_FOCUS}`}>
                <Bot size={12} aria-hidden="true" /> {t('modal.agent_btn')}
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose}
          className={`w-full mt-3 py-2 rounded-xl text-xs font-bold transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} ${BTN_FOCUS}`}>
          {t('modal.close')}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default PostExtractionModal;
