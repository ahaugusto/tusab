# -*- coding: utf-8 -*-
"""Adds HomeScreen, RepositorioTab, RelatorioTab components to App.jsx"""

APP = r'C:\Users\augus\Desktop\Brainiac\web_interface\src\App.jsx'

with open(APP, 'r', encoding='utf-8') as f:
    src = f.read()

# Find insertion point — before the Onboarding component
INSERT_BEFORE = "// ── Onboarding ─────────────────────────────────────────────────────────────"

COMPONENTS = r"""// ── Home Screen ──────────────────────────────────────────────────────────────

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
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
      {history.length === 1 && (
        <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>@{canal}</p>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
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


"""

if INSERT_BEFORE not in src:
    print("ERROR: insertion point not found")
    sys.exit(1)

src = src.replace(INSERT_BEFORE, COMPONENTS + INSERT_BEFORE, 1)
print("Components added")

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print("Done. Lines:", src.count('\n'))
