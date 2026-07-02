/**
 * @file App.jsx
 * @description Root application shell — orchestrates state, routing and layout
 * @module App
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import AprofundarModal from './components/shared/AprofundarModal';
import {
  fetchHistory, fetchRepositorio, fetchQueue, setChannel, startExtraction, pauseExtraction, queueAdd, queueClear,
  queueRemoveItem, queueMoveItem, saveAutoUpdateConfig, runAutoUpdate, getAutoUpdateConfig,
  cancelExtraction, startDriveAuth, cancelDriveAuth, disconnectDrive, saveAgentConfig,
  startIndexing, cancelIndexing, clearChatHistory, fetchAgentStatus,
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
import ChatDrawer, { LOADING_PHRASES } from './components/chat/ChatDrawer';
import HistoricoTab             from './components/agent/HistoricoTab';
import { DriveToggle }          from './components/sidebar/SidebarContent';
import CancelQueueModal         from './components/modals/CancelQueueModal';
import ResetModal               from './components/modals/ResetModal';
import QueueManagerModal        from './components/modals/QueueManagerModal';
import UpdateSuccessModal       from './components/modals/UpdateSuccessModal';
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

// ─── ChatFloatButton ──────────────────────────────────────────────────────────
// Botão flutuante do chat com pulso periódico a cada 60s (sem anéis duplos).

function ChatFloatButton({ darkMode, indexed, configured, msgCount, onClick, title }) {
  const [pulsing, setPulsing] = React.useState(false);
  React.useEffect(() => {
    const fire = () => { setPulsing(true); setTimeout(() => setPulsing(false), 900); };
    const first = setTimeout(fire, 3000);
    const interval = setInterval(fire, 60000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  // Verde = base + LLM prontos; âmbar = só base (LLM não configurado); sem badge = nada
  const badgeColor = indexed && configured ? 'bg-secondary'
    : indexed && !configured  ? 'bg-amber-400'
    : null;

  const badgeTitle = indexed && configured ? 'Base indexada e agente configurado'
    : indexed ? 'Base indexada — configure o agente para conversar'
    : null;

  const glowBase = darkMode
    ? '0 0 0 3px rgba(109,40,217,0.25), 0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(109,40,217,0.35)'
    : '0 0 0 3px rgba(109,40,217,0.12), 0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(109,40,217,0.20)';
  const glowPulse = darkMode
    ? '0 0 0 7px rgba(109,40,217,0.4), 0 8px 32px rgba(0,0,0,0.65), 0 4px 20px rgba(109,40,217,0.55)'
    : '0 0 0 7px rgba(109,40,217,0.22), 0 8px 32px rgba(0,0,0,0.16), 0 4px 20px rgba(109,40,217,0.38)';

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={pulsing
        ? { scale: [1, 1.12, 0.96, 1.06, 1], boxShadow: [glowBase, glowPulse, glowBase] }
        : { scale: 1, opacity: 1, boxShadow: glowBase }}
      transition={pulsing
        ? { duration: 0.75, ease: 'easeInOut' }
        : { delay: 0.3, type: 'spring', stiffness: 200, opacity: { duration: 0.3 } }}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative w-16 h-16 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      style={{ boxShadow: glowBase }}>
      <img
        src={darkMode ? '/chat_btn_dark.svg' : '/chat_btn_light.svg'}
        alt=""
        className="w-full h-full object-contain rounded-full"
        draggable={false}
      />
      {badgeColor && (
        <span
          title={badgeTitle}
          className={`absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 ${badgeColor}
            ${darkMode ? 'border-[#0C1122]' : 'border-white'}`} />
      )}
      {msgCount > 0 && (
        <span className={`absolute top-0 left-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white border-2
          ${darkMode ? 'border-[#0C1122]' : 'border-white'}`}>
          {msgCount}
        </span>
      )}
    </motion.button>
  );
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
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [showHome,         setShowHome]         = useState(true);
  const [activeTab,        setActiveTab]        = useState(() => {
    try {
      const perfil = localStorage.getItem('tusab_perfil');
      const abas = PERFIS_CONFIG[perfil]?.abas ?? PERFIS_CONFIG.profissional.abas;
      return abas.includes('extracao') ? 'extracao' : (abas[0] ?? 'repositorio');
    } catch { return 'extracao'; }
  });
  const [repoAddOpen,      setRepoAddOpen]      = useState(false);
  const [extracaoSubTab,   setExtracaoSubTab]   = useState('extrair'); // 'extrair' | 'relatorio'
  const [agentInitialSubTab, setAgentInitialSubTab] = useState('configuracoes');
  const [repoIndexarOpen,  setRepoIndexarOpen]  = useState(false);
  const [repoBuscaInicial, setRepoBuscaInicial] = useState('');
  const [repoImportOpen,   setRepoImportOpen]   = useState(false);
  const [showPostModal,    setShowPostModal]    = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [projetos,             setProjetos]             = useState([]);
  const [extractionQueue,      setExtractionQueue]      = useState([]);
  const [showQueueModal,       setShowQueueModal]       = useState(false);
  const [autoUpdateConfigs,    setAutoUpdateConfigs]    = useState({}); // { [canal]: { enabled, frequencia, fontes } }
  const [autoUpdateChecking,   setAutoUpdateChecking]   = useState(false);
  const [appUpdateInfo,        setAppUpdateInfo]        = useState(null);  // { version, downloaded }
  const [showUpdateBanner,     setShowUpdateBanner]     = useState(false);
  const [justUpdatedVersion,   setJustUpdatedVersion]   = useState(null);  // versão recém instalada via auto-update
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
  const [repositorio,      setRepositorio]      = useState({ youtube: [], documentos: [], textos: [], canais: [] });
  const prevExtractionStatus = useRef('');
  const prevDriveStatus      = useRef('');
  const prevIndexingRef      = useRef(false);
  const indexacaoLoteRef     = useRef(null); // null = sem lote; { total, done } = lote em andamento
  const [backendOnline,    setBackendOnline]    = useState(true);
  const _backendFailCount  = useRef(0);

  // ─── Canal state ───────────────────────────────────────────────────────────
  const [canalInput,       setCanalInput]       = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState(() => localStorage.getItem('tusab_canal_configurado') || '');
  // Estado do chat: independente do canal de extração
  const [projetoChat,      setProjetoChat]      = useState(() => localStorage.getItem('tusab_canal_chat') || '');
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
  const [projetosExtras,   setProjetosExtras]   = useState([]);
  const [agentIndexError,  setAgentIndexError]  = useState('');

  // ─── Consent / analytics ──────────────────────────────────────────────────
  const [showConsent,      setShowConsent]      = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => getConsent() === 'yes');
  const [progressToast,    setProgressToast]    = useState(null);
  const showError = (message) => setProgressToast({ type: 'error', message });

  // ─── Agent config hook ────────────────────────────────────────────────────
  const {
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
    handleOllamaModelChange,
    handlePersonaChange,
    handleSaveAgentConfig,
    handleRemoveApiKey,
    handleTestKey,
    setCanalAtivo,
    aprofundarOpen,       aprofundarPendente,
    aprofundarRodando,    aprofundarProgresso,
    handleAprofundarConfirm,
    handleAprofundarClose,
  } = useAgentConfig({ activeTab, showError });

  const { seen, markSeen, KEYS } = useOnboarding();
  const { hasSeenWarning, markWarningShown } = useDriveWarning();
  const [showDriveWarning, setShowDriveWarning] = useState(false);
  const [driveOpen,        setDriveOpen]        = useState(false);

  // ─── Chat engine hook ─────────────────────────────────────────────────────
  const chatOpenRef = useRef(false);
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
    canalConfigurado: projetoChat,
    canaisExtras: projetosExtras,
    useExternalProvider,
    showError,
    perfil: perfil ?? '',
    chatOpenRef,
    onPrimeiraFonte: () => setProgressToast({
      type: 'info',
      message: LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)],
    }),
  });

  // Mantém chatOpenRef sincronizado para closures async no useChatEngine
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  /** When profile disables busca ampla, always revert to restricted */
  useEffect(() => {
    if (!regras.busca_ampla && buscaAmpla) setBuscaAmpla(false);
  }, [regras.busca_ampla, buscaAmpla]);

  // ─── Chat highlight: anel pulsante + snack ────────────────────────────────
  // Persiste se o usuário já abriu o chat ao menos uma vez (some com o anel)
  const [chatJaAberto, setChatJaAberto] = useState(
    () => localStorage.getItem('tusab_chat_ja_aberto') === '1'
  );
  // Snack lateral "Pergunte à sua base →" — convite para o chat
  const [showChatSnack, setShowChatSnack] = useState(false);

  // Reabre o convite a cada nova indexação concluída (true→false), não só uma vez por sessão —
  // o usuário deve ser convidado a interagir sempre que houver base nova/atualizada disponível.
  useEffect(() => {
    const wasIndexing = prevIndexingRef.current;
    if (!wasIndexing || agentStatus.indexing) return;
    if (!agentStatus.indexed || chatOpen) return;
    setShowChatSnack(true);
    const t = setTimeout(() => setShowChatSnack(false), 10000);
    return () => clearTimeout(t);
  }, [agentStatus.indexing, agentStatus.indexed, chatOpen]);

  // Também convida após uma extração terminar (caso a base já esteja indexada e não precise reindexar)
  useEffect(() => {
    if (status.stats.status === 'Finalizado ✓' && prevExtractionStatus.current !== 'Finalizado ✓'
        && agentStatus.indexed && !chatOpen) {
      setShowChatSnack(true);
      const t = setTimeout(() => setShowChatSnack(false), 10000);
      return () => clearTimeout(t);
    }
  }, [status.stats.status]);

  // Marca como "já aberto" quando o usuário abre o chat pela primeira vez
  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
    setShowChatSnack(false);
    if (!chatJaAberto) {
      setChatJaAberto(true);
      localStorage.setItem('tusab_chat_ja_aberto', '1');
    }
  }, [chatJaAberto]);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const logContainerRef = useRef(null);
  const logSectionRef   = useRef(null);
  const mainScrollRef   = useRef(null);
  const isVisibleRef    = useRef(true);
  const cleanupRef      = useRef(null);

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

  /** Escuta eventos de atualização do Electron (electron-updater → IPC → frontend) */
  useEffect(() => {
    if (!window.tusab?.onUpdateAvailable) return;
    window.tusab.onUpdateAvailable(info => {
      setAppUpdateInfo({ version: info.version, downloaded: false });
      setShowUpdateBanner(true);
    });
    window.tusab.onUpdateDownloaded(info => {
      setAppUpdateInfo({ version: info.version, downloaded: true });
      setShowUpdateBanner(true);
    });
    // Clique na notificação nativa de update → instala imediatamente
    window.tusab.onTriggerInstallUpdate?.(() => {
      window.tusab?.installUpdate?.(appUpdateInfo?.version);
    });
    // App acabou de reiniciar após auto-update
    window.tusab.onAppJustUpdated?.((info) => {
      if (info.version) setJustUpdatedVersion(info.version);
    });
  }, []);

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

  /** Keyboard shortcuts: Esc closes/collapses chat; Shift+key navigates tabs / opens chat */
  useEffect(() => {
    const NAV_KEYS = { B: 'repositorio', E: 'extracao', A: 'admin', I: 'agente', M: 'monitor', V: 'visao-geral', H: 'historico' };
    const onKey = (e) => {
      if (e.key === 'Escape' && chatOpen) {
        if (chatExpandido) { setChatExpandido(false); return; }
        setChatOpen(false);
        return;
      }
      if (!e.shiftKey) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const editable = document.activeElement?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return;
      const key = e.key.toUpperCase();
      if (e.key === '>' && chatOpen && chatExpandido) { setChatExpandido(false); return; }
      if (e.key === '<' && chatOpen && !chatExpandido) { setChatExpandido(true); return; }
      if (key === 'C' && !chatOpen) { e.preventDefault(); handleOpenChat(); return; }
      if (key === 'R' && regras.abas?.includes('extracao')) { setActiveTab('extracao'); setExtracaoSubTab('relatorio'); setShowHome(false); return; }
      const tab = NAV_KEYS[key];
      if (tab && regras.abas?.includes(tab)) { setActiveTab(tab); setShowHome(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen, chatExpandido, setChatOpen, setChatExpandido, regras, handleOpenChat]);

  useEffect(() => { initAnalytics(); Analytics.appOpened(); }, []);

  /** Fallback: pede permissão de notificação se onboarding já foi concluído sem perguntar */
  useEffect(() => {
    const jaOnboarded = !!localStorage.getItem('tusab_onboarded');
    if (jaOnboarded && Notification.permission === 'default') Notification.requestPermission();
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

  /** Resets driveOpen when auth fails or is cancelled (status returns to nao_autenticado) */
  useEffect(() => {
    if (driveStatus === 'nao_autenticado') setDriveOpen(false);
  }, [driveStatus]);

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
        // Atualiza canal configurado quando motor está rodando — cobre troca da fila
        const nomeDoMotor = res.data.stats?.canal_nome;
        if (nomeDoMotor && !canalRemovidoRef.current && res.data.is_running && nomeDoMotor !== canalConfigurado) {
          setCanalConfigurado(nomeDoMotor);
        }
      } catch {
        _backendFailCount.current += 1;
        if (_backendFailCount.current >= 2) setBackendOnline(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [canalConfigurado]);

  // Persiste canal de extração para sobreviver a reloads
  useEffect(() => {
    if (canalConfigurado) {
      localStorage.setItem('tusab_canal_configurado', canalConfigurado);
    } else {
      localStorage.removeItem('tusab_canal_configurado');
    }
  }, [canalConfigurado]);

  // Persiste projeto do chat separadamente — independente da extração
  useEffect(() => {
    if (projetoChat) {
      localStorage.setItem('tusab_canal_chat', projetoChat);
    } else {
      localStorage.removeItem('tusab_canal_chat');
    }
  }, [projetoChat]);

  // Sincroniza canal ativo com o hook (usa projeto do chat, não da extração)
  useEffect(() => {
    setCanalAtivo(projetoChat || agentStatus.canal_indexado || '');
  }, [projetoChat, agentStatus.canal_indexado]);

  // Inicializa projetoChat quando o usuário ainda não escolheu — só com projetos realmente indexados
  // Um projeto com índice mas sem arquivos fonte (n_arquivos_fonte === 0) é órfão e não conta para auto-select,
  // mas ainda é válido para manter a seleção explícita do usuário.
  useEffect(() => {
    const todos     = agentStatus.canais_indexados || [];
    const indexados = todos.filter(c => (c.n_arquivos_fonte ?? 1) > 0);
    const nomesTodosValidos = new Set(todos.map(c => c.nome));
    // Limpa projetoChat apenas se o projeto desapareceu completamente da lista de indexados
    if (projetoChat && nomesTodosValidos.size > 0 && !nomesTodosValidos.has(projetoChat)) {
      setProjetoChat('');
      return;
    }
    // Auto-seleciona apenas se há exatamente 1 projeto com fonte e nenhum foi escolhido
    if (!projetoChat && indexados.length === 1) {
      setProjetoChat(indexados[0].nome);
    }
  }, [agentStatus.canais_indexados]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Auto-scrolls log container to the bottom while extraction runs */
  useEffect(() => {
    if (status.is_running && status.logs.length > 0 && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs.length, status.is_running]);

  /** Tracks scroll position to show/hide scroll-to-top button */
  useEffect(() => {
    setShowScrollTop(false);
    const attach = (el) => {
      if (!el) return () => {};
      const onScroll = () => setShowScrollTop(el.scrollTop > 300);
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    };
    // rAF garante que o div já está montado antes de ler .current
    const id = requestAnimationFrame(() => {
      const d1 = attach(mainScrollRef.current);
      cleanupRef.current = () => { d1(); };
    });
    return () => {
      cancelAnimationFrame(id);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
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
      // Em modo lote, suprimir todo feedback intermediário — handleIndexarDoChat controla o toast final
      if (indexacaoLoteRef.current) return;
      const hasError = agentStatus.index_logs.some(l => l.message?.includes('Erro') || l.message?.includes('erro'));
      if (hasError) {
        const errLog = agentStatus.index_logs.find(l => l.message?.includes('Erro') || l.message?.includes('erro'));
        showError(errLog?.message || t('error.index_failed'));
      } else {
        Analytics.baseIndexada(agentStatus.index_count);
        if (!showHome && !showLanding) {
          setProgressToast({
            message: t('toast.base_indexed', { count: agentStatus.index_count }),
            nextStep: chatOpen ? null : t('toast.open_chat'),
            onNext: chatOpen ? null : () => setChatOpen(true),
          });
        }
      }
    }
  }, [agentStatus.indexing, agentStatus.index_logs]);


  /** Toast de carregamento do CrossEncoder (primeira busca ampla — ~30s) */
  useEffect(() => {
    if (agentStatus.cross_encoder_loading) {
      setProgressToast({ type: 'info', message: t('toast.cross_encoder_loading') });
    }
  }, [agentStatus.cross_encoder_loading]);


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

  /** Tracks Drive auth success for the D1 funnel (drive vs chat usage) */
  useEffect(() => {
    const ds = status.drive_status;
    if (ds === 'autenticado' && prevDriveStatus.current && prevDriveStatus.current !== 'autenticado') {
      Analytics.driveAuthConcluida();
    }
    prevDriveStatus.current = ds;
  }, [status.drive_status]);

  /** Tracks tab visits for the activation funnel (repositório / relatório) */
  useEffect(() => {
    if (activeTab === 'repositorio') {
      Analytics.repositorioAcessado();
      fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
    }
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
  const handleAgentIndex = async (canalOverride) => {
    setAgentIndexError('');
    setAgentStatus(prev => ({ ...prev, indexing: true, index_logs: [] }));
    const canal = canalOverride || agentStatus.canal_indexado || canalConfigurado;
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

  /** Aguarda o backend terminar a indexação em andamento via polling (max 5 min). */
  const _aguardarIndexacao = () => new Promise((resolve) => {
    const MAX = 300_000;
    const start = Date.now();
    const tick = () => {
      if (Date.now() - start > MAX) { resolve(); return; }
      fetchAgentStatus().then(r => {
        if (!r.data?.indexing) resolve();
        else setTimeout(tick, 1500);
      }).catch(() => setTimeout(tick, 2000));
    };
    setTimeout(tick, 1500);
  });

  /**
   * Indexes a list (or single) of canals sequentially.
   * onStatusChange(nome, 'aguardando'|'indexando'|'ok'|'erro') — called per item for live card feedback.
   */
  const handleIndexarDoChat = async (canaisParam, onStatusChange) => {
    setAgentIndexError('');
    const lista = Array.isArray(canaisParam) ? canaisParam : [canaisParam];
    const isLote = lista.length > 1;
    if (isLote) indexacaoLoteRef.current = { total: lista.length, done: 0 };
    // Mark all items as waiting before starting
    lista.forEach(nome => onStatusChange?.(nome, 'aguardando'));
    setAgentStatus(prev => ({ ...prev, indexing: true, index_logs: [] }));
    let indexadas = 0;
    let comErro = 0;
    try {
      for (const nome of lista) {
        onStatusChange?.(nome, 'indexando');
        const res = await startIndexing(nome).catch(() => null);
        if (res?.data?.error) {
          onStatusChange?.(nome, 'erro');
          comErro++;
          continue;
        }
        await _aguardarIndexacao();
        const statusRes = await fetchAgentStatus().catch(() => null);
        const logs = statusRes?.data?.index_logs || [];
        const temErro = logs.some(l => l.message?.includes('Erro') || l.message?.includes('erro') || l.message?.includes('❌'));
        if (temErro) { onStatusChange?.(nome, 'erro'); comErro++; }
        else { onStatusChange?.(nome, 'ok'); indexadas++; }
      }
    } catch (err) {
      setAgentIndexError(extrairMensagemErro(err));
    } finally {
      indexacaoLoteRef.current = null;
      if (isLote && !showHome && !showLanding) {
        const total = indexadas + comErro;
        setProgressToast({
          message: comErro > 0
            ? t('toast.bases_indexed_partial', { ok: indexadas, total })
            : t('toast.bases_indexed', { count: indexadas }),
          nextStep: indexadas > 0 ? t('toast.open_chat') : undefined,
          onNext: indexadas > 0 ? () => setChatOpen(true) : undefined,
        });
      }
      refetchAgentStatus();
    }
  };

  /** Removes an indexed canal and updates the extras list */
  const handleDeleteCanal = async (nome) => {
    const ok = await deleteCanalIndex(nome).then(() => true).catch(() => false);
    if (!ok) { showError(t('error.remove_canal')); return; }
    setProjetosExtras(prev => prev.filter(c => c !== nome));
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
    Analytics.driveAuthIniciada();
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
  const handleDriveDisconnect = () => { Analytics.driveDesconectado(); return disconnectDrive().catch(() => {}); };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Landing screen — shown only on first-ever visit (not yet onboarded) */}
      <AnimatePresence>
        {showLanding && (
          <motion.div key="landing-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999]">
            <LandingScreen darkMode={darkMode} appUpdateInfo={appUpdateInfo} onToggleDark={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('tusab_theme', next ? 'dark' : 'light'); }} onEnter={() => {
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
          <ConsentModal key="consent" darkMode={darkMode}
            zIndex={showLanding ? 'z-[10001]' : 'z-50'}
            skipAriaHidden={showLanding}
            onDone={() => {
              setShowConsent(false);
              setShowLanding(false);
            }} />
        )}
      </AnimatePresence>

      {/* Drive security warning — shown once before first Drive auth */}
      <DriveWarningModal
        open={showDriveWarning}
        darkMode={darkMode}
        onConfirm={handleDriveWarningConfirm}
        onCancel={() => { setShowDriveWarning(false); setDriveOpen(false); }} />

      {/* Aprofundar base — oferecido após salvar config LLM quando há vídeos sem resumo */}
      <AprofundarModal
        open={aprofundarOpen}
        darkMode={darkMode}
        totalPendente={aprofundarPendente.total}
        canais={aprofundarPendente.canais}
        rodando={aprofundarRodando}
        progresso={aprofundarProgresso}
        onConfirm={handleAprofundarConfirm}
        onClose={handleAprofundarClose} />

      {/* Banner de atualização do app disponível */}
      <AnimatePresence>
        {showUpdateBanner && appUpdateInfo && !showHome && (
          <motion.div
            key="update-banner"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9000] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm
              ${darkMode ? 'bg-[#1a2035] border-warning/30 text-white' : 'bg-white border-warning/40 text-slate-800'}`}
            style={{ minWidth: 300, maxWidth: 420 }}>
            <span className="text-warning text-base">⬆</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {appUpdateInfo.downloaded
                  ? <>Tusab <span className="text-warning">{appUpdateInfo.version}</span> pronto para instalar</>
                  : <>Nova versão <span className="text-warning">{appUpdateInfo.version}</span> disponível</>
                }
              </p>
              <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {appUpdateInfo.downloaded
                  ? 'Clique em "Instalar e reiniciar" para aplicar agora.'
                  : 'Baixando em segundo plano automaticamente…'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {appUpdateInfo.downloaded ? (
                <button
                  onClick={() => window.tusab?.installUpdate?.(appUpdateInfo?.version)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-warning text-white hover:bg-warning/90 transition-colors">
                  Instalar e reiniciar
                </button>
              ) : (
                <a
                  href="https://github.com/ahaugusto/tusab-public/releases/latest"
                  target="_blank" rel="noreferrer"
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors
                    ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  Baixar manualmente
                </a>
              )}
              <button onClick={() => setShowUpdateBanner(false)}
                aria-label="Fechar"
                className={`p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress toast — contextual next-step guidance */}
      <AnimatePresence>
        {progressToast && !showHome && !showLanding && !(chatOpen && progressToast.type === 'info') && (
          <ProgressToast
            key="progress-toast"
            darkMode={darkMode}
            type={progressToast.type || 'success'}
            message={progressToast.message}
            nextStep={progressToast.nextStep}
            onNext={progressToast.onNext}
            onClose={() => setProgressToast(null)}
            offsetRight={chatOpen ? 440 : 24}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && (
          <Onboarding key="onboarding" darkMode={darkMode}
            zIndex={showLanding ? 'z-[10001]' : undefined}
            skipAriaHidden={showLanding}
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
              // Redireciona para a primeira aba permitida se a aba atual não estiver disponível no novo perfil
              const abasNovoPerfil = PERFIS_CONFIG[novoPerfil]?.abas ?? [];
              if (!abasNovoPerfil.includes(activeTab)) {
                setActiveTab(abasNovoPerfil[0] ?? 'repositorio');
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
          setProjetosExtras([]);
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

      {/* Modal: app recém atualizado via auto-update */}
      <UpdateSuccessModal
        version={justUpdatedVersion}
        darkMode={darkMode}
        onClose={() => setJustUpdatedVersion(null)}
      />

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
                  aria-describedby={id === 'agente' && (agentStatus.configured || ollamaStatus?.running) ? 'tooltip-agente' : undefined}
                  className={`group relative w-full py-2 rounded-xl flex flex-col items-center gap-1 transition-colors ${BTN_FOCUS}
                    ${activeTab === id && !showHome
                      ? darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                      : darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span className="text-[9px] font-semibold leading-none tracking-wide">{label}</span>
                  {id === 'extracao' && isRunning && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-warning animate-pulse" aria-hidden="true" />
                  )}
                  {id === 'admin' && appUpdateInfo && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-warning animate-pulse" aria-hidden="true" />
                  )}
                  {id === 'agente' && (agentStatus.configured || ollamaStatus?.running) && (
                    <>
                      <span className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${agentStatus.configured ? 'bg-secondary' : 'bg-warning'}`} aria-hidden="true" />
                      <div
                        id="tooltip-agente"
                        role="tooltip"
                        className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[10px] leading-snug shadow-lg
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
            <p className={`text-[9px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>v{__APP_VERSION__}</p>
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
              onNavigate={(id) => { if (id === 'agente') setAgentInitialSubTab('configuracoes'); setActiveTab(id); setShowHome(false); }}
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
                onOpenQueueModal={() => setShowQueueModal(true)}
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
              <div id="panel-historico" role="tabpanel" aria-labelledby="tab-historico" ref={mainScrollRef}
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
              <div id="panel-repositorio" role="tabpanel" aria-labelledby="tab-repositorio" ref={mainScrollRef}
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
                      <p className={`text-[10px] ${driveStatus === 'autenticado' ? 'text-secondary' : driveStatus === 'sem_credenciais' ? 'text-warning' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {driveStatus === 'autenticado' ? t('drive.connected') : driveStatus === 'sem_credenciais' ? t('drive.no_credentials_title') : t('drive.not_authenticated')}
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
                        // sem_credenciais: abre o painel para mostrar a instrução, mas não chama
                        // o backend — a auth falharia com FileNotFoundError críptico
                        if (willOpen && driveStatus !== 'autenticado' && driveStatus !== 'sem_credenciais') handleDriveAuth();
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
                      {driveStatus === 'sem_credenciais' && (
                        <p className="text-[11px] text-warning flex items-center gap-1" role="alert">
                          <AlertTriangle size={10} /> {t('drive.no_credentials_reinstall')}
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
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>
                    <span className="text-lg shrink-0 mt-0.5">💡</span>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className={`text-xs font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Seu repositório de conhecimento</p>
                        <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          Aqui ficam os arquivos do YouTube e tudo que você adicionar. Após adicionar conteúdo, clique em <strong>Indexar base</strong> para o chat conseguir responder perguntas sobre ele.
                        </p>
                      </div>
                      <div className={`grid grid-cols-2 gap-2 text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <div className={`flex items-start gap-1.5 p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-white border border-slate-200'}`}>
                          <span className="shrink-0 mt-0.5">📄</span>
                          <span><strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Documentos</strong><br/>PDF, Word, Excel, Markdown, TXT</span>
                        </div>
                        <div className={`flex items-start gap-1.5 p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-white border border-slate-200'}`}>
                          <span className="shrink-0 mt-0.5">💬</span>
                          <span><strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Conversas</strong><br/>WhatsApp, Zoom, Teams, Otter</span>
                        </div>
                        <div className={`flex items-start gap-1.5 p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-white border border-slate-200'}`}>
                          <span className="shrink-0 mt-0.5">✏️</span>
                          <span><strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Textos</strong><br/>Cole qualquer texto diretamente</span>
                        </div>
                        <div className={`flex items-start gap-1.5 p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-white border border-slate-200'}`}>
                          <span className="shrink-0 mt-0.5">📦</span>
                          <span><strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Compartilhar</strong><br/>Exporte e importe bases <code className={`px-1 rounded ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>.tusab</code></span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => markSeen(KEYS.repositorio)} className={`p-1 rounded text-xs shrink-0 mt-0.5 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
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
                  onAnexarArquivo={(arquivo, tipo) => {
                    setFontesFixadas(prev => {
                      const sub = tipo === 'documento' ? 'documents' : tipo === 'texto' ? 'texts' : 'youtube';
                      const emoji = tipo === 'documento' ? '📄' : tipo === 'texto' ? '📝' : '🎬';
                      const id = `@@${sub}/${arquivo}`;
                      if (prev.some(f => f.id === id)) return prev;
                      return [...prev, { tipo: 'arquivo', id, label: arquivo.replace('.txt','').replace(/_/g,' '), emoji, arquivo, _modo: '@' }];
                    });
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
                  buscaInicial={repoBuscaInicial}
                  onBuscaInicialHandled={() => setRepoBuscaInicial('')}
                  regras={regras}
                />
              </div>
            )}


            {/* ── TAB: VISÃO GERAL ── */}
            {activeTab === 'visao-geral' && (
              <div id="panel-visao-geral" role="tabpanel" aria-labelledby="tab-visao-geral" ref={mainScrollRef}
                className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-5 custom-scrollbar">
                <VisaoGeralTab darkMode={darkMode} btnFocus={BTN_FOCUS} />
              </div>
            )}

            {/* ── TAB: MONITOR ── */}
            {activeTab === 'monitor' && (
              <div id="panel-monitor" role="tabpanel" aria-labelledby="tab-monitor" ref={mainScrollRef}
                className="flex-1 overflow-y-auto px-4 lg:px-8 pt-5 pb-6 custom-scrollbar">
                <MonitorTab darkMode={darkMode} btnFocus={BTN_FOCUS} onGoToAdmin={() => { setActiveTab('admin'); setShowHome(false); }} />
              </div>
            )}

            {/* ── TAB: AGENTE ── */}
            {activeTab === 'agente' && (
              <AgentTab
                darkMode={darkMode}
                mainScrollRef={mainScrollRef}
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
                onIndexar={handleIndexarDoChat}
                initialSubTab={agentInitialSubTab}
              />
            )}
{/* ── Admin tab ── */}
            {activeTab === 'admin' && !showHome && regras.admin && (
              <AdminTab
                darkMode={darkMode}
                mainScrollRef={mainScrollRef}
                analyticsEnabled={analyticsEnabled}
                setAnalyticsEnabled={setAnalyticsEnabled}
                regras={regras}
                onResetClick={() => setShowResetModal(true)}
                appUpdateInfo={appUpdateInfo}
                onInstallUpdate={() => window.tusab?.installUpdate?.(appUpdateInfo?.version)}
              />
            )}

            {/* ── Chat Drawer ── */}
            <ChatDrawer
              darkMode={darkMode}
              persona={persona}
              onOpenPersona={PERFIS_CONFIG[perfil]?.config_api !== false ? () => {
                setAgentInitialSubTab('configuracoes');
                setActiveTab('agente');
                setChatOpen(false);
                setTimeout(() => {
                  document.getElementById('agent-persona-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
              } : undefined}
              onPersonaChange={PERFIS_CONFIG[perfil]?.config_api === false ? (novaPersona) => {
                handlePersonaChange(novaPersona);
              } : undefined}
              agentProvider={useExternalProvider ? agentProvider : 'ollama'}
              ollamaStatus={ollamaStatus}
              onGoToAgent={() => {
                setChatOpen(false);
                setActiveTab('agente');
                setShowHome(false);
              }}
              onAbrirIndexacaoRepositorio={() => {
                setChatOpen(false);
                setActiveTab('repositorio');
                setShowHome(false);
                setTimeout(() => setRepoIndexarOpen(true), 80);
              }}
              onAbrirBuscaRepositorio={(query) => {
                setChatOpen(false);
                setActiveTab('repositorio');
                setShowHome(false);
                if (query) setRepoBuscaInicial(query);
              }}
              chatOpen={chatOpen} setChatOpen={setChatOpen}
              expandido={chatExpandido} setExpandido={setChatExpandido}
              chatMessages={chatMessages} setChatMessages={setChatMessages}
              chatInput={chatInput} setChatInput={setChatInput}
              chatLoading={chatLoading}
              onSend={handleChatSend}
              onRecriarIndice={handleAgentIndex}
              onClearHistory={() => {
                const canal = projetoChat || agentStatus.canal_indexado;
                if (canal) clearChatHistory(canal).catch(() => showError('Erro ao limpar histórico. Tente novamente.'));
              }}
              agentStatus={agentStatus}
              indexingDoneCount={indexingDoneCount}
              projetoSelecionado={projetoChat}
              onSelectProjeto={setProjetoChat}
              canalMeta={canalMeta}
              chatEndRef={chatEndRef}
              canaisExtraidos={[
                ...new Set([
                  ...(repositorio.canais || []).map(c => c.nome),
                  ...history.filter(h => h.canal_nome).map(h => h.canal_nome),
                ])
              ]}
              projetosExtras={projetosExtras}
              setProjetosExtras={setProjetosExtras}
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
              <div className={`fixed right-6 z-40 flex items-center gap-3 transition-all duration-300 ${activeTab === 'repositorio' ? 'bottom-20' : 'bottom-6'}`}>
                {/* Snack lateral */}
                <AnimatePresence>
                  {showChatSnack && (
                    <motion.div
                      initial={{ opacity: 0, x: 16, scale: 0.92 }}
                      animate={{ opacity: 1, x: 0,  scale: 1 }}
                      exit={{    opacity: 0, x: 16, scale: 0.92 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      onClick={handleOpenChat}
                      role="status"
                      aria-live="polite"
                      className={`cursor-pointer select-none flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[13px] font-semibold shadow-xl whitespace-nowrap
                        ${darkMode
                          ? 'bg-[#1e1b2e] border border-violet-500/40 text-violet-200'
                          : 'bg-white border border-violet-200 text-violet-700'}`}
                      style={{ boxShadow: darkMode
                        ? '0 4px 20px 0 rgba(124,58,237,0.35)'
                        : '0 4px 20px 0 rgba(124,58,237,0.18)' }}>
                      <span className="text-base">✨</span>
                      {t('chat.snack_hint')}
                      <span className="opacity-60">→</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Botão flutuante do chat */}
                <ChatFloatButton
                  darkMode={darkMode}
                  indexed={agentStatus.indexed}
                  configured={agentStatus.configured}
                  msgCount={chatMessages.filter(m => m.role === 'assistant').length}
                  onClick={handleOpenChat}
                  title={t('chat.open_tooltip')}
                />
              </div>
            )}

            {/* Scroll-to-top button — liquid glass */}
            <AnimatePresence>
              {showScrollTop && !chatOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.7, y: 8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={() => {
                    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  aria-label="Voltar ao topo"
                  style={{ backdropFilter: 'blur(16px) saturate(1.8)', WebkitBackdropFilter: 'blur(16px) saturate(1.8)' }}
                  className={`fixed z-30 p-3 rounded-full transition-all duration-200 ${BTN_FOCUS}
                    bottom-24 right-6
                    ${darkMode
                      ? 'bg-white/10 text-white border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-white/18 hover:border-white/35 hover:shadow-[0_6px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'bg-white/60 text-primary border border-white/80 shadow-[0_4px_24px_rgba(99,102,241,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-white/80 hover:border-white hover:shadow-[0_6px_32px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,1)]'
                    }`}>
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
