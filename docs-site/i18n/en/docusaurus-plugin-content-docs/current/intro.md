---
id: intro
title: What Tusab is
sidebar_label: Introduction
slug: /intro
---

# What Tusab is

**Tusab is a personal knowledge management (PKM) system with local AI.** Point it at what you want to learn — a YouTube channel, PDFs, documents, notes — and Tusab absorbs it all, indexes it, and answers your questions in natural language, always citing the exact source the answer came from.

Runs entirely on your machine. Works offline with [Ollama](https://ollama.com). Zero cost in the default setup.

## The name

Tusab (Ancient Egyptian: *s-bȝ-yt*) is the name of a literary genre from Ancient Egypt — instructional texts, where someone of great experience recorded what they learned for those who came after. The most famous example is the Maxims of Ptahhotep (c. 2400 BCE).

The product does the same thing, in practice: you accumulate knowledge, Tusab organizes and indexes it, and when you have a question, it instructs you back from what you chose to teach it — never inventing, always citing the source.

## The core pipeline — IAC

| Stage | What it does |
|-------|-----------|
| **I — Index** | Extracts and indexes any source: YouTube, PDFs, DOCX, Markdown, pasted text, audio, images, WhatsApp, meeting transcripts |
| **A — Augment** | RAG (Retrieval-Augmented Generation): retrieves the most relevant excerpts from your base and delivers them to the model as context |
| **C — Chat** | Natural-language conversation, streaming responses, always citing title, date, and link of the original source |

## Why it exists

The central problem of personal knowledge management: you save a lot, but can't find it when you need it. Keyword search is poor, you don't remember where you stored something, and end up re-reading everything from scratch.

Tusab solves this with a mentor that only knows what you chose to teach it — which isn't a limitation, it's the guarantee that it won't hallucinate beyond what you indexed.

## The four profiles

Tusab adapts to whoever is using it. The profile is chosen during onboarding and can be switched at any time.

| Profile | Main use |
|--------|---------------|
| 🎓 **Student** | Imports ready-made bases (`.tusab`) shared by teachers. Query only — zero setup. |
| 📚 **Teacher** | Extracts YouTube channels, indexes teaching material, exports bases to share with the class. |
| 🔬 **Researcher** | Builds corpora from multiple sources, uses Broad Search with semantic reranking, accesses project analytics. |
| 🧑‍💻 **Specialist** | Full access: system monitoring, administration, full reset, all advanced tools. |

What changes between profiles: visible tabs, the assistant's default persona, access to AI provider configuration, the extraction queue, Drive integration, and administrative tools.

What does **not** change: RAG quality, local-first privacy, mandatory source citation, and zero cost with Ollama — those are product invariants, regardless of profile.

## What sets it apart

- **YouTube channel extraction at scale** — entire channels, hundreds of videos, via local yt-dlp
- **Multi-source** — YouTube, PDF, DOCX, Markdown, free text, images (OCR), audio (local transcription), WhatsApp, meeting transcripts (Zoom/Teams/Otter)
- **100% local** — data never leaves the machine; works offline with Ollama
- **Mandatory source citation** — every answer cites title, date, and origin link
- **Teacher → student flow** — export a ready `.tusab` base, the student imports it and starts chatting right away, no extraction needed
- **BYOK** — Groq (free), OpenAI, Anthropic, Google Gemini as optional providers, alongside local Ollama
- **MCP Server** — expose your knowledge base to Claude Code, Cursor, or any MCP client
- **Windows and macOS (Apple Silicon)** — native installers for both systems

## Next steps

- [Installation](/instalacao) — download and install Tusab
- [Profiles and user journeys](/perfis-e-jornadas) — find out which profile fits your use case
- [Features](/funcionalidades/extracao-youtube) — see each feature in detail
- [Technical architecture](/arquitetura/visao-geral) — for those who want to understand or contribute to the code
