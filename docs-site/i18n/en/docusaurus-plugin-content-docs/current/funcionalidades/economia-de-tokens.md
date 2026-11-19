---
id: economia-de-tokens
title: Token savings
sidebar_label: Token savings
slug: /funcionalidades/economia-de-tokens
---

# Token savings

Tusab measures how much the AI received from Tusab (excerpts only) compared to what it would receive if the full sources were attached to the conversation. The code is in `tusab-mcp/src/nucleo/tokens.js`.

## How the estimate is made

- **Local estimate of ~4 characters per token** (`CARACTERES_POR_TOKEN = 4`). An exact count would require sending the text to the AI service, which Tusab doesn't do. The real number varies with the model and the language.
- On each call to `tusab_buscar`, `tusab_ler_fonte` and `tusab_ler_original` (PDF pages), the plugin adds up:
  - **sent:** estimated tokens of the response the tool returned;
  - **without Tusab:** estimated tokens of the full text of the sources the excerpts came from.

## What is stored

Only aggregate numbers, in `data/config/economia_tokens.json`: total queries, tokens sent, "without Tusab" tokens, subtotals per tool and per day (the daily count keeps the last 90 days). **The question and the text are never stored.** The counter can be reset on the screen.

## Where to see it

- Through the AI: tool `tusab_economia`.
- On the screen: the **Token savings** button in the [Prompt Library](/biblioteca-de-prompts), with an explanation of the calculation, the accumulated real usage and the test with your own questions.

## Test with your own questions

The "with and without Tusab" test runs the user's questions against a project, without calling any AI. For each question, it compares:

- tokens of the excerpts the AI would receive (up to 8 excerpts, as in `tusab_buscar`);
- tokens of the full sources of those excerpts (attaching only the right files);
- tokens of the whole project (attaching everything).

On the screen, questions are written one per line (up to 50). From the command line, in `tusab-mcp/`:

```powershell
$env:TUSAB_REPOSITORIO = "C:\path\to\repository"
node src/cli.js medir-tokens questions.txt <project> [output.csv]
```

`questions.txt` has one question per line. The command shows a table per question, the total savings against "full sources" and against "whole project", and how many questions had no answer in the base. With `output.csv`, it writes the columns `pergunta, trechos, tokens_tusab, tokens_fontes_inteiras, tokens_projeto_inteiro`.
