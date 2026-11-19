---
id: extracao-youtube
title: YouTube extraction
sidebar_label: YouTube extraction
slug: /funcionalidades/extracao-youtube
---

# YouTube extraction

Tusab downloads the **subtitles** (not the videos) of YouTube channels, playlists and videos with [yt-dlp](https://github.com/yt-dlp/yt-dlp), running on the user's computer and IP address, with no intermediary server. Code: `tusab-mcp/src/nucleo/motor.js`, `ytdlp.js` and `legendas.js`.

## How to request it

- **Through the AI:** tool `tusab_adicionar_youtube` (`url`, `projeto`, optional `max_videos`). Extraction runs in the background; progress shows in `tusab_status` and on the screen.
- **Through the screen:** Extraction tab, with channel search by name, choice of tabs, playlists and period, live log and remaining time.

Requests from the AI and from the screen go through the same engine: what the AI asks for shows up on the screen, and vice versa.

## How it works

1. **Address:** a channel in the `youtube.com/@name`, `youtube.com/channel/ID` or `youtube.com/c/name` formats (validated by a regular expression before reaching yt-dlp). Through the MCP tool, also a playlist or single video link; suffixes such as `/videos` or `/shorts` are stripped from the channel link.
2. **Mapping by tab:** Videos, Shorts, Live, Podcasts, Courses and Playlists; each tab can be included or excluded on the screen.
3. **Optional filters:** specific playlists and a publication date range. With a date filter on, videos without a known date are left out. The filter used appears in the log, in the Report and in the Overview.
4. **Subtitles:** two language passes, first `pt,pt-BR` and, only if no subtitle comes back, `en,es`; auto-translated subtitles are ignored. Metadata, chapters and subtitles come in a **single yt-dlp call** per video (fewer calls, less risk of rate-limit blocking), with a 1 s pause between requests (`--sleep-requests 1`).
5. **Writing:** the text goes to `neural/{projeto}/youtube/{canal}/{canal}_Parte_N.txt`, each video's status to `neural/{projeto}/management/{canal}_base.csv`, and the index is updated.

## Splitting into excerpts

- By YouTube chapter, when the video has chapters.
- Without chapters: 120 s windows with 15 s overlap (effective step of 105 s).
- Cap of 3,000 characters per excerpt, cut at a subtitle line boundary; larger chapters become several parts.
- Each block of the `.txt` stores title, tab, date, link, video ID, views, start minute, tags, description and content. That's where the minute citation (`▶ MM:SS`) and the `&t=Ns` link returned by `tusab_buscar` come from.

## Status per video (management CSV)

`Sucesso`, `Sem Legenda`, `Legenda Curta`, `Falha Extração`, `Arquivo Ausente`. The values stay in Portuguese because the format is the same as the desktop app's.

## Incremental extraction, pause and queue

- Videos already extracted are skipped in a new run of the same channel; only what's new is processed. Extraction resumes the last part of the `.txt`.
- Extraction can be paused and cancelled from the screen.
- **Queue:** if the AI (or the screen) asks for a channel while another is being extracted, the request joins the queue (`data/config/extraction_queue.json`); the tool's response reports the position.

## Automatic channel updates

Each channel can have automatic updates turned on from the screen (setting in `management/{canal}_summary.json`). With the plugin open, the check runs a few seconds after startup and then every hour: it lists the videos in the tabs with yt-dlp (metadata only, `--flat-playlist`) and compares them with the CSV. If there's a new video, the channel goes to the engine, or to the queue if an extraction is running. With the AI tool closed, nothing runs.

## Single web page

In the Repository, a page URL is read and its main content becomes a text in the project. Tusab checks the site's `robots.txt` (User-Agent `TusabBot/1.0`) and doesn't insist if the page disallows automated access. It doesn't run JavaScript: static pages only.

## Extraction security

- Channel URL and playlist ID validated by regular expressions before the command is built.
- yt-dlp is run with an argument list, never through a shell.
- When the plugin downloads the yt-dlp binary, its SHA-256 sum is checked against the one published by the project.

See [Security](/seguranca).
