// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React from 'react';

const ROTACOES = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2'];

const PALETA = [
  { bg: '#fef3c7', text: '#78350f' },
  { bg: '#fce7f3', text: '#831843' },
  { bg: '#dbeafe', text: '#1e3a8a' },
  { bg: '#d1fae5', text: '#065f46' },
  { bg: '#ede9fe', text: '#4c1d95' },
];

const PALETA_DARK = [
  { bg: 'rgba(251,191,36,0.14)', text: '#fde68a' },
  { bg: 'rgba(244,114,182,0.14)', text: '#fbcfe8' },
  { bg: 'rgba(96,165,250,0.14)', text: '#bfdbfe' },
  { bg: 'rgba(52,211,153,0.14)', text: '#a7f3d0' },
  { bg: 'rgba(167,139,250,0.14)', text: '#ddd6fe' },
];

/**
 * PostIt — nota adesiva de estudo: card leve com rotação e cor alternadas por
 * índice (sem lib de masonry — o pai organiza em CSS columns e cada nota usa
 * break-inside-avoid pra não cortar ao meio entre colunas).
 */
export default function PostIt({ texto, index = 0, darkMode }) {
  const cores = darkMode ? PALETA_DARK : PALETA;
  const cor = cores[index % cores.length];
  const rotacao = ROTACOES[index % ROTACOES.length];
  return (
    <div
      className={`${rotacao} break-inside-avoid mb-3 rounded-lg shadow-sm transition-transform duration-150 hover:rotate-0 hover:scale-[1.02]`}
      style={{ background: cor.bg, color: cor.text, padding: '14px 16px', fontSize: '13px', fontWeight: 600, lineHeight: 1.5 }}
    >
      {texto}
    </div>
  );
}
