/**
 * @file useOnboarding.js
 * @description Hook for contextual onboarding — tracks which features the user
 *   has seen and provides helpers to mark them as visited.
 *   State persists in localStorage so hints only show once.
 * @module hooks/useOnboarding
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import { useState, useCallback } from 'react';

// ─── Feature keys ────────────────────────────────────────────────────────────

const KEYS = {
  repositorio:     'tusab_onb_repositorio',
  relatorio:       'tusab_onb_relatorio',
  chatFirstSend:   'tusab_onb_chat_first',
  indexDone:       'tusab_onb_index_done',
  docAdded:        'tusab_onb_doc_added',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useOnboarding — manages contextual hint state per feature
 *
 * @returns {{
 *   seen: (key: string) => boolean,
 *   markSeen: (key: string) => void,
 *   KEYS: Object
 * }}
 */
export function useOnboarding() {
  const [, forceUpdate] = useState(0);

  /** Returns true if the user has already seen this feature hint */
  const seen = useCallback((key) => {
    return localStorage.getItem(key) === '1';
  }, []);

  /** Marks a feature hint as seen — persists across sessions */
  const markSeen = useCallback((key) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      forceUpdate(n => n + 1);
    }
  }, []);

  return { seen, markSeen, KEYS };
}
