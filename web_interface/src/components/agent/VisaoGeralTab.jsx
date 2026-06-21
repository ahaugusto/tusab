/**
 * @file VisaoGeralTab.jsx
 * @description Painel de visão geral — inventário completo da ferramenta
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRepositorio, fetchAgentStatus, fetchHistory, fetchChatStats } from '../../services/api';
import {
  Database, FileText, Brain, Play, BookOpen, AlignLeft,
  Search, RefreshCw, ChevronDown, ChevronUp, MessageSquare,
  Image, Music,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024)         return `${b} B`;
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(str) {
  if (!str) return '—';
  if (typeof str === 'number') return new Date(str * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return str.length > 10 ? str.slice(0, 10) : str;
}

function Badge({ children, color = 'slate' }) {
  const map = {
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    sky:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    red:    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    pink:   'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    slate:  'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-400',
  };
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${map[color] || map.slate}`}>{children}</span>;
}

// Classifica cada item de "documentos" por subtipo
const _AUDIO_TIPOS  = new Set(['mp3','wav','m4a','ogg','flac','opus','aac']);
const _IMG_TIPOS    = new Set(['png','jpg','jpeg','webp','bmp','tiff','tif']);

function subtipoDoc(item) {
  const t = (item.tipo || '').toLowerCase();
  if (_AUDIO_TIPOS.has(t)) return 'audio';
  if (_IMG_TIPOS.has(t))   return 'imagem';
  return 'doc'; // pdf, docx, xlsx, csv, txt → trata como doc
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VisaoGeralTab({ darkMode, btnFocus }) {
  const { t } = useTranslation();
  const [repo,       setRepo]       = React.useState(null);
  const [agent,      setAgent]      = React.useState(null);
  const [history,    setHistory]    = React.useState([]);
  const [chatStats,  setChatStats]  = React.useState({});
  const [loading,    setLoading]    = React.useState(true);
  const [busca,      setBusca]      = React.useState('');
  const [expanded,   setExpanded]   = React.useState({});
  const [filtroTipo, setFiltroTipo] = React.useState('todos');

  const load = async () => {
    setLoading(true);
    try {
      const [r, a, h, cs] = await Promise.all([
        fetchRepositorio(), fetchAgentStatus(), fetchHistory(), fetchChatStats(),
      ]);
      setRepo(r.data);
      setAgent(a.data);
      setHistory(h.data || []);
      setChatStats(cs.data || {});
    } catch { /* ignore */ }
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  const toggleExpand = (nome) => setExpanded(prev => ({ ...prev, [nome]: !prev[nome] }));

  // ── Derivações ───────────────────────────────────────────────────────────────

  const repoCanais   = repo?.canais || [];
  const indexados    = agent?.canais_indexados || [];

  // Índice por nome
  const indexMap = React.useMemo(() => {
    const m = {};
    indexados.forEach(c => { m[c.nome] = c; });
    return m;
  }, [indexados]);

  // Mapa de histórico por canal
  const histMap = React.useMemo(() => {
    const m = {};
    (history || []).forEach(h => { m[h.canal] = h; });
    return m;
  }, [history]);

  // Merge: repositório + apenas-indexados (sem arquivos no repo)
  const todosCanais = React.useMemo(() => {
    const nomes = new Set(repoCanais.map(c => c.nome));
    const extras = indexados
      .filter(c => !nomes.has(c.nome))
      .map(c => ({ nome: c.nome, youtube: [], documentos: [], textos: [], videos_mapeados: 0 }));
    return [...repoCanais, ...extras];
  }, [repoCanais, indexados]);

  // Enriquece cada canal separando imagens/áudios de docs genéricos
  const canaisEnriquecidos = React.useMemo(() => todosCanais.map(c => {
    const docs    = (c.documentos || []).filter(d => subtipoDoc(d) === 'doc');
    const imagens = (c.documentos || []).filter(d => subtipoDoc(d) === 'imagem');
    const audios  = (c.documentos || []).filter(d => subtipoDoc(d) === 'audio');
    return { ...c, docs, imagens, audios };
  }), [todosCanais]);

  // Stats globais
  const totalArquivos = canaisEnriquecidos.reduce((s, c) =>
    s + c.youtube.length + c.docs.length + c.imagens.length + c.audios.length + (c.textos || []).length, 0);
  const totalVideosMapeados = canaisEnriquecidos.reduce((s, c) => s + (c.videos_mapeados || 0) + c.youtube.length, 0);
  const totalBytes = canaisEnriquecidos.reduce((s, c) => {
    const soma = (arr) => arr.reduce((a, f) => a + (f.tamanho || 0), 0);
    return s + soma(c.youtube) + soma(c.docs) + soma(c.imagens) + soma(c.audios) + soma(c.textos || []);
  }, 0);
  const totalChunks    = indexados.reduce((s, c) => s + (c.chunks || 0), 0);
  const totalIndexados = indexados.length;
  const totalInteracoes = Object.values(chatStats).reduce((s, cs) => s + (cs.total_interactions || 0), 0);
  const totalRefs       = Object.values(chatStats).reduce((s, cs) => s + (cs.total_refs_used || 0), 0);

  // Filtros
  const FILTROS = [
    { id: 'todos',      label: t('overview.filter_all') },
    { id: 'youtube',    label: `🎬 ${t('overview.filter_youtube')}` },
    { id: 'docs',       label: `📄 ${t('overview.filter_docs')}` },
    { id: 'imagens',    label: `🖼 ${t('overview.filter_images')}` },
    { id: 'audios',     label: `🎵 ${t('overview.filter_audios')}` },
    { id: 'textos',     label: `📝 ${t('overview.filter_texts')}` },
  ];

  const canaisFiltrados = canaisEnriquecidos.filter(c => {
    const q = busca.toLowerCase();
    if (q) {
      const nomeMatch = c.nome.toLowerCase().includes(q);
      const arquivoMatch = [
        ...c.youtube.map(f => f.nome || ''),
        ...c.docs.map(f => f.nome_original || f.titulo || ''),
        ...c.imagens.map(f => f.nome_original || f.titulo || ''),
        ...c.audios.map(f => f.nome_original || f.titulo || ''),
        ...(c.textos || []).map(f => f.nome_original || f.titulo || ''),
      ].some(n => n.toLowerCase().includes(q));
      if (!nomeMatch && !arquivoMatch) return false;
    }
    if (filtroTipo === 'youtube' && c.youtube.length === 0)    return false;
    if (filtroTipo === 'docs'    && c.docs.length === 0)       return false;
    if (filtroTipo === 'imagens' && c.imagens.length === 0)    return false;
    if (filtroTipo === 'audios'  && c.audios.length === 0)     return false;
    if (filtroTipo === 'textos'  && (c.textos || []).length === 0) return false;
    return true;
  });

  // ── Estilos ──────────────────────────────────────────────────────────────────

  const card   = `rounded-2xl border p-4 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`;
  const lbl    = `text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const val    = `text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`;
  const sub    = `text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`;
  const th     = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const td     = `px-3 py-2.5 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`;
  const trBase = `border-t transition-colors ${darkMode ? 'border-white/5 hover:bg-white/4' : 'border-slate-100 hover:bg-slate-50'}`;
  const trSub  = `border-t transition-colors ${darkMode ? 'border-white/5 bg-black/10 hover:bg-black/15' : 'border-slate-50 bg-slate-50/60 hover:bg-slate-100/60'}`;

  return (
    <div className="space-y-5">

      {/* ── Atualizar ── */}
      <div className="flex justify-end">
        <button onClick={load} disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${btnFocus}
            ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Brain size={14} className="text-violet-400" />
            <span className={lbl}>{t('overview.kpi_projects')}</span>
          </div>
          <div className={val}>{canaisEnriquecidos.length}</div>
          <p className={sub}>{totalIndexados} {t('overview.kpi_indexed')}</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-sky-400" />
            <span className={lbl}>{t('overview.kpi_files')}</span>
          </div>
          <div className={val}>{totalArquivos}</div>
          <p className={sub}>{fmtBytes(totalBytes)} {t('overview.kpi_size_suffix')}</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-emerald-400" />
            <span className={lbl}>{t('overview.kpi_chunks')}</span>
          </div>
          <div className={val}>{totalChunks.toLocaleString()}</div>
          <p className={sub}>em {totalIndexados} {t('overview.kpi_bases_suffix')}</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Play size={14} className="text-red-400" />
            <span className={lbl}>{t('overview.kpi_videos')}</span>
          </div>
          <div className={val}>{totalVideosMapeados}</div>
          <p className={sub}>{canaisEnriquecidos.reduce((s,c) => s + c.youtube.length, 0)} {t('overview.kpi_transcript_suffix')}</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={14} className="text-amber-400" />
            <span className={lbl}>{t('overview.kpi_interactions')}</span>
          </div>
          <div className={val}>{totalInteracoes.toLocaleString()}</div>
          <p className={sub}>{totalRefs.toLocaleString()} {t('overview.kpi_refs_suffix')}</p>
        </div>
      </div>

      {/* ── Filtros + busca ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 flex-1 min-w-[160px] rounded-xl border px-2.5 py-1.5 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30
          ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
          <Search size={11} className={`shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder={t('overview.search_placeholder')}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 min-w-0 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
          {busca && (
            <button onClick={() => setBusca('')} className={`shrink-0 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        {FILTROS.map(f => (
          <button key={f.id} onClick={() => setFiltroTipo(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
              ${filtroTipo === f.id
                ? darkMode ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-violet-50 border-violet-300 text-violet-700'
                : darkMode ? 'border-white/10 text-slate-400 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Tabela de projetos ─────────────────────────────────────────────── */}
      {loading ? (
        <div className={`rounded-2xl border p-12 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('overview.loading')}</span>
          </div>
        </div>
      ) : canaisFiltrados.length === 0 ? (
        <div className={`rounded-2xl border p-10 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl mb-2">📭</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {busca ? `${t('overview.empty_search_prefix')} "${busca}"` : t('overview.empty')}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <table className="w-full">
            <thead>
              <tr className={darkMode ? 'bg-white/4 border-b border-white/10' : 'bg-slate-50 border-b border-slate-100'}>
                <th className={th}>{t('overview.col_project')}</th>
                <th className={`${th} text-right`}>🎬 {t('overview.filter_youtube')}</th>
                <th className={`${th} text-right`}>📄 {t('overview.filter_docs')}</th>
                <th className={`${th} text-right`}>🖼 {t('overview.filter_images')}</th>
                <th className={`${th} text-right`}>🎵 {t('overview.filter_audios')}</th>
                <th className={`${th} text-right`}>📝 {t('overview.filter_texts')}</th>
                <th className={`${th} text-right`}>{t('overview.col_size')}</th>
                <th className={`${th} text-center`}>{t('overview.col_bm25')}</th>
                <th className={`${th} text-right`}>{t('overview.col_coverage')}</th>
                <th className={`${th} text-right`}>{t('overview.col_interactions')}</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {canaisFiltrados.map(canal => {
                const idx    = indexMap[canal.nome];
                const hist   = histMap[canal.nome];
                const cstats = chatStats[canal.nome] || null;
                const bytes  = [
                  ...canal.youtube, ...canal.docs, ...canal.imagens, ...canal.audios, ...(canal.textos || [])
                ].reduce((s, f) => s + (f.tamanho || 0), 0);
                const totalArq = canal.youtube.length + canal.docs.length + canal.imagens.length + canal.audios.length + (canal.textos || []).length + (canal.videos_mapeados || 0);
                const isOpen = expanded[canal.nome];

                return (
                  <React.Fragment key={canal.nome}>
                    <tr className={trBase}>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{idx ? '🧠' : '📁'}</span>
                          <p className={`font-bold truncate max-w-[140px] ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal.nome}</p>
                        </div>
                      </td>
                      <td className={`${td} text-right`}>
                        {canal.youtube.length > 0 || canal.videos_mapeados > 0 ? (
                          <div className="flex flex-col items-end gap-0">
                            <span className="font-mono font-bold">{canal.youtube.length}</span>
                            {canal.videos_mapeados > 0 && canal.youtube.length === 0 && (
                              <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{canal.videos_mapeados} {t('overview.mapped_suffix')}</span>
                            )}
                          </div>
                        ) : <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}
                      </td>
                      <td className={`${td} text-right font-mono`}>{canal.docs.length || <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}</td>
                      <td className={`${td} text-right font-mono`}>{canal.imagens.length || <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}</td>
                      <td className={`${td} text-right font-mono`}>{canal.audios.length || <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}</td>
                      <td className={`${td} text-right font-mono`}>{(canal.textos || []).length || <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}</td>
                      <td className={`${td} text-right font-mono text-[10px]`}>{bytes > 0 ? fmtBytes(bytes) : <span className={`${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}</td>
                      <td className={`${td} text-center`}>
                        {idx ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge color="green">{idx.chunks} {t('overview.chunks_suffix')}</Badge>
                            <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{fmtDate(idx.indexed_at)}</span>
                          </div>
                        ) : (
                          <Badge color="amber">{t('overview.not_indexed')}</Badge>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        {hist?.cobertura != null ? (
                          <span className={`font-bold text-xs ${hist.cobertura >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {hist.cobertura}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className={`${td} text-right`}>
                        {cstats ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-bold text-xs ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>{cstats.total_interactions}</span>
                            <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{cstats.total_refs_used} {t('overview.refs_suffix')}</span>
                          </div>
                        ) : <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>—</span>}
                      </td>
                      <td className={td}>
                        {totalArq > 0 && (
                          <button onClick={() => toggleExpand(canal.nome)}
                            className={`p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* ── Arquivos expandidos ──────────────────────────────── */}
                    {isOpen && (
                      <>
                        {canal.youtube.map((f, i) => (
                          <tr key={`yt-${i}`} className={trSub}>
                            <td className={`${td} pl-10`} colSpan={2}>
                              <div className="flex items-center gap-1.5">
                                <Play size={10} className="text-red-400 shrink-0" />
                                <span className={`truncate max-w-[200px] text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.nome}</span>
                              </div>
                            </td>
                            <td colSpan={4} />
                            <td className={`${td} text-right font-mono text-[10px]`}>{fmtBytes(f.tamanho)}</td>
                            <td /><td />
                            <td className={`${td} text-right text-[10px] font-mono`}>{f.data || '—'}</td>
                            <td />
                          </tr>
                        ))}
                        {canal.docs.map((f, i) => (
                          <tr key={`doc-${i}`} className={trSub}>
                            <td className={`${td} pl-10`} colSpan={2}>
                              <div className="flex items-center gap-1.5">
                                <BookOpen size={10} className="text-sky-400 shrink-0" />
                                <span className={`truncate max-w-[200px] text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.nome_original || f.titulo || f.id}</span>
                              </div>
                            </td>
                            <td className={`${td} text-right`}><Badge color="sky">{(f.tipo || 'doc').toUpperCase()}</Badge></td>
                            <td colSpan={3} />
                            <td className={`${td} text-right font-mono text-[10px]`}>{fmtBytes(f.tamanho)}</td>
                            <td /><td />
                            <td className={`${td} text-right text-[10px] font-mono`}>{f.data || '—'}</td>
                            <td />
                          </tr>
                        ))}
                        {canal.imagens.map((f, i) => (
                          <tr key={`img-${i}`} className={trSub}>
                            <td className={`${td} pl-10`} colSpan={2}>
                              <div className="flex items-center gap-1.5">
                                <Image size={10} className="text-pink-400 shrink-0" />
                                <span className={`truncate max-w-[200px] text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.nome_original || f.titulo || f.id}</span>
                              </div>
                            </td>
                            <td colSpan={2} />
                            <td className={`${td} text-right`}><Badge color="pink">{(f.tipo || 'img').toUpperCase()}</Badge></td>
                            <td colSpan={2} />
                            <td className={`${td} text-right font-mono text-[10px]`}>{fmtBytes(f.tamanho)}</td>
                            <td /><td />
                            <td className={`${td} text-right text-[10px] font-mono`}>{f.data || '—'}</td>
                            <td />
                          </tr>
                        ))}
                        {canal.audios.map((f, i) => (
                          <tr key={`aud-${i}`} className={trSub}>
                            <td className={`${td} pl-10`} colSpan={2}>
                              <div className="flex items-center gap-1.5">
                                <Music size={10} className="text-amber-400 shrink-0" />
                                <span className={`truncate max-w-[200px] text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.nome_original || f.titulo || f.id}</span>
                              </div>
                            </td>
                            <td colSpan={3} />
                            <td className={`${td} text-right`}><Badge color="amber">{(f.tipo || 'mp3').toUpperCase()}</Badge></td>
                            <td />
                            <td className={`${td} text-right font-mono text-[10px]`}>{fmtBytes(f.tamanho)}</td>
                            <td /><td />
                            <td className={`${td} text-right text-[10px] font-mono`}>{f.data || '—'}</td>
                            <td />
                          </tr>
                        ))}
                        {(canal.textos || []).map((f, i) => (
                          <tr key={`txt-${i}`} className={trSub}>
                            <td className={`${td} pl-10`} colSpan={2}>
                              <div className="flex items-center gap-1.5">
                                <AlignLeft size={10} className="text-violet-400 shrink-0" />
                                <span className={`truncate max-w-[200px] text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{f.nome_original || f.titulo || f.id}</span>
                              </div>
                            </td>
                            <td colSpan={4} />
                            <td className={`${td} text-right`}><Badge color="violet">{t('overview.badge_text')}</Badge></td>
                            <td />
                            <td className={`${td} text-right font-mono text-[10px]`}>{fmtBytes(f.tamanho)}</td>
                            <td /><td />
                            <td className={`${td} text-right text-[10px] font-mono`}>{f.data || '—'}</td>
                            <td />
                          </tr>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div className={`px-4 py-2.5 border-t text-[10px] flex items-center gap-3 ${darkMode ? 'border-white/8 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <span>{canaisFiltrados.length} {t('overview.footer_projects')}</span>
            <span>·</span>
            <span>{totalArquivos} {t('overview.footer_files')}</span>
            <span>·</span>
            <span>{fmtBytes(totalBytes)}</span>
            <span>·</span>
            <span>{totalChunks.toLocaleString()} {t('overview.footer_chunks')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
