/**
 * @file Onboarding.jsx
 * @description First-run multi-step onboarding flow shown to new users
 * @module components/shared/Onboarding
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Brain, Play, FolderOpen, Bot, BarChart2 } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Onboarding — paginated introduction wizard stored in localStorage
 *
 * @param {Object} props
 * @param {Function} props.onDone - callback invoked when user finishes or skips
 * @returns {JSX.Element}
 */
function Onboarding({ onDone }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const STEPS = [
    { icon: Brain,      title: t('onboarding.s1_title'), body: t('onboarding.s1_body') },
    { icon: Play,       title: t('onboarding.s2_title'), body: t('onboarding.s2_body') },
    { icon: FolderOpen, title: t('onboarding.s3_title'), body: t('onboarding.s3_body') },
    { icon: Bot,        title: t('onboarding.s4_title'), body: t('onboarding.s4_body') },
    { icon: BarChart2,  title: t('onboarding.s5_title'), body: t('onboarding.s5_body') },
  ];

  const total   = STEPS.length;
  const current = STEPS[step];
  const Icon    = current.icon;

  /** Marks onboarding complete in localStorage and calls onDone */
  const finish = () => {
    localStorage.setItem('brainiac_onboarded', '1');
    onDone();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-[#0C1122] border border-white/15 rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        {/* Step dots + skip */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <button onClick={finish} className={`text-[11px] text-slate-500 hover:text-slate-300 transition-colors ${BTN_FOCUS}`}>
            {t('onboarding.skip')}
          </button>
        </div>

        {/* Step icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
          <Icon size={22} className="text-primary" />
        </div>

        {/* Content */}
        <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{current.body}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            aria-label={t('onboarding.back')}
            className={`text-xs text-slate-500 hover:text-slate-300 disabled:opacity-0 transition-colors ${BTN_FOCUS}`}
          >
            ← {t('onboarding.back')}
          </button>
          <span className="text-[11px] text-slate-600">
            {step + 1} {t('onboarding.step_of')} {total}
          </span>
          <button
            onClick={step === total - 1 ? finish : () => setStep(s => s + 1)}
            className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors ${BTN_FOCUS}`}
          >
            {step === total - 1 ? t('onboarding.finish') : t('onboarding.next')} →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Onboarding;
