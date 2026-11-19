---
id: visao-geral
title: Architecture overview
sidebar_label: Overview
slug: /arquitetura/visao-geral
---

# Architecture overview

Tusab (`tusab-mcp/`, version 0.6.0) is an [MCP](https://modelcontextprotocol.io) server written in Node.js (ESM, Node 18.17 or newer). The user's AI tool starts the process on the computer itself and talks to it over standard input and output (**stdio**). The same process:

- answers the AI through the [MCP tools](/ferramentas-mcp) and the [prompts](/biblioteca-de-prompts);
- serves the [Tusab screen](/tela) at `http://127.0.0.1:<random port>`;
- runs the YouTube extraction engine, document reading, public sources and the search index.

Since the AI and the screen use **the same instance**, an extraction requested by the AI shows up on the screen, and what the user does on the screen is available to the AI.

```
AI tool (Claude Desktop, Claude Code, VS Code, Cursor...)
        │  stdio (MCP JSON-RPC)
        ▼
tusab-mcp  (Node process on the user's computer)
  ├── MCP server ........ 15 tools + 22 prompts
  ├── HTTP panel ........ 127.0.0.1:<port>, per-session key  ◄── user's browser
  ├── engine ............ yt-dlp, documents, public sources, exports
  └── index ............. SQLite FTS5 (WebAssembly) in data/tusab.sqlite
        │
        ▼
<repository folder>/data/
```

## Process lifecycle

- **Start:** the AI tool runs `node src/index.js`. Before any module loads, `console.log`, `console.info` and `console.debug` are redirected to stderr, because stdout is reserved for the MCP protocol.
- **Screen:** the HTTP server only starts when requested (tool `tusab_abrir_painel`, prompt `abrir_tusab` or the automatic opening on the first run in a folder).
- **End:** when the AI tool closes, the process's stdin ends; the plugin closes the panel and exits. The screen stops working with it.
- **Automatic channel updates:** with the plugin open, the check for new videos runs a few seconds after startup and then every hour (only for channels with the option on).

## Search index

- Engine: official SQLite compiled to WebAssembly (`@sqlite.org/sqlite-wasm`), **FTS5** virtual table with `tokenize = 'unicode61 remove_diacritics 2'` (accent-insensitive search) and ranking by `bm25()`.
- The natural-language question becomes a safe FTS5 expression: quoted terms only, joined by `OR`.
- **The `.txt` files are the source of truth**; `data/tusab.sqlite` can be rebuilt. Sync is per file (modification time and size):
  - `neural/{projeto}/youtube/**/{canal}_Parte_N.txt`: one excerpt per block, with minute;
  - `neural/{projeto}/texts/*.txt` and `documents/*.txt`: excerpts by paragraph.
- The database lives in memory and is written atomically under a lock file, because more than one AI tool may open the same repository.

## Folder structure

The root is the folder chosen at installation (`TUSAB_REPOSITORIO` variable; equivalent to the desktop app's `TUSAB_DATA_DIR`):

```
<folder>/data/
  neural/{projeto}/
    youtube/{canal}/{canal}_Parte_N.txt    transcripts in blocks with minute
    youtube/{canal}/{canal}_meta.json      channel metadata
    documents/                             text extracted from documents + _manifest.json
    documents/originais/                   uploaded original files
    texts/                                 texts + _manifest.json
    management/{canal}_base.csv            management sheet (status per video)
    management/{canal}_summary.json        channel summary, filter used, automatic updates
    management/flashcards*.json, ...       study memory (same format as the desktop app)
    estudo/                                saved study material
  config/
    extraction_queue.json                  extraction queue
    prompts_usuario.json                   "My prompts"
    idioma.json                            language chosen on the screen
    economia_tokens.json                   aggregate token counter
    auto_update.json                       last channel check
    boas_vindas.json                       first-opening marker
  temp/                                    temporary subtitles
  bin/                                     yt-dlp downloaded by the plugin
  tusab.sqlite                             search index
```

The file formats (`.txt` blocks, CSV columns and statuses, manifests, flashcards and SM-2 spaced repetition) are the same as the desktop app's. Project names go through the same cleaning rule (`[<>:"/\|?*\s]` becomes `_`), with one extra protection: leading dots are removed.

## Main modules

| File | Role |
|---|---|
| `src/index.js` | Entry point; protects stdout and starts the server |
| `src/servidor.js` | MCP server over stdio: tools, prompts, instructions for the AI |
| `src/painel.js` | Local HTTP server for the screen, with the security protections |
| `src/api.js` | `/api/*` routes with the same contracts as the desktop API; features that don't exist in the extension answer neutrally |
| `src/cli.js` | Command line with the same engine (without the AI) |
| `src/nucleo/motor.js`, `ytdlp.js`, `legendas.js` | YouTube extraction (port of the Python engine) |
| `src/nucleo/indice.js` | SQLite FTS5 index |
| `src/nucleo/documentos.js`, `repositorio.js`, `originais.js` | Documents, repository and originals |
| `src/nucleo/exportar.js` | Exports and the `.tusab` file |
| `src/nucleo/atualizacao.js` | Automatic channel updates |
| `src/nucleo/estudo.js` | Study memory and spaced repetition |
| `src/nucleo/prompts.js` | Prompt Library |
| `src/nucleo/idioma.js`, `textos/` | Languages (pt, en, es) |
| `src/nucleo/tokens.js` | Token savings |
| `src/fontes/` | The 70 public sources |

## Dependencies

`@modelcontextprotocol/sdk` (MCP server), `@sqlite.org/sqlite-wasm` (index), `pdfjs-dist` (PDF), `mammoth` (DOCX), `read-excel-file` and `write-excel-file` (XLSX), `pdfkit` (PDF report), `fflate` (zip and `.tusab`), `fast-xml-parser` (sources that answer in XML) and `zod` (tool parameter validation). Pinned versions in `tusab-mcp/package.json`. There is no native binary: SQLite runs in WebAssembly and yt-dlp is the official binary, downloaded with a SHA-256 check when the computer doesn't have it.

## The screen (`web_interface/`)

The screen is the React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React + react-i18next interface from `web_interface/`, built in extension mode:

| Item | Detail |
|---|---|
| Command | `npm run build:interface` in `tusab-mcp/` (runs `vite build --mode extensao` in `web_interface/`) |
| Output | `tusab-mcp/interface/`, served by the panel |
| What the mode changes | `VITE_TUSAB_MODO=extensao` (`web_interface/.env.extensao`) turns on `MODO_EXTENSAO` in `src/constants/index.js`: `API_BASE='/api'`, session key on calls, no Google fonts or sourcemaps (CSP `'self'`), no telemetry, no chat |

The same code builds the [desktop app](/desktop/visao-geral) interface with `npx vite build`.

## What stays with the user's AI

Conversing, summarizing, building quizzes and generating flashcards. Tusab has no chat of its own, LLM, Ollama, vector search, Google Drive, audio transcription, OCR or telemetry: it delivers the excerpts, keeps what needs memory across conversations and takes care of the base. Those features exist in the [desktop app](/desktop/visao-geral).

## Patterns

- **Atomic writes:** files are written to a temporary file and renamed in one step (`escreverAtomico` in `src/nucleo/caminhos.js`).
- **Same format as the desktop app:** the `src/nucleo/` modules are ports of the Python engine and write the same `.txt`, CSV, manifests and study JSON.
- **Windows and macOS:** code that touches paths, subprocesses or the browser branches by platform (`process.platform`) in the same file.

More details in [Data and storage](/arquitetura/dados-e-armazenamento) and [Technical decisions](/arquitetura/decisoes-tecnicas).
