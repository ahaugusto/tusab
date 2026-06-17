# Tusab — Contexto de Projeto para Claude Code

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Autor:** Augusto Brasil · https://linkedin.com/in/augustoalvesbrasil

---

## O que é este projeto

Tusab é um sistema de gestão de conhecimento pessoal (PKM) com IA local.
Extrai transcrições de canais do YouTube via yt-dlp, indexa com BM25 e permite
consultas em linguagem natural via chat com LLM (Ollama, Groq, OpenAI, Gemini, Anthropic).

**Stack:** Electron 34 + FastAPI/Python 3.11 (localhost:8001) + React 19 + Vite + Tailwind

---

## Como rodar

```powershell
# Backend (sempre no .venv)
.venv\Scripts\python.exe api_tusab.py

# Frontend
cd web_interface; npx vite build   # build
cd web_interface; npm run dev       # dev server

# Testes
.venv\Scripts\python.exe -m pytest tests/ -v

# Electron
cd electron; npm run dev
```

**Armadilhas:**
- `pip install` vai pro Python do sistema, não `.venv` — sempre prefixar com `.venv\Scripts\python.exe -m pip`
- `npm run build` via Bash não atualiza dist no Windows — usar PowerShell
- `TUSAB_DATA_DIR` env var define onde os dados ficam (usado em testes e no Electron packaged)

---

## Arquitetura em camadas

```
api_tusab.py           ← thin entry point (165 linhas); monta app FastAPI + routers
  │
  ├── tusab_engine/api/          ← routers FastAPI por domínio
  │     router_status.py           GET /status, /drive-auth, /history, /open-folder
  │     router_extraction.py       POST /set-channel, /start, /pause, /cancel
  │     router_agent.py            /agent/* (chat, config, index, ollama, stream)
  │     router_repositorio.py      /repositorio, /relatorio, /cerebro/*
  │
  ├── tusab_engine/motor/        ← extração e Drive
  │     drive.py                   OAuth2 Google Drive + upload (get_drive_service, upload_txt_como_gdoc_seguro)
  │     extraction.py              engine principal (tusab_engine), utilitários, relatórios
  │
  ├── tusab_engine/agent/        ← RAG local
  │     config.py                  carregar/salvar agent_config.json
  │     index.py                   BM25 indexing (_bm25_cache, _bm25_lock, indexar)
  │     chat.py                    RAG chat + streaming (chat, chat_stream, _recuperar_contexto)
  │
  ├── tusab_engine/state.py      ← AppState singleton + LogRedirector
  └── tusab_engine/storage.py    ← paths de dados + IO atômico
```

**Regra de dependência (acíclica):**
`api → agent | motor → storage`  — NUNCA importar de `api` dentro de `agent` ou `motor`.

**Shims de compatibilidade na raiz:**
`motor_tusab.py` e `agent_tusab.py` são re-exports puros — Electron e código legado
os importam pelo nome antigo, sem breaking change.

---

## Módulos — referência semântica

### `tusab_engine/storage.py`
**Tags:** paths, diretórios, dados, IO, atômico, CSV, JSON, cerebro, config, temp, gestao
**Responsabilidade:** fonte de verdade para todos os caminhos de dados do app.
**Entrypoints principais:** `obter_caminho_dados()`, `DADOS_DIR`, `CEREBRO_DIR`, `CONFIG_PATH`,
`salvar_csv_atomico(df, path)`, `salvar_json_atomico(obj, path, indent)`.
**Padrão atômico:** write-to-`.tmp` + `os.replace()` — mesmo volume, substituição atômica pelo SO.
**Override:** `TUSAB_DATA_DIR` env var substitui o root de dados (usado em testes e Electron packaged).

---

### `tusab_engine/state.py`
**Tags:** estado global, singleton, AppState, LogRedirector, locks, threading, concorrência, logs, stats
**Responsabilidade:** estado compartilhado entre routers e background threads.
**Entrypoints principais:** `state` (singleton AppState), `LogRedirector`, `_real_stderr`.
**Locks:**
- `state.state_lock` (RLock) — protege `stats` e `logs`; RLock porque `print()` dentro de locked region reentra no LogRedirector
- `state.hist_lock` (Lock) — protege `chat_histories`
- `state.agent_chat_lock` (Lock) — serializa chamadas ao LLM
**Side effect no import:** `sys.stdout = LogRedirector()` — redireciona prints do motor de background thread para o array `state.logs`.
**Importante:** importar `state.py` APÓS `motor_tusab` e `agent_tusab` para preservar a ordem original de inicialização.

---

### `tusab_engine/agent/config.py`
**Tags:** configuração, agente, provider, api_key, groq, openai, gemini, anthropic, ollama, JSON
**Responsabilidade:** leitura/escrita de `agent_config.json` — ponto único de acesso.
**Funções:** `carregar_config() → dict`, `salvar_config(config: dict)`.

---

