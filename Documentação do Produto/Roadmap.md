# Roadmap — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

> Para o histórico completo do produto — de script pessoal (fev/2025) até a v1.0 — veja [`Evolução do Produto — De Raspador a Plataforma de IA.md`](Evolução%20do%20Produto%20—%20De%20Raspador%20a%20Plataforma%20de%20IA.md).

---

## Estado atual — v1.0.34 (julho 2026)

> Este documento foi escrito originalmente em junho/2026 (v1.0.11). As seções abaixo mantêm o conteúdo histórico; o que foi entregue depois está consolidado no bloco "Entregue entre v1.0.12 e v1.0.34" logo após "Feito e funcionando", e detalhado versão a versão em [`agents/_historia.md`](../agents/_historia.md).

### Feito e funcionando

**Sistema de Perfis**
- Onboarding com seleção de perfil na primeira abertura (Estudante, Professor, Pesquisador, Especialista)
- Feature flags por perfil: abas visíveis, persona padrão, busca ampla, config de API, fila, Drive, export, monitor, admin, reset total
- Landing screen na primeira abertura; tela inicial personalizada por perfil
- Alteração de perfil a qualquer momento via menu no cabeçalho
- Slug interno `profissional` com label "Especialista" — compatibilidade com localStorage preservada

**Base Compartilhável**
- Export `.tusab` por projeto (neural/ + índice BM25 + manifest.json)
- Import `.tusab` com validação de manifest e proteção readonly (UX)
- Fluxo professor→aluno: professor exporta, aluno importa e conversa sem reindexar
- Card "Importar Base" em destaque na tela inicial do perfil Estudante

**Extração**
- Extração de canais YouTube via yt-dlp (legendas PT, incremental)
- Fila sequencial de extração (N canais enfileirados, processados um a um)
- Filtro de fontes por tipo (Vídeos, Shorts, Ao Vivo, Podcasts, Cursos, Playlists)
- Cancelamento limpa a fila; erro num canal não interrompe os seguintes
- Relatório de cobertura por canal: tabela de vídeos, filtros por tipo/status/aba, busca por título, colunas Views e Aba

**Repositório**
- Upload de PDF, DOCX, XLSX, CSV, Markdown, TXT, imagens, áudio — sempre dentro de um projeto nomeado
- Botões de adicionar texto (📝) e arquivo (📎) por projeto, no header do accordion — sem opção "avulso"
- Parser automático de WhatsApp (Android/iOS) e transcrições (Zoom/Otter/Teams)
- Toolbar global com 3 botões: Indexar base | Importar .tusab | Limpar base
- Manifesto `_manifest.json` por subdiretório (escrita atômica)

**Agente RAG**
- Indexação BM25 com cache em memória por projeto
- Chunking com overlap de 200 chars entre janelas de 2.000 chars — evita cortar ideias na borda de documentos longos
- Enriquecimento: tags YouTube (3×) + keywords TF-IDF (2×) + descrições
- Query expansion (LLM gera variações da pergunta) — Groq, OpenAI, Anthropic, Gemini; desabilitado para Ollama
- Re-rankeamento semântico com CrossEncoder (`ms-marco-MiniLM-L-6-v2`, ~80MB, CPU) — ativado na Busca Ampla; BM25 recupera top-12 candidatos, CrossEncoder reordena por relevância semântica real antes de montar o prompt
- Multi-canal: busca simultânea em múltiplos índices com merge
- Anti-alucinação: threshold BM25 + verificação pós-geração por keyword overlap
- Recovery de índice corrompido: detecção automática + toast com botão Reindexar

**Chat**
- Streaming via ReadableStream, cursor piscante
- Histórico server-side — últimas 6 trocas por canal
- Busca Restrita (~1ms de retrieval) e Busca Ampla com CrossEncoder (~+236ms de retrieval) — toggle disponível para todos os perfis
- Persona / tom do agente: Padrão, Objetivo, Técnico, Didático, Descontraído, Socrático
- Perguntas sugeridas pós-indexação (chips clicáveis)
- Renderização Markdown nas respostas (negrito, listas, tabelas, código)
- Chat expandido em overlay sobre as abas
- Histórico de conversa acessível via sidebar

**Provedores LLM**
- Ollama (llama3.2:1b padrão, qualquer modelo instalado configurável)
- Groq (llama-3.1-8b-instant, llama-3.1-70b-versatile) — destacado como melhor gratuito para o mercado brasileiro
- OpenAI (gpt-4o-mini)
- Anthropic (claude-sonnet-4-6)
- Google Generative AI (gemini-1.5-flash)

**Export**
- ZIP da base completa (`/export/base`)
- Markdown do histórico de chat (`/export/historico`)
- DOCX com resumo de canal (`/export/resumo-canal`)
- XLSX com tabela de vídeos (`/export/tabela-videos`)
- PDF com Q&A do chat (`/export/relatorio-pdf`)

