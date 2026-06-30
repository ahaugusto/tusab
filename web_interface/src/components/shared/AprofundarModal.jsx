/**
 * @file AprofundarModal.jsx
 * @description Modal oferecendo sumarização LLM após configuração bem-sucedida de provider
 * @module components/shared/AprofundarModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ModalWrapper from './ModalWrapper';

/**
 * AprofundarModal — oferecido ao usuário após salvar configuração LLM com sucesso,
 * quando há vídeos sem resumo gerado. Dispara sumarização em background.
 *
 * @param {boolean}  props.open
 * @param {boolean}  props.darkMode
 * @param {number}   props.totalPendente  - total de vídeos sem resumo
 * @param {Array}    props.canais         - lista de {prefixo, total} com pendências
 * @param {boolean}  props.rodando        - sumarização em progresso
 * @param {number}   props.progresso      - 0-100
 * @param {Function} props.onConfirm      - inicia sumarização
 * @param {Function} props.onClose        - fecha sem sumarizar
 */
function AprofundarModal({ open, darkMode, totalPendente, canais = [], rodando, progresso, onConfirm, onClose }) {
  const { t } = useTranslation();

  const base = darkMode
    ? 'bg-slate-900 border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const done  = progresso >= 100;

  return (
    <AnimatePresence>
      {open && (
        <ModalWrapper onClose={onClose} zIndex="z-50" backdrop="bg-black/50 backdrop-blur-sm" label={t('aprofundar.title')}>
          <motion.div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-5 ${base}`}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}>

            {/* Close */}
            {!rodando && (
              <button
                onClick={onClose}
                className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                <X size={15} />
              </button>
            )}

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/15 shrink-0">
                {done
                  ? <CheckCircle2 size={20} className="text-emerald-500" />
                  : <Sparkles size={20} className="text-primary" />}
              </div>
              <div>
                <h2 className="font-bold text-base">{t('aprofundar.title')}</h2>
                <p className={`text-xs mt-0.5 ${muted}`}>
                  {done ? t('aprofundar.done_sub') : t('aprofundar.subtitle')}
                </p>
              </div>
            </div>

            {/* Body — estado inicial */}
            {!rodando && !done && (
              <>
                <p className={`text-sm leading-relaxed ${muted}`}>
                  {t('aprofundar.body', { count: totalPendente })}
                </p>

                {canais.length > 0 && (
                  <ul className={`text-xs space-y-1 ${muted}`}>
                    {canais.slice(0, 5).map(c => (
                      <li key={c.prefixo} className="flex justify-between">
                        <span className="font-mono truncate max-w-[200px]">{c.prefixo}</span>
                        <span>{t('aprofundar.n_videos', { count: c.total })}</span>
                      </li>
                    ))}
                    {canais.length > 5 && (
                      <li className={`text-[11px] ${muted}`}>
                        {t('aprofundar.more_channels', { count: canais.length - 5 })}
                      </li>
                    )}
                  </ul>
                )}

                <p className={`text-[11px] ${muted}`}>
                  {t('aprofundar.note')}
                </p>
              </>
            )}

            {/* Body — em progresso */}
            {rodando && !done && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                  <p className={`text-sm ${muted}`}>{t('aprofundar.running')}</p>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progresso}%` }}
                    transition={{ duration: 0.4 }} />
                </div>
                <p className={`text-[11px] text-right ${muted}`}>{progresso}%</p>
              </div>
            )}

            {/* Body — concluído */}
            {done && (
              <p className={`text-sm leading-relaxed ${muted}`}>
                {t('aprofundar.done_body')}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {!rodando && !done && (
                <>
                  <button
                    onClick={onClose}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${darkMode ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {t('aprofundar.skip')}
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                    <Sparkles size={12} />
                    {t('aprofundar.confirm')}
                  </button>
                </>
              )}
              {done && (
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                  {t('aprofundar.close_done')}
                </button>
              )}
            </div>

          </motion.div>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}

export default AprofundarModal;
