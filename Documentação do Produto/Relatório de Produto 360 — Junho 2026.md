# Relatório de Produto 360° — Sebayt

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Data da análise:** 11 de junho de 2026
**Versão analisada:** v0.4.3+ (branch main, commit `8c37ed3`)
**Método:** análise de código completa (backend Python 3.013 linhas + frontend React ~5.300 linhas), documentação estratégica (9 documentos), histórico de auditorias (segurança, LGPD, UX) e verificação direta dos achados.

> **Acompanhamento da execução:** o progresso item a item da matriz P0–P3 é registrado
> em [Execução do Relatório 360.md](Execução%20do%20Relatório%20360.md) — checklist vivo
> com explicação técnica e didática de cada entrega.

---

## 0. Sumário Executivo

O Sebayt está **estrategicamente maduro e tecnicamente funcional, mas operacionalmente frágil**. O produto tem posicionamento raro de se encontrar em estágio early (categoria clara, diferencial defensável, case validado), UX acima da média para um MVP e uma postura de segurança que já passou por duas rodadas de hardening. Os três déficits estruturais são: **confiabilidade** (estado compartilhado sem proteção, persistência sem atomicidade, zero recovery), **qualidade** (zero testes automatizados) e **dados** (telemetria instalada mas 7 de 11 eventos nunca disparam — o produto está voando sem instrumentos).

A conclusão da Avaliação Estratégica de junho/2026 permanece válida e este relatório a reforça: **o gargalo não é técnico, é de go-to-market**. Porém, a análise de código revela que existe um conjunto de correções de confiabilidade de baixo esforço (1–2 dias) que deve ser feito ANTES da primeira distribuição ampla — porque bug de corrupção de dados na máquina de um cliente B2B destrói a credibilidade que o pitch local-first constrói.

### Scorecard

| Vertical | Nota | Tendência | Síntese |
|---|---|---|---|
| Estratégia & Posicionamento | 9/10 | → | Categoria, nicho e narrativa definidos; falta executar GTM |
| Inovação & Diferencial | 9/10 | ↑ | YouTube em escala + local-first: nicho estruturalmente aberto |
| UX & Design | 8/10 | ↑ | Jornada clara, onboarding contextual; faltam estados de erro específicos |
| Responsividade | 9/10 | → | Mobile-first bem implementado nos 3 breakpoints |
| Segurança | 7,5/10 | ↑ | 12 fixes aplicados em 2 rodadas; pendem keychain e rate limit |
| i18n | 7,5/10 | → | Paridade perfeita (187 chaves × 3 idiomas); ~10 strings hardcoded |
| Performance | 7/10 | → | BM25 cacheado <100ms; primeiro load 2–3s; polling otimizável |
| Distribuição | 7/10 | → | Electron + auto-update prontos; OAuth/INPI/instalador pendentes |
| LGPD & Privacidade | 7/10 | ↑ | 3 fixes críticos aplicados; política de privacidade ausente (bloqueia lançamento) |
| Acessibilidade | 6,5/10 | → | Forte em semântica ARIA; fraco em focus management |
| Arquitetura Frontend | 6/10 | ↓ | App.jsx God Component (1.668 linhas, 36 estados) crescendo |
| Arquitetura Backend | 5/10 | ↓ | Monólito de 1.281 linhas; race conditions; erros silenciosos |
| Confiabilidade (SRE) | 4,5/10 | ↓ | Sem atomicidade, sem recovery, sem backup, sem health check |
| Dados & Telemetria | 4/10 | ↓ | Infra pronta, mas 7/11 eventos mortos; zero visibilidade de uso |
| Qualidade & Testes | 3/10 | ↓ | Zero testes automatizados; só smoke manual de 10 checks |

**Leitura do scorecard:** as notas altas estão nas verticais que definem *se o produto merece existir* (estratégia, inovação, UX). As notas baixas estão nas que definem *se o produto sobrevive ao crescimento* (confiabilidade, testes, dados). Essa é a assinatura típica de um MVP forte pronto para profissionalizar — o risco é escalar vendas antes de fechar as fundações.

---

## 1. Estratégia & Negócio

