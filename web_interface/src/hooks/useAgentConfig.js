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
  fetchCanalMeta,
  fetchAgentStatus,
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
    canais_indexados: [],
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
  const [ollamaStatus,         setOllamaStatus]         = useState({ running: false, models: [] });
  const [ollamaModel,          setOllamaModel]          = useState('llama3.2:1b');
  const [configOpen,           setConfigOpen]           = useState(true);
  const [queryExpansion,       setQueryExpansion]       = useState(false);
  const [persona,              setPersona]              = useState('');
  const [canalMeta,            setCanalMeta]            = useState(null);

  // ─── Effects ─────────────────────────────────────────────────────────────

  /** Loads saved agent config on mount and sets Ollama as default if no external key */
  useEffect(() => {
    loadAgentConfig().then(async r => {
      if (r.data.ollama_model) setOllamaModel(r.data.ollama_model);
      if (r.data.query_expansion !== undefined) setQueryExpansion(!!r.data.query_expansion);
      if (r.data.persona !== undefined) setPersona(r.data.persona || '');
      const hasExternalKey = r.data.provider && r.data.provider !== 'ollama' && r.data.api_key;
      if (hasExternalKey) {
        setAgentProvider(r.data.provider);
        setUseExternalProvider(true);
        // Se a chave está criptografada no keychain, recupera para passar ao backend
        if (r.data.api_key === '__encrypted__' && window.tusab?.getApiKey) {
          const realKey = await window.tusab.getApiKey(r.data.provider).catch(() => null);
          if (realKey) {
            // Reinforma o backend com a chave real (sem exibir na UI)
            saveAgentConfig({ provider: r.data.provider, api_key: realKey }).catch(() => {});
          }
        }
        setAgentApiKey('');
      } else {
        setAgentProvider('ollama');
        setUseExternalProvider(false);
        saveAgentConfig({ provider: 'ollama', api_key: '', idioma: i18n.language })
          .then(() => loadAgentConfig())
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  /** Syncs UI language to agent_config.json whenever the user changes the language.
   *  Não envia api_key para evitar apagar chave externa configurada (WARN-19). */
  useEffect(() => {
    if (!i18n.language) return;
    const provider = useExternalProvider ? agentProvider : 'ollama';
    saveAgentConfig({ provider, api_key: '__keep__', idioma: i18n.language }).catch(() => {});
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

  /** Fetches canal metadata when the agent tab is active */
  useEffect(() => {
    if (activeTab !== 'agente') return;
    fetchCanalMeta()
      .then(r => { if (r.data && r.data.canal_nome) setCanalMeta(r.data); })
      .catch(() => {});
  }, [activeTab, agentStatus.canal_indexado]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  /** Saves selected Ollama model to config and switches provider to Ollama */
  const handleOllamaModelChange = async (model) => {
    setOllamaModel(model);
    setUseExternalProvider(false);
    setAgentProvider('ollama');
    await saveAgentConfig({ provider: 'ollama', api_key: '', ollama_model: model, persona, idioma: i18n.language })
      .catch(() => showError('Erro ao salvar modelo. Tente novamente.'));
  };

  /** Saves persona immediately (no key required) */
  const handlePersonaChange = async (novaPersona) => {
    setPersona(novaPersona);
    const provider = useExternalProvider ? agentProvider : 'ollama';
    await saveAgentConfig({ provider, api_key: '', persona: novaPersona, idioma: i18n.language })
      .catch(() => {});
  };

  /** Clears external API key and resets provider to Ollama */
  const handleRemoveApiKey = async () => {
    setAgentApiKey('');
    setTestKeyResult(null);
    setAgentKeyError('');
    setKeyTested(false);
    // Remove do keychain também
    if (agentProvider && window.tusab?.deleteApiKey) {
      window.tusab.deleteApiKey(agentProvider).catch(() => {});
    }
    await saveAgentConfig({ provider: 'ollama', api_key: '', idioma: i18n.language })
      .catch(() => showError('Erro ao remover chave. Tente novamente.'));
    setUseExternalProvider(false);
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
    setSavingConfig(true);
    setAgentKeyError('');
    setConfigSaved(false);
    setTestKeyResult(null);
    const provider = useExternalProvider ? agentProvider : 'ollama';
    const apiKey   = useExternalProvider ? agentApiKey.trim() : '';
    try {
      // Grava no OS keychain quando disponível; backend recebe sentinel
      let backendKey = apiKey;
      if (apiKey && window.tusab?.setApiKey) {
        const stored = await window.tusab.setApiKey(provider, apiKey).catch(() => false);
        if (stored) backendKey = '__encrypted__';
      }
      const res = await saveAgentConfig({ provider, api_key: backendKey, persona, idioma: i18n.language });
      if (res.data.error) {
        setAgentKeyError(res.data.message);
      } else {
        setConfigSaved(true);
        Analytics.provedorConfigurado(provider);
        setTimeout(() => setConfigSaved(false), 4000);
      }
    } catch {
      setAgentKeyError(t('agent.key_error_server'));
    }
    setSavingConfig(false);
  };

  /** Tests the API key inline (without saving) */
  const handleTestKey = async () => {
    setTestingKey(true);
    setTestKeyResult(null);
    setKeyTested(false);
    try {
      const res = await testAgentKey({ provider: agentProvider, api_key: agentApiKey.trim() });
      const ok = !res.data.error;
      setTestKeyResult({ ok, message: res.data.message });
      setKeyTested(ok);
    } catch {
      setTestKeyResult({ ok: false, message: t('agent.key_error_server') });
    }
    setTestingKey(false);
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
    ollamaStatus,         setOllamaStatus,
    ollamaModel,          setOllamaModel,
    configOpen,           setConfigOpen,
    queryExpansion,       setQueryExpansion,
    persona,              setPersona,
    canalMeta,            setCanalMeta,
    // handlers
    handleOllamaModelChange,
    handlePersonaChange,
    handleSaveAgentConfig,
    handleRemoveApiKey,
    handleTestKey,
    setCanalAtivo,
  };
}
