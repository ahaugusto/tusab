---
id: build-e-testes
title: Production build and tests
sidebar_label: Build and tests
slug: /desenvolvimento/build-e-testes
---

# Production build and tests

## Production build (Windows)

```powershell
# 1. Build the frontend
cd web_interface
npm run build
cd ..

# 2. Build the Windows installer
cd electron
npm run build
```

Output: `dist_electron/Tusab-Setup-X.X.X.exe`.

**Prerequisite:** `electron/python_env/` needs to be populated with an embeddable Python 3.12 and its installed dependencies, and `electron/bin/yt-dlp.exe` needs to exist. These folders are large and gitignored — set them up once locally before building.

## Production build (macOS)

The macOS build (signed and notarized `.dmg`/`.zip`, Apple Silicon) runs via `electron-builder --mac` on GitHub Actions (`macos-latest`), with automated notarization via `@electron/notarize`. There's no documented local build — every macOS test goes through real CI, since no Mac hardware is available for development.

Cross-building for ARM64 from an Intel host is supported (`pip install --platform macosx_14_0_arm64 ...`), avoiding the need for a dedicated ARM64 runner.

## Tests

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

```
tests/
  conftest.py               fixture: TUSAB_DATA_DIR points to a tempdir before any import
  test_api.py                integration (FastAPI TestClient) — /neural/*, /queue/*, /agent/* routes
  test_confiabilidade.py     atomic writes, concurrency, corrupted/empty index
```

## Smoke tests

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-tusab\smoke.ps1" -Suite full
```

Runs against a real backend on port 8001 — covers yt-dlp, status/repository/queue/assistant endpoints, key validation, path traversal blocking, and serving `index.html`. Configured as a pre-commit hook.

## Automated CI

`.github/workflows/ci.yml` runs on every push/PR to `main`, with two jobs:

- **`backend-tests`** — full `pytest` suite against a minimal `dist/` (doesn't build the whole frontend in this job).
- **`frontend-build`** — production `vite build`, followed by an automated accessibility audit (`pa11y-ci`) against the Landing screen served via `vite preview` — see [Accessibility](/acessibilidade#pa11y-ci-scope) for the exact scope of this coverage.

## Minimum gate for any PR

Full `pytest` suite + `smoke.ps1 -Suite full`, regardless of the change's target platform. A change intended only for macOS must not alter Windows behavior when the platform condition is false, and vice versa.
