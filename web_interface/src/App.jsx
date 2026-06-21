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
  Sun, Moon, Link2, XCircle, Trash2, Wrench, Shield, Bell, Clock, Mail, LayoutDashboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants, services, hooks ───────────────────────────────────────────────
import { API_BASE, BTN_FOCUS } from './constants';
import { initAnalytics, getConsent, acceptAnalytics, declineAnalytics, Analytics } from './services/analytics';
import { useOnboarding } from './hooks/useOnboarding';
import { useAgentConfig } from './hooks/useAgentConfig';
import { useChatEngine }  from './hooks/useChatEngine';
import { usePerfil, PERFIS_META, PERFIS_CONFIG } from './hooks/usePerfil';
import ConsentModal from './components/shared/ConsentModal';
import ProgressToast from './components/shared/ProgressToast';
import DriveWarningModal, { useDriveWarning } from './components/shared/DriveWarningModal';
import {
  fetchHistory, fetchRepositorio, fetchQueue, setChannel, startExtraction, pauseExtraction, queueAdd, queueClear,
  queueRemoveItem, queueMoveItem, saveAutoUpdateConfig, runAutoUpdate,
  cancelExtraction, startDriveAuth, cancelDriveAuth, disconnectDrive, saveAgentConfig,
  startIndexing, cancelIndexing, clearChatHistory,
  deleteCanalIndex, openFolder, extrairMensagemErro, listarProjetos, resetTotal,
} from './services/api';

