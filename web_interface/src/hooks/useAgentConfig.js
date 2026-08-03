/**
 * @file useAgentConfig.js
 * @description Custom hook encapsulating all agent configuration state, effects
 *              and handlers (provider, API key, Ollama, canal metadata).
 * @module hooks/useAgentConfig
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  saveAgentConfig,
  loadAgentConfig,
  testAgentKey,
  fetchOllamaStatus,
  fetchCustomStatus,
  fetchCanalMeta,
  fetchAgentStatus,
  fetchSummarizePending,
  startSummarize,
  cancelSummarize,
} from '../services/api';
import { Analytics } from '../services/analytics';

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAgentConfig — manages all agent/LLM configuration state and side-effects.
 *
 * @param {{ activeTab: string, showError: Function }} params
 * @returns {Object} Agent config state and handlers
 */
export function useAgentConfig({ activeTab, showError }) {
  const { t, i18n } = useTranslation();

  // ─── State ───────────────────────────────────────────────────────────────

  // [CONTRATO] Shape de agentStatus espelhado de router_agent.py:GET /agent/status.
  // Adicionar campo aqui exige adicionar no backend. Remover campo aqui quebra
  // RepositorioTab (canais_indexados), ChatDrawer (indexed) e App.jsx (indexing).
  // Ver: Documentação do Produto/Mapa de Impacto de Dependências.md §3.4
  const [agentStatus,          setAgentStatus]          = useState({
    configured: false,
    provider: '',
    canal_indexado: '',
    index_count: 0,
    indexed: false,
    indexing: false,
    index_logs: [],
    index_progress: { processed: 0, total: 0 },
    canais_indexados: [],
    summarizing: false,
    summarize_progress: 0,
    summarize_logs: [],
  });
  const [agentProvider,        setAgentProvider]        = useState('gemini');
  const [agentApiKey,          setAgentApiKey]          = useState('');
  const [showApiKey,           setShowApiKey]           = useState(false);
  const [agentKeyError,        setAgentKeyError]        = useState('');
  const [configSaved,          setConfigSaved]          = useState(false);
  const [testingKey,           setTestingKey]           = useState(false);
  const [testKeyResult,        setTestKeyResult]        = useState(null);
  const [keyTested,            setKeyTested]            = useState(false);
  const [savingConfig,         setSavingConfig]         = useState(false);
  const [useExternalProvider,  setUseExternalProvider]  = useState(false);
  // Terceiro modo, distinto de useExternalProvider: servidor OpenAI-compatible
  // self-hosted (ex: 9router) — posicionado como opção grátis/local, não como
  // mais um provider de chave paga. Mutuamente exclusivo com useExternalProvider.
  const [useCustomEndpoint,    setUseCustomEndpoint]    = useState(false);
  const [customBaseUrl,        setCustomBaseUrl]        = useState('');
  const [customModel,          setCustomModel]          = useState('');
  const [customStatus,         setCustomStatus]         = useState({ running: false, models: [] });
  const [customStatusChecking, setCustomStatusChecking] = useState(false);
  const [ollamaStatus,         setOllamaStatus]         = useState({ running: false, models: [] });
  const [ollamaModel,          setOllamaModel]          = useState('llama3.2:1b');
  const [configOpen,           setConfigOpen]           = useState(true);
  const [queryExpansion,       setQueryExpansion]       = useState(false);
  const [persona,              setPersona]              = useState('');
  const [personaCustom,        setPersonaCustom]        = useState('');
  const [mostrarRaciocinio,    setMostrarRaciocinio]    = useState(false);
  const [canalMeta,            setCanalMeta]            = useState(null);

  // ─── Aprofundar base ─────────────────────────────────────────────────────
  const [aprofundarOpen,       setAprofundarOpen]       = useState(false);
  const [aprofundarPendente,   setAprofundarPendente]   = useState({ total: 0, canais: [] });
  const [aprofundarRodando,    setAprofundarRodando]    = useState(false);
  const [aprofundarProgresso,  setAprofundarProgresso]  = useState(0);

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Guarda contra a corrida entre este load assíncrono e o efeito de sync de
  // idioma logo abaixo: sem isso, o efeito de idioma dispara no primeiro
  // render com os defaults do useState (useExternalProvider=false,
  // useCustomEndpoint=false) — ANTES da config real ter voltado do backend —
  // e grava provider:'ollama' por cima do que estava configurado de verdade
  // (custom ou externo). Bug real reportado: "não consigo desabilitar o
  // Ollama" / "algum deles sempre parece ativo".
  const configLoadedRef = useRef(false);

  /** Loads saved agent config on mount and sets Ollama as default if no external key */
  useEffect(() => {
    loadAgentConfig().then(async r => {
      configLoadedRef.current = true;
      if (r.data.ollama_model) setOllamaModel(r.data.ollama_model);
      if (r.data.query_expansion !== undefined) setQueryExpansion(!!r.data.query_expansion);
      if (r.data.persona !== undefined) setPersona(r.data.persona || '');
      if (r.data.persona_custom !== undefined) setPersonaCustom(r.data.persona_custom || '');
      if (r.data.mostrar_raciocinio !== undefined) setMostrarRaciocinio(!!r.data.mostrar_raciocinio);
      if (r.data.provider === 'custom') {
        setUseCustomEndpoint(true);
        setUseExternalProvider(false);
        setCustomBaseUrl(r.data.custom_base_url || '');
        setCustomModel(r.data.custom_model || '');
        if (r.data.api_key === '__encrypted__' && window.tusab?.getApiKey) {
          const realKey = await window.tusab.getApiKey('custom').catch(() => null);
          if (realKey) {
            saveAgentConfig({
              provider: 'custom', api_key: realKey,
              custom_base_url: r.data.custom_base_url, custom_model: r.data.custom_model,
              mostrar_raciocinio: !!r.data.mostrar_raciocinio,
            }).catch(() => {});
          }
        }
        setAgentApiKey('');
        return;
      }
      const hasExternalKey = r.data.provider && r.data.provider !== 'ollama' && r.data.api_key;
      if (hasExternalKey) {
        setAgentProvider(r.data.provider);
        setUseExternalProvider(true);
        // Se a chave está criptografada no keychain, recupera para passar ao backend
        if (r.data.api_key === '__encrypted__' && window.tusab?.getApiKey) {
          const realKey = await window.tusab.getApiKey(r.data.provider).catch(() => null);
          if (realKey) {
            // Reinforma o backend com a chave real (sem exibir na UI)
            saveAgentConfig({ provider: r.data.provider, api_key: realKey, mostrar_raciocinio: !!r.data.mostrar_raciocinio }).catch(() => {});
          }
        }
        setAgentApiKey('');
      } else {
        setAgentProvider('ollama');
        setUseExternalProvider(false);
        saveAgentConfig({ provider: 'ollama', api_key: '', idioma: i18n.language, mostrar_raciocinio: !!r.data.mostrar_raciocinio })
          .then(() => loadAgentConfig())
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  /** Syncs UI language to agent_config.json whenever the user changes the language.
   *  Não envia api_key para evitar apagar chave externa configurada (WARN-19).
   *  Só dispara depois do load inicial (configLoadedRef) — antes disso, o
   *  provider "atual" ainda são os defaults do useState, não o que está
   *  realmente salvo (ver comentário no load acima). */
  useEffect(() => {
    if (!i18n.language || !configLoadedRef.current) return;
    const provider = useCustomEndpoint ? 'custom' : useExternalProvider ? agentProvider : 'ollama';
    saveAgentConfig({ provider, api_key: '__keep__', idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio }).catch(() => {});
  }, [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const canalAtivoRef = useRef('');
  const setCanalAtivo = (canal) => { canalAtivoRef.current = canal || ''; };

  const [indexingDoneCount, setIndexingDoneCount] = useState(0);
  const prevIndexingPollRef = useRef(false);

  const refetchAgentStatus = () =>
    fetchAgentStatus(canalAtivoRef.current).then(r => {
      const next = r.data;
      if (prevIndexingPollRef.current && !next.indexing) {
        setIndexingDoneCount(c => c + 1);
      }
      prevIndexingPollRef.current = next.indexing;
      setAgentStatus(next);
    }).catch(() => {});

  /** Polls agent status every 3 seconds (indexing progress, canal_indexado, etc.) */
  useEffect(() => {
    const iv = setInterval(refetchAgentStatus, 3000);
    refetchAgentStatus();
    return () => clearInterval(iv);
  }, []);

  /** Polls Ollama status every 5 seconds */
  useEffect(() => {
    const iv = setInterval(() => {
      fetchOllamaStatus().then(r => setOllamaStatus(r.data)).catch(() => {});
    }, 5000);
    fetchOllamaStatus().then(r => setOllamaStatus(r.data)).catch(() => {});
    return () => clearInterval(iv);
  }, []);

  /** Checks the custom endpoint (only while the section is open) — debounced
   *  while typing, so it doesn't fire a request per keystroke. Só verifica
   *  URLs que já parecem http(s) válidas — não bate em texto incompleto. */
  const refreshCustomStatus = async (url) => {
    setCustomStatusChecking(true);
    try {
      const r = await fetchCustomStatus(url);
      setCustomStatus(r.data);
    } catch {
      setCustomStatus({ running: false, models: [] });
    }
    setCustomStatusChecking(false);
  };

  useEffect(() => {
    if (!useCustomEndpoint) return;
    const url = customBaseUrl.trim();
    if (!/^https?:\/\/.+/i.test(url)) { setCustomStatus({ running: false, models: [] }); return; }
    const timer = setTimeout(() => { refreshCustomStatus(url); }, 700);
    return () => clearTimeout(timer);
  }, [useCustomEndpoint, customBaseUrl]);

  /** Fetches canal metadata when the agent tab is active */
  useEffect(() => {
    if (activeTab !== 'agente') return;
    fetchCanalMeta()
      .then(r => { if (r.data && r.data.canal_nome) setCanalMeta(r.data); })
      .catch(() => {});
  }, [activeTab, agentStatus.canal_indexado]);

  // Sincroniza progresso de sumarização com o backend via polling de agentStatus
  useEffect(() => {
    if (!aprofundarRodando) return;
    if (agentStatus.summarizing) {
      setAprofundarProgresso(agentStatus.summarize_progress ?? 0);
    } else if (aprofundarProgresso > 0) {
      setAprofundarProgresso(100);
      setAprofundarRodando(false);
    }
  }, [agentStatus.summarizing, agentStatus.summarize_progress, aprofundarRodando]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  /** Saves selected Ollama model to config and switches provider to Ollama */
  const handleOllamaModelChange = async (model) => {
    setOllamaModel(model);
    setUseExternalProvider(false);
    setUseCustomEndpoint(false);
    setAgentProvider('ollama');
    await saveAgentConfig({ provider: 'ollama', api_key: '', ollama_model: model, persona, idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio })
      .catch(() => showError('Erro ao salvar modelo. Tente novamente.'));
  };

  /** Saves persona immediately (no key required) */
  const handlePersonaChange = async (novaPersona) => {
    setPersona(novaPersona);
    const provider = useCustomEndpoint ? 'custom' : useExternalProvider ? agentProvider : 'ollama';
    await saveAgentConfig({ provider, api_key: '__keep__', persona: novaPersona, idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio })
      .catch(() => {});
  };

  /** Saves the free-text custom tone (from the "Custom" persona modal) and
   *  activates it as the current persona. */
  const handlePersonaCustomSave = async (texto) => {
    const limpo = texto.trim().slice(0, 300);
    setPersona('custom');
    setPersonaCustom(limpo);
    const provider = useCustomEndpoint ? 'custom' : useExternalProvider ? agentProvider : 'ollama';
    await saveAgentConfig({ provider, api_key: '__keep__', persona: 'custom', persona_custom: limpo, idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio })
      .catch(() => {});
  };

  /** Toggles "mostrar raciocínio do modelo" — só afeta modelos Ollama com
   *  thinking nativo (qwen3, deepseek-r1); outros ignoram silenciosamente. */
  const handleToggleMostrarRaciocinio = async () => {
    const novoValor = !mostrarRaciocinio;
    setMostrarRaciocinio(novoValor);
    const provider = useCustomEndpoint ? 'custom' : useExternalProvider ? agentProvider : 'ollama';
    await saveAgentConfig({ provider, api_key: '__keep__', persona, idioma: i18n.language, mostrar_raciocinio: novoValor })
      .catch(() => { setMostrarRaciocinio(!novoValor); showError('Erro ao salvar preferência. Tente novamente.'); });
  };

  /** Clears external API key or endpoint customizado, resets provider to Ollama */
  const handleRemoveApiKey = async () => {
    const providerAtual = useCustomEndpoint ? 'custom' : agentProvider;
    setAgentApiKey('');
    setTestKeyResult(null);
    setAgentKeyError('');
    setKeyTested(false);
    // Remove do keychain também
    if (providerAtual && window.tusab?.deleteApiKey) {
      window.tusab.deleteApiKey(providerAtual).catch(() => {});
    }
    await saveAgentConfig({ provider: 'ollama', api_key: '', idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio })
      .catch(() => showError('Erro ao remover chave. Tente novamente.'));
    setUseExternalProvider(false);
    setUseCustomEndpoint(false);
    setCustomBaseUrl('');
    setCustomModel('');
    setAgentProvider('ollama');
    // Força refresh do agentStatus via leitura do config
    loadAgentConfig().catch(() => {});
  };

  /** Saves the agent provider and API key configuration */
  const handleSaveAgentConfig = async () => {
    if (useExternalProvider && !agentApiKey.trim()) {
      setAgentKeyError(t('agent.key_error_required'));
      return;
    }
    if (useCustomEndpoint && !customBaseUrl.trim()) {
      setAgentKeyError(t('agent.custom_url_error_required'));
      return;
    }
    setSavingConfig(true);
    setAgentKeyError('');
    setConfigSaved(false);
    setTestKeyResult(null);
    const provider = useCustomEndpoint ? 'custom' : useExternalProvider ? agentProvider : 'ollama';
    const apiKey   = (useExternalProvider || useCustomEndpoint) ? agentApiKey.trim() : '';
    try {
      // Grava no OS keychain quando disponível; backend recebe sentinel
      let backendKey = apiKey;
      if (apiKey && window.tusab?.setApiKey) {
        const stored = await window.tusab.setApiKey(provider, apiKey).catch(() => false);
        if (stored) backendKey = '__encrypted__';
      }
      const payload = { provider, api_key: backendKey, persona, idioma: i18n.language, mostrar_raciocinio: mostrarRaciocinio };
      if (useCustomEndpoint) {
        payload.custom_base_url = customBaseUrl.trim();
        payload.custom_model = customModel.trim();
      }
      const res = await saveAgentConfig(payload);
      if (res.data.error) {
        setAgentKeyError(res.data.message);
      } else {
        setConfigSaved(true);
        Analytics.provedorConfigurado(provider);
        setTimeout(() => setConfigSaved(false), 4000);
        // Verifica vídeos sem resumo para oferecer "Aprofundar base"
        try {
          const pending = await fetchSummarizePending();
          if (pending.data.total > 0) {
            setAprofundarPendente({ total: pending.data.total, canais: pending.data.canais || [] });
            setAprofundarOpen(true);
          }
        } catch { /* silencioso — não bloqueia o fluxo principal */ }
      }
    } catch {
      setAgentKeyError(t('agent.key_error_server'));
    }
    setSavingConfig(false);
  };

  /** Tests the API key or endpoint customizado inline (without saving) */
  const handleTestKey = async () => {
    setTestingKey(true);
    setTestKeyResult(null);
    setKeyTested(false);
    try {
      const payload = useCustomEndpoint
        ? { provider: 'custom', api_key: agentApiKey.trim(), custom_base_url: customBaseUrl.trim(), custom_model: customModel.trim() }
        : { provider: agentProvider, api_key: agentApiKey.trim() };
      const res = await testAgentKey(payload);
      const ok = !res.data.error;
      setTestKeyResult({ ok, message: res.data.message });
      setKeyTested(ok);
    } catch {
      setTestKeyResult({ ok: false, message: t('agent.key_error_server') });
    }
    setTestingKey(false);
  };

  /** Inicia sumarização para todos os canais com pendências */
  const handleAprofundarConfirm = async () => {
    if (aprofundarPendente.canais.length === 0) return;
    setAprofundarRodando(true);
    setAprofundarProgresso(0);
    // Dispara todos os canais; progresso real vem via polling de agentStatus.summarize_progress
    for (const c of aprofundarPendente.canais) {
      try { await startSummarize(c.prefixo); } catch { /* segue */ }
    }
  };

  const handleAprofundarClose = () => {
    if (aprofundarRodando) {
      cancelSummarize().catch(() => {});
      setAprofundarRodando(false);
    }
    setAprofundarOpen(false);
    setAprofundarProgresso(0);
  };

  // ─── Return ──────────────────────────────────────────────────────────────

  return {
    // state
    agentStatus,          setAgentStatus,     refetchAgentStatus,  indexingDoneCount,
    agentProvider,        setAgentProvider,
    agentApiKey,          setAgentApiKey,
    showApiKey,           setShowApiKey,
    agentKeyError,        setAgentKeyError,
    configSaved,          setConfigSaved,
    testingKey,
    testKeyResult,        setTestKeyResult,
    keyTested,            setKeyTested,
    savingConfig,
    useExternalProvider,  setUseExternalProvider,
    useCustomEndpoint,    setUseCustomEndpoint,
    customBaseUrl,        setCustomBaseUrl,
    customModel,          setCustomModel,
    customStatus,         customStatusChecking,  refreshCustomStatus,
    ollamaStatus,         setOllamaStatus,
    ollamaModel,          setOllamaModel,
    configOpen,           setConfigOpen,
    queryExpansion,       setQueryExpansion,
    persona,              setPersona,
    personaCustom,        setPersonaCustom,
    mostrarRaciocinio,    setMostrarRaciocinio,
    canalMeta,            setCanalMeta,
    aprofundarOpen,       aprofundarPendente,
    aprofundarRodando,    aprofundarProgresso,
    // handlers
    handleOllamaModelChange,
    handlePersonaChange,
    handlePersonaCustomSave,
    handleToggleMostrarRaciocinio,
    handleSaveAgentConfig,
    handleRemoveApiKey,
    handleAprofundarConfirm,
    handleAprofundarClose,
    handleTestKey,
    setCanalAtivo,
  };
}
