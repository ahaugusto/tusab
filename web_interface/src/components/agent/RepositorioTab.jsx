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
function RepositorioTab({ darkMode, repositorio, setRepositorio, history, btnFocus, onSetCanal, showAdd, setShowAdd: setShowAddProp, canalAtivo }) {
  const [showAddLocal, setShowAddLocal] = React.useState(false);
  const showAdd_ = showAdd !== undefined ? showAdd : showAddLocal;
  const setShowAdd = (v) => { setShowAddLocal(v); setShowAddProp?.(v); };
  const [mode, setMode]       = React.useState('texto');
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [file, setFile]       = React.useState(null);
  const [expandedCanais, setExpandedCanais] = React.useState({});
  const fileRef = React.useRef(null);

  const reload = () =>
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});

  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    await saveText(title.trim(), text.trim(), canalAtivo || '').catch(() => {});
    reload(); setShowAdd(false); setTitle(''); setText(''); setSaving(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    const form = new FormData();
    form.append('arquivo', file);
    if (canalAtivo) form.append('canal', canalAtivo);
    await uploadDocument(form).catch(() => {});
    reload(); setShowAdd(false); setFile(null); setSaving(false);
  };

  const toggleCanal = (nome) =>
    setExpandedCanais(prev => ({ ...prev, [nome]: !prev[nome] }));

  /** Deletes a repositório item by type and id */
  const handleDelete = async (tipo, id) => {
    await deleteRepositorioItem(tipo, id).catch(() => {});
    reload();
  };

  const canais = repositorio.canais || [];
  const totalYT  = repositorio.youtube?.length || 0;
  const totalDoc = (repositorio.documentos?.length || 0) + (repositorio.textos?.length || 0);
  const total    = totalYT + totalDoc;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Repositório de Conhecimento</h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {total} arquivo{total !== 1 ? 's' : ''}
            {canalAtivo && <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${darkMode ? 'bg-primary/15 text-primary' : 'bg-violet-50 text-violet-600'}`}>@{canalAtivo}</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd_)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
          + Adicionar
        </button>
      </div>

      {/* Add panel */}
      {showAdd_ && (
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

      {/* Canal groups */}
      {canais.map(canal => {
        const cTotal = canal.youtube.length + canal.documentos.length + canal.textos.length;
        const isOpen = expandedCanais[canal.nome] !== false; // default open
        const isAvulso = canal.nome === '_avulso';
        return (
          <div key={canal.nome} className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <button
              onClick={() => toggleCanal(canal.nome)}
              className={`w-full px-4 py-3 border-b flex items-center gap-2 text-left transition-colors ${darkMode ? 'border-white/10 bg-white/4 hover:bg-white/8' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
              <span className="text-sm">{isAvulso ? '📁' : '📺'}</span>
              <p className={`text-xs font-bold flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                {isAvulso ? 'Avulso' : `@${canal.nome}`}
              </p>
              <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{cTotal} item{cTotal !== 1 ? 's' : ''}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {isOpen && (
              <div className="divide-y divide-white/5">
                {canal.youtube.map((f, i) => (
                  <div key={`yt-${i}`} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                    <span className="text-sm shrink-0">🎬</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.nome}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{f.data} · {(f.tamanho / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ))}
                {[...canal.documentos.map(d => ({...d, _tipo: 'documentos'})),
                  ...canal.textos.map(d => ({...d, _tipo: 'textos'}))
                ].map((item, i) => (
                  <div key={`doc-${i}`} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                    <span className="text-sm shrink-0">{item._tipo === 'textos' ? '📝' : '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo || item.nome_original}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{item.data} · {item.tipo?.toUpperCase() || 'TXT'} · {item.chars?.toLocaleString()} chars</p>
                    </div>
                    <button onClick={() => handleDelete(item._tipo, item.id)}
                      className={`p-1.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                      aria-label="Remover">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {total === 0 && (
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
