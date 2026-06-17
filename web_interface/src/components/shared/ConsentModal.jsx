/**
 * @file ConsentModal.jsx
 * @description Data disclosure notice shown once on first launch.
 *   Covers all three data flows: analytics (opt-in), external APIs, Drive OAuth.
 *   Serves as the product's lightweight privacy notice until a formal policy is published.
 * @module components/shared/ConsentModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BarChart2, Globe, HardDrive, ShieldCheck } from 'lucide-react';
import { acceptAnalytics, declineAnalytics } from '../../services/analytics';

// ─── Data flows disclosed ─────────────────────────────────────────────────────

const FLOWS = [
  {
    icon: BarChart2,
    color: 'text-primary',
    bg:    'bg-primary/10',
    title: 'Telemetria anônima (opcional)',
    desc:  'Eventos de uso — quais funcionalidades você usa, onde trava. Nenhum conteúdo da base é enviado. Você escolhe aceitar ou recusar abaixo.',
  },
  {
    icon: Globe,
    color: 'text-amber-500',
    bg:    'bg-amber-500/10',
    title: 'APIs externas (só se configurar)',
    desc:  "Se você configurar Gemini, OpenAI, Claude ou Groq, as mensagens do chat e trechos da base saem da máquina para servidores fora do Brasil. O Tusab não acessa esses dados — eles vão direto ao provedor escolhido.",
  },
  {
    icon: HardDrive,
    color: 'text-emerald-500',
    bg:    'bg-emerald-500/10',
    title: 'Google Drive (só se autenticar)',
    desc:  'Se você conectar o Drive, a pasta cerebro/ é sincronizada na sua conta Google. A pasta config/ (chaves de API) nunca é sincronizada.',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ConsentModal — data disclosure notice + analytics opt-in
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode  - dark/light theme flag
 * @param {Function} props.onDone    - called after accept or decline
 * @returns {JSX.Element}
 */
function ConsentModal({ darkMode, onDone }) {
  const [expanded, setExpanded] = useState(false);

  const handleAccept  = () => { acceptAnalytics();  onDone(); };
  const handleDecline = () => { declineAnalytics(); onDone(); };

  const base   = darkMode ? 'bg-[#0C1122] border-white/15 text-white'    : 'bg-white border-slate-200 text-slate-900';
  const muted  = darkMode ? 'text-slate-400'                              : 'text-slate-500';
  const rowBg  = darkMode ? 'bg-white/5'                                  : 'bg-slate-50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div className={`rounded-2xl border shadow-2xl overflow-hidden ${base}`}>

        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-3 mb-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-white/8' : 'bg-slate-100'} shrink-0`}>
              <ShieldCheck size={17} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Antes de começar — seus dados</p>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${muted}`}>
                O Tusab é local-first: sua base de conhecimento fica na sua máquina.
                Três fluxos de dados existem, todos opcionais ou condicionais.
              </p>
            </div>
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={`flex items-center gap-1 text-[11px] font-semibold ${muted} hover:text-primary transition-colors`}>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Ocultar detalhes' : 'Ver o que é coletado'}
          </button>
        </div>

        {/* Expandable detail rows */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}>
              <div className={`mx-5 mb-4 rounded-xl overflow-hidden border ${darkMode ? 'border-white/8' : 'border-slate-200'}`}>
                {FLOWS.map(({ icon: Icon, color, bg, title, desc }, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 px-3 py-3 ${i < FLOWS.length - 1 ? (darkMode ? 'border-b border-white/8' : 'border-b border-slate-100') : ''}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${bg}`}>
                      <Icon size={12} className={color} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold">{title}</p>
                      <p className={`text-[10px] leading-relaxed mt-0.5 ${muted}`}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics consent question */}
        <div className={`px-5 pt-0 pb-5 border-t ${darkMode ? 'border-white/8' : 'border-slate-100'} mt-1`}>
          <p className={`text-[11px] font-semibold mt-3 mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Permitir telemetria anônima para ajudar a melhorar o Tusab?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30">
              Aceitar
            </button>
            <button
              onClick={handleDecline}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              Recusar
            </button>
          </div>
          <p className={`text-[10px] mt-2 text-center ${muted}`}>
            Você pode mudar essa decisão a qualquer momento nas configurações.
          </p>
        </div>

      </div>
    </motion.div>
  );
}

export default ConsentModal;