// ─── Components ───────────────────────────────────────────────────────────────
import Onboarding               from './components/shared/Onboarding';
import GuideModal               from './components/shared/GuideModal';
import AlterarPerfilModal       from './components/shared/AlterarPerfilModal';
import StatCard                 from './components/shared/StatCard';
import LogLine                  from './components/shared/LogLine';
import ExtractionModal          from './components/extraction/ExtractionModal';
import PostExtractionModal      from './components/extraction/PostExtractionModal';
import OllamaSetup              from './components/agent/OllamaSetup';
import RepositorioTab           from './components/agent/RepositorioTab';
import RelatorioTab             from './components/agent/RelatorioTab';
import VisaoGeralTab            from './components/agent/VisaoGeralTab';
import MonitorTab               from './components/agent/MonitorTab';
import HomeScreen               from './components/home/HomeScreen';
import LandingScreen            from './components/home/LandingScreen';
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

  // ─── Perfil ────────────────────────────────────────────────────────────────
  const { perfil, regras, setPerfil, perfilDefinido } = usePerfil();
  const [showAlterarPerfil, setShowAlterarPerfil] = useState(false);
  const [showLanding,      setShowLanding]      = useState(() => !localStorage.getItem('tusab_onboarded'));

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [showOnboarding,   setShowOnboarding]   = useState(false);
  const [showGuide,        setShowGuide]        = useState(false);
  const [showResetModal,   setShowResetModal]   = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetando,        setResetando]        = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [showHome,         setShowHome]         = useState(true);
  const [activeTab,        setActiveTab]        = useState('extracao');
  const [repoAddOpen,      setRepoAddOpen]      = useState(false);
  const [extracaoSubTab,   setExtracaoSubTab]   = useState('extrair'); // 'extrair' | 'relatorio'
  const [repoIndexarOpen,  setRepoIndexarOpen]  = useState(false);
  const [showPostModal,    setShowPostModal]    = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [projetos,             setProjetos]             = useState([]);
  const [extractionQueue,      setExtractionQueue]      = useState([]);
  const [showQueueModal,       setShowQueueModal]       = useState(false);
  const [cancelFlash,          setCancelFlash]          = useState(false);
  const [showCancelQueueModal, setShowCancelQueueModal] = useState(false);
  const [showScrollTop,    setShowScrollTop]    = useState(false);
  const [darkMode,         setDarkMode]         = useState(() => {
    const saved = localStorage.getItem('tusab_theme');
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
  const [backendOnline,    setBackendOnline]    = useState(true);
  const _backendFailCount  = useRef(0);

  // ─── Canal state ───────────────────────────────────────────────────────────
  const [canalInput,       setCanalInput]       = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState('');
  const [canalError,       setCanalError]       = useState('');
  const [configurando,     setConfigurando]     = useState(false);
  // Bloqueia restauração automática pelo polling quando o usuário remove manualmente
  const canalRemovidoRef = useRef(false);

  // ─── Open-folder picker ────────────────────────────────────────────────────
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // ─── Agent state (via hook) ────────────────────────────────────────────────
  const [showIndexInfo,    setShowIndexInfo]    = useState(false);
  const [lastIndexLogs,    setLastIndexLogs]    = useState([]);
  const [showAgentHint,    setShowAgentHint]    = useState(false);
  const [canaisExtras,     setCanaisExtras]     = useState([]);
  const [agentIndexError,  setAgentIndexError]  = useState('');

  // ─── Consent / analytics ──────────────────────────────────────────────────
  const [showConsent,      setShowConsent]      = useState(() => getConsent() === null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => getConsent() === 'yes');

  // Se já deu consent mas ainda não fez onboarding, abre onboarding direto
  useEffect(() => {
    if (getConsent() !== null && !localStorage.getItem('tusab_onboarded')) {
      setShowOnboarding(true);
    }
  }, []);
  const [progressToast,    setProgressToast]    = useState(null);
  const showError = (message) => setProgressToast({ type: 'error', message });

  // ─── Agent config hook ────────────────────────────────────────────────────
  const {
    agentStatus,          setAgentStatus,
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
    handleOllamaModelChange,
    handlePersonaChange,
    handleSaveAgentConfig,
    handleRemoveApiKey,
    handleTestKey,
  } = useAgentConfig({ activeTab, showError });

  const { seen, markSeen, KEYS } = useOnboarding();
  const { hasSeenWarning, markWarningShown } = useDriveWarning();
  const [showDriveWarning, setShowDriveWarning] = useState(false);
  const [driveOpen,        setDriveOpen]        = useState(false);

  // ─── Chat engine hook ─────────────────────────────────────────────────────
  const {
    chatOpen,      setChatOpen,
    chatExpandido, setChatExpandido,
    buscaAmpla,    setBuscaAmpla,
    chatMessages,  setChatMessages,
    chatInput,     setChatInput,
    chatLoading,
    chatEndRef,
    fontesFixadas, setFontesFixadas,
    handleChatSend,
  } = useChatEngine({
    agentProvider,
    agentStatus,
    ollamaStatus,
    canalConfigurado,
    canaisExtras,
    useExternalProvider,
    showError,
    onPrimeiraFonte: () => setProgressToast({
      type: 'info',
      message: t('citation.snackbar'),
    }),
  });

  /** When profile disables busca ampla, always revert to restricted */
  useEffect(() => {
    if (!regras.busca_ampla && buscaAmpla) setBuscaAmpla(false);
  }, [regras.busca_ampla, buscaAmpla]);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const logContainerRef = useRef(null);
  const logSectionRef   = useRef(null);
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

  /** Resets activeTab if it is not in the current profile's allowed tabs */
  useEffect(() => {
    if (regras.abas && !regras.abas.includes(activeTab)) {
      setActiveTab(regras.abas[0] ?? 'repositorio');
    }
  }, [regras]);

  /** Pauses polling when tab is in background */
  useEffect(() => {
    const onVisibility = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /** Syncs dark class on html element */
  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);

  /** Keyboard shortcuts: Esc closes chat; Shift+key navigates tabs / opens chat */
  useEffect(() => {
    const NAV_KEYS = { B: 'repositorio', E: 'extracao', A: 'admin', I: 'agente', M: 'monitor', V: 'visao-geral' };
    const onKey = (e) => {
      if (e.key === 'Escape' && chatOpen) {
        setChatOpen(false);
        return;
      }
      if (!e.shiftKey) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const editable = document.activeElement?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return;
      if (e.key === 'C' && !chatOpen) { setChatOpen(true); return; }
      if (e.key === 'R' && regras.abas?.includes('extracao')) { setActiveTab('extracao'); setExtracaoSubTab('relatorio'); setShowHome(false); return; }
      const tab = NAV_KEYS[e.key];
      if (tab && regras.abas?.includes(tab)) { setActiveTab(tab); setShowHome(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen, setChatOpen, regras]);

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
      if (localStorage.getItem('tusab_theme') === null) setDarkMode(e.matches);
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

  /** Polls /queue every 3s while running to keep the inline queue in sync */
  useEffect(() => {
    if (!isRunning) { setExtractionQueue([]); return; }
    const interval = setInterval(() => {
      fetchQueue().then(r => setExtractionQueue(r.data.queue || [])).catch(() => {});
    }, 3000);
    fetchQueue().then(r => setExtractionQueue(r.data.queue || [])).catch(() => {});
    return () => clearInterval(interval);
  }, [isRunning]);

  /** Polls /status every 2 seconds (pauses when tab hidden) */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isVisibleRef.current) return;
      try {
        const res = await axios.get(`${API_BASE}/status`);
        _backendFailCount.current = 0;
        setBackendOnline(true);
        setStatus(prev => JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data);
        if (res.data.stats?.canal_nome && !canalConfigurado && !canalRemovidoRef.current) setCanalConfigurado(res.data.stats.canal_nome);
      } catch {
        _backendFailCount.current += 1;
        if (_backendFailCount.current >= 2) setBackendOnline(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [canalConfigurado]);

  /** Auto-scrolls log container to the bottom while extraction runs */
  useEffect(() => {
    if (status.is_running && status.logs.length > 0 && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs.length, status.is_running]);

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
          message: t('toast.base_indexed', { count: agentStatus.index_count }),
          nextStep: t('toast.open_chat'),
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
  }, [activeTab]);

  useEffect(() => {
    if (extracaoSubTab === 'relatorio') Analytics.relatorioAcessado();
  }, [extracaoSubTab]);

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
      else { canalRemovidoRef.current = false; setCanalConfigurado(res.data.canal_nome || canalInput); setCanalInput(''); }
    } catch (err) { setCanalError(extrairMensagemErro(err)); }
    Analytics.canalConfigurado();
    setConfigurando(false);
  };

  /** Starts the knowledge base indexing for the configured canal */
  const handleAgentIndex = async () => {
    setAgentIndexError('');
    setAgentStatus(prev => ({ ...prev, indexing: true, index_logs: [] }));
    const canal = agentStatus.canal_indexado || canalConfigurado;
    try {
      const res = await startIndexing(canal || '');
      if (res.data?.error) setAgentIndexError(res.data.message);
    } catch (err) {
      setAgentIndexError(extrairMensagemErro(err));
      setAgentStatus(prev => ({ ...prev, indexing: false }));
    }
  };

  /** Cancels ongoing indexing */
  const handleAgentIndexCancel = () => cancelIndexing();

  /** Triggered from the chat drawer — indexes a specific canal or all extracted canals */
  const handleIndexarDoChat = async (canalNome) => {
    setAgentIndexError('');
    // Sinaliza loading imediatamente sem esperar o próximo ciclo de polling (3s)
    setAgentStatus(prev => ({ ...prev, indexing: true, index_logs: [] }));
    try {
      if (canalNome === '__todos__') {
        const canaisRepo = (repositorio.canais || []).map(c => c.nome);
        const canaisHist = history.filter(h => h.canal_nome).map(h => h.canal_nome);
        const todos = [...new Set([...canaisRepo, ...canaisHist])];
        for (const nome of todos) {
          await startIndexing(nome).catch(() => {});
        }
      } else {
        await startIndexing(canalNome).catch((err) => {
          setAgentIndexError(extrairMensagemErro(err));
        });
      }
    } catch (err) {
      setAgentIndexError(extrairMensagemErro(err));
    }
  };

  /** Removes an indexed canal and updates the extras list */
  const handleDeleteCanal = async (nome) => {
    const ok = await deleteCanalIndex(nome).then(() => true).catch(() => false);
    if (!ok) { showError(t('error.remove_canal')); return; }
    setCanaisExtras(prev => prev.filter(c => c !== nome));
  };

  /** Opens the extraction-type modal, or shows canal error if none configured */
  const handleStart = () => {
    if (!canalConfigurado && !isRunning) { setCanalError(t('channel.error_required')); return; }
    listarProjetos().then(r => setProjetos(r.data.projetos || [])).catch(() => {});
    setShowExtractionModal(true);
  };

  /** Confirms extraction with selected content types and project, or enqueues if already running */
  const handleStartConfirm = (fontes, projetoNome = '', novaUrl, autoUpdateConfig) => {
    setShowExtractionModal(false);
    setExtractionTypes(fontes);
    const urlEfetiva = novaUrl || canalInput.trim() || status.canal_url;
    if (novaUrl) { canalRemovidoRef.current = false; setCanalInput(novaUrl); setCanalConfigurado(''); }
    // Persist auto-update preference per canal
    const prefixo = projetoNome || canalConfigurado;
    if (prefixo && autoUpdateConfig !== undefined) {
      saveAutoUpdateConfig(
        prefixo,
        autoUpdateConfig?.enabled ?? false,
        autoUpdateConfig?.frequencia ?? 'semanal',
        fontes,
        urlEfetiva,
      ).catch(() => {});
    }
    if (isRunning) {
      queueAdd(urlEfetiva, fontes, projetoNome).catch(() => {});
      return;
    }
    Analytics.extracaoIniciada(fontes);
    setChannel(urlEfetiva, projetoNome)
      .then(r => { if (!r.data.error) setCanalConfigurado(r.data.canal_nome || ''); })
      .then(() => startExtraction(fontes).then(r => { if (r.data.error) setCanalError(r.data.message); }))
      .catch(() => startExtraction(fontes).then(r => { if (r.data.error) setCanalError(r.data.message); }));
  };

  /** Pauses or resumes the running extraction, then scrolls to the log card */
  const handlePause = () => {
    pauseExtraction();
    setTimeout(() => {
      logSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  /** Cancels the running extraction — if queue has items, asks what to do first */
  const handleCancel = () => {
    if (extractionQueue.length > 0) {
      setShowCancelQueueModal(true);
      return;
    }
    cancelExtraction();
    setCancelFlash(true);
    setTimeout(() => setCancelFlash(false), 1200);
    setTimeout(() => {
      logSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  /** Cancels extraction and also discards the queue */
  const handleCancelAndClearQueue = () => {
    setShowCancelQueueModal(false);
    cancelExtraction();
    queueClear();
    setExtractionQueue([]);
    setCancelFlash(true);
    setTimeout(() => setCancelFlash(false), 1200);
  };

  /** Cancels current extraction but keeps the queue — next item starts automatically */
  const handleCancelAndKeepQueue = () => {
    setShowCancelQueueModal(false);
    cancelExtraction();
    setCancelFlash(true);
    setTimeout(() => setCancelFlash(false), 1200);
  };

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

  /** Disconnects Google Drive by removing the stored token */
  const handleDriveDisconnect = () => disconnectDrive().catch(() => {});

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Landing screen — shown only on first-ever visit (not yet onboarded) */}
      <AnimatePresence>
        {showLanding && (
          <motion.div key="landing-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999]">
            <LandingScreen darkMode={darkMode} onEnter={() => setShowLanding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

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
          <ConsentModal key="consent" darkMode={darkMode} onDone={() => {
            setShowConsent(false);
            if (!localStorage.getItem('tusab_onboarded')) setShowOnboarding(true);
          }} />
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

      {/* Modal: alterar perfil */}
      <AnimatePresence>
        {showAlterarPerfil && (
          <AlterarPerfilModal
            key="alterar-perfil-modal"
            darkMode={darkMode}
            btnFocus={BTN_FOCUS}
            perfilAtual={perfil ?? 'profissional'}
            onConfirmar={(novoPerfil) => {
              setPerfil(novoPerfil);
              // Aplica persona padrão do novo perfil se o agente ainda não tiver provider configurado
              if (!agentStatus.configured) {
                const personaPadrao = PERFIS_CONFIG[novoPerfil]?.persona_padrao ?? '';
                saveAgentConfig({ persona: personaPadrao }).catch(() => {});
                setPersona(personaPadrao);
              }
              setShowAlterarPerfil(false);
            }}
            onFechar={() => setShowAlterarPerfil(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal: cancelar extração com fila pendente */}
      <AnimatePresence>
        {showCancelQueueModal && (
          <motion.div key="cancel-queue-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCancelQueueModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className={`rounded-2xl border p-6 max-w-sm w-full shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Cancelar extração</h3>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {extractionQueue.length} canal{extractionQueue.length !== 1 ? 'is' : ''} na fila
                  </p>
                </div>
              </div>

              <p className={`text-xs mb-5 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                O que deve acontecer com os canais que ainda estão na fila de extração?
              </p>

              {/* Opções */}
              <div className="space-y-2 mb-5">
                <button onClick={handleCancelAndKeepQueue}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-primary/30 bg-primary/10 hover:bg-primary/15 text-white' : 'border-violet-200 bg-violet-50 hover:bg-violet-100 text-slate-800'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary mt-0.5 shrink-0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <div>
                    <p className="text-xs font-bold">Cancelar e continuar fila</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Para este canal e inicia o próximo automaticamente
                    </p>
                  </div>
                </button>

                <button onClick={handleCancelAndClearQueue}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-danger/30 bg-danger/10 hover:bg-danger/15 text-white' : 'border-red-200 bg-red-50 hover:bg-red-100 text-slate-800'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger mt-0.5 shrink-0"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  <div>
                    <p className="text-xs font-bold">Cancelar e limpar fila</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Para este canal e descarta todos os {extractionQueue.length} da fila
                    </p>
                  </div>
                </button>
              </div>

              <button onClick={() => setShowCancelQueueModal(false)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'bg-white/6 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Voltar — não cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Reset total da base */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div key="reset-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={e => { if (e.target === e.currentTarget && !resetando) setShowResetModal(false); }}>
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                  <Trash2 size={18} className="text-danger" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Limpar toda a base</h3>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Essa ação não pode ser desfeita</p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Remove todos os vídeos, documentos, textos e índices de conhecimento. Os arquivos extraídos do YouTube e os uploads serão apagados permanentemente.
              </p>
              <div>
                <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Digite <span className="font-mono text-danger">RESETAR</span> para confirmar
                </label>
                <input
                  type="text" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="RESETAR" autoFocus
                  className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-danger transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowResetModal(false)} disabled={resetando}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Cancelar
                </button>
                <button
                  disabled={resetConfirmText !== 'RESETAR' || resetando}
                  onClick={async () => {
                    setResetando(true);
                    await resetTotal().catch(() => {});
                    setResetando(false);
                    setShowResetModal(false);
                    setResetConfirmText('');

                    // Limpa refs de estado anterior para evitar que effects reativem painel antigo
                    prevExtractionStatus.current = '';
                    prevIsRunningRef.current = false;

                    // Canal e extração
                    setCanalConfigurado('');
                    setCanalInput('');
                    canalRemovidoRef.current = true;
                    setExtractionQueue([]);
                    setStatus(s => ({
                      ...s,
                      is_running: false, is_paused: false, canal_url: '',
                      stats: { videos_processed: 0, videos_total: 0, videos_sem_legenda: 0,
                               videos_legenda_curta: 0, files_generated: 0, status: 'Ocioso',
                               progress: 0, canal_nome: '', idioma_detectado: '' },
                      logs: [],
                    }));

                    // Chat
                    setChatMessages([]);
                    setChatOpen(false);
                    setCanaisExtras([]);

                    // Agente
                    setAgentStatus(a => ({
                      ...a,
                      canal_indexado: '', canais_indexados: [], indexed: false,
                      index_logs: [], perguntas_sugeridas: [],
                    }));

                    // Navega para home e notifica
                    setActiveTab(regras.abas?.[0] ?? 'extracao');
                    setShowHome(true);
                    setProgressToast({ type: 'success', message: t('toast.reset_success') });

                    // Recarrega dados do backend
                    fetchHistory().then(r => setHistory(r.data)).catch(() => {});
                    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-danger/20 text-danger hover:bg-danger/30">
                  {resetando ? 'Limpando…' : 'Limpar tudo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showExtractionModal && (
          <ExtractionModal key="extraction-modal" onClose={() => setShowExtractionModal(false)} onConfirm={handleStartConfirm} darkMode={darkMode} canalNome={canalConfigurado} canalUrlInicial={canalInput || status.canal_url || ''} projetos={projetos} modoFila={isRunning} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPostModal && (
          <PostExtractionModal key="post-modal" onClose={() => setShowPostModal(false)}
            driveStatus={driveStatus} agentConfigured={agentStatus.configured}
            onGoToAgent={() => setActiveTab('agente')} onDriveAuth={handleDriveAuth} darkMode={darkMode} />
        )}
      </AnimatePresence>

      {/* ── Modal de gerência de fila ── */}
      <AnimatePresence>
        {showQueueModal && (
          <motion.div
            key="queue-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowQueueModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className={`rounded-2xl p-5 max-w-sm w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('ops.queue_title')}</h2>
                  <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    {extractionQueue.length === 0 ? 'Fila vazia.' : `${extractionQueue.length} ${extractionQueue.length === 1 ? 'canal aguardando' : 'canais aguardando'}`}
                  </p>
                </div>
                <button onClick={() => setShowQueueModal(false)}
                  className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${BTN_FOCUS}`}
                  aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              {extractionQueue.length === 0 ? (
                <p className={`text-center text-xs py-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum canal na fila.</p>
              ) : (
                <div className="space-y-1 mb-4 max-h-72 overflow-y-auto custom-scrollbar">
                  {extractionQueue.map((item, i) => {
                    const m = item.url?.match(/@([^/?]+)/);
                    const nome = item.projeto_nome || (m ? `@${m[1]}` : item.url?.split('/').pop() || '—');
                    const handleMover = async (fromIdx, toIdx) => {
                      await queueMoveItem(fromIdx, toIdx).catch(() => {});
                      const res = await fetchQueue().catch(() => null);
                      if (res) setExtractionQueue(res.data.queue || []);
                    };
                    const handleRemover = async (idx) => {
                      await queueRemoveItem(idx).catch(() => {});
                      const res = await fetchQueue().catch(() => null);
                      if (res) setExtractionQueue(res.data.queue || []);
                    };
                    return (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${darkMode ? 'border-white/8 bg-white/3' : 'border-slate-100 bg-slate-50'}`}>
                        {/* Reorder arrows */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => handleMover(i, i - 1)}
                            disabled={i === 0}
                            aria-label="Mover para cima"
                            className={`p-0.5 rounded transition-colors disabled:opacity-20 ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'} ${BTN_FOCUS}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                          </button>
                          <button
                            onClick={() => handleMover(i, i + 1)}
                            disabled={i === extractionQueue.length - 1}
                            aria-label="Mover para baixo"
                            className={`p-0.5 rounded transition-colors disabled:opacity-20 ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'} ${BTN_FOCUS}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                          </button>
                        </div>
                        <span className={`text-[10px] font-mono w-4 text-center shrink-0 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{nome}</p>
                          {item.projeto_nome && m && (
                            <p className={`text-[10px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{m[1]}</p>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          {(item.fontes || []).length > 0 ? (item.fontes || []).length + ' tipos' : 'todos'}
                        </span>
                        {/* Remove individual */}
                        <button
                          onClick={() => handleRemover(i)}
                          aria-label="Remover da fila"
                          className={`p-1 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-600 hover:text-danger hover:bg-danger/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'} ${BTN_FOCUS}`}>
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {extractionQueue.length > 0 && (
                <button
                  onClick={() => { queueClear(); setExtractionQueue([]); }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'border-danger/30 text-danger hover:bg-danger/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                  Limpar fila
                </button>
              )}
            </motion.div>
          </motion.div>
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
              <img src={darkMode ? '/logo_dark_compact.svg' : '/logo_light_compact.svg'} alt="Tusab"
                style={{ width: 52, height: 52, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; }} />
            </button>
            <div className="flex flex-col items-center gap-0.5 flex-1 w-full px-1.5">
              {[
                { id: 'extracao',    icon: Zap,             label: t('tabs.extraction')  },
                { id: 'repositorio', icon: BookOpen,         label: t('tabs.repositorio') },
                { id: 'visao-geral', icon: LayoutDashboard,  label: t('tabs.overview')    },
                { id: 'monitor',     icon: Activity,         label: t('tabs.monitor')     },
                { id: 'agente',      icon: Wrench,           label: t('tabs.agent')       },
                { id: 'admin',       icon: Settings,         label: t('tabs.admin')       },
              ].filter(({ id }) => regras.abas?.includes(id)).map(({ id, icon: Icon, label }) => (
                <button key={id}
                  onClick={() => {
                    setActiveTab(id);
                    setShowHome(false);
                    if (id === 'agente' && !localStorage.getItem('tusab_agent_visited')) {
                      setShowAgentHint(true);
                      localStorage.setItem('tusab_agent_visited', '1');
                    }
                  }}
                  aria-label={label}
                  className={`group relative w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                    ${activeTab === id && !showHome
                      ? darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                      : darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span className="text-[9px] font-semibold leading-none tracking-wide">{label}</span>
                  {id === 'agente' && (agentStatus.configured || ollamaStatus?.running) && (
                    <>
                      <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${agentStatus.configured ? 'bg-secondary' : 'bg-warning'}`} aria-hidden="true" />
                      <div className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[10px] leading-snug shadow-lg
                        ${darkMode ? 'bg-slate-800 text-slate-200 border border-white/10' : 'bg-white text-slate-700 border border-slate-200 shadow-slate-200/60'}`}>
                        {agentStatus.configured
                          ? `Agente pronto · ${agentStatus.provider || 'configurado'}`
                          : ollamaStatus?.running ? `Ollama ativo · ${ollamaStatus.models?.[0] || 'modelo carregado'}` : ''}
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-0.5 w-full px-1.5 mb-1">
              {/* Botão de perfil — fixo no bottom do nav rail */}
              {perfilDefinido && (
                <button
                  onClick={() => setShowAlterarPerfil(true)}
                  aria-label={t('perfil.trocar')}
                  className={`w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <span className="text-sm leading-none" aria-hidden="true">
                    {PERFIS_META[perfil]?.icon ?? '👤'}
                  </span>
                  <span className="text-[9px] font-semibold leading-none truncate max-w-full px-0.5">
                    {t(PERFIS_META[perfil]?.label ?? 'perfil.profissional')}
                  </span>
                </button>
              )}
<button onClick={() => setShowGuide(true)} aria-label={t('guide.title')}
                className={`w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <HelpCircle size={15} aria-hidden="true" />
                <span className="text-[9px] font-semibold leading-none">{t('nav.help')}</span>
              </button>
              <button
                onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('tusab_theme', next ? 'dark' : 'light'); }}
                aria-label={darkMode ? t('footer.light') : t('footer.dark')}
                className={`w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                {darkMode ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                <span className="text-[9px] font-semibold leading-none">{darkMode ? t('footer.light') : t('footer.dark')}</span>
              </button>
            </div>
            <p className={`text-[9px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>v1.0.0</p>
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
                  <img src={darkMode ? '/logo_dark_compact.svg' : '/logo_light_compact.svg'} alt="Tusab"
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
                  { id: 'extracao',    icon: Zap,             label: t('tabs.extraction')  },
                  { id: 'repositorio', icon: BookOpen,         label: t('tabs.repositorio') },
                  { id: 'visao-geral', icon: LayoutDashboard,  label: t('tabs.overview')    },
                  { id: 'monitor',     icon: Activity,         label: t('tabs.monitor')     },
                  { id: 'agente',      icon: Wrench,           label: t('tabs.agent')       },
                  { id: 'admin',       icon: Settings,         label: t('tabs.admin')       },
                ].filter(({ id }) => regras.abas?.includes(id)).map(({ id, icon: Icon, label }) => (
                  <button key={id}
                    onClick={() => {
                      setActiveTab(id); setSidebarOpen(false); setShowHome(false);
                      if (id === 'agente' && !localStorage.getItem('tusab_agent_visited')) {
                        setShowAgentHint(true);
                        localStorage.setItem('tusab_agent_visited', '1');
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-left ${BTN_FOCUS}
                      ${activeTab === id && !showHome
                        ? darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                        : darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              {/* Botão de perfil no rodapé do drawer mobile */}
              {perfilDefinido && (
                <button
                  onClick={() => { setShowAlterarPerfil(true); setSidebarOpen(false); }}
                  aria-label={t('perfil.trocar')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                    ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <span className="text-base leading-none" aria-hidden="true">
                    {PERFIS_META[perfil]?.icon ?? '👤'}
                  </span>
                  {t(PERFIS_META[perfil]?.label ?? 'perfil.profissional')}
                </button>
              )}
              <button onClick={() => { setShowGuide(true); setSidebarOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}
                  ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <HelpCircle size={14} aria-hidden="true" />
                {t('guide.title')}
              </button>
              <button
                onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('tusab_theme', next ? 'dark' : 'light'); }}
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
              onToggleTheme={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('tusab_theme', next ? 'dark' : 'light'); }}
              onChangeLang={changeLang}
            />
          )}

          {/* ── Tabbed app shell ── */}
          <div className={showHome ? 'hidden' : 'flex flex-col flex-1 overflow-hidden'}>
            <div className={`absolute top-0 right-0 w-[600px] h-[600px] blur-[140px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-primary/8' : 'bg-primary/4'}`} aria-hidden="true" />
            <div className={`absolute bottom-0 left-0 w-[400px] h-[400px] blur-[120px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-accent/5' : 'bg-accent/3'}`} aria-hidden="true" />

            {/* Page header */}
            <header className={`px-4 md:px-6 lg:px-8 py-3 lg:py-4 flex justify-between items-center shrink-0 gap-4 border-b backdrop-blur-sm ${darkMode ? 'border-white/8 shadow-[0_1px_12px_rgba(0,0,0,0.25)]' : 'border-slate-200 shadow-[0_1px_8px_rgba(0,0,0,0.06)]'}`}>
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
                    {isRunning && !isPaused && status.stats.eta_segundos > 0 && (
                      <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                        <Loader2 size={9} className="animate-spin" aria-hidden="true" />
                        {(() => {
                          const s = status.stats.eta_segundos;
                          if (s < 60)  return `~${s}s restantes`;
                          if (s < 3600) return `~${Math.ceil(s/60)}min restantes`;
                          return `~${(s/3600).toFixed(1)}h restantes`;
                        })()}
                      </p>
                    )}
                    {canalConfigurado && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                        @{cleanCanalName(canalConfigurado)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h1 className={`text-xl lg:text-2xl font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {{ extracao: t('tabs.extraction'), repositorio: t('tabs.repositorio'), relatorio: t('tabs.relatorio'), monitor: 'Monitor', agente: t('tabs.agent') }[activeTab]}
                    </h1>
                    {canalConfigurado && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>@{cleanCanalName(canalConfigurado)}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Drive status chip — always navigates to Repositório */}
                {regras.drive && driveStatus !== 'autenticado' && (
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
                {regras.drive && driveStatus === 'autenticado' && (
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
              className="flex-1 overflow-y-auto custom-scrollbar flex flex-col"
              style={{ display: activeTab === 'extracao' ? undefined : 'none' }}>

              {/* ── Sub-tab switcher ── */}
              <div className={`px-4 lg:px-8 pt-4 shrink-0 border-b ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'extrair',      label: t('tabs.extraction'), icon: Zap },
                    { id: 'relatorio',    label: t('tabs.relatorio'),  icon: BarChart3 },
                    { id: 'periodicidade', label: 'Periodicidade',     icon: Clock },
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

              {/* ── Sub-aba: Extrair ── */}
              <div className={`flex-1 px-4 lg:px-8 pt-5 pb-6 space-y-4 overflow-y-auto custom-scrollbar ${extracaoSubTab !== 'extrair' ? 'hidden' : ''}`}>

              {/* ── Canal + Drive + Iniciar ── */}
              <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className={`px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                  <Zap size={14} className="text-primary" aria-hidden="true" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('tabs.extraction')}</span>
                </div>
                <div className="p-4">
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
                          <button onClick={() => { canalRemovidoRef.current = true; setCanalConfigurado(''); setCanalInput(''); }} aria-label={t('channel.remove')}
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
                        <button onClick={handleConfigurarCanal} disabled={configurando || !canalInput.trim() || !backendOnline}
                          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                            disabled:opacity-40 disabled:cursor-not-allowed
                            bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 ${BTN_FOCUS}`}>
                          {configurando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                          {configurando ? t('channel.configuring') : t('channel.confirm')}
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                <div className={`px-4 pb-4 pt-3 border-t flex items-center gap-2 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                  {regras.fila && extractionQueue.length > 0 && (
                    <button onClick={() => setShowQueueModal(true)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${BTN_FOCUS}
                        ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      Fila ({extractionQueue.length})
                    </button>
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

              {/* ── Fila de extração inline ── */}
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
                      <button
                        onClick={() => setShowQueueModal(true)}
                        className={`text-[10px] font-semibold transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'} ${BTN_FOCUS}`}>
                        Gerenciar →
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {extractionQueue.slice(0, 3).map((item, i) => {
                        const m = item.url?.match(/@([^/?]+)/);
                        const nome = item.projeto_nome || (m ? m[1] : item.url?.split('/').pop()) || '—';
                        return (
                          <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? '' : ''}`}>
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
                        <button
                          onClick={() => setShowQueueModal(true)}
                          className={`w-full px-4 py-2 text-[10px] font-bold text-center transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/4' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'} ${BTN_FOCUS}`}>
                          + {extractionQueue.length - 3} mais canais na fila →
                        </button>
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
                      <p aria-live="polite" className={`text-[11px] mt-2 flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
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

              {/* Monitor shortcut — visible during extraction for profiles with monitor */}
              {isRunning && regras.monitor && (
                <button onClick={() => setActiveTab('monitor')}
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
                  <div className={`rounded-2xl border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`px-4 lg:px-5 py-3 border-b flex items-center gap-2 rounded-t-2xl ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                      <Globe size={14} className="text-primary" aria-hidden="true" />
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('history.title')}</h3>
                      <div className="relative group/hint ml-1">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`cursor-default ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}><circle cx="8" cy="8" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="7.4" y="7" width="1.2" height="5.5" rx="0.5"/><circle cx="8" cy="4.8" r="0.75"/></svg>
                        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 px-3 py-2 rounded-xl text-[10px] leading-relaxed pointer-events-none
                          opacity-0 group-hover/hint:opacity-100 transition-opacity duration-150 z-50 shadow-xl
                          ${darkMode ? 'bg-slate-800 text-slate-200 border border-white/10' : 'bg-slate-900 text-white'}`}>
                          Use <strong>Usar</strong> para carregar um canal como ativo e extrair novos vídeos sem redigitar a URL. Os ícones de pasta nos cards passam a abrir as pastas desse canal.
                          <div className={`absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 -translate-y-1 ${darkMode ? 'bg-slate-800' : 'bg-slate-900'}`} />
                        </div>
                      </div>
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
                            {t('history.use_btn')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

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

              {/* ── Sub-aba: Relatório ── */}
              {extracaoSubTab === 'relatorio' && (
                <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 custom-scrollbar">
                  <RelatorioTab darkMode={darkMode} history={history} btnFocus={BTN_FOCUS}
                    canalAtivo={canalConfigurado}
                    onRefreshHistory={() => fetchHistory().then(r => setHistory(r.data)).catch(() => {})} />
                </div>
              )}

              {/* ── Sub-aba: Periodicidade (Pro) ── */}
              {extracaoSubTab === 'periodicidade' && (
                <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 space-y-4 custom-scrollbar">

                  {/* Hero Pro */}
                  <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                      <Clock size={14} className="text-amber-500" />
                      <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('periodicidade.title')}</span>
                    </div>
                    <div className="px-5 py-10 flex flex-col items-center text-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
                        <Clock size={28} className="text-amber-500" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('periodicidade.tagline')}</p>
                        <p className={`text-xs mt-1.5 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('periodicidade.desc')}
                        </p>
                      </div>
                      <div className={`flex flex-wrap justify-center gap-2 mt-1`}>
                        {[t('periodicidade.tag1'), t('periodicidade.tag2'), t('periodicidade.tag3'), t('periodicidade.tag4')].map(f => (
                          <span key={f} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${darkMode ? 'border-white/10 text-slate-400 bg-white/4' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview — tabela de canais com periodicidade (mockup somente-leitura) */}
                  <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className={`px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                      <BarChart3 size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('periodicidade.channels_title')}</span>
                      <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{t('periodicidade.coming_soon')}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {history.length === 0 ? (
                        <p className={`px-5 py-6 text-xs text-center ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                          Nenhum canal extraído ainda. Extraia um canal para vê-lo aqui.
                        </p>
                      ) : history.slice(0, 8).map((h, i) => (
                        <div key={i} className={`px-5 py-3 flex items-center gap-3 ${darkMode ? 'opacity-50' : 'opacity-40'}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${darkMode ? 'bg-white/8 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                            {(h.canal || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>@{h.canal}</p>
                            <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{h.videos_count ?? 0} vídeos</p>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${darkMode ? 'border-white/8 text-slate-600 bg-white/4' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                            <Clock size={9} />
                            {i % 3 === 0 ? 'Semanal' : i % 3 === 1 ? 'Mensal' : 'Diário'}
                          </div>
                          <div className={`w-6 h-3 rounded-full ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* ── TAB: REPOSITÓRIO ── */}
            {activeTab === 'repositorio' && (
              <div id="panel-repositorio" role="tabpanel" aria-labelledby="tab-repositorio"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 space-y-4 custom-scrollbar">

                {/* ── Drive toggle — topo ── */}
                {regras.drive && <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
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
                      <p className={`text-[11px] pt-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Sincronize os arquivos extraídos com o Drive para usar no{' '}
                        <strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>NotebookLM</strong>.
                      </p>
                      {status.drive_auth_error && (
                        <p className={`text-[11px] text-danger flex items-center gap-1`}>
                          <AlertTriangle size={10} /> {status.drive_auth_error}
                        </p>
                      )}
                      {driveStatus === 'em_progresso' && (
                        <button onClick={() => { handleDriveCancel(); setDriveOpen(false); }}
                          className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BTN_FOCUS}
                            ${darkMode ? 'border-white/15 text-slate-400 hover:text-white hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                          <XCircle size={11} /> Cancelar autenticação
                        </button>
                      )}
                      {driveStatus === 'autenticado' && (
                        <button onClick={handleDriveDisconnect}
                          className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${BTN_FOCUS}
                            ${darkMode ? 'border-white/15 text-slate-400 hover:text-danger hover:border-danger/30' : 'border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200'}`}>
                          <XCircle size={11} /> Desconectar Drive
                        </button>
                      )}
                    </div>
                  )}
                </div>}

                {/* ── Onboarding hint ── */}
                {!seen(KEYS.repositorio) && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>
                    <span className="text-base shrink-0">💡</span>
                    <div className="flex-1">
                      <p className={`text-xs font-bold mb-0.5 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Seu repositório de conhecimento</p>
                      <p className={`text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Aqui ficam os arquivos do YouTube. Use <strong>+ Adicionar</strong> para incluir PDFs, Word, Markdown ou colar texto.</p>
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
                  onInjetarContexto={(trecho, arquivo) => {
                    setChatInput(prev => (prev ? prev + '\n\n' : '') + `[${arquivo}]\n${trecho}`);
                    setChatOpen(true);
                  }}
                  onIndexar={handleIndexarDoChat}
                  agentStatus={agentStatus}
                  openIndexar={repoIndexarOpen}
                  onOpenIndexarHandled={() => setRepoIndexarOpen(false)}
                  regras={regras}
                />
              </div>
            )}


            {/* ── TAB: VISÃO GERAL ── */}
            {activeTab === 'visao-geral' && (
              <div id="panel-visao-geral" role="tabpanel" aria-labelledby="tab-visao-geral"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 custom-scrollbar">
                <VisaoGeralTab darkMode={darkMode} btnFocus={BTN_FOCUS} />
              </div>
            )}

            {/* ── TAB: MONITOR ── */}
            {activeTab === 'monitor' && (
              <div id="panel-monitor" role="tabpanel" aria-labelledby="tab-monitor"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pt-5 pb-6 custom-scrollbar">
                <MonitorTab darkMode={darkMode} btnFocus={BTN_FOCUS} />
              </div>
            )}

            {/* ── TAB: AGENTE ── */}
            {activeTab === 'agente' && (
              <div id="panel-agente" role="tabpanel" aria-labelledby="tab-agente"
                ref={agentScrollRef}
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
                          <OllamaSetup darkMode={darkMode} ollamaStatus={ollamaStatus} setOllamaStatus={setOllamaStatus} btnFocus={BTN_FOCUS} ollamaModel={ollamaModel} onModelChange={handleOllamaModelChange} />

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

              </div>
            )}

            {/* ── Admin tab ── */}
            {activeTab === 'admin' && !showHome && (
              <div ref={mainScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">
                <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('tabs.admin_title')}</h2>

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

                {/* Limpeza de bases — only shown for profiles with reset_total permission */}
                {regras.reset_total && (
                <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`px-5 py-3.5 flex items-center gap-2 ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
                    <Trash2 size={14} className={darkMode ? 'text-slate-400' : 'text-slate-500'} aria-hidden="true" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Limpeza de bases</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Remove permanentemente todos os dados extraídos, índices BM25 e configurações do sistema. Esta ação não pode ser desfeita.
                    </p>
                    <button
                      onClick={() => { setResetConfirmText(''); setShowResetModal(true); }}
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
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>Notificações do sistema</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Em breve</span>
                  </div>
                  <div className="p-5">
                    <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      Alertas de erros de extração, índice desatualizado, espaço em disco e novas versões do Tusab.
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
                      href="mailto:tusab@tusab.sollution"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors
                        ${darkMode ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
                      <Mail size={13} /> tusab@tusab.sollution
                    </a>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      Tusab v1.0.0 · © 2026 CriAugu — CNPJ 65.131.075/0001-57
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* ── Chat Drawer ── */}
            <ChatDrawer
              darkMode={darkMode}
              persona={persona}
              onOpenPersona={() => {
                setActiveTab('agente');
                setChatOpen(false);
                setTimeout(() => {
                  document.getElementById('agent-persona-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
              }}
              onAbrirIndexacaoRepositorio={() => {
                setChatOpen(false);
                setActiveTab('repositorio');
                setShowHome(false);
                setTimeout(() => setRepoIndexarOpen(true), 80);
              }}
              chatOpen={chatOpen} setChatOpen={setChatOpen}
              expandido={chatExpandido} setExpandido={setChatExpandido}
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
              canaisExtraidos={[
                ...new Set([
                  ...(repositorio.canais || []).map(c => c.nome),
                  ...history.filter(h => h.canal_nome).map(h => h.canal_nome),
                ])
              ]}
              canaisExtras={canaisExtras}
              setCanaisExtras={setCanaisExtras}
              onIndexar={handleIndexarDoChat}
              buscaAmpla={regras.busca_ampla ? buscaAmpla : false}
              setBuscaAmpla={(updater) => {
                if (!regras.busca_ampla) return;
                const next = typeof updater === 'function' ? updater(buscaAmpla) : updater;
                Analytics.buscaAmplaToggled(next);
                setBuscaAmpla(next);
              }}
              fontesFixadas={fontesFixadas}
              setFontesFixadas={setFontesFixadas}
            />

            {/* Floating chat button */}
            {!chatOpen && (
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                onClick={() => setChatOpen(true)}
                className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform overflow-hidden"
                style={{ boxShadow: darkMode
                  ? '0 8px 24px 0 rgba(0,0,0,0.55), 0 2px 8px 0 rgba(0,0,0,0.35)'
                  : '0 8px 24px 0 rgba(0,0,0,0.22), 0 2px 8px 0 rgba(0,0,0,0.12)' }}
                aria-label="Abrir chat com o agente">
                <img
                  src={darkMode ? '/chat_btn_dark.svg' : '/chat_btn_light.svg'}
                  alt=""
                  className="w-full h-full object-cover"
                />
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
              {showScrollTop && !chatOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                  onClick={() => {
                    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    agentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  aria-label="Voltar ao topo"
                  className={`fixed z-30 p-3 rounded-full shadow-lg transition-colors ${BTN_FOCUS}
                    bottom-24 right-6
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
