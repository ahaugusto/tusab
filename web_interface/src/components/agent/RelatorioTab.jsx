/**
 * @file RelatorioTab.jsx
 * @description Extraction report tab: channel selector, stats, dynamic filters and video table
 * @module components/agent/RelatorioTab
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';
import { Loader2, Search, X } from 'lucide-react';
import { fetchRelatorio, limparHistorico } from '../../services/api';

// ─── Component ───────────────────────────────────────────────────────────────

function RelatorioTab({ darkMode, history, btnFocus, onRefreshHistory, canalAtivo, isRunning }) {
  const { t } = useTranslation();
  const [canal,             setCanal]             = React.useState('');
  const [data,              setData]              = React.useState(null);
  const [loading,           setLoading]           = React.useState(false);
  const [filtroStatus,      setFiltroStatus]      = React.useState('todos');
  const [filtroAba,         setFiltroAba]         = React.useState('todas');
  const [busca,             setBusca]             = React.useState('');
  const [showLimpar,        setShowLimpar]        = React.useState(false);
  const [limparSel,         setLimparSel]         = React.useState({});
  const [limpando,          setLimpando]          = React.useState(false);
  const [showCoberturaInfo, setShowCoberturaInfo] = React.useState(true);

  const toggleSel = (prefixo) =>
    setLimparSel(s => ({ ...s, [prefixo]: !s[prefixo] }));

  const toggleTodos = () => {
    const todos = history.every(h => limparSel[h.canal]);
    const next  = {};
    history.forEach(h => { next[h.canal] = !todos; });
    setLimparSel(next);
  };

  const handleLimpar = async () => {
    const selecionados = history.map(h => h.canal).filter(p => limparSel[p]);
    if (!selecionados.length) return;
    setLimpando(true);
    await limparHistorico(selecionados).catch(() => {});
    setLimpando(false);
    setShowLimpar(false);
    setLimparSel({});
    if (selecionados.includes(canal)) { setCanal(''); setData(null); }
    onRefreshHistory?.();
  };

  React.useEffect(() => {
    if (history.length === 0) return;
    // Pré-seleciona canal ativo se existir no histórico, senão o primeiro
    if (!canal) {
      const match = canalAtivo && history.find(h => h.canal === canalAtivo);
      setCanal(match ? match.canal : history[0].canal);
    }
  }, [history]);

  React.useEffect(() => {
    if (!canal) return;
    setLoading(true);
    setFiltroStatus('todos');
    setFiltroAba('todas');
    setBusca('');
    setShowCoberturaInfo(true);
    fetchRelatorio(canal)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [canal]);

  // Recarrega automaticamente enquanto a extração está rodando (a cada 8s)
  React.useEffect(() => {
    if (!isRunning || !canal) return;
    const iv = setInterval(() => {
      fetchRelatorio(canal).then(r => { setData(r.data); }).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [isRunning, canal]);

  const relatorioNaoGerado = data?.error === true;
  const videos = relatorioNaoGerado ? [] : (data?.videos || []);
  const stats  = relatorioNaoGerado ? null : data?.stats;

  // Unique tabs present in this canal's data
  const abasDisponiveis = React.useMemo(() => {
    const set = new Set(videos.map(v => v.Aba).filter(Boolean));
    return [...set].sort();
  }, [videos]);

  // Apply all filters
  const filtrados = React.useMemo(() => {
    return videos.filter(v => {
      if (filtroStatus !== 'todos' && v.Status !== filtroStatus) return false;
      if (filtroAba    !== 'todas' && v.Aba    !== filtroAba)    return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        if (!(v.Titulo || '').toLowerCase().includes(q) && !(v.Link || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [videos, filtroStatus, filtroAba, busca]);

  const todosSelected = history.length > 0 && history.every(h => limparSel[h.canal]);
  const algumSelected = history.some(h => limparSel[h.canal]);

  const formatViews = (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n === 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  return (
    <div className="space-y-4">
      {/* Header com botão limpar */}
      {history.length > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('relatorio.title')}</h2>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('relatorio.history_count', { count: history.length })}</p>
          </div>
          <button onClick={() => setShowLimpar(true)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
              ${darkMode ? 'text-danger/70 hover:text-danger hover:bg-danger/10 border-danger/20' : 'text-red-400 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
            {t('relatorio.clear')}
          </button>
        </div>
      )}

      {/* Canal selector */}
      {history.length > 1 && (
        <div className="flex items-center gap-2">
          <label className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.canal_label')}</label>
          <select value={canal} onChange={e => setCanal(e.target.value)}
            style={darkMode ? { colorScheme: 'dark' } : {}}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-[#1a2035] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
            {history.map(h => (
              <option key={h.canal} value={h.canal}>@{h.canal}</option>
            ))}
          </select>
        </div>
      )}

      {/* Canal badge — single channel */}
      {history.length === 1 && canal && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
            {canal[0]?.toUpperCase()}
          </div>
          <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal}</p>
        </div>
      )}

      {/* Modal — limpar histórico */}
      {showLimpar && (
        <ModalWrapper onClose={() => { setShowLimpar(false); setLimparSel({}); }} zIndex="z-[9999]" backdrop="bg-black/60" label={t('relatorio.clear')}>
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('relatorio.clear')}</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.clear_desc')}</p>
              </div>
            </div>

            <label className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-colors
              ${todosSelected ? darkMode ? 'border-danger/40 bg-danger/10' : 'border-red-300 bg-red-50'
                              : darkMode ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={todosSelected} onChange={toggleTodos} className="accent-red-500 w-3.5 h-3.5" />
              <span className={`text-xs font-bold flex-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t('relatorio.select_all')}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{history.length}</span>
            </label>

            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {history.map(h => (
                <label key={h.canal}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors
                    ${limparSel[h.canal]
                      ? darkMode ? 'border-danger/40 bg-danger/10' : 'border-red-300 bg-red-50'
                      : darkMode ? 'border-white/8 hover:border-white/15' : 'border-slate-150 hover:border-slate-200'}`}>
                  <input type="checkbox" checked={!!limparSel[h.canal]} onChange={() => toggleSel(h.canal)} className="accent-red-500 w-3.5 h-3.5" />
                  <span className="text-sm shrink-0">📺</span>
                  <span className={`text-xs font-medium flex-1 truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>@{h.canal}</span>
                  <span className={`text-[10px] whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('relatorio.videos_count', { count: h.extraidos })}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowLimpar(false); setLimparSel({}); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {t('repo.cancel')}
              </button>
              <button onClick={handleLimpar} disabled={limpando || !algumSelected}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {limpando ? t('relatorio.removing') : t('relatorio.confirm')}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Banner informativo de cobertura */}
      {data && showCoberturaInfo && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${darkMode ? 'bg-amber-500/8 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 opacity-80" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className={`text-[11px] leading-relaxed flex-1 ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}
            dangerouslySetInnerHTML={{ __html: t('relatorio.coverage_info') }} />
          <button
            onClick={() => setShowCoberturaInfo(false)}
            className={`p-0.5 rounded transition-opacity opacity-60 hover:opacity-100 shrink-0`}
            aria-label={t('relatorio.close_notice')}>
            <X size={13} />
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('relatorio.stat_total'),    value: stats.total,           color: 'primary'   },
              { label: t('summary.extracted'),       value: stats.sucesso,         color: 'secondary' },
              { label: t('summary.no_caption'),      value: stats.sem_legenda,     color: 'slate'     },
              { label: t('relatorio.stat_coverage'), value: `${stats.cobertura}%`, color: stats.cobertura >= 80 ? 'secondary' : 'warning' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 border text-center ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-xl font-bold ${s.color === 'secondary' ? 'text-secondary' : s.color === 'warning' ? 'text-warning' : s.color === 'primary' ? 'text-primary' : darkMode ? 'text-white' : 'text-slate-800'}`}>{s.value}</p>
                <p className={`text-[10px] uppercase font-bold mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Filtros dinâmicos ── */}
          <div className="space-y-2">
            {/* Busca por título */}
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
              <Search size={12} className={`shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder={t('relatorio.search_placeholder')}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
              {busca && (
                <button onClick={() => setBusca('')} className="shrink-0 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtro de status */}
            <div className="flex gap-1.5 flex-wrap">
              {[['todos', t('relatorio.filter_all')], ['Sucesso', t('relatorio.filter_extracted')], ['Sem Legenda', t('relatorio.filter_no_caption')], ['Legenda Curta', t('relatorio.filter_short_caption')]].map(([v, l]) => (
                <button key={v} onClick={() => setFiltroStatus(v)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filtroStatus === v ? 'bg-primary/20 text-primary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Filtro de aba — só aparece quando há mais de uma aba */}
            {abasDisponiveis.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFiltroAba('todas')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filtroAba === 'todas' ? 'bg-secondary/20 text-secondary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                  {t('relatorio.all_tabs')}
                </button>
                {abasDisponiveis.map(aba => (
                  <button key={aba} onClick={() => setFiltroAba(aba)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filtroAba === aba ? 'bg-secondary/20 text-secondary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                    {aba.startsWith('Playlist:') ? '▶ ' + aba.replace('Playlist: ', '') : aba}
                  </button>
                ))}
              </div>
            )}

            {/* Contador de resultados */}
            <p className={`text-[10px] px-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {filtrados.length === videos.length
                ? t('relatorio.results_total', { count: videos.length })
                : t('relatorio.results_filtered', { filtered: filtrados.length, total: videos.length })}
              {busca && t('relatorio.results_search', { query: busca })}
            </p>
          </div>

          {/* Videos table */}
          <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="max-h-96 overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <caption className="sr-only">{t('relatorio.table_caption')}</caption>
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.col_title')}</th>
                    <th className={`text-left px-4 py-2.5 font-bold whitespace-nowrap ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.col_date')}</th>
                    <th className={`text-left px-4 py-2.5 font-bold whitespace-nowrap ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Extração</th>
                    <th className={`text-left px-4 py-2.5 font-bold whitespace-nowrap ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Views</th>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.col_tab')}</th>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('relatorio.col_status')}</th>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('relatorio.no_results')}
                      </td>
                    </tr>
                  )}
                  {filtrados.slice(0, 200).map((v, i) => (
                    <tr key={i} className={`border-b last:border-0 ${darkMode ? 'border-white/5 hover:bg-white/4' : 'border-slate-50 hover:bg-slate-50'}`}>
                      <td className="px-4 py-2">
                        <a href={v.Link} target="_blank" rel="noreferrer"
                          className={`hover:underline truncate block min-w-[120px] max-w-[520px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {v.Titulo}
                        </a>
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.Data_Pub || '—'}</td>
                      <td className={`px-4 py-2 whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.Data_Extracao || '—'}</td>
                      <td className={`px-4 py-2 whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {v.Views ? Number(v.Views).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {v.Aba ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap
                            ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {v.Aba.startsWith('Playlist:') ? '▶ ' + v.Aba.replace('Playlist: ', '') : v.Aba}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${v.Status === 'Sucesso' ? (darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700')
                          : v.Status === 'Sem Legenda' ? (darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500')
                          : darkMode ? 'bg-warning/15 text-warning' : 'bg-amber-100 text-amber-700'}`}>
                          {v.Status || '—'}
                        </span>
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap font-mono text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        {v.Local || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Banner: relatório sendo gerado durante extração */}
      {!loading && relatorioNaoGerado && isRunning && (
        <div className={`rounded-2xl border p-6 flex items-start gap-4 ${darkMode ? 'border-primary/30 bg-primary/8' : 'border-primary/25 bg-violet-50'}`}>
          <Loader2 size={20} className="animate-spin text-primary shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {t('relatorio.gerando_titulo', 'Relatório sendo gerado…')}
            </p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('relatorio.gerando_desc', 'O relatório de {{canal}} estará disponível assim que a extração for concluída. Esta tela atualiza automaticamente.', { canal: `@${canal}` })}
            </p>
          </div>
        </div>
      )}

      {/* Relatório não encontrado e extração parada */}
      {!loading && relatorioNaoGerado && !isRunning && (
        <div className={`rounded-2xl border p-6 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl mb-3">📊</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('relatorio.nao_encontrado', 'Relatório não encontrado')}</p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('relatorio.nao_encontrado_desc', 'Inicie uma extração para gerar o relatório deste canal.')}</p>
        </div>
      )}

      {/* Empty state — nenhum canal extraído ainda */}
      {!loading && !data && history.length === 0 && (
        <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl mb-3">📊</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('relatorio.empty')}</p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('relatorio.empty_desc')}</p>
        </div>
      )}
    </div>
  );
}

export default RelatorioTab;
