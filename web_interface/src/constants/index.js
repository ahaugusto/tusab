/**
 * @file index.js
 * @description Application-wide constants and configuration
 * @module constants
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */

// ─── API ─────────────────────────────────────────────────────────────────────

/** Base URL for the FastAPI backend */
export const API_BASE = "http://localhost:8001";

// ─── UI ──────────────────────────────────────────────────────────────────────

/** Available UI languages */
export const LANGS = ['pt', 'en', 'es'];

/** Tailwind focus-visible ring class reused across interactive elements */
export const BTN_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';
