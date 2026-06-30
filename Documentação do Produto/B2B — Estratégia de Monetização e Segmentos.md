# Tusab B2B — Estratégia de Monetização e Segmentos
**Status:** Visão estratégica — campo das ideias
**Data:** Junho 2026
**Última atualização:** Junho 2026 — definição expandida de local-first, modelo de dados de turmas/usuários, fluxo de curadoria pedagógica

---

## O momento da monetização

Até junho 2026, o Tusab não monetizava em nenhum cenário. A proposta B2B muda esse quadro pela primeira vez com escalabilidade real: uma venda serve centenas ou milhares de usuários simultâneos, sem custo proporcional de suporte.

O produto atual (B2C, local-first, gratuito) continua existindo como vitrine técnica e canal de aquisição. O B2B é uma camada separada — mesma tecnologia, modelo de negócio diferente.

---

## A distinção fundamental: B2C vs. B2B e o princípio local-first

### B2C — o produto atual
- Dados do usuário, na máquina do usuário
- Local-first é promessa inegociável e diferencial de posicionamento
- Nunca tocar esses dados — é o contrato com o usuário
- Monetização futura: plano Pro por features (export, fila ilimitada, etc.)

### B2B — a nova camada
- A **instituição** compra o produto e o fornece aos seus usuários
- Os dados de uso são **da instituição**, não do usuário final
- Mesmo modelo do Google Workspace for Education: o aluno usa, mas os dados pertencem à escola contratante
- A instituição assina os termos, assume a responsabilidade LGPD

> Se o usuário final quiser privacidade absoluta, ele usa o Tusab na sua conta pessoal (B2C). No B2B, ele está usando a ferramenta da instituição, sob os termos da instituição. São contratos distintos.

---

## Definição expandida de local-first no B2B

**"Local-first" no B2B não significa "na máquina do usuário" — significa "nos servidores da instituição, sob controle da instituição."**

O Tusab nunca opera dados de clientes. Cada instituição opera seu próprio servidor. O dado fica na infraestrutura do contratante, não de terceiros. Isso preserva o princípio e o argumento LGPD em todos os cenários:

| Cenário | Como funciona | Local-first? |
|---------|--------------|:---:|
| Escola com rede interna | Servidor no datacenter da escola; aluno acessa via IP local | ✅ |
| Cursinho com alunos em casa | VPS própria do cursinho com domínio; dados nos servidores deles | ✅ |
| Hospital | Servidor no datacenter do hospital; sem saída para internet | ✅ |
| Você operando dados de cliente | Não acontece — não é o modelo | ❌ nunca |

### Distribuição de acesso sem abrir mão do local-first

O aluno não precisa instalar nada. Acessa via browser. O "link por e-mail" funciona assim:

1. Coordenador importa lista de alunos via CSV
2. Sistema gera credenciais automaticamente
3. E-mail automático enviado com login/senha + endereço do servidor da instituição
4. Aluno clica → cai na tela de login do Tusab rodando *dentro da instituição*

Para cursinhos com alunos em casa: o servidor do cursinho tem IP público ou domínio próprio (`tusab.estrategiaconcursos.com.br`). Os dados ficam no servidor deles. O Tusab não toca em nada.

---

## Modelo de dados — estrutura comum a todos os segmentos

A hierarquia central do produto B2B:

```
Instituição
  └── Turma / Grupo (ex: "3º Ano A", "Turma Direito Administrativo", "Nível B2")
        ├── Alunos (N por turma)
        └── Professores / Instrutores (N por turma — mesmo prof pode estar em várias)
              └── Bases de conhecimento (por disciplina / módulo)
                    └── Status: rascunho | publicada para turma(s)
```

### Papéis e responsabilidades

| Papel | O que faz no sistema |
|-------|---------------------|
| **Coordenador** | Cria turmas, importa usuários via CSV, associa professores e alunos a turmas, visualiza todas as bases publicadas |
| **Professor / Instrutor** | Monta bases de conhecimento, publica para turmas onde leciona após validação pedagógica offline |
| **Aluno / Usuário final** | Acessa chat das bases publicadas nas suas turmas — sem configuração, sem acesso a arquivos |

### Fluxo de curadoria — como realmente funciona

O fluxo **não é um workflow técnico de aprovação**. É um processo pedagógico humano que já existe na instituição:

```
Professor monta a base
       ↓
Compartilha com coordenação (link de preview ou export)
       ↓
Coordenação valida com equipe pedagógica (offline, no próprio processo da escola)
       ↓
Professor clica "Publicar para turma" no sistema
       ↓
Alunos da turma têm acesso imediato
```

O Tusab não gerencia o processo de validação — só oferece o controle de visibilidade:
- **Rascunho:** professor vê, aluno não
- **Publicada:** alunos das turmas associadas veem no chat
- **Painel do coordenador:** lista de todas as bases ativas por turma (auditoria, não aprovação)

Isso reduz o MVP técnico significativamente: sem workflow de aprovação formal, sem notificações complexas — só um botão "Publicar" e uma lista de bases ativas para o coordenador.

### Importação de usuários

- **CSV padrão:** nome, e-mail, papel, turma(s)
- Sistema gera credenciais e envia e-mail automático com acesso
- Coordenador é o único que pode criar/editar usuários
- Um professor pode estar associado a N turmas
- Um aluno vê as bases de todas as suas turmas simultaneamente no chat

---

## As interações de chat como produto comercial

As perguntas que os usuários fazem ao chat são sinais de altíssimo valor:

- **Para a instituição:** quais dúvidas surgem mais → pauta de novos conteúdos, treinamentos, materiais
- **Para o Tusab (agregado, opt-in institucional):** "70% dos alunos de ensino médio no Brasil têm dificuldade com juros compostos" → produto editorial, benchmark de mercado

