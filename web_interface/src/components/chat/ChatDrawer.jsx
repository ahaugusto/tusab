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
import { Sparkles, X, Bot, Loader2, ExternalLink, Send, Database, ChevronRight, RefreshCw, Zap, ChevronDown, Maximize2, Minimize2, History, PlusCircle, ArrowLeft, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { salvarHistoricoChat, listarHistoricosChat, clearChatHistory, lerArquivo } from '../../services/api';

// ─── Loading phrases ─────────────────────────────────────────────────────────

const LOADING_PHRASES = [
  // Thoth / Tusab
  'Tusab vem de "Thoth" — deus egípcio da sabedoria, escrita e conhecimento.',
  'Thoth era o escriba dos deuses. O Tusab é o seu escriba pessoal.',
  'Os egípcios acreditavam que Thoth inventou a escrita para preservar o saber eterno.',
  'Thoth era representado com cabeça de íbis — pássaro conhecido por sua memória e precisão.',
  'O nome hieroglífico de Thoth é "Djehuti". Tusab é sua reencarnação digital.',
  'Thoth era o guardião dos Registros Akáshicos — o Tusab guarda os seus.',
  'Segundo os egípcios, Thoth escreveu 42 livros com todo o conhecimento do universo.',
  'Na mitologia egípcia, Thoth pesava a alma dos mortos com a pena de Maat. Aqui pesamos suas perguntas com BM25.',
  // Hidratação / pausa
  'Já se hidratou hoje? Vai lá tomar uma água, eu fico aqui pensando.',
  'Aproveitando que você vai esperar, levanta e espreguiça. Coluna agradece.',
  'Que tal respirar fundo três vezes enquanto eu trabalho?',
  'Este é um bom momento para tomar aquele cafezinho que você estava adiando.',
  'Dica de produtividade: pausas curtas aumentam o foco. Você está fazendo uma agora.',
  // IA / RAG
  'O RAG não alucina achismos — ele só responde com o que está na sua base.',
  'Com RAG, a IA lê seus documentos antes de responder. Sem chute, sem invenção.',
  'A diferença entre IA genérica e RAG: um fala sobre o mundo, o outro fala sobre o seu mundo.',
  'Seu conhecimento privado + poder do LLM = RAG. É exatamente isso que está acontecendo agora.',
  'RAG significa Retrieval-Augmented Generation — busca primeiro, gera depois.',
  'Nenhum dado seu sai daqui. A busca é local, a resposta é sua.',
  'Enquanto modelos genéricos treinam em bilhões de páginas, o Tusab foca só no que você escolheu.',
  'A IA mais útil não é a que sabe mais — é a que sabe o que é relevante pra você.',
];

function useLoadingPhrase(active) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LOADING_PHRASES.length));
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setIdx(i => (i + 1) % LOADING_PHRASES.length);
    }, 3000);
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
  onIndexar,
}) {
  const { t } = useTranslation();
  const [showRepoModal,     setShowRepoModal]     = useState(false);
  const [showIndexModal,    setShowIndexModal]    = useState(false);
  const [indexSel,          setIndexSel]          = useState(null);
  const [showHistModal,     setShowHistModal]     = useState(false);
  const [historicos,        setHistoricos]        = useState([]);
  const [histLoading,       setHistLoading]       = useState(false);
  const [histSelecionado,   setHistSelecionado]   = useState(null); // { titulo, conteudo }
  const [salvando,          setSalvando]          = useState(false);
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

  const loadingPhrase = useLoadingPhrase(chatLoading);
  const canaisIndexados = agentStatus.canais_indexados || [];
  const temBase = agentStatus.indexed || canaisIndexados.length > 0;
  const canalAtivo = canalConfigurado || agentStatus.canal_indexado;
  const chatHabilitado = temBase && !!canalAtivo;

  // Conteúdo interno compartilhado entre drawer e modo expandido
  const conteudo = (onFechar) => (<>
    {/* Header */}
    <div className={`px-4 py-3.5 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
      <Sparkles size={15} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('agent.chat_title')}</p>
        {agentStatus.indexed && (
          <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{canalConfigurado || agentStatus.canal_indexado}</p>
        )}
      </div>
      {/* Busca Ampla toggle */}
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
        <div className={`absolute top-full mt-2 right-0 w-56 p-2.5 rounded-xl border text-[10px] leading-relaxed shadow-xl
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-10
          ${darkMode ? 'bg-[#0C1122] border-white/20 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/60'}`}>
          {buscaAmpla
            ? <><strong className={darkMode ? 'text-accent' : 'text-cyan-600'}>Busca Ampla ativada</strong><br/>Usa sua base como referência principal e complementa com o conhecimento geral do modelo quando necessário.</>
            : <><strong className={darkMode ? 'text-white' : 'text-slate-800'}>Busca Restrita</strong><br/>Responde exclusivamente com o conteúdo da sua base. Se não encontrar, diz que não encontrou.</>}
        </div>
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
          aria-label={expandido ? 'Recolher chat' : 'Expandir chat'}>
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
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('agent.chat_empty_no_index')}
                      </p>
                      {onIndexar && (
                        <button
                          onClick={() => { setIndexSel(null); setShowIndexModal(true); }}
                          className={`mt-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                            bg-accent/20 text-accent hover:bg-accent/30`}>
                          <Zap size={13} aria-hidden="true" />
                          Indexar base
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
                                Selecionar base para indexar
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
                                  <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Todos os canais extraídos</p>
                                  <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Indexa cada canal em sequência</p>
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
                              {agentStatus.indexing ? 'Indexando…' : 'Confirmar e Indexar'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : !canalAtivo || showRepoModal ? (
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
                              <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{canal.chunks} {t('chat.chunks_indexed')}</p>
                            </div>
                            <ChevronRight size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                      <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
                            Pergunte sobre
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
                            ? 'bg-primary/20 border border-primary/30 text-primary rounded-br-sm'
                            : 'bg-primary/15 border border-primary/20 text-primary rounded-br-sm'
                          : msg.role === 'error'
                            ? (darkMode ? 'bg-danger/15 border border-danger/30 text-danger' : 'bg-red-50 text-red-700 border border-red-200')
                            : (darkMode ? 'bg-white/8 border border-white/10 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm')} rounded-bl-sm`}>
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
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={!chatHabilitado ? t('agent.chat_placeholder_disabled') : t('agent.chat_placeholder_ready')}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
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

      {/* Barra de ações abaixo do input */}
      <div className="flex items-center gap-2 mt-2 px-0.5">
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
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/8' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          aria-label="Nova conversa">
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
          <span>Nova conversa</span>
        </button>

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
          aria-label="Histórico de conversas">
          <History size={12} />
          <span>Histórico</span>
        </button>
      </div>
    </div>

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
              {histSelecionado ? histSelecionado.titulo : 'Histórico de conversas'}
            </h3>
            {histSelecionado && (
              <button
                onClick={() => setHistSelecionado(null)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
                Voltar à lista
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
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Carregando...</span>
              </div>
            ) : historicos.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-32 gap-2 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <History size={24} className="opacity-40" />
                <p className="text-xs">Nenhuma conversa salva ainda.</p>
                <p className="text-[10px] opacity-70">Clique em "Nova conversa" para salvar a atual.</p>
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
                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{h.data} · {Math.round((h.chars || 0) / 5)} palavras aprox.</p>
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
        onKeyDown={e => { if (e.key === 'Escape') { if (showHistModal) setShowHistModal(false); else if (showIndexModal) setShowIndexModal(false); else if (showRepoModal) setShowRepoModal(false); else setExpandido(false); } }}
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
            onKeyDown={e => { if (e.key === 'Escape') { if (showIndexModal) setShowIndexModal(false); else if (showRepoModal) setShowRepoModal(false); else setChatOpen(false); } }}
            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl border-l ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200'}`}>
            {conteudo(() => setChatOpen(false))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ChatDrawer;
