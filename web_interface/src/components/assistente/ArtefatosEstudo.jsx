// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
/**
 * ArtefatosEstudo — os materiais de estudo guardados num projeto (flashcards, resumos,
 * post-its), em cartões; cada um abre no EstudoArtefatoModal (flashcards com virar carta e
 * revisão espaçada, resumo em Markdown, post-its). Renomear e excluir no próprio cartão.
 *
 * Na extensão quem grava é a IA do usuário (tusab_salvar_estudo), fora desta tela: a lista
 * se atualiza ao voltar para a janela e a cada 10 s. `atualizarQuando` força uma nova busca
 * quando muda (o EstudoTab do desktop passava o fim de cada geração).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Layers, StickyNote, Pencil, Trash2 } from 'lucide-react';
import { MODO_EXTENSAO } from '../../constants';
import { listarArtefatosEstudo, buscarArtefatoEstudo, renomearArtefatoEstudo, excluirArtefatoEstudo } from '../../services/api';
import EstudoArtefatoModal from './EstudoArtefatoModal';

const ICONE_TIPO = { resumo: FileText, flashcards: Layers, postits: StickyNote };

export default function ArtefatosEstudo({ darkMode, projeto, atualizarQuando, titulo = true, onLista, abrirId = null }) {
  const { t } = useTranslation();
  const [artefatos, setArtefatos] = useState([]);
  const [artefatoAberto, setArtefatoAberto] = useState(null); // entrada do manifest
  const [artefatoDados, setArtefatoDados] = useState(null);   // conteúdo estruturado
  const [tituloEditando, setTituloEditando] = useState(null); // id do cartão em edição
  const [tituloEditandoValor, setTituloEditandoValor] = useState('');

  const refetch = useCallback(() => {
    if (!projeto) { setArtefatos([]); onLista?.([]); return; }
    listarArtefatosEstudo(projeto)
      .then((r) => { const l = r.data?.artefatos || []; setArtefatos(l); onLista?.(l); })
      .catch(() => { setArtefatos([]); onLista?.([]); });
  }, [projeto, onLista]);

  useEffect(() => { refetch(); }, [refetch, atualizarQuando]);

  useEffect(() => {
    if (!MODO_EXTENSAO) return undefined;
    const id = setInterval(refetch, 10000);
    window.addEventListener('focus', refetch);
    return () => { clearInterval(id); window.removeEventListener('focus', refetch); };
  }, [refetch]);

  // Veio do link "Abrir no Tusab": abre aquele material assim que a lista chega (uma vez).
  const jaAbriu = React.useRef(false);
  useEffect(() => {
    if (!abrirId || jaAbriu.current) return;
    const art = artefatos.find((a) => a.id === abrirId);
    if (art) { jaAbriu.current = true; abrir(art); }
  }, [abrirId, artefatos]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (art) => {
    const r = await buscarArtefatoEstudo(projeto, art.id).catch(() => null);
    if (r?.data?.ok) { setArtefatoAberto(art); setArtefatoDados(r.data.dados); }
  };

  const renomearAberto = async (novoTitulo) => {
    await renomearArtefatoEstudo(projeto, artefatoAberto.id, novoTitulo).catch(() => {});
    setArtefatoAberto((prev) => (prev ? { ...prev, titulo: novoTitulo } : prev));
    refetch();
  };

  const excluirAberto = async () => {
    await excluirArtefatoEstudo(projeto, artefatoAberto.id).catch(() => {});
    setArtefatoAberto(null);
    setArtefatoDados(null);
    refetch();
  };

  const iniciarEdicao = (e, art) => {
    e.stopPropagation();
    setTituloEditando(art.id);
    setTituloEditandoValor(art.titulo);
  };

  const salvarTitulo = async (art) => {
    const limpo = tituloEditandoValor.trim();
    setTituloEditando(null);
    if (!limpo || limpo === art.titulo) return;
    await renomearArtefatoEstudo(projeto, art.id, limpo).catch(() => {});
    refetch();
  };

  const excluir = async (e, art) => {
    e.stopPropagation();
    await excluirArtefatoEstudo(projeto, art.id).catch(() => {});
    refetch();
  };

  const borderColor = darkMode ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const bgCard = darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const textPrimary = darkMode ? '#f1f5f9' : '#1e293b';
  const textSecond = darkMode ? '#94a3b8' : '#64748b';
  const destaque = darkMode ? '#a78bfa' : '#7c3aed';
  const botaoIcone = { background: 'none', border: 'none', cursor: 'pointer', color: textSecond, padding: '4px', display: 'flex', borderRadius: '6px' };

  return (
    <>
      {artefatos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {titulo && (
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: textSecond, margin: 0 }}>
              {t('estudo.kanban_titulo', { count: artefatos.length })}
            </p>
          )}
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', listStyle: 'none', margin: 0, padding: 0 }}>
            {artefatos.map((art) => {
              const Icone = ICONE_TIPO[art.tipo] || FileText;
              return (
                <li key={art.id} data-artefato={art.tipo}
                  style={{ background: bgCard, border: `1px solid ${borderColor}`, borderRadius: '14px', padding: '12px 14px', width: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icone size={13} color={destaque} aria-hidden="true" />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: destaque }}>{t(`estudo.type_${art.tipo}`)}</span>
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={(e) => iniciarEdicao(e, art)} aria-label={t('estudo.artefato_editar_titulo')} style={botaoIcone}>
                      <Pencil size={11} />
                    </button>
                    <button type="button" onClick={(e) => excluir(e, art)} aria-label={t('estudo.artefato_excluir')} style={botaoIcone}>
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {tituloEditando === art.id ? (
                    <input
                      autoFocus
                      aria-label={t('estudo.artefato_editar_titulo')}
                      value={tituloEditandoValor}
                      onChange={(e) => setTituloEditandoValor(e.target.value)}
                      onBlur={() => salvarTitulo(art)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setTituloEditando(null); }}
                      style={{ fontSize: '12px', fontWeight: 700, color: textPrimary, background: 'transparent', border: '1px solid rgba(139,92,246,0.40)', borderRadius: '6px', padding: '3px 6px', outline: 'none' }} />
                  ) : (
                    // O título é o botão que abre o material (teclado e leitor de tela chegam nele).
                    <button type="button" onClick={() => abrir(art)}
                      style={{ fontSize: '12px', fontWeight: 700, color: textPrimary, margin: 0, padding: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {art.titulo}
                    </button>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {art.tema && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: darkMode ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.10)', color: destaque }}>
                        {art.tema}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: textSecond }}>{art.criado_em}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {artefatoAberto && artefatoDados !== null && (
        <EstudoArtefatoModal
          darkMode={darkMode}
          artefato={artefatoAberto}
          dados={artefatoDados}
          onClose={() => { setArtefatoAberto(null); setArtefatoDados(null); }}
          onRenomear={renomearAberto}
          onExcluir={excluirAberto}
        />
      )}
    </>
  );
}
