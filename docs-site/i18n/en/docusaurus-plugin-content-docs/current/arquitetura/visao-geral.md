---
id: visao-geral
title: Architecture overview
sidebar_label: Overview
slug: /arquitetura/visao-geral
---

# Architecture overview

## Stack

**Backend:** Python 3.12 (embeddable in the production build) + FastAPI + Uvicorn — REST API on `localhost:8001`
**RAG:** `rank_bm25` (BM25Okapi) + SQLite FTS5 (exact-match) + `sentence-transformers` (CrossEncoder) + optional vector search via Ollama (`nomic-embed-text`) + Ollama or external providers
**Frontend:** React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React + react-i18next (PT/EN/ES)
**Desktop:** Electron 34 + electron-builder (NSIS for Windows; signed and notarized `.dmg`/`.zip` for macOS arm64) + electron-updater (auto-update via GitHub Releases)
**Extraction:** yt-dlp (bundled) + pdfplumber + python-docx
**Images:** multimodal Ollama (llava/gemma3) → RapidOCR as fallback (Python + pure ONNX, no external binary)
**Audio:** faster-whisper (`base` model, CPU, ~150 MB)
**Drive:** Google Auth OAuth2, `drive.file` scope

## Layered architecture

```
api_tusab.py           thin entry point; mounts the FastAPI app + routers + startup migrations
  │
  ├── tusab_engine/api/          domain-specific FastAPI routers
  │     router_status.py           GET /status, /drive-auth, /history, /open-folder
  │     router_extraction.py       POST /set-channel, /start, /pause, /cancel, /queue/*
  │     router_agent.py            /agent/* (chat, config, index, ollama, stream)
  │     router_repositorio.py      /repositorio, /relatorio, /neural/*, /reset-total
  │     router_exports.py          /export/* (zip, markdown, docx, xlsx, pdf)
  │
  ├── tusab_engine/motor/        extraction and Drive
  │     drive.py                   Google Drive OAuth + upload
  │     extraction.py              main extraction engine, utilities, reports
  │
  ├── tusab_engine/agent/        local RAG
  │     config.py                  load/save agent_config.json
  │     index.py                   BM25 indexing (cache + lock)
  │     chat.py                    RAG chat + streaming
  │     fts.py                     SQLite FTS5 index (exact-match)
  │     embeddings.py              optional vector search via Ollama
  │     calibration.py             dynamic per-corpus threshold calibration
  │     summarize.py               on-demand video summaries (LLM)
  │     tts.py                     local text-to-speech (Study Mode audio)
  │
  ├── tusab_engine/state.py      AppState singleton + LogRedirector
  └── tusab_engine/storage.py    data paths + atomic IO
```

**Dependency rule (acyclic):** `api → agent | motor → storage` — never the reverse.

## Frontend — modular structure

```
web_interface/src/
  services/api.js           every call to the FastAPI backend
  services/analytics.js     PostHog wrapper (opt-in; no-op without consent)
  hooks/
    useStatus.js              polls GET /status every 2s
    useAssistenteConfig.js    assistant config (provider, key, Ollama, channel metadata)
    useChatEngine.js          RAG chat pipeline (streaming, export, auto-scroll)
  components/
    home/HomeScreen.jsx, LandingScreen.jsx, CircuitBackground.jsx
    chat/ChatDrawer.jsx, ReferenciarModal.jsx
    assistente/OllamaSetup.jsx, RepositorioTab.jsx, RelatorioTab.jsx
    extraction/ExtractionModal.jsx, PostExtractionModal.jsx
    shared/ModalWrapper.jsx, Onboarding.jsx, ConsentModal.jsx
  App.jsx                     main orchestrator
  locales/pt.json, en.json, es.json
```

## Core technical patterns

**Local-first** — all data stays on the user's machine; Drive is explicit opt-in.

**Atomic writes** — every file is written via `write-to-tmp` + `os.replace()`, guaranteeing integrity even if the process crashes mid-write.

**SSE streaming** — chat responses via `ReadableStream`, blinking cursor in the UI during generation.

**Server-side history** — `state.chat_histories` controlled exclusively by the backend; the client payload is ignored, preventing fake-context injection.

**BYOK** — external provider keys stored encrypted via Electron's `safeStorage` (DPAPI/Keychain); `agent_config.json` writes an `__encrypted__` sentinel instead of the real key.

## Windows/macOS parity

Tusab has supported Windows and macOS since July 30, 2026. Any code touching paths, subprocesses, or external binaries uses a per-platform conditional branch — never two separate files per system. The CI pipeline validates both platforms on every release (real build on `macos-latest` in GitHub Actions).

For the detail of each non-obvious technical decision, see [Technical decisions](/arquitetura/decisoes-tecnicas). For the on-disk data layout, see [Data and storage](/arquitetura/dados-e-armazenamento).
