/**
 * @file MateriaisTab.jsx
 * @description Modo extensão: "Materiais". O que a IA do usuário gera e guarda no Tusab
 *   (tusab_salvar_estudo: flashcards, resumos, post-its) aparece aqui por projeto e abre numa
 *   janela do Tusab: flashcards com virar carta e revisão espaçada, resumo em Markdown,
 *   post-its. A IA gera; o Tusab guarda, mostra e lembra de revisar.
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Info, LibraryBig } from 'lucide-react';
import { BTN_FOCUS } from '../../constants';
import ArtefatosEstudo from './ArtefatosEstudo';
import { abrirPromptsDoProjeto } from './PromptsTab';

const CHAVE_PROJETO = 'tusab_materiais_projeto';

/**
 * Link "Abrir no Tusab" que a IA mostra depois de tusab_salvar_estudo: …/#material/<projeto>/<id>.
 * Lê o destino uma vez e tira o # da barra de endereço. → { projeto, id } ou null.
 */
export function lerDestinoMaterial() {
  const m = /^#material\/([^/]+)\/([^/]+)$/.exec(window.location.hash || '');
  if (!m) return null;
  window.history.replaceState(null, '', window.location.pathname);
  try {
    return { projeto: decodeURIComponent(m[1]), id: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}
const NEGRITO = { b: <strong /> };

export default function MateriaisTab({ darkMode, projetos = [], abrir = null }) {
  const { t } = useTranslation();
  const [projeto, setProjeto] = useState(() => {
    if (abrir?.projeto) return abrir.projeto;
    try { return localStorage.getItem(CHAVE_PROJETO) || ''; } catch { return ''; }
  });
  const [lista, setLista] = useState(null); // null = ainda carregando

  // Projeto lembrado que sumiu (excluído) → o primeiro da lista; sem nenhum lembrado → o primeiro.
  useEffect(() => {
    if (projetos.length && !projetos.includes(projeto)) setProjeto(projetos[0]);
  }, [projetos, projeto]);

  const escolher = (p) => {
    setProjeto(p);
    setLista(null);
    try { localStorage.setItem(CHAVE_PROJETO, p); } catch { /* sem armazenamento */ }
  };

  const textoSec = darkMode ? 'text-slate-400' : 'text-slate-500';
  const btnSec = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`;

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[220px]">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textoSec}`}>{t('ext.prompts.projeto')}</span>
            <select value={projeto} onChange={(e) => escolher(e.target.value)} data-campo="projeto"
              disabled={!projetos.length}
              className={`rounded-xl border px-3 py-2 text-sm ${BTN_FOCUS} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
              {!projetos.length && <option value="">{t('ext.materiais.sem_projetos')}</option>}
              {projetos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <p className={`text-xs flex-1 min-w-[240px] flex items-start gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <span><Trans i18nKey="ext.materiais.dica" components={NEGRITO} /></span>
          </p>
        </div>
      </section>

      {projeto && (
        <ArtefatosEstudo key={projeto} darkMode={darkMode} projeto={projeto} onLista={setLista}
          abrirId={abrir?.projeto === projeto ? abrir.id : null} />
      )}

      {projeto && lista && lista.length === 0 && (
        <section data-estado="materiais-vazio"
          className={`rounded-2xl border border-dashed p-6 text-center space-y-3 ${darkMode ? 'border-white/15' : 'border-slate-300'}`}>
          <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{t('ext.materiais.vazio_titulo')}</p>
          <p className={`text-xs max-w-md mx-auto ${textoSec}`}>{t('ext.materiais.vazio_texto')}</p>
          <button type="button" onClick={() => abrirPromptsDoProjeto(projeto)} className={btnSec} data-acao="ir-biblioteca">
            <LibraryBig size={13} aria-hidden="true" /> {t('ext.materiais.ir_biblioteca')}
          </button>
        </section>
      )}
    </div>
  );
}
