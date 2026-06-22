import React from 'react';
import { Trash2, Bell, Mail, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PrivacidadeRede from '../agent/PrivacidadeRede';
import { BTN_FOCUS } from '../../constants';
import { acceptAnalytics, declineAnalytics } from '../../services/analytics';

export default function AdminTab({
  darkMode,
  mainScrollRef,
  analyticsEnabled,
  setAnalyticsEnabled,
  regras,
  onResetClick,
}) {
  const { t } = useTranslation();

  return (
    <div ref={mainScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">

      {/* Telemetria */}
      <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={analyticsEnabled ? 'text-secondary' : darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Telemetria</h3>
          {analyticsEnabled && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-secondary">
              <CheckCircle2 size={11} /> Ativa
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>Telemetria anônima</p>
              <p className={`text-[10px] mt-1 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                Registra eventos de uso — quais abas foram abertas, extrações iniciadas, indexações e perguntas no chat.
                <strong className={darkMode ? ' text-slate-400' : ' text-slate-600'}> Nenhum conteúdo pessoal é coletado</strong>: sem texto de mensagens, nomes de arquivos, URLs de canais ou chaves de API.
                Os dados são enviados ao <strong className={darkMode ? 'text-slate-400' : 'text-slate-600'}>PostHog</strong> (servidores na UE/EUA) e usados exclusivamente para melhorar o produto.
              </p>
            </div>
            <button
              role="switch" aria-checked={analyticsEnabled}
              onClick={() => {
                if (analyticsEnabled) { declineAnalytics(); setAnalyticsEnabled(false); }
                else { acceptAnalytics(); setAnalyticsEnabled(true); }
              }}
              className={`relative shrink-0 mt-0.5 inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${analyticsEnabled ? 'bg-primary' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${analyticsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Privacidade e Rede */}
      <PrivacidadeRede darkMode={darkMode} />

      {/* Limpeza de bases — só para perfis com reset_total */}
      {regras.reset_total && (
        <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
            <Trash2 size={14} className={darkMode ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" />
            <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Limpeza de bases</h3>
          </div>
          <div className="p-5 space-y-3">
            <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Remove permanentemente todos os dados extraídos, índices de busca e configurações do sistema. Esta ação não pode ser desfeita.
            </p>
            <button
              onClick={onResetClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                ${darkMode ? 'border-danger/30 text-danger hover:bg-danger/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
              <Trash2 size={13} /> Limpar toda a base de conhecimento
            </button>
          </div>
        </section>
      )}

      {/* Notificações */}
      <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
          <Bell size={14} className={darkMode ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" />
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Notificações do sistema</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Em breve</span>
        </div>
        <div className="p-5">
          <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            Alertas de erros de extração, índice desatualizado, espaço em disco e novas versões do Tusab.
          </p>
        </div>
      </section>

      {/* Suporte */}
      <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
          <Mail size={14} className={darkMode ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" />
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Suporte</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Encontrou um problema ou tem uma sugestão? Entre em contato com a equipe do Tusab.
          </p>
          <a
            href="mailto:tusab@tusab.sollution"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors
              ${darkMode ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
            <Mail size={13} /> tusab@tusab.sollution
          </a>
          <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            Tusab v1.0.0 · © 2026 CriAugu — CNPJ 65.131.075/0001-57
          </p>
        </div>
      </section>
    </div>
  );
}
