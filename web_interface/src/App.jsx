import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import {
  Pause, Square, Activity, FileText, Video, Info, HelpCircle,
  Database, Zap, Terminal, Sun, Moon, Brain, Link2, CheckCircle2,
  AlertTriangle, XCircle, Loader2, BarChart3, Menu, X,
  ShieldCheck, ShieldOff, ShieldAlert, CloudOff, KeyRound,
  Trophy, Globe, MicOff, Scissors, Bot, Sparkles, Send,
  BookOpen, Eye, EyeOff, ExternalLink, RefreshCw, ArrowUp, FolderOpen, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = "http://localhost:8001";
const btnFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

const LANGS = ['pt', 'en', 'es'];

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusDot({ isRunning, isPaused }) {
  if (!isRunning) return <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" aria-hidden="true" />;
  if (isPaused)   return <span className="w-2 h-2 rounded-full bg-warning shrink-0" aria-hidden="true" />;
  return              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden="true" />;
}

function logMeta(msg, darkMode) {
  if (msg.includes('✅') || msg.includes('OK!') || msg.includes('CUMPRIDA') || msg.includes('FINALIZADO') || msg.includes('LOCAL CONCLUÍDA'))
    return { color: 'text-secondary font-medium', label: 'sucesso' };
  if (msg.includes('❌') || msg.includes('Erro') || msg.includes('ERRO'))
    return { color: 'text-danger font-medium', label: 'erro' };
  if (msg.includes('⚠️') || msg.includes('Ignorado') || msg.includes('Inconsist') || msg.includes('PULADO'))
    return { color: 'text-warning', label: 'aviso' };
  if (msg.includes('⏸️') || msg.includes('Pausa'))
    return { color: 'text-warning', label: 'pausa' };
  if (msg.includes('🧠') || msg.includes('ENGINE') || msg.includes('==='))
    return { color: `${darkMode ? 'text-violet-300' : 'text-violet-700'} font-semibold`, label: 'sistema' };
  if (msg.includes('📡') || msg.includes('mapeado') || msg.includes('Mapeando'))
    return { color: darkMode ? 'text-cyan-300' : 'text-cyan-700', label: 'mapeamento' };
  if (msg.includes('☁️') || msg.includes('Drive') || msg.includes('⬆️') || msg.includes('🔄'))
    return { color: darkMode ? 'text-violet-300' : 'text-violet-600', label: 'drive' };
  if (msg.includes('🛑') || msg.includes('Cancelamento'))
    return { color: 'text-danger font-medium', label: 'cancelado' };
  return { color: darkMode ? 'text-slate-300' : 'text-slate-600', label: 'info' };
}

// ── Ollama Setup ───────────────────────────────────────────────────────────

function OllamaSetup({ darkMode, ollamaStatus, setOllamaStatus, btnFocus, apiBase }) {
  const [pullProgress, setPullProgress] = React.useState(null);
  const [pulling, setPulling] = React.useState(false);
  const hasModel = ollamaStatus.models && ollamaStatus.models.length > 0;
  const modelName = hasModel ? ollamaStatus.models[0] : 'llama3.2:1b';

  const refresh = () => axios.get(`${apiBase}/agent/ollama/status`).then(r => setOllamaStatus(r.data)).catch(() => {});

  React.useEffect(() => { refresh(); }, []);

  React.useEffect(() => {
    if (!pulling) return;
    const iv = setInterval(async () => {
      try {
        const r = await axios.get(`${apiBase}/agent/ollama/pull-progress`);
        setPullProgress(r.data);
        if (r.data.status === 'done' || r.data.status === 'error') {
          setPulling(false);
          const s = await axios.get(`${apiBase}/agent/ollama/status`);
          setOllamaStatus(s.data);
        }
      } catch {}
    }, 800);
    return () => clearInterval(iv);
  }, [pulling]);

  const startPull = async () => {
    setPulling(true);
    setPullProgress({ status: 'pulling', pct: 0, message: 'Iniciando...' });
    await axios.post(`${apiBase}/agent/ollama/pull`).catch(() => {});
  };

  return (
    <div className={`rounded-xl p-4 space-y-3 border ${darkMode ? 'bg-secondary/5 border-secondary/20' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${ollamaStatus.running ? 'bg-secondary animate-pulse' : 'bg-slate-400'}`} />
        <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {ollamaStatus.running ? 'Ollama ativo' : 'Ollama não detectado'}
        </span>
      </div>

      {!ollamaStatus.running && (
        <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          O Ollama será iniciado automaticamente pelo app. Se não iniciar, instale em{' '}
          <a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">ollama.com</a>.
        </p>
      )}

      {ollamaStatus.running && !hasModel && !pulling && (
        <div className="space-y-2">
          <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Nenhum modelo detectado. Baixe o <strong>llama3.2:1b</strong> (~1.3 GB) ou verifique se ja instalou.
          </p>
          <div className="flex gap-2">
            <button onClick={startPull}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors bg-secondary/20 text-secondary hover:bg-secondary/30 ${btnFocus}`}>
              Baixar Modelo
            </button>
            <button onClick={refresh} title="Verificar novamente"
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {ollamaStatus.running && hasModel && (
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-[11px] font-medium text-secondary`}>
            <CheckCircle2 size={13} /> Pronto: <span className="font-mono">{modelName}</span>
          </div>
          <button onClick={refresh} title="Atualizar"
            className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            <RefreshCw size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen({ darkMode, history, repositorio, agentStatus, onNavigate, btnFocus }) {
  const totalArquivos = (repositorio.youtube?.length || 0) + (repositorio.documentos?.length || 0) + (repositorio.textos?.length || 0);
  const totalCanais   = history.length;
  const configured    = agentStatus.configured;
  const indexed       = agentStatus.canais_indexados?.length > 0;

  const cards = [
    {
      id:       'extracao',
      icon:     '🎬',
      title:    'Extrair Canal YouTube',
      desc:     totalCanais > 0 ? `${totalCanais} canal${totalCanais !== 1 ? 'is' : ''} extraído${totalCanais !== 1 ? 's' : ''}` : 'Comece aqui — cole a URL de um canal',
      color:    'primary',
      badge:    totalCanais > 0 ? String(totalCanais) : null,
      primary:  true,
    },
    {
      id:       'repositorio',
      icon:     '📚',
      title:    'Repositório',
      desc:     totalArquivos > 0 ? `${totalArquivos} arquivo${totalArquivos !== 1 ? 's' : ''} indexado${totalArquivos !== 1 ? 's' : ''}` : 'Gerencie seu banco de conhecimento',
      color:    'accent',
      badge:    totalArquivos > 0 ? String(totalArquivos) : null,
      primary:  false,
    },
    {
      id:       'relatorio',
      icon:     '📊',
      title:    'Relatório',
      desc:     totalCanais > 0 ? `${totalCanais} canal${totalCanais !== 1 ? 'is' : ''} disponível${totalCanais !== 1 ? 's' : ''}` : 'Veja o status das suas extrações',
      color:    'secondary',
      badge:    totalCanais > 0 ? String(totalCanais) : null,
      primary:  false,
    },
    {
      id:       'agente',
      icon:     '⚙️',
      title:    'Configurar Agente IA',
      desc:     configured ? (indexed ? 'Agente pronto para uso' : 'Indexe uma base para usar o chat') : 'Configure o provedor de IA',
      color:    configured && indexed ? 'secondary' : 'primary',
      badge:    configured ? '✓' : null,
      primary:  false,
    },
  ];

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-6 py-8 ${darkMode ? 'bg-[#080C18]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>BrainIAc</h1>
        </div>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Transforme qualquer canal do YouTube em conhecimento consultável
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className={`relative p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${btnFocus}
              ${card.primary
                ? darkMode ? 'bg-primary/15 border-primary/30 hover:bg-primary/20' : 'bg-violet-50 border-violet-200 hover:bg-violet-100'
                : darkMode ? 'bg-white/4 border-white/10 hover:bg-white/8 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
            {card.badge && (
              <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full
                ${card.color === 'secondary' ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'
                  : darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                {card.badge}
              </span>
            )}
            <span className="text-3xl mb-3 block">{card.icon}</span>
            <p className={`text-sm font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</p>
            <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{card.desc}</p>
          </button>
        ))}
      </div>

      {/* Skip */}
      <button
        onClick={() => onNavigate('extracao')}
        className={`mt-8 text-xs ${darkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
        Entrar diretamente na ferramenta →
      </button>
    </div>
  );
}


// ── Repositório Tab ───────────────────────────────────────────────────────────

function RepositorioTab({ darkMode, repositorio, setRepositorio, history, btnFocus, apiBase, onSetCanal }) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [mode, setMode]       = React.useState('texto'); // 'texto' | 'arquivo'
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [file, setFile]       = React.useState(null);
  const fileRef = React.useRef(null);

  const reload = () => axios.get(`${apiBase}/repositorio`).then(r => setRepositorio(r.data)).catch(() => {});

  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    await axios.post(`${apiBase}/cerebro/texto`, { titulo: title.trim(), conteudo: text.trim() }).catch(() => {});
    reload(); setShowAdd(false); setTitle(''); setText(''); setSaving(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    const form = new FormData();
    form.append('arquivo', file);
    await axios.post(`${apiBase}/cerebro/upload`, form).catch(() => {});
    reload(); setShowAdd(false); setFile(null); setSaving(false);
  };

  const handleDelete = async (tipo, id) => {
    await axios.delete(`${apiBase}/cerebro/arquivo/${tipo}/${id}`).catch(() => {});
    reload();
  };

  const totalYT  = repositorio.youtube?.length || 0;
  const totalDoc = (repositorio.documentos?.length || 0) + (repositorio.textos?.length || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Repositório de Conhecimento</h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{totalYT + totalDoc} arquivo{totalYT + totalDoc !== 1 ? 's' : ''} na base</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
          + Adicionar
        </button>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex gap-2">
            {['texto', 'arquivo'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${mode === m ? 'bg-primary/20 text-primary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                {m === 'texto' ? 'Colar texto' : 'Upload de arquivo'}
              </button>
            ))}
          </div>

          {mode === 'texto' ? (
            <>
              <input placeholder="Título do conteúdo" value={title} onChange={e => setTitle(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
              <textarea placeholder="Cole o texto aqui..." value={text} onChange={e => setText(e.target.value)} rows={6}
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none resize-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
              <button onClick={handleSaveText} disabled={saving || !title.trim() || !text.trim()}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
                {saving ? 'Salvando...' : 'Salvar texto'}
              </button>
            </>
          ) : (
            <>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${darkMode ? 'border-white/15 hover:border-primary/40' : 'border-slate-200 hover:border-violet-300'}`}
                onClick={() => fileRef.current?.click()}>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {file ? file.name : 'Clique para selecionar PDF, DOCX, TXT ou MD'}
                </p>
                <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  Suporte: .pdf .docx .txt .md
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
                onChange={e => setFile(e.target.files[0] || null)} />
              <button onClick={handleUpload} disabled={saving || !file}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-accent/20 text-accent hover:bg-accent/30 ${btnFocus}`}>
                {saving ? 'Processando...' : 'Fazer upload'}
              </button>
            </>
          )}
        </div>
      )}

      {/* YouTube files */}
      {totalYT > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
            <span className="text-sm">🎬</span>
            <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>YouTube</p>
            <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{totalYT} arquivo{totalYT !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-white/5">
            {repositorio.youtube.map((f, i) => (
              <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.nome}</p>
                  <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{f.data} · {(f.tamanho / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User documents */}
      {(repositorio.documentos?.length > 0 || repositorio.textos?.length > 0) && (
        <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
            <span className="text-sm">📎</span>
            <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>Documentos adicionados</p>
            <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{totalDoc} item{totalDoc !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-white/5">
            {[...(repositorio.documentos || []).map(d => ({...d, tipo_grupo: 'documentos'})),
              ...(repositorio.textos || []).map(d => ({...d, tipo_grupo: 'textos'}))
            ].map((item, i) => (
              <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                <span className="text-sm shrink-0">{item.tipo_grupo === 'textos' ? '📝' : '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {item.titulo || item.nome_original}
                  </p>
                  <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    {item.data} · {item.tipo?.toUpperCase()} · {item.chars?.toLocaleString()} chars
                  </p>
                </div>
                <button onClick={() => handleDelete(item.tipo_grupo, item.id)}
                  className={`p-1.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                  aria-label="Remover">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalYT === 0 && totalDoc === 0 && (
        <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl mb-3">📭</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Repositório vazio</p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Extraia um canal ou adicione documentos para começar</p>
        </div>
      )}
    </div>
  );
}


// ── Relatório Tab ─────────────────────────────────────────────────────────────

function RelatorioTab({ darkMode, history, btnFocus, apiBase }) {
  const [canal,   setCanal]   = React.useState('');
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [filtro,  setFiltro]  = React.useState('todos');

  React.useEffect(() => {
    if (history.length > 0 && !canal) setCanal(history[0].canal);
  }, [history]);

  React.useEffect(() => {
    if (!canal) return;
    setLoading(true);
    axios.get(`${apiBase}/relatorio/${encodeURIComponent(canal)}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [canal]);

  const videos = data?.videos || [];
  const filtrados = filtro === 'todos' ? videos : videos.filter(v => v.Status === filtro);
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* Canal selector */}
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
              { label: 'Total',         value: stats.total,        color: 'primary'   },
              { label: 'Extraídos',     value: stats.sucesso,      color: 'secondary' },
              { label: 'Sem legenda',   value: stats.sem_legenda,  color: 'slate'     },
              { label: 'Cobertura',     value: `${stats.cobertura}%`, color: stats.cobertura >= 80 ? 'secondary' : 'warning' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 border text-center ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-xl font-bold ${s.color === 'secondary' ? 'text-secondary' : s.color === 'warning' ? 'text-warning' : s.color === 'primary' ? 'text-primary' : darkMode ? 'text-white' : 'text-slate-800'}`}>{s.value}</p>
                <p className={`text-[10px] uppercase font-bold mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex gap-1.5">
            {[['todos','Todos'], ['Sucesso','Extraídos'], ['Sem Legenda','Sem legenda'], ['Legenda Curta','Leg. curta']].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${filtro === v ? 'bg-primary/20 text-primary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Table */}
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


// ── Onboarding ─────────────────────────────────────────────────────────────

function Onboarding({ onDone }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const STEPS = [
    { icon: Brain,       title: t('onboarding.s1_title'), body: t('onboarding.s1_body') },
    { icon: Link2,       title: t('onboarding.s2_title'), body: t('onboarding.s2_body') },
    { icon: ShieldCheck, title: t('onboarding.s3_title'), body: t('onboarding.s3_body') },
    { icon: Zap,         title: t('onboarding.s4_title'), body: t('onboarding.s4_body') },
    { icon: Bot,         title: t('onboarding.s5_title'), body: t('onboarding.s5_body') },
  ];
  const total = STEPS.length;
  const current = STEPS[step];
  const Icon = current.icon;

  const finish = () => {
    localStorage.setItem('brainiac_onboarded', '1');
    onDone();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-[#0C1122] border border-white/15 rounded-2xl p-8 max-w-md w-full shadow-2xl"
      >
        {/* Step dots */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <button onClick={finish} className={`text-[11px] text-slate-500 hover:text-slate-300 transition-colors ${btnFocus}`}>
            {t('onboarding.skip')}
          </button>
        </div>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
          <Icon size={22} className="text-primary" />
        </div>

        {/* Content */}
        <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{current.body}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            aria-label={t('onboarding.back')}
            className={`text-xs text-slate-500 hover:text-slate-300 disabled:opacity-0 transition-colors ${btnFocus}`}
          >
            ← {t('onboarding.back')}
          </button>
          <span className="text-[11px] text-slate-600">
            {step + 1} {t('onboarding.step_of')} {total}
          </span>
          <button
            onClick={step === total - 1 ? finish : () => setStep(s => s + 1)}
            className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors ${btnFocus}`}
          >
            {step === total - 1 ? t('onboarding.finish') : t('onboarding.next')} →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Modal de Seleção de Extração ───────────────────────────────────────────

function ExtractionModal({ onClose, onConfirm, darkMode }) {
  const { t } = useTranslation();
  const ALL_TYPES = [
    { id: 'Videos',    label: t('ops.type_videos'),   icon: '🎬' },
    { id: 'Shorts',    label: t('ops.type_shorts'),   icon: '⚡' },
    { id: 'Ao_Vivo',  label: t('ops.type_lives'),    icon: '🔴' },
    { id: 'Podcasts',  label: t('ops.type_podcasts'), icon: '🎙️' },
    { id: 'Cursos',    label: t('ops.type_courses'),  icon: '📚' },
    { id: 'Playlists', label: t('ops.type_playlists'),icon: '▶️' },
  ];
  const [selected, setSelected] = React.useState(ALL_TYPES.map(t => t.id));
  const allSelected = selected.length === ALL_TYPES.length;

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className={`rounded-2xl p-6 max-w-sm w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('ops.types_modal_title')}
            </h2>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('ops.types_modal_subtitle')}
            </p>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}
            aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Select all */}
        <button
          onClick={() => setSelected(allSelected ? [ALL_TYPES[0].id] : ALL_TYPES.map(t => t.id))}
          className={`w-full text-left text-[11px] font-bold flex items-center gap-2 mb-3 px-1 transition-colors ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'} ${btnFocus}`}>
          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
            ${allSelected ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
            {allSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          {t('ops.types_select_all')}
        </button>

        {/* Checkboxes */}
        <div className="space-y-1 mb-5">
          {ALL_TYPES.map(({ id, label, icon }) => {
            const checked = selected.includes(id);
            return (
              <button key={id} onClick={() => toggle(id)}
                role="checkbox" aria-checked={checked}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${btnFocus}
                  ${checked
                    ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/25'
                    : darkMode ? 'bg-white/3 border-white/8 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${checked ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                  {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
                <span className={`text-xs font-semibold ${checked ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <button onClick={() => onConfirm(selected)}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${btnFocus}`}>
          <Zap size={15} aria-hidden="true" />
          {t('ops.start_confirm')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Modal Guia de Uso ──────────────────────────────────────────────────────

function GuideModal({ onClose, darkMode }) {
  const { t } = useTranslation();
  const steps = [
    { step: 1, color: 'primary',   text: t('guide.step1') },
    { step: 2, color: 'primary',   text: t('guide.step2') },
    { step: 3, color: 'accent',    text: t('guide.step3') },
    { step: 4, color: 'secondary', text: t('guide.step4') },
    { step: 5, color: 'secondary', text: t('guide.step5') },
    { step: 6, color: 'primary',   text: t('guide.step6') },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className={`rounded-2xl p-6 max-w-2xl w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0" aria-hidden="true">
              <HelpCircle size={16} className="text-primary" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('guide.title')}</h2>
              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('guide.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
            aria-label="Fechar guia">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map(({ step, color, text }) => (
            <div key={step} className={`flex gap-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
              <div className={`w-5 h-5 rounded-full bg-${color}/20 text-${color} flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5`} aria-hidden="true">{step}</div>
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}


function PostExtractionModal({ onClose, driveStatus, agentConfigured, onGoToAgent, onDriveAuth, darkMode }) {
  const { t } = useTranslation();
  const driveConnected = driveStatus === 'autenticado';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onClick={e => e.stopPropagation()}
        className={`rounded-2xl p-6 max-w-lg w-full shadow-2xl border ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-secondary" aria-hidden="true" />
              <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {t('modal.title_finished')}
              </h2>
            </div>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('modal.subtitle')}
            </p>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}
            aria-label={t('modal.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Opção Drive / NotebookLM */}
          <div className={`rounded-2xl p-4 border flex flex-col gap-3 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2">
              {driveConnected
                ? <CheckCircle2 size={16} className="text-secondary shrink-0" aria-hidden="true" />
                : <CloudOff size={16} className="text-slate-400 shrink-0" aria-hidden="true" />}
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {t('modal.drive_title')}
              </h3>
            </div>
            <p className={`text-[11px] leading-relaxed flex-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}
              dangerouslySetInnerHTML={{ __html: driveConnected ? t('modal.drive_desc_connected') : t('modal.drive_desc_local') }} />
            <div className="space-y-1.5">
              {driveConnected
                ? <p className="text-[10px] flex items-center gap-1 font-bold text-secondary">
                    <CheckCircle2 size={10} aria-hidden="true" /> {t('drive.connected')}
                  </p>
                : <button onClick={() => { onDriveAuth(); onClose(); }}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors
                      ${darkMode ? 'border-primary/40 text-primary hover:bg-primary/10' : 'border-primary/30 text-primary hover:bg-primary/5'} ${btnFocus}`}>
                    <ShieldCheck size={13} className="shrink-0" aria-hidden="true" />
                    <span>{t('modal.drive_enable')}</span>
                  </button>}
              <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer"
                aria-disabled={!driveConnected}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors
                  ${driveConnected
                    ? darkMode ? 'border-white/20 text-slate-300 hover:bg-white/10' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    : 'border-dashed opacity-40 cursor-not-allowed ' + (darkMode ? 'border-white/15 text-slate-500' : 'border-slate-300 text-slate-400')} ${btnFocus}`}
                onClick={e => { if (!driveConnected) e.preventDefault(); }}>
                <ExternalLink size={12} aria-hidden="true" /> {t('modal.drive_notebooklm')}
              </a>
            </div>
          </div>

          {/* Opção Agente */}
          <div className={`rounded-2xl p-4 border flex flex-col gap-3 ${darkMode ? 'bg-primary/8 border-primary/20' : 'bg-violet-50 border-violet-200'}`}>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-primary shrink-0" aria-hidden="true" />
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {t('modal.agent_title')}
              </h3>
            </div>
            <p className={`text-[11px] leading-relaxed flex-1 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
              {t('modal.agent_desc')}
            </p>
            <div className="space-y-1.5">
              {agentConfigured
                ? <p className="text-[10px] flex items-start gap-1.5 font-bold text-secondary">
                    <CheckCircle2 size={12} className="shrink-0 mt-px" aria-hidden="true" />
                    <span>{t('modal.agent_configured')}</span>
                  </p>
                : <p className={`text-[10px] flex items-start gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Info size={12} className="shrink-0 mt-px" aria-hidden="true" />
                    <span>{t('modal.agent_not_configured')}</span>
                  </p>}
              <button onClick={() => { onGoToAgent(); onClose(); }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors bg-primary text-white hover:bg-primary/85 shadow-sm ${btnFocus}`}>
                <Bot size={12} aria-hidden="true" /> {t('modal.agent_btn')}
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose}
          className={`w-full mt-3 py-2 rounded-xl text-xs font-bold transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} ${btnFocus}`}>
          {t('modal.close')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Toggle compacto do Drive ───────────────────────────────────────────────

function DriveToggle({ driveStatus, driveAuthError, onAuth, onCancel, isRunning, darkMode }) {
  const { t } = useTranslation();

  const isOn       = driveStatus === 'autenticado' || driveStatus === 'em_progresso';
  const isLoading  = driveStatus === 'em_progresso';
  const noCredentials = driveStatus === 'sem_credenciais';
  const toggleDisabled = noCredentials || isRunning || driveStatus === 'autenticado';

  const handleToggle = () => {
    if (isLoading) { onCancel(); return; }
    if (!isOn)     { onAuth(); }
  };

  const statusColor = driveStatus === 'autenticado'
    ? 'text-secondary'
    : driveStatus === 'em_progresso'
    ? 'text-primary'
    : darkMode ? 'text-slate-500' : 'text-slate-600';

  const statusIcon = driveStatus === 'autenticado'
    ? <ShieldCheck size={14} aria-hidden="true" />
    : driveStatus === 'em_progresso'
    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
    : noCredentials
    ? <ShieldAlert size={14} aria-hidden="true" />
    : <ShieldOff size={14} aria-hidden="true" />;

  const statusLabel = driveStatus === 'autenticado'
    ? t('drive.connected')
    : driveStatus === 'em_progresso'
    ? t('drive.waiting')
    : noCredentials
    ? t('drive.no_credentials_title')
    : t('drive.not_authenticated');

  return (
    <div className="space-y-1.5">
      {/* Toggle row */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
        ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}
        role="status" aria-label={t('drive.title')}>

        <div className={`flex items-center gap-2 min-w-0 ${statusColor}`}>
          {statusIcon}
          <div className="min-w-0">
            <p className={`text-[11px] font-bold truncate ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('drive.title')}</p>
            <p className={`text-[10px] truncate ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>

        {/* Switch */}
        <button
          role="switch"
          aria-checked={isOn}
          aria-label={t('drive.aria_open_browser')}
          disabled={toggleDisabled}
          onClick={handleToggle}
          className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200
            disabled:cursor-not-allowed
            ${isOn
              ? driveStatus === 'autenticado' ? 'bg-secondary' : 'bg-primary'
              : darkMode ? 'bg-white/20' : 'bg-slate-300'}
            ${btnFocus}`}>
          {isLoading
            ? <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" aria-hidden="true" />
            : <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
                ${isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />}
        </button>
      </div>

      {/* Erro de autenticação */}
      {(driveStatus === 'erro' || driveAuthError) && (
        <p className="text-[10px] text-danger flex items-center gap-1 px-1" role="alert">
          <AlertTriangle size={10} aria-hidden="true" />
          {driveAuthError || t('drive.error_fallback')}
        </p>
      )}

      {/* Sem credenciais: link de ajuda */}
      {noCredentials && (
        <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer"
          className={`text-[10px] flex items-center gap-1 px-1 underline underline-offset-2 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <ExternalLink size={9} aria-hidden="true" /> {t('drive.how_to')}
        </a>
      )}

      {/* Botão de cancelar quando em progresso */}
      {isLoading && (
        <button onClick={onCancel}
          className={`w-full py-1.5 rounded-lg text-[11px] font-bold border transition-colors
            ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
          {t('drive.cancel_auth')}
        </button>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const { t } = useTranslation();

  const [showOnboarding,   setShowOnboarding]   = useState(() => !localStorage.getItem('brainiac_onboarded'));
  const ALL_TYPES = ['Videos', 'Shorts', 'Ao_Vivo', 'Podcasts', 'Cursos', 'Playlists'];
  const [extractionTypes,  setExtractionTypes]  = useState(ALL_TYPES);
  const [status,           setStatus]           = useState({
    is_running: false, is_paused: false, canal_url: "",
    drive_status: "nao_autenticado", drive_auth_error: null,
    stats: { videos_processed: 0, videos_total: 0, videos_sem_legenda: 0, videos_legenda_curta: 0, files_generated: 0, status: "Ocioso", progress: 0, canal_nome: "", idioma_detectado: "" },
    logs: []
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('brainiac_theme');
    if (saved !== null) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [showGuide,        setShowGuide]        = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [canalInput,       setCanalInput]       = useState("");
  const [canalConfigurado, setCanalConfigurado] = useState("");
  const [canalError,       setCanalError]       = useState("");
  const [configurando,     setConfigurando]     = useState(false);
  const [activeTab,        setActiveTab]        = useState("extracao");

  const [showPostModal,       setShowPostModal]       = useState(false);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const prevExtractionStatus = useRef('');

  const [agentStatus,      setAgentStatus]      = useState({ configured: false, provider: '', canal_indexado: '', index_count: 0, indexed: false, indexing: false, index_logs: [] });
  const [agentProvider,    setAgentProvider]    = useState("gemini");
  const [agentApiKey,      setAgentApiKey]      = useState("");
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [agentKeyError,    setAgentKeyError]    = useState("");
  const [configSaved,      setConfigSaved]      = useState(false);
  const [testingKey,       setTestingKey]       = useState(false);
  const [testKeyResult,    setTestKeyResult]    = useState(null); // { ok, message }
  const [showIndexInfo,    setShowIndexInfo]    = useState(false);
  const [lastIndexLogs,    setLastIndexLogs]    = useState([]);
  const [configOpen,       setConfigOpen]       = useState(true);
  const [indexOpen,        setIndexOpen]        = useState(true);
  const [showAgentHint,    setShowAgentHint]    = useState(false);
  const agentScrollRef = useRef(null);
  const [savingConfig,     setSavingConfig]     = useState(false);
  const [canalMeta,        setCanalMeta]        = useState(null);
  const [ollamaStatus,     setOllamaStatus]     = useState({ running: false, models: [] });
  const [canaisExtras,     setCanaisExtras]     = useState([]);
  const [history,          setHistory]          = useState([]);
  const [useExternalProvider, setUseExternalProvider] = useState(false);
  const [showHome,         setShowHome]         = useState(true);
  const [chatOpen,         setChatOpen]         = useState(false);
  const [repositorio,      setRepositorio]      = useState({ youtube: [], documentos: [], textos: [] });
  const [relatorioCanal,   setRelatorioCanal]   = useState('');
  const [relatorioData,    setRelatorioData]    = useState(null);
  const [showAddDoc,       setShowAddDoc]       = useState(false);
  const [pasteTitle,       setPasteTitle]       = useState('');
  const [pasteText,        setPasteText]        = useState('');
  const [chatMessages,     setChatMessages]     = useState([]);
  const [chatInput,        setChatInput]        = useState("");
  const [chatLoading,      setChatLoading]      = useState(false);
  const chatEndRef      = useRef(null);
  const logContainerRef = useRef(null);
  const mainScrollRef   = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const errorId = "canal-error";


  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); }, [darkMode]);

  // Solicita permissão de notificação na primeira abertura
  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/history`).then(r => setHistory(r.data)).catch(() => {});
    axios.get(`${API_BASE}/repositorio`).then(r => setRepositorio(r.data)).catch(() => {});
  }, []);

  // Sincroniza com mudanças do tema do sistema quando o usuário não definiu preferência
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (localStorage.getItem('brainiac_theme') === null) setDarkMode(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng === 'en' ? 'en' : lng === 'es' ? 'es' : 'pt-BR';
  };

  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('en') ? 'en'
      : i18n.language.startsWith('es') ? 'es' : 'pt-BR';
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/status`);
        setStatus(prev => JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data);
        if (res.data.stats?.canal_nome && !canalConfigurado) setCanalConfigurado(res.data.stats.canal_nome);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [canalConfigurado]);

  useEffect(() => {
    if (status.is_running && status.logs.length > 0 && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs.length, status.is_running]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/agent/status`);
        setAgentStatus(res.data);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/agent/config`).then(r => {
      const hasExternalKey = r.data.provider && r.data.provider !== 'ollama' && r.data.api_key;
      if (hasExternalKey) {
        setAgentProvider(r.data.provider);
        setAgentApiKey('');  // chave nunca pre-carregada — usuario digita quando quiser usar
        setUseExternalProvider(true);
      } else {
        // Sem chave válida — garante Ollama como padrão
        setAgentProvider('ollama');
        setUseExternalProvider(false);
        axios.post(`${API_BASE}/agent/config`, { provider: 'ollama', api_key: '' })
          .then(() => axios.get(`${API_BASE}/agent/status`))
          .then(r => setAgentStatus(r.data))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      axios.get(`${API_BASE}/agent/ollama/status`).then(r => setOllamaStatus(r.data)).catch(() => {});
    }, 5000);
    axios.get(`${API_BASE}/agent/ollama/status`).then(r => setOllamaStatus(r.data)).catch(() => {});
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (activeTab !== 'agente') return;
    axios.get(`${API_BASE}/agent/canal-meta`)
      .then(r => { if (r.data && r.data.canal_nome) setCanalMeta(r.data); })
      .catch(() => {});
  }, [activeTab, agentStatus.canal_indexado]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const attach = (el) => {
      if (!el) return () => {};
      const onScroll = () => setShowScrollTop(el.scrollTop > 300);
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    };
    const d1 = attach(mainScrollRef.current);
    const d2 = attach(agentScrollRef.current);
    return () => { d1(); d2(); };
  }, [activeTab]);

  useEffect(() => {
    if (!agentStatus.indexing && agentStatus.index_logs.length > 0) {
      setLastIndexLogs(agentStatus.index_logs);
    }
  }, [agentStatus.indexing, agentStatus.index_logs]);

  useEffect(() => {
    const s = status.stats.status;
    if (s === 'Finalizado ✓' && prevExtractionStatus.current !== 'Finalizado ✓') {
      setShowPostModal(true);

      const notify = () => new Notification('BrainIAc — Extração concluída!', {
        body: status.stats.videos_processed + ' vídeos extraídos de @' + (status.stats.canal_nome || ''),
        icon: '/logo.png',
      });

      if (Notification.permission === 'granted') {
        notify();
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') notify(); });
      }
    }
    prevExtractionStatus.current = s;
  }, [status.stats.status]);

  const handleConfigurarCanal = async () => {
    if (!canalInput.trim()) { setCanalError(t('channel.error_required')); return; }
    if (!canalInput.includes("@")) {
      setCanalError(t('channel.error_invalid')); return;
    }
    setConfigurando(true); setCanalError("");
    try {
      const res = await axios.post(`${API_BASE}/set-channel`, { canal_url: canalInput.trim() });
      if (res.data.error) { setCanalError(res.data.message); }
      else { setCanalConfigurado(res.data.canal_nome || canalInput); setCanalInput(""); }
    } catch { setCanalError(t('channel.error_server')); }
    setConfigurando(false);
  };

  const handleRemoveApiKey = async () => {
    setAgentApiKey('');
    setTestKeyResult(null);
    setAgentKeyError('');
    await axios.post(`${API_BASE}/agent/config`, { provider: 'ollama', api_key: '' }).catch(() => {});
    setUseExternalProvider(false);
    setAgentProvider('ollama');
    const r = await axios.get(`${API_BASE}/agent/status`).catch(() => null);
    if (r) setAgentStatus(r.data);
  };

  const handleSaveAgentConfig = async () => {
    if (useExternalProvider && !agentApiKey.trim()) { setAgentKeyError(t('agent.key_error_required')); return; }
    setSavingConfig(true); setAgentKeyError(""); setConfigSaved(false); setTestKeyResult(null);
    const provider = useExternalProvider ? agentProvider : 'ollama';
    const apiKey   = useExternalProvider ? agentApiKey.trim() : '';
    try {
      const res = await axios.post(`${API_BASE}/agent/config`, {
        provider, api_key: apiKey
      });
      if (res.data.error) setAgentKeyError(res.data.message);
      else { setConfigSaved(true); setTimeout(() => setConfigSaved(false), 4000); }
    } catch { setAgentKeyError(t('agent.key_error_server')); }
    setSavingConfig(false);
  };

  const handleTestKey = async () => {
    setTestingKey(true); setTestKeyResult(null);
    try {
      const res = await axios.post(`${API_BASE}/agent/test-key`);
      setTestKeyResult({ ok: !res.data.error, message: res.data.message });
    } catch { setTestKeyResult({ ok: false, message: t('agent.key_error_server') }); }
    setTestingKey(false);
  };

  const [agentIndexError, setAgentIndexError] = useState("");
  const handleAgentIndex = async () => {
    setAgentIndexError("");
    try {
      const res = await axios.post(`${API_BASE}/agent/index`, { canal_nome: canalConfigurado });
      if (res.data.error) setAgentIndexError(res.data.message);
    } catch {
      setAgentIndexError("Erro ao conectar com o servidor.");
    }
  };
  const handleAgentIndexCancel = () => axios.post(`${API_BASE}/agent/index-cancel`);

  const handleDeleteCanal = async (nome) => {
    await axios.delete(`${API_BASE}/agent/canal/${encodeURIComponent(nome)}`).catch(() => {});
    setCanaisExtras(prev => prev.filter(c => c !== nome));
  };

  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const historico = chatMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    // Adiciona mensagem vazia do assistente que vai receber o stream
    const assistantIdx = chatMessages.length + 1;
    setChatMessages(prev => [...prev, { role: 'assistant', content: '', fontes: [], streaming: true }]);

    try {
      const response = await fetch(`${API_BASE}/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem:     msg,
          canal_nome:   agentStatus.canal_indexado || canalConfigurado,
          historico,
          canais_extras: canaisExtras,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fontes = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) {
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: 'error', content: parsed.error };
                return msgs;
              });
            } else if (parsed.fontes) {
              fontes = parsed.fontes;
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], fontes };
                return msgs;
              });
            } else if (parsed.done) {
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], streaming: false };
                return msgs;
              });
            }
          } catch {
            // linha é texto puro — acumula no conteúdo
            setChatMessages(prev => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = { ...last, content: (last.content || '') + line };
              return msgs;
            });
          }
        }
      }
    } catch {
      setChatMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: 'error', content: 'Erro ao conectar com o servidor.' };
        return msgs;
      });
    }
    setChatLoading(false);
  };

  const handleStart      = () => { if (!canalConfigurado) { setCanalError(t('channel.error_required')); return; } setShowExtractionModal(true); };
  const handleStartConfirm = (fontes) => { setShowExtractionModal(false); setExtractionTypes(fontes); axios.post(`${API_BASE}/start`, { fontes }).then(r => { if (r.data.error) setCanalError(r.data.message); }); };
  const handlePause      = () => axios.post(`${API_BASE}/pause`);
  const handleCancel     = () => axios.post(`${API_BASE}/cancel`);
  const handleDriveAuth  = () => axios.post(`${API_BASE}/drive-auth`);
  const handleDriveCancel = () => axios.post(`${API_BASE}/drive-auth-cancel`);

  const cleanCanalName  = (n) => n ? n.split('?')[0] : '';
  const progress        = status.stats.progress || 0;
  const isRunning       = status.is_running;
  const isPaused        = status.is_paused;
  const totalVideos     = status.stats.videos_total;
  const processedVideos = status.stats.videos_processed;
  const driveStatus     = status.drive_status || "nao_autenticado";

  const statusTextColor = () => {
    const s = status.stats.status;
    if (s.includes("Finalizado"))                        return "text-secondary";
    if (s.includes("Erro") || s.includes("Interrompido")) return "text-danger";
    if (s.includes("Pausa"))                             return "text-warning";
    if (isRunning)                                       return "text-primary";
    return darkMode ? "text-slate-200" : "text-slate-700";
  };

  const StatCard = ({ icon: Icon, label, value, color, sub, onOpen }) => (
    <div role="status" aria-label={`${label}: ${value}`}
      className={`p-4 lg:p-5 rounded-2xl flex items-center gap-4 border transition-all ${darkMode ? 'bg-white/5 border-white/10 hover:border-primary/40' : 'bg-white border-slate-200 shadow-md hover:border-primary/40'}`}>
      <div className={`p-3 rounded-xl shrink-0 bg-${color}/15 text-${color}`} aria-hidden="true"><Icon size={22} /></div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold uppercase tracking-widest truncate ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{label}</p>
        <p className={`font-bold truncate ${typeof value === 'string' && value.length > 8 ? 'text-base lg:text-lg' : 'text-xl lg:text-2xl'} ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{sub}</p>}
      </div>
      {onOpen && (
        <button onClick={onOpen} title={t('stats.open_folder')}
          className={`p-2 rounded-lg shrink-0 transition-colors ${darkMode ? 'text-slate-500 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
          <FolderOpen size={15} />
        </button>
      )}
    </div>
  );

  const LogLine = ({ log }) => {
    const { color, label } = logMeta(log.message, darkMode);
    return (
      <div className="flex gap-3 group hover:bg-white/5 px-1 py-0.5 rounded" role="listitem">
        <span className={`font-mono font-bold shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>[{log.timestamp}]</span>
        <span className={`font-mono text-xs break-all ${color}`}>
          <span className="sr-only">[{label}] </span>{log.message}
        </span>
      </div>
    );
  };

  // ── Conteúdo da Sidebar ────────────────────────────────────────────────
  const SidebarContent = () => (
    <>
      {/* Idioma + dark mode — acima do logo, centralizados */}
      <div className="relative z-10 flex items-center justify-center gap-2 mb-0">
        <div className={`relative flex items-center rounded-lg border px-2 py-1 ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
          <Globe size={11} className={`shrink-0 mr-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`} aria-hidden="true" />
          <select
            value={i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('en') ? 'en' : 'es'}
            onChange={e => changeLang(e.target.value)}
            aria-label="Selecionar idioma"
            className={`text-[11px] font-bold bg-transparent border-none outline-none cursor-pointer pr-1 ${btnFocus}
              ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
            style={{ appearance: 'none', WebkitAppearance: 'none' }}>
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <button onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('brainiac_theme', next ? 'dark' : 'light'); }}
          aria-label={darkMode ? t('footer.light') : t('footer.dark')} aria-pressed={darkMode}
          className={`p-1.5 rounded-lg border transition-colors ${darkMode ? 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'} ${btnFocus}`}>
          {darkMode ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        </button>
      </div>

      {/* Logo */}
      <div className="flex justify-center -mt-6 -mb-6">
        <img
          src={darkMode ? "/logo_dark.png" : "/logo_light.png"}
          alt="BrainIAc — Intelligence Engine"
          style={{ width: '220px', height: '220px', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      </div>

      <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

      {/* ── PASSO 1: Canal YouTube ── */}
      <section aria-labelledby="canal-heading" className="space-y-2 mb-3">
        <div className="flex items-center gap-2 px-1">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
            ${canalConfigurado ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}
            aria-hidden="true">1</span>
          <p id="canal-heading" className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            {t('channel.title')}
          </p>
        </div>

        {canalConfigurado ? (
          <div role="status" aria-label={`Canal configurado: @${canalConfigurado}`}
            className={`p-3 rounded-xl flex items-center gap-2 border ${darkMode ? 'bg-primary/10 border-primary/25' : 'bg-primary/5 border-primary/25'}`}>
            <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-[10px] uppercase font-bold tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('channel.configured')}</p>
              <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{cleanCanalName(canalConfigurado)}</p>
            </div>
            {!isRunning && (
              <button onClick={() => { setCanalConfigurado(""); setCanalInput(""); }}
                aria-label={t('channel.remove')}
                className={`ml-auto rounded-md p-0.5 transition-colors hover:text-danger ${darkMode ? 'text-slate-500' : 'text-slate-600'} ${btnFocus}`}>
                <XCircle size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="canal-url" className="sr-only">URL do canal YouTube</label>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 transition-all ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
              <Link2 size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              <input id="canal-url" type="url" placeholder={t('channel.placeholder')} value={canalInput}
                onChange={e => { setCanalInput(e.target.value); setCanalError(""); }}
                onKeyDown={e => e.key === 'Enter' && handleConfigurarCanal()}
                aria-describedby={canalError ? errorId : undefined} aria-invalid={!!canalError}
                className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
            </div>
            {canalError && (
              <p id={errorId} role="alert" className="text-[11px] text-danger flex items-center gap-1 font-medium">
                <AlertTriangle size={11} aria-hidden="true" /> {canalError}
              </p>
            )}
            <button onClick={handleConfigurarCanal} disabled={configurando || !canalInput.trim()}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 ${btnFocus}`}>
              {configurando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
              {configurando ? t('channel.configuring') : t('channel.confirm')}
            </button>
          </div>
        )}
      </section>

      <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

      {/* ── PASSO 2: Google Drive (toggle) ── */}
      <section aria-labelledby="drive-heading" className="space-y-2 mb-3">
        <div className="flex items-center gap-2 px-1">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
            ${driveStatus === 'autenticado' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}
            aria-hidden="true">2</span>
          <p id="drive-heading" className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            {t('drive.title')}
          </p>
        </div>
        <DriveToggle
          driveStatus={driveStatus}
          driveAuthError={status.drive_auth_error}
          onAuth={handleDriveAuth}
          onCancel={handleDriveCancel}
          isRunning={isRunning}
          darkMode={darkMode}
        />
      </section>

      <div className={`border-t mb-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`} role="separator" />

      {/* ── PASSO 3: Operações ── */}
      <section aria-labelledby="ops-heading" className="space-y-2 mb-3">
        <div className="flex items-center gap-2 px-1">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
            ${isRunning && !isPaused ? 'bg-primary/20 text-primary animate-pulse' : 'bg-primary/20 text-primary'}`}
            aria-hidden="true">3</span>
          <p id="ops-heading" className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            {t('ops.title')}
          </p>
        </div>
        <div role="group" aria-label={t('ops.controls')}>
          <button onClick={handleStart} disabled={isRunning || !canalConfigurado}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
              bg-primary text-white hover:bg-primary/85 shadow-lg shadow-primary/25 ${btnFocus}`}>
            <Zap size={15} aria-hidden="true" />
            {t('ops.start')}
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className={`mt-auto pt-2 border-t flex flex-col items-center gap-0.5 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('footer.version')}</p>
        <p className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>© 2026 CriAugu · {t('footer.by')}</p>
      </div>
    </>
  );

  return (
    <>
      {/* WCAG 2.4.1 — Skip navigation link */}
      <a href="#main-content"
        className={`sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:text-xs focus:font-bold focus:bg-primary focus:text-white ${btnFocus}`}>
        Ir para o conteúdo principal
      </a>

      <AnimatePresence>
        {showOnboarding && <Onboarding key="onboarding" onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showGuide && <GuideModal key="guide-modal" onClose={() => setShowGuide(false)} darkMode={darkMode} />}
      </AnimatePresence>
      <AnimatePresence>
        {showExtractionModal && (
          <ExtractionModal
            key="extraction-modal"
            onClose={() => setShowExtractionModal(false)}
            onConfirm={handleStartConfirm}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPostModal && (
          <PostExtractionModal
            key="post-modal"
            onClose={() => setShowPostModal(false)}
            driveStatus={driveStatus}
            agentConfigured={agentStatus.configured}
            onGoToAgent={() => setActiveTab('agente')}
            onDriveAuth={handleDriveAuth}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>

      <div className={`flex h-screen overflow-hidden font-sans ${darkMode ? 'bg-[#080C18] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

        {/* Overlay mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          )}
        </AnimatePresence>

        {/* Sidebar desktop */}
        <aside aria-label="Painel de controle"
          className={`hidden lg:flex w-72 shrink-0 border-r flex-col px-4 pt-2 pb-3 overflow-y-auto custom-scrollbar ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <SidebarContent />
        </aside>

        {/* Sidebar mobile (drawer) */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside aria-label="Painel de controle"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className={`fixed top-0 left-0 h-full w-72 z-30 flex flex-col px-5 pt-3 pb-5 overflow-y-auto custom-scrollbar lg:hidden ${darkMode ? 'bg-[#0C1122] border-r border-white/10' : 'bg-white border-r border-slate-200 shadow-xl'}`}>
              <div className="flex justify-end mb-1">
                <button onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"
                  className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                  <X size={18} />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main */}
        <main id="main-content" aria-label="Área principal" className="flex-1 flex flex-col overflow-hidden relative min-w-0">

          {/* ── Home Screen ── */}
          {showHome && (
            <HomeScreen
              darkMode={darkMode}
              history={history}
              repositorio={repositorio}
              agentStatus={agentStatus}
              btnFocus={btnFocus}
              onNavigate={(id) => { setActiveTab(id); setShowHome(false); }}
            />
          )}

          {/* ── App com Abas ── */}
          <div className={showHome ? 'hidden' : 'flex flex-col flex-1 overflow-hidden'}>
          <div className={`absolute top-0 right-0 w-[600px] h-[600px] blur-[140px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-primary/8' : 'bg-primary/4'}`} aria-hidden="true" />
          <div className={`absolute bottom-0 left-0 w-[400px] h-[400px] blur-[120px] -z-10 rounded-full pointer-events-none ${darkMode ? 'bg-accent/5' : 'bg-accent/3'}`} aria-hidden="true" />

          {/* Tabs */}
          <div className={`px-4 lg:px-8 pt-4 flex items-center gap-1 shrink-0 border-b ${darkMode ? 'border-white/10' : 'border-slate-200'}`}
            role="tablist" aria-label="Navegação principal">
            {[
              { id: 'extracao',    label: t('tabs.extraction'), icon: Zap,       panel: 'panel-extracao'    },
              { id: 'repositorio', label: 'Repositório',           icon: BookOpen,  panel: 'panel-repositorio' },
              { id: 'relatorio',   label: 'Relatório',             icon: BarChart3, panel: 'panel-relatorio'   },
              { id: 'agente',      label: t('tabs.agent'),         icon: Settings,  panel: 'panel-agente'      },
            ].map(({ id, label, icon: Icon, panel }) => (
              <button key={id}
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={panel}
                id={`tab-${id}`}
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'agente' && !localStorage.getItem('brainiac_agent_visited')) {
                    setShowAgentHint(true);
                    localStorage.setItem('brainiac_agent_visited', '1');
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-px ${btnFocus}
                  ${activeTab === id
                    ? darkMode ? 'border-primary text-primary bg-primary/8' : 'border-primary text-primary bg-primary/5'
                    : darkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon size={13} aria-hidden="true" />
                {label}
                {id === 'agente' && agentStatus.indexed && (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" aria-label={t('agent.configured_badge')} />
                )}
              </button>
            ))}
          </div>

          {/* Header */}
          <header className="px-4 lg:px-8 py-4 lg:py-6 flex justify-between items-center lg:items-end shrink-0 gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de controle"
                className={`lg:hidden p-2 rounded-xl transition-colors ${darkMode ? 'bg-white/8 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} ${btnFocus}`}>
                <Menu size={20} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusDot isRunning={isRunning} isPaused={isPaused} />
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('header.status')}</span>
                </div>
                <h2 aria-live="polite" aria-atomic="true" className={`text-xl lg:text-3xl font-bold leading-tight ${statusTextColor()}`}>
                  {status.stats.status}
                </h2>
                {canalConfigurado && (
                  <p className={`text-xs lg:text-sm mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    {t('header.channel')}: <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>@{cleanCanalName(canalConfigurado)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block" aria-hidden="true">
                <p className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('header.engine')}</p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{t('header.universal')}</p>
              </div>
              <button onClick={() => setShowGuide(true)}
                aria-label={t('guide.title')}
                className={`p-2 rounded-xl transition-colors ${darkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'} ${btnFocus}`}>
                <HelpCircle size={18} />
              </button>
            </div>
          </header>

          {/* ── ABA EXTRAÇÃO ── */}
          <div id="panel-extracao" role="tabpanel" aria-labelledby="tab-extracao"
            ref={mainScrollRef}
            className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 space-y-4 custom-scrollbar"
            style={{ display: activeTab === 'extracao' ? undefined : 'none' }}>

            {/* Banner aviso Drive local */}
            <AnimatePresence>
              {(driveStatus === 'sem_credenciais' || driveStatus === 'nao_autenticado') && !isRunning && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  role="note" aria-label={t('banner.aria')}
                  className={`rounded-2xl px-4 py-3 border flex items-center gap-3 text-xs ${darkMode ? 'bg-warning/8 border-warning/20 text-warning' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <CloudOff size={16} className="shrink-0" aria-hidden="true" />
                  <span>
                    <strong>{t('banner.local_mode')}</strong>{' '}
                    <span dangerouslySetInnerHTML={{ __html: t('banner.local_desc') }} />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barra de Progresso */}
            <AnimatePresence>
              {(isRunning || progress > 0) && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  role="region" aria-label={t('progress.title')}
                  className={`rounded-2xl p-4 lg:p-5 border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={15} className="text-primary" aria-hidden="true" />
                      <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t('progress.title')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {totalVideos > 0 && (
                        <span className={`text-xs font-mono ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{processedVideos} / {totalVideos}</span>
                      )}
                      <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{progress}%</span>
                    </div>
                  </div>
                  <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`${t('progress.title')}: ${progress}%`}
                    className={`h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                  </div>
                  {isRunning && !isPaused && (
                    <p aria-live="polite" className={`text-[11px] mt-2 flex items-center gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      <Loader2 size={10} className="animate-spin" aria-hidden="true" /> {t('progress.processing')}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Painel de Resumo Pós-Extração */}
            <AnimatePresence>
              {(status.stats.status === 'Finalizado ✓' || status.stats.status === 'Interrompido') && status.stats.videos_total > 0 && (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  aria-labelledby="summary-heading"
                  className={`rounded-2xl border overflow-hidden ${status.stats.status === 'Finalizado ✓'
                    ? darkMode ? 'bg-secondary/8 border-secondary/25' : 'bg-emerald-50 border-emerald-200'
                    : darkMode ? 'bg-warning/8 border-warning/25' : 'bg-amber-50 border-amber-200'}`}>
                  <div className={`px-5 py-3.5 border-b flex items-center gap-2 ${status.stats.status === 'Finalizado ✓'
                    ? darkMode ? 'border-secondary/20' : 'border-emerald-200'
                    : darkMode ? 'border-warning/20' : 'border-amber-200'}`}>
                    {status.stats.status === 'Finalizado ✓'
                      ? <Trophy size={15} className="text-secondary" aria-hidden="true" />
                      : <AlertTriangle size={15} className="text-warning" aria-hidden="true" />}
                    <h3 id="summary-heading" className={`text-xs font-bold uppercase tracking-wider ${status.stats.status === 'Finalizado ✓'
                      ? darkMode ? 'text-secondary' : 'text-emerald-700'
                      : darkMode ? 'text-warning' : 'text-amber-700'}`}>
                      {status.stats.status === 'Finalizado ✓' ? t('summary.finished') : t('summary.interrupted')}
                    </h3>
                    {status.stats.idioma_detectado && (
                      <span className={`ml-auto flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/10 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>
                        <Globe size={10} aria-hidden="true" /> {status.stats.idioma_detectado}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: CheckCircle2, label: t('summary.extracted'),     value: status.stats.videos_processed,    color: "text-secondary", bg: darkMode ? "bg-secondary/10" : "bg-emerald-100" },
                      { icon: MicOff,       label: t('summary.no_caption'),    value: status.stats.videos_sem_legenda,  color: "text-slate-400",  bg: darkMode ? "bg-white/5"       : "bg-slate-100" },
                      { icon: Scissors,     label: t('summary.short_caption'), value: status.stats.videos_legenda_curta,color: "text-slate-400",  bg: darkMode ? "bg-white/5"       : "bg-slate-100" },
                      { icon: FileText,     label: t('summary.files'),         value: status.stats.files_generated,     color: "text-primary",    bg: darkMode ? "bg-primary/10"    : "bg-violet-100" },
                    ].map(({ icon: Icon, label, value, color, bg }) => (
                      <div key={label} className={`rounded-xl p-3 flex flex-col items-center gap-1 ${bg}`} role="status" aria-label={`${label}: ${value}`}>
                        <Icon size={16} className={color} aria-hidden="true" />
                        <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{value}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {status.stats.videos_total > 0 && (
                    <div className="px-5 pb-4">
                      <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-bold ${darkMode ? 'bg-black/20' : 'bg-white border border-slate-200'}`}>
                        <span className={darkMode ? 'text-slate-500' : 'text-slate-600'}>{t('summary.coverage')}</span>
                        <span className={status.stats.videos_processed / status.stats.videos_total >= 0.8
                          ? 'text-secondary' : 'text-warning'}>
                          {Math.round(status.stats.videos_processed / status.stats.videos_total * 100)}%
                          <span className={`ml-1 font-normal text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                            {t('summary.coverage_detail', { processed: status.stats.videos_processed, total: status.stats.videos_total })}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
              <StatCard icon={Video}    label={t('stats.processed')} value={processedVideos}
                color="primary"   sub={totalVideos > 0 ? t('stats.mapped', { total: totalVideos }) : t('stats.waiting')} />
              <StatCard icon={FileText} label={t('stats.files')}     value={status.stats.files_generated}
                color="accent"    sub={t('stats.parts')}
                onOpen={() => axios.get(`${API_BASE}/open-folder?name=cerebro_txt`)} />
              <StatCard icon={Database} label={t('stats.db')}        value={canalConfigurado ? t('stats.active') : t('stats.waiting_db')}
                color="secondary" sub={canalConfigurado ? `@${canalConfigurado}` : t('stats.no_channel')}
                onOpen={canalConfigurado ? () => axios.get(`${API_BASE}/open-folder?name=gestao`) : undefined} />
            </div>

            {/* Histórico de Canais */}
            {history.length > 0 && !isRunning && (
              <section aria-label="Histórico de extrações">
                <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`px-4 lg:px-5 py-3 border-b flex items-center gap-2 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <Globe size={14} className="text-primary" aria-hidden="true" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>Canais Extraídos</h3>
                    <span className={`ml-auto text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{history.length} {history.length !== 1 ? 'canais' : 'canal'}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {history.map((h, i) => (
                      <div key={i} className={`px-4 lg:px-5 py-3 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'} transition-colors`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                          {h.canal[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{h.canal}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${h.cobertura >= 80 ? darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700' : darkMode ? 'bg-warning/20 text-warning' : 'bg-amber-100 text-amber-700'}`}>{h.cobertura}%</span>
                          </div>
                          <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{h.extraidos} vídeos · {h.ultima_extracao}</p>
                        </div>
                        <button
                          onClick={async () => {
                            setCanalInput(h.canal_url);
                            setCanalError('');
                            const res = await axios.post(`\/set-channel`, { canal_url: h.canal_url }).catch(() => null);
                            if (res && !res.data.error) setCanalConfigurado(res.data.canal_nome || h.canal);
                          }}
                          className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                          Usar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Log de Atividade */}
            <section aria-labelledby="log-heading"
              className={`rounded-2xl overflow-hidden flex flex-col border ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className={`px-4 lg:px-5 py-3 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Terminal size={15} className="text-primary shrink-0" aria-hidden="true" />
                  <h3 id="log-heading" className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-700'}`}>{t('log.title')}</h3>
                  {isRunning && (
                    <div className="flex items-center gap-1.5 ml-1" aria-label={t('log.live')}>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider" aria-hidden="true">{t('log.live')}</span>
                    </div>
                  )}
                </div>
                {isRunning && (
                  <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={t('ops.controls')}>
                    <button onClick={handlePause} aria-pressed={isPaused}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97]
                        border-warning/50 text-warning hover:bg-warning/10 ${btnFocus}`}>
                      <Pause size={11} aria-hidden="true" />
                      {isPaused ? t('ops.resume') : t('ops.pause')}
                    </button>
                    <button onClick={handleCancel}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97]
                        border-danger/40 text-danger hover:bg-danger/10 ${btnFocus}`}>
                      <Square size={10} aria-hidden="true" />
                      {t('ops.cancel')}
                    </button>
                  </div>
                )}
              </div>
              <div ref={logContainerRef} role="log" aria-label={t('log.title')}
                aria-live="polite" aria-relevant="additions"
                style={{ height: 'clamp(8rem, 22vh, 20rem)' }}
                className={`overflow-y-auto p-4 lg:p-5 space-y-1 custom-scrollbar text-xs ${darkMode ? 'bg-black/30 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                {status.logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-3">
                    <Activity size={28} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                    <p className={`text-xs opacity-60 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {canalConfigurado ? t('log.ready') : t('log.complete_steps')}
                    </p>
                  </div>
                ) : (
                  <div role="list" aria-label={t('log.title')}>
                    {status.logs.map((log, i) => <LogLine key={i} log={log} />)}
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* ── ABA REPOSITORIO ── */}
          {activeTab === 'repositorio' && (
            <div id="panel-repositorio" role="tabpanel" aria-labelledby="tab-repositorio"
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 custom-scrollbar">
              <RepositorioTab
                darkMode={darkMode}
                repositorio={repositorio}
                setRepositorio={setRepositorio}
                history={history}
                btnFocus={btnFocus}
                apiBase={API_BASE}
                onSetCanal={(url) => { setCanalInput(url); }}
              />
            </div>
          )}

          {/* ── ABA RELATORIO ── */}
          {activeTab === 'relatorio' && (
            <div id="panel-relatorio" role="tabpanel" aria-labelledby="tab-relatorio"
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 pt-4 custom-scrollbar">
              <RelatorioTab
                darkMode={darkMode}
                history={history}
                btnFocus={btnFocus}
                apiBase={API_BASE}
              />
            </div>
          )}

          {/* ── ABA AGENTE ── */}
          {activeTab === 'agente' && (
            <div id="panel-agente" role="tabpanel" aria-labelledby="tab-agente"
              ref={agentScrollRef}
              className="flex-1 overflow-y-auto px-4 lg:px-8 pb-6 space-y-4 custom-scrollbar">

              {/* Card do Canal */}
              {canalMeta && (
                <div className={`rounded-2xl border p-4 flex items-center gap-4 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold ${darkMode ? 'bg-primary/20 text-primary' : 'bg-violet-100 text-violet-700'}`}>
                    {(canalMeta.canal_nome || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {canalMeta.canal_nome}
                    </p>
                    <div className={`flex items-center gap-2 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                      <span>{canalMeta.canal_handle}</span>
                      {canalMeta.inscritos && <><span>·</span><span>{canalMeta.inscritos} inscritos</span></>}
                    </div>
                  </div>
                  <a href={canalMeta.canal_url} target="_blank" rel="noreferrer"
                    className={`shrink-0 p-2 rounded-lg transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                    aria-label="Abrir canal no YouTube">
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Hint de primeiro acesso */}
              <AnimatePresence>
                {showAgentHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`rounded-2xl border p-4 flex gap-3 ${darkMode ? 'bg-primary/8 border-primary/25' : 'bg-violet-50 border-violet-200'}`}>
                    <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Configure o Agente em 3 passos</p>
                      <ol className={`text-[11px] space-y-0.5 list-none ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        <li>1. Escolha o provedor de IA e salve sua chave de API</li>
                        <li>2. Clique em <strong>Indexar Agora</strong> para preparar a base</li>
                        <li>3. Use o chat para perguntar sobre o canal</li>
                      </ol>
                    </div>
                    <button onClick={() => setShowAgentHint(false)}
                      className={`shrink-0 p-1 rounded-md transition-colors ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'} ${btnFocus}`}
                      aria-label="Fechar dica">
                      <X size={13} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Configuração do Provedor */}
              <section aria-labelledby="agent-config-heading"
                className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <button
                  aria-expanded={configOpen}
                  aria-controls="agent-config-body"
                  onClick={() => setConfigOpen(v => !v)}
                  className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${configOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <KeyRound size={14} className="text-primary shrink-0" aria-hidden="true" />
                  <h3 id="agent-config-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                    {t('agent.provider_title')}
                  </h3>
                  {agentStatus.configured && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-secondary mr-2">
                      <CheckCircle2 size={11} /> {t('agent.configured_badge')}
                    </span>
                  )}
                  <motion.div animate={{ rotate: configOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {configOpen && (
                    <motion.div id="agent-config-body"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}>
                <div className="p-5 space-y-4">

                  {/* Ollama — provedor padrão */}
                  <OllamaSetup darkMode={darkMode} ollamaStatus={ollamaStatus} setOllamaStatus={setOllamaStatus} btnFocus={btnFocus} apiBase={API_BASE} />

                  {/* Toggle provedor externo */}
                  <div className={`flex items-center justify-between py-3 border-t ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                    <div>
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-700'}`}>Usar minha chave de API</p>
                      <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gemini, OpenAI ou Anthropic Claude</p>
                    </div>
                    <button
                      role="switch" aria-checked={useExternalProvider}
                      onClick={() => {
                        const next = !useExternalProvider;
                        setUseExternalProvider(next);
                        if (!next) {
                          setAgentProvider('ollama');
                          axios.post(`${API_BASE}/agent/config`, { provider: 'ollama', api_key: '' }).catch(() => {});
                        }
                      }}
                      className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${useExternalProvider ? 'bg-primary' : darkMode ? 'bg-white/15' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${useExternalProvider ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Seletor + chave de API (apenas se toggle ON) */}
                  <AnimatePresence initial={false}>
                    {useExternalProvider && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                        className="space-y-3">

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'gemini',    label: 'Google Gemini'    },
                            { id: 'openai',    label: 'OpenAI'           },
                            { id: 'anthropic', label: 'Anthropic Claude' },
                          ].map(({ id, label }) => (
                            <button key={id} onClick={() => setAgentProvider(id)}
                              className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${btnFocus}
                                ${agentProvider === id
                                  ? 'border-primary bg-primary/15 text-primary'
                                  : darkMode ? 'border-white/15 text-slate-400 hover:border-white/30' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className={`text-[11px] flex items-center gap-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                          <Info size={11} />
                          {agentProvider === 'gemini'    && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_gemini')} <ExternalLink size={9} /></a>}
                          {agentProvider === 'openai'    && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_openai')} <ExternalLink size={9} /></a>}
                          {agentProvider === 'anthropic' && <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 flex items-center gap-1">{t('agent.get_key_anthropic')} <ExternalLink size={9} /></a>}
                        </div>

                        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                          <input type={showApiKey ? 'text' : 'password'}
                            placeholder={t('agent.key_placeholder')}
                            value={agentApiKey} onChange={e => { setAgentApiKey(e.target.value); setAgentKeyError(""); }}
                            className={`flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                          <button onClick={() => setShowApiKey(!showApiKey)} className={`shrink-0 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500'} ${btnFocus}`}
                            aria-label={showApiKey ? t('agent.key_hide') : t('agent.key_show')}>
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>

                        {agentKeyError && (
                          <p role='alert' className='text-[11px] text-danger flex items-center gap-1'>
                            <AlertTriangle size={11} /> {agentKeyError}
                          </p>
                        )}
                        {testKeyResult && (
                          <p role='status' className={`text-[11px] flex items-center gap-1 font-medium ${testKeyResult.ok ? 'text-secondary' : 'text-danger'}`}>
                            {testKeyResult.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {testKeyResult.message}
                          </p>
                        )}
                        <div className='flex gap-2'>
                          <button onClick={handleRemoveApiKey}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors border-danger/40 text-danger hover:bg-danger/10 ${btnFocus}`}>
                              Limpar
                            </button>
                          <button onClick={handleSaveAgentConfig} disabled={savingConfig || !agentApiKey.trim()}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${configSaved ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary hover:bg-primary/30'} ${btnFocus}`}>
                            {savingConfig ? <Loader2 size={12} className='animate-spin inline mr-1' /> : null}
                            {savingConfig ? t('agent.saving') : configSaved ? `✓ ${t('agent.config_saved')}` : t('agent.save_config')}
                          </button>
                          <button onClick={handleTestKey} disabled={testingKey || !agentStatus.configured}
                            title={t('agent.test_key')}
                            className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                            {testingKey ? <Loader2 size={12} className='animate-spin' /> : <Zap size={12} />}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Indexação */}
              <section aria-labelledby="agent-index-heading"
                className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                <button
                  aria-expanded={indexOpen}
                  aria-controls="agent-index-body"
                  onClick={() => setIndexOpen(v => !v)}
                  className={`w-full px-5 py-3.5 flex items-center gap-2 text-left transition-colors ${indexOpen && (darkMode ? 'border-b border-white/10' : 'border-b border-slate-100')} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <BookOpen size={14} className="text-accent shrink-0" aria-hidden="true" />
                  <h3 id="agent-index-heading" className={`text-xs font-bold uppercase tracking-wider flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                    {t('agent.index_title')}
                  </h3>
                  {agentStatus.indexed && !agentStatus.indexing && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full mr-2 ${darkMode ? 'bg-secondary/15 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>
                      {agentStatus.index_count} chunks
                    </span>
                  )}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowIndexInfo(v => !v)}
                      aria-expanded={showIndexInfo}
                      aria-label="O que é indexação?"
                      className={`p-1 rounded-md transition-colors mr-1 ${showIndexInfo ? 'text-primary' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} ${btnFocus}`}>
                      <Info size={13} />
                    </button>
                    <AnimatePresence>
                      {showIndexInfo && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className={`absolute right-0 top-7 z-10 w-72 p-3 rounded-xl border text-[11px] leading-relaxed shadow-xl ${darkMode ? 'bg-[#0C1122] border-white/20 text-slate-300' : 'bg-white border-slate-200 text-slate-600 shadow-slate-200/60'}`}>
                          {t('agent.index_what')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div animate={{ rotate: indexOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUp size={13} className={darkMode ? 'text-slate-500' : 'text-slate-400'} aria-hidden="true" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {indexOpen && (
                    <motion.div id="agent-index-body"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}>
                <div className="p-5 space-y-3">
                  {/* Lista de canais indexados */}
                  {agentStatus.canais_indexados && agentStatus.canais_indexados.length > 0 && !agentStatus.indexing && (
                    <div className="space-y-1.5">
                      {agentStatus.canais_indexados.map(canal => {
                        const isActive = canal.nome === agentStatus.canal_indexado;
                        const isExtra  = canaisExtras.includes(canal.nome);
                        return (
                          <div key={canal.nome} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all
                            ${isActive
                              ? darkMode ? 'bg-secondary/10 border-secondary/30' : 'bg-emerald-50 border-emerald-200'
                              : isExtra
                                ? darkMode ? 'bg-primary/10 border-primary/30' : 'bg-violet-50 border-violet-200'
                                : darkMode ? 'bg-white/4 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                            <CheckCircle2 size={11} className={isActive ? 'text-secondary' : isExtra ? 'text-primary' : darkMode ? 'text-slate-600' : 'text-slate-300'} />
                            <span className={`flex-1 font-medium truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal.nome}</span>
                            <span className={`text-[10px] font-mono ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{canal.chunks} chunks</span>
                            {isActive
                              ? <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-secondary/20 text-secondary' : 'bg-emerald-100 text-emerald-700'}`}>Ativo</span>
                              : (
                                <button onClick={() => setCanaisExtras(prev => isExtra ? prev.filter(c => c !== canal.nome) : [...prev, canal.nome])}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${btnFocus}
                                    ${isExtra ? darkMode ? 'bg-primary/20 text-primary border-primary/30' : 'bg-violet-100 text-violet-700 border-violet-200' : darkMode ? 'border-white/20 text-slate-400 hover:border-primary/40 hover:text-primary' : 'border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600'}`}>
                                  {isExtra ? '✓ incluso' : '+ incluir'}
                                </button>
                              )
                            }
                            <button onClick={() => handleDeleteCanal(canal.nome)}
                              className={`p-1 rounded transition-colors ${darkMode ? 'text-slate-600 hover:text-danger' : 'text-slate-300 hover:text-danger'} ${btnFocus}`}
                              aria-label={`Remover índice de @${canal.nome}`}>
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                      {canaisExtras.length > 0 && (
                        <p className={`text-[10px] ${darkMode ? 'text-primary/70' : 'text-violet-500'}`}>
                          Buscando em {canaisExtras.length + 1} canais simultaneamente
                        </p>
                      )}
                    </div>
                  )}

                  {agentStatus.indexing && (
                    <div className="space-y-2">
                      <div className={`p-3 rounded-xl flex items-center gap-2 text-xs ${darkMode ? 'bg-primary/8 border border-primary/20 text-primary' : 'bg-violet-50 border border-violet-200 text-violet-700'}`}>
                        <Loader2 size={14} className="animate-spin" /> {t('agent.indexing')}
                      </div>
                      <div className={`rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar text-[11px] font-mono space-y-1 ${darkMode ? 'bg-black/30' : 'bg-slate-50 border border-slate-200'}`}>
                        {agentStatus.index_logs.map((l, i) => (
                          <div key={i} className={darkMode ? 'text-slate-300' : 'text-slate-600'}>[{l.timestamp}] {l.message}</div>
                        ))}
                      </div>
                      <button onClick={handleAgentIndexCancel}
                        className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-100'} ${btnFocus}`}>
                        {t('agent.cancel_index')}
                      </button>
                    </div>
                  )}

                  {!agentStatus.indexing && lastIndexLogs.length > 0 && (
                    <div className={`rounded-xl p-3 max-h-28 overflow-y-auto custom-scrollbar text-[11px] font-mono space-y-0.5 ${darkMode ? 'bg-black/30' : 'bg-slate-50 border border-slate-200'}`}>
                      {lastIndexLogs.slice(-6).map((l, i) => {
                        const isErr = l.message.includes('❌') || l.message.includes('Nenhum');
                        return (
                          <div key={i} className={isErr ? 'text-danger' : darkMode ? 'text-slate-300' : 'text-slate-600'}>
                            [{l.timestamp}] {l.message}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!agentStatus.indexing && (
                    <div className="space-y-2">
                      <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                        {agentStatus.indexed ? t('agent.index_note_update') : t('agent.index_note_new')}
                      </p>
                      
                      {!canalConfigurado && (
                        <p className={`text-[11px] flex items-center gap-1 ${darkMode ? 'text-warning/80' : 'text-amber-600'}`}>
                          <AlertTriangle size={11} aria-hidden="true" /> {t('agent.index_prereq_channel')}
                        </p>
                      )}
                      {agentIndexError && (
                        <p role="alert" className="text-[11px] flex items-center gap-1 text-danger font-medium">
                          <AlertTriangle size={11} aria-hidden="true" /> {agentIndexError}
                        </p>
                      )}
                      <button onClick={handleAgentIndex}
                        disabled={!canalConfigurado}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                          ${agentStatus.indexed ? `${darkMode ? 'bg-white/8 text-slate-300 hover:bg-white/12' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}` : 'bg-accent/20 text-accent hover:bg-accent/30'} ${btnFocus}`}>
                        <RefreshCw size={13} />
                        {agentStatus.indexed ? t('agent.reindex') : t('agent.index_now')}
                      </button>
                    </div>
                  )}
                </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>



            </div>
          )}


          {/* ── Chat Drawer flutuante ── */}
          <AnimatePresence>
            {chatOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                  onClick={() => setChatOpen(false)} />
                <motion.div
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                  transition={{ type: 'tween', duration: 0.25 }}
                  className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl border-l ${darkMode ? 'bg-[#0C1122] border-white/10' : 'bg-white border-slate-200'}`}>
                  <div className={`px-4 py-3.5 border-b flex items-center gap-3 shrink-0 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
                    <Sparkles size={15} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('agent.chat_title')}</p>
                      {agentStatus.indexed && (
                        <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>@{agentStatus.canal_indexado}</p>
                      )}
                    </div>
                    {chatMessages.length > 0 && (
                      <button onClick={() => setChatMessages([])}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        Limpar
                      </button>
                    )}
                    <button onClick={() => setChatOpen(false)}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                      aria-label="Fechar chat">
                      <X size={16} />
                    </button>
                  </div>
                  <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${darkMode ? 'bg-black/20' : 'bg-slate-50'}`}
                    role="log" aria-label={t('agent.chat_title')} aria-live="polite">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center gap-3">
                        <Bot size={32} className={darkMode ? 'text-slate-600' : 'text-slate-300'} aria-hidden="true" />
                        <p className={`text-xs text-center max-w-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {!canalConfigurado
                            ? 'Configure um canal na aba Extração para usar o chat.'
                            : agentStatus.canal_indexado !== canalConfigurado
                              ? `Indexe @${canalConfigurado} na aba Agente IA para usar o chat.`
                              : t('agent.chat_empty_ready', { canal: canalConfigurado })}
                        </p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${msg.role === 'user' ? 'bg-primary/20 text-primary rounded-br-sm' : msg.role === 'error' ? (darkMode ? 'bg-danger/15 text-danger' : 'bg-red-50 text-red-700 border border-red-200') : (darkMode ? 'bg-white/8 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm')} rounded-bl-sm`}>
                              <p className="whitespace-pre-wrap">
                                {msg.content}
                                {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />}
                              </p>
                              {msg.fontes && msg.fontes.length > 0 && !msg.streaming && (
                                <div className={`pt-2 border-t space-y-1 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                                  <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('agent.sources')}</p>
                                  {msg.fontes.map((f, j) => (
                                    <a key={j} href={f.link} target="_blank" rel="noreferrer"
                                      className={`flex items-start gap-1.5 text-[10px] hover:underline ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                                      <ExternalLink size={9} className="mt-0.5 shrink-0" />
                                      <span>{f.titulo}{f.data ? ` · ${f.data}` : ''}{canalMeta?.canal_handle ? ` · ${canalMeta.canal_handle}` : ''}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${darkMode ? 'bg-white/8' : 'bg-white border border-slate-200'}`}>
                              <Loader2 size={14} className="animate-spin text-primary" />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </>
                    )}
                  </div>
                  <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
                      <input type="text"
                        placeholder={!canalConfigurado ? 'Configure um canal primeiro...' : agentStatus.canal_indexado !== canalConfigurado ? `Indexe @${canalConfigurado} primeiro...` : t('agent.chat_placeholder_ready')}
                        value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                        disabled={!agentStatus.indexed || !canalConfigurado || agentStatus.canal_indexado !== canalConfigurado || chatLoading}
                        autoFocus
                        className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 disabled:cursor-not-allowed ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                      <button onClick={handleChatSend} disabled={!agentStatus.indexed || !canalConfigurado || agentStatus.canal_indexado !== canalConfigurado || !chatInput.trim() || chatLoading}
                        className={`p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                        aria-label={t('agent.send')}>
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Botao flutuante Chat ── */}
          {!chatOpen && (
            <motion.button
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-primary to-accent hover:scale-110 active:scale-95 transition-transform"
              aria-label="Abrir chat com o agente">
              <Bot size={24} className="text-white" />
              {agentStatus.indexed && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-secondary border-2 border-white" />
              )}
              {chatMessages.filter(m => m.role === 'assistant').length > 0 && (
                <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">
                  {chatMessages.filter(m => m.role === 'assistant').length}
                </span>
              )}
            </motion.button>
          )}

          {/* Botão voltar ao topo */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  agentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label="Voltar ao topo"
                className={`fixed bottom-6 right-6 z-30 p-3 rounded-full shadow-lg transition-colors ${btnFocus}
                  ${darkMode ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/35' : 'bg-primary text-white hover:bg-primary/85 shadow-primary/30'}`}>
                <ArrowUp size={18} aria-hidden="true" />
              </motion.button>
            )}
          </AnimatePresence>

          </div>{/* end app com abas */}
        </main>
      </div>
    </>
  );
}

export default App;




