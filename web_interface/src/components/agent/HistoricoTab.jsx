/**
 * @file HistoricoTab.jsx
 * @description Aba de histórico de conversas — lista, busca, favoritos, retomada e exclusão
 * @module components/agent/HistoricoTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Trash2, MessageSquare, Search, RotateCcw, Download } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoje ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7)  return `Há ${diffDays} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function exportJSON(conv) {
  const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tusab_conv_${conv.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ConvCard ────────────────────────────────────────────────────────────────

function ConvCard({ conv, darkMode, btnFocus, onRetomar, onDelete, onToggleFav, onRename }) {
  const [editando, setEditando] = useState(false);
  const [titulo,   setTitulo]   = useState(conv.titulo);
  const msgCount = conv.messages?.length || 0;
  const preview  = conv.messages?.find(m => m.role === 'assistant')?.content?.slice(0, 100) || '';

  const handleRename = () => {
    if (titulo.trim()) onRename(conv.id, titulo.trim());
    setEditando(false);
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all group
      ${darkMode
        ? 'bg-[#0C1122]/80 border-white/10 hover:border-white/20'
        : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>

      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {editando ? (
            <input
              autoFocus
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditando(false); }}
              className={`w-full text-xs font-bold rounded-lg px-2 py-1 outline-none border focus:border-primary
                ${darkMode ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
            />
          ) : (
            <p
              className={`text-xs font-bold leading-tight truncate cursor-pointer hover:text-primary transition-colors
                ${darkMode ? 'text-white' : 'text-slate-800'}`}
              onDoubleClick={() => setEditando(true)}
              title="Duplo clique para renomear"
            >
              {conv.titulo}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {conv.canalNome && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                ${darkMode ? 'bg-primary/15 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                @{conv.canalNome}
              </span>
            )}
            <span className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {fmtDate(conv.updatedAt)} · {msgCount} msg
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleFav(conv.id)} className={`p-1.5 rounded-lg transition-colors ${btnFocus}
            ${conv.favorito
              ? 'text-amber-400'
              : darkMode ? 'text-slate-600 hover:text-amber-400' : 'text-slate-300 hover:text-amber-500'}`}
            title={conv.favorito ? 'Remover favorito' : 'Favoritar'}>
            <Star size={12} fill={conv.favorito ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => exportJSON(conv)} className={`p-1.5 rounded-lg transition-colors ${btnFocus}
            ${darkMode ? 'text-slate-600 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}
            title="Exportar como JSON">
            <Download size={12} />
          </button>
          <button onClick={() => onDelete(conv.id)} className={`p-1.5 rounded-lg transition-colors ${btnFocus}
            ${darkMode ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}
            title="Excluir conversa">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Preview da resposta */}
      {preview && (
        <p className={`text-[10px] leading-relaxed line-clamp-2 mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {preview}…
        </p>
      )}

      {/* Retomar */}
      <button
        onClick={() => onRetomar(conv)}
        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${btnFocus}
          ${darkMode
            ? 'bg-primary/15 text-primary hover:bg-primary/25'
            : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
        <RotateCcw size={11} />
        Retomar conversa
      </button>
    </div>
  );
}

// ─── HistoricoTab ─────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {boolean}  props.darkMode
 * @param {Object[]} props.conversations    - array de conversas do useChatHistory
 * @param {Function} props.onRetomar        - (conv) => void — reabre o chat com a conversa
 * @param {Function} props.onDelete         - (id) => void
 * @param {Function} props.onToggleFav      - (id) => void
 * @param {Function} props.onRename         - (id, titulo) => void
 */
function HistoricoTab({ darkMode, conversations, onRetomar, onDelete, onToggleFav, onRename }) {
  const { t } = useTranslation();
  const [busca,       setBusca]       = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [apenaseFav,  setApenasFav]   = useState(false);

  const canais = useMemo(() => {
    const set = new Set(conversations.map(c => c.canalNome).filter(Boolean));
    return [...set].sort();
  }, [conversations]);

  const filtered = useMemo(() => {
    return conversations.filter(c => {
      if (apenaseFav && !c.favorito) return false;
      if (filtroCanal && c.canalNome !== filtroCanal) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const inTitulo = c.titulo?.toLowerCase().includes(q);
        const inMsgs   = c.messages?.some(m => m.content?.toLowerCase().includes(q));
        if (!inTitulo && !inMsgs) return false;
      }
      return true;
    });
  }, [conversations, busca, filtroCanal, apenaseFav]);

  const favoritos = filtered.filter(c => c.favorito);
  const normais   = filtered.filter(c => !c.favorito);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <MessageSquare size={32} className={darkMode ? 'text-slate-700' : 'text-slate-300'} />
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Nenhuma conversa ainda
        </p>
        <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Suas conversas com o agente serão salvas automaticamente aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${darkMode ? 'bg-white/5 border-white/15' : 'bg-white border-slate-200'}`}>
          <Search size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar em conversas..."
            className={`flex-1 text-xs bg-transparent outline-none ${darkMode ? 'text-white placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'}`}
          />
          {busca && (
            <button onClick={() => setBusca('')} className={darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}>
              ×
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {canais.length > 0 && (
            <select
              value={filtroCanal}
              onChange={e => setFiltroCanal(e.target.value)}
              className={`flex-1 text-[11px] rounded-xl border px-2 py-1.5 outline-none ${BTN_FOCUS}
                ${darkMode ? 'bg-white/5 border-white/15 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
              <option value="">Todos os canais</option>
              {canais.map(c => <option key={c} value={c}>@{c}</option>)}
            </select>
          )}
          <button
            onClick={() => setApenasFav(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${BTN_FOCUS}
              ${apenaseFav
                ? 'bg-amber-400/20 border-amber-400/40 text-amber-400'
                : darkMode ? 'bg-white/5 border-white/15 text-slate-400 hover:text-amber-400' : 'bg-white border-slate-200 text-slate-500 hover:text-amber-500'}`}>
            <Star size={11} fill={apenaseFav ? 'currentColor' : 'none'} />
            Favoritos
          </button>
        </div>

        <p className={`text-[10px] px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          {filtered.length} conversa{filtered.length !== 1 ? 's' : ''}
          {busca || filtroCanal || apenaseFav ? ' encontrada' + (filtered.length !== 1 ? 's' : '') : ''}
        </p>
      </div>

      {/* Favoritos */}
      {favoritos.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[10px] font-bold uppercase tracking-widest px-1 ${darkMode ? 'text-amber-500/60' : 'text-amber-600'}`}>
            ★ Favoritos
          </p>
          {favoritos.map(conv => (
            <ConvCard
              key={conv.id}
              conv={conv}
              darkMode={darkMode}
              btnFocus={BTN_FOCUS}
              onRetomar={onRetomar}
              onDelete={onDelete}
              onToggleFav={onToggleFav}
              onRename={onRename}
            />
          ))}
        </div>
      )}

      {/* Conversas normais */}
      {normais.length > 0 && (
        <div className="space-y-2">
          {favoritos.length > 0 && (
            <p className={`text-[10px] font-bold uppercase tracking-widest px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Recentes
            </p>
          )}
          {normais.map(conv => (
            <ConvCard
              key={conv.id}
              conv={conv}
              darkMode={darkMode}
              btnFocus={BTN_FOCUS}
              onRetomar={onRetomar}
              onDelete={onDelete}
              onToggleFav={onToggleFav}
              onRename={onRename}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && conversations.length > 0 && (
        <p className={`text-xs text-center py-8 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Nenhuma conversa encontrada para os filtros aplicados.
        </p>
      )}
    </div>
  );
}

export default HistoricoTab;
