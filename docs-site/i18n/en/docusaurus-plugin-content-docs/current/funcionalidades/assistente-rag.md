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

1. **Intent routing** — before any search, chat checks whether the question can be answered without retrieval (see "Intent routing" below). If not, it moves on to search as usual.
2. **Query expansion** — the LLM generates variations of the question to cover synonyms and paraphrases (disabled for Ollama: adds 10–15s of latency on small models)
3. **Context retrieval** — BM25Okapi search over the selected project(s)' index, always merged with FTS5 (exact-match, guarantees recall of literal terms like proper names and acronyms) and, in Broad Search with the embedding model installed, also with vector search by meaning (see "Vector search" below)
4. **Prompt assembly** — every retrieved source is wrapped in semantic XML tags (`<source id="N">`) to mitigate prompt injection
5. **Generation** — local model (Ollama) or a configured external provider
6. **Post-generation verification** — two independent checks: keyword overlap against the retrieved sources (measures hallucination), and a heuristic that flags when the answer looks like it followed an instruction hidden in a base document (indirect prompt injection) instead of answering the question

## Intent routing

Not every question needs to search the base. Before the full pipeline, chat recognizes two kinds of question and answers them directly:

| Type | Example | How it answers |
|------|---------|----------------|
| **Base metadata** | "how many videos are in this base?", "which is the most recent?", "when was this base indexed?" | Reads the real value straight from disk (extraction summary, manifests) — never asks the model to "guess" a number. Zero LLM calls. |
| **Arithmetic** | "what is 15+27?", "compute (100-25)*2" | Solved by a safe arithmetic evaluator (never `eval`/`exec`, only the operators +, -, *, /, %, `**`), using only the numbers typed in the question itself — never numbers from retrieved documents, so third-party content can't become a prompt-injection surface. |

Greetings ("hi", "thanks") and referenced excerpts (`[file]`) also get an immediate answer, without waiting for the model's intent classification. Any other question goes through the search pipeline as usual — routing never invents an answer: if it doesn't confidently recognize the pattern, it falls back to search.

## Narrow Search vs. Broad Search

| Mode | How it works |
|------|---------------|
| **Narrow** | BM25 + exact-match search (FTS5) — ~1 ms for the search step |
| **Broad** | Everything in Narrow + search by meaning via Ollama, when the embedding model is downloaded (see "Vector search" below). It matters most exactly when keyword search finds little — for example, a question in Portuguese about documents in English |

:::info Semantic reranking (CrossEncoder) and KeyBERT are not in the standard installer
Tusab's code can also rerank Broad Search candidates with a CrossEncoder (`ms-marco-MiniLM-L-6-v2`) — BM25 hands over 12 to 30 candidates, depending on base size, and the model reorders them by semantic relevance before the top 6 go to the prompt (+236 ms measured) — and enrich the index with keywords via KeyBERT. Both depend on a heavy AI stack (`torch` and `sentence-transformers`) that would cost 0.5–1 GB of RAM and multiply the installer size. That's why it is **left out of the standard installer** on Windows and macOS, and the app works without it: search keeps running on BM25, FTS5 and search by meaning via Ollama. The stack is reserved for the edition with advanced semantic search (`requirements-enterprise.txt` in the source code).
:::

## Anti-hallucination

- A relevance threshold, calibrated dynamically per corpus (not a fixed value — a small corpus and a corpus with thousands of chunks have very different score distributions), determines whether there's enough context to answer
- When Narrow Search finds nothing, chat automatically retries with Broad Search before giving up — only then, if there's still no context, it returns `sem_contexto: true` and the interface shows the **"Index now"** button instead of a generic message
- Per-sentence graded confidence: when part of the answer has weak direct support from the sources, an amber indicator appears under the message — without suppressing the whole answer
- Separate signal for possible instruction hijacking: if the answer looks like it followed a command hidden in a base document, a warning is shown — this is a different mechanism from per-sentence confidence, and it doesn't block the answer

## Vector search (embeddings)

Optional complement to keyword search, active only in Broad Search: retrieves passages by **meaning**, not just shared terms — useful when your question uses different vocabulary than the content. Runs 100% locally via Ollama (`nomic-embed-text`, ~274 MB). Download the model with one click on the "Vector search" card in the Assistant tab and re-index your base — from then on, every Broad Search automatically combines both methods. Without the model installed, behavior is identical to before the feature existed (graceful degradation).

## Multi-base

A conversation can query multiple projects at once. The "Knowledge Base" panel (database icon in the chat header) lets you pick which bases participate and re-index any that don't have an index yet.

## Citation and sources

Every answer cites the title, date, and origin link. Clicking a source opens the original video on YouTube or the corresponding local document.

## Feedback (local RLHF)

👍 on an answer saves the question/answer pair to `neural/{project}/texts/feedback_{timestamp}.txt` — on the next indexing run, that content enters the BM25 corpus and becomes retrievable for similar questions. 👎 no longer just discards it silently: it accumulates a per-project counter that widens the number of candidates Broad Search's semantic reranking considers (never reduces, never discards a result — it only gives the search a better chance of finding the right excerpt). This effect depends on the CrossEncoder, which is not in the standard installer (see above). Neither is model training — they improve retrieval, not the LLM's weights.

## Referencing excerpts

The 🔍 button in the chat toolbar (or "Reference excerpt" on messages without context) opens a federated search: BM25 + query expansion (and semantic reranking, when available) across one or more bases, with results grouped by project and multi-select. Chosen excerpts are injected into the message field as pinned context.

## Persona and tone

Five personas available: didactic, technical, objective, casual, socratic. The default persona varies by profile (didactic for Student/Teacher, technical for Researcher, objective for Specialist) and can be changed at any time in the Assistant tab or the Admin panel.

## Server-side history

Conversation history is kept on the server (`state.chat_histories`), limited to 12 messages (6 exchanges). The payload sent by the client is ignored — this prevents a malicious client from injecting fake history to manipulate the model's behavior.

## AI providers

| Provider | Default model | Cost | Key required |
|----------|--------------|-------|-------------------|
| Ollama (default) | llama3.2:1b | Free | No |
| Groq | llama-3.1-8b-instant | Free tier | Yes |
| OpenRouter | meta-llama/llama-3.3-70b-instruct:free (configurable) | Free tier | Yes |
| OpenAI | gpt-4o-mini | Paid | Yes |
| Anthropic | claude-haiku-4-5 (auxiliary) / claude-sonnet-4-6 (main answer) | Paid | Yes |
| Google Gemini | gemini-1.5-flash | Paid | Yes |
| Custom endpoint | any OpenAI-compatible server | Depends | Optional |

Ollama models with native reasoning (qwen3, deepseek-r1) are supported, with an option to show the model's reasoning.
