---
description: Sincroniza as tabelas de roadmap desatualizadas nos arquivos agents/*.md contra o CHANGELOG.md — propõe atualizações para aprovação antes de salvar
---

Você mantém as tabelas de roadmap dentro de `agents/*.md` sincronizadas com a realidade do produto. Cada arquivo de agente especializado (`backend.md`, `produto.md`, `ux.md`, `qa.md`, etc.) tem sua própria tabela de roadmap com a perspectiva daquele agente — e essas tabelas ficam desatualizadas silenciosamente conforme features saem, são descartadas, ou mudam de prioridade. Seu trabalho é achar esse drift e propor a correção, **nunca salvar sem aprovação explícita**.

## Contexto do problema que este comando resolve

Em 28/ago/2026, uma auditoria encontrou 14 dos 22 arquivos em `agents/` com tabelas de roadmap citando sprints (`P0-c`, `P0-d`, `P0-e`, `P1`, `P1-b`, `P2`, `P5`, etc.) como "planejado"/"próximo" quando na verdade já tinham sido entregues (algumas há mais de uma versão), removidas por bug real, ou reordenadas. A causa raiz: quando uma feature sai ou é descartada, ninguém volta nos ~14 arquivos de agente para atualizar o status — só `CHANGELOG.md` e `agents/_historia.md` são tocados no fluxo normal de release.

Este comando existe para rodar esse fechamento de loop de forma repetível, em vez de depender de alguém notar o drift meses depois.

## O que fazer

### Passo 1 — Descobrir o que mudou de status

1. Leia `CHANGELOG.md` (raiz) — extraia toda entrada `### Adicionado`/`### Alterado`/`### Removido` desde a última vez que este comando rodou (ver Passo 2 para saber a data de corte).
2. Leia `agents/_historia.md` — decisões estratégicas e experimentos descartados também mudam o status de itens de roadmap (ex: "GraphRAG adiado" vira "GraphRAG: premissa desatualizada, ver achado X").
3. Se a conversa atual tocou em algo ainda não versionado/lançado que muda status de um item de roadmap, considere também.

Monte uma lista de fatos do tipo: `{item do roadmap} → {novo status: ✅ Entregue vX.Y.Z | ❌ Removido vX.Y.Z (motivo) | 🔵 Próxima prioridade real | reordenado}`.

### Passo 2 — Encontrar o drift em cada arquivo de agente

Para cada arquivo em `agents/*.md` que contenha uma tabela ou lista de roadmap (grep por "Roadmap", "Sprint", "P0-", "P1", nomes de sprint específicos do projeto):

1. Leia a tabela/bloco de roadmap inteiro.
2. Para cada linha, confira se o status implícito ou explícito bate com os fatos do Passo 1.
3. Marque divergências: item citado como pendente/planejado que já saiu; item citado como ativo que foi removido; ordem de prioridade que não reflete mais a realidade (ex: um item "próxima prioridade" citado em um arquivo mas não nos outros).

**Não assuma que todos os 22 arquivos de `agents/` têm tabela de roadmap** — alguns (ex: `macos.md`, `_historia.md` mesmo) podem não ter esse padrão. Rode grep primeiro para descobrir a lista real antes de abrir todos.

### Passo 3 — Apresentar a proposta

Para cada arquivo com divergência real, apresente:

```
PROPOSTA DE ATUALIZAÇÃO DE ROADMAP — aguardando aprovação

### agents/{arquivo}.md
**Tabela/bloco afetado:** nome da seção
**O que está desatualizado:** citação exata do texto atual
**Deveria dizer:** texto proposto (seguindo o padrão de status já estabelecido: ✅ Entregue (vX.Y.Z) / ❌ Removido (vX.Y.Z, motivo) / 🔵 Próxima prioridade técnica real / "Verificar estado atual antes de assumir pendente" quando não há evidência suficiente)
**Evidência:** CHANGELOG.md vX.Y.Z, ou `agents/_historia.md`, ou commit
```

Preserve a perspectiva específica de cada arquivo (ex: em `testes.md` o "o que fazer" é caso de teste; em `ux.md` é desafio de UX; em `seguranca.md` é implicação de segurança) — não homogeneíze o conteúdo, só corrija o status.

Se nenhum arquivo tiver divergência, diga isso explicitamente — não invente drift para justificar a execução.

### Passo 4 — Aguardar aprovação

**Não edite nenhum arquivo em `agents/` ainda.** Pergunte:

> "Confirma as atualizações de roadmap acima? Ou quer ajustar/remover algum item antes de aplicar?"

### Passo 5 — Aplicar o aprovado

Após aprovação explícita:
1. Edite cada arquivo aprovado com o padrão de status acordado.
2. Adicione (ou atualize) uma linha `**Atualizado em {data}**` no topo de cada tabela de roadmap tocada — é o que permite ao próximo agente que ler o arquivo saber se a informação é recente sem precisar rodar este comando de novo.
3. Rode `git status --short agents/` para confirmar exatamente quais arquivos mudaram, e liste isso para o usuário.
4. Pergunte se o usuário quer commitar agora — **nunca commite automaticamente sem confirmação separada**, mesmo sendo só documentação de agente.

## Quando rodar este comando

- Sempre que uma feature listada em algum roadmap de `agents/*.md` for entregue, removida, ou reordenada (mesmo gatilho de quando `/documentacao` roda para o site público — mas este comando cobre os arquivos internos de agente, não `docs-site/`).
- Pode rodar no mesmo fechamento de ciclo que `/memoria-atualizar` (mesma ocasião: após release ou decisão relevante), mas são comandos independentes com escopos diferentes: `/memoria-atualizar` escreve em `_historia.md` (memória histórica); este comando corrige o status corrente citado nas tabelas de roadmap de cada agente (estado presente, não histórico).
- Se um usuário pedir "atualiza os agentes" ou "os roadmaps dos agentes estão desatualizados", este é o comando certo.

## O que NÃO fazer

- Não reescrever o roadmap inteiro de um arquivo — só corrigir o status dos itens que já têm fato novo (Passo 1). Reestruturação de prioridade que não veio de um fato concreto (release, descarte, decisão registrada) não é escopo deste comando.
- Não duplicar `_historia.md` dentro de `agents/*.md` — a tabela de roadmap deve continuar curta e específica da perspectiva daquele agente, com "ver `agents/_historia.md`" ou "ver `agents/backend.md`" como referência cruzada quando fizer sentido (ex: LanceDB é referenciado em vários arquivos, mas detalhado só em `backend.md`).
- Não inventar status quando não há evidência — usar "Verificar estado atual antes de assumir pendente" é a resposta correta quando o CHANGELOG.md não confirma nem entrega nem descarte.
- Não editar sem aprovação explícita.
