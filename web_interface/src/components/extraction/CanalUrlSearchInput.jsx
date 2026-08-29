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

const RE_URL = /^https?:\/\//i;
const RE_YT_DOMAIN = /youtube\.com|youtu\.be/i;

function CanalUrlSearchInput({ darkMode, value, onChange, onEnter, onSelectCanal, placeholder, inputSize = 14, autoFocus = false }) {
  const { t } = useTranslation();
  const [resultados,  setResultados]  = React.useState([]);
  const [buscando,    setBuscando]    = React.useState(false);
  const [buscaErro,   setBuscaErro]   = React.useState('');
  const [canalEscolhido, setCanalEscolhido] = React.useState(null); // { nome, thumbnail }
  const timerRef = React.useRef(null);

  const pareceUrl = RE_URL.test(value.trim()) || RE_YT_DOMAIN.test(value);
  const modoBusca = !canalEscolhido && value.trim().length > 0 && !pareceUrl;

  React.useEffect(() => {
    clearTimeout(timerRef.current);
    if (!modoBusca) { setResultados([]); setBuscaErro(''); return; }
    const q = value.trim();
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
  }, [value, modoBusca]);

  const escolherCanal = (canal) => {
    onChange(canal.url);
    onSelectCanal?.(canal);
    setCanalEscolhido({ nome: canal.nome, thumbnail: canal.thumbnail, handle: canal.handle });
    setResultados([]);
  };

  const trocarBusca = () => {
    setCanalEscolhido(null);
    onChange('');
  };

  if (canalEscolhido) {
    return (
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
    );
  }

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all
        ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
        {modoBusca
          ? (buscando
            ? <Loader2 size={inputSize} className="text-slate-400 shrink-0 animate-spin" aria-hidden="true" />
            : <Search size={inputSize} className="text-slate-400 shrink-0" aria-hidden="true" />)
          : <Link2 size={inputSize} className="text-slate-400 shrink-0" aria-hidden="true" />}
        <input type="text" placeholder={placeholder || t('channel.input_placeholder')} value={value} autoFocus={autoFocus}
          aria-label={t('channel.title')}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !modoBusca) onEnter?.(); }}
          className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
      </div>

      {modoBusca && value.trim().length >= 2 && (
        <div className={`absolute z-20 mt-1 w-full rounded-xl border shadow-xl max-h-[30rem] overflow-y-auto custom-scrollbar
          ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
          {buscaErro ? (
            <p className="flex items-center gap-1.5 px-3 py-3 text-[11px] text-danger"><AlertTriangle size={11} aria-hidden="true" /> {buscaErro}</p>
          ) : !buscando && resultados.length === 0 ? (
            <p className={`px-3 py-3 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('channel.search_no_results', { query: value.trim() })}</p>
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
  );
}

export default CanalUrlSearchInput;