### Sólido
- **Posicionamento em duas camadas bem resolvido:** PKM como categoria de mercado (onde competir), Mentor Digital como conceito (como o usuário experimenta). Essa separação evita o erro comum de vender jargão.
- **Diferencial defensável e verificado no código:** extração de canais inteiros (não vídeos individuais como NotebookLM) + processamento 100% local + custo zero com Ollama. A extração via yt-dlp no IP residencial do usuário é inimitável por SaaS — princípio corretamente tratado como intocável.
- **Validação real:** AUVP comprou a ideia antes do produto existir. Três camadas de monetização (B2C / B2B Creator / B2B Enterprise) com flywheel descrito entre elas.
- **Modelo de negócio documentado:** Free / Pro (R$97–197 perpétua) / Studio (R$97–297/mês) / Enterprise (sob consulta), com Lemon Squeezy escolhido como infraestrutura de licença.
- **Leitura correta do ecossistema:** Gemma 4 e o avanço dos modelos locais são combustível, não ameaça — o Sebayt é camada de infraestrutura de conhecimento, não motor.

### Preocupa
- **Os três pilares de receita não existem ainda:** sem landing page (sem pipeline de aquisição), sem sistema de licença (sem cobrança), sem primeira venda formal (sem validação de preço). Documentados como pendentes há mais de um ciclo.
- **Janela de timing:** o ecossistema local-first amadurece a cada mês. First-mover advantage no nicho "criadores educacionais BR" tem prazo de validade.
- **Dependência de um único case:** AUVP é a única validação. Um case não é padrão de demanda.
- **Precificação não testada:** os valores são sugestões internas; nenhum cliente confirmou willingness-to-pay.

### Ações
1. **Primeira venda B2B formal** — zero código necessário; demo com criador educacional 50k–500k usando o case AUVP. É a ação de maior impacto de todo este relatório.
2. Landing page mínima (proposta de valor + vídeo demo + formulário) — pré-requisito do item 1 em escala.
3. Lemon Squeezy somente após a primeira venda validar preço.
4. Documentar 2–3 demos gravadas para reduzir custo de cada pitch.

---

## 2. UX & Design de Produto

### Sólido
- Home com cards contextuais (badges com dados reais), chat flutuante acessível de qualquer aba, sidebar recolhível, tema automático com persistência.
- Onboarding em camadas: wizard de 6 passos + ProgressToast pós-indexação + hints contextuais por aba.
- Fluxo de configuração de API key em dois passos (testar → salvar) — padrão correto que previne configuração quebrada.
- PostExtractionModal com dois caminhos claros (Drive / Agente IA) — bom momento de decisão guiada.
- Correções da auditoria UX de junho aplicadas: busca_ampla no payload, Groq na UI, versão no footer, cards da home uniformizados, indicador "⚠ Configurar" no card do agente.

### Preocupa
- **Erros silenciosos para o usuário:** `fetchHistory().catch(() => {})` e `fetchRepositorio().catch(() => {})` (App.jsx:184–185) — se a API falha, a tela simplesmente não atualiza, sem feedback. Não há interceptor global de erros do axios nem timeout configurado.
- **"Ollama offline" ainda não diferenciado:** quando o Ollama trava, o chat mostra erro genérico de servidor. O usuário não sabe o que reiniciar. (Pendência conhecida, ainda aberta.)
- **Terminologia inconsistente:** "Configurar Agente" / "Agente IA" / "Provedor de IA" seguem coexistindo.
- **Day 7 / Day 30 não desenhados:** o produto capta bem no Day 1; não há gatilho de retorno (ex.: "seu canal tem 12 vídeos novos — reindexe") além do badge passivo.
- **ChatDrawer usa `key={index}`** na lista de mensagens — funcional hoje, mas frágil se mensagens forem deletáveis/reordenáveis.

### Ações
1. Toast de erro padrão para falhas de API críticas (componente já existe — ProgressToast aceita variante).
2. Mensagem específica "Ollama offline" com botão de retry no chat.
3. Unificar terminologia do agente em um único termo nos 3 idiomas.
4. Desenhar o loop de retenção: notificação nativa quando a base ficar desatualizada (a infra de notificação nativa já existe na extração).

