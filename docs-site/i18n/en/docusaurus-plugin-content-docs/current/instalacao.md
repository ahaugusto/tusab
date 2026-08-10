---
id: instalacao
title: Installation
sidebar_label: Installation
slug: /instalacao
---

# Installation

## Download

Download the latest installer from the [GitHub releases page](https://github.com/ahaugusto/tusab/releases/latest).

| Platform | Requirement | File |
|---|---|---|
| Windows 10/11 x64 | — | `Tusab-Setup-X.X.X.exe` |
| macOS (Apple Silicon — M1 or newer) | macOS 14 (Sonoma) or later | `Tusab-X.X.X-arm64.dmg` |

Python and yt-dlp are bundled in both installers — nothing else to install manually.

:::note macOS Intel is not supported
Apple Silicon (arm64) only, for now.
:::

## Installing on Windows

Run the `.exe` and follow the NSIS installer. No additional manual steps.

## Installing on macOS

1. Download the `.dmg`.
2. Open the `.dmg` and drag the Tusab icon into **Applications**.
3. Launch Tusab from Applications. The app is **signed and notarized by Apple** (Developer ID + automated CI notarization) — it opens normally, no need to manually allow anything in System Settings → Privacy & Security.
4. On first launch, Tusab detects whether Ollama is installed and offers to download it automatically if not.

## First launch

On first launch, Tusab walks you through:

1. Welcome screen (language and theme)
2. Telemetry consent (opt-in, can be declined or revoked later)
3. Profile choice — Student, Teacher, Researcher, or Specialist
4. AI engine setup — local Ollama (recommended, free) or an external provider key (Groq, OpenAI, Anthropic, Gemini)

See the detail of each journey in [Profiles and user journeys](/perfis-e-jornadas).

## Setting up the AI engine

### Ollama (default, recommended)

Zero cost, no API key, works offline. Onboarding offers automatic download; if you prefer manually, download it from [ollama.com/download](https://ollama.com/download). Default model: `llama3.2:1b` (~1.3 GB).

### External providers (BYOK — bring your own key)

Configurable at any time in the **Assistant** tab:

| Provider | Default model | Cost |
|----------|--------------|-------|
| Groq | llama-3.1-8b-instant | Free tier |
| OpenAI | gpt-4o-mini | Paid |
| Anthropic | claude-haiku-4-5 (auxiliary) / claude-sonnet-4-6 (main answer) | Paid |
| Google Gemini | gemini-1.5-flash | Paid |
| Custom endpoint | any OpenAI-compatible server | Depends on the server |

The key is tested before being saved and stored encrypted by the operating system (DPAPI on Windows, Keychain on macOS) via Electron's `safeStorage`.

## Google Drive (optional)

To sync/share bases via Google Drive:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**
2. Create OAuth 2.0 credentials (Desktop app type) and download the JSON
3. Rename it to `credentials.json` and place it at the project root (dev build) or in the data folder (packaged build)
4. In the Tusab interface, enable Drive from the Repository tab — the OAuth flow opens in your browser
5. After authorizing, `token.json` is saved locally (both files are gitignored)

The scope requested is the minimum necessary: `drive.file` — Tusab only accesses files it created itself.
