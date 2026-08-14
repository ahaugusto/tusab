/**
 * @file locale.js
 * @description Maps the active i18n language to a BCP-47 locale for Intl/toLocaleDateString calls
 * @module utils/locale
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */

/**
 * localeFor — resolves the i18next language code to the matching locale used
 * by toLocaleDateString/toLocaleTimeString/toLocaleString. Falls back to
 * pt-BR (the default UI language) when lang is unset or unrecognized.
 *
 * @param {string} lang - i18next language code (e.g. 'pt', 'en', 'es')
 * @returns {string} BCP-47 locale ('pt-BR' | 'en-US' | 'es-ES')
 */
export function localeFor(lang) {
  return lang?.startsWith('en') ? 'en-US' : lang?.startsWith('es') ? 'es-ES' : 'pt-BR';
}
