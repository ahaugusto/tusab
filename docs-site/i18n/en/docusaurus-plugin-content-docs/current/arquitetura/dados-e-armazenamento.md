---
id: dados-e-armazenamento
title: Data and storage
sidebar_label: Data and storage
slug: /arquitetura/dados-e-armazenamento
---

# Data and storage

## Where data lives

| Context | Location |
|----------|-------|
| Production (packaged Electron) | `%AppData%\Tusab\data\` (Windows) |
| Development | `./data/` |
| Configurable via | `TUSAB_DATA_DIR` environment variable |

## On-disk structure

```
data/neural/{project}/
  youtube/       .txt transcripts extracted from YouTube
  documents/     PDFs, DOCX and other repository docs + _manifest.json
  texts/         pasted/parsed texts + _manifest.json
  estudo/        Study Mode artifacts + cached audio
  management/    management CSVs, summary.json, README, report

data/indexes/    BM25 indexes serialized per project ({prefix}_index.json)
data/config/     agent_config.json, credentials.json, token.json, keystore.json
data/temp/       temporary VTTs (auto-removed)
```

## Project naming

`projeto_nome` is set by the user in the extraction modal. If omitted, it's derived from the YouTube channel name. The name is sanitized (`re.sub(r'[<>:"/\\|?*\s]', '_', ...)`) before becoming a folder name. A channel can be imported into any project — the folder isn't tied to the source.

Subfolders (`documents/`, `texts/`, `management/`) use English names as the technical standard, independent of the interface language.

## Atomic writes

Every file goes through `write-to-tmp` + `os.replace()` — an atomic operation on the same volume, guaranteed by the operating system. The file is never left corrupted, even if the process crashes mid-write.

## Legacy structure migration

Idempotent migration functions run on startup and only take effect if legacy structure exists on disk: `migrar_cerebro_para_neural()`, `migrar_gestao_para_cerebro()`, `migrar_pastas_para_ingles()`.

## Sharing — the `.tusab` file

A complete project (content + BM25 index) can be exported as a single `.tusab` file, portable between machines — whoever imports it doesn't need to re-index anything.

## What's safe to sync/share

| Folder | Safe to share? |
|-------|---------------------|
| `neural/` | ✅ Yes — indexed content, no secrets |
| `indexes/` | ✅ Yes |
| `config/` | ⚠️ **No** — may contain API keys in plain text (`agent_config.json`) and OAuth tokens (`token.json`, `credentials.json`) |

A `LEIA-ME-SEGURANCA.txt` is automatically created in the data folder explaining this distinction. We recommend not including `config/` in automatic cloud backups without additional encryption.
