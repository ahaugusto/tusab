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
import { fetchRepositorio, uploadDocument, saveText, deleteRepositorioItem, limparBase, buscarBase, lerArquivo, listarProjetos, criarProjeto, limparCanal, resetTotal } from '../../services/api';
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

// Tipos aceitos para input e drag-drop
const ACCEPT_TYPES = '.pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.mp3,.wav,.m4a,.ogg,.flac,.opus,.aac';

function _fileIsAccepted(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const accepted = ['pdf','docx','xlsx','csv','txt','md','png','jpg','jpeg','webp','bmp','tiff','mp3','wav','m4a','ogg','flac','opus','aac'];
  return accepted.includes(ext);
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * RepositorioTab — displays and manages the knowledge base files
 *
 * @param {Object}   props
 * @param {boolean}  props.darkMode       - dark/light theme flag
 * @param {Object}   props.repositorio    - { youtube, documentos, textos, canais }
 * @param {Function} props.setRepositorio - state setter for repositorio
 * @param {Array}    props.history        - extraction history array
 * @param {string}   props.btnFocus       - Tailwind focus-visible ring classes
 * @param {Function} props.onSetCanal     - callback(url) to propagate a canal URL to the main form
 * @param {string}   props.canalAtivo     - canal currently active
 * @returns {JSX.Element}
 */
function RepositorioTab({ darkMode, repositorio, setRepositorio, history, btnFocus, onSetCanal, showAdd, setShowAdd: setShowAddProp, canalAtivo, onInjetarContexto }) {
  const { t } = useTranslation();
  const [showAddLocal, setShowAddLocal] = React.useState(false);
  const showAdd_ = showAdd !== undefined ? showAdd : showAddLocal;
  const setShowAdd = (v) => { setShowAddLocal(v); setShowAddProp?.(v); };
  const [mode, setMode]       = React.useState('texto');
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [file, setFile]       = React.useState(null);
  const [uploadAviso, setUploadAviso] = React.useState('');
  const [expandedCanais, setExpandedCanais] = React.useState({});
  const [showLimpar, setShowLimpar]         = React.useState(false);
  const [limparSel, setLimparSel]           = React.useState({ youtube: false, documentos: false, textos: false });
  const [limpando, setLimpando]             = React.useState(false);
  const [showResetTotal, setShowResetTotal] = React.useState(false);
  const [resetConfirm, setResetConfirm]     = React.useState('');
  const [resetando, setResetando]           = React.useState(false);
  const [limparCanalNome, setLimparCanalNome] = React.useState(null); // canal sendo limpo
  const [limpandoCanal, setLimpandoCanal]   = React.useState(false);
  const [dragging, setDragging]             = React.useState(false);
  const [buscaQuery,     setBuscaQuery]     = React.useState('');
  const [buscaResultados, setBuscaResultados] = React.useState(null);
  const [buscando,       setBuscando]       = React.useState(false);
  const [showBusca,      setShowBusca]      = React.useState(false);
  // ─── Project selector ────────────────────────────────────────────────────────
  const [projetos,       setProjetos]       = React.useState([]);
  const [projetoSel,     setProjetoSel]     = React.useState('');   // '' = usa canalAtivo
  const [showNovoProjeto, setShowNovoProjeto] = React.useState(false);
  const [novoProjNome,   setNovoProjNome]   = React.useState('');
  const [criandoProj,    setCriandoProj]    = React.useState(false);
  const fileRef  = React.useRef(null);
  const dropRef  = React.useRef(null);

  const reload = () =>
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});

  const reloadProjetos = () =>
    listarProjetos().then(r => setProjetos(r.data.projetos || [])).catch(() => {});

  // Resolve which canal/project name to use for uploads
  const _canalEfetivo = () => projetoSel || canalAtivo || '';

  const handleCriarProjeto = async () => {
    const nome = novoProjNome.trim();
    if (!nome) return;
    setCriandoProj(true);
    try {
      const res = await criarProjeto(nome);
      if (res.data?.ok) {
        await reloadProjetos();
        setProjetoSel(res.data.nome);
        setShowNovoProjeto(false);
        setNovoProjNome('');
      }
    } catch { /* ignore */ }
    setCriandoProj(false);
  };

  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    const ok = await saveText(title.trim(), text.trim(), _canalEfetivo()).then(() => true).catch(() => false);
    if (ok) Analytics.documentoAdicionado('texto');
    reload(); setShowAdd(false); setTitle(''); setText(''); setSaving(false);
  };

  const handleUpload = async (fileToUpload = file) => {
    if (!fileToUpload) return;
    setSaving(true);
    setUploadAviso('');
    const form = new FormData();
    form.append('arquivo', fileToUpload);
    form.append('canal', _canalEfetivo());
    try {
      const res = await uploadDocument(form);
      const data = res.data;
      if (data?.error) {
        setUploadAviso(data.message || 'Erro ao processar arquivo.');
      } else {
        Analytics.documentoAdicionado(fileToUpload.name.split('.').pop()?.toLowerCase() || 'arquivo');
        if (data?.aviso) {
          // Imagem registrada mas sem extração de texto — mostra aviso informativo
          setUploadAviso('⚠️ Imagem registrada no repositório. Para extrair o texto, instale Ollama com modelo multimodal (llava) ou Tesseract OCR.');
        }
        reload();
        setFile(null);
        setShowAdd(false);
      }
    } catch {
      setUploadAviso('Erro de conexão com o servidor.');
    }
    setSaving(false);
  };

  // ─── Drag and drop ────────────────────────────────────────────────────────

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropRef.current?.contains(e.relatedTarget)) setDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    if (!_fileIsAccepted(dropped)) {
      setUploadAviso('Tipo de arquivo não suportado. Use PDF, DOCX, XLSX, CSV, TXT, MD, imagem ou áudio.');
      return;
    }
    setFile(dropped);
    // Se já estiver em modo arquivo, faz upload automaticamente
    if (mode === 'arquivo') {
      await handleUpload(dropped);
    } else {
      // Muda para modo arquivo e deixa o usuário confirmar
      setMode('arquivo');
    }
  };

  // Drop na zona fora do painel (sobre o repositório inteiro)
  const handleGlobalDragOver = (e) => {
    e.preventDefault();
    if (!showAdd_) {
      setShowAdd(true);
      setMode('arquivo');
    }
    setDragging(true);
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

  const handleDelete = async (tipo, id) => {
    await deleteRepositorioItem(tipo, id).catch(() => {});
    reload();
  };

  const handleLimparCanal = async () => {
    if (!limparCanalNome) return;
    setLimpandoCanal(true);
    await limparCanal(limparCanalNome).catch(() => {});
    setLimparCanalNome(null);
    setLimpandoCanal(false);
    reload();
  };

  const handleResetTotal = async () => {
    if (resetConfirm !== 'RESETAR') return;
    setResetando(true);
    await resetTotal().catch(() => {});
    setShowResetTotal(false);
    setResetConfirm('');
    setResetando(false);
    reload();
  };

  const handleBuscar = async (e) => {
    e?.preventDefault();
    const q = buscaQuery.trim();
    if (!q) return;
    setBuscando(true);
    setBuscaResultados(null);
    try {
      const res = await buscarBase(q, canalAtivo || '');
      setBuscaResultados(res.data);
    } catch {
      setBuscaResultados({ resultados: [], total: 0, query: q });
    }
    setBuscando(false);
  };

  const canais    = repositorio.canais      || [];
  const flatYT    = repositorio.youtube    || [];
  const flatDocs  = repositorio.documentos || [];
  const flatTexts = repositorio.textos     || [];
  const total     = flatYT.length + flatDocs.length + flatTexts.length;

  const coveredYT  = new Set(canais.flatMap(c => c.youtube.map(f => f.nome)));
  const coveredIds = new Set(canais.flatMap(c => [...c.documentos, ...c.textos].map(d => d.id)));

  const orphanYT    = flatYT.filter(f => !coveredYT.has(f.nome));
  const orphanDocs  = flatDocs.filter(d => !coveredIds.has(d.id));
  const orphanTexts = flatTexts.filter(t => !coveredIds.has(t.id));

  const orphanGroups = [
    { key: 'orp-youtube',    label: 'YouTube',    emoji: '🎬', items: orphanYT,    tipo: null },
    { key: 'orp-documentos', label: 'Documentos', emoji: '📄', items: orphanDocs,  tipo: 'documentos' },
    { key: 'orp-textos',     label: 'Textos',     emoji: '📝', items: orphanTexts, tipo: 'textos' },
  ].filter(g => g.items.length > 0);

  return (
    <div
      className="space-y-4"
      onDragOver={handleGlobalDragOver}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}>

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
          {total > 0 && (
            <button onClick={() => { setShowBusca(b => !b); setBuscaQuery(''); setBuscaResultados(null); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
                ${showBusca
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : darkMode ? 'text-slate-400 hover:bg-white/8 border-white/15' : 'text-slate-500 hover:bg-slate-100 border-slate-200'}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Buscar
            </button>
          )}
          <button onClick={() => { setShowResetTotal(true); setResetConfirm(''); }}
            title="Resetar toda a base de conhecimento"
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
              ${darkMode ? 'text-danger/60 hover:text-danger hover:bg-danger/10 border-danger/20' : 'text-red-300 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l16 16M4 20L20 4"/></svg>
            Reset
          </button>
          <button onClick={() => { const next = !showAdd_; setShowAdd(next); setUploadAviso(''); if (next) reloadProjetos(); else { setShowNovoProjeto(false); setNovoProjNome(''); } }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
            + Adicionar
          </button>
        </div>
      </div>

      {/* ── Busca avançada ── */}
      {showBusca && (
        <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <form onSubmit={handleBuscar} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-slate-300'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Buscar termo nos arquivos do repositório…"
              value={buscaQuery}
              onChange={e => setBuscaQuery(e.target.value)}
              className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`} />
            {buscando
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary shrink-0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              : <button type="submit" className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors shrink-0 ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>Buscar</button>
            }
          </form>

          {buscaResultados && (
            <div className="space-y-2">
              <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {buscaResultados.total === 0
                  ? `Nenhum resultado para "${buscaResultados.query}"`
                  : `${buscaResultados.total} resultado${buscaResultados.total !== 1 ? 's' : ''} para "${buscaResultados.query}"`}
              </p>
              {buscaResultados.resultados.map((r, i) => (
                <div key={i} className={`rounded-xl border p-3 space-y-1.5 ${darkMode ? 'bg-white/4 border-white/8' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {r.tipo === 'youtube' ? '🎬' : r.tipo === 'documento' ? '📄' : '📝'} {r.arquivo}
                      </p>
                      {r.canal && (
                        <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${darkMode ? 'bg-white/8 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>@{r.canal}</span>
                      )}
                    </div>
                    {onInjetarContexto && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => onInjetarContexto(r.trecho, r.arquivo)}
                          title="Injeta apenas o trecho encontrado — mais preciso"
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-colors
                            ${darkMode ? 'bg-secondary/20 text-secondary hover:bg-secondary/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                          + Trecho
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await lerArquivo(r.caminho);
                              if (res.data?.ok) {
                                onInjetarContexto(res.data.conteudo, r.arquivo);
                              }
                            } catch { /* silently ignore */ }
                          }}
                          title="Injeta o arquivo completo — mais contexto, consome mais da janela do LLM"
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-colors
                            ${darkMode ? 'bg-white/10 text-slate-400 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                          + Arquivo
                        </button>
                      </div>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    …{r.trecho}…
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal — limpar base */}
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
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors
          ${dragging
            ? darkMode ? 'border-primary bg-primary/8' : 'border-violet-400 bg-violet-50'
            : darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>

          {/* Project selector */}
          <div className="space-y-1.5">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Pasta / Projeto</p>
            <div className="flex gap-2 items-center">
              <select
                value={projetoSel}
                onChange={e => {
                  if (e.target.value === '__novo__') {
                    setShowNovoProjeto(true);
                  } else {
                    setProjetoSel(e.target.value);
                    setShowNovoProjeto(false);
                  }
                }}
                style={darkMode ? { colorScheme: 'dark' } : {}}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-[#1a2035] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
                <option value="">{canalAtivo ? `@${canalAtivo} (atual)` : 'Avulso (sem projeto)'}</option>
                {projetos.map(p => (
                  <option key={p.nome} value={p.nome}>
                    {p.tipo === 'youtube' ? `📺 @${p.nome}` : `📁 ${p.nome}`}
                  </option>
                ))}
                <option value="__novo__">+ Novo projeto…</option>
              </select>
            </div>
            {showNovoProjeto && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do projeto"
                  value={novoProjNome}
                  onChange={e => setNovoProjNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCriarProjeto()}
                  autoFocus
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
                <button
                  onClick={handleCriarProjeto}
                  disabled={criandoProj || !novoProjNome.trim()}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
                  {criandoProj ? '…' : 'Criar'}
                </button>
                <button
                  onClick={() => { setShowNovoProjeto(false); setNovoProjNome(''); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${darkMode ? 'text-slate-500 hover:bg-white/8' : 'text-slate-400 hover:bg-slate-100'} ${btnFocus}`}>
                  ✕
                </button>
              </div>
            )}
          </div>

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
              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none
                  ${dragging
                    ? darkMode ? 'border-primary bg-primary/12 scale-[1.01]' : 'border-violet-400 bg-violet-50 scale-[1.01]'
                    : file
                      ? darkMode ? 'border-secondary/50 bg-secondary/8' : 'border-emerald-300 bg-emerald-50'
                      : darkMode ? 'border-white/15 hover:border-primary/40' : 'border-slate-200 hover:border-violet-300'}`}>

                {file ? (
                  <>
                    <p className="text-lg mb-1">
                      {_EXTS_IMAGEM.has(file.name.split('.').pop()?.toLowerCase()) ? '🖼️'
                        : _EXTS_AUDIO.has(file.name.split('.').pop()?.toLowerCase()) ? '🎵' : '📄'}
                    </p>
                    <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{file.name}</p>
                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {(file.size / 1024).toFixed(0)} KB · Clique para trocar
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-xs font-medium ${dragging ? 'text-primary' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {dragging ? 'Solte aqui para fazer upload' : 'Arraste e solte ou clique para selecionar'}
                    </p>
                    <div className={`mt-2 space-y-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      <p className="text-[10px]">📄 PDF · DOCX · XLSX · CSV · TXT · MD</p>
                      <p className="text-[10px]">🖼️ PNG · JPG · JPEG · WEBP · BMP · TIFF</p>
                      <p className="text-[10px]">🎵 MP3 · WAV · M4A · OGG · FLAC · OPUS · AAC</p>
                    </div>
                  </>
                )}
              </div>

              <input ref={fileRef} type="file"
                accept={ACCEPT_TYPES}
                className="hidden"
                onChange={e => { setFile(e.target.files[0] || null); setUploadAviso(''); }} />

              {/* Aviso de extração parcial (imagem sem OCR) */}
              {uploadAviso && (
                <p className={`text-[11px] rounded-xl px-3 py-2 leading-relaxed
                  ${uploadAviso.startsWith('⚠️')
                    ? darkMode ? 'bg-warning/10 text-warning' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    : darkMode ? 'bg-danger/10 text-danger' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {uploadAviso}
                </p>
              )}

              <button onClick={() => handleUpload(file)} disabled={saving || !file}
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
        const isOpen = expandedCanais[canal.nome] !== false;
        const isAvulso = canal.nome === '_avulso';
        return (
          <div key={canal.nome} className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
              <button onClick={() => toggleCanal(canal.nome)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                <span className="text-sm shrink-0">{isAvulso ? '📁' : '📺'}</span>
                <p className={`text-xs font-bold flex-1 truncate ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  {isAvulso ? 'Avulso' : `@${canal.nome}`}
                </p>
                <span className={`text-[10px] shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{cTotal} item{cTotal !== 1 ? 's' : ''}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setLimparCanalNome(canal.nome); }}
                title={`Limpar tudo do canal @${canal.nome}`}
                className={`shrink-0 p-1.5 rounded-lg transition-colors text-danger/50 hover:text-danger hover:bg-danger/10 ${btnFocus}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
              </button>
            </div>

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

      {/* Orphan groups */}
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

      {/* Modal — limpar canal individual */}
      {limparCanalNome && ReactDOM.createPortal(
        <ModalWrapper onClose={() => !limpandoCanal && setLimparCanalNome(null)} zIndex="z-[9999]" backdrop="bg-black/60" label="Limpar canal">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Limpar canal</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Remove todas as transcrições, documentos, textos e índice BM25 do canal <span className="font-bold">@{limparCanalNome}</span>. Irreversível.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setLimparCanalNome(null)} disabled={limpandoCanal}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleLimparCanal} disabled={limpandoCanal}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {limpandoCanal ? 'Removendo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}

      {/* Modal — reset total */}
      {showResetTotal && ReactDOM.createPortal(
        <ModalWrapper onClose={() => !resetando && (setShowResetTotal(false), setResetConfirm(''))} zIndex="z-[9999]" backdrop="bg-black/70" label="Reset total">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/20' : 'bg-red-100'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Resetar base completa</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Apaga <strong>todo o cérebro</strong>: transcrições, documentos, textos, índices BM25 e histórico de extração. Não há como desfazer.
                </p>
              </div>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${darkMode ? 'bg-danger/8 border-danger/25' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-[10px] mb-2 font-semibold ${darkMode ? 'text-danger/80' : 'text-red-500'}`}>
                Digite <span className="font-mono font-bold">RESETAR</span> para confirmar:
              </p>
              <input
                type="text"
                value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                placeholder="RESETAR"
                autoFocus
                className={`w-full rounded-lg border px-3 py-1.5 text-xs font-mono outline-none focus:border-danger
                  ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowResetTotal(false); setResetConfirm(''); }} disabled={resetando}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleResetTotal} disabled={resetando || resetConfirm !== 'RESETAR'}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {resetando ? 'Resetando…' : 'Resetar tudo'}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}
    </div>
  );
}

export default RepositorioTab;
