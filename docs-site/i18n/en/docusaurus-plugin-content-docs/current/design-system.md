---
id: design-system
title: Design System
sidebar_label: Design System
slug: /design-system
---

# Design System

The source of truth for Tusab's design is **the production code** (`web_interface/src/`) — not Figma, not this document. Divergence between them is a documentation bug to fix, not a design option.

## Principles

1. **Dark-first** — dark theme is primary (`darkMode: 'class'` in Tailwind); light is derived, every component ships with both states.
2. **Compact density** — Tusab is a work tool, not a marketing site. The type scale runs below typical web defaults (12px body text).
3. **Accessibility is foundation, not a layer** — universal focus ring, `prefers-reduced-motion`, documented contrast, mandatory `aria-*` on interactive elements.
4. **Tokens before values** — color always via a semantic token, never a loose hex value in a component.

## Colors

| Token | Value | Use |
|-------|-------|-----|
| `primary` | `#1558B0` (light) / `#4B9FE8` (dark) | Primary action, links, focus, selection |
| `secondary` | `#10B981` (emerald) | Success, active/connected states |
| `accent` | `#06B6D4` (cyan) | Informational highlights |
| `warning` | `#F59E0B` (amber) | Updates, non-destructive alerts |
| `danger` | `#EF4444` (red) | Errors, destructive actions |
| `muted` | `#64748B` (slate-500) | Supporting text, inactive icons |

Dark surfaces use white at reduced opacity (`bg-white/4` to `bg-white/10`) instead of a fixed gray scale — the dominant pattern measured in the code.

## Typography

Families: **Inter** (sans, body) and **JetBrains Mono** (mono — versions, IDs, model names).

Real scale: `text-xs` (12px) is the standard body size; `text-[10px]` for support/caption text; `text-sm` (14px) only for main section headings. The scale has six steps — don't introduce intermediate sizes outside it.

## Border radius

`rounded-2xl` for cards and sections · `rounded-xl` for controls (buttons, inputs) · `rounded-lg` for list items · `rounded-full` for pills, badges, and toggles.

## Standard components

Every modal uses `ModalWrapper.jsx` — never a custom implementation. `createPortal(modal, document.body)` always with the explicit second argument; z-index always via prop, never inherited from a parent wrapper (the portal ignores that context).

## Motion

Global 150ms transition (`cubic-bezier(0.4,0,0.2,1)`) on color/opacity/shadow/transform. Enter/exit via Framer Motion (`AnimatePresence`). `prefers-reduced-motion` is respected globally and never overridden by a component.

## Known anti-patterns

| Never | Why |
|-------|---------|
| `createPortal` without `document.body` | React crash (error #299) |
| z-index on a parent div of a component with its own portal/`fixed` | Ignored by the browser |
| `autoFocus` on a `#root` element with a modal that sets `aria-hidden` | Silent flow lockup |
| Loose hex value in a component | Always a token; dark surfaces via `white/N` |
| Font size outside the six-step scale | Rethink the hierarchy instead of creating an intermediate step |
| Interactive element without the focus pattern (`BTN_FOCUS`) | Breaks WCAG 2.4.7 |

## Figma library

A v1 library (Light/Dark tokens, text styles, 5 atoms, Feedback, Shell/NavItem) mirrors the published code. A complete v2 (chat kit, modal template, forms) is planned for when the design workflow starts actively consuming the library.
