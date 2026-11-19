---
id: privacidade
title: Privacy
sidebar_label: Privacy
slug: /privacidade
---

# Privacy

Tusab keeps the knowledge base **on the user's computer**. CriAugu runs no server that receives Tusab content, conversations, bases or usage data.

This page describes technically what stays on the computer and what leaves it. The formal privacy policy (Brazil's LGPD, Law No. 13,709/2018, and the GDPR) is published at [tusab.solutions](https://tusab.solutions).

## What stays only on the computer

| Data | Where |
|---|---|
| Transcripts, documents, texts, originals | `data/neural/{projeto}/` |
| Search index | `data/tusab.sqlite` |
| Own prompts, language, queue, settings | `data/config/` |
| Token savings counter (aggregate numbers only) | `data/config/economia_tokens.json` |

Tusab has no account, login or telemetry: on the screen, the analytics module loads nothing.

## What leaves the computer

| Where to | What | When |
|---|---|---|
| **The user's AI tool** (and the AI service behind it) | The excerpts returned by the tools (`tusab_buscar`, `tusab_ler_fonte`…), PDF pages and images requested with `tusab_ler_original` (without metadata), project and source names | When the AI calls a tool |
| YouTube | yt-dlp requests (channel mapping, subtitles, metadata), from the user's IP | When extracting or checking channel updates |
| Public sources | The searched topic | When searching a public source |
| Web page sites | Request for the page and its `robots.txt` | When adding a web page |
| GitHub (`github.com/yt-dlp`) | Download of yt-dlp and its SHA-256 sums list | Only if the computer doesn't have yt-dlp |
| YouTube image domains | Thumbnails loaded on the screen | When showing channels and videos on the screen |

What the AI tool does with the excerpts it receives (storage, use, server location) follows the terms of that tool and AI service, not Tusab's. Its servers may be outside Brazil.

## Minimization

- The AI receives **excerpts**, not the full sources (see [Token savings](/funcionalidades/economia-de-tokens)).
- Images go without EXIF/GPS; if removal can't be guaranteed, they don't go.
- Originals only go into an exported `.tusab` by explicit choice, with a warning about personal data, authorship and location in photos.
- In case law (STF, TCU, TST), party data is removed and CPF and OAB numbers are masked (see [Public sources](/funcionalidades/fontes-publicas#privacy-in-case-law)).

## Data subject rights

| Right | How to exercise it |
|---|---|
| Access | The repository folder is directly accessible through the operating system |
| Correction | Edit the files or use the screen |
| Deletion | Screen (delete, clear, full reset) or the file system; deleting a document also deletes its original |
| Portability | Open formats (`.txt`, `.json`, `.csv`) and `.tusab` (zip) |
| Stopping processing | Remove the extension from the AI tool; nothing runs while it's closed |

Contact: **tusab@tusab.solutions**

## Desktop app

In the [desktop app](/desktop/visao-geral), in addition to the above:

- **Assistant:** with an external provider (OpenAI, Anthropic, Gemini, Groq, OpenRouter, custom endpoint), the question and the retrieved excerpts go to that provider; the app warns when configuring it. With local Ollama, nothing leaves.
- **API keys** stay in the system keychain (`safeStorage`) and are used directly from the computer to the chosen provider.
- **Chat history** lives in the backend's memory and doesn't persist across sessions.
- **Optional telemetry (Microsoft Clarity):** only with explicit consent on first run, revocable in the settings. Screen content is masked on the computer before sending; events carry only their name. Without consent, no request leaves. Anonymous telemetry retention: 12 months.
- **Google Drive** (optional): `drive.file` scope; the OAuth token lasts until revoked.

---

Controller: CriAugu — CNPJ 65.131.075/0001-57.