**A distinção do valor:** não são os dados brutos que valem — é o insight agregado. As 50 perguntas mais frequentes sobre ENEM biologia são um produto editorial. O mapeamento de gaps de conteúdo por disciplina é insumo para editoras, cursinhos, plataformas.

**Modelo de consentimento:**
- Nível 1 (padrão): dados ficam na instituição, só ela acessa
- Nível 2 (opt-in institucional): instituição autoriza compartilhamento agregado e anonimizado com o Tusab para benchmarking → desconto na licença ou acesso a relatórios comparativos de mercado

---

## Segmentos mapeados

| Segmento | Documento | Status |
|----------|-----------|--------|
| Escola (ensino fundamental/médio) | [Tusab School — Proposta Estratégica.md](Tusab School — Proposta Estratégica.md) | Completo com parecer técnico |
| Cursinho para concurso público | [Tusab Concurso — Proposta Estratégica.md](Tusab Concurso — Proposta Estratégica.md) | Rascunho |
| Pré-vestibular | [Tusab Vestibular — Proposta Estratégica.md](Tusab Vestibular — Proposta Estratégica.md) | Rascunho |
| Escola de inglês / idiomas | [Tusab Idiomas — Proposta Estratégica.md](Tusab Idiomas — Proposta Estratégica.md) | Rascunho |
| Hospital / saúde | [Tusab Saúde — Proposta Estratégica.md](Tusab Saúde — Proposta Estratégica.md) | Rascunho |

---

## Arquitetura de produto B2B — o que é comum a todos os segmentos

### Stack comum (reaproveitada do produto atual)
- Motor de extração YouTube (yt-dlp) — sem mudança
- BM25 + CrossEncoder — sem mudança
- Chat RAG com streaming — sem mudança
- Upload PDF/DOCX/WhatsApp/Reuniões — sem mudança
- i18n PT/EN/ES — sem mudança

### Camadas novas (comuns a todos os segmentos B2B)
- **Autenticação JWT local** — usuário/senha, sem dependência de cloud externa
- **Sistema de papéis** — Coordenador / Professor / Aluno (nomenclatura varia por segmento)
- **Gestão de turmas/grupos** — Coordenador cria, associa usuários, importa via CSV
- **Controle de visibilidade de bases** — rascunho vs. publicada por turma
- **Deploy headless** — servidor local da instituição, sem Electron
- **Namespace de dados por usuário** — isolamento dentro do mesmo servidor
- **Importação de usuários via CSV** — com geração de credenciais e envio de e-mail
- **Analytics de queries** (v2) — painel de insights para o gestor

### O que varia por segmento
- Nomenclatura dos papéis (Professor vs. Médico vs. Instrutor vs. Especialista)
- Granularidade da curadoria (pedagógica vs. compliance vs. editorial)
- Fontes de conteúdo prioritárias (YouTube vs. PDFs técnicos vs. material próprio)
- Requisitos regulatórios (LGPD básica vs. CFM/ANVISA para saúde)
- Modelo de precificação (por turma vs. por usuário vs. por unidade)

---

## Estimativa técnica de MVP revisada

Baseado na avaliação técnica do segmento Escola (junho 2026) e refinamentos de fluxo:

| Componente | Dias (2 devs paralelo) | Observação |
|------------|----------------------|------------|
| Auth JWT + papéis + deploy headless | 6–8 dias | Bloqueante — primeiro a construir |
| AppState → job registry (multi-usuário) | 5–7 dias | Bloqueante — paralelo com auth |
| Gestão de turmas + importação CSV | 3–4 dias | Substitui fluxo de aprovação formal |
| Controle de visibilidade (rascunho/publicada) | 1–2 dias | Simples — substitui workflow complexo |
| Interface do aluno (read-only por turma) | 3–4 dias | |
| Painel do coordenador (gestão + auditoria) | 3–4 dias | Mais simples que aprovação formal |
| Storage namespace por usuário | 4–5 dias | |
| Importação CSV + envio de e-mail | 2–3 dias | |
| **Total MVP B2B (segmento 1)** | **~20–28 dias** | Redução vs. estimativa anterior |
| **Segmentos adicionais** (reaproveitando MVP) | **~3–5 dias cada** | Só nomenclatura e config mudam |

**Redução de ~25–35 para ~20–28 dias** pela eliminação do workflow de aprovação formal — substituído por controle simples de visibilidade.

---

## Sequência de entrada no mercado recomendada

1. **Escola** — decisor acessível, ciclo curto, LGPD como argumento, piloto validável em 1 turma
2. **Cursinho para concurso** — mesmo produto, público maior, ticket maior, decisor mais rápido
3. **Pré-vestibular** — sobreposição com escola e cursinho, modo estudo como diferencial
4. **Escola de idiomas** — corpus multilíngue já suportado, potencial de franquia
5. **Hospital** — maior receita, maior complexidade regulatória — entra com produto maduro

---

## Premissas a validar antes de construir

1. ✅ Local-first preservado — servidor da instituição, não do Tusab *(validado conceitualmente)*
2. ✅ Fluxo de curadoria é humano/offline — sistema só controla visibilidade *(validado na conversa)*
3. ⬜ Coordenador usa painel de auditoria na prática — ou ignora após setup inicial
4. ⬜ Professor mantém bases atualizadas com regularidade
5. ⬜ Importação de CSV funciona com formatos reais das escolas (cada escola tem o próprio formato)
6. ⬜ Licença anual é aprovável no orçamento institucional
7. ⬜ TI da escola (ou VPS do cursinho) consegue manter servidor operando sem suporte frequente

---

*Documento vivo — atualizar conforme validações de mercado e decisões de produto.*