**Infraestrutura**
- Modularização: 9 módulos em `tusab_engine/` com separação limpa de responsabilidades
- Suite pytest: 27/27 verde
- Smoke tests: 16/16 verde (pre-commit hook)
- Segurança: 12 fixes aplicados (CORS, path traversal, prompt injection, upload size, etc.)
- Chaves de API criptografadas via `safeStorage` do Electron (Windows DPAPI)
- Watchdog do backend no Electron (poll de 5s, IPC backend-dead/alive, banner vermelho com botão Reiniciar)
- Fila de extração persistente em disco — crash não perde jobs pendentes (v1.0.8)
- Race condition no histórico de chat corrigida — leitura+LLM+escrita atômicas (v1.0.8)
- API de eventos estruturados `dispatch_event()` no AppState (v1.0.8)
- Telemetria PostHog opt-in com retenção Day 7 / Day 30
- i18n PT/EN/ES (Brasil como mercado primário — app abre em português)
- Empacotamento Windows: Python embeddable + yt-dlp bundled + instalador NSIS multilíngue PT/EN/ES com selector de idioma

**Modo Estudo (v1.0.11)**
- Flashcards e resumo gerados por LLM a partir do índice BM25 do projeto
- Seleção obrigatória de projeto indexado antes de gerar — empty state âmbar quando nada indexado
- Parser robusto de flashcards: cascata JSON direto → extração de bloco `[...]` → fallback regex Q:/A:
- Amostragem distribuída: `random.sample()` em vez de `chunks[:n]` — cobre todo o corpus, não só o início
- Timeout Ollama: 120→300s; amostra do resumo reduzida de 18k para 3.7k chars (evita timeout em modelos locais)
- Estado persistente: flashcards, resumo e progresso sobrevivem a trocas de aba e fechamento do accordion
- Download de modelos Ollama também persiste entre trocas de aba

**RAG — qualidade para corpora densos (v1.0.11)**
- Chunk size para textos/WhatsApp: 500→1200 chars com overlap de 100→250 chars — captura contexto conversacional completo
- Score mínimo BM25 adaptativo por tamanho do corpus: 0.15 (>5k chunks) / 0.25 (>2k) / 0.35 (>500) / 0.5 (pequeno)
- CrossEncoder com truncação 512→768 chars por chunk — mais contexto para rerankeamento semântico

**Histórico de chat como conhecimento (v1.0.11)**
- Auto-salvamento em `texts/_chat_history/` ao limpar conversa — formato BM25 otimizado (TEMA/PERGUNTA/RESPOSTA/FONTES)
- Pasta `_chat_history/` ignorada pelo indexador por padrão — usuário controla quando injetar
- Aba "Salvos no disco" no histórico de chat — lista com metadata e botão "Adicionar ao corpus"

**Acessibilidade de modais (v1.0.11)**
- `ModalWrapper` usa `ReactDOM.createPortal` + `aria-hidden` no `#root` enquanto modal aberta
- Screen readers (NVDA, JAWS, VoiceOver) agora lêem apenas a modal — conteúdo de fundo mascarado
- `CancelQueueModal`, `QueueManagerModal`, `ResetModal`, `ProHintModal` migrados para `ModalWrapper`
- Hook `useAriaHidden.js` criado para modais fora do `ModalWrapper`

**UX — Sub-abas do Agente (v1.0.11)**
- Tabs "Funcionalidades" e "Configurações" agora seguem o padrão visual da aba de Extração (underline `border-b-2`, não pill)
- Layout `flex-col` com área scrollável separada — mais espaço vertical para o conteúdo

**Notificações e diagnóstico (v1.0.10)**
- Notificação desktop quando o chat responde com drawer fechado/minimizado — dispara via Web Notification API ao detectar `parsed.done` com `chatOpenRef.current === false`
- Notificação nativa Electron ao concluir download de update — clique na notificação instala e reinicia sem passar pelo Admin
- Step de notificações no onboarding — solicita permissão contextualmente com feedback de concedida/bloqueada
- Accordion "Redes Corporativas" na aba Admin — checklist de diagnóstico (6 itens com severidade crítico/moderado/baixo) + texto para o TI liberar portas 8001/11434, exceções no antivírus e GPO; PT/EN/ES
- Monitor de sistema detecta métricas zeradas (psutil sem permissão em ambientes EDR/GPO) e exibe aviso com link direto para o accordion de Redes Corporativas

**Google Drive**
- OAuth2 com escopo `drive.file` (mínimo)
- Upload de transcrições como Google Docs
- Desconexão via UI (sem revogar OAuth no Google)

---

## Entregue entre v1.0.12 e v1.0.34 (julho 2026)

**Busca e recuperação**
- SQLite FTS5 como camada de exact-match paralela ao BM25 — recall de termos frequentes/literais (v1.0.26)
- Classificador de intenção BUSCA/CONTEXTO/CONVERSA — evita nova busca BM25 em follow-ups como "explique melhor" (v1.0.25)
- Chunking temporal de vídeos sem capítulos (janelas 120s/overlap 15s); enriquecimento silencioso via KeyBERT; sumarização LLM por vídeo ("Aprofundar base") (v1.0.23)
- Fix de peso morto no BM25: tags multi-palavra do YouTube ("renda fixa") agora entram palavra a palavra no corpus (v1.0.33)

