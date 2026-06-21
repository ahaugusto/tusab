/**
 * @file useChatEngine.js
 * @description Custom hook that encapsulates all chat/RAG state and handlers
 * @module hooks/useChatEngine
 * @author CriAugu <augusto.brasil@saude.gov.br>
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

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const chatEndRef            = useRef(null);
  const fonteSnackbarMostrado = useRef(false);
  // id da conversa ativa — criado ao enviar a primeira mensagem
  const convIdRef             = useRef(null);

  // ─── Effects ───────────────────────────────────────────────────────────────

  /** Scrolls chat to the latest message */
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /** Auto-save: persiste após cada resposta completa (não durante streaming) */
  useEffect(() => {
    const canal = agentStatus?.canal_indexado || canalConfigurado || '';
    const hasFinished = chatMessages.length > 0 && !chatMessages.some(m => m.streaming);
    if (!hasFinished || chatMessages.length === 0) return;
    if (!convIdRef.current) convIdRef.current = history.startNew(canal);
    history.saveMessages(convIdRef.current, chatMessages, canal);
  }, [chatMessages]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Sends the current chat message using server-sent streaming */
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    // Detecta intenção de export antes de ir ao LLM
    const canal = agentStatus.canal_indexado || canalConfigurado;
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

    setChatInput('');
    Analytics.chatPergunta(buscaAmpla ? 'ampla' : 'restrita', useExternalProvider ? agentProvider : 'ollama');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', fontes: [], streaming: true }]);

    try {
      const idsFixados = fontesFixadas.map(f => f.id);
      setFontesFixadas([]);
      const response = await sendChatStream({
        mensagem:       msg,
        canal_nome:     agentStatus.canal_indexado || canalConfigurado,
        canais_extras:  canaisExtras,
        busca_ampla:    buscaAmpla,
        fontes_fixadas: idsFixados,
        perfil:         perfil,
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
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: 'error', content: parsed.error };
                return msgs;
              });
            } else if (parsed.fontes !== undefined) {
              fontes = parsed.fontes;
              const semCtx = !!parsed.sem_contexto;
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], fontes, sem_contexto: semCtx };
                return msgs;
              });
              // A2 — KPI: primeira resposta com fontes reais (não erro, não vazia)
              if (fontes.length > 0 && agentStatus.primeiro_uso) {
                const minutos = Math.round((Date.now() / 1000 - agentStatus.primeiro_uso) / 60);
                Analytics.primeiraRespostaUtil(minutos, useExternalProvider ? agentProvider : 'ollama');
              }
              // Snackbar educativo: mostra uma vez por sessão na primeira resposta com fontes
              if (fontes.length > 0 && !fonteSnackbarMostrado.current && onPrimeiraFonte) {
                fonteSnackbarMostrado.current = true;
                onPrimeiraFonte();
              }
            } else if (parsed.done) {
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false };
                return msgs;
              });
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
      setChatMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: 'error', content: 'Erro ao conectar com o servidor.' };
        return msgs;
      });
    }
    setChatLoading(false);
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
