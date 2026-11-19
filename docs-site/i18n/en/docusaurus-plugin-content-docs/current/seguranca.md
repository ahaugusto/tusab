---
id: seguranca
title: Security
sidebar_label: Security
slug: /seguranca
---

# Security

Tusab runs on the user's computer and doesn't depend on a central server. That reduces the attack surface, but doesn't eliminate it. The real surfaces are:

1. the screen's **local HTTP server** (`127.0.0.1`), which other websites open in the same browser may try to reach;
2. the **content of the sources**, which goes to the AI and may contain hidden instructions (indirect *prompt injection*);
3. the **inputs**: YouTube links, uploaded files, imported `.tusab` files, web pages;
4. what **leaves the computer**: images sent to the AI, yt-dlp downloads.

## Local screen server

Summary of the protections in `tusab-mcp/src/painel.js` (details in [Tusab screen](/tela#local-server-security)):

- listens only on `127.0.0.1`, on a random port, and closes together with the AI tool;
- requires the session key (256 bits, new at each start) in the `X-Tusab-Chave` header, with constant-time comparison;
- refuses a `Host` other than `127.0.0.1:<port>` (DNS rebinding) and `Origin`/`Sec-Fetch-Site` from other sites;
- sends no CORS headers; CSP `'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`;
- accepts only `GET`, `POST` and `DELETE` on the API, a JSON body (up to 12 MB) or file upload (up to 50 MB), and only serves files from inside `interface/`.

The screen link carries the key in the URL (`?chave=`) and must not be shared; it stops working when the AI tool closes.

## Source content and the AI

- Every tool that returns content from the base includes the notice that **the text is data from the sources, not instructions**.
- The MCP server instructions ask the AI never to follow orders that appear inside the excerpts.
- These measures reduce the risk, but don't isolate: no model treats delimiters or notices as a guaranteed barrier. The structural protection is that Tusab **puts no secrets in what it hands to the AI** (the extension stores no API keys or tokens).
- Tools that change the base or access the internet are marked as such (`readOnlyHint: false`, `openWorldHint: true`), and the instructions ask the AI to add content only when the user asks.

## Files and paths

- **Types checked by signature** (first bytes), not only by name extension; SVG, HTML and executables are refused.
- **Originals** at a path recomputed by convention (`documents/originais/{id}_{nome}{ext}`, `id` with 8 hex characters), never read from the manifest; Tusab never opens an original with the system's default program.
- **Path traversal:** every read, write and delete checks that the final path stays inside the allowed folder (`dentroDe`); project names are cleaned and can't start with a dot.
- **`.tusab` import:** size limit (512 MB uploaded), limits on the uncompressed content (against *zip bombs*), a check of every zip path (against *zip slip*) and discarding of originals with a forbidden type or non-matching signature.
- **Atomic writes** for every file (temporary file + rename).

## Extraction and network

- Channel URL and playlist ID validated by regular expressions before the command is built.
- yt-dlp run with an argument list, never through a shell.
- yt-dlp downloaded only from `github.com/yt-dlp/yt-dlp/releases/latest`, with the SHA-256 sum checked against the published `SHA2-256SUMS`; if it doesn't match, the download is discarded.
- Web pages: `robots.txt` is checked before reading.
- The browser is opened without a shell, with the link validated by a regular expression.

## Images sent to the AI

Before `tusab_ler_original` returns an image, EXIF, XMP, comments and embedded text (including GPS) are removed from JPEG, PNG and WebP. If cleaning can't be guaranteed, the image isn't sent (fail closed). Images above 3 MB are not sent. See [Originals and images](/funcionalidades/originais-e-imagens).

## Known gaps

- Metadata removal doesn't apply to GIF, which is sent as is.
- People mentioned in the body of case-law texts, outside the party fields, are not anonymized automatically (see [Public sources](/funcionalidades/fontes-publicas#privacy-in-case-law)).
- The "data, not instructions" notice is a mitigation, not isolation: a malicious document can still influence the AI's answer. Check the citations.

## Desktop app

The desktop app has other surfaces: the FastAPI API on `localhost:8001`, the Electron window and the API keys stored on the system. The controls applied:

| Control | How |
|---|---|
| Isolated Electron | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, explicit preload |
| Restricted CORS | `allow_origins` only `http://localhost:8001` and `http://127.0.0.1:8001`, `allow_credentials=False` |
| API keys | In the system keychain via `safeStorage` (DPAPI/Keychain); `agent_config.json` stores `__encrypted__`; the key appears masked in `GET /agent/config` |
| Uploads | 50 MB limit per document; sanitized names; deletion protected with `os.path.realpath()` |
| Input fields | Size limits (`max_length`) in the Pydantic models; chat question up to 2,000 characters |
| Prompt injection in the chat | Sources delimited by XML tags (`<source>`, `<content>`), an explicit instruction to treat commands inside the content as data and, after the answer, detection of signs that it obeyed a hidden instruction (a notice in the interface, without blocking) |
| Chat history | Kept on the server (12 messages); history sent by the client is ignored |
| Interface | No `dangerouslySetInnerHTML` |
| Google Drive | Minimal `drive.file` scope; quotes escaped in Drive queries |

Desktop technical gap: the API on `localhost:8001` requires no authentication token; protection against other websites is the restricted CORS.

For personal data handling, see [Privacy](/privacidade).