**Chat**
- Menção `@arquivo` (fixa um arquivo do projeto) e `@@busca` (busca BM25 inline com highlight) — mesma pipeline BM25+CrossEncoder do Repositório, inline no chat (v1.0.27)
- `@@` injeta o trecho selecionado diretamente no LLM como contexto fixo, sem re-passar pelo BM25 (`trechos_fixados`) (v1.0.30)
- `+ Arquivo` no Repositório vira chip de contexto fixado no chat, mesmo comportamento do `@` (v1.0.28)
- Feedback de resposta (👍/👎) — resposta útil salva no corpus BM25 como conhecimento para perguntas futuras similares (RLHF local, não treino de modelo)
- Markdown rendering nas respostas; fix de fila de chat (identidade por `streamId`, não por posição) (v1.0.26–27)

**Google Drive**
- OAuth publicado em produção — funciona para qualquer conta, não só as autorizadas no Google Cloud Console (P3 concluído)
- Funil D1 de analytics (`drive_auth_iniciada`, `drive_auth_concluida`, `drive_desconectado`) para medir uso real antes de decidir reposicionamento (v1.0.32)
- Fix: estado `sem_credenciais` deixou de ser falha silenciosa (v1.0.32)

**Infraestrutura e estabilidade**
- Aba Monitor (métricas via `psutil`) — hotfix crítico após ausência do pacote no python_env empacotado (v1.0.33)
- Export XLSX (`openpyxl`) — mesmo tipo de hotfix (v1.0.33)
- Hotfix crítico `sandbox: false` no preload Electron — corrige `window.tusab` undefined no app instalado (v1.0.31)
- Ampliação da lista de modelos Ollama sugeridos de 8 para 12 (v1.0.32)
- Botão "Verificar atualização" manual na aba Admin, com download automático + banner de instalação (v1.0.34)

**Design System**
- Documentação oficial de tokens (`Documentação do Produto/Design System — Tusab.md`) — cor, tipografia, espaçamento, componentes, motion e a11y, todos medidos por grep no código real
- Inventário completo de moléculas e organismos (`Design System — Inventário de Componentes.md`)
- Agente guardião `/design-system` — impede divergência entre documentação e código, exige medição real antes de token novo
- 5 dívidas de consistência mapeadas e resolvidas (StatCard, ConsentModal, z-index inline, help.html, sombras ad-hoc)

---

## Próximos passos técnicos prioritários

### ~~P0 — RAG: re-rankeamento com CrossEncoder~~ ✅ IMPLEMENTADO (junho 2026)

- `sentence-transformers==5.6.0` adicionado ao `requirements.txt`
- Modelo `ms-marco-MiniLM-L-6-v2` (~80MB, CPU) carregado em lazy load na primeira chamada
- Ativado apenas com Busca Ampla — BM25 puro na Busca Restrita (sem overhead)
- Latência medida: +236ms de retrieval (modelo já em memória); carga inicial ~29s (download único, primeira sessão)
- Degradação graciosa: se `sentence-transformers` não estiver disponível, BM25 puro continua funcionando
- Chunking de documentos também corrigido: overlap de 200 chars entre janelas de 2.000 chars

### ~~P0-beta — Estabilidade crítica~~ ✅ IMPLEMENTADO (v1.0.8-beta)

- **Fila persistente em disco** — `AppState.salvar_fila()` / `restaurar_fila()`; write atômico; restaurado no startup
- **Race condition no chat corrigida** — `agent_chat_lock` cobre leitura + LLM + escrita do histórico
- **Chunking dinâmico** — PDF/DOCX: (1500, 300); texto/WhatsApp: (500, 100); YouTube: chunk natural
- **Toast de carregamento do CrossEncoder** — `cross_encoder_loading` em `/agent/status`; informativo na primeira Busca Ampla
- **API de eventos estruturados** — `dispatch_event()` no `AppState`; base para migrar LogRedirector
- **`google-generativeai` removido** — SDK legado eliminado do `requirements.txt`

---

### P0-c — Calibragem dinâmica de RAG por corpus (Perfil Especialista)

**O problema:** os parâmetros de RAG são constantes hardcoded (`SCORE_MINIMO`, `CHUNK_SIZE`, `n_docs`, uso de CrossEncoder). O perfil Especialista frequentemente precisa que o usuário ajuste manualmente as configurações dependendo do corpus — base densa de WhatsApp exige limiar menor; corpus técnico pequeno exige limiar maior.

**A proposta:** ao indexar (ou na primeira query de um canal), o backend analisa o corpus e persiste `corpus_profile.json` no diretório do projeto com parâmetros calibrados automaticamente.

```python
# Exemplo de corpus_profile.json
{
  "canal_prefixo": "meu_projeto",
  "calibrado_em": "2026-06-26T10:00:00",
  "n_chunks_total": 12400,
  "tipo_dominante": "texts",       # youtube | documents | texts
  "densidade_media_tokens": 180,
  "score_minimo": 0.15,
  "chunk_size": 1200,
  "overlap": 250,
  "usar_crossencoder": true,
  "n_candidatos_bm25": 15,
  "n_docs_prompt": 6
}
```

**Lógica de calibragem (`_calibrar_corpus(prefixo)` em `index.py`):**

