# Roadmap — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

## Estado atual — v1.0.0 (junho 2026)

### Feito e funcionando

**Extração**
- Extração de canais YouTube via yt-dlp (legendas PT, incremental)
- Fila sequencial de extração (N canais enfileirados, processados um a um)
- Filtro de fontes por tipo (Vídeos, Shorts, Ao Vivo, Podcasts, Cursos, Playlists)
- Cancelamento limpa a fila; erro num canal não interrompe os seguintes
- Relatório de cobertura por canal: tabela de vídeos, filtros por tipo/status/aba, busca por título, colunas Views e Aba

**Repositório**
- Upload de PDF, DOCX, XLSX, CSV, Markdown, TXT, imagens, áudio
- Drag and drop sobre a área de upload
- Parser automático de WhatsApp (Android/iOS) e transcrições (Zoom/Otter/Teams)
- Busca full-text no repositório com injeção de trecho no chat
- Manifesto `_manifest.json` por subdiretório (escrita atômica)

**Agente RAG**
- Indexação BM25 com cache em memória por projeto
- Enriquecimento: tags YouTube (3×) + keywords TF-IDF (2×) + descrições
- Query expansion (LLM gera variações da pergunta) — Groq, OpenAI, Anthropic, Gemini; desabilitado para Ollama
- Multi-canal: busca simultânea em múltiplos índices com merge
- Anti-alucinação: threshold BM25 + verificação pós-geração por keyword overlap
- Recovery de índice corrompido: detecção automática + toast com botão Reindexar

**Chat**
- Streaming via ReadableStream, cursor piscante
- Histórico server-side — últimas 6 trocas por canal
- Busca Restrita e Busca Ampla (toggle no chat)
- Persona / tom do agente: Padrão, Objetivo, Técnico, Didático, Descontraído, Socrático
- Perguntas sugeridas pós-indexação (chips clicáveis)
- Renderização Markdown nas respostas (negrito, listas, tabelas, código)
- Chat expandido em overlay sobre as abas
- Histórico de conversa acessível via sidebar

**Provedores LLM**
- Ollama (llama3.2:1b padrão, qualquer modelo instalado configurável)
- Groq (llama-3.1-8b-instant, llama-3.1-70b-versatile)
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
- Smoke tests: 15/15 verde (pre-commit hook)
- Segurança: 12 fixes aplicados (CORS, path traversal, prompt injection, CORS, upload size, etc.)
- Chaves de API criptografadas via `safeStorage` do Electron (Windows DPAPI)
- Watchdog do backend no Electron (poll de 5s, IPC backend-dead/alive, banner vermelho com botão Reiniciar)
- Telemetria PostHog opt-in com retenção Day 7 / Day 30
- i18n PT/EN/ES (216 chaves, 100% consistentes)
- Empacotamento Windows: Python embeddable + yt-dlp bundled + instalador NSIS

**Google Drive**
- OAuth2 com escopo `drive.file` (mínimo)
- Upload de transcrições como Google Docs
- Desconexão via UI (sem revogar OAuth no Google)

---

## Próximos passos técnicos prioritários

### P1 — Implementáveis sem decisão de produto

**Scheduler de periodicidade (sub-aba no modal de extração)**
Permitir que o usuário configure atualização automática de canais: a cada N dias, o Tusab verifica novos vídeos e extrai automaticamente. Impacto: transforma o uso de "ação pontual" para "base sempre atualizada". Pré-requisito: persistir agenda em `agent_config.json` e implementar loop no startup do Electron.

**Refatoração de App.jsx**
Migrar estado global do orquestrador (~40 estados, ~1.590 linhas) para Context API ou Zustand. Não tem impacto visível para o usuário, mas é o débito técnico com maior risco de crescimento. Gatilho: quando a adição de uma nova feature exigir mais de 1h para entender o fluxo de estado existente.

**Proteção do código Python (pré-lançamento comercial)**
Compilar o backend com Nuitka ou PyArmor antes de distribuir versão com cobrança. Sem isso, o código Python fica acessível no diretório de instalação. Só faz sentido implementar quando o sistema de licença estiver ativo.

**Mensagem específica "Ollama offline" no chat**
Quando o Ollama trava silenciosamente, o chat exibe erro genérico "Erro ao conectar com servidor". Detectar especificamente o status do Ollama no payload de erro e exibir mensagem orientada com link para verificação.