---

## 3. Acessibilidade

### Sólido
- Skip link correto (WCAG 2.4.1), `role="log"` + `aria-live="polite"` no log, `role="progressbar"` com valores, `aria-expanded` em accordions, `aria-checked` em switches, 50+ `aria-label` em botões de ícone, 80+ `aria-hidden` em ícones decorativos, focus ring padronizado via `BTN_FOCUS`.

### Preocupa
- **Nenhum modal tem focus trap** (8 modais) — Tab vazia para o fundo da página; Escape não fecha consistentemente. Viola WCAG 2.4.3 e é o gap mais sério.
- **Tooltips hover-only** (toggle Busca Ampla no ChatDrawer) — invisíveis para teclado e leitor de tela; sem `aria-describedby`.
- **Inputs sem `<label>`** (canal, API key) — só placeholder, que desaparece ao digitar.
- Sidebar recolhida ainda perde affordance de navegação para teclado.

### Ações
1. Extrair um `<ModalWrapper>` único (hoje o padrão backdrop+motion está duplicado 8×) e implementar focus trap + Escape nele — resolve os 8 modais de uma vez.
2. `aria-describedby` no toggle Busca Ampla; tooltip visível com foco de teclado.
3. `<label className="sr-only">` nos inputs de canal e API key.

---

## 4. Internacionalização

### Sólido
- **Paridade perfeita verificada nesta análise: 187 chaves × 3 idiomas (pt/en/es), zero divergência.** Detector automático + fallback pt-BR.

### Preocupa
- **~10 strings hardcoded em português no JSX**, confirmadas: labels de navegação "Repositório"/"Relatório" (App.jsx:608–609 e duplicadas em 671–672), "Desmarcar tudo" (App.jsx:868), títulos em RepositorioTab e RelatorioTab. Usuário em EN/ES vê interface mestiça.
- Labels de navegação duplicados em dois blocos (rail desktop + drawer mobile) — corrigir num lugar não corrige o outro.

### Ações
1. Migrar as strings hardcoded para os 3 locales (esforço: ~1h).
2. Extrair o array de abas para constante única consumida pelos dois blocos de navegação.

---

## 5. Engenharia — Backend (Python/FastAPI)

**Dimensão:** api_sebayt.py 1.281 linhas (31 endpoints) · motor_sebayt.py 923 linhas · agent_sebayt.py 809 linhas.

### Sólido
- Separação conceitual correta em três domínios: API / motor de extração / agente RAG.
- Pipeline RAG bem desenhado: indexação com enriquecimento (tags 3×, keywords TF-IDF 2×), BM25 com cache por mtime, query expansion para provedores rápidos, prompt com delimitadores XML, streaming, verificação anti-alucinação pós-geração.
- Validação de entrada nos endpoints sensíveis (upload com whitelist+50MB, URLs com regex, path traversal mitigado com realpath em delete e serve_static).
- 5 provedores LLM com fallback gratuito (Ollama) — flexibilidade rara.

### Preocupa — em ordem de severidade

**CRÍTICO — Race conditions em estado compartilhado.** Três estruturas globais são lidas/escritas por múltiplas threads sem proteção:
- `state.stats` — atualizado pelo LogRedirector (thread do motor) e lido pela API (api_sebayt.py:170–195);
- `_bm25_cache` — dois chats simultâneos no mesmo canal disparam dupla reconstrução do índice (agent_sebayt.py:70–74);
- `state.chat_histories` — dict sem lock (o único lock existente é `agent_chat_lock`).
Consequência prática: stats inconsistentes na UI e trabalho duplicado. Fix: um `threading.Lock` por estrutura — esforço de minutos.

**CRÍTICO — Persistência sem atomicidade.** O motor faz `pd.concat` + `df.to_csv()` a cada vídeo processado (motor_sebayt.py:830–831) — centenas de reescritas completas do CSV por extração, sem write-to-temp+rename, sem lock de arquivo. Processo morto no meio da escrita = CSV truncado = histórico corrompido. O índice BM25 (JSON) tem o mesmo padrão e **nenhuma validação ao carregar** — JSON corrompido = crash do chat sem mensagem.

