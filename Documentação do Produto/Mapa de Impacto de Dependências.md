# Mapa de Impacto de Dependências — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026 (v1.0.10 — Sprint 3: Timestamp clicável + Date-aware retrieval + Views boost | Decisão S4: BM25S descartado)

Este documento é a referência de compliance para mudanças de código.
**Antes de alterar qualquer módulo listado, consulte a coluna "Quebra".**

---

## Por que este documento existe

O Tusab tem contratos implícitos que não aparecem em tipos, schemas ou imports — padrões de emoji em logs, estrutura de JSONs em disco, chaves de localStorage. Uma mudança inocente em `extraction.py` pode congelar o progress bar da UI sem nenhum erro visível. Este mapa torna esses contratos explícitos.

---

## 1. Grafo de dependências por camada

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                    │
│                                                             │
│  App.jsx ──────────────────────────────────────────────┐   │
│    ├─ useAgentConfig  (provider, api_key, persona)     │   │
│    ├─ useChatEngine   (chat state, streaming)          │   │
│    ├─ usePerfil       (regras, abas, busca_ampla)      │   │
│    ├─ useStatus       (poll /status a cada 2s)         │   │
│    │                                                   │   │
│    ├─ ExtractionTab ◄─ props: status, history,         │   │
│    │                          canalConfigurado,        │   │
│    │                          repositorio              │   │
│    │                                                   │   │
│    ├─ RepositorioTab ◄─ props: repositorio,            │   │
│    │                           projetoInicial,         │   │
│    │                           agentStatus             │   │
│    │                                                   │   │
│    └─ ChatDrawer ◄─ props: chatMessages,               │   │
│                             agentStatus,               │   │
│                             canalConfigurado           │   │
│                                                        │   │
│  services/api.js ──── todas chamadas HTTP ─────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP localhost:8001
┌─────────────────────────────────────────────────────────────┐
│  BACKEND                                                    │
│                                                             │
│  api_tusab.py                                              │
│    └─ monta routers:                                        │
│         router_status      /status, /history, /drive-*, /agent/mcp/config │
│         router_extraction  /set-channel, /start, /queue/*               │
│         router_agent       /agent/* (config, index, chat, ollama)        │
│         router_repositorio /repositorio, /neural/*                       │
│         router_exports     /export/*  (Pro)                              │
│         router_estudo      /agent/study, /agent/study/{canal}            │
│         router_digest      /agent/digest/{projeto}                       │
│                                                             │
│  Todos os routers compartilham estado via:                  │
│                                                             │
│  tusab_engine/state.py → AppState (singleton) ◄────────┐  │
│    ├─ state.stats {}      ← escrito por LogRedirector   │  │
│    ├─ state.logs []       ← escrito por LogRedirector   │  │
│    ├─ state.chat_histories{}                            │  │
│    ├─ state.agent_indexing                              │  │
│    ├─ state.extraction_queue []                         │  │
│    └─ state.pro_hint                                    │  │
│                                                         │  │
│  LogRedirector ─── parseia prints do motor ─────────────┘  │
│    (✅ → videos_processed, 📂 → files_generated, ...)       │
│                                                             │
│  tusab_engine/                                             │
│    storage.py   ← fonte de todos os paths em disco         │
│    agent/                                                  │
│      config.py  ← lê/grava agent_config.json              │
│      index.py   ← BM25, _bm25_cache, _index.json          │
│      chat.py    ← RAG: recupera contexto + LLM             │
│    motor/                                                  │
│      extraction.py ← yt-dlp, legendas, CSV               │
│      drive.py      ← OAuth Google Drive                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Hubs — alto risco de impacto

| Hub | Arquivo | Dependentes diretos | Risco |
|-----|---------|---------------------|-------|
| **AppState** | `tusab_engine/state.py:28` | Todos os 5 routers + LogRedirector | CRÍTICO |
| **LogRedirector** | `tusab_engine/state.py:93` | Motor de extração (prints) → UI (logs + progresso) | CRÍTICO |
| **storage.py paths** | `tusab_engine/storage.py:43-61` | agent/index, agent/chat, motor/extraction, todos routers | CRÍTICO |
| **agent_config.json schema** | `data/config/agent_config.json` | router_agent, useAgentConfig.js, chat.py | CRÍTICO |
| **_index_{canal}.json schema** | `data/indexes/` | agent/chat.py (_recuperar_contexto) | CRÍTICO |
| **agent/chat.py** | `tusab_engine/agent/chat.py` | Todos os endpoints /agent/chat* | CRÍTICO |
| **router_agent.py** | `tusab_engine/api/router_agent.py` | /agent/status, /agent/index, /agent/chat* | ALTO |
| **App.jsx** | `web_interface/src/App.jsx` | Todos os componentes filhos | CRÍTICO |
| **useAgentConfig** | `web_interface/src/hooks/useAgentConfig.js` | App.jsx, AgentTab, ChatDrawer | ALTO |
| **useChatEngine** | `web_interface/src/hooks/useChatEngine.js` | App.jsx, ChatDrawer | ALTO |
| **services/api.js** | `web_interface/src/services/api.js` | Todos os componentes e hooks | ALTO |

---

## 3. Contratos implícitos críticos

Estes são os contratos mais perigosos porque não aparecem como erros de compilação — quebram silenciosamente em runtime.

### 3.1 Contratos de logging (motor → UI)

**Arquivo:** `tusab_engine/state.py:119-158` (LogRedirector)
**Contrato:** O motor de extração comunica progresso via `print()`. O LogRedirector parseia padrões específicos para atualizar `state.stats`.

| Print no motor | Efeito em state.stats | Quebra se... |
|---|---|---|
| `"✅ ..."` ou `"OK!"` | `videos_processed += 1`, `progress` recalculado, ETA atualizado | Emoji muda para `✔️` ou `☑` — contagem congela |
| `"📂 ..."` ou `"NOVO ARQUIVO"` | `files_generated += 1` | Emoji ou texto muda — contador de arquivos para |
| `"Sem legenda"` | `videos_sem_legenda += 1` | Substring muda — stat fica zerado |
| `"Legenda muito curta"` | `videos_legenda_curta += 1` | Substring muda — stat fica zerado |
| `"Idiomas configurados: PT"` | `idioma_detectado = "PT"` | Formato da string muda — idioma some da UI |
| `"N vídeos mapeados (M no total)"` | `videos_mapeados`, `status = "Mapeando YouTube"` | Formato regex não matcheia — status fica desatualizado |
| `"N vídeos mapeados no canal"` | `videos_total`, `status = "Extraindo legendas"` | Formato muda — barra de progresso fica em 0% |

**Regra:** Nunca alterar strings de `print()` em `motor/extraction.py` sem atualizar os padrões em `state.py:LogRedirector.write()`.

---

### 3.2 Contratos de estrutura em disco

#### `agent_config.json`
**Lido por:** `agent/config.py:carregar_config()` → `chat.py`, `router_agent.py`, `useAgentConfig.js` (via GET /agent/config)

```json
{
  "provider": "ollama | gemini | openai | anthropic | groq",
  "api_key": "string | '__encrypted__' | ''",
  "ollama_model": "string",
  "persona": "'' | 'objetivo' | 'tecnico' | 'didatico' | 'descontraido' | 'socratico'",
  "idioma": "pt | en | es",
  "query_expansion": false,
  "canal_indexado": "string"
}
```

**Quebra se:** Campo `provider` ausente → `chat.py` não sabe qual LLM usar, retorna erro sem contexto.

#### `_index_{canal}.json`
**Lido por:** `agent/chat.py:_recuperar_contexto()`
**Escrito por:** `agent/index.py:indexar()`

```json
{
  "canal_nome": "string",
  "indexed_at": 1234567890,
  "chunks": [
    {
      "texto": "string",
      "titulo": "string",
      "aba": "youtube | documents | texts",
      "data": "string",
      "link": "string",
      "tags": [],
      "arquivo": "string",
      "canal": "string",
      "descricao": "string"
    }
  ]
}
```

**Quebra se:** `chunks` não é lista → `_enriquecer_documento()` itera e quebra com `TypeError`. O índice corrompido é deletado automaticamente (router_agent.py).

#### Estrutura de diretórios em disco
**Fonte única:** `tusab_engine/storage.py`

```
data/
  neural/{projeto}/
    youtube/{canal}/*.txt    ← transcrições
    documents/               ← PDFs, DOCX e outros
    texts/                   ← textos colados
    management/              ← CSVs, summary.json, README
  indexes/{canal}_index.json ← índices BM25
  config/
    agent_config.json
    credentials.json         ← OAuth Google Drive
    token.json               ← OAuth token
```

**Quebra se:** Qualquer constante em `storage.py` (NEURAL_DIR, INDEX_DIR) muda sem migração — todos os módulos que derivam paths dela deixam de encontrar arquivos.

---

### 3.3 Contratos de state.stats (backend → frontend)

**Escrito por:** `LogRedirector` + routers
**Lido por:** `GET /status` → `useStatus.js` → `ExtractionTab.jsx`, `StatCard`

```json
{
  "videos_processed": 0,
  "videos_total": 0,
  "videos_mapeados": 0,
  "videos_sem_legenda": 0,
  "videos_legenda_curta": 0,
  "files_generated": 0,
  "status": "Ocioso | Mapeando YouTube | Extraindo legendas | ...",
  "progress": 0,
  "canal_nome": "string",
  "idioma_detectado": "string",
  "eta_segundos": 0
}
```

**Quebra se:** Qualquer chave for renomeada ou removida — o frontend acessa `status.stats.videos_processed` diretamente sem optional chaining; `undefined` propaga para cálculos e strings de progresso.

---

### 3.4 Contratos de agentStatus (backend → frontend)

**Escrito por:** `router_agent.py:GET /agent/status` → `get_agent_status()`
**Lido por:** `useAgentConfig.js:setAgentStatus()` → `RepositorioTab`, `ChatDrawer`, `App.jsx`

```json
{
  "configured": true,
  "provider": "string",
  "canal_indexado": "string",
  "index_count": 0,
  "indexed": false,
  "indexing": false,
  "index_logs": [],
  "canais_indexados": [],
  "pro_hint": false
}
```

**Quebra se:** `indexing` ausente → modal de indexação não mostra progresso. `canais_indexados` ausente → RepositorioTab não sabe quais bases têm índice.

---

### 3.5 Contratos de repositorio (backend → frontend)

**Escrito por:** `router_repositorio.py:GET /repositorio`
**Lido por:** `App.jsx:setRepositorio()` → `RepositorioTab`, `ExtractionTab`, folder picker

```json
{
  "canais": [
    {
      "nome": "string",
      "youtube": [{"nome": "string", "tamanho": 0, "data": "string"}],
      "documentos": [{"id": "string", "titulo": "string", "chars": 0, "data": "string", "tipo": "string"}],
      "textos": [{"id": "string", "titulo": "string", "chars": 0, "data": "string"}]
    }
  ],
  "youtube": [],
  "documentos": [],
  "textos": []
}
```

**Quebra se:** `canais` ausente → RepositorioTab renderiza vazio. `canais[n].nome` ausente → select de projeto no upload modal quebra.

---

### 3.6 Contratos de localStorage/sessionStorage

| Chave | Tipo | Usado por | Quebra se... |
|-------|------|-----------|--------------|
| `tusab_onboarded` | `"true"` | `useOnboarding.js` | Renomeada → onboarding re-abre para todos os usuários existentes |
| `tusab_theme` | `"dark" \| "light"` | `App.jsx` | Renomeada → tema sempre reseta para padrão |
| `tusab_drive_warning_shown` | `"1"` | `useDriveWarning.js` | Renomeada → warning aparece toda sessão |
| `tusab_pro_hint_shown` | `"1"` | `App.jsx` | Renomeada → ProHintModal aparece em toda nova sessão mesmo após fechar |
| `tusab_perfil` | slug de perfil | `usePerfil.js` | Renomeada → usuário perde perfil salvo |
| `tusab_canal_*` | histórico de chat | `useChatEngine.js` | Padrão muda → histórico de chat some |

**Regra:** Nunca renomear uma chave sem escrever uma migração de localStorage (`localStorage.setItem(novaChave, localStorage.getItem(velhaChave))`).

---

### 3.7 Contratos de slugs de perfil

**Definido em:** `usePerfil.js:PERFIS_META`
**Persiste em:** `localStorage['tusab_perfil']`

| Slug interno | Label na UI | Cuidado |
|---|---|---|
| `estudante` | Estudante | — |
| `profissional` | **Especialista** | ⚠️ Label mudou em jun/2026; slug não pode mudar sem migração |
| `pesquisador` | Pesquisador | — |

**Regra:** Slug ≠ label. Mudar o label é seguro. Mudar o slug apaga o perfil salvo de todos os usuários com aquele perfil.

---

## 4. Tabela de impacto: mudança em A → quebra B

| Mudança em A | Afeta B | Severidade | Mecanismo de quebra |
|---|---|---|---|
| Print `✅` muda para outro emoji em `extraction.py` | `state.stats.videos_processed`, progress bar, ETA | **CRÍTICO** | LogRedirector não matcheia → contagem congela silenciosamente |
| Renomear chave em `state.stats` | `ExtractionTab`, `StatCard`, polling `/status` | **CRÍTICO** | Frontend acessa direto sem optional chaining → `undefined` |
| Mudar estrutura de `agent_config.json` | `chat.py`, `router_agent.py`, `useAgentConfig.js` | **CRÍTICO** | `carregar_config()` retorna dict sem campo → KeyError ou fallback errado |
| Mudar estrutura de `_index_{canal}.json` | `chat.py:_recuperar_contexto()` | **CRÍTICO** | `chunks` não iterável → TypeError, chat retorna erro sem contexto |
| Renomear constante em `storage.py` | Todos os módulos que derivam paths | **CRÍTICO** | FileNotFoundError em runtime — arquivos não encontrados |
| Mudar `NEURAL_DIR` layout em disco | `router_repositorio`, `agent/index`, `motor/extraction` | **CRÍTICO** | Arquivos existentes sumem da UI; indexação falha |
| Mudar `_bm25_cache` structure | `chat.py` | **ALTO** | Cache miss → rebuilt automático (lento), não quebra funcionalmente |
| Mudar enum `PERSONAS` em `chat.py` | `router_agent.py:_PERSONAS_VALIDAS`, UI de tom | **MÉDIO** | Persona salva não existe → validação rejeita config, usuário perde tom |
| Mudar `_MAX_HIST_MSGS` em `router_agent.py` | Quantidade de contexto no chat | **BAIXO** | Funcional, mas altera tamanho do contexto enviado ao LLM |
| Renomear chave de localStorage | Hook correspondente | **MÉDIO** | Configuração do usuário reseta para default na próxima sessão |
| Mudar slug de perfil em `PERFIS_META` | localStorage + regras de exibição de abas | **CRÍTICO** | Usuários com perfil salvo ficam sem perfil → redirecionados para onboarding |
| Mudar `repositorio.canais[n]` shape | `RepositorioTab`, folder picker, `ExtractionTab` | **ALTO** | Projetos somem da UI; upload modal não lista projetos |
| Upload de arquivo/texto sem projeto criado previamente | `router_repositorio.py:/neural/upload`, `/neural/texto` | **CRÍTICO** | Backend cria pasta on-the-fly mas sem registro no repositório → arquivo some na listagem. **Regra:** projeto deve existir antes do upload — UI deve bloquear upload até `criarProjeto()` retornar `ok: true`. |
| Botão de upload no card do projeto abre modal já com projeto fixo | `RepositorioTab` — ícone 📎 no card do canal | **ALTO** | Se o projeto-alvo não existir mais no backend entre o click e o upload, o arquivo fica órfão. Recarregar `repositorio` ao abrir o modal de upload mitiga. |
| Mudar `agentStatus.indexing` | `useAgentConfig.refetchAgentStatus`, `indexingDoneCount`, snackbar do ChatDrawer | **ALTO** | Transição true→false não detectada → contador não incrementa → snackbar nunca aparece |
| Remover prop `indexingDoneCount` do ChatDrawer | Snackbar de sucesso pós-indexação | **MÉDIO** | Snackbar some silenciosamente; indexação funciona normalmente |
| Mudar formato do stream `/agent/chat/stream` | `useChatEngine.js:parseMessageStream()` | **CRÍTICO** | Chat fica "enviando..." eternamente ou resposta não renderiza |
| Mudar `state.extraction_queue` sem `queue_lock` | Motor de extração (thread) | **MÉDIO** | Race condition em CPython (GIL mitiga, mas não garante) |
| Modelo LLM hardcoded deprecado | `chat.py` (OpenAI: gpt-4o-mini, Anthropic: claude-sonnet-4-6) | **MÉDIO** | API retorna 404/400 → chat com erro genérico |
| Remover `onTriggerInstallUpdate` do preload | `App.jsx` listener de update por clique na notificação | **BAIXO** | Clique na notificação nativa não instala; banner do Admin continua funcionando |
| `chatOpenRef` dessincronizado de `chatOpen` | `useChatEngine.js` — notificação de chat concluído | **BAIXO** | Notificação dispara mesmo com chat visível, ou nunca dispara |

---

## 5. Diagrama de fluxo dos contratos críticos

### 5.1 Motor → UI (progresso de extração)

```
motor/extraction.py
  print("✅ vídeo extraído")
       │
       ▼
  LogRedirector.write()          ← CONTRATO: emoji ✅ obrigatório
       │ parseia padrão
       ▼
  state.stats["videos_processed"] += 1
  state.stats["progress"] = int(processed/total*100)
  state.stats["eta_segundos"] = int(remaining/rate)
       │
       ▼  (2s poll)
  GET /status → router_status
       │  serializa state.stats
       ▼
  useStatus.js setStatus()       ← CONTRATO: shape state.stats
       │
       ▼
  ExtractionTab → StatCard       ← CONTRATO: status.stats.videos_processed
  ProgressBar → status.stats.progress
```

### 5.2 Chat RAG completo

```
ChatDrawer (user envia mensagem)
       │
       ▼
  useChatEngine.handleChatSend()
       │ POST /agent/chat/stream
       ▼
  router_agent → chat.chat_stream()
       │
       ├─ _recuperar_contexto()           ← LÊ: _index_{canal}.json
       │    BM25 + CrossEncoder
       │
       ├─ _montar_prompt()                ← LÊ: agent_config.json (persona, idioma)
       │
       ├─ LLM call (provider do config)   ← CONTRATO: provider em PROVEDORES_VALIDOS
       │
       └─ yield chunks → stream
              │
              ▼
       useChatEngine.parseMessageStream() ← CONTRATO: formato do stream
              │
              ▼
       setChatMessages()
       ChatDrawer renderiza
```

### 5.3 Indexação → agentStatus → UI

```
RepositorioTab "Indexar base"
       │ POST /agent/index
       ▼
  router_agent._run_indexacao()
       │ state.agent_indexing = True
       ▼
  agent/index.indexar()
       │ _parsear_todos_chunks()          ← LÊ: NEURAL_DIR/{canal}/
       │ salvar_json_atomico()            ← ESCREVE: INDEX_DIR/{canal}_index.json
       ▼
  state.agent_indexing = False
  state.pro_hint = True (se >= 3 canais)
       │
       ▼  (3s poll)
  GET /agent/status → get_agent_status()  ← CONTRATO: shape agentStatus
       │
       ▼
  useAgentConfig.refetchAgentStatus()
       │ detecta transição indexing: true→false
       │ setIndexingDoneCount(c => c + 1)   ← CONTRATO: contador incremental
       │ setAgentStatus(next)
       │
       ├─ RepositorioTab atualiza lista de bases
       └─ ChatDrawer recebe indexingDoneCount via prop
              │ useEffect([indexingDoneCount]) → exibe snackbar 7s
              └─ CONTRATO: prop indexingDoneCount obrigatória no App.jsx
```

**Nota importante (jun/2026):** A detecção de fim de indexação foi centralizada em
`useAgentConfig.refetchAgentStatus()`, não mais no ChatDrawer. Isso elimina a race
condition onde indexações curtas (< 3s) terminavam entre dois ciclos de polling e o
ChatDrawer nunca via a transição — o snackbar não aparecia na primeira indexação.

---

## 6. Checklist de compliance para mudanças

Use este checklist antes de qualquer PR que toque um módulo crítico:

### Mudando `motor/extraction.py`
- [ ] Algum `print()` com emoji foi alterado?  
  → Verificar `state.py:LogRedirector.write()` — atualizar padrão se necessário
- [ ] A estrutura dos arquivos `.txt` gerados mudou?  
  → Verificar `agent/index.py:_parsear_todos_chunks()` — parsear nova estrutura

### Mudando `tusab_engine/state.py`
- [ ] Alguma chave de `state.stats` foi renomeada ou removida?  
  → Atualizar `useStatus.js`, `ExtractionTab`, `StatCard`, reset em `App.jsx`
- [ ] `state.chat_histories` estrutura mudou?  
  → Atualizar `router_agent.py:_run_chat()`, `useChatEngine.js`

### Mudando `tusab_engine/storage.py`
- [ ] Alguma constante de path mudou?  
  → Executar migração antes de alterar: todos os arquivos existentes precisam ser movidos
- [ ] Nova constante de path adicionada?  
  → Adicionar a `obter_caminho_dados()` para respeitar `TUSAB_DATA_DIR`

### Mudando `agent/index.py` (estrutura de chunks)
- [ ] Alguma chave dos chunks mudou (ex: `texto` → `content`)?  
  → Atualizar `chat.py:_recuperar_contexto()` e `_enriquecer_documento()`
- [ ] Todos os índices existentes precisam ser re-gerados (breaking change de schema)

### Mudando `agent/chat.py`
- [ ] Formato do stream mudou (yield structure)?  
  → Atualizar `useChatEngine.js:parseMessageStream()`
- [ ] Campo `sem_contexto` foi removido do retorno?  
  → ChatDrawer usa este campo para exibir botão "Indexar base agora"
- [ ] Enum `PERSONAS` mudou?  
  → Atualizar `_PERSONAS_VALIDAS` em `router_agent.py`

### Mudando `router_agent.py`
- [ ] Shape de `/agent/status` mudou?  
  → Atualizar `useAgentConfig.js:DEFAULT_AGENT_STATUS`
- [ ] Algum campo do response foi renomeado?  
  → Buscar no frontend: `agentStatus.{campo}` em todos os componentes

### Mudando frontend (localStorage)
- [ ] Alguma chave de localStorage foi renomeada?  
  → Escrever migração: `localStorage.setItem(nova, localStorage.getItem(velha))`
- [ ] Slug de perfil em `PERFIS_META` mudou?  
  → Nunca mudar slug — apenas o label. Se necessário, escrever migração explícita.

### Mudando `services/api.js`
- [ ] Assinatura de alguma função mudou (parâmetros, URL, method)?  
  → Buscar todos os consumers: hooks e componentes que importam a função

---

## 7. Onde encontrar cada contrato no código

| Contrato | Localização exata |
|---|---|
| Padrões de emoji para progresso | `tusab_engine/state.py:119-159` |
| Shape de `state.stats` | `tusab_engine/state.py:41-53` |
| Schema de `agent_config.json` | `tusab_engine/agent/config.py:carregar_config()` |
| Schema de `_index.json` | `tusab_engine/agent/index.py:357-361` |
| Enum de personas válidas | `tusab_engine/agent/chat.py:PERSONAS` + `router_agent.py:_PERSONAS_VALIDAS` |
| Formato do stream de chat | `tusab_engine/api/router_agent.py:_gen()` |
| Shape de agentStatus | `web_interface/src/hooks/useAgentConfig.js:34-43` |
| Detecção de fim de indexação (`indexingDoneCount`) | `web_interface/src/hooks/useAgentConfig.js:refetchAgentStatus()` → prop `indexingDoneCount` no ChatDrawer |
| Shape de repositorio | `web_interface/src/App.jsx:121` (estado inicial inclui `canais: []`) |
| Fetch de repositorio ao abrir aba | `web_interface/src/App.jsx` — `useEffect([activeTab])` dispara `fetchRepositorio` ao entrar em `'repositorio'` |
| Atualização de `canalConfigurado` ao trocar da fila | `web_interface/src/App.jsx` — polling `/status` atualiza `canalConfigurado` sempre que `canal_nome` muda enquanto `is_running` |
| Chaves de localStorage | `web_interface/src/hooks/usePerfil.js`, `useOnboarding.js`, `App.jsx` |
| Slugs de perfil | `web_interface/src/hooks/usePerfil.js:PERFIS_META` |
| Formato do stream no frontend | `web_interface/src/hooks/useChatEngine.js:parseMessageStream()` |
| Constantes de path em disco | `tusab_engine/storage.py:43-61` |
| Contratos de CSV de gestão | `tusab_engine/api/router_status.py:_count_files_on_disk()` |

---

## 8. Riscos silenciosos conhecidos

Estes cenários não produzem erro de compilação nem log de erro — falham silenciosamente:

1. **Emoji mudado no motor**: progresso congela em 0%, nenhum erro
2. **Índice JSON corrompido**: chat responde sem contexto (fallback genérico), sem erro visível
3. **Campo faltando em `state.stats`**: UI mostra `undefined` ou `NaN` em lugar do número
4. **Chave localStorage renomeada**: configuração reseta para padrão, sem aviso ao usuário
5. **Slug de perfil renomeado**: usuário vê onboarding novamente, perde perfil salvo
6. **Modelo LLM deprecado**: chat retorna erro genérico de API, sem diagnóstico claro
7. **Schema de chunk mudado sem re-indexar**: BM25 usa estrutura antiga do cache, chat degrada gradualmente
8. **Pro hint `state.pro_hint` não resetado**: modal ProHint aparece em toda resposta de `/agent/status`
9. ~~**`repositorio` sem `canais: []` no estado inicial**~~: RepositorioTab renderizava vazio até o primeiro fetch completar. **Corrigido** em `App.jsx:121` — estado inicial agora inclui `canais: []`; fetch também disparado ao entrar na aba.
10. ~~**`canalConfigurado` não atualizado ao trocar canal da fila**~~: card "Configurado" mostrava o canal anterior mesmo após troca. **Corrigido** em `App.jsx` — polling atualiza `canalConfigurado` sempre que `stats.canal_nome !== canalConfigurado` enquanto `is_running`.

---

## 9. Contratos adicionados no Sprint 1 (jun/2026)

### 9.1 Campo `trecho` nas fontes do chat (S1.1 — Citações clicáveis)

**Adicionado em:** `tusab_engine/agent/chat.py` — funções `chat()` e `chat_stream()`
**Consumido por:** `ChatDrawer.jsx` — botão "Trecho" + painel inline expandível

```json
{
  "titulo":  "string",
  "aba":     "youtube | documents | texts",
  "data":    "string",
  "link":    "string",
  "arquivo": "string",
  "canal":   "string",
  "score":   0.0,
  "trecho":  "string (primeiros 600 chars do chunk)"
}
```

**Contrato:** `trecho` é opcional — se ausente (modo trecho injetado), o botão "Trecho" não aparece. Limite de 600 chars é proposital para exibição compacta; `…` é adicionado pelo frontend se `trecho.length >= 600`.

**Quebra se:**
- Campo `trecho` renomeado → botão "Trecho" some silenciosamente (condição `!!f.trecho`)
- Limite 600 chars aumentado sem teste em mobile → painel overflow

**Estado local no ChatDrawer:** `fontePreview` — `{ titulo, trecho, link, data, arquivo }` ou `null`. Reset ao fechar (clicar no botão "Fechar" ou na mesma fonte).

---

### 9.2 Endpoint `GET /agent/base-summary` (S1.3 — Painel de visibilidade da base)

**Adicionado em:** `tusab_engine/api/router_agent.py`
**Consumido por:** `BasePainel.jsx` via `fetchBaseSummary()` em `services/api.js`

```json
{
  "projetos": [
    {
      "prefixo":       "string",
      "nome":          "string",
      "n_youtube":     0,
      "n_documents":   0,
      "n_texts":       0,
      "total":         0,
      "indexado":      false,
      "indexed_at":    1234567890,
      "ultima_adicao": 1234567890,
      "n_chunks":      0
    }
  ]
}
```

**Contrato:** projetos com `total === 0` são filtrados no backend (nunca chegam ao frontend). `indexed_at` e `ultima_adicao` são timestamps Unix em segundos; `null` quando não disponíveis.

**Quebra se:**
- `projetos` ausente → `BasePainel` renderiza "Nenhuma base encontrada" (degradação graciosa)
- Chave `indexado` renomeada → `StatusChip` sempre mostra "Não indexado"
- Chave `n_chunks` removida → chip de chunks não aparece (condição `p.n_chunks > 0`)

**Componente:** `BasePainel.jsx` em `web_interface/src/components/agent/`
**Integração:** `AgentTab.jsx` recebe prop `onIndexar` → passa para `BasePainel` → chama `handleIndexarDoChat()` do `App.jsx`

**Checklist para mudanças em `GET /agent/base-summary`:**
- [ ] Chave renomeada? → Atualizar `BasePainel.jsx` e este mapa
- [ ] Formato de timestamp mudou? → `formatDate()` em `BasePainel.jsx` usa `ts * 1000` (Unix → JS Date)

---

## 10. Contratos adicionados no Sprint 2 (jun/2026)

### 10.1 MCP Server stdio (S2.1)

**Arquivo:** `tusab_engine/mcp_server.py` (standalone, sem importar `tusab_engine.state`)
**Protocolo:** JSON-RPC 2.0 sobre stdio — uma mensagem por linha
**Configuração:** `GET /agent/mcp/config` (em `router_status.py`) retorna o JSON para `~/.claude.json` / `.cursor/mcp.json`

**Tools expostas:**

| Tool | Input | Output |
|------|-------|--------|
| `search_knowledge` | `{ query, canal, top_k }` | `{ chunks: [{ titulo, texto, score, aba, link }] }` |
| `list_projects` | `{}` | `{ projects: [{ prefixo, indexed_at, n_chunks }] }` |

**Contrato de stderr:** Todo stderr é redirecionado para `data/mcp_server.log` via `_StderrToLog`. Jamais escrever para stderr diretamente — Claude Code / Cursor interpretam qualquer output fora de stdout como erro de protocolo.

**Quebra se:**
- `tusab_engine.state` for importado → `LogRedirector` redireciona `sys.stdout`, corrompendo o protocolo stdio
- Algum `print()` for adicionado ao mcp_server fora do loop de resposta → Claude Code recebe JSON malformado

**Checklist para mudanças em `mcp_server.py`:**
- [ ] Novo `print()` adicionado? → Garantir que é apenas dentro de `_respond()` e apenas para stdout
- [ ] Nova tool adicionada? → Registrar em `tools/list` E implementar em `tools/call`
- [ ] Import de `tusab_engine.state` tentado? → **Proibido** — causa corrupção de stdio

---

### 10.2 Modo Estudo — flashcards e resumo (S2.2)

**Módulo backend:** `tusab_engine/api/router_estudo.py`
**Endpoints:** `POST /agent/study`, `GET /agent/study/{canal_nome}`
**Componente frontend:** `EstudoTab.jsx` em `web_interface/src/components/agent/`
**API calls:** `gerarEstudo()`, `fetchEstudo()`, `exportFlashcardsAnki()` em `services/api.js`
**Export CSV:** `GET /export/flashcards/{canal_nome}` em `router_exports.py`

**Schema em disco:** `data/neural/{prefixo}/management/flashcards.json`

```json
{
  "canal": "string",
  "gerado_em": "YYYY-MM-DDTHH:MM:SS",
  "flashcards": [
    { "pergunta": "string", "resposta": "string" }
  ]
}
```

**Resumo:** `data/neural/{prefixo}/management/resumo_estudo.md` (Markdown plano)

**Contrato de requisição:**
```json
{
  "canal_nome": "string (max 120 chars)",
  "tipo": "flashcards | resumo | ambos",
  "n_cards": 10
}
```

**Contrato de resposta:**
```json
{
  "ok": true,
  "flashcards": [{ "pergunta": "string", "resposta": "string" }],
  "resumo": "string | ''",
  "total": 0
}
```

**Pré-condição:** índice BM25 deve existir (`data/indexes/{prefixo}_index.json`). Se ausente, retorna `{ "error": true, "message": "Indexe a base primeiro." }`.

**Quebra se:**
- Chave `pergunta`/`resposta` renomeada → flip animation do `EstudoTab` mostra campo vazio
- `resumo_estudo.md` deletado manualmente → `GET /agent/study` retorna `resumo: null`; frontend exibe botão "Gerar" novamente
- `_index_path()` muda → `POST /agent/study` não encontra índice mesmo após indexação

**Checklist para mudanças em `router_estudo.py`:**
- [ ] Schema de `flashcards.json` mudou? → Atualizar `EstudoTab.jsx` e o handler do Anki export
- [ ] Formato do CSV Anki mudou? → CSV usa `frente;verso` (ponto-e-vírgula) com header `frente;verso\n` — Anki exige este separador

---

### 10.3 Digest Semanal (S2.3)

**Módulo backend:** `tusab_engine/api/router_digest.py`
**Módulo de lógica:** `tusab_engine/scheduler.py`
**Endpoints:** `GET /agent/digest/{projeto}`, `POST /agent/digest/{projeto}`

**Schema de digest em disco:** `data/neural/{prefixo}/management/digest_{YYYY-MM-DD}.md`

**Contrato de listagem (`GET /agent/digest/{projeto}`):**
```json
{
  "digests": [
    {
      "data": "YYYY-MM-DD",
      "preview": "string (primeiros 200 chars)",
      "filename": "digest_YYYY-MM-DD.md"
    }
  ]
}
```

**Contrato de geração (`POST /agent/digest/{projeto}`):**
```json
{ "ok": true, "message": "Digest gerado para @projeto (N arquivo(s) novo(s))." }
```
ou
```json
{ "ok": false, "message": "Nenhum arquivo novo esta semana." }
```

**Lógica de `_arquivos_novos`:** escaneia `youtube/`, `documents/`, `texts/` buscando arquivos com `mtime > agora - 7 dias`. Digest não é gerado se lista vazia.

**Scheduler:** `agendar_digest()` usa APScheduler (`CronTrigger`, segunda-feira 8h). Protegido por `try/except ImportError` — funciona sem APScheduler instalado (trigger manual via POST).

**Quebra se:**
- `tusab_engine.scheduler` importar `tusab_engine.state` → circular import via `AppState` singleton
- Formato de nome de arquivo `digest_{YYYY-MM-DD}.md` mudar → `listar_digests()` não encontra arquivos existentes (glob `digest_*.md`)
- APScheduler não instalado → `agendar_digest()` retorna silenciosamente; POST manual continua funcionando

**Checklist para mudanças em `scheduler.py`:**
- [ ] Padrão de glob `digest_*.md` mudou? → Atualizar `listar_digests()` e este contrato
- [ ] Lógica de "arquivo novo" mudou (janela de 7 dias)? → `GET /agent/digest` pode retornar listas diferentes do esperado

---

### 10.4 Registros de modularidade — Sprint 2

| Módulo | Arquivo | Rotas | Extrai de |
|--------|---------|-------|-----------|
| `router_estudo` | `tusab_engine/api/router_estudo.py` | `POST /agent/study`, `GET /agent/study/{canal}` | Extraído de `router_agent.py` (era monolítico) |
| `router_digest` | `tusab_engine/api/router_digest.py` | `GET /agent/digest/{p}`, `POST /agent/digest/{p}` | Extraído de `router_agent.py` (era monolítico) |
| `mcp_server` | `tusab_engine/mcp_server.py` | stdio JSON-RPC 2.0 | Novo arquivo standalone |
| `scheduler` | `tusab_engine/scheduler.py` | — (lógica pura) | Novo arquivo standalone |

**Registrados em `api_tusab.py`:**
```python
from tusab_engine.api.router_estudo import router as router_estudo
from tusab_engine.api.router_digest import router as router_digest
app.include_router(router_estudo)
app.include_router(router_digest)
```

**Regra de modularidade (fixada após Sprint 2):** Qualquer novo domínio de funcionalidade deve ter seu próprio arquivo `router_{dominio}.py`. `router_agent.py` fica restrito a: configuração, indexação, chat, status do agente e Ollama.

---

## 11. Contratos adicionados no Sprint 3 (jun/2026)

### 11.1 Novos campos nos arquivos .txt extraídos

**Escrito por:** `tusab_engine/motor/extraction.py` — função `tusab_engine()`, bloco de escrita do `.txt`
**Lido por:** `tusab_engine/agent/index.py` — `_parsear_chunks()`

Campos adicionados ao cabeçalho de cada vídeo no `.txt`:
```
VIDEO_ID: {v_id}
VIEWS: {views}
TIMESTAMP_INICIO: {segundos}
```

- `VIDEO_ID`: ID do vídeo YouTube (ex: `dQw4w9WgXcQ`)
- `VIEWS`: inteiro, views no momento da extração (vem do mesmo `%(view_count)s` do mapeamento — sem request extra)
- `TIMESTAMP_INICIO`: inteiro em segundos do primeiro cue VTT detectado por `_limpar_vtt_interno()`

**Compatibilidade retroativa:** arquivos extraídos antes do Sprint 3 não têm esses campos. `_parsear_chunks()` usa `.group(1)` com fallback — retorna `''` / `0` se ausente. Chat e frontend tratam `timestamp_inicio == 0` como "sem timestamp".

**Quebra se:**
- Formato `VIDEO_ID:` renomeado → `_parsear_chunks` não extrai o ID → link de timestamp não aparece
- `TIMESTAMP_INICIO:` renomeado → todos os chunks antigos (que eram 0) permanecem sem impacto; novos chunks perdem o timestamp

---

### 11.2 Novos campos nos chunks BM25

**Escrito por:** `_parsear_chunks()` em `tusab_engine/agent/index.py`
**Lido por:** `chat.py` (views boost, fontes) e `ChatDrawer.jsx` (link ▶)

Três campos novos no schema de chunk:
```json
{
  "video_id":         "string (ID YouTube ou '')",
  "views":            0,
  "timestamp_inicio": 0
}
```

**Compatibilidade:** índices gerados antes do Sprint 3 não têm esses campos. `c.get('video_id', '')`, `c.get('views', 0)`, `c.get('timestamp_inicio', 0)` garantem fallback seguro.

**Quebra se:**
- `video_id` removido → `ChatDrawer` nunca renderiza link ▶ (condição `f.video_id && f.timestamp_inicio > 0`)
- `views` removido → boost silenciosamente desativado (boost = 0 quando views=0, sem erro)

---

### 11.3 Novas fontes do chat com timestamp (S3.1)

**Adicionado em:** `chat.py` — funções `chat()` e `chat_stream()`, na construção de `fontes`
**Consumido por:** `ChatDrawer.jsx`

```json
{
  "titulo":            "string",
  "aba":               "youtube | documents | texts",
  "data":              "string",
  "link":              "string",
  "arquivo":           "string",
  "canal":             "string",
  "score":             0.0,
  "trecho":            "string (primeiros 600 chars)",
  "video_id":          "string (ID YouTube ou '')",
  "timestamp_inicio":  0
}
```

**Renderização no ChatDrawer:**
- Quando `f.video_id && f.timestamp_inicio > 0`: renderiza `<a href="https://www.youtube.com/watch?v={video_id}&t={timestamp_inicio}">▶ MM:SS</a>`
- Formato de label: `H:MM:SS` quando hora > 0, `M:SS` caso contrário

**Quebra se:**
- `video_id` ou `timestamp_inicio` ausentes no payload → link não aparece (degradação graciosa — sem erro)
- Formato da URL `?v=ID&t=SEG` mudar → link abre YouTube mas sem saltar ao timestamp

**Checklist para mudanças:**
- [ ] Campo `timestamp_inicio` renomeado? → Atualizar `chat.py` (2 lugares: sync + stream), `ChatDrawer.jsx`, este mapa
- [ ] `limpar_vtt_com_timestamp()` refatorada? → Garantir que `_limpar_vtt_interno()` ainda retorna `(texto, int)` — `limpar_vtt()` original não pode quebrar (mantida como wrapper)

---

### 11.4 Date-aware retrieval (S3.2)

**Implementado em:** `tusab_engine/agent/chat.py` — `_recuperar_contexto()`, após score mínimo e antes do CrossEncoder

**Lógica:**
1. Detecta termos temporais na query: `{'recente', 'último', 'atual', 'agora', 'hoje', 'novo', ...}` ou ano explícito (`\b20\d{2}\b`)
2. Se ano explícito (`"em 2024"`): filtra chunks cujo campo `data` (DD/MM/AAAA) tem ano == ano alvo
3. Se termo recente: filtra chunks do último ano em relação ao máximo encontrado no corpus
4. Filtro só aplicado se há candidatos suficientes (`≥ max(n//2, 2)`); se não, usa todos

**Não requer:** nenhum campo novo — usa o campo `data` já existente nos chunks

**Quebra se:**
- Formato de `data` no chunk mudar de `DD/MM/AAAA` → parser `data_str.split('/')[-1]` falha silenciosamente (ano = 0, filtro não aplica — degradação graciosa)
- Lista `_TERMOS_RECENTE` crescer com termos muito comuns → filtro aplica em queries não temporais

---

### 11.5 Views boost no retrieval (S3.3)

**Implementado em:** `tusab_engine/agent/chat.py` — `_recuperar_contexto()`, após filtro de data e antes do CrossEncoder

**Fórmula:**
```python
boost = 1.0 + 0.2 * (log1p(views) / log1p(views_max))
score_final = score_bm25 * boost
```

- Boost máximo (vídeo mais visto do conjunto): `1.2x`
- Boost mínimo (views = 0): `1.0x` (neutro)
- `views_max` é calculado por consulta — normalização relativa ao conjunto retornado

**Dependência:** chunk precisa ter campo `views` (int). Chunks sem `views` (índices pré-Sprint 3) recebem boost = 1.0 (neutro, sem penalização).

**Quebra se:**
- `views` negativo no chunk → `log1p` retorna NaN → multiplicar por NaN propaga NaN no score → `sort()` tem comportamento indefinido. Mitigação: `if views > 0` já está no código.
- `views_max` = 0 (todos os chunks sem views) → divisão por zero. Mitigação: `or 1` na linha `views_max = max(...) or 1`.

**Checklist:**
- [ ] Novo provider de views? → Garantir que o valor é sempre inteiro ≥ 0 no `.txt` e no chunk
- [ ] Fórmula de boost alterada? → Testar que scores permanecem ≥ SCORE_MINIMO (0.5) para queries relevantes

---

## 12. Decisões de infraestrutura RAG — Sprint 4 (jun/2026)

### 12.1 BM25S — descartado para corpora < 5 k docs

**Análise:** `bm25s 0.3.9` foi instalado e benchmarked contra `rank_bm25` com corpus de 500 docs.

| Métrica | rank_bm25 | bm25s |
|---------|-----------|-------|
| Tempo de indexação (500 docs) | ~1 ms | ~7 ms |
| Tempo de retrieval (k=500) | ~0,6 ms | ~0,5 ms |
| Qualidade do ranking | BM25Okapi | BM25+ (equivalente) |
| Complexidade de migração | — | Alta (API de vocabulário compartilhado) |

**Conclusão:** O ganho de 100–500× citado na literatura aplica-se a corpora de 1 M+ documentos. Para o Tusab (200–500 vídeos típicos), `rank_bm25` já indexa em < 5 ms e o overhead de tokenização do `bm25s` (NumPy + vocabulário) supera qualquer ganho. A migração exigiria refatoração significativa do pipeline de cache (`_bm25_cache`) sem benefício perceptível.

**Decisão:** Manter `rank_bm25` até a adoção do **LanceDB** (Sprint 5+), que resolverá indexação incremental e substituirá tanto `rank_bm25` quanto o ChromaDB planejado de uma vez.

**Arquivo de teste:** salvo em `scratchpad/test_bm25s_v3.py` (sessão de jun/2026).

**Impacto em código:** nenhum — `rank_bm25` permanece em `chat.py` e `index.py`. `bm25s` instalado no `.venv` mas não usado — pode ser removido com `pip uninstall bm25s`.

### 12.2 Roadmap de infraestrutura RAG

| Sprint | Item | Status |
|--------|------|--------|
| S3 | CrossEncoder ms-marco-MiniLM-L-6-v2 | ✅ Implementado |
| S3 | Date-aware retrieval + Views boost | ✅ Implementado |
| S4 | BM25S (drop-in replacement) | ❌ Descartado |
| S5 | LanceDB (indexação incremental + columnar) | 🔜 Planejado |
| S6 | Embeddings Ollama + ChromaDB | 🔜 Planejado (pode ser absorvido pelo LanceDB) |
| S7 | SPLADE (learned sparse retrieval) | 🔜 Planejado (pós-feedback de produção) |
