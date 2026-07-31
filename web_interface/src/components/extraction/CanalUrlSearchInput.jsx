/**
 * @file CanalUrlSearchInput.jsx
 * @description Campo de URL de canal do YouTube com modo alternativo de busca
 *   por nome (via yt-dlp local, sem API key) — usuário escolhe colar a URL
 *   ou digitar o nome do canal e selecionar entre os candidatos retornados.
 * @module components/extraction/CanalUrlSearchInput
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Search, Loader2, AlertTriangle, X } from 'lucide-react';
import { buscarCanaisYoutube } from '../../services/api';

function CanalUrlSearchInput({ darkMode, value, onChange, onEnter, placeholder, inputSize = 14, autoFocus = false }) {
  const { t } = useTranslation();
  const [modo,        setModo]        = React.useState('paste'); // 'paste' | 'search'
  const [termo,       setTermo]       = React.useState('');
  const [resultados,  setResultados]  = React.useState([]);
  const [buscando,    setBuscando]    = React.useState(false);
  const [buscaErro,   setBuscaErro]   = React.useState('');
  const [canalEscolhido, setCanalEscolhido] = React.useState(null); // { nome, thumbnail }
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    clearTimeout(timerRef.current);
    if (modo !== 'search' || canalEscolhido) return;
    const q = termo.trim();
    if (q.length < 2) { setResultados([]); setBuscaErro(''); return; }
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      setBuscaErro('');
      try {
        const res = await buscarCanaisYoutube(q);
        setResultados(res.data?.canais || []);
      } catch {
        setBuscaErro(t('channel.search_error'));
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 450);
    return () => clearTimeout(timerRef.current);
  }, [termo, modo, canalEscolhido]);

  const escolherCanal = (canal) => {
    onChange(canal.url);
    setCanalEscolhido({ nome: canal.nome, thumbnail: canal.thumbnail, handle: canal.handle });
    setResultados([]);
  };

  const trocarBusca = () => {
    setCanalEscolhido(null);
    setTermo('');
    onChange('');
  };

  return (
    <div className="space-y-1.5">
      {/* Toggle Colar URL / Buscar canal */}
      <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${darkMode ? 'bg-white/3 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
        <button type="button" onClick={() => setModo('paste')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors
            ${modo === 'paste' ? 'bg-primary text-white' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <Link2 size={10} aria-hidden="true" /> {t('channel.mode_paste')}
        </button>
        <button type="button" onClick={() => setModo('search')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors
            ${modo === 'search' ? 'bg-primary text-white' : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <Search size={10} aria-hidden="true" /> {t('channel.mode_search')}
        </button>
      </div>

      {modo === 'paste' ? (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all
          ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
          <Link2 size={inputSize} className="text-slate-400 shrink-0" aria-hidden="true" />
          <input type="url" placeholder={placeholder} value={value} autoFocus={autoFocus}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onEnter?.()}
            className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
        </div>
      ) : canalEscolhido ? (
        <button type="button" onClick={trocarBusca}
          className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors
            ${darkMode ? 'bg-primary/10 border-primary/30 hover:bg-primary/15' : 'bg-primary/5 border-primary/30 hover:bg-primary/10'}`}>
          {canalEscolhido.thumbnail
            ? <img src={canalEscolhido.thumbnail} alt="" className="w-6 h-6 rounded-full shrink-0" />
            : <div className={`w-6 h-6 rounded-full shrink-0 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{canalEscolhido.nome}</p>
            {canalEscolhido.handle && <p className={`text-[10px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{canalEscolhido.handle}</p>}
          </div>
          <X size={12} className={darkMode ? 'text-slate-500 shrink-0' : 'text-slate-400 shrink-0'} aria-hidden="true" />
        </button>
      ) : (
        <div className="relative">
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all
            ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
            {buscando
              ? <Loader2 size={inputSize} className="text-slate-400 shrink-0 animate-spin" aria-hidden="true" />
              : <Search size={inputSize} className="text-slate-400 shrink-0" aria-hidden="true" />}
            <input type="text" placeholder={t('channel.search_placeholder')} value={termo} autoFocus={autoFocus}
              onChange={e => setTermo(e.target.value)}
              className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
          </div>

          {termo.trim().length >= 2 && (
            <div className={`absolute z-20 mt-1 w-full rounded-xl border shadow-xl max-h-56 overflow-y-auto custom-scrollbar
              ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
              {buscaErro ? (
                <p className="flex items-center gap-1.5 px-3 py-3 text-[11px] text-danger"><AlertTriangle size={11} aria-hidden="true" /> {buscaErro}</p>
              ) : !buscando && resultados.length === 0 ? (
                <p className={`px-3 py-3 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('channel.search_no_results', { query: termo.trim() })}</p>
              ) : (
                resultados.map(canal => (
                  <button key={canal.url} type="button" onClick={() => escolherCanal(canal)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                      ${darkMode ? 'hover:bg-white/8 border-b border-white/5 last:border-0' : 'hover:bg-slate-50 border-b border-slate-100 last:border-0'}`}>
                    {canal.thumbnail
                      ? <img src={canal.thumbnail} alt="" className="w-7 h-7 rounded-full shrink-0" />
                      : <div className={`w-7 h-7 rounded-full shrink-0 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{canal.nome}</p>
                      <p className={`text-[10px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {canal.handle}{canal.handle && canal.seguidores != null ? ' · ' : ''}
                        {canal.seguidores != null ? t('channel.search_subscribers', { count: canal.seguidores.toLocaleString() }) : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CanalUrlSearchInput;