**Analytics.chatPergunta() ativo**
O método existe em `analytics.js` mas nunca é invocado. Sem ele, Time to First Value Answer não está sendo medido — a principal métrica de ativação está cega.

### P2 — Dependem de decisão de produto

**Sistema de licença (Lemon Squeezy)**
Tela de ativação no Electron, validação HTTP, hardware fingerprint. Pré-requisito: decisão de quando e como cobrar. A infraestrutura de feature flags já existe (`PRO_LIMIT:` no backend, ProSnackbar no frontend) — é questão de ativar o `config.get('pro', False)`.

**Publicar OAuth do Google Drive em produção**
Atualmente em modo "Testing" — só funciona para contas autorizadas no Google Cloud Console. Para distribuição pública, precisa passar por revisão do Google (exige URL pública da política de privacidade). A política já existe como `.md` — falta publicar em URL.

**Landing page mínima**
Proposta de valor, demo em vídeo (30s), botão de download. Sem essa página, não há pipeline de aquisição para usuários que não conhecem o autor diretamente.

**Funil de ativação no PostHog**
Os eventos existem e estão ativos. Falta configurar o funil no dashboard: install → primeira extração → indexação → primeira pergunta → primeira resposta com fonte. Sem isso, os dados existem mas não são legíveis.

---

## Candidatos a features futuras

**Servidor MCP**
Expõe a base RAG do Tusab como ferramenta para agentes externos. O usuário conecta o Tusab ao Claude Code, Cursor ou qualquer agente compatível com MCP. A base de conhecimento vira uma "ferramenta de busca" para qualquer agente. Alto potencial para o público técnico.

**Modo institucional (servidor interno)**
Deploy do backend em servidor local da instituição com autenticação de usuários. Múltiplos usuários consultando a mesma base. Requer separação de sessões e histórico por usuário. Candidato natural para contratos enterprise.

**Entrada por voz no chat**
Usuário pergunta ao mentor por voz, sem digitar. Requer integração com Web Speech API ou Whisper local. Caso de uso: perguntas rápidas enquanto trabalha.

**Modo "full context" para bases pequenas**
Com modelos de 256K tokens de contexto (Gemma 4 12B via Ollama), bases com menos de 50 arquivos podem caber inteiras no prompt — sem necessidade de seleção BM25. O BM25 continua essencial para bases grandes (100+ vídeos extraídos).

**Fontes além do YouTube**
Podcasts via RSS, páginas web via URL, repositórios de código. Cada fonte exige um extrator próprio — escopo considerável.

**Busca web integrada no chat**
Integração com Brave Search API (2.000 buscas/mês gratuitas). A base como referência primária + snippets da web como complemento. Requer campo para API key nas configurações do agente.

**API pública para integrações**
Expor a base RAG como API REST autenticada para integrações externas. Pré-requisito: modo servidor + autenticação.

---

## Descartado e por quê

**Freemium com paywall ativo**
Descartado em junho 2026. O produto serve como vitrine técnica — um paywall na fase atual gera atrito no momento errado. A infraestrutura foi construída mas não ativada. Ver `Decisões de Produto.md`.

**Exportar base como "Exportar para Drive"**
Descartado como feature separada. A pasta `data/neural/` já é local (acesso direto pelo explorador de arquivos) e o Drive sync já cobre o compartilhamento. O export ZIP (`/export/base`) cobre o caso de backup/portabilidade sem duplicar o Drive.

**Suporte a imagens via OCR (Tesseract) como feature principal**
Mantido como dependência opcional (pytesseract), não como feature de destaque. O caso de uso principal (fotos de slides, capturas de tela) é melhor coberto por Gemma 4 12B via Ollama — sem pipeline separado. OCR fica como fallback para quem não tem GPU.

**Whisper como feature principal para áudio**
Mantido via faster-whisper como dependência opcional. Para o roadmap, Gemma 4 12B tem ASR nativo — pode simplificar ou eliminar essa dependência. Aguardar maturação do ecossistema antes de investir mais.

**Export para formatos adicionais (ePub, HTML)**
Sem demanda identificada. Os formatos existentes (ZIP, MD, DOCX, XLSX, PDF) cobrem os casos de uso documentados.

**Histórico de chat persistido em disco por padrão**
O histórico atual é em memória (perdido ao fechar o app) para evitar crescimento irrestrito de dados. Persistência em disco exige política de retenção, interface de gerenciamento e espaço adicional — complexidade sem demanda clara.
