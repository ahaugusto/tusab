---
id: instalacao
title: Installation
sidebar_label: Installation
slug: /instalacao
---

# Installation

Tusab is installed as an extension (local MCP server) in the AI tool. Systems declared in the manifest: Windows (`win32`) and macOS (`darwin`).

:::note Desktop app discontinued
The desktop app (`.exe` and `.dmg` installers) was discontinued on 2026-11-19. Its documentation stays in the [Desktop app](/desktop/visao-geral) section as a record.
:::

## Claude Desktop: `.mcpb` package

<a className="button button--primary button--lg" href="https://github.com/criaugu/tusab/releases/download/v2.0.0/tusab-2.0.0.mcpb">Download Tusab 2.0.0 (.mcpb)</a>

SHA-256 checksum: the `tusab-2.0.0.mcpb.sha256` file, in the same [release](https://github.com/criaugu/tusab/releases/tag/v2.0.0), holds the package's checksum. To verify, compare it with the output of `Get-FileHash .\tusab-2.0.0.mcpb -Algorithm SHA256` (Windows, PowerShell) or `shasum -a 256 tusab-2.0.0.mcpb` (macOS).

The extension is distributed as an [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) package (`.mcpb`). The package carries the server code, the dependencies, the prebuilt screen and the license texts. Node.js comes with Claude Desktop itself, so there is nothing else to install.

1. Open the `tusab-2.0.0.mcpb` file with Claude Desktop installed; it shows the extension installation screen.
2. When Claude Desktop asks for the repository folder (field "Pasta do repositório"), choose a folder. Tusab creates `data/` inside it. To open a base created by the desktop app, choose the app's data folder (see [Data and storage](/arquitetura/dados-e-armazenamento#where-the-data-lives)).
3. On the first run in a folder, the plugin opens the Tusab screen in the browser once (marker in `data/config/boas_vindas.json`).

The chosen folder is passed to the server through the `TUSAB_REPOSITORIO` environment variable (field `user_config.repositorio` in `manifest.json`). Without that variable, the server uses `~/Tusab`.

Will you also use Tusab in another AI tool? See [Other AI tools](#other-ai-tools-claude-code-vs-code-cursor-gemini-cli-codex) and, above all, the [Precautions](#precautions): one AI at a time on the same base.

## Building the `.mcpb` from source

An alternative to the download above. The generated package is named `tusab.mcpb` and installs the same way.

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

## Other AI tools (Claude Code, VS Code, Cursor, Gemini CLI, Codex…)

Tusab works in any AI tool that accepts **local MCP servers** (which the tool starts on the computer itself, over stdio). There, installation is done by hand, in three steps: have Node.js, put Tusab's files in a folder, and point the tool to them.

:::info Where it does not work
Browser AIs (Claude.ai, ChatGPT, Gemini on the web) and the ChatGPT app only accept servers over the internet: they cannot reach the Tusab on this computer. To use them with your base, copy the request from the [Prompt Library](/biblioteca-de-prompts) and use **Open in browser**: Tusab copies the request with the excerpts from the base inside.
:::

### 1. Node.js: check and install

Claude Desktop ships its own Node.js; the other tools use the one installed on the computer. Tusab needs version **18.17 or newer**.

**Check whether it is installed.** Open PowerShell (Windows: Start menu › "PowerShell") or Terminal (macOS: Applications › Utilities › Terminal) and type:

```bash
node --version
```

- A number like `v22.11.0` shows up (18.17 or higher): go to step 2.
- A lower number shows up (for example, `v16.20.0`): update with the installer below.
- "`node` is not recognized as a command" (Windows) or "`command not found`" (macOS) shows up: Node.js is not installed.

**Install.** Download the **LTS** version from [nodejs.org](https://nodejs.org/) (Windows: `.msi` installer; macOS: `.pkg` installer) and follow the installer with the default options. If you prefer the command line, use `winget install OpenJS.NodeJS.LTS` (Windows) or `brew install node` (macOS, with Homebrew). Then **close and reopen** PowerShell or Terminal (and the AI tool) and check with `node --version`.

### 2. Put Tusab in a folder

The simplest way is to open the `.mcpb` package itself (the same one used by Claude Desktop) into a folder: it already has the server, the dependencies and the compiled screen, with nothing else to install.

1. Download the package from the [release](https://github.com/criaugu/tusab/releases) (`tusab-X.Y.Z.mcpb`) and check the SHA-256 checksum, as in Claude Desktop.
2. In PowerShell or Terminal, open the package into a folder (replace the file name and folder with yours):

```powershell
# Windows
npx --yes @anthropic-ai/mcpb@2.1.2 unpack "$HOME\Downloads\tusab-2.0.0.mcpb" "$HOME\tusab-servidor"
```

```bash
# macOS
npx --yes @anthropic-ai/mcpb@2.1.2 unpack ~/Downloads/tusab-2.0.0.mcpb ~/tusab-servidor
```

The file the tool will run is `tusab-servidor/src/index.js` inside that folder. To **update**, download the new package and open it into the same folder (your base data lives elsewhere and is not touched). If you prefer the source code, use a clone of the repository after `npm install` in `web_interface/` and `tusab-mcp/` and `npm run build:interface` in `tusab-mcp/`.

### 3. Configure the tool

All of them ask for the same three values:

| Value | What to use |
|---|---|
| Command | `node` |
| Argument | the full path of `src/index.js` in the folder from step 2 |
| `TUSAB_REPOSITORIO` variable | your base folder (the same one you chose in Claude Desktop, to use the same base) |

In the examples below, replace `augusto` with your user and the folders with yours. In JSON files on Windows, the backslash is doubled (`\\`).

**Claude Code** (in the terminal; `-s user` applies to all projects):

```powershell
claude mcp add tusab -s user -e TUSAB_REPOSITORIO="C:\Users\augusto\Tusab" -- node "C:\Users\augusto\tusab-servidor\src\index.js"
```

**Cursor** (`~/.cursor/mcp.json`), **Gemini CLI** (`~/.gemini/settings.json`) and other tools that use the `mcpServers` key:

```json
{
  "mcpServers": {
    "tusab": {
      "command": "node",
      "args": ["C:\\Users\\augusto\\tusab-servidor\\src\\index.js"],
      "env": { "TUSAB_REPOSITORIO": "C:\\Users\\augusto\\Tusab" }
    }
  }
}
```

On macOS, the paths look like `/Users/augusto/tusab-servidor/src/index.js` and `/Users/augusto/Tusab`.

**VS Code with GitHub Copilot** (`.vscode/mcp.json` in the project, or the "MCP: Add Server" command): the same block, with the `servers` key instead of `mcpServers` and `"type": "stdio"` inside `tusab`.

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.tusab]
command = "node"
args = ['C:\Users\augusto\tusab-servidor\src\index.js']
env = { TUSAB_REPOSITORIO = 'C:\Users\augusto\Tusab' }
```

After configuring, restart the tool and ask "open Tusab" or "list my Tusab projects". If the tool says the server did not start, check step 1 (`node --version` in the same terminal) and whether the path to `src/index.js` is right.

### What works in each tool

| Feature | Claude Desktop | Other tools |
|---|---|---|
| The 15 tools (search with citations, YouTube, documents, public sources, saving material, spaced repetition, token savings) | Yes | Yes |
| Tusab screen in the browser (opens by itself the first time; afterwards, ask "open Tusab") | Yes | Yes |
| **Open in Tusab** link after saving a material | Yes | Yes |
| Connection status in the "copied" notice | Yes, as "Claude Desktop" | Yes, with the name the tool reports |
| Ready-made shortcuts in **+** | Yes | Depends on the tool (in Claude Code they become `/` commands). Where they do not show up, copy the request from the Library |
| **Open Claude (app)** button in the "copied" notice | Yes | Not applicable: paste the request in the tool |
| Images from originals (`tusab_ler_original`) | Yes | In most; depends on the tool accepting images from the server |
| Installation | Open the `.mcpb` | Steps 1 to 3 |
| Node.js | Comes with Claude Desktop | Must be installed (18.17+) |

## Precautions

- **One AI at a time on the same base.** Each AI tool starts its own Tusab. Two of them open at the same time pointing to the same folder (for example, Claude Desktop and Claude Code) would write the same index and files at the same time, which can corrupt the base. Close one before opening the other, or use a different base folder for each.
- **The screen lives while the AI is open.** Tusab is started by the AI tool and closes with it; the screen in the browser stops responding when the AI closes.
- **The "Open in Tusab" link only works in that session.** The screen's port and key change each time the AI starts Tusab; an old link does not open. To see a material later, ask "open Tusab" and use the Materials tab.
- **Install only from the official repository.** Tusab runs with your user's permissions (Claude Desktop warns about this during installation). Download the package from the [releases](https://github.com/criaugu/tusab/releases) and check the SHA-256 checksum.
- **Up-to-date Node.js.** In the other tools, a Node.js version below 18.17 keeps Tusab from starting.

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
