/**
 * @file ModalWrapper.jsx
 * @description Accessible modal backdrop with focus trap, Escape-to-close and
 *   aria-hidden on #root (screen readers see only the modal while it's open).
 *   Renders into document.body via createPortal so the #root isolation works.
 * @module components/shared/ModalWrapper
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Tracks how many ModalWrapper instances are currently mounted.
// We only toggle aria-hidden on #root when going 0→1 (first modal opens)
// and 1→0 (last modal closes). Nested modals are handled correctly.
let openCount = 0;

/**
 * ModalWrapper — portal + focus trap + Escape handler + screen-reader isolation
 *
 * @param {Object}   props
 * @param {Function} props.onClose          - called on Escape or backdrop click
 * @param {React.ReactNode} props.children  - modal card content
 * @param {boolean}  [props.disableEscape]  - prevent Escape from closing
 * @param {boolean}  [props.disableBackdrop]- prevent backdrop click from closing
 * @param {string}   [props.zIndex='z-40']  - Tailwind z-index class
 * @param {string}   [props.backdrop='bg-black/75'] - Tailwind backdrop colour class
 * @param {string}   [props.label]          - aria-label for the dialog region
 */
function ModalWrapper({
  onClose,
  children,
  disableEscape   = false,
  disableBackdrop = false,
  zIndex          = 'z-40',
  backdrop        = 'bg-black/75',
  label,
}) {
  const dialogRef = useRef(null);
  const prevFocus = useRef(null);

  // On mount: save focused element, hide #root from screen readers
  useEffect(() => {
    prevFocus.current = document.activeElement;
    openCount += 1;
    if (openCount === 1) {
      const root = document.getElementById('root');
      if (root) root.setAttribute('aria-hidden', 'true');
    }
    return () => {
      openCount -= 1;
      if (openCount === 0) {
        const root = document.getElementById('root');
        if (root) root.removeAttribute('aria-hidden');
      }
      prevFocus.current?.focus();
    };
  }, []);

  // Auto-focus first focusable element inside the dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelector(FOCUSABLE);
    first?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    if (disableEscape) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, disableEscape]);

  // Tab key focus trap — keeps Tab cycling inside the dialog
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = [...el.querySelectorAll(FOCUSABLE)].filter(f => !f.disabled);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  };

  const handleBackdropClick = (e) => {
    if (!disableBackdrop && e.target === e.currentTarget) onClose();
  };

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${zIndex} ${backdrop} flex items-center justify-center p-4`}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}
      >
        {children}
      </div>
    </motion.div>
  );

  // Render into document.body (outside #root) so aria-hidden on #root
  // does not accidentally hide the modal itself from screen readers.
  return createPortal(modal, document.body);
}

export default ModalWrapper;
