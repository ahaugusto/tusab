---
id: mcp-server
title: Desktop app — MCP server
sidebar_label: Desktop MCP server
slug: /funcionalidades/mcp-server
---

# Desktop app — MCP server

:::warning Desktop app discontinued
The desktop app was discontinued on 2026-11-19 and no longer receives fixes or updates. The code mentioned on this page is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag, no longer on `main`. This page is kept only as a record.
:::

The repository has **two different MCP servers**. This page covers the server that ships with the **desktop app**. Tusab itself, distributed as an AI extension, is the other one: see [MCP tools](/ferramentas-mcp) and [Architecture](/arquitetura/visao-geral).

| | Desktop server | AI extension |
|---|---|---|
| Code | `tusab_engine/mcp_server.py` (Python) | `tusab-mcp/` (Node.js) |
| Transport | stdio, line-by-line JSON-RPC 2.0 | stdio, official MCP SDK |
| Tools | 2: `search_knowledge`, `list_projects` | [15](/ferramentas-mcp): search, reading, extraction, public sources, study, originals, token savings… |
| Prompts | — | 21 built-in prompts + `abrir_tusab` |
| Index | The desktop index (`data/agent_index/`), the Assistant's BM25 search | Its own SQLite FTS5 (`data/tusab.sqlite`), synced from the `.txt` files |
| Screen | Serves no screen (the desktop app is the screen) | Serves the Tusab screen on `127.0.0.1` |
| Installation | Configuration copied from the app (below) | `.mcpb` package or `node src/index.js` configuration |

Both read the same folder structure, but each uses its own index.

## How to connect

1. In the desktop app, open the **Admin** tab.
2. Click **Copy MCP configuration**.
3. Paste the configuration into the MCP client (Claude Code, Cursor, Continue.dev…).

The configuration comes from `GET /agent/mcp/config` and points to the app's own Python and the path of `tusab_engine/mcp_server.py`:

```json
{
  "mcpServers": {
    "tusab": {
      "command": "<Tusab's python>",
      "args": ["<...>/tusab_engine/mcp_server.py"]
    }
  }
}
```

## Tools

| Tool | Parameters | What it does |
|---|---|---|
| `search_knowledge` | `query` (required); `project` (without it, uses the project indexed in the Assistant configuration or the first available); `top_k` (default 6) | BM25 search over the base indexed by the desktop app, returning title, text, link, date, channel and score for each excerpt |
| `list_projects` | — | Lists the projects that have an index file in `data/agent_index/` |

Everything in the desktop index is available: transcripts, documents, texts and the [Study Mode](/funcionalidades/modo-estudo) artifacts.
