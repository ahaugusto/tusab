/**
 * @file BasePainel.jsx
 * @description Painel de visibilidade da base — inventário por projeto com cards
 *              de contagem de documentos, status do índice e data de última adição.
 * @module components/agent/BasePainel
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Database, Play, FileText, AlignLeft, RefreshCw, Loader2, Zap } from 'lucide-react';
import { fetchBaseSummary } from '../../services/api';

function localeFor(lang) {
  return lang?.startsWith('en') ? 'en-US' : lang?.startsWith('es') ? 'es-ES' : 'pt-BR';
}

function formatDate(ts, lang) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(localeFor(lang), { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusChip({ indexado, desatualizado, darkMode, t }) {
  if (!indexado) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
        ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
        {t('chat.not_indexed')}
      </span>
    );
  }
  if (desatualizado) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
        ${darkMode ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        {t('basePainel.status_outdated')}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border
      ${darkMode ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {t('basePainel.status_indexed')}
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
  const { t, i18n } = useTranslation();
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
        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('basePainel.loading')}</span>
      </div>
    );
  }

  if (projetos.length === 0) {
    return (
      <div className={`text-center py-8 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {t('basePainel.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('basePainel.header_count', { count: projetos.length })}
        </p>
        <button
          onClick={carregar}
          title={t('common.refresh')}
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
              <StatusChip indexado={p.indexado} desatualizado={desatualizado} darkMode={darkMode} t={t} />
            </div>

            {/* Contadores de fontes */}
            <div className="flex items-center gap-3 flex-wrap">
              {p.n_youtube > 0 && (
                <div className="flex items-center gap-1">
                  <Play size={10} className={darkMode ? 'text-red-400' : 'text-red-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('basePainel.videos_count', { count: p.n_youtube })}
                  </span>
                </div>
              )}
              {p.n_documents > 0 && (
                <div className="flex items-center gap-1">
                  <FileText size={10} className={darkMode ? 'text-blue-400' : 'text-blue-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('basePainel.docs_count', { count: p.n_documents })}
                  </span>
                </div>
              )}
              {p.n_texts > 0 && (
                <div className="flex items-center gap-1">
                  <AlignLeft size={10} className={darkMode ? 'text-emerald-400' : 'text-emerald-500'} />
                  <span className={`text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('basePainel.texts_count', { count: p.n_texts })}
                  </span>
                </div>
              )}
              {p.n_chunks > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono
                  ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {t('basePainel.chunks_suffix', { count: p.n_chunks.toLocaleString(localeFor(i18n.language)) })}
                </span>
              )}
            </div>

            {/* Datas */}
            <div className={`flex items-center gap-3 text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {p.ultima_adicao && (
                <span>{t('basePainel.last_added', { date: formatDate(p.ultima_adicao, i18n.language) })}</span>
              )}
              {p.indexed_at && (
                <span>{t('basePainel.indexed_at', { date: formatDate(p.indexed_at, i18n.language) })}</span>
              )}
            </div>

            {/* Perfil do corpus — calibragem automática (P0-c) */}
            {p.corpus_profile && (
              <div className={`flex items-center gap-1.5 flex-wrap text-[9px] px-2 py-1 rounded-lg
                ${darkMode ? 'bg-primary/8 text-slate-400' : 'bg-violet-50 text-slate-500'}`}>
                <Zap size={9} className={darkMode ? 'text-primary' : 'text-violet-500'} />
                <span className="font-semibold">{t('basePainel.corpus_profile_label')}</span>
                <span>{p.corpus_profile.tipo_dominante}</span>
                <span className="opacity-50">·</span>
                <span>{t('basePainel.corpus_candidates_suffix', { count: p.corpus_profile.n_candidatos_bm25 })}</span>
              </div>
            )}

            {/* Botão indexar quando desatualizado ou não indexado */}
            {(desatualizado || !p.indexado) && onIndexar && (
              <button
                disabled={!!agentIndexing}
                onClick={() => onIndexar(p.nome)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${darkMode ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'}`}>
                <Zap size={10} />
                {agentIndexing ? t('repo.indexing_short') : desatualizado ? t('basePainel.update_index_btn') : t('basePainel.index_now_btn')}
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
