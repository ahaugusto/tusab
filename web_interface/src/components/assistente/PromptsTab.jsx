/**
 * @file PromptsTab.jsx
 * @description Modo extensão: "Biblioteca de Prompts". O Tusab não gera cards, quizzes ou resumos —
 *   a IA do usuário faz isso melhor. Esta aba entrega o pedido certo, já amarrado ao projeto
 *   (buscar na base, citar a fonte), para copiar e colar — ou usar pelo "+" do Claude.
 *   A lista vem do plugin (GET /api/prompts), a mesma que aparece no menu "+" do Claude, já no
 *   idioma da tela (o plugin recebe o idioma em cada chamada e recarregamos ao trocar).
 *   "Meus prompts": o usuário cria os seus (do zero ou duplicando um pronto); as regras de
 *   busca e citação entram sempre, no plugin, sem depender do texto que ele escreveu.
 *   PedirIA: o atalho "Pedir à IA" que o Repositório mostra em cada projeto.
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';
import axios from 'axios';
import { BookOpen, GraduationCap, Search, Scale, PenLine, Inbox, Copy, Check, X, Info, Star, Plus, Pencil, Trash2, CopyPlus, Sparkles, ChevronDown, Gauge, Folder, ExternalLink, Loader2, AlertTriangle, CheckCircle2, Zap, Brain } from 'lucide-react';
import { API_BASE, BTN_FOCUS } from '../../constants';
import ModalWrapper from '../shared/ModalWrapper';
import EconomiaTokens from './EconomiaTokens';

const MEUS = 'meus';
const TODOS = 'todos';
const ICONE_CATEGORIA = { estudar: BookOpen, ensinar: GraduationCap, pesquisar: Search, decidir: Scale, criar: PenLine, acompanhar: Inbox, [MEUS]: Star };
const CHAVE_PROJETO = 'tusab_prompts_projeto';
/** Evento que abre a aba de prompts num projeto (o App troca de aba; a aba troca de projeto). */
export const EVENTO_ABRIR_PROMPTS = 'tusab:abrir-prompts';
const ATALHOS = ['resposta-verificavel', 'resumo', 'flashcards', 'quiz'];
const NEGRITO = { b: <strong /> };
const TODAS_PASTAS = '*';
// "Para quê": os filtros da Biblioteca (perfil único desde 19/11/2026). Um prompt pode servir a mais de um.
const PUBLICOS = ['estudar', 'ensinar', 'pesquisar', 'trabalho'];
// Modelo sugerido pelo custo-benefício da tarefa (sugestão; quem escolhe o modelo é o usuário).
const ICONE_NIVEL = { leve: Zap, equilibrado: Gauge, avancado: Brain };

/** "Roediger, H. L., III; Karpicke, J. D." → "Roediger & Karpicke"; 3 ou mais → "Chi et al." */
function autoresCurto(autores = '') {
  const nomes = String(autores).split(';').map((x) => x.split(',')[0].trim()).filter(Boolean);
  if (nomes.length > 2) return `${nomes[0]} et al.`;
  return nomes.join(' & ');
}

