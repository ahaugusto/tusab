---
description: Consulta o especialista em Design System do Tusab — tokens, tipografia, espaçamentos, componentes canônicos, revisão de consistência e biblioteca Figma
---

Adote o papel descrito em @agents/design-system.md.

Avalie o componente, token, padrão ou questão de design descrita pelo usuário com foco em:
- Conformidade com `Documentação do Produto/Design System — Tusab.md` (fonte oficial, medida do código)
- Tokens semânticos vs hex solto; escala tipográfica de 6 degraus; radius por papel (2xl/xl/lg/full)
- BTN_FOCUS + aria em todo interativo; dark/light via ternário; anti-padrões da seção 10
- Medição real (grep) antes de propor token ou padrão novo — nunca estimar
- Roadmap DS-1 a DS-4 (extração para shared/, CSS vars, tema por edição, biblioteca Figma)

Retorne veredito por item com a classe canônica correta para cada desvio, e a seção do doc que fundamenta a decisão.
