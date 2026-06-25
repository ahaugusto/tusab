# Roadmap — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

> Para o histórico completo do produto — de script pessoal (fev/2025) até a v1.0 — veja [`Evolução do Produto — De Raspador a Plataforma de IA.md`](Evolução%20do%20Produto%20—%20De%20Raspador%20a%20Plataforma%20de%20IA.md).

---

## Estado atual — v1.0.8-beta (junho 2026)

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
- Fila de extração persistente em disco — crash não perde jobs pendentes (v1.0.8-beta)
- Race condition no histórico de chat corrigida — leitura+LLM+escrita atômicas (v1.0.8-beta)
- API de eventos estruturados `dispatch_event()` no AppState (v1.0.8-beta)
- Telemetria PostHog opt-in com retenção Day 7 / Day 30
- i18n PT/EN/ES (Brasil como mercado primário — app abre em português)
- Empacotamento Windows: Python embeddable + yt-dlp bundled + instalador NSIS multilíngue PT/EN/ES com selector de idioma

**Google Drive**
- OAuth2 com escopo `drive.file` (mínimo)
- Upload de transcrições como Google Docs
- Desconexão via UI (sem revogar OAuth no Google)

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

### P1 — RAG: embedding local opcional (quando Ollama disponível)

**O que é:** quando o usuário tem Ollama configurado e `nomic-embed-text` instalado, usar busca vetorial como complemento ao BM25 (RAG híbrido). Quando não disponível, BM25 puro — degradação graciosa.

**Por que depois do CrossEncoder:** mais complexo. Exige detecção de disponibilidade do modelo de embedding, fallback gracioso, e fusão de scores BM25 + vetorial. O CrossEncoder é mais direto.

**Quem mais se beneficia:** Pesquisador (corpora acadêmicos com vocabulário especializado onde sinônimos são problema real).

---

### P2 — Scheduler de periodicidade

**O que é:** atualização automática de canais configurável pelo usuário. A cada N dias, o Tusab verifica novos vídeos e extrai automaticamente.

**Impacto:** transforma o uso de "ação pontual" para "base sempre atualizada". Especialmente relevante para o perfil Professor (canal que posta aulas periodicamente).

**Pré-requisito:** persistir agenda em `agent_config.json` e implementar loop no startup do Electron.

---

### P3 — Publicar OAuth do Google Drive em produção

**Contexto:** atualmente em modo "Testing" — só funciona para contas autorizadas no Google Cloud Console. Para distribuição pública, precisa passar por revisão do Google (exige URL pública da política de privacidade). A política já existe como `.md` — falta publicar em URL.

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

## Candidatos a features futuras

### RAG: Embeddings via Ollama + ChromaDB (próxima versão)

**O que é:** RAG Híbrido — BM25 continua como retriever principal, embeddings vetoriais via `nomic-embed-text` (Ollama) complementam com busca semântica. Fusão de scores BM25 + vetorial antes de montar o prompt.

**Por que não agora:** aguardando feedback dos usuários com o CrossEncoder já implementado. Decisão tomada em junho 2026.

**Condição obrigatória:** só ativar quando o provedor for Ollama. Para Groq/OpenAI (resposta ~1s), o retrieval estimado de 700–1.100ms seria mais lento que o próprio LLM — destruiria a UX.

**Latência estimada do RAG híbrido completo:**
- Embeddings via `nomic-embed-text` CPU: +400–800ms
- ChromaDB lookup: +50–100ms
- Fusão BM25 + vetorial: +10ms
- **Total: ~700–1.100ms de retrieval** — aceitável para Ollama (LLM ~10s), inaceitável para provedores rápidos

**Três pontos a decidir antes de codar:**
1. Detectar `nomic-embed-text` disponível via `GET /api/tags` do Ollama antes de indexar — sem travar o chat se ausente
2. Recriar índice vetorial (ChromaDB) sempre junto com BM25 no `indexar()` — nunca separado, para evitar inconsistência
3. Comunicar lentidão da primeira indexação com toast de aviso e estimativa de tempo baseada no número de chunks

---

### RAG: GraphRAG (fase futura — Pesquisador e Especialista)

**O que é:** construção de grafo de conhecimento entre documentos — entende relações entre conceitos, não só trechos isolados.

**Quando faz sentido:** quando corpora de Pesquisadores e Especialistas atingirem alta densidade relacional (artigos que se citam, documentos normativos com referências cruzadas, bases acadêmicas temáticas densas). O corpus atual do usuário médio (transcrições YouTube + PDFs avulsos) é predominantemente paralelo — baixa densidade relacional.

**Por que não agora:** requer Neo4j ou implementação manual de grafos — complexidade incompatível com o princípio local-first sem dependências pesadas. Reavaliação quando dados de uso mostrarem padrão de corpus denso nos perfis Pesquisador e Especialista.

---

### Servidor MCP

Expõe a base RAG do Tusab como ferramenta para agentes externos. O usuário conecta o Tusab ao Claude Code, Cursor ou qualquer agente compatível com MCP. A base de conhecimento vira uma "ferramenta de busca" para qualquer agente. Alto potencial para o perfil Especialista e usuários técnicos.

---

### Modo institucional (servidor interno)

Deploy do backend em servidor local da instituição com autenticação de usuários. Múltiplos usuários consultando a mesma base. Requer separação de sessões e histórico por usuário. Candidato natural para contratos enterprise com instituições de ensino.

---

### Scheduler com sync automático para Drive

Combinação do Scheduler (P2) com a integração Google Drive existente: ao concluir extração incremental, faz upload automático para Drive configurado. Relevante para o perfil Professor que mantém base compartilhada.

---

### Fontes além do YouTube

Podcasts via RSS, páginas web via URL, repositórios de código. Cada fonte exige um extrator próprio — escopo considerável. Prioridade por perfil: Pesquisador (feeds acadêmicos) e Especialista (RSS de publicações setoriais).

---

### Busca web integrada no chat

Integração com Brave Search API (2.000 buscas/mês gratuitas). A base como referência primária + snippets da web como complemento. Relevante para Pesquisador (busca ampla + web) e Especialista.

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
