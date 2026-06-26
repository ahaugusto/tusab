/**
 * @file useAriaHidden.js
 * @description Hook that hides #root from screen readers while a modal is open.
 *   Call inside any modal component that does NOT use ModalWrapper.
 *   ModalWrapper already handles this natively; do not use both together.
 */
import { useEffect } from 'react';

let count = 0;

export function useAriaHidden(active = true) {
  useEffect(() => {
    if (!active) return;
    count += 1;
    if (count === 1) {
      const root = document.getElementById('root');
      if (root) root.setAttribute('aria-hidden', 'true');
    }
    return () => {
      count -= 1;
      if (count === 0) {
        const root = document.getElementById('root');
        if (root) root.removeAttribute('aria-hidden');
      }
    };
  }, [active]);
}
