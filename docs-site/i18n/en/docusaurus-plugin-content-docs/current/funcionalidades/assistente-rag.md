---
id: assistente-rag
title: Assistant — RAG chat
sidebar_label: Assistant (RAG chat)
slug: /funcionalidades/assistente-rag
---

# Assistant — RAG chat

Chat is where Tusab delivers its value: you ask in natural language, get a streaming answer, always with source citation.

:::info Product name vs. code name
In the interface this feature is called **"Assistant"** — a more precise term, since it's a chat with local RAG, no autonomous loop or self-initiated tool calls. Internally the backend still uses the name `agent` (`tusab_engine/agent/`, `/agent/*` routes, `agent_config.json`) — changing that would require migrating configuration already saved to disk on existing installs, with no real UX gain. It's intentional, not renaming leftovers.
:::

## RAG pipeline

1. **Query expansion** — the LLM generates variations of the question to cover synonyms and paraphrases (disabled for Ollama: adds 10–15s of latency on small models)
2. **Context retrieval** — BM25Okapi search over the selected project(s)' index, always merged with FTS5 (exact-match, guarantees recall of literal terms like proper names and acronyms) and, in Broad Search with the embedding model installed, also with vector search by meaning (see "Vector search" below)
3. **Prompt assembly** — every retrieved source is wrapped in semantic XML tags (`<source id="N">`) to mitigate prompt injection
4. **Generation** — local model (Ollama) or a configured external provider
5. **Post-generation verification** — checks keyword overlap against the retrieved sources

## Narrow Search vs. Broad Search

| Mode | How it works | Latency |
|------|---------------|----------|
| **Narrow** | Pure BM25 | ~1 ms |
| **Broad** | BM25 retrieves the top-12 → CrossEncoder (`ms-marco-MiniLM-L-6-v2`) reranks semantically → top-6 go to the prompt | +236 ms measured |

## Anti-hallucination

- A relevance threshold, calibrated dynamically per corpus (not a fixed value — a small corpus and a corpus with thousands of chunks have very different score distributions), determines whether there's enough context to answer
- When there isn't, chat returns `sem_contexto: true` and the interface shows the **"Index now"** button instead of a generic message
- Per-sentence graded confidence: when part of the answer has weak direct support from the sources, an amber indicator appears under the message — without suppressing the whole answer

## Vector search (embeddings)

Optional complement to keyword search, active only in Broad Search: retrieves passages by **meaning**, not just shared terms — useful when your question uses different vocabulary than the content. Runs 100% locally via Ollama (`nomic-embed-text`, ~274 MB). Download the model with one click on the "Vector search" card in the Assistant tab and re-index your base — from then on, every Broad Search automatically combines both methods. Without the model installed, behavior is identical to before the feature existed (graceful degradation).

## Multi-base

A conversation can query multiple projects at once. The "Knowledge Base" panel (database icon in the chat header) lets you pick which bases participate and re-index any that don't have an index yet.

## Citation and sources

Every answer cites the title, date, and origin link. Clicking a source opens the original video on YouTube or the corresponding local document.

## Feedback (local RLHF)

👍 on an answer saves the question/answer pair to `neural/{project}/texts/feedback_{timestamp}.txt` — on the next indexing run, that content enters the BM25 corpus and becomes retrievable for similar questions. 👎 no longer just discards it silently: it accumulates a per-project counter that widens the number of candidates considered in Broad Search (never reduces, never discards a result — it only gives the search a better chance of finding the right excerpt). Neither is model training — they improve retrieval, not the LLM's weights.

## Referencing excerpts

The 🔍 button in the chat toolbar (or "Reference excerpt" on messages without context) opens a federated search: BM25 + query expansion + CrossEncoder across one or more bases, with results grouped by project and multi-select. Chosen excerpts are injected into the message field as pinned context.

## Persona and tone

Five personas available: didactic, technical, objective, casual, socratic. The default persona varies by profile (didactic for Student/Teacher, technical for Researcher, objective for Specialist) and can be changed at any time in the Assistant tab or the Admin panel.

## Server-side history

Conversation history is kept on the server (`state.chat_histories`), limited to 12 messages (6 exchanges). The payload sent by the client is ignored — this prevents a malicious client from injecting fake history to manipulate the model's behavior.

## AI providers

| Provider | Default model | Cost | Key required |
|----------|--------------|-------|-------------------|
| Ollama (default) | llama3.2:1b | Free | No |
| Groq | llama-3.1-8b-instant | Free tier | Yes |
| OpenAI | gpt-4o-mini | Paid | Yes |
| Anthropic | claude-haiku-4-5 (auxiliary) / claude-sonnet-4-6 (main answer) | Paid | Yes |
| Google Gemini | gemini-1.5-flash | Paid | Yes |
| Custom endpoint | any OpenAI-compatible server | Depends | Optional |

Ollama models with native reasoning (qwen3, deepseek-r1) are supported, with an option to show the model's reasoning.
