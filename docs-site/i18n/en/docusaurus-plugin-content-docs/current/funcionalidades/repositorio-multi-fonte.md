---
id: repositorio-multi-fonte
title: Repository and documents
sidebar_label: Repository and documents
slug: /funcionalidades/repositorio-multi-fonte
---

# Repository and documents

The Repository stores content organized by **project**, not by channel: a YouTube channel can go to any project, and a project can mix videos, documents and texts. Code: `tusab-mcp/src/nucleo/documentos.js`, `repositorio.js`, `originais.js` and `exportar.js`.

## How to add content

| Origin | Through the screen | Through the AI |
|---|---|---|
| YouTube videos | Extraction tab | `tusab_adicionar_youtube` |
| Documents (PDF, Word, Excel…) | Repository → upload file | — |
| `.txt`/`.md` file | Repository | `tusab_adicionar_arquivo` (up to 5 MB) |
| Pasted text | Repository | — |
| Web page (URL) | Repository | — |
| Public sources | Extraction tab → Public source | `tusab_buscar_fonte_publica` |

## Accepted formats

| Type | How it is read |
|---|---|
| PDF | Text extracted with pdfjs, with a `[Página N]` marker on each page so the AI can cite the page |
| Word (`.docx`) | mammoth |
| Excel (`.xlsx`) and CSV | read-excel-file / direct reading |
| TXT and Markdown | Directly |
| FHIR JSON | FHIR Bundle converted to text |
| Images (PNG, JPG, GIF, WebP) | Kept as an [original](/funcionalidades/originais-e-imagens), not read; the AI can open them with `tusab_ler_original` |
| Audio (MP3, WAV, M4A, OGG, FLAC, Opus, AAC) | Kept as an original, not transcribed |

Upload limit: **50 MB per file**. Every file is checked by its name extension and by its signature (first bytes); SVG, HTML and executables are refused; the same file uploaded twice is refused (SHA-256).

## Special formats detected

Texts go through structure detection before being saved (same rules as the desktop app):

- **WhatsApp** (Android/iOS export): organized by day and participant;
- **Meetings** (Zoom, Teams, Otter): organized by speaker and time;
- **Legal documents** (petition, contract, legal opinion): detected by the text structure and saved with a header of extracted fields before the full content.

## Layout on disk

```
data/neural/{projeto}/
  youtube/{canal}/      transcripts extracted from YouTube
  documents/            text extracted from documents ({id}_{nome}.txt) + _manifest.json
    originais/          original files, as they came
  texts/                pasted or uploaded texts + _manifest.json
  estudo/               study material saved by the AI
  management/           management CSV, per-channel summary, study and review data
```

Each document or text `.txt` starts with a `TITULO`/`FONTE`/`DATA` header and a line of 70 hyphens; `_manifest.json` is the folder's local index, written atomically.

## Indexing

There is no index button: the SQLite FTS5 index (`data/tusab.sqlite`) is synced from the `.txt` files whenever a query tool is called or the screen asks, comparing each file's modification time and size. From the command line: `node src/cli.js indexar`.

## Export and import

| Export | What it produces |
|---|---|
| A project's `.tusab` base | Zip with `neural/{projeto}/…` and a `manifest.json`. Originals only go along by explicit choice (the screen asks, with a warning about personal data, authorship and location in photos) |
| Base zip | All content of `data/neural/` |
| Video table | XLSX spreadsheet from the management CSV |
| PDF report | Research report with question/answer pairs and sources |

The `.tusab` is compatible with the desktop app both ways (a desktop `.tusab` may also carry its index, in `agent_index/{projeto}.lancedb/`). On import, the file can be up to 512 MB; each zip path is checked (protection against *zip slip*), the uncompressed size is limited (protection against *zip bombs*) and originals of a forbidden type or with a non-matching signature are discarded.

## Deletion

Deleting a file, clearing a project's documents/texts or doing a full reset removes from disk, including the originals. Every deletion checks that the final path stays inside the allowed folder (protection against *path traversal*). Projects can be marked read-only (checked via `GET /export/readonly-status`), in which case the screen doesn't offer deletion.

## In the desktop app

The discontinued desktop app accepted the same formats and, in addition, described images (multimodal Ollama or OCR with RapidOCR) and transcribed audio locally (faster-whisper); there, images went up to 20 MB and audio up to 100 MB. See [Desktop app](/desktop/visao-geral).
