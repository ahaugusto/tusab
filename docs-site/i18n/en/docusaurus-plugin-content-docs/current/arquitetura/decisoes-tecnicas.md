---
id: decisoes-tecnicas
title: Non-obvious technical decisions
sidebar_label: Technical decisions
slug: /arquitetura/decisoes-tecnicas
---

# Non-obvious technical decisions

A record of decisions that wouldn't be evident just from reading the code — the reason matters as much as the decision.

| Decision | Reason |
|---------|--------|
| `RLock` on `state_lock` (not `Lock`) | `print()` inside a locked region re-enters `LogRedirector` — a plain `Lock` would deadlock |
| `os.replace()` for atomic writes | Atomic operation on the same volume — the file is always intact even after a crash |
| `tusab_engine/` (not `Tusab/`) | `Tusab.spec` exists at the root (PyInstaller) — name collision |
| Local yt-dlp on the user's IP | Untouchable principle — every extraction runs on the user's own residential IP, natural protection against YouTube blocks |
| BM25 without query expansion for Ollama | Query expansion increased latency from 3s to 15s with small models |
| `sub_langs = 'pt'` fixed | Dual attempts (pt+en) caused 429 rate limiting on YouTube |
| Root-level shims (`motor_tusab.py`, `agent_tusab.py`) | Electron and legacy code import by the old name — zero breaking change |
| Chat history kept on the server | Prevents a manipulated client payload from injecting fake context into the LLM |
| `NEURAL_DIR` (not `cerebro/`) | Neutral technical naming; `CEREBRO_DIR = NEURAL_DIR` keeps a compatibility alias |
| English subfolders (`documents/`, `texts/`, `management/`) | Technical standard independent of the interface language |
| `projeto_nome` decoupled from the channel | The user names the repository; the channel can change without renaming the folder |
| `sem_contexto: true` in the chat response | Signals to the frontend that BM25 returned no chunks — shows "Index now" instead of a hardcoded message |
| Persona injected as the last line of the prompt | Style instruction applied without altering the retrieved RAG context |
| WhatsApp/meeting parser runs on upload | `.txt`/`.md` texts go through format detection before saving — improves BM25 recall |
| Lazy import in `router_exports.py` | `python-docx`, `openpyxl`, and `reportlab` don't need to be installed for the module to load |
| Per-subdirectory `_manifest.json` manifest | Atomic local index per folder — each docs/texts subdirectory has its own manifest |
| BM25 corpus uses `texto` (with KeyBERT keywords), not `texto_original` | `texto_original` exists only for display in chat sources; using that field in the corpus would make BM25 lose the keywords extracted during indexing |
| Title weighted 5× in the BM25 corpus | Guarantees queries with exact title words always match, without needing to re-index |

## The term "Agent" vs. "Assistant"

Since July 2026, the interface uses the term **"Assistant"** — more precise, since it's a chat with local RAG, with no autonomous loop. The internal backend keeps the `agent` name on purpose (`tusab_engine/agent/`, `/agent/*` routes, `agent_config.json`) — renaming it would require migrating configuration already persisted on disk by existing installs, with no real UX gain. It's not a leftover of an incomplete rename.

## BM25 + FTS5 + CrossEncoder + vector search

Narrow Search uses pure BM25 (~1 ms). Broad Search retrieves the top-12 via BM25 and reorders them with a CrossEncoder (`ms-marco-MiniLM-L-6-v2`, `sentence-transformers`), delivering the top-6 to the prompt (+236 ms measured). The model is lazy-loaded, with graceful degradation if the library is missing. A SQLite FTS5 index runs alongside BM25 to guarantee exact recall of literal terms (proper names, acronyms) — always merged, unconditionally, into the candidate pool.

**Vector search (embeddings) — Phase 1, v1.0.49:** complements keyword search with meaning-based retrieval, via Ollama (`nomic-embed-text`, ~274 MB, optional one-click download in the Assistant tab). Only enters the pool in Broad Search — the same reason the CrossEncoder is restricted to that mode: an approximate semantic match needs a real relevance validator before reaching the prompt. Fixed symbolic score in the pool (not the raw cosine — the BM25/FTS5/cosine scales are incompatible with each other). Total graceful degradation: without the model installed, behavior is identical to before the feature existed.

GraphRAG remains discarded — the current corpus (YouTube transcripts, standalone PDFs) has too low a relational density to justify the complexity of a knowledge graph.

**Anthropic uses two models by purpose:** Claude Haiku for low-risk auxiliary calls (query expansion, intent classification, no-context fallback answer) and Claude Sonnet only for the final answer the user reads — Haiku is faster and cheaper, and Sonnet's extra quality matters where the user actually sees the result. The other providers (OpenAI, Gemini, Groq) use the same default model for both categories.

## Chunking

Long documents use 2,000-character windows with 200-character overlap — avoids cutting an idea at the boundary and ensures key phrases at the edge appear in two BM25 candidates. Videos without chapters are split into 120s temporal windows with 15s overlap (effective 105s step) — a 12-minute video generates about 7 chunks with distributed timestamps.

## Silent corpus enrichment (KeyBERT)

Before indexing, the top-8 key phrases of each chunk (via KeyBERT) are appended to the `texto` field used in the index. The `texto_original` field preserves the clean text for display in chat sources. Graceful degradation if KeyBERT is missing — indexes without enrichment.
