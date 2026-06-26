/**
 * @file BasePainel.jsx
 * @description Painel de visibilidade da base — inventário por projeto com cards
 *              de contagem de documentos, status do índice e data de última adição.
 * @module components/agent/BasePainel
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, Play, FileText, AlignLeft, RefreshCw, Loader2, Zap } from 'lucide-react';
import { fetchBaseSummary } from '../../services/api';

function formatDate(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusChip({ indexado, desatualizado, darkMode }) {
  if (!indexado) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
        ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
        Não indexado
      </span>
    );
  }
  if (desatualizado) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
        ${darkMode ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Desatualizado
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
      ${darkMode ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Indexado
    </span>
  );
}

/**
 * BasePainel — exibe cards por projeto com inventário de fontes e status do índice.
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode
 * @param {string[]} props.basesDesatualizadas  - nomes das bases com arquivos mais novos que o índice
 * @param {Function} [props.onIndexar]          - callback(nome) para indexar uma base
 * @param {boolean}  [props.agentIndexing]      - true enquanto indexação está em progresso
 */
export function BasePainel({ darkMode, basesDesatualizadas = [], onIndexar, agentIndexing }) {
  const [projetos, setProjetos] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchBaseSummary();
      setProjetos(r.data.projetos || []);
    } catch {
      // silencioso — painel é opcional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <Loader2 size={14} className={`animate-spin ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Carregando inventário…</span>
      </div>
    );
  }

  if (projetos.length === 0) {
    return (
      <div className={`text-center py-8 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        Nenhuma base encontrada. Extraia um canal ou adicione documentos no Repositório.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          O que o Tusab sabe — {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </p>
        <button
          onClick={carregar}
          title="Atualizar"
          className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <RefreshCw size={11} />
        </button>
      </div>

      {projetos.map((p, i) => {
        const desatualizado = basesDesatualizadas.includes(p.nome);
        return (
          <motion.div
            key={p.prefixo}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-xl border p-3 space-y-2.5
              ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>

            {/* Header do card */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Database size={13} className={`shrink-0 ${darkMode ? 'text-primary' : 'text-violet-600'}`} />
                <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  @{p.nome}
                </p>
              </div>
              <StatusChip indexado={p.indexado} desatualizado={desatualizado} darkMode={darkMode} />
            </div>

            {/* Contadores de fontes */}
            <div className="flex items-center gap-3 flex-wrap">
              {p.n_youtube > 0 && (
                <div className="flex items-center gap-1">
                  <Play size={10} className={darkMode ? 'text-red-400' : 'text-red-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {p.n_youtube} {p.n_youtube === 1 ? 'vídeo' : 'vídeos'}
                  </span>
                </div>
              )}
              {p.n_documents > 0 && (
                <div className="flex items-center gap-1">
                  <FileText size={10} className={darkMode ? 'text-blue-400' : 'text-blue-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {p.n_documents} {p.n_documents === 1 ? 'doc' : 'docs'}
                  </span>
                </div>
              )}
              {p.n_texts > 0 && (
                <div className="flex items-center gap-1">
                  <AlignLeft size={10} className={darkMode ? 'text-emerald-400' : 'text-emerald-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {p.n_texts} {p.n_texts === 1 ? 'texto' : 'textos'}
                  </span>
                </div>
              )}
              {p.n_chunks > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono
                  ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {p.n_chunks.toLocaleString('pt-BR')} chunks
                </span>
              )}
            </div>

            {/* Datas */}
            <div className={`flex items-center gap-3 text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {p.ultima_adicao && (
                <span>Última adição: {formatDate(p.ultima_adicao)}</span>
              )}
              {p.indexed_at && (
                <span>Indexado: {formatDate(p.indexed_at)}</span>
              )}
            </div>

            {/* Botão indexar quando desatualizado ou não indexado */}
            {(desatualizado || !p.indexado) && onIndexar && (
              <button
                disabled={!!agentIndexing}
                onClick={() => onIndexar(p.nome)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${darkMode ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'}`}>
                <Zap size={10} />
                {agentIndexing ? 'Indexando…' : desatualizado ? 'Atualizar índice' : 'Indexar agora'}
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