| Sinal do corpus | Ação |
|---|---|
| `n_chunks > 5000` | `score_minimo = 0.15`; `usar_crossencoder = True` |
| `tipo_dominante == 'texts'` | `chunk_size = 1200`, `overlap = 250` (conversacional) |
| `tipo_dominante == 'documents'` | `chunk_size = 1500`, `overlap = 300` (técnico) |
| `tipo_dominante == 'youtube'` | chunk natural por vídeo — sem chunking extra |
| `densidade_media_tokens < 50` | corpus de mensagens curtas → `n_candidatos_bm25 = 20` |

**Integração com `_recuperar_contexto()` em `chat.py`:** lê `corpus_profile.json` do projeto ativo antes de aplicar os parâmetros de busca. Fallback para constantes hardcoded se o arquivo não existir (backward-compatible).

**UX:** no Repositório, card "Perfil do corpus" mostra os parâmetros calibrados automaticamente. Botão "Recalibrar" força nova análise após adicionar muitos documentos.

**Quem se beneficia:** Especialista (qualquer corpus), Pesquisador (bases acadêmicas heterogêneas).

**Custo estimado:** 2 dias. Sem nova dependência.

---

### P0-d — Modo Estudo: Quiz Adaptativo com SM-2

**O que é:** após gerar flashcards, o usuário pode entrar em modo quiz. Cada card é marcado como "fácil", "médio" ou "difícil". O algoritmo SM-2 (SuperMemo 2) calcula o próximo intervalo de revisão para cada card — cartões difíceis aparecem mais cedo, cartões fáceis somem por mais tempo.

**Por que é valioso:** hoje o Modo Estudo gera flashcards e o usuário os revisa sem progressão. O quiz adaptativo transforma a ferramenta em sistema de repetição espaçada (SRS) — o mesmo modelo do Anki. Diferencial claro vs. qualquer concorrente que gera flashcards mas não gerencia revisão.

**Dados persistidos por card em `management/srs_state.json`:**

```json
{
  "card_id": "sha256-hash-da-pergunta",
  "intervalo_dias": 4,
  "facilidade": 2.5,
  "proxima_revisao": "2026-07-01",
  "historico": ["facil", "medio", "facil"]
}
```

**Algoritmo SM-2 (Python, sem dependência):**
```python
def sm2(facilidade, intervalo, qualidade):  # qualidade: 0-5
    if qualidade >= 3:
        if intervalo == 0: intervalo = 1
        elif intervalo == 1: intervalo = 6
        else: intervalo = round(intervalo * facilidade)
        facilidade = max(1.3, facilidade + 0.1 - (5 - qualidade) * 0.08)
    else:
        intervalo = 1
    return facilidade, intervalo
```

**UX:** após o flip do card, três botões: `← Difícil` / `OK` / `Fácil →`. Barra de progresso mostra cards revisados vs. pendentes. Badge "X cards para revisar hoje" na aba Funcionalidades.

**Exportação Anki:** o CSV existente (`/export/flashcards/{canal}`) já é compatível com Anki. O estado SRS do Tusab é independente — dois sistemas de revisão paralelos para quem preferir.

**Custo estimado:** 3-4 dias. Sem nova dependência (SM-2 é pure Python).

---

### P0-e — Modo Estudo: Mapa de Conceitos e Índice de Tópicos

**Mapa de conceitos:** prompt LLM extrai entidades e relações do corpus → gera grafo `{ nodes: [...], edges: [...] }` → renderizado com `react-force-graph` ou D3 force-directed. Identifica clusters de tópicos e pontes conceituais.

**Índice de tópicos:** BM25 agrupa chunks por TF-IDF → gera lista de tópicos com frequência e exemplos de fontes. Sem LLM — puro BM25 + clustering de keywords. Útil para entender o que está e o que não está na base.

**Anotações ancoradas:** ao revelar a resposta de um flashcard, botão "Anotar" abre textarea vinculada ao `card_id`. Anotações salvas em `management/anotacoes.json`. Injetáveis no corpus BM25 como um bloco `ANOTACAO` — o próprio usuário enriquece a base com suas reflexões.

**Custo estimado:** mapa de conceitos (5 dias — depende de lib de grafo); índice de tópicos (2 dias); anotações ancoradas (1 dia).

---

### P1 — RAG: embedding local opcional (quando Ollama disponível)

**O que é:** quando o usuário tem Ollama configurado e `nomic-embed-text` instalado, usar busca vetorial como complemento ao BM25 (RAG híbrido). Quando não disponível, BM25 puro — degradação graciosa.

**Por que depois do CrossEncoder:** mais complexo. Exige detecção de disponibilidade do modelo de embedding, fallback gracioso, e fusão de scores BM25 + vetorial. O CrossEncoder é mais direto.

**Quem mais se beneficia:** Pesquisador (corpora acadêmicos com vocabulário especializado onde sinônimos são problema real).

**Impacto competitivo:** fecha o gap de qualidade de RAG vs. NotebookLM (Gemini + contexto longo). Não iguala, mas reduz a distância perceptível para o usuário.

---

### P1-b — Citações navegáveis no chat

