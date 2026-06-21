/**
 * @file useChatHistory.js
 * @description Persistência de histórico de conversas de chat em localStorage (JSON estruturado)
 *   - Cada conversa é um objeto com id, canal, título, timestamps e array de mensagens
 *   - Auto-save ao enviar mensagem; auto-título derivado da primeira pergunta
 *   - Máximo de 100 conversas (FIFO sobre as mais antigas não-favoritadas)
 *   - Estrutura compatível com MCP resource future
 * @module hooks/useChatHistory
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useCallback, useRef } from 'react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'tusab_chat_history_v1';
const MAX_CONVS    = 100;
const TITLE_LEN    = 60;

// ─── Helpers de storage ───────────────────────────────────────────────────────

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(convs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    // quota exceeded — descarta a mais antiga não-favoritada
    const pruned = convs.filter(c => !c.favorito).slice(1);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...pruned, ...convs.filter(c => c.favorito)])); } catch {}
  }
}

function genId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function deriveTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser?.content) return 'Conversa';
  const clean = firstUser.content.replace(/\s+/g, ' ').trim();
  return clean.length > TITLE_LEN ? clean.slice(0, TITLE_LEN - 1) + '…' : clean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useChatHistory — gerencia conversas de chat persistidas em localStorage
 *
 * @returns {Object}
 *   conversations   - todas as conversas (ordenadas por updatedAt desc)
 *   activeId        - id da conversa ativa (ou null)
 *   startNew        - () => id  — cria nova conversa e retorna id
 *   saveMessages    - (id, messages, canalNome) => void  — persiste mensagens
 *   loadConversation - (id) => conversation | null
 *   deleteConversation - (id) => void
 *   toggleFavorito  - (id) => void
 *   renameConversation - (id, titulo) => void
 *   setActiveId     - (id | null) => void
 *   recent          - últimas 10 conversas (para acesso rápido)
 */
export function useChatHistory() {
  const [conversations, setConversations] = useState(() =>
    loadAll().sort((a, b) => b.updatedAt - a.updatedAt)
  );
  const [activeId, setActiveId] = useState(null);
  // Ref para evitar re-render em cada keystroke do auto-save
  const pendingRef = useRef(null);

  const _refresh = useCallback(() => {
    setConversations(loadAll().sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  /** Cria uma nova conversa vazia e retorna o id */
  const startNew = useCallback((canalNome = '') => {
    const id = genId();
    const conv = {
      id,
      canalNome,
      titulo:    'Nova conversa',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorito:  false,
      messages:  [],
    };
    const all = loadAll();
    // Enforce MAX_CONVS: descarta mais antigas não-favoritadas
    let trimmed = [conv, ...all];
    if (trimmed.length > MAX_CONVS) {
      const favoritos   = trimmed.filter(c => c.favorito);
      const normais     = trimmed.filter(c => !c.favorito).sort((a, b) => b.updatedAt - a.updatedAt);
      trimmed = [...favoritos, ...normais].slice(0, MAX_CONVS);
    }
    saveAll(trimmed);
    setActiveId(id);
    _refresh();
    return id;
  }, [_refresh]);

  /** Persiste mensagens de uma conversa. Auto-titula na primeira pergunta. */
  const saveMessages = useCallback((id, messages, canalNome = '') => {
    if (!id) return;
    const all = loadAll();
    const idx = all.findIndex(c => c.id === id);
    const now = Date.now();

    // Filtra mensagens persistíveis (exclui streaming parcial e exports)
    const persistable = messages
      .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'error')
      .filter(m => !m.streaming)
      .map(m => ({
        role:        m.role,
        content:     m.content || '',
        fontes:      m.fontes   || [],
        sem_contexto: m.sem_contexto || false,
        ts:          m.ts || now,
      }));

    if (idx !== -1) {
      const existing = all[idx];
      const titulo = existing.titulo === 'Nova conversa'
        ? deriveTitle(persistable)
        : existing.titulo;
      all[idx] = { ...existing, titulo, messages: persistable, updatedAt: now, canalNome: canalNome || existing.canalNome };
    } else {
      all.unshift({
        id,
        canalNome,
        titulo:    deriveTitle(persistable),
        createdAt: now,
        updatedAt: now,
        favorito:  false,
        messages:  persistable,
      });
    }
    saveAll(all);
    _refresh();
  }, [_refresh]);

  /** Retorna uma conversa por id */
  const loadConversation = useCallback((id) => {
    return loadAll().find(c => c.id === id) || null;
  }, []);

  /** Remove uma conversa */
  const deleteConversation = useCallback((id) => {
    const all = loadAll().filter(c => c.id !== id);
    saveAll(all);
    if (activeId === id) setActiveId(null);
    _refresh();
  }, [activeId, _refresh]);

  /** Alterna favorito */
  const toggleFavorito = useCallback((id) => {
    const all = loadAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) { all[idx] = { ...all[idx], favorito: !all[idx].favorito }; saveAll(all); _refresh(); }
  }, [_refresh]);

  /** Renomeia uma conversa */
  const renameConversation = useCallback((id, titulo) => {
    const all = loadAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) { all[idx] = { ...all[idx], titulo: titulo.slice(0, TITLE_LEN) }; saveAll(all); _refresh(); }
  }, [_refresh]);

  const recent = conversations.slice(0, 10);

  return {
    conversations,
    activeId,
    setActiveId,
    startNew,
    saveMessages,
    loadConversation,
    deleteConversation,
    toggleFavorito,
    renameConversation,
    recent,
  };
}
