# Tusab School — Proposta Estratégica
**Status:** Campo das ideias — alinhamento de visão, não spec técnico
**Data:** Junho 2026
**Participantes:** Produto + Backend + Frontend

---

## 1. Por que escola é o primeiro mercado B2B

**O problema real nas escolas hoje:**
ChatGPT e Gemini já estão nas salas de aula — mas sem controle pedagógico. A coordenação sabe que os alunos usam, não sabe o que respondem. E a base de conhecimento usada é a da internet, não a do professor.

**Por que escola antes de cursinho ou corporativo:**

| Critério | Escola | Cursinho | Corporativo |
|----------|--------|---------|------------|
| Decisor acessível | Coordenador / Diretor | Dono | C-level / TI |
| Ciclo de venda | Curto | Médio | Longo |
| Caso de uso demonstrável | "Pergunte sobre a aula de hoje" | "Revise para a prova" | Variável |
| Piloto possível | 1 turma | 1 curso | 1 departamento |
| Sensibilidade LGPD | Alta (dados de menores) | Média | Alta |

**O argumento LGPD é o diferencial de entrada:** dados de alunos menores em servidores de terceiros é um risco real para escolas. O Tusab School roda dentro da própria instituição — isso não é feature, é requisito legal para uma parte significativa do mercado.

---

## 2. Personas e Jobs to be Done

### Professor
**Job:** "Quero que meu conteúdo seja acessível 24h, sem eu estar disponível."

- Extrai videoaulas do YouTube canal da escola
- Faz upload de apostilas, PDFs, provas anteriores
- Submete a base para revisão da coordenação
- Vê relatório de quais tópicos os alunos mais perguntam (v2)

**Frustração hoje:** aluno usa ChatGPT e recebe resposta genérica ou errada para o contexto da disciplina. O professor não tem visibilidade disso.

---

### Coordenador Pedagógico
**Job:** "Preciso garantir que o que o aluno recebe está alinhado ao currículo — e que nada inadequado está na base."

- Recebe notificação quando professor submete base
- Visualiza preview do conteúdo indexado
- Aprova ou rejeita com comentário
- Base só fica disponível para alunos após aprovação

**Frustração hoje:** zero visibilidade sobre o que a IA responde. Não existe ferramenta que permita curadoria pedagógica antes da entrega ao aluno.

---

### Aluno
**Job:** "Quero tirar dúvidas agora, sem esperar a próxima aula."

- Acessa só o chat, via browser, na rede da escola
- Só vê as bases aprovadas pelo coordenador
- Não configura nada — canal já está pré-definido
- Modo didático por padrão (linguagem adaptada)

**Frustração hoje:** ChatGPT responde qualquer coisa. O aluno não sabe se está estudando o conteúdo correto para a prova.

---

### TI / Gestão
**Job:** "Não posso ter dados de alunos em servidores de terceiros."

- Instala em servidor próprio da escola (Windows Server ou Linux)
- Não depende de conectividade com cloud externa
- Funciona na rede interna mesmo sem internet

---

## 3. Proposta de valor vs. concorrentes no contexto escolar

| | Tusab School | ChatGPT/Gemini | NotebookLM | Google Classroom |
|--|:--:|:--:|:--:|:--:|
| Conteúdo controlado pela escola | ✅ | ❌ | Parcial | ❌ |
| Fluxo de aprovação pedagógica | ✅ | ❌ | ❌ | ❌ |
| Dados dentro da escola (LGPD) | ✅ | ❌ | ❌ | ❌ sem GSuite |
| Funciona offline / rede local | ✅ | ❌ | ❌ | ❌ |
| YouTube + PDF + Docs como fonte | ✅ | ❌ | Parcial | ❌ |
| UX não-técnica para professor | ✅ | ✅ | ✅ | ✅ |
| Custo por aluno | Licença única | Por usuário/mês | Gratuito (por ora) | Gratuito |

**Posicionamento em uma frase:**
> "O único assistente de IA que responde só o que o professor ensinou — dentro da sua escola, sem nuvem."

---

## 4. O que é o MVP do Tusab School

O menor produto vendável que valida o modelo com uma escola piloto.

### Como o fluxo de curadoria realmente funciona

O fluxo de validação **não é um workflow técnico no sistema** — é o processo pedagógico que já existe na escola. O Tusab respeita esse processo sem tentar automatizá-lo:

