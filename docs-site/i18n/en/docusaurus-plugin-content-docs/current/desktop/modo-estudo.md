---
id: modo-estudo
title: Desktop app — Study Mode
sidebar_label: Study Mode
slug: /funcionalidades/modo-estudo
---

# Desktop app — Study Mode

:::warning Desktop app discontinued
The desktop app was discontinued on 2026-11-19 and no longer receives fixes or updates. The code mentioned on this page is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag, no longer on `main`. This page is kept only as a record.
:::

In the desktop app, Study Mode **generates** study material with the LLM configured in the app, from the indexed base. In the extension, the user's AI generates it and Tusab stores the result in the same format (see [Study and spaced repetition](/funcionalidades/estudo)).

| | Desktop app | Extension |
|---|---|---|
| Who generates flashcards, summary and post-its | The LLM configured in the desktop app (Ollama or an external provider) | The user's AI, from the [prompts](/biblioteca-de-prompts) and the `tusab_buscar` excerpts |
| Where it stores | `neural/{projeto}/management/` and `neural/{projeto}/estudo/` | The same files, via `tusab_salvar_estudo` |
| Spaced repetition | In the Study tab | In the AI chat: `tusab_revisao_hoje` and `tusab_registrar_revisao` |
| Summary audio (text to speech) | Local, cached after the first generation | Doesn't exist |

Since the on-disk format is the same, a project studied in the app opens in the extension, and vice versa.

## Artifacts

| Artifact | What it is |
|---|---|
| **Flashcards** | Question and answer, with spaced repetition by the SM-2 algorithm (the same calculation as the extension) |
| **Summary** | Structured synthesis of the topic (Markdown) |
| **Post-its** | Key points in short sentences |

Quiz and Topics were removed from the desktop generator after end-to-end tests (quiz generation timing out and text extraction problems polluting the topics). In the extension, quizzes, mind maps, study plans and other formats are up to the AI, through the built-in prompts.

## Files

```
data/neural/{projeto}/management/
  flashcards.json             latest batch of flashcards
  postits.json                latest batch of post-its
  resumo_estudo.md            latest summary
  flashcards_progresso.json   spaced repetition state per card
  digest_AAAA-MM-DD.md        weekly digest
data/neural/{projeto}/estudo/
  _manifest.json              list of artifacts (most recent first)
  estudo_{tipo}_{data}.txt    artifact text (searchable)
  estudo_{tipo}_{data}.json   structured data
```

Each flashcard's ID is the first 12 hexadecimal characters of the SHA-1 of the question, the same as in the extension. In the extension, `tusab_salvar_estudo` refuses repeated questions in the same batch.

## Scoped generation and kanban

- Generation uses BM25 search to restrict the material to a topic and can be limited to chosen videos or documents in the project.
- Artifacts live in a kanban per project. The listing checks that the files still exist on disk before showing them.
- Clicking a card reopens the original experience; for flashcards, that includes flipping the card and grading it, with review progress preserved.
- Artifacts enter the desktop BM25 index and are also available through the [desktop MCP server](/funcionalidades/mcp-server).
