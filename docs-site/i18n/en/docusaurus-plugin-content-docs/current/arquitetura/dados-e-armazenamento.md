---
id: dados-e-armazenamento
title: Data and storage
sidebar_label: Data and storage
slug: /arquitetura/dados-e-armazenamento
---

# Data and storage

## Where the data lives

Everything lives in a **root** that contains the `data/` folder:

- the folder chosen at installation (Claude Desktop's repository folder field), passed to the server through the `TUSAB_REPOSITORIO` variable;
- without the variable, `~/Tusab`.

To open a base created by the [desktop app](/desktop/visao-geral), choose its data folder as the repository folder: `%APPDATA%\Tusab` on Windows, `~/Library/Application Support/Tusab` on macOS (Electron's `userData` folder), or the value of `TUSAB_DATA_DIR`, if set.

## Structure on disk

```
data/
  neural/{projeto}/
    youtube/{canal}/{canal}_Parte_N.txt   transcripts in blocks (with minute)
    youtube/{canal}/{canal}_meta.json     channel metadata (7-day cache)
    documents/{id}_{nome}.txt             text extracted from documents + _manifest.json
    documents/originais/                  uploaded originals, as they came
    texts/                                pasted/uploaded texts + _manifest.json
    estudo/                               study artifacts saved by the AI
    management/                           {canal}_base.csv, {canal}_summary.json,
                                          flashcards.json, postits.json, resumo_estudo.md,
                                          flashcards_progresso.json, digest_AAAA-MM-DD.md
  config/
    extraction_queue.json                 extraction queue
    prompts_usuario.json                  "My prompts"
    idioma.json                           language chosen on the screen
    economia_tokens.json                  aggregate token counter
    auto_update.json                      last channel check
    boas_vindas.json                      first screen opening marker
  temp/                                   temporary VTT subtitles
  bin/                                    yt-dlp downloaded by the plugin
  tusab.sqlite                            search index (rebuildable)
```

## File formats

- **Transcripts:** `{canal}_Parte_N.txt` (up to 40,000 words per part, UTF-8 with BOM). Each block has `TITULO`, `ABA`, `DATA`, `LINK`, `VIDEO_ID`, `VIEWS`, `TIMESTAMP_INICIO`, `[PARTE/TOTAL_PARTES]`, `TAGS`, `DESCRICAO` and `CONTEUDO`, separated by lines of `=` and `-`.
- **Management CSV** (`{canal}_base.csv`): `ID, Data_Pub, Link, Titulo, Aba, Views, Local, Status, Data_Extracao`.
- **Channel summary** (`{canal}_summary.json`): total mapped, URLs, last filter used and the automatic update setting.
- **Documents and texts:** `{id}_{nome}.txt` with a `TITULO`/`FONTE`/`DATA` header and an entry in the folder's `_manifest.json`.
- **Originals:** `documents/originais/{id}_{nome}{ext}` (see [Originals and images](/funcionalidades/originais-e-imagens)).

These formats are the same as the desktop app's and stay in Portuguese (labels and statuses), so both read the same folder.

## Index

- `data/tusab.sqlite`, with an FTS5 virtual table (`unicode61 remove_diacritics 2`) and ranking by `bm25()`.
- **The `.txt` files are the source of truth.** The index can be rebuilt and is synced per file (modification time and size): one excerpt per block in transcripts, by paragraph in documents and texts.
- The database is kept in memory and written atomically under a lock file, because more than one AI tool may open the same repository.
- The desktop app has its own index (`data/agent_index/`, LanceDB), which the extension doesn't use.

## Project names

Chosen by the user and cleaned before becoming a folder: `[<>:"/\|?*\s]` becomes `_` (same rule as the desktop app), leading dots are removed (`..` never becomes a folder name) and the name is limited to 120 characters. A channel can go to any project.

## Atomic writes

Files are written to a temporary file (`{file}.{pid}.{time}.tmp`) and renamed in one step. If the process stops midway, the previous file stays intact.

## What can be shared

| Folder | Share? |
|---|---|
| `neural/` | Yes, paying attention to personal data in the documents and originals themselves (photos may carry location) |
| `tusab.sqlite` | Not needed: it is rebuilt from `neural/` |
| `config/` | No secrets (the extension stores no keys), but it is this computer's local configuration |

To share a project, prefer the `.tusab` file (see [Repository and documents](/funcionalidades/repositorio-multi-fonte#export-and-import)).

Differences in the desktop app (encrypted API keys, Google Drive tokens, migrations of old layouts) are in [Desktop app](/desktop/visao-geral#desktop-app-data).
