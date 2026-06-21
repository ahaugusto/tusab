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
import { Brain, Play, FolderOpen, Cloud, Cpu, MessageSquare, BarChart2 } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from './ModalWrapper';
import { usePerfil, PERFIS_META } from '../../hooks/usePerfil';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Onboarding — paginated introduction wizard stored in localStorage
 *
 * @param {Object} props
 * @param {Function} props.onDone - callback invoked with the selected profile slug when user finishes or skips
 * @returns {JSX.Element}
 */
function Onboarding({ onDone }) {
  const { t } = useTranslation();
  // step 0 = profile selection; steps 1–7 = content steps (mapped from index 0 in STEPS array)
  const [step, setStep] = useState(0);
  const [perfilSelecionado, setPerfilSelecionado] = useState(null);
  const { setPerfil } = usePerfil();

  // ── per-profile body overrides for steps 1 and 6 ─────────────────────────
  const s1Body = () => {
    if (perfilSelecionado === 'estudante') return t('onboarding.s1_body_estudante');
    if (perfilSelecionado === 'professor') return t('onboarding.s1_body_professor');
    return t('onboarding.s1_body');
  };

  const s6Body = () => {
    if (perfilSelecionado === 'estudante') return t('onboarding.s6_body_estudante');
    if (perfilSelecionado === 'professor') return t('onboarding.s6_body_professor');
    return t('onboarding.s6_body');
  };

  const STEPS = [
    { icon: Brain,         title: t('onboarding.s1_title'), body: s1Body() },
    { icon: Play,          title: t('onboarding.s2_title'), body: t('onboarding.s2_body') },
    { icon: FolderOpen,    title: t('onboarding.s3_title'), body: t('onboarding.s3_body') },
    { icon: Cloud,         title: t('onboarding.s4_title'), body: t('onboarding.s4_body') },
    { icon: Cpu,           title: t('onboarding.s5_title'), body: t('onboarding.s5_body') },
    { icon: MessageSquare, title: t('onboarding.s6_title'), body: s6Body() },
    { icon: BarChart2,     title: t('onboarding.s7_title'), body: t('onboarding.s7_body') },
  ];

  const total   = STEPS.length;
  // step 0 is the profile picker; content steps start at 1
  const isProfileStep = step === 0;
  const contentStep   = step - 1; // index into STEPS when step >= 1
  const current       = isProfileStep ? null : STEPS[contentStep];
  const Icon          = current?.icon ?? null;

  /** Handles profile card selection */
  const handleSelectPerfil = (slug) => {
    setPerfilSelecionado(slug);
  };

  /** Marks onboarding complete in localStorage and calls onDone with the chosen profile */
  const finish = (skipPerfil = false) => {
    const finalPerfil = skipPerfil ? 'profissional' : (perfilSelecionado ?? 'profissional');
    setPerfil(finalPerfil);
    localStorage.setItem('tusab_onboarded', JSON.stringify({ perfil: finalPerfil, ts: Date.now() }));
    onDone(finalPerfil);
  };

  // ── Step 0 — Profile picker ───────────────────────────────────────────────
  if (isProfileStep) {
    return (
      <ModalWrapper onClose={() => finish(true)} disableBackdrop disableEscape label="Introdução ao Tusab">
        <motion.div
          key="profile-step"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-[#0C1122] border border-white/15 rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          {/* Header row: dots + skip */}
          <div className="flex items-center justify-between mb-6">
            {/* No dots on step 0 — show a single indicator */}
            <div className="flex gap-1.5">
              <div className="h-1.5 rounded-full w-6 bg-primary" />
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="h-1.5 rounded-full w-1.5 bg-white/20" />
              ))}
            </div>
            <button
              onClick={() => finish(true)}
              className={`text-[11px] text-slate-500 hover:text-slate-300 transition-colors ${BTN_FOCUS}`}
            >
              {t('onboarding.skip')}
            </button>
          </div>

          {/* Titles */}
          <h2 className="text-lg font-bold text-white mb-1">{t('perfil.escolha_titulo')}</h2>
          <p className="text-sm text-slate-400 mb-5">{t('perfil.escolha_subtitulo')}</p>

          {/* Profile cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(PERFIS_META).map(([slug, meta]) => {
              const selected = perfilSelecionado === slug;
              return (
                <button
                  key={slug}
                  onClick={() => handleSelectPerfil(slug)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${BTN_FOCUS} ${
                    selected
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10'
                  }`}
                >
                  <span className="text-3xl leading-none">{meta.icon}</span>
                  <span className="text-xs font-semibold">{t(meta.label)}</span>
                  <span className="text-[10px] text-slate-400 leading-snug">{t(meta.desc)}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {/* Back placeholder for alignment */}
            <span className="w-16" />
            <span className="text-[11px] text-slate-600">
              1 {t('onboarding.step_of')} {total + 1}
            </span>
            <button
              onClick={() => setStep(1)}
              disabled={!perfilSelecionado}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS} ${
                perfilSelecionado
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed'
              }`}
            >
              {t('onboarding.next')} →
            </button>
          </div>
        </motion.div>
      </ModalWrapper>
    );
  }

  // ── Steps 1–7 — Content steps ─────────────────────────────────────────────
  return (
    <ModalWrapper onClose={() => finish(false)} disableBackdrop disableEscape label="Introdução ao Tusab">
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
            {/* dot for the profile step */}
            <div className="h-1.5 rounded-full w-1.5 bg-white/20" />
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === contentStep ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}
              />
            ))}
          </div>
          <button onClick={() => finish(false)} className={`text-[11px] text-slate-500 hover:text-slate-300 transition-colors ${BTN_FOCUS}`}>
            {t('onboarding.skip')}
          </button>
        </div>

        {/* Step icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
          <Icon size={22} className="text-primary" />
        </div>

        {/* Content */}
        <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">{current.body}</p>
        {current.whys && (
          <ul className="space-y-2.5">
            {current.whys.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-xs text-slate-400 leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(s => s - 1)}
            aria-label={t('onboarding.back')}
            className={`text-xs text-slate-500 hover:text-slate-300 transition-colors ${BTN_FOCUS}`}
          >
            ← {t('onboarding.back')}
          </button>
          <span className="text-[11px] text-slate-600">
            {step + 1} {t('onboarding.step_of')} {total + 1}
          </span>
          <button
            onClick={contentStep === total - 1 ? () => finish(false) : () => setStep(s => s + 1)}
            className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors ${BTN_FOCUS}`}
          >
            {contentStep === total - 1 ? t('onboarding.finish') : t('onboarding.next')} →
          </button>
        </div>
      </motion.div>
    </ModalWrapper>
  );
}

export default Onboarding;
