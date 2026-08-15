---
id: acessibilidade
title: Acessibilidade
sidebar_label: Acessibilidade
slug: /acessibilidade
---

# Acessibilidade

Interface auditada contra **WCAG 2.1 nível AA**.

## Conformidade por área

| Área | Status |
|------|--------|
| Estrutura HTML semântica | ✅ Conforme |
| Foco visível e navegação por teclado | ✅ Conforme (global via `index.css`) |
| `prefers-reduced-motion` | ✅ Conforme (respeitado globalmente) |
| Modais com trap de foco, `aria-modal`, isolamento do fundo | ✅ Conforme (`ModalWrapper.jsx`) |
| Skip-nav link | ✅ Conforme |
| `lang` no HTML | ✅ Conforme (`pt-BR`) |
| Contraste de texto (AA) | ⚠️ Maioria conforme — exceções em correção contínua |
| `aria-live` para conteúdo dinâmico | ⚠️ Parcial — segue em evolução |

## Decisões de implementação

**Foco visível global** — `:focus-visible` com anel de 2px na cor primária, aplicado via constante `BTN_FOCUS` em todo botão interativo.

**`prefers-reduced-motion`** — todas as animações (Framer Motion) são reduzidas para durações de 0.01ms quando o sistema operacional sinaliza a preferência.

**Modais** — `ModalWrapper.jsx` implementa `role="dialog"`, `aria-modal="true"`, `aria-label` obrigatório, trap de foco automático, renderização via `ReactDOM.createPortal` (fora do `#root`), `aria-hidden="true"` no `#root` enquanto a modal está aberta, e restauração de foco ao elemento anterior ao fechar.

## Atalhos de teclado

| Tecla | Alternativa no macOS | Ação |
|-------|----------------------|------|
| `Shift + C` | `⌘ + C` | Abrir chat |
| `Esc` | `Esc` | Fechar chat / colapsar chat expandido / voltar à Home |
| `<` / `>` (com chat aberto) | `<` / `>` | Expandir / recolher chat lateral |
| `Shift + B` | `⌘ + B` | Aba Repositório |
| `Shift + E` | `⌘ + E` | Aba Extração |
| `Shift + A` | `⌘ + A` | Aba Admin |
| `Shift + I` | `⌘ + I` | Aba Assistente |
| `Shift + M` | — | Aba Monitor |
| `Shift + V` | `⌘ + V` | Visão Geral |
| `Shift + H` | — | Histórico |
| `Shift + U` | `⌘ + U` | Aba Estudo |
| `Shift + R` | — | Sub-aba Relatório (dentro de Extração) |

Todos os atalhos com `Shift` são desativados automaticamente enquanto o foco está num campo de texto, para não interferir com a digitação — em qualquer sistema.

No macOS, a maioria dos atalhos também aceita `⌘` (Cmd) como alternativa nativa — `Shift` continua funcionando igual, `⌘` é só uma opção a mais. **Três exceções ficam só em `Shift + tecla`, mesmo no Mac**: Monitor, Histórico e Relatório usam letras (`M`, `H`, `R`) que colidem com atalhos do próprio sistema operacional ou do menu do Electron (Minimizar, Ocultar app, Recarregar) — esses interceptam a tecla antes que o app consiga reconhecer o atalho, então usar `⌘` nesses três casos nunca funcionaria de forma confiável.

## Checklist WCAG 2.1 AA — resumo por princípio

**Perceptível** — conteúdo não-textual majoritariamente com `aria-label`; contraste mínimo 4.5:1 verificado nos componentes principais (com exceções pontuais em correção); texto redimensionável via unidades relativas; sem imagens de texto.

**Operável** — 100% navegável por teclado, sem armadilha de foco fora de modais, skip-nav presente, ordem de foco = ordem do DOM, foco sempre visível (`BTN_FOCUS` + CSS global).

**Compreensível** — idioma da página declarado (`lang="pt-BR"`), i18n via `react-i18next`, mudanças de contexto sempre disparadas por ação explícita do usuário, erros identificados com mensagem textual.

**Robusto** — JSX compilado para HTML válido; a maioria dos componentes interativos usa `role` correto (`switch`, `dialog`, `alert`, `status`).

## Ferramentas usadas em auditorias

- **axe DevTools** — varredura automatizada (Chrome/Firefox)
- **NVDA** (Windows) — testes com leitor de tela gratuito
- **Colour Contrast Analyser** — medição de contraste
- **axe-core** via Jest (`@axe-core/react`) — testes automatizados

A lista completa de achados, com arquivo e linha, é mantida no repositório em `Documentação do Produto/Acessibilidade e WCAG.md`, atualizada a cada release significativo.
