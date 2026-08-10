---
id: seguranca
title: Security
sidebar_label: Security
slug: /seguranca
---

# Security

Tusab runs locally on the user's machine — a privacy advantage, but that doesn't eliminate risk. Three attack surfaces exist even in a local desktop app: the FastAPI API on `localhost:8001`, user input (URLs, uploads, pasted text), and the React interface running inside Electron.

## What was already secure from the start

- **Electron with best practices** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, explicit preload script
- **Safe subprocesses** — yt-dlp is always executed via an argument list, never `shell=True` (prevents shell injection)
- **Sensitive files in `.gitignore`** — `credentials.json`, `token.json`, `.env`, `agent_config.json` have never been committed
- **File name sanitization** — regex strips special characters before saving uploads to disk

## Audit and fixes applied

Two rounds of end-to-end code auditing (June 2026) covered subprocess injection, path traversal, input validation, Electron security, secret storage, CORS, XSS, and dependencies. Twelve findings identified and fixed:

| # | Fix | Severity |
|---|----------|------------|
| 1 | CORS restricted to `localhost:8001` (was: `allow_origins=["*"]`) | Critical |
| 2 | yt-dlp playlist ID validated by regex before composing commands | Critical |
| 3 | Upload limited to 50 MB before processing | High |
| 4 | File delete protected against path traversal (`os.path.realpath()`) | High |
| 5 | `dangerouslySetInnerHTML` eliminated from React | Medium |
| 6 | API keys migrated to the OS keychain via `safeStorage` | Medium |
| 7 | Size limits on every Pydantic field (`max_length`) | Low |
| 8 | Path traversal in the static file server fixed | High |
| 9 | Prompt injection mitigated with XML delimiters in the RAG prompt | Medium |
| 10 | Google Drive query injection fixed with quote escaping | Medium |
| 11 | YouTube URL validated against a regex whitelist | Low |
| 12 | Chat history moved to the server — client payload ignored | Low |

### Example — CORS

**Before:** `allow_origins=["*"]`, `allow_credentials=True` — any site open in the user's browser, or any local process, could make unrestricted requests to the API.

**After:** `allow_origins=["http://localhost:8001", "http://127.0.0.1:8001"]`, `allow_credentials=False` — only the app itself can call the API.

### Example — prompt injection in the RAG pipeline

The prompt assembles each component with semantic XML delimiters:

```
<source id="1">
<title>...</title>
<date>...</date>
<link>...</link>
<content>...</content>
</source>

<conversation_history>...</conversation_history>

<question>...</question>
```

The model receives an explicit structure: content inside `<source>` is treated as reference data, not as instruction. The question is capped at 2,000 characters.

### Example — path traversal on delete

```python
real_path = os.path.realpath(txt_path)
real_subdir = os.path.realpath(subdir)
if not real_path.startswith(real_subdir + os.sep):
    return {"error": True, "message": "Invalid path"}
```

`os.path.realpath()` resolves the real absolute path — including any `../` or symlink — and verifies it's actually inside the allowed folder before any delete operation.

## General posture

- No central server to attack or compromise
- Data never leaves the machine without explicit consent
- Electron configured with isolation best practices
- The 12 fixes close the realistic attack surfaces for the current distribution phase

**What's still missing for an enterprise posture:** local authentication token for the API (server mode), pinned dependency versions, automated tests covering critical security endpoints.

For personal data handling (LGPD/GDPR), see [Privacy](/privacidade).