/** Selo do modelo sugerido: ícone + texto (nunca só cor), com a explicação no title. */
function SeloNivel({ nivel, darkMode }) {
  const { t } = useTranslation();
  const Icone = ICONE_NIVEL[nivel];
  if (!Icone) return null;
  return (
    <span title={t(`ext.nivel.${nivel}_dica`)} data-nivel={nivel}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${darkMode ? 'bg-white/8 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
      <Icone size={10} aria-hidden="true" /> {t(`ext.nivel.${nivel}`)}
    </span>
  );
}

/** Comparação de busca: sem acento e sem maiúsculas ("Revisão" acha "revisao"). */
const normalizar = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();

// IA no navegador para o atalho do aviso de "copiado" (a escolha fica lembrada neste navegador).
const IAS_NAVEGADOR = [
  { id: 'claude', nome: 'Claude.ai', url: 'https://claude.ai/new' },
  { id: 'chatgpt', nome: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', nome: 'Gemini', url: 'https://gemini.google.com/app' },
];
const CHAVE_IA_NAVEGADOR = 'tusab_ia_navegador';
// Nome que a ferramenta de IA informa ao conectar (clientInfo.name) → nome para mostrar.
const NOME_CLIENTE = { 'claude-ai': 'Claude Desktop', 'claude-code': 'Claude Code' };
const nomeCliente = (c) => NOME_CLIENTE[c?.nome] || c?.nome || '';

/**
 * Estado da conexão MCP enquanto o aviso está aberto (GET /api/conexao a cada 2 s):
 * se o plugin está ligado a uma ferramenta de IA e se ela já usou o Tusab depois da cópia.
 * → { carregado, mcp, cliente, consultou: nome da ferramenta | null }
 */
function useConexaoDesde(desde) {
  const [estado, setEstado] = useState({ carregado: false, mcp: false, cliente: null, consultou: null });
  useEffect(() => {
    let vivo = true;
    const ler = () => axios.get(`${API_BASE}/conexao`).then((r) => {
      if (!vivo) return;
      const uf = r.data?.ultima_ferramenta;
      setEstado({ carregado: true, mcp: Boolean(r.data?.mcp), cliente: r.data?.cliente || null, consultou: uf && uf.em >= desde ? uf.nome : null });
    }).catch(() => { if (vivo) setEstado((e) => ({ ...e, carregado: true })); });
    ler();
    const id = setInterval(ler, 2000);
    return () => { vivo = false; clearInterval(id); };
  }, [desde]);
  return estado;
}

/**
 * Aviso depois de copiar: leva à IA aberta no computador (app do Claude, pelo endereço claude://)
 * ou à IA no navegador, e mostra se o Tusab está conectado a uma IA e quando ela consultou a base
 * (a confirmação de que a resposta vem dos trechos do usuário). Fica 45 s (8 s depois da
 * confirmação), ou até fechar; parado enquanto o mouse ou o foco estão nele; não rouba o foco.
 */
export function AvisoCopiado({ darkMode, onFechar, pedido = null }) {
  const { t } = useTranslation();
  // IA no navegador: ao abrir por aqui, o pedido é copiado de novo com os trechos da base dentro.
  const [paraNavegador, setParaNavegador] = useState(null); // null | 'copiando' | { trechos } | { erro }
  const copiarParaNavegador = () => {
    if (!pedido) return;
    setParaNavegador('copiando');
    const montagem = montarPedidoNavegador(pedido.id, pedido.projeto, pedido.extras);
    copiarTexto(montagem.then((r) => r.texto)) // começa no clique (Safari); a aba abre pelo próprio link
      .then((ok) => montagem.then((r) => setParaNavegador(ok ? { trechos: r.trechos } : { erro: t('ext.prompts.copiar_manual') })))
      .catch((e) => setParaNavegador({ erro: e.message }));
    montagem.catch((e) => setParaNavegador({ erro: e.message }));
  };
  const [ia, setIa] = useState(() => {
    try { return localStorage.getItem(CHAVE_IA_NAVEGADOR) || 'claude'; } catch { return 'claude'; }
  });
  const [desde] = useState(() => Date.now());
  const conexao = useConexaoDesde(desde);
  const pausado = useRef(false);
  useEffect(() => {
    const tm = setInterval(() => { if (!pausado.current) onFechar(); }, conexao.consultou ? 8000 : 45000);
    return () => clearInterval(tm);
  }, [onFechar, conexao.consultou]);
  const escolher = (id) => {
    setIa(id);
    try { localStorage.setItem(CHAVE_IA_NAVEGADOR, id); } catch { /* sem armazenamento */ }
  };
  const destino = IAS_NAVEGADOR.find((x) => x.id === ia) || IAS_NAVEGADOR[0];
  const botao = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${BTN_FOCUS}`;
  return createPortal(
    <div role="status" aria-live="polite" data-estado="copiado"
      onMouseEnter={() => { pausado.current = true; }} onMouseLeave={() => { pausado.current = false; }}
      onFocus={() => { pausado.current = true; }} onBlur={() => { pausado.current = false; }}
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9998] w-[min(34rem,calc(100vw-2rem))] rounded-2xl border shadow-2xl p-4 space-y-3
        ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm">
          <strong className="text-emerald-500">{t('ext.copiado.titulo')}</strong> {t('ext.copiado.texto')}
        </p>
        <button onClick={onFechar} aria-label={t('ext.copiado.fechar')}
          className={`p-1 rounded-lg shrink-0 ${BTN_FOCUS} ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href="claude://" onClick={() => setTimeout(onFechar, 300)} data-acao="abrir-app"
          className={`${botao} bg-primary-button text-white hover:bg-primary-button/85`}>
          <ExternalLink size={13} aria-hidden="true" /> {t('ext.copiado.app')}
        </a>
        <span className={`inline-flex items-center rounded-lg border ${darkMode ? 'border-white/15' : 'border-slate-300'}`}>
          <a href={destino.url} target="_blank" rel="noopener noreferrer" data-acao="abrir-navegador" onClick={copiarParaNavegador}
            className={`${botao} ${darkMode ? 'text-slate-200 hover:bg-white/8' : 'text-slate-700 hover:bg-slate-50'}`}>
            <ExternalLink size={13} aria-hidden="true" /> {t('ext.copiado.navegador')}
          </a>
          <select value={ia} onChange={(e) => escolher(e.target.value)} aria-label={t('ext.copiado.navegador_qual')}
            className={`text-xs font-bold bg-transparent pl-3 py-1.5 min-w-[7.5rem] rounded-r-lg border-l ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-200' : 'border-slate-300 text-slate-700'}`}>
            {IAS_NAVEGADOR.map((x) => <option key={x.id} value={x.id} className={darkMode ? 'bg-slate-900' : ''}>{x.nome}</option>)}
          </select>
        </span>
      </div>
      <EstadoConexao conexao={conexao} darkMode={darkMode} />
      {paraNavegador ? (
        <p data-estado={paraNavegador === 'copiando' ? 'navegador-copiando' : paraNavegador.erro ? 'navegador-erro' : 'navegador-copiado'}
          className={`text-xs ${paraNavegador.erro ? (darkMode ? 'text-amber-300' : 'text-amber-700') : (darkMode ? 'text-emerald-300' : 'text-emerald-700')}`}>
          {paraNavegador === 'copiando' ? t('ext.copiado.navegador_copiando')
            : paraNavegador.erro ? paraNavegador.erro
              : t('ext.copiado.navegador_trechos', { count: paraNavegador.trechos })}
        </p>
      ) : (
        <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t(pedido ? 'ext.copiado.aviso_navegador_trechos' : 'ext.copiado.aviso_navegador')}</p>
      )}
    </div>,
    document.body,
  );
}

