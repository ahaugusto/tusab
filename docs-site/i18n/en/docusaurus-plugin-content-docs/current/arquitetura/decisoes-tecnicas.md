---
id: decisoes-tecnicas
title: Non-obvious technical decisions
sidebar_label: Technical decisions
slug: /arquitetura/decisoes-tecnicas
---

# Non-obvious technical decisions

Decisions that wouldn't be evident just from reading the code; the reason matters as much as the decision. Those of the desktop app's Python backend are in [Desktop app — technical decisions](/desktop/decisoes-tecnicas).

| Decision | Reason |
|---|---|
| The user's AI generates the material; Tusab only delivers the request and keeps the memory | The AI converses, summarizes and builds quizzes better; what it doesn't do is remember across conversations. That's why Tusab keeps flashcards and spaced repetition (`tusab_salvar_estudo`, `tusab_revisao_hoje`) and offers [built-in prompts](/biblioteca-de-prompts) instead of generating |
| One instance serves the AI (MCP) and the screen (HTTP) | What the AI requests shows up on the screen and vice versa, with no sync between processes |
| `console.log`/`info`/`debug` redirected to stderr before any module loads | stdout is the MCP protocol channel; a library warning (pdfjs warns when an optional component is missing) would corrupt the conversation with the AI |
| Same on-disk format as the desktop app, including Portuguese labels | The extension opens existing desktop bases and `.tusab` works both ways |
| `.txt` as the source of truth; SQLite only as a rebuildable index | The index can be deleted and rebuilt at any time; no data exists only in it |
| SQLite in WebAssembly (`@sqlite.org/sqlite-wasm`), no native binary | The `.mcpb` package works on Windows and macOS without compiling anything on the user's computer |
| In-memory database with atomic writes and a lock file | More than one AI tool may open the same repository at the same time |
| Question converted into quoted terms joined by `OR` | Always a valid FTS5 expression: characters in the question never become query operators |
| Metadata, chapters and subtitles in a single yt-dlp call per video | The desktop app makes three calls; fewer calls, less risk of 429 blocking |
| Official yt-dlp downloaded with a SHA-256 check | The package doesn't need to carry the binary; a tampered download is discarded |
| Screen served by the plugin, not by a website | Browsers such as Firefox and Safari don't let a website write to a folder on the computer; here the browser only displays and the plugin writes |
| Session key in a custom header (`X-Tusab-Chave`) and no CORS header | A custom header forces a preflight on requests from other sites, and the server allows none |
| `Host` checked on every request | Protection against DNS rebinding |
| Language (`X-Tusab-Idioma`) read only after the key | Anyone without the key changes nothing in the plugin, not even the language |
| Original's path always recomputed, never read from the manifest | A tampered manifest can't point outside the project folder |
| File type checked by signature, not only by name extension | An executable renamed to `.pdf` is refused |
| Image metadata removal fails closed | If it can't be guaranteed that the location was removed, the image doesn't go to the AI |
| Token savings estimated locally (~4 characters per token) | An exact count would require sending the text to the AI service; and only aggregate numbers are stored |
| Search and citation rules added by the plugin, outside the editable text | They also apply to user prompts, which can't remove them by mistake |
| Tool technical descriptions in Portuguese; titles in the screen's language | Only the AI reads the descriptions (and the instructions ask for answers in the user's language); the title is shown to the user in the conversation |
| Disk formats and search terms sent to sources kept out of translation | Changing the screen language must not change what is written or what is asked of the sources |

## Splitting into excerpts

The same rules as the desktop app, for the same `.txt` files: by YouTube chapter when there are chapters; otherwise, 120 s windows with 15 s overlap; cap of 3,000 characters per excerpt, cut at a subtitle line boundary. Documents and texts are indexed by paragraph; PDFs carry the `[Página N]` marker so the AI can cite the page.
