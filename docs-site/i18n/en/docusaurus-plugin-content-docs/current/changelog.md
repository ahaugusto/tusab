---
id: changelog
title: Changelog
sidebar_label: Changelog
slug: /changelog
---

# Changelog

The complete history of every version — [Keep a Changelog](https://keepachangelog.com) format, [semantic versioning](https://semver.org) — lives in [`CHANGELOG.md`](https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md) in the main repository. This page summarizes the most recent milestones.

## Recent highlights

**v1.0.50 (2026-08-10)** — Single LLM client factory in chat (fixes a real drift in the Gemini fallback list); full reset now available to every profile, not just Specialist.

**v1.0.49 (2026-08-10)** — Vector search (embeddings via Ollama `nomic-embed-text`) as a complement to BM25+FTS5+CrossEncoder in chat, active in Broad Search with optional one-click download.

**v1.0.48 (2026-08-09)** — Tagline unified to "Augment" across all logo art and text, deliberately referencing Douglas Engelbart's concept of Intelligence Augmentation.

**v1.0.46–47 (2026-08-07/09)** — Release fixes (race condition between Windows/macOS builders), full Overview translation, refreshed logo and README.

**v1.0.44–45 (2026-08-07)** — Real, persisted audio player for Study Mode summaries, fixed unwanted horizontal scroll in the side menu.

**v1.0.42–43 (2026-08-06/07)** — Complete Study Mode (flashcards with SM-2, summaries, post-its), playlist selection and date filter in extraction, support for Ollama models with native reasoning (thinking), "Agent" renamed to "Assistant" throughout the interface.

**v1.0.41 (2026-07-31)** — macOS installer (Apple Silicon), search public sources by knowledge area (arXiv, OpenAlex, FHIR and others), standalone web page reader, formalized as source-available (Elastic License 2.0).

**v1.0.38–40 (2026-07-24/27)** — Automatic legal document recognition, per-sentence graded confidence in chat, MCP Server exposed in the interface.

For the full detail — including internal CI/infra fixes — see the [complete CHANGELOG.md](https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md).
