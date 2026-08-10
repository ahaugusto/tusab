---
id: visao-geral
title: Visão geral da arquitetura
sidebar_label: Visão geral
slug: /arquitetura/visao-geral
---

# Visão geral da arquitetura

## Stack

**Backend:** Python 3.12 (embeddable no build de produção) + FastAPI + Uvicorn — API REST em `localhost:8001`
**RAG:** `rank_bm25` (BM25Okapi) + SQLite FTS5 (exact-match) + `sentence-transformers` (CrossEncoder) + busca vetorial opcional via Ollama (`nomic-embed-text`) + Ollama ou provedores externos
**Frontend:** React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React + react-i18next (PT/EN/ES)
**Desktop:** Electron 34 + electron-builder (NSIS para Windows; `.dmg`/`.zip` assinado e notarizado para macOS arm64) + electron-updater (auto-update via GitHub Releases)
**Extração:** yt-dlp (bundled) + pdfplumber + python-docx
**Imagens:** Ollama multimodal (llava/gemma3) → RapidOCR como fallback (Python + ONNX puro, sem binário externo)
**Áudio:** faster-whisper (modelo `base`, CPU, ~150 MB)
**Drive:** Google Auth OAuth2, escopo `drive.file`

## Arquitetura em camadas

```
api_tusab.py           thin entry point; monta app FastAPI + routers + migrações on-startup
  │
  ├── tusab_engine/api/          routers FastAPI por domínio
  │     router_status.py           GET /status, /drive-auth, /history, /open-folder
  │     router_extraction.py       POST /set-channel, /start, /pause, /cancel, /queue/*
  │     router_agent.py            /agent/* (chat, config, index, ollama, stream)
  │     router_repositorio.py      /repositorio, /relatorio, /neural/*, /reset-total
  │     router_exports.py          /export/* (zip, markdown, docx, xlsx, pdf)
  │
  ├── tusab_engine/motor/        extração e Drive
  │     drive.py                   OAuth2 Google Drive + upload
  │     extraction.py              engine principal, utilitários, relatórios
  │
  ├── tusab_engine/agent/        RAG local
  │     config.py                  carregar/salvar agent_config.json
  │     index.py                   indexação BM25 (cache + lock)
  │     chat.py                    RAG chat + streaming
  │     fts.py                     índice SQLite FTS5 (exact-match)
  │     embeddings.py              busca vetorial opcional via Ollama
  │     calibration.py             calibragem dinâmica de threshold por corpus
  │     summarize.py               resumos de vídeo sob demanda (LLM)
  │     tts.py                     texto-para-voz local (áudio do Modo Estudo)
  │
  ├── tusab_engine/state.py      AppState singleton + LogRedirector
  └── tusab_engine/storage.py    paths de dados + IO atômico
```

**Regra de dependência (acíclica):** `api → agent | motor → storage` — nunca o inverso.

## Frontend — estrutura modular

```
web_interface/src/
  services/api.js           todas as chamadas ao backend FastAPI
  services/analytics.js     wrapper PostHog (opt-in; no-op sem consentimento)
  hooks/
    useStatus.js              polling GET /status a cada 2s
    useAssistenteConfig.js    config do assistente (provider, chave, Ollama, canal-meta)
    useChatEngine.js          pipeline de chat RAG (streaming, export, auto-scroll)
  components/
    home/HomeScreen.jsx, LandingScreen.jsx, CircuitBackground.jsx
    chat/ChatDrawer.jsx, ReferenciarModal.jsx
    assistente/OllamaSetup.jsx, RepositorioTab.jsx, RelatorioTab.jsx
    extraction/ExtractionModal.jsx, PostExtractionModal.jsx
    shared/ModalWrapper.jsx, Onboarding.jsx, ConsentModal.jsx
  App.jsx                     orquestrador principal
  locales/pt.json, en.json, es.json
```

## Padrões técnicos centrais

**Local-first** — todos os dados ficam na máquina do usuário; Drive é opt-in explícito.

**Escrita atômica** — todo arquivo é gravado via `write-to-tmp` + `os.replace()`, garantindo integridade mesmo em caso de crash no meio da escrita.

**Streaming SSE** — respostas do chat via `ReadableStream`, cursor piscante na interface durante a geração.

**Histórico server-side** — `state.chat_histories` controlado exclusivamente pelo backend; o payload do cliente é ignorado, o que impede injeção de contexto falso.

**BYOK** — chaves de provedores externos armazenadas de forma criptografada via `safeStorage` do Electron (DPAPI/Keychain); `agent_config.json` grava um sentinel `__encrypted__` em vez da chave real.

## Paridade Windows/macOS

O Tusab suporta Windows e macOS desde 30 de julho de 2026. Qualquer código que toque em paths, subprocessos ou binários externos usa branch condicional por plataforma — nunca dois arquivos separados por sistema. O pipeline de CI valida ambas as plataformas a cada release (build real em `macos-latest` no GitHub Actions).

Para o detalhe de cada decisão técnica não óbvia, veja [Decisões técnicas](/arquitetura/decisoes-tecnicas). Para o layout de dados em disco, veja [Dados e armazenamento](/arquitetura/dados-e-armazenamento).
