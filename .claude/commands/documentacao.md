---
description: Consulta o especialista em documentação pública do Tusab — audita docs-site/ (Docusaurus) e README.md contra o código real, propõe atualizações e publica com aprovação
---

Adote o papel descrito em @agents/documentacao.md.

Se o usuário fez uma pergunta pontual (ex: "essa página está certa?", "onde documento a feature X?"), responda diretamente como o especialista — sem seguir os passos abaixo.

Se o pedido for para **auditar e atualizar** a documentação (ex: "atualiza a documentação", "roda a doc", ou invocado como parte do fechamento de uma feature/release), siga o fluxo:

## Passo 1 — Coletar o que mudou

1. Identifique a última versão refletida em `docs-site/docs/changelog.md` (seção "Destaques recentes").
2. Leia `CHANGELOG.md` (raiz) de todas as versões posteriores a essa — extraia as entradas `### Adicionado`/`### Alterado`/`### Corrigido` visíveis ao usuário final (ignore `### Interno`).
3. Se a conversa atual tocou em código ainda não versionado/lançado, considere também essas mudanças.

## Passo 2 — Mapear mudanças para páginas

Para cada item do Passo 1, decida:
- **Já existe página que cobre isso** → precisa de atualização (cite a divergência exata: o que a página diz hoje vs. o que deveria dizer, com evidência do código real)
- **Feature nova sem cobertura** → precisa de seção nova numa página existente, ou página nova (proponha onde no `sidebars.js`)
- **Mudança interna/não visível ao usuário** → não precisa de mudança na documentação pública

Sempre verifique o código real antes de escrever qualquer detalhe técnico específico (nome de modelo, valor padrão, comportamento) — nunca parafraseie o CHANGELOG sem checar a fonte primária (ver "Achados reais" em `agents/documentacao.md` — é exatamente esse tipo de erro que já aconteceu no site).

## Passo 3 — Apresentar a proposta

Liste as mudanças candidatas, arquivo por arquivo:

```
PROPOSTA DE ATUALIZAÇÃO — aguardando aprovação

### docs-site/docs/{caminho}.md
**O que está desatualizado:** citação exata do texto atual
**Deveria dizer:** texto proposto
**Evidência:** arquivo:linha do código, ou versão do CHANGELOG.md
```

Se nada estiver desatualizado, diga isso explicitamente — não invente mudança pra justificar a execução.

## Passo 4 — Aguardar aprovação

**Não edite nenhum arquivo em `docs-site/` ainda.** Pergunte:

> "Confirma as atualizações acima? Ou quer ajustar/remover algum item antes de aplicar?"

## Passo 5 — Aplicar e publicar

Após aprovação explícita:
1. Edite os arquivos `.md` aprovados em `docs-site/docs/` (frontmatter `id`/`title`/`sidebar_label`/`slug` sempre presente; siga o padrão de callout `:::info` e tabelas já estabelecido).
2. Rode `npm run build` dentro de `docs-site/` pra confirmar que o build não quebra (`onBrokenLinks: 'throw'` — qualquer link interno quebrado falha o build).
3. Se pedido também para atualizar o `README.md` da raiz, aplique lá seguindo o mesmo padrão de verificação.
4. Informe que o commit/push fica a critério do usuário — **nunca commite ou dê push em `docs-site/` automaticamente sem confirmação explícita separada**, já que isso dispara o deploy real (`.github/workflows/deploy-docs.yml`) pro site público.

## O que NÃO fazer

- Não escrever detalhe técnico (nome de modelo, versão, comportamento) sem verificar o código real primeiro
- Não duplicar o `CHANGELOG.md` inteiro em `docs/changelog.md` — ele é um resumo curado, não uma cópia
- Não editar `docs-site/docs/tutorial-basics/`, `tutorial-extras/`, `blog/*` — são resíduo de scaffold do Docusaurus, não conteúdo do produto
- Não publicar (commit + push de `docs-site/`) sem confirmação explícita e separada da aprovação do conteúdo
