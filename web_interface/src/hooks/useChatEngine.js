/**
 * @file useChatEngine.js
 * @description Custom hook that encapsulates all chat/RAG state and handlers
 * @module hooks/useChatEngine
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Analytics } from '../services/analytics';
import { sendChatStream, resumeConversation } from '../services/api';
import { useChatHistory } from './useChatHistory';

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useChatEngine — manages chat state, export detection, and streaming RAG chat
 *
 * @param {Object} opts
 * @param {string}   opts.agentProvider        - active LLM provider ('ollama' | 'gemini' | ...)
 * @param {Object}   opts.agentStatus          - agent status object (canal_indexado, primeiro_uso, ...)
 * @param {Object}   opts.ollamaStatus         - { running: boolean, models: string[] }
 * @param {string}   opts.canalConfigurado     - currently configured YouTube canal name
 * @param {string[]} opts.canaisExtras         - extra canais for multi-canal search
 * @param {boolean}  opts.useExternalProvider  - whether a cloud provider is active
 * @param {Function} opts.showError            - App-level error display (message: string) => void
 * @param {Object}   [opts.exportFns]          - optional export functions: { docx, xlsx, pdf, historico }
 * @param {Function} [opts.onPrimeiraFonte]    - callback disparado na primeira resposta com fontes reais
 * @returns {Object} chat state and handlers
 */
