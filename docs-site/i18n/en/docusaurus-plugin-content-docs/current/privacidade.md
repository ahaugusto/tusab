---
id: privacidade
title: Privacy
sidebar_label: Privacy
slug: /privacidade
---

# Privacy

Tusab's core principle is **local-first**: data stays on the user's machine. CriAugu does not operate servers that store user content, conversations, or knowledge bases.

This summary covers the essential points of the full Privacy Policy, drafted in compliance with **LGPD** (Brazilian Law No. 13,709/2018) and the **GDPR** (EU Regulation 2016/679).

## Data processed only locally

Never sent to CriAugu's servers:

| Data | Where it lives |
|------|-----------|
| Transcripts, documents, indexed texts | `data/neural/{project}/` |
| BM25 index | `data/indexes/{project}_index.json` |
| Assistant settings | `data/config/agent_config.json` |
| Chat history | RAM — does not persist between sessions |

## Third-party API keys

Stored locally (preferably via Electron's `safeStorage` — DPAPI/Keychain). Never transmitted to CriAugu's servers; used directly from the device to call the chosen provider. The user is responsible for the security of these keys on their own device.

## Telemetry (opt-in)

With explicit consent (modal on first launch), anonymous usage events are collected via PostHog: app opened, extraction started, indexing, chat message sent (only the modality, not the content), configured provider.

**Never collected:** message content, channel URLs, video titles, file names, API keys, or any personally identifiable data. Consent can be revoked at any time in settings.

## International data transfer

When using an external AI provider (OpenAI, Gemini, Anthropic, Groq), the content of queries — the question and retrieved context excerpts — is transmitted to that provider's servers, which may be outside Brazil. Tusab shows an explicit warning when configuring an external provider. **Ollama (the local default) generates no data transfer at all.**

## Data subject rights (LGPD Art. 18 / GDPR Art. 17)

| Right | How to exercise it |
|---------|--------------|
| Access | Data folder directly accessible via the operating system |
| Correction | Edit files directly or via the interface |
| Deletion | The app's Repository tab, or directly in the file system |
| Portability | Data in open formats (`.txt`, `.json`, `.csv`) — exportable without depending on Tusab |
| Consent revocation | App settings |
| Objection to processing | Since processing is local, uninstalling the app stops any processing |

Contact: **tusab@tusab.solutions**

## Retention

| Data | Period |
|------|---------|
| Knowledge base (`neural/`) | Indefinite — fully user-controlled |
| Settings | Indefinite — user can delete at any time |
| Chat history | Session duration |
| Anonymous telemetry | 12 months |
| Drive OAuth token | Until manually revoked |

## Minors

Tusab is not intended for anyone under 16.

---

Data controller: **CriAugu — CNPJ 65.131.075/0001-57**. The full, current policy is always available at [tusab.solutions](https://tusab.solutions).