```
Professor monta a base no Tusab
       ↓
Compartilha preview com a coordenação (offline — reunião, e-mail, WhatsApp)
       ↓
Coordenação valida com equipe pedagógica no próprio processo da escola
       ↓
Professor clica "Publicar para turma(s)" no sistema
       ↓
Alunos das turmas associadas têm acesso imediato no chat
```

O coordenador tem visibilidade de todas as bases ativas (painel de auditoria) e pode despublicar a qualquer momento — sem aprovar formalmente cada base. Isso elimina burocracia e preserva a autonomia do professor.

### O que entra no MVP

- Deploy como servidor (FastAPI + React via nginx, sem Electron)
- 3 papéis com autenticação JWT local: Coordenador / Professor / Aluno
- **Gestão de turmas pelo coordenador:** cria turmas, importa lista via CSV, associa N professores e N alunos por turma
- **Importação CSV:** sistema gera credenciais e envia e-mail automático com login + endereço de acesso
- **Controle de visibilidade:** base em rascunho (só professor vê) → publicada por turma (alunos da turma acessam no chat)
- **Painel do coordenador:** todas as bases ativas por turma — auditoria, não aprovação formal
- Interface do aluno: só chat, bases das suas turmas, sem configuração
- Instalador para Windows Server ou Ubuntu — TI instala em ~30 min

### O que fica fora do MVP (versões futuras)

| Feature | Versão |
|---------|--------|
| Analytics de queries ("tópicos mais perguntados") | v2 |
| Feedback loop professor → pauta de novos vídeos | v2 |
| App mobile para aluno | v2 |
| Multi-escola / painel centralizado | v3 |
| SSO / integração com sistema escolar (TOTVS, etc.) | v3 |

### O que reaproveita do Tusab atual

- Motor de extração YouTube (yt-dlp) — sem mudança
- BM25 + CrossEncoder — sem mudança
- Chat RAG com streaming — sem mudança
- Upload PDF/DOCX — sem mudança
- i18n PT/EN/ES — sem mudança
- Todos os componentes visuais do painel do professor — ~70% reuso direto

**Estimativa de reuso:** 60–65% do backend e 70% do frontend são reaproveitáveis sem reescrita.

---

## 5. Modelo de negócio preliminar

**Premissa:** escola não compra SaaS recorrente facilmente — prefere licença anual com suporte. Orçamento é fixo e aprovado com antecedência.

| Tier | Preço estimado | O que inclui |
|------|---------------|--------------|
| **Piloto** | Gratuito / 1 semestre | 1 turma, 1 professor, até 30 alunos |
| **Escola Básico** | R$ 3.600/ano | Até 5 professores, 200 alunos, suporte por email |
| **Escola Completo** | R$ 9.600/ano | Professores ilimitados, 1.000 alunos, suporte prioritário, analytics v2 |
| **Rede de Escolas** | Negociação | Multi-unidade, painel centralizado, SLA |

**Por que licença anual e não por aluno:**
- Escola tem resistência a custo variável — orçamento é fixo
- Simplifica processo de compra e aprovação
- Margem previsível

**Gatilho de upsell Básico → Completo:** o coordenador quer ver relatório de quais tópicos os alunos mais perguntam (analytics v2). Isso não existe no Básico — é o argumento de renovação e upgrade.

---

## 6. Riscos e premissas

### Riscos do produto

| Risco | Prob. | Mitigação |
|-------|-------|-----------|
| TI da escola não consegue instalar / manter | Alta | Instalador guiado + documentação + suporte no onboarding obrigatório |
| Coordenador não usa o painel de auditoria | Baixa | Painel é opcional — produto funciona mesmo sem uso ativo do coordenador |
| Professor não indexa conteúdo regularmente | Média | Relatório de "base desatualizada há X dias" como lembrete passivo |
| Escola não renova por falta de evidência de uso | Média | Analytics de queries (v2) mostra engajamento — argumento de renovação |
| Google Workspace for Education responde | Média/Alta | Curadoria pedagógica + LGPD local são diferenciais não triviais de copiar |

### Premissas que precisam ser validadas antes de construir

1. Escola consegue manter servidor Windows/Linux operando — nem toda escola tem TI capaz
2. Professor tem disposição para indexar conteúdo regularmente (não é uso pontual)
3. Coordenador vê valor em revisar — ou vira burocracia que trava o professor
4. O argumento LGPD é suficiente para substituir gratuidade do Google/ChatGPT

---

## 7. Parecer técnico — viabilidade de implementação

### Backend (avaliação do engenheiro backend)

