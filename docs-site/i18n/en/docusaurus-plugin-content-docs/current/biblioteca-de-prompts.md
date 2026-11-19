---
id: biblioteca-de-prompts
title: Prompt Library
sidebar_label: Prompt Library
slug: /biblioteca-de-prompts
---

# Prompt Library

Tusab doesn't generate flashcards, quizzes or summaries: the user's AI does. Tusab delivers the **ready-made request**, already tied to the base (search the project, cite the source, don't make things up), and **keeps** what needs memory across conversations (flashcards and spaced repetition).

A single list (`tusab-mcp/src/nucleo/prompts.js`) feeds two places:

- Claude Desktop's **"+" menu** (MCP prompts), where the user picks the prompt and fills in the project and, where applicable, topic and quantity;
- the **Prompt Library** tab of the [Tusab screen](/tela) (`GET /api/prompts`), to copy and paste into any AI.

## The 21 built-in prompts

| Category | Prompts | Fields |
|---|---|---|
| **Study** | Flashcards · Review today · Multiple-choice quiz · Study summary · Mind map (Mermaid) · Explain it simply · Study plan | project; topic and quantity depending on the prompt |
| **Teach** | Exam with answer key · Lesson plan · Exercises by level | project, topic; quantity in the exam and exercises |
| **Research** | Material review · Compare sources and contradictions · Gaps in the base · Reading notes per source · Timeline · Key quotes | project, topic; quantity in the quotes |
| **Decide** | Verifiable answer · Briefing note | project, topic |
| **Create content** | Video script · LinkedIn post | project, topic |
| **Keep up** | Weekly digest | project |

Default quantities: 8 in the quiz, 7 days in the study plan, 10 in the exam and the quotes, 9 in the exercises. The value given is kept between 1 and 50. The topic is cut at 200 characters and the project name at 120.

Besides these, the `abrir_tusab` shortcut ("Open Tusab") opens the screen. Claude's "+" menu therefore shows **22 shortcuts**.

## Fixed rules added by the plugin

When building the final text, the plugin appends the search and citation rules to the request, in the screen's language:

> Search the Tusab base in the project "\{projeto\}" with tusab_buscar (and tusab_ler_fonte when you need more context). Use only what is in the excerpts; if information is missing, say what is missing. Cite every statement with the source title and, for videos, the minute with the link (▶ MM:SS); for PDFs, the page marked in the excerpt ([Página N]) — if the excerpt does not show the page, do not make it up.

- The rules **are not editable** and also apply to prompts created by the user.
- Two exceptions: **Review today** and **Weekly digest** already state which tools to use in the request itself (`tusab_revisao_hoje`/`tusab_registrar_revisao` and `tusab_novidades_semana`), so they don't get the rules.
- Flashcards and Study summary end by asking the AI to save the result with `tusab_salvar_estudo`. The prompts that produce a document (quiz, mind map, study plan, test, lesson plan, exercises, literature review, reading sheet, timeline, technical note, script and post) ask it to save the complete material as `documento`, to open later in the **Materials** tab.
- Every request starts with a connection check: if the Tusab tools are not available in the conversation, the AI must say that Tusab is not connected instead of answering from memory. This also applies to the user's own prompts and to anyone who pastes the request into a browser AI, which cannot reach the local Tusab.

## My prompts

The user creates their own prompts on the screen, from scratch or with "Duplicate and edit" from a built-in one.

- Stored in `data/config/prompts_usuario.json`; limit of 50 prompts, title up to 80 characters, description up to 200, request up to 4,000.
- Placeholders in the request text:
  - `{tema_frase}` becomes ` about "<topic>"` (or nothing, if the topic is empty) and makes the **topic** field appear;
  - `{quantidade}` becomes the number given (default 10) and makes the **quantity** field appear.
- **Folders:** each prompt can have a folder (up to 40 characters). A folder can be renamed or dissolved (the prompts stay). In Claude's "+" menu, the title shows as `Folder › Title`.
- Creating, changing or deleting a prompt on the screen updates Claude's "+" menu **immediately, without restarting** (the server notifies the AI tool that the prompt list changed).

## On the screen

- Search by name, description, text or folder, accent-insensitive.
- Each card has **Copy** and **Adjust** (editable preview). If the browser denies automatic copying, the preview opens for copying by hand.
- **Copied notice:** after copying, a notice offers to open the Claude app (`claude://` address) or an AI in the browser (Claude.ai, ChatGPT or Gemini; the choice is remembered in the browser). The notice points out that, in the browser, the AI can't reach Tusab on this computer: the copied request works as text, but the MCP tools only exist in the AI tool where the extension is installed.
- In the Repository, each project's **Ask the AI** button copies frequent requests already filled in with the project, or opens the Library on that project.
- The Library's **Token savings** button opens the window described in [Token savings](/funcionalidades/economia-de-tokens).
