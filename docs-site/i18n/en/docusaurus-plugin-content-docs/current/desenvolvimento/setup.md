---
id: setup
title: Development setup
sidebar_label: Development setup
slug: /desenvolvimento/setup
---

# Development setup

## Prerequisites

Node.js 20+, Python 3.12+, Git.

## Clone and install

```powershell
git clone https://github.com/ahaugusto/tusab.git
cd tusab

# Python virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend dependencies
cd web_interface
npm install
cd ..

# Electron dependencies
cd electron
npm install
cd ..
```

## Running in dev mode (two terminals)

```powershell
# Terminal 1 — backend
.venv\Scripts\python.exe api_tusab.py

# Terminal 2 — frontend (hot reload)
cd web_interface
npm run dev
```

Full interface at `http://localhost:8001` (served by the backend from the generated `dist/`). Hot reload at `http://localhost:5173` (Vite dev server).

## Environment variables

| Variable | Description |
|----------|-----------|
| `TUSAB_DATA_DIR` | Overrides the data directory (used in tests and in the packaged Electron app) |
| `ELECTRON_RUN` | Set by Electron in production — suppresses automatic browser launch |
| `VITE_POSTHOG_KEY` | PostHog telemetry key (never commit — use `web_interface/.env`) |

## Known pitfalls

- `pip install` without a prefix goes to the system Python, not `.venv` — always use `.venv\Scripts\python.exe -m pip install ...`
- `npm run build` via Bash doesn't correctly update `dist/` on Windows — use PowerShell