**O que é:** tornar cada citação de fonte no chat clicável — abre um painel lateral com o trecho exato de onde a resposta veio, dentro do documento ou vídeo original.

**Por que é P1:** o NotebookLM faz isso e é o momento de maior confiança no produto. Hoje o Tusab cita mas não permite verificação em dois cliques — gap de UX crítico vs. o principal concorrente.

**Implementação:** `_recuperar_contexto()` já retorna offset de chunk; adicionar `chunk_id` na resposta do chat → frontend abre modal com trecho original ao clicar na citação.

---

### P2 — Scheduler de periodicidade (auto-update de canais)

**O que é:** atualização automática de canais configurável pelo usuário. A cada N dias, o Tusab verifica novos vídeos e extrai automaticamente.

**Impacto:** transforma o uso de "ação pontual" para "base sempre atualizada". Especialmente relevante para o perfil Professor (canal que posta aulas periodicamente) e Pesquisador (feeds de publicações técnicas).

**Pré-requisito técnico:**
- Persistir agenda por canal em `agent_config.json` (`{ canal, frequencia_dias, fontes, proxima_execucao }`)
- Loop de verificação no startup do Electron — compara `proxima_execucao` com `Date.now()`; se vencido, enfileira extração incremental
- Notificação nativa ao concluir extração agendada (infra de notificações já disponível em v1.0.10)

**UX planejada:** toggle por canal no accordion do Repositório com seletor de frequência (diário / semanal / quinzenal / mensal). Ao ativar, o Tusab agenda silenciosamente a próxima verificação.

**Nota:** a notificação de conclusão de extração agendada já está preparada — a infra de Web Notification + Electron Notification foi implementada na v1.0.10. O P2 é puramente o scheduler e a UI de configuração.

---

### P2-b — Digest Semanal (síntese periódica por projeto)

**O que é:** job agendado (APScheduler, disponível no Python) que roda BM25 + LLM local sobre o que foi adicionado na semana e gera um resumo estruturado por projeto. Entregue como notificação desktop (infra já disponível em v1.0.10) e acessível no histórico.

**Por que é importante:** cria hábito de retorno ao app — barreira comportamental de entrada para concorrentes. Nenhum concorrente direto (AnythingLLM, GPT4All) tem isso.

**Custo de implementação:** baixo — APScheduler + prompt de síntese + notificação já existente.

---

### ~~P3 — Publicar OAuth do Google Drive em produção~~ ✅ IMPLEMENTADO (julho 2026)

**Contexto:** estava em modo "Testing" — só funcionava para contas autorizadas no Google Cloud Console. Publicado em produção; funciona para qualquer conta Google. Ver funil D1 de analytics (`drive_auth_iniciada`/`drive_auth_concluida`/`drive_desconectado`) adicionado em v1.0.32 para medir uso real.

---

### P4 — Landing page mínima (tusab.solutions)

**O que é:** proposta de valor, seção de perfis, demo em vídeo (30s), botão de download.

**Copy base disponível:** seção "Copy para site" em `Visão Geral do Produto.md`.

**Por que é P4:** sem landing page, não há pipeline de aquisição para usuários que não conhecem o autor diretamente. É pré-requisito para qualquer esforço de marketing.

---

### P5 — Sistema de licença

**Contexto:** a infraestrutura de feature flags já existe. O modelo correto é: case documentado → landing page → sistema de licença → venda. Não o inverso.

**Pré-requisito:** Lemon Squeezy + hardware fingerprint + proteção do código Python (Nuitka ou PyArmor).

---

## Análise competitiva — Junho 2026

### Posicionamento confirmado

O Tusab é um **motor de ingestão + RAG privado de fontes externas estruturadas** — mais preciso que "PKM clássico" (que pressupõe captura de notas pessoais, grafos, backlinks). O diferencial é: você traz suas fontes (YouTube em escala, PDFs, reuniões, WhatsApp), o Tusab indexa, e você conversa com esse corpus localmente.

O posicionamento defensável: **privacidade local com captura rica de múltiplas fontes**. Nenhum concorrente ocupa esse espaço com UX não-técnica.

### Mapa de ameaças

| Concorrente | Ameaça principal | Probabilidade | Horizonte |
|---|---|---|---|
| NotebookLM | Adicionar extração de canal completo (Google tem acesso privilegiado à API YouTube) | Alta | 12–18 meses |
| AnythingLLM | Adicionar extração YouTube nativa | Média | 6–12 meses |
| Obsidian | Lançar ingestão YouTube nativa | Baixa | 18+ meses |

### Janela estratégica

O Tusab tem **12–18 meses** para tornar a extração em escala apenas o ponto de entrada — o valor real deve migrar para o grafo de conhecimento e o servidor MCP, onde Google e OpenAI não têm vantagem estrutural sobre dados locais.

### Diferenciais a fortalecer (não facilmente copiáveis)

1. **Fluxo professor→aluno via `.tusab`** — sem equivalente no mercado. Aposta de viralidade orgânica em contexto educacional.
2. **Servidor MCP** — transforma o Tusab em fonte de contexto para Claude Code, Cursor, Continue.dev. AnythingLLM não tem MCP nativo. NotebookLM não tem API pública.
3. **CPU-only + offline + UX não-técnica** — combinação que AnythingLLM e GPT4All não entregam juntos.

