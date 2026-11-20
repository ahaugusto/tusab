---
id: intro
title: What Tusab is
sidebar_label: Introduction
slug: /intro
---

# What Tusab is

Tusab is an **extension for AI tools** (such as Claude Desktop) that keeps the user's knowledge base **on their own computer** and hands the AI only the right excerpts, **with citations**: the video and the exact minute, or the PDF page.

Technically, it is a local [MCP](https://modelcontextprotocol.io) server (`tusab-mcp/`, Node.js, version 2.0.0). The AI tool starts the process on the computer itself; it:

- **stores and indexes** YouTube video transcripts, documents (PDF, Word, Excel, CSV, Markdown), texts and results from public sources (papers, theses, legislation, open data) in a local folder;
- **answers the AI** through [15 MCP tools](/ferramentas-mcp): search, read a source in order, open a document's original file, add content, save study material;
- **offers ready-made requests** in the [Prompt Library](/biblioteca-de-prompts) (41 prompts, 20 of them based on evidence-based techniques, in the Claude "+" menu and on the screen);
- **serves a screen** in the browser, at `http://127.0.0.1:<port>`, to extract channels, organize the repository and view reports ([the Tusab screen](/tela)).

The one who converses, summarizes, builds quizzes and generates flashcards is **the user's AI**. Tusab takes care of the base: it extracts, indexes, finds the excerpt, cites the source and keeps what needs memory across conversations (for example, flashcard spaced repetition).

## Technical principle: the data stays on the computer

- YouTube extraction runs on the user's computer and IP address, with [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- Files, transcripts and the index stay in a local folder chosen at installation.
- Only the **queried excerpts** go to the AI the user chose (the AI tool where the extension is installed).
- **Nothing goes through a CriAugu server.** There is no account, login, telemetry or cloud sync.

Which connections leave the computer, and where they go, is in [Privacy](/privacidade) and [Security](/seguranca).

## Desktop app

Before the extension, Tusab was distributed as a desktop app (Electron + FastAPI backend) with its own chat. The app was **discontinued on 2026-11-19**: its code is preserved in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag, and the [1.0.x releases](https://github.com/criaugu/tusab/releases) remain published as history, with no further fixes or updates.

The extension uses **the same folder structure** as the bases created by the desktop app: former desktop users can point the extension to the app's data folder, and a `.tusab` file exported by the desktop app is imported by the extension. The app's documentation stays in the [Desktop app](/desktop/visao-geral) section as a record.

## Where to go next

- [Installation](/instalacao): `.mcpb` package in Claude Desktop or MCP configuration in other tools.
- [MCP tools](/ferramentas-mcp), [Prompt Library](/biblioteca-de-prompts) and [Tusab screen](/tela): how the AI and the user use the extension.
- [Features](/funcionalidades/extracao-youtube): extraction, repository, public sources, study, originals, languages, token savings.
- [Technical architecture](/arquitetura/visao-geral) and [Development](/desenvolvimento/setup): for anyone who will read, run or change the code.
