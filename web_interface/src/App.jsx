/**
 * @file App.jsx
 * @description Root application shell — orchestrates state, routing and layout
 * @module App
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import {
  Pause, Square, Activity, FileText, Video, HelpCircle,
  Database, Zap, Terminal, Brain,
  CheckCircle2, AlertTriangle, Loader2, BarChart3, Menu, X,
  CloudOff, Trophy, Globe, MicOff, Scissors, Bot, Sparkles,
  KeyRound, BookOpen, Eye, EyeOff, ExternalLink, RefreshCw, ArrowUp, FolderOpen, Settings, Info,
  Sun, Moon, Link2, XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants, services, hooks ───────────────────────────────────────────────
import { API_BASE, BTN_FOCUS } from './constants';
import { initAnalytics, getConsent, acceptAnalytics, declineAnalytics, Analytics } from './services/analytics';
import { useOnboarding } from './hooks/useOnboarding';
import ConsentModal from './components/shared/ConsentModal';
import ProgressToast from './components/shared/ProgressToast';
import DriveWarningModal, { useDriveWarning } from './components/shared/DriveWarningModal';
import {
  fetchHistory, fetchRepositorio, setChannel, startExtraction, pauseExtraction,
  cancelExtraction, startDriveAuth, cancelDriveAuth, saveAgentConfig, loadAgentConfig,
  testAgentKey, startIndexing, cancelIndexing, fetchCanalMeta, sendChatStream, clearChatHistory,
  fetchOllamaStatus, deleteCanalIndex, openFolder,
} from './services/api';

// ─── Components ───────────────────────────────────────────────────────────────
import Onboarding               from './components/shared/Onboarding';
import GuideModal               from './components/shared/GuideModal';
import StatCard                 from './components/shared/StatCard';
import LogLine                  from './components/shared/LogLine';
import ExtractionModal          from './components/extraction/ExtractionModal';
import PostExtractionModal      from './components/extraction/PostExtractionModal';
import OllamaSetup              from './components/agent/OllamaSetup';
import RepositorioTab           from './components/agent/RepositorioTab';
import RelatorioTab             from './components/agent/RelatorioTab';
import HomeScreen               from './components/home/HomeScreen';
import ChatDrawer               from './components/chat/ChatDrawer';
import { DriveToggle }          from './components/sidebar/SidebarContent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** StatusDot — animated coloured dot representing extraction engine state */
function StatusDot({ isRunning, isPaused }) {
  if (!isRunning) return <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" aria-hidden="true" />;
  if (isPaused)   return <span className="w-2 h-2 rounded-full bg-warning shrink-0" aria-hidden="true" />;
  return              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden="true" />;
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const { t } = useTranslation();

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [showOnboarding,   setShowOnboarding]   = useState(() => !localStorage.getItem('sebayt_onboarded'));
  const [showGuide,        setShowGuide]        = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [showHome,         setShowHome]         = useState(true);
  const [activeTab,        setActiveTab]        = useState('extracao');
  const [repoAddOpen,      setRepoAddOpen]      = useState(false);
  const [showPostModal,    setShowPostModal]    = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [showScrollTop,    setShowScrollTop]    = useState(false);
  const [darkMode,         setDarkMode]         = useState(() => {
    const saved = localStorage.getItem('Sebayt_theme');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // ─── Extraction state ──────────────────────────────────────────────────────
  const ALL_TYPES = ['Videos', 'Shorts', 'Ao_Vivo', 'Podcasts', 'Cursos', 'Playlists'];
  const [extractionTypes,  setExtractionTypes]  = useState(ALL_TYPES);
  const [status,           setStatus]           = useState({
    is_running: false, is_paused: false, canal_url: '',
    drive_status: 'nao_autenticado', drive_auth_error: null,
    stats: { videos_processed: 0, videos_total: 0, videos_sem_legenda: 0, videos_legenda_curta: 0, files_generated: 0, status: 'Ocioso', progress: 0, canal_nome: '', idioma_detectado: '' },
    logs: [],
  });
  const [history,          setHistory]          = useState([]);
  const [repositorio,      setRepositorio]      = useState({ youtube: [], documentos: [], textos: [] });
  const prevExtractionStatus = useRef('');

  // ─── Canal state ───────────────────────────────────────────────────────────
  const [canalInput,       setCanalInput]       = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState('');
  const [canalError,       setCanalError]       = useState('');
  const [configurando,     setConfigurando]     = useState(false);

  // ─── Open-folder picker ────────────────────────────────────────────────────
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // ─── Agent state ───────────────────────────────────────────────────────────
  const [agentStatus,      setAgentStatus]      = useState({ configured: false, provider: '', canal_indexado: '', index_count: 0, indexed: false, indexing: false, index_logs: [], canais_indexados: [] });
  const [agentProvider,    setAgentProvider]    = useState('gemini');
  const [agentApiKey,      setAgentApiKey]      = useState('');
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [agentKeyError,    setAgentKeyError]    = useState('');
  const [configSaved,      setConfigSaved]      = useState(false);
  const [testingKey,       setTestingKey]       = useState(false);
  const [testKeyResult,    setTestKeyResult]    = useState(null);
  const [keyTested,        setKeyTested]        = useState(false);
  const [showIndexInfo,    setShowIndexInfo]    = useState(false);
  const [lastIndexLogs,    setLastIndexLogs]    = useState([]);
  const [configOpen,       setConfigOpen]       = useState(true);
  const [telemetryOpen,    setTelemetryOpen]    = useState(false);
  const [indexOpen,        setIndexOpen]        = useState(true);
  const [showAgentHint,    setShowAgentHint]    = useState(false);
  const [savingConfig,     setSavingConfig]     = useState(false);
  const [canalMeta,        setCanalMeta]        = useState(null);
  const [ollamaStatus,     setOllamaStatus]     = useState({ running: false, models: [] });
  const [ollamaModel,      setOllamaModel]      = useState('llama3.2:1b');
  const [canaisExtras,     setCanaisExtras]     = useState([]);
  const [useExternalProvider, setUseExternalProvider] = useState(false);
  const [agentIndexError,  setAgentIndexError]  = useState('');

  // ─── Chat state ────────────────────────────────────────────────────────────
  const [chatOpen,         setChatOpen]         = useState(false);
  const [buscaAmpla,       setBuscaAmpla]       = useState(false);
  const [showConsent,      setShowConsent]      = useState(() => getConsent() === null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => getConsent() === 'yes');
  const [progressToast,    setProgressToast]    = useState(null);
  const showError = (message) => setProgressToast({ type: 'error', message });
  const { seen, markSeen, KEYS } = useOnboarding();
  const { hasSeenWarning, markWarningShown } = useDriveWarning();
  const [showDriveWarning, setShowDriveWarning] = useState(false);
  const [driveOpen,        setDriveOpen]        = useState(false);
  const [chatMessages,     setChatMessages]     = useState([]);
  const [chatInput,        setChatInput]        = useState('');
  const [chatLoading,      setChatLoading]      = useState(false);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const chatEndRef      = useRef(null);
  const logContainerRef = useRef(null);
  const mainScrollRef   = useRef(null);
  const agentScrollRef  = useRef(null);
  const isVisibleRef    = useRef(true);

  // ─── Derived values ────────────────────────────────────────────────────────
  const progress        = status.stats.progress || 0;
  const isRunning       = status.is_running;
  const isPaused        = status.is_paused;
  const totalVideos     = status.stats.videos_total;
  const processedVideos = status.stats.videos_processed;
  const driveStatus     = status.drive_status || 'nao_autenticado';

  /** True when there is any content available to index (canal or files) */
  const temConteudo = !!(canalConfigurado
    || repositorio.youtube?.length > 0
    || repositorio.documentos?.length > 0
    || repositorio.textos?.length > 0);

  /** Returns the Tailwind colour class for the current extraction status text */
  const statusTextColor = () => {
    const s = status.stats.status;
    if (s.includes('Finalizado'))                          return 'text-secondary';
    if (s.includes('Erro') || s.includes('Interrompido')) return 'text-danger';
    if (s.includes('Pausa'))                              return 'text-warning';
    if (s.includes('Na fila'))                            return 'text-accent';
    if (isRunning)                                        return 'text-primary';
    return darkMode ? 'text-slate-200' : 'text-slate-700';
  };

  /** Strips query-string from a canal name for display */
  const cleanCanalName = (n) => n ? n.split('?')[0] : '';

  // ─── Effects ───────────────────────────────────────────────────────────────

  /** Pauses polling when tab is in background */
  useEffect(() => {
    const onVisibility = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /** Syncs dark class on html element */
  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);

  useEffect(() => { initAnalytics(); Analytics.appOpened(); }, []);

  /** Requests browser notification permission on first load */
  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission();
  }, []);

  /** Loads initial history and repositório on mount */
  useEffect(() => {
    fetchHistory().then(r => setHistory(r.data)).catch(() => {});
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
  }, []);

  /** Refreshes relatório + repositório when extraction stops or pauses */
  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    if (prevIsRunningRef.current && !status.is_running) {
      fetchHistory().then(r => setHistory(r.data)).catch(() => {});
      fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
    }
    prevIsRunningRef.current = status.is_running;
  }, [status.is_running]);

  /** Syncs theme with system preference when user has not set a manual override */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (localStorage.getItem('Sebayt_theme') === null) setDarkMode(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /** Sets initial HTML lang attribute from i18n */
  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('en') ? 'en'
      : i18n.language.startsWith('es') ? 'es' : 'pt-BR';
  }, []);

  /** Closes mobile sidebar on wide viewports */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Polls /status every 2 seconds (pauses when tab hidden) */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isVisibleRef.current) return;
      try {
        const res = await axios.get(`${API_BASE}/status`);
        setStatus(prev => JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data);
        if (res.data.stats?.canal_nome && !canalConfigurado) setCanalConfigurado(res.data.stats.canal_nome);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [canalConfigurado]);

  /** Auto-scrolls log container to the bottom while extraction runs */
  useEffect(() => {
    if (status.is_running && status.logs.length > 0 && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs.length, status.is_running]);

  /** Polls /agent/status every 3 seconds (pauses when tab hidden) */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isVisibleRef.current) return;
      try {
        const res = await axios.get(`${API_BASE}/agent/status`);
        setAgentStatus(res.data);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /** Loads saved agent config on mount and sets Ollama as default if no external key */
  useEffect(() => {
    loadAgentConfig().then(r => {
      if (r.data.ollama_model) setOllamaModel(r.data.ollama_model);
      const hasExternalKey = r.data.provider && r.data.provider !== 'ollama' && r.data.api_key;
      if (hasExternalKey) {
        setAgentProvider(r.data.provider);
        setAgentApiKey('');
        setUseExternalProvider(true);
      } else {
        setAgentProvider('ollama');
        setUseExternalProvider(false);
        saveAgentConfig({ provider: 'ollama', api_key: '' })
          .then(() => axios.get(`${API_BASE}/agent/status`))
          .then(r => setAgentStatus(r.data))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  /** Saves selected Ollama model to config */
  const handleOllamaModelChange = async (model) => {
    setOllamaModel(model);
    await saveAgentConfig({ provider: 'ollama', api_key: '', ollama_model: model }).catch(() => showError('Erro ao salvar modelo. Tente novamente.'));
  };

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

  /** Scrolls chat to the latest message */
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /** Tracks scroll position to show/hide scroll-to-top button */
  useEffect(() => {
    const attach = (el) => {
      if (!el) return () => {};
      const onScroll = () => setShowScrollTop(el.scrollTop > 300);
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    };
    const d1 = attach(mainScrollRef.current);
    const d2 = attach(agentScrollRef.current);
    return () => { d1(); d2(); };
  }, [activeTab]);

  /** Snapshots the last set of index logs for display after indexing completes */
  useEffect(() => {
    if (!agentStatus.indexing && agentStatus.index_logs.length > 0) {
      setLastIndexLogs(agentStatus.index_logs);
      if (!seen(KEYS.indexDone)) {
        markSeen(KEYS.indexDone);
        Analytics.baseIndexada(agentStatus.index_count);
        setProgressToast({
          message: `Base indexada — ${agentStatus.index_count} chunks prontos!`,
          nextStep: 'Abrir chat',
          onNext: () => setChatOpen(true),
        });
      }
    }
  }, [agentStatus.indexing, agentStatus.index_logs]);

  /** Shows post-extraction modal and sends desktop notification when extraction finishes */
  useEffect(() => {
    const s = status.stats.status;
    if (s === 'Finalizado ✓' && prevExtractionStatus.current !== 'Finalizado ✓') {
      setShowPostModal(true);
      Analytics.extracaoConcluida({
        videos_processados: status.stats.videos_processed,
        videos_total:       status.stats.videos_total,
        sem_legenda:        status.stats.videos_sem_legenda,
      });
      const notify = () => new Notification(t('notify.extraction_done'), {
        body: status.stats.videos_processed + ' vídeos extraídos de @' + (status.stats.canal_nome || ''),
        icon: '/logo_light_mode.svg',
      });
      if (Notification.permission === 'granted') {
        notify();
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') notify(); });
      }
    }
    prevExtractionStatus.current = s;
  }, [status.stats.status]);

  /** Tracks tab visits for the activation funnel (repositório / relatório) */
  useEffect(() => {
    if (activeTab === 'repositorio') Analytics.repositorioAcessado();
    if (activeTab === 'relatorio')   Analytics.relatorioAcessado();
  }, [activeTab]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /** Changes i18n language and syncs HTML lang attribute */
  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng === 'en' ? 'en' : lng === 'es' ? 'es' : 'pt-BR';
  };

  /** Submits the canal URL to the backend and updates configured state */
  const handleConfigurarCanal = async () => {
    if (!canalInput.trim()) { setCanalError(t('channel.error_required')); return; }
    if (!canalInput.includes('@')) { setCanalError(t('channel.error_invalid')); return; }
    setConfigurando(true); setCanalError('');
    try {
      const res = await setChannel(canalInput.trim());
      if (res.data.error) { setCanalError(res.data.message); }
      else { setCanalConfigurado(res.data.canal_nome || canalInput); setCanalInput(''); }
    } catch { setCanalError(t('channel.error_server')); }
    Analytics.canalConfigurado();
    setConfigurando(false);
  };

  /** Clears external API key and resets provider to Ollama */
  const handleRemoveApiKey = async () => {
    setAgentApiKey('');
    setTestKeyResult(null);
    setAgentKeyError('');
    setKeyTested(false);
    await saveAgentConfig({ provider: 'ollama', api_key: '' }).catch(() => showError('Erro ao remover chave. Tente novamente.'));
    setUseExternalProvider(false);
    setAgentProvider('ollama');
    const r = await axios.get(`${API_BASE}/agent/status`).catch(() => null);
    if (r) setAgentStatus(r.data);
  };

  /** Saves the agent provider and API key configuration */
  const handleSaveAgentConfig = async () => {
    if (useExternalProvider && !agentApiKey.trim()) { setAgentKeyError(t('agent.key_error_required')); return; }
    setSavingConfig(true); setAgentKeyError(''); setConfigSaved(false); setTestKeyResult(null);
    const provider = useExternalProvider ? agentProvider : 'ollama';
    const apiKey   = useExternalProvider ? agentApiKey.trim() : '';
    try {
      const res = await saveAgentConfig({ provider, api_key: apiKey });
      if (res.data.error) setAgentKeyError(res.data.message);
      else {
        setConfigSaved(true);
        Analytics.provedorConfigurado(provider);
        setTimeout(() => setConfigSaved(false), 4000);
      }
    } catch { setAgentKeyError(t('agent.key_error_server')); }
    setSavingConfig(false);
  };

  /** Tests the API key inline (without saving) */
  const handleTestKey = async () => {
    setTestingKey(true); setTestKeyResult(null); setKeyTested(false);
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

  /** Starts the knowledge base indexing for the configured canal */
  const handleAgentIndex = async () => {
    setAgentIndexError('');
    try {
      const res = await startIndexing(canalConfigurado);
      if (res.data.error) setAgentIndexError(res.data.message);
    } catch { setAgentIndexError('Erro ao conectar com o servidor.'); }
  };

  /** Cancels ongoing indexing */
  const handleAgentIndexCancel = () => cancelIndexing();

  /** Removes an indexed canal and updates the extras list */
  const handleDeleteCanal = async (nome) => {
    const ok = await deleteCanalIndex(nome).then(() => true).catch(() => false);
    if (!ok) { showError('Erro ao remover canal. Tente novamente.'); return; }
    setCanaisExtras(prev => prev.filter(c => c !== nome));
  };

  /** Opens the extraction-type modal, or shows canal error if none configured */
  const handleStart = () => {
    if (!canalConfigurado) { setCanalError(t('channel.error_required')); return; }
    if (extractionTypes.length === 0) return;
    handleStartConfirm(extractionTypes);
  };

  /** Confirms extraction with selected content types */
  const handleStartConfirm = (fontes) => {
    setShowExtractionModal(false);
    setExtractionTypes(fontes);
    Analytics.extracaoIniciada(fontes);
    startExtraction(fontes).then(r => { if (r.data.error) setCanalError(r.data.message); });
  };

  /** Pauses or resumes the running extraction */
  const handlePause = () => pauseExtraction();

  /** Cancels the running extraction */
  const handleCancel = () => cancelExtraction();

  /** Initiates Drive OAuth flow — shows one-time security warning first */
  const handleDriveAuth = () => {
    if (!hasSeenWarning()) {
      setShowDriveWarning(true);
    } else {
      startDriveAuth();
    }
  };

  /** Confirms Drive warning and proceeds with auth */
  const handleDriveWarningConfirm = () => {
    markWarningShown();
    setShowDriveWarning(false);
    startDriveAuth();
  };

  /** Cancels in-progress Drive authentication */
  const handleDriveCancel = () => cancelDriveAuth();

  /** Sends the current chat message using server-sent streaming */
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    if (agentProvider === 'ollama' && !ollamaStatus.running) {
      setChatInput('');
      setChatMessages(prev => [...prev,
        { role: 'user',  content: msg },
        { role: 'error', content: t('agent.ollama_offline') },
      ]);
      return;
    }

    setChatInput('');
    Analytics.chatPergunta(buscaAmpla ? 'ampla' : 'restrita', useExternalProvider ? agentProvider : 'ollama');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', fontes: [], streaming: true }]);

    try {
      const response = await sendChatStream({
        mensagem:      msg,
        canal_nome:    agentStatus.canal_indexado || canalConfigurado,
        canais_extras: canaisExtras,
        busca_ampla:   buscaAmpla,
      });

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fontes = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) {
              setChatMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { role: 'error', content: parsed.error }; return msgs; });
            } else if (parsed.fontes) {
              fontes = parsed.fontes;
              setChatMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], fontes }; return msgs; });
            } else if (parsed.done) {
              setChatMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false }; return msgs; });
            }
          } catch {
            // Plain text line — append to current assistant message
            setChatMessages(prev => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = { ...last, content: (last.content || '') + line };
              return msgs;
            });
          }
        }
      }
    } catch {
      setChatMessages(prev => { const msgs = [...prev]; msgs[msgs.length - 1] = { role: 'error', content: 'Erro ao conectar com o servidor.' }; return msgs; });
    }
    setChatLoading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* WCAG 2.4.1 — Skip navigation link */}
      <a href="#main-content"
        className={`sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:text-xs focus:font-bold focus:bg-primary focus:text-white ${BTN_FOCUS}`}>
        Ir para o conteúdo principal
      </a>

      {/* ── Modals ── */}
      {/* Folder picker — choose which canal to open */}
      <AnimatePresence>
        {folderPickerOpen && (
          <motion.div
            key="folder-picker"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setFolderPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-5 ${darkMode ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}
              onClick={e => e.stopPropagation()}
            >
              <h2 className={`text-sm font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Abrir pasta do canal</h2>
              <div className="flex flex-col gap-1.5">
                {history.filter(h => h.canal_nome).map((h, i) => (
                  <button key={i}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    onClick={() => { openFolder('canal_youtube', h.canal_nome); setFolderPickerOpen(false); }}
                  >
                    @{h.canal_nome}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics consent — shown once on first launch */}
      <AnimatePresence>
        {showConsent && (
          <ConsentModal key="consent" darkMode={darkMode} onDone={() => setShowConsent(false)} />
        )}
      </AnimatePresence>

      {/* Drive security warning — shown once before first Drive auth */}
      <DriveWarningModal
        open={showDriveWarning}
        darkMode={darkMode}
        onConfirm={handleDriveWarningConfirm}
        onCancel={() => setShowDriveWarning(false)} />

      {/* Progress toast — contextual next-step guidance */}
      <AnimatePresence>
        {progressToast && (
          <ProgressToast
            key="progress-toast"
            darkMode={darkMode}
            type={progressToast.type || 'success'}
            message={progressToast.message}
            nextStep={progressToast.nextStep}
            onNext={progressToast.onNext}
            onClose={() => setProgressToast(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && <Onboarding key="onboarding" onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showGuide && <GuideModal key="guide-modal" onClose={() => setShowGuide(false)} darkMode={darkMode} />}
      </AnimatePresence>
      <AnimatePresence>
        {showExtractionModal && (
          <ExtractionModal key="extraction-modal" onClose={() => setShowExtractionModal(false)} onConfirm={handleStartConfirm} darkMode={darkMode} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPostModal && (
          <PostExtractionModal key="post-modal" onClose={() => setShowPostModal(false)}
            driveStatus={driveStatus} agentConfigured={agentStatus.configured}
            onGoToAgent={() => setActiveTab('agente')} onDriveAuth={handleDriveAuth} darkMode={darkMode} />
        )}
      </AnimatePresence>

      <div className={`flex h-screen overflow-hidden font-sans ${darkMode ? 'bg-[#080C18] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-20 md:hidden"
              onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          )}
        </AnimatePresence>

        {/* ── Nav Rail (tablet+) ── */}
        {!showHome && (
          <nav aria-label={t('nav.main')}
            className={`hidden md:flex shrink-0 flex-col items-center w-20 py-3 border-r
              ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <button onClick={() => setShowHome(true)} aria-label={t('nav.home')} title={t('nav.home')}
              className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 transition-opacity hover:opacity-80 ${BTN_FOCUS}`}>
              <img src={darkMode ? '/logo_dark_compact.svg' : '/logo_light_compact.svg'} alt="Sebayt"
                style={{ width: 52, height: 52, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; }} />
            </button>
            <div className="flex flex-col items-center gap-0.5 flex-1 w-full px-1.5">
              {[
                { id: 'extracao',    icon: Zap,      label: t('tabs.extraction')  },
                { id: 'repositorio', icon: BookOpen,  label: t('tabs.repositorio') },
                { id: 'relatorio',   icon: BarChart3, label: t('tabs.relatorio')   },
                { id: 'agente',      icon: Settings,  label: t('tabs.agent')       },
              ].map(({ id, icon: Icon, label }) => (
                <button key={id}
                  onClick={() => {
                    setActiveTab(id);
                    if (id === 'agente' && !localStorage.getItem('Sebayt_agent_visited')) {
                      setShowAgentHint(true);
                      localStorage.setItem('Sebayt_agent_visited', '1');
                    }
                  }}
                  aria-label={label}
                  className={`relative w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                    ${activeTab === id
                      ? darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                      : darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span className="text-[9px] font-semibold leading-none tracking-wide">{label}</span>
                  {id === 'agente' && agentStatus.indexed && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-secondary" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-0.5 w-full px-1.5 mb-1">
              <button onClick={() => setShowGuide(true)} aria-label={t('guide.title')}
                className={`w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <HelpCircle size={15} aria-hidden="true" />
                <span className="text-[9px] font-semibold leading-none">Ajuda</span>
              </button>
              <button
                onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('Sebayt_theme', next ? 'dark' : 'light'); }}
                aria-label={darkMode ? t('footer.light') : t('footer.dark')}
                className={`w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                {darkMode ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                <span className="text-[9px] font-semibold leading-none">{darkMode ? 'Claro' : 'Escuro'}</span>
              </button>
            </div>
            <p className={`text-[9px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>v0.4</p>
          </nav>
        )}

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.nav aria-label={t('nav.main')}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className={`fixed top-0 left-0 h-full w-52 z-30 flex flex-col px-4 pt-4 pb-6 md:hidden
                ${darkMode ? 'bg-[#0C1122] border-r border-white/10' : 'bg-white border-r border-slate-200 shadow-xl'}`}>
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => { setShowHome(true); setSidebarOpen(false); }}
                  className="rounded-xl transition-opacity hover:opacity-80 focus-visible:outline-none">
                  <img src={darkMode ? '/logo_dark_compact.svg' : '/logo_light_compact.svg'} alt="Sebayt"
                    style={{ width: 44, height: 44, objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                </button>
                <button onClick={() => setSidebarOpen(false)} aria-label={t('nav.close_menu')}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}>
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                {[
                  { id: 'extracao',    icon: Zap,      label: t('tabs.extraction')  },
                  { id: 'repositorio', icon: BookOpen,  label: t('tabs.repositorio') },
                  { id: 'relatorio',   icon: BarChart3, label: t('tabs.relatorio')   },
                  { id: 'agente',      icon: Settings,  label: t('tabs.agent')       },
                ].map(({ id, icon: Icon, label }) => (
                  <button key={id}
                    onClick={() => {
                      setActiveTab(id); setSidebarOpen(false);
                      if (id === 'agente' && !localStorage.getItem('Sebayt_agent_visited')) {
                        setShowAgentHint(true);
                        localStorage.setItem('Sebayt_agent_visited', '1');
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-left ${BTN_FOCUS}
                      ${activeTab === id
                        ? darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                        : darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowGuide(true); setSidebarOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <HelpCircle size={14} aria-hidden="true" />
                {t('guide.title')}
              </button>
              <button
                onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('Sebayt_theme', next ? 'dark' : 'light'); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                {darkMode ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                {darkMode ? t('footer.light') : t('footer.dark')}
              </button>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* ── Main ── */}
        <main id="main-content" aria-label="Área principal" className="flex-1 flex flex-col overflow-hidden relative min-w-0">

          {/* Home screen */}
          {showHome && (
            <HomeScreen
              darkMode={darkMode} history={history} repositorio={repositorio}
              agentStatus={agentStatus} ollamaStatus={ollamaStatus} btnFocus={BTN_FOCUS}
              onNavigate={(id) => { setActiveTab(id); setShowHome(false); }}
              onAddFiles={() => { setActiveTab('repositorio'); setShowHome(false); setRepoAddOpen(true); }}
              onToggleTheme={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('Sebayt_theme', next ? 'dark' : 'light'); }}
              onChangeLang={changeLang}
            />
          )}

          {/* ── Tabbed app shell ── */}
          <div className={showHome ? 'hidden' : 'flex flex-col flex-1 overflow-hidden'}>
            <div className={`absolute top-0 right-0 w-[600px] h-[600px] blur-[140px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-primary/8' : 'bg-primary/4'}`} aria-hidden="true" />
            <div className={`absolute bottom-0 left-0 w-[400px] h-[400px] blur-[120px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-accent/5' : 'bg-accent/3'}`} aria-hidden="true" />

            {/* Page header */}
            <header className={`px-4 md:px-6 lg:px-8 py-3 lg:py-4 flex justify-between items-center shrink-0 gap-4 border-b ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de controle"
                  className={`md:hidden p-2 rounded-xl transition-colors ${darkMode ? 'bg-white/8 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} ${BTN_FOCUS}`}>
                  <Menu size={20} />
                </button>
                {(isRunning || isPaused) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <StatusDot isRunning={isRunning} isPaused={isPaused} />
                      <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('header.status')}</span>
                    </div>
                    <h2 aria-live="polite" aria-atomic="true" className={`text-lg lg:text-2xl font-bold leading-tight ${statusTextColor()}`}>
                      {status.stats.status}
                    </h2>
                    {canalConfigurado && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        @{cleanCanalName(canalConfigurado)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h1 className={`text-xl lg:text-2xl font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {{ extracao: t('tabs.extraction'), repositorio: t('tabs.repositorio'), relatorio: t('tabs.relatorio'), agente: t('tabs.agent') }[activeTab]}
                    </h1>
                    {canalConfigurado && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>@{cleanCanalName(canalConfigurado)}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Drive status chip — always navigates to Repositório */}
                {driveStatus !== 'autenticado' && (
                  <button
                    onClick={() => setActiveTab('repositorio')}
                    title={driveStatus === 'em_progresso' ? 'Autenticando Drive…' : 'Conectar Google Drive'}
                    aria-label={driveStatus === 'em_progresso' ? 'Autenticando Drive' : 'Conectar Google Drive — ir para Repositório'}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-[11px] font-bold border transition-colors ${BTN_FOCUS}
                      ${driveStatus === 'em_progresso'
                        ? darkMode ? 'border-primary/30 text-primary bg-primary/8 hover:bg-primary/15' : 'border-violet-300 text-violet-600 bg-violet-50 hover:bg-violet-100'
                        : darkMode ? 'border-warning/30 text-warning bg-warning/8 hover:bg-warning/15' : 'border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100'}`}>
                    {driveStatus === 'em_progresso'
                      ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                      : <CloudOff size={12} aria-hidden="true" />}
                    <span className="hidden sm:inline">Drive</span>
                  </button>
                )}
                {driveStatus === 'autenticado' && (
                  <button
                    onClick={() => setActiveTab('repositorio')}
                    title={isRunning ? 'Drive sincronizando…' : 'Drive conectado — ir para Repositório'}
                    aria-label={isRunning ? 'Drive sincronizando' : 'Drive conectado — ir para Repositório'}
                    className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-[11px] font-bold border transition-colors ${BTN_FOCUS}
                      ${isRunning
                        ? darkMode ? 'border-secondary/40 text-secondary bg-secondary/12 hover:bg-secondary/20' : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        : darkMode ? 'border-white/15 text-slate-400 bg-white/4 hover:bg-white/8' : 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100'}`}>
                    {isRunning
                      ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>}
                    <span className="hidden sm:inline">Drive</span>
                  </button>
                )}
              </div>
            </header>

            {/* ── TAB: EXTRAÇÃO ── */}
            <div id="panel-extracao" role="tabpanel" aria-labelledby="tab-extracao"
              ref={mainScrollRef}
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 space-y-4 custom-scrollbar"
              style={{ display: activeTab === 'extracao' ? undefined : 'none' }}>

              {/* ── Canal + Drive + Iniciar ── */}
              <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className={`px-5 py-3 border-b flex items-center justify-between gap-3 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-primary" aria-hidden="true" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('tabs.extraction')}</span>
                  </div>
                  <button onClick={handleStart} disabled={isRunning || !canalConfigurado}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                      disabled:opacity-40 disabled:cursor-not-allowed
                      bg-primary text-white hover:bg-primary/85 shadow shadow-primary/20 ${BTN_FOCUS}`}>
                    <Zap size={12} aria-hidden="true" />
                    {t('ops.start')}
                  </button>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Canal section */}
                  <div className="space-y-2">
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.title')}</p>
                    {canalConfigurado ? (
                      <div role="status" aria-label={`Canal: @${canalConfigurado}`}
                        className={`p-3 rounded-xl flex items-center gap-2 border ${darkMode ? 'bg-primary/10 border-primary/25' : 'bg-primary/5 border-primary/25'}`}>
                        <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] uppercase font-bold tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.configured')}</p>
                          <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canalConfigurado.split('?')[0]}</p>
                        </div>
                        {!isRunning && (
                          <button onClick={() => { setCanalConfigurado(''); setCanalInput(''); }} aria-label={t('channel.remove')}
                            className={`rounded-md p-0.5 transition-colors hover:text-danger ${darkMode ? 'text-slate-500' : 'text-slate-400'} ${BTN_FOCUS}`}>
                            <XCircle size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                  {/* Extraction types — inline */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('ops.types_label')}</p>
                      <button
                        onClick={() => setExtractionTypes(extractionTypes.length === ALL_TYPES.length ? [] : ALL_TYPES)}
                        className={`text-[10px] font-semibold transition-colors ${darkMode ? 'text-slate-500 hover:text-primary' : 'text-slate-400 hover:text-primary'} ${BTN_FOCUS}`}>
                        {extractionTypes.length === ALL_TYPES.length ? t('ops.deselect_all') : t('ops.types_select_all')}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'Videos',    label: t('ops.type_videos')    },
                        { key: 'Shorts',    label: t('ops.type_shorts')    },
                        { key: 'Ao_Vivo',   label: t('ops.type_lives')     },
                        { key: 'Podcasts',  label: t('ops.type_podcasts')  },
                        { key: 'Cursos',    label: t('ops.type_courses')   },
                        { key: 'Playlists', label: t('ops.type_playlists') },
                      ].map(({ key, label }) => {
                        const active = extractionTypes.includes(key);
                        return (
                          <button key={key}
                            onClick={() => setExtractionTypes(prev =>
                              active ? prev.filter(k => k !== key) : [...prev, key]
                            )}
                            disabled={isRunning}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${BTN_FOCUS}
                              ${active
                                ? darkMode ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-primary/10 border-primary/30 text-primary'
                                : darkMode ? 'bg-white/4 border-white/10 text-slate-500 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {extractionTypes.length === 0 && (
                      <p className="text-[10px] text-warning flex items-center gap-1">
                        <AlertTriangle size={10} aria-hidden="true" /> Selecione ao menos um tipo.
                      </p>
                    )}
                  </div>
                </div>
              </div>

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
                          <span className={`text-xs font-mono ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{processedVideos} / {totalVideos}</span>
                        )}
                        {totalVideos === 0 && status.stats.videos_mapeados > 0 && (
                          <span className={`text-xs font-mono ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{status.stats.videos_mapeados} mapeados</span>
                        )}
                        <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{progress}%</span>
                      </div>
                    </div>

                    {/* Barra indeterminada durante mapeamento de canal extenso */}
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
                      <p aria-live="polite" className={`text-[11px] mt-2 flex items-center gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                        <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                        {totalVideos === 0 ? t('progress.mapping') : t('progress.processing')}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Post-extraction summary panel */}
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
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {status.stats.videos_total > 0 && (
                      <div className="px-5 pb-4">
                        <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-bold ${darkMode ? 'bg-black/20' : 'bg-white border border-slate-200'}`}>
                          <span className={darkMode ? 'text-slate-500' : 'text-slate-600'}>{t('summary.coverage')}</span>
                          <span className={status.stats.videos_processed / status.stats.videos_total >= 0.8 ? 'text-secondary' : 'text-warning'}>
                            {Math.round(status.stats.videos_processed / status.stats.videos_total * 100)}%
                            <span className={`ml-1 font-normal text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                              {t('summary.coverage_detail', { processed: status.stats.videos_processed, total: status.stats.videos_total })}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                <StatCard icon={Video}    label={t('stats.processed')} value={processedVideos}
                  color="primary"   sub={totalVideos > 0 ? t('stats.mapped', { total: totalVideos }) : t('stats.waiting')}
                  darkMode={darkMode} />
                <StatCard icon={FileText} label={t('stats.files')}     value={status.stats.files_generated}
                  color="accent"    sub={t('stats.parts')}
                  onOpen={() => {
                    const canais = history.filter(h => h.canal_nome);
                    if (!canais.length && !canalConfigurado) return;
                    if (canais.length > 1) { setFolderPickerOpen(true); return; }
                    const prefixo = canalConfigurado || canais[0].canal_nome;
                    openFolder('canal_youtube', prefixo);
                  }}
                  darkMode={darkMode} />
                <StatCard icon={Database} label={t('stats.db')}        value={canalConfigurado ? t('stats.active') : t('stats.waiting_db')}
                  color="secondary" sub={canalConfigurado ? `@${canalConfigurado}` : t('stats.no_channel')}
                  onOpen={canalConfigurado ? () => openFolder('gestao') : undefined}
                  darkMode={darkMode} />
              </div>

              {/* Canal history */}
              {history.length > 0 && !isRunning && (
                <section aria-label="Histórico de extrações">
                  <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`px-4 lg:px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                      <Globe size={14} className="text-primary" aria-hidden="true" />
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>Canais Extraídos</h3>
                      <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{history.length} {history.length !== 1 ? 'canais' : 'canal'}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {history.map((h, i) => (
                        <div key={i} className={`px-4 lg:px-5 py-3 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'} transition-colors`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                            {h.canal[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{h.canal}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${h.cobertura >= 80 ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700' : darkMode ? 'bg-warning/20 text-warning' : 'bg-amber-100 text-amber-700'}`}>{h.cobertura}%</span>
                            </div>
                            <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {h.extraidos}{h.total_mapeado && h.total_mapeado > h.total ? ` de ${h.total_mapeado}` : ''} vídeos · {h.ultima_extracao}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              setCanalInput(h.canal_url);
                              setCanalError('');
                              const res = await setChannel(h.canal_url).catch(() => null);
                              if (res && !res.data.error) setCanalConfigurado(res.data.canal_nome || h.canal);
                            }}
                            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            Usar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Activity log */}
              <section aria-labelledby="log-heading"
                className={`rounded-2xl overflow-hidden flex flex-col border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
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
                      <button onClick={handleCancel}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97] border-danger/40 text-danger hover:bg-danger/10 ${BTN_FOCUS}`}>
                        <Square size={10} aria-hidden="true" />
                        {t('ops.cancel')}
                      </button>
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
            </div>

            {/* ── TAB: REPOSITÓRIO ── */}
            {activeTab === 'repositorio' && (
              <div id="panel-repositorio" role="tabpanel" aria-labelledby="tab-repositorio"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 space-y-4 custom-scrollbar">

                {/* ── Drive toggle — topo ── */}
                <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="px-5 py-3.5 flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`shrink-0 ${driveStatus === 'autenticado' ? 'text-secondary' : 'text-primary'}`} aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09A16 16 0 0014.09 14"/><path d="M22 16.92v3"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('drive.title')}</p>
                      <p className={`text-[10px] ${driveStatus === 'autenticado' ? 'text-secondary' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {driveStatus === 'autenticado' ? t('drive.connected') : t('drive.not_authenticated')}
                      </p>
                    </div>
                    {/* Toggle switch */}
                    <button
                      role="switch"
                      aria-checked={driveStatus === 'autenticado'}
                      title={driveStatus === 'autenticado' ? 'Drive conectado' : 'Conectar Google Drive'}
                      onClick={() => {
                        const willOpen = !driveOpen;
                        setDriveOpen(willOpen);
                        if (willOpen && driveStatus !== 'autenticado') handleDriveAuth();
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${BTN_FOCUS}
                        ${driveStatus === 'autenticado' ? 'bg-secondary' : driveOpen ? 'bg-primary/60' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
                        ${driveStatus === 'autenticado' || driveOpen ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  {/* Expandable content */}
                  {(driveOpen || driveStatus === 'autenticado') && (
                    <div className={`px-5 pb-4 pt-0 border-t space-y-2 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                      <p className={`text-[11px] pt-3 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        Sincronize os arquivos extraídos com o Drive para usar no{' '}
                        <strong className={darkMode ? 'text-slate-300' : 'text-slate-700'}>NotebookLM</strong>.
                      </p>
                      <DriveToggle
                        driveStatus={driveStatus} driveAuthError={status.drive_auth_error}
                        onAuth={handleDriveAuth} onCancel={() => { handleDriveCancel(); setDriveOpen(false); }}
                        isRunning={isRunning} darkMode={darkMode} btnFocus={BTN_FOCUS}
                      />
                    </div>
                  )}
                </div>

                {/* ── Onboarding hint ── */}
                {!seen(KEYS.repositorio) && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>
                    <span className="text-base shrink-0">💡</span>
                    <div className="flex-1">
                      <p className={`text-xs font-bold mb-0.5 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Seu repositório de conhecimento</p>
                      <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Aqui ficam os arquivos do YouTube. Use <strong>+ Adicionar</strong> para incluir PDFs, Word, Markdown ou colar texto.</p>
                    </div>
                    <button onClick={() => markSeen(KEYS.repositorio)} className={`p-1 rounded text-xs shrink-0 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
                  </div>
                )}

                <RepositorioTab
                  darkMode={darkMode} repositorio={repositorio} setRepositorio={setRepositorio}
                  history={history} btnFocus={BTN_FOCUS}
                  onSetCanal={(url) => { setCanalInput(url); }}
                  showAdd={repoAddOpen} setShowAdd={setRepoAddOpen}
                  canalAtivo={canalConfigurado}
                />
              </div>
            )}

            {/* ── TAB: RELATÓRIO ── */}
            {activeTab === 'relatorio' && (
              <div id="panel-relatorio" role="tabpanel" aria-labelledby="tab-relatorio"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 custom-scrollbar">
                <RelatorioTab darkMode={darkMode} history={history} btnFocus={BTN_FOCUS}
                  onRefreshHistory={() => fetchHistory().then(r => setHistory(r.data)).catch(() => {})} />
              </div>
            )}

            {/* ── TAB: AGENTE ── */}
            {activeTab === 'agente' && (
              <div id="panel-agente" role="tabpanel" aria-labelledby="tab-agente"
                ref={agentScrollRef}
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 space-y-4 custom-scrollbar">

                {/* Canal meta card */}
                {canalMeta && (
                  <div className={`rounded-2xl border p-4 flex items-center gap-4 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                      {(canalMeta.canal_nome || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{canalMeta.canal_nome}</p>
                      <div className={`flex items-center gap-2 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                        <span>{canalMeta.canal_handle}</span>
                        {canalMeta.inscritos && <><span>·</span><span>{canalMeta.inscritos} inscritos</span></>}
                      </div>
                    </div>
                    <a href={canalMeta.canal_url} target="_blank" rel="noreferrer"
                      className={`shrink-0 p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                      aria-label="Abrir canal no YouTube">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}

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
                          <OllamaSetup darkMode={darkMode} ollamaStatus={ollamaStatus} setOllamaStatus={setOllamaStatus} btnFocus={BTN_FOCUS} ollamaModel={ollamaModel} onModelChange={handleOllamaModelChange} />

                          {/* External provider toggle */}
                          <div className={`flex items-center justify-between py-3 border-t ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                            <div>
                              <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>Usar minha chave de API</p>
                              <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gemini, OpenAI, Claude ou Groq</p>
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
                                <div className={`text-[11px] flex items-center gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
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
                                {/* Step 1 — key input */}
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

                                {/* Step 2 — test button */}
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

                                {/* Feedback messages */}
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

                                {/* Step 3 — save / clear (only after successful test) */}
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

                {/* Telemetry section */}
                <section aria-labelledby="agent-telemetry-heading"
                  className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <button
                    aria-expanded={telemetryOpen} aria-controls="agent-telemetry-body"
                    onClick={() => setTelemetryOpen(v => !v)}
                    className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${telemetryOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={analyticsEnabled ? 'text-secondary' : darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    <h3 id="agent-telemetry-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                      Telemetria
                    </h3>
                    {analyticsEnabled && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-secondary mr-2">
                        <CheckCircle2 size={11} /> Ativa
                      </span>
                    )}
                    <motion.div animate={{ rotate: telemetryOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {telemetryOpen && (
                      <motion.div id="agent-telemetry-body"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* Indexing section */}
                <section aria-labelledby="agent-index-heading"
                  className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <button
                    aria-expanded={indexOpen} aria-controls="agent-index-body"
                    onClick={() => setIndexOpen(v => !v)}
                    className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${indexOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                    <BookOpen size={14} className="text-accent shrink-0" aria-hidden="true" />
                    <h3 id="agent-index-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                      {t('agent.index_title')}
                    </h3>
                    {agentStatus.indexed && !agentStatus.indexing && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full mr-2 ${darkMode ? 'bg-secondary/15 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>
                        {agentStatus.index_count} chunks
                      </span>
                    )}
                    {agentStatus.base_desatualizada && !agentStatus.indexing && (
                      <span
                        title={`${agentStatus.novos_desde_indexacao} arquivo(s) novo(s) — reindexe para atualizar`}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full mr-2 animate-pulse cursor-help ${darkMode ? 'bg-warning/20 text-warning' : 'bg-amber-100 text-amber-700'}`}>
                        {agentStatus.novos_desde_indexacao} novo{agentStatus.novos_desde_indexacao !== 1 ? 's' : ''}
                      </span>
                    )}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setShowIndexInfo(v => !v)}
                        aria-expanded={showIndexInfo} aria-label="O que é indexação?"
                        className={`p-1 rounded-md transition-colors mr-1 ${showIndexInfo ? 'text-primary' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} ${BTN_FOCUS}`}>
                        <Info size={13} />
                      </button>
                      <AnimatePresence>
                        {showIndexInfo && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.15 }}
                            className={`absolute right-0 top-7 z-10 w-72 p-3 rounded-xl border text-[11px] leading-relaxed shadow-xl ${darkMode ? 'bg-[#0C1122] border-white/20 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/60'}`}>
                            {t('agent.index_what')}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <motion.div animate={{ rotate: indexOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {indexOpen && (
                      <motion.div id="agent-index-body"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}>
                        <div className="p-5 space-y-3">

                          {/* Indexed canals list */}
                          {agentStatus.canais_indexados && agentStatus.canais_indexados.length > 0 && !agentStatus.indexing && (
                            <div className="space-y-1.5">
                              {agentStatus.canais_indexados.map(canal => {
                                const isActive = canal.nome === agentStatus.canal_indexado;
                                const isExtra  = canaisExtras.includes(canal.nome);
                                return (
                                  <div key={canal.nome} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all
                                    ${isActive
                                      ? darkMode ? 'bg-secondary/10 border-secondary/30' : 'bg-emerald-50 border-emerald-200'
                                      : isExtra
                                        ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-violet-50 border-violet-200'
                                        : darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <CheckCircle2 size={11} className={isActive ? 'text-secondary' : isExtra ? 'text-primary' : darkMode ? 'text-slate-600' : 'text-slate-300'} />
                                    <span className={`flex-1 font-medium truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal.nome}</span>
                                    <span className={`text-[10px] font-mono ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{canal.chunks} chunks</span>
                                    {isActive
                                      ? <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>Ativo</span>
                                      : (
                                        <button onClick={() => setCanaisExtras(prev => isExtra ? prev.filter(c => c !== canal.nome) : [...prev, canal.nome])}
                                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${BTN_FOCUS}
                                            ${isExtra ? darkMode ? 'bg-primary/20 text-primary border-primary/30' : 'bg-violet-100 text-violet-700 border-violet-200' : darkMode ? 'border-white/20 text-slate-400 hover:border-primary/40 hover:text-primary' : 'border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600'}`}>
                                          {isExtra ? '✓ incluso' : '+ incluir'}
                                        </button>
                                      )
                                    }
                                    <button onClick={() => handleDeleteCanal(canal.nome)}
                                      className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-600 hover:text-danger' : 'text-slate-300 hover:text-danger'} ${BTN_FOCUS}`}
                                      aria-label={`Remover índice de @${canal.nome}`}>
                                      <X size={11} />
                                    </button>
                                  </div>
                                );
                              })}
                              {canaisExtras.length > 0 && (
                                <p className={`text-[10px] ${darkMode ? 'text-primary/70' : 'text-violet-500'}`}>
                                  Buscando em {canaisExtras.length + 1} canais simultaneamente
                                </p>
                              )}
                            </div>
                          )}

                          {/* Indexing in progress */}
                          {agentStatus.indexing && (
                            <div className="space-y-2">
                              <div className={`p-3 rounded-xl flex items-center gap-2 text-xs ${darkMode ? 'bg-primary/8 border border-primary/20 text-primary' : 'bg-violet-50 border border-violet-200 text-violet-700'}`}>
                                <Loader2 size={14} className="animate-spin" /> {t('agent.indexing')}
                              </div>
                              <div className={`rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar text-[11px] font-mono space-y-1 ${darkMode ? 'bg-black/30' : 'bg-slate-50 border border-slate-200'}`}>
                                <div className="flex justify-end mb-1">
                                  <a href="http://localhost:8001/log" target="_blank" rel="noreferrer"
                                    className={`text-[10px] flex items-center gap-0.5 hover:underline ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <ExternalLink size={9} /> abrir log
                                  </a>
                                </div>
                                {agentStatus.index_logs.map((l, i) => (
                                  <div key={i} className={darkMode ? 'text-slate-300' : 'text-slate-600'}>[{l.timestamp}] {l.message}</div>
                                ))}
                              </div>
                              <button onClick={handleAgentIndexCancel}
                                className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${BTN_FOCUS}`}>
                                {t('agent.cancel_index')}
                              </button>
                            </div>
                          )}

                          {/* Last index logs */}
                          {!agentStatus.indexing && lastIndexLogs.length > 0 && (
                            <div className={`rounded-xl p-3 max-h-28 overflow-y-auto custom-scrollbar text-[11px] font-mono space-y-0.5 ${darkMode ? 'bg-black/30' : 'bg-slate-50 border border-slate-200'}`}>
                              {lastIndexLogs.slice(-6).map((l, i) => {
                                const isErr = l.message.includes('❌') || l.message.includes('Nenhum');
                                return (
                                  <div key={i} className={isErr ? 'text-danger' : darkMode ? 'text-slate-300' : 'text-slate-600'}>
                                    [{l.timestamp}] {l.message}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Index action */}
                          {!agentStatus.indexing && (
                            <div className="space-y-2">
                              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                                {agentStatus.indexed ? t('agent.index_note_update') : t('agent.index_note_new')}
                              </p>
                              {!temConteudo && (
                                <p className={`text-[11px] flex items-center gap-1 ${darkMode ? 'text-warning/80' : 'text-amber-600'}`}>
                                  <AlertTriangle size={11} aria-hidden="true" /> {t('agent.index_prereq_content')}
                                </p>
                              )}
                              {agentIndexError && (
                                <p role="alert" className="text-[11px] flex items-center gap-1 text-danger font-medium">
                                  <AlertTriangle size={11} aria-hidden="true" /> {agentIndexError}
                                </p>
                              )}
                              <button onClick={handleAgentIndex} disabled={!temConteudo}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                  ${agentStatus.indexed ? `${darkMode ? 'bg-white/8 text-slate-300 hover:bg-white/12' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}` : 'bg-accent/20 text-accent hover:bg-accent/30'} ${BTN_FOCUS}`}>
                                <RefreshCw size={13} />
                                {agentStatus.indexed ? t('agent.reindex') : t('agent.index_now')}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>
            )}

            {/* ── Chat Drawer ── */}
            <ChatDrawer
              darkMode={darkMode}
              chatOpen={chatOpen} setChatOpen={setChatOpen}
              chatMessages={chatMessages} setChatMessages={setChatMessages}
              chatInput={chatInput} setChatInput={setChatInput}
              chatLoading={chatLoading}
              onSend={handleChatSend}
              onRecriarIndice={handleAgentIndex}
              onClearHistory={() => {
                const canal = agentStatus.canal_indexado || canalConfigurado;
                if (canal) clearChatHistory(canal).catch(() => showError('Erro ao limpar histórico. Tente novamente.'));
              }}
              agentStatus={agentStatus}
              canalConfigurado={canalConfigurado}
              onSelectCanal={setCanalConfigurado}
              canalMeta={canalMeta}
              chatEndRef={chatEndRef}
              buscaAmpla={buscaAmpla}
              setBuscaAmpla={(updater) => {
                const next = typeof updater === 'function' ? updater(buscaAmpla) : updater;
                Analytics.buscaAmplaToggled(next);
                setBuscaAmpla(next);
              }}
            />

            {/* Floating chat button */}
            {!chatOpen && (
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
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

            {/* Scroll-to-top button */}
            <AnimatePresence>
              {showScrollTop && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                  onClick={() => {
                    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    agentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  aria-label="Voltar ao topo"
                  className={`fixed bottom-6 right-6 z-30 p-3 rounded-full shadow-lg transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/35' : 'bg-primary text-white hover:bg-primary/85 shadow-primary/30'}`}>
                  <ArrowUp size={18} aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>

          </div>{/* end tabbed shell */}
        </main>
      </div>
    </>
  );
}

export default App;
