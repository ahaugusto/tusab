// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Loader2, Download, BookOpen, RotateCcw, ChevronDown, AlertCircle, Layers, FileText, Trash2, Pencil, X, Search, Video } from 'lucide-react';
import { listarArtefatosEstudo, buscarArtefatoEstudo, renomearArtefatoEstudo, excluirArtefatoEstudo, buscarProgressoRevisao } from '../../services/api';
import EstudoArtefatoModal from './EstudoArtefatoModal';
import AudioArtefatoPlayer from './AudioArtefatoPlayer';
import FlashcardPlayer from './FlashcardPlayer';
import PostIt from '../shared/PostIt';

/**
 * EstudoTab — componente controlado: todo estado persistente vive no AgentTab pai.
 * Player de flashcards (navegação, virar carta, avaliação SM-2) vive em
 * FlashcardPlayer.jsx, reutilizado aqui e em EstudoArtefatoModal.jsx.
 */
export default function EstudoTab({
  darkMode,
  projetosIndexados = [],
  // estado controlado pelo pai
  projeto,        setProjeto,
  tipo,           setTipo,
  nCards,         setNCards,
  tema,           setTema,
  itensDisponiveis = [],
  itensSelecionados = [], setItensSelecionados,
  gerando,
  erro,
  flashcards,
  resumo,
  resumoArtefatoId,
  postits,
  onGerar,
  onResetar,
  onExportarAnki,
}) {
  const { t } = useTranslation();

  // Filtro de busca do seletor "Itens específicos" — puramente local, não
  // precisa sobreviver a troca de aba/projeto como a seleção em si.
  const [buscaItem, setBuscaItem] = useState('');
  const itensFiltrados = buscaItem.trim()
    ? itensDisponiveis.filter(i => i.titulo.toLowerCase().includes(buscaItem.trim().toLowerCase()))
    : itensDisponiveis;
  const toggleItem = (arquivo) => setItensSelecionados(prev =>
    prev.includes(arquivo) ? prev.filter(a => a !== arquivo) : [...prev, arquivo]);
  const selecionarTodosItens = () => setItensSelecionados(itensFiltrados.map(i => i.arquivo));
  const desmarcarTodosItens  = () => setItensSelecionados([]);

  // Kanban de artefatos persistidos — lista independente do resultado "ao vivo"
  // acima (flashcards/resumo/postits da última geração); é buscada do backend
  // porque sobrevive a troca de aba/projeto, ao contrário do estado efêmero.
  const [artefatos,           setArtefatos]           = useState([]);
  const [artefatoAberto,      setArtefatoAberto]       = useState(null); // entrada do manifest
  const [artefatoDados,       setArtefatoDados]        = useState(null); // conteúdo estruturado
  const [artefatoCarregando,  setArtefatoCarregando]   = useState(false);
  const [tituloEditando,      setTituloEditando]       = useState(null); // id do card em edição inline
  const [tituloEditandoValor, setTituloEditandoValor]  = useState('');

  const refetchArtefatos = useCallback(() => {
    if (!projeto) { setArtefatos([]); return; }
    listarArtefatosEstudo(projeto).then(r => setArtefatos(r.data?.artefatos || [])).catch(() => setArtefatos([]));
  }, [projeto]);

  useEffect(() => { refetchArtefatos(); }, [refetchArtefatos]);

  // Refaz a busca assim que uma geração termina (gerando true→false) — os
  // artefatos recém-criados já estão salvos no backend nesse ponto.
  const prevGerandoRef = useRef(gerando);
  useEffect(() => {
    if (prevGerandoRef.current && !gerando) refetchArtefatos();
    prevGerandoRef.current = gerando;
  }, [gerando, refetchArtefatos]);

  const handleAbrirArtefato = async (art) => {
    setArtefatoCarregando(true);
    try {
      const r = await buscarArtefatoEstudo(projeto, art.id);
      if (r.data?.ok) { setArtefatoAberto(art); setArtefatoDados(r.data.dados); }
    } finally {
      setArtefatoCarregando(false);
    }
  };

  const handleRenomearArtefato = async (novoTitulo) => {
    await renomearArtefatoEstudo(projeto, artefatoAberto.id, novoTitulo).catch(() => {});
    setArtefatoAberto(prev => prev ? { ...prev, titulo: novoTitulo } : prev);
    refetchArtefatos();
  };

  const handleExcluirArtefato = async () => {
    await excluirArtefatoEstudo(projeto, artefatoAberto.id).catch(() => {});
    setArtefatoAberto(null);
    setArtefatoDados(null);
    refetchArtefatos();
  };

  const handleIniciarEdicaoTitulo = (e, art) => {
    e.stopPropagation();
    setTituloEditando(art.id);
    setTituloEditandoValor(art.titulo);
  };

  const handleSalvarTituloInline = async (art) => {
    const limpo = tituloEditandoValor.trim();
    setTituloEditando(null);
    if (!limpo || limpo === art.titulo) return;
    await renomearArtefatoEstudo(projeto, art.id, limpo).catch(() => {});
    refetchArtefatos();
  };

  const handleExcluirCard = async (e, art) => {
    e.stopPropagation();
    await excluirArtefatoEstudo(projeto, art.id).catch(() => {});
    refetchArtefatos();
  };

  const ICONE_TIPO = { resumo: FileText, flashcards: Layers };

  // Repetição espaçada (SM-2) — progresso por card (chave = id estável, hash
  // da pergunta) persistido no backend, sobrevive a regenerações futuras.
  const [progressoRevisao, setProgressoRevisao] = useState({}); // { [cardId]: {proxima_revisao, ...} }
  const [modoRevisarHoje,  setModoRevisarHoje]  = useState(false);

  useEffect(() => {
    if (!projeto) { setProgressoRevisao({}); return; }
    buscarProgressoRevisao(projeto).then(r => setProgressoRevisao(r.data?.progresso || {})).catch(() => setProgressoRevisao({}));
  }, [projeto]);

  const hoje = new Date().toISOString().slice(0, 10);
  const isDue = (id) => {
    const p = progressoRevisao[id];
    return !p || p.proxima_revisao <= hoje;
  };
  const flashcardsAlvo = modoRevisarHoje ? (flashcards || []).filter(c => isDue(c.id)) : (flashcards || []);
  const dueHojeTotal = (flashcards || []).filter(c => isDue(c.id)).length;

  const semProjetos = projetosIndexados.length === 0;

  const handleResetarLocal = () => { onResetar?.(); };

  // ── Estilos base ──────────────────────────────────────────────────────────

  const borderColor = darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const bgCard      = darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const textPrimary = darkMode ? '#f1f5f9' : '#1e293b';
  const textSecond  = darkMode ? '#94a3b8' : '#64748b';
  const btnBase     = {
    border: 'none', cursor: 'pointer', fontWeight: 700,
    fontSize: '12px', borderRadius: '12px', padding: '8px 16px',
    transition: 'opacity 0.15s',
  };

  // ── Empty state ──────────────────────────────────────────────────────────

  if (semProjetos) {
    return (
      <div style={{
        background: darkMode ? 'rgba(251,191,36,0.08)' : '#fffbeb',
        border: `1px solid ${darkMode ? 'rgba(251,191,36,0.25)' : '#fde68a'}`,
        borderRadius: '16px', padding: '20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center',
      }}>
        <AlertCircle size={24} color={darkMode ? '#fbbf24' : '#d97706'} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#fbbf24' : '#92400e', marginBottom: '4px' }}>
            {t('estudo.empty_title')}
          </p>
          <p style={{ fontSize: '11px', color: darkMode ? '#fcd34d' : '#b45309' }}>
            {t('estudo.empty_desc')}
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Controles */}
      <div style={{
        background: bgCard, border: `1px solid ${borderColor}`,
        borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
      }}>

        {/* Seletor de projeto */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
            {t('estudo.label_project')}
          </p>
          <div style={{ position: 'relative' }}>
            <select
              value={projeto}
              onChange={e => { setProjeto(e.target.value); handleResetarLocal(); }}
              style={{
                width: '100%', appearance: 'none', padding: '8px 32px 8px 12px',
                borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                border: `1px solid ${projeto ? 'rgba(139,92,246,0.40)' : borderColor}`,
                color: projeto ? (darkMode ? '#a78bfa' : '#7c3aed') : textSecond,
                cursor: 'pointer', outline: 'none',
              }}>
              <option value="" style={{ background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }}>{t('estudo.select_project_placeholder')}</option>
              {projetosIndexados.map(p => (
                <option key={p.nome} value={p.nome} style={{ background: darkMode ? '#0f172a' : '#fff', color: darkMode ? '#fff' : '#1e293b' }}>
                  {t('estudo.project_chunks_suffix', { name: p.nome, count: p.chunks })}
                </option>
              ))}
            </select>
            <ChevronDown size={13} style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              color: textSecond, pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Tipo */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
            {t('estudo.label_type')}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'flashcards', label: t('estudo.type_flashcards') },
              { id: 'resumo',     label: t('estudo.type_resumo')     },
              { id: 'postits',    label: t('estudo.type_postits')    },
            ].map(({ id, label }) => {
              const ativo = tipo.includes(id);
              return (
                <button key={id}
                  onClick={() => setTipo(prev => ativo ? prev.filter(t => t !== id) : [...prev, id])}
                  style={{
                    ...btnBase, padding: '6px 14px',
                    background: ativo
                      ? (darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)')
                      : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                    color: ativo ? (darkMode ? '#a78bfa' : '#7c3aed') : textSecond,
                    border: ativo ? '1px solid rgba(139,92,246,0.40)' : `1px solid ${borderColor}`,
                  }}>{label}</button>
              );
            })}
          </div>
          <p style={{ fontSize: '10px', color: textSecond, marginTop: '8px', marginBottom: 0 }}>
            {t('estudo.modelo_robusto_hint')}
          </p>
        </div>

        {/* Tema — opcional, escopa a geração a um recorte específico do projeto via BM25 */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
            {t('estudo.label_tema')}
          </p>
          <div style={{ position: 'relative' }}>
            <input
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder={t('estudo.tema_placeholder')}
              maxLength={200}
              style={{
                width: '100%', padding: '8px 32px 8px 12px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 500,
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                border: `1px solid ${tema ? 'rgba(139,92,246,0.40)' : borderColor}`,
                color: textPrimary, outline: 'none',
              }} />
            {tema && (
              <button onClick={() => setTema('')} aria-label={t('estudo.tema_limpar')} style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: textSecond, padding: 0,
                display: 'flex',
              }}>
                <X size={13} />
              </button>
            )}
          </div>
          <p style={{ fontSize: '10px', color: textSecond, marginTop: '5px', marginBottom: 0 }}>
            {t('estudo.tema_hint')}
          </p>
        </div>

        {/* Itens específicos — opcional, restringe o universo de geração a
            vídeos/documentos escolhidos em vez do projeto inteiro; combina
            com o Tema acima (itens definem o universo, tema rankeia dentro). */}
        {itensDisponiveis.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: textSecond, margin: 0 }}>
                {t('estudo.label_itens')}
                {itensSelecionados.length > 0 && (
                  <span style={{ color: darkMode ? '#a78bfa' : '#7c3aed' }}> ({itensSelecionados.length})</span>
                )}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={selecionarTodosItens} style={{
                  ...btnBase, padding: '3px 9px', fontSize: '10px',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: textSecond, border: `1px solid ${borderColor}`,
                }}>{t('estudo.itens_selecionar_todos')}</button>
                <button onClick={desmarcarTodosItens} style={{
                  ...btnBase, padding: '3px 9px', fontSize: '10px',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: textSecond, border: `1px solid ${borderColor}`,
                }}>{t('estudo.itens_desmarcar_todos')}</button>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: textSecond }} />
              <input
                value={buscaItem}
                onChange={e => setBuscaItem(e.target.value)}
                placeholder={t('estudo.itens_busca_placeholder')}
                style={{
                  width: '100%', padding: '7px 10px 7px 30px', borderRadius: '10px',
                  fontSize: '12px', fontWeight: 500,
                  background: darkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                  border: `1px solid ${borderColor}`, color: textPrimary, outline: 'none',
                }} />
            </div>

            <div style={{
              maxHeight: '200px', overflowY: 'auto', borderRadius: '10px',
              border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column',
            }}>
              {itensFiltrados.length === 0 ? (
                <p style={{ fontSize: '11px', color: textSecond, textAlign: 'center', padding: '14px 0', margin: 0 }}>
                  {t('estudo.itens_busca_vazio')}
                </p>
              ) : itensFiltrados.map((item, i) => {
                const Icone = item.aba === 'youtube' ? Video : FileText;
                const marcado = itensSelecionados.includes(item.arquivo);
                return (
                  <label key={item.arquivo} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', cursor: 'pointer',
                    borderTop: i > 0 ? `1px solid ${borderColor}` : 'none',
                    background: marcado ? (darkMode ? 'rgba(139,92,246,0.10)' : 'rgba(139,92,246,0.06)') : 'transparent',
                  }}>
                    <input type="checkbox" checked={marcado} onChange={() => toggleItem(item.arquivo)} style={{ cursor: 'pointer', accentColor: '#7c3aed', flexShrink: 0 }} />
                    <Icone size={12} style={{ color: textSecond, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '11px', fontWeight: 500, color: textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</span>
                    <span style={{ fontSize: '9px', color: textSecond, flexShrink: 0 }}>{t('estudo.itens_chunks_suffix', { count: item.n_chunks })}</span>
                  </label>
                );
              })}
            </div>
            <p style={{ fontSize: '10px', color: textSecond, marginTop: '5px', marginBottom: 0 }}>
              {t('estudo.itens_hint')}
            </p>
          </div>
        )}

        {/* Quantidade — some se só "resumo" estiver selecionado (não usa contagem) */}
        {tipo.some(t => t !== 'resumo') && (
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
              {t('estudo.label_qty')} <span style={{ color: darkMode ? '#a78bfa' : '#7c3aed' }}>{nCards}</span>
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[5, 10, 15, 20].map(n => (
                <button key={n} onClick={() => setNCards(n)} style={{
                  ...btnBase, padding: '5px 12px',
                  background: nCards === n
                    ? (darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)')
                    : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                  color: nCards === n ? (darkMode ? '#a78bfa' : '#7c3aed') : textSecond,
                  border: nCards === n ? '1px solid rgba(139,92,246,0.40)' : `1px solid ${borderColor}`,
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* Botão Gerar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onGerar} disabled={gerando || !projeto || !tipo.length} style={{
            ...btnBase, flex: 1, padding: '10px 0', fontSize: '13px',
            background: gerando || !projeto || !tipo.length
              ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9')
              : (darkMode ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.15)'),
            color: gerando || !projeto || !tipo.length ? textSecond : (darkMode ? '#a78bfa' : '#7c3aed'),
            cursor: gerando || !projeto || !tipo.length ? 'not-allowed' : 'pointer',
            opacity: !projeto || !tipo.length ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {gerando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('estudo.generating')}</>
              : <><BookOpen size={14} /> {t('estudo.generate_btn')}</>}
          </button>

          {(flashcards?.length > 0 || resumo || postits?.length > 0) && (
            <button onClick={handleResetarLocal} style={{
              ...btnBase, padding: '10px 12px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond, border: `1px solid ${borderColor}`,
            }} title={t('estudo.clear_result_title')}>
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Kanban de artefatos salvos ───────────────────────────────────────── */}
      {artefatos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, margin: 0 }}>
            {t('estudo.kanban_titulo', { count: artefatos.length })}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {artefatos.map(art => {
              const Icone = ICONE_TIPO[art.tipo] || FileText;
              return (
                <div key={art.id}
                  onClick={() => handleAbrirArtefato(art)}
                  style={{
                    background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '14px',
                    padding: '12px 14px', width: '220px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icone size={13} color={darkMode ? '#a78bfa' : '#7c3aed'} />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: darkMode ? '#a78bfa' : '#7c3aed' }}>{t(`estudo.type_${art.tipo}`)}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={e => handleIniciarEdicaoTitulo(e, art)} aria-label={t('estudo.artefato_editar_titulo')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecond, padding: '2px', display: 'flex' }}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={e => handleExcluirCard(e, art)} aria-label={t('estudo.artefato_excluir')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecond, padding: '2px', display: 'flex' }}>
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {tituloEditando === art.id ? (
                    <input
                      autoFocus
                      value={tituloEditandoValor}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setTituloEditandoValor(e.target.value)}
                      onBlur={() => handleSalvarTituloInline(art)}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setTituloEditando(null); }}
                      style={{
                        fontSize: '12px', fontWeight: 700, color: textPrimary, background: 'transparent',
                        border: `1px solid rgba(139,92,246,0.40)`, borderRadius: '6px', padding: '3px 6px', outline: 'none',
                      }} />
                  ) : (
                    <p style={{ fontSize: '12px', fontWeight: 700, color: textPrimary, margin: 0,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {art.titulo}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {art.tema && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
                        background: darkMode ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.10)', color: darkMode ? '#a78bfa' : '#7c3aed' }}>
                        {art.tema}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: textSecond }}>{art.criado_em}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div style={{
          background: darkMode ? 'rgba(248,113,113,0.10)' : '#fef2f2',
          border: `1px solid ${darkMode ? 'rgba(248,113,113,0.30)' : '#fca5a5'}`,
          borderRadius: '12px', padding: '10px 14px',
          color: darkMode ? '#f87171' : '#dc2626', fontSize: '12px',
        }}>{erro}</div>
      )}

      {/* ── Flashcards ───────────────────────────────────────────────────────── */}
      {flashcards?.length > 0 && (
        <div style={{
          background: bgCard, border: `1px solid ${borderColor}`,
          borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, margin: 0 }}>{t('estudo.section_flashcards')}</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setModoRevisarHoje(m => !m)} style={{
                ...btnBase, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px',
                background: modoRevisarHoje
                  ? (darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)')
                  : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                color: modoRevisarHoje ? (darkMode ? '#a78bfa' : '#7c3aed') : textSecond,
                border: modoRevisarHoje ? '1px solid rgba(139,92,246,0.40)' : `1px solid ${borderColor}`,
              }}>
                {t('estudo.revisar_hoje_btn', { count: dueHojeTotal })}
              </button>
              <button onClick={onExportarAnki} style={{
                ...btnBase, padding: '5px 10px',
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                color: textSecond, border: `1px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', gap: '4px',
              }} title={t('estudo.export_anki_title')}>
                <Download size={12} /> Anki
              </button>
            </div>
          </div>

          {modoRevisarHoje && flashcardsAlvo.length === 0 && (
            <p style={{ fontSize: '12px', color: textSecond, textAlign: 'center', padding: '12px 0' }}>
              {t('estudo.revisar_hoje_vazio')}
            </p>
          )}

          <FlashcardPlayer darkMode={darkMode} projeto={projeto} cards={flashcardsAlvo} />
        </div>
      )}

      {/* ── Post-its ─────────────────────────────────────────────────────────── */}
      {postits?.length > 0 && (
        <div style={{ background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '14px' }}>{t('estudo.section_postits')}</p>
          <div className="columns-2 md:columns-3">
            {postits.map((texto, i) => <PostIt key={i} texto={texto} index={i} darkMode={darkMode} />)}
          </div>
        </div>
      )}

      {/* ── Resumo ───────────────────────────────────────────────────────────── */}
      {resumo && (
        <div style={{ background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, margin: '0 0 10px' }}>{t('estudo.section_resumo')}</p>
          <AudioArtefatoPlayer darkMode={darkMode} projeto={projeto} artefatoId={resumoArtefatoId} borderColor={borderColor} />
          <div style={{ fontSize: '13px', lineHeight: 1.7, color: textPrimary }}>
            <ReactMarkdown components={{
              h1: ({ children }) => <h1 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: textPrimary }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: '13px', fontWeight: 700, marginTop: '12px', marginBottom: '6px', color: darkMode ? '#a78bfa' : '#7c3aed' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: 700, marginTop: '10px', marginBottom: '4px', color: textSecond }}>{children}</h3>,
              p:  ({ children }) => <p style={{ marginBottom: '8px', color: textPrimary }}>{children}</p>,
              ul: ({ children }) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: '3px', color: textPrimary }}>{children}</li>,
              strong: ({ children }) => <strong style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>{children}</strong>,
            }}>{resumo}</ReactMarkdown>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {artefatoAberto && artefatoDados !== null && (
        <EstudoArtefatoModal
          darkMode={darkMode}
          artefato={artefatoAberto}
          dados={artefatoDados}
          onClose={() => { setArtefatoAberto(null); setArtefatoDados(null); }}
          onRenomear={handleRenomearArtefato}
          onExcluir={handleExcluirArtefato}
        />
      )}
    </div>
  );
}
