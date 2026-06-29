/**
 * @file Onboarding.jsx
 * @description First-run multi-step onboarding flow shown to new users
 * @module components/shared/Onboarding
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Brain, Play, FolderOpen, Cloud, Cpu, MessageSquare, BarChart2, Bell } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ModalWrapper from './ModalWrapper';
import { usePerfil, PERFIS_META } from '../../hooks/usePerfil';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Onboarding — paginated introduction wizard stored in localStorage
 *
 * @param {Object} props
 * @param {Function} props.onDone - callback invoked with the selected profile slug when user finishes or skips
 * @param {boolean} props.darkMode - whether the app is in dark mode (affects modal background and text colors)
 * @returns {JSX.Element}
 */
function Onboarding({ onDone, onSkip, darkMode = true, zIndex }) {
  const { t } = useTranslation();
  // step 0 = profile selection; steps 1–8 = content steps (mapped from index 0 in STEPS array)
  const [step, setStep] = useState(0);
  const [perfilSelecionado, setPerfilSelecionado] = useState(null);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const { setPerfil } = usePerfil();

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

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
    { icon: Bell,          title: t('onboarding.s_notif_title'), body: t('onboarding.s_notif_body'), isNotif: true },
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

  /** Fecha o onboarding sem gravar no localStorage — retorna à landing */
  const skip = () => {
    if (onSkip) { onSkip(); return; }
    finish(true); // fallback se onSkip não fornecido
  };

  // ── helpers de cor por tema ───────────────────────────────────────────────
  const dotInactive  = darkMode ? 'bg-white/20' : 'bg-slate-200';
  const textTitle    = darkMode ? 'text-white' : 'text-slate-900';
  const textSub      = darkMode ? 'text-slate-400' : 'text-slate-500';
  const textMeta     = darkMode ? 'text-slate-600' : 'text-slate-400';
  const textSkip     = darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600';
  const cardInactive = darkMode
    ? 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100';
  const cardLabelInactive = darkMode ? 'text-slate-200' : 'text-slate-700';
  const btnDisabled  = darkMode ? 'bg-white/5 text-slate-600' : 'bg-slate-100 text-slate-400';

  // ── Step 0 — Profile picker ───────────────────────────────────────────────
  if (isProfileStep) {
    return (
      <ModalWrapper onClose={skip} disableBackdrop disableEscape label="Introdução ao Tusab" zIndex={zIndex}>
        <motion.div
          key="profile-step"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`rounded-2xl max-w-md w-full shadow-2xl overflow-y-auto custom-scrollbar border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
          style={{ maxHeight: 'min(90vh, 680px)', padding: '2rem' }}
        >
          {/* Header row: dots + skip */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1.5">
              <div className="h-1.5 rounded-full w-6 bg-primary" />
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full w-1.5 ${dotInactive}`} />
              ))}
            </div>
            {perfilSelecionado && (
              <button onClick={skip} className={`text-[11px] transition-colors ${BTN_FOCUS} ${textSkip}`}>
                {t('onboarding.skip')}
              </button>
            )}
          </div>

          <h2 className={`text-lg font-bold mb-1 ${textTitle}`}>{t('perfil.escolha_titulo')}</h2>
          <p className={`text-sm mb-5 ${textSub}`}>{t('perfil.escolha_subtitulo')}</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(PERFIS_META).map(([slug, meta]) => {
              const selected = perfilSelecionado === slug;
              return (
                <button
                  key={slug}
                  onClick={() => handleSelectPerfil(slug)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${BTN_FOCUS} ${
                    selected ? 'border-primary bg-primary/10' : cardInactive
                  }`}
                >
                  <span className="text-3xl leading-none">{meta.icon}</span>
                  <span className={`text-xs font-semibold ${selected ? 'text-primary' : cardLabelInactive}`}>{t(meta.label)}</span>
                  <span className={`text-[10px] leading-snug ${textSub}`}>{t(meta.desc)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="w-16" />
            <span className={`text-[11px] ${textMeta}`}>1 {t('onboarding.step_of')} {total + 1}</span>
            <button
              onClick={() => setStep(1)}
              disabled={!perfilSelecionado}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS} ${
                perfilSelecionado
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : `${btnDisabled} cursor-not-allowed`
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
    <ModalWrapper onClose={() => finish(false)} disableBackdrop disableEscape label="Introdução ao Tusab" zIndex={zIndex}>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`rounded-2xl max-w-md w-full shadow-2xl overflow-y-auto custom-scrollbar border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
        style={{ maxHeight: 'min(90vh, 680px)', padding: '2rem' }}
      >
        {/* Step dots + skip */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5">
            <div className={`h-1.5 rounded-full w-1.5 ${dotInactive}`} />
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === contentStep ? 'w-6 bg-primary' : `w-1.5 ${dotInactive}`}`}
              />
            ))}
          </div>
          <button onClick={() => finish(false)} className={`text-[11px] transition-colors ${BTN_FOCUS} ${textSkip}`}>
            {t('onboarding.skip')}
          </button>
        </div>

        {/* Step icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
          <Icon size={22} className="text-primary" />
        </div>

        {/* Content */}
        <h2 className={`text-lg font-bold mb-2 ${textTitle}`}>{current.title}</h2>
        <p className={`text-sm leading-relaxed mb-4 ${textSub}`}>{current.body}</p>

        {/* Step de notificações — botão de ativação */}
        {current.isNotif && (
          <div className="mt-2">
            {notifPermission === 'granted' ? (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold
                ${darkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                <Bell size={13} />
                {t('onboarding.notif_granted')}
              </div>
            ) : notifPermission === 'denied' ? (
              <p className={`text-xs px-4 py-2.5 rounded-xl
                ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                {t('onboarding.notif_denied')}
              </p>
            ) : (
              <button
                onClick={requestNotifPermission}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
                <Bell size={13} />
                {t('onboarding.notif_cta')}
              </button>
            )}
          </div>
        )}

        {current.whys && (
          <ul className="space-y-2.5">
            {current.whys.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className={`text-xs leading-relaxed ${textSub}`}>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(s => s - 1)}
            aria-label={t('onboarding.back')}
            className={`text-xs transition-colors ${BTN_FOCUS} ${textSkip}`}
          >
            ← {t('onboarding.back')}
          </button>
          <span className={`text-[11px] ${textMeta}`}>
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
