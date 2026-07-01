/**
 * @file api.js
 * @description Centralized API service layer for Tusab backend communication
 * @module services/api
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import axios from 'axios';
import { API_BASE } from '../constants';

// Timeout padrão de 15s para todas as chamadas (evita hang silencioso)
axios.defaults.timeout = 15000;

// Interceptor: extrai mensagem legível de qualquer erro axios
export function extrairMensagemErro(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.data?.detail)  return err.response.data.detail;
  if (err?.response?.status === 422) return 'Dados inválidos enviados ao servidor.';
  if (err?.response?.status >= 500)  return 'Erro interno do servidor. Verifique os logs.';
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ERR_NETWORK') return 'Backend offline. Reinicie o Tusab.';
  if (err?.code === 'ECONNABORTED') return 'Servidor demorou demais para responder. Tente novamente.';
  return err?.message || 'Erro desconhecido. Tente novamente.';
}

// ─── Status ──────────────────────────────────────────────────────────────────

/** Fetches current extraction engine status */
export const fetchStatus = () => axios.get(`${API_BASE}/status`);

/** Clears the real-time log panel */
export const clearLog = () => axios.post(`${API_BASE}/log/clear`);

/** Fetches system metrics (RAM, CPU) with history */
export const fetchMetrics = () => axios.get(`${API_BASE}/metrics`);

/** Fetches agent/RAG status */
export const fetchAgentStatus = (canal = '') => axios.get(`${API_BASE}/agent/status${canal ? `?canal=${encodeURIComponent(canal)}` : ''}`);

/** Fetches per-project inventory metrics for the base visibility panel */
export const fetchBaseSummary = () => axios.get(`${API_BASE}/agent/base-summary`);

/** Fetches extraction history (all canals) */
export const fetchHistory = () => axios.get(`${API_BASE}/history`);

/** Fetches repositório content (youtube + docs + textos) */
export const fetchRepositorio = () => axios.get(`${API_BASE}/repositorio`);

/** Fetches per-project chat interaction stats */
export const fetchChatStats = () => axios.get(`${API_BASE}/agent/chat-stats`);

/** Fetches extraction report for a specific canal */
export const fetchRelatorio = (canal) => axios.get(`${API_BASE}/relatorio/${encodeURIComponent(canal)}`);

// ─── Canal ───────────────────────────────────────────────────────────────────

/** Sets the active YouTube channel URL */
export const setChannel = (canal_url, projeto_nome = '') => axios.post(`${API_BASE}/set-channel`, { canal_url, projeto_nome });

/** Removes the currently configured channel */
export const removeChannel = () => axios.post(`${API_BASE}/set-channel`, { canal_url: '' });

/** Fetches channel coverage map (titles + topics) without downloading transcriptions */
export const getCanalInfo = (url) => axios.get(`${API_BASE}/canal-info`, { params: { url } });

// ─── Motor ───────────────────────────────────────────────────────────────────

/** Starts extraction engine with selected content types */
export const startExtraction = (fontes) => axios.post(`${API_BASE}/start`, { fontes });

/** Pauses or resumes the extraction engine */
export const pauseExtraction = () => axios.post(`${API_BASE}/pause`);

/** Cancels the running extraction (also clears the queue) */
export const cancelExtraction = () => axios.post(`${API_BASE}/cancel`);

/** Adds a channel URL to the extraction queue */
export const queueAdd = (canal_url, fontes = [], projeto_nome = '') => axios.post(`${API_BASE}/queue/add`, { canal_url, fontes, projeto_nome });

/** Clears all pending items from the extraction queue */
export const queueClear = () => axios.delete(`${API_BASE}/queue/clear`);

/** Returns current queue contents */
export const fetchQueue = () => axios.get(`${API_BASE}/queue`);

/** Removes a single item from the queue by 0-based index */
export const queueRemoveItem = (index) => axios.delete(`${API_BASE}/queue/item/${index}`);

/** Moves an item in the queue from one index to another */
export const queueMoveItem = (from_index, to_index) => axios.post(`${API_BASE}/queue/move`, { from_index, to_index });

/** Saves auto-update config for a channel */
export const saveAutoUpdateConfig = (canal_prefixo, enabled, frequencia, fontes, canal_url, projeto_prefixo = '') =>
  axios.post(`${API_BASE}/auto-update/config`, { canal_prefixo, projeto_prefixo, enabled, frequencia, fontes, canal_url });

/** Gets auto-update config for a channel */
export const getAutoUpdateConfig = (canal_prefixo, projeto_prefixo = '') => axios.get(`${API_BASE}/auto-update/config/${canal_prefixo}?projeto_prefixo=${projeto_prefixo}`);

/** Triggers an immediate auto-update check for all configured channels */
export const runAutoUpdate = () => axios.post(`${API_BASE}/auto-update/run`);

// ─── Drive ───────────────────────────────────────────────────────────────────

/** Initiates Google Drive OAuth flow */
export const startDriveAuth = () => axios.post(`${API_BASE}/drive-auth`);

