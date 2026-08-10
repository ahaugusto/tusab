---
id: design-system
title: Design System
sidebar_label: Design System
slug: /design-system
---

# Design System

A fonte de verdade do design do Tusab é **o código em produção** (`web_interface/src/`) — não o Figma, não este documento. Divergência entre eles é bug de documentação a corrigir, não uma opção de design.

## Princípios

1. **Dark-first** — o tema escuro é o principal (`darkMode: 'class'` no Tailwind); o light é derivado, todo componente nasce com os dois estados.
2. **Densidade compacta** — o Tusab é ferramenta de trabalho, não um site institucional. A escala tipográfica opera abaixo do padrão web (corpo em 12px).
3. **Acessibilidade é fundação, não camada** — focus ring universal, `prefers-reduced-motion`, contraste documentado, `aria-*` obrigatório em interativos.
4. **Tokens antes de valores** — cor sempre via token semântico, nunca hex solto em componente.

## Cores

| Token | Valor | Uso |
|-------|-------|-----|
| `primary` | `#1558B0` (light) / `#4B9FE8` (dark) | Ação principal, links, foco, seleção |
| `secondary` | `#10B981` (emerald) | Sucesso, estados ativo/conectado |
| `accent` | `#06B6D4` (cyan) | Destaques informativos |
| `warning` | `#F59E0B` (amber) | Atualizações, alertas não-destrutivos |
| `danger` | `#EF4444` (red) | Erros, ações destrutivas |
| `muted` | `#64748B` (slate-500) | Texto de apoio, ícones inativos |

Superfícies dark usam branco em opacidade (`bg-white/4` a `bg-white/10`) em vez de uma escala de cinzas fixa — padrão dominante medido no código.

## Tipografia

Famílias: **Inter** (sans, corpo) e **JetBrains Mono** (mono — versões, IDs, nomes de modelo).

Escala real: `text-xs` (12px) é o corpo padrão; `text-[10px]` para apoio/caption; `text-sm` (14px) só para títulos de seção principal. A escala tem seis degraus — não introduzir tamanhos intermediários fora dela.

## Raio de borda

`rounded-2xl` para cards e seções · `rounded-xl` para controles (botões, inputs) · `rounded-lg` para itens de lista · `rounded-full` para pills, badges e toggles.

## Componentes padrão

Todo modal usa `ModalWrapper.jsx` — nunca implementação própria. `createPortal(modal, document.body)` sempre com o segundo argumento explícito; z-index sempre via prop, nunca herdado de um wrapper pai (o portal ignora esse contexto).

## Motion

Transição global de 150ms (`cubic-bezier(0.4,0,0.2,1)`) em cor/opacidade/sombra/transform. Entradas/saídas via Framer Motion (`AnimatePresence`). `prefers-reduced-motion` é respeitado globalmente e nunca sobrescrito por componente.

## Anti-padrões conhecidos

| Nunca | Por quê |
|-------|---------|
| `createPortal` sem `document.body` | Crash do React (erro #299) |
| z-index em div pai de componente com portal/`fixed` próprio | Ignorado pelo navegador |
| `autoFocus` em elemento do `#root` com modal que seta `aria-hidden` | Trava silenciosa de fluxo |
| Hex solto em componente | Sempre token; superfícies dark via `white/N` |
| Tamanho de fonte fora da escala de seis degraus | Repensar a hierarquia em vez de criar um intermediário |
| Interativo sem o padrão de foco (`BTN_FOCUS`) | Quebra WCAG 2.4.7 |

## Biblioteca Figma

Uma biblioteca v1 (tokens Light/Dark, text styles, 5 átomos, Feedback, Shell/NavItem) espelha o código publicado. Uma v2 completa (chat kit, modal template, formulários) está planejada para quando o fluxo de design passar a consumir a biblioteca ativamente.
