---
id: repositorio-multi-fonte
title: Multi-source repository
sidebar_label: Multi-source repository
slug: /funcionalidades/repositorio-multi-fonte
---

# Multi-source repository

The Repository is where every knowledge base lives — organized by **project**, not by channel. A YouTube channel can be imported into any project; the folder isn't tied to the source.

## Supported sources

| Type | Formats | Note |
|------|----------|------------|
| Video | YouTube transcripts | Via extraction (see [YouTube extraction](/funcionalidades/extracao-youtube)) |
| Documents | PDF, DOCX, XLSX, CSV, TXT | Direct upload, 50 MB limit per file |
| Images | PNG, JPG, WEBP etc. | Description via multimodal Ollama (llava/gemma3) or OCR (RapidOCR) as fallback |
| Audio | MP3, WAV, M4A etc. | Local transcription via faster-whisper (`base` model, CPU, ~150 MB) |
| Pasted text | — | Directly from the interface |
| Web page | Standalone URL | Extraction via trafilatura, respecting `robots.txt` |

## Special-format parsers

`.txt`/`.md` texts go through automatic structure detection before saving:

- **WhatsApp** (Android/iOS) — structured by day/participant
- **Meetings** (Zoom, Teams, Otter) — structured by speaker/timestamp
- **Legal documents** (petitions, contracts, opinions) — detected by textual structure (court address, numbered clauses, summary header); reformatted with a header of extracted fields before the full content

This pre-processing improves BM25 recall at search time — without depending on any external API.

## Organization by project

```
data/neural/{project}/
  youtube/       .txt transcripts extracted from YouTube
  documents/     PDFs, DOCX and other docs + _manifest.json
  texts/         pasted/parsed texts + _manifest.json
  estudo/        Study Mode artifacts (flashcards/summary/post-its + audio)
  management/    management CSVs, summary.json, README, report
```

Each subdirectory of `documents/` and `texts/` keeps a `_manifest.json` as a local index, with atomic writes (`write-to-tmp` + `os.replace()`).

## Indexing

The **Index base** button (in the Repository, or "Index now" directly from a chat message without enough context) builds the project's BM25 index. Since v1.0.42, indexing also runs automatically in the background after any content ingestion — extraction, upload, pasted text, or public-source search — with an incremental per-file cache: only what's new or changed pays the cost of semantic enrichment.

## Sharing — export/import `.tusab`

Any project can be exported as a single `.tusab` file, portable between machines. Whoever receives it imports it and starts chatting right away — the BM25 index is already inside the file, no need to index anything.

## Limits and security

- Upload limited to 50 MB per file
- File names sanitized before saving to disk
- File deletion protected against path traversal (`os.path.realpath()` validates that the final path is within the allowed subdirectory)