**ALTO — 37 blocos `except Exception` genéricos, 9 deles com `pass` silencioso.** Falha de sync do Drive, falha de query expansion e falha de migração somem sem rastro. Logging é todo via `print()` redirecionado — sem níveis, sem estrutura, stack traces descartados (só a mensagem final vai para o crash log).

**ALTO — `requirements.txt` sem nenhuma versão pinned.** Build de hoje e de daqui 3 meses instalam dependências diferentes. A SDK da OpenAI já quebrou compatibilidade no passado; yt-dlp muda semanalmente. Builds irreproduzíveis são risco direto para o instalador oficial.

**MÉDIO — Pontos diversos:** `/agent/test-key` sem rate limit (loop rápido esgota quota da chave do usuário); `/cerebro/texto` sem limite de tamanho do conteúdo; `/historico/limpar` com lista vazia apaga tudo (comportamento perigoso como default); modelo Anthropic hardcoded (`claude-sonnet-4-6`); Ollama `localhost:11434` hardcoded em 3 pontos; histórico do chat salvo só após o stream completar — desconexão no meio perde o turno.

### Ações
1. **Sprint de confiabilidade (1–2 dias):** locks nas 3 estruturas + escrita atômica (temp+rename) em CSV/JSON + validação com fallback ao carregar índice.
2. `pip freeze > requirements-lock.txt` e instalar a partir do lock no build.
3. Substituir `print` por `logging` com níveis e arquivo rotativo — pré-requisito para dar suporte remoto a cliente B2B.
4. Rate limit simples em `/agent/test-key` (ex.: 1 chamada/5s) e `max_length` nos campos Pydantic (Fix ⑦ do backlog de segurança).
5. v2: separar em routers FastAPI por domínio (já mapeado na Avaliação Estratégica — segue válido).

---

## 6. Engenharia — Frontend (React)

### Sólido
- Modularização real: 15+ componentes com responsabilidade única, services/api.js centralizado, hooks de polling isolados com cleanup correto, constantes globais, JSDoc consistente.
- Zero código morto, zero TODOs órfãos, imports limpos.
- Bundle saudável (~100KB gzip estimado).

### Preocupa
- **App.jsx é um God Component em crescimento: 1.668 linhas, 36 `useState`, 13 `useEffect`.** Era 1.279 linhas na v0.4.1 — cresceu 30% em poucas semanas. Todo feature novo passa por ele; toda mudança re-renderiza tudo. É o principal limitador de velocidade de desenvolvimento futuro.
- **Prop drilling pesado:** ChatDrawer recebe 11 props, RepositorioTab 8+. Sem Context nem store.
- Comparação de estado de polling via `JSON.stringify` (O(n) a cada 2s) e `useAgentStatus` seta estado sem comparar — re-render garantido a cada 3s.
- Polling não pausa com aba/janela em background (3 pollings paralelos: 2s, 3s, 5s + 800ms durante pull do Ollama).
- Sem TypeScript — contratos entre componentes são implícitos; com 11 props num componente, o risco de quebra silenciosa cresce.

### Ações
1. **Refatoração incremental do App.jsx em hooks de domínio** (`useExtraction`, `useAgentConfig`, `useChat`) — não precisa de big bang; um hook por sprint. Context apenas para darkMode + idioma.
2. `document.visibilitychange` para pausar pollings em background.
3. Trocar `JSON.stringify` por comparação de campos relevantes (status, progress, logs.length).
4. Considerar TypeScript apenas em `services/api.js` + tipos das respostas (custo baixo, benefício alto, sem migração total).

---

## 7. Confiabilidade (SRE)

### Sólido
- Electron gerencia ciclo de vida do backend e do Ollama; auto-update do yt-dlp no startup; migração automática de estrutura de dados antiga; loading screen com status real.

### Preocupa
- **Nenhum recovery para índice corrompido** — o chat simplesmente quebra, sem botão "Recriar índice".
- **Nenhum backup da base de conhecimento** — `cerebro/` apagado = tudo perdido (Drive cobre parcialmente, mas só se o usuário ativou).
- **Nenhum health check de processos** — Ollama travado = chat mudo sem diagnóstico.
- Estado do motor vive só em memória — crash no meio da extração perde progresso de mapeamento (o delta por CSV mitiga, mas a auditoria CSV↔TXT é frágil).
- yt-dlp com timeout por subprocess (30s), mas o loop inteiro de extração é síncrono — um canal grande mantém a thread ocupada por horas sem checkpoint de saúde.

