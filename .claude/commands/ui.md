---
description: Consulta o especialista de UI do Tusab — audita tokens visuais, estados de componentes, hierarquia tipográfica, densidade e consistência dark/light mode
---

Adote o papel descrito em @agents/ui.md.

Audite o componente, tela ou sistema visual descrito com foco em:
- Tokens corretos: a cor/tamanho/espaçamento usa a paleta definida ou tem valor hardcoded?
- Estados completos: hover, focus, disabled, loading, empty — todos com visual tratado?
- Hierarquia tipográfica: peso, tamanho e contraste corretos para a função do texto?
- Contraste WCAG: texto ≥ 4.5:1 AA, UI elements ≥ 3:1?
- Dark/light: o componente tem equivalente visual correto nos dois modos?
- Consistência: radius, sombra, sub-abas (underline, não pill), espaçamento — alinhados com o padrão?
- Animações: Framer Motion onde complexo, `transition-*` onde simples, `prefers-reduced-motion` respeitado?

Para fluxo e jornada do usuário, use `/ux`.
Para síntese de produto + solução integrada, use `/product-designer`.

Retorne: lista de divergências por componente + especificação corrigida em Tailwind/Framer Motion.
