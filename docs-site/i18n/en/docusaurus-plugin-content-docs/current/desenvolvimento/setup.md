---
id: setup
title: Development setup
sidebar_label: Development setup
slug: /desenvolvimento/setup
---

# Development setup

## Prerequisites

- Node.js 18.17 or newer (the same minimum declared in `manifest.json`).
- Git.
- yt-dlp is optional: without it, the plugin downloads the official one on the first extraction.

## Clone and install

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab

# Interface (the screen is built from here)
cd web_interface
npm install
cd ..

# Plugin
cd tusab-mcp
npm install
npm run build:interface     # generates tusab-mcp/interface/ (vite build --mode extensao)
```

## Running without an AI tool

The command line uses the same engine as the plugin. Set the test folder first:

```powershell
cd tusab-mcp
$env:TUSAB_REPOSITORIO = "C:\path\test"

npm run painel                                        # opens the screen in the browser (Ctrl+C closes)
node src/cli.js painel --sem-navegador                # only prints the link
node src/cli.js projetos                              # lists projects
node src/cli.js indexar                               # syncs the index
node src/cli.js buscar "query" [project]              # searches the index
node src/cli.js youtube https://www.youtube.com/@channel Project 5   # extracts up to 5 videos
node src/cli.js medir-tokens questions.txt Project [output.csv]      # token savings test
```

## Running as an MCP server

```powershell
npm start        # = node src/index.js, MCP server over stdio
```

To use it in an AI tool during development, point its MCP configuration to `node <path>/tusab-mcp/src/index.js` with `TUSAB_REPOSITORIO` (see [Installation](/instalacao#other-ai-tools-claude-code-vs-code-cursor-gemini-cli-codex)).

## Environment variables

| Variable | Description |
|---|---|
| `TUSAB_REPOSITORIO` | Repository folder (root that contains `data/`). Default: `~/Tusab` |
| `TUSAB_YTDLP` | yt-dlp to use. `test/ytdlp-falso.mjs` replaces yt-dlp with a simulated one (3 videos, one without subtitles), with no network |
| `YTDLP_FALSO_ATRASO` | With the simulated yt-dlp, a delay in milliseconds (e.g. `800`) to watch progress on the screen |
| `TUSAB_IDIOMA` | Initial language (`pt`, `en`, `es`) |
| `TUSAB_SEM_BOAS_VINDAS` | `1` turns off opening the screen automatically on the first run in a folder |

## Interface in extension mode

The screen is `web_interface/` built with `vite build --mode extensao`, which reads `web_interface/.env.extensao` (`VITE_TUSAB_MODO=extensao`). In `web_interface/src/constants/index.js`, `MODO_EXTENSAO` becomes true and `API_BASE` becomes `/api`. Components that change in extension mode check `MODO_EXTENSAO`. After changing the interface, run `npm run build:interface` in `tusab-mcp/` again.

Without the built interface, the panel answers with a page asking you to run `npm run build:interface`.

## Code organization

See [Architecture overview](/arquitetura/visao-geral#main-modules). Practical rules:

- the MCP process's **stdout** is reserved for the protocol: warnings go to stderr;
- every sentence the user reads goes through `t()` and needs a translation in `src/nucleo/textos/en.js` and `es.js` (the language test fails otherwise);
- formats written to disk follow the desktop app and are not translated.
