# Arquitetura Técnica — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

## Stack completa

### Backend
| Componente | Versão / Detalhe |
|-----------|-----------------|
| Python | 3.12 (embeddable no build de produção) |
| FastAPI | servidor web e API REST em localhost:8001 |
| Uvicorn | servidor ASGI |
| yt-dlp | extração de legendas e metadados do YouTube (binário bundled) |
| Pandas | manipulação do banco de dados CSV |
| Google Auth / Google API Python Client | OAuth2 e Drive (escopo drive.file) |
| pdfplumber | extração de texto de PDFs |
| python-docx | extração de texto de DOCX / geração de relatórios |
| openpyxl | geração de planilhas .xlsx |
| reportlab | geração de PDFs |
| python-multipart | upload de arquivos via FastAPI |
| rank_bm25 | indexação e busca lexical BM25Okapi |

**Dependências opcionais (imagens e áudio):**
- `pytesseract` — OCR fallback para imagens (requer Tesseract binário)
- `faster-whisper` — transcrição local de áudio, modelo base ~150 MB, roda em CPU sem GPU

### Agente RAG
- **BM25Okapi** — busca lexical com cache em memória por projeto; enriquecimento com tags YouTube (3×) + keywords TF-IDF (2×) + descrições
- **Query expansion** — LLM gera variações da pergunta para cobrir sinônimos e paráfrases; desabilitado para Ollama (modelos pequenos adicionam 10–15s de latência)
- **Anti-alucinação** — threshold BM25 (score ≥ 0.5) + verificação pós-geração por keyword overlap
- **Multi-canal** — busca simultânea em múltiplos índices com merge
- **Streaming SSE** — fetch + ReadableStream, cursor piscante na UI

**LLM padrão:** Ollama (llama3.2:1b, ~1.3 GB) — zero custo, zero API key, funciona offline

**Provedores externos opcionais (BYOK):**
| Provedor | Modelo padrão |
|---------|--------------|
| Groq | llama-3.1-8b-instant / llama-3.1-70b-versatile |
| OpenAI | gpt-4o-mini |
| Anthropic | claude-sonnet-4-6 |
| Google Generative AI | gemini-1.5-flash |

### Frontend
| Componente | Detalhe |
|-----------|---------|
| React 19 | biblioteca de UI |
| Vite | bundler |
| Tailwind CSS 3 | estilização utilitária |
| Framer Motion | animações |
| Lucide React | ícones |
| react-i18next | internacionalização PT / EN / ES |
| react-markdown + remark-gfm | renderização Markdown nas respostas do chat |

### Distribuição
| Componente | Detalhe |
|-----------|---------|
| Electron 34 | wrapper desktop; gerencia ciclo de vida do backend e Ollama |
| electron-builder | instalador NSIS para Windows (.exe) |
| electron-updater | auto-update via GitHub Releases |
| Python embeddable (Win x64) | runtime Python bundled, sem dependência prévia |
| yt-dlp binário | bundled junto com o Python embeddable |

---

## Arquitetura em camadas

```
api_tusab.py           ← thin entry point; monta app FastAPI + routers + migrações on-startup
  │
  ├── tusab_engine/api/          ← routers FastAPI por domínio
  │     router_status.py           GET /status, /drive-auth, /history, /open-folder
  │     router_extraction.py       POST /set-channel, /start, /pause, /cancel, /queue/*
  │     router_agent.py            /agent/* (chat, config, index, ollama, stream)
  │     router_repositorio.py      /repositorio, /relatorio, /neural/*, /reset-total
  │     router_exports.py          /export/* (zip, markdown, docx, xlsx, pdf)
  │
  ├── tusab_engine/motor/        ← extração e Drive
  │     drive.py                   OAuth2 Google Drive + upload
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

**Regra de dependência (acíclica):** `api → agent | motor → storage` — NUNCA importar de `api` dentro de `agent` ou `motor`.

**Shims de compatibilidade na raiz:** `motor_tusab.py` e `agent_tusab.py` são re-exports puros — Electron e código legado os importam pelo nome antigo, sem breaking change.

---

## Estrutura de dados em disco

```
data/neural/{projeto}/
  youtube/       ← transcrições .txt extraídas do YouTube
  documents/     ← PDFs, DOCX e outros docs do repositório + _manifest.json
  texts/         ← textos colados pelo usuário + _manifest.json
  management/    ← CSVs de gestão, summary.json, README, relatório

