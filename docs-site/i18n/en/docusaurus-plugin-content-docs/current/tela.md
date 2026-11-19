---
id: tela
title: The Tusab screen (local panel)
sidebar_label: Tusab screen
slug: /tela
---

# The Tusab screen (local panel)

The plugin serves the Tusab screen in the browser (the React interface from `web_interface/`, built in extension mode). The browser only displays the screen; the plugin process is what writes to the folder, extracts from YouTube and indexes. That's why the screen works the same in any browser.

## How to open it

- By asking the AI (tool `tusab_abrir_painel`) or through the **Open Tusab** shortcut in Claude Desktop's "+" menu.
- Automatically, once, on the plugin's first run in a folder.
- From the command line, without an AI tool: `npm run painel` in `tusab-mcp/` (`Ctrl+C` closes it).

The address has the form `http://127.0.0.1:<port>/?chave=<session key>`. It only works on this computer and while the AI tool is open. **The link carries the session key and must not be shared.** On opening, the screen keeps the key only in that tab (`sessionStorage`), removes it from the address bar and sends it in the `X-Tusab-Chave` header of every call. If the key is missing or the plugin has closed, the screen shows a notice instead of failing silently.

## What the screen has

- **Extraction:** YouTube (channel, playlists, tabs, period) and public sources, with queue, pause, live log and automatic channel updates.
- **Repository:** documents, texts and web pages per project; delete and clear; space used (originals × text); "Text only" marker; **Ask the AI** button.
- **Prompt Library:** the built-in prompts and "My prompts", to copy into any AI (see [Prompt Library](/biblioteca-de-prompts)). After copying, a notice leads to the Claude app or to the browser AI and shows the connection state: whether the plugin is linked to an AI tool (the name it reports when connecting) and, after the copy, when the AI used a Tusab tool (`GET /api/conexao`, polled every 2 s while the notice is open).
- **Materials:** what the AI saved with `tusab_salvar_estudo` (flashcards, summaries, sticky notes and documents), by project, each one opened in a dialog (see [Study and spaced repetition](/funcionalidades/estudo)).
- **Report** per channel, **Overview** and **Monitor** (Specialist profile), **Admin**.
- **Exports:** `.tusab` (with or without originals), zip of the base, video table (XLSX) and PDF report; `.tusab` import.

There is no chat, conversation history, LLM configuration, Ollama, Google Drive or telemetry: the conversation happens in the AI tool. The screen is the same React interface as the [desktop app](/desktop/visao-geral) built in extension mode, so the tabs that depend on chat are left out. The onboarding includes a step explaining how to ask the connected AI; the analytics module loads nothing.

## Local server security

A server on `127.0.0.1` can be targeted by other websites open in the same browser. The protections, in `tusab-mcp/src/painel.js`:

| Protection | How |
|---|---|
| Local only | Listens on `127.0.0.1`, on a port picked by the system (random), only while the plugin is open |
| Per-session key | 32 random bytes (256 bits) generated at each start. Every call to `/api/*` requires the key in the `X-Tusab-Chave` header; comparison is constant-time. Without the key: HTTP 401 |
| `Host` checked | A request with `Host` other than `127.0.0.1:<port>` is refused (HTTP 421), against DNS rebinding |
| `Origin` and `Sec-Fetch-Site` | When present, they must come from the panel itself (`same-origin` or `none`); otherwise, HTTP 403 |
| No CORS | No CORS header is sent. Since the key travels in a custom header, a request from another site would need a preflight that the server never allows |
| Language only after the key | The `X-Tusab-Idioma` header is read only after the key is checked |
| Methods and body | Only `GET`, `POST` and `DELETE` on `/api/*`. Body only as JSON (up to 12 MB) or `multipart/form-data` for file upload (up to 50 MB per document; a separate limit for `.tusab` import) |
| Static files | Only from inside the `interface/` folder, with known file types |
| Headers | CSP `default-src 'none'` with `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`; images also from `*.ytimg.com`, `*.ggpht.com` and `*.googleusercontent.com` (YouTube thumbnails). Also `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy` and `Cross-Origin-Opener-Policy` `same-origin` |
| Opening the browser | The link is validated by a regular expression and opened without a shell (`rundll32` on Windows, `open` on macOS, `xdg-open` elsewhere) |

## API

The screen talks to the plugin through the `/api/*` routes (`tusab-mcp/src/api.js`). They repeat the desktop app's API contracts (same field names), inherited from when the same interface served both. Desktop routes with no counterpart in the extension (chat, LLM configuration, Ollama) answer neutrally.
