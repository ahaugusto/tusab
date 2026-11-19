---
id: originais-e-imagens
title: Originals and images
sidebar_label: Originals and images
slug: /funcionalidades/originais-e-imagens
---

# Originals and images

Every file uploaded through the screen is kept **as it came**, next to the extracted text. The text is what goes into the index (cheap in tokens); the original stays on the computer and the AI only opens it when the text is not enough, with `tusab_ler_original`.

## Where they are

```
data/neural/{projeto}/documents/originais/{id}_{nome}{ext}
```

- `id` has 8 hexadecimal characters; `nome` is the cleaned file name (letters, digits, `_` and `-` only, up to 40 characters).
- The original's path is **never read from the manifest**: it is always recomputed from this convention and checked to stay inside the project folder.
- The same file uploaded twice is refused (SHA-256 comparison).
- Deleting a document or clearing a project's documents also deletes the originals.
- Tusab never opens an original with the system's default program.
- The Repository shows the space used per project (originals × text) and marks as **Text only** the documents without an original (for example, documents created by the desktop app, imported from a `.tusab` without originals or coming from public sources).

## Accepted types

A closed list, checked by **the name extension and the file signature** (first bytes):

| Category | Extensions |
|---|---|
| Document | `.pdf`, `.docx`, `.xlsx` |
| Text | `.csv`, `.txt`, `.md`, `.json` (FHIR) |
| Image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |
| Audio | `.mp3`, `.wav`, `.ogg`, `.opus`, `.flac`, `.m4a`, `.aac` |

SVG, HTML and executables are refused. Images and audio are **stored without being read**: Tusab does no OCR or transcription (the discontinued [desktop app](/desktop/visao-geral) did, with local models). Upload limit: 50 MB per file.

## `tusab_ler_original`

Takes the `fonte_id` of a document (returned by `tusab_buscar`).

| Original type | What goes back to the AI |
|---|---|
| Image (PNG, JPEG, GIF, WebP) up to 3 MB | The image, **without metadata** (below) |
| Image above 3 MB | A notice for the user to attach the image to the conversation |
| PDF | The text of the requested pages (`paginas`: `"3"` or `"2-4"`; default page 1; at most 10 pages per call). If the pages have no selectable text (scanned PDF), a notice for the user to attach the PDF |
| Audio and other types | Not sent whole; the tool points to `tusab_ler_fonte` for the text |

YouTube videos and documents from public sources have no stored original; for them, `tusab_ler_original` returns an error pointing to `tusab_ler_fonte`. The response header shows the path **relative** to the repository, without exposing the user's folder.

## Images without metadata (EXIF/GPS)

Before an image goes to the AI, the `semMetadados` function (`src/nucleo/originais.js`) removes EXIF, XMP, comments and embedded text, including location (GPS):

- JPEG, PNG and WebP: the metadata blocks are stripped;
- GIF: sent as is.

**Fail closed:** if the file structure is not recognized and cleaning can't be guaranteed, the image **is not sent**, and the AI gets a notice to ask the user to attach the image to the conversation if they want. The file stored on the computer is not changed.

## Exporting and importing `.tusab`

- Originals only go into the `.tusab` by explicit choice: when exporting a project that has originals, the screen asks whether they should go along (with a warning about personal data, authorship and location in photos). Unchecked, only the text goes.
- On import, originals of a forbidden type or with a non-matching signature are discarded.
