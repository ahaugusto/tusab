/**
 * @file ChatDrawer.jsx
 * @description Floating chat drawer for interacting with the indexed RAG agent
 * @module components/chat/ChatDrawer
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Bot, Loader2, ExternalLink, Send, Database, ChevronRight, RefreshCw, Zap, ChevronDown } from 'lucide-react';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ChatDrawer — slide-in panel for streaming RAG chat
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode           - dark/light theme flag
 * @param {boolean}  props.chatOpen           - whether the drawer is visible
 * @param {Function} props.setChatOpen        - callback to open/close drawer
 * @param {Array}    props.chatMessages        - message history array
 * @param {Function} props.setChatMessages     - state setter for messages
 * @param {string}   props.chatInput           - current text input value
 * @param {Function} props.setChatInput        - state setter for input value
 * @param {boolean}  props.chatLoading         - true while streaming a response
 * @param {Function} props.onSend             - callback to send the current message
 * @param {Object}   props.agentStatus         - agent status including indexed/canal_indexado
 * @param {string}   props.canalConfigurado    - currently configured canal name
 * @param {Object}   props.canalMeta           - canal metadata (handle etc.)
 * @param {React.RefObject} props.chatEndRef   - ref to scroll anchor at end of messages
 * @param {boolean}  props.buscaAmpla          - enables broader LLM knowledge beyond indexed base
 * @param {Function} props.setBuscaAmpla       - toggles broad search mode
 * @param {Array}    props.canaisExtraidos     - extraction history (canal_nome items)
 * @param {Function} props.onIndexar          - callback(canal_nome) to trigger indexing
 * @returns {JSX.Element}
 */