/** Linha de estado da conexão no aviso de "copiado". */
function EstadoConexao({ conexao, darkMode }) {
  const { t } = useTranslation();
  if (!conexao.carregado) return null;
  const cliente = nomeCliente(conexao.cliente);
  let Icone = Loader2, cor = darkMode ? 'text-slate-300' : 'text-slate-600', texto, girando = true;
  if (!conexao.mcp) {
    Icone = AlertTriangle; girando = false; cor = darkMode ? 'text-amber-300' : 'text-amber-700';
    texto = t('ext.copiado.sem_conexao');
  } else if (conexao.consultou) {
    Icone = CheckCircle2; girando = false; cor = darkMode ? 'text-emerald-300' : 'text-emerald-700';
    texto = t('ext.copiado.consultou', { cliente: cliente || 'IA', ferramenta: conexao.consultou });
  } else {
    texto = t('ext.copiado.aguardando', { cliente: cliente || 'IA' });
  }
  return (
    <p data-estado={!conexao.mcp ? 'sem-conexao' : conexao.consultou ? 'consultou' : 'aguardando'}
      className={`text-xs flex items-start gap-2 ${cor}`}>
      <Icone size={14} className={`shrink-0 mt-0.5 ${girando ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{texto}</span>
    </p>
  );
}

/**
 * Copia um texto — ou a promessa de um texto que o plugin ainda está montando. O Safari só
 * deixa copiar dentro do clique: com ClipboardItem a cópia começa no clique e o texto chega
 * depois. Sem ClipboardItem (ou se falhar), usa writeText. → true se copiou.
 */
async function copiarTexto(textoOuPromessa) {
  const promessa = Promise.resolve(textoOuPromessa);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const blob = promessa.then((texto) => new Blob([texto], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    } catch { /* tenta writeText abaixo */ }
  }
  try {
    await navigator.clipboard.writeText(await promessa);
    return true;
  } catch {
    return false;
  }
}

async function montarPedido(id, projeto, extras = {}) {
  const r = await axios.post(`${API_BASE}/prompts/montar`, { id, projeto, ...extras });
  if (r.data?.error) throw new Error(r.data.message);
  return r.data.texto;
}

/** Versão para IA no navegador: o pedido com os trechos da base dentro. → { texto, trechos } */
async function montarPedidoNavegador(id, projeto, extras = {}) {
  const r = await axios.post(`${API_BASE}/prompts/montar`, { id, projeto, ...extras, navegador: true });
  if (r.data?.error) throw new Error(r.data.message);
  return { texto: r.data.texto, trechos: r.data.trechos };
}

function lembrarProjeto(p) {
  try { localStorage.setItem(CHAVE_PROJETO, p); } catch { /* sem armazenamento */ }
}

/** Abre a Biblioteca de Prompts já no projeto (usado pelo Repositório). */
export function abrirPromptsDoProjeto(projeto) {
  lembrarProjeto(projeto);
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PROMPTS, { detail: { projeto } }));
}

export default function PromptsTab({ darkMode, projetos = [] }) {
  const { t, i18n } = useTranslation();
  const [lista, setLista] = useState([]);
  const [categoria, setCategoria] = useState(TODOS);
  const [projeto, setProjeto] = useState(() => {
    try { return localStorage.getItem(CHAVE_PROJETO) || ''; } catch { return ''; }
  });
  const [aberto, setAberto] = useState(null);
  const [editando, setEditando] = useState(null); // {id?, titulo, descricao, pedido, base?}
  const [excluindo, setExcluindo] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);
  const [aviso, setAviso] = useState('');
  const [ultimoPedido, setUltimoPedido] = useState(null); // o que foi copiado (para a versão do navegador)
  const [mostrarCopiado, setMostrarCopiado] = useState(false);
  const [busca, setBusca] = useState('');
  const [pasta, setPasta] = useState(TODAS_PASTAS);
  const [renomeando, setRenomeando] = useState(null);
  const [economia, setEconomia] = useState(false);
  const abasRef = useRef([]);
  const fecharCopiado = useCallback(() => setMostrarCopiado(false), []);

  const carregar = useCallback(() => axios.get(`${API_BASE}/prompts`).then((r) => {
    setLista(r.data?.prompts || []);
  }).catch(() => setAviso(t('ext.prompts.erro_carregar'))), [t]);

  // Recarrega ao trocar de idioma: títulos, descrições e pedidos vêm do plugin já traduzidos.
  useEffect(() => { carregar(); }, [carregar, i18n.resolvedLanguage]);

  // Vindo do Repositório com a aba já aberta.
  useEffect(() => {
    const ao = (e) => { if (e.detail?.projeto) setProjeto(e.detail.projeto); };
    window.addEventListener(EVENTO_ABRIR_PROMPTS, ao);
    return () => window.removeEventListener(EVENTO_ABRIR_PROMPTS, ao);
  }, []);

  // Projeto lembrado só vale se ainda existir.
  useEffect(() => {
    if (projeto && projetos.length && !projetos.includes(projeto)) setProjeto('');
  }, [projetos, projeto]);

  const escolherProjeto = (p) => {
    setProjeto(p);
    lembrarProjeto(p);
  };

  const montar = useCallback((id, extras = {}) => montarPedido(id, projeto, extras), [projeto]);

  const copiarDireto = async (p) => {
    try {
      const pedido = montar(p.id); // a cópia começa já, no clique (Safari); o texto chega depois
      const ok = await copiarTexto(pedido);
      await pedido; // erro do plugin (ex.: projeto inválido) vira aviso, não prévia
      if (ok) {
        setCopiadoId(p.id);
        setUltimoPedido({ id: p.id, projeto, extras: {} });
        setMostrarCopiado(true);
        setTimeout(() => setCopiadoId(null), 2000);
      } else setAberto(p); // sem permissão de área de transferência: abre a prévia para copiar à mão
    } catch (e) {
      setAviso(e.message);
    }
  };

  const salvo = (msg) => {
    setEditando(null);
    setAviso(msg);
    carregar().then(() => setCategoria(MEUS));
  };

  const excluir = async (p) => {
    try {
      const r = await axios.delete(`${API_BASE}/prompts/usuario/${p.id}`);
      if (r.data?.error) throw new Error(r.data.message);
      setExcluindo(null);
      setAviso(t('ext.prompts.excluido', { titulo: p.titulo }));
      carregar();
    } catch (e) {
      setAviso(e?.response?.data?.message || e.message);
    }
  };

  // Abas "Para quê" (id fixo, rótulo no idioma da tela) + "Meus prompts", que sempre aparece.
  const abas = useMemo(() => [
    { id: TODOS, nome: t('ext.prompts.todos') },
    ...PUBLICOS.map((id) => ({ id, nome: t(`ext.prompts.publico_${id}`) })),
    { id: MEUS, nome: t('ext.prompts.meus') },
  ], [t]);
  const pastas = useMemo(() => [...new Set(lista.filter((p) => p.categoria_id === MEUS && p.pasta).map((p) => p.pasta))]
    .sort((a, b) => a.localeCompare(b, i18n.resolvedLanguage)), [lista, i18n.resolvedLanguage]);
  // Buscar procura em todos os prompts: a aba "Para quê" aberta (ex.: Ensinar) volta para Todos ao
  // digitar, senão um prompt de outra aba parecia não existir. Em "Meus prompts" a busca fica nos seus.
  const buscar = (valor) => {
    setBusca(valor);
    if (valor.trim() && categoria !== TODOS && categoria !== MEUS) setCategoria(TODOS);
  };
  const termo = normalizar(busca.trim());
  const visiveis = useMemo(() => lista.filter((p) => {
    if (categoria === MEUS ? p.categoria_id !== MEUS : categoria !== TODOS && !(p.publicos || []).includes(categoria)) return false;
    if (categoria === MEUS && pasta !== TODAS_PASTAS && (p.pasta || '') !== pasta) return false;
    if (!termo) return true;
    return [p.titulo, p.descricao, p.pedido, p.pasta, p.categoria, p.referencia?.autores].some((x) => normalizar(x).includes(termo));
  }), [lista, categoria, pasta, termo]);
  // Pasta escolhida que deixou de existir (renomeada/esvaziada) volta para "Todas".
  useEffect(() => {
    if (pasta !== TODAS_PASTAS && pasta !== '' && !pastas.includes(pasta)) setPasta(TODAS_PASTAS);
  }, [pastas, pasta]);

  const renomear = async (de, para) => {
    try {
      const r = await axios.post(`${API_BASE}/prompts/pasta`, { de, para });
      if (r.data?.error) throw new Error(r.data.message);
      setRenomeando(null);
      setAviso(t('ext.prompts.pasta_renomeada'));
      await carregar();
      setPasta(para.trim() || TODAS_PASTAS);
    } catch (e) {
      setAviso(e?.response?.data?.message || e.message);
    }
  };

  const onTeclaAba = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const prox = (i + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length;
    setCategoria(abas[prox].id);
    abasRef.current[prox]?.focus();
  };

  const cartao = darkMode ? 'bg-white/4 border-white/10 hover:border-white/25' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300';
  const textoSec = darkMode ? 'text-slate-400' : 'text-slate-500';
  const btnSec = `px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`;
  const btnIcone = `p-1.5 rounded-lg border ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`;
  const semProjeto = !projeto;
  const meusVazio = categoria === MEUS && !termo && visiveis.length === 0;

  return (
    <div className="space-y-4">
      {/* Projeto + como usar */}
      <section className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[220px]">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${textoSec}`}>{t('ext.prompts.projeto')}</span>
            <select value={projeto} onChange={(e) => escolherProjeto(e.target.value)} data-campo="projeto"
              className={`rounded-xl border px-3 py-2 text-sm ${BTN_FOCUS} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`}>
              <option value="">{t('ext.prompts.escolha_projeto')}</option>
              {projetos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <p className={`text-xs flex-1 min-w-[240px] flex items-start gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <span><Trans i18nKey="ext.prompts.dica_claude" components={NEGRITO} /></span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEconomia(true)} className={`flex items-center gap-1.5 ${btnSec}`} data-acao="economia">
              <Gauge size={13} aria-hidden="true" /> {t('ext.economia.botao')}
            </button>
            <button onClick={() => setEditando({ titulo: '', descricao: '', pedido: '', pasta: categoria === MEUS && pasta !== TODAS_PASTAS ? pasta : '' })}
              className={`flex items-center gap-1.5 ${btnSec}`} data-acao="novo">
              <Plus size={13} aria-hidden="true" /> {t('ext.prompts.novo')}
            </button>
          </div>
        </div>
        {semProjeto && <p className={`text-xs ${textoSec}`}>{t('ext.prompts.precisa_projeto')}</p>}
      </section>

      {/* Categorias */}
      <div role="tablist" aria-label={t('ext.prompts.categorias')} className={`flex flex-wrap gap-1 border-b ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
        {abas.map((c, i) => (
          <button key={c.id} role="tab" aria-selected={categoria === c.id} tabIndex={categoria === c.id ? 0 : -1}
            ref={(el) => { abasRef.current[i] = el; }}
            onClick={() => setCategoria(c.id)} onKeyDown={(e) => onTeclaAba(e, i)}
            className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${BTN_FOCUS}
              ${categoria === c.id ? 'border-primary text-primary' : `border-transparent ${textoSec} hover:text-primary`}`}>
            {c.nome}
          </button>
        ))}
      </div>

      {/* Busca nos prompts: logo acima dos cartões (dentro da caixa do projeto parecia buscar projetos) */}
      <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:border-primary ${darkMode ? 'bg-white/5 border-white/15' : 'bg-white border-slate-300'}`}>
        <Search size={14} className={textoSec} aria-hidden="true" />
        <span className="sr-only">{t('ext.prompts.buscar')}</span>
        <input type="search" value={busca} onChange={(e) => buscar(e.target.value)} data-campo="busca"
          placeholder={t('ext.prompts.buscar_exemplo')}
          className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${darkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`} />
        {busca && (
          <button onClick={() => setBusca('')} aria-label={t('ext.prompts.limpar_busca')} className={`p-0.5 rounded ${BTN_FOCUS} ${textoSec}`}>
            <X size={14} />
          </button>
        )}
      </label>

      {categoria === MEUS && (pastas.length > 0 || lista.some((p) => p.categoria_id === MEUS)) && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('ext.prompts.pastas')}>
          <Folder size={13} className={textoSec} aria-hidden="true" />
          {[{ id: TODAS_PASTAS, nome: t('ext.prompts.todas_pastas') }, ...pastas.map((x) => ({ id: x, nome: x })), { id: '', nome: t('ext.prompts.sem_pasta') }].map((x) => (
            <button key={`p-${x.id}`} onClick={() => setPasta(x.id)} aria-pressed={pasta === x.id} data-pasta={x.id}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${BTN_FOCUS}
                ${pasta === x.id ? 'bg-primary-button text-white border-transparent' : `${darkMode ? 'border-white/15 text-slate-300 hover:bg-white/8' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}`}>
              {x.nome}
            </button>
          ))}
          {pasta !== TODAS_PASTAS && pasta !== '' && (
            <button onClick={() => setRenomeando({ de: pasta, para: pasta })} data-acao="renomear-pasta"
              aria-label={t('ext.prompts.renomear_pasta_rotulo', { pasta })} title={t('ext.prompts.renomear_pasta')} className={btnIcone}>
              <Pencil size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className={`text-xs min-h-[1rem] ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
        {termo ? (visiveis.length ? t('ext.prompts.n_resultados', { count: visiveis.length }) : t('ext.prompts.nenhum_resultado', { busca: busca.trim() })) : aviso}
      </p>

      {meusVazio && (
        <p className={`text-sm ${textoSec}`}><Trans i18nKey="ext.prompts.meus_vazio" components={NEGRITO} /></p>
      )}

      {/* Cartões */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((p) => {
          const Icone = ICONE_CATEGORIA[p.categoria_id] || BookOpen;
          const meu = p.categoria_id === MEUS;
          return (
            <article key={p.id} className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${cartao}`}>
              <button onClick={() => !semProjeto && setAberto(p)} disabled={semProjeto}
                className={`text-left flex gap-3 items-start rounded-lg ${BTN_FOCUS} disabled:cursor-not-allowed`}
                aria-label={t('ext.prompts.abrir_previa', { titulo: p.titulo })}>
                <span className={`p-2 rounded-xl shrink-0 ${darkMode ? 'bg-primary/15' : 'bg-primary/10'}`}>
                  <Icone size={16} className="text-primary" aria-hidden="true" />
                </span>
                <span>
                  <span className={`block text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{p.titulo}</span>
                  {p.descricao && <span className={`block text-xs mt-0.5 ${textoSec}`}>{p.descricao}</span>}
                  {(p.nivel || p.referencia) && (
                    <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <SeloNivel nivel={p.nivel} darkMode={darkMode} />
                      {p.referencia && (
                        <span className={`text-[10px] italic ${textoSec}`}>{t('ext.prompts.base_curta', { autores: autoresCurto(p.referencia.autores), ano: p.referencia.ano })}</span>
                      )}
                    </span>
                  )}
                  {meu && p.pasta && (
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold ${textoSec}`}>
                      <Folder size={10} aria-hidden="true" /> {p.pasta}
                    </span>
                  )}
                </span>
              </button>
              <div className="flex flex-wrap gap-2 mt-auto items-center">
                <button onClick={() => copiarDireto(p)} disabled={semProjeto} data-acao="copiar"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-button text-white hover:bg-primary-button/85 disabled:opacity-40 disabled:cursor-not-allowed ${BTN_FOCUS}`}>
                  {copiadoId === p.id
                    ? <><Check size={13} aria-hidden="true" /> {t('ext.prompts.copiado')}</>
                    : <><Copy size={13} aria-hidden="true" /> {t('ext.prompts.copiar')}</>}
                </button>
                <button onClick={() => setAberto(p)} disabled={semProjeto} className={btnSec} data-acao="ajustar">{t('ext.prompts.ajustar')}</button>
                <span className="ml-auto flex gap-1.5">
                  {meu ? (
                    <>
                      <button onClick={() => setEditando({ id: p.id, titulo: p.titulo, descricao: p.descricao || '', pedido: p.pedido || '', base: p.base, pasta: p.pasta || '' })}
                        aria-label={t('ext.prompts.editar_rotulo', { titulo: p.titulo })} title={t('ext.prompts.editar')} className={btnIcone} data-acao="editar">
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      <button onClick={() => setExcluindo(p)} aria-label={t('ext.prompts.excluir_rotulo', { titulo: p.titulo })}
                        title={t('ext.prompts.excluir')} className={btnIcone} data-acao="excluir">
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditando({ titulo: t('ext.prompts.minha_versao', { titulo: p.titulo }).slice(0, 80), descricao: p.descricao || '', pedido: p.pedido || '', base: p.id })}
                      aria-label={t('ext.prompts.duplicar_rotulo', { titulo: p.titulo })} title={t('ext.prompts.duplicar')} className={btnIcone} data-acao="duplicar">
                      <CopyPlus size={13} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {aberto && (
        <PreviaPrompt prompt={aberto} projeto={projeto} montar={montar} darkMode={darkMode}
          onFechar={() => setAberto(null)} onCopiado={(extras) => { setUltimoPedido({ id: aberto.id, projeto, extras }); setMostrarCopiado(true); }} />
      )}
      {mostrarCopiado && <AvisoCopiado darkMode={darkMode} onFechar={fecharCopiado} pedido={ultimoPedido} />}
      {economia && <EconomiaTokens darkMode={darkMode} btnFocus={BTN_FOCUS} projetoInicial={projeto} onFechar={() => setEconomia(false)} />}
      {renomeando && (
        <ModalWrapper onClose={() => setRenomeando(null)} label={t('ext.prompts.renomear_pasta')}>
          <form onSubmit={(e) => { e.preventDefault(); renomear(renomeando.de, renomeando.para); }}
            className={`rounded-2xl p-5 max-w-sm w-full shadow-2xl border space-y-3 ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h2 className="text-base font-bold">{t('ext.prompts.renomear_pasta_rotulo', { pasta: renomeando.de })}</h2>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold">{t('ext.prompts.novo_nome_pasta')}</span>
              <input value={renomeando.para} onChange={(e) => setRenomeando({ ...renomeando, para: e.target.value })} maxLength={40} autoFocus
                aria-describedby="dica-renomear" data-campo="nova-pasta"
                className={`rounded-xl border px-3 py-2 text-sm ${BTN_FOCUS} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
            </label>
            <p id="dica-renomear" className={`text-xs ${textoSec}`}>{t('ext.prompts.renomear_dica')}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRenomeando(null)} className={btnSec}>{t('ext.comum.cancelar')}</button>
              <button type="submit" data-acao="salvar-pasta" className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-button text-white hover:bg-primary-button/85 ${BTN_FOCUS}`}>{t('ext.prompts.salvar')}</button>
            </div>
          </form>
        </ModalWrapper>
      )}
      {editando && (
        <EditorPrompt inicial={editando} pastas={pastas} darkMode={darkMode} onFechar={() => setEditando(null)}
          onSalvo={(p) => salvo(t(editando.id ? 'ext.prompts.atualizado' : 'ext.prompts.criado', { titulo: p.titulo }))} />
      )}
      {excluindo && (
        <ModalWrapper onClose={() => setExcluindo(null)} label={t('ext.prompts.excluir_modal')}>
          <div className={`rounded-2xl p-5 max-w-sm w-full shadow-2xl border space-y-3 ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h2 className="text-base font-bold">{t('ext.prompts.excluir_titulo', { titulo: excluindo.titulo })}</h2>
            <p className={`text-xs ${textoSec}`}>{t('ext.prompts.excluir_texto')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExcluindo(null)} className={btnSec}>{t('ext.comum.cancelar')}</button>
              <button onClick={() => excluir(excluindo)} data-acao="confirmar-excluir"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 ${BTN_FOCUS}`}>{t('ext.prompts.excluir')}</button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}

function EditorPrompt({ inicial, pastas = [], darkMode, onFechar, onSalvo }) {
  const { t } = useTranslation();
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [pedido, setPedido] = useState(inicial.pedido);
  const [pasta, setPasta] = useState(inicial.pasta || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const r = await axios.post(`${API_BASE}/prompts/usuario`, { id: inicial.id, base: inicial.base, titulo, descricao, pedido, pasta });
      if (r.data?.error) throw new Error(r.data.message);
      onSalvo(r.data.prompt);
    } catch (err) {
      setErro(err?.response?.data?.message || err.message);
    } finally {
      setSalvando(false);
    }
  };

  const campo = `rounded-xl border px-3 py-2 text-sm ${BTN_FOCUS} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`;
  const sec = darkMode ? 'text-slate-400' : 'text-slate-500';
  const tituloModal = inicial.id ? t('ext.prompts.editar_prompt') : t('ext.prompts.novo');
  return (
    <ModalWrapper onClose={onFechar} label={tituloModal}>
      <form onSubmit={salvar} className={`rounded-2xl p-5 max-w-xl w-full shadow-2xl border space-y-3 ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold">{tituloModal}</h2>
          <button type="button" onClick={onFechar} aria-label={t('ext.comum.fechar')} className={`p-1.5 rounded-lg ${BTN_FOCUS} ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold">{t('ext.prompts.nome')}</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} required className={campo}
            data-campo="titulo" placeholder={t('ext.prompts.nome_exemplo')} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold">{t('ext.prompts.para_que_serve')}</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold">{t('ext.prompts.pasta')}</span>
          <input value={pasta} onChange={(e) => setPasta(e.target.value)} maxLength={40} list="tusab-pastas" className={campo}
            data-campo="pasta" placeholder={t('ext.prompts.pasta_exemplo')} aria-describedby="dica-pasta" />
          <datalist id="tusab-pastas">{pastas.map((x) => <option key={x} value={x} />)}</datalist>
          <span id="dica-pasta" className={`text-[11px] ${sec}`}>{t('ext.prompts.pasta_dica')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold">{t('ext.prompts.o_que_pedir')}</span>
          <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={4000} required rows={7} data-campo="pedido"
            aria-describedby="dica-pedido" className={`${campo} text-xs leading-relaxed`} placeholder={t('ext.prompts.pedido_exemplo')} />
        </label>
        <div id="dica-pedido" className={`text-xs space-y-1 ${sec}`}>
          <p><code>{'{tema_frase}'}</code> {t('ext.prompts.dica_tema')} <code>{'{quantidade}'}</code> {t('ext.prompts.dica_quantidade')}</p>
          <p>{t('ext.prompts.dica_regras')}</p>
        </div>
        <p role="alert" className="text-xs min-h-[1rem] text-red-500">{erro}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onFechar} className={`px-4 py-2 rounded-xl text-xs font-bold border ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-200 hover:bg-white/8' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{t('ext.comum.cancelar')}</button>
          <button type="submit" disabled={salvando} data-acao="salvar" className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary-button text-white hover:bg-primary-button/85 disabled:opacity-50 ${BTN_FOCUS}`}>
            {salvando ? t('ext.prompts.salvando') : t('ext.prompts.salvar')}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function PreviaPrompt({ prompt, projeto, montar, darkMode, onFechar, onCopiado }) {
  const { t } = useTranslation();
  const [tema, setTema] = useState('');
  const [quantidade, setQuantidade] = useState(prompt.quantidade || '');
  const [texto, setTexto] = useState('');
  const [editado, setEditado] = useState(false);
  const [estado, setEstado] = useState('');
  const caixaRef = useRef(null);

  // Remonta o texto quando tema/quantidade mudam (enquanto o usuário não editou à mão).
  useEffect(() => {
    if (editado) return undefined;
    const tm = setTimeout(() => {
      montar(prompt.id, { tema, quantidade }).then(setTexto).catch((e) => setEstado(e.message));
    }, 200);
    return () => clearTimeout(tm);
  }, [tema, quantidade, prompt.id, montar, editado]);

  const copiar = async (fechar) => {
    if (await copiarTexto(texto)) {
      setEstado(t('ext.prompts.copiado_aviso'));
      onCopiado({ tema, quantidade });
      if (fechar) onFechar();
    } else {
      caixaRef.current?.select();
      setEstado(t('ext.prompts.copiar_manual'));
    }
  };

  const campo = `rounded-xl border px-3 py-2 text-sm ${BTN_FOCUS} ${darkMode ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`;
  const campos = prompt.campos || [];
  return (
    <ModalWrapper onClose={onFechar} label={t('ext.prompts.previa_rotulo', { titulo: prompt.titulo })}>
      <div className={`rounded-2xl p-5 max-w-xl w-full shadow-2xl border space-y-3 ${darkMode ? 'bg-[#0C1122] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{prompt.titulo}</h2>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('ext.prompts.projeto_valor', { projeto })}{prompt.descricao ? ` · ${prompt.descricao}` : ''}
            </p>
            {prompt.nivel && (
              <p className={`text-[11px] mt-1.5 flex items-start gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <SeloNivel nivel={prompt.nivel} darkMode={darkMode} /> <span>{t(`ext.nivel.${prompt.nivel}_dica`)}</span>
              </p>
            )}
            {prompt.referencia && (
              <p className={`text-[11px] mt-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} data-campo="referencia">
                <strong>{t('ext.prompts.base_titulo')}</strong> {prompt.referencia.autores} ({prompt.referencia.ano}). <em>{prompt.referencia.obra}</em>
                {prompt.referencia.pratica ? ` ${prompt.referencia.pratica}` : ''}
              </p>
            )}
          </div>
          <button onClick={onFechar} aria-label={t('ext.comum.fechar')} className={`p-1.5 rounded-lg ${BTN_FOCUS} ${darkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {campos.includes('tema') && (
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[11px] font-bold">{t('ext.prompts.tema')}</span>
              <input value={tema} onChange={(e) => { setTema(e.target.value); setEditado(false); }} className={campo}
                data-campo="tema" placeholder={t('ext.prompts.tema_exemplo')} />
            </label>
          )}
          {campos.includes('quantidade') && (
            <label className="flex flex-col gap-1 w-28">
              <span className="text-[11px] font-bold">{t('ext.prompts.quantidade')}</span>
              <input type="number" min="1" max="50" value={quantidade} onChange={(e) => { setQuantidade(e.target.value); setEditado(false); }} className={campo} />
            </label>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold">{t('ext.prompts.texto_pedido')}</span>
          <textarea ref={caixaRef} value={texto} onChange={(e) => { setTexto(e.target.value); setEditado(true); }}
            rows={8} className={`${campo} text-xs leading-relaxed`} data-campo="texto" />
        </label>
        <p role="status" aria-live="polite" className={`text-xs min-h-[1rem] ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{estado}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => copiar(false)} className={`px-4 py-2 rounded-xl text-xs font-bold border ${BTN_FOCUS} ${darkMode ? 'border-white/15 text-slate-200 hover:bg-white/8' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{t('ext.prompts.copiar')}</button>
          <button onClick={() => copiar(true)} className={`px-4 py-2 rounded-xl text-xs font-bold bg-primary-button text-white hover:bg-primary-button/85 ${BTN_FOCUS}`}>{t('ext.prompts.copiar_fechar')}</button>
        </div>
      </div>
    </ModalWrapper>
  );
}

/**
 * Botão "Pedir à IA" de um projeto do Repositório: um menu curto com os pedidos mais comuns
 * (copia direto) e "Ver todos os prompts" (abre a aba de prompts já neste projeto).
 * O menu abre por cima da página (portal), porque o cartão do projeto corta o que passa da borda.
 */
export function PedirIA({ projeto, darkMode }) {
  const { t, i18n } = useTranslation();
  const [pos, setPos] = useState(null); // menu aberto = posição calculada
  const [atalhos, setAtalhos] = useState([]);
  const [idiomaAtalhos, setIdiomaAtalhos] = useState('');
  const [previa, setPrevia] = useState(null);
  const [estado, setEstado] = useState('');
  const [mostrarCopiado, setMostrarCopiado] = useState(false);
  const [ultimoPedido, setUltimoPedido] = useState(null);
  const fecharCopiado = useCallback(() => setMostrarCopiado(false), []);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);
  const itensRef = useRef([]);
  const aberto = !!pos;

  const posicao = () => {
    const r = botaoRef.current.getBoundingClientRect();
    return { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) };
  };

  useEffect(() => {
    if (!aberto) return undefined;
    if (idiomaAtalhos !== i18n.resolvedLanguage) {
      axios.get(`${API_BASE}/prompts`).then((r) => {
        const todos = r.data?.prompts || [];
        setAtalhos(ATALHOS.map((id) => todos.find((p) => p.id === id)).filter(Boolean));
        setIdiomaAtalhos(i18n.resolvedLanguage);
      }).catch(() => setEstado(t('ext.prompts.erro_carregar')));
    }
    const fora = (e) => {
      if (!menuRef.current?.contains(e.target) && !botaoRef.current?.contains(e.target)) setPos(null);
    };
    const fechar = () => setPos(null);
    document.addEventListener('mousedown', fora);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [aberto, idiomaAtalhos, i18n.resolvedLanguage, t]);

  useEffect(() => { if (aberto) itensRef.current[0]?.focus(); }, [aberto, atalhos.length]);

  const fecharMenu = () => { setPos(null); botaoRef.current?.focus(); };

  const onTecla = (e) => {
    const itens = itensRef.current.filter(Boolean);
    const i = itens.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); fecharMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); itens[(i + 1) % itens.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); itens[(i - 1 + itens.length) % itens.length]?.focus(); }
    else if (e.key === 'Tab') setPos(null);
  };

  const copiar = async (p) => {
    fecharMenu();
    try {
      const pedido = montarPedido(p.id, projeto); // a cópia começa no clique (Safari)
      const ok = await copiarTexto(pedido);
      await pedido;
      if (ok) {
        setEstado(t('ext.pedir.copiado', { titulo: p.titulo }));
        setUltimoPedido({ id: p.id, projeto, extras: {} });
        setMostrarCopiado(true);
      } else setPrevia(p); // sem permissão de área de transferência: abre a prévia
    } catch (e) {
      setEstado(e.message);
    }
  };

  const montar = useCallback((id, extras) => montarPedido(id, projeto, extras), [projeto]);
  const item = `w-full text-left px-3 py-2 text-xs rounded-lg outline-none ${darkMode ? 'text-slate-200 hover:bg-white/10 focus:bg-white/10' : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'}`;

  return (
    <>
      <button ref={botaoRef} type="button" onClick={(e) => { e.stopPropagation(); setPos(aberto ? null : posicao()); }}
        aria-haspopup="menu" aria-expanded={aberto} data-acao="pedir-ia"
        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary-button text-white hover:bg-primary-button/85 ${BTN_FOCUS}`}>
        <Sparkles size={12} aria-hidden="true" /> {t('ext.pedir.botao')} <ChevronDown size={11} aria-hidden="true" />
      </button>
      <span role="status" aria-live="polite" className="sr-only">{estado}</span>
      {aberto && createPortal(
        <div ref={menuRef} role="menu" aria-label={t('ext.pedir.menu', { projeto })} onKeyDown={onTecla}
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
          className={`z-[9998] w-64 rounded-xl border p-1 shadow-xl ${darkMode ? 'bg-[#0C1122] border-white/15' : 'bg-white border-slate-200'}`}>
          <p className={`px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('ext.pedir.copiar_pedido')}</p>
          {atalhos.map((p, i) => (
            <button key={p.id} role="menuitem" tabIndex={-1} ref={(el) => { itensRef.current[i] = el; }}
              onClick={() => copiar(p)} className={item}>{p.titulo}</button>
          ))}
          <div className={`my-1 border-t ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />
          <button role="menuitem" tabIndex={-1} ref={(el) => { itensRef.current[atalhos.length] = el; }} data-acao="ver-todos"
            onClick={() => { setPos(null); abrirPromptsDoProjeto(projeto); }} className={`${item} font-bold text-primary`}>
            {t('ext.pedir.ver_todos')}
          </button>
        </div>,
        document.body,
      )}
      {mostrarCopiado && <AvisoCopiado darkMode={darkMode} onFechar={fecharCopiado} pedido={ultimoPedido} />}
      {previa && (
        <PreviaPrompt prompt={previa} projeto={projeto} montar={montar} darkMode={darkMode}
          onFechar={() => setPrevia(null)} onCopiado={(extras) => { setUltimoPedido({ id: previa.id, projeto, extras }); setMostrarCopiado(true); }} />
      )}
    </>
  );
}