### Ações
1. Validação de schema ao carregar `{canal}_index.json`; em falha, mensagem clara + botão "Recriar índice" na UI (a indexação já existe — é só religar).
2. Health check do Ollama no início de cada chat (1 GET com timeout 2s) → habilita a mensagem específica de offline da vertical UX.
3. Export .zip da pasta `cerebro/` como ação manual — diferencial de confiança para o pitch institucional (reavaliação do item descartado: backup ≠ sync; Drive não cobre quem não autenticou).

---

## 8. Dados & Telemetria

### Sólido
- Infraestrutura completa: PostHog opt-in com ConsentModal, revogação nas configurações (conformidade LGPD), 11 eventos nomeados com semântica de produto correta, chave fora do repositório.

### Preocupa
- **7 dos 11 eventos nunca são disparados** (verificado no código): `extracaoIniciada`, `extracaoConcluida`, `documentoAdicionado`, `provedorConfigurado`, `repositorioAcessado`, `relatorioAcessado`, `buscaAmplaToggled`. Apenas `appOpened`, `canalConfigurado`, `baseIndexada` e `chatPergunta` funcionam.
- Consequência: **o funil de ativação (instalar → extrair → indexar → perguntar) está cego nas duas etapas do meio.** Não dá para saber onde usuários travam — exatamente a pergunta que a telemetria existia para responder.
- Nenhuma métrica de retenção definida operacionalmente (a proposta "usuário com 2+ fontes" está documentada mas não implementada).
- Time to Value (instalação → primeira resposta de chat) não é calculável sem `extracaoIniciada`/`extracaoConcluida`.

### Ações
1. **Religar os 7 eventos mortos** (~2h de trabalho — os handlers já existem, falta a chamada).
2. Definir 3 métricas norte e criar o dashboard no PostHog: Time to First Answer, % usuários com 2+ fontes, perguntas por usuário/semana.
3. Só depois de 2–4 semanas de dados, decidir o próximo sprint de produto com evidência em vez de intuição.

---

## 9. Segurança

### Sólido
- **12 correções aplicadas em duas rodadas de auditoria** (documentadas em Segurança.txt): CORS restrito, validação de playlist ID, limite de upload, path traversal (delete + serve_static), eliminação de dangerouslySetInnerHTML, prompt injection (delimitadores XML), Drive query injection (escaping), URL whitelist, histórico server-side.
- Electron com contextIsolation + nodeIntegration:false; subprocess sempre via lista; segredos no .gitignore; smoke test cobre path traversal.

### Preocupa
- **Chave de API em plaintext** (`agent_config.json`) — mitigada com avisos, mas a solução definitiva (keychain do OS via keytar) segue pendente. Nota adicional desta análise: `GET /agent/config` retorna a chave em claro para o frontend a cada load — minimizar para retornar apenas `key_set: true` + últimos 4 caracteres.
- **API sem autenticação local:** qualquer processo na máquina pode chamar os 31 endpoints (CORS protege contra browser, não contra processo local). Aceitável para desktop pessoal; bloqueador para o modo institucional/servidor do roadmap.
- `/agent/test-key` sem rate limit (vetor de esgotamento de quota da chave do próprio usuário).
- Campos Pydantic sem `max_length` (Fix ⑦, backlog).

### Ações
1. Minimizar resposta de `GET /agent/config` (não devolver a chave inteira).
2. Rate limit em test-key + Fix ⑦ — fecham o backlog de severidade baixa.
3. Keychain (keytar) na v1.0 — manter no roadmap.
4. Token local de API é pré-requisito da Fase 4 (modo institucional) — registrar como dependência arquitetural, não fazer agora.

---

## 10. Privacidade & LGPD

