/**
 * @file GuideModal.jsx
 * @description Modal de ajuda com guia de uso e atalhos de teclado
 * @module components/shared/GuideModal
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { HelpCircle, X, Keyboard, BookOpen } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

// ─── Atalhos ─────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  {
    group: 'Chat',
    items: [
      { keys: ['Shift', 'C'],   desc: 'Abrir chat RAG'       },
      { keys: ['Esc'],          desc: 'Fechar chat'           },
    ],
  },
  {
    group: 'Navegação',
    items: [
      { keys: ['Shift', 'E'],   desc: 'Aba Extração'         },
      { keys: ['Shift', 'R'],   desc: 'Sub-aba Relatório'    },
      { keys: ['Shift', 'B'],   desc: 'Aba Repositório'      },
      { keys: ['Shift', 'H'],   desc: 'Aba Histórico'        },
      { keys: ['Shift', 'V'],   desc: 'Aba Visão Geral'      },
      { keys: ['Shift', 'M'],   desc: 'Aba Monitor'          },
      { keys: ['Shift', 'I'],   desc: 'Aba Agente'           },
      { keys: ['Shift', 'A'],   desc: 'Aba Admin'            },
    ],
  },
];

function Kbd({ children, darkMode }) {
  return (
    <kbd className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-[10px] font-bold font-mono border
      ${darkMode ? 'bg-white/10 border-white/20 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>
      {children}
    </kbd>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function GuideModal({ onClose, darkMode }) {
  const { t } = useTranslation();
  const [aba, setAba] = useState('guia'); // 'guia' | 'atalhos'

  const steps = [
    { step: 1,  color: 'primary',   text: t('guide.step1')  },
    { step: 2,  color: 'primary',   text: t('guide.step2')  },
    { step: 3,  color: 'accent',    text: t('guide.step3')  },
    { step: 4,  color: 'accent',    text: t('guide.step4')  },
    { step: 5,  color: 'secondary', text: t('guide.step5')  },
    { step: 6,  color: 'secondary', text: t('guide.step6')  },
    { step: 7,  color: 'secondary', text: t('guide.step7')  },
    { step: 8,  color: 'primary',   text: t('guide.step8')  },
    { step: 9,  color: 'primary',   text: t('guide.step9')  },
    { step: 10, color: 'accent',    text: t('guide.step10') },
  ];

  const tabCls = (id) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border-b-2 ${
      aba === id
        ? darkMode
          ? 'border-primary text-primary'
          : 'border-violet-600 text-violet-700'
        : `border-transparent ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`
    }`;

  return (
    <ModalWrapper onClose={onClose} label={t('guide.title')}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`rounded-2xl p-6 max-w-3xl w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <HelpCircle size={16} className="text-primary" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('guide.title')}</h2>
              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('guide.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 mb-4 border-b ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <button className={tabCls('guia')} onClick={() => setAba('guia')}>
            <BookOpen size={12} />
            Como usar
          </button>
          <button className={tabCls('atalhos')} onClick={() => setAba('atalhos')}>
            <Keyboard size={12} />
            Atalhos de teclado
          </button>
        </div>

        {/* ── Conteúdo: Como usar ─────────────────────────────────────────── */}
        {aba === 'guia' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {steps.map(({ step, color, text }) => (
              <div key={step} className={`flex gap-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className={`w-5 h-5 rounded-full bg-${color}/20 text-${color} flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5`}>{step}</div>
                <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{text}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Conteúdo: Atalhos ───────────────────────────────────────────── */}
        {aba === 'atalhos' && (
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
            <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Atalhos funcionam quando o foco não está em uma caixa de texto.
            </p>
            {SHORTCUTS.map(({ group, items }) => (
              <div key={group}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{group}</p>
                <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                  {items.map(({ keys, desc }, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${
                      i > 0 ? (darkMode ? 'border-t border-white/5' : 'border-t border-slate-50') : ''
                    } ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'} transition-colors`}>
                      <span className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{desc}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((k, j) => (
                          <React.Fragment key={k}>
                            {j > 0 && <span className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>+</span>}
                            <Kbd darkMode={darkMode}>{k}</Kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </ModalWrapper>
  );
}

export default GuideModal;
