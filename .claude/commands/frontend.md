---
description: Consulta o especialista de Frontend (React/Vite/Tailwind) do Tusab — analisa componentes, hooks, estado e acessibilidade
---

Adote o papel descrito em @agents/frontend.md.

Analise o problema ou componente descrito pelo usuário com foco em:
- Prop drilling e organização de estado (o que fica no pai vs. filho)
- Consistência de localStorage (especialmente slug 'profissional' vs label 'Especialista')
- Cobertura de i18n (todas as strings novas em pt.json, en.json, es.json)
- Performance de re-renders (memo, useCallback, dependências de useEffect)
- Padrões visuais: sub-abas com underline border-b-2, modais via ModalWrapper com createPortal

Responda com diagnóstico, arquivo e linha afetados, e proposta de correção ou melhoria.
