// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Loader2, Download, BookOpen, RotateCcw, ChevronDown, AlertCircle, Volume2, Square, Layers, FileText, HelpCircle, Trash2, Pencil, X } from 'lucide-react';
import { ttsStatus, ttsSintetizar, listarArtefatosEstudo, buscarArtefatoEstudo, renomearArtefatoEstudo, excluirArtefatoEstudo, revisarFlashcard, buscarProgressoRevisao } from '../../services/api';
import EstudoArtefatoModal from './EstudoArtefatoModal';
import PostIt from '../shared/PostIt';

/**
 * EstudoTab — componente controlado: todo estado persistente vive no AgentTab pai.
 * Estado efêmero de navegação (currentIdx, flipped) é local — correto resetar ao voltar.
 */
export default function EstudoTab({
  darkMode,
  projetosIndexados = [],
  // estado controlado pelo pai
  projeto,        setProjeto,
  tipo,           setTipo,
  nCards,         setNCards,
  tema,           setTema,
  gerando,
  erro,
  flashcards,
  resumo,
  quiz,
  topicos,
  postits,
  onGerar,
  onResetar,
  onExportarAnki,
}) {
  const { t } = useTranslation();
  // Estado efêmero de navegação — pode resetar sem perder o resultado
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped,    setFlipped]    = useState(false);

  // Quiz — estado efêmero de navegação/respostas, mesma filosofia dos flashcards
  const [quizIdx,       setQuizIdx]       = useState(0);
  const [quizRespostas, setQuizRespostas] = useState({}); // { [idx]: alternativaEscolhidaIdx }

  // Kanban de artefatos persistidos — lista independente do resultado "ao vivo"
  // acima (flashcards/resumo/quiz da última geração); é buscada do backend
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

  const ICONE_TIPO = { resumo: FileText, flashcards: Layers, quiz: HelpCircle };

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

  useEffect(() => { setCurrentIdx(0); setFlipped(false); }, [modoRevisarHoje]);

  const card = flashcardsAlvo[currentIdx] ?? null;
  const perguntaQuiz = quiz?.[quizIdx] ?? null;
  const quizRespondidas = Object.keys(quizRespostas).length;
  const quizAcertos = Object.entries(quizRespostas).filter(([idx, alt]) => quiz?.[idx]?.correta === alt).length;
  const semProjetos = projetosIndexados.length === 0;

  // ── TTS local (Pocket TTS) — só disponível na build Beta/Enterprise ──────────
  // torch+pocket-tts não fazem parte do instalador B2C (ver tusab_engine/agent/tts.py);
  // build padrão nunca mostra o botão porque /agent/tts/status retorna disponivel=false.
  const [ttsDisponivel, setTtsDisponivel] = useState(false);
  const [ttsCarregando, setTtsCarregando] = useState(false);
  const [ttsTocando,    setTtsTocando]    = useState(false);
  const [ttsErro,       setTtsErro]       = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    ttsStatus().then(r => setTtsDisponivel(!!r.data?.disponivel)).catch(() => setTtsDisponivel(false));
    return () => { audioRef.current?.pause(); };
  }, []);

  const handleOuvirResumo = async () => {
    if (ttsTocando) {
      audioRef.current?.pause();
      setTtsTocando(false);
      return;
    }
    setTtsErro(null);
    setTtsCarregando(true);
    try {
      const resp = await ttsSintetizar(resumo);
      const url = URL.createObjectURL(resp.data);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsTocando(false); URL.revokeObjectURL(url); };
      await audio.play();
      setTtsTocando(true);
    } catch {
      setTtsErro(t('estudo.tts_error'));
    } finally {
      setTtsCarregando(false);
    }
  };

  const handleAnterior = () => { setCurrentIdx(i => Math.max(0, i - 1)); setFlipped(false); };
  const handleProximo  = () => { setCurrentIdx(i => Math.min(flashcardsAlvo.length - 1, i + 1)); setFlipped(false); };

  // Qualidade: 1 = "Não lembrei", 3 = "Difícil", 5 = "Fácil" — mapeamento
  // simplificado da escala 0-5 do SM-2 pra 3 botões (granularidade fina
  // demais seria fricção sem benefício real).
  const handleQualidade = async (qualidade) => {
    if (!card) return;
    try {
      const r = await revisarFlashcard(projeto, card.id, qualidade);
      if (r.data?.ok) setProgressoRevisao(prev => ({ ...prev, [card.id]: r.data }));
    } catch { /* revisão não persistida — segue a navegação normalmente */ }
    if (currentIdx < flashcardsAlvo.length - 1) { setCurrentIdx(i => i + 1); setFlipped(false); }
  };

  const handleResetarLocal = () => {
    setCurrentIdx(0); setFlipped(false);
    setQuizIdx(0); setQuizRespostas({});
    onResetar?.();
  };

  const handleQuizAnterior = () => setQuizIdx(i => Math.max(0, i - 1));
  const handleQuizProximo  = () => setQuizIdx(i => Math.min(quiz.length - 1, i + 1));
  const handleQuizResponder = (altIdx) => {
    if (quizRespostas[quizIdx] !== undefined) return; // já respondida — não deixa trocar
    setQuizRespostas(prev => ({ ...prev, [quizIdx]: altIdx }));
  };

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
              { id: 'quiz',       label: t('estudo.type_quiz')       },
              { id: 'topicos',    label: t('estudo.type_topicos')    },
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

          {(flashcards?.length > 0 || resumo || quiz?.length > 0 || topicos?.length > 0 || postits?.length > 0) && (
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
              <span style={{ fontSize: '11px', color: textSecond }}>
                {flashcardsAlvo.length > 0 ? `${currentIdx + 1} / ${flashcardsAlvo.length}` : '0 / 0'}
              </span>
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

          {card && (
            <div onClick={() => setFlipped(f => !f)} style={{ perspective: '1000px', cursor: 'pointer' }}>
              <div style={{
                position: 'relative', width: '100%', height: '180px',
                transformStyle: 'preserve-3d', transition: 'transform 0.4s ease',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  backfaceVisibility: 'hidden',
                  background: darkMode ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)',
                  border: `1px solid ${darkMode ? 'rgba(139,92,246,0.30)' : 'rgba(139,92,246,0.20)'}`,
                  borderRadius: '14px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px', gap: '8px', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: darkMode ? '#a78bfa' : '#7c3aed' }}>{t('estudo.card_question_label')}</span>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: textPrimary, lineHeight: 1.5, margin: 0 }}>
                    {card.pergunta}
                  </p>
                  <span style={{ fontSize: '10px', color: textSecond, marginTop: '4px' }}>{t('estudo.click_to_reveal')}</span>
                </div>

                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                  background: darkMode ? 'rgba(52,211,153,0.10)' : 'rgba(52,211,153,0.08)',
                  border: `1px solid ${darkMode ? 'rgba(52,211,153,0.25)' : 'rgba(16,185,129,0.25)'}`,
                  borderRadius: '14px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px', gap: '8px', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: darkMode ? '#34d399' : '#059669' }}>{t('estudo.card_answer_label')}</span>
                  <p style={{ fontSize: '14px', color: textPrimary, lineHeight: 1.5, margin: 0 }}>{card.resposta}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleAnterior} disabled={currentIdx === 0} style={{
              ...btnBase, padding: '8px 14px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond, border: `1px solid ${borderColor}`,
              opacity: currentIdx === 0 ? 0.4 : 1,
              cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
            }}>{t('estudo.prev_btn')}</button>

            {flipped && card && (
              <>
                <button onClick={() => handleQualidade(1)} style={{
                  ...btnBase, flex: 1, padding: '8px 4px', fontSize: '11px',
                  background: darkMode ? 'rgba(248,113,113,0.15)' : '#fef2f2',
                  color: darkMode ? '#f87171' : '#dc2626',
                  border: `1px solid ${darkMode ? 'rgba(248,113,113,0.30)' : '#fca5a5'}`,
                }}>{t('estudo.qualidade_nao_lembrei')}</button>
                <button onClick={() => handleQualidade(3)} style={{
                  ...btnBase, flex: 1, padding: '8px 4px', fontSize: '11px',
                  background: darkMode ? 'rgba(251,191,36,0.15)' : '#fffbeb',
                  color: darkMode ? '#fbbf24' : '#92400e',
                  border: `1px solid ${darkMode ? 'rgba(251,191,36,0.30)' : '#fde68a'}`,
                }}>{t('estudo.qualidade_dificil')}</button>
                <button onClick={() => handleQualidade(5)} style={{
                  ...btnBase, flex: 1, padding: '8px 4px', fontSize: '11px',
                  background: darkMode ? 'rgba(52,211,153,0.15)' : '#d1fae5',
                  color: darkMode ? '#34d399' : '#065f46',
                  border: `1px solid ${darkMode ? 'rgba(52,211,153,0.30)' : '#6ee7b7'}`,
                }}>{t('estudo.qualidade_facil')}</button>
              </>
            )}

            <button onClick={handleProximo} disabled={currentIdx === flashcardsAlvo.length - 1} style={{
              ...btnBase, padding: '8px 14px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond, border: `1px solid ${borderColor}`,
              opacity: currentIdx === flashcardsAlvo.length - 1 ? 0.4 : 1,
              cursor: currentIdx === flashcardsAlvo.length - 1 ? 'not-allowed' : 'pointer',
            }}>{t('estudo.next_btn')}</button>
          </div>

          {flashcardsAlvo.length > 0 && (
            <div style={{ height: '4px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
              borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                background: 'linear-gradient(90deg, #8b5cf6, #34d399)',
                width: `${((currentIdx + 1) / flashcardsAlvo.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* ── Quiz ─────────────────────────────────────────────────────────────── */}
      {quiz?.length > 0 && (
        <div style={{
          background: bgCard, border: `1px solid ${borderColor}`,
          borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, margin: 0 }}>{t('estudo.section_quiz')}</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: textSecond }}>{quizIdx + 1} / {quiz.length}</span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: darkMode ? 'rgba(52,211,153,0.15)' : '#d1fae5',
                color: darkMode ? '#34d399' : '#065f46',
              }}>{t('estudo.quiz_score', { acertos: quizAcertos, respondidas: quizRespondidas })}</span>
            </div>
          </div>

          {perguntaQuiz && (() => {
            const respostaEscolhida = quizRespostas[quizIdx];
            const jaRespondeu = respostaEscolhida !== undefined;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: textPrimary, lineHeight: 1.5, margin: 0 }}>
                  {perguntaQuiz.pergunta}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {perguntaQuiz.alternativas.map((alt, i) => {
                    const ehCorreta  = i === perguntaQuiz.correta;
                    const ehEscolhida = i === respostaEscolhida;
                    let bg = darkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc';
                    let border = borderColor;
                    let color = textPrimary;
                    if (jaRespondeu && ehCorreta) {
                      bg = darkMode ? 'rgba(52,211,153,0.15)' : '#d1fae5';
                      border = darkMode ? 'rgba(52,211,153,0.40)' : '#6ee7b7';
                      color = darkMode ? '#34d399' : '#065f46';
                    } else if (jaRespondeu && ehEscolhida && !ehCorreta) {
                      bg = darkMode ? 'rgba(248,113,113,0.15)' : '#fef2f2';
                      border = darkMode ? 'rgba(248,113,113,0.40)' : '#fca5a5';
                      color = darkMode ? '#f87171' : '#dc2626';
                    }
                    return (
                      <button key={i} onClick={() => handleQuizResponder(i)} disabled={jaRespondeu} style={{
                        ...btnBase, textAlign: 'left', padding: '10px 14px',
                        background: bg, border: `1px solid ${border}`, color,
                        cursor: jaRespondeu ? 'default' : 'pointer', fontWeight: 500,
                      }}>{alt}</button>
                    );
                  })}
                </div>
                {jaRespondeu && perguntaQuiz.explicacao && (
                  <p style={{
                    fontSize: '11px', color: textSecond, margin: 0, padding: '10px 12px',
                    background: darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: '10px',
                  }}>{perguntaQuiz.explicacao}</p>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleQuizAnterior} disabled={quizIdx === 0} style={{
              ...btnBase, padding: '8px 14px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond, border: `1px solid ${borderColor}`,
              opacity: quizIdx === 0 ? 0.4 : 1,
              cursor: quizIdx === 0 ? 'not-allowed' : 'pointer',
            }}>{t('estudo.prev_btn')}</button>
            <button onClick={handleQuizProximo} disabled={quizIdx === quiz.length - 1} style={{
              ...btnBase, flex: 1, padding: '8px 14px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond, border: `1px solid ${borderColor}`,
              opacity: quizIdx === quiz.length - 1 ? 0.4 : 1,
              cursor: quizIdx === quiz.length - 1 ? 'not-allowed' : 'pointer',
            }}>{t('estudo.next_btn')}</button>
          </div>

          <div style={{ height: '4px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px',
              background: 'linear-gradient(90deg, #8b5cf6, #34d399)',
              width: `${((quizIdx + 1) / quiz.length) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
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

      {/* ── Lista de Tópicos / Nuvem de Palavras ────────────────────────────────
          Sem lib externa — font-size escalado linearmente pelo score normalizado
          entre o menor e o maior da lista (backend já ordena por score desc). */}
      {topicos?.length > 0 && (
        <div style={{ background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '14px' }}>{t('estudo.section_topicos')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline', justifyContent: 'center' }}>
            {(() => {
              const scores = topicos.map(x => x.score);
              const max = Math.max(...scores), min = Math.min(...scores);
              const cores = darkMode
                ? ['#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#fbbf24']
                : ['#7c3aed', '#059669', '#2563eb', '#db2777', '#d97706'];
              return topicos.map((tp, i) => {
                const norm = max > min ? (tp.score - min) / (max - min) : 1;
                const fontSize = 12 + norm * 18; // 12px..30px
                return (
                  <span key={tp.termo}
                    onClick={() => setTema(tp.termo)}
                    title={t('estudo.topico_usar_como_tema', { count: tp.ocorrencias })}
                    style={{ fontSize: `${fontSize}px`, fontWeight: 700, color: cores[i % cores.length], lineHeight: 1.2,
                      whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {tp.termo}
                  </span>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Resumo ───────────────────────────────────────────────────────────── */}
      {resumo && (
        <div style={{ background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, margin: 0 }}>{t('estudo.section_resumo')}</p>
            {ttsDisponivel && (
              <button
                onClick={handleOuvirResumo}
                disabled={ttsCarregando}
                title={t('estudo.tts_button_title')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                  border: `1px solid ${borderColor}`, background: 'transparent',
                  color: textSecond, cursor: ttsCarregando ? 'default' : 'pointer',
                  opacity: ttsCarregando ? 0.6 : 1,
                }}>
                {ttsCarregando
                  ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                  : ttsTocando
                  ? <Square size={12} aria-hidden="true" />
                  : <Volume2 size={12} aria-hidden="true" />}
                {ttsCarregando ? t('estudo.tts_generating') : ttsTocando ? t('estudo.tts_stop') : t('estudo.tts_listen')}
              </button>
            )}
          </div>
          {ttsErro && (
            <p style={{ fontSize: '11px', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={11} aria-hidden="true" /> {ttsErro}
            </p>
          )}
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