### `tusab_engine/agent/index.py`
**Tags:** BM25, indexação, rank_bm25, cache, chunks, corpus, youtube, documentos, textos, canal, prefixo
**Responsabilidade:** construção e gerenciamento do índice BM25 local.
**Entrypoints:** `indexar(canal_nome, canal_prefixo, callback, stop_event) → int`, `get_agent_status() → dict`.
**Cache:** `_bm25_cache: dict` + `_bm25_lock (threading.Lock)` — evita dupla reconstrução quando dois chats usam o mesmo canal simultaneamente.
**Helpers:** `_index_path(prefixo)`, `_invalidar_cache(prefixo)`, `_carregar_meta_canal(prefixo)`,
`_get_canal_youtube_dir(prefixo)`, `_get_canal_doc_dirs(prefixo)`, `_enriquecer_documento(texto, tags, desc)`.
**Corpus:** YouTube (`cerebro/{prefixo}/youtube/`) + documentos + textos + legado (`cerebro/youtube/`).

---

### `tusab_engine/agent/chat.py`
**Tags:** RAG, chat, streaming, LLM, contexto, BM25, recuperação, histórico, busca ampla, canal
**Responsabilidade:** pipeline RAG — recupera chunks relevantes e gera resposta via LLM.
**Entrypoints:** `chat(mensagem, canal_nome, hist, canais_extras, busca_ampla) → dict`,
`chat_stream(mensagem, canal_nome, hist, canais_extras, busca_ampla) → Iterator[str]`.
**Pipeline:** `_expandir_query` → `_recuperar_contexto` (BM25 lookup) → `_montar_prompt` → LLM → `_verificar_alucinacao`.
**Dependência:** importa de `index.py` (one-way); nunca o contrário.

---

### `tusab_engine/motor/drive.py`
**Tags:** Google Drive, OAuth, autenticação, upload, gdoc, credenciais, token, SCOPES
**Responsabilidade:** autenticação OAuth2 e upload de arquivos/docs para o Google Drive.
**Entrypoints:** `get_drive_status() → str`, `is_authenticated() → bool`, `get_drive_service(stop_event) → Resource`,
`garantir_pasta_drive(service, nome, parent_id)`, `upload_txt_como_gdoc_seguro(service, filepath, folder_id)`,
`upload_arquivo_drive(service, filepath, folder_id)`.
**Cancelamento:** `stop_event` passado ao `get_drive_service` permite abortar o fluxo OAuth (watchdog thread derruba o servidor WSGI local).
**Segurança:** `credentials.json` e `token.json` nunca são commitados; ficam em `DADOS_DIR/config/`.

---

### `tusab_engine/motor/extraction.py`
**Tags:** extração, YouTube, yt-dlp, transcrição, VTT, canal, mapeamento, CSV, cerebro, relatório, migração
**Responsabilidade:** engine principal de extração de transcrições e geração de base de conhecimento.
**Entrypoints:** `tusab_engine(canal_url, evento_pausa, evento_cancelar, fontes_filtro)` (função principal),
`sanitizar_nome(nome)`, `extrair_nome_canal(url)`, `limpar_vtt(path)`, `executar_comando(cmd)`,
`coletar_meta_canal(url, nome, prefixo)`, `gerar_relatorio_checkup(safe, db_file)`, `gerar_readme(raw, safe)`,
`migrar_cerebro_txt()`, `migrar_canal_para_subdir(prefixo)`.
**Controle:** `evento_pausa (threading.Event)` e `evento_cancelar (threading.Event)` — set/clear do router.
**Nota de naming:** a função `tusab_engine()` tem o mesmo nome do pacote — sem conflito porque está em `motor/extraction.py`, não no `__init__.py` do pacote.

---

### `tusab_engine/api/router_status.py`
**Tags:** status, drive-auth, histórico, abrir pasta, polling, is_running, stats, logs
**Rotas:** `GET /status`, `POST /drive-auth`, `POST /drive-auth-cancel`, `GET /history`, `GET /open-folder`.
**Background:** `run_drive_auth()` — executa OAuth em background task do FastAPI.

---

### `tusab_engine/api/router_extraction.py`
**Tags:** extração, canal, iniciar, pausar, cancelar, fontes, motor, YouTube
**Rotas:** `POST /set-channel`, `POST /start`, `POST /pause`, `POST /cancel`.
**Background:** `run_motor()` — chama `motor_tusab.tusab_engine()` em background task; usa `threading.Thread` para auto-reset de status após 15s.
**Validação:** `_YT_URL_RE` — regex que aceita `/@canal`, `/channel/...`, `/c/...`; rejeita qualquer outra coisa.

---

### `tusab_engine/api/router_agent.py`
**Tags:** agente, RAG, chat, streaming, indexação, ollama, groq, gemini, openai, anthropic, config, histórico
**Rotas:** `GET /agent/status`, `GET /log`, `GET|POST /agent/config`, `POST /agent/index`, `POST /agent/test-key`,
`POST /agent/index-cancel`, `POST /agent/chat`, `POST /agent/chat/stream`, `POST /agent/chat/clear`,
`DELETE /agent/canal/{canal_nome}`, `/agent/ollama/*`.
**Background:** `_run_indexacao(canal_nome, canal_prefixo)` — BM25 com callback de progresso.
**Histórico:** `_MAX_HIST_MSGS = 12` (6 trocas); server-side em `state.chat_histories`; payload do cliente é ignorado.

