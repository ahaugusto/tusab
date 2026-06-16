/**
 * @file SidebarContent.jsx
 * @description Sidebar panel with language/theme toggles, logo, canal config, Drive toggle and extraction controls
 * @module components/sidebar/SidebarContent
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe, Sun, Moon, Link2, CheckCircle2, XCircle, AlertTriangle, Loader2, Zap,
  ShieldCheck, ShieldOff, ShieldAlert, ExternalLink, PlayCircle, FileText, Info,
  FolderPlus, ListOrdered, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import i18n from '../../i18n';
import { queueAdd, queueClear } from '../../services/api';

// ─── DriveToggle (internal sub-component) ────────────────────────────────────

/**
 * DriveToggle — compact toggle row for Google Drive authentication state
 *
 * @param {Object}   props
 * @param {string}   props.driveStatus      - 'autenticado' | 'em_progresso' | 'sem_credenciais' | 'nao_autenticado' | 'erro'
 * @param {string}   props.driveAuthError   - error message from last auth attempt
 * @param {Function} props.onAuth           - callback to start Drive OAuth
 * @param {Function} props.onCancel         - callback to cancel ongoing auth
 * @param {boolean}  props.isRunning        - whether extraction is currently running
 * @param {boolean}  props.darkMode         - dark/light theme flag
 * @param {string}   props.btnFocus         - Tailwind focus-visible ring classes
 * @returns {JSX.Element}
 */