data/indexes/    ← índices BM25 serializados por projeto ({prefixo}_index.json)

data/config/     ← agent_config.json, credentials.json, token.json
                    keystore.json (blobs criptografados — chaves de API via DPAPI)
```

**Em produção (Electron packaged):** `%AppData%\Tusab\data\` — definido pela env var `TUSAB_DATA_DIR`.

**Naming de projetos:** `projeto_nome` é definido pelo usuário no modal de extração. Se omitido, deriva do nome do canal YouTube. Nome sanitizado via `re.sub(r'[<>:"/\\|?*\s]', '_', ...)`. Um canal pode ser importado para qualquer projeto — a pasta não fica atrelada ao canal.

**Subpastas em inglês** (`documents/`, `texts/`, `management/`) — padrão americano independente de idioma da UI. i18n da UI não afeta nomes de pasta.

---

## Módulos principais

### `tusab_engine/storage.py`
Fonte de verdade para todos os caminhos de dados do app. Entrypoints: `obter_caminho_dados()`, `DADOS_DIR`, `NEURAL_DIR`, `CONFIG_PATH`, `salvar_csv_atomico(df, path)`, `salvar_json_atomico(obj, path, indent)`. Funções de migração idempotentes chamadas no startup: `migrar_gestao_para_cerebro()`, `migrar_pastas_para_ingles()`.

### `tusab_engine/state.py`
Estado compartilhado entre routers e background threads via singleton `AppState`. Locks:
- `state_lock` (RLock) — protege `stats` e `logs`; RLock porque `print()` dentro de locked region reentra no LogRedirector
- `hist_lock` (Lock) — protege `chat_histories`
- `agent_chat_lock` (Lock) — serializa chamadas ao LLM

Side effect no import: `sys.stdout = LogRedirector()` — redireciona prints de background thread para `state.logs`.

### `tusab_engine/agent/index.py`
Construção e gerenciamento do índice BM25. Cache: `_bm25_cache: dict` + `_bm25_lock (threading.Lock)` — evita dupla reconstrução quando dois chats usam o mesmo canal simultaneamente. Corpus: YouTube + docs + textos + legado (`neural/youtube/`).

### `tusab_engine/agent/chat.py`
Pipeline RAG: `_expandir_query` → `_recuperar_contexto` (BM25) → `_montar_prompt` → LLM → `_verificar_alucinacao`. Histórico server-side em `state.chat_histories` — payload do cliente é ignorado. `_MAX_HIST_MSGS = 12` (6 trocas).

### `tusab_engine/motor/extraction.py`
Engine principal de extração. Controle via `evento_pausa` e `evento_cancelar` (threading.Event). Extração incremental — vídeos já processados são pulados automaticamente.

### `tusab_engine/motor/drive.py`
OAuth2 Google Drive + upload. Cancelamento via `stop_event` — watchdog thread derruba o servidor WSGI local. Escopo mínimo: `drive.file`.

---

## Frontend — estrutura modular

```
web_interface/src/
  constants/index.js        IDs de eventos PostHog, constantes de UI
  services/api.js           todas as chamadas ao backend FastAPI (24 funções)
  services/analytics.js     wrapper PostHog (opt-in; no-op sem consentimento)
  hooks/
    useStatus.js            polling GET /status a cada 2s
    useAgentStatus.js       polling GET /agent/status a cada 3s
    useOnboarding.js        lógica de onboarding contextual
    useAgentConfig.js       config do agente (provider, API key, Ollama poll, canal-meta, keychain)
    useChatEngine.js        pipeline de chat RAG (streaming, export detection, auto-scroll)
  components/
    home/HomeScreen.jsx     tela inicial com cards de navegação
    chat/ChatDrawer.jsx     drawer lateral de chat RAG
    sidebar/SidebarContent.jsx
    agent/
      OllamaSetup.jsx       setup guiado do Ollama
      RepositorioTab.jsx    gestão da base de conhecimento + modal de indexação
      RelatorioTab.jsx      tabela de vídeos + stats + filtros
    extraction/
      ExtractionModal.jsx   seletor de fontes + iniciar extração
      PostExtractionModal.jsx ações pós-extração
    shared/
      ModalWrapper.jsx      backdrop único: focus trap, Escape, aria-dialog
      GuideModal.jsx        guia de uso (6 passos)
      Onboarding.jsx        wizard de primeiro acesso
      ProSnackbar.jsx       notificação informativa de feature Pro
      StatCard.jsx, LogLine.jsx, ProgressToast.jsx
  App.jsx                   orquestrador principal (~1.590 linhas)
  locales/pt.json, en.json, es.json   i18n (216 chaves, 100% consistentes nos três idiomas)