---

### `tusab_engine/api/router_repositorio.py`
**Tags:** repositório, cerebro, documentos, textos, upload, PDF, DOCX, manifesto, limpeza, histórico, CSV
**Rotas:** `GET /repositorio`, `GET /relatorio/{canal}`, `POST /cerebro/upload`, `POST /cerebro/texto`,
`DELETE /cerebro/arquivo/{tipo}/{fid}`, `DELETE /historico/limpar`, `DELETE /cerebro/limpar`.
**Manifest pattern:** cada subdiretório de docs/textos mantém `_manifest.json` como índice local (atomic write).

---

## Frontend — estrutura

```
web_interface/src/
  constants/index.js        IDs de eventos PostHog, constantes de UI
  services/api.js           todas as chamadas ao backend FastAPI
  services/analytics.js     wrapper PostHog (opt-in; no-op sem consentimento)
  hooks/
    useStatus.js            polling GET /status a cada 2s
    useAgentStatus.js       polling GET /agent/status
    useOnboarding.js        lógica de onboarding contextual
  components/
    home/HomeScreen.jsx     tela inicial (logo + cards)
    chat/ChatDrawer.jsx     drawer lateral de chat RAG
    sidebar/SidebarContent.jsx
    agent/
      OllamaSetup.jsx       setup guiado do Ollama
      RepositorioTab.jsx    listagem e upload de docs/textos
      RelatorioTab.jsx      tabela de vídeos + stats de cobertura
    extraction/
      ExtractionModal.jsx   seletor de fontes + iniciar extração
      PostExtractionModal.jsx ações pós-extração
    shared/
      Onboarding.jsx, ConsentModal.jsx, StatCard.jsx, LogLine.jsx, ProgressToast.jsx
  App.jsx                   orquestrador principal (~1 340 linhas)
  locales/pt.json, en.json, es.json   i18n
```

**Segurança:** `VITE_POSTHOG_KEY` fica em `web_interface/.env` (gitignored). **Nunca commitar.**

---

## Testes

```
tests/
  conftest.py               fixture: TUSAB_DATA_DIR → tempdir antes de qualquer import
  test_api.py               17 testes de integração (TestClient FastAPI)
  test_confiabilidade.py    6 testes: atômicos + concorrência + índice corrompido/vazio
```

**23/23 verde.** Para rodar: `.venv\Scripts\python.exe -m pytest tests/ -v`

---

## Decisões técnicas não óbvias

| Decisão | Motivo |
|---------|--------|
| `RLock` em `state_lock` (não `Lock`) | `print()` dentro de locked region reentra no `LogRedirector` — `Lock` causaria deadlock |
| `os.replace()` para escrita atômica | Operação atômica no mesmo volume — arquivo sempre íntegro mesmo com crash |
| `tusab_engine/` (não `Tusab/`) | `Tusab.spec` existe na raiz (PyInstaller) — colisão de nome |
| yt-dlp local no IP do usuário | Princípio intocável — dados nunca saem da máquina |
| BM25 sem query expansion para Ollama | Query expansion aumentava latência de 3s para 15s |
| `sub_langs = 'pt'` fixo | Tentativas duplas (pt+en) causavam rate limit 429 no YouTube |
| Shims na raiz (`motor_tusab.py`, `agent_tusab.py`) | Electron `extraResources.filter` e testes importam pelo nome antigo — zero breaking change |
| Histórico server-side no chat | Evita payload manipulado pelo cliente injetar contexto falso |

---

## Onde encontrar o quê

| Quero... | Vá para... |
|----------|------------|
| Mudar onde os dados ficam | `tusab_engine/storage.py` |
| Mudar o estado global / adicionar flag | `tusab_engine/state.py` → `AppState` |
| Mudar o fluxo de extração YouTube | `tusab_engine/motor/extraction.py` → `tusab_engine()` |
| Mudar integração com Drive | `tusab_engine/motor/drive.py` |
| Mudar como o BM25 indexa | `tusab_engine/agent/index.py` → `indexar()` |
| Mudar como o chat recupera contexto | `tusab_engine/agent/chat.py` → `_recuperar_contexto()` |
| Adicionar rota de status/drive | `tusab_engine/api/router_status.py` |
| Adicionar rota de extração | `tusab_engine/api/router_extraction.py` |
| Adicionar rota de agente | `tusab_engine/api/router_agent.py` |
| Adicionar rota de repositório | `tusab_engine/api/router_repositorio.py` |
| Mudar como o frontend chama o backend | `web_interface/src/services/api.js` |
| Mudar eventos de telemetria | `web_interface/src/services/analytics.js` + `constants/index.js` |
| Entender histórico de decisões | `Documentação do Produto/Execução do Relatório 360.md` |
| Entender o blueprint da modularização | `Documentação do Produto/Blueprint de Modularização.md` |
