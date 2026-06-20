/**
 * @file ChatDrawer.jsx
 * @description Floating chat drawer for interacting with the indexed RAG agent
 * @module components/chat/ChatDrawer
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Bot, Loader2, ExternalLink, Send, Database, ChevronRight, RefreshCw, Zap, ChevronDown, Maximize2, Minimize2, History, PlusCircle, ArrowLeft, FileText, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { salvarHistoricoChat, listarHistoricosChat, clearChatHistory, lerArquivo, fetchMencoes } from '../../services/api';

// ─── Loading phrases ─────────────────────────────────────────────────────────

const LOADING_PHRASES = [
  // ── Funcionais — o que está acontecendo agora ────────────────────────────
  'Buscando nos seus documentos…',
  'Recuperando contexto relevante…',
  'Ranqueando trechos por relevância…',
  'Montando o contexto para o modelo…',
  'Localizando informações relevantes…',
  'Consultando a base de conhecimento indexada…',
  'Expandindo a consulta para cobrir variações do tema…',
  'Filtrando os documentos mais pertinentes…',
  'Passando o contexto para o modelo de linguagem…',
  'Processando os trechos recuperados…',
  'Quase lá — finalizando a geração da resposta…',

  // ── Thoth / Sabedoria / origem do Tusab ──────────────────────────────────
  'Tusab foi inspirado na ideia da Sabedoria — e associado a Thoth, o deus egípcio que a personificava.',
  'Thoth era o escriba dos deuses. O Tusab é o seu escriba pessoal — transcreve, indexa e responde.',
  'Os egípcios acreditavam que Thoth inventou a escrita para preservar o saber eterno. O Tusab preserva o seu.',
  'Thoth era representado com cabeça de íbis — pássaro de memória precisa. O Tusab não esquece nada que você indexar.',
  'Segundo os egípcios, Thoth escreveu 42 livros com todo o conhecimento do universo. Quantos canais você já extraiu?',
  'Thoth era o guardião dos Registros Akáshicos — o repositório de tudo que existiu. O Tusab guarda os seus.',
  'Thoth mediava entre os deuses com sabedoria, não com força. O Tusab medeia entre você e seus documentos.',
  'Thoth iluminava o que estava na escuridão. O Tusab ilumina o que estava esquecido em vídeos, PDFs, textos e documentos.',
  'Thoth era "o que equilibra" — pesava com precisão. O BM25 faz o mesmo com os trechos da sua base.',
  'A pena de Maat era símbolo da verdade. O Tusab ancora cada resposta nos seus próprios documentos.',
  'Na tradição hermética, Thoth tornou-se Hermes Trismegisto — três vezes grande. O Tusab: extrai, indexa e responde.',
  'O íbis de Thoth nunca errava ao pescar — precisão era seu dom. O Tusab treina o mesmo instinto na busca.',
  'Os egípcios acreditavam que escrever algo era torná-lo real. Indexar é o ato moderno de tornar real.',
  'Thoth era protetor dos bibliotecários. O Tusab é a biblioteca que você mesmo construiu — e protege.',
  'Thoth preservava o conhecimento de todos os lados de uma batalha. O Tusab preserva todas as suas fontes, sem julgamento.',
  'A escrita hieroglífica foi chamada de "palavras dos deuses". Seus documentos indexados são as suas palavras.',
  'Thoth era invocado para curar e para lembrar. O Tusab lembra — você cuida do resto.',
  'Os sacerdotes de Thoth guardavam segredos por gerações. Você guarda os seus localmente, em hardware que só você acessa.',
  'Em algumas tradições, Thoth ensinou a alquimia ao mundo. O Tusab pratica a alquimia de transformar vídeos, PDFs e documentos em conhecimento consultável.',
  'Thoth aparecia nas batalhas apenas como testemunha — para registrar, não para lutar. O Tusab registra tudo, sem interferir.',

  // ── Como a ferramenta funciona — RAG, privacidade, curadoria ─────────────
  'O RAG não alucina achismos — ele só responde com o que está na sua base.',
  'Com RAG, a IA lê seus documentos antes de responder. Sem chute, sem invenção.',
  'A diferença entre IA genérica e RAG: um fala sobre o mundo, o outro fala sobre o seu mundo.',
  'RAG significa Retrieval-Augmented Generation — busca primeiro, gera depois.',
  'Nenhum dado seu sai daqui. A busca é local, a resposta é sua.',
  'Enquanto modelos genéricos treinam em bilhões de páginas, o Tusab foca só no que você escolheu.',
  'A IA mais útil não é a que sabe mais — é a que sabe o que é relevante pra você.',
  'O BM25 ranqueia os trechos mais relevantes antes de passar pro modelo. Velocidade com precisão.',
  'BM25 considera frequência e raridade das palavras — termos raros pesam mais na busca.',
  'Quanto mais você indexa, mais preciso fica o contexto. A qualidade da resposta cresce com a base.',
  'O yt-dlp extrai legendas diretamente do YouTube — sem gravar áudio, sem processar vídeo. PDFs e documentos entram pelo repositório.',
  'Cada item indexado — transcrição, PDF, texto ou documento — é um fragmento de memória consultável em milissegundos.',
  'O Tusab funciona 100% offline — sem internet, sem nuvem obrigatória, sem assinatura por token.',
  'Seus documentos ficam em cerebro/ — uma pasta local que só você controla.',
  'Você pode usar Ollama localmente ou conectar a Groq, OpenAI, Gemini e Anthropic. A escolha é sua.',
  'O histórico de chat fica no servidor local — nunca no cliente. Proteção contra injeção de contexto.',
  'A indexação BM25 é feita em Python puro, sem GPU necessária. Roda em qualquer máquina.',
  'Chunks são pedaços de texto com sobreposição — o contexto nunca é cortado no meio de uma ideia.',
  'Você pode fixar fontes específicas com @ no chat — o BM25 filtra só esses documentos.',
  'O Tusab suporta PDFs, Word, Markdown, CSV e texto colado. Qualquer conhecimento pode entrar.',
  'Playlists, Shorts, Ao Vivo, Podcasts e Cursos podem ser extraídos separadamente ou juntos.',
  'O Tusab não treina modelos com seus dados. Ele apenas consulta o que você já tem.',
  'Streaming de resposta: as palavras chegam à medida que são geradas — sem esperar o fim.',
  // Curadoria e privacidade — tom investigativo
  'Curadoria é o que separa informação de conhecimento. Você escolhe o que entra, o modelo usa só isso.',
  'A pergunta certa não é "o modelo é bom?" — é "o modelo está respondendo com as fontes certas?".',
  'Privacidade não é paranoia — é higiene de dados. Seus documentos merecem ficar com você.',
  'Um modelo com RAG responde com evidência — você pode rastrear de onde veio cada trecho.',
  'Você sabe exatamente de onde vem cada resposta daqui — porque a fonte está nos seus arquivos.',
  'O Tusab mostra os trechos usados na resposta — transparência é parte do design.',
  'RAG ancora a resposta na fonte. O que está nos seus documentos é o que guia o modelo.',
  'Quanto mais curada a sua base, mais confiável a resposta. Qualidade entra, qualidade sai.',
  'Indexar conhecimento é um ato de curadoria — você decide o que merece entrar.',
  'Dados privados merecem tratamento privado. O Tusab foi desenhado com isso em mente.',
  'Conhecimento sem rastreabilidade é crença. O RAG devolve a rastreabilidade para a IA.',
  'Você não precisa confiar cegamente na resposta — você pode verificar nos seus próprios documentos.',
  'IA local significa que o processamento acontece no seu hardware, não em servidores de terceiros.',
  'O valor do Tusab está em amplificar o que você já sabe — não em substituir o seu julgamento.',
  'Sua base de conhecimento é sua vantagem competitiva. Faz sentido mantê-la com você.',

  // ── Saúde mental / pausas / autocuidado ──────────────────────────────────
  'Já se hidratou hoje? Vai lá tomar uma água, eu fico aqui pensando.',
  'Aproveitando que você vai esperar, levanta e espreguiça. Coluna agradece.',
  'Que tal respirar fundo três vezes enquanto eu trabalho?',
  'Este é um bom momento para tomar aquele cafezinho que você estava adiando.',
  'Pausas curtas aumentam o foco. Você está fazendo uma agora — conta sim.',
  'Fechar os olhos por 20 segundos descansa a visão. Pode fazer isso agora.',
  'Lembra de piscar! A gente costuma piscar menos olhando para telas.',
  'Se você estiver tenso, solte os ombros. Agora. Isso mesmo.',
  'Produtividade sustentável > sprint sem pausa. O Tusab estará aqui quando você voltar.',
  'Uma xícara de chá também funciona, se o café já era pra hoje.',
  'Você está consumindo conhecimento de forma ativa — isso é diferente de só scrollar.',
  'Organizar o que você sabe é tão importante quanto aprender coisas novas.',
  'Já faz tempo que você está na tela? Olhar para algo distante por 20 segundos ajuda os olhos.',
  'Não existe atalho para entender — só para encontrar. O Tusab cuida do encontrar.',
  'Pausas não são perda de tempo — são onde a memória consolida o que aprendeu.',
  'Cuidar de si é parte do processo de aprender. Sem energia, nem o melhor RAG ajuda.',
  'Você merece entender o que está estudando, não só coletar informação.',
  'Toda grande descoberta começa com uma boa pergunta. A sua já foi feita.',
  'Se a resposta não veio como esperado, tente reformular. A base é a mesma, o ângulo muda.',
  'Seu cérebro processa informação mesmo quando você não está olhando pra tela.',
];

function useLoadingPhrase(active) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LOADING_PHRASES.length));
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setIdx(i => (i + 1) % LOADING_PHRASES.length);
    }, 15000);
    return () => clearInterval(iv);
  }, [active]);
  return LOADING_PHRASES[idx];
}

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
  expandido,
  setExpandido,
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
  canaisExtras,
  setCanaisExtras,
  onIndexar,
  fontesFixadas,
  setFontesFixadas,
  persona,
  onOpenPersona,
  onAbrirIndexacaoRepositorio,
}) {
  const { t } = useTranslation();
  const [showRepoModal,     setShowRepoModal]     = useState(false);
  const [showIndexModal,    setShowIndexModal]    = useState(false);
  const [indexSel,          setIndexSel]          = useState(null);
  const [showHistModal,     setShowHistModal]     = useState(false);
  const [historicos,        setHistoricos]        = useState([]);
  const [histLoading,       setHistLoading]       = useState(false);
  const [histSelecionado,   setHistSelecionado]   = useState(null);
  const [salvando,          setSalvando]          = useState(false);
  const [showBaseModal,     setShowBaseModal]     = useState(false);
  const [showBuscaModal,    setShowBuscaModal]    = useState(false);
  const [indexandoBase,     setIndexandoBase]     = useState(null);
  const [indexSnackbar,     setIndexSnackbar]     = useState(null); // { msg, type }
  const prevIndexing = useRef(false);
  const [mencaoQuery,       setMencaoQuery]       = useState('');
  const [mencaoItens,       setMencaoItens]       = useState({ bases: [], documentos: [] });
  const [showMencao,        setShowMencao]        = useState(false);
  const [mencaoLoading,     setMencaoLoading]     = useState(false);
  const mencaoStartRef = useRef(-1);
  const textareaRef = useRef(null);

  const prevChatInputRef = useRef(chatInput);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    // Foca quando o input foi alterado externamente (injeção de contexto)
    if (chatInput !== prevChatInputRef.current && chatInput.length > prevChatInputRef.current.length) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    prevChatInputRef.current = chatInput;
  }, [chatInput]);

  // Detecta fim da indexação e exibe snackbar
  useEffect(() => {
    const agora = agentStatus.indexing;
    if (prevIndexing.current && !agora) {
      setIndexSnackbar({ msg: t('chat.index_success'), type: 'ok' });
      setTimeout(() => setIndexSnackbar(null), 4000);
    }
    prevIndexing.current = agora;
  }, [agentStatus.indexing, t]);

  const loadingPhrase = useLoadingPhrase(chatLoading);
  const canaisIndexados = agentStatus.canais_indexados || [];
  const temBase = agentStatus.indexed || canaisIndexados.length > 0;
  const canalAtivo = canalConfigurado || agentStatus.canal_indexado;
  const chatHabilitado = temBase && !!canalAtivo;

  // Handler de @mention: detecta @ no input e busca itens mencionáveis
  const handleInputChange = async (e) => {
    const val = e.target.value;
    setChatInput(val);
    const cursor = e.target.selectionStart;
    // Busca @ mais próximo antes do cursor
    const beforeCursor = val.slice(0, cursor);
    const atIdx = beforeCursor.lastIndexOf('@');
    if (atIdx >= 0) {
      const query = beforeCursor.slice(atIdx + 1);
      // Só abre dropdown se não tiver espaço após o @
      if (!query.includes(' ')) {
        mencaoStartRef.current = atIdx;
        setMencaoQuery(query);
        setShowMencao(true);
        if (canalAtivo && mencaoItens.bases.length === 0 && mencaoItens.documentos.length === 0) {
          setMencaoLoading(true);
          try {
            const r = await fetchMencoes(canalAtivo);
            setMencaoItens(r.data);
          } catch { /* silencioso */ }
          finally { setMencaoLoading(false); }
        }
        return;
      }
    }
    setShowMencao(false);
  };

  const handleSelecionarMencao = (item) => {
    const start = mencaoStartRef.current;
    if (start < 0) return;
    // Já está fixada?
    const jaFixada = (fontesFixadas || []).some(f => f.id === item.id);
    if (!jaFixada && setFontesFixadas) {
      setFontesFixadas(prev => [...prev, item]);
    }
    // Remove @query do input
    const novoTexto = chatInput.slice(0, start) + chatInput.slice(chatInput.indexOf(' ', start + 1) < 0 ? chatInput.length : chatInput.indexOf(' ', start + 1));
    setChatInput(novoTexto.trim() ? novoTexto : '');
    setShowMencao(false);
    mencaoStartRef.current = -1;
    textareaRef.current?.focus();
  };

  const itensFiltrados = mencaoQuery
    ? [
        ...(mencaoItens.bases || []).filter(b => b.label.toLowerCase().includes(mencaoQuery.toLowerCase())),
        ...(mencaoItens.documentos || []).filter(d => d.label.toLowerCase().includes(mencaoQuery.toLowerCase())),
      ]
    : [
        ...(mencaoItens.bases || []),
        ...(mencaoItens.documentos || []),
      ];

  // Conteúdo interno compartilhado entre drawer e modo expandido
  const conteudo = (onFechar) => (<>
    {/* Header */}
    <div className={`px-4 py-3.5 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
      <Sparkles size={15} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('agent.chat_title')}</p>
        {agentStatus.indexed && (() => {
          const principal = canalConfigurado || agentStatus.canal_indexado;
          const extras = canaisExtras || [];
          const todas = extras.length > 0
            ? [principal, ...extras].filter(Boolean)
            : null;
          return todas ? (
            <div className="relative group/bases inline-block">
              <p className={`text-[10px] cursor-default ${darkMode ? 'text-primary/80' : 'text-primary'}`}>
                {t('chat.active_bases', { count: todas.length })}
              </p>
              <div className={`absolute left-0 top-full mt-1 z-50 hidden group-hover/bases:block
                rounded-xl border shadow-lg p-2 space-y-0.5 min-w-[140px]
                ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
                {todas.map(b => (
                  <p key={b} className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap
                    ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    @{b}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>@{principal}</p>
          );
        })()}
      </div>
      {/* Busca Ampla toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-[10px] font-medium ${buscaAmpla ? (darkMode ? 'text-accent' : 'text-cyan-600') : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>
          {buscaAmpla ? t('chat.search_broad_label') : t('chat.search_restricted_label')}
        </span>
        <button
          role="switch"
          aria-checked={buscaAmpla}
          onClick={() => setBuscaAmpla(v => !v)}
          className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${buscaAmpla ? 'bg-accent' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${buscaAmpla ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <button
          onClick={() => setShowBuscaModal(true)}
          className={`p-0.5 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
          aria-label={t('chat.search_info_aria')}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="7.4" y="7" width="1.2" height="5.5" rx="0.5"/><circle cx="8" cy="4.8" r="0.75"/></svg>
        </button>
      </div>
      {chatMessages.length > 0 && (
        <button onClick={() => { setChatMessages([]); onClearHistory?.(); }}
          className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
          {t('chat.clear')}
        </button>
      )}
      {/* Botão expandir/recolher */}
      {setExpandido && (
        <button
          onClick={() => expandido ? setExpandido(false) : setExpandido(true)}
          className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
          aria-label={expandido ? t('chat.collapse_aria') : t('chat.expand_aria')}>
          {expandido ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
      <button onClick={onFechar}
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
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_no_index')}
                      </p>
                      {onIndexar && (
                        <button
                          onClick={() => { setIndexSel(null); setShowIndexModal(true); }}
                          className={`mt-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                            bg-accent/20 text-accent hover:bg-accent/30`}>
                          <Zap size={13} aria-hidden="true" />
                          {t('chat.index_base_btn')}
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
                                {t('chat.index_modal_title')}
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
                                  <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('chat.index_all_channels')}</p>
                                  <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t('chat.index_all_channels_desc')}</p>
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
                              {agentStatus.indexing ? t('chat.indexing_progress') : t('chat.index_confirm_btn')}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : ((!canalAtivo || showRepoModal) && canaisIndexados.length > 0) ? (
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
                              <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{canal.chunks} {t('chat.chunks_indexed')}</p>
                            </div>
                            <ChevronRight size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : canaisIndexados.length === 0 && !canalAtivo ? (
                    <>
                      <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_no_index')}
                      </p>
                      {onIndexar && (
                        <button
                          onClick={() => { setIndexSel(null); setShowIndexModal(true); }}
                          className={`mt-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                            bg-accent/20 text-accent hover:bg-accent/30`}>
                          <Zap size={13} aria-hidden="true" />
                          {t('chat.index_base_btn')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_ready', { canal: canalAtivo })}
                      </p>
                      {canaisIndexados.length > 1 && (
                        <button onClick={() => setShowRepoModal(true)}
                          className={`text-[10px] underline ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                          {t('chat.switch_base')}
                        </button>
                      )}
                      {agentStatus?.perguntas_sugeridas?.length > 0 && (
                        <div className="w-full mt-3 space-y-1.5">
                          <p className={`text-[10px] font-semibold text-center uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t('chat.suggested_questions')}
                          </p>
                          {agentStatus.perguntas_sugeridas.map((q, i) => (
                            <button key={i}
                              onClick={() => { setChatInput(q); setTimeout(() => onSend?.(q), 0); }}
                              className={`w-full text-left text-[11px] px-3 py-2 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99]
                                ${darkMode ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-primary/15 hover:border-primary/30 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-slate-800'}`}>
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {/* Mensagem de export — card especial com botão de download */}
                      {msg.role === 'export' ? (
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2.5 rounded-bl-sm
                          ${darkMode ? 'bg-white/8 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                          <div className="flex items-center gap-2">
                            <Sparkles size={13} className="text-primary shrink-0" />
                            <ReactMarkdown remarkPlugins={[remarkGfm]}
                              children={msg.content}
                              components={{ p: ({children}) => <span>{children}</span>, strong: ({children}) => <strong className="font-bold">{children}</strong> }}
                            />
                          </div>
                          <a
                            href={msg.exportUrl}
                            download={`tusab_${msg.exportCanal}_export.${msg.exportExt}`}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99]
                              ${darkMode ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25' : 'bg-violet-50 border-violet-200 text-primary hover:bg-violet-100'}`}>
                            <ExternalLink size={12} className="shrink-0" />
                            <span className="font-semibold truncate">{msg.exportLabel}</span>
                          </a>
                        </div>
                      ) : (
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2
                        ${msg.role === 'user'
                          ? darkMode
                            ? 'bg-primary/25 border border-primary/35 text-white rounded-br-sm'
                            : 'bg-violet-100 border border-violet-200 text-slate-800 rounded-br-sm'
                          : msg.role === 'error'
                            ? (darkMode ? 'bg-danger/15 border border-danger/30 text-danger' : 'bg-red-50 text-red-700 border border-red-200') + ' rounded-bl-sm'
                            : (darkMode ? 'bg-white/8 border border-white/10 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm') + ' rounded-bl-sm'}`}>
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="markdown-body">
                            <ReactMarkdown
                              // Normaliza \n simples entre parágrafos para \n\n (padrão Markdown)
                              // preservando blocos de código e listas que já têm estrutura própria
                              remarkPlugins={[remarkGfm]}
                              children={msg.content.replace(/(?<!\n)\n(?!\n)(?![-*+\d])/g, '\n\n')}
                              components={{
                                p:      ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                em:     ({children}) => <em className="italic">{children}</em>,
                                del:    ({children}) => <del className="line-through opacity-70">{children}</del>,
                                a:      ({href, children}) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 opacity-80 hover:opacity-100 break-all">{children}</a>,
                                ul:     ({children}) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                                ol:     ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                                li:     ({children}) => <li className="leading-relaxed">{children}</li>,
                                h1:     ({children}) => <p className="font-bold text-sm mb-1 mt-2">{children}</p>,
                                h2:     ({children}) => <p className="font-bold text-xs mb-1 mt-2">{children}</p>,
                                h3:     ({children}) => <p className="font-semibold text-xs mb-1 mt-1.5">{children}</p>,
                                code:   ({inline, children}) => inline
                                  ? <code className={`px-1 py-0.5 rounded text-[10px] font-mono ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>{children}</code>
                                  : <pre className={`p-2 rounded-lg text-[10px] font-mono overflow-x-auto mb-2 ${darkMode ? 'bg-black/30' : 'bg-slate-100'}`}><code>{children}</code></pre>,
                                blockquote: ({children}) => <blockquote className={`border-l-2 pl-3 my-1 opacity-70 ${darkMode ? 'border-white/30' : 'border-slate-400'}`}>{children}</blockquote>,
                                hr:     () => <hr className={`my-2 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />,
                              }}
                            />
                            {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />}
                          </div>
                        )}
                        {msg.role === 'error' && onRecriarIndice && !agentStatus?.indexing && (
                          <button
                            onClick={onRecriarIndice}
                            className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
                            <RefreshCw size={9} aria-hidden="true" />
                            {t('agent.rebuild_index')}
                          </button>
                        )}
                        {msg.sem_contexto && !msg.streaming && onAbrirIndexacaoRepositorio && (
                          <button
                            onClick={onAbrirIndexacaoRepositorio}
                            className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.98]
                              ${darkMode ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'}`}>
                            <Zap size={11} aria-hidden="true" />
                            {t('chat.index_base_now_btn')}
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
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start max-w-[85%]">
                      <div className={`px-4 py-3 rounded-2xl rounded-bl-sm border space-y-2 ${darkMode ? 'bg-white/8 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(n => (
                            <span key={n} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: `${n * 0.15}s`, animationDuration: '0.8s' }} />
                          ))}
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={loadingPhrase}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.35 }}
                            className={`text-[10px] leading-relaxed italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {loadingPhrase}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
    </div>

    {/* Input bar */}
    <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>

      {/* Chips de fontes fixadas */}
      {fontesFixadas && fontesFixadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {fontesFixadas.map(f => (
            <span key={f.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border
                ${darkMode ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
              <span>{f.emoji}</span>
              <span className="max-w-[100px] truncate">@{f.label}</span>
              <button
                onClick={() => setFontesFixadas && setFontesFixadas(prev => prev.filter(x => x.id !== f.id))}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown de @mention */}
      <AnimatePresence>
        {showMencao && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className={`mb-1.5 rounded-xl border shadow-lg overflow-hidden max-h-48 overflow-y-auto
              ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200 shadow-slate-200/60'}`}>
            {mencaoLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Loader2 size={12} className={`animate-spin ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('chat.loading')}</span>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className={`px-3 py-2.5 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('chat.mention_empty')}
              </div>
            ) : (
              itensFiltrados.map(item => (
                <button
                  key={item.id}
                  onMouseDown={e => { e.preventDefault(); handleSelecionarMencao(item); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors
                    ${darkMode ? 'hover:bg-white/8 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <span className="text-sm shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">@{item.label}</p>
                    {item.tipo === 'base' && (
                      <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{item.chunks} {t('chat.chunks_indexed')}</p>
                    )}
                    {item.tipo === 'documento' && (
                      <p className={`text-[10px] ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{item.pasta}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={!chatHabilitado ? t('agent.chat_placeholder_disabled') : t('agent.chat_placeholder_ready')}
          value={chatInput}
          onChange={handleInputChange}
          onKeyDown={e => {
            if (e.key === 'Escape' && showMencao) { setShowMencao(false); return; }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          disabled={!chatHabilitado || chatLoading}
          autoFocus
          style={{ resize: 'none', overflow: 'hidden' }}
          className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed leading-relaxed ${darkMode ? 'text-white' : 'text-slate-800'}`} />
        <button
          onClick={onSend}
          disabled={!chatHabilitado || !chatInput.trim() || chatLoading}
          className="p-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label={t('agent.send')}>
          <Send size={13} />
        </button>
      </div>

      {/* Barra de ações abaixo do input — Base | Histórico | Nova conversa */}
      <div className="flex items-center mt-2 px-0.5">
        {/* Base — esquerda */}
        <button
          onClick={() => setShowBaseModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors
            ${canaisExtras?.length > 0
              ? darkMode ? 'text-primary hover:bg-primary/10' : 'text-primary hover:bg-violet-50'
              : darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          aria-label={t('chat.base_btn_aria')}>
          <Database size={12} />
          <span>{t('chat.base_btn')}{canaisExtras?.length > 0 ? ` (${canaisExtras.length + 1})` : ''}</span>
        </button>

        {/* Histórico — centro */}
        <button
          onClick={async () => {
            const canal = agentStatus?.canal_indexado || canalConfigurado;
            if (!canal) return;
            setShowHistModal(true);
            setHistSelecionado(null);
            setHistLoading(true);
            try {
              const r = await listarHistoricosChat(canal);
              setHistoricos(r.data.historicos || []);
            } catch { setHistoricos([]); }
            finally { setHistLoading(false); }
          }}
          disabled={!(agentStatus?.canal_indexado || canalConfigurado)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          aria-label={t('chat.history_btn_aria')}>
          <History size={12} />
          <span>{t('chat.history_btn')}</span>
        </button>

        {/* Tom do agente */}
        {onOpenPersona && (
          <button
            onClick={onOpenPersona}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors
              ${persona
                ? darkMode ? 'text-primary bg-primary/15 hover:bg-primary/25' : 'text-violet-600 bg-violet-100 hover:bg-violet-200'
                : darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            aria-label={t('chat.tone_btn_aria')}>
            <SlidersHorizontal size={12} />
            <span>{ persona ? t(`persona.${persona}`) : t('chat.tone_btn') }</span>
          </button>
        )}

        {/* Nova conversa — direita */}
        <button
          onClick={async () => {
            const canal = agentStatus?.canal_indexado || canalConfigurado;
            if (!canal || chatMessages.length === 0) return;
            const msgs = chatMessages.filter(m => m.role === 'user' || m.role === 'assistant');
            if (msgs.length === 0) return;
            setSalvando(true);
            try {
              await salvarHistoricoChat(canal, msgs);
              await clearChatHistory(canal);
              setChatMessages([]);
            } catch { /* silencioso */ }
            finally { setSalvando(false); }
          }}
          disabled={chatMessages.length === 0 || salvando || chatLoading}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          aria-label={t('chat.new_conversation_aria')}>
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
          <span>{t('chat.new_conversation_btn')}</span>
        </button>
      </div>
    </div>

    {/* Modal explicativo: Busca Ampla vs Restrita */}
    <AnimatePresence>
      {showBuscaModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBuscaModal(false); }}>
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl ${darkMode ? 'bg-[#0C1122] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('chat.search_modal_title')}</h3>
              <button onClick={() => setShowBuscaModal(false)}
                className={`p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'}`}>
                <X size={14} />
              </button>
            </div>

            {/* Restrita */}
            <div className={`rounded-xl p-3.5 space-y-1.5 border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${darkMode ? 'bg-white/30' : 'bg-slate-400'}`} />
                <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('chat.restricted_title_default')}</p>
              </div>
              <p className="text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: t('chat.restricted_body') }} />
              <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t('chat.restricted_hint')}</p>
            </div>

            {/* Ampla */}
            <div className={`rounded-xl p-3.5 space-y-1.5 border ${darkMode ? 'bg-accent/8 border-accent/25' : 'bg-cyan-50 border-cyan-200'}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-accent" />
                <p className={`text-xs font-bold ${darkMode ? 'text-accent' : 'text-cyan-700'}`}>{t('chat.broad_title')}</p>
              </div>
              <p className="text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: t('chat.broad_body') }} />
              <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t('chat.broad_hint')}</p>
            </div>

            <button
              onClick={() => { setBuscaAmpla(v => !v); setShowBuscaModal(false); }}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-colors
                ${buscaAmpla
                  ? darkMode ? 'bg-white/10 text-slate-300 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-accent/20 text-accent hover:bg-accent/30'}`}>
              {buscaAmpla ? t('chat.broad_disable_btn') : t('chat.broad_enable_btn')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Modal de seleção de base de conhecimento */}
    <AnimatePresence>
      {showBaseModal && (() => {
        // Monta lista unificada: indexadas + não indexadas
        const indexadas = agentStatus.canais_indexados || [];
        const naoIndexadas = (canaisExtraidos || []).filter(n => !indexadas.some(c => c.nome === n));
        const todasBases = [
          ...indexadas.map(c => ({ nome: c.nome, chunks: c.chunks || c.index_count || 0, indexado: true, indexed_at: c.indexed_at || null })),
          ...naoIndexadas.map(n => ({ nome: n, chunks: 0, indexado: false, indexed_at: null })),
        ];
        const canalAtualAtivo = canalConfigurado || agentStatus.canal_indexado;
        const todosSelecionados = todasBases.every(b => {
          if (b.nome === canalAtualAtivo) return true;
          return (canaisExtras || []).includes(b.nome);
        });
        const toggleTodos = () => {
          if (todosSelecionados) {
            setCanaisExtras?.([]);
          } else {
            setCanaisExtras?.(todasBases.filter(b => b.nome !== canalAtualAtivo).map(b => b.nome));
          }
        };

        return (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col overflow-hidden"
            style={{ background: darkMode ? 'rgba(12,17,34,0.97)' : 'rgba(255,255,255,0.97)' }}>

            {/* Header */}
            <div className={`flex items-center gap-2 px-4 py-3 border-b shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
              <button
                onClick={() => setShowBaseModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
                <ArrowLeft size={14} />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('chat.base_modal_title')}</h3>
                <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t('chat.base_modal_desc')}</p>
              </div>
            </div>

            {/* Barra de ações: marcar tudo + indexar selecionadas */}
            {todasBases.length > 0 && (
              <div className={`flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0 ${darkMode ? 'border-white/8' : 'border-slate-100'}`}>
                <button
                  onClick={toggleTodos}
                  className={`text-[10px] font-bold transition-colors ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                  {todosSelecionados ? t('chat.deselect_all') : t('chat.select_all')}
                </button>
                <button
                  onClick={async () => {
                    setIndexandoBase('__todos__');
                    await onIndexar?.('__todos__').catch?.(() => {});
                    setIndexandoBase(null);
                  }}
                  disabled={!!indexandoBase || agentStatus.indexing}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50
                    ${darkMode ? 'bg-accent/15 text-accent hover:bg-accent/25' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200'}`}>
                  {indexandoBase === '__todos__' || agentStatus.indexing
                    ? <Loader2 size={10} className="animate-spin" />
                    : <RefreshCw size={10} />}
                  {t('chat.reindex_btn')}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {todasBases.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-32 gap-2 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Database size={24} className="opacity-40" />
                  <p className="text-xs">{t('chat.no_base')}</p>
                </div>
              ) : todasBases.map(base => {
                const isAtivo = base.nome === canalAtualAtivo;
                const isExtra = (canaisExtras || []).includes(base.nome);
                const selecionado = isAtivo || isExtra;
                const indexandoEsta = indexandoBase === base.nome || indexandoBase === '__todos__';
                return (
                  <div key={base.nome}
                    onClick={() => {
                      if (isAtivo) return;
                      setCanaisExtras?.(prev =>
                        isExtra ? prev.filter(c => c !== base.nome) : [...prev, base.nome]
                      );
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer
                      ${selecionado
                        ? darkMode ? 'bg-primary/15 border-primary/40' : 'bg-violet-50 border-violet-300'
                        : darkMode ? 'bg-white/4 border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                      ${selecionado
                        ? darkMode ? 'bg-primary/30 text-primary' : 'bg-violet-100 text-violet-700'
                        : darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {(base.nome || '?')[0].toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{base.nome}</p>
                      {base.indexado ? (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>
                            {base.chunks} chunks
                          </span>
                          {base.indexed_at && (
                            <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                              {(() => {
                                const d = new Date(base.indexed_at * 1000);
                                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                              })()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{t('chat.not_indexed')}</p>
                      )}
                    </div>
                    {/* Ações */}
                    <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {base.indexado ? (
                        /* Reindexar */
                        <button
                          onClick={async () => {
                            setIndexandoBase(base.nome);
                            await onIndexar?.(base.nome).catch?.(() => {});
                            setIndexandoBase(null);
                          }}
                          disabled={!!indexandoBase || agentStatus.indexing}
                          title={`Reindexar @${base.nome}`}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40
                            ${darkMode ? 'text-slate-500 hover:text-accent hover:bg-accent/10' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}>
                          {indexandoEsta
                            ? <Loader2 size={11} className="animate-spin text-accent" />
                            : <RefreshCw size={11} />}
                        </button>
                      ) : (
                        /* Indexar */
                        <button
                          onClick={async () => {
                            setIndexandoBase(base.nome);
                            await onIndexar?.(base.nome).catch?.(() => {});
                            setIndexandoBase(null);
                          }}
                          disabled={!!indexandoBase || agentStatus.indexing}
                          className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-colors disabled:opacity-50
                            ${darkMode ? 'bg-accent/15 text-accent hover:bg-accent/25' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}>
                          {indexandoEsta ? <Loader2 size={10} className="animate-spin" /> : t('chat.index_btn')}
                        </button>
                      )}
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0
                        ${selecionado ? 'border-primary bg-primary' : darkMode ? 'border-white/20' : 'border-slate-300'}`}>
                        {selecionado && <span className="text-white text-[8px] font-bold">✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(canaisExtras || []).length > 0 && !agentStatus.indexing && (
              <div className={`px-4 py-2.5 border-t text-[10px] ${darkMode ? 'border-white/10 text-primary/70' : 'border-slate-100 text-violet-500'}`}>
                {t('chat.searching_bases', { count: (canaisExtras || []).length + 1 })}
              </div>
            )}

            {/* Overlay de indexação em andamento */}
            <AnimatePresence>
              {agentStatus.indexing && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
                  className={`absolute inset-x-0 bottom-0 rounded-t-2xl border-t shadow-2xl flex flex-col gap-3 p-4
                    ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
                  style={{ maxHeight: '65%' }}>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative shrink-0">
                      <Zap size={15} className="text-accent" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-ping opacity-75" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('chat.indexing_base_label')}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('chat.wait_no_close')}</p>
                    </div>
                    <Loader2 size={14} className="text-accent animate-spin shrink-0" />
                  </div>
                  <div className={`h-1 rounded-full overflow-hidden shrink-0 ${darkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <motion.div
                      className="h-full w-1/3 rounded-full bg-accent"
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                    />
                  </div>
                  {(agentStatus.index_logs || []).length > 0 && (
                    <div className={`flex-1 overflow-y-auto rounded-xl p-3 space-y-1 min-h-0
                      ${darkMode ? 'bg-black/30' : 'bg-slate-50 border border-slate-100'}`}>
                      {[...(agentStatus.index_logs || [])].reverse().map((log, i) => (
                        <p key={i} className={`text-[10px] font-mono leading-relaxed ${
                          i === 0 ? darkMode ? 'text-accent' : 'text-cyan-700' : darkMode ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          <span className={`mr-1.5 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>{log.timestamp}</span>
                          {log.message}
                        </p>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Snackbar de sucesso */}
            <AnimatePresence>
              {indexSnackbar && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }}
                  className={`absolute bottom-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-bold
                    ${darkMode ? 'bg-secondary/90 text-white' : 'bg-emerald-600 text-white'}`}>
                  <CheckCircle2 size={14} />
                  {indexSnackbar.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })()}
    </AnimatePresence>

    {/* Modal de histórico de conversas */}
    <AnimatePresence>
      {showHistModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex flex-col"
          style={{ background: darkMode ? 'rgba(12,17,34,0.97)' : 'rgba(255,255,255,0.97)' }}>

          {/* Header do modal */}
          <div className={`flex items-center gap-2 px-4 py-3 border-b shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
            <button
              onClick={() => { setShowHistModal(false); setHistSelecionado(null); }}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
              <ArrowLeft size={14} />
            </button>
            <h3 className={`text-sm font-semibold flex-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {histSelecionado ? histSelecionado.titulo : t('chat.history_title')}
            </h3>
            {histSelecionado && (
              <button
                onClick={() => setHistSelecionado(null)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t('chat.back_to_list')}
              </button>
            )}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-4">
            {histSelecionado ? (
              /* Visualização de uma conversa */
              <div className={`text-xs leading-relaxed markdown-body ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}
                  components={{
                    p:      ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                    em:     ({children}) => <em className="italic">{children}</em>,
                    hr:     () => <hr className={`my-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />,
                    code:   ({inline, children}) => inline
                      ? <code className={`px-1 py-0.5 rounded text-[10px] font-mono ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>{children}</code>
                      : <pre className={`p-2 rounded-lg text-[10px] font-mono overflow-x-auto mb-2 ${darkMode ? 'bg-black/30' : 'bg-slate-100'}`}><code>{children}</code></pre>,
                  }}>
                  {histSelecionado.conteudo}
                </ReactMarkdown>
              </div>
            ) : histLoading ? (
              <div className="flex items-center justify-center h-24 gap-2">
                <Loader2 size={14} className={`animate-spin ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('chat.loading')}</span>
              </div>
            ) : historicos.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-32 gap-2 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <History size={24} className="opacity-40" />
                <p className="text-xs">{t('chat.no_history')}</p>
                <p className="text-[10px] opacity-70">{t('chat.no_history_hint')}</p>
              </div>
            ) : (
              /* Lista de conversas */
              <div className="space-y-2">
                {historicos.map((h) => (
                  <button
                    key={h.id}
                    onClick={async () => {
                      const canal_prefixo = (agentStatus?.canal_indexado || canalConfigurado || '').replace(/[<>:"/\\|?*\s]/g, '_').replace(/^_+|_+$/g, '') || '_avulso';
                      setHistLoading(true);
                      try {
                        const r = await lerArquivo(`${canal_prefixo}/textos/${h.nome_txt}`);
                        setHistSelecionado({ titulo: h.titulo, conteudo: r.data.conteudo || '' });
                      } catch { setHistSelecionado({ titulo: h.titulo, conteudo: '(Erro ao carregar conversa)' }); }
                      finally { setHistLoading(false); }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99]
                      ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
                    <div className="flex items-start gap-2">
                      <FileText size={12} className={`mt-0.5 shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{h.titulo}</p>
                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{h.data} · {Math.round((h.chars || 0) / 5)} {t('chat.words_approx')}</p>
                      </div>
                      <ChevronRight size={12} className={`ml-auto shrink-0 mt-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>);

  // Modo expandido: overlay sobre as abas, ocupa todo o container pai
  if (expandido) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('agent.chat_title')}
        onKeyDown={e => { if (e.key === 'Escape') { if (showBuscaModal) setShowBuscaModal(false); else if (showBaseModal) setShowBaseModal(false); else if (showHistModal) setShowHistModal(false); else if (showIndexModal) setShowIndexModal(false); else if (showRepoModal) setShowRepoModal(false); else setExpandido(false); } }}
        className={`absolute inset-0 z-30 flex flex-col overflow-hidden ${darkMode ? 'bg-[#0C1122]' : 'bg-white'}`}>
        {conteudo(() => setExpandido(false))}
      </div>
    );
  }

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
            role="dialog"
            aria-modal="true"
            aria-label={t('agent.chat_title')}
            onKeyDown={e => { if (e.key === 'Escape') { if (showBuscaModal) setShowBuscaModal(false); else if (showBaseModal) setShowBaseModal(false); else if (showHistModal) setShowHistModal(false); else if (showIndexModal) setShowIndexModal(false); else if (showRepoModal) setShowRepoModal(false); else setChatOpen(false); } }}
            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl border-l ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200'}`}>
            {conteudo(() => setChatOpen(false))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ChatDrawer;