**Bloqueio principal:** o `AppState` singleton foi projetado para single-user. Com múltiplos professores simultâneos, o estado global é sobrescrito. A solução é transformá-lo em um job registry com `ExtractionJob` por usuário — trabalhoso mas sem reescrita total.

**Autenticação:** JWT local com `python-jose` + `passlib[bcrypt]`. Usuários em `data/config/users.json`. Sem dependência de serviços externos — funciona offline.

**Controle de visibilidade:** campo `status_base` no `summary.json` com dois estados — `rascunho` e `publicada`. Uma rota `/bases/publicar/{projeto}` e um guard no `/agent/chat` que bloqueia bases em rascunho. Sem workflow de submissão/aprovação — o processo de validação é humano e offline.

**Gestão de turmas:** modelo relacional simples em SQLite. Turma ↔ Professor (N:N), Turma ↔ Aluno (N:N), Base ↔ Turma (N:N). Importação de CSV com geração de credenciais e envio de e-mail via SMTP local.

**Deploy headless:** FastAPI serve o React via `StaticFiles` — 3 linhas de código. Principal armadilha: uvicorn deve rodar com `--workers 1` (o state singleton não sobrevive a múltiplos workers).

| Item | Dias estimados |
|------|---------------|
| Auth JWT + papéis | 3–4 dias |
| AppState → job registry | 5–7 dias |
| Gestão de turmas + importação CSV | 3–4 dias |
| Controle de visibilidade (rascunho/publicada) | 1–2 dias |
| Storage namespace por usuário | 4–5 dias |
| Deploy headless (sem Electron) | 3–4 dias |
| Rate-limit yt-dlp em servidor | 2–3 dias |
| **Total backend MVP** | **~18–22 dias** |

---

### Frontend (avaliação do engenheiro frontend)

**Interface do Aluno:** novo slug `aluno` no `PERFIS_CONFIG` existente — não é SPA separada. Canal pré-definido via JWT. Remoção de botões de gestão via regras de perfil. ~3–4 dias.

**Interface do Coordenador:** nova aba `CoordTab.jsx` com lista de bases pendentes, preview e botões Aprovar/Rejeitar. Padrão visual dos componentes existentes. ~4–5 dias.

**Autenticação:** `AuthContext` + `LoginScreen` + interceptor axios + migração de localStorage para user-scoped (em laboratório, múltiplos alunos na mesma máquina herdariam estado). ~3–4 dias.

**Deploy web:** principal armadilha é `API_BASE` hardcoded para `localhost:8001`. Precisa de `VITE_API_URL` como variável de ambiente no build. nginx requer `try_files $uri /index.html` para SPA funcionar com refresh.

| Item | Dias estimados |
|------|---------------|
| react-router + AuthContext + LoginScreen | 3–4 dias |
| Perfil 'aluno' + restrições de UI | 3–4 dias |
| CoordTab (visual + integração) | 4–5 dias |
| Migração localStorage user-scoped | 1–2 dias |
| VITE_API_URL + useElectron hook | 1 dia |
| Testes e ajustes | 4–5 dias |
| **Total frontend MVP** | **~14–19 dias** |

---

### Estimativa total de MVP

| | Dias |
|--|--|
| Backend | 20–25 dias |
| Frontend | 14–19 dias |
| Sobreposição (trabalho paralelo) | −8–10 dias |
| **Total com 2 devs em paralelo** | **~25–35 dias** |
| **Total com 1 dev** | **~35–45 dias** |

O caminho crítico é o backend — os endpoints de autenticação precisam existir antes que o frontend possa ser validado end-to-end.

---

## 8. Sequência recomendada de validação

**Antes de escrever código:**
1. Validar com 1 escola piloto que o coordenador quer o fluxo de aprovação (não é burocracia)
2. Validar que a TI consegue instalar servidor (rodar o instalador em máquina clean)
3. Definir se escola tem Windows Server ou Linux (afeta 3–4 dias do backend)

**Sequência de desenvolvimento:**
1. Auth JWT + papéis (semana 1 — libera todo o resto)
2. Deploy headless + VITE_API_URL (semana 1 — paralelo com auth)
3. Job registry no AppState (semana 2–3 — caminho crítico)
4. Perfil aluno + CoordTab (semana 2 — pode começar frontend em paralelo)
5. Fluxo de aprovação + guard no chat (semana 3)
6. Namespace de storage por usuário (semana 3–4)
7. Testes end-to-end + piloto (semana 4–5)

---

*Documento gerado em junho 2026 — revisão recomendada antes de qualquer decisão de construção.*
