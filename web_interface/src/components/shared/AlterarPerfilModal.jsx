/**
 * @file AlterarPerfilModal.jsx
 * @description Modal para alterar o perfil do usuário (Estudante / Professor / Pesquisador / Profissional).
 *   Inclui alerta especial ao sair do perfil Estudante.
 * @module components/shared/AlterarPerfilModal
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, AlertTriangle, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalWrapper from './ModalWrapper';
import { PERFIS_META } from '../../hooks/usePerfil';
import { BTN_FOCUS } from '../../constants';

/**
 * AlterarPerfilModal
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode       - tema escuro
 * @param {string}   props.btnFocus       - classe focus ring (BTN_FOCUS)
 * @param {string}   props.perfilAtual    - slug do perfil atual
 * @param {Function} props.onConfirmar    - (novoPerfil: string) => void
 * @param {Function} props.onFechar       - fecha o modal sem alterar
 */
function AlterarPerfilModal({ darkMode, btnFocus = BTN_FOCUS, perfilAtual, onConfirmar, onFechar }) {
  const { t } = useTranslation();

  // perfil selecionado na grade — inicia com o atual
  const [selecionado, setSelecionado] = useState(perfilAtual);
  // controla painel de aviso para saída do perfil Estudante
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const perfis = Object.keys(PERFIS_META);

  // Mapeamento de cores por perfil (border + bg no card ativo)
  const COR_PERFIL = {
    estudante:   { border: 'border-sky-500',    bg: darkMode ? 'bg-sky-500/10'    : 'bg-sky-50',    text: 'text-sky-500'    },
    professor:   { border: 'border-emerald-500', bg: darkMode ? 'bg-emerald-500/10': 'bg-emerald-50', text: 'text-emerald-500' },
    pesquisador: { border: 'border-violet-500',  bg: darkMode ? 'bg-violet-500/10' : 'bg-violet-50',  text: 'text-violet-500'  },
    profissional:{ border: 'border-amber-500',   bg: darkMode ? 'bg-amber-500/10'  : 'bg-amber-50',   text: 'text-amber-500'   },
  };

  function handleConfirmar() {
    if (selecionado === perfilAtual) return;
    // Alerta especial ao sair do perfil estudante
    if (perfilAtual === 'estudante' && selecionado !== 'estudante') {
      setMostrarAviso(true);
      return;
    }
    onConfirmar(selecionado);
  }

  function handleAvisoCancelar() {
    setMostrarAviso(false);
    setSelecionado(perfilAtual); // desfaz seleção
  }

  function handleAvisoConfirmar() {
    setMostrarAviso(false);
    onConfirmar(selecionado);
  }

  return (
    <ModalWrapper onClose={onFechar} label={t('perfil.trocar')} zIndex="z-50">
      <motion.div
        initial={{ scale: 0.96, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={`relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col
          ${darkMode ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}
        style={{ maxHeight: 'min(90vh, 640px)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
            ${darkMode ? 'bg-primary/15' : 'bg-violet-100'}`}>
            <User size={15} className="text-primary" aria-hidden="true" />
          </div>
          <h2 className={`text-sm font-bold flex-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {t('perfil.trocar')}
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className={`p-1.5 rounded-lg transition-colors ${btnFocus}
              ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Subtítulo — perfil atual */}
        <div className={`px-5 pt-4 pb-2`}>
          <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="font-semibold">{t('perfil.atual')}:</span>{' '}
            <span>{PERFIS_META[perfilAtual]?.icon} {t(PERFIS_META[perfilAtual]?.label)}</span>
          </p>
        </div>

        {/* Grade 2×2 de perfis */}
        <div className="grid grid-cols-2 gap-2.5 px-5 pb-4">
          {perfis.map(slug => {
            const meta = PERFIS_META[slug];
            const cor  = COR_PERFIL[slug];
            const eAtual    = slug === perfilAtual;
            const eSelecionado = slug === selecionado;

            return (
              <button
                key={slug}
                onClick={() => { if (!mostrarAviso) setSelecionado(slug); }}
                disabled={mostrarAviso}
                aria-pressed={eSelecionado}
                className={`relative flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-all ${btnFocus}
                  ${eSelecionado
                    ? `${cor.border} ${cor.bg}`
                    : darkMode
                      ? 'border-white/10 hover:border-white/25 bg-white/4 hover:bg-white/8'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100'}
                  ${mostrarAviso ? 'opacity-50 cursor-default' : ''}`}
              >
                {/* Ícone do perfil + check */}
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg leading-none" aria-hidden="true">{meta.icon}</span>
                  {eAtual && (
                    <span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${cor.bg} ${cor.text} border ${cor.border}`}>
                      <Check size={9} strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                  {eSelecionado && !eAtual && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary shrink-0">
                      <Check size={9} strokeWidth={3} className="text-white" aria-hidden="true" />
                    </span>
                  )}
                </div>
                {/* Label */}
                <p className={`text-xs font-bold leading-tight
                  ${eSelecionado
                    ? cor.text
                    : darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {t(meta.label)}
                </p>
                {/* Desc */}
                <p className={`text-[10px] leading-snug line-clamp-2
                  ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t(meta.desc)}
                </p>
              </button>
            );
          })}
        </div>

        {/* Painel de aviso — saída do perfil Estudante */}
        <AnimatePresence>
          {mostrarAviso && (
            <motion.div
              key="aviso-estudante"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={`mx-5 mb-4 rounded-xl border p-4 space-y-3
                ${darkMode ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className={`text-[11px] leading-relaxed flex-1
                  ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>
                  {t('perfil.alerta_estudante')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAvisoCancelar}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                  {t('perfil.alerta_cancelar')}
                </button>
                <button
                  onClick={handleAvisoConfirmar}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${btnFocus}
                    ${darkMode ? 'bg-amber-500/25 text-amber-300 hover:bg-amber-500/35' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                  {t('perfil.alerta_confirmar')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão confirmar — só visível quando não está no painel de aviso */}
        {!mostrarAviso && (
          <div className={`px-5 pb-5`}>
            <button
              onClick={handleConfirmar}
              disabled={selecionado === perfilAtual}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${btnFocus}
                disabled:opacity-40 disabled:cursor-not-allowed
                ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/35 disabled:hover:bg-primary/20' : 'bg-primary text-white hover:bg-primary/85 disabled:hover:bg-primary'}`}>
              {t('perfil.alerta_confirmar')}
            </button>
          </div>
        )}
        </div>{/* fim scroll */}

      </motion.div>
    </ModalWrapper>
  );
}

export default AlterarPerfilModal;
