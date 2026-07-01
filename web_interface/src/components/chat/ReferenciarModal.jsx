import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check, ChevronDown, ChevronRight, Database, Zap, Loader2 } from 'lucide-react';
import { buscarTrechos } from '../../services/api';

function highlightQuery(text, query) {
  if (!query || !text) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return text;
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-300/40 text-inherit rounded px-0.5">{part}</mark>
      : part
  );
}

export default function ReferenciarModal({
  darkMode,
  canaisIndexados = [],   // [{ nome, chunks }] — vindos do agentStatus
  queryInicial = '',
  onInjetar,              // (trechosConcatenados: string) => void
  onFechar,
}) {
  const [query,        setQuery]        = useState(queryInicial);
  const [buscando,     setBuscando]     = useState(false);
  const [trechos,      setTrechos]      = useState([]);   // resultados do backend
  const [selecionados, setSelecionados] = useState({});   // { idx: true }
  const [canaisSel,    setCanaisSel]    = useState({});   // { nome: true }
  const [expandidos,   setExpandidos]   = useState({});   // { nome: true }
  const [erro,         setErro]         = useState('');
  const [buscaAmpla,   setBuscaAmpla]   = useState(true);
  const inputRef  = useRef(null);
  const timerRef  = useRef(null);

  // Inicializa todos os canais selecionados
  useEffect(() => {
    const sel = {};
    canaisIndexados.forEach(c => { sel[c.nome] = true; });
    setCanaisSel(sel);
  }, [canaisIndexados]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const buscar = useCallback(async (q, canais, ampla) => {
    const canaisAtivos = canaisIndexados.filter(c => canais[c.nome]).map(c => c.nome);
    if (!q.trim() || !canaisAtivos.length) { setTrechos([]); return; }
    setBuscando(true);
    setErro('');
    try {
      const res = await buscarTrechos(q.trim(), canaisAtivos, 8, ampla);
      setTrechos(res.data?.trechos || []);
      setSelecionados({});
      // Expande automaticamente a base com melhor resultado
      if (res.data?.trechos?.length) {
        setExpandidos({ [res.data.trechos[0].canal]: true });
      }
    } catch {
      setErro('Erro ao buscar. Verifique se o backend está rodando.');
      setTrechos([]);
    } finally {
      setBuscando(false);
    }
  }, [canaisIndexados]);

  // Debounce da busca ao digitar
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(query, canaisSel, buscaAmpla), 500);
    return () => clearTimeout(timerRef.current);
  }, [query, canaisSel, buscaAmpla, buscar]);

  const toggleCanal = nome =>
    setCanaisSel(prev => ({ ...prev, [nome]: !prev[nome] }));

  const toggleExpand = nome =>
    setExpandidos(prev => ({ ...prev, [nome]: !prev[nome] }));

  const toggleSel = idx =>
    setSelecionados(prev => ({ ...prev, [idx]: !prev[idx] }));

  const nSel = Object.values(selecionados).filter(Boolean).length;

  // Agrupa por canal
  const porCanal = trechos.reduce((acc, t, idx) => {
    if (!acc[t.canal]) acc[t.canal] = [];
    acc[t.canal].push({ ...t, _idx: idx });
    return acc;
  }, {});

  const handleInjetar = () => {
    const escolhidos = trechos.filter((_, idx) => selecionados[idx]);
    if (!escolhidos.length) return;
    // Constrói o contexto: cada trecho como bloco [arquivo]\ntrecho
    const blocos = escolhidos.map(t => {
      const id = t.arquivo || t.titulo || t.canal;
      const texto = t.trecho || '';
      return `[${id}]\n${texto}`;
    });
    onInjetar(blocos.join('\n\n---\n\n'));
  };

  const dm = darkMode;

  return (
    <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden
      ${dm ? 'bg-[#0C1122] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
      style={{ maxHeight: 'min(85vh, 700px)' }}>

      {/* Header */}
      <div className={`px-5 pt-5 pb-4 border-b shrink-0 ${dm ? 'border-white/8' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search size={16} className={dm ? 'text-accent' : 'text-violet-600'} />
            <h2 className="text-sm font-bold">Referenciar trecho no chat</h2>
          </div>
          <button onClick={onFechar}
            className={`p-1.5 rounded-lg transition-colors ${dm ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={14} />
          </button>
        </div>

        {/* Campo de busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2
          ${dm ? 'bg-white/5 border-white/10 focus-within:border-accent/50' : 'bg-slate-50 border-slate-200 focus-within:border-violet-300'}`}>
          <Search size={13} className={dm ? 'text-slate-500' : 'text-slate-400'} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por título, termo ou trecho..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {buscando
            ? <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />
            : query && <button onClick={() => { setQuery(''); setTrechos([]); }} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
          }
        </div>

        {/* Filtros de base + toggle busca ampla */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {canaisIndexados.map(c => (
            <button key={c.nome} onClick={() => toggleCanal(c.nome)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
                ${canaisSel[c.nome]
                  ? dm ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-violet-50 border-violet-300 text-violet-700'
                  : dm ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
              <Database size={10} />
              {c.nome}
            </button>
          ))}
          <button onClick={() => setBuscaAmpla(p => !p)}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
              ${buscaAmpla
                ? dm ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : dm ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
            <Zap size={10} />
            Busca ampla
          </button>
        </div>
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
        {erro && (
          <p className="text-xs text-red-400 text-center py-4">{erro}</p>
        )}
        {!buscando && !erro && query.trim() && trechos.length === 0 && (
          <p className={`text-xs text-center py-8 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum trecho encontrado para <strong>"{query}"</strong> nas bases selecionadas.
          </p>
        )}
        {!query.trim() && (
          <p className={`text-xs text-center py-8 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            Digite um termo, título ou trecho para buscar nas suas bases.
          </p>
        )}

        {Object.entries(porCanal).map(([canal, items]) => (
          <div key={canal} className={`rounded-xl border overflow-hidden ${dm ? 'border-white/8' : 'border-slate-200'}`}>
            {/* Cabeçalho do grupo */}
            <button
              onClick={() => toggleExpand(canal)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors
                ${dm ? 'bg-white/5 hover:bg-white/8' : 'bg-slate-50 hover:bg-slate-100'}`}>
              {expandidos[canal] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Database size={12} className={dm ? 'text-accent' : 'text-violet-500'} />
              <span className="text-xs font-semibold flex-1">{canal}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dm ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                {items.length} trecho{items.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Trechos do grupo */}
            {expandidos[canal] && (
              <div className="divide-y divide-white/5">
                {items.map(t => {
                  const sel = selecionados[t._idx];
                  const isYt = t.aba === 'youtube' || !!t.link;
                  const icon = isYt ? '🎬' : t.aba === 'texto' ? '📝' : '📄';
                  const trecho = t.trecho || '';
                  const preview = trecho.length > 300 ? trecho.slice(0, 300) + '…' : trecho;

                  return (
                    <div key={t._idx}
                      onClick={() => toggleSel(t._idx)}
                      className={`px-3 py-2.5 cursor-pointer transition-colors flex gap-3
                        ${sel
                          ? dm ? 'bg-accent/10 border-l-2 border-accent' : 'bg-violet-50 border-l-2 border-violet-500'
                          : dm ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                        }`}>

                      {/* Checkbox visual */}
                      <div className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all
                        ${sel
                          ? dm ? 'bg-accent border-accent' : 'bg-violet-600 border-violet-600'
                          : dm ? 'border-white/20' : 'border-slate-300'
                        }`}>
                        {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5 mb-1">
                          <span className="text-xs shrink-0">{icon}</span>
                          <p className="text-[12px] font-semibold leading-tight line-clamp-2">
                            {highlightQuery(t.titulo || t.arquivo || 'Sem título', query)}
                          </p>
                        </div>

                        {t.data && (
                          <p className={`text-[10px] mb-1 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t.data}{t.timestamp_inicio ? ` · ${t.timestamp_inicio}` : ''}
                          </p>
                        )}

                        <p className={`text-[11px] leading-relaxed line-clamp-3 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                          {highlightQuery(preview, query)}
                        </p>

                        {t.fts_match && (
                          <span className={`mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded font-medium
                            ${dm ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                            match exato
                          </span>
                        )}
                      </div>

                      {/* Score */}
                      <span className={`shrink-0 text-[10px] font-mono mt-0.5 ${dm ? 'text-slate-600' : 'text-slate-300'}`}>
                        {t.score > 0 ? t.score.toFixed(2) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={`px-5 py-4 border-t shrink-0 flex items-center justify-between gap-3 ${dm ? 'border-white/8' : 'border-slate-100'}`}>
        <p className={`text-[11px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
          {nSel > 0
            ? <><strong className={dm ? 'text-slate-200' : 'text-slate-700'}>{nSel}</strong> trecho{nSel !== 1 ? 's' : ''} selecionado{nSel !== 1 ? 's' : ''}</>
            : 'Selecione os trechos para usar como contexto'}
        </p>
        <div className="flex gap-2">
          <button onClick={onFechar}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${dm ? 'text-slate-400 hover:text-slate-200 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'}`}>
            Cancelar
          </button>
          <button
            onClick={handleInjetar}
            disabled={nSel === 0}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${nSel > 0
                ? dm ? 'bg-accent text-white hover:bg-accent/80' : 'bg-violet-600 text-white hover:bg-violet-700'
                : dm ? 'bg-white/8 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
            Usar como contexto no chat
          </button>
        </div>
      </div>
    </div>
  );
}
