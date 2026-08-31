# Triagem de agentes — como decidir qual especialista acionar

**Criado:** 30/ago/2026, a pedido explícito do Augusto: "quero que nossa estrutura saiba quando, como e onde cada agente pode atacar" + "se não encontrar [especialista adequado] na base, vamos criar um agente para isso".

Este arquivo documenta o **processo de roteamento** — não substitui `agents/_historia.md` (memória de decisões passadas) nem os arquivos individuais de agente (conhecimento de domínio). É consultado sempre que uma tarefa chega em linguagem natural, sem `/comando` explícito do usuário, e mais de um agente poderia se aplicar.

---

## Princípio geral: autonomia na execução, aval humano na lacuna

Modelo confirmado com o Augusto (30/ago/2026), para não recair em dois extremos ruins — autonomia total sem visibilidade, ou checkpoint em toda etapa (rejeitado explicitamente: "quero um pouco mais de autonomia"):

1. **A triagem é decidida sozinha e só informada** — nunca pausar pedindo aprovação de "qual agente devo usar aqui?". Dizer qual persona(s) foi(ram) acionada(s) e seguir.
2. **Execução dentro da tarefa é autônoma** — investigar, codar, testar, iterar sem pausa a cada passo. O freio humano continua sendo o já estabelecido no projeto: commit/push, ações destrutivas/irreversíveis, e decisões que só o Augusto pode tomar (ver regras gerais do sistema, não repetidas aqui).
3. **Só há UM ponto de pausa específico da triagem**: quando nenhum agente existente cobre bem o domínio da tarefa. Nesse caso, sinalizar a lacuna, seguir a tarefa mesmo assim (sem bloquear), e propor a criação de um agente novo como item separado — nunca interromper o trabalho em andamento esperando aval pra criar o agente.

---

## Inventário de agentes por domínio de decisão

Fonte de verdade dos nomes/escopos: tabela em `CLAUDE.md` (seção "Agentes especializados"). Este arquivo organiza a mesma informação por **tipo de pergunta que a tarefa está fazendo**, para triagem mais rápida.

### "Isso é sobre o código/sistema em si?"

| Sintoma da tarefa | Agente |
|---|---|
| Lógica de API, thread safety, atomicidade, BM25/RAG, LanceDB, storage | `/backend` |
| Componentes React, hooks, estado, i18n, prop drilling | `/frontend` |
| Contrato Electron↔FastAPI↔React↔disco, payload entre camadas | `/integracao` |
| Path traversal, injeção, secrets, Electron security, upload | `/seguranca` |
| Code signing, notarização, empacotamento Electron, CI macOS | `/macos` |
| Gaps de teste, novos casos, confiabilidade da suíte pytest | `/testes` |
| Checklist manual de fluxo completo, validação ponta a ponta | `/qa` |

### "Isso é sobre como a interface parece ou se comporta?"

| Sintoma da tarefa | Agente |
|---|---|
| Tokens visuais, contraste, estados de componente, consistência dark/light | `/ui` |
| Fluxo, jornada, fricção, microcopy, atalho de teclado | `/ux` |
| WCAG, ARIA, navegação por teclado, leitor de tela | `/acessibilidade` |
| Síntese UX+UI+JTBD+impacto de negócio numa proposta só | `/product-designer` |
| Tokens/componentes canônicos como *estrutura* (não 1 tela isolada) | `/design-system` |

### "Isso é sobre para onde o produto vai ou como ele se posiciona?"

| Sintoma da tarefa | Agente |
|---|---|
| Priorização de feature, benchmarking, estratégia geral | `/produto` |
| Avaliar tendência/ferramenta técnica nova, oportunidade | `/inovacao` |
| Telemetria, KPIs, funil de ativação | `/metricas` |
| Canal de aquisição, copy, growth sem budget | `/marketing` |
| Viabilidade de negócio, TAM/SAM/SOM, análise de mercado com frieza de investidor | `/investidor` |

### "Isso é sobre a linha institucional B2B?"

| Sintoma da tarefa | Agente |
|---|---|
| Oportunidade/pricing/proposta/piloto institucional | `/comercial-b2b` |
| Build variant, licenciamento offline, deploy em massa (GPO), EDR | `/implantacao-b2b` |
| Feature enterprise no código (licença, feature flag, auditoria) | `/dev-b2b` |
| Roadmap e priorização da edição institucional | `/produto-b2b` |

### "Isso é sobre memória, histórico ou documentação do próprio projeto?"

