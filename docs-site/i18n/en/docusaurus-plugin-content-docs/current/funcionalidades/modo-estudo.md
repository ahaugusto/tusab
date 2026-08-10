---
id: modo-estudo
title: Study Mode
sidebar_label: Study Mode
slug: /funcionalidades/modo-estudo
---

# Study Mode

Generates study material from your own indexed base — nothing is invented beyond what's already been taught to Tusab.

## Available artifacts

| Artifact | What it generates |
|----------|-----------|
| **Flashcards** | Question/answer cards with spaced repetition (SM-2 algorithm) |
| **Summary** | Structured synthesis of the topic, with an audio player (local text-to-speech, cached after the first generation) |
| **Post-its** | AI-generated key points in short form |

Quiz and Topics were evaluated and removed from the product after end-to-end testing — a Quiz generation timeout and a pre-existing PDF-extraction bug (loss of spacing in text with mathematical notation) polluted the Topics results. Removed from both frontend and backend, not just hidden from the interface.

## Topic-scoped generation

Generation uses BM25 to scope the material to a specific topic, combinable with selecting specific items — videos or documents already indexed in the project, with search and multi-select — instead of always sampling from the whole project.

## Artifact kanban

Generated artifacts are persisted and searchable in a per-project kanban board. Since they enter the BM25 index, they're also available via the [MCP Server](/funcionalidades/mcp-server). The listing validates that files actually exist on disk before displaying them — artifacts deleted outside the app don't show up as ghost cards.

## Where it lives

`neural/{project}/estudo/` — includes the artifacts and the cached audio of summaries.
