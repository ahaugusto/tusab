import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check, ChevronDown, ChevronRight, Database, Zap, Loader2, CheckSquare, Square } from 'lucide-react';
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

// Agrupa trechos por arquivo dentro de cada canal
function agruparPorArquivo(trechos) {
  // { canal: { arquivo: [trecho, ...] } }
  const resultado = {};
  trechos.forEach((t, idx) => {
    const canal = t.canal || 'desconhecido';
    const arq   = t.arquivo || t.titulo || 'sem_arquivo';
    if (!resultado[canal]) resultado[canal] = {};
    if (!resultado[canal][arq]) resultado[canal][arq] = [];
    resultado[canal][arq].push({ ...t, _idx: idx });
  });
  return resultado;
}

export default function ReferenciarModal({
  darkMode,
  canaisIndexados = [],   // [{ nome, chunks }] — vindos do agentStatus
  queryInicial = '',
  onInjetar,              // ({ arquivos: [{canal, arquivo, titulo, trechos}] }) => void
  onFechar,
}) {
  const [query,          setQuery]          = useState(queryInicial);
  const [buscando,       setBuscando]       = useState(false);
  const [trechos,        setTrechos]        = useState([]);
  const [basesSel,       setBasesSel]       = useState({});     // { nome: true } — bases para buscar
  const [arquivosSel,    setArquivosSel]    = useState({});     // { "canal::arquivo": true } — arquivos marcados
  const [expandidos,     setExpandidos]     = useState({});     // { canal: true }
  const [expandArqs,     setExpandArqs]     = useState({});     // { "canal::arquivo": true } — expande trechos
  const [erro,           setErro]           = useState('');
  const [buscaAmpla,     setBuscaAmpla]     = useState(true);
  const [mostrarBases,   setMostrarBases]   = useState(false);  // dropdown de seleção de bases
  const inputRef  = useRef(null);
  const timerRef  = useRef(null);

  // Inicializa todas as bases selecionadas
  useEffect(() => {
    const sel = {};
    canaisIndexados.forEach(c => { sel[c.nome] = true; });
    setBasesSel(sel);
  }, [canaisIndexados]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const buscar = useCallback(async (q, bases, ampla) => {
    const canaisAtivos = canaisIndexados.filter(c => bases[c.nome]).map(c => c.nome);
    if (!q.trim() || !canaisAtivos.length) { setTrechos([]); return; }
    setBuscando(true);
    setErro('');
    try {
      const res = await buscarTrechos(q.trim(), canaisAtivos, 10, ampla);
      const novos = res.data?.trechos || [];
      setTrechos(novos);
      setArquivosSel({});
      // Expande automaticamente o primeiro canal
      if (novos.length) {
        const primeiroCanal = novos[0].canal;
        setExpandidos({ [primeiroCanal]: true });
      }
    } catch {
      setErro('Erro ao buscar. Verifique se o backend está rodando.');
      setTrechos([]);
    } finally {
      setBuscando(false);
    }
  }, [canaisIndexados]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(query, basesSel, buscaAmpla), 500);
    return () => clearTimeout(timerRef.current);
  }, [query, basesSel, buscaAmpla, buscar]);

  const toggleBase = nome =>
    setBasesSel(prev => ({ ...prev, [nome]: !prev[nome] }));

  const toggleExpand = canal =>
    setExpandidos(prev => ({ ...prev, [canal]: !prev[canal] }));

  const toggleExpandArq = key =>
    setExpandArqs(prev => ({ ...prev, [key]: !prev[key] }));

  const arquivoKey = (canal, arq) => `${canal}::${arq}`;

  const toggleArquivo = (canal, arq) => {
    const key = arquivoKey(canal, arq);
    setArquivosSel(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTodosDoCanal = (canal, agrupado) => {
    const arqs = Object.keys(agrupado[canal] || {});
    const todosOn = arqs.every(a => arquivosSel[arquivoKey(canal, a)]);
    setArquivosSel(prev => {
      const next = { ...prev };
      arqs.forEach(a => { next[arquivoKey(canal, a)] = !todosOn; });
      return next;
    });
  };

  const agrupado = agruparPorArquivo(trechos);

  const nArquivosSel = Object.values(arquivosSel).filter(Boolean).length;

  // Chips das bases selecionadas (para exibição compacta após fechar dropdown)
  const basesSelecionadas = canaisIndexados.filter(c => basesSel[c.nome]);
  const nBasesTotal = canaisIndexados.length;

  const handleInjetar = () => {
    // Coleta um arquivo por entrada selecionada, com todos os seus trechos encontrados
    const payload = [];
    Object.entries(agrupado).forEach(([canal, arquivos]) => {
      Object.entries(arquivos).forEach(([arq, items]) => {
        const key = arquivoKey(canal, arq);
        if (!arquivosSel[key]) return;
        payload.push({
          canal,
          arquivo: arq,
          titulo: items[0]?.titulo || arq,
          trechos: items.map(t => t.trecho || ''),
        });
      });
    });
    if (!payload.length) return;

    // Monta o texto de contexto: [arquivo]\ntrechos do arquivo
    const blocos = payload.map(p => {
      const header = `[${p.arquivo}]`;
      const corpo = p.trechos.join('\n\n…\n\n');
      return `${header}\n${corpo}`;
    });
    onInjetar(blocos.join('\n\n---\n\n'));
  };

  const dm = darkMode;

  return (
    <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden
      ${dm ? 'bg-[#0C1122] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
      style={{ maxHeight: 'min(85vh, 720px)' }}>

      {/* Header */}
      <div className={`px-5 pt-5 pb-4 border-b shrink-0 ${dm ? 'border-white/8' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search size={16} className={dm ? 'text-accent' : 'text-violet-600'} />
            <h2 className="text-sm font-bold">Referenciar no chat</h2>
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

        {/* Linha de bases + busca ampla */}
        <div className="mt-3 flex items-center gap-2">
          {/* Seletor de bases — dropdown quando 3+ bases */}
          <div className="relative flex-1">
            {nBasesTotal <= 2 ? (
              // Chips diretos quando 1-2 bases
              <div className="flex gap-2 flex-wrap">
                {canaisIndexados.map(c => (
                  <button key={c.nome} onClick={() => toggleBase(c.nome)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
                      ${basesSel[c.nome]
                        ? dm ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-violet-50 border-violet-300 text-violet-700'
                        : dm ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                    <Database size={10} />
                    {c.nome}
                  </button>
                ))}
              </div>
            ) : (
              // Dropdown de lista quando 3+ bases
              <div>
                <button
                  onClick={() => setMostrarBases(p => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
                    ${dm ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  <Database size={10} />
                  {basesSelecionadas.length === nBasesTotal
                    ? `Todas as bases (${nBasesTotal})`
                    : `${basesSelecionadas.length} de ${nBasesTotal} bases`}
                  <ChevronDown size={10} className={`transition-transform ${mostrarBases ? 'rotate-180' : ''}`} />
                </button>

                {mostrarBases && (
                  <div className={`absolute top-full mt-1 left-0 z-10 w-64 rounded-xl border shadow-xl overflow-hidden
                    ${dm ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
                    {canaisIndexados.map(c => (
                      <button key={c.nome}
                        onClick={() => toggleBase(c.nome)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors
                          ${dm ? 'hover:bg-white/8 border-b border-white/5 last:border-0' : 'hover:bg-slate-50 border-b border-slate-100 last:border-0'}`}>
                        <div className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center
                          ${basesSel[c.nome]
                            ? dm ? 'bg-accent border-accent' : 'bg-violet-600 border-violet-600'
                            : dm ? 'border-white/20' : 'border-slate-300'}`}>
                          {basesSel[c.nome] && <Check size={8} className="text-white" strokeWidth={3} />}
                        </div>
                        <Database size={10} className={dm ? 'text-accent/60' : 'text-violet-400'} />
                        <span className="flex-1 truncate">{c.nome}</span>
                        <span className={`text-[10px] ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{c.chunks} chunks</span>
                      </button>
                    ))}
                    <button onClick={() => setMostrarBases(false)}
                      className={`w-full text-center text-[11px] py-2 font-medium transition-colors
                        ${dm ? 'text-accent hover:bg-white/5' : 'text-violet-600 hover:bg-violet-50'}`}>
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chips das bases selecionadas (quando 3+, mostra só as ativas como chips removíveis) */}
          {nBasesTotal > 2 && basesSelecionadas.length > 0 && basesSelecionadas.length < nBasesTotal && (
            <div className="flex gap-1 flex-wrap">
              {basesSelecionadas.map(c => (
                <span key={c.nome}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${dm ? 'bg-accent/20 text-accent' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                  {c.nome}
                  <button onClick={() => toggleBase(c.nome)} className="hover:opacity-70"><X size={9} /></button>
                </span>
              ))}
            </div>
          )}

          <button onClick={() => setBuscaAmpla(p => !p)}
            className={`ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all
              ${buscaAmpla
                ? dm ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : dm ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
            <Zap size={10} />
            Busca ampla
          </button>
        </div>
      </div>

      {/* Resultados — agrupados por canal > arquivo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3"
        onClick={() => mostrarBases && setMostrarBases(false)}>
        {erro && (
          <p className="text-xs text-red-400 text-center py-4">{erro}</p>
        )}
        {!buscando && !erro && query.trim() && trechos.length === 0 && (
          <p className={`text-xs text-center py-8 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum resultado para <strong>"{query}"</strong> nas bases selecionadas.
          </p>
        )}
        {!query.trim() && (
          <p className={`text-xs text-center py-8 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            Digite um termo, título ou trecho para buscar nas suas bases.
          </p>
        )}

        {Object.entries(agrupado).map(([canal, arquivos]) => {
          const arqKeys = Object.keys(arquivos);
          const todosOn = arqKeys.every(a => arquivosSel[arquivoKey(canal, a)]);
          const algumOn = arqKeys.some(a => arquivosSel[arquivoKey(canal, a)]);
          const nArqsCanal = arqKeys.length;

          return (
            <div key={canal} className={`rounded-xl border overflow-hidden ${dm ? 'border-white/8' : 'border-slate-200'}`}>
              {/* Cabeçalho do canal */}
              <div className={`flex items-center gap-2 px-3 py-2.5 ${dm ? 'bg-white/5' : 'bg-slate-50'}`}>
                <button onClick={() => toggleExpand(canal)} className="flex items-center gap-2 flex-1 text-left">
                  {expandidos[canal] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Database size={12} className={dm ? 'text-accent' : 'text-violet-500'} />
                  <span className="text-xs font-semibold">{canal}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dm ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                    {nArqsCanal} arquivo{nArqsCanal !== 1 ? 's' : ''}
                  </span>
                </button>
                {/* Selecionar/desselecionar todos do canal */}
                <button
                  onClick={() => toggleTodosDoCanal(canal, agrupado)}
                  className={`flex items-center gap-1 text-[10px] font-medium transition-colors
                    ${algumOn
                      ? dm ? 'text-accent hover:text-accent/70' : 'text-violet-600 hover:text-violet-800'
                      : dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                  {todosOn ? <CheckSquare size={12} /> : algumOn ? <CheckSquare size={12} className="opacity-50" /> : <Square size={12} />}
                  {todosOn ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>

              {/* Lista de arquivos */}
              {expandidos[canal] && (
                <div className={`divide-y ${dm ? 'divide-white/5' : 'divide-slate-100'}`}>
                  {arqKeys.map(arq => {
                    const key = arquivoKey(canal, arq);
                    const items = arquivos[arq];
                    const sel = !!arquivosSel[key];
                    const expandArq = !!expandArqs[key];
                    const titulo = items[0]?.titulo || arq.replace('.txt', '');
                    const isYt = items[0]?.aba === 'youtube' || !!items[0]?.link;
                    const icon = isYt ? '🎬' : items[0]?.aba === 'texto' ? '📝' : '📄';
                    const melhorTrecho = items[0]?.trecho || '';
                    const preview = melhorTrecho.replace(/^CONTEUDO:\n/, '').slice(0, 200);

                    return (
                      <div key={key}
                        className={`transition-colors
                          ${sel
                            ? dm ? 'bg-accent/8 border-l-2 border-accent' : 'bg-violet-50 border-l-2 border-violet-500'
                            : ''
                          }`}>
                        {/* Linha do arquivo — clica para selecionar */}
                        <div
                          className={`px-3 py-2.5 flex gap-3 cursor-pointer
                            ${!sel ? (dm ? 'hover:bg-white/5' : 'hover:bg-slate-50') : ''}`}
                          onClick={() => toggleArquivo(canal, arq)}>

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
                              <p className="text-[12px] font-semibold leading-tight line-clamp-2 flex-1">
                                {highlightQuery(titulo, query)}
                              </p>
                              {items[0]?.data && (
                                <span className={`text-[10px] shrink-0 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>{items[0].data}</span>
                              )}
                            </div>

                            {/* Preview do melhor trecho */}
                            <p className={`text-[11px] leading-relaxed line-clamp-2 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                              {highlightQuery(preview, query)}
                            </p>

                            {/* Info: quantos trechos encontrados nesse arquivo */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`text-[10px] ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                                {items.length} trecho{items.length !== 1 ? 's' : ''} encontrado{items.length !== 1 ? 's' : ''}
                              </span>
                              {items.some(t => t.fts_match) && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium
                                  ${dm ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                                  match exato
                                </span>
                              )}
                              {/* Toggle para ver os trechos individuais */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleExpandArq(key); }}
                                className={`text-[10px] underline underline-offset-2 transition-colors
                                  ${dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                {expandArq ? 'Ocultar trechos' : 'Ver trechos'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Trechos expandidos (somente leitura) */}
                        {expandArq && (
                          <div className={`mx-3 mb-2 rounded-lg overflow-hidden divide-y text-[11px]
                            ${dm ? 'bg-white/4 divide-white/5 border border-white/8' : 'bg-slate-50 divide-slate-100 border border-slate-200'}`}>
                            {items.map((t, ti) => (
                              <div key={ti} className="px-3 py-2">
                                {t.timestamp_inicio > 0 && (
                                  <span className={`text-[10px] font-mono mr-2 ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {Math.floor(t.timestamp_inicio / 60)}:{String(t.timestamp_inicio % 60).padStart(2, '0')}
                                  </span>
                                )}
                                <span className={dm ? 'text-slate-400' : 'text-slate-500'}>
                                  {highlightQuery((t.trecho || '').replace(/^CONTEUDO:\n/, '').slice(0, 300), query)}
                                  {(t.trecho || '').length > 300 ? '…' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`px-5 py-4 border-t shrink-0 ${dm ? 'border-white/8' : 'border-slate-100'}`}>
        {/* Info sobre o que acontece ao confirmar */}
        {nArquivosSel > 0 && (
          <p className={`text-[11px] mb-3 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            <strong className={dm ? 'text-slate-300' : 'text-slate-600'}>{nArquivosSel} arquivo{nArquivosSel !== 1 ? 's' : ''}</strong> selecionado{nArquivosSel !== 1 ? 's' : ''} — o conteúdo será indexado como contexto no chat.
            {nArquivosSel > 1 && <span className={`ml-1 ${dm ? 'text-accent' : 'text-violet-600'}`}>Conectando {new Set(Object.entries(arquivosSel).filter(([,v]) => v).map(([k]) => k.split('::')[0])).size} base{new Set(Object.entries(arquivosSel).filter(([,v]) => v).map(([k]) => k.split('::')[0])).size !== 1 ? 's' : ''}.</span>}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className={`text-[11px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            {nArquivosSel === 0 && 'Selecione arquivos para usar como contexto'}
          </p>
          <div className="flex gap-2">
            <button onClick={onFechar}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${dm ? 'text-slate-400 hover:text-slate-200 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'}`}>
              Cancelar
            </button>
            <button
              onClick={handleInjetar}
              disabled={nArquivosSel === 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${nArquivosSel > 0
                  ? dm ? 'bg-accent text-white hover:bg-accent/80' : 'bg-violet-600 text-white hover:bg-violet-700'
                  : dm ? 'bg-white/8 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}>
              Usar como contexto no chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
