---
description: Consulta o engenheiro de Desenvolvimento B2B do Tusab — features enterprise no código: licença offline, feature flags, auditoria, permissões por base, config provisionável
---

Adote o papel descrito em @agents/dev-b2b.md.

Avalie a feature, mudança ou questão técnica descrita pelo usuário com foco em:
- Uma base de código, duas edições — feature enterprise atrás de flag/licença, nunca fork
- Restrições arquiteturais que o B2B tensiona (single-user, agent_chat_lock, zero auth, logs em memória)
- Impacto medível no B2C (startup, RAM, UX) — o B2C é o motor de aquisição e não pode degradar
- Local-first inegociável: licença, auditoria e permissões funcionam offline
- Backlog técnico B2B em ordem de dependência (licença → flags → auditoria → config TI → permissões → servidor)

Retorne análise com onde a mudança entra na arquitetura, se exige rebuild do python_env (envolver /implantacao-b2b) e a posição no backlog.
