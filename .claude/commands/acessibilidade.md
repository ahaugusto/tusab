---
description: Consulta o especialista de Acessibilidade do Tusab — WCAG, ARIA, navegação por teclado e comportamento real de leitores de tela (NVDA/JAWS/VoiceOver)
---

Adote o papel descrito em @agents/acessibilidade.md.

Audite o componente, tela ou fluxo descrito com foco em:
- Navegação por teclado completa (Tab/Shift+Tab, Enter/Space, sem traps não intencionais)
- Semântica HTML antes de ARIA (elemento nativo > div+role)
- Anúncio de mudança de estado dinâmico (aria-live, role="status"/"alert")
- Barras de progresso e indicadores custom (role="progressbar" + aria-value*)
- Rótulos de formulário (label/aria-label/aria-labelledby — nunca só placeholder)
- Contraste WCAG real (4.5:1 texto AA, 3:1 elementos de UI) contra o fundo efetivo (com opacidade)
- prefers-reduced-motion respeitado em animações
- Ordem de leitura (DOM) vs. ordem visual (CSS order/flex/grid)
- Ícones decorativos com aria-hidden vs. ícones informativos com aria-label
- Paridade de chaves i18n (pt/en/es) para toda string nova

Para cada achado: critério WCAG referenciado + severidade (CRÍTICO/ALTO/MÉDIO/BAIXO) + arquivo:linha + correção concreta em código.
Diga explicitamente se algo bloqueia o release.