function ChatDrawer({
  darkMode,
  chatOpen,
  setChatOpen,
  chatMessages,
  setChatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  onSend,
  onClearHistory,
  onRecriarIndice,
  agentStatus,
  canalConfigurado,
  onSelectCanal,
  canalMeta,
  chatEndRef,
  buscaAmpla,
  setBuscaAmpla,
  canaisExtraidos,
  onIndexar,
}) {
  const { t } = useTranslation();
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [indexSel, setIndexSel] = useState(null);

  const canaisIndexados = agentStatus.canais_indexados || [];
  const temBase = agentStatus.indexed || canaisIndexados.length > 0;
  const canalAtivo = canalConfigurado || agentStatus.canal_indexado;
  const chatHabilitado = temBase && !!canalAtivo;

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setChatOpen(false)} />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl border-l ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200'}`}>

            {/* Header */}
            <div className={`px-4 py-3.5 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
              <Sparkles size={15} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('agent.chat_title')}</p>
                {agentStatus.indexed && (
                  <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{canalConfigurado || agentStatus.canal_indexado}</p>
                )}
              </div>
              {/* Busca Ampla toggle com tooltip descritivo */}
              <div className="relative flex items-center gap-1.5 shrink-0 group">
                <span className={`text-[10px] font-medium ${buscaAmpla ? (darkMode ? 'text-accent' : 'text-cyan-600') : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                  {buscaAmpla ? 'Ampla' : 'Restrita'}
                </span>
                <button
                  role="switch"
                  aria-checked={buscaAmpla}
                  onClick={() => setBuscaAmpla(v => !v)}
                  className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${buscaAmpla ? 'bg-accent' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${buscaAmpla ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                {/* Tooltip */}
                <div className={`absolute top-full mt-2 right-0 w-56 p-2.5 rounded-xl border text-[10px] leading-relaxed shadow-xl
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-10
                  ${darkMode ? 'bg-[#0C1122] border-white/20 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/60'}`}>
                  {buscaAmpla
                    ? <><strong className={darkMode ? 'text-accent' : 'text-cyan-600'}>Busca Ampla ativada</strong><br/>Usa sua base como referência principal e complementa com o conhecimento geral do modelo quando necessário.</>
                    : <><strong className={darkMode ? 'text-white' : 'text-slate-800'}>Busca Restrita</strong><br/>Responde exclusivamente com o conteúdo da sua base. Se não encontrar, diz que não encontrou.</>
                  }
                </div>
              </div>
              {chatMessages.length > 0 && (
                <button onClick={() => { setChatMessages([]); onClearHistory?.(); }}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                  {t('chat.clear')}
                </button>
              )}
              <button onClick={() => setChatOpen(false)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                aria-label={t('chat.close')}>
                <X size={16} />
              </button>
            </div>

            {/* Messages area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${darkMode ? 'bg-black/20' : 'bg-slate-50'}`}
              role="log" aria-label={t('agent.chat_title')} aria-live="polite">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-4">
                  {!temBase ? (
                    <>
                      <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_no_index')}
                      </p>
                      {onIndexar && (
                        <button
                          onClick={() => { setIndexSel(null); setShowIndexModal(true); }}
                          className={`mt-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                            bg-accent/20 text-accent hover:bg-accent/30`}>
                          <Zap size={13} aria-hidden="true" />
                          Indexar base
                        </button>
                      )}

                      {/* Index selection modal */}
                      <AnimatePresence>
                        {showIndexModal && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full rounded-2xl border p-4 space-y-3 shadow-xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                                Selecionar base para indexar
                              </p>
                              <button onClick={() => setShowIndexModal(false)}
                                className={`p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'}`}>
                                <X size={14} />
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {/* Todos os canais */}
                              <button
                                onClick={() => setIndexSel('__todos__')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                                  ${indexSel === '__todos__'
                                    ? darkMode ? 'bg-accent/15 border-accent/40' : 'bg-cyan-50 border-cyan-300'
                                    : darkMode ? 'bg-white/4 border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                <Database size={13} className="text-accent shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Todos os canais extraídos</p>
                                  <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Indexa cada canal em sequência</p>
                                </div>
                                {indexSel === '__todos__' && <div className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                              </button>

                              {/* Canais individuais */}
                              {(canaisExtraidos || []).map(nome => (
                                <button key={nome}
                                  onClick={() => setIndexSel(nome)}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                                    ${indexSel === nome
                                      ? darkMode ? 'bg-primary/15 border-primary/40' : 'bg-violet-50 border-violet-300'
                                      : darkMode ? 'bg-white/4 border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                  <Database size={13} className="text-primary shrink-0" />
                                  <p className={`text-xs font-bold flex-1 truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{nome}</p>
                                  {indexSel === nome && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                                </button>
                              ))}
                            </div>

                            <button
                              disabled={!indexSel || agentStatus.indexing}
                              onClick={() => { onIndexar(indexSel); setShowIndexModal(false); }}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                                disabled:opacity-40 disabled:cursor-not-allowed bg-accent/20 text-accent hover:bg-accent/30`}>
                              <Zap size={13} />
                              {agentStatus.indexing ? 'Indexando…' : 'Confirmar e Indexar'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : !canalAtivo || showRepoModal ? (
                    <>
                      <Database size={28} className="text-primary" aria-hidden="true" />
                      <p className={`text-xs font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('chat.select_base_title')}</p>
                      <p className={`text-[11px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('chat.select_base_desc')}
                      </p>
                      <div className="w-full mt-1 space-y-2">
                        {canaisIndexados.map(canal => (
                          <button key={canal.nome}
                            onClick={() => { onSelectCanal?.(canal.nome); setShowRepoModal(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99]
                              ${darkMode ? 'bg-white/5 border-white/15 hover:bg-primary/15 hover:border-primary/30' : 'bg-slate-50 border-slate-200 hover:bg-violet-50 hover:border-violet-200'}`}>
                            <Database size={14} className="text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal.nome}</p>
                              <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{canal.chunks} {t('chat.chunks_indexed')}</p>
                            </div>
                            <ChevronRight size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_ready', { canal: canalAtivo })}
                      </p>
                      {canaisIndexados.length > 1 && (
                        <button onClick={() => setShowRepoModal(true)}
                          className={`text-[10px] underline ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                          {t('chat.switch_base')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2
                        ${msg.role === 'user'
                          ? 'bg-primary/20 text-primary rounded-br-sm'
                          : msg.role === 'error'
                            ? (darkMode ? 'bg-danger/15 text-danger' : 'bg-red-50 text-red-700 border border-red-200')
                            : (darkMode ? 'bg-white/8 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm')} rounded-bl-sm`}>
                        <p className="whitespace-pre-wrap">
                          {msg.content}
                          {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />}
                        </p>
                        {msg.role === 'error' && onRecriarIndice && !agentStatus?.indexing && (
                          <button
                            onClick={onRecriarIndice}
                            className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
                            <RefreshCw size={9} aria-hidden="true" />
                            {t('agent.rebuild_index')}
                          </button>
                        )}
                        {msg.fontes && msg.fontes.length > 0 && !msg.streaming && (
                          <div className={`pt-2 border-t space-y-1.5 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('agent.sources')}</p>
                            {msg.fontes.map((f, j) => {
                              const isYt  = f.aba === 'youtube' || !!f.link;
                              const icon  = isYt ? '🎬' : f.aba === 'texto' ? '📝' : '📄';
                              const label = f.titulo || f.arquivo?.replace('.txt', '') || 'Sem título';
                              const sub   = f.arquivo?.replace('.txt', '') !== label ? f.arquivo?.replace('.txt', '') : null;
                              return (
                                <div key={j} className={`rounded-lg p-2 flex items-start gap-2 ${darkMode ? 'bg-white/5' : 'bg-slate-100/60'}`}>
                                  <span className="text-sm shrink-0 mt-0.5">{icon}</span>
                                  <div className="flex-1 min-w-0">
                                    {f.link
                                      ? <a href={f.link} target="_blank" rel="noreferrer"
                                          className={`text-[10px] font-medium leading-snug flex items-center gap-1 hover:underline ${darkMode ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}>
                                          <span className="truncate">{label}</span>
                                          <ExternalLink size={8} className="shrink-0 opacity-60" />
                                        </a>
                                      : <p className={`text-[10px] font-medium leading-snug truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                                    }
                                    {sub && <p className={`text-[9px] truncate mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
                                    <div className={`flex items-center gap-1.5 mt-0.5 flex-wrap text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                      {f.data   && <span>{f.data}</span>}
                                      {f.canal  && <span className={`px-1 py-0.5 rounded font-mono ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>@{f.canal}</span>}
                                      {!isYt && f.arquivo && <span className={`px-1 py-0.5 rounded font-mono ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{f.arquivo.split('.').pop()?.toUpperCase()}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${darkMode ? 'bg-white/8' : 'bg-white border border-slate-200'}`}>
                        <Loader2 size={14} className="animate-spin text-primary" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input bar */}
            <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                <input type="text"
                  placeholder={!chatHabilitado ? t('agent.chat_placeholder_disabled') : t('agent.chat_placeholder_ready')}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
                  disabled={!chatHabilitado || chatLoading}
                  autoFocus
                  className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                <button
                  onClick={onSend}
                  disabled={!chatHabilitado || !chatInput.trim() || chatLoading}
                  className="p-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label={t('agent.send')}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ChatDrawer;
