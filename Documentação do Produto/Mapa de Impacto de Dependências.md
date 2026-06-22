# Mapa de Impacto de Dependências — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

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
│         router_status      /status, /history, /drive-*     │
│         router_extraction  /set-channel, /start, /queue/*  │
│         router_agent       /agent/*                        │
│         router_repositorio /repositorio, /neural/*         │
│         router_exports     /export/*  (Pro)                │
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
| Mudar `agentStatus.indexing` | Modal de indexação, `refetchAgentStatus` | **ALTO** | Modal não detecta fim de indexação → spinner eterno |
| Mudar formato do stream `/agent/chat/stream` | `useChatEngine.js:parseMessageStream()` | **CRÍTICO** | Chat fica "enviando..." eternamente ou resposta não renderiza |
| Mudar `state.extraction_queue` sem `queue_lock` | Motor de extração (thread) | **MÉDIO** | Race condition em CPython (GIL mitiga, mas não garante) |
| Modelo LLM hardcoded deprecado | `chat.py` (OpenAI: gpt-4o-mini, Anthropic: claude-sonnet-4-6) | **MÉDIO** | API retorna 404/400 → chat com erro genérico |

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
  useAgentConfig.setAgentStatus()
       │
       ├─ refetchAgentStatus() (imediato na transição indexing true→false)
       └─ RepositorioTab, ChatDrawer atualizam estado
```

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
| Shape de repositorio | `web_interface/src/App.jsx:123` |
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
