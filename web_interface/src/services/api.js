/**
 * @file api.js
 * @description Centralized API service layer for Tusab backend communication
 * @module services/api
 * @author CriAugu <augusto.brasil@saude.gov.br>
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

/** Fetches system metrics (RAM, CPU) with history */
export const fetchMetrics = () => axios.get(`${API_BASE}/metrics`);

/** Fetches agent/RAG status */
export const fetchAgentStatus = () => axios.get(`${API_BASE}/agent/status`);

/** Fetches extraction history (all canals) */
export const fetchHistory = () => axios.get(`${API_BASE}/history`);

/** Fetches repositório content (youtube + docs + textos) */
export const fetchRepositorio = () => axios.get(`${API_BASE}/repositorio`);

/** Fetches extraction report for a specific canal */
export const fetchRelatorio = (canal) => axios.get(`${API_BASE}/relatorio/${encodeURIComponent(canal)}`);

// ─── Canal ───────────────────────────────────────────────────────────────────

/** Sets the active YouTube channel URL */
export const setChannel = (canal_url) => axios.post(`${API_BASE}/set-channel`, { canal_url });

/** Removes the currently configured channel */
export const removeChannel = () => axios.post(`${API_BASE}/set-channel`, { canal_url: '' });

// ─── Motor ───────────────────────────────────────────────────────────────────

/** Starts extraction engine with selected content types */
export const startExtraction = (fontes) => axios.post(`${API_BASE}/start`, { fontes });

/** Pauses or resumes the extraction engine */
export const pauseExtraction = () => axios.post(`${API_BASE}/pause`);

/** Cancels the running extraction (also clears the queue) */
export const cancelExtraction = () => axios.post(`${API_BASE}/cancel`);

/** Adds a channel URL to the extraction queue */
export const queueAdd = (canal_url, fontes = []) => axios.post(`${API_BASE}/queue/add`, { canal_url, fontes });

/** Clears all pending items from the extraction queue */
export const queueClear = () => axios.delete(`${API_BASE}/queue/clear`);

/** Returns current queue contents */
export const fetchQueue = () => axios.get(`${API_BASE}/queue`);

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
  axios.post(`${API_BASE}/cerebro/buscar`, { query, canal });

/** Reads the full content of a TXT file by relative path (from CEREBRO_DIR) */
export const lerArquivo = (caminho) =>
  axios.post(`${API_BASE}/cerebro/ler-arquivo`, { caminho });

/** Lists all project subdirectories in the cerebro */
export const listarProjetos = () => axios.get(`${API_BASE}/cerebro/projetos`);

/** Creates a new named project subdirectory in the cerebro */
export const criarProjeto = (nome) => axios.post(`${API_BASE}/cerebro/projeto`, { nome });

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

/** Saves current chat messages as a .md file in the canal's text repository */
export const salvarHistoricoChat = (canal_nome, mensagens) => axios.post(`${API_BASE}/agent/chat/salvar-historico`, { canal_nome, mensagens });

/** Lists saved chat history files for a canal */
export const listarHistoricosChat = (canal_nome) => axios.get(`${API_BASE}/agent/chat/historicos/${encodeURIComponent(canal_nome)}`);

/** Lists mentionable items (bases + documents) for @ dropdown in chat */
export const fetchMencoes = (canal_nome) => axios.get(`${API_BASE}/agent/mencoes/${encodeURIComponent(canal_nome)}`);

/** Fetches Ollama service status and installed models */
export const fetchOllamaStatus = () => axios.get(`${API_BASE}/agent/ollama/status`);

/** Triggers Ollama model download */
export const pullOllamaModel = () => axios.post(`${API_BASE}/agent/ollama/pull`);

/** Fetches Ollama model download progress */
export const fetchOllamaPullProgress = () => axios.get(`${API_BASE}/agent/ollama/pull-progress`);

/** Deletes a canal index */
export const deleteCanalIndex = (canal_nome) => axios.delete(`${API_BASE}/agent/canal/${encodeURIComponent(canal_nome)}`);

// ─── Repositório ─────────────────────────────────────────────────────────────

/** Uploads a document file to cerebro/documentos/ */
export const uploadDocument = (formData) => axios.post(`${API_BASE}/cerebro/upload`, formData);

/** Saves pasted text to cerebro/textos/ */
export const saveText = (titulo, conteudo, canal = '') => axios.post(`${API_BASE}/cerebro/texto`, { titulo, conteudo, canal });

/** Deletes a document or text from the cerebro */
export const deleteRepositorioItem = (tipo, id) => axios.delete(`${API_BASE}/cerebro/arquivo/${tipo}/${id}`);

/** Clears selected content types from the entire knowledge base */
export const limparBase = (payload) => axios.delete(`${API_BASE}/cerebro/limpar`, { data: payload });

/** Removes extraction history for selected canal prefixes (empty = all) */
export const limparHistorico = (prefixos = []) => axios.delete(`${API_BASE}/historico/limpar`, { data: { prefixos } });

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

/** Downloads canal summary as Word .docx */
export const exportResumoCanalDocx = (canal_nome) =>
  fetch(`${API_BASE}/export/resumo-canal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome }),
  });

/** Downloads video table as Excel .xlsx */
export const exportTabelaVideosXlsx = (canal) =>
  fetch(`${API_BASE}/export/tabela-videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal }),
  });

/** Downloads research report as PDF */
export const exportRelatorioPdf = (canal_nome) =>
  fetch(`${API_BASE}/export/relatorio-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome }),
  });
