---
id: changelog
title: Changelog
sidebar_label: Changelog
slug: /changelog
---

# Changelog

Technical summary of the versions. From 2.0.0 on, Tusab is only the AI extension; the numbering continues the product's (the desktop app stopped at 1.0.64). The desktop's complete history, in [Keep a Changelog](https://keepachangelog.com) format, is in [`CHANGELOG.md`](https://github.com/criaugu/tusab/blob/main/CHANGELOG.md).

## Extension (`tusab-mcp/`)

**v2.0.0 (2026-11-19)** — Tusab becomes only the AI extension; the desktop app is discontinued.

- First version of the extension published in the [releases](https://github.com/criaugu/tusab/releases) as `tusab-2.0.0.mcpb`, with a SHA-256 checksum next to it. GitHub Actions builds the release from the tag: tests, compiled screen, license notices and package.
- Square icon in the package (light and dark theme versions), made from the logo.
- **Materials** tab: what the AI saves in Tusab opens in a dialog on the screen (flashcards with spaced repetition, summaries, sticky notes and documents). New `documento` type in `tusab_salvar_estudo` (Markdown, up to 60,000 characters), and the prompts that produce documents (quiz, mind map, lesson plan, test, technical note…) ask to save them.
- Connection with the AI: every prompt starts with a check (without the Tusab tools, the AI warns instead of answering from memory), and the "copied" notice shows whether Tusab is connected and confirms when the AI queried the base (`GET /api/conexao`).
- Prompt Library: 20 new prompts based on evidence-based techniques (pretest, free recall, interleaved practice, worked example, backward design, rubric, PRISMA, thematic analysis, pre-mortem, competing hypotheses…), with the reference on screen; "What for" tabs (Study, Teach, Research, Work and decisions) instead of profiles, which become a single one in the extension; suggested model badge (Fast · Haiku, Balanced · Sonnet, Most capable · Opus).
- Browser AI: "Open in browser" copies the request with the excerpts from the base inside (from the topic or a project overview), since a browser AI cannot reach the local Tusab.
- After `tusab_salvar_estudo`, the AI receives and shows the **Open in Tusab** link, which opens the screen right on the material.
- Mind maps, flowcharts and timelines (`mermaid` blocks) are drawn in the Materials tab (Mermaid, loaded only when there is a diagram; the optional `elk` layout stays out of the package).
- Tool descriptions in English and Spanish (before, only the titles changed language).
- The Microsoft Clarity SDK (telemetry from the old desktop app) leaves the package: an empty module goes in its place.
- Screen fixes: in the dark theme, the open list of selects was white with white text (native controls now follow the theme); select arrows have a fixed gap from the border.
- A single source for the version number: `tusab-mcp/package.json`. The server and the screen read it from there; a test checks that `manifest.json` matches.
- Extension descriptions (pt, en, es) no longer mention the desktop app.
- Desktop app discontinued: its code (Electron, Python engine, tests and installer automation) left the repository and is preserved in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag. The 1.0.x releases stay published as history, with no further fixes.
- CI tests the extension on Windows, macOS and Linux and audits the accessibility of the screen served by the plugin (pa11y-ci, light and dark theme).

**v0.6.0 (2026-11-18)** — First version of the extension in the repository (not published as a package).

- MCP server over stdio with 15 tools: search with citations (`tusab_buscar`), reading a source and an original, YouTube extraction, text files, public sources, study memory and spaced repetition, weekly news, token savings, status and opening the screen.
- Tusab screen served on `127.0.0.1` with a per-session key, `Host` and `Origin` checked, no CORS and CSP `'self'`: the desktop app interface built in extension mode.
- YouTube extraction engine in Node, with the same on-disk format as the desktop app; official yt-dlp downloaded with a SHA-256 check; automatic channel updates every hour.
- Documents (PDF with page markers, DOCX, XLSX, CSV, TXT/MD, FHIR, web page), originals stored with type checked by signature, images sent to the AI without EXIF/GPS.
- Exports (zip, XLSX, PDF) and `.tusab` compatible with the desktop app both ways, with optional originals.
- 70 public sources across 11 areas, the same registry as the desktop app.
- Prompt Library: 21 prompts in 6 categories, fixed search and citation rules, "My prompts" with folders.
- Three languages (pt, en, es) on the screen, in plugin messages, tool titles and "+" shortcuts.
- Locally estimated token savings, with a command-line test (`medir-tokens`).
- `.mcpb` package with `LICENSE`, `TRADEMARK.md` and `THIRD_PARTY_NOTICES.txt`.

## Desktop app (discontinued on 2026-11-19)

**v1.0.64 (2026-10-27)** — Optional telemetry is recorded again: the Clarity ID pointed to a mobile app project; it now uses a Site project, with strict masking.

**v1.0.63 (2026-10-27)** — Optional telemetry moves from PostHog to Microsoft Clarity. Still opt-in, with screen content masked on the computer; anyone who had accepted is asked again.

**v1.0.62 (2026-10-27)** — Scrolling fix in the expanded chat; Electron 44.9.3 and updated dependencies.

**v1.0.61 (2026-10-21)** — From 26 to 70 public sources across 11 areas: case law (STF, TCU, TST), Brazil's Senate and Chamber, health (PAHO, WHO, Fiocruz, ANVISA), World Bank, NASA, Hugging Face and more. New **Education** (theses and teaching materials) and **Open data** (about 40 government portals in Brazil and abroad) areas. Teacher and Specialist profiles can now search public sources. Search accepts several sources at once, with filters by region, content type and institution. Chat tables are easier to read and can be downloaded as a spreadsheet (.xlsx) or copied as CSV.

**v1.0.60 (2026-10-20)** — Lighter installer and app: about 240 MB less on disk and a Windows installer about 50 MB smaller. Gemini now uses Google's current official SDK, with the same key. On Windows, the installer now limits the length of the chosen folder path, since long paths made automatic updates hang.

**v1.0.59 (2026-10-20)** — App foundation updated to Electron 44, with the accumulated Chromium and Node.js security fixes. Nothing changes in day-to-day use: your bases, conversations and API keys stay where they were.

**v1.0.58 (2026-10-18)** — The Windows installer includes the app's engine again: versions 1.0.42 to 1.0.57 shipped without the embedded Python, and the app didn't work on Windows. The macOS installer gets smaller, without the semantic reranking stack, which was already not part of the standard Windows version. Security fixes in components used by automatic updates and optional telemetry.

**v1.0.57 (2026-09-28)** — Protection against instructions hidden in indexed documents (indirect prompt injection): malicious content in a video, PDF, or text file is no longer followed as a command by the assistant; when an answer still looks influenced this way, a warning appears in the chat. Dependencies updated, including React and axios (with a security fix).

**v1.0.56 (2026-09-02)** — Fixed the automated accessibility audit in CI, which had been failing since v1.0.55.

**v1.0.55 (2026-08-30)** — OpenRouter as a new free chat provider; search index storage migrated to LanceDB (ranking is still BM25, no perceptible change in answer quality); Especialista profile can hide the Study Mode card on the home screen; tables and lists in assistant replies no longer render glued together on screen; contrast and keyboard focus improvements.

**v1.0.54 (2026-08-22)** — Thumbs-down in chat now has a real effect: it accumulates a per-project counter that widens the search instead of just discarding the response.

**v1.0.53 (2026-08-14)** — Keyboard shortcuts with `⌘` (Cmd) on macOS; a saved flashcard modal now opens the full review experience (flip card, rate); fixed a chat search bug that ignored the actual question term in bases with a lot of formal text; per-file indexing progress with working cancellation; fixes to the expanded chat, a checkbox, and i18n.

**v1.0.52 (2026-08-14)** — Intent routing in chat: questions about the base itself ("how many videos does this base have?", "when was it indexed?") answer with real data from disk, no LLM call; pure calculation questions ("what's 15+27?") are solved by a safe arithmetic evaluator, no LLM or search; automatic retry in Broad Search before showing "not found". macOS keyboard shortcuts documented in Help.

**v1.0.51 (2026-08-12)** — YouTube video chapters longer than 3000 characters were being truncated in the search index and chat citation; now split into multiple parts, with continuity preserved.

**v1.0.50 (2026-08-10)** — Single LLM client factory in chat (fixes a real drift in the Gemini fallback list); full reset now available to every profile, not just Specialist.

**v1.0.49 (2026-08-10)** — Vector search (embeddings via Ollama `nomic-embed-text`) as a complement to BM25+FTS5+CrossEncoder in chat, active in Broad Search with optional one-click download.

**v1.0.46–47 (2026-08-07/09)** — Release fixes (race condition between the Windows and macOS builds) and full Overview translation.

**v1.0.44–45 (2026-08-07)** — Real, persisted audio player for Study Mode summaries, fixed unwanted horizontal scroll in the side menu.

**v1.0.42–43 (2026-08-06/07)** — Complete Study Mode (flashcards with SM-2, summaries, post-its), playlist selection and date filter in extraction, support for Ollama models with native reasoning (thinking), "Agent" renamed to "Assistant" throughout the interface.

**v1.0.41 (2026-07-31)** — macOS installer (Apple Silicon), search public sources by knowledge area (arXiv, OpenAlex, FHIR and others), standalone web page reader, code published under the Elastic License 2.0.

**v1.0.38–40 (2026-07-24/27)** — Automatic legal document recognition, per-sentence graded confidence in chat, MCP Server exposed in the interface.

For the full detail, including internal CI and infrastructure fixes, see [CHANGELOG.md](https://github.com/criaugu/tusab/blob/main/CHANGELOG.md).