### Sólido
- Local-first por design — a maior parte dos dados nunca sai da máquina.
- Os 3 fixes críticos/altos da auditoria LGPD aplicados: parâmetro `{canal}` removido do analytics, aviso de transferência internacional nos cards de provedores externos, toggle de revogação de consentimento.
- OAuth com escopo mínimo (`drive.file`).

### Preocupa
- **Política de privacidade ausente — é o item que bloqueia simultaneamente:** (a) OAuth em produção no Google Cloud, (b) distribuição pública, (c) qualquer venda B2B com departamento jurídico. É o pendente de maior alavancagem fora de código.
- Onboarding ainda não menciona saída de dados ao configurar provedor externo (princípio da transparência, Art. 6º VI).
- Chave PostHog exposta no bundle JS (risco baixo, write-only — melhoria mapeada para v1.0).

### Ações
1. **Redigir a política de privacidade** cobrindo: dados locais, PostHog, provedores externos, Drive OAuth, direitos do titular, contato. Publicar na futura landing page (sinergia com GTM).
2. Uma frase no step de API do onboarding: "ao usar provedor externo, suas perguntas e trechos da base saem da sua máquina".

---

## 11. Performance

### Sólido
- BM25 com cache em memória — buscas subsequentes <100ms; latência do Ollama já otimizada (sem query expansion, 4 chunks: 15s→3s).
- Streaming de respostas — percepção de velocidade correta.
- Bundle frontend razoável; Vite + tree-shaking funcionando.

### Preocupa
- **Primeiro chat por canal paga 2–3s** de carga do índice (JSON inteiro em memória + construção do BM25) — sem indicador na UI de que é um warm-up, parece lentidão.
- Cache BM25 sem evição: N canais indexados = N índices residentes em RAM para sempre.
- `/history` lê CSVs completos com pandas a cada chamada (e é polled).
- Query expansion para provedores externos = 2 chamadas LLM extras por pergunta (latência + custo do usuário).
- Polling frontend agressivo e contínuo (seção 6).

### Ações
1. Indicador "preparando base..." no primeiro chat do canal (UX barata para um custo fixo inevitável).
2. Evição LRU simples no cache BM25 (manter 3 canais mais recentes).
3. Cachear resposta de `/history` em memória no backend, invalidando ao fim da extração.

---

## 12. Qualidade & Testes

### Sólido
- Smoke test manual de 10 checks (`.claude/skills/run-brainiac/smoke.ps1`) cobrindo endpoints críticos, incluindo path traversal e test-key — é um embrião real de suíte de regressão.
- CHANGELOG disciplinado, versionamento semântico com tags, convenção de commits.

### Preocupa
- **Zero testes automatizados em CI. Zero CI.** Não há `.github/workflows`, não há pytest, não há script de teste no package.json. Cada refactor (incluindo os recomendados neste relatório) é feito no escuro.
- O risco é composto: God Component + monólito backend + sem testes = custo de mudança crescendo exponencialmente.

### Ações
1. **Converter o smoke.ps1 em pytest** (os 10 checks viram ~10 testes de integração com `TestClient` do FastAPI) — 1 dia de trabalho, aproveitando o que já existe.
2. GitHub Actions mínimo: rodar pytest + `npm run build` a cada push (30 min de setup).
3. Meta de cobertura pragmática: apenas os fluxos críticos (extração mock, indexação, chat, upload, deletes) — não perseguir %.

---

## 13. Distribuição & DevOps

### Sólido
- Pipeline de empacotamento completo: Electron 34 + Python embeddable + Node portable + Ollama auto-instalado + electron-updater via GitHub Releases. Para um produto local-first, essa fundação é 80% do trabalho de distribuição.

### Preocupa
- **Os 4 pendentes de lançamento seguem abertos:** OAuth Testing→Production, registro INPI (~R$90), primeiro instalador oficial publicado, landing page.
- Processo de build manual com armadilha conhecida: sincronizar Python para `dist_electron/win-unpacked/resources/app/` é passo manual que já causou bug em produção (405 do histórico). Sem script, vai acontecer de novo.
- requirements sem lock (seção 5) afeta diretamente a reprodutibilidade do instalador.

