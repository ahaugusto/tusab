# Changelog — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57

Todas as mudanças relevantes do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com).
Versionamento via [Semantic Versioning](https://semver.org).

---

## [1.0.8] — 2026-06-25

### Fixed (P0 — Estabilidade)
- **Fila de extração perdida ao fechar o app** — `extraction_queue` agora persiste em `data/config/extraction_queue.json` a cada mutação e é restaurada no próximo startup. Jobs pendentes sobrevivem a crashes e reinicializações.
- **Race condition no histórico de chat** — leitura do histórico movida para dentro do `agent_chat_lock`, garantindo que leitura + LLM + escrita sejam atômicas. Chats concorrentes no mesmo canal não sobrescrevem mais o histórico um do outro.
- **`google-generativeai` legado removido** — SDK depreciado (`google-generativeai`) removido do `requirements.txt`; `google-genai` já era o SDK ativo e continua sendo o único.

### New
- **API de eventos estruturados no AppState** — `dispatch_event(event, **kwargs)` substitui o contrato implícito de emojis no `LogRedirector`. O motor pode chamar diretamente sem depender de padrões de string frágeis.
- **Toast de carregamento do CrossEncoder** — primeira busca ampla exibe toast informativo ("Carregando modelo de relevância semântica... ~30s") via campo `cross_encoder_loading` em `GET /agent/status`.
- **Persistência e restauração de fila** — métodos `salvar_fila()` / `restaurar_fila()` no `AppState`; chamados em todas as mutações da fila (add, clear, remove, move, pop).

### Improved (P1 — Qualidade RAG)
- **Chunking dinâmico por tipo de documento** — documentos PDF/DOCX usam janelas de 1.500 chars com overlap de 300; textos colados/WhatsApp usam 500 chars com overlap de 100. YouTube continua com chunks naturais por vídeo. Melhora o recall BM25 para documentos densos e conversas fragmentadas.

### Fixed (UX)
- **Botão "Voltar ao topo" disponível em todas as abas** — anteriormente só aparecia na aba Agente. Todas as abas com rolagem longa (Extração, Repositório, Histórico, Visão Geral, Monitor, Agente, Admin) agora compartilham um único ref de scroll e disparam o botão corretamente.

---

## [1.0.7] — 2026-06-25

### Fixed
- **Export de PDF não funcionava no app instalado** — `reportlab` declarado no `requirements.txt` mas nunca incluído no `python_env/` bundled. Instalado e reempacotado; export de PDF agora funciona offline sem dependências externas.
- **PDFs com layout complexo geravam texto corrompido** — tolerâncias explícitas no `pdfplumber.extract_text()` (`x_tolerance=3, y_tolerance=3`) melhoram extração de colunas e tabelas. Hifenização automática de linha (`palavra-\npalavra`) desfeita por regex. Espaços múltiplos colapsados.
- **PDFs escaneados eram rejeitados silenciosamente** — agora são aceitos no repositório com texto placeholder e aviso ao usuário, em vez de retornar "Arquivo sem conteúdo extraível". Campo `QUALIDADE_PDF` gravado no cabeçalho do `.txt` para diagnóstico futuro.
- **Mensagem de erro de export PDF inútil no .exe** — substituída sugestão de `pip install` por mensagem orientando o usuário a reinstalar ou contatar suporte.

---

## [1.0.6] — 2026-06-25

### Fixed
- **Chip "✓ ativo" no seletor de modelos Ollama aparecia sem modelo instalado** — `modelName` agora exige `hasModel` (lista não vazia) antes de resolver; sem modelo, chip não aparece.
- **E-mail de suporte com typo na aba Admin** — `tusab@tusab.sollutions` corrigido para `tusab@tusab.solutions`.
- **`electron-updater` apontava para repositório privado** — usuários sem acesso ao repo privado não recebiam atualizações automáticas. `build.publish.repo` corrigido para `tusab-public`.
- **Versão exibida no nav lateral não refletia a versão de publicação** — estava hardcoded `v1.0.0`; agora usa `__APP_VERSION__` injetado via Vite em build-time.

### New
- **Instalador NSIS multilíngue** — Português (padrão), Inglês e Espanhol. O idioma é detectado automaticamente pelo Windows via locale ID; sem seleção manual necessária.
- **Aviso no chat quando Ollama está ativo mas sem modelo** — estado `ollamaSemModelo` bloqueia o chat e exibe banner orientando o usuário a baixar um modelo na aba Agente.
- **Versão, ano, e-mail e CNPJ injetados em build-time** — constantes `__APP_VERSION__`, `__APP_YEAR__`, `__SUPPORT_EMAIL__`, `__CNPJ__` definidas em `vite.config.js` a partir do `electron/package.json`; nunca desincronizam com a release.

---

## [1.0.4] — 2026-06-25

### New
- Tela de loading em preto e branco (identidade da marca).
- Instalador oferece instalar o Ollama automaticamente durante o setup via script NSIS customizado.
- Botão de download direto do Ollama no app (sempre versão mais recente via redirect oficial).
- Estimativa de tempo restante durante download de modelos Ollama.

### Fixed
- Alerta visual claro quando Ollama não está instalado (âmbar, não verde).
- Chip "ativo" corrigido — não aparecia quando Ollama estava rodando mas sem modelo selecionado.

---

## [1.0.3] — 2026-06-24

### Fixed
- **Crash imediato do backend em instalações novas** — `ModuleNotFoundError: motor_tusab` ao importar via shim no Electron packaged. Corrigido path de import no `main.js`.
- Tela de loading com animação de pulsos e glow azul/violeta alinhada ao design da landing.

---

## [1.0.2] — 2026-06-24

### Fixed
- Timeout do backend aumentado para 90 segundos — resolve "Timeout aguardando backend" em máquinas novas (carregamento inicial dos modelos sentence-transformers demora mais).
- Feedback progressivo na tela de loading durante inicialização dos modelos de IA.
- Log do Python exibido no diálogo de erro para facilitar diagnóstico.

---

## [1.0.1] — 2026-06-24

### Fixed
- **Índices BM25 apagados após indexação bem-sucedida** — `get_agent_status()` chamava `get_canal_youtube_dir(prefixo)` com um argumento (assinatura exige dois); o `TypeError` era capturado pelo `except Exception` que deletava o arquivo como "corrompido". Separados os handlers: `json.JSONDecodeError`/`ValueError` apagam o índice; demais exceções apenas ignoram o `n_arquivos_fonte`.
- **Fontes erradas no chat multi-base** — `useChatEngine.js` enviava `agentStatus.canal_indexado` (último canal indexado globalmente) em vez de `canalConfigurado` (escolha do usuário). Invertida a precedência: `canalConfigurado || agentStatus.canal_indexado`.
- **Seletor de base ocupando o corpo do chat** — com 2+ bases indexadas, os cards de seleção apareciam no corpo da área de mensagens. Removidos; a modal `showBaseModal` (botão "Base" na barra inferior) abre automaticamente ao entrar no chat com múltiplas bases disponíveis.
- **Backend crashando ao servir JS grande no Windows** — `print()` do banner ASCII usava caracteres Unicode (`█`, `©`, `—`) incompatíveis com `cp1252` (encoding padrão do Windows), causando `UnicodeEncodeError` antes do servidor subir. Adicionado `-X utf8` ao spawn do Python no Electron e `sys.stdout.reconfigure(encoding='utf-8')` no `api_tusab.py`.
- **Electron em dev apontando para `AppData` em vez do projeto** — `TUSAB_DATA_DIR` era sempre `app.getPath('userData')` independente do ambiente; em dev os dados ficavam em `AppData\Roaming\Tusab` enquanto os índices estavam em `Desktop\Tusab\data`. Corrigido: em dev usa a raiz do projeto; em produção empacotada mantém `userData`.
- **Electron em dev usando Python do sistema** — adicionada detecção do `.venv\Scripts\python.exe` local antes de tentar `python_env` ou `python` do sistema.
- **Voltar para seleção de projeto no modal de upload** — ao abrir upload pelo card da home com projeto pré-selecionado, não havia como trocar. Adicionado botão `←` no chip do projeto que força o step de seleção/criação via `forceSelecionarProjeto`.
- **`useEffect` com referência antes de inicialização** — `precisaSelecionarBase` era usado no `useEffect` antes de ser declarado no componente, causando `ReferenceError` em runtime. Movido para após as declarações das constantes derivadas.

### Changed
- Botão "Selecionar base" no header do chat destacado em âmbar quando seleção é obrigatória.

---

## [0.5.2] — 2026-06-24

### Fixed
- **Indexação sequencial de múltiplas bases** — o loop anterior disparava todos os POSTs simultaneamente; o backend rejeitava a partir do segundo ("indexação já em andamento"). Agora `handleIndexarDoChat` processa a lista sequencialmente, aguardando o backend terminar cada item via polling (`_aguardarIndexacao`) antes de iniciar o próximo.
- **Modal de indexação (Repositório) com feedback imediato** — ao clicar "Indexar", o bloco de progresso aparece no topo da modal antes do primeiro poll (via `setIndexando(true)` síncrono); lista de projetos fica opaca/desabilitada durante o processo.
- **Toast de lote inteligente** — ao indexar múltiplas bases: se todas ok → "X bases indexadas com sucesso"; se erros parciais → "X de Y bases indexadas (outras sem conteúdo)". Toasts intermediários suprimidos durante lote.
- **Botão "Confirmar" da Base de Conhecimento sempre visível** — rodapé do painel estava condicionado a `canalAtivo`; agora aparece sempre que há bases listadas.
- **"Indexar agora" em mensagens sem contexto** — antes abria o modal de indexação do Repositório (comportamento errado); agora abre o painel Base de Conhecimento no chat diretamente.
- **Card click no painel Base de Conhecimento** — clique no card não troca mais a base principal imediatamente; apenas adiciona/remove das extras. Confirmação exclusiva pelo botão "Confirmar".
- **Tag "YouTube" redundante removida** do modal de indexação — ícone 🎬 já comunica a fonte; a tag textual gerava confusão.
- **`package-lock.json` sincronizado** — `@emnapi` deps transitivas faltando causavam falha no `npm ci` do CI.

### Changed
- `handleIndexarDoChat` (App.jsx) agora aceita string ou array de nomes de canal, consolidando a lógica de indexação de ambos os fluxos (ChatDrawer e RepositorioTab).
- `RepositorioTab.handleIndexarConfirmar` delega toda a fila ao `handleIndexarDoChat` em vez de fazer loop próprio.

---

## [Unreleased]
### Planned
- Fila de extração com retry e backoff exponencial
- Whisper como fallback para vídeos sem legenda (Gemma 4 12B pode substituir)
- Sistema de licença via Lemon Squeezy
- Imagens na base de conhecimento (Gemma 4 multimodal / OCR fallback)
- Busca web via Brave Search API
- Entrada por voz (AI Edge Eloquent como referência)
- LiteRT-LM CLI como provider adicional (aguardar API pública)
- Embeddings Ollama + ChromaDB (próxima versão pós-feedback CrossEncoder)

---

## [0.5.1] — 2026-06-24

### Changed
- **Perfis unificados** — estudante, professor e pesquisador agora têm acesso a todas as funcionalidades exceto Monitor (exclusivo do Especialista). Restrições anteriores por perfil eram arbitrárias e criavam fricção desnecessária.
  - Todos os perfis: aba Agente com config de provider/API key, Busca Ampla + CrossEncoder, Google Drive, Relatório, exportar base `.tusab`
  - Estudante: sem aba Extração (perfil de consumo) e sem Visão Geral (painel de gestão de corpus não relevante)
  - Professor e acima: acesso à Extração e Visão Geral
  - Monitor: exclusivo do Especialista
- **Onboarding s5 reescrito** — texto deixa claro que Ollama é pré-requisito do chat; instrução de instalação e alternativa de provedor externo explicitadas
- **Aviso de Ollama no chat** — painel âmbar quando `provider=ollama` e Ollama não detectado; link direto para `ollama.com/download`; válido para todos os perfis
- **Placeholder do modal "Criar Projeto"** — trocado de "Nome do projeto" para "Canal do Youtube" (pt) / "YouTube channel" (en) / "Canal de YouTube" (es)
- **Botão "Criar projeto" no header** — removido "+" duplicado da string de tradução (já havia ícone SVG no botão)

### Docs
- `Jornada do Usuário.md` — mapa de perfis reescrito, narrativas atualizadas, tabela de funcionalidades reflete v0.5.1
- `Jornada do Usuário — Roteiro de Vídeo.md` — bloco 7 atualizado com aviso de Ollama; bloco 3 com modoFila; tabela final atualizada

---

## [0.5.0] — 2026-06-24

### Added
- **Fila de extração com UI completa** — adicionar canais à fila antes ou durante uma extração;
  gerenciador inline com remoção individual e limpeza total; card de extração atualiza automaticamente
  para o canal que assume a posição quando o atual termina ou é cancelado.
- **Sistema de projetos desacoplado do canal** — usuário nomeia o repositório independentemente do canal.
  Pasta `data/neural/{projeto}/` agrupa YouTube + documents + texts sob um nome escolhido.
  Um canal pode ser importado para qualquer projeto sem renomear pasta.
- **Modal "Criar Projeto" standalone** no header do Repositório — cria projeto antes de qualquer upload.
  Contrato documentado em código (`[CONTRATO CRÍTICO]`) e na documentação de dependências.
- **ExtractionModal refatorado para steps por string** (`'url' | 'projeto' | 'fontes'`).
  Modo fila: URL → Projeto (handle sugerido em tempo real ao digitar) → Fontes.
  Modo canal já configurado: começa em Projeto → Fontes (URL omitida).
- **CrossEncoder na Busca Ampla** — BM25 recupera top-12 → `ms-marco-MiniLM-L-6-v2` reordena
  semanticamente → top-6 vão ao prompt (+236ms medido vs. BM25 puro). Lazy load; degradação graciosa.
- **Sistema de perfis de usuário** com HomeScreen personalizada por perfil (Pesquisador, Estudante, Especialista).
  LandingScreen animada com seletor de idioma + tema antes do onboarding.
  `CircuitBackground` interativo (glow do mouse na HomeScreen) e passivo (landing).
- **i18n completo** em pt/en/es — todos os componentes, modais, toasts, personas, relatório e chat drawer.
- **Base Compartilhável** (`.tusab`) — exportar e importar base de conhecimento entre máquinas; readonly mode.
- **Histórico de conversas persistente** — salvar, listar e restaurar conversas anteriores.
- **Parser WhatsApp / Reuniões** — detecta e estrutura automaticamente exportações Android/iOS e
  transcrições Zoom/Otter/Teams antes de indexar (melhora recall BM25).
- **Personas de tom de voz** — Objetivo, Técnico, Didático, Descontraído, Socrático; injetadas no prompt.
- **Seletor multi-canal no chat** — chips de bases, busca ampla/restrita com toggle; `@mention` de canal.
- **Download de modelos Ollama via backend** com controle de acesso por perfil.
- **Auto-Update por canal** — aba com configuração de periodicidade real por canal.
- **Fila de mensagens no chat** (máx. 5 balões simultâneos) com export de arquivos pelo chat.
- **Anexo de arquivo direto no chat** com indexação automática.
- **Busca inline no Repositório** por projeto e arquivo.
- **Monitor de sistema** com ETA de extração e relatório de observabilidade.
- **PostHog analytics opt-in** — ConsentModal na primeira abertura; zero coleta sem consentimento.
- **Onboarding contextual** — dicas por feature em localStorage; ProgressToast após indexação.

### Changed
- **Upload de arquivo exige projeto existente** — botão bloqueado até `POST /neural/projeto` confirmar.
  Alias `"documentos"`/`"textos"` → `"documents"`/`"texts"` no DELETE mantido para backward-compat.
- **Indexação usa canal explícito do modal** — `req.canal_nome` tem prioridade sobre `state.stats.canal_nome`;
  fix de regressão onde a última extração sobrescrevia a seleção do usuário no modal de indexação.
- **Repositório carrega ao abrir a aba** (não só no mount) — `useEffect` em `activeTab`.
- **App.jsx modularizado** — extraídos 7+ componentes e 4 custom hooks; de ~2.500 → ~1.600 linhas.
- **Chunking de docs com overlap** — janelas de 2.000 chars com overlap de 200 chars; evita corte de ideias na borda.
- **Ollama com parâmetros de performance** — `num_ctx`/`num_predict`/`num_thread`; contexto reduzido para modelos locais.
- **Timeout Ollama** aumentado de 120s → 300s.
- Pastas internas renomeadas para inglês (`documents/`, `texts/`, `management/`); aliases de backward-compat mantidos.
- Subpastas por projeto sob `data/neural/{projeto}/` em vez de pasta plana.
- Branding definitivo: Brain'IAC → Sebayt → **Tusab** (nome final; slug `profissional` preservado para backward-compat localStorage).

### Fixed
- `canalConfigurado` não atualizava quando canal da fila assumia a extração.
- Repositório mostrava vazio mesmo com projetos no backend (estado inicial sem `canais: []`; sem refresh ao abrir aba).
- modoFila step Projeto herdava nome do canal em extração em vez do handle da URL digitada.
- `ExtractionModal` pulava step de URL em reloads — agora só pula se canal configurado na *sessão atual*.
- `createPortal` para modais standalone (fix `ReactDOM` default import quebra React 19).
- Drive: `credentials.json` e `token.json` movidos para `data/config/` (fora do bundle PyInstaller).
- Path traversal → fallback seguro para `index.html` (SPA routing).
- XSS via `dangerouslySetInnerHTML` removido.
- `RLock` no `state_lock` — `print()` dentro de região bloqueada reentrava no `LogRedirector` causando deadlock.
- Scroll interno em `ExtractionModal`, `AlterarPerfilModal` e `Onboarding`.
- Query expansion desativada para Ollama local (latência 15-25s → 3-8s).
- `sub_langs = 'pt'` fixo — tentativas duplas causavam rate limit 429 no YouTube.
- `skip=translated_subs` + sleep entre requests para eliminar 429 adicionais.

### Docs
- **Mapa de Impacto de Dependências** — documento formal com contratos críticos, regras de dependência
  e histórico de decisões técnicas não óbvias.
- **Blueprint de Modularização** — guia de referência da arquitetura do frontend.
- **CLAUDE.md** expandido — semântica de módulos, onde encontrar o quê, decisões técnicas não óbvias.
- Smoke tests expandidos (15 checks) com hook pre-commit obrigatório.
- Workflow de release GitHub Actions (`.github/workflows/release.yml`) — CI + build Windows + publicação.

---

## [0.4.3] — 2026-06-05
### Added
- **Seletor de modelos Ollama** em "Configurações Avançadas" na aba Configurar Agente
  Painel colapsável (ícone engrenagem) lista todos os modelos instalados via Ollama.
  Seleção persiste em agent_config.json e é aplicada imediatamente no chat.
  Compatível com qualquer modelo Ollama — incluindo Gemma 4 12B (gemma3:12b).
  Padrão mantido: llama3.2:1b (funciona com 4GB RAM).

### Docs
- Posicionamento: PKM como categoria de mercado, Mentor Digital como conceito
- Análise competitiva frente ao NotebookLM documentada na Proposta de valor
- Análise de convergência com Gemma 4 12B (Google) na Avaliação Estratégica
- Botão "Exportar base" descartado — Drive já cobre backup e compartilhamento
- Roadmap: AI Edge Eloquent (Fase 3) e LiteRT-LM CLI (Fase 4) mapeados

---

## [0.4.2] — 2026-06-06
### Added
- **Posthog analytics opt-in** — ConsentModal na primeira abertura
  Aceitar/Recusar persiste em localStorage. Zero coleta sem consentimento.
  services/analytics.js com 10 eventos nomeados (appOpened, canalConfigurado,
  baseIndexada, chatPergunta, repositorioAcessado, etc.)
- **Onboarding contextual** — dicas no momento certo, não em modal de entrada
  hooks/useOnboarding.js gerencia flags por feature em localStorage
  ProgressToast após indexação: "N chunks prontos! → Abrir chat"
  Hint na primeira visita à aba Repositório
- **Toggle busca ampla/restrita** no chat com tooltip descritivo ao hover
  Restrita: só base indexada | Ampla: base + conhecimento do modelo
- **Badge "N novos"** no header da Base de Conhecimento quando desatualizada
  Detecta .txt mais novos que o índice via mtime, pisca em âmbar
- **Base de conhecimento embutida** (scripts/create_help_base.py)
  13.671 chars cobrindo: o que é, como usar, capacidades, limitações,
  teoria (RAG, BM25, Ollama, Groq, yt-dlp), FAQ, glossário técnico
  Criada automaticamente na primeira execução se não existir

### Fixed
- Query expansion desabilitada para Ollama local — latência 15-25s → 3-8s
- Chunks reduzidos de 6→4 para Ollama (contexto menor = resposta mais rápida)
- Brain'IAC_crash.log adicionado ao .gitignore (segurança)
- IndentationError no chat_stream após refactor do n_chunks

### Docs
- Avaliação Estratégica.txt criada com análise sob 6 perspectivas
  (Arquiteto, PM, UX, Segurança, Negócio, SRE) + matriz de prioridades
- Posthog, busca web e onboarding contextual documentados em Próximos passos
- Clareza de posicionamento: Brain'IAC não compete com IA generativa,
  são produtos complementares com jobs to be done distintos
- Arquitetura narrativa em 3 camadas documentada na Proposta de valor

---

## [0.4.1] — 2026-06-06
### Changed
- **Modularização completa do frontend** — App.jsx de 2.495 → 1.279 linhas
  - `constants/index.js` — API_BASE, LANGS, BTN_FOCUS centralizados
  - `services/api.js` — 24 funções de API nomeadas (axios/fetch)
  - `hooks/useStatus.js` — polling /status isolado em custom hook
  - `hooks/useAgentStatus.js` — polling /agent/status isolado
  - `components/shared/` — GuideModal, Onboarding, StatCard, LogLine
  - `components/extraction/` — ExtractionModal, PostExtractionModal
  - `components/agent/` — OllamaSetup, RepositorioTab, RelatorioTab
  - `components/home/` — HomeScreen
  - `components/chat/` — ChatDrawer
  - `components/sidebar/` — SidebarContent

### Added
- Padrão de comentários DevOps em todos os arquivos:
  - `@file`, `@description`, `@module`, `@author`, `@copyright`
  - `@param`, `@returns` em componentes e hooks
  - Seções marcadas com `// ─── Nome ───`
  - Handlers documentados com JSDoc inline
- Home screen com layout de duas colunas (logo esquerda, cards direita)
- Sidebar recolhível com toggle `‹ / ›`
- Sidebar oculta na home screen
- Seletor de idioma e tema na home screen
- Logo clicável retorna à home em qualquer aba

---

## [0.4.0] — 2026-06-05
### Added
- **Home screen** com 4 cards interativos (Extrair / Repositório / Relatório / Configurar Agente) — mostrada a cada entrada, com badges de contagem real
- **Aba Repositório** — browser de arquivos da base: YouTube extraídos, documentos e textos do usuário; botão "Adicionar" para upload (PDF/DOCX/TXT/MD) ou colar texto; botão deletar por item
- **Aba Relatório** — select de canal, cards de stats (total, extraídos, cobertura %), tabela de vídeos filtrável por status
- **Base de conhecimento expandida** — nova estrutura `data/cerebro/youtube/`, `data/cerebro/documentos/`, `data/cerebro/textos/`; BM25 lê de todas as fontes na indexação
- **Endpoints novos**: `GET /repositorio`, `GET /relatorio/{canal}`, `POST /cerebro/upload`, `POST /cerebro/texto`, `DELETE /cerebro/arquivo/{tipo}/{id}`
- **Groq como provedor** — modelos llama-3.1-8b e llama-3.1-70b gratuitos; seletor simplificado (Rápido / Máxima qualidade)
- **Chat flutuante** — drawer lateral (420px desktop, full-screen mobile) acessível de qualquer aba
- Guia "Como usar" atualizado com 6 passos refletindo o novo fluxo
- Canal do relatório com feedback visual ao selecionar

### Changed
- 4 abas: Extração · Repositório · Relatório · Configurar Agente (era Extração · Agente IA)
- `cerebro_txt/` migrado automaticamente para `cerebro/youtube/` na inicialização
- Chat removido da aba Configurar Agente — acessível via botão flutuante
- Chat vinculado ao canal configurado no sidebar (não mais ao último indexado)

### Fixed
- `NaN` do pandas causando 500 no endpoint `/relatorio/{canal}`
- `python-multipart` ausente bloqueando upload de arquivos
- Duplicate `function App()` causando build quebrado
- Fontes do chat aparecem após a resposta (não antes)
- Select com ícone muito próximo da borda (adicionado `pr-8`)

### Packages
- `pdfplumber` — extração de texto de PDFs
- `python-docx` — extração de texto de DOCX
- `python-multipart` — upload de arquivos via FastAPI

---

## [0.3.2] — 2026-06-05
### Fixed
- **Causa raiz do bloqueio de indexação**: verificação de chave de API estava no endpoint `/agent/index` em `api_Brain'IAC.py`, não só em `agent_Brain'IAC.py`. Indexação BM25 é 100% local e nunca requer chave.
- Ollama status polling movido para o componente pai — antes dependia do accordion estar aberto; se fechado, `ollamaStatus` ficava `{running: false}` e warnings apareciam incorretamente
- Bug de build: useEffect de polling inserido com URL quebrada (`` `/agent/ollama/status` `` sem `${API_BASE}`), causando falha silenciosa de build e dist desatualizado
- "canalis" → "canais" (pluralização incorreta em português)
- Botão "Usar" no histórico agora confirma o canal automaticamente via API, sem precisar clicar no sidebar

### Added
- Auto-update do yt-dlp via GitHub API no startup do Electron (feature branch mergeada)
- Versionamento semântico formal com tags git retroativas (v0.1.0 → v0.3.1)
- Branch `develop` para integração contínua
- `CHANGELOG.md` com histórico completo

### Changed
- Contraste WCAG melhorado: textos secundários de `slate-400/500` para `slate-500/600` (light) e `slate-300` (dark), atingindo requisito AA 4.5:1

### Docs
- Pasta renomeada de "Objetivos e Estrutura" para "Documentação do Produto"
- Novo arquivo: `Proposta de valor.txt` com pitch de um parágrafo
- Novo arquivo: `Modelo de negócio.txt` — ISV Freemium + Perpetual Seat License
- `O meu porquê.txt` reescrito com origin story real (AUVP/Raul Sena)
- `Os meus alvos.txt` reorganizado em 3 camadas (B2C / B2B Creator / Enterprise)
- `Próximos passos.txt` atualizado com análise estratégica e decisões tomadas
- Sistema de licença via Lemon Squeezy

---

## [0.3.1] — 2026-06-02
### Fixed
- Status "Interrompido" agora auto-reseta para "Ocioso" após 15s
- Indexação BM25 não exige mais chave de API (era local desde sempre)
- `configured: true` retornado quando Ollama disponível sem config salvo
- Chave de API não pré-carregada no campo ao abrir o app

### Added
- Notificação nativa do OS ao concluir extração
- Histórico de canais extraídos na aba Extração (lê CSVs de gestão)
- Endpoint `GET /history` com resumo por canal
- Ollama como provedor padrão sem necessidade de configuração
- Toggle "Usar minha chave de API" para provedores externos
- Botão "Limpar" para remover chave salva do disco

### Docs
- Porquê, alvos e proposta de valor refinados com origin story real (AUVP)
- Análise estratégica de gargalos: usuário, PO, CEO, investidor
- Próximos passos atualizados com decisões tomadas

---

## [0.3.0] — 2026-05-29
### Added
- Agente RAG local com BM25 (rank_bm25) — sem embeddings, sem API externa
- Indexação instantânea em JSON local, cache em memória
- Query expansion: LLM gera variações da pergunta, scores combinados
- Streaming de respostas via ReadableStream com cursor piscante
- Histórico de conversa (últimas 6 trocas no contexto do LLM)
- Multi-canal: indexar e buscar em N canais simultaneamente
- Ollama (llama3.2:1b) como provedor padrão gratuito e offline
- Provedores externos opcionais: Gemini, OpenAI, Anthropic (BYOK)
- Electron 34 com Python embeddable bundled
- Auto-update via electron-updater + GitHub Releases
- Ollama baixado automaticamente na primeira execução (Win/macOS/Linux)
- Detecção de OS para download correto do instalador Ollama
- Loading screen com status em tempo real durante setup
- Coleta de hashtags e descrições dos vídeos via yt-dlp
- Metadados do canal (nome, handle, inscritos) salvos em JSON
- Cabeçalho de atribuição ao criador em cada arquivo .txt
- Internacionalização PT/EN/ES com react-i18next
- Tema automático via prefers-color-scheme com persistência
- Accordions animados na aba Agente
- Card de canal com metadados na aba Agente
- NSIS installer com license.txt informando downloads adicionais
- Copyright © 2026 CriAugu em todos os arquivos principais

### Changed
- ChromaDB e embeddings substituídos por BM25 local
- Sub-langs fixo 'pt' (elimina 429 por detecção dinâmica)
- yt-dlp: dois subprocessos separados (fix bug simulação 2026)
- Dados em `%AppData%\Brain'IAC\data\` (separado do diretório do app)

### Fixed
- 429 rate limit por --list-subs retornando 60+ idiomas
- google-genai SDK incompatível com text-embedding-004
- Botão "Configurado" aparecia antes de chave ser inserida

---

## [0.2.0] — 2026-05-01
### Added
- Interface web React 19 + Vite + Tailwind CSS 3
- FastAPI backend (localhost:8001)
- Google Drive sync opcional (OAuth2, escopo drive)
- Seletor de tipos de conteúdo (vídeos/shorts/lives/podcasts/cursos/playlists)
- Delta inteligente — não reextrai vídeos já processados
- Log em tempo real
- Barra de progresso com percentual
- Internacionalização básica

---

## [0.1.0] — 2025-12-01
### Added
- Extração básica de legendas via yt-dlp
- Interface CustomTkinter (desktop GUI)
- Upload para Google Drive
- Chunking em partes (MAX_WORDS_PER_FILE)
- CSV de gestão de metadados
- Suporte inicial ao canal @InvestidorSardinha (AUVP)