/** Cancels ongoing Drive authentication */
export const cancelDriveAuth = () => axios.post(`${API_BASE}/drive-auth-cancel`);

/** Disconnects Google Drive by removing the stored token */
export const disconnectDrive = () => axios.post(`${API_BASE}/drive-disconnect`);

// ─── Busca avançada ───────────────────────────────────────────────────────────

/** Full-text search across all TXT files in the knowledge base */
export const buscarBase = (query, canal = '') =>
  axios.post(`${API_BASE}/neural/buscar`, { query, canal });

/** Pipeline completo BM25+CrossEncoder sem LLM — retorna chunks ranqueados para seleção */
export const buscarTrechos = (query, canais = [], n = 8, buscaAmpla = true) =>
  axios.post(`${API_BASE}/agent/buscar-trechos`, { query, canais, n, busca_ampla: buscaAmpla });

/** Reads the full content of a TXT file by relative path (from NEURAL_DIR) */
export const lerArquivo = (caminho) =>
  axios.post(`${API_BASE}/neural/ler-arquivo`, { caminho });

/** Lists all project subdirectories in the neural */
export const listarProjetos = () => axios.get(`${API_BASE}/neural/projetos`);

/** Creates a new named project subdirectory in the neural */
export const criarProjeto = (nome) => axios.post(`${API_BASE}/neural/projeto`, { nome });

// ─── Agent ───────────────────────────────────────────────────────────────────

/** Saves agent provider configuration */
export const saveAgentConfig = (payload) => axios.post(`${API_BASE}/agent/config`, payload);

/** Loads saved agent configuration */
export const loadAgentConfig = () => axios.get(`${API_BASE}/agent/config`);

/** Tests an API key — pass { provider, api_key } to test inline without saving */
export const testAgentKey = (payload = {}) => axios.post(`${API_BASE}/agent/test-key`, payload);

/** Starts knowledge base indexing */
export const startIndexing = (canal_nome) => axios.post(`${API_BASE}/agent/index`, { canal_nome });

/** Cancels ongoing indexing */
export const cancelIndexing = () => axios.post(`${API_BASE}/agent/index-cancel`);

/** Returns videos without summary per project */
export const fetchSummarizePending = () => axios.get(`${API_BASE}/agent/summarize/pending`);

/** Starts deep summarization for a channel prefix */
export const startSummarize = (canal_prefixo) => axios.post(`${API_BASE}/agent/summarize/${encodeURIComponent(canal_prefixo)}`);

/** Cancels ongoing summarization */
export const cancelSummarize = () => axios.post(`${API_BASE}/agent/summarize/cancel`);

/** Fetches channel metadata */
export const fetchCanalMeta = () => axios.get(`${API_BASE}/agent/canal-meta`);