### Ações
1. **Script `build.ps1` único** que encadeia: vite build → cópia dos 3 .py → electron-builder. Elimina a classe inteira de bugs de dessincronização.
2. Executar os 4 pendentes de lançamento na ordem: INPI (barato e lento — iniciar já) → política de privacidade → OAuth production → instalador no GitHub Releases.

---

## 14. Inovação & Roadmap

### Sólido
- O roadmap documentado é coerente e em camadas: curto (busca ampla v2, imagens via Gemma 4 multimodal), médio (MCP server, atualização automática da base, voz), longo (modo institucional, API pública, fontes RSS/web).
- **Servidor MCP é a aposta estratégica mais subestimada do roadmap:** transforma o Sebayt de app destino em infraestrutura que qualquer agente (Claude, Cursor, etc.) consulta — muda a categoria do produto e cria lock-in técnico real.
- Decisões de descarte registradas com racional (ChromaDB, SaaS, exportar base) — disciplina rara.

### Preocupa
- Risco de commoditização parcial: "chat com documentos" será feature de OS em 1–2 anos. O fosso real é a camada de extração/curadoria (YouTube em escala) — investimento contínuo deve priorizar essa camada, não o chat.
- 256K de contexto (Gemma 4) muda a equação do RAG para bases pequenas — o modo "full context" mapeado merece subir de prioridade quando houver dados de tamanho médio de base (depende da telemetria religada).

### Ações
1. Manter MCP server como próxima grande feature pós-lançamento — é diferencial técnico que nenhum PKM concorrente tem hoje.
2. Atualização automática da base (novos vídeos) é o gatilho de retenção Day 7/Day 30 — promover junto com a vertical UX.

---

## 15. Matriz de Priorização Consolidada

### P0 — Antes de distribuir (1 semana de código + GTM em paralelo)
| # | Ação | Vertical | Esforço |
|---|---|---|---|
| 1 | Política de privacidade | LGPD | 1 dia (sem código) |
| 2 | Locks nas 3 estruturas compartilhadas + escrita atômica CSV/JSON | Confiabilidade | 1–2 dias |
| 3 | Religar os 7 eventos de telemetria mortos | Dados | 2h |
| 4 | requirements-lock.txt pinned | Backend/Distribuição | 30 min |
| 5 | Script build.ps1 unificado (vite + cópia .py + electron) | DevOps | 2h |
| 6 | Strings hardcoded → i18n | i18n | 1h |
| 7 | Rate limit test-key + max_length Pydantic + minimizar GET /agent/config | Segurança | 2h |

### P1 — Sprint seguinte (fundação de qualidade)
1. smoke.ps1 → pytest + GitHub Actions mínimo
2. Recovery de índice corrompido + botão "Recriar índice"
3. ModalWrapper único com focus trap + Escape (8 modais de uma vez)
4. Mensagem "Ollama offline" + health check pré-chat
5. Toast de erro para falhas de API silenciosas
6. Polling com pausa em background

### P2 — Go-to-market (paralelo a tudo, sem código)
1. Primeira venda B2B formal (case AUVP como referência)
2. Landing page mínima
3. INPI + OAuth production + instalador oficial no GitHub Releases
4. Lemon Squeezy após validação de preço

### P3 — Escala (v0.5+/v1.0)
1. Refatoração incremental App.jsx (hooks de domínio + Context)
2. Routers FastAPI por domínio
3. Keychain para chaves (keytar)
4. Logging estruturado
5. Servidor MCP
6. Atualização automática da base + evição LRU do cache BM25

---

## Conclusão

O Sebayt tem o problema certo, a solução certa e o momento certo — o que falta é **transformar maturidade estratégica em operação confiável e mensurável**. As três frentes que merecem a próxima semana de trabalho são pequenas e desproporcionalmente valiosas: o sprint de confiabilidade P0 (para que o produto aguente um cliente pagante sem corromper dados), a telemetria religada (para que as próximas decisões de produto sejam baseadas em evidência) e a política de privacidade (que destrava OAuth, distribuição e vendas de uma vez).

Feito isso, a recomendação é deliberada: **parar de polir e ir vender.** O código aguenta a primeira dezena de clientes; cada semana adicional de desenvolvimento sem venda é a aposta mais cara do projeto.
