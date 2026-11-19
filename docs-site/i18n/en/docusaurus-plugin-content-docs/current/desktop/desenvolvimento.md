---
id: desenvolvimento
title: Desktop app — development
sidebar_label: Development
slug: /desktop/desenvolvimento
---

# Desktop app — development

:::warning Desktop app discontinued
The desktop app was discontinued on 2026-11-19 and no longer receives fixes or updates. The code mentioned on this page is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag, no longer on `main`. This page is kept only as a record.
:::

## Prerequisites

Node.js 20+, Python 3.12+, Git.

## Clone and install

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab

# Python virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1
.venv\Scripts\python.exe -m pip install -r requirements.txt

# Interface
cd web_interface
npm install
cd ..

# Electron
cd electron
npm install
cd ..
```

For semantic reranking (CrossEncoder) and KeyBERT, which are left out of the standard installer, also install `requirements-enterprise.txt`.

## Running in development mode

```powershell
# Terminal 1 — backend
.venv\Scripts\python.exe api_tusab.py

# Terminal 2 — interface with hot reload
cd web_interface
npm run dev

# Or the full app in Electron
cd electron
npm run dev
```

The full interface is at `http://localhost:8001` (served by the backend from `web_interface/dist/`); hot reload, at `http://localhost:5173` (Vite server).

## Environment variables

| Variable | Description |
|---|---|
| `TUSAB_DATA_DIR` | Overrides the data folder (used in tests and in the packaged app) |
| `ELECTRON_RUN` | Set by Electron; stops the backend from opening the browser on its own |
| `VITE_CLARITY_ID` | Optional: replaces the public Microsoft Clarity project ID |

## Windows caveats

- `pip install` without a prefix goes to the system Python, not the `.venv`: use `.venv\Scripts\python.exe -m pip install ...`.
- `npm run build` from Git Bash may not update `dist/`: use PowerShell.

## Tests

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

`tests/conftest.py` points `TUSAB_DATA_DIR` to a temporary folder before any import. The suite covers API routes (FastAPI TestClient), reliability (atomic writes, concurrency, corrupted or empty index), search, public sources, exports and other modules.

## Production build (Windows)

```powershell
cd web_interface
npm run build
cd ..\electron
npm run build
```

Output: `dist_electron/Tusab-Setup-X.X.X.exe`. Prerequisite: `electron/python_env/` with an embeddable Python 3.12 and the dependencies, and `electron/bin/yt-dlp.exe`. These folders are large and kept out of git.

## Production build (macOS)

The macOS build (signed and notarized `.dmg`/`.zip`, Apple Silicon) runs on GitHub Actions (`macos-latest`) with `electron-builder --mac` and automated notarization. The package's Python is a portable CPython 3.12 for arm64.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **`backend-tests`:** full `pytest` (Python 3.11) against a minimal `dist/`;
- **`frontend-build`:** production `vite build` and an accessibility audit with `pa11y-ci` on the Landing screen (see [Accessibility](/acessibilidade#pa11y-ci-scope)).

`release.yml` builds the installers; `validar-instalador-windows.yml` and `macos-smoke.yml` check the generated packages. An installer is only considered valid after it starts the backend on a clean machine: between 1.0.42 and 1.0.57, the `.exe` shipped without the embedded Python while CI was green.

## Windows and macOS

Code that touches paths, subprocesses or binaries branches by platform (`process.platform === 'darwin'`, `sys.platform`) in the same file, never in separate files or branches per system. A change meant for one system must not change the other's behavior.