### Gaps a fechar

1. **Citações navegáveis** — NotebookLM permite clicar na citação e ver o trecho original. O Tusab cita mas não navega. Gap de confiança crítico.
2. **Fricção do Ollama no onboarding** — usuário não-técnico pode abandonar antes do primeiro "aha moment". Mitigação: Groq como padrão inicial (sem instalação).
3. **Visibilidade da base** — o usuário não vê o que foi indexado, não percebe o crescimento. Obsidian tem graph view. O Tusab não tem nenhuma representação visual da base.

---

## Sprint 5 — LanceDB: indexação incremental (plano técnico)

> **Por que LanceDB?** O gargalo atual não é velocidade de query (< 1ms) — é que `indexar()` reconstrói o índice inteiro do zero a cada chamada. Com 500 vídeos, isso leva 3–5s e bloqueia o uso do agente. LanceDB resolve com append nativo: só novos chunks são gravados. Além disso, substitui `rank_bm25` **e** o ChromaDB planejado de uma vez, eliminando uma dependência futura.

### Motivação

| Cenário | Hoje (rank_bm25) | Com LanceDB |
|---------|-----------------|-------------|
| Adicionar 10 vídeos novos ao projeto com 500 | Reindexar tudo (~3–5s) | Append de 10 chunks (< 100ms) |
| 2 usuários indexando o mesmo projeto | Race condition potencial no JSON | Transações ACID nativas |
| Quero ver meus chunks por data/canal | Carrego JSON inteiro na memória | Query SQL-like via Arrow |
| Quero busca vetorial no futuro | Nova dependência (ChromaDB) | Já está no LanceDB |

### Plano técnico

#### Fase 1 — Infraestrutura base (2 dias)

**1.1 Instalação**
```
pip install lancedb pyarrow
```

**1.2 Novo schema de tabela LanceDB**

Cada chunk vira uma linha Arrow com colunas tipadas:

```python
SCHEMA_CHUNKS = pa.schema([
    pa.field("canal_prefixo",    pa.string()),
    pa.field("canal_nome",       pa.string()),
    pa.field("arquivo",          pa.string()),
    pa.field("texto",            pa.string()),
    pa.field("titulo",           pa.string()),
    pa.field("aba",              pa.string()),      # youtube | documents | texts
    pa.field("data",             pa.string()),      # DD/MM/AAAA
    pa.field("link",             pa.string()),
    pa.field("tags",             pa.list_(pa.string())),
    pa.field("descricao",        pa.string()),
    pa.field("video_id",         pa.string()),
    pa.field("views",            pa.int64()),
    pa.field("timestamp_inicio", pa.int64()),
    pa.field("indexed_at",       pa.int64()),       # Unix timestamp da indexação
    pa.field("texto_enriquecido", pa.string()),     # tokens BM25 pré-calculados (join de _enriquecer_documento)
])
```

**1.3 Path do banco**

```python
# storage.py
LANCEDB_DIR = os.path.join(DATA_DIR, "lancedb")
```

**1.4 `index.py` — função `indexar()` com LanceDB**

```python
def indexar(canal_nome, canal_prefixo, callback=None, stop_event=None):
    import lancedb, pyarrow as pa

    chunks = _parsear_todos_chunks(canal_prefixo)
    if not chunks:
        raise ValueError(...)

    db    = lancedb.connect(LANCEDB_DIR)
    table_name = f"tusab_{canal_prefixo}"

    # Prepara registros Arrow
    registros = [{
        **c,
        "canal_prefixo":    canal_prefixo,
        "canal_nome":       canal_nome,
        "indexed_at":       int(time.time()),
        "texto_enriquecido": " ".join(_enriquecer_documento(c["texto"], c.get("tags", []), c.get("descricao", ""))),
        "tags":              c.get("tags", []),
    } for c in chunks]

    # Cria ou substitui tabela (overwrite completo — modo simples)
    if table_name in db.table_names():
        db.drop_table(table_name)
    db.create_table(table_name, data=registros, schema=SCHEMA_CHUNKS)

    callback(f"✅ {len(chunks)} chunks indexados no LanceDB.")
    _invalidar_cache(canal_prefixo)
    return len(chunks)
```

**Fase 2 — Indexação incremental (1 dia)**

Após a Fase 1 funcionar, ativar append:

```python
# Detecta arquivos novos desde a última indexação
def _arquivos_novos_desde(canal_prefixo, last_indexed_at):
    """Retorna lista de paths com mtime > last_indexed_at."""
    ...

# indexar() com modo incremental
def indexar(..., incremental=False):
    if incremental and table_name in db.table_names():
        tbl = db.open_table(table_name)
        last_ts = tbl.to_arrow()["indexed_at"].to_pylist()
        last_ts = max(last_ts) if last_ts else 0
        novos = _arquivos_novos_desde(canal_prefixo, last_ts)
        if not novos:
            callback("✅ Base já atualizada."); return 0
        # parsear só os arquivos novos, append na tabela
        ...
```

**Fase 3 — Retrieval BM25 via LanceDB (1 dia)**

