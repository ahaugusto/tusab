import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Zap, BarChart3, Clock, CheckCircle2, AlertTriangle, Loader2,
  Link2, XCircle, Pause, Square, Terminal, Activity, Globe,
  FileText, Video, Database, Trophy, MicOff, Scissors, RefreshCw, ChevronRight,
} from 'lucide-react';
import StatCard   from '../shared/StatCard';
import LogLine    from '../shared/LogLine';
import RelatorioTab from '../agent/RelatorioTab';
import { BTN_FOCUS } from '../../constants';
import {
  fetchHistory, setChannel, saveAutoUpdateConfig, runAutoUpdate, openFolder,
} from '../../services/api';

export default function ExtractionTab({
  darkMode,
  mainScrollRef,
  // extraction state
  status,
  history,           setHistory,
  isRunning,
  isPaused,
  progress,
  totalVideos,
  processedVideos,
  cancelFlash,
  extractionQueue,
  autoUpdateConfigs, setAutoUpdateConfigs,
  autoUpdateChecking, setAutoUpdateChecking,
  // canal state
  canalInput,        setCanalInput,
  canalConfigurado,  setCanalConfigurado,
  canalError,        setCanalError,
  configurando,
  // sub-tab
  extracaoSubTab,    setExtracaoSubTab,
  // refs
  logContainerRef,
  logSectionRef,
  // handlers
  handleConfigurarCanal,
  handleUsarCanalHistorico,
  handleStart,
  handlePause,
  handleCancel,
  // repositório (para resolver canais disponíveis no folder picker)
  repositorio,
  // folder picker (opens modal in App)
  onOpenFolderPicker,
  // nav to monitor
  onNavigateMonitor,
  // canal remove ref callback
  onRemoveCanal,
  // regras
  regras,
}) {
  const { t } = useTranslation();

  return (
    <div id="panel-extracao" role="tabpanel" aria-labelledby="tab-extracao"
      ref={mainScrollRef}
      className="flex-1 flex flex-col overflow-hidden"
      style={{ display: undefined }}>

      {/* Sub-tab switcher */}
      <div className={`px-4 lg:px-8 pt-4 shrink-0 border-b ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <div className="flex items-center gap-1">
          {[
            { id: 'extrair',       label: t('tabs.extraction'), icon: Zap     },
            { id: 'relatorio',     label: t('tabs.relatorio'),  icon: BarChart3 },
            { id: 'periodicidade', label: 'Auto-Update',        icon: Clock   },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => setExtracaoSubTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors -mb-px ${BTN_FOCUS}
                ${extracaoSubTab === id
                  ? 'border-primary text-primary'
                  : darkMode ? 'border-transparent text-slate-500 hover:text-slate-300' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-aba: Extrair */}
      <div className={`flex-1 px-4 lg:px-8 pt-5 pb-6 space-y-4 overflow-y-auto custom-scrollbar ${extracaoSubTab !== 'extrair' ? 'hidden' : ''}`}>

        {/* Canal + Iniciar */}
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
            <Zap size={14} className="text-primary" aria-hidden="true" />
            <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('tabs.extraction')}</span>
          </div>
          <div className="p-4">
            {canalConfigurado ? (
              /* ── Canal já configurado ── */
              <div role="status" aria-label={`Canal: @${canalConfigurado}`}
                className={`p-3 rounded-xl flex items-center gap-2 border ${darkMode ? 'bg-primary/10 border-primary/25' : 'bg-primary/5 border-primary/25'}`}>
                <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] uppercase font-bold tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.configured')}</p>
                  <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canalConfigurado.split('?')[0]}</p>
                </div>
                {!isRunning && (
                  <button onClick={onRemoveCanal} aria-label={t('channel.remove')}
                    className={`rounded-md p-0.5 transition-colors hover:text-danger ${darkMode ? 'text-slate-500' : 'text-slate-400'} ${BTN_FOCUS}`}>
                    <XCircle size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : history.length > 0 ? (
              /* ── Split: URL à esquerda | Seletor à direita ── */
              <div className="flex gap-4 items-stretch">
                {/* Esquerda — nova URL */}
                <div className="flex-1 space-y-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{t('channel.title')}</p>
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all
                    ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                    <Link2 size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <input type="url" placeholder={t('channel.placeholder')} value={canalInput}
                      onChange={e => { setCanalInput(e.target.value); setCanalError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleConfigurarCanal()}
                      aria-invalid={!!canalError}
                      className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                  </div>
                  {canalError && (
                    <p role="alert" className="text-[11px] text-danger flex items-center gap-1 font-medium">
                      <AlertTriangle size={11} aria-hidden="true" /> {canalError}
                    </p>
                  )}
                  <button onClick={handleConfigurarCanal} disabled={configurando || !canalInput.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                      disabled:opacity-40 disabled:cursor-not-allowed
                      bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 ${BTN_FOCUS}`}>
                    {configurando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                    {configurando ? t('channel.configuring') : t('channel.confirm')}
                  </button>
                </div>

                {/* Divisor */}
                <div className="flex flex-col items-center gap-1 pt-5">
                  <div className={`flex-1 w-px ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <span className={`text-[10px] font-bold px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>ou</span>
                  <div className={`flex-1 w-px ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
                </div>

                {/* Direita — canais anteriores */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Extraídos anteriormente</p>
                    <div className="relative group/hint">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className={`cursor-default ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}><circle cx="8" cy="8" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="7.4" y="7" width="1.2" height="5.5" rx="0.5"/><circle cx="8" cy="4.8" r="0.75"/></svg>
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 px-3 py-2 rounded-xl text-[10px] leading-relaxed pointer-events-none
                        opacity-0 group-hover/hint:opacity-100 transition-opacity duration-150 z-50 shadow-xl
                        ${darkMode ? 'bg-slate-800 text-slate-200 border border-white/10' : 'bg-slate-900 text-white'}`}>
                        Selecione um canal já extraído para carregá-lo como ativo e extrair novos vídeos sem redigitar a URL.
                        <div className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 -translate-y-1 ${darkMode ? 'bg-slate-800' : 'bg-slate-900'}`} />
                      </div>
                    </div>
                  </div>
                  <div className={`relative rounded-xl border overflow-hidden ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                    <select
                      defaultValue=""
                      onChange={e => {
                        const h = history.find(h => h.canal_url === e.target.value);
                        if (h) handleUsarCanalHistorico(h.canal_url, h.canal);
                        e.target.value = '';
                      }}
                      className={`w-full px-3 py-2 pr-8 text-xs bg-transparent outline-none cursor-pointer appearance-none
                        ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                      <option value="" disabled className={darkMode ? 'bg-slate-900' : 'bg-white'}>
                        Selecionar canal...
                      </option>
                      {history.map((h, i) => (
                        <option key={i} value={h.canal_url} className={darkMode ? 'bg-slate-900' : 'bg-white'}>
                          @{h.canal} · {h.extraidos} vídeos · {h.cobertura}%
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Sem histórico: só input de URL ── */
              <div className="space-y-2">
                <p className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.title')}</p>
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all
                  ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                  <Link2 size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <input type="url" placeholder={t('channel.placeholder')} value={canalInput}
                    onChange={e => { setCanalInput(e.target.value); setCanalError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleConfigurarCanal()}
                    aria-invalid={!!canalError}
                    className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                </div>
                {canalError && (
                  <p role="alert" className="text-[11px] text-danger flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} aria-hidden="true" /> {canalError}
                  </p>
                )}
                <button onClick={handleConfigurarCanal} disabled={configurando || !canalInput.trim()}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 ${BTN_FOCUS}`}>
                  {configurando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                  {configurando ? t('channel.configuring') : t('channel.confirm')}
                </button>
              </div>
            )}
          </div>
          <div className={`px-4 pb-4 pt-3 border-t flex items-center gap-2 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
            {regras.fila && extractionQueue.length > 0 && (
              <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${darkMode ? 'border-white/15 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Fila ({extractionQueue.length})
              </span>
            )}
            <button onClick={handleStart} disabled={!canalConfigurado && !isRunning}
              className={`ml-auto flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isRunning
                  ? 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30'
                  : 'bg-primary text-white hover:bg-primary/85 shadow shadow-primary/20'} ${BTN_FOCUS}`}>
              <Zap size={13} aria-hidden="true" />
              {isRunning ? t('ops.extract_another') : t('ops.start')}
            </button>
          </div>
        </div>

        {/* Fila inline */}
        <AnimatePresence>
          {regras.fila && isRunning && extractionQueue.length > 0 && (
            <motion.div
              key="queue-inline"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" aria-hidden="true" />
                <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Na fila · {extractionQueue.length} {extractionQueue.length === 1 ? 'canal' : 'canais'}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {extractionQueue.slice(0, 3).map((item, i) => {
                  const m = item.url?.match(/@([^/?]+)/);
                  const nome = item.projeto_nome || (m ? m[1] : item.url?.split('/').pop()) || '—';
                  return (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={`text-[10px] font-mono w-4 shrink-0 text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                          {item.projeto_nome ? item.projeto_nome : `@${m?.[1] || '—'}`}
                        </p>
                        {item.projeto_nome && m && (
                          <p className={`text-[10px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{m[1]}</p>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {(item.fontes || []).length > 0 ? (item.fontes || []).length + ' tipos' : 'todos'}
                      </span>
                    </div>
                  );
                })}
                {extractionQueue.length > 3 && (
                  <div className={`px-4 py-2 text-[10px] font-bold text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    + {extractionQueue.length - 3} mais canais na fila
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <AnimatePresence>
          {(isRunning || progress > 0) && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              role="region" aria-label={t('progress.title')}
              className={`rounded-2xl p-4 lg:p-5 border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-primary" aria-hidden="true" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t('progress.title')}</span>
                </div>
                <div className="flex items-center gap-3">
                  {totalVideos > 0 && (
                    <span className={`text-xs font-mono ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{processedVideos} / {totalVideos}</span>
                  )}
                  {totalVideos === 0 && status.stats.videos_mapeados > 0 && (
                    <span className={`text-xs font-mono ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{status.stats.videos_mapeados} mapeados</span>
                  )}
                  <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{progress}%</span>
                </div>
              </div>
              {isRunning && totalVideos === 0 ? (
                <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}
                  role="progressbar" aria-valuetext={t('progress.mapping')} aria-busy="true">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-accent"
                    animate={{ x: ['0%', '200%', '0%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                </div>
              ) : (
                <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`${t('progress.title')}: ${progress}%`}
                  className={`h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                </div>
              )}
              {isRunning && !isPaused && (
                <p aria-live="polite" className={`text-[11px] mt-2 flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                  {totalVideos === 0 ? t('progress.mapping') : t('progress.processing')}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Post-extraction summary */}
        <AnimatePresence>
          {(status.stats.status === 'Finalizado ✓' || status.stats.status === 'Interrompido') && status.stats.videos_total > 0 && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              aria-labelledby="summary-heading"
              className={`rounded-2xl border overflow-hidden ${status.stats.status === 'Finalizado ✓'
                ? darkMode ? 'bg-secondary/8 border-secondary/25' : 'bg-emerald-50 border-emerald-200'
                : darkMode ? 'bg-warning/8 border-warning/25' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`px-5 py-3.5 border-b flex items-center gap-2 ${status.stats.status === 'Finalizado ✓'
                ? darkMode ? 'border-secondary/20' : 'border-emerald-200'
                : darkMode ? 'border-warning/20' : 'border-amber-200'}`}>
                {status.stats.status === 'Finalizado ✓'
                  ? <Trophy size={15} className="text-secondary" aria-hidden="true" />
                  : <AlertTriangle size={15} className="text-warning" aria-hidden="true" />}
                <h3 id="summary-heading" className={`text-xs font-bold uppercase tracking-wider ${status.stats.status === 'Finalizado ✓'
                  ? darkMode ? 'text-secondary' : 'text-emerald-700'
                  : darkMode ? 'text-warning' : 'text-amber-700'}`}>
                  {status.stats.status === 'Finalizado ✓' ? t('summary.finished') : t('summary.interrupted')}
                </h3>
                {status.stats.idioma_detectado && (
                  <span className={`ml-auto flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    <Globe size={10} aria-hidden="true" /> {status.stats.idioma_detectado}
                  </span>
                )}
              </div>
              <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: CheckCircle2, label: t('summary.extracted'),     value: status.stats.videos_processed,     color: 'text-secondary', bg: darkMode ? 'bg-secondary/10' : 'bg-emerald-100' },
                  { icon: MicOff,       label: t('summary.no_caption'),    value: status.stats.videos_sem_legenda,   color: 'text-slate-400',  bg: darkMode ? 'bg-white/5'       : 'bg-slate-100' },
                  { icon: Scissors,     label: t('summary.short_caption'), value: status.stats.videos_legenda_curta, color: 'text-slate-400',  bg: darkMode ? 'bg-white/5'       : 'bg-slate-100' },
                  { icon: FileText,     label: t('summary.files'),         value: status.stats.files_generated,      color: 'text-primary',    bg: darkMode ? 'bg-primary/10'    : 'bg-violet-100' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl p-3 flex flex-col items-center gap-1 ${bg}`} role="status" aria-label={`${label}: ${value}`}>
                    <Icon size={16} className={color} aria-hidden="true" />
                    <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{value}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
                  </div>
                ))}
              </div>
              {status.stats.videos_total > 0 && (
                <div className="px-5 pb-4">
                  <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-bold ${darkMode ? 'bg-black/20' : 'bg-white border border-slate-200'}`}>
                    <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{t('summary.coverage')}</span>
                    <span className={status.stats.videos_processed / status.stats.videos_total >= 0.8 ? 'text-secondary' : 'text-warning'}>
                      {Math.round(status.stats.videos_processed / status.stats.videos_total * 100)}%
                      <span className={`ml-1 font-normal text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t('summary.coverage_detail', { processed: status.stats.videos_processed, total: status.stats.videos_total })}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Monitor shortcut */}
        {isRunning && regras.monitor && (
          <button onClick={onNavigateMonitor}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-colors ${BTN_FOCUS}
              ${darkMode ? 'bg-white/4 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
            <Activity size={12} className="text-sky-400" aria-hidden="true" />
            {t('ops.monitor_shortcut')}
          </button>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
          <StatCard icon={Video}    label={t('stats.processed')} value={processedVideos}
            color="primary"   sub={totalVideos > 0 ? t('stats.mapped', { total: totalVideos }) : t('stats.waiting')}
            darkMode={darkMode} />
          <StatCard icon={FileText} label={t('stats.files')}     value={status.stats.files_generated}
            color="accent"    sub={t('stats.parts')}
            onOpen={() => {
              const nomesRepo  = (repositorio?.canais || []).map(c => c.nome);
              const nomesHist  = history.filter(h => h.canal_nome).map(h => h.canal_nome);
              const todos = [...new Set([...nomesRepo, ...nomesHist])];
              if (!todos.length && !canalConfigurado) return;
              if (todos.length > 1) { onOpenFolderPicker(); return; }
              openFolder('canal_youtube', canalConfigurado || todos[0]);
            }}
            darkMode={darkMode} />
          <StatCard icon={Database} label={t('stats.db')}        value={canalConfigurado ? t('stats.active') : t('stats.waiting_db')}
            color="secondary" sub={canalConfigurado ? `@${canalConfigurado}` : t('stats.no_channel')}
            onOpen={canalConfigurado ? () => openFolder('gestao') : undefined}
            darkMode={darkMode} />
        </div>


        {/* Activity log */}
        <section ref={logSectionRef} aria-labelledby="log-heading"
          className={`rounded-2xl overflow-hidden flex flex-col border transition-all duration-300
            ${cancelFlash ? 'border-danger shadow-lg shadow-danger/20 ring-2 ring-danger/40' : darkMode ? 'border-white/10' : 'border-slate-200 shadow-sm'}
            ${darkMode ? 'bg-white/4' : 'bg-white'}`}>
          <div className={`px-4 lg:px-5 py-3 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Terminal size={15} className="text-primary shrink-0" aria-hidden="true" />
              <h3 id="log-heading" className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('log.title')}</h3>
              {isRunning && (
                <div className="flex items-center gap-1.5 ml-1" aria-label={t('log.live')}>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider" aria-hidden="true">{t('log.live')}</span>
                </div>
              )}
            </div>
            {isRunning && (
              <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={t('ops.controls')}>
                <button onClick={handlePause} aria-pressed={isPaused}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97] border-warning/50 text-warning hover:bg-warning/10 ${BTN_FOCUS}`}>
                  <Pause size={11} aria-hidden="true" />
                  {isPaused ? t('ops.resume') : t('ops.pause')}
                </button>
                {status.stats.status === 'Cancelando...' ? (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-500/30 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                    Aguardando...
                  </span>
                ) : (
                  <button onClick={handleCancel}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97] border-danger/40 text-danger hover:bg-danger/10 ${BTN_FOCUS}`}>
                    <Square size={10} aria-hidden="true" />
                    {t('ops.cancel')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div ref={logContainerRef} role="log" aria-label={t('log.title')} aria-live="polite" aria-relevant="additions"
            style={{ height: 'clamp(8rem, 22vh, 20rem)' }}
            className={`overflow-y-auto p-4 lg:p-5 space-y-1 custom-scrollbar text-xs ${darkMode ? 'bg-black/30 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
            {status.logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                <Activity size={28} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                <p className={`text-xs opacity-60 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {canalConfigurado ? t('log.ready') : t('log.complete_steps')}
                </p>
              </div>
            ) : (
              <div role="list" aria-label={t('log.title')}>
                {status.logs.map((log, i) => <LogLine key={i} log={log} darkMode={darkMode} />)}
              </div>
            )}
          </div>
        </section>
      </div>{/* end sub-aba extrair */}

      {/* Sub-aba: Relatório */}
      {extracaoSubTab === 'relatorio' && (
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 custom-scrollbar">
          <RelatorioTab darkMode={darkMode} history={history} btnFocus={BTN_FOCUS}
            canalAtivo={canalConfigurado}
            onRefreshHistory={() => fetchHistory().then(r => setHistory(r.data)).catch(() => {})} />
        </div>
      )}

      {/* Sub-aba: Auto-Update */}
      {extracaoSubTab === 'periodicidade' && (
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 space-y-4 custom-scrollbar">
          <div className="flex items-center justify-between">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Configure a frequência de verificação de novos vídeos por canal.
            </p>
            <button
              onClick={() => {
                setAutoUpdateChecking(true);
                runAutoUpdate().finally(() => setAutoUpdateChecking(false));
              }}
              disabled={autoUpdateChecking || isRunning}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${BTN_FOCUS}
                ${darkMode ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/8 hover:bg-cyan-500/15' : 'border-cyan-500/40 text-cyan-700 bg-cyan-50 hover:bg-cyan-100'}`}>
              <RefreshCw size={11} className={autoUpdateChecking ? 'animate-spin' : ''} />
              Verificar agora
            </button>
          </div>

          <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
              <Clock size={14} className="text-cyan-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>Seus canais</span>
              <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{history.length} canal{history.length !== 1 ? 'is' : ''}</span>
            </div>
            <div className={`divide-y ${darkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
              {history.length === 0 ? (
                <div className="px-5 py-10 flex flex-col items-center gap-2">
                  <Clock size={24} className={darkMode ? 'text-slate-700' : 'text-slate-300'} />
                  <p className={`text-xs text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Nenhum canal extraído ainda.<br />Extraia um canal para configurar o Auto-Update.
                  </p>
                </div>
              ) : history.map((h) => {
                const cfg = autoUpdateConfigs[h.canal] || { enabled: false, frequencia: 'semanal' };
                const FREQ_LABELS = { ao_abrir: 'Ao abrir', diario: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };
                const canalUrl = h.canal_url || '';
                const projetoPrefixo = h.projeto || '';
                const rowKey = projetoPrefixo ? `${h.canal}__${projetoPrefixo}` : h.canal;
                const toggleEnabled = (canal, currentCfg) => {
                  const next = { ...currentCfg, enabled: !currentCfg.enabled };
                  setAutoUpdateConfigs(prev => ({ ...prev, [canal]: next }));
                  saveAutoUpdateConfig(canal, next.enabled, next.frequencia || 'semanal', next.fontes || [], canalUrl, projetoPrefixo).catch(() => {});
                };
                const changeFreq = (canal, currentCfg, freq) => {
                  const next = { ...currentCfg, frequencia: freq };
                  setAutoUpdateConfigs(prev => ({ ...prev, [canal]: next }));
                  saveAutoUpdateConfig(canal, next.enabled, freq, next.fontes || [], canalUrl, projetoPrefixo).catch(() => {});
                };
                return (
                  <div key={rowKey} className={`px-5 py-3.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/3' : 'hover:bg-slate-50'} transition-colors`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${darkMode ? 'bg-white/8 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                      {(h.canal || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>@{h.canal}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        {h.extraidos ?? h.total ?? 0} vídeos extraídos
                        {projetoPrefixo && <> · Projeto: <span className="font-medium">{projetoPrefixo}</span></>}
                      </p>
                    </div>
                    {cfg.enabled && (
                      <div className="flex gap-1">
                        {['ao_abrir', 'diario', 'semanal', 'mensal'].map(f => (
                          <button key={f} onClick={() => changeFreq(h.canal, cfg, f)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${BTN_FOCUS}
                              ${cfg.frequencia === f
                                ? 'bg-cyan-500 border-cyan-500 text-white'
                                : darkMode ? 'border-white/10 text-slate-500 hover:border-cyan-500/40 hover:text-cyan-400' : 'border-slate-200 text-slate-400 hover:border-cyan-400 hover:text-cyan-600'}`}>
                            {FREQ_LABELS[f]}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleEnabled(h.canal, cfg)}
                      role="switch" aria-checked={cfg.enabled}
                      className={`w-9 h-5 rounded-full flex items-center shrink-0 transition-colors px-0.5 ${BTN_FOCUS}
                        ${cfg.enabled ? 'bg-cyan-500 justify-end' : darkMode ? 'bg-white/15 justify-start' : 'bg-slate-300 justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className={`text-[10px] text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            O Tusab verifica novos vídeos na frequência configurada e os enfileira automaticamente para extração.
          </p>
        </div>
      )}
    </div>
  );
}
