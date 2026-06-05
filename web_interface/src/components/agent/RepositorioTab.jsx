/**
 * @file RepositorioTab.jsx
 * @description Knowledge repository tab: lists YouTube files, documents and texts; supports add/delete
 * @module components/agent/RepositorioTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { fetchRepositorio, uploadDocument, saveText, deleteRepositorioItem } from '../../services/api';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * RepositorioTab — displays and manages the knowledge base files
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode       - dark/light theme flag
 * @param {Object}   props.repositorio    - { youtube, documentos, textos }
 * @param {Function} props.setRepositorio - state setter for repositorio
 * @param {Array}    props.history        - extraction history array
 * @param {string}   props.btnFocus       - Tailwind focus-visible ring classes
 * @param {Function} props.onSetCanal     - callback(url) to propagate a canal URL to the main form
 * @returns {JSX.Element}
 */
function RepositorioTab({ darkMode, repositorio, setRepositorio, history, btnFocus, onSetCanal }) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [mode, setMode]       = React.useState('texto'); // 'texto' | 'arquivo'
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [file, setFile]       = React.useState(null);
  const fileRef = React.useRef(null);

  /** Reloads the repository list from the backend */
  const reload = () =>
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});

  /** Saves pasted text entry to the cerebro */
  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    await saveText(title.trim(), text.trim()).catch(() => {});
    reload(); setShowAdd(false); setTitle(''); setText(''); setSaving(false);
  };

  /** Uploads a file to the cerebro/documentos endpoint */
  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    const form = new FormData();
    form.append('arquivo', file);
    await uploadDocument(form).catch(() => {});
    reload(); setShowAdd(false); setFile(null); setSaving(false);
  };

  /** Deletes a repositório item by type and id */
  const handleDelete = async (tipo, id) => {
    await deleteRepositorioItem(tipo, id).catch(() => {});
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

      {/* YouTube files list */}
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

      {/* User documents list */}
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

      {/* Empty state */}
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

export default RepositorioTab;