LanceDB tem BM25 nativo via full-text search:

```python
def _recuperar_contexto(...):
    import lancedb
    db  = lancedb.connect(LANCEDB_DIR)
    tbl = db.open_table(f"tusab_{canal_prefixo}")

    # Busca BM25 nativa
    resultados = tbl.search(pergunta, query_type="fts").limit(n * 2).to_list()
    # → retorna dicts com colunas do schema + score "_score"

    # Pipeline pós-retrieval continua igual:
    # filtro SCORE_MINIMO → date-aware → views boost → CrossEncoder
    ...
```

**Checklist de migração (Fase 1→3)**

- [ ] `storage.py`: adicionar `LANCEDB_DIR`
- [ ] `index.py`: substituir `salvar_json_atomico` por `lancedb.create_table`; manter `_index_path()` como fallback de leitura para índices legados
- [ ] `chat.py`: substituir `rank_bm25.BM25Okapi` + `get_scores()` por `tbl.search(..., query_type="fts")`
- [ ] `_bm25_cache`: simplificar — LanceDB é persistido em disco, cache em memória vira apenas referência à tabela aberta
- [ ] Testes: adaptar `test_confiabilidade.py` para LanceDB (índice corrompido = tabela ausente)
- [ ] Migração de índices legados: se `_index_{canal}.json` existe mas tabela LanceDB não, reconstruir automaticamente no startup

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| API do LanceDB muda (biblioteca jovem) | Pinnar versão no `requirements.txt` |
| Tabela LanceDB corrompida | Mesmo tratamento atual: se `db.open_table()` falhar, deletar e pedir reindexação |
| Full-text search do LanceDB com qualidade diferente do BM25Okapi | A/B test interno: rodar ambos por uma versão, comparar top-3 |
| Arquivo legado `_index.json` sem tabela LanceDB | `_recuperar_contexto()` detecta ausência e lança erro orientado: "Reindexe para migrar para o novo formato" |

### Estimativa

- Fase 1 (infra + overwrite): ~2 dias
- Fase 2 (incremental): ~1 dia  
- Fase 3 (BM25 nativo): ~1 dia
- Testes + ajustes: ~1 dia
- **Total: ~5 dias de trabalho** — Sprint 5 dedicado

---

## Candidatos a features futuras

### RAG: Embeddings via Ollama + LanceDB (pós-Sprint 5)

**O que é:** RAG Híbrido — após o Sprint 5 (LanceDB), adicionar busca vetorial como complemento ao BM25. `nomic-embed-text` (Ollama) gera embeddings; LanceDB armazena vetores na mesma tabela dos chunks (sem ChromaDB separado). Fusão de scores BM25 + vetorial antes de montar o prompt.

**Por que depois do LanceDB:** o LanceDB já tem suporte a vetores nativamente — a mesma tabela que guarda os chunks BM25 pode guardar o vetor de embedding de cada chunk. Elimina a necessidade de ChromaDB como dependência separada.

**Por que não agora:** aguardando feedback dos usuários com o CrossEncoder já implementado. Decisão tomada em junho 2026.

**Condição obrigatória:** só ativar quando o provedor for Ollama. Para Groq/OpenAI (resposta ~1s), o retrieval estimado de 700–1.100ms seria mais lento que o próprio LLM — destruiria a UX.

**Latência estimada do RAG híbrido completo:**
- Embeddings via `nomic-embed-text` CPU: +400–800ms
- LanceDB ANN lookup: +10–30ms (muito mais rápido que ChromaDB)
- Fusão BM25 + vetorial: +10ms
- **Total: ~450–850ms de retrieval** — aceitável para Ollama (LLM ~10s), inaceitável para provedores rápidos

**Três pontos a decidir antes de codar:**
1. Detectar `nomic-embed-text` disponível via `GET /api/tags` do Ollama antes de indexar — sem travar o chat se ausente
2. Adicionar coluna `vector` ao schema LanceDB no Sprint 5 (campo opcional, nulo quando sem embedding)
3. Comunicar lentidão da primeira indexação com embedding via toast com estimativa baseada no número de chunks

---

### RAG: Grafo de entidades leve (GraphRAG sem Neo4j)

**O que é:** após embeddings + ChromaDB, extrair entidades (pessoa, conceito, data, projeto) com spaCy ou LLM local e construir um grafo SQLite com relações. Viável em Python puro, sem Neo4j.

**Diferencial competitivo:** permite responder "qual a evolução do pensamento deste autor sobre X ao longo de 3 anos de vídeos" — nenhum concorrente local faz isso.

**Por que não agora:** depende de embeddings implementados primeiro. Corpus atual (transcrições YouTube + PDFs avulsos) tem densidade relacional baixa para a maioria dos usuários. Reavaliação quando dados de uso mostrarem padrão de corpus denso nos perfis Pesquisador e Especialista.

**Por que SQLite e não Neo4j:** complexidade incompatível com o princípio local-first sem dependências pesadas.

---

### Servidor MCP

Expõe a base RAG do Tusab como ferramenta para agentes externos. O usuário conecta o Tusab ao Claude Code, Cursor ou qualquer agente compatível com MCP. A base de conhecimento vira uma "ferramenta de busca" para qualquer agente. Alto potencial para o perfil Especialista e usuários técnicos.

