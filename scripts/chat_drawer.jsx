          {/* ── Chat Drawer (flutuante) ── */}
          <AnimatePresence>
            {chatOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                  onClick={() => setChatOpen(false)} />
                <motion.div
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                  transition={{ type: 'tween', duration: 0.25 }}
                  className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl border-l ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200'}`}>
                  <div className={`px-4 py-3.5 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                    <Sparkles size={15} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('agent.chat_title')}</p>
                      {agentStatus.indexed && (
                        <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{agentStatus.canal_indexado}</p>
                      )}
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
                  <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${darkMode ? 'bg-black/20' : 'bg-slate-50'}`}
                    role="log" aria-label={t('agent.chat_title')} aria-live="polite">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center gap-3">
                        <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                        <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {!agentStatus.indexed ? t('agent.chat_empty_no_index') : t('agent.chat_empty_ready', { canal: agentStatus.canal_indexado })}
                        </p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${msg.role === 'user' ? 'bg-primary/20 text-primary rounded-br-sm' : msg.role === 'error' ? (darkMode ? 'bg-danger/15 text-danger' : 'bg-red-50 text-red-700 border border-red-200') : (darkMode ? 'bg-white/8 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm')} rounded-bl-sm`}>
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
                  <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                      <input type="text"
                        placeholder={agentStatus.indexed ? t('agent.chat_placeholder_ready') : t('agent.chat_placeholder_disabled')}
                        value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                        disabled={!agentStatus.indexed || chatLoading}
                        autoFocus
                        className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                      <button onClick={handleChatSend} disabled={!agentStatus.indexed || !chatInput.trim() || chatLoading}
                        className={`p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                        aria-label={t('agent.send')}>
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Botão flutuante Chat ── */}
          {!chatOpen && (
            <motion.button
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-primary to-accent hover:scale-110 active:scale-95 transition-transform"
              aria-label="Abrir chat com o agente">
              <Bot size={24} className="text-white" />
              {agentStatus.indexed && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-secondary border-2 border-white" />
              )}
              {chatMessages.filter(m => m.role === 'assistant').length > 0 && (
                <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                  {chatMessages.filter(m => m.role === 'assistant').length}
                </span>
              )}
            </motion.button>
          )}

