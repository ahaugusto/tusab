// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { X, Pencil, Check, Copy, FileText, FileDown, Trash2, Loader2 } from 'lucide-react';
import ModalWrapper from '../shared/ModalWrapper';
import PostIt from '../shared/PostIt';
import AudioArtefatoPlayer from './AudioArtefatoPlayer';
import { exportResumoCanalDocx, exportRelatorioPdf } from '../../services/api';

/** Achata o conteúdo estruturado num texto corrido — usado por copiar/exportar. */
function formatarTexto(tipo, dados) {
  if (tipo === 'flashcards' && Array.isArray(dados)) {
    return dados.map(c => `P: ${c.pergunta}\nR: ${c.resposta}`).join('\n\n');
  }
  if (tipo === 'postits' && Array.isArray(dados)) {
    return dados.map(p => `- ${p}`).join('\n');
  }
  return String(dados || '');
}

/**
 * EstudoArtefatoModal — modal ampla de leitura/edição de um card do kanban de Estudo.
 * Reaproveita o mecanismo de export do chat (router_exports.py aceita mensagens
 * sintéticas) — não existe rota própria de export pra artefatos de Estudo.
 */
export default function EstudoArtefatoModal({ darkMode, artefato, dados, onClose, onRenomear, onExcluir }) {
  const { t } = useTranslation();
  const [editando, setEditando]   = useState(false);
  const [tituloTmp, setTituloTmp] = useState(artefato.titulo);
  const [copiado, setCopiado]     = useState(false);
  const [exportando, setExportando] = useState(null); // 'docx' | 'pdf' | null
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const bg          = darkMode ? '#0f172a' : '#ffffff';
  const borderColor = darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const textPrimary = darkMode ? '#f1f5f9' : '#1e293b';
  const textSecond  = darkMode ? '#94a3b8' : '#64748b';
  const chipBg      = darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9';

  const textoFlat = formatarTexto(artefato.tipo, dados);

  const handleSalvarTitulo = () => {
    const limpo = tituloTmp.trim();
    if (limpo && limpo !== artefato.titulo) onRenomear(limpo);
    setEditando(false);
  };

  const handleCopiar = () => {
    navigator.clipboard.writeText(textoFlat).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const triggerDownload = async (responsePromise, filename) => {
    try {
      const response = await responsePromise;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return; // erro — export silencioso, modal já mostra o conteúdo
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExportando(null);
    }
  };

  const handleExportar = (formato) => {
    setExportando(formato);
    const mensagens = [{ role: 'assistant', content: textoFlat }];
    const slug = artefato.projeto.replace(/\s+/g, '_');
    if (formato === 'docx') {
      triggerDownload(exportResumoCanalDocx(slug, mensagens), `estudo_${artefato.tipo}_${slug}.docx`);
    } else {
      triggerDownload(exportRelatorioPdf(slug, mensagens), `estudo_${artefato.tipo}_${slug}.pdf`);
    }
  };

  const btnAcao = {
    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700,
    padding: '6px 12px', borderRadius: '10px', border: `1px solid ${borderColor}`,
    background: chipBg, color: textSecond, cursor: 'pointer',
  };

  return (
    <ModalWrapper onClose={onClose} label={artefato.titulo}>
      <div style={{
        background: bg, border: `1px solid ${borderColor}`, borderRadius: '20px',
        width: 'min(880px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {editando ? (
              <>
                <input
                  autoFocus
                  value={tituloTmp}
                  onChange={e => setTituloTmp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSalvarTitulo(); if (e.key === 'Escape') setEditando(false); }}
                  style={{
                    flex: 1, fontSize: '15px', fontWeight: 700, color: textPrimary,
                    background: chipBg, border: `1px solid rgba(139,92,246,0.40)`, borderRadius: '10px',
                    padding: '6px 10px', outline: 'none',
                  }} />
                <button onClick={handleSalvarTitulo} aria-label={t('estudo.artefato_salvar_titulo')}
                  style={{ ...btnAcao, color: darkMode ? '#34d399' : '#059669' }}>
                  <Check size={14} />
                </button>
              </>
            ) : (
              <>
                <h2 style={{ flex: 1, fontSize: '15px', fontWeight: 700, color: textPrimary, margin: 0 }}>{artefato.titulo}</h2>
                <button onClick={() => { setTituloTmp(artefato.titulo); setEditando(true); }}
                  aria-label={t('estudo.artefato_editar_titulo')} style={{ ...btnAcao, padding: '6px 8px' }}>
                  <Pencil size={13} />
                </button>
              </>
            )}
            <button onClick={onClose} aria-label={t('estudo.artefato_fechar')} style={{ ...btnAcao, padding: '6px 8px' }}>
              <X size={15} />
            </button>
          </div>

          {/* Metadados */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: chipBg, color: textSecond }}>
              {t(`estudo.type_${artefato.tipo}`)}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: chipBg, color: textSecond }}>
              {artefato.projeto}
            </span>
            {artefato.tema && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                background: darkMode ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.10)', color: darkMode ? '#a78bfa' : '#7c3aed' }}>
                {artefato.tema}
              </span>
            )}
            <span style={{ fontSize: '10px', color: textSecond }}>{artefato.criado_em}</span>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {artefato.tipo === 'resumo' && (
            <>
              <AudioArtefatoPlayer darkMode={darkMode} projeto={artefato.projeto} artefatoId={artefato.id} borderColor={borderColor} />
              <div style={{ fontSize: '13px', lineHeight: 1.7, color: textPrimary }}>
                <ReactMarkdown>{String(dados || '')}</ReactMarkdown>
              </div>
            </>
          )}

          {artefato.tipo === 'flashcards' && Array.isArray(dados) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dados.map((c, i) => (
                <div key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '12px 14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: darkMode ? '#a78bfa' : '#7c3aed', margin: '0 0 4px' }}>{t('estudo.card_question_label')}</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: textPrimary, margin: '0 0 10px' }}>{c.pergunta}</p>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: darkMode ? '#34d399' : '#059669', margin: '0 0 4px' }}>{t('estudo.card_answer_label')}</p>
                  <p style={{ fontSize: '13px', color: textPrimary, margin: 0 }}>{c.resposta}</p>
                </div>
              ))}
            </div>
          )}

          {artefato.tipo === 'postits' && Array.isArray(dados) && (
            <div className="columns-2 md:columns-3">
              {dados.map((texto, i) => <PostIt key={i} texto={texto} index={i} darkMode={darkMode} />)}
            </div>
          )}
        </div>

        {/* Toolbar de ações */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${borderColor}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleCopiar} style={btnAcao}>
            {copiado ? <Check size={13} color={darkMode ? '#34d399' : '#059669'} /> : <Copy size={13} />}
            {copiado ? t('estudo.artefato_copiado') : t('estudo.artefato_copiar')}
          </button>
          <button onClick={() => handleExportar('docx')} disabled={!!exportando} style={{ ...btnAcao, opacity: exportando ? 0.6 : 1 }}>
            {exportando === 'docx' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />}
            Doc
          </button>
          <button onClick={() => handleExportar('pdf')} disabled={!!exportando} style={{ ...btnAcao, opacity: exportando ? 0.6 : 1 }}>
            {exportando === 'pdf' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
            PDF
          </button>
          <div style={{ flex: 1 }} />
          {confirmarExcluir ? (
            <>
              <span style={{ fontSize: '11px', color: textSecond, alignSelf: 'center' }}>{t('estudo.artefato_confirmar_excluir')}</span>
              <button onClick={onExcluir} style={{ ...btnAcao, color: '#dc2626', borderColor: '#fca5a5' }}>
                {t('estudo.artefato_confirmar_sim')}
              </button>
              <button onClick={() => setConfirmarExcluir(false)} style={btnAcao}>{t('estudo.artefato_confirmar_nao')}</button>
            </>
          ) : (
            <button onClick={() => setConfirmarExcluir(true)} style={{ ...btnAcao, color: '#dc2626' }}>
              <Trash2 size={13} /> {t('estudo.artefato_excluir')}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </ModalWrapper>
  );
}
