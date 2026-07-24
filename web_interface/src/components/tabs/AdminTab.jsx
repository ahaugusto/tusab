import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Bell, BellOff, BellRing, Mail, CheckCircle2, RefreshCw, Plug, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PrivacidadeRede from '../agent/PrivacidadeRede';
import RedesCorporativas from '../agent/RedesCorporativas';
import { BTN_FOCUS } from '../../constants';
import { acceptAnalytics, declineAnalytics } from '../../services/analytics';
import { fetchMcpConfig } from '../../services/api';

export default function AdminTab({
  darkMode,
  mainScrollRef,
  analyticsEnabled,
  setAnalyticsEnabled,
  regras,
  onResetClick,
  appUpdateInfo,
  onInstallUpdate,
}) {
  const { t } = useTranslation();

  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
  );

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    setNotifPerm(Notification.permission);
  }, []);

  const handleEnableNotif = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPerm(result);
  }, []);

  // ── Verificação manual de atualização ──────────────────────────────────
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkResult,    setCheckResult]    = useState(null); // { tone: 'ok'|'info'|'warn', text }
  const appVersion = window.tusab?.version || '';

  // ── MCP Server: copiar config para Claude Code / Cursor / qualquer cliente MCP ──
  const [mcpCopied, setMcpCopied] = useState(false);

  const handleCopyMcpConfig = useCallback(async () => {
    try {
      const res = await fetchMcpConfig();
      await navigator.clipboard.writeText(JSON.stringify(res.data, null, 2));
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 2500);
    } catch (e) {
      // Falha silenciosa é aceitável aqui — usuário só tenta de novo; sem estado de erro dedicado.
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (!window.tusab?.checkForUpdates) {
      setCheckResult({ tone: 'warn', text: 'Verificação disponível apenas no app instalado.' });
      return;
    }
    setCheckingUpdate(true);
    setCheckResult(null);
    try {
      const res = await window.tusab.checkForUpdates();
      if (res?.status === 'update-available') {
        setCheckResult({ tone: 'info', text: `Nova versão ${res.version} encontrada — baixando em segundo plano. O botão "Instalar e reiniciar" aparecerá quando o download terminar.` });
      } else if (res?.status === 'up-to-date') {
        setCheckResult({ tone: 'ok', text: `Você está na versão mais recente${res.current ? ` (v${res.current})` : ''}.` });
      } else if (res?.status === 'dev') {
        setCheckResult({ tone: 'warn', text: 'Verificação disponível apenas no app instalado.' });
      } else {
        setCheckResult({ tone: 'warn', text: `Não foi possível verificar: ${res?.message || 'erro desconhecido'}.` });
      }
    } catch (e) {
      setCheckResult({ tone: 'warn', text: 'Não foi possível verificar. Confira sua conexão e tente novamente.' });
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  return (
    <div ref={mainScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">

      {/* Card de atualização do app */}
      {appUpdateInfo && (
        <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-warning/5 border-warning/25' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-warning/15' : 'border-b border-amber-100'}`}>
            <span className="text-warning text-sm">⬆</span>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
              Atualização disponível
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-warning/20 text-warning' : 'bg-amber-200 text-amber-800'}`}>
              v{appUpdateInfo.version}
            </span>
          </div>
          <div className="p-5 space-y-3">
            <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {appUpdateInfo.downloaded
                ? `O Tusab ${appUpdateInfo.version} foi baixado e está pronto para instalar. Feche o app para aplicar a atualização automaticamente.`
                : `Uma nova versão do Tusab (${appUpdateInfo.version}) está sendo baixada em segundo plano. A atualização será aplicada ao fechar o app.`}
            </p>
            {appUpdateInfo.downloaded && onInstallUpdate && (
              <button
                onClick={onInstallUpdate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-warning text-white hover:bg-warning/90 transition-colors">
                ⬆ Instalar e reiniciar agora
              </button>
            )}
          </div>
        </section>
      )}

      {/* Atualização do app — verificação manual */}
      <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
          <RefreshCw size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Atualização do app</h3>
          {appVersion && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              v{appVersion}
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            O Tusab verifica atualizações automaticamente ao abrir. Use o botão para forçar uma verificação agora — se houver versão nova, o download começa em segundo plano.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${BTN_FOCUS}
                ${darkMode ? 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25' : 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'}`}>
              <RefreshCw size={12} className={checkingUpdate ? 'animate-spin' : ''} />
              {checkingUpdate ? 'Verificando…' : 'Verificar atualização'}
            </button>
            {checkResult && (
              <p role="status" className={`text-[11px] font-medium
                ${checkResult.tone === 'ok'   ? 'text-secondary'
                : checkResult.tone === 'info' ? 'text-primary'
                : 'text-warning'}`}>
                {checkResult.text}
              </p>
            )}
          </div>
        </div>
      </section>

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

      {/* Redes Corporativas */}
      <RedesCorporativas darkMode={darkMode} />

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
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
            {t('admin.notif_title', 'Notificações do sistema')}
          </h3>
          {notifPerm === 'granted' && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400">
              <BellRing size={10} /> {t('admin.notif_active', 'Ativo')}
            </span>
          )}
          {notifPerm === 'denied' && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400">
              <BellOff size={10} /> {t('admin.notif_blocked', 'Bloqueado')}
            </span>
          )}
          {notifPerm === 'default' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {t('admin.notif_pending', 'Não solicitado')}
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('admin.notif_desc', 'O Tusab envia alertas quando uma extração termina ou quando o chat responde enquanto você está em outra aba.')}
          </p>

          {notifPerm === 'default' && (
            <button
              onClick={handleEnableNotif}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}
            >
              <Bell size={13} /> {t('admin.notif_enable', 'Ativar notificações')}
            </button>
          )}

          {notifPerm === 'granted' && (
            <div className={`flex items-start gap-2 text-[11px] px-3 py-2.5 rounded-xl ${darkMode ? 'bg-emerald-500/8 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
              <span>{t('admin.notif_granted_info', 'Notificações ativas. Para desativar, clique no ícone de cadeado na barra de endereço do navegador e altere a permissão de notificações.')}</span>
            </div>
          )}

          {notifPerm === 'denied' && (
            <div className={`flex items-start gap-2 text-[11px] px-3 py-2.5 rounded-xl ${darkMode ? 'bg-red-500/8 text-slate-400' : 'bg-red-50 text-slate-600'}`}>
              <BellOff size={13} className="mt-0.5 shrink-0" />
              <span>{t('admin.notif_denied_info', 'Notificações bloqueadas pelo navegador. Para habilitar, clique no ícone de cadeado na barra de endereço e permita notificações para este app.')}</span>
            </div>
          )}

          {notifPerm === 'unavailable' && (
            <p className={`text-[11px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('admin.notif_unavailable', 'Notificações não disponíveis neste ambiente.')}
            </p>
          )}
        </div>
      </section>

      {/* MCP Server */}
      <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
          <Plug size={14} className={darkMode ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" />
          <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>MCP Server</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            O Tusab expõe sua base de conhecimento como um servidor MCP (Model Context Protocol) local — qualquer agente de IA compatível (Claude Code, Cursor, e outros) pode consultar suas fontes indexadas diretamente, sem sair da ferramenta que você já usa.
          </p>
          <button
            onClick={handleCopyMcpConfig}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
              ${mcpCopied
                ? darkMode ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                : darkMode ? 'border-primary/30 text-primary hover:bg-primary/10' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
            {mcpCopied ? <Check size={13} /> : <Copy size={13} />}
            {mcpCopied ? 'Config copiada!' : 'Copiar configuração MCP'}
          </button>
          <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            Cole o conteúdo copiado no arquivo de configuração MCP do seu editor (ex: <code className={darkMode ? 'text-slate-500' : 'text-slate-500'}>.cursor/mcp.json</code>). Veja o passo a passo completo no Help.
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
            href={`mailto:${__SUPPORT_EMAIL__}`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors
              ${darkMode ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
            <Mail size={13} /> {__SUPPORT_EMAIL__}
          </a>
          <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            Tusab v{__APP_VERSION__} · © {__APP_YEAR__} CriAugu — CNPJ {__CNPJ__}
          </p>
        </div>
      </section>
    </div>
  );
}