/** Sends a chat message (streaming) */
export const sendChatStream = (payload) => fetch(`${API_BASE}/agent/chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

/** Clears server-side conversation history for a canal */
export const clearChatHistory = (canal_nome) => axios.post(`${API_BASE}/agent/chat/clear`, { canal_nome, mensagem: '', historico: [], canais_extras: [], busca_ampla: false });

/** Resumes a saved conversation by reloading its messages into server-side context */
export const resumeConversation = (payload) => axios.post(`${API_BASE}/agent/chat/resume`, payload);

/** Saves current chat messages as a .md file in the canal's text repository */
export const salvarHistoricoChat = (canal_nome, mensagens) => axios.post(`${API_BASE}/agent/chat/salvar-historico`, { canal_nome, mensagens });

/** Lists saved chat history files for a canal */
export const listarHistoricosChat = (canal_nome) => axios.get(`${API_BASE}/agent/chat/historicos/${encodeURIComponent(canal_nome)}`);

/** Lists mentionable items (bases + documents) for @ dropdown in chat */
export const fetchMencoes = (canal_nome) => axios.get(`${API_BASE}/agent/mencoes/${encodeURIComponent(canal_nome)}`);

/** Lists individual files inside a project for @@ dropdown in chat */
export const fetchArquivos = (canal_nome) => axios.get(`${API_BASE}/agent/arquivos/${encodeURIComponent(canal_nome)}`);

/** Fetches Ollama service status and installed models */
export const fetchOllamaStatus = () => axios.get(`${API_BASE}/agent/ollama/status`);

/** Triggers Ollama model download — pass model name or omit for default */
export const pullOllamaModel = (model = '') => axios.post(`${API_BASE}/agent/ollama/pull`, model ? { model } : {});

/** Fetches Ollama model download progress */
export const fetchOllamaPullProgress = () => axios.get(`${API_BASE}/agent/ollama/pull-progress`);

/** Deletes a canal index */
export const deleteCanalIndex = (canal_nome) => axios.delete(`${API_BASE}/agent/canal/${encodeURIComponent(canal_nome)}`);

// ─── Repositório ─────────────────────────────────────────────────────────────

/** Uploads a document file to neural/documentos/ */
export const uploadDocument = (formData) => axios.post(`${API_BASE}/neural/upload`, formData);

/** Saves pasted text to neural/textos/ */
export const saveText = (titulo, conteudo, canal = '') => axios.post(`${API_BASE}/neural/texto`, { titulo, conteudo, canal });

/** Deletes a document or text from the neural */
export const deleteRepositorioItem = (tipo, id) => axios.delete(`${API_BASE}/neural/arquivo/${tipo}/${id}`);

/** Clears selected content types from the entire knowledge base */
export const limparBase = (payload) => axios.delete(`${API_BASE}/neural/limpar`, { data: payload });

/** Removes extraction history for selected canal prefixes (empty = all) */
export const limparHistorico = (prefixos = []) => axios.delete(`${API_BASE}/historico/limpar`, { data: { prefixos } });

/** Full reset: wipes cerebro, gestao CSVs, BM25 indexes and chat history */
export const resetTotal = () => axios.delete(`${API_BASE}/reset-total`);

/** Deletes cerebro files + BM25 index for a single canal */
export const limparCanal = (canal_nome) => Promise.all([
  axios.delete(`${API_BASE}/neural/limpar`, { data: { youtube: true, documentos: true, textos: true, canal: canal_nome } }),
  axios.delete(`${API_BASE}/agent/canal/${encodeURIComponent(canal_nome)}`),
  axios.delete(`${API_BASE}/historico/limpar`, { data: { prefixos: [canal_nome.replace(/[<>:"/\\|?*\s]/g, '_').replace(/^_+|_+$/g, '')] } }),
]);

// ─── Base Compartilhável ─────────────────────────────────────────────────────

/** Exports a project as a .tusab file (returns blob URL for download) */
export const exportarBaseCompartilhavel = (projeto) =>
  axios.get(`${API_BASE}/export/base-compartilhavel/${encodeURIComponent(projeto)}`, {
    responseType: 'blob',
    timeout: 60000,
  });

/** Returns { projeto: bool } map of which projects are readonly */
export const fetchReadonlyStatus = () => axios.get(`${API_BASE}/export/readonly-status`);

/** Imports a .tusab file into the local data folder */
export const importarBaseCompartilhavel = (arquivo) => {
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  return axios.post(`${API_BASE}/import/base-compartilhavel`, fd, { timeout: 60000 });
};

// ─── System ──────────────────────────────────────────────────────────────────

/** Opens a local folder in Windows Explorer */
export const openFolder = (name, prefixo = '') =>
  axios.get(`${API_BASE}/open-folder?name=${name}${prefixo ? `&prefixo=${prefixo}` : ''}`);

// ─── Exports (Pro) ────────────────────────────────────────────────────────────

/** Downloads the full knowledge base as a ZIP file */
export const exportBase = () =>
  fetch(`${API_BASE}/export/base`, { method: 'POST' });

/** Downloads chat history for a canal as Markdown */
export const exportHistorico = (canal_nome = '') =>
  fetch(`${API_BASE}/export/historico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome }),
  });

// ─── Modo Estudo ──────────────────────────────────────────────────────────────

/** Gera flashcards e/ou resumo para um canal a partir do índice BM25 */
export const gerarEstudo = (data) => axios.post(`${API_BASE}/agent/study`, data, { timeout: 300000 });

/** Busca flashcards e resumo salvos para um canal */
export const fetchEstudo = (canal) => axios.get(`${API_BASE}/agent/study/${encodeURIComponent(canal)}`);

/** Lista históricos auto-salvos em _chat_history/ (fora do corpus BM25) */
export const listarHistoricosSalvos = (canal) => axios.get(`${API_BASE}/agent/chat/historicos-salvos/${encodeURIComponent(canal)}`);

/** Move um histórico de _chat_history/ para texts/ — torna-o indexável */
export const injetarHistorico = (canal_nome, hist_id) => axios.post(`${API_BASE}/agent/chat/injetar-historico`, { canal_nome, hist_id });

export const enviarFeedback = (canal_nome, pergunta, resposta, util) =>
  axios.post(`${API_BASE}/agent/feedback`, { canal_nome, pergunta, resposta, util });

/** Exporta flashcards como CSV compatível com Anki (frente;verso) */
export const exportFlashcardsAnki = (canal) => fetch(`${API_BASE}/export/flashcards/${encodeURIComponent(canal)}`);

/** Downloads canal summary as Word .docx — sends frontend messages to avoid empty server-side history */
export const exportResumoCanalDocx = (canal_nome, mensagens = []) =>
  fetch(`${API_BASE}/export/resumo-canal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome, mensagens }),
  });

/** Downloads video table as Excel .xlsx */
export const exportTabelaVideosXlsx = (canal) =>
  fetch(`${API_BASE}/export/tabela-videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal }),
  });

/** Downloads research report as PDF — sends frontend messages to avoid empty server-side history */
export const exportRelatorioPdf = (canal_nome, mensagens = []) =>
  fetch(`${API_BASE}/export/relatorio-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome, mensagens }),
  });
