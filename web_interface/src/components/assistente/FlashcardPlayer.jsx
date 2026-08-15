// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { revisarFlashcard, buscarProgressoRevisao } from '../../services/api';

/**
 * FlashcardPlayer — experiência de revisão de flashcards (virar carta,
 * anterior/próximo, avaliação SM-2) extraída de EstudoTab.jsx pra ser
 * reutilizável tanto na sessão "ao vivo" (geração atual, EstudoTab) quanto
 * dentro do modal de um artefato salvo (EstudoArtefatoModal) — antes o
 * modal só listava pergunta/resposta em texto corrido, sem interatividade.
 *
 * Estado de navegação (currentIdx, flipped) é local e reseta ao trocar de
 * `cards` — cada instância do player é uma sessão de revisão independente.
 * Progresso de revisão (SM-2) é buscado/gravado por `projeto` + `card.id`
 * (hash estável da pergunta, ver backend `_id_flashcard`), então funciona
 * igual seja o card da sessão ao vivo ou de um artefato salvo antigo.
 */
export default function FlashcardPlayer({ darkMode, projeto, cards }) {
  const { t } = useTranslation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped,    setFlipped]    = useState(false);
  const [progressoRevisao, setProgressoRevisao] = useState({});

  useEffect(() => {
    if (!projeto) { setProgressoRevisao({}); return; }
    buscarProgressoRevisao(projeto).then(r => setProgressoRevisao(r.data?.progresso || {})).catch(() => setProgressoRevisao({}));
  }, [projeto]);

  useEffect(() => { setCurrentIdx(0); setFlipped(false); }, [cards]);

  const card = cards[currentIdx] ?? null;

  const handleAnterior = () => { setCurrentIdx(i => Math.max(0, i - 1)); setFlipped(false); };
  const handleProximo  = () => { setCurrentIdx(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };

  // Qualidade: 1 = "Não lembrei", 3 = "Difícil", 5 = "Fácil" — mesmo
  // mapeamento simplificado da escala 0-5 do SM-2 usado na sessão ao vivo.
  const handleQualidade = async (qualidade) => {
    if (!card) return;
    try {
      const r = await revisarFlashcard(projeto, card.id, qualidade);
      if (r.data?.ok) setProgressoRevisao(prev => ({ ...prev, [card.id]: r.data }));
    } catch { /* revisão não persistida — segue a navegação normalmente */ }
    if (currentIdx < cards.length - 1) { setCurrentIdx(i => i + 1); setFlipped(false); }
  };

  const borderColor = darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const textPrimary = darkMode ? '#f1f5f9' : '#1e293b';
  const textSecond  = darkMode ? '#94a3b8' : '#64748b';
  const btnBase     = {
    border: 'none', cursor: 'pointer', fontWeight: 700,
    fontSize: '12px', borderRadius: '12px', padding: '8px 16px',
    transition: 'opacity 0.15s',
  };

  if (!cards.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', color: textSecond }}>{currentIdx + 1} / {cards.length}</span>
      </div>

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

        <button onClick={handleProximo} disabled={currentIdx === cards.length - 1} style={{
          ...btnBase, padding: '8px 14px',
          background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          color: textSecond, border: `1px solid ${borderColor}`,
          opacity: currentIdx === cards.length - 1 ? 0.4 : 1,
          cursor: currentIdx === cards.length - 1 ? 'not-allowed' : 'pointer',
        }}>{t('estudo.next_btn')}</button>
      </div>

      <div style={{ height: '4px', background: darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
        borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '4px',
          background: 'linear-gradient(90deg, #8b5cf6, #34d399)',
          width: `${((currentIdx + 1) / cards.length) * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
