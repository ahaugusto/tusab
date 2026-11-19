---
id: instalacao
title: Desktop app — installation
sidebar_label: Installation
slug: /desktop/instalacao
---

# Desktop app — installation

:::warning Desktop app discontinued
The desktop app was discontinued on 2026-11-19 and no longer receives fixes or updates. The code mentioned on this page is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag, no longer on `main`. This page is kept only as a record.
:::

The installers are in the 1.0.x GitHub releases; the last one is [v1.0.64](https://github.com/criaugu/tusab/releases/tag/v1.0.64).

| Platform | Requirement | File |
|---|---|---|
| Windows 10/11 x64 | — | `Tusab-Setup-X.X.X.exe` |
| macOS (Apple Silicon) | macOS 14 (Sonoma) or later | `Tusab-X.X.X-arm64.dmg` |

Python and yt-dlp are bundled in both installers. macOS on Intel processors is not supported.

## Windows

Run the `.exe` (NSIS installer). If you choose another installation folder, the path can have at most **65 characters** (the installer's `TUSAB_MAX_INSTDIR` limit); with longer paths automatic updates can't replace the files, and the installer won't proceed. The suggested folder always fits.

:::caution Versions 1.0.42 to 1.0.57 on Windows
Those installers shipped without the embedded Python: the app opened, but extraction, chat and repository didn't work. Install 1.0.58 or later; data and settings stay where they were.
:::

## macOS

1. Open the `.dmg` and drag Tusab into **Applications**.
2. Open it from Applications. The app is signed (Developer ID) and notarized by Apple.
3. On first run, the app checks whether Ollama is installed and offers to download it.

## First run

1. Language and theme.
2. Telemetry consent (optional; can be declined or revoked later).
3. Profile: Student, Teacher, Researcher or Specialist (see [Profiles](/perfis-e-jornadas)).
4. Assistant AI engine: local Ollama or an external provider key.

## Assistant AI engine

| Provider | Default model |
|---|---|
| Ollama (default) | `llama3.2:1b` |
| Groq | `llama-3.1-8b-instant` |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` (configurable) |
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-haiku-4-5` (auxiliary calls) / `claude-sonnet-4-6` (final answer) |
| Google Gemini | the first one available on the account, starting with `gemini-1.5-flash` |
| Custom endpoint | any server compatible with the OpenAI API |

The key is tested before being saved and stored with Electron's `safeStorage` (DPAPI on Windows, Keychain on macOS).

## Google Drive (optional)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Create OAuth 2.0 credentials of type *Desktop app* and download the JSON.
3. Rename it to `credentials.json` and place it at the project root (development) or in the data folder (installed app).
4. Enable Drive from the Repository tab; the OAuth flow opens in the browser.
5. `token.json` is saved locally.

Requested scope: `drive.file` (Tusab only accesses files it created itself).
