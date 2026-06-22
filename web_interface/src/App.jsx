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
  Sun, Moon, Link2, XCircle, Trash2, Wrench, Shield, Bell, Clock, Mail, LayoutDashboard, History,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants, services, hooks ───────────────────────────────────────────────
import { API_BASE, BTN_FOCUS } from './constants';
import { initAnalytics, getConsent, Analytics } from './services/analytics';
import { useOnboarding } from './hooks/useOnboarding';
import { useAgentConfig } from './hooks/useAgentConfig';
import { useChatEngine }  from './hooks/useChatEngine';
import { usePerfil, PERFIS_META, PERFIS_CONFIG } from './hooks/usePerfil';
import ConsentModal from './components/shared/ConsentModal';
import ProgressToast from './components/shared/ProgressToast';
import DriveWarningModal, { useDriveWarning } from './components/shared/DriveWarningModal';
import {
  fetchHistory, fetchRepositorio, fetchQueue, setChannel, startExtraction, pauseExtraction, queueAdd, queueClear,
  queueRemoveItem, queueMoveItem, saveAutoUpdateConfig, runAutoUpdate, getAutoUpdateConfig,
  cancelExtraction, startDriveAuth, cancelDriveAuth, disconnectDrive, saveAgentConfig,
  startIndexing, cancelIndexing, clearChatHistory,
  deleteCanalIndex, openFolder, extrairMensagemErro, listarProjetos, criarProjeto, resetTotal,
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
import HistoricoTab             from './components/agent/HistoricoTab';
import { DriveToggle }          from './components/sidebar/SidebarContent';
import CancelQueueModal         from './components/modals/CancelQueueModal';
import ResetModal               from './components/modals/ResetModal';
import QueueManagerModal        from './components/modals/QueueManagerModal';
import ProHintModal             from './components/modals/ProHintModal';
import ExtractionTab            from './components/extraction/ExtractionTab';
import AgentTab                 from './components/tabs/AgentTab';
import AdminTab                 from './components/tabs/AdminTab';

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
  const [showProHint,      setShowProHint]      = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [showHome,         setShowHome]         = useState(true);
  const [activeTab,        setActiveTab]        = useState('extracao');
  const [repoAddOpen,      setRepoAddOpen]      = useState(false);
  const [extracaoSubTab,   setExtracaoSubTab]   = useState('extrair'); // 'extrair' | 'relatorio'
  const [repoIndexarOpen,  setRepoIndexarOpen]  = useState(false);
  const [repoImportOpen,   setRepoImportOpen]   = useState(false);
  const [showPostModal,    setShowPostModal]    = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [projetos,             setProjetos]             = useState([]);
  const [extractionQueue,      setExtractionQueue]      = useState([]);
  const [showQueueModal,       setShowQueueModal]       = useState(false);
  const [autoUpdateConfigs,    setAutoUpdateConfigs]    = useState({}); // { [canal]: { enabled, frequencia, fontes } }
  const [autoUpdateChecking,   setAutoUpdateChecking]   = useState(false);
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
  const prevIndexingRef      = useRef(false);
  const [backendOnline,    setBackendOnline]    = useState(true);
  const _backendFailCount  = useRef(0);

  // ─── Canal state ───────────────────────────────────────────────────────────
  const [canalInput,       setCanalInput]       = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState('');
  const [canalError,       setCanalError]       = useState('');
  const [configurando,     setConfigurando]     = useState(false);
  // Bloqueia restauração automática pelo polling quando o usuário remove manualmente
  const canalRemovidoRef = useRef(false);
  // Marca que o canal foi configurado nesta sessão (não apenas restaurado pelo polling)
  const canalConfiguradoNaSessaoRef = useRef(false);
  // Bloqueia o polling de sobrescrever o estado otimista após cancelamento
  const cancelingUntilRef = useRef(0);

  // ─── Open-folder picker ────────────────────────────────────────────────────
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerNovoProjeto, setFolderPickerNovoProjeto] = useState('');
  const [folderPickerCriando, setFolderPickerCriando] = useState(false);
  const [repoProjetoInicial,  setRepoProjetoInicial]  = useState('');

  // ─── Agent state (via hook) ────────────────────────────────────────────────
  const [showIndexInfo,    setShowIndexInfo]    = useState(false);
  const [lastIndexLogs,    setLastIndexLogs]    = useState([]);
  const [showAgentHint,    setShowAgentHint]    = useState(false);
  const [canaisExtras,     setCanaisExtras]     = useState([]);
  const [agentIndexError,  setAgentIndexError]  = useState('');

  // ─── Consent / analytics ──────────────────────────────────────────────────
  const [showConsent,      setShowConsent]      = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => getConsent() === 'yes');
  const [progressToast,    setProgressToast]    = useState(null);
  const showError = (message) => setProgressToast({ type: 'error', message });

  // ─── Agent config hook ────────────────────────────────────────────────────
  const {
    agentStatus,          setAgentStatus,     refetchAgentStatus,
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
    chatQueue,
    handleChatSend,
    chatHistory,
    retomar:       retomar,
    novaConversa,
  } = useChatEngine({
    agentProvider,
    agentStatus,
    ollamaStatus,
    canalConfigurado,
    canaisExtras,
    useExternalProvider,
    showError,
    perfil: perfil ?? '',
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
        // Se ainda estamos no período de bloqueio pós-cancel, ignora updates de is_running
        if (Date.now() < cancelingUntilRef.current && res.data.is_running) return;
        setStatus(prev => JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data);
        if (res.data.stats?.canal_nome && !canalConfigurado && !canalRemovidoRef.current && res.data.is_running) setCanalConfigurado(res.data.stats.canal_nome);
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
    const wasIndexing = prevIndexingRef.current;
    prevIndexingRef.current = agentStatus.indexing;
    // Only fire on the true→false transition — prevents re-triggering on every poll
    if (!wasIndexing || agentStatus.indexing) return;
    // Refetch imediato para atualizar canais_indexados sem esperar o próximo poll (3s)
    refetchAgentStatus();
    if (agentStatus.index_logs.length > 0) {
      setLastIndexLogs(agentStatus.index_logs);
      const hasError = agentStatus.index_logs.some(l => l.message?.includes('Erro') || l.message?.includes('erro'));
      if (hasError) {
        const errLog = agentStatus.index_logs.find(l => l.message?.includes('Erro') || l.message?.includes('erro'));
        showError(errLog?.message || t('error.index_failed'));
      } else {
        Analytics.baseIndexada(agentStatus.index_count);
        if (!showHome && !showLanding) {
          setProgressToast({
            message: t('toast.base_indexed', { count: agentStatus.index_count }),
            nextStep: t('toast.open_chat'),
            onNext: () => setChatOpen(true),
          });
        }
      }
    }
  }, [agentStatus.indexing, agentStatus.index_logs]);

  // Detecta pro_hint do backend (emitido uma vez após indexar >= 3 canais)
  useEffect(() => {
    if (agentStatus.pro_hint && !sessionStorage.getItem('tusab_pro_hint_shown')) {
      setShowProHint(true);
      sessionStorage.setItem('tusab_pro_hint_shown', '1');
    }
  }, [agentStatus.pro_hint]);

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
    if (extracaoSubTab === 'periodicidade' && history.length > 0) {
      Promise.all(
        history.map(h => getAutoUpdateConfig(h.canal, h.projeto || '')
          .then(r => ({ canal: h.canal, cfg: r.data.auto_update || { enabled: false } }))
          .catch(() => ({ canal: h.canal, cfg: { enabled: false } }))
        )
      ).then(results => {
        const map = {};
        results.forEach(({ canal, cfg }) => { map[canal] = cfg; });
        setAutoUpdateConfigs(map);
      });
    }
  }, [extracaoSubTab, history]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /** Changes i18n language and syncs HTML lang attribute */
  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng === 'en' ? 'en' : lng === 'es' ? 'es' : 'pt-BR';
  };

  /** Selects a previously extracted canal by URL (history quick-select) */
  const handleFolderPickerCriar = async () => {
    if (!folderPickerNovoProjeto.trim()) return;
    setFolderPickerCriando(true);
    try {
      const res = await criarProjeto(folderPickerNovoProjeto.trim());
      if (res.data?.ok) {
        const nomeCriado = res.data.nome || folderPickerNovoProjeto.trim();
        fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
        openFolder('canal_youtube', nomeCriado);
        setFolderPickerOpen(false);
        setFolderPickerNovoProjeto('');
        // Abre o modal de upload com o projeto recém-criado pré-selecionado
        setRepoProjetoInicial(nomeCriado);
        setRepoAddOpen(true);
        setActiveTab('repositorio');
        setShowHome(false);
      }
    } catch { /* ignore */ }
    setFolderPickerCriando(false);
  };

  const handleUsarCanalHistorico = async (canalUrl, canalNomeFallback) => {
    try {
      const res = await setChannel(canalUrl);
      if (!res.data.error) {
        canalRemovidoRef.current = false;
        canalConfiguradoNaSessaoRef.current = true;
        setCanalConfigurado(res.data.canal_nome || canalNomeFallback);
        setCanalInput('');
      }
    } catch { /* silencioso */ }
  };

  /** Submits the canal URL to the backend and updates configured state */
  const handleConfigurarCanal = async () => {
    if (!canalInput.trim()) { setCanalError(t('channel.error_required')); return; }
    if (!canalInput.includes('@')) { setCanalError(t('channel.error_invalid')); return; }
    setConfigurando(true); setCanalError('');
    try {
      const res = await setChannel(canalInput.trim());
      if (res.data.error) { setCanalError(res.data.message); }
      else { canalRemovidoRef.current = false; canalConfiguradoNaSessaoRef.current = true; setCanalConfigurado(res.data.canal_nome || canalInput); setCanalInput(''); }
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
    if (isRunning) {
      queueAdd(urlEfetiva, fontes, projetoNome).catch(() => {});
      return;
    }
    Analytics.extracaoIniciada(fontes);
    setChannel(urlEfetiva, projetoNome)
      .then(r => {
        const canalPrefixo = r.data.canal_nome || '';
        const projetoPrefixo = r.data.projeto_nome || projetoNome || '';
        const nomeFinal = projetoPrefixo || canalPrefixo;
        if (!r.data.error) setCanalConfigurado(canalPrefixo || projetoPrefixo);
        // Persiste config de auto-update: canal_prefixo = canal YouTube, projeto_prefixo = projeto
        if (canalPrefixo && autoUpdateConfig !== undefined) {
          saveAutoUpdateConfig(
            canalPrefixo,
            autoUpdateConfig?.enabled ?? false,
            autoUpdateConfig?.frequencia ?? 'semanal',
            fontes,
            urlEfetiva,
            projetoPrefixo,
          ).catch(() => {});
        }
      })
      .then(() => startExtraction(fontes).then(r => { if (r.data.error) setCanalError(r.data.message); }))
      .catch(() => startExtraction(fontes).then(r => { if (r.data.error) setCanalError(r.data.message); }));
  };

  const handlePause = () => {
    pauseExtraction();
  };

  /** Cancels the running extraction — if queue has items, asks what to do first */
  /** Applies an optimistic UI reset so the interface doesn't freeze waiting for the next poll */
  const _applyOptimisticCancel = () => {
    // Mostra "Cancelando..." sem colapsar o layout — mantém is_running true
    // O polling fica bloqueado por 20s; quando o backend confirmar is_running=false,
    // ele passa pelo bloqueio (pois res.data.is_running será false) e atualiza normalmente.
    cancelingUntilRef.current = Date.now() + 20_000;
    setStatus(prev => ({
      ...prev,
      is_paused: false,
      stats: { ...prev.stats, status: 'Cancelando...', progress: 0 },
    }));
    setCancelFlash(true);
    setTimeout(() => setCancelFlash(false), 1200);
  };

  const handleCancel = () => {
    if (extractionQueue.length > 0) {
      setShowCancelQueueModal(true);
      return;
    }
    cancelExtraction();
    _applyOptimisticCancel();
  };

  /** Cancels extraction and also discards the queue */
  const handleCancelAndClearQueue = () => {
    setShowCancelQueueModal(false);
    cancelExtraction();
    queueClear();
    setExtractionQueue([]);
    _applyOptimisticCancel();
  };

  /** Cancels current extraction but keeps the queue — next item starts automatically */
  const handleCancelAndKeepQueue = () => {
    setShowCancelQueueModal(false);
    cancelExtraction();
    _applyOptimisticCancel();
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
          <motion.div key="landing-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999]">
            <LandingScreen darkMode={darkMode} onToggleDark={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('tusab_theme', next ? 'dark' : 'light'); }} onEnter={() => {
              // Fluxo: landing → onboarding → consent → home
              if (!localStorage.getItem('tusab_onboarded')) {
                setShowOnboarding(true);
              } else if (getConsent() === null) {
                setShowConsent(true);
              } else {
                setShowLanding(false);
              }
            }} />
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
              {(() => {
                const canais = [
                  ...new Set([
                    ...(repositorio.canais || []).map(c => c.nome),
                    ...history.filter(h => h.canal_nome).map(h => h.canal_nome),
                  ])
                ];
                if (canais.length === 0) {
                  return (
                    <>
                      <h2 className={`text-sm font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Criar primeiro projeto</h2>
                      <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Você ainda não tem projetos. Crie um para organizar seus arquivos.
                      </p>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={folderPickerNovoProjeto}
                          onChange={e => setFolderPickerNovoProjeto(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleFolderPickerCriar(); }}
                          placeholder="Nome do projeto..."
                          className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-primary
                            ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`}
                        />
                        <button
                          disabled={folderPickerCriando || !folderPickerNovoProjeto.trim()}
                          onClick={handleFolderPickerCriar}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
                        >
                          {folderPickerCriando ? '...' : 'Criar'}
                        </button>
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <h2 className={`text-sm font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Abrir pasta do projeto</h2>
                    <div className="flex flex-col gap-1.5">
                      {canais.map((nome, i) => (
                        <button key={i}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                          onClick={() => { openFolder('canal_youtube', nome); setFolderPickerOpen(false); }}
                        >
                          @{nome}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics consent — shown once on first launch */}
      <AnimatePresence>
        {showConsent && (
          <div className="fixed inset-0 z-[10000]">
            <ConsentModal key="consent" darkMode={darkMode} onDone={() => {
              setShowConsent(false);
              setShowLanding(false);
            }} />
          </div>
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
        {progressToast && !showHome && !showLanding && (
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
        {showOnboarding && (
          <div className={showLanding ? 'fixed inset-0 z-[10000]' : ''}>
            <Onboarding key="onboarding"
              onSkip={() => {
                // Pular no step 0: fecha o onboarding e mantém a landing
                setShowOnboarding(false);
              }}
              onDone={(perfilEscolhido) => {
                setPerfil(perfilEscolhido);
                setShowOnboarding(false);
                if (getConsent() === null) {
                  setShowConsent(true);
                } else {
                  setShowLanding(false);
                }
              }} />
          </div>
        )}
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
      <CancelQueueModal
        open={showCancelQueueModal}
        darkMode={darkMode}
        extractionQueue={extractionQueue}
        onKeepQueue={handleCancelAndKeepQueue}
        onClearQueue={handleCancelAndClearQueue}
        onCancel={() => setShowCancelQueueModal(false)}
      />

      {/* Modal: Reset total da base */}
      <ResetModal
        open={showResetModal}
        darkMode={darkMode}
        onClose={() => setShowResetModal(false)}
        onResetDone={() => {
          prevExtractionStatus.current = '';
          prevIsRunningRef.current = false;
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
          setChatMessages([]);
          setChatOpen(false);
          setCanaisExtras([]);
          setAgentStatus(a => ({
            ...a,
            canal_indexado: '', canais_indexados: [], indexed: false,
            index_logs: [], perguntas_sugeridas: [],
          }));
          setActiveTab(regras.abas?.[0] ?? 'extracao');
          setShowHome(true);
          setProgressToast({ type: 'success', message: t('toast.reset_success') });
          fetchHistory().then(r => setHistory(r.data)).catch(() => {});
          fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
        }}
      />
      {showProHint && <ProHintModal onClose={() => setShowProHint(false)} />}

      <AnimatePresence>
        {showExtractionModal && (
          <ExtractionModal key="extraction-modal" onClose={() => setShowExtractionModal(false)} onConfirm={handleStartConfirm} darkMode={darkMode} canalNome={canalConfigurado} canalUrlInicial={!isRunning && canalConfigurado ? (canalInput || status.canal_url || '') : ''} projetos={projetos} modoFila={isRunning} />
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
      <QueueManagerModal
        open={showQueueModal}
        darkMode={darkMode}
        extractionQueue={extractionQueue}
        setExtractionQueue={setExtractionQueue}
        onClose={() => setShowQueueModal(false)}
      />

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
            <button onClick={() => { setShowHome(true); setProgressToast(null); }} aria-label={t('nav.home')} title={t('nav.home')}
              className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 transition-opacity hover:opacity-80 ${BTN_FOCUS}`}>
              <img src={darkMode ? '/logo_dark_compact.svg' : '/logo_light_compact.svg'} alt="Tusab"
                style={{ width: 52, height: 52, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; }} />
            </button>
            <div className="flex flex-col items-center gap-0.5 flex-1 w-full px-1.5">
              {[
                { id: 'extracao',    icon: Zap,             label: t('tabs.extraction')  },
                { id: 'repositorio', icon: BookOpen,         label: t('tabs.repositorio') },
                { id: 'historico',   icon: History,          label: t('tabs.historico')   },
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
                <button onClick={() => { setShowHome(true); setSidebarOpen(false); setProgressToast(null); }}
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
              regras={regras}
              onNavigate={(id) => { setActiveTab(id); setShowHome(false); }}
              onAddFiles={() => { setActiveTab('repositorio'); setShowHome(false); setRepoAddOpen(true); }}
              onImportBase={() => { setActiveTab('repositorio'); setShowHome(false); setRepoImportOpen(true); }}
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
                      {{ extracao: t('tabs.extraction'), repositorio: t('tabs.repositorio'), relatorio: t('tabs.relatorio'), monitor: 'Monitor', agente: t('tabs.agent'), 'visao-geral': t('tabs.overview'), admin: t('tabs.admin_title'), historico: t('tabs.historico') }[activeTab]}
                    </h1>
                    {canalConfigurado && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>@{cleanCanalName(canalConfigurado)}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Chip de perfil — sempre visível quando Drive não autenticado */}
                {driveStatus !== 'autenticado' && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] hidden sm:inline ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('header.perfil_acessado')}</span>
                    <button
                      onClick={() => setShowAlterarPerfil(true)}
                      title="Alterar perfil"
                      aria-label="Perfil ativo — clique para alterar"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${BTN_FOCUS}
                        ${darkMode ? 'border-white/15 text-slate-300 bg-white/4 hover:bg-white/8' : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'}`}>
                      <span>{PERFIS_META[perfil]?.icon ?? '🧑‍💻'}</span>
                      <span className="hidden sm:inline">{t(PERFIS_META[perfil]?.label ?? 'perfil.especialista')}</span>
                    </button>
                  </div>
                )}
                {/* Drive chip — só aparece quando autenticado */}
                {regras.drive && driveStatus === 'autenticado' && (
                  <button
                    onClick={() => setActiveTab('repositorio')}
                    title={isRunning ? 'Drive sincronizando…' : 'Drive conectado — ir para Repositório'}
                    aria-label={isRunning ? 'Drive sincronizando' : 'Drive conectado — ir para Repositório'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${BTN_FOCUS}
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
            {activeTab === 'extracao' && (
              <ExtractionTab
                darkMode={darkMode}
                mainScrollRef={mainScrollRef}
                logContainerRef={logContainerRef}
                logSectionRef={logSectionRef}
                status={status}
                history={history}
                setHistory={setHistory}
                isRunning={isRunning}
                isPaused={isPaused}
                progress={progress}
                totalVideos={totalVideos}
                processedVideos={processedVideos}
                cancelFlash={cancelFlash}
                extractionQueue={extractionQueue}
                autoUpdateConfigs={autoUpdateConfigs}
                setAutoUpdateConfigs={setAutoUpdateConfigs}
                autoUpdateChecking={autoUpdateChecking}
                setAutoUpdateChecking={setAutoUpdateChecking}
                canalInput={canalInput}
                setCanalInput={setCanalInput}
                canalConfigurado={canalConfigurado}
                setCanalConfigurado={setCanalConfigurado}
                canalError={canalError}
                setCanalError={setCanalError}
                configurando={configurando}
                extracaoSubTab={extracaoSubTab}
                setExtracaoSubTab={setExtracaoSubTab}
                handleConfigurarCanal={handleConfigurarCanal}
                handleUsarCanalHistorico={handleUsarCanalHistorico}
                handleStart={handleStart}
                handlePause={handlePause}
                handleCancel={handleCancel}
                repositorio={repositorio}
                onOpenFolderPicker={() => setFolderPickerOpen(true)}
                onNavigateMonitor={() => { setActiveTab('monitor'); setShowHome(false); }}
                onRemoveCanal={() => {
                  setCanalConfigurado('');
                  setCanalInput('');
                  canalRemovidoRef.current = true;
                  canalConfiguradoNaSessaoRef.current = false;
                }}
                regras={regras}
              />
            )}
{/* ── TAB: HISTÓRICO ── */}
            {activeTab === 'historico' && (
              <div id="panel-historico" role="tabpanel" aria-labelledby="tab-historico"
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 space-y-4 custom-scrollbar">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Histórico de conversas</h2>
                    <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Salvo automaticamente · máx. 100 conversas · JSON exportável
                    </p>
                  </div>
                </div>
                <HistoricoTab
                  darkMode={darkMode}
                  conversations={chatHistory.conversations}
                  onRetomar={(conv) => { retomar(conv); setShowHome(false); }}
                  onDelete={chatHistory.deleteConversation}
                  onToggleFav={chatHistory.toggleFavorito}
                  onRename={chatHistory.renameConversation}
                />
              </div>
            )}

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
                  openImport={repoImportOpen}
                  onOpenImportHandled={() => setRepoImportOpen(false)}
                  projetoInicial={repoProjetoInicial}
                  onProjetoInicialHandled={() => setRepoProjetoInicial('')}
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
              <AgentTab
                darkMode={darkMode}
                agentScrollRef={agentScrollRef}
                agentStatus={agentStatus}
                agentProvider={agentProvider}
                setAgentProvider={setAgentProvider}
                agentApiKey={agentApiKey}
                setAgentApiKey={setAgentApiKey}
                showApiKey={showApiKey}
                setShowApiKey={setShowApiKey}
                agentKeyError={agentKeyError}
                setAgentKeyError={setAgentKeyError}
                configSaved={configSaved}
                testingKey={testingKey}
                testKeyResult={testKeyResult}
                setTestKeyResult={setTestKeyResult}
                keyTested={keyTested}
                setKeyTested={setKeyTested}
                savingConfig={savingConfig}
                useExternalProvider={useExternalProvider}
                setUseExternalProvider={setUseExternalProvider}
                ollamaStatus={ollamaStatus}
                setOllamaStatus={setOllamaStatus}
                ollamaModel={ollamaModel}
                configOpen={configOpen}
                setConfigOpen={setConfigOpen}
                persona={persona}
                handleOllamaModelChange={handleOllamaModelChange}
                handlePersonaChange={handlePersonaChange}
                handleSaveAgentConfig={handleSaveAgentConfig}
                handleRemoveApiKey={handleRemoveApiKey}
                handleTestKey={handleTestKey}
                showAgentHint={showAgentHint}
                setShowAgentHint={setShowAgentHint}
              />
            )}
{/* ── Admin tab ── */}
            {activeTab === 'admin' && !showHome && (
              <AdminTab
                darkMode={darkMode}
                mainScrollRef={mainScrollRef}
                analyticsEnabled={analyticsEnabled}
                setAnalyticsEnabled={setAnalyticsEnabled}
                regras={regras}
                onResetClick={() => setShowResetModal(true)}
              />
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
              chatHistory={chatHistory}
              onRetomar={retomar}
              onNovaConversa={novaConversa}
              chatQueue={chatQueue}
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
