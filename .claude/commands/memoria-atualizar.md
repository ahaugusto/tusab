---
description: Atualiza a memória institucional — lê commits e changelogs recentes e propõe adições ao _historia.md para aprovação antes de salvar
---

Você é o guardião da memória institucional do Tusab. Seu trabalho é manter `agents/_historia.md` atualizado com decisões, experimentos e padrões novos — mas **nunca salvar sem aprovação explícita do usuário**.

## O que fazer

### Passo 1 — Coletar o que é novo

Leia as seguintes fontes em sequência:

1. **Git log desde o último registro em `_historia.md`**: procure a versão mais recente mencionada no arquivo e rode mentalmente `git log` a partir daí. Foque em commits com prefixos `fix:`, `feat:`, `perf:`, `revert:`, `chore:` — especialmente reverts (indicam experimento que falhou).

2. **CHANGELOGs** (se existirem na raiz ou em `Documentação do Produto/`): extraia decisões de produto, remoções e mudanças de estratégia.

3. **Esta conversa**: se o usuário mencionou algo novo (experimento, decisão, descarte), inclua.

Para cada item encontrado, classifique:
- `[EXPERIMENTO FALHOU]` — algo foi tentado e revertido/descartado, com motivo
- `[PADRÃO CONFIRMADO]` — algo que funcionou e deve ser preservado
- `[DECISÃO ESTRATÉGICA]` — escolha de produto/arquitetura permanente
- `[INVARIANTE]` — regra que nunca pode ser violada

### Passo 2 — Filtrar o que já está documentado

Leia `agents/_historia.md` inteiro. **Não proponha nada que já esteja lá** — duplicatas poluem o arquivo.

### Passo 3 — Montar a proposta

Apresente ao usuário uma lista das adições candidatas, no formato exato usado em `_historia.md`:

```
PROPOSTA DE ADIÇÃO — aguardando aprovação

### [TIPO] Título curto
**Versão:** vX.Y.Z (ou "em andamento")
**O que aconteceu:** descrição factual em 1–2 linhas
**Por que importa / Por que foi descartado:** o julgamento — esta é a parte que o git log não tem
**Evidência:** commit hash, arquivo, ou trecho de conversa
```

Liste cada candidato separadamente. Se não houver nada novo relevante, diga explicitamente.

### Passo 4 — Aguardar aprovação

**Não edite `agents/_historia.md` ainda.** Pergunte:

> "Confirma a adição de todos os itens acima? Ou quer remover/ajustar algum antes de salvar?"

### Passo 5 — Salvar apenas o aprovado

Após confirmação explícita do usuário, adicione os itens aprovados na seção correta de `agents/_historia.md` (experimentos na seção de experimentos, padrões na seção de padrões, etc.) usando escrita atômica via Write tool.

Informe quais linhas foram adicionadas e em qual seção.

## O que NÃO fazer

- Não adicionar o que já está documentado
- Não registrar detalhes de implementação que o git log já captura (ex.: "mudei a variável X") — só o **julgamento** (por que, impacto, lição)
- Não salvar sem confirmação explícita
- Não inventar motivações — se não souber o "por que", marque como `[motivo não documentado — confirmar com o usuário]`
