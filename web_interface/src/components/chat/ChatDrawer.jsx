/**
 * @file ChatDrawer.jsx
 * @description Floating chat drawer for interacting with the indexed RAG agent
 * @module components/chat/ChatDrawer
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Bot, Loader2, ExternalLink, Send } from 'lucide-react';

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
  agentStatus,
  canalConfigurado,
  canalMeta,
  chatEndRef,
  buscaAmpla,
  setBuscaAmpla,
}) {
  const { t } = useTranslation();

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
                <div className={`absolute bottom-8 right-0 w-56 p-2.5 rounded-xl border text-[10px] leading-relaxed shadow-xl
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-10
                  ${darkMode ? 'bg-[#0C1122] border-white/20 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/60'}`}>
                  {buscaAmpla
                    ? <><strong className={darkMode ? 'text-accent' : 'text-cyan-600'}>Busca Ampla ativada</strong><br/>Usa sua base como referência principal e complementa com o conhecimento geral do modelo quando necessário.</>
                    : <><strong className={darkMode ? 'text-white' : 'text-slate-800'}>Busca Restrita</strong><br/>Responde exclusivamente com o conteúdo da sua base. Se não encontrar, diz que não encontrou.</>
                  }
                </div>
              </div>
              {chatMessages.length > 0 && (
                <button onClick={() => setChatMessages([])}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                  Limpar
                </button>
              )}
              <button onClick={() => setChatOpen(false)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                aria-label="Fechar chat">
                <X size={16} />
              </button>
            </div>

            {/* Messages area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${darkMode ? 'bg-black/20' : 'bg-slate-50'}`}
              role="log" aria-label={t('agent.chat_title')} aria-live="polite">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                  <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {!canalConfigurado
                      ? 'Configure um canal na aba Extração para usar o chat.'
                      : agentStatus.canal_indexado !== canalConfigurado
                        ? `Indexe @${canalConfigurado} na aba Agente IA para usar o chat.`
                        : t('agent.chat_empty_ready', { canal: canalConfigurado })}
                  </p>
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
                        {msg.fontes && msg.fontes.length > 0 && !msg.streaming && (
                          <div className={`pt-2 border-t space-y-1 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('agent.sources')}</p>
                            {msg.fontes.map((f, j) => (
                              <a key={j} href={f.link} target="_blank" rel="noreferrer"
                                className={`flex items-start gap-1.5 text-[10px] hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                                <ExternalLink size={9} className="mt-0.5 shrink-0" />
                                <span>{f.titulo}{f.data ? ` · ${f.data}` : ''}{canalMeta?.canal_handle ? ` · ${canalMeta.canal_handle}` : ''}</span>
                              </a>
                            ))}
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
                  placeholder={
                    !canalConfigurado
                      ? 'Configure um canal primeiro...'
                      : agentStatus.canal_indexado !== canalConfigurado
                        ? `Indexe @${canalConfigurado} primeiro...`
                        : t('agent.chat_placeholder_ready')}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
                  disabled={!agentStatus.indexed || !canalConfigurado || agentStatus.canal_indexado !== canalConfigurado || chatLoading}
                  autoFocus
                  className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                <button
                  onClick={onSend}
                  disabled={!agentStatus.indexed || !canalConfigurado || agentStatus.canal_indexado !== canalConfigurado || !chatInput.trim() || chatLoading}
                  className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