export function DriveToggle({ driveStatus, driveAuthError, onAuth, onCancel, isRunning, darkMode, btnFocus }) {
  const { t } = useTranslation();

  const isOn           = driveStatus === 'autenticado' || driveStatus === 'em_progresso';
  const isLoading      = driveStatus === 'em_progresso';
  const noCredentials  = driveStatus === 'sem_credenciais';
  const toggleDisabled = noCredentials || isRunning || driveStatus === 'autenticado';

  /** Handles the toggle switch click — either starts auth or cancels loading */
  const handleToggle = () => {
    if (isLoading) { onCancel(); return; }
    if (!isOn)     { onAuth(); }
  };

  const statusColor = driveStatus === 'autenticado'
    ? 'text-secondary'
    : driveStatus === 'em_progresso'
    ? 'text-primary'
    : darkMode ? 'text-slate-500' : 'text-slate-600';

  const statusIcon = driveStatus === 'autenticado'
    ? <ShieldCheck size={14} aria-hidden="true" />
    : driveStatus === 'em_progresso'
    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
    : noCredentials
    ? <ShieldAlert size={14} aria-hidden="true" />
    : <ShieldOff size={14} aria-hidden="true" />;

  const statusLabel = driveStatus === 'autenticado'
    ? t('drive.connected')
    : driveStatus === 'em_progresso'
    ? t('drive.waiting')
    : noCredentials
    ? t('drive.no_credentials_title')
    : t('drive.not_authenticated');

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
        ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}
        role="status" aria-label={t('drive.title')}>

        <div className={`flex items-center gap-2 min-w-0 ${statusColor}`}>
          {statusIcon}
          <div className="min-w-0">
            <p className={`text-[11px] font-bold truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('drive.title')}</p>
            <p className={`text-[10px] truncate ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>

        <button
          role="switch"
          aria-checked={isOn}
          aria-label={t('drive.aria_open_browser')}
          disabled={toggleDisabled}
          onClick={handleToggle}
          className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200
            disabled:cursor-not-allowed
            ${isOn
              ? driveStatus === 'autenticado' ? 'bg-secondary' : 'bg-primary'
              : darkMode ? 'bg-white/20' : 'bg-slate-300'}
            ${btnFocus}`}>
          {isLoading
            ? <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" aria-hidden="true" />
            : <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
                ${isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />}
        </button>
      </div>

      {(driveStatus === 'erro' || driveAuthError) && (
        <p className="text-[10px] text-danger flex items-center gap-1 px-1" role="alert">
          <AlertTriangle size={10} aria-hidden="true" />
          {driveAuthError || t('drive.error_fallback')}
        </p>
      )}

      {noCredentials && (
        <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer"
          className={`text-[10px] flex items-center gap-1 px-1 underline underline-offset-2 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <ExternalLink size={9} aria-hidden="true" /> {t('drive.how_to')}
        </a>
      )}

      {isLoading && (
        <button onClick={onCancel}
          className={`w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors
            ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
          {t('drive.cancel_auth')}
        </button>
      )}
    </div>
  );
}

// ─── SidebarContent ──────────────────────────────────────────────────────────

/**
 * SidebarContent — full sidebar interior with all control sections
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode           - dark/light theme flag
 * @param {Function} props.setDarkMode        - state setter for darkMode
 * @param {string}   props.canalConfigurado   - currently configured canal name
 * @param {Function} props.setCanalConfigurado - state setter
 * @param {string}   props.canalInput         - URL input value
 * @param {Function} props.setCanalInput      - state setter
 * @param {string}   props.canalError         - validation / server error message
 * @param {Function} props.setCanalError      - state setter
 * @param {boolean}  props.configurando       - true while the set-channel request is pending
 * @param {string}   props.driveStatus        - Drive auth state
 * @param {string}   props.driveAuthError     - Drive auth error message
 * @param {boolean}  props.isRunning          - extraction is active
 * @param {boolean}  props.isPaused           - extraction is paused
 * @param {Function} props.onConfigurarCanal  - callback to submit the canal URL
 * @param {Function} props.onStart            - callback to open extraction modal
 * @param {Function} props.onDriveAuth        - callback to start Drive auth
 * @param {Function} props.onDriveCancel      - callback to cancel Drive auth
 * @param {Function} props.setShowHome        - callback to return to the home screen
 * @param {string}   props.btnFocus           - Tailwind focus-visible ring classes
 * @returns {JSX.Element}
 */
function SidebarContent({
  darkMode,
  setDarkMode,
  canalConfigurado,
  setCanalConfigurado,
  canalInput,
  setCanalInput,
  canalError,
  setCanalError,
  configurando,
  driveStatus,
  driveAuthError,
  isRunning,
  isPaused,
  onConfigurarCanal,
  onStart,
  onDriveAuth,
  onDriveCancel,
  setShowHome,
  onAddFiles,
  btnFocus,
}) {
  const { t } = useTranslation();
  const errorId = 'canal-error';
  const [activeSource, setActiveSource] = useState('youtube');
  const [queue,        setQueue]        = useState([]);
  const [queueInput,   setQueueInput]   = useState('');
  const [queueError,   setQueueError]   = useState('');
  const [queueAdding,  setQueueAdding]  = useState(false);

  /** Removes the configured canal from state */
  const handleRemoveCanal = () => { setCanalConfigurado(''); setCanalInput(''); };

  /** Cleans canal name by stripping query params */
  const cleanCanalName = (n) => n ? n.split('?')[0] : '';

  /** Adds a URL to the extraction queue */
  const handleQueueAdd = async () => {
    const url = queueInput.trim();
    if (!url) return;
    setQueueAdding(true); setQueueError('');
    try {
      const res = await queueAdd(url);
      if (res.data.error) { setQueueError(res.data.message); }
      else {
        setQueue(prev => [...prev, url]);
        setQueueInput('');
      }
    } catch { setQueueError('Erro ao adicionar à fila'); }
    setQueueAdding(false);
  };

  /** Clears the entire queue locally and on the backend */
  const handleQueueClear = async () => {
    await queueClear().catch(() => {});
    setQueue([]);
  };

  /** Removes a single item from the local queue display (backend manages the real list) */
  const handleQueueRemoveLocal = (idx) => setQueue(prev => prev.filter((_, i) => i !== idx));

  /** Changes i18n language and updates the HTML lang attribute */
  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng === 'en' ? 'en' : lng === 'es' ? 'es' : 'pt-BR';
  };

  return (
    <>
      {/* Language + dark mode row */}
      <div className="relative z-10 flex items-center justify-center gap-2 mb-0">
        <div className={`relative flex items-center rounded-lg border px-2 py-1 ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
          <Globe size={11} className={`shrink-0 mr-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`} aria-hidden="true" />
          <select
            value={i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('en') ? 'en' : 'es'}
            onChange={e => changeLang(e.target.value)}
            aria-label="Selecionar idioma"
            className={`text-[11px] font-bold bg-transparent border-none outline-none cursor-pointer pr-1 ${btnFocus}
              ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
            style={{ appearance: 'none', WebkitAppearance: 'none' }}>
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <button
          onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('Sebayt_theme', next ? 'dark' : 'light'); }}
          aria-label={darkMode ? t('footer.light') : t('footer.dark')}
          aria-pressed={darkMode}
          className={`p-1.5 rounded-lg border transition-colors ${darkMode ? 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'} ${btnFocus}`}>
          {darkMode ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        </button>
      </div>

      {/* Logo */}
      <div className="flex justify-center -mt-6 -mb-6">
        <button
          onClick={() => setShowHome(true)}
          aria-label="Voltar à tela inicial"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-opacity hover:opacity-80 active:opacity-60">
          <img
            src={darkMode ? '/logo_dark_mode.svg' : '/logo_light_mode.svg'}
            alt="Sebayt — Index.Augment.Converse"
            style={{ width: '220px', height: '220px', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </button>
      </div>

      <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

      {/* ── Source tabs: YouTube | Arquivos ── */}
      <div className={`flex rounded-xl p-0.5 mb-3 ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
        {[
          { id: 'youtube',  label: 'YouTube',  icon: PlayCircle },
          { id: 'arquivos', label: 'Arquivos',  icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSource(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-all
              ${activeSource === id
                ? darkMode ? 'bg-primary/25 text-primary shadow' : 'bg-white text-primary shadow-sm'
                : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon size={11} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* ── YouTube tab ── */}
      {activeSource === 'youtube' && (
        <>
          <section aria-labelledby="canal-heading" className="space-y-2 mb-3">
            <p id="canal-heading" className={`text-[11px] font-bold uppercase tracking-widest px-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('channel.title')}
            </p>

            {canalConfigurado ? (
              <div role="status" aria-label={`Canal configurado: @${canalConfigurado}`}
                className={`p-3 rounded-xl flex items-center gap-2 border ${darkMode ? 'bg-primary/10 border-primary/25' : 'bg-primary/5 border-primary/25'}`}>
                <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`text-[10px] uppercase font-bold tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.configured')}</p>
                  <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{cleanCanalName(canalConfigurado)}</p>
                </div>
                {!isRunning && (
                  <button onClick={handleRemoveCanal} aria-label={t('channel.remove')}
                    className={`ml-auto rounded-md p-0.5 transition-colors hover:text-danger ${darkMode ? 'text-slate-500' : 'text-slate-600'} ${btnFocus}`}>
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="canal-url" className="sr-only">URL do canal YouTube</label>
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                  <Link2 size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <input id="canal-url" type="url" placeholder={t('channel.placeholder')} value={canalInput}
                    onChange={e => { setCanalInput(e.target.value); setCanalError(''); }}
                    onKeyDown={e => e.key === 'Enter' && onConfigurarCanal()}
                    aria-describedby={canalError ? errorId : undefined} aria-invalid={!!canalError}
                    className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                </div>
                {canalError && (
                  <p id={errorId} role="alert" className="text-[11px] text-danger flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} aria-hidden="true" /> {canalError}
                  </p>
                )}
                <button onClick={onConfigurarCanal} disabled={configurando || !canalInput.trim()}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 ${btnFocus}`}>
                  {configurando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                  {configurando ? t('channel.configuring') : t('channel.confirm')}
                </button>
              </div>
            )}
          </section>

          <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

          {/* Google Drive — com hint NotebookLM */}
          <section aria-labelledby="drive-heading" className="space-y-2 mb-3">
            <p id="drive-heading" className={`text-[11px] font-bold uppercase tracking-widest px-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('drive.title')}
            </p>
            <div className={`flex items-start gap-2 rounded-xl p-2.5 text-[10px] ${darkMode ? 'bg-white/4 border border-white/8' : 'bg-slate-50 border border-slate-200'}`}>
              <Info size={11} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                Sincronize os arquivos extraídos com o Drive para usar no{' '}
                <strong className={darkMode ? 'text-slate-300' : 'text-slate-700'}>NotebookLM</strong>.
                O Sebayt monta o repositório; o NotebookLM atua como interface de leitura.
              </p>
            </div>
            <DriveToggle
              driveStatus={driveStatus}
              driveAuthError={driveAuthError}
              onAuth={onDriveAuth}
              onCancel={onDriveCancel}
              isRunning={isRunning}
              darkMode={darkMode}
              btnFocus={btnFocus}
            />
          </section>

          <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

          <button onClick={onStart} disabled={isRunning || !canalConfigurado}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
              bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${btnFocus}`}>
            <Zap size={15} aria-hidden="true" />
            {t('ops.start')}
          </button>

          {/* ── Fila de extração ── */}
          <div className={`border-t pt-3 mt-1 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <ListOrdered size={11} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
              <p className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                Fila {queue.length > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-600'}`}>{queue.length}</span>}
              </p>
            </div>

            {/* Input para adicionar à fila */}
            <div className="space-y-1.5">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                <Link2 size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
                <input
                  type="url"
                  placeholder="youtube.com/@próximocanal"
                  value={queueInput}
                  onChange={e => { setQueueInput(e.target.value); setQueueError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleQueueAdd()}
                  aria-label="URL do próximo canal para a fila"
                  className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                <button onClick={handleQueueAdd} disabled={queueAdding || !queueInput.trim()}
                  aria-label="Adicionar à fila"
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-40
                    ${darkMode ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} ${btnFocus}`}>
                  {queueAdding ? <Loader2 size={10} className="animate-spin" /> : '+'}
                </button>
              </div>
              {queueError && (
                <p role="alert" className="text-[10px] text-danger flex items-center gap-1">
                  <AlertTriangle size={10} aria-hidden="true" /> {queueError}
                </p>
              )}
            </div>

            {/* Lista dos canais na fila */}
            {queue.length > 0 && (
              <div className="mt-2 space-y-1">
                {queue.map((url, idx) => {
                  const nome = url.match(/@([^/?\s]+)/)?.[1] || url.split('/').pop();
                  return (
                    <div key={idx} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${darkMode ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{idx + 1}</span>
                      <span className={`flex-1 truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>@{nome}</span>
                      <button onClick={() => handleQueueRemoveLocal(idx)}
                        aria-label={`Remover @${nome} da fila`}
                        className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-danger' : 'text-slate-400 hover:text-danger'} ${btnFocus}`}>
                        <XCircle size={12} />
                      </button>
                    </div>
                  );
                })}
                <button onClick={handleQueueClear}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors mt-1
                    ${darkMode ? 'text-danger/60 hover:text-danger hover:bg-danger/10' : 'text-red-400 hover:text-red-600 hover:bg-red-50'} ${btnFocus}`}>
                  <Trash2 size={10} aria-hidden="true" /> Limpar fila
                </button>
              </div>
            )}

            {queue.length === 0 && (
              <p className={`text-[10px] mt-1.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Adicione canais para extrair em sequência após o atual.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Arquivos tab ── */}
      {activeSource === 'arquivos' && (
        <section className="space-y-4">
          <p className={`text-[11px] font-bold uppercase tracking-widest px-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            Seus Arquivos
          </p>
          <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Adicione documentos ao repositório para conversar com eles via IA — sem canal YouTube, sem extração.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['PDF', 'DOCX', 'TXT', 'MD'].map(ext => (
              <span key={ext} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${darkMode ? 'bg-white/5 border-white/15 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                .{ext.toLowerCase()}
              </span>
            ))}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border italic
              ${darkMode ? 'bg-white/3 border-white/8 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              áudio/vídeo em breve
            </span>
          </div>
          <button onClick={onAddFiles}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]
              bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${btnFocus}`}>
            <FolderPlus size={15} aria-hidden="true" />
            Adicionar Arquivos
          </button>
        </section>
      )}

      {/* Footer */}
      <div className={`mt-auto pt-2 border-t flex flex-col items-center gap-0.5 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('footer.version')}</p>
        <p className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>© 2026 CriAugu · {t('footer.by')}</p>
      </div>
    </>
  );
}

export default SidebarContent;
