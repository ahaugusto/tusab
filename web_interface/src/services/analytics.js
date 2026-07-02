/**
 * @file analytics.js
 * @description Posthog analytics service — opt-in only.
 *   All tracking is gated behind explicit user consent stored in localStorage.
 *   If no consent or no API key, every call is a no-op.
 * @module services/analytics
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const CONSENT_KEY  = 'tusab_analytics_consent'; // 'yes' | 'no' | null
const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = 'https://app.posthog.com';

// ─── State ────────────────────────────────────────────────────────────────────

let _posthog   = null;
let _consented = localStorage.getItem(CONSENT_KEY) === 'yes';

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialises Posthog if consent was previously given and a key exists.
 * Safe to call multiple times — only initialises once.
 */
export function initAnalytics() {
  if (!POSTHOG_KEY || !_consented || _posthog) return;
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host:            POSTHOG_HOST,
      autocapture:         false,   // manual events only
      capture_pageview:    false,
      persistence:         'localStorage',
      disable_session_recording: true,
    });
    _posthog = posthog;
  });
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
  if (_posthog) { _posthog.opt_out_capturing(); _posthog = null; }
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Captures a named event with optional properties.
 * No-op if user hasn't consented or Posthog isn't initialised.
 *
 * @param {string} event      - event name (snake_case)
 * @param {Object} [props={}] - additional properties
 */
export function track(event, props = {}) {
  if (!_consented || !_posthog) return;
  try { _posthog.capture(event, props); } catch {}
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