```

**Responsividade:** breakpoints sm (640px) · md (768px) · lg (1024px). Mobile: nav drawer deslizante. Tablet: rail lateral fixa. Desktop: layout split.

**Acessibilidade (WCAG 2.1 AA):** touch targets ≥ 44×44px, aria-label em botões de ícone, role="dialog" aria-modal="true" via ModalWrapper, focus trap + Escape-to-close em modais, aria-live="polite" no status de extração.

---

## Padrões técnicos

### Local-first
Todos os dados ficam na máquina do usuário. Drive é opt-in. Nenhum dado sai da máquina sem consentimento explícito.

### Escrita atômica
Write-to-`.tmp` + `os.replace()` — mesmo volume, substituição atômica pelo SO. Arquivo sempre íntegro mesmo com crash.

### Streaming SSE
Respostas do agente via `ReadableStream` para UX em tempo real. Cursor piscante na UI durante geração.

### Anti-alucinação
Threshold BM25 (score ≥ 0.5) para determinar se há contexto suficiente. Verificação pós-geração por keyword overlap. Sinalização `sem_contexto: True` ao frontend — exibe botão "Indexar base agora" em vez de mensagem hardcoded.

### Prompt injection mitigation
Cada componente do prompt usa delimitadores XML semânticos: `<source id="N">`, `<conversation_history>`, `<question>`. Pergunta limitada a 2.000 caracteres.

### Histórico server-side
`state.chat_histories` controlado exclusivamente pelo backend. Payload do cliente ignorado — impede injeção de contexto falso.

### BYOK
Groq, OpenAI, Anthropic, Gemini como provedores externos opcionais. Chaves armazenadas criptografadas via `safeStorage` do Electron (Windows DPAPI / macOS Keychain). `agent_config.json` grava sentinel `__encrypted__` em vez da chave real.

---

## Segurança — os 12 fixes aplicados

| Fix | Descrição | Severidade original | Status |
|-----|-----------|--------------------|----|
| ① | CORS restrito a localhost (allow_origins=["*"] → localhost:8001 apenas) | Crítico | Corrigido |
| ② | yt-dlp playlist ID validado com regex `^[A-Za-z0-9_\-]{10,50}$` antes de uso | Crítico | Corrigido |
| ③ | Upload limitado a 50 MB (MAX_FILE_SIZE antes de processar) | Alto | Corrigido |
| ④ | Path traversal no delete: `os.path.realpath()` verifica que caminho está dentro do subdir permitido | Alto | Corrigido |
| ⑤ | `dangerouslySetInnerHTML` eliminado do React — tag `<code>` movida para JSX | Médio | Corrigido |
| ⑥ | Chaves de API migradas para keychain do OS via `safeStorage` do Electron | Médio | Corrigido |
| ⑦ | Campos Pydantic com `Field(max_length=...)` em todos os modelos de request | Baixo | Corrigido |
| ⑧ | Path traversal no `serve_static`: `realpath()` verifica que arquivo está dentro de `dist/` | Alto | Corrigido |
| ⑨ | Prompt injection: delimitadores XML no prompt (`<source>`, `<question>`, `<conversation_history>`) | Médio | Corrigido |
| ⑩ | Drive query injection: `_drive_escape()` aplica escaping de aspas em nomes de pasta | Médio | Corrigido |
| ⑪ | URL YouTube: regex whitelist no `/set-channel` (formatos `@handle`, `/channel/`, `/c/`) | Baixo | Corrigido |
| ⑫ | Histórico do chat movido para servidor; payload do cliente ignorado | Baixo | Corrigido |

**Positivos confirmados desde o início:** Electron com `contextIsolation: true` e `nodeIntegration: false`; `subprocess` com lista de argumentos (nunca `shell=True`); arquivos sensíveis no `.gitignore`.

---

## Decisões técnicas não óbvias

| Decisão | Motivo |
|---------|--------|
| `RLock` em `state_lock` (não `Lock`) | `print()` dentro de locked region reentra no `LogRedirector` — `Lock` causaria deadlock |
| `os.replace()` para escrita atômica | Operação atômica no mesmo volume — arquivo sempre íntegro mesmo com crash |
| `tusab_engine/` (não `Tusab/`) | `Tusab.spec` existe na raiz (PyInstaller) — colisão de nome |
| yt-dlp local no IP do usuário | Princípio intocável — cada extração roda no IP residencial do usuário; proteção natural contra bloqueios do YouTube |
| BM25 sem query expansion para Ollama | Query expansion aumentava latência de 3s para 15s com modelos pequenos |
| `sub_langs = 'pt'` fixo | Tentativas duplas (pt+en) causavam rate limit 429 no YouTube |
| Shims na raiz (`motor_tusab.py`, `agent_tusab.py`) | Electron `extraResources.filter` e código legado importam pelo nome antigo — zero breaking change |
| Histórico server-side no chat | Evita payload manipulado pelo cliente injetar contexto falso |
| `NEURAL_DIR` (não `cerebro/`) | Nomenclatura técnica neutra; `CEREBRO_DIR = NEURAL_DIR` mantém aliases para backward-compat |
| Subpastas em inglês (`documents/`, `texts/`, `management/`) | Padrão americano independente de idioma da UI |
| `projeto_nome` desacoplado do canal | Usuário nomeia o repositório; canal pode mudar sem renomear pasta |
| `sem_contexto: True` no retorno do chat | Sinaliza ao frontend que BM25 não retornou chunks — exibe botão "Indexar base agora" |
| Persona injetada em `_montar_prompt` | `instrucao_tom` é a última linha do prompt antes da pergunta — instrução de estilo sem alterar o contexto RAG |
| Parser WhatsApp/Reuniões no upload | Textos `.txt`/`.md` passam por `_detectar_formato_especial` antes de salvar — melhora recall BM25 |
| Importação lazy em `router_exports.py` | python-docx, openpyxl e reportlab não precisam estar instalados para o módulo carregar |
| Manifest `_manifest.json` por subdiretório | Índice local atômico por pasta — cada subdir de docs/texts tem seu próprio manifesto |

---

## Testes

```
tests/
  conftest.py               fixture: TUSAB_DATA_DIR → tempdir antes de qualquer import
  test_api.py               integração (TestClient FastAPI) — rotas /neural/*, /queue/*, /agent/*
  test_confiabilidade.py    atômicos + concorrência + índice corrompido/vazio
```

**27/27 verde** (junho 2026). Para rodar: `.venv\Scripts\python.exe -m pytest tests/ -v`

**Smoke tests (pre-commit hook):** `python smoke_test.py` — 15 checks contra backend real em porta 8001, cobrindo: yt-dlp, endpoints de status/repositório/fila/agente, validação de chave, path traversal bloqueado, serve de index.html.

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
| Mudar tom/persona do agente | `tusab_engine/agent/chat.py` → `PERSONAS` + `_montar_prompt()` |
| Mudar parser de WhatsApp/Reuniões | `tusab_engine/api/router_repositorio.py` → `_detectar_formato_especial()` |
| Adicionar/mudar modal de indexação | `web_interface/src/components/agent/RepositorioTab.jsx` |
| Adicionar rota de export Pro | `tusab_engine/api/router_exports.py` |
| Mudar config do agente / provider / Ollama | `web_interface/src/hooks/useAgentConfig.js` |
| Mudar o pipeline de chat RAG | `web_interface/src/hooks/useChatEngine.js` |
| Mudar como o frontend chama o backend | `web_interface/src/services/api.js` |
