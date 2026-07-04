# Tusab — Contexto de Projeto para Claude Code

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Autor:** Augusto Brasil · https://linkedin.com/in/augustoalvesbrasil

---

## Agentes especializados

Slash commands disponíveis nesta sessão — cada um carrega o contexto do especialista antes de responder:

| Comando | Papel | Use quando... |
|---------|-------|---------------|
| `/qa` | QA Tester | rodar checklist manual completo ou validar um fluxo específico |
| `/testes` | Engenheiro de Testes | gaps na suite pytest, novos test cases, confiabilidade |
| `/seguranca` | Engenheiro de Segurança | path traversal, injeção de comando, secrets, Electron, upload |
| `/integracao` | Engenheiro de Integração | contrato Electron↔FastAPI↔React↔disco, payload, fluxos ponta a ponta |
| `/backend` | Engenheiro FastAPI/Python | analisar API, thread safety, atomicidade, BM25, RAG |
| `/frontend` | Engenheiro React/Vite | analisar componentes, hooks, estado, i18n, acessibilidade |
| `/ux` | Designer UX | avaliar fluxo, jornada, fricção, microcopy e interação por perfil |
| `/ui` | Designer UI | auditar tokens visuais, estados de componentes, hierarquia tipográfica, consistência dark/light |
| `/product-designer` | Product Designer | síntese UX + UI + Job to be Done + impacto de negócio — proposta integrada |
| `/design-system` | Especialista em Design System | tokens, tipografia, espaçamentos, componentes canônicos, revisão de consistência, lib Figma |
| `/produto` | Product Manager | priorizar features, benchmarking competitivo, estratégia |
| `/inovacao` | Especialista em Inovação | avaliar oportunidades técnicas e tendências |
| `/metricas` | Especialista em Analytics | telemetria, KPIs, funil de ativação |
| `/marketing` | Especialista em Marketing/Growth | canais de aquisição, copy, posicionamento, táticas sem budget |
| `/comercial-b2b` | Comercial B2B/Enterprise | oportunidade institucional, pricing, proposta, piloto, LGPD como argumento de venda |
| `/implantacao-b2b` | Engenheiro de Implantação B2B | build variant institucional, licenciamento offline, silent install/GPO, EDR, LTS |
| `/dev-b2b` | Engenheiro de Desenvolvimento B2B | features enterprise no código: licença offline, feature flags, auditoria, permissões por base |
| `/produto-b2b` | Product Manager B2B | roadmap da edição institucional, escopo mínimo vendável, priorização por contrato |
| `/memoria` | Memória Institucional | "isso já foi tentado?", "por que X foi descartado?", "quais invariantes não podem ser violados?" |
| `/memoria-atualizar` | Atualização da Memória | após cada release ou decisão relevante — propõe adições ao `_historia.md` para aprovação |

Os prompts completos ficam em [`agents/`](agents/) e são referenciados pelos comandos em [`.claude/commands/`](.claude/commands/).