**Impacto competitivo por perfil:**
- Profissional técnico: base de canais de programação disponível diretamente no Cursor durante o código
- Pesquisador: base de papers e transcrições acessível no Claude Projects sem subir dados para a nuvem
- Criador de conteúdo: roteiros gerados com contexto da própria base local, sem vazar ideias para servidores externos

AnythingLLM não tem MCP server nativo. NotebookLM não tem API pública. Esta é a maior janela de diferenciação no médio prazo.

---

### Modo institucional (servidor interno)

Deploy do backend em servidor local da instituição com autenticação de usuários. Múltiplos usuários consultando a mesma base. Requer separação de sessões e histórico por usuário. Candidato natural para contratos enterprise com instituições de ensino.

---

### Scheduler com sync automático para Drive

Combinação do Scheduler (P2) com a integração Google Drive existente: ao concluir extração incremental, faz upload automático para Drive configurado. Relevante para o perfil Professor que mantém base compartilhada.

---

### Extração multimodal local (vídeo → frame + áudio)

**O que é:** yt-dlp já baixa o vídeo; Whisper.cpp local transcreve com timestamps; CLIP ou LLaVA (Ollama) analisa frames-chave. O resultado: chunks com contexto visual + temporal, indexados junto ao texto.

**Diferencial:** NotebookLM ignora frames de vídeo — processa apenas a transcrição. O Tusab passaria a indexar conceito visual + fala + timestamp simultaneamente.

**Pré-requisito:** Ollama com modelo multimodal (llava ou gemma3 12B) instalado pelo usuário. Degradação graciosa: sem modelo multimodal, comportamento atual (transcrição apenas).

---

### Fontes além do YouTube

Podcasts via RSS, páginas web via URL, repositórios de código. Cada fonte exige um extrator próprio — escopo considerável. Prioridade por perfil: Pesquisador (feeds acadêmicos) e Especialista (RSS de publicações setoriais).

---

### Busca web integrada no chat

Integração com Brave Search API (2.000 buscas/mês gratuitas). A base como referência primária + snippets da web como complemento. Relevante para Pesquisador (busca ampla + web) e Especialista.

---

## Débitos e pendências operacionais

Itens implementáveis sem decisão de produto — entram no próximo sprint disponível.

| # | Item | Tipo | Nota |
|---|---|---|---|
| C7 | **LogRedirector event-driven** — migrar `extraction.py` para `dispatch_event()` | técnico | Elimina acoplamento frágil de emojis/strings no LogRedirector |
| P1-perf | **Cache em `get_agent_status()`** — hoje faz full scan de índices a cada poll de 2s; com 30 projetos = 30 leituras de disco por chamada | técnico | Adicionar TTL de 30s sobre o resultado |
| P1-front | **Code splitting no Vite** — bundle único de 1 MB+ carrega tudo; tabs pesadas (Repositório, Admin) devem carregar sob demanda | técnico | `build.rolldownOptions.output.codeSplitting` |
| M2 | **Sistema de licença (Lemon Squeezy)** — tela de ativação no Electron, validação HTTP, hardware fingerprint | produto | Pré-requisito: ter tração antes de implementar |
| M3 | **Proteção do código Python** — compilar com Nuitka ou PyArmor antes da versão paga | produto | Só faz sentido junto com M2 |
| T3 | **Funil de ativação no PostHog** — configurar dashboard: install → extração → indexação → 1ª pergunta → 1ª resposta com fonte | produto | Dados existem, falta dashboard legível |
| T4 | **Evento de abandono de canal** — usuário configura canal mas nunca inicia extração | produto | Indica fricção no fluxo |
| D1 | **Landing page mínima** — proposta de valor, demo 30s, botão de download | estratégico | Sem isso não há funil de aquisição |
| D4 | **Case público da AUVP** — documentar com autorização; único social proof existente | estratégico | Pré-requisito para demos B2B |
| E3 | **Política de portabilidade de dados** — "seus dados ficam em X, você exporta fazendo Y, deleta fazendo Z" | produto | Para contratos B2B enterprise |

---

## Descartado e por quê

**Freemium com paywall ativo**
Descartado em junho 2026. O produto serve como vitrine técnica — um paywall na fase atual gera atrito no momento errado. A infraestrutura foi construída mas não ativada. Ver `Decisões de Produto.md`.

**Exportar base como "Exportar para Drive" (feature separada)**
Descartado. A pasta `data/neural/` já é local e o Drive sync já cobre o compartilhamento. O export `.tusab` cobre portabilidade e o fluxo professor→aluno sem duplicar a feature.

**Suporte a imagens via OCR (Tesseract) como feature principal**
Mantido como dependência opcional, não como feature de destaque. O caso de uso principal é melhor coberto por Gemma 4 12B via Ollama.

**Histórico de chat persistido em disco por padrão**
O histórico atual é em memória (perdido ao fechar o app) para evitar crescimento irrestrito. Persistência exige política de retenção, interface de gerenciamento e espaço adicional — complexidade sem demanda clara.
