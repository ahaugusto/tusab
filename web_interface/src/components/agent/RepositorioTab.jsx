/**
 * @file RepositorioTab.jsx
 * @description Knowledge repository tab: lists YouTube files, documents and texts; supports add/delete
 * @module components/agent/RepositorioTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';
import { fetchRepositorio, uploadDocument, saveText, deleteRepositorioItem, limparBase } from '../../services/api';
import { Analytics } from '../../services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _EXTS_IMAGEM = new Set(['png','jpg','jpeg','webp','bmp','tiff','tif']);
const _EXTS_AUDIO  = new Set(['mp3','wav','m4a','ogg','flac','opus','aac']);

function _emojiTipo(item) {
  const ext = (item.tipo || '').toLowerCase();
  if (_EXTS_IMAGEM.has(ext)) return '🖼️';
  if (_EXTS_AUDIO.has(ext))  return '🎵';
  if (item._tipo === 'textos') return '📝';
  return '📄';
}

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
  const { t } = useTranslation();
  const [showAddLocal, setShowAddLocal] = React.useState(false);
  const showAdd_ = showAdd !== undefined ? showAdd : showAddLocal;
  const setShowAdd = (v) => { setShowAddLocal(v); setShowAddProp?.(v); };
  const [mode, setMode]       = React.useState('texto');
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [file, setFile]       = React.useState(null);
  const [expandedCanais, setExpandedCanais] = React.useState({});
  const [showLimpar, setShowLimpar]         = React.useState(false);
  const [limparSel, setLimparSel]           = React.useState({ youtube: false, documentos: false, textos: false });
  const [limpando, setLimpando]             = React.useState(false);
  const fileRef = React.useRef(null);

  const reload = () =>
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});

  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    const ok = await saveText(title.trim(), text.trim(), canalAtivo || '').then(() => true).catch(() => false);
    if (ok) Analytics.documentoAdicionado('texto');
    reload(); setShowAdd(false); setTitle(''); setText(''); setSaving(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    const form = new FormData();
    form.append('arquivo', file);
    form.append('canal', canalAtivo || '');
    const ok = await uploadDocument(form).then(() => true).catch(() => false);
    if (ok) Analytics.documentoAdicionado(file.name.split('.').pop()?.toLowerCase() || 'arquivo');
    reload(); setShowAdd(false); setFile(null); setSaving(false);
  };

  const toggleCanal = (nome) =>
    setExpandedCanais(prev => ({ ...prev, [nome]: !prev[nome] }));

  const handleLimpar = async () => {
    if (!limparSel.youtube && !limparSel.documentos && !limparSel.textos) return;
    setLimpando(true);
    await limparBase(limparSel).catch(() => {});
    setShowLimpar(false);
    setLimparSel({ youtube: false, documentos: false, textos: false });
    setLimpando(false);
    reload();
  };

  /** Deletes a repositório item by type and id */
  const handleDelete = async (tipo, id) => {
    await deleteRepositorioItem(tipo, id).catch(() => {});
    reload();
  };

  const canais    = repositorio.canais      || [];
  const flatYT    = repositorio.youtube    || [];
  const flatDocs  = repositorio.documentos || [];
  const flatTexts = repositorio.textos     || [];
  const total     = flatYT.length + flatDocs.length + flatTexts.length;

  // Items already shown inside canal accordions — don't duplicate them
  const coveredYT  = new Set(canais.flatMap(c => c.youtube.map(f => f.nome)));
  const coveredIds = new Set(canais.flatMap(c => [...c.documentos, ...c.textos].map(d => d.id)));

  // Orphan items (legacy flat structure or items without an active canal)
  const orphanYT    = flatYT.filter(f => !coveredYT.has(f.nome));
  const orphanDocs  = flatDocs.filter(d => !coveredIds.has(d.id));
  const orphanTexts = flatTexts.filter(t => !coveredIds.has(t.id));

  const orphanGroups = [
    { key: 'orp-youtube',    label: 'YouTube',    emoji: '🎬', items: orphanYT,    tipo: null },
    { key: 'orp-documentos', label: 'Documentos', emoji: '📄', items: orphanDocs,  tipo: 'documentos' },
    { key: 'orp-textos',     label: 'Textos',     emoji: '📝', items: orphanTexts, tipo: 'textos' },
  ].filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.title')}</h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {total} arquivo{total !== 1 ? 's' : ''}
            {canalAtivo && <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${darkMode ? 'bg-primary/15 text-primary' : 'bg-violet-50 text-violet-600'}`}>@{canalAtivo}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button onClick={() => setShowLimpar(true)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${btnFocus}
                ${darkMode ? 'text-danger/70 hover:text-danger hover:bg-danger/10 border border-danger/20' : 'text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200'}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
              {t('repo.clear')}
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd_)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* Modal — limpar base (portal para evitar clipping por transform de pai) */}
      {showLimpar && ReactDOM.createPortal(
        <ModalWrapper onClose={() => { setShowLimpar(false); setLimparSel({ youtube: false, documentos: false, textos: false }); }} zIndex="z-[9999]" backdrop="bg-black/60" label={t('repo.clear_title')}>
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.clear_title')}</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Esta ação é irreversível. Selecione o que deseja remover:</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { key: 'youtube',    emoji: '🎬', label: 'YouTube', count: flatYT.length },
                { key: 'documentos', emoji: '📄', label: 'Documentos', count: flatDocs.length },
                { key: 'textos',     emoji: '📝', label: 'Textos', count: flatTexts.length },
              ].filter(opt => opt.count > 0).map(opt => (
                <label key={opt.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                    ${limparSel[opt.key]
                      ? darkMode ? 'border-danger/40 bg-danger/10' : 'border-red-300 bg-red-50'
                      : darkMode ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="checkbox" checked={limparSel[opt.key]}
                    onChange={e => setLimparSel(s => ({ ...s, [opt.key]: e.target.checked }))}
                    className="accent-red-500 w-3.5 h-3.5" />
                  <span className="text-sm">{opt.emoji}</span>
                  <span className={`text-xs font-medium flex-1 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{opt.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{opt.count}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowLimpar(false); setLimparSel({ youtube: false, documentos: false, textos: false }); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {t('repo.cancel')}
              </button>
              <button onClick={handleLimpar}
                disabled={limpando || (!limparSel.youtube && !limparSel.documentos && !limparSel.textos)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {limpando ? 'Removendo…' : 'Confirmar remoção'}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}

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
                {saving ? t('repo.saving') : t('repo.save_text')}
              </button>
            </>
          ) : (
            <>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${darkMode ? 'border-white/15 hover:border-primary/40' : 'border-slate-200 hover:border-violet-300'}`}
                onClick={() => fileRef.current?.click()}>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {file ? file.name : 'Clique para selecionar arquivo'}
                </p>
                <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  📄 .pdf .docx .txt .md
                </p>
                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  🖼️ .png .jpg .jpeg .webp .bmp .tiff
                </p>
                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  🎵 .mp3 .wav .m4a .ogg .flac .opus .aac
                </p>
              </div>
              <input ref={fileRef} type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.mp3,.wav,.m4a,.ogg,.flac,.opus,.aac"
                className="hidden"
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
                    <span className="text-sm shrink-0">{_emojiTipo(item)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo || item.nome_original}</p>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{item.data} · {item.tipo?.toUpperCase() || 'TXT'} · {item.chars?.toLocaleString()} chars</p>
                    </div>
                    <button onClick={() => handleDelete(item._tipo, item.id)}
                      className={`p-2.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                      aria-label={`Remover ${item.titulo || item.nome_original || 'arquivo'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Orphan groups — legacy flat files not covered by any canal accordion */}
      {orphanGroups.map(group => {
        const isOpen = expandedCanais[group.key] !== false;
        return (
          <div key={group.key} className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <button
              onClick={() => toggleCanal(group.key)}
              className={`w-full px-4 py-3 border-b flex items-center gap-2 text-left transition-colors ${darkMode ? 'border-white/10 bg-white/4 hover:bg-white/8' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
              <span className="text-sm">{group.emoji}</span>
              <p className={`text-xs font-bold flex-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>{group.label}</p>
              <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {isOpen && (
              <div className="divide-y divide-white/5">
                {group.tipo === null
                  ? group.items.map((f, i) => (
                    <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                      <span className="text-sm shrink-0">🎬</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.nome}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{f.data} · {(f.tamanho / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  ))
                  : group.items.map((item, i) => (
                    <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                      <span className="text-sm shrink-0">{_emojiTipo({...item, _tipo: group.tipo})}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo || item.nome_original}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{item.data} · {item.tipo?.toUpperCase() || 'TXT'} · {item.chars?.toLocaleString()} chars</p>
                      </div>
                      <button onClick={() => handleDelete(group.tipo, item.id)}
                        className={`p-2.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                        aria-label={`Remover ${item.titulo || item.nome_original || 'arquivo'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                      </button>
                    </div>
                  ))
                }
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