**Base de memória compartilhada:** [`agents/_historia.md`](agents/_historia.md) — todos os agentes injetam este arquivo como contexto histórico. Contém: experimentos que falharam (com versão e motivo), padrões que funcionaram, decisões estratégicas permanentes e invariantes técnicas.

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
api_tusab.py           ← thin entry point; monta app FastAPI + routers + migrações on-startup
  │
  ├── tusab_engine/api/          ← routers FastAPI por domínio
  │     router_status.py           GET /status, /drive-auth, /history, /open-folder
  │     router_extraction.py       POST /set-channel, /start, /pause, /cancel, /queue/*
  │     router_agent.py            /agent/* (chat, config, index, ollama, stream)
  │     router_repositorio.py      /repositorio, /relatorio, /neural/*, /reset-total
  │     router_exports.py          /export/* (zip, markdown, docx, xlsx, pdf) — Pro
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

### Estrutura de dados em disco

```
data/neural/{projeto}/
  youtube/       ← transcrições .txt extraídas do YouTube
  documents/     ← PDFs, DOCX e outros docs do repositório
  texts/         ← textos colados pelo usuário
  management/    ← CSVs de gestão, summary.json, README, relatório
data/indexes/    ← índices BM25 serializados por projeto
data/config/     ← agent_config.json, credentials.json, token.json
```

**Naming de projetos:** `projeto_nome` é definido pelo usuário no modal de extração.
Se omitido, deriva do nome do canal YouTube. O nome é sanitizado (`re.sub(r'[<>:"/\\|?*\s]', '_', ...)`).
Um canal pode ser importado para qualquer projeto — a pasta não fica atrelada ao canal.

**Regra de dependência (acíclica):**
`api → agent | motor → storage`  — NUNCA importar de `api` dentro de `agent` ou `motor`.

**Shims de compatibilidade na raiz:**
`motor_tusab.py` e `agent_tusab.py` são re-exports puros — Electron e código legado
os importam pelo nome antigo, sem breaking change.

---

## Módulos — referência semântica

### `tusab_engine/storage.py`
**Tags:** paths, diretórios, dados, IO, atômico, CSV, JSON, neural, config, temp, gestao, migração
**Responsabilidade:** fonte de verdade para todos os caminhos de dados do app.
**Entrypoints principais:** `obter_caminho_dados()`, `DADOS_DIR`, `NEURAL_DIR`, `CONFIG_PATH`,
`salvar_csv_atomico(df, path)`, `salvar_json_atomico(obj, path, indent)`,
`gestao_canal_dir(prefixo) → str`.
**Aliases de compatibilidade:** `CEREBRO_DIR = NEURAL_DIR`; `DOCUMENTOS_DIR`, `TEXTOS_DIR` apontam para dentro de `NEURAL_DIR`.
**Funções de migração (idempotentes):** `migrar_cerebro_para_neural()`, `migrar_gestao_para_cerebro()`, `migrar_pastas_para_ingles()` — chamadas no startup; executam apenas se houver estrutura legada em disco.
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
**Tags:** BM25, indexação, rank_bm25, cache, chunks, corpus, youtube, documents, texts, canal, prefixo
**Responsabilidade:** construção e gerenciamento do índice BM25 local.
**Entrypoints:** `indexar(canal_nome, canal_prefixo, callback, stop_event) → int`, `get_agent_status() → dict`.
**Cache:** `_bm25_cache: dict` + `_bm25_lock (threading.Lock)` — evita dupla reconstrução quando dois chats usam o mesmo canal simultaneamente.
**Helpers:** `_index_path(prefixo)`, `_invalidar_cache(prefixo)`, `_carregar_meta_canal(prefixo)`,
`_get_canal_youtube_dir(prefixo)`, `_get_canal_doc_dirs(prefixo)`, `_enriquecer_documento(texto, tags, desc)`.
**Corpus:** YouTube (`neural/{prefixo}/youtube/`) + docs (`documents/`) + textos (`texts/`) + legado (`neural/youtube/`).

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
**Tags:** extração, YouTube, yt-dlp, transcrição, VTT, canal, mapeamento, CSV, neural, relatório, migração, projeto
**Responsabilidade:** engine principal de extração de transcrições e geração de base de conhecimento.
**Entrypoints:** `tusab_engine(canal_url, evento_pausa, evento_cancelar, fontes_filtro, projeto_nome)` (função principal),
`sanitizar_nome(nome)`, `extrair_nome_canal(url)`, `limpar_vtt(path)`, `executar_comando(cmd)`,
`coletar_meta_canal(url, nome, prefixo)`, `gerar_relatorio_checkup(safe, db_file)`, `gerar_readme(raw, safe)`,
`migrar_cerebro_txt()`, `migrar_canal_para_subdir(prefixo)`.
**Controle:** `evento_pausa (threading.Event)` e `evento_cancelar (threading.Event)` — set/clear do router.
**Projeto:** `projeto_nome` (str, opcional) — se fornecido, usa como prefixo da pasta em vez de derivar do canal.
**Nota de naming:** a função `tusab_engine()` tem o mesmo nome do pacote — sem conflito porque está em `motor/extraction.py`, não no `__init__.py` do pacote.

---

### `tusab_engine/api/router_status.py`
**Tags:** status, drive-auth, histórico, abrir pasta, polling, is_running, stats, logs
**Rotas:** `GET /status`, `POST /drive-auth`, `POST /drive-auth-cancel`, `GET /history`, `GET /open-folder`.
**Background:** `run_drive_auth()` — executa OAuth em background task do FastAPI.

---

### `tusab_engine/api/router_extraction.py`
**Tags:** extração, canal, iniciar, pausar, cancelar, fontes, motor, YouTube, fila, projeto
**Rotas:** `POST /set-channel`, `POST /start`, `POST /pause`, `POST /cancel`,
`POST /queue/add`, `DELETE /queue/clear`, `GET /queue`.
**Background:** `run_motor()` — loop que processa o canal atual e consome `state.extraction_queue` até esgotá-la; usa `threading.Thread` para auto-reset de status após 15s.
**Validação:** `_YT_URL_RE` — regex que aceita `/@canal`, `/channel/...`, `/c/...`; rejeita qualquer outra coisa.
**Projeto:** `ChannelRequest.projeto_nome` e `QueueAddRequest.projeto_nome` — nome do projeto (max 120 chars); sanitizado antes de usar como prefixo de pasta.

---

### `tusab_engine/api/router_agent.py`
**Tags:** agente, RAG, chat, streaming, indexação, ollama, groq, gemini, openai, anthropic, config, histórico, persona
**Rotas:** `GET /agent/status`, `GET /log`, `GET|POST /agent/config`, `POST /agent/index`, `POST /agent/test-key`,
`POST /agent/index-cancel`, `POST /agent/chat`, `POST /agent/chat/stream`, `POST /agent/chat/clear`,
`DELETE /agent/canal/{canal_nome}`, `/agent/ollama/*`.
**Background:** `_run_indexacao(canal_nome, canal_prefixo)` — BM25 com callback de progresso.
**Histórico:** `_MAX_HIST_MSGS = 12` (6 trocas); server-side em `state.chat_histories`; payload do cliente é ignorado.
**Persona:** `AgentConfigRequest.persona` — um de `{'', 'objetivo', 'tecnico', 'didatico', 'descontraido', 'socratico'}`; validado contra `_PERSONAS_VALIDAS`; persistido em `agent_config.json`.

---

### `tusab_engine/api/router_repositorio.py`
**Tags:** repositório, neural, documents, texts, upload, PDF, DOCX, XLSX, CSV, manifesto, limpeza, histórico, reset, whatsapp, reunião
**Rotas:** `GET /repositorio`, `GET /relatorio/{canal}`,
`POST /neural/upload`, `POST /neural/texto`,
`DELETE /neural/arquivo/{tipo}/{fid}`, `DELETE /historico/limpar`,
`DELETE /neural/limpar` (limpa documentos/textos de um canal), `DELETE /reset-total` (wipe completo).
**Manifest pattern:** cada subdiretório de docs/texts mantém `_manifest.json` como índice local (atomic write).
**Aliases:** tipo `"documentos"` → `"documents"`, `"textos"` → `"texts"` no handler DELETE — compatibilidade com clientes legados.
**Parser de formatos especiais:** `_detectar_formato_especial()` identifica WhatsApp Android/iOS e transcrições Zoom/Otter/Teams por regex; `_processar_formato_especial()` estrutura o texto por dia/participante ou palestrante/timestamp antes de salvar; `aviso_extracao` retorna `✅ Formato detectado: ...` quando identificado.

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
    useAgentConfig.js       config do agente (provider, API key, Ollama poll, canal-meta, keychain)
    useChatEngine.js        pipeline de chat RAG (streaming, export detection, auto-scroll)
  components/
    home/
      HomeScreen.jsx        tela inicial (logo + cards por perfil) — CircuitBackground interativo
      LandingScreen.jsx     tela de boas-vindas (first-run) — CircuitBackground + pulso no logo + seletor idioma/tema
      CircuitBackground.jsx canvas animado de circuitos PCB com pulsos elétricos e glow do mouse
    chat/ChatDrawer.jsx     drawer lateral de chat RAG
    sidebar/SidebarContent.jsx
    agent/
      OllamaSetup.jsx       setup guiado do Ollama
      RepositorioTab.jsx    listagem e upload de docs/textos; botão "Indexar base" (modal com checkboxes por projeto)
      RelatorioTab.jsx      tabela de vídeos + stats de cobertura
    extraction/
      ExtractionModal.jsx   seletor de fontes + iniciar extração
      PostExtractionModal.jsx ações pós-extração
    shared/
      Onboarding.jsx, ConsentModal.jsx, StatCard.jsx, LogLine.jsx, ProgressToast.jsx
  App.jsx                   orquestrador principal (~1 600 linhas)
  locales/pt.json, en.json, es.json   i18n
```

**Segurança:** `VITE_POSTHOG_KEY` fica em `web_interface/.env` (gitignored). **Nunca commitar.**

---

## Testes

```
tests/
  conftest.py               fixture: TUSAB_DATA_DIR → tempdir antes de qualquer import
  test_api.py               integração (TestClient FastAPI) — rotas /neural/*, /queue/*, /agent/*
  test_confiabilidade.py    atômicos + concorrência + índice corrompido/vazio
```

**27/27 verde.** Para rodar: `.venv\Scripts\python.exe -m pytest tests/ -v`

**Smoke tests (pre-commit hook):** `python smoke_test.py` — 16 checks contra backend real em porta 8001.

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
| `NEURAL_DIR` (não `cerebro/`) | Nomenclatura técnica neutra; `CEREBRO_DIR = NEURAL_DIR` mantém aliases para backward-compat |
| Subpastas em inglês (`documents/`, `texts/`, `management/`) | Padrão americano independente de idioma da UI; i18n da UI não afeta nomes de pasta |
| `projeto_nome` desacoplado do canal | Usuário nomeia o repositório; canal pode mudar sem renomear pasta |
| Aliases de tipo no DELETE `/neural/arquivo` | Clientes antigos passavam `"documentos"`/`"textos"`; backend normaliza antes de deletar |
| `sem_contexto: True` no retorno do chat | Sinaliza ao frontend que BM25 não retornou chunks — exibe botão "Indexar base agora" na mensagem em vez de mensagem hardcoded |
| Persona injetada em `_montar_prompt` | `instrucao_tom` é a última linha do prompt antes da pergunta — o LLM recebe instrução de estilo sem alterar o contexto RAG |
| Parser WhatsApp/Reuniões no upload | Textos `.txt`/`.md` passam por `_detectar_formato_especial` antes de salvar — estrutura o conteúdo por dia/participante, melhorando o recall BM25 |
| Modal "Indexar base" no Repositório, não no chat | Indexação é operação de gestão de conteúdo — pertence ao Repositório; chat apenas consome índice já pronto |
| Slug `profissional` ≠ label "Especialista" | Em jun/2026 o perfil foi renomeado na UI para "Especialista", mas o slug interno permanece `profissional` para preservar localStorage já gravado e todos os fallbacks em App.jsx, Onboarding.jsx e HomeScreen.jsx. **Nunca renomear o slug sem migração explícita de localStorage.** Ver comentário em `usePerfil.js → PERFIS_META.profissional`. |
| BM25 + CrossEncoder na Busca Ampla | Busca Restrita: BM25 puro (~1ms). Busca Ampla: BM25 recupera top-12 → CrossEncoder (`ms-marco-MiniLM-L-6-v2`, `sentence-transformers`) reordena semanticamente → top-6 vão ao prompt (+236ms medido). Lazy load do modelo; degradação graciosa se lib ausente. Embeddings e GraphRAG são evolução futura — corpus atual (transcrições YouTube, PDFs avulsos) tem baixa densidade relacional para justificar GraphRAG agora. |
| Chunking de docs com overlap | Documentos longos: janelas de 2.000 chars com overlap de 200 chars entre chunks. Evita cortar uma ideia na borda e garante que frases-chave na fronteira apareçam em dois candidatos BM25. YouTube não precisa: cada vídeo já é um chunk natural. |
| Chunking temporal de vídeos sem capítulos | `_vtt_por_janela_temporal()` em `motor/extraction.py` divide VTT em janelas de 120s com overlap de 15s (passo efetivo = 105s). Fallback dentro de `_vtt_por_capitulo()` quando não há capítulos. Vídeo de 12 min → ~7 chunks com timestamps distribuídos. Chunk máximo reduzido de 8.000 para 3.000 chars para melhorar precisão BM25. |
| Enriquecimento silencioso do corpus BM25 (KeyBERT) | `_enriquecer_com_keywords()` em `agent/index.py` appenda top-8 frases-chave ao campo `texto` de cada chunk antes de indexar. Campo `texto_original` preserva o texto limpo exibido ao usuário nas fontes do chat. Lazy singleton `_get_keybert()` — reutiliza `all-MiniLM-L6-v2` do CrossEncoder. Degradação graciosa: se KeyBERT ausente, indexa sem enriquecimento. |
| Sumarização LLM por vídeo ("Aprofundar base") | `tusab_engine/agent/summarize.py` — `resumir_video()` gera `{tema, subtemas, entidades, conclusao}` por vídeo (timeout 30s, todos os providers). Salvo em `neural/{prefixo}/youtube/{id}_resumo.json`. `_carregar_resumos_relevantes()` em `chat.py` injeta até 2 resumos antes dos chunks no prompt. Gatilho: `GET /agent/summarize/pending` após salvar config LLM → modal "Aprofundar base" no frontend. Não roda durante extração — evita sumarizar sem LLM configurado. |
| Corpus BM25 usa `texto` (com KeyBERT), não `texto_original` | `_recuperar_contexto()` em `chat.py` reconstrói corpus BM25 em memória com `c['texto']` — inclui as keywords KeyBERT appendadas durante a indexação. `texto_original` ainda existe nos chunks para exibição nas fontes do chat, mas não entra no corpus. Mudança: se usar `texto_original`, o BM25 perde todas as keywords extraídas na indexação. |
| Título com peso 5x no corpus BM25 | `_enriquecer_documento()` em `index.py` recebe `titulo=` e prefixa os tokens do título 5 vezes antes das tags (3x) e keywords (2x). Garante que queries com palavras exatas do título sempre acertam — sem precisar reindexar (corpus é reconstruído em memória a cada restart). |
| `POST /agent/buscar-trechos` — pipeline RAG sem LLM | Executa BM25 + query expansion + CrossEncoder em uma ou mais bases e retorna chunks ranqueados. Usado pelo `ReferenciarModal` para o usuário selecionar trechos e injetá-los no chat como contexto fixado. Schema: `{query, canais[], n, busca_ampla}` → `{trechos[], total}`. |
| `ReferenciarModal` — busca federada de trechos | `web_interface/src/components/chat/ChatDrawer.jsx` → `showReferenciarModal`. Abre via botão 🔍 na toolbar do chat ou via botão "Referenciar trecho" em mensagens sem contexto. Busca em múltiplas bases simultaneamente, agrupa por canal, permite seleção múltipla. Trechos injetados no `chatInput` como `[arquivo]\ntrecho` — detectado por `_extrair_trecho_injetado()` em `chat.py`. |
| Feedback de resposta (RLHF local) | 👍 em qualquer resposta do assistente → `POST /agent/feedback` → salva par `PERGUNTA/RESPOSTA ÚTIL` em `neural/{prefixo}/texts/feedback_{ts}.txt`. Na próxima indexação entra no corpus BM25 — futuras perguntas similares recuperam essa resposta como contexto. 👎 descarta silenciosamente. Não é treino de modelo: melhora a **recuperação**, não os pesos do LLM. |
| Modal de base não reabre após dispensar | `baseModalDismissedRef` em `ChatDrawer` — ref que impede o `useEffect` de reabrir o modal de seleção de base após o usuário confirmar/fechar. Reseta quando o chat é fechado. Resolve: com 2 bases e 1 selecionada, o modal abria em loop porque `precisaSelecionarBase` continuava `true`. |
| Badge animado de extração na navbar | Item `extracao` na nav mostra `w-1.5 h-1.5 bg-warning animate-pulse` quando `isRunning === true` (mesmo padrão do badge de update do `admin`). Prop `isRunning` vem de `status.is_running` via `useStatus` hook. |
| `CircuitBackground` com prop `interactive` | `interactive={false}` (landing): só pulsos automáticos, sem listener de mouse. `interactive={true}` (HomeScreen): glow nos segmentos próximos ao cursor. Separação evita event listener desnecessário na landing. |
| Landing → Onboarding sem flash da HomeScreen | `onEnter` na landing não fecha a landing — abre consent/onboarding por cima (`z-[10000]`). A landing só some no `onDone` do onboarding. Evita o flash da HomeScreen antes do perfil ser escolhido. |
| LandingScreen: seletor de idioma + tema acima do logo | Brazil First: usuário escolhe idioma antes de entrar. Toggle de tema também disponível na landing. Onboarding não repete o seletor — usuário já escolheu. |

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
| Mudar tom/persona do agente | `tusab_engine/agent/chat.py` → `PERSONAS` + `_montar_prompt()` → config em `useAgentConfig.js` → seção "Tom" na aba Agente |
| Mudar parser de WhatsApp/Reuniões | `tusab_engine/api/router_repositorio.py` → `_detectar_formato_especial()`, `_parsear_whatsapp()`, `_parsear_reuniao()` |
| Adicionar/mudar modal de indexação do Repositório | `web_interface/src/components/agent/RepositorioTab.jsx` → `showIndexar` + `handleIndexarConfirmar()` |
| Acionar modal de indexação a partir do chat | `ChatDrawer` → prop `onAbrirIndexacaoRepositorio` → `App.jsx` → `repoIndexarOpen` → `RepositorioTab` |
| Adicionar rota de status/drive | `tusab_engine/api/router_status.py` |
| Adicionar rota de extração / fila | `tusab_engine/api/router_extraction.py` |
| Adicionar rota de agente | `tusab_engine/api/router_agent.py` |
| Adicionar rota de repositório / reset | `tusab_engine/api/router_repositorio.py` |
| Adicionar export Pro (zip/docx/xlsx/pdf) | `tusab_engine/api/router_exports.py` |
| Mudar nome de projeto na extração | `ExtractionModal.jsx` step 2 → `handleStartConfirm()` em `App.jsx` |
| Mudar config do agente / provider / Ollama | `web_interface/src/hooks/useAgentConfig.js` |
| Mudar o pipeline de chat RAG / export | `web_interface/src/hooks/useChatEngine.js` |
| Mudar como o frontend chama o backend | `web_interface/src/services/api.js` |
| Mudar eventos de telemetria | `web_interface/src/services/analytics.js` + `constants/index.js` |
| Entender histórico de decisões | `Documentação do Produto/Execução do Relatório 360.md` |
| Entender o blueprint da modularização | `Documentação do Produto/Blueprint de Modularização.md` |
| Mudar animação de circuito (landing + home) | `web_interface/src/components/home/CircuitBackground.jsx` — constantes no topo: `GRID`, `NUM_PATHS`, `DIAG_PROB`, `MAX_PULSES`, `PULSE_SPEED`, `MOUSE_RADIUS` |
| Mudar pulso do logo na landing | `web_interface/src/components/home/LandingScreen.jsx` → `usePulseLogo()` |
| Mudar busca federada de trechos (modal) | `web_interface/src/components/chat/ReferenciarModal.jsx` — campo de busca, filtro por base, seleção múltipla, injeção no chatInput |
| Mudar endpoint de busca de trechos | `tusab_engine/api/router_agent.py` → `agent_buscar_trechos()` + `tusab_engine/agent/chat.py` → `buscar_trechos()` |
| Mudar lógica de feedback de resposta | `tusab_engine/api/router_agent.py` → `agent_feedback()` — salva em `texts/feedback_{ts}.txt`; `ChatDrawer.jsx` → `feedbackMap` state + botões `ThumbsUp`/`ThumbsDown` |
| Mudar badge de extração na navbar | `App.jsx` → item `extracao` no `.map()` da nav — usa `isRunning` de `useStatus` |
