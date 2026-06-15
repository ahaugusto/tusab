/**
 * @file ModalWrapper.jsx
 * @description Accessible modal backdrop with focus trap and Escape-to-close.
 *   Drop-in replacement for the `fixed inset-0 … bg-black/75` outer div used
 *   across all modal components.
 * @module components/shared/ModalWrapper
 * @author CriAugu <augusto.brasil@saude.gov.br>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * ModalWrapper — backdrop + focus trap + Escape handler
 *
 * @param {Object}   props
 * @param {Function} props.onClose          - called on Escape or backdrop click
 * @param {React.ReactNode} props.children  - modal card content (animated inner div)
 * @param {boolean}  [props.disableEscape]  - prevent Escape from closing (required consent)
 * @param {boolean}  [props.disableBackdrop]- prevent backdrop click from closing
 * @param {string}   [props.zIndex='z-40']  - Tailwind z-index class
 * @param {string}   [props.backdrop='bg-black/75'] - Tailwind backdrop colour class
 * @param {string}   [props.label]          - aria-label for the dialog region
 * @returns {JSX.Element}
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
  const dialogRef  = useRef(null);
  const prevFocus  = useRef(null);

  // Save focus on mount; restore on unmount
  useEffect(() => {
    prevFocus.current = document.activeElement;
    return () => prevFocus.current?.focus();
  }, []);

  // Auto-focus first focusable element
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

  // Tab key focus trap
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${zIndex} ${backdrop} flex items-center justify-center p-4`}
      onClick={handleBackdropClick}
      aria-hidden="true"
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
}

export default ModalWrapper;
