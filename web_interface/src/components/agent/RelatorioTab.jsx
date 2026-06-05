/**
 * @file RelatorioTab.jsx
 * @description Extraction report tab: channel selector, stats and video status table
 * @module components/agent/RelatorioTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { fetchRelatorio } from '../../services/api';

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
function RelatorioTab({ darkMode, history, btnFocus }) {
  const [canal,   setCanal]   = React.useState('');
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [filtro,  setFiltro]  = React.useState('todos');

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

  return (
    <div className="space-y-4">
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
            <div className={`max-h-96 overflow-y-auto custom-scrollbar`}>
              <table className="w-full text-xs">
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
                          className={`hover:underline truncate block max-w-[200px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
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
