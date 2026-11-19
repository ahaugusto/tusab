---
id: modo-estudo
title: App desktop — Modo Estudo
sidebar_label: Modo Estudo
slug: /funcionalidades/modo-estudo
---

# App desktop — Modo Estudo

:::warning App desktop descontinuado
O app desktop foi descontinuado em 19/11/2026 e não recebe mais correções nem atualizações. O código citado nesta página está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), não mais no `main`. Esta página é mantida só como registro.
:::

No app desktop, o Modo Estudo **gera** material de estudo com o LLM configurado no app, a partir da base indexada. Na extensão, quem gera é a IA do usuário e o Tusab guarda o resultado no mesmo formato (ver [Estudo e revisão espaçada](/funcionalidades/estudo)).

| | App desktop | Extensão |
|---|---|---|
| Quem gera flashcards, resumo e post-its | O LLM configurado no desktop (Ollama ou provedor externo) | A IA do usuário, a partir dos [prompts](/biblioteca-de-prompts) e dos trechos de `tusab_buscar` |
| Onde guarda | `neural/{projeto}/management/` e `neural/{projeto}/estudo/` | Os mesmos arquivos, via `tusab_salvar_estudo` |
| Revisão espaçada | Na aba Estudo | No chat da IA: `tusab_revisao_hoje` e `tusab_registrar_revisao` |
| Áudio do resumo (texto para voz) | Local, guardado depois da primeira geração | Não existe |

Como o formato em disco é o mesmo, um projeto estudado no app abre na extensão, e vice-versa.

## Artefatos

| Artefato | O que é |
|---|---|
| **Flashcards** | Pergunta e resposta, com repetição espaçada pelo algoritmo SM-2 (o mesmo cálculo na extensão) |
| **Resumo** | Síntese estruturada do tema (Markdown) |
| **Post-its** | Pontos-chave em frases curtas |

Quiz e Tópicos foram removidos do gerador do desktop depois de testes de ponta a ponta (tempo esgotado na geração de quiz e problemas de extração de texto que poluíam os tópicos). Na extensão, quiz, mapa mental, plano de estudo e outros formatos ficam a cargo da IA, pelos prompts prontos.

## Arquivos

```
data/neural/{projeto}/management/
  flashcards.json             último lote de flashcards
  postits.json                último lote de post-its
  resumo_estudo.md            último resumo
  flashcards_progresso.json   estado da revisão espaçada por card
  digest_AAAA-MM-DD.md        digest semanal
data/neural/{projeto}/estudo/
  _manifest.json              lista dos artefatos (mais recente primeiro)
  estudo_{tipo}_{data}.txt    texto do artefato (pesquisável)
  estudo_{tipo}_{data}.json   dados estruturados
```

O ID de cada flashcard são os 12 primeiros caracteres hexadecimais do SHA-1 da pergunta, igual na extensão. Na extensão, `tusab_salvar_estudo` recusa perguntas repetidas no mesmo lote.

## Geração escopada e kanban

- A geração usa a busca BM25 para restringir o material a um tema e pode ser limitada a vídeos ou documentos escolhidos do projeto.
- Os artefatos ficam num kanban por projeto. A listagem confere se os arquivos ainda existem em disco antes de mostrar.
- Clicar num card reabre a experiência original; nos flashcards, isso inclui virar a carta e avaliar, com o progresso da revisão preservado.
- Os artefatos entram no índice BM25 do desktop e ficam disponíveis também pelo [servidor MCP do desktop](/funcionalidades/mcp-server).
