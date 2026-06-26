import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  KeyRound, CheckCircle2, Eye, EyeOff, AlertTriangle, Loader2,
  Zap, ArrowUp, Sparkles, X, Info, ExternalLink, GraduationCap,
} from 'lucide-react';
import OllamaSetup from '../agent/OllamaSetup';
import { BasePainel } from '../agent/BasePainel';
import EstudoTab from '../agent/EstudoTab';
import { BTN_FOCUS } from '../../constants';
import { saveAgentConfig } from '../../services/api';

export default function AgentTab({
  darkMode,
  mainScrollRef,
  // agent config state (from useAgentConfig)
  agentStatus,
  agentProvider,       setAgentProvider,
  agentApiKey,         setAgentApiKey,
  showApiKey,          setShowApiKey,
  agentKeyError,       setAgentKeyError,
  configSaved,
  testingKey,
  testKeyResult,       setTestKeyResult,
  keyTested,           setKeyTested,
  savingConfig,
  useExternalProvider, setUseExternalProvider,
  ollamaStatus,        setOllamaStatus,
  ollamaModel,
  configOpen,          setConfigOpen,
  persona,
  // handlers
  handleOllamaModelChange,
  handlePersonaChange,
  handleSaveAgentConfig,
  handleRemoveApiKey,
  handleTestKey,
  // hint state
  showAgentHint,       setShowAgentHint,
  // base visibility panel
  onIndexar,
}) {
  const { t } = useTranslation();
  const [estudoOpen, setEstudoOpen] = useState(false);
  const canalAtivo = agentStatus?.canal_indexado || '';

  return (
    <div id="panel-agente" role="tabpanel" aria-labelledby="tab-agente"
      ref={mainScrollRef}
      className="flex-1 overflow-y-auto px-4 lg:px-8 pt-5 pb-6 space-y-4 custom-scrollbar">

      {/* First-visit hint */}
      <AnimatePresence>
        {showAgentHint && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`rounded-2xl border p-4 flex gap-3 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>
            <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Configure o Agente em 3 passos</p>
              <ol className={`text-[11px] space-y-0.5 list-none ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <li>1. Escolha o provedor de IA e salve sua chave de API</li>
                <li>2. Clique em <strong>Indexar Agora</strong> para preparar a base</li>
                <li>3. Use o chat para perguntar sobre o canal</li>
              </ol>
            </div>
            <button onClick={() => setShowAgentHint(false)}
              className={`shrink-0 p-1 rounded-md transition-colors ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'} ${BTN_FOCUS}`}
              aria-label="Fechar dica">
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provider configuration */}
      <section aria-labelledby="agent-config-heading"
        className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <button
          aria-expanded={configOpen} aria-controls="agent-config-body"
          onClick={() => setConfigOpen(v => !v)}
          className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${configOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
          <KeyRound size={14} className="text-primary shrink-0" aria-hidden="true" />
          <h3 id="agent-config-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
            {t('agent.provider_title')}
          </h3>
          {agentStatus.configured && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-secondary mr-2">
              <CheckCircle2 size={11} /> {t('agent.configured_badge')}
            </span>
          )}
          <motion.div animate={{ rotate: configOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {configOpen && (
            <motion.div id="agent-config-body"
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}>
              <div className="p-5 space-y-4">
                <OllamaSetup darkMode={darkMode} ollamaStatus={ollamaStatus} setOllamaStatus={setOllamaStatus} btnFocus={BTN_FOCUS} ollamaModel={ollamaModel} onModelChange={handleOllamaModelChange} isStandby={useExternalProvider} />

                {/* External provider toggle */}
                <div className={`flex items-center justify-between py-3 border-t ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                  <div>
                    <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>Usar minha chave de API</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>Gemini, OpenAI, Claude ou Groq</p>
                  </div>
                  <button
                    role="switch" aria-checked={useExternalProvider}
                    onClick={() => {
                      const next = !useExternalProvider;
                      setUseExternalProvider(next);
                      if (!next) {
                        setAgentProvider('ollama');
                        saveAgentConfig({ provider: 'ollama', api_key: '' }).catch(() => {});
                      }
                    }}
                    className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${useExternalProvider ? 'bg-primary' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${useExternalProvider ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* API key section */}
                <AnimatePresence initial={false}>
                  {useExternalProvider && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                      className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'gemini',    label: 'Google Gemini'    },
                          { id: 'openai',    label: 'OpenAI'           },
                          { id: 'anthropic', label: 'Anthropic Claude' },
                          { id: 'groq',      label: 'Groq (gratuito)'  },
                        ].map(({ id, label }) => (
                          <button key={id} onClick={() => { setAgentProvider(id); setTestKeyResult(null); setKeyTested(false); }}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${BTN_FOCUS}
                              ${agentProvider === id
                                ? 'border-primary bg-primary/15 text-primary'
                                : darkMode ? 'border-white/15 text-slate-400 hover:border-white/30' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className={`text-[11px] flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <Info size={11} />
                        {agentProvider === 'gemini'    && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_gemini')} <ExternalLink size={9} /></a>}
                        {agentProvider === 'openai'    && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_openai')} <ExternalLink size={9} /></a>}
                        {agentProvider === 'anthropic' && <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_anthropic')} <ExternalLink size={9} /></a>}
                        {agentProvider === 'groq'      && <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_groq')} <ExternalLink size={9} /></a>}
                      </div>
                      <div className={`flex items-start gap-2 rounded-xl p-2.5 text-[10px] leading-relaxed ${darkMode ? 'bg-amber-500/8 border border-amber-500/20 text-amber-300/70' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                        <Info size={11} className="shrink-0 mt-0.5" />
                        <span>Ao usar este provedor, mensagens e trechos da sua base são enviados para servidores externos fora do Brasil (LGPD Art. 33).</span>
                      </div>

                      {/* Key input */}
                      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40
                        ${keyTested ? darkMode ? 'border-secondary/50 bg-secondary/5' : 'border-emerald-300 bg-emerald-50' : darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                        <input type={showApiKey ? 'text' : 'password'}
                          placeholder={t('agent.key_placeholder')}
                          value={agentApiKey}
                          onChange={e => { setAgentApiKey(e.target.value); setAgentKeyError(''); setTestKeyResult(null); setKeyTested(false); }}
                          className={`flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                        <button onClick={() => setShowApiKey(!showApiKey)}
                          className={`shrink-0 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500'} ${BTN_FOCUS}`}
                          aria-label={showApiKey ? t('agent.key_hide') : t('agent.key_show')}>
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      {/* Test button */}
                      <button onClick={handleTestKey}
                        disabled={testingKey || !agentApiKey.trim() || keyTested}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed ${BTN_FOCUS}
                          ${keyTested
                            ? darkMode ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : !agentApiKey.trim()
                              ? 'opacity-40 ' + (darkMode ? 'bg-white/8 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-400 border border-slate-200')
                              : darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30' : 'bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200'}`}>
                        {testingKey
                          ? <><Loader2 size={12} className="animate-spin" /> Testando…</>
                          : keyTested
                            ? <><CheckCircle2 size={12} /> Chave verificada</>
                            : <><Zap size={12} /> Testar chave</>}
                      </button>

                      {/* Feedback */}
                      {agentKeyError && (
                        <p role="alert" className="text-[11px] text-danger flex items-center gap-1">
                          <AlertTriangle size={11} /> {agentKeyError}
                        </p>
                      )}
                      {testKeyResult && (
                        <p role="status" className={`text-[11px] flex items-center gap-1 font-medium ${testKeyResult.ok ? 'text-secondary' : 'text-danger'}`}>
                          {testKeyResult.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {testKeyResult.message}
                        </p>
                      )}
                      {agentApiKey.trim() && !keyTested && !testKeyResult && (
                        <p className={`text-[10px] flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Info size={10} /> Teste a chave antes de salvar
                        </p>
                      )}

                      {/* Save / clear */}
                      <div className="flex gap-2">
                        <button onClick={handleRemoveApiKey}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors border-danger/40 text-danger hover:bg-danger/10 ${BTN_FOCUS}`}>
                          Limpar
                        </button>
                        <button onClick={handleSaveAgentConfig}
                          disabled={savingConfig || !keyTested}
                          title={!keyTested ? 'Teste a chave primeiro' : undefined}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                            ${configSaved ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary hover:bg-primary/30'} ${BTN_FOCUS}`}>
                          {savingConfig ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                          {savingConfig ? t('agent.saving') : configSaved ? `✓ ${t('agent.config_saved')}` : t('agent.save_config')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Personas section */}
      <section id="agent-persona-section" aria-labelledby="agent-persona-heading"
        className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 flex items-center gap-2 border-b ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={persona ? 'text-primary' : darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <h3 id="agent-persona-heading" className={`text-xs font-bold flex-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            {t('agent.persona_title')}
          </h3>
          {persona && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-primary/15 text-primary' : 'bg-violet-100 text-violet-700'}`}>
              {t('agent.persona_active')}
            </span>
          )}
        </div>
        <div className="p-4 space-y-2">
          <p className={`text-[11px] mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            Define como o assistente comunica as respostas — sem alterar o que ele busca.
          </p>
          {[
            { id: '',             emoji: '⚪', label: t('persona.default'),      desc: t('persona.default_desc')      },
            { id: 'objetivo',     emoji: '🎯', label: t('persona.objetivo'),     desc: t('persona.objetivo_desc')     },
            { id: 'tecnico',      emoji: '🔬', label: t('persona.tecnico'),      desc: t('persona.tecnico_desc')      },
            { id: 'didatico',     emoji: '📚', label: t('persona.didatico'),     desc: t('persona.didatico_desc')     },
            { id: 'descontraido', emoji: '😊', label: t('persona.descontraido'), desc: t('persona.descontraido_desc') },
            { id: 'socratico',    emoji: '🤔', label: t('persona.socratico'),    desc: t('persona.socratico_desc')    },
          ].map(p => (
            <button key={p.id} onClick={() => handlePersonaChange(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                ${persona === p.id
                  ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                  : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors
                ${persona === p.id ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                {persona === p.id && <span className="w-2 h-2 rounded-full bg-white block" />}
              </div>
              <span className="text-base leading-none shrink-0" aria-hidden="true">{p.emoji}</span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${persona === p.id ? 'text-primary' : darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{p.label}</p>
                <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Painel de visibilidade da base (S1.3) ── */}
      <section aria-label="O que o Tusab sabe"
        className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`px-5 py-3.5 border-b ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>
            Base de Conhecimento
          </h3>
        </div>
        <div className="p-4">
          <BasePainel
            darkMode={darkMode}
            basesDesatualizadas={agentStatus.bases_desatualizadas || []}
            onIndexar={onIndexar}
            agentIndexing={agentStatus.indexing}
          />
        </div>
      </section>

      {/* ── Modo Estudo ── */}
      <section aria-labelledby="estudo-heading"
        className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <button
          aria-expanded={estudoOpen} aria-controls="estudo-body"
          onClick={() => setEstudoOpen(v => !v)}
          className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${estudoOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'} ${BTN_FOCUS}`}>
          <GraduationCap size={14} className="text-primary shrink-0" aria-hidden="true" />
          <h3 id="estudo-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
            Modo Estudo
          </h3>
          {canalAtivo && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mr-1 ${darkMode ? 'bg-primary/15 text-primary' : 'bg-violet-100 text-violet-700'}`}>
              @{canalAtivo}
            </span>
          )}
          <motion.div animate={{ rotate: estudoOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {estudoOpen && (
            <motion.div id="estudo-body"
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}>
              <div className="p-4">
                <EstudoTab darkMode={darkMode} canalAtivo={canalAtivo} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
