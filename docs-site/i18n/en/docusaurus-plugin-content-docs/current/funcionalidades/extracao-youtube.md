---
id: extracao-youtube
title: YouTube channel extraction
sidebar_label: YouTube extraction
slug: /funcionalidades/extracao-youtube
---

# YouTube channel extraction

Tusab extracts entire YouTube channels — hundreds of videos — via [yt-dlp](https://github.com/yt-dlp/yt-dlp), running locally on the user's own IP, with no intermediary server.

## How it works

1. Paste the channel URL (accepted formats: `@handle`, `channel/ID`, `c/name`)
2. Select the desired sources (videos, podcasts, shorts — each can be included or excluded)
3. Optionally, restrict to specific playlists or a publish-date range
4. Start — real-time progress bar, live log, processed-video counter

Each video has its Portuguese captions extracted (`sub_langs = 'pt'` fixed) and saved locally as `.txt` under `neural/{project}/youtube/`.

## Incremental extraction

Already-processed videos are automatically skipped on a new extraction run of the same channel — only new content is downloaded and indexed.

## Playlist selection and date filter

The `GET /playlists-canal` endpoint lets you restrict extraction to chosen playlists and/or a date range, instead of the whole channel. The active filter is visible in the live log, in the Report, and as an icon in the Overview — so a partial channel extraction is never confused with a full one.

## Extraction queue

Teacher, Researcher, and Specialist profiles can queue multiple channels for sequential extraction (`POST /queue/add`, `GET /queue`, `DELETE /queue/clear`).

## Public sources (Researcher profile)

Besides YouTube, the Researcher profile has access to searching 26 public sources across 9 knowledge areas — none require registration or an API key. See [Public sources by knowledge area](/funcionalidades/fontes-publicas) for the full list.

## Standalone web page reader

In the Repository, paste a URL and Tusab extracts the main content via [trafilatura](https://github.com/adbar/trafilatura) (Apache-2.0) and indexes it. Respects `robots.txt` — never attempts to bypass a site's block. Limited to static pages (no JavaScript rendering).

## Extraction security

- Channel URL validated against a regex whitelist before being passed to yt-dlp
- Playlist ID validated (`^[A-Za-z0-9_\-]{10,50}$`) before composing commands
- yt-dlp always executed via an argument list — never via `shell=True`

See [Security](/seguranca) for the full detail of the controls applied.
