---
id: visao-geral
title: App desktop (descontinuado)
sidebar_label: Visão geral
slug: /desktop/visao-geral
---

# App desktop (descontinuado)

:::warning App desktop descontinuado
O app desktop foi descontinuado em 19/11/2026 e não recebe mais correções nem atualizações. O código citado nesta página está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), não mais no `main`. Esta página é mantida só como registro.
:::

Antes da extensão de IA, o Tusab era distribuído como aplicativo desktop: uma janela Electron com backend Python (FastAPI) e **chat próprio** (o Assistente), que responde com RAG local usando Ollama ou um provedor externo. A última versão foi a 1.0.64, para Windows e macOS. As releases 1.0.x continuam publicadas no GitHub como histórico, e o código está na etiqueta `desktop-final`.

## Diferenças em relação à extensão

| | Extensão (`tusab-mcp/`) | App desktop |
|---|---|---|
| Quem conversa | A IA do usuário, pelas [ferramentas MCP](/ferramentas-mcp) | O [Assistente](/funcionalidades/assistente-rag) do app |
| Material de estudo | Gerado pela IA, guardado pelo Tusab | Gerado pelo próprio app ([Modo Estudo](/funcionalidades/modo-estudo)) |
| Índice | SQLite FTS5 (`data/tusab.sqlite`) | BM25 em memória + FTS5 + busca vetorial opcional; armazenado em LanceDB (`data/agent_index/`) |
| Imagens e áudio | Guardados como originais, sem leitura | Descrição de imagem (Ollama multimodal ou RapidOCR) e transcrição de áudio (faster-whisper) |
| Integração MCP | É o próprio servidor MCP (15 ferramentas) | [Servidor MCP do desktop](/funcionalidades/mcp-server) com 2 ferramentas |
| Google Drive, telemetria opcional | Não | Sim |
| Instalação | Pacote `.mcpb` ou configuração MCP | [Instaladores](/desktop/instalacao) `.exe` e `.dmg` |

Os dois gravam a **mesma estrutura de pastas** (`data/neural/{projeto}/…`): a extensão abre a pasta de dados do app, e o `.tusab` funciona nos dois sentidos. A tela da extensão é a mesma interface React do app, compilada em modo extensão.

## Stack

**Backend:** Python 3.12 (embutido no instalador) + FastAPI + Uvicorn, API REST em `localhost:8001`. O CI roda os testes com Python 3.11.
**RAG:** `rank_bm25` (BM25Okapi) + SQLite FTS5 + busca vetorial opcional via Ollama (`nomic-embed-text`); CrossEncoder e KeyBERT (`sentence-transformers`) suportados no código, fora do instalador padrão.
**Armazenamento do índice:** LanceDB (`data/agent_index/{projeto}.lancedb/`).
**Interface:** React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React + react-i18next (pt, en, es), em `web_interface/`, compilada com `npx vite build` para `web_interface/dist/`.
**Desktop:** Electron 44 + electron-builder (NSIS no Windows; `.dmg`/`.zip` assinado e notarizado para macOS arm64) + electron-updater (atualização via GitHub Releases).
**Extração:** yt-dlp (empacotado) + pdfplumber + python-docx; página web com trafilatura.
**Imagens:** Ollama multimodal (llava/gemma3), com RapidOCR como alternativa.
**Áudio:** faster-whisper (modelo `base`, CPU).
**Drive:** OAuth2 do Google, escopo `drive.file`.

## Camadas do backend

```
api_tusab.py           ponto de entrada; monta o app FastAPI, routers e migrações na inicialização
  │
  ├── tusab_engine/api/          routers FastAPI por domínio
  │     router_status.py           /status, /drive-auth, /history, /open-folder, /agent/mcp/config
  │     router_extraction.py       /set-channel, /start, /pause, /cancel, /queue/*
  │     router_agent.py            /agent/* (chat, configuração, índice, Ollama, streaming)
  │     router_estudo.py           Modo Estudo
  │     router_repositorio.py      /repositorio, /relatorio, /neural/*, /reset-total
  │     router_exports.py          /export/* (zip, markdown, docx, xlsx, pdf)
  │     router_fontes.py           fontes públicas
  │     router_digest.py, router_metrics.py
  │
  ├── tusab_engine/motor/        extração (extraction.py), Drive, fontes públicas, FHIR, arXiv,
  │                              página web, atualização automática
  ├── tusab_engine/agent/        RAG local: index.py, chat.py, fts.py, embeddings.py,
  │                              calibration.py, lance_store.py, llm_providers.py, tts.py…
  ├── tusab_engine/mcp_server.py servidor MCP do desktop (2 ferramentas)
  ├── tusab_engine/state.py      estado compartilhado (AppState) + LogRedirector
  └── tusab_engine/storage.py    caminhos de dados + escrita atômica
```

**Regra de dependência (acíclica):** `api → agent | motor → storage`; nunca o inverso. `motor_tusab.py` e `agent_tusab.py`, na raiz, são reexportações para compatibilidade com o Electron e código antigo.

## Dados do app desktop

| Contexto | Raiz de dados |
|---|---|
| App instalado | Pasta `userData` do Electron: `%APPDATA%\Tusab` (Windows), `~/Library/Application Support/Tusab` (macOS) |
| Desenvolvimento | Pasta do repositório (`./data/`) |
| Sobrescrito | Variável `TUSAB_DATA_DIR` |

Além da estrutura comum descrita em [Dados e armazenamento](/arquitetura/dados-e-armazenamento), o desktop usa:

| Caminho | Conteúdo |
|---|---|
| `data/agent_index/{projeto}.lancedb/` | Índice do Assistente (LanceDB) |
| `data/config/agent_config.json` | Configuração do Assistente; guarda o marcador `__encrypted__` no lugar da chave de API |
| `config/keystore.json` (na pasta `userData`) | Chaves de API cifradas com `safeStorage` (DPAPI no Windows, Keychain no macOS) |
| `data/config/token.json`, `credentials.json` | OAuth do Google Drive |

`config/` **não deve ser compartilhado** nem ir para backup em nuvem sem cifra: pode conter tokens OAuth e configuração do Assistente. O app cria um `LEIA-ME-SEGURANCA.txt` na pasta de dados explicando isso.

Na inicialização, funções idempotentes migram estruturas antigas, se existirem: `migrar_cerebro_para_neural()`, `migrar_gestao_para_cerebro()`, `migrar_pastas_para_ingles()`. Na troca para LanceDB (v1.0.55), só o armazenamento mudou (indexação incremental cerca de 12 vezes mais rápida); o ranqueamento continua BM25 em memória, porque a busca nativa do LanceDB perdeu precisão nos testes.

## Páginas desta seção

- [Instalação](/desktop/instalacao): instaladores, primeira execução, provedores de IA, Google Drive.
- [Assistente (chat RAG)](/funcionalidades/assistente-rag).
- [Modo Estudo](/funcionalidades/modo-estudo).
- [Servidor MCP do desktop](/funcionalidades/mcp-server).
- [Decisões técnicas](/desktop/decisoes-tecnicas).
- [Desenvolvimento](/desktop/desenvolvimento): setup, build do Electron, testes e CI.
