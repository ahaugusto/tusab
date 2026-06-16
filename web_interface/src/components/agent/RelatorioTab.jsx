/**
 * @file RelatorioTab.jsx
 * @description Extraction report tab: channel selector, stats and video status table
 * @module components/agent/RelatorioTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';
import { Loader2 } from 'lucide-react';
import { fetchRelatorio, limparHistorico } from '../../services/api';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * RelatorioTab — shows per-canal extraction statistics and a filterable video table
 *
 * @param {Object}  props
 * @param {boolean} props.darkMode  - dark/light theme flag
 * @param {Array}   props.history   - list of extracted channels
 * @param {string}  props.btnFocus  - Tailwind focus-visible ring classes
 * @returns {JSX.Element}
 */
function RelatorioTab({ darkMode, history, btnFocus, onRefreshHistory }) {
  const { t } = useTranslation();
  const [canal,        setCanal]        = React.useState('');
  const [data,         setData]         = React.useState(null);
  const [loading,      setLoading]      = React.useState(false);
  const [filtro,       setFiltro]       = React.useState('todos');
  const [showLimpar,   setShowLimpar]   = React.useState(false);
  const [limparSel,    setLimparSel]    = React.useState({});
  const [limpando,     setLimpando]     = React.useState(false);

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

  /** Pre-selects the first canal when history is loaded */
  React.useEffect(() => {
    if (history.length > 0 && !canal) setCanal(history[0].canal);
  }, [history]);

  /** Fetches report data whenever the selected canal changes */
  React.useEffect(() => {
    if (!canal) return;
    setLoading(true);
    fetchRelatorio(canal)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [canal]);

  const videos   = data?.videos || [];
  const filtrados = filtro === 'todos' ? videos : videos.filter(v => v.Status === filtro);
  const stats    = data?.stats;

  const todosSelected = history.length > 0 && history.every(h => limparSel[h.canal]);
  const algumSelected = history.some(h => limparSel[h.canal]);

  return (
    <div className="space-y-4">
      {/* Header com botão limpar */}
      {history.length > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('relatorio.title')}</h2>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{history.length} canal{history.length !== 1 ? 'is' : ''} com histórico</p>
          </div>
          <button onClick={() => setShowLimpar(true)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
              ${darkMode ? 'text-danger/70 hover:text-danger hover:bg-danger/10 border-danger/20' : 'text-red-400 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
            {t('relatorio.clear')}
          </button>
        </div>
      )}

      {/* Canal selector — multi-channel */}
      {history.length > 1 && (
        <div className="flex items-center gap-2">
          <label className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Canal:</label>
          <select value={canal} onChange={e => setCanal(e.target.value)}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
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
      {showLimpar && ReactDOM.createPortal(
        <ModalWrapper onClose={() => { setShowLimpar(false); setLimparSel({}); }} zIndex="z-[9999]" backdrop="bg-black/60" label="Limpar histórico">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Limpar histórico</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecione os canais cujo histórico deseja remover:</p>
              </div>
            </div>

            {/* Selecionar todos */}
            <label className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-colors
              ${todosSelected ? darkMode ? 'border-danger/40 bg-danger/10' : 'border-red-300 bg-red-50'
                              : darkMode ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={todosSelected} onChange={toggleTodos} className="accent-red-500 w-3.5 h-3.5" />
              <span className={`text-xs font-bold flex-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Selecionar todos</span>
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
                  <span className={`text-[10px] whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{h.extraidos} vídeos</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowLimpar(false); setLimparSel({}); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleLimpar} disabled={limpando || !algumSelected}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {limpando ? 'Removendo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
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
              { label: 'Total',       value: stats.total,           color: 'primary'   },
              { label: 'Extraídos',   value: stats.sucesso,         color: 'secondary' },
              { label: 'Sem legenda', value: stats.sem_legenda,     color: 'slate'     },
              { label: 'Cobertura',   value: `${stats.cobertura}%`, color: stats.cobertura >= 80 ? 'secondary' : 'warning' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 border text-center ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-xl font-bold ${s.color === 'secondary' ? 'text-secondary' : s.color === 'warning' ? 'text-warning' : s.color === 'primary' ? 'text-primary' : darkMode ? 'text-white' : 'text-slate-800'}`}>{s.value}</p>
                <p className={`text-[10px] uppercase font-bold mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {[['todos','Todos'], ['Sucesso','Extraídos'], ['Sem Legenda','Sem legenda'], ['Legenda Curta','Leg. curta']].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filtro === v ? 'bg-primary/20 text-primary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Videos table */}
          <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`max-h-96 overflow-y-auto overflow-x-auto custom-scrollbar`}>
              <table className="w-full text-xs">
                <caption className="sr-only">Lista de vídeos extraídos com título, data de publicação e status</caption>
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Título</th>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Data</th>
                    <th className={`text-left px-4 py-2.5 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 200).map((v, i) => (
                    <tr key={i} className={`border-b last:border-0 ${darkMode ? 'border-white/5 hover:bg-white/4' : 'border-slate-50 hover:bg-slate-50'}`}>
                      <td className="px-4 py-2">
                        <a href={v.Link} target="_blank" rel="noreferrer"
                          className={`hover:underline truncate block min-w-[120px] max-w-[280px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {v.Titulo}
                        </a>
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.Data_Pub}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${v.Status === 'Sucesso' ? (darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700')
                          : v.Status === 'Sem Legenda' ? (darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500')
                          : darkMode ? 'bg-warning/15 text-warning' : 'bg-amber-100 text-amber-700'}`}>
                          {v.Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !data && history.length === 0 && (
        <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl mb-3">📊</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Nenhuma extração ainda</p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Extraia um canal para ver o relatório aqui</p>
        </div>
      )}
    </div>
  );
}

export default RelatorioTab;
