---
id: acessibilidade
title: Accessibility
sidebar_label: Accessibility
slug: /acessibilidade
---

# Accessibility

Interface audited against **WCAG 2.1 level AA**.

## Compliance by area

| Area | Status |
|------|--------|
| Semantic HTML structure | ✅ Compliant |
| Visible focus and keyboard navigation | ✅ Compliant (global via `index.css`) |
| `prefers-reduced-motion` | ✅ Compliant (respected globally) |
| Modals with focus trap, `aria-modal`, background isolation | ✅ Compliant (`ModalWrapper.jsx`) |
| Skip-nav link | ✅ Compliant |
| `lang` on the HTML element | ✅ Compliant (`pt-BR`) |
| Text contrast (AA) | ⚠️ Mostly compliant — exceptions under ongoing fixes |
| `aria-live` for dynamic content | ⚠️ Partial — still evolving |

## Implementation decisions

**Global visible focus** — `:focus-visible` with a 2px ring in the primary color, applied via the `BTN_FOCUS` constant on every interactive button.

**`prefers-reduced-motion`** — every animation (Framer Motion) is reduced to 0.01ms durations when the operating system signals the preference.

**Modals** — `ModalWrapper.jsx` implements `role="dialog"`, `aria-modal="true"`, mandatory `aria-label`, automatic focus trap, rendering via `ReactDOM.createPortal` (outside `#root`), `aria-hidden="true"` on `#root` while the modal is open, and focus restoration to the previous element on close.

## Keyboard shortcuts

| Key | macOS alternative | Action |
|-----|--------------------|--------|
| `Shift + C` | `⌘ + C` | Open chat |
| `Esc` | `Esc` | Close chat / collapse expanded chat / back to Home |
| `<` / `>` (with chat open) | `<` / `>` | Expand / collapse the side chat |
| `Shift + B` | `⌘ + B` | Repository tab |
| `Shift + E` | `⌘ + E` | Extraction tab |
| `Shift + A` | `⌘ + A` | Admin tab |
| `Shift + I` | `⌘ + I` | Assistant tab |
| `Shift + M` | — | Monitor tab |
| `Shift + V` | `⌘ + V` | Overview |
| `Shift + H` | — | History |
| `Shift + U` | `⌘ + U` | Study tab |
| `Shift + R` | — | Report sub-tab (inside Extraction) |

All `Shift` shortcuts are automatically disabled while a text field has focus, so they don't interfere with typing — on any system.

On macOS, most shortcuts also accept `⌘` (Cmd) as a native alternative — `Shift` still works the same way, `⌘` is just an added option. **Three exceptions stay `Shift`-only even on Mac**: Monitor, History and Report use letters (`M`, `H`, `R`) that collide with system-level or Electron menu shortcuts (Minimize, Hide app, Reload) — those intercept the key before the app can ever see it, so `⌘` could never work reliably for these three.

## WCAG 2.1 AA checklist — summary by principle

**Perceivable** — non-text content mostly has `aria-label`; minimum 4.5:1 contrast verified on the main components (with a few exceptions under fixing); text resizable via relative units; no text-as-images.

**Operable** — 100% keyboard-navigable, no focus trap outside modals, skip-nav present, focus order = DOM order, focus always visible (`BTN_FOCUS` + global CSS).

**Understandable** — page language declared (`lang="pt-BR"`), i18n via `react-i18next`, context changes always triggered by an explicit user action, errors identified with a text message.

**Robust** — JSX compiled into valid HTML; most interactive components use the correct `role` (`switch`, `dialog`, `alert`, `status`).

## Tools used in audits

- **axe DevTools** — automated scanning (Chrome/Firefox)
- **NVDA** (Windows) — testing with the free screen reader
- **Colour Contrast Analyser** — contrast measurement
- **axe-core** via Jest (`@axe-core/react`) — automated tests

The complete list of findings, with file and line, is kept in the repository at `Documentação do Produto/Acessibilidade e WCAG.md`, updated at every significant release.
