/**
 * @file api.js
 * @description Centralized API service layer for Sebayt backend communication
 * @module services/api
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import axios from 'axios';
import { API_BASE } from '../constants';

// ─── Status ──────────────────────────────────────────────────────────────────

/** Fetches current extraction engine status */
export const fetchStatus = () => axios.get(`${API_BASE}/status`);

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

/** Cancels the running extraction */
export const cancelExtraction = () => axios.post(`${API_BASE}/cancel`);

// ─── Drive ───────────────────────────────────────────────────────────────────

/** Initiates Google Drive OAuth flow */
export const startDriveAuth = () => axios.post(`${API_BASE}/drive-auth`);

/** Cancels ongoing Drive authentication */
export const cancelDriveAuth = () => axios.post(`${API_BASE}/drive-auth-cancel`);

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
export const openFolder = (name) => axios.get(`${API_BASE}/open-folder?name=${name}`);
