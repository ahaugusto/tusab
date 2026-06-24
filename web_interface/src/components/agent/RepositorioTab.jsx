/**
 * @file RepositorioTab.jsx
 * @description Knowledge repository tab: lists YouTube files, documents and texts; supports add/delete
 * @module components/agent/RepositorioTab
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalWrapper from '../shared/ModalWrapper';
import { fetchRepositorio, fetchAgentStatus, uploadDocument, saveText, deleteRepositorioItem, limparBase, buscarBase, lerArquivo, listarProjetos, criarProjeto, limparCanal, resetTotal, startIndexing, exportarBaseCompartilhavel, importarBaseCompartilhavel, fetchReadonlyStatus, openFolder } from '../../services/api';
import { Analytics } from '../../services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _EXTS_IMAGEM = new Set(['png','jpg','jpeg','webp','bmp','tiff','tif']);
const _EXTS_AUDIO  = new Set(['mp3','wav','m4a','ogg','flac','opus','aac']);

function _emojiTipo(item) {
  const ext = (item.tipo || '').toLowerCase();
  if (_EXTS_IMAGEM.has(ext)) return '🖼️';
  if (_EXTS_AUDIO.has(ext))  return '🎵';
  if (item._tipo === 'texts' || item._tipo === 'textos') return '📝';
  return '📄';
}

// Tipos aceitos para input e drag-drop
const ACCEPT_TYPES = '.pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.mp3,.wav,.m4a,.ogg,.flac,.opus,.aac';

function _fileIsAccepted(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const accepted = ['pdf','docx','xlsx','csv','txt','md','png','jpg','jpeg','webp','bmp','tiff','mp3','wav','m4a','ogg','flac','opus','aac'];
  return accepted.includes(ext);
}

// ─── IndexarModal ────────────────────────────────────────────────────────────

function IndexarModal({ darkMode, btnFocus, projetos, indexarSel, setIndexarSel, indexando, filaStatus = {}, agentStatus, onConfirmar, onFechar }) {
  const { t } = useTranslation();
  const [busca, setBusca] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const lista = projetos.length > 0 ? projetos : [];
  const listaFiltrada = busca.trim()
    ? lista.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
    : lista;
  const listaComConteudo = listaFiltrada.filter(p => (p.n_arquivos ?? 1) > 0);
  const todos = listaComConteudo.length > 0 && listaComConteudo.every(p => indexarSel[p.nome]);
  const nSel  = Object.values(indexarSel).filter(Boolean).length;

  const toggleTodos = () => {
    const sel = { ...indexarSel };
    listaComConteudo.forEach(p => { sel[p.nome] = !todos; });
    setIndexarSel(sel);
  };

  return (
    <div className={`w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden
      ${darkMode ? 'bg-[#0C1122] border-white/15 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
      style={{ maxHeight: 'min(80vh, 640px)' }}>

      {/* Header */}
      <div className={`px-5 pt-5 pb-4 border-b shrink-0 ${darkMode ? 'border-white/8' : 'border-slate-100'}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t('repo.indexar_title')}</h3>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
              {t('repo.indexar_subtitle', { count: nSel })}
            </p>
          </div>
          {!indexando && !agentStatus?.indexing && (
            <button onClick={onFechar}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:bg-white/8' : 'text-slate-400 hover:bg-slate-100'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30
          ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('repo.indexar_search_placeholder', { count: lista.length })}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 ${darkMode ? 'text-white' : 'text-slate-800'}`}
          />
          {busca && (
            <button onClick={() => setBusca('')} className={`${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 custom-scrollbar">
        {/* Selecionar todos (da lista filtrada) */}
        {listaComConteudo.length > 0 && (
          <button
            onClick={toggleTodos}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors mb-1
              ${todos
                ? darkMode ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-violet-50 border-violet-300 text-violet-700'
                : darkMode ? 'border-white/10 text-slate-300 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
              ${todos ? 'bg-primary border-primary' : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
              {todos && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            {todos ? t('repo.deselect_all') : busca ? t('repo.indexar_select_results', { count: listaComConteudo.length }) : t('repo.select_all')}
          </button>
        )}

        {listaFiltrada.length === 0 ? (
          <div className={`text-center py-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {busca
              ? <><p className="text-sm mb-1">🔍</p><p className="text-xs">{t('repo.indexar_no_match', { query: busca })}</p></>
              : <><p className="text-sm mb-1">📭</p><p className="text-xs">{t('repo.indexar_empty')}</p></>
            }
          </div>
        ) : listaFiltrada.map(p => {
          const st = filaStatus[p.nome];
          const emFila = !!st;
          const semConteudo = !emFila && (p.n_arquivos === 0);
          const disabled = semConteudo || emFila;
          const borderColor = st === 'ok'
            ? darkMode ? 'border-emerald-500/50 bg-emerald-500/8' : 'border-emerald-300 bg-emerald-50'
            : st === 'erro'
              ? darkMode ? 'border-red-500/50 bg-red-500/8' : 'border-red-300 bg-red-50'
              : st === 'indexando'
                ? darkMode ? 'border-accent/50 bg-accent/8' : 'border-cyan-300 bg-cyan-50'
                : st === 'aguardando'
                  ? darkMode ? 'border-white/15 bg-white/4' : 'border-slate-200 bg-slate-50'
                  : semConteudo
                    ? darkMode ? 'border-white/5 bg-white/2 opacity-50' : 'border-slate-100 bg-slate-50/50 opacity-50'
                    : indexarSel[p.nome]
                      ? darkMode ? 'bg-primary/10 border-primary/35' : 'bg-violet-50 border-violet-200'
                      : darkMode ? 'border-white/8 hover:border-white/20' : 'border-slate-100 hover:border-slate-200';
          return (
            <button key={p.nome}
              onClick={() => !disabled && setIndexarSel(prev => ({ ...prev, [p.nome]: !prev[p.nome] }))}
              disabled={semConteudo}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${borderColor} ${disabled ? 'cursor-default' : ''}`}>
              {/* Checkbox / status indicator */}
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                ${st === 'ok' ? 'bg-emerald-500 border-emerald-500'
                  : st === 'erro' ? 'bg-red-500 border-red-500'
                  : st === 'indexando' ? 'bg-accent border-accent'
                  : st === 'aguardando' ? darkMode ? 'border-white/20' : 'border-slate-300'
                  : semConteudo ? darkMode ? 'border-white/10' : 'border-slate-200'
                  : indexarSel[p.nome] ? 'bg-primary border-primary'
                  : darkMode ? 'border-white/30' : 'border-slate-300'}`}>
                {st === 'ok' && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                {st === 'erro' && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                {st === 'indexando' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                {st === 'aguardando' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                {!st && !semConteudo && indexarSel[p.nome] && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className="shrink-0">{p.tipo === 'youtube' ? '🎬' : '🧠'}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium truncate block ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {p.tipo === 'youtube' ? `@${p.nome}` : p.nome}
                </span>
                {semConteudo && (
                  <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Sem conteúdo — adicione arquivos ou extraia um canal
                  </span>
                )}
              </div>
              {/* Status label */}
              {st && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                  ${st === 'ok' ? darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    : st === 'erro' ? darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                    : st === 'indexando' ? darkMode ? 'bg-accent/20 text-accent' : 'bg-cyan-100 text-cyan-700'
                    : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {st === 'ok' ? '✓ ok' : st === 'erro' ? '✗ erro' : st === 'indexando' ? 'indexando…' : 'aguardando'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`px-5 pb-5 pt-3 flex gap-2 shrink-0 border-t ${darkMode ? 'border-white/8' : 'border-slate-100'}`}>
        <button onClick={onFechar} disabled={indexando || agentStatus?.indexing}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40
            ${darkMode ? 'bg-white/8 text-slate-300 hover:bg-white/12' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {t('repo.cancel')}
        </button>
        <button onClick={onConfirmar} disabled={indexando || agentStatus?.indexing || nSel === 0}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
            bg-accent/20 text-accent hover:bg-accent/30`}>
          {(indexando || agentStatus?.indexing) ? t('repo.indexing_short') : t('repo.indexar_btn', { count: nSel })}
        </button>
      </div>
    </div>
  );
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
function RepositorioTab({ darkMode, repositorio, setRepositorio, history, btnFocus, onSetCanal, showAdd, setShowAdd: setShowAddProp, canalAtivo, onInjetarContexto, onIndexar, agentStatus, openIndexar, onOpenIndexarHandled, regras, openImport, onOpenImportHandled, projetoInicial, onProjetoInicialHandled }) {
  const { t } = useTranslation();
  const [showAddLocal, setShowAddLocal] = React.useState(false);
  const showAdd_ = showAdd !== undefined ? showAdd : showAddLocal;
  const setShowAdd = (v) => { setShowAddLocal(v); setShowAddProp?.(v); };
  const [mode, setMode]       = React.useState('arquivo');
  const [title, setTitle]     = React.useState('');
  const [text, setText]       = React.useState('');
  const [saving, setSaving]       = React.useState(false);
  const [files, setFiles]         = React.useState([]);          // multiple files queue
  const [uploadProgress, setUploadProgress] = React.useState({}); // { fileName: 'ok'|'error'|'loading' }
  const [uploadAviso, setUploadAviso] = React.useState('');
  const [reindexando, setReindexando] = React.useState(false);
  const [expandedCanais, setExpandedCanais] = React.useState({});
  const [showLimpar, setShowLimpar]         = React.useState(false);
  const [limparSel, setLimparSel]           = React.useState({ youtube: false, documentos: false, textos: false });
  const [limparBasesSel, setLimparBasesSel] = React.useState({}); // { nomeDaBase: bool }
  const [limpando, setLimpando]             = React.useState(false);
  const [showResetTotal, setShowResetTotal] = React.useState(false);
  const [resetConfirm, setResetConfirm]     = React.useState('');
  const [resetando, setResetando]           = React.useState(false);
  const [limparCanalNome, setLimparCanalNome] = React.useState(null); // canal sendo limpo
  const [limpandoCanal, setLimpandoCanal]   = React.useState(false);
  const [dragging, setDragging]             = React.useState(false);
  // busca por projeto: { [nome]: { query, resultados, buscando } }
  const [buscaState, setBuscaState] = React.useState({});
  const [showIndexar,    setShowIndexar]    = React.useState(false);
  const [indexarSel,     setIndexarSel]     = React.useState({});   // { nome: bool }
  const [indexando,      setIndexando]      = React.useState(false);
  const [filaStatus,     setFilaStatus]     = React.useState({});   // { nome: 'aguardando'|'indexando'|'ok'|'erro' }
  const [indexSnackbar,  setIndexSnackbar]  = React.useState(null);
  const prevIndexingRef = React.useRef(false);
  const [exportando,     setExportando]     = React.useState(false);
  const [importando,     setImportando]     = React.useState(false);
  const [shareSnackbar,  setShareSnackbar]  = React.useState(null);
  const [readonlyMap,    setReadonlyMap]    = React.useState({});
  const importInputRef = React.useRef(null);

  React.useEffect(() => {
    if (openImport) {
      importInputRef.current?.click();
      onOpenImportHandled?.();
    }
  }, [openImport]);
  // ─── Project selector ────────────────────────────────────────────────────────
  const [projetos,       setProjetos]       = React.useState([]);
  const [projetoSel,     setProjetoSel]     = React.useState('');   // '' = usa canalAtivo
  const [forceSelecionarProjeto, setForceSelecionarProjeto] = React.useState(false); // volta ao step de seleção mesmo com canalAtivo
  const [showNovoProjeto, setShowNovoProjeto] = React.useState(false);
  const [novoProjNome,   setNovoProjNome]   = React.useState('');
  const [showCriarProjetoModal, setShowCriarProjetoModal] = React.useState(false);
  const [criarProjetoNome,      setCriarProjetoNome]      = React.useState('');
  const [criandoProj,    setCriandoProj]    = React.useState(false);
  const fileRef  = React.useRef(null);
  const dropRef  = React.useRef(null);

  // Pré-seleciona projeto quando vindo de fora (ex: criação no folder picker)
  React.useEffect(() => {
    if (projetoInicial) {
      setProjetoSel(projetoInicial);
      onProjetoInicialHandled?.();
    }
  }, [projetoInicial]);

  const closeAddModal = () => {
    setShowAdd(false);
    setProjetoSel('');
    setNovoProjNome('');
    setForceSelecionarProjeto(false);
  };

  const reload = () => {
    fetchRepositorio().then(r => setRepositorio(r.data)).catch(() => {});
    fetchReadonlyStatus().then(r => setReadonlyMap(r.data || {})).catch(() => {});
  };

  const toggleCanal = (nome) =>
    setExpandedCanais(prev => ({ ...prev, [nome]: !(prev[nome] !== false) }));

  const reloadProjetos = () =>
    listarProjetos().then(r => setProjetos(r.data.projetos || [])).catch(() => {});

  // Detecta fim da indexação via agentStatus e exibe snackbar
  React.useEffect(() => {
    const agora = agentStatus?.indexing;
    if (prevIndexingRef.current && !agora) {
      setIndexSnackbar(t('repo.index_success'));
      setTimeout(() => setIndexSnackbar(null), 4000);
    }
    prevIndexingRef.current = agora;
  }, [agentStatus?.indexing]);

  // Abrir modal de indexação externamente (ex: vindo do chat)
  React.useEffect(() => {
    if (!openIndexar) return;
    listarProjetos()
      .then(res => {
        const lista = res?.data?.projetos || [];
        setProjetos(lista);
        const sel = {};
        lista.forEach(p => { if ((p.n_arquivos ?? 1) > 0) sel[p.nome] = true; });
        setIndexarSel(sel);
        setShowIndexar(true);
        onOpenIndexarHandled?.();
      })
      .catch(() => {
        setShowIndexar(true);
        onOpenIndexarHandled?.();
      });
  }, [openIndexar]);

  const handleIndexarConfirmar = async () => {
    const projetosMap = Object.fromEntries(projetos.map(p => [p.nome, p]));
    const selecionados = Object.entries(indexarSel)
      .filter(([k, v]) => v && (projetosMap[k]?.n_arquivos ?? 1) > 0)
      .map(([k]) => k);
    if (selecionados.length === 0 || !onIndexar) return;
    setIndexando(true);
    setFilaStatus({});
    await onIndexar(selecionados, (nome, status) =>
      setFilaStatus(prev => ({ ...prev, [nome]: status }))
    ).catch?.(() => {});
    setIndexando(false);
    // Fecha o modal após 1s para o usuário ver o estado final dos cards
    setTimeout(() => { setShowIndexar(false); setFilaStatus({}); }, 1000);
  };

  // Resolve which canal/project name to use for uploads
  // Se forceSelecionarProjeto=true, ignora canalAtivo e força o step de seleção
  const _canalEfetivo = () => forceSelecionarProjeto ? (projetoSel || '') : (projetoSel || canalAtivo || '');

  const handleCriarProjeto = async () => {
    const nome = novoProjNome.trim();
    if (!nome) return;
    setCriandoProj(true);
    try {
      const res = await criarProjeto(nome);
      if (res.data?.ok) {
        await reloadProjetos();
        setProjetoSel(res.data.nome);
        setForceSelecionarProjeto(false);
        setShowNovoProjeto(false);
        setNovoProjNome('');
      }
    } catch { /* ignore */ }
    setCriandoProj(false);
  };

  const handleSaveText = async () => {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    const canal = _canalEfetivo();
    const ok = await saveText(title.trim(), text.trim(), canal).then(() => true).catch(() => false);
    if (ok) {
      Analytics.documentoAdicionado('texto');
      reload();
      closeAddModal();
      setTitle('');
      setText('');
      _triggerReindex(canal);
    }
    setSaving(false);
  };

  const _addFiles = (newFiles) => {
    const accepted = Array.from(newFiles).filter(_fileIsAccepted);
    const rejected = Array.from(newFiles).filter(f => !_fileIsAccepted(f));
    if (rejected.length > 0) {
      setUploadAviso(t('repo.unsupported_type', { names: rejected.map(f => f.name).join(', ') }));
    }
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const toAdd = accepted.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...toAdd];
    });
    setUploadProgress({});
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setSaving(true);
    setUploadAviso('');
    const canal = _canalEfetivo();
    let hasError = false;
    let avisos = [];

    for (const f of files) {
      setUploadProgress(prev => ({ ...prev, [f.name + f.size]: 'loading' }));
      const form = new FormData();
      form.append('arquivo', f);
      form.append('canal', canal);
      try {
        const res = await uploadDocument(form);
        const data = res.data;
        if (data?.error) {
          setUploadProgress(prev => ({ ...prev, [f.name + f.size]: 'error' }));
          avisos.push(`${f.name}: ${data.message}`);
          hasError = true;
        } else {
          setUploadProgress(prev => ({ ...prev, [f.name + f.size]: 'ok' }));
          Analytics.documentoAdicionado(f.name.split('.').pop()?.toLowerCase() || 'arquivo');
          if (data?.aviso) avisos.push(data.aviso.startsWith('✅') ? data.aviso : `⚠️ ${f.name}: ${data.aviso}`);
        }
      } catch {
        setUploadProgress(prev => ({ ...prev, [f.name + f.size]: 'error' }));
        avisos.push(`${f.name}: ${t('repo.connection_error')}`);
        hasError = true;
      }
    }

    reload();
    setSaving(false);

    if (avisos.length > 0) setUploadAviso(avisos.join('\n'));

    if (!hasError) {
      setFiles([]);
      setUploadProgress({});
      closeAddModal();
    }
    _triggerReindex(canal);
  };

  const _triggerReindex = async (canal) => {
    if (!canal) return;
    setReindexando(true);
    try {
      await startIndexing(canal);
    } catch { /* ignore */ }
    // polling até indexação terminar (max 2 min)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetchAgentStatus();
        if (!res.data?.indexing) break;
      } catch { break; }
    }
    setReindexando(false);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (!e.dataTransfer.files?.length) return;
    setMode('arquivo');
    _addFiles(e.dataTransfer.files);
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

  const handleLimpar = async () => {
    const selecionadas = Object.entries(limparBasesSel).filter(([, v]) => v).map(([k]) => k);
    if (selecionadas.length === 0) return;
    setLimpando(true);
    for (const nome of selecionadas) {
      await limparCanal(nome).catch(() => {});
    }
    setShowLimpar(false);
    setLimparBasesSel({});
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

  const handleExportar = async (projeto) => {
    setExportando(true);
    setShareSnackbar(null);
    try {
      const res = await exportarBaseCompartilhavel(projeto);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projeto}.tusab`;
      a.click();
      URL.revokeObjectURL(url);
      setShareSnackbar({ ok: true, msg: t('repo.export_ok', { projeto }) });
    } catch {
      setShareSnackbar({ ok: false, msg: t('repo.export_error') });
    } finally {
      setExportando(false);
      setTimeout(() => setShareSnackbar(null), 4000);
    }
  };

  const handleImportar = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setImportando(true);
    setShareSnackbar(null);
    try {
      const res = await importarBaseCompartilhavel(arquivo);
      setShareSnackbar({ ok: true, msg: t('repo.import_ok', { projeto: res.data.projeto }) });
      reload();
    } catch (err) {
      const msg = err?.response?.data?.message || t('repo.import_error');
      setShareSnackbar({ ok: false, msg });
    } finally {
      setImportando(false);
      e.target.value = '';
      setTimeout(() => setShareSnackbar(null), 4000);
    }
  };

  const _getBusca = (nome) => buscaState[nome] || { query: '', resultados: null, buscando: false };
  const _setBusca = (nome, patch) => setBuscaState(prev => ({ ...prev, [nome]: { ..._getBusca(nome), ...patch } }));

  const handleBuscarCanal = async (nome) => {
    const q = _getBusca(nome).query.trim();
    if (!q) return;
    _setBusca(nome, { buscando: true, resultados: null });
    try {
      const res = await buscarBase(q, nome);
      _setBusca(nome, { resultados: res.data, buscando: false });
    } catch {
      _setBusca(nome, { resultados: { resultados: [], total: 0, query: q }, buscando: false });
    }
  };

  const canais    = repositorio.canais      || [];
  const flatYT    = repositorio.youtube    || [];
  const flatDocs  = repositorio.documentos || [];
  const flatTexts = repositorio.textos     || [];
  const total     = canais.reduce((acc, c) => acc + c.youtube.length + c.documentos.length + c.textos.length, 0);

  const coveredYT  = new Set(canais.flatMap(c => c.youtube.map(f => f.nome)));
  const coveredIds = new Set(canais.flatMap(c => [...c.documentos, ...c.textos].map(d => d.id)));

  const orphanYT    = flatYT.filter(f => !coveredYT.has(f.nome));
  const orphanDocs  = flatDocs.filter(d => !coveredIds.has(d.id));
  const orphanTexts = flatTexts.filter(t => !coveredIds.has(t.id));

  const orphanGroups = [
    { key: 'orp-youtube',    label: t('repo.orphan_youtube'),    emoji: '🎬', items: orphanYT,    tipo: null },
    { key: 'orp-documentos', label: t('repo.orphan_docs'), emoji: '📄', items: orphanDocs,  tipo: 'documents' },
    { key: 'orp-textos',     label: t('repo.orphan_texts'),     emoji: '📝', items: orphanTexts, tipo: 'texts' },
  ].filter(g => g.items.length > 0);

  const allAccordionKeys = [...canais.map(c => c.nome), ...orphanGroups.map(g => g.key)];
  const anyExpanded = allAccordionKeys.some(k => expandedCanais[k] !== false);
  const collapseAll = () => {
    const collapsed = {};
    allAccordionKeys.forEach(k => { collapsed[k] = false; });
    setExpandedCanais(collapsed);
  };

  return (
    <div
      className="space-y-4"
      onDragOver={handleGlobalDragOver}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.title')}</h2>
          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>
            {t('repo.file_count', { files: total, bases: canais.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Expandir / Recolher tudo */}
          {allAccordionKeys.length > 1 && (
            <>
              <button
                onClick={() => {
                  const expanded = {};
                  allAccordionKeys.forEach(k => { expanded[k] = true; });
                  setExpandedCanais(expanded);
                }}
                disabled={allAccordionKeys.every(k => expandedCanais[k] !== false)}
                className={`text-[10px] transition-colors disabled:opacity-30 disabled:cursor-default
                  ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                {t('repo.expand_all')}
              </button>
              <span className={`text-[10px] ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>·</span>
              <button
                onClick={collapseAll}
                disabled={allAccordionKeys.every(k => expandedCanais[k] === false)}
                className={`text-[10px] transition-colors disabled:opacity-30 disabled:cursor-default
                  ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                {t('repo.collapse_all')}
              </button>
              <span className={`w-px h-4 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            </>
          )}
          {/* Novo Projeto */}
          <button
            onClick={() => { setCriarProjetoNome(''); setShowCriarProjetoModal(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
              ${darkMode ? 'text-slate-300 border-white/15 hover:bg-white/8' : 'text-slate-600 border-slate-300 bg-white hover:bg-slate-50'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
            {t('repo.create_project_btn')}
          </button>

          {/* Indexar base */}
          <button
            onClick={async () => {
              const res = await listarProjetos().catch(() => null);
              const lista = res?.data?.projetos || projetos;
              setProjetos(lista);
              const sel = {};
              lista.forEach(p => { if ((p.n_arquivos ?? 1) > 0) sel[p.nome] = true; });
              setIndexarSel(sel);
              setShowIndexar(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
              ${darkMode ? 'text-accent border-accent/30 hover:bg-accent/10' : 'text-cyan-700 border-cyan-300 bg-cyan-50 hover:bg-cyan-100'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {t('repo.indexar_base_btn')}
          </button>

          {/* Importar .tusab */}
          {regras?.import_tusab !== false && (
          <>
          <input ref={importInputRef} type="file" accept=".tusab" className="hidden" onChange={handleImportar} />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importando}
            title={t('repo.import_base_title')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
              ${darkMode ? 'text-secondary border-secondary/30 hover:bg-secondary/10' : 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importando ? t('repo.importing') : t('repo.import_base_btn')}
          </button>
          </>
          )}

          {/* Limpar bases */}
          <button
            onClick={() => { setLimparBasesSel({}); setShowLimpar(true); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${btnFocus}
              ${darkMode ? 'text-danger/70 hover:text-danger hover:bg-danger/10 border-danger/20' : 'text-red-400 hover:text-red-600 hover:bg-red-50 border-red-200'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
            {t('repo.clear')}
          </button>
        </div>
      </div>


      {/* ── Snackbar exportar/importar ── */}
      {shareSnackbar && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border ${
          shareSnackbar.ok
            ? darkMode ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : darkMode ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <span>{shareSnackbar.ok ? '✓' : '✕'}</span>
          <span>{shareSnackbar.msg}</span>
        </div>
      )}


      {/* Modal — limpar base */}
      {showLimpar && createPortal(
        <ModalWrapper onClose={() => { if (!limpando) { setShowLimpar(false); setLimparBasesSel({}); } }} zIndex="z-[9999]" backdrop="bg-black/60" label="Limpar bases">
          {(() => {
            const selecionadas = Object.entries(limparBasesSel).filter(([, v]) => v).map(([k]) => k);
            const todasSel = canais.length > 0 && canais.every(c => limparBasesSel[c.nome]);
            const toggleTodas = () => {
              const sel = {};
              canais.forEach(c => { sel[c.nome] = !todasSel; });
              setLimparBasesSel(sel);
            };
            return (
              <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.clear_bases_title')}</h3>
                    <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('repo.clear_bases_desc')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Marcar/desmarcar todas */}
                  <button onClick={toggleTodas}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                      ${todasSel
                        ? darkMode ? 'border-danger/40 bg-danger/10 text-danger' : 'border-red-300 bg-red-50 text-red-700'
                        : darkMode ? 'border-white/10 text-slate-400 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${todasSel ? 'bg-danger border-danger' : darkMode ? 'border-white/20' : 'border-slate-300'}`}>
                      {todasSel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    {todasSel ? t('repo.deselect_all_bases') : t('repo.select_all_bases')}
                  </button>

                  {/* Lista de bases */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {canais.length === 0 ? (
                      <p className={`text-xs text-center py-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('repo.no_bases_found')}</p>
                    ) : canais.map(canal => {
                      const qtd = canal.youtube.length + canal.documentos.length + canal.textos.length;
                      const sel = !!limparBasesSel[canal.nome];
                      return (
                        <button key={canal.nome} onClick={() => setLimparBasesSel(prev => ({ ...prev, [canal.nome]: !sel }))}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all
                            ${sel
                              ? darkMode ? 'border-danger/40 bg-danger/10' : 'border-red-300 bg-red-50'
                              : darkMode ? 'border-white/8 hover:border-white/20' : 'border-slate-100 hover:border-slate-200'}`}>
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                            ${sel ? 'bg-danger border-danger' : darkMode ? 'border-white/20' : 'border-slate-300'}`}>
                            {sel && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </span>
                          <span className={`text-xs font-semibold flex-1 truncate ${sel ? darkMode ? 'text-danger' : 'text-red-700' : darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            🧠 @{canal.nome}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${darkMode ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {t('repo.item_file_count', { count: qtd })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aviso de reset total */}
                {todasSel && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-[11px] leading-relaxed ${darkMode ? 'bg-danger/10 border border-danger/20 text-danger/80' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>{t('repo.clear_all_warning')}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowLimpar(false); setLimparBasesSel({}); }} disabled={limpando}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${btnFocus}
                      ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t('repo.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      if (todasSel) {
                        // Redireciona para o modal de reset total existente
                        setShowLimpar(false);
                        setLimparBasesSel({});
                        setResetConfirm('');
                        setShowResetTotal(true);
                      } else {
                        handleLimpar();
                      }
                    }}
                    disabled={limpando || selecionadas.length === 0}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                      ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                    {limpando ? t('repo.removing') : todasSel ? t('repo.delete_all') : t('repo.delete_bases', { count: selecionadas.length })}
                  </button>
                </div>
              </div>
            );
          })()}
        </ModalWrapper>,
        document.body
      )}

      {/* Add modal */}
      {showAdd_ && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => closeAddModal()}>
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl p-4 space-y-3 overflow-y-auto
              ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}
              ${dragging ? darkMode ? 'border-primary' : 'border-violet-400' : ''}`}
            style={{ maxHeight: 'min(90vh, 680px)' }}
            onClick={e => e.stopPropagation()}>
          {/* Modal header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/8">
            <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {!_canalEfetivo() ? t('repo.select_project', 'Selecionar projeto') : mode === 'texto' ? t('repo.paste_text') : t('repo.upload_file')}
            </h3>
            <button onClick={() => closeAddModal()}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:bg-white/8' : 'text-slate-400 hover:bg-slate-100'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className={`rounded-2xl border-0 p-0 space-y-3`}>

          {/* Step de seleção de projeto quando nenhum está definido */}
          {!_canalEfetivo() ? (
            <div className="space-y-3 py-2">
              {(() => {
                const nomesRepo = (repositorio?.canais || []).map(c => c.nome);
                const nomesProjetos = projetos.map(p => typeof p === 'string' ? p : p.nome);
                const todos = [...new Set([...nomesRepo, ...nomesProjetos])];
                return (
                  <>
                    {todos.length > 0 && (
                      <div className="space-y-1.5">
                        <label className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {t('repo.select_project_prompt', 'Selecione o projeto de destino para o arquivo:')}
                        </label>
                        <select
                          value=""
                          onChange={e => { if (e.target.value) { setProjetoSel(e.target.value); setForceSelecionarProjeto(false); } }}
                          className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary cursor-pointer
                            ${darkMode ? 'bg-[#0C1122] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                        >
                          <option value="" disabled>🧠 {t('repo.select_project_placeholder', 'Escolher projeto...')}</option>
                          {todos.map(nome => (
                            <option key={nome} value={nome}>🧠 @{nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={`${todos.length > 0 ? `border-t pt-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}` : ''}`}>
                      <p className={`text-[10px] mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {todos.length > 0
                          ? t('repo.or_create_project', 'Ou crie um novo projeto:')
                          : t('repo.create_first_project', 'Crie seu primeiro projeto:')}
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={novoProjNome}
                          onChange={e => setNovoProjNome(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCriarProjeto()}
                          placeholder={t('repo.project_name_placeholder', 'Nome do projeto...')}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary
                            ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`}
                        />
                        <button onClick={handleCriarProjeto} disabled={criandoProj || !novoProjNome.trim()}
                          className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors ${btnFocus}`}>
                          {criandoProj ? '...' : t('repo.create', 'Criar')}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              {/* [CONTRATO] Projeto deve existir antes do upload — _canalEfetivo() não pode ser vazio aqui.
                  O modal só chega neste branch quando projetoSel ou canalAtivo está preenchido.
                  Ver: router_repositorio.py:/neural/upload e Mapa de Impacto §5 */}
              {/* Chip do projeto de destino + botão voltar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setForceSelecionarProjeto(true); setProjetoSel(''); }}
                  title="Trocar projeto"
                  className={`p-1 rounded-lg transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <p className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('repo.folder_project')}</p>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                  ${darkMode ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary'}`}>
                  🧠 @{_canalEfetivo()}
                </span>
              </div>

              <div className="flex gap-2">
                {['arquivo', 'texto'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${mode === m ? 'bg-primary/20 text-primary' : darkMode ? 'text-slate-400 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100'} ${btnFocus}`}>
                    {m === 'texto' ? t('repo.paste_text') : t('repo.upload_file')}
                  </button>
                ))}
              </div>
            </>
          )}

          {_canalEfetivo() && mode === 'texto' ? (
            <>
              <input placeholder={t('repo.title_placeholder')} value={title} onChange={e => setTitle(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-primary ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
              <textarea placeholder={t('repo.text_placeholder')} value={text} onChange={e => setText(e.target.value)} rows={6}
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
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all select-none
                  ${dragging
                    ? darkMode ? 'border-primary bg-primary/12 scale-[1.01]' : 'border-violet-400 bg-violet-50 scale-[1.01]'
                    : files.length > 0
                      ? darkMode ? 'border-secondary/40 bg-secondary/5' : 'border-emerald-200 bg-emerald-50/50'
                      : darkMode ? 'border-white/15 hover:border-primary/40' : 'border-slate-200 hover:border-violet-300'}`}>
                <p className={`text-xs font-medium ${dragging ? 'text-primary' : darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                  {dragging ? t('repo.drop_here') : files.length > 0 ? t('repo.add_more_files') : t('repo.drag_or_click')}
                </p>
                {files.length === 0 && (
                  <div className={`mt-1.5 space-y-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    <p className="text-[10px]">📄 PDF · DOCX · XLSX · CSV · TXT · MD</p>
                    <p className="text-[10px]">🖼️ PNG · JPG · WEBP · BMP · TIFF &nbsp; 🎵 MP3 · WAV · M4A · FLAC</p>
                  </div>
                )}
              </div>

              <input ref={fileRef} type="file" multiple
                accept={ACCEPT_TYPES}
                className="hidden"
                onChange={e => { if (e.target.files?.length) { _addFiles(e.target.files); e.target.value = ''; } }} />

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => {
                    const key = f.name + f.size;
                    const status = uploadProgress[key];
                    const ext = f.name.split('.').pop()?.toLowerCase() || '';
                    const emoji = _EXTS_IMAGEM.has(ext) ? '🖼️' : _EXTS_AUDIO.has(ext) ? '🎵' : '📄';
                    return (
                      <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                        ${status === 'ok'    ? darkMode ? 'border-secondary/30 bg-secondary/8' : 'border-emerald-200 bg-emerald-50' :
                          status === 'error' ? darkMode ? 'border-danger/30 bg-danger/8' : 'border-red-200 bg-red-50' :
                          status === 'loading' ? darkMode ? 'border-primary/30 bg-primary/8' : 'border-violet-200 bg-violet-50' :
                          darkMode ? 'border-white/10 bg-white/4' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="shrink-0">{emoji}</span>
                        <span className={`flex-1 truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.name}</span>
                        <span className={`shrink-0 text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        {status === 'loading' && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary shrink-0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                        )}
                        {status === 'ok' && <span className="text-secondary shrink-0">✓</span>}
                        {status === 'error' && <span className="text-danger shrink-0">✗</span>}
                        {!status && (
                          <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            className={`p-1 rounded-lg transition-colors shrink-0 ${darkMode ? 'text-slate-500 hover:text-danger hover:bg-danger/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'} ${btnFocus}`}
                            aria-label={t('repo.remove_file_label')}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Aviso */}
              {uploadAviso && (
                <p className={`text-[11px] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-line
                  ${uploadAviso.startsWith('✅')
                    ? darkMode ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : uploadAviso.includes('⚠️')
                      ? darkMode ? 'bg-warning/10 text-warning' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      : darkMode ? 'bg-danger/10 text-danger' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {uploadAviso}
                </p>
              )}

              {/* Reindexando toast */}
              {reindexando && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium
                  ${darkMode ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  {t('repo.reindexing')}
                </div>
              )}

              <button
                onClick={handleUploadAll}
                disabled={saving || files.length === 0}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 bg-accent/20 text-accent hover:bg-accent/30 ${btnFocus}`}>
                {saving
                  ? t('repo.processing_files', { count: files.length })
                  : files.length > 1 ? t('repo.confirm_upload_many', { count: files.length }) : t('repo.confirm_upload')}
              </button>
            </>
          )}
          </div>
          </div>
        </div>,
        document.body
      )}


      {/* Canal groups */}
      {canais.map(canal => {
        const cTotal = canal.youtube.length + canal.documentos.length + canal.textos.length;
        const isOpen = expandedCanais[canal.nome] !== false;
        return (
          <div key={canal.nome} className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${darkMode ? 'border-white/10 bg-white/4' : 'border-slate-100 bg-slate-50'}`}>
              <button onClick={() => toggleCanal(canal.nome)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                <span className="text-sm shrink-0">🧠</span>
                <p className={`text-xs font-bold flex-1 truncate ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  @{canal.nome}
                </p>
                {readonlyMap[canal.nome] && (
                  <span
                    title={t('repo.readonly_tooltip')}
                    className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                    {t('repo.readonly_badge')}
                  </span>
                )}
                <span className={`text-[10px] shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('repo.item_count', { count: cTotal })}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {/* Colar texto no projeto */}
              {!readonlyMap[canal.nome] && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    reloadProjetos().then(() => {
                      setProjetoSel(canal.nome);
                      setShowNovoProjeto(false);
                      setMode('arquivo');
                      setUploadAviso('');
                      setTitle('');
                      setText('');
                      setShowAdd(true);
                    });
                  }}
                  title={t('repo.add_text_title', { nome: canal.nome })}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${btnFocus} ${darkMode ? 'text-primary/60 hover:text-primary hover:bg-primary/10' : 'text-violet-400 hover:text-violet-700 hover:bg-violet-50'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </button>
              )}
              {/* Upload de arquivo no projeto */}
              {!readonlyMap[canal.nome] && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    reloadProjetos().then(() => {
                      setProjetoSel(canal.nome);
                      setShowNovoProjeto(false);
                      setMode('arquivo');
                      setUploadAviso('');
                      setFiles([]);
                      setShowAdd(true);
                    });
                  }}
                  title={t('repo.add_file_title', { nome: canal.nome })}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${btnFocus} ${darkMode ? 'text-accent/60 hover:text-accent hover:bg-accent/10' : 'text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                </button>
              )}
              {!readonlyMap[canal.nome] && regras?.export_tusab !== false && (
                <button
                  onClick={e => { e.stopPropagation(); handleExportar(canal.nome); }}
                  disabled={exportando}
                  title={t('repo.export_base_title', { nome: canal.nome })}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${btnFocus} ${darkMode ? 'text-secondary/60 hover:text-secondary hover:bg-secondary/10' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              )}
              {/* Abrir pasta local */}
              <button
                onClick={e => { e.stopPropagation(); openFolder('canal_youtube', canal.nome).catch(() => {}); }}
                title={t('repo.open_folder_title', { nome: canal.nome })}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${btnFocus} ${darkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-white/8' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              </button>
              {!readonlyMap[canal.nome] && (
                <button
                  onClick={e => { e.stopPropagation(); setLimparCanalNome(canal.nome); }}
                  title={t('repo.clear_base_title', { nome: canal.nome })}
                  className={`shrink-0 p-1.5 rounded-lg transition-colors text-danger/50 hover:text-danger hover:bg-danger/10 ${btnFocus}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                </button>
              )}
            </div>

            {isOpen && (() => {
              const b = _getBusca(canal.nome);
              return (
                <div>
                  {/* Campo de busca inline */}
                  <div className={`px-4 py-2 border-b ${darkMode ? 'border-white/8' : 'border-slate-100'}`}>
                    <div className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30
                      ${darkMode ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        type="text"
                        placeholder={t('repo.search_in_canal', { canal: canal.nome })}
                        value={b.query}
                        onChange={e => {
                          _setBusca(canal.nome, { query: e.target.value });
                          if (!e.target.value.trim()) _setBusca(canal.nome, { query: '', resultados: null });
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleBuscarCanal(canal.nome)}
                        className={`flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 min-w-0 ${darkMode ? 'text-white' : 'text-slate-800'}`}
                      />
                      {b.query.trim() && (
                        b.buscando
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary shrink-0"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                          : <button onClick={() => handleBuscarCanal(canal.nome)} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 transition-colors ${darkMode ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>{t('repo.search_btn')}</button>
                      )}
                      {b.resultados && (
                        <button onClick={() => _setBusca(canal.nome, { query: '', resultados: null })} className={`text-[10px] shrink-0 ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
                      )}
                    </div>
                  </div>

                  {/* Resultados de busca (quando ativos) */}
                  {b.resultados && (
                    <div className={`px-4 py-3 space-y-2 border-b ${darkMode ? 'border-white/8 bg-white/2' : 'border-slate-100 bg-slate-50/50'}`}>
                      <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                        {b.resultados.total === 0
                          ? t('repo.search_no_results', { query: b.resultados.query })
                          : t('repo.search_results', { count: b.resultados.total, query: b.resultados.query })}
                      </p>
                      {b.resultados.resultados.map((r, i) => (
                        <div key={i} className={`rounded-xl border p-3 space-y-1.5 ${darkMode ? 'bg-white/4 border-white/8' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[11px] font-bold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              {r.tipo === 'youtube' ? '🎬' : r.tipo === 'documento' ? '📄' : '📝'} {r.arquivo}
                            </p>
                            {onInjetarContexto && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => onInjetarContexto(r.trecho, r.arquivo)}
                                  title={t('repo.inject_excerpt_title')}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${darkMode ? 'bg-secondary/20 text-secondary hover:bg-secondary/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                  {t('repo.inject_excerpt_btn')}
                                </button>
                                <button onClick={async () => {
                                    try { const res = await lerArquivo(r.caminho); if (res.data?.ok) onInjetarContexto(res.data.conteudo, r.arquivo); } catch {}
                                  }}
                                  title={t('repo.inject_file_title')}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${darkMode ? 'bg-white/10 text-slate-400 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                                  {t('repo.inject_file_btn')}
                                </button>
                              </div>
                            )}
                          </div>
                          <p className={`text-[11px] leading-relaxed italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>…{r.trecho}…</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista de arquivos */}
                  <div className="divide-y divide-white/5">
                    {canal.youtube.map((f, i) => (
                      <div key={`yt-${i}`} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                        <span className="text-sm shrink-0">🎬</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.nome}</p>
                          <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{f.data} · {(f.tamanho / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                    ))}
                    {[...canal.documentos.map(d => ({...d, _tipo: 'documents'})),
                      ...canal.textos.map(d => ({...d, _tipo: 'texts'}))
                    ].map((item, i) => (
                      <div key={`doc-${i}`} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                        <span className="text-sm shrink-0">{_emojiTipo(item)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo || item.nome_original}</p>
                          <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{item.data} · {item.tipo?.toUpperCase() || 'TXT'} · {item.chars?.toLocaleString()} chars</p>
                        </div>
                        <button onClick={() => handleDelete(item._tipo, item.id)}
                          className={`p-2.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                          aria-label={t('repo.remove_item_label', { name: item.titulo || item.nome_original || 'arquivo' })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
              <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('repo.item_count', { count: group.items.length })}</span>
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
                        <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{f.data} · {(f.tamanho / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  ))
                  : group.items.map((item, i) => (
                    <div key={i} className={`px-4 py-2.5 flex items-center gap-3 ${darkMode ? 'hover:bg-white/4' : 'hover:bg-slate-50'}`}>
                      <span className="text-sm shrink-0">{_emojiTipo({...item, _tipo: group.tipo})}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo || item.nome_original}</p>
                        <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{item.data} · {item.tipo?.toUpperCase() || 'TXT'} · {item.chars?.toLocaleString()} chars</p>
                      </div>
                      <button onClick={() => handleDelete(group.tipo, item.id)}
                        className={`p-2.5 rounded-lg transition-colors text-danger/60 hover:text-danger hover:bg-danger/10 ${btnFocus}`}
                        aria-label={t('repo.remove_item_label', { name: item.titulo || item.nome_original || 'arquivo' })}>
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
        <div className={`rounded-2xl border p-8 text-center space-y-3 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <p className="text-2xl">📭</p>
          <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t('repo.empty')}</p>
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t('repo.empty_full_desc')}</p>
          <button
            onClick={() => {
              reloadProjetos().then(() => {
                setProjetoSel('__novo__');
                setShowNovoProjeto(true);
                setMode('arquivo');
                setUploadAviso('');
                setShowAdd(true);
              });
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors bg-primary/20 text-primary hover:bg-primary/30 ${btnFocus}`}>
            {t('repo.create_project_btn')}
          </button>
        </div>
      )}

      {/* Modal — criar novo projeto */}
      {showCriarProjetoModal && createPortal(
        <ModalWrapper onClose={() => setShowCriarProjetoModal(false)} zIndex="z-[9999]" backdrop="bg-black/60" label="Novo projeto">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div>
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Novo projeto</h3>
              <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Dê um nome ao projeto. Depois você poderá adicionar arquivos e textos a ele.
              </p>
            </div>
            <div>
              <label className={`text-[11px] font-bold block mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Nome do projeto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={criarProjetoNome}
                onChange={e => setCriarProjetoNome(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && criarProjetoNome.trim() && !criandoProj) {
                    setCriandoProj(true);
                    try {
                      const res = await criarProjeto(criarProjetoNome.trim());
                      if (res.data?.ok) {
                        await reloadProjetos();
                        await reload();
                        setShowCriarProjetoModal(false);
                      }
                    } catch { /* ignore */ }
                    setCriandoProj(false);
                  }
                }}
                placeholder="Ex: FGV, Marketing Digital, Estudos 2026…"
                autoFocus
                maxLength={120}
                className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:border-primary transition-colors ${darkMode ? 'bg-white/5 border-white/20 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowCriarProjetoModal(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button
                disabled={!criarProjetoNome.trim() || criandoProj}
                onClick={async () => {
                  setCriandoProj(true);
                  try {
                    const res = await criarProjeto(criarProjetoNome.trim());
                    if (res.data?.ok) {
                      await reloadProjetos();
                      await reload();
                      setShowCriarProjetoModal(false);
                    }
                  } catch { /* ignore */ }
                  setCriandoProj(false);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 bg-primary text-white hover:bg-primary/85 ${btnFocus}`}>
                {criandoProj ? 'Criando…' : 'Criar projeto'}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}

      {/* Modal — limpar canal individual */}
      {limparCanalNome && createPortal(
        <ModalWrapper onClose={() => !limpandoCanal && setLimparCanalNome(null)} zIndex="z-[9999]" backdrop="bg-black/60" label="Limpar canal">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/15' : 'bg-red-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M8 6V4h8v2"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.clear_canal_title')}</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('repo.clear_canal_desc', { canal: limparCanalNome })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setLimparCanalNome(null)} disabled={limpandoCanal}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'border-white/15 text-slate-400 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {t('repo.cancel')}
              </button>
              <button onClick={handleLimparCanal} disabled={limpandoCanal}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {limpandoCanal ? t('repo.removing') : t('repo.confirm_btn')}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}

      {/* Modal — reset total */}
      {showResetTotal && createPortal(
        <ModalWrapper onClose={() => !resetando && (setShowResetTotal(false), setResetConfirm(''))} zIndex="z-[9999]" backdrop="bg-black/70" label="Reset total">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-danger/20' : 'bg-red-100'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('repo.reset_title')}</h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`} dangerouslySetInnerHTML={{ __html: t('repo.reset_desc') }} />
              </div>
            </div>
            <div className={`rounded-xl border px-3 py-2.5 ${darkMode ? 'bg-danger/8 border-danger/25' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-[10px] mb-2 font-semibold ${darkMode ? 'text-danger/80' : 'text-red-500'}`}
                dangerouslySetInnerHTML={{ __html: t('repo.reset_confirm_label') }} />
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
                {t('repo.cancel')}
              </button>
              <button onClick={handleResetTotal} disabled={resetando || resetConfirm !== 'RESETAR'}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${btnFocus}
                  ${darkMode ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                {resetando ? t('repo.resetting') : t('repo.reset_all_btn')}
              </button>
            </div>
          </div>
        </ModalWrapper>,
        document.body
      )}

      {/* Modal: Indexar base */}
      {showIndexar && createPortal(
        <ModalWrapper onClose={() => !indexando && setShowIndexar(false)} zIndex="z-[9999]" backdrop="bg-black/60" label="Indexar base de conhecimento">
          <IndexarModal
            darkMode={darkMode}
            btnFocus={btnFocus}
            projetos={projetos}
            indexarSel={indexarSel}
            setIndexarSel={setIndexarSel}
            indexando={indexando}
            filaStatus={filaStatus}
            agentStatus={agentStatus}
            onConfirmar={handleIndexarConfirmar}
            onFechar={() => setShowIndexar(false)}
          />
        </ModalWrapper>,
        document.body
      )}

      {/* Snackbar de indexação concluída */}
      {indexSnackbar && createPortal(
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 99999 }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-xs font-bold pointer-events-none
            ${darkMode ? 'bg-secondary/90 text-white' : 'bg-emerald-600 text-white'}`}>
          ✓ {indexSnackbar}
        </div>,
        document.body
      )}
    </div>
  );
}

export default RepositorioTab;
