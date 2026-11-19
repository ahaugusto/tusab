---
id: instalacao
title: Installation
sidebar_label: Installation
slug: /instalacao
---

# Installation

Tusab is installed as an extension (local MCP server) in the AI tool. Systems declared in the manifest: Windows (`win32`) and macOS (`darwin`). For the desktop app (`.exe` and `.dmg` installers), see [Desktop app — installation](/desktop/instalacao).

## Claude Desktop: `.mcpb` package

The extension is distributed as an [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) package (`tusab.mcpb`). The package carries the server code, the dependencies, the prebuilt screen and the license texts. Node.js comes with Claude Desktop itself, so there is nothing else to install.

:::note The `.mcpb` is not published in releases yet
For now, the [GitHub releases](https://github.com/criaugu/tusab/releases) carry only the desktop app installers. To get `tusab.mcpb`, build the package from source (below).
:::

1. Open the `tusab.mcpb` file with Claude Desktop installed; it shows the extension installation screen.
2. When Claude Desktop asks for the repository folder (field "Pasta do repositório"), choose a folder. Tusab creates `data/` inside it. To open a base created by the desktop app, choose the app's data folder (see [Data and storage](/arquitetura/dados-e-armazenamento#where-the-data-lives)).
3. On the first run in a folder, the plugin opens the Tusab screen in the browser once (marker in `data/config/boas_vindas.json`).

The chosen folder is passed to the server through the `TUSAB_REPOSITORIO` environment variable (field `user_config.repositorio` in `manifest.json`). Without that variable, the server uses `~/Tusab`.

## Building the `.mcpb` from source

Prerequisite: Node.js 18.17 or newer.

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab/web_interface
npm install          # the extension screen is built from here
cd ../tusab-mcp
npm install
npm run pack         # builds the screen, generates the license notices and creates ../tusab.mcpb
```

The file is written to the repository root (`tusab.mcpb`). `npm run pack` uses `@anthropic-ai/mcpb@2.1.2` through `npx`.

## Other MCP-compatible tools (Claude Code, VS Code, Cursor…)

Any MCP client that starts servers over **stdio** can run the plugin straight from source, after `npm install` in `tusab-mcp/` and `npm run build:interface` (for the screen to work):

```json
{
  "mcpServers": {
    "tusab": {
      "command": "node",
      "args": ["<path>/tusab/tusab-mcp/src/index.js"],
      "env": { "TUSAB_REPOSITORIO": "<repository folder>" }
    }
  }
}
```

The exact configuration file format depends on each tool; what matters is the command (`node`), the argument (`src/index.js`) and the `TUSAB_REPOSITORIO` variable.

## yt-dlp

The plugin looks for yt-dlp in this order: the `TUSAB_YTDLP` variable, a copy in `data/bin/`, `yt-dlp` on the `PATH`. If none is found, it downloads the official binary from `github.com/yt-dlp/yt-dlp/releases/latest` and checks the published SHA-256 sum (`SHA2-256SUMS`); if it doesn't match, the download is discarded.

## Environment variables

| Variable | Use |
|---|---|
| `TUSAB_REPOSITORIO` | Repository folder (the root that contains `data/`). Default: `~/Tusab` |
| `TUSAB_YTDLP` | Path to a yt-dlp to use instead of the downloaded one |
| `TUSAB_IDIOMA` | Initial language (`pt`, `en` or `es`) before the screen sets one |
| `TUSAB_SEM_BOAS_VINDAS` | `1` turns off opening the screen automatically on the first run |

## First steps

1. Ask the AI to open Tusab (or use the **Open Tusab** shortcut in Claude Desktop's "+" menu).
2. On the screen, choose language, theme and profile, and add a YouTube channel, documents or a public source search. The AI can also add a channel with `tusab_adicionar_youtube`.
3. Ask in the conversation: the AI searches the base with `tusab_buscar` and cites video and minute, or document and page.
