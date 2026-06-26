// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Download, BookOpen, RotateCcw } from 'lucide-react';
import { gerarEstudo, exportFlashcardsAnki } from '../../services/api';

/**
 * EstudoTab — Modo Estudo: flashcards interativos + resumo estruturado.
 *
 * Props:
 *   darkMode    {boolean}
 *   canalAtivo  {string}  — nome do canal/projeto indexado
 */
export default function EstudoTab({ darkMode, canalAtivo }) {
  const [tipo, setTipo]         = useState('flashcards');
  const [nCards, setNCards]     = useState(10);
  const [gerando, setGerando]   = useState(false);
  const [erro, setErro]         = useState('');

  // flashcards state
  const [flashcards, setFlashcards]   = useState([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [flipped, setFlipped]         = useState(false);
  const [revisados, setRevisados]     = useState(new Set());

  // resumo state
  const [resumo, setResumo] = useState('');

  const card = flashcards[currentIdx] ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGerar = useCallback(async () => {
    if (!canalAtivo) {
      setErro('Nenhum canal/projeto selecionado. Indexe uma base primeiro.');
      return;
    }
    setGerando(true);
    setErro('');
    setFlashcards([]);
    setResumo('');
    setCurrentIdx(0);
    setFlipped(false);
    setRevisados(new Set());

    try {
      const res = await gerarEstudo({ canal_nome: canalAtivo, tipo, n_cards: nCards });
      const data = res.data;
      if (data.error) {
        setErro(data.message || 'Erro ao gerar conteúdo de estudo.');
        return;
      }
      if (data.flashcards?.length) setFlashcards(data.flashcards);
      if (data.resumo) setResumo(data.resumo);
    } catch (e) {
      setErro(e?.response?.data?.message || e?.message || 'Erro de conexão com o backend.');
    } finally {
      setGerando(false);
    }
  }, [canalAtivo, tipo, nCards]);

  const handleAnterior = () => {
    setCurrentIdx(i => Math.max(0, i - 1));
    setFlipped(false);
  };

  const handleProximo = () => {
    setCurrentIdx(i => Math.min(flashcards.length - 1, i + 1));
    setFlipped(false);
  };

  const handleRevisar = (soube) => {
    setRevisados(prev => {
      const next = new Set(prev);
      if (soube) next.add(currentIdx); else next.delete(currentIdx);
      return next;
    });
    if (currentIdx < flashcards.length - 1) {
      setCurrentIdx(i => i + 1);
      setFlipped(false);
    }
  };

  const handleExportarAnki = async () => {
    if (!canalAtivo || !flashcards.length) return;
    try {
      const resp = await exportFlashcardsAnki(canalAtivo);
      if (!resp.ok) { setErro('Erro ao exportar CSV.'); return; }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tusab_${canalAtivo}_flashcards.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Erro ao exportar flashcards.');
    }
  };

  const handleResetar = () => {
    setFlashcards([]);
    setResumo('');
    setCurrentIdx(0);
    setFlipped(false);
    setRevisados(new Set());
    setErro('');
  };

  // ── Estilos base ──────────────────────────────────────────────────────────

  const borderColor  = darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const bgCard       = darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const textPrimary  = darkMode ? '#f1f5f9' : '#1e293b';
  const textSecond   = darkMode ? '#94a3b8' : '#64748b';
  const btnBase      = {
    border: 'none', cursor: 'pointer', fontWeight: 700,
    fontSize: '12px', borderRadius: '12px', padding: '8px 16px',
    transition: 'opacity 0.15s',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Controles */}
      <div style={{
        background: bgCard, border: `1px solid ${borderColor}`,
        borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {/* Tipo */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
            Tipo de material
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'flashcards', label: 'Flashcards' },
              { id: 'resumo',     label: 'Resumo'     },
              { id: 'ambos',      label: 'Ambos'      },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTipo(id)}
                style={{
                  ...btnBase,
                  padding: '6px 14px',
                  background: tipo === id
                    ? (darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)')
                    : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                  color: tipo === id
                    ? (darkMode ? '#a78bfa' : '#7c3aed')
                    : textSecond,
                  border: tipo === id
                    ? '1px solid rgba(139,92,246,0.40)'
                    : `1px solid ${borderColor}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantidade */}
        {tipo !== 'resumo' && (
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, marginBottom: '8px' }}>
              Quantidade de cards: <span style={{ color: darkMode ? '#a78bfa' : '#7c3aed' }}>{nCards}</span>
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setNCards(n)}
                  style={{
                    ...btnBase,
                    padding: '5px 12px',
                    background: nCards === n
                      ? (darkMode ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.12)')
                      : (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                    color: nCards === n
                      ? (darkMode ? '#a78bfa' : '#7c3aed')
                      : textSecond,
                    border: nCards === n
                      ? '1px solid rgba(139,92,246,0.40)'
                      : `1px solid ${borderColor}`,
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botão Gerar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleGerar}
            disabled={gerando || !canalAtivo}
            style={{
              ...btnBase,
              flex: 1, padding: '10px 0', fontSize: '13px',
              background: gerando || !canalAtivo
                ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9')
                : (darkMode ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.15)'),
              color: gerando || !canalAtivo ? textSecond
                : (darkMode ? '#a78bfa' : '#7c3aed'),
              cursor: gerando || !canalAtivo ? 'not-allowed' : 'pointer',
              opacity: !canalAtivo ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
            {gerando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando…</>
              : <><BookOpen size={14} /> Gerar</>}
          </button>

          {(flashcards.length > 0 || resumo) && (
            <button onClick={handleResetar} style={{
              ...btnBase, padding: '10px 12px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              color: textSecond,
              border: `1px solid ${borderColor}`,
            }} title="Limpar resultado">
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Canal ativo */}
        {canalAtivo ? (
          <p style={{ fontSize: '10px', color: textSecond, margin: 0 }}>
            Base: <strong style={{ color: darkMode ? '#a78bfa' : '#7c3aed' }}>@{canalAtivo}</strong>
          </p>
        ) : (
          <p style={{ fontSize: '10px', color: darkMode ? '#f87171' : '#dc2626', margin: 0 }}>
            Nenhuma base selecionada — indexe um projeto primeiro.
          </p>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div style={{
          background: darkMode ? 'rgba(248,113,113,0.10)' : '#fef2f2',
          border: `1px solid ${darkMode ? 'rgba(248,113,113,0.30)' : '#fca5a5'}`,
          borderRadius: '12px', padding: '10px 14px',
          color: darkMode ? '#f87171' : '#dc2626', fontSize: '12px',
        }}>
          {erro}
        </div>
      )}

      {/* ── Flashcards ────────────────────────────────────────────────────── */}
      {flashcards.length > 0 && (
        <div style={{
          background: bgCard, border: `1px solid ${borderColor}`,
          borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: textSecond, margin: 0 }}>
              Flashcards
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: textSecond }}>
                {currentIdx + 1} / {flashcards.length}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: darkMode ? 'rgba(52,211,153,0.15)' : '#d1fae5',
                color: darkMode ? '#34d399' : '#065f46',
              }}>
                {revisados.size} sabidos
              </span>
              <button onClick={handleExportarAnki}
                style={{
                  ...btnBase, padding: '5px 10px',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: textSecond, border: `1px solid ${borderColor}`,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
                title="Exportar para Anki (.csv)">
                <Download size={12} /> Anki
              </button>
            </div>
          </div>

          {/* Card com flip */}
          {card && (
            <div
              onClick={() => setFlipped(f => !f)}
              style={{ perspective: '1000px', cursor: 'pointer' }}>
              <div style={{
                position: 'relative', width: '100%', height: '180px',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s ease',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Frente — Pergunta */}
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
                    letterSpacing: '0.06em', color: darkMode ? '#a78bfa' : '#7c3aed' }}>
                    Pergunta
                  </span>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: textPrimary,
                    lineHeight: 1.5, margin: 0 }}>
                    {card.pergunta}
                  </p>
                  <span style={{ fontSize: '10px', color: textSecond, marginTop: '4px' }}>
                    Clique para revelar
                  </span>
                </div>

                {/* Verso — Resposta */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: darkMode ? 'rgba(52,211,153,0.10)' : 'rgba(52,211,153,0.08)',
                  border: `1px solid ${darkMode ? 'rgba(52,211,153,0.25)' : 'rgba(16,185,129,0.25)'}`,
                  borderRadius: '14px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px', gap: '8px', textAlign: 'center',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: darkMode ? '#34d399' : '#059669' }}>
                    Resposta
                  </span>
                  <p style={{ fontSize: '14px', color: textPrimary, lineHeight: 1.5, margin: 0 }}>
                    {card.resposta}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navegação + marcação */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleAnterior} disabled={currentIdx === 0}
              style={{
                ...btnBase, padding: '8px 14px',
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                color: textSecond, border: `1px solid ${borderColor}`,
                opacity: currentIdx === 0 ? 0.4 : 1,
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
              }}>
              ← Anterior
            </button>

            {flipped && (
              <>
                <button onClick={() => handleRevisar(false)}
                  style={{
                    ...btnBase, flex: 1, padding: '8px 0',
                    background: darkMode ? 'rgba(248,113,113,0.15)' : '#fef2f2',
                    color: darkMode ? '#f87171' : '#dc2626',
                    border: `1px solid ${darkMode ? 'rgba(248,113,113,0.30)' : '#fca5a5'}`,
                  }}>
                  Não sei
                </button>
                <button onClick={() => handleRevisar(true)}
                  style={{
                    ...btnBase, flex: 1, padding: '8px 0',
                    background: darkMode ? 'rgba(52,211,153,0.15)' : '#d1fae5',
                    color: darkMode ? '#34d399' : '#065f46',
                    border: `1px solid ${darkMode ? 'rgba(52,211,153,0.30)' : '#6ee7b7'}`,
                  }}>
                  Sei!
                </button>
              </>
            )}

            <button onClick={handleProximo} disabled={currentIdx === flashcards.length - 1}
              style={{
                ...btnBase, padding: '8px 14px',
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                color: textSecond, border: `1px solid ${borderColor}`,
                opacity: currentIdx === flashcards.length - 1 ? 0.4 : 1,
                cursor: currentIdx === flashcards.length - 1 ? 'not-allowed' : 'pointer',
              }}>
              Próximo →
            </button>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: '4px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px',
              background: 'linear-gradient(90deg, #8b5cf6, #34d399)',
              width: `${((currentIdx + 1) / flashcards.length) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Resumo ────────────────────────────────────────────────────────── */}
      {resumo && (
        <div style={{
          background: bgCard, border: `1px solid ${borderColor}`,
          borderRadius: '16px', padding: '16px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: textSecond, marginBottom: '12px' }}>
            Resumo Estruturado
          </p>
          <div style={{
            fontSize: '13px', lineHeight: 1.7, color: textPrimary,
          }}>
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: textPrimary }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: '13px', fontWeight: 700, marginTop: '12px', marginBottom: '6px', color: darkMode ? '#a78bfa' : '#7c3aed' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: 700, marginTop: '10px', marginBottom: '4px', color: textSecond }}>{children}</h3>,
                p:  ({ children }) => <p style={{ marginBottom: '8px', color: textPrimary }}>{children}</p>,
                ul: ({ children }) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: '3px', color: textPrimary }}>{children}</li>,
                strong: ({ children }) => <strong style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>{children}</strong>,
              }}>
              {resumo}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Keyframe para spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