export function useChatEngine({
  agentProvider,
  agentStatus,
  ollamaStatus,
  canalConfigurado,
  canaisExtras,
  useExternalProvider,
  showError,
  exportFns = {},
  onPrimeiraFonte,
  perfil = '',
  chatOpenRef,
}) {
  const { t } = useTranslation();

  // ─── Histórico persistido ──────────────────────────────────────────────────
  const history = useChatHistory();

  // ─── State ─────────────────────────────────────────────────────────────────
  const [chatOpen,        setChatOpen]        = useState(false);
  const [chatExpandido,   setChatExpandido]   = useState(false);
  const [buscaAmpla,      setBuscaAmpla]      = useState(false);
  const [chatMessages,    setChatMessages]    = useState([]);
  const [chatInput,       setChatInput]       = useState('');
  const [chatLoading,     setChatLoading]     = useState(false);
  const [fontesFixadas,   setFontesFixadas]   = useState([]);
  // Fila de mensagens pendentes enquanto uma resposta está em andamento (max 5)
  const [chatQueue,       setChatQueue]       = useState([]);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const chatEndRef            = useRef(null);
  const fonteSnackbarMostrado = useRef(false);
  // id da conversa ativa — criado ao enviar a primeira mensagem
  const convIdRef             = useRef(null);
  // ref espelho de chatQueue para uso dentro de closures async
  const chatQueueRef          = useRef([]);

  // ─── Effects ───────────────────────────────────────────────────────────────

  /** Scrolls chat to the latest message */
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /** Auto-save: persiste após cada resposta completa (não durante streaming) */
  useEffect(() => {
    const canal = canalConfigurado || agentStatus?.canal_indexado || '';
    const hasFinished = chatMessages.length > 0 && !chatMessages.some(m => m.streaming);
    if (!hasFinished || chatMessages.length === 0) return;
    if (!convIdRef.current) convIdRef.current = history.startNew(canal);
    history.saveMessages(convIdRef.current, chatMessages, canal);
  }, [chatMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Mantém chatQueueRef sincronizado com chatQueue para closures async */
  useEffect(() => {
    chatQueueRef.current = chatQueue;
  }, [chatQueue]);

  /** Consome próximo item da fila quando a resposta atual termina */
  useEffect(() => {
    if (chatLoading) return;
    if (chatQueueRef.current.length === 0) return;
    const [proxima, ...resto] = chatQueueRef.current;
    setChatQueue(resto);
    chatQueueRef.current = resto;
    // Remove o balão "queued" da proxima mensagem e dispara o envio
    setChatMessages(prev => prev.map(m =>
      m.role === 'queued' && m.content === proxima ? { ...m, role: 'user', queued: false } : m
    ));
    _executarEnvio(proxima);
  }, [chatLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /** Detecta intenção de export na mensagem do usuário */
  const detectarIntencaoExport = (msg) => {
    const m = msg.toLowerCase();
    const isDocx = /word|docx|documento|resumo.*canal|canal.*resumo|summary/.test(m);
    const isXlsx = /excel|xlsx|planilha|tabela.*v[ií]deo|v[ií]deo.*tabela|spreadsheet/.test(m);
    const isPdf  = /pdf|relat[oó]rio.*pdf|pdf.*relat[oó]rio/.test(m);
    const isHist = /hist[oó]rico.*chat|chat.*hist[oó]rico|conversa.*export|export.*conversa|markdown/.test(m);
    const hasVerb = /ger[ae]|export[ae]|cri[ae]|baixe?|download|salv[ae]/.test(m);
    if (!hasVerb) return null;
    if (isDocx) return 'docx';
    if (isXlsx) return 'xlsx';
    if (isPdf)  return 'pdf';
    if (isHist) return 'historico';
    return null;
  };

  /** Executa export e injeta mensagem com link de download no chat.
   *  Requer que as funções de export sejam passadas via exportFns (feature Pro). */
  const handleExportDoChat = async (tipo, canal, msgUsuario) => {
    const fn = exportFns[tipo];
    if (!fn) {
      setChatMessages(prev => [...prev,
        { role: 'user',  content: msgUsuario },
        { role: 'error', content: 'Exportação não disponível nesta versão.' },
      ]);
      return;
    }
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msgUsuario }]);
    setChatLoading(true);
    try {
      const labels = {
        docx:      'Resumo do canal (.docx)',
        xlsx:      'Tabela de vídeos (.xlsx)',
        pdf:       'Relatório (.pdf)',
        historico: 'Histórico do chat (.md)',
      };
      const exts = { docx: 'docx', xlsx: 'xlsx', pdf: 'pdf', historico: 'md' };
      const res  = await fn(canal);
      if (!res.ok) throw new Error('Falha ao gerar arquivo');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setChatMessages(prev => [...prev, {
        role:        'export',
        content:     `Aqui está o arquivo gerado para **@${canal}**:`,
        exportLabel: labels[tipo],
        exportUrl:   url,
        exportExt:   exts[tipo],
        exportCanal: canal,
      }]);
    } catch {
      setChatMessages(prev => [...prev, {
        role:    'error',
        content: 'Não foi possível gerar o arquivo. Verifique se o canal está indexado e com histórico.',
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  /** Núcleo do envio — executa a chamada de streaming para uma mensagem já confirmada */
  const _executarEnvio = async (msg) => {
    Analytics.chatPergunta(buscaAmpla ? 'ampla' : 'restrita', useExternalProvider ? agentProvider : 'ollama');
    // ID único para este stream — evita que atualizações usem msgs.length-1 e peguem
    // mensagens queued ou de outros streams quando há fila de mensagens.
    const streamId = `stream_${Date.now()}_${Math.random()}`;
    setChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', fontes: [], streaming: true, _streamId: streamId }]);

    try {
      const idsFixados = fontesFixadas.map(f => f.id);
      setFontesFixadas([]);
      const response = await sendChatStream({
        mensagem:       msg,
        canal_nome:     canalConfigurado || agentStatus.canal_indexado,
        canais_extras:  canaisExtras,
        busca_ampla:    buscaAmpla,
        fontes_fixadas: idsFixados,
        perfil:         perfil,
      });

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              const isModeloLento = /timeout|timed out|read timeout|connection.*reset|model.*load/i.test(parsed.error);
              setChatMessages(prev => prev.map(m =>
                m._streamId === streamId ? { role: 'error', content: parsed.error, modelo_lento: isModeloLento } : m
              ));
            } else if (parsed.fontes !== undefined) {
              const fontes = parsed.fontes;
              const semCtx = !!parsed.sem_contexto;
              setChatMessages(prev => prev.map(m =>
                m._streamId === streamId ? { ...m, fontes, sem_contexto: semCtx } : m
              ));
              if (fontes.length > 0 && agentStatus.primeiro_uso) {
                const minutos = Math.round((Date.now() / 1000 - agentStatus.primeiro_uso) / 60);
                Analytics.primeiraRespostaUtil(minutos, useExternalProvider ? agentProvider : 'ollama');
              }
              if (fontes.length > 0 && !fonteSnackbarMostrado.current && onPrimeiraFonte) {
                fonteSnackbarMostrado.current = true;
                onPrimeiraFonte();
              }
            } else if (parsed.done) {
              setChatMessages(prev => prev.map(m =>
                m._streamId === streamId ? { ...m, streaming: false } : m
              ));
              // Notificação desktop quando o chat está fechado/minimizado
              if (chatOpenRef && !chatOpenRef.current && Notification.permission === 'granted') {
                const canal = canalConfigurado || agentStatus?.canal_indexado || '';
                new Notification(t('notify.chat_done_title'), {
                  body: canal ? t('notify.chat_done_body_canal', { canal }) : t('notify.chat_done_body'),
                  icon: '/logo_light_mode.svg',
                });
              }
            }
          } catch {
            setChatMessages(prev => prev.map(m =>
              m._streamId === streamId ? { ...m, content: (m.content || '') + line } : m
            ));
          }
        }
      }
    } catch (err) {
      const msg = err?.message || '';
      const isModeloLento = /timeout|timed out/i.test(msg);
      setChatMessages(prev => prev.map(m =>
        m._streamId === streamId ? { role: 'error', content: 'Erro ao conectar com o servidor.', modelo_lento: isModeloLento } : m
      ));
    }
    setChatLoading(false);
  };

  const QUEUE_LIMIT = 5;

  /** Envia a mensagem atual ou enfileira se já há uma resposta em andamento */
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg) return;

    // Detecta intenção de export antes de ir ao LLM
    const canal = canalConfigurado || agentStatus.canal_indexado;
    const intencao = detectarIntencaoExport(msg);
    if (intencao && canal) {
      handleExportDoChat(intencao, canal, msg);
      return;
    }

    if (agentProvider === 'ollama' && !ollamaStatus.running) {
      setChatInput('');
      setChatMessages(prev => [...prev,
        { role: 'user',  content: msg },
        { role: 'error', content: t('agent.ollama_offline') },
      ]);
      return;
    }

    // Se há resposta em andamento: enfileira (balão "queued" já aparece no histórico)
    if (chatLoading) {
      if (chatQueueRef.current.length >= QUEUE_LIMIT) return; // fila cheia — não limpa input, usuário vê o que digitou
      setChatInput('');
      const novaFila = [...chatQueueRef.current, msg];
      chatQueueRef.current = novaFila;
      setChatQueue(novaFila);
      setChatMessages(prev => [...prev, { role: 'queued', content: msg }]);
      return;
    }

    // Caminho normal: envia imediatamente
    setChatInput('');
    const anexos = fontesFixadas.length > 0 ? [...fontesFixadas] : undefined;
    setChatMessages(prev => [...prev, { role: 'user', content: msg, anexos }]);
    await _executarEnvio(msg);
  };

  /**
   * Retoma uma conversa salva: repopula o chat visualmente e reenvia contexto ao servidor.
   * @param {Object} conv — objeto de conversa do useChatHistory
   */
  const retomar = useCallback(async (conv) => {
    convIdRef.current = conv.id;
    history.setActiveId(conv.id);
    // Restaura mensagens no chat visual
    setChatMessages(conv.messages.map(m => ({ ...m, streaming: false })));
    setChatOpen(true);
    // Reenvia últimas N mensagens ao servidor para restaurar contexto do LLM
    const canal = conv.canalNome || agentStatus?.canal_indexado || canalConfigurado || '';
    if (canal && conv.messages.length > 0) {
      try {
        const ultimas = conv.messages.slice(-6); // últimas 3 trocas (6 mensagens)
        await resumeConversation({ canal_nome: canal, historico: ultimas.map(m => ({ role: m.role, content: m.content })) });
      } catch { /* servidor pode estar offline — chat visual ainda funciona */ }
    }
  }, [agentStatus, canalConfigurado, history]);

  /** Inicia uma nova conversa (descarta contexto ativo) */
  const novaConversa = useCallback(() => {
    convIdRef.current = null;
    history.setActiveId(null);
    setChatMessages([]);
    setChatInput('');
  }, [history]);

  // ─── Return ────────────────────────────────────────────────────────────────
  return {
    chatOpen,
    setChatOpen,
    chatExpandido,
    setChatExpandido,
    buscaAmpla,
    setBuscaAmpla,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    setChatLoading,
    chatEndRef,
    fontesFixadas,
    setFontesFixadas,
    chatQueue,
    detectarIntencaoExport,
    handleExportDoChat,
    handleChatSend,
    // histórico
    chatHistory:  history,
    retomar,
    novaConversa,
    convId: convIdRef,
  };
}
