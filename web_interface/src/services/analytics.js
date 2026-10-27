/**
 * @file analytics.js
 * @description Microsoft Clarity analytics service — opt-in only.
 *   All tracking is gated behind explicit user consent stored in localStorage.
 *   If no consent or no API key, every call is a no-op.
 * @module services/analytics
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */

// ─── Constants ───────────────────────────────────────────────────────────────

// Chave nova (v1.0.63): a telemetria passou do PostHog para o Microsoft Clarity,
// que também grava interação (cliques, rolagem). Quem aceitou a anterior é
// consultado de novo — o consentimento antigo não cobria esse tipo de coleta.
const CONSENT_KEY = 'tusab_clarity_consent'; // 'yes' | 'no' | null
// ID do projeto Clarity — identificador público (aparece no script de qualquer site), não é segredo.
const CLARITY_ID  = import.meta.env.VITE_CLARITY_ID || 'z41cjpv40n';
const PERFIL_KEY  = 'tusab_perfil';

// ─── State ────────────────────────────────────────────────────────────────────

let _clarity   = null;
let _consented = localStorage.getItem(CONSENT_KEY) === 'yes';
// Eventos disparados enquanto o SDK (import dinâmico) ainda carrega.
let _queue     = [];
const QUEUE_MAX = 50;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialises Microsoft Clarity if consent was previously given.
 * Safe to call multiple times — only initialises once.
 * Mascaramento estrito: todo o conteúdo da tela (chat, documentos, chaves de API)
 * é mascarado no cliente antes de sair — só estrutura, cliques e rolagem são gravados.
 */
export function initAnalytics() {
  if (!CLARITY_ID || !_consented || _clarity) return;
  document.body.setAttribute('data-clarity-mask', 'True');
  import('@microsoft/clarity').then(({ default: Clarity }) => {
    if (!_consented) return;
    Clarity.init(CLARITY_ID);
    Clarity.consentV2({ ad_Storage: 'denied', analytics_Storage: 'granted' });
    try { Clarity.setTag('perfil', localStorage.getItem(PERFIL_KEY) || 'nenhum'); } catch {}
    _clarity = Clarity;
    const pendentes = _queue; _queue = [];
    pendentes.forEach(([event]) => { try { Clarity.event(event); } catch {} });
  }).catch(() => {});
}

// ─── Consent ──────────────────────────────────────────────────────────────────

/** Returns current consent status: 'yes' | 'no' | null */
export function getConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

/** User accepted analytics — initialise and begin tracking */
export function acceptAnalytics() {
  localStorage.setItem(CONSENT_KEY, 'yes');
  _consented = true;
  initAnalytics();
  track('analytics_accepted');
}

/** User declined analytics — ensure nothing is tracked */
export function declineAnalytics() {
  localStorage.setItem(CONSENT_KEY, 'no');
  _consented = false;
  _queue = [];
  if (_clarity) { try { _clarity.consent(false); } catch {} _clarity = null; }
  document.body.removeAttribute('data-clarity-mask');
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Registra um evento nomeado. O Clarity guarda só o nome (sem propriedades);
 * o que antes ia em `props` fica de fora de propósito — menos dado, mesma contagem.
 * No-op se o usuário não consentiu.
 *
 * @param {string} event      - event name (snake_case)
 * @param {Object} [props={}] - ignorado (mantido para compatibilidade das chamadas)
 */
export function track(event, props = {}) {
  if (!_consented) return;
  if (!_clarity) {
    if (_queue.length < QUEUE_MAX) _queue.push([event]);
    return;
  }
  try { _clarity.event(event); } catch {}
}

// ─── Named events (keeps event names consistent across the codebase) ─────────

export const Analytics = {
  appOpened:            ()                    => track('app_opened'),
  canalConfigurado:     ()                    => track('canal_configurado'),
  extracaoIniciada:     (tipos)               => track('extracao_iniciada', { tipos }),
  extracaoConcluida:    (stats)               => track('extracao_concluida', stats),
  documentoAdicionado:  (tipo)                => track('documento_adicionado', { tipo }),
  baseIndexada:         (chunks)              => track('base_indexada', { chunks }),
  chatPergunta:         (modo, prov)          => track('chat_pergunta', { modo, provider: prov }),
  provedorConfigurado:  (prov)                => track('provedor_configurado', { provider: prov }),
  repositorioAcessado:  ()                    => track('repositorio_acessado'),
  relatorioAcessado:    ()                    => track('relatorio_acessado'),
  buscaAmplaToggled:    (ativo)               => track('busca_ampla_toggled', { ativo }),
  // A2 — KPI de ativação real: resposta com fontes (não erro, não "não encontrei")
  primeiraRespostaUtil: (minutos, provider)   => track('primeira_resposta_util', { minutos_desde_install: minutos, provider }),
  // A3 — retenção: disparado quando o usuário cruza 1, 7 ou 30 dias
  retencaoDia:          (dia, dias_total)     => track(`retencao_dia${dia}`, { dias_desde_install: dias_total }),
  // D1 — funil do Drive: responde "que % de quem usa Drive nunca usa o chat?"
  // (decisão estratégica jul/2026: medir antes de reposicionar o Drive sync)
  driveAuthIniciada:    ()                    => track('drive_auth_iniciada'),
  driveAuthConcluida:   ()                    => track('drive_auth_concluida'),
  driveDesconectado:    ()                    => track('drive_desconectado'),
};