| Sintoma da tarefa | Agente/processo |
|---|---|
| "Isso já foi tentado?", "por que X foi descartado?", invariantes | `/memoria` |
| Fechar um ciclo de trabalho — propor o que entra em `_historia.md` | `/memoria-atualizar` |
| Corrigir tabela de roadmap desatualizada nos próprios `agents/*.md` | `/roadmap-sincronizar` |
| Manter `docs-site/`/`README.md` sincronizados com o código | `/documentacao` |

**Nota de sequência:** para uma feature que muda comportamento visível ao usuário, a ordem natural é implementar (`/backend`/`/frontend` etc.) → `/documentacao` → considerar `/memoria-atualizar` no fechamento do ciclo. `/roadmap-sincronizar` entra quando uma feature sai/muda de status, não a cada mudança pontual.

---

## Regras de triagem para tarefas ambíguas ou multi-domínio

1. **Tarefa toca mais de um domínio → acionar mais de um agente, em sequência ou paralelo conforme a dependência real entre eles.** Exemplo real desta sessão: correção de contraste (`/design-system` + `/acessibilidade`) rodou em paralelo porque uma auditoria não dependia da outra; já a decisão de commit dependeu de ambas terminarem.
2. **Tarefa é só "arrumar um bug"/"implementar uma correção pequena e concreta" → não precisa de triagem formal.** Fazer direto, sem invocar persona — a triagem existe para decisões de *que perícia aplicar*, não para todo edit trivial.
3. **Tarefa pede investigação técnica não-trivial → preferir `/backend` (ou o agente de domínio certo) rodando como Agent/Workflow em vez de eu mesmo especular.** Já é a prática desta sessão (consultei `/backend` antes de decisões técnicas de peso como a migração LanceDB e a correção de streaming).
4. **Tarefa é uma pergunta estratégica de produto sem urgência de código → considerar se cabe workflow de síntese (`/produto` + `/inovacao` + `/investidor` em paralelo, depois eu sintetizo) em vez de escolher um agente só.**

---

## Quando NÃO existe agente adequado — lacuna real

Sinal de lacuna real (não confundir com "a tarefa é ampla e cabe em vários agentes já existentes"): o domínio da tarefa não aparece em NENHUMA linha do inventário acima, mesmo combinando agentes.

**Procedimento (aviso + prosseguir, nunca bloquear):**

1. Seguir a tarefa normalmente, sem persona especializada (ou com a persona mais próxima disponível, deixando claro que é aproximação).
2. Ao final (ou no início, se ficar óbvio de imediato), avisar objetivamente: *"Não há um agente dedicado a [domínio X] em `agents/`. Segui sem persona especializada nessa parte. Vale criar um agente pra isso?"*
3. **Não criar o agente novo sem essa confirmação explícita** — este é o único ponto real de aval humano deste processo, porque criar um agente é uma decisão de investimento de longo prazo (o agente passa a ser consultado em toda tarefa futura daquele domínio), diferente de uma decisão de execução pontual.
4. Se o Augusto confirmar, seguir o padrão estrutural já estabelecido nos agentes existentes (ver qualquer arquivo em `agents/` como modelo: papel, escopo, invariantes/memória institucional referenciada, "o que avaliar em toda análise") e registrar o novo comando em `.claude/commands/` + na tabela do `CLAUDE.md`.

---

## Diferença deste processo vs. o padrão "deepseek-harness" (por que isto tem HITL e aquilo não)

Registrado para não reabrir a discussão sem contexto (ver conversa de 30/ago/2026): a diferença central não é quantidade de automação, é *onde* fica o freio.

- **Aqui**: a triagem decide sozinha, a execução roda autônoma, e o único portão humano obrigatório é a criação de agente novo (decisão de investimento de longo prazo) — commits/pushes/ações destrutivas continuam sob as regras gerais já em vigor no projeto, não deste arquivo especificamente.
- **deepseek-harness (rejeitado como ferramenta de dev)**: o próprio loop de execução de código é autônomo por desenho, sem portão embutido — o "harness" *é* a ausência do freio, não uma peça que se possa religar por cima sem perder a razão de ser da ferramenta.

Este arquivo não introduz um mecanismo de execução novo — formaliza como já orquestramos hoje (Agent/Workflow, agentes definidos em `.md`, execução supervisionada por commit), só tornando a escolha de "qual perícia usar" um processo declarado em vez de julgamento ad-hoc a cada conversa.
