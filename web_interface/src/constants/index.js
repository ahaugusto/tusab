/**
 * @file index.js
 * @description Application-wide constants and configuration
 * @module constants
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Modo extensão: a interface é servida pelo plugin MCP do Tusab (tusab-mcp),
 * que responde às mesmas rotas em /api no próprio endereço local da página.
 * Ativado só no build da extensão (VITE_TUSAB_MODO=extensao).
 */
export const MODO_EXTENSAO = import.meta.env.VITE_TUSAB_MODO === 'extensao';

/**
 * Base URL for the FastAPI backend.
 * In Electron or production builds, uses absolute URL.
 * In Vite dev server, uses empty string so requests go through the proxy.
 */
export const API_BASE = MODO_EXTENSAO ? '/api' : (
  typeof window !== 'undefined' && window.tusab
    ? 'http://localhost:8001'          // Electron context — direct call
    : import.meta.env.DEV
      ? ''                             // Vite dev — proxy handles routing
      : 'http://localhost:8001'        // production build loaded in browser
);

// ─── UI ──────────────────────────────────────────────────────────────────────

/** Available UI languages */
export const LANGS = ['pt', 'en', 'es'];

/** Tailwind focus-visible ring class reused across interactive elements */
export const BTN_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
