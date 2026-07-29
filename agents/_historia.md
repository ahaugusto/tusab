# História viva do Tusab — contexto que todo agente deve conhecer

Este arquivo é injetado como base de memória institucional em todos os agentes do projeto.
Contém: decisões tomadas, experimentos que falharam, o que funcionou, e por quê.

---

## Origem e identidade

- **Autor:** Augusto Brasil / CriAugu — CNPJ 65.131.075/0001-57
- **Origem:** script pessoal de extração de canal do YouTube para estudar na AUVP (canal do Raul Sena / Investidor Sardinha). O caso de origem é o próprio autor como aluno.
- **Nome:** TUSAB = **T**ranscrição + **U**suário + **S**aber + **A**gente + **B**ase
- **Tagline técnica:** INDEX · AUGMENT · CONVERSE (IAC pipeline)
- **Tagline visual:** INDEX · ASCEND · CONVERSE (versão para o logo)
- **Brazil First:** app abre em português. Brasil é o mercado primário. i18n PT/EN/ES implementado, mas o foco é o mercado educacional e corporativo brasileiro.

---

## Linha do tempo de versões

| Versão | Período | Marco principal |
|--------|---------|----------------|
| v0.x | fev–mai 2025 | Script pessoal → app com UI básica |
| v0.5.2 | mai 2025 | Indexação sequencial de múltiplas bases |
| v1.0.0 | jun 2025 | Lançamento público no GitHub |
| v1.0.1 | jun 2025 | Persistência de índices, chat multi-base, estabilidade Windows |
| v1.0.2–v1.0.5 | jun 2025 | Fix de empacotamento, notificação in-app de update |
| v1.0.6 | jun 2025 | Instalador multilíngue NSIS, UX Ollama sem modelo |
| v1.0.8 | jun 2026 | Fila persistente em disco, race condition chat corrigida, CrossEncoder, query expansion, dispatch_event |
| v1.0.9 | jun 2026 | Logo ibis na tela de loading |
| v1.0.10 | jun 2026 | MCP Server, Flashcards/Modo Estudo, Digest Semanal, Timestamp clicável, date-aware RAG, views boost, notificações desktop, watchdog Electron |
| v1.0.11 | jun 2026 | RAG denso (chunk adaptativo, score mínimo adaptativo, CrossEncoder 768), histórico de chat como conhecimento, acessibilidade modais, sub-abas underline |
| v1.0.12 | jun 2026 | Capítulos como fronteiras de chunk BM25, deduplicação semântica Jaccard (0.85), mapa de cobertura pré-extração (`GET /canal-info`), fix z-index onboarding sobre landing, sistema de agentes especialistas |
| v1.0.14–v1.0.15 | jun 2026 | Notificação de update na landing, modal pós-atualização automática, fix ConsentModal z-index, fix steps 1–7 do Onboarding sem zIndex |
| v1.0.17 | jun 2026 | Fix raiz do onboarding (aria-hidden + autoFocus), CORS dev server, notificações funcionais na aba Admin, FAQ de notificações no help trilíngue |
| v1.0.18 | jun 2026 | Menu Electron restaurado (Reload/DevTools/Zoom/Fullscreen), versão dinâmica via package.json no preload, CHANGELOG atualizado v1.0.11–v1.0.18 |
| v1.0.19 | jun 2026 | Shift+C via handleOpenChat (snack removido corretamente), Shift+R fecha HomeScreen, QA expandido com 17 jornadas mapeadas, 5 FAILs documentados |
| v1.0.23 | jun 2026 | Chunking temporal de vídeos sem capítulos (janelas 120s/overlap 15s), enriquecimento silencioso BM25 via KeyBERT, sumarização LLM por vídeo ("Aprofundar base"), modal pós-config LLM, chunk reduzido 8k→3k chars |
| v1.0.24 | jun 2026 | Hotfix: aba "Ferramentas" (Modo Estudo) oculta por timeout 300s em Modo Estudo — toda a sub-aba `funcionalidades` removida temporariamente; `agentInitialSubTab` default corrigido para `'configuracoes'` |
| v1.0.25 | jun 2026 | Onboarding interativo com OllamaSetup no step 5 (download de modelo sem sair do onboarding); classificador de intenção BUSCA/CONTEXTO/CONVERSA; 12 dicas de como perguntar bem nas frases de loading; placeholder agnóstico |
| v1.0.26 | jun 2026 | SQLite FTS5 exact-match paralelo ao BM25; 4 fixes de recall BM25 (texto_original, np.max, score>0, deduplicação FTS5); desacoplamento canalChat/canalConfigurado; markdown rendering no chat; modal de base com deselecção total |
| v1.0.27 | jul 2026 | Menção `@arquivo`/`@@busca` no chat; highlight de termo nos resultados do Repositório; chips de anexo na bolha do usuário; fix fila de chat (streamId); fix saudações PT/EN/ES; fix sem_contexto suprime fontes; fix endpoint /agent/arquivos subpastas |
| v1.0.28 | jul 2026 | `+ Arquivo` no Repositório vira chip de contexto fixado no chat (mesmo comportamento do `@`), em vez de injetar texto no input |
| v1.0.30 | jul 2026 | `@@` injeta trecho diretamente no LLM sem re-passar pelo BM25 (`trechos_fixados`); fix banner de atualização (texto contraditório + fallback "Baixar manualmente") |
| v1.0.31 | jul 2026 | Hotfix crítico: `sandbox: false` no preload — Electron 20+ bloqueava `require()` de Node built-ins, deixando `window.tusab` undefined e o app inoperante no instalado |
| v1.0.32 | jul 2026 | Funil D1 do Drive (analytics); lista de modelos Ollama ampliada de 8 para 12; fix `sem_credenciais` deixa de ser falha silenciosa |
| v1.0.33 | jul 2026 | Hotfix crítico: `psutil`/`openpyxl` ausentes do python_env empacotado (Monitor zerado, export XLSX quebrado); fix tags multi-palavra do YouTube no BM25; chave PostHog renovada |
| v1.0.34 | jul 2026 | Botão "Verificar atualização" manual na aba Admin; Design System oficial (tokens medidos por grep + agente guardião `/design-system` + inventário de moléculas/organismos); fix fallback de versão hardcoded no preload; fix dívidas de consistência (StatCard, ConsentModal) |
| v1.0.35 | jul 2026 | Fix WARN-21: banner de atualização passa a aparecer também na HomeScreen; fix WARN-23: fechar o painel do Drive durante OAuth em andamento cancela o fluxo automaticamente |
| v1.0.36 | jul 2026 | Busca acadêmica no arXiv (perfil Pesquisador); TTS local no Modo Estudo (Pocket TTS, build Beta/Enterprise); atualização completa de stacks backend+frontend com validação funcional real |
| v1.0.37 | jul 2026 | Busca de estudos clínicos via FHIR/ResearchStudy (perfil Pesquisador) — terceira fonte além de YouTube/arXiv |
| v1.0.38 | jul 2026 | Reconhecimento de documentos jurídicos (perfil Especialista); confiança graduada por sentença no chat (P1-e); calibragem dinâmica de RAG por corpus (P0-c); progresso granular na indexação; pipeline de release automático corrigido (quebrado desde v1.0.22) + Dependabot |
| v1.0.39 | jul 2026 | Discoverability: orientação sobre o MCP Server no produto (botão Admin + FAQ + onboarding); FAQ trilíngue de FHIR e reconhecimento jurídico; aviso permanente sobre reconhecimento jurídico no Repositório — features já implementadas em versões anteriores ganham exposição real ao usuário |
| v1.0.40 | jul 2026 | Aba Admin liberada pro perfil Pesquisador (WARN de acesso, sem razão de segurança); arXiv/FHIR acessíveis sem canal do YouTube configurado; chip de perfil e chip do Drive coexistindo no header (fix WARN-25); feedback de update mais visível (ProgressToast); badge persistente de formato detectado (jurídico/WhatsApp/reunião) na listagem do Repositório; instrução de formato do chat (negrito/tabela/emoji) unificada em `_FMT_INSTR` e aplicada aos 3 prompt builders; copy de notificações adaptada pra Electron (sem "barra de endereço") |

---

## Decisões estratégicas permanentes

### Local-first — linha vermelha inegociável
Dados nunca saem da máquina sem consentimento explícito do usuário. Isso não é política de privacidade — é design. Motivações:
1. Diferencial competitivo: todos os concorrentes são SaaS
2. Proteção do yt-dlp: extração no IP do usuário distribui carga; servidor central seria bloqueado
3. Mercado institucional: hospitais, conselhos, empresas não mandam dados internos para fora
4. LGPD simplificada: dados que não saem não precisam de DPA
5. Custo zero de infraestrutura

### yt-dlp local no IP do usuário — princípio intocável
Rate limiting do YouTube é por IP. Extração centralizada = bloqueio garantido. Extração distribuída por IP de usuário = escala natural.

### BM25 como fundação + CrossEncoder como upgrade
BM25Okapi (rank_bm25): ~1ms, determinístico, CPU puro, auditável. CrossEncoder (ms-marco-MiniLM-L-6-v2, ~80MB): +236ms, ativado só na Busca Ampla. Decisão de manter BM25 como padrão: velocidade e custo zero para usuários sem paciência para wait. Embeddings vetoriais virão depois (Ollama + nomic-embed-text, P1), como complemento — nunca como substituição obrigatória.

### Stack semântica reservada à edição institucional B2B (jul/2026)
Descoberta: torch + sentence-transformers + scikit-learn + keybert (~2,5 GB) nunca entraram no `python_env` empacotado — CrossEncoder e KeyBERT sempre degradaram graciosamente no app instalado; o produto B2C real é BM25 + FTS5. Decisão (Augusto, 02/jul/2026): **não incluir a stack no instalador consumer** — em PC modesto (persona Estudante) o custo de RAM (+0,5–1 GB) e latência de inferência CPU (1–3s vs +236ms de dev) degradaria a experiência, e o instalador saltaria de 223 MB para ~1,5 GB com imposto recorrente de auto-update. A stack fica **reservada para a futura edição institucional (B2B)**: hardware corporativo absorve o custo, corpus institucional heterogêneo se beneficia mais do re-ranqueamento, e "busca semântica avançada" é diferenciador legível em proposta enterprise. Gatilhos para empacotar a edição B2B: primeiro lead concreto + validação do valor semântico com corpus institucional real. README público corrigido para anunciar apenas BM25 + FTS5. Caminho semântico do B2C continua sendo embeddings via Ollama (sem torch no python_env). Plano completo: `Documentação do Produto/Plano B2B — Tusab Enterprise.md`.

### Tusab Enterprise — nomenclatura, código e repositórios (02/jul/2026)
Nome oficial da edição institucional: **Tusab Enterprise** (aprovado por Augusto; B2C permanece "Tusab"). Três decisões estruturais: (1) **um repositório de código, sempre** — as duas edições vivem em `ahaugusto/tusab`; diferenciação por flag/licença + configuração de build (`requirements-enterprise.txt` + variant electron-builder), fork vetado; (2) **repo novo só de releases, só com lead** — `tusab-enterprise-releases` (privado, apenas artefatos + `latest.yml` para canal de update separado) será criado no gatilho da Fase 1, não antes; (3) **verticais são pacotes de GTM, não produtos** — Tusab School, Concurso, Idiomas, Saúde e Vestibular são empacotamentos comerciais do mesmo Tusab Enterprise (curadoria + persona + canal), compartilhando código, instalador e stack; qualquer lead de vertical dispara a mesma Fase 1. Plano: `Documentação do Produto/Plano B2B — Tusab Enterprise.md`; docs de verticais atualizados com nota de reposicionamento.

### Classificador de intenção BUSCA/CONTEXTO/CONVERSA (jun/2026, v1.0.25)
Antes: todo follow-up ("traduza isso", "explique melhor") disparava nova busca BM25, retornando chunks irrelevantes.
Solução: antes de acionar o BM25, classifica a mensagem via chamada LLM com `max_tokens=5` e `temperature=0.0` em paralelo com a busca (usando `ThreadPoolExecutor` compartilhado no módulo, nunca recriado por request).
- **BUSCA**: BM25 normal — chunks recuperados alimentam o prompt.
- **CONTEXTO**: bypassa BM25 completamente; usa `state.last_chat_response[canal_prefixo]` com a resposta anterior. Fallback para BUSCA se primeira mensagem da sessão.
- **CONVERSA**: responde diretamente sem fontes (casual, saudação, agradecimento).
**`state.last_chat_response`**: dict em `AppState`, escrito no `finally` do stream e após `chat()` sync. GIL protege contra corrupção de struct; race entre duas streams paralelas do mesmo canal é teoricamente possível mas improvável na prática.
**Bug crítico encontrado por Integration agent (FAIL-01 original)**: o `_gen()` do stream em `router_agent.py` tinha `except Exception: pass` descartando todos os chunks de texto puro — o stream retorna texto, não JSON, então `json.loads()` lançava na maioria dos chunks e o `pass` fazia `resposta_acumulada` nunca ser populada. Fix: `except Exception: if chunk.strip(): resposta_acumulada.append(chunk)`.
**Fallback seguro**: qualquer exceção em `_classificar_intencao()` retorna `'BUSCA'` — comportamento idêntico ao pré-feature.

### Enriquecimento KeyBERT + sumarização LLM (jun/2026, v1.0.23)
Dois níveis de aprimoramento de RAG implementados:
1. **KeyBERT** (offline, transparente): frases-chave appendadas ao campo `texto` de cada chunk antes de indexar. Campo `texto_original` preserva o texto limpo para exibição. Usa `all-MiniLM-L6-v2` já presente. Sem dependência nova de modelo.
2. **Sumarização LLM** (opcional, gatilho pós-config): `summarize.py` gera `{tema, subtemas, entidades, conclusao}` por vídeo com timeout 30s. Salvo em `_resumo.json` ao lado do `.txt`. Injetado no prompt antes dos chunks como "Visão geral". Gatilho: usuário salva config LLM → modal "Aprofundar base" oferece processar pendências.
**Princípio:** nenhuma das duas pode quebrar o produto. Degradação graciosa total — sem KeyBERT ou sem resumo, BM25 e chat funcionam normalmente.

### Brazil First
PT como idioma primário. Groq destacado como melhor alternativa gratuita para quem não tem cartão internacional. AUVP como caso de origem e case de referência para B2B Creator (Camada 2).

### Freemium removido (jun 2026)
O produto serve como vitrine técnica de Augusto Brasil/CriAugu. Paywall nessa fase criaria atrito antes de validar tração. Infraestrutura de licença está pronta (`config.get('pro', False)`) mas desabilitada. Quando ativar: após caso documentado + landing page + sistema de licença.

### Repositório fechado → revisado para source-available (28/jul/2026)
Decisão original (acima) revertida conscientemente, não abandonada por acidente. Contexto que mudou: (1) achado factual — `tusab-public` já existia como mirror PUBLIC do GitHub há tempos, criado como bugfix do feed do `electron-updater` (`CHANGELOG.md:391`, não como decisão deliberada de abrir o projeto), recebendo os mesmos commits que o repo privado a cada push desta sessão; (2) auditoria de segurança (`git log --all -p` completo) não encontrou nenhum segredo/chave jamais commitado em nenhum ponto do histórico — o acidente não teve o pior desfecho possível; (3) achado que muda o cálculo de risco: o backend Python inteiro (`tusab_engine/**`) já é distribuído como código-fonte legível dentro de todo instalador via `extraResources` (`electron/package.json`) — "fechado" nunca protegeu o pipeline RAG de um concorrente disposto a instalar e vasculhar, só impunha fricção; (4) zero stars/forks/issues/watchers em ambos os repos — não havia comunidade formada pra fragmentar ou risco de imagem por formalizar agora.

Motivação declarada por Augusto: visibilidade. Decisão tomada após consulta a 4 agentes (memoria, seguranca, produto-b2b, produto) na mesma sessão — não foi decisão solo.

**Licenciamento escolhido: Elastic License 2.0 (ELv2)**, não MIT/Apache puro. Motivo (`/produto-b2b`): MIT/Apache permitiria um concorrente clonar o repo e vender uma "Tusab Enterprise" rival com menos esforço do que Augusto teve — ELv2 mantém o código 100% legível/auditável (a prova real de "local-first" que importa pro perfil Pesquisador) mas proíbe oferecer como serviço hospedado/gerenciado a terceiros. Precedente citado: Elastic, Sentry, MongoDB (SSPL) adotaram licenças equivalentes pelo mesmo motivo.

**Marca separada do código**: `TRADEMARK.md` novo — nome "Tusab" e logo não entram na licença de código, forks precisam se renomear. INPI pendente não bloqueia a decisão: direito autoral sobre código é automático (Lei 9.610/1998), INPI protege é a marca — a separação de arquivo resolve isso sem esperar o registro sair.

**Overhead de contribuição não foi resolvido, foi adiado deliberadamente**: `CONTRIBUTING.md` novo declara explicitamente "source-available, sem PRs externos aceitos por enquanto" — desacopla "tornar visível" (custo zero de manutenção) de "aceitar contribuição de terceiro" (custo real, não assumido agora). Pode ser revisitado depois.

**Pendente, não decidido ainda**: consolidar `tusab` (privado) e `tusab-public` (mirror) num único repo público. Augusto levantou a ideia; recomendação dada foi tornar `ahaugusto/tusab` o repo canônico público (nome mais limpo, sem sufixo "-public" que lê como mirror secundário) e migrar `build.publish.repo` do electron-builder pra lá, mantendo `tusab-public` vivo até 1 release de transição pra não quebrar auto-update de instalações existentes — ação de flip de visibilidade não executada ainda, aguardando confirmação explícita (é ação difícil de reverter de verdade: uma vez público, pode ficar indexado/cacheado mesmo se voltar a privado).

---

## Experimentos que falharam — não repropor sem nova evidência

| Experimento | Versão | Por que falhou |
|-------------|--------|---------------|
| Tentativas duplas pt+en no yt-dlp | < v1.0.6 | Causavam rate limit 429 do YouTube. Fixado em `sub_langs = 'pt'` |
| Query expansion para Ollama | v1.0.8 | Aumentava latência de 3s para 15s. Desabilitado para Ollama; mantido para providers cloud |
| `Lock` em `state_lock` | < v1.0.8 | `print()` dentro de região locked reentrava no LogRedirector → deadlock. Corrigido para `RLock` |
| BM25S (bm25s 0.3.9) | jun 2026 | 7ms vs 1ms em 500 docs; ganho só começa em 1M+ docs; API exige vocabulário compartilhado e refatoração significativa. Descartado; aguardando LanceDB |
| Deduplicação semântica de chunks | v1.0.10 | Testada, sem ganho percebido na qualidade das respostas. Descartada |
| Capítulos como fronteira de chunk | v1.0.10 | Requereria request extra ao yt-dlp por vídeo — risco de rate limit e latência extra |
| Groq como provider de linha de frente | v1.0.10 | Contradiz local-first; dados passam por servidor externo. Groq permanece como opção gratuita destacada (Brazil First), não como padrão |
| GraphRAG | Avaliado, não implementado | Corpus atual (YouTube + PDFs avulsos) tem baixa densidade relacional. Retornar quando corpus tiver alta densidade (artigos que se citam, wikis) |
| ChromaDB como banco vetorial | Avaliado | Substituído pelo plano LanceDB (mesmo armazenamento BM25 + vetor, sem servidor separado) |
| Chunk size fixo 500/100 para WhatsApp | v1.0.10 | 2–3 mensagens por chunk — muito granular para BM25. Corrigido para 1200/250 em v1.0.11 |
| Score mínimo BM25 fixo em 0.5 | v1.0.10 | Eliminava resultados válidos em corpus grande (> 5k chunks têm scores naturalmente menores). Corrigido para threshold adaptativo em v1.0.11 |
| CrossEncoder com truncação de 512 chars | v1.0.10 | Perdia contexto. Aumentado para 768 em v1.0.11 |
| Amostragem sequencial para flashcards (`chunks[:n]`) | v1.0.11 | Pegava sempre os primeiros chunks — bias de início de corpus. Corrigido para `random.sample()` |
| Resumo com 18k chars para Ollama | v1.0.11 | Causava timeout em modelos locais (120s insuficiente). Reduzido para 3.7k chars + timeout 300s |
| `createPortal` duplo no RepositorioTab | v1.0.11 | ModalWrapper já faz portal internamente; chamar createPortal no caller gerava portal duplo. Removido |
| Onboarding invisível sobre landing (z-index + portal) | v1.0.12 | `ModalWrapper` usa `createPortal(modal, document.body)` — o modal renderiza fora da árvore React, então qualquer `z-index` num div pai no caller é **ignorado pelo browser**. Wrapping com `<div z-[10000]>` em `App.jsx` era ineficaz. Correto: passar `zIndex='z-[10001]'` diretamente como prop ao `ModalWrapper` via `Onboarding`. **Invariante:** ao empilhar modais com portal sobre layers fixos, sempre passar `zIndex` por prop, nunca via wrapper pai. |
| ConsentModal invisível sobre landing após seleção de perfil | v1.0.13 | `ConsentModal` usa `fixed z-50` próprio (não `ModalWrapper`) — `z-50 = 50`, abaixo da landing `z-[9999]`. O wrapper `div z-[10000]` em `App.jsx` era ignorado pelo mesmo motivo: `fixed` interno cria stacking context próprio. Corrigido adicionando prop `zIndex` ao `ConsentModal` e passando `z-[10001]` quando `showLanding=true`. **Regra geral:** todo componente com `position: fixed` interno ignora z-index do pai — sempre controlar via prop direta. |
| Steps 1–7 do Onboarding invisíveis sobre landing (segundo ModalWrapper sem zIndex) | v1.0.15 | `Onboarding.jsx` tem dois retornos com `ModalWrapper`: step 0 (seleção de perfil) recebia `zIndex={zIndex}`, mas o segundo `ModalWrapper` (steps 1–7) não. Ao clicar "Próximo" o componente renderizava sem z-index — abaixo da landing `z-[9999]`, parecendo que o app voltava à landing. Fix: passar `zIndex={zIndex}` em TODOS os `ModalWrapper` do `Onboarding.jsx`. Regra: se um componente retorna `ModalWrapper` em múltiplos branches, todos devem receber o mesmo `zIndex`. |
| Onboarding não avança mesmo com zIndex correto — causa raiz definitiva | v1.0.17 | O `ModalWrapper` chama `root.setAttribute('aria-hidden', 'true')` ao montar. O browser bloqueia silenciosamente quando um elemento dentro do `#root` tem foco ativo — `LandingScreen` tinha `autoFocus` no botão "Entrar". O browser emite warning `"Blocked aria-hidden on an element because its descendant retained focus"` mas não lança erro — React processa normalmente, mas os eventos do dialog ficam comprometidos. Fix em duas partes: (1) remover `autoFocus` do botão da landing; (2) prop `skipAriaHidden=true` no `ModalWrapper` quando landing está ativa — não seta `aria-hidden` no `#root` nessa situação. **Invariante:** nunca misturar `autoFocus` em elemento dentro do `#root` com modais que setam `aria-hidden` no `#root`. |
| `API_BASE` hardcoded causava CORS no dev server | v1.0.17 | `constants/index.js` usava `"http://localhost:8001"` fixo. Proxy do Vite (`vite.config.js`) só funciona com URLs relativas (sem hostname). Solução: `API_BASE` detecta ambiente via `import.meta.env.DEV` — dev usa `''`, Electron (com `window.tusab`) e produção usam `'http://localhost:8001'`. |
| `aria-hidden` no backdrop do ModalWrapper | v1.0.11 | Estava escondendo a própria modal do leitor de tela — bug de acessibilidade invertido. Corrigido |
| Endpoint `/_debug/paths` em produção | v1.0.1 | Expunha paths do filesystem. Removido |
| `google-generativeai` SDK legado | v1.0.8 | Eliminado do requirements.txt — substituído pelo SDK atual |
| `allow_origins=["*"]` no CORS | < v1.0.8 | Fix de segurança aplicado em v1.0.8 (12 fixes de segurança nessa sprint) |
| Pill/segmented control nas sub-abas | v1.0.11 | Inconsistência visual com aba de Extração (que já usava underline). Unificado para `border-b-2` |
| Score mínimo BM25 adaptativo por tamanho de corpus | v1.0.11–v1.0.26 | Threshold adaptativo (0.15/0.25/0.35/0.5 por corpus size) substituído por `score > 0` + FTS5 como rede de segurança. Qualquer threshold arbitrário corta chunks BM25-legítimos de termos frequentes. A combinação score>0 + FTS5 é mais robusta que qualquer threshold estático ou adaptativo. |

---

## O que funcionou bem — padrões a preservar

| Padrão | Versão | Por que funciona |
|--------|--------|-----------------|
| Escrita atômica `.tmp + os.replace()` | Desde o início | Arquivo sempre íntegro mesmo com crash; idempotente; sem arquivo corrompido em disco |
| `RLock` em `state_lock` | v1.0.8 | LogRedirector reentrante — qualquer `print()` dentro de locked region voltava ao lock; `RLock` permite reentrada |
| Histórico server-side no chat | v1.0.8 | Evita payload manipulado pelo cliente injetar contexto falso. `_MAX_HIST_MSGS = 12` limita acumulação |
| `TUSAB_DATA_DIR` env var | Desde o início | Permite testes isolados e Electron packaged sem alterar código |
| Shims na raiz (`motor_tusab.py`, `agent_tusab.py`) | v1.0.1 | Electron e código legado importam pelo nome antigo; zero breaking change |
| Parser WhatsApp linha a linha (não findall) | v1.0.10 | `findall` perdia mensagens multilinha; iteração linha a linha captura continuações |
| Estado de download Ollama no `AgentTab` (não no filho) | v1.0.11 | OllamaSetup desmonta ao trocar sub-aba; estado no pai sobrevive |
| `createPortal` + `aria-hidden` no `#root` | v1.0.11 | Screen readers vêem apenas a modal; foco restaurado ao fechar; padrão robusto para modais aninhadas |
| Dependência acíclica `api → agent|motor → storage` | Desde a modularização | Evita imports circulares que causariam ImportError silencioso ou comportamento inesperado |
| `mcp_server.py` nunca importa `state.py` | v1.0.10 | `state.py` seta `sys.stdout = LogRedirector()` — contaminaria o canal stdio do MCP com prints |
| Chunking com overlap | v1.0.8+ | Ideias na fronteira de dois chunks aparecem em ambos os candidatos BM25 |
| Score mínimo adaptativo por corpus | v1.0.11 | Corpus grande tem scores BM25 naturalmente menores; threshold fixo eliminava resultados válidos |
| `random.sample()` para amostragem de corpus | v1.0.11 | Garante cobertura de todo o corpus nos flashcards, não apenas dos primeiros chunks |
| Classificação de intenção paralela ao BM25 | v1.0.25 | Submit do future antes do BM25 → classificação LLM sobreposta com busca local → overhead zero no caso BUSCA (mais comum) |
| `_intent_executor` module-level | v1.0.25 | `ThreadPoolExecutor` criado uma vez no import do módulo — evita overhead de criação de thread por request no hot path do chat |
| Frases de loading com dicas de uso | v1.0.25 | Usuário aprende como perguntar melhor enquanto aguarda resposta — zero fricção de onboarding |
| SQLite FTS5 como camada de exact-match paralela ao BM25 | v1.0.26 | BM25 falha em termos frequentes (IDF baixo) e quando KeyBERT dilui o campo texto. FTS5 com `unicode61 remove_diacritics 2` garante recall de termos literais independente do BM25. Merge: BM25 ranqueia, FTS5 garante que nada óbvio fique de fora. Score simbólico 0.1 para chunks FTS-only mantém CrossEncoder como árbitro final. |
| `texto_original` para corpus BM25 (não campo KeyBERT) | v1.0.26 | KeyBERT enriquece o índice para cobertura de sinônimos mas inflaciona IDF dos termos originais. BM25 deve receber `texto_original` (sem keywords sintéticas) para scoring preciso. KeyBERT contribui apenas no campo `texto` persistido no índice, não no corpus de scoring em memória. |
| `np.max` para agregação multi-query (não `np.mean`) | v1.0.26 | Query expansion gera variantes da pergunta; `np.mean` dilui o melhor score quando variantes menos relevantes pontuam baixo. `np.max` preserva o sinal: chunk que responde bem a qualquer variante deve ser recuperado. |
| Deduplicação FTS5+BM25 com fallback `chunk_{rid}` | v1.0.26 | Docs PDF/texto têm `titulo=None` e `timestamp_inicio=None` — deduplicação por esses campos colapsava chunks distintos. Chave robusta: `titulo or f'chunk_{rid}'`. Descoberto pelo agente de integração antes do merge. |
| `canalChat` desacoplado de `canalConfigurado` | v1.0.26 | Estado único compartilhado causava conflito: mudar canal de extração resetava base do chat e vice-versa. Separados em dois estados com localStorage distintos (`tusab_canal_chat` / `tusab_canal_configurado`). Extração e chat são fluxos independentes e devem permanecer assim. |
| `streamId` por envio para identidade de stream | v1.0.27 | `setChatMessages` com `msgs.length-1` atingia a mensagem errada quando havia fila ativa (`[user, queued, assistant_streaming]`). Fix: `streamId = stream_${Date.now()}_${Math.random()}` criado antes do loading; todas as atualizações usam `prev.map(m => m._streamId === streamId ? ... : m)`. Identidade por valor, nunca por posição — padrão obrigatório para qualquer future feature que adicione itens ao array de chat. |
| Saudações forçam `CONVERSA` com verificação dupla | v1.0.27 | `_SAUDACOES` expandido para PT-BR/EN/ES. Verificação pós-classificador (`pergunta_lower_strip in _SAUDACOES`) em `chat()` e `chat_stream()` força `CONVERSA` mesmo que o LLM retorne `BUSCA` para inputs curtos. O classificador é conservador por design — a lista hardcoded é a defesa correta para 1–2 palavras. |
| `@@busca` no chat como atalho de busca BM25 inline | v1.0.27 | `@@termo` (2+ chars) chama `buscarTrechos` na base ativa — mesma pipeline BM25+CrossEncoder do Repositório, mas inline no chat. Resultados no dropdown com highlight do termo em âmbar. Selecionar injeta trecho como contexto fixo com chip ciano na bolha. `@arquivo` lista arquivos do projeto e fixa um arquivo específico para o BM25 filtrar. Cache dos arquivos em `mencaoArquivosRef` (ref, não estado) — invalida ao trocar projeto. |
| `HighlightTrecho` no Repositório | v1.0.27 | Termo buscado destacado com `<mark>` + fundo âmbar nos trechos de resultado da busca do Repositório. Regex case-insensitive com escape de chars especiais. Mesmo padrão visual usado no dropdown `@@` do chat — consistência deliberada. |
| Design System com tokens medidos por grep (não estimados) | v1.0.34 | `Documentação do Produto/Design System — Tusab.md` deriva a escala tipográfica e demais tokens contando ocorrências reais no código (ex.: 266× `text-xs`, 252× `text-[10px]`) em vez de prescrever valores teóricos. Agente guardião `/design-system` exige essa mesma medição real antes de aprovar qualquer token novo — evita que a documentação de design divirja do código, o mesmo tipo de apodrecimento que gerou as 5 dívidas de consistência encontradas no inventário (StatCard, ConsentModal, z-index inline, help.html duplicando tema, sombras ad-hoc). |

---

## Invariantes técnicas — nunca violar

1. **`sub_langs = 'pt'` fixo no yt-dlp** — tentativas duplas causam rate limit 429
2. **`RLock` em `state_lock`, nunca `Lock`** — LogRedirector reentrante
3. **Shims na raiz são re-exports puros** — não adicionar lógica neles
4. **`mcp_server.py` nunca importa `tusab_engine.state`** — corromperia stdio
5. **Slug `profissional` nunca renomear** sem migração de localStorage — quebraria onboarding silenciosamente
6. **Escrita em disco sempre atômica** — `.tmp + os.replace()`, mesmo volume
7. **Histórico de chat é server-side** — payload do cliente para histórico é ignorado
8. **`api/` nunca importado por `agent/` ou `motor/`** — dependência acíclica obrigatória
9. **`VITE_POSTHOG_KEY` nunca commitado** — fica em `web_interface/.env`
10. **`credentials.json` e `token.json` nunca no bundle Electron** — não aparecem no `filter` do `extraResources`
11. **yt-dlp sempre local no IP do usuário** — princípio intocável
12. **`createPortal` sempre com segundo argumento `document.body`** — omitir causa React error #299 ("Target container is not a DOM element") que crasha o componente inteiro ao tentar renderizar o portal. Verificar todo novo uso.
13. **`sandbox: false` obrigatório em `webPreferences` do Electron** — Electron 20+ ativa sandbox por padrão nos preloads, bloqueando `require()` de Node built-ins. Resultado em cascata: `preload.js` falha → `window.tusab = undefined` → `API_BASE` cai para `localhost` → CORS bloqueia `127.0.0.1:8001` → app inteiro inoperante. O bug não aparece em dev (só no `.exe` instalado). **Checklist obrigatório antes de publicar**: abrir DevTools no app instalado → Console → verificar `window.tusab !== undefined`. Corrigido em v1.0.31.
14. **Nunca testar apenas o backend em dev antes de publicar** — smoke suite valida FastAPI, não o packaging Electron. Bugs de sandbox, asar e paths só aparecem no instalador em máquina limpa. Ver item 13 e checklist em `agents/qa.md` (itens 6–8).
15. **`electron/python_env` deve estar sincronizado com `requirements.txt`** — o python_env empacotado é um ambiente separado do `.venv` de dev; instalar no `.venv` NÃO instala no instalador. Em jul/2026 o Monitor chegou zerado aos usuários porque `psutil` nunca foi instalado no python_env (openpyxl idem — export XLSX quebrado). Antes de cada build: diff `pip list` do python_env contra requirements.txt. Exceção deliberada: torch/sentence-transformers/scikit-learn/keybert (~2,5 GB) ficam fora por tamanho — Busca Ampla e KeyBERT degradam graciosamente no app empacotado (decisão pendente de revisão de produto).
16. **`_intent_executor` nunca recriar por request** — `ThreadPoolExecutor` é module-level em `chat.py`; recriá-lo por chamada causaria vazamento de threads e overhead no hot path do chat.
17. **Chat stream acumula `resposta_acumulada` no `except`** — o stream SSE emite texto puro (não JSON) na maioria dos chunks; `json.loads()` lança, e o `except` deve fazer `resposta_acumulada.append(chunk)` — nunca `pass`. Romper isso torna `last_chat_response` vazio e o classificador CONTEXTO completamente inativo.
18. **`api_key: '__keep__'` ao salvar config parcial** — ao mudar só `ollama_model` ou `persona`, usar o sentinel `'__keep__'` para não zerar chaves de providers externos. Backend interpreta `'__keep__'` mantendo o valor atual em `agent_config.json`.
19. **`canalAtualAtivo` no modal de base usa só `canalConfigurado`, sem fallback para `agentStatus.canal_indexado`** — `agentStatus` é estado do servidor e não muda com cliques no modal. Fallback para `agentStatus` impede que desmarcar reflita no visual. Seleção do modal = escolha explícita do usuário, nunca inferida do backend.
20. **`fts.py/_fts_path` sanitiza `canal_prefixo` localmente** — não depender da sanitização do chamador. `re.sub(r'[^\w\-]', '_', prefixo)` antes de compor o path. Defesa em profundidade contra path traversal mesmo que o router já sanitize.
21. **Nome do asset `.exe` na GitHub Release deve ser exatamente o que o `electron-builder` gera (com espaços, ex. `Tusab Setup 1.0.35.exe`) ou o equivalente com hífens (`Tusab-Setup-1.0.35.exe`) — nunca com pontos.** O `latest.yml` gerado sempre declara o nome com hífens (`GitHubProvider.js: p.replace(/ /g, "-")` no `electron-updater`), e a URL de download é montada a partir desse valor. Renomear o asset manualmente para `Tusab.Setup.X.exe` (padrão observado em publicações manuais de v1.0.28 a v1.0.35) faz a URL que o auto-updater solicita retornar 404 — confirmado por teste direto (`curl -I`) nas releases v1.0.30 a v1.0.35. O instalador funcionava para quem baixava manualmente pelo README, mas o auto-update estava silenciosamente quebrado para todo mundo. **Fix retroativo (06/jul/2026):** asset com nome correto (`Tusab-Setup-X.exe`) reenviado em v1.0.30, v1.0.31, v1.0.32, v1.0.33 e v1.0.35 — todos os 5 confirmados com `curl -I` retornando 302. Nome antigo (pontos) mantido como alias em cada release para não quebrar links já compartilhados. v1.0.28 não tinha `latest.yml` publicado — não participava do auto-update de qualquer forma, sem necessidade de fix. **Checklist antes de publicar uma release:** `curl -sI <url exata do path no latest.yml>` deve retornar 302, nunca 404.
22. **`electron-builder` publicando em repositório diferente de onde o CI roda exige PAT, nunca `GITHUB_TOKEN`.** `electron/package.json::publish.owner/repo` aponta para `ahaugusto/tusab-public`; `.github/workflows/release.yml` roda em `ahaugusto/tusab`. O `GITHUB_TOKEN` automático do GitHub Actions só tem permissão no repositório local — cruzar para outro repo (mesmo do mesmo dono) retorna `403 Forbidden — "Resource not accessible by integration"`. Corrigido com secret `RELEASE_PAT` (Personal Access Token, escopo `repo`). **Descoberto tarde:** o pipeline existia desde jun/2026 mas falhava desde a v1.0.22 (29/jun/2026) sem que ninguém percebesse — 15 releases seguintes (v1.0.23–v1.0.37) foram feitas manualmente, ninguém checou `gh run list` para saber se o automático ainda funcionava.
    **Complemento (24/jul/2026):** o `.github/workflows/release.yml` também existe no próprio `ahaugusto/tusab-public` (mesmo commit, os dois repos têm a árvore inteira). Dar push de uma tag diretamente no `public` dispara o `release.yml` **daquele repositório**, que roda com os *secrets* do `public`, não os do `origin` — são dois cofres de secrets independentes por repositório, mesmo sendo do mesmo dono. `RELEASE_PAT` precisa existir **nos dois** (`ahaugusto/tusab` e `ahaugusto/tusab-public`), com o mesmo valor de token, ou o job do repo que estiver sem o secret falha com `Error: GitHub Personal Access Token is not set` (`GH_TOKEN` vazio, não mascarado no log — sinal de secret ausente, diferente do 403 de token presente mas sem permissão). Confirmado em v1.0.39: `origin` tinha o secret e publicou corretamente (viu a release já existente e pulou, sem erro); `public` não tinha, falhou; corrigido recriando o PAT (o anterior havia sido perdido) e configurando em ambos os repos — re-run confirmou sucesso.

23. **Publicar release manualmente via `gh release create` exige incluir o `latest.yml`, não só `.exe`/`.blockmap`.** Descoberto na v1.0.40 (27/jul/2026): a release parecia completa (download manual funcionava), mas o `electron-updater` de uma instalação em v1.0.39 falhou ao "Verificar atualização" com `Cannot find latest.yml in the latest release artifacts ... 404`. O `dist_electron/latest.yml` gerado pelo `electron-builder` nunca foi anexado — passou despercebido porque não há teste automatizado que dispara uma checagem real de update contra uma release publicada (isso exigiria uma instalação anterior real, fora do escopo do smoke suite). Fix: `gh release upload vX.Y.Z dist_electron/latest.yml --repo <owner>/<repo>` nos dois repositórios. Checklist de publicação atualizado em `agents/qa.md` (item 9) para sempre conferir os 3 arquivos antes de considerar a release completa.

---

## Bugs mapeados pela auditoria de jornadas v1.0.19 — status e prioridade

Auditoria completa de 17 jornadas realizada em jun/2026 identificou os seguintes itens abertos:

| ID | Arquivo | Severidade | Descrição | Status |
|----|---------|-----------|-----------|--------|
| FAIL-01 | App.jsx:91, usePerfil.js:8 | MÉDIO | `activeTab='extracao'` default incompatível com perfil `estudante` — useEffect corrige em seguida mas há frame de aba inválida | Aberto |
| FAIL-02 | ExtractionModal.jsx:44, App.jsx:723 | ALTO | Fluxo normal sem canal nunca passa pelo step de URL — `POST /start` com canal vazio possível quando usuário abre modal sem canal configurado | Aberto |
| FAIL-03 | web_interface/src/services/api.js:203 | CRÍTICO | `limparCanal()` chama `DELETE /neural/limpar` sem parâmetro `canal` — apaga arquivos de **todos** os projetos. Backend aceita `canal` como parâmetro opcional mas frontend não envia | **Corrigido v1.0.20** |
| WARN-13 | useChatEngine.js:286 | MÉDIO | Fila de chat cheia (6ª msg): mensagem descartada silenciosamente sem feedback ao usuário | Corrigido |
| WARN-15 | ChatDrawer.jsx:293 | MÉDIO | Falha de export (docx/pdf/xlsx): apenas `console.warn`, sem toast ou mensagem de erro na UI | Corrigido |
| WARN-19 | useAgentConfig.js:97 | ALTO | Sync de idioma envia `api_key: ''` ao backend — pode zerar chave externa se backend não tiver proteção para campo vazio | Corrigido |
| WARN-21 | App.jsx:1086 | BAIXO | Banner de update invisível na HomeScreen (`!showHome` condition) — usuário na home não via notificação de atualização | **Corrigido v1.0.35** — removida a condição `!showHome`; banner é `fixed` e renderiza corretamente sobre qualquer tela |
| WARN-23 | App.jsx:1628 | BAIXO | Fechar painel Drive durante OAuth não cancelava o fluxo — OAuth continuava em background sem feedback | **Corrigido v1.0.35** — toggle switch agora chama `handleDriveCancel()` quando fecha o painel com `driveStatus === 'em_progresso'` |
| WARN-25 | App.jsx:1592 | **Corrigido (24/jul/2026)** | Chip de perfil some quando Drive autenticado | Era decisão deliberada de espaço no header, mas impedia trocar de perfil sem antes desconectar o Drive — sem alternativa na UI. Reclassificado de "intencional" para bug real após relato de usuário. Fix: os dois chips (perfil + Drive) agora coexistem lado a lado (`flex-wrap`), sem exclusividade mútua |
| WARN-31 | App.jsx:446 | MÉDIO | `Shift+R` com perfil estudante mudaria `activeTab='extracao'` mesmo com aba filtrada por `regras.abas` | Já corrigido — handler checa `regras.abas?.includes('extracao')` antes de trocar de aba |

**Bugs já corrigidos nesta sprint (não reabrir):**
- FAIL-05: `Shift+C` usava `setChatOpen(true)` direto — snack não era removido. Fix: `handleOpenChat()` + `useCallback`
- FAIL-SR: `Shift+R` não chamava `setShowHome(false)` — HomeScreen bloqueava UI
- FAIL-03: `limparCanal()` sem `canal` apagava todos os projetos. Fix: frontend passa `canal_nome`, backend filtra por subdir
- WARN-19: sync de idioma enviava `api_key:''` zerando chave. Fix: sentinel `'__keep__'`
- FAIL-02: ExtractionModal pulava step de URL. Fix: `stepInicial='url'` quando `!canalJaConfigurado`
- WARN-13: mensagem de chat descartada silenciosamente. Fix: input não é limpo quando fila cheia
- WARN-15: falha de export sem feedback. Fix: snackbar vermelho com i18n
- FAIL-01: aba inválida para perfil estudante. Fix: lazy initializer lê PERFIS_CONFIG do localStorage
- **createPortal sem `document.body` (v1.0.20)**: modal "Indexar base" no RepositorioTab crashava com React #299. Análise estática não detectou — descoberto por teste manual. Fix: adicionar `document.body` como segundo argumento.

---

## Decisões técnicas não-óbvias que parecem erros mas não são

| Parece erro | É na verdade |
|-------------|-------------|
| `tusab_engine()` tem o mesmo nome do pacote | Sem conflito — está em `motor/extraction.py`, não no `__init__.py` |
| `NEURAL_DIR` em vez de `cerebro/` | Nomenclatura técnica neutra; `CEREBRO_DIR = NEURAL_DIR` mantém backward-compat |
| `dispatch_event()` em vez de `print()` direto | API de eventos estruturada para facilitar migração futura do LogRedirector |
| `agent_config.json` relido a cada request de config | Permite que o arquivo seja editado manualmente sem reiniciar o servidor |
| `_chat_history/` com prefixo `_` em texts/ | Prefixo `_` sinaliza ao indexador para ignorar por padrão; usuário controla quando injetar |
| `ProSnackbar` presente mas `pro = False` hardcoded | Infraestrutura de licença pronta para ativar; não é dead code |

---

## Benchmark — ferramentas open-source avaliadas (jul/2026)

Avaliação sob demanda (Augusto, 07/jul/2026) de três ferramentas candidatas a integração/inspiração, cruzadas com `/memoria`, `/produto` e `/backend`. Nenhuma foi adotada. Registrado para não reavaliar do zero se a pergunta voltar.

### Hyper-Extract (yifanfeng97) — CLI de extração de conhecimento estruturado

**O que é:** transforma texto não estruturado em 8 estruturas (listas, grafos, hypergraphs, grafos espaço-temporais); 10+ engines (GraphRAG, LightRAG, Hyper-RAG, KG-Gen); 80+ templates YAML por domínio; MCP server (`he-mcp`) nativo; suporte a Claude Opus/Sonnet/Haiku.

| Dimensão | Tusab hoje | Hyper-Extract | Vereditos |
|---|---|---|---|
| Estrutura de saída | Chunks BM25 + FTS5 + keywords KeyBERT (texto plano enriquecido) | Grafos/hypergraphs/espaço-temporais via LLM | Tusab não constrói grafo — decisão deliberada, não lacuna |
| Custo de indexação | BM25 ~1ms, determinístico, CPU puro, sem chamada de rede | 1 chamada de LLM por chunk para extrair entidades/relações | Hyper-Extract multiplicaria custo de indexação por N chamadas de LLM — inviável no fluxo síncrono de indexação do B2C |
| MCP | `mcp_server.py` já expõe `search_knowledge`/`list_projects` | `he-mcp` expõe grafos extraídos | Sem sobreposição de propósito nem urgência de interoperar agora |

**Veredito:** não adotar no B2C. Reafirma a decisão já registrada de GraphRAG (linha "Experimentos que falharam") — corpus atual (YouTube + PDFs avulsos) tem baixa densidade relacional, e o custo de LLM-por-chunk contradiz BM25 como fundação determinística. Único destino plausível: cofre da stack semântica B2B Enterprise (torch/CrossEncoder/KeyBERT), ao lado do que já está reservado ali — gatilho: primeiro lead concreto + corpus institucional denso o suficiente para grafo valer a pena.

### PageIndex (VectifyAI) — RAG "vectorless" baseado em reasoning

**O que é:** gera árvore hierárquica (tipo sumário) de um documento via LLM, depois o LLM navega essa árvore por tree search para recuperar seções. Sem vector DB, sem chunking. Claim de 98.7% no FinanceBench (documentos financeiros longos).

| Dimensão | Tusab hoje | PageIndex | Veredito |
|---|---|---|---|
| Retrieval | BM25 + FTS5, determinístico, sem LLM na busca | LLM navega a árvore a cada busca | Contradiz a decisão permanente "BM25 como fundação" (rápido, determinístico, CPU puro) |
| Latência por pergunta | ~1ms (Busca Restrita), +236ms (Busca Ampla c/ CrossEncoder) | 1+ chamadas de LLM por busca — segundos, não ms | Reintroduz o mesmo tipo de custo que já reprovou query expansion para Ollama (3s→15s) |
| Pré-requisito de LLM | BM25 funciona sem nenhum provider configurado | Árvore só existe se um LLM a construiu na indexação | Quebra o caso "Estudante extrai sem Ollama configurado ainda" |
| Ideia aproveitável | Título pesado 5x no corpus BM25 | Estrutura hierárquica (headings) como sinal | Extrair headings via regex (sem LLM) como metadado de seção é evolução barata compatível com P1 — não a lib inteira |

**Veredito:** não adotar a lib. A única ideia com mérito — usar estrutura do documento como sinal de retrieval — já existe em forma equivalente e mais barata (peso de título no corpus). Nota de roadmap de baixíssima prioridade, não ação imediata.

### OpenScience (synthetic-sciences) — workbench de agente de pesquisa científica

**O que é:** agente autônomo que lê literatura, forma hipótese, escreve/roda código, roda experimentos, escreve resultado. Multi-provider BYOK, 290+ skills, ~30 bancos científicos (arXiv, PubMed, PDB, ChEMBL, OpenAlex, Semantic Scholar).

**Primeira leitura (indexação/componente):** sem superfície de integração — não é lib de RAG, não mapeia para `index.py`/`fts.py`/`chat.py`. Descartado por incompatibilidade de domínio.

**Segunda leitura, pedida por Augusto — feature para o perfil Pesquisador:** aqui a avaliação muda. Separar duas coisas:
1. **Workbench completo** (rodar código, orquestrar experimentos, formar hipótese) — scope creep genuíno. Nenhum perfil do Tusab tem esse job; contradiz "UX não-técnica" e o Tusab vira outro produto.
2. **Nova fonte de extração** (buscar literatura em arXiv/PubMed/Semantic Scholar e indexar como qualquer PDF) — coerente. Mesmo padrão de YouTube/PDF/WhatsApp: busca, baixa, indexa localmente, cita fonte exata. Pesquisador já é definido como "RAG sobre PDFs + docs + privacidade absoluta" — buscar o paper certo e trazer para dentro da base é extensão natural do JTBD, não redefinição.

**Veredito:** não adotar o workbench. Cabe como item de roadmap "Fonte: arXiv/PubMed/Semantic Scholar" ao lado das fontes existentes — pequeno, testável em <2 sprints, sem LLM-per-document, sem custo de compute pesado. **Não ataca a janela estratégica de 12–18 meses** (não defende contra NotebookLM/AnythingLLM) — é expansão lateral de valor para o Pesquisador, a ser priorizada conscientemente contra P0-c/P1 que constroem a barreira defensável real.

**Atualização (07/jul/2026) — saiu do papel:** a fatia "busca no arXiv" foi implementada como feature real (não o workbench completo, nem PubMed/Semantic Scholar ainda). Toggle "Canal do YouTube" vs. "Buscar no arXiv" no `ExtractionModal`, visível só para o perfil `pesquisador`. Novo módulo `tusab_engine/motor/arxiv.py` (API pública Atom XML, sem autenticação, `time.sleep(3)` entre requisições) + endpoints `POST /arxiv/search|cancel`, `GET /arxiv/status`. Reaproveita o mesmo contrato de `_manifest.json`/cabeçalho `TITULO/FONTE/DATA` do upload manual (`router_repositorio.py::cerebro_upload()`) — não introduz um pipeline de indexação novo, só uma origem nova de PDF. Estado isolado em `state.py` (`arxiv_running`/`arxiv_stats`) — deliberadamente **não** reaproveita `state.stats`/`run_motor()` do YouTube, que são acoplados a conceitos de vídeo (`videos_processed`, parsing de emoji do `LogRedirector`). ClinicalTrials.gov/ChEMBL/PubChem/PDB/Ensembl permanecem fora de escopo — documentados em `Documentação do Produto/Tusab Saúde — Proposta Estratégica.md` como próximos passos do vertical B2B Enterprise, não do perfil Pesquisador B2C.

### Headroom (headroomlabs-ai) — camada de compressão de contexto para agentes de IA

**O que é:** biblioteca/proxy/MCP server que comprime tool outputs, logs, chunks de RAG, arquivos e histórico de conversa antes de chegar ao LLM (60–95% menos tokens em JSON, 15–20% em código). `ContentRouter` escolhe compressor por tipo: `SmartCrusher` (JSON), `CodeCompressor` (AST), `Kompress-v2-base` (prosa, modelo local HuggingFace). 100% local, sem chamada de rede.

**Veredito: não adotar agora.** Dois motivos:
1. Parcialmente redundante — o Tusab já reduz volume de prompt por **seleção** (score mínimo adaptativo, CrossEncoder top-12→top-6, `_MAX_HIST_MSGS=12`), não por compressão de texto. Nunca precisou dessa categoria porque BM25 já filtra bem na fonte.
2. Risco real, não hipotético: o invariante já registrado "`texto_original` para corpus BM25, não campo KeyBERT" (v1.0.26, seção "O que funcionou bem") existe justamente para nunca deixar uma transformação de texto contaminar o que é citado como fonte. Headroom comprimiria esse mesmo `texto_original` antes da citação — e `Kompress-v2-base` é modelo neural, não determinístico como BM25, sem garantia medida de preservar citabilidade exata. Contradiz a promessa de "cita a fonte exata".

**Se algum dia fizer sentido:** só para comprimir histórico de chat (texto já gerado, não fonte citável) em corpus muito grande + Ollama de contexto pequeno — nunca os chunks recuperados. Nota de baixíssima prioridade, mesmo tratamento de PageIndex.

### Pocket TTS (kyutai-labs) — text-to-speech local, CPU-only

**O que é:** modelo TTS 100M parâmetros, roda em CPU (~200ms latência ao primeiro chunk, ~6x tempo real numa CPU de MacBook Air M4, 2 cores), streaming de áudio, voice cloning, multi-idioma incluindo PT. Requer PyTorch 2.5+ (CPU-only).

**Veredito inicial:** promissor — fecha o gap "Audio Overviews" listado como desvantagem vs. NotebookLM (`agents/produto.md`), com vantagem de posicionamento que o concorrente cloud não pode alegar (100% local, sem custo de API). Perfil que mais se beneficia: Estudante (ouvir resumo de vídeo no trajeto).

**Medição real (07/jul/2026):** instalado torch 2.12.1 CPU-only + pocket-tts no `.venv` de dev para medir de verdade, não estimar. Resultado: **torch sozinho ocupa ~530MB em disco** (não os ~200MB estimados a partir do wheel comprimido de 124.9MB — o pacote descompactado/instalado é ~4x maior) — sozinho já maior que a stack CrossEncoder+KeyBERT+scikit-learn inteira (~2,5GB, mas essa soma três libs, não uma). Total torch+pocket-tts+deps: 544MB. Instalador B2C atual: 213,7MB (v1.0.35).

**Decisão final (Augusto, 07/jul/2026):** mesmo padrão já usado para o Modo Estudo (desabilitado desde v1.0.24) e para CrossEncoder/KeyBERT — reservar para uma futura **build Beta/Enterprise**, nunca no instalador B2C padrão. `pocket-tts` adicionado a `requirements-enterprise.txt` (mesmo arquivo que já hospeda `torch` para a stack semântica — sem duplicar decisão).

**Saiu do papel — implementado (07/jul/2026):** novo módulo `tusab_engine/agent/tts.py` (`tts_disponivel()`, `limpar_para_audio()` — remove markdown antes de sintetizar, `sintetizar_audio()` com lazy-load do modelo) + endpoints `POST /agent/tts`, `GET /agent/tts/status` em `router_estudo.py`. Botão "🔊 Ouvir resumo" em `EstudoTab.jsx` — só aparece quando `GET /agent/tts/status` confirma a stack instalada; build B2C nunca mostra o botão. Testado de ponta a ponta em dev (síntese real gerou WAV válido, 245KB para uma frase de teste). Suite de testes (`tests/test_tts.py`) usa mock para não depender de download de pesos em CI. **Decisão relacionada registrada no roadmap (`Documentação do Produto/Roadmap.md`, P0-f):** promover Modo Estudo a aba de primeiro nível exclusiva do perfil Estudante — adiado deliberadamente, não implementado nesta entrega, para não misturar escopo com o TTS.

### Meetily (Zackriya-Solutions) — captura + transcrição local de reuniões

**O que é:** app desktop (Tauri, Rust+TypeScript) que grava áudio de reunião (microfone + áudio do sistema simultaneamente), transcreve 100% local via Whisper ou Parakeet (NVIDIA), resume via LLM (Ollama local ou APIs externas). MIT, open-source, 22,6k stars. Foco declarado: setores regulamentados (legal, saúde, defesa) que não podem mandar reunião sensível para SaaS (Otter.ai, Fireflies).

**Avaliado (Augusto, 10/jul/2026):** território genuinamente novo — nunca avaliado antes, sem decisão prévia sobre captura de áudio.

**Onde bate com o Tusab:** o parser `_detectar_formato_especial()` (`router_repositorio.py`) já estrutura transcrições de Zoom/Otter/Teams **já prontas** — mas o Tusab nunca captura áudio, é sempre pós-fato (usuário exporta de algum SaaS e faz upload). Meetily preenche exatamente essa lacuna anterior no funil, com a mesma tese de local-first já usada para YouTube.

**Onde não bate — stack, não conceito:** Meetily é Rust+Tauri; Tusab é Electron+Python/FastAPI. Não é "importar código" — seria reescrever do zero ou rodar como segundo processo/segunda stack de build, contrariando a arquitetura de "um instalador, uma stack". Captura de áudio de sistema (loopback WASAPI no Windows) é funcionalidade **inteiramente nova** para o Tusab — mais parecido com construir um subproduto do que adicionar uma fonte (diferente de arXiv, que reaproveitou 100% do pipeline de upload/manifest já existente).

**Relação com o roadmap já registrado:** `agents/produto.md` já cita "Modelos multimodais locais (Whisper, LLaVA)" como movimento de mercado a antecipar em 12–24 meses — mas como transcrição de áudio **já existente** (vídeo sem legenda), não captura ao vivo de reunião. São coisas diferentes.

**Veredito:** não adotar/integrar Meetily. A ideia de "Tusab grava sua própria reunião" é coerente com o produto e útil (perfil Especialista com reuniões de cliente sensíveis; vertical B2B Enterprise — hospitais/conselhos, mesma tese do documento Tusab Saúde), mas é projeto de esforço muito maior que qualquer feature recente: nova stack de captura de áudio por plataforma, nova UI (start/stop, indicador ao vivo), superfície de teste inteiramente nova. Não é candidato de "próxima feature" — é candidato de sprint dedicado, registrado aqui para não reavaliar do zero se a pergunta voltar, sem entrar no roadmap ativo por ora.

### Geração de documento estruturado com citação por seção — feature genérica do Especialista, jurídico como caso de uso (jul/2026, avaliado, não implementado)

**Contexto:** Augusto propôs originalmente um perfil "Consultor" ou expansão do Especialista para documentos jurídicos. Nunca avaliado antes — território novo, sem menção prévia a "jurídico"/"advogado"/"Direito" em nenhum documento do projeto. A ideia evoluiu em quatro iterações na mesma conversa, registradas em ordem porque cada uma descartou a anterior por motivo técnico ou de produto real, terminando numa formulação bem mais ampla que a proposta inicial:

**Iteração 1 — buscar jurisprudência via API pública (padrão arXiv/FHIR).** Pesquisado: Akoma Ntoso/LegalDocML (padrão OASIS, equivalente jurídico do FHIR, mas sem adoção brasileira — só legislation.gov.uk e Finlex) e a API Pública Datajud do CNJ (chave pública sem cadastro, mesmo padrão de acesso do HAPI FHIR). **Testado de verdade, dois problemas reais encontrados:** (1) a API do Datajud deu timeout puro no ambiente de teste (TCP conecta, servidor nunca responde) enquanto o HAPI FHIR respondeu normalmente no mesmo teste — sugere IP-fencing do lado do CNJ contra datacenter/cloud, não falha de rede genérica; (2) confirmado via pesquisa que o Datajud **não retorna texto integral de decisões**, só metadados de processo (número, partes, movimentações, classe) — sem valor substantivo para RAG, diferente do Narrative do FHIR ou do PDF completo do arXiv. Descartada.

**Iteração 2 — parser de template + resumo consolidado multi-documento (ainda jurídico-específico).** Augusto reformulou: em vez de buscar externamente, reconhecer estrutura de documentos jurídicos que o usuário já tem (petição, contrato, parecer — mesmo padrão de `_detectar_formato_especial()` já usado para WhatsApp/Zoom/Teams/Otter em `router_repositorio.py`) e gerar um resumo consolidado de vários documentos de um caso, generalizando `agent/summarize.py::resumir_video()` (hoje só resume 1 vídeo por vez) para operar sobre um conjunto. Elimina os dois problemas técnicos da iteração 1. Boa direção, mas ainda incompleta — resumo passivo não é o JTBD real, e ainda restrito a Direito.

**Iteração 3 — assistente de organização e redação de peças (ainda jurídico-específico).** Augusto: "o que um advogado precisa hoje é juntar documentos suficientes de maneira organizada para trabalhar a escrita de petições, ações etc." Muda o produto de "resumir passivamente" para **research assistant para redação** — mais próximo do que Harvey AI/CoCounsel fazem no mercado jurídico (nenhum é local-first). Decomposto: (1) organização por caso já funciona hoje sem feature nova — "projeto" (`data/neural/{projeto}/`) já é a unidade certa; (2) o que falta é o modo de output — não chat conversacional curto (já existe), e sim rascunho estruturado por seções (fatos, fundamentos, pedidos) com citação obrigatória por seção, não só fonte ao final da resposta como hoje; (3) parser de template extrai campos estruturados (partes, datas, valores, cláusulas) para alimentar o rascunho.

**Iteração 4 — generalização (formulação final, Augusto: "isso nem vale só pra área jurídica, vale pra todas").** O insight de fundo não é específico de Direito: qualquer perfil que organiza documentos de um projeto/caso e precisa produzir um documento estruturado a partir deles tem o mesmo JTBD — consultor de negócios montando proposta a partir de reuniões, pesquisador montando artigo a partir de fontes, profissional de RH montando parecer. **A feature correta é genérica do perfil Especialista**: "gerar rascunho estruturado por seções, com citação obrigatória de fonte por seção, a partir dos documentos de um projeto" — jurídico (petição) é só o caso de uso que revelou o padrão, não o produto. O parser de template jurídico-específico (extrair partes/datas/cláusulas de petições) vira um plugin/especialização dentro dessa capacidade geral, não o centro da feature.

**Veredito:** nenhuma das quatro iterações implementada — registrado para não reavaliar do zero se a pergunta voltar. A formulação final (iteração 4) é a única com JTBD real, diferenciado e sem se prender a um único domínio — mas é ordem de grandeza maior que qualquer feature recente (arXiv/FHIR foram extensões pequenas de um padrão já validado; isto é um modo de output inteiramente novo no pipeline — geração estruturada multi-seção com citação obrigatória por seção, não presente em nenhuma camada atual, que hoje só faz chat conversacional com fonte ao final). Perfil: evolução do Especialista (`profissional`, já "consultar múltiplas bases com respostas precisas e fontes verificáveis"), não perfil novo — confirma a decisão já tomada de perfis por tipo de uso, não por profissão. Camada: B2C — o usuário é dono dos próprios documentos, sensibilidade é sigilo profissional (argumento de venda do local-first), não barreira de compliance como Saúde. Sem lead nem sinal de demanda real (diferente do arXiv, que veio de necessidade observável do Pesquisador já em produção) — não entra no roadmap ativo.

**Ferramentas open-source jurídicas avaliadas (Augusto perguntou "temos ferramentas que podem nos amparar?"), nenhuma adotada:**

- **RAGFlow** (infiniflow/ragflow) — engine RAG open-source (Go+Python+TS, Apache 2.0) com "citação rastreável" — conceito próximo do que a iteração 4 precisa. Mas arquitetura pesada: Docker Compose com Elasticsearch/Infinity + MySQL + MinIO + Redis, ≥16GB RAM recomendado. Contradiz frontalmente a identidade do Tusab (1 clique, offline, CPU-only, instalador ~440MB). Não vale trazer como dependência — o conceito (citação obrigatória por seção) é reaproveitável, o código não.
- **LexML Brasil** — portal federado de legislação/jurisprudência brasileira, API SRU (padrão Library of Congress), formato XML. **Testado de verdade:** a API retornou uma página de "Verificação de segurança" (WAF/challenge JS do Senado Federal) em vez de dados, mesmo com User-Agent de navegador — bloqueio estrutural a requisições automatizadas, não específico deste ambiente. Além disso, mesmo quando acessível via navegador, o portal só tem metadados descritivos com **links para os sites das instituições** que hospedam o texto integral — não serve o conteúdo diretamente, mesma limitação do Datajud.
- **Datajud/CNJ** — já testado e descartado na iteração 1 (timeout de rede + sem texto integral).
- **awesome-legal-data** (openlegaldata) — lista curada de datasets jurídicos; recursos brasileiros listados (LexML, DOU, STF, STJ, CNJ, Jusbrasil, vLex) são todos portais de busca/scraping, nenhum com API de conteúdo aberta e testável como o arXiv.

**Padrão identificado:** infraestrutura pública de dados jurídicos no Brasil (Datajud, LexML) tende a bloquear acesso automatizado ou só publicar metadados — diferente da infraestrutura internacional (arXiv, HAPI FHIR), que é aberta de propósito para esse uso. Isso não é "ajustar o código depois" — é barreira estrutural do lado do provedor. **Nenhuma fonte brasileira testada até agora se qualifica como "arXiv/FHIR do Direito".** Se a busca por fonte externa jurídica voltar a ser cogitada, começar testando de novo antes de assumir que algo mudou (portais públicos às vezes abrem/fecham acesso automatizado sem aviso).

**O que É implementável hoje sem depender de nada externo:** as duas peças que operam só sobre documentos que o usuário já sobe — (1) parser de template jurídico, extensão de `_detectar_formato_especial()`, sem lib nova (regex, mesmo padrão do WhatsApp/Zoom); (2) geração de documento estruturado com citação por seção, extensão do pipeline `chat.py` já existente, sem lib jurídica externa nenhuma.

**Atualização (jul/2026) — peça 1 saiu do papel.** `_detectar_formato_especial()` (`router_repositorio.py`) reconhece petição (vocativo "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ" tradicional ou "Ao Juízo da..." pós-reforma do CPC), contrato (cláusulas numeradas — "CLÁUSULA PRIMEIRA"/"1ª"/"I") e parecer (cabeçalho "PARECER JURÍDICO" ou "Ementa:"). Nova função `_parsear_documento_juridico()` extrai campos (tipo de documento, cláusulas identificadas com título, CPF/CNPJ das partes via regex, ementa do parecer) e prefixa o texto original com um cabeçalho estruturado — mesmo espírito de `_parsear_whatsapp()`/`_parsear_reuniao()`: melhora chunking sem perder conteúdo. Integrado também a PDF e DOCX (não só `.txt`/`.md` como o parser de reuniões), já que petições/contratos reais em geral são PDF — a detecção roda sobre o texto já extraído, antes da escrita em disco. 15 testes novos (`tests/test_documento_juridico.py`), suite completa 73/73 verde. Peça 2 (geração de documento estruturado com citação por seção) segue não implementada — é o modo de output novo, ordem de grandeza maior, ainda sem lead real.

**Bug pré-existente descoberto durante os testes (não corrigido, fora de escopo desta feature):** o regex de detecção de WhatsApp Android (`wapp_android` em `_detectar_formato_especial()`) exige hífen (`[-–]`) mesmo no formato com colchetes (`[DD/MM/AAAA, HH:MM:SS] Nome:`), mas o próprio comentário do código mostra esse formato sem hífen. Um export real de WhatsApp nesse formato específico não seria detectado. Registrado aqui para correção futura — não mexido nesta rodada para não misturar escopo com a feature de documentos jurídicos.

### Unlimited-OCR (baidu/Unlimited-OCR, HuggingFace) — não adotado (jul/2026)

**O que é:** modelo de OCR/parsing de documentos da Baidu, 3B parâmetros, safetensors BF16, "parsing de longo horizonte em um único disparo" (imagens, múltiplas páginas, PDFs completos). Licença MIT. Uso via `transformers`, vLLM ou SGLang. Benchmark ParseBench citado: 86,81% de conteúdo textual, 46,17% de desempenho médio geral.

**Veredito: não adotar — desqualificado por requisito de hardware.** Documentação confirma teste com "CUDA12.9" e não menciona suporte nativo a CPU — **requer GPU NVIDIA**. Isso contradiz diretamente o princípio CPU-only já estabelecido no projeto, o mesmo motivo que vetou CrossEncoder/KeyBERT do instalador B2C (reservados à stack semântica Beta/Enterprise) e reservou torch/Pocket TTS à mesma edição. Um modelo de 3B parâmetros com GPU obrigatória está ainda mais distante do B2C do que essas duas exclusões já registradas.

**Também seria substituição, não adição, sem ganho claro:** o Tusab já tem OCR funcional e leve — Tesseract (CPU puro) com fallback/preferência por Ollama multimodal (llava/gemma3, também CPU-only via Ollama), ver `router_repositorio.py::_extrair_imagem()`. Trocar um pipeline CPU-only e já funcional por um modelo GPU-obrigatório de 86,8% de acurácia (não excepcional) não compensa o custo de infraestrutura.

**Se algum dia fizer sentido:** só como opção adicional na futura stack Beta/Enterprise (que já assume GPU/hardware corporativo em alguns cenários), nunca como substituição do caminho B2C. Nota de baixíssima prioridade, mesmo tratamento dado a PageIndex/Headroom.

### OpenWorker (andrewyng/openworker) — não adotado, mas achado real sobre o MCP Server do Tusab (jul/2026)

**O que é:** assistente de IA desktop de Andrew Ng — "entrega trabalho finalizado, não só chat". Orquestra 25+ conectores (Slack, GitHub, Jira, Notion, Gmail, calendário) para produzir deliverables (documentos, planilhas, respostas), com gates de aprovação antes de ações consequentes, suporte a MCP, multi-provider LLM (incluindo Ollama local). Stack: Python + React/Vite + **Tauri (Rust)**, MIT, roda em CPU.

**Veredito: não adotar.** Categoria de produto diferente — "agentic worker" (orquestração de ferramentas externas pra produzir entregáveis) vs. PKM/RAG focado do Tusab (indexar fontes, conversar com citação exata). Não é ameaça competitiva (não disputa o mesmo usuário/JTBD que NotebookLM/AnythingLLM) nem inspiração direta de feature — adotar o escopo do OpenWorker seria construir outro produto. Stack incompatível (Tauri/Rust, não Electron) — mesmo obstáculo já registrado para o Meetily.

**Achado real, já corrigido:** o MCP Server do Tusab (`tusab_engine/mcp_server.py`, stdio JSON-RPC 2.0 padrão, tools `search_knowledge`/`list_projects`) já é consumível por qualquer cliente MCP — incluindo, presumivelmente, o OpenWorker, que declara suporte a MCP. Não é "trazer o OpenWorker pro Tusab", é o inverso: o Tusab já pode ser uma ferramenta que agentes de orquestração chamam, sem nenhuma mudança de código. **Mas essa capacidade estava invisível no produto** — o endpoint `GET /agent/mcp/config` (gera o JSON pronto pra colar em `.cursor/mcp.json`) existia desde antes, mas não tinha nenhuma exposição: zero UI, zero FAQ, zero menção em onboarding. Corrigido na mesma sessão: botão "Copiar configuração MCP" na aba Admin, FAQ trilíngue (PT/EN/ES) em `help.html`, menção no onboarding do perfil Especialista (`onboarding.s6_body_profissional`).

### TabFM (google-research) — modelo de fundação para dados tabulares

**O que é:** classificação/regressão zero-shot em CSV/planilhas via in-context learning, scikit-learn compatible, requer JAX ou PyTorch.

**Veredito: fora de escopo, sem necessidade de mais análise.** É predição tabular (categoria de BI/data science), não RAG textual. O Tusab já lida com CSV/XLSX só como texto formatado para o corpus BM25 (`router_repositorio.py`), nunca como dado a prever. Nenhum dos 4 perfis tem JTBD de "prever valor numa planilha" — não é um caso de "avaliado e descartado por razão técnica", é domínio de produto diferente.

### Artigos de arquitetura RAG avaliados (jul/2026) — nenhuma técnica nova, validação externa do que já existe

**"Building a RAG pipeline for 10M documents with near-zero hallucination"** — pipeline `retrieve → constrain → verify → abstain`. Mapeamento direto: retrieve = `_recuperar_contexto()` (BM25+FTS5+CrossEncoder); constrain = chunks como única fonte no prompt; verify = `_verificar_alucinacao()` já existe; abstain = `sem_contexto: True` já existe (mas é binário, não abstenção **calibrada por confiança** — essa nuance é a única lacuna real, nota de baixa prioridade). Reciprocal Rank Fusion mencionado no artigo é mais formal que a fusão BM25+FTS5 atual (união com score simbólico 0.1 para FTS5-only, v1.0.26) — vale nota de melhoria incremental, não adoção de arquitetura nova. LanceDB do artigo já está no roadmap (Sprint 5/P5).

**"Vectorless RAG: building retrieval systems without embeddings or vector databases"** — tese "keyword matching > semantic similarity em produção, infraestrutura vetorial cara em escala" **valida, não contradiz**, a decisão já registrada "BM25 como fundação + CrossEncoder como upgrade opcional". Evidência externa a favor de uma escolha já feita por razões próprias (custo, latência, CPU-only).

**Não avaliado (artigo sobre Python 3.15):** conteúdo do artigo estava atrás de paywall — só teaser disponível (lazy imports, rollback do GC incremental do 3.14). Sem profundidade suficiente para avaliar impacto no Tusab (que roda em Python 3.12/3.14 conforme ambiente, ver `requirements.txt`). Não requer ação — Python 3.15 ainda não é dependência do projeto.

### LanceDB — benchmark real antes de migrar (jul/2026)

**Contexto:** o roadmap (`Documentação do Produto/Roadmap.md`, "Sprint 5 — LanceDB") já tinha um plano técnico detalhado escrito, mas nunca implementado nem validado contra a biblioteca real. Antes de migrar `index.py`/`chat.py`, medido de verdade com `lancedb==0.34.0` (instalado em `.venv` de dev) — a API do plano estava desatualizada: `create_fts_index()` está deprecada, API atual é `tbl.create_index(coluna, config=FTS())`.

**Benchmark real** (corpus sintético, sem depender de dados reais escassos no projeto):

| Cenário | BM25Okapi (atual) | LanceDB FTS nativo |
|---|---|---|
| Indexação completa — 2.000 chunks | 40ms | 195ms |
| Query aquecida — 2.000 chunks | 5,4ms | 5,4ms (empate) |
| Indexação completa — 10.000 chunks | 238ms | 459ms |
| Query aquecida — 10.000 chunks | 17ms | 8ms (LanceDB 2x mais rápido) |
| **Adicionar 10 chunks a corpus de 10k** | **214ms (reindexação total)** | **18ms (append incremental)** |

**Conclusão:** a motivação real do roadmap nunca foi velocidade de query pura — era o custo de reindexar tudo do zero a cada mudança pequena, que cresce proporcionalmente ao tamanho do corpus. O benchmark confirma isso: BM25Okapi ganha em indexação do zero (mais leve), mas perde feio no cenário que mais importa em uso real — adicionar poucos itens a uma base já grande (~12x mais lento que o append do LanceDB, a 10k chunks). Query pura empata em corpus pequeno, LanceDB vence em corpus maior.

**LanceDB não substitui BM25 como algoritmo — tem BM25/FTS nativo embutido.** Não são dois motores de ranking concorrentes; é uma troca de onde os dados vivem (JSON+pickle em memória vs. tabela Arrow em disco com índice FTS nativo). "Ter os dois" só faz sentido como período de transição/A-B test, nunca como arquitetura permanente (duas fontes de verdade para o mesmo corpus é risco de inconsistência sem benefício líquido).

**Status:** plano de roadmap confirmado nos fundamentos pelo benchmark real, mas ainda não implementado em código de produção — API do plano escrito precisa ser atualizada antes da Fase 1 (`create_fts_index` → `create_index(coluna, config=FTS())`).

### Lematização em português — benchmark real, não adotada (jul/2026)

**Proposta avaliada (Augusto, 10/jul/2026):** usar lematização (spaCy `pt_core_news_sm`) no pipeline BM25 para resolver variação morfológica ("investindo"/"investiu"/"investimento" → mesmo lema) — classe de problema diferente da query expansion (que resolve sinônimos, não morfologia). Nunca avaliada antes.

**Medição real** (não estimada — mesma disciplina do benchmark LanceDB): modelo baixado via HuggingFace (`raw.githubusercontent.com` bloqueado no sandbox de rede, HF funcionou) — **12,4MB comprimido, 16MB descompactado**, mesma ordem de grandeza do CrossEncoder (~80MB) já em produção B2C. Testado num venv isolado e depois no `.venv` de dev, removido ao final (zero resíduo).

**Benchmark de recall** — corpus real (26 transcrições do canal FGV), 12 perguntas (6 pares, mesma raiz morfológica cada):

| Métrica | BM25 puro (RAW) | BM25 + lematização |
|---|---|---|
| Tempo de indexação (26 docs) | 96,6ms | 62.961,9ms |
| Overhead | — | **651x mais lento** |
| Concordância de top-1 com RAW | — | 4/12 (33%) |

**Dois problemas reais, não hipotéticos:**
1. **Custo:** 651x de overhead de indexação é proibitivo — mesmo em corpus pequeno (26 docs), passou de <100ms para quase 1 minuto. Corpus real de usuário (centenas de vídeos) tornaria a indexação impraticável no fluxo síncrono atual.
2. **Qualidade não previsível:** teste manual de lematização (`nlp("Estou investindo... Já investi... pretendo investir...")`) mostrou o lematizador errando em vocabulário comum — `"pretendo"` → `"preter"` (deveria ser `"pretender"`), e `"investi"` não lematizado para `"investir"`. Isso não é caso de borda de jargão técnico — é erro em português cotidiano, do modelo estatístico geral (treinado em notícias). Resultado prático: top-1 mudou em 67% das perguntas testadas, sem padrão claro de melhora.

**Veredito:** não adotar. O overhead por si só já reprova a proposta (contradiz o mesmo motivo que descartou BM25S e reprovou query expansion para Ollama — latência inaceitável), e o ganho de qualidade nem se comprova no teste real. KeyBERT (já em produção) e query expansion (já em produção para providers cloud) continuam sendo os mecanismos corretos para esse tipo de gap — lematização seria redundante em resultado e cara em custo.

### FHIR — formato viável para fonte de dados clínicos, ainda não priorizado (jul/2026)

**Contexto:** avaliado junto com lematização (Augusto, 10/jul/2026), no âmbito do vertical `Tusab Saúde — Proposta Estratégica.md`, que já mapeia ClinicalTrials.gov/ChEMBL/PubChem/PDB/Ensembl como fontes candidatas de v2/v3 (nenhuma implementada).

**Achado técnico:** todo recurso FHIR (`Patient`, `Observation`, `ResearchStudy` etc.) tem um campo padronizado `text.div` (Narrative) — resumo em HTML feito para leitura humana, obrigatório por spec. Isso muda a viabilidade técnica frente às outras fontes já mapeadas: não seria preciso parsear o schema JSON/XML tipado inteiro (referências cruzadas, campos estruturados) — bastaria extrair `text.div`, limpar o HTML (mesmo padrão de `_detectar_formato_especial()` usado para WhatsApp/Zoom em `router_repositorio.py`), e indexar como texto corrido. Mais barato tecnicamente que ClinicalTrials.gov, que exigiria schema de indexação próprio.

**`ResearchStudy`** é o recurso FHIR específico para ensaios clínicos — descreve propósito, patrocinador, condição estudada; equivalente estruturado ao que ClinicalTrials.gov já expõe via API.

**Status:** não implementado, não priorizado, para o vertical Tusab Saúde (B2B) — mesma regra de entrada de sempre (2+ segmentos educacionais em produção + lead concreto). Registrado como nota técnica na tabela de fontes candidatas do documento de Saúde, ao lado de ClinicalTrials.gov/ChEMBL/PDB/Ensembl.

**Atualização (10/jul/2026) — saiu do papel, mas no perfil Pesquisador B2C, não no vertical Saúde:** Augusto decidiu implementar a busca FHIR como fonte do perfil Pesquisador (mesmo padrão do arXiv), não como parte do futuro Tusab Saúde/B2B. Escopo restrito deliberadamente a `ResearchStudy` — descartado `Patient` e qualquer outro resource type que modele indivíduo, mesmo sintético/teste, para não contradizer "privacidade absoluta" do perfil Pesquisador B2C (confirmado com o usuário antes de implementar). Novo módulo `tusab_engine/motor/fhir.py`, endpoints `POST /fhir/search|cancel`, `GET /fhir/status`, toggle de 3 fontes no `ExtractionModal` (YouTube/arXiv/FHIR), estado isolado `fhir_running`/`fhir_cancel`/`fhir_stats` em `state.py` (mesmo padrão do arXiv, mesmo motivo de não reaproveitar `state.stats`).

**Achado prático do teste real (não hipotético) contra `hapi.fhir.org/baseR4`:** o servidor público de sandbox tem poucos `ResearchStudy` com `text.div` preenchido de verdade — a maioria só tem `title`+`status`; até o único registro "com narrative" encontrado tinha um placeholder vazio (`"[Put rendering here]"`), tratado explicitamente pelo parser (`_parsear_resource()` ignora esse texto). `Patient`, por outro lado, tem narrative rico no mesmo servidor — reforça a decisão de escopo (mais fácil de indexar, mas errado por natureza de dado). Resultado prático: o `.txt` gerado hoje contra o sandbox público é magro (título + status, às vezes description/condition) — funcional e correto, mas de baixo valor de busca até que um servidor institucional mais rico (ex: futuro Tusab Saúde) entre em cena. Parser já preparado para isso (extrai todo campo disponível, sem exigir narrative).

12 testes novos (`tests/test_fhir.py`) cobrindo parser de Narrative HTML, `CodeableConcept` (FHIR usa tanto string simples quanto `{text, coding:[...]}`), placeholder de narrative vazio, fallback para campos estruturados, resource type inesperado no bundle (defesa em profundidade), e erro parcial não derruba o lote. Suite completa: 58/58 verde. Testado também contra o servidor real (sem mock) antes do commit — 1 estudo salvo de verdade a partir de `hapi.fhir.org`.

**Atualização (27/jul/2026) — busca ao vivo removida do Pesquisador; virou leitor de formato.** Uso real revelou o problema de fundo: `ResearchStudy` não é um registro central pesquisável — é um formato de interoperabilidade que cada instituição usa pra expor os próprios estudos. Testado ao vivo contra os únicos servidores públicos conhecidos: `hapi.fhir.org` (0 resultados pra qualquer termo testado — HIV/cancer/diabetes/covid/heart/study, inclusive busca sem filtro retornou `total: 4` sem nenhuma entrada recuperável) e `r4.smarthealthit.org` (49 registros reais, mas quase todos variações do mesmo estudo de "Fight Retinal Blindness!" — zero pra cancer/diabetes/heart). Nenhum servidor público serve como "arXiv de estudos clínicos".

Avaliado em seguida trazer **ClinicalTrials.gov** (API v2, pública, sem auth) pro perfil Pesquisador como alternativa de escala mundial — confirmado ao vivo: 10.094 resultados só pra "HIV", cobertura genuinamente internacional (Tanzânia/Uganda/Romênia/EUA nos 5 primeiros), texto substantivo (`briefSummary`/`detailedDescription`, não só metadado). Decisão do Augusto: **não trazer pro Pesquisador** — faria o perfil virar implicitamente "pesquisador da área de saúde", contradizendo o proposito do perfil (pesquisa acadêmica geral, arXiv-first). ClinicalTrials.gov fica reservado para o vertical **Tusab Saúde (B2B)**, reforçando a segmentação original de 10/jul/2026 — a "atualização" daquela data que trouxe FHIR pro Pesquisador foi, em retrospecto, a exceção equivocada; ClinicalTrials.gov não repete o erro.

FHIR no Pesquisador muda de "busca numa API pública" para "leitura de um Bundle que o usuário já tem" (export do FHIR de uma instituição/universidade com acesso legítimo) — mesmo padrão de PDF/DOCX/WhatsApp/documento jurídico: upload no Repositório, detecção automática de formato, parsing com as mesmas funções já escritas (`_parsear_resource()`, `_limpar_narrative_html()`, `_extrair_campo_texto()` em `fhir.py`). Endpoints `POST /fhir/search|cancel`/`GET /fhir/status` e o toggle de fonte no `ExtractionModal` removidos — a live search não tinha valor real de qualquer forma, dado o achado acima.

**Atualização (27/jul/2026) — arXiv também ocultado do Pesquisador; Tusab Saúde vira vertical de perfil único.** Depois de reservar ClinicalTrials.gov para o Tusab Saúde (acima), Augusto reconsiderou o próprio perfil Pesquisador: ao pensar em "área de conhecimento" (Saúde/Tecnologia/Humanas etc.) como seletor dentro do Pesquisador, concluiu que misturar arXiv (pesquisa acadêmica geral) com fontes de saúde no mesmo perfil B2C sempre ia empurrar o Pesquisador pra virar implicitamente "pesquisador de saúde". Decisão: em vez de generalizar o Pesquisador por área, **o Tusab Saúde vira uma vertical de perfil único** — não um dos 4 perfis atuais (Estudante/Especialista/Pesquisador/Professor) nem uma opção dentro do Pesquisador, mas um produto dedicado que herda toda a base técnica já construída (arXiv, leitura de Bundle FHIR, e o ClinicalTrials.gov já avaliado acima) quando for lançado.

Implementação inicial: `regras.arxiv = false` em `usePerfil.js` (antes `true`) — oculta o toggle YouTube/arXiv, sem apagar nenhum código. **Revertido no mesmo dia** (ver atualização abaixo) — não ficou vigente.

**Atualização (27/jul/2026, ainda no mesmo dia) — registro genérico de fontes públicas por área de conhecimento; arXiv volta, compartilhado com o Tusab Saúde.** Augusto trouxe um documento técnico da Equipe NDTI/DECIT/SCTIE (Ministério da Saúde) catalogando 105 endpoints de API pública em 9 áreas de conhecimento (científica, tecnologia, economia, direito, saúde, terra/clima, física/química, patrimônio cultural, antropologia/linguística) e pediu implementação **generalista** — "qualquer pesquisador possa baixar dados de bases públicas, a depender da área" — não mais restrito à saúde. Isso supera a decisão anterior de reservar tudo pro Tusab Saúde.

**Mapeamento ao vivo das 9 áreas** (1 endpoint por área, testado sem mock): todas têm pelo menos 1 fonte real sem cadastro. Três padrões técnicos distintos identificados — busca→documento em 2 chamadas (PubMed, The Met, Câmara dos Deputados), dado estruturado não-narrativo que precisaria virar texto corrido (World Bank, IBGE, Open-Meteo, PubChem/property), e SPARQL com template de query próprio (Wikidata/DBpedia/Getty) — confirmando que um adaptador único não serve pras 9 áreas.

**Arquitetura escolhida:** registro genérico em `tusab_engine/motor/fontes/` — cada fonte é um módulo pequeno com `{FONTE_META, buscar()}`; `_base.py` concentra o laço comum (salvar .txt, manifest, throttle, cancelamento) que só existia duplicado em `arxiv.py`/`fhir.py` antes. Um único endpoint genérico `POST /fontes/{fonte_id}/search` (+ `/cancel`, `/status`, `GET /fontes` pra listar) substitui o padrão anterior de um endpoint dedicado por fonte — não escalaria pras dezenas de fontes mapeadas. Estado por fonte em `state.fontes_publicas_state` (dict populado sob demanda), não mais um `arxiv_running`/`arxiv_cancel`/`arxiv_stats` fixo por fonte.

**Área 1 (Produção científica e literatura) implementada e testada ao vivo com dado real:** arXiv (via `arxiv_adapter.py`, wrapper sobre `arxiv.py` original — não reescrito), OpenAlex (491k resultados pra um termo, abstract real via reconstrução do formato invertido), Europe PMC (exige `resultType=core` pra vir com abstract), DataCite (prioriza `descriptionType=Abstract`), DOAJ, Zenodo (description em HTML, limpo no parser). Busca real por "hiv stigma" salvou 11 documentos reais nas 6 fontes simultaneamente, verificado via curl direto no backend rodando. Semantic Scholar (429 imediato sem chave), SciELO (endpoint desatualizado) e PapersWithCode (redirect, API mudou) ficaram de fora desta rodada — candidatos pra revisão futura. BDTD/Lattes/CAPES excluídos — sem REST, confirmado pelo próprio documento fonte.

**Área 2 (Tecnologia, IA e ciência de dados), 28/jul/2026:** GitHub (busca real de repositórios + **README completo** via `GET /repos/{owner}/{repo}/readme`, decodificado de base64 — não só a descrição de uma linha; rate limit sem token é 60/h pro resto da API vs 10/min só pra busca, então README é best-effort com fallback gracioso pra descrição sozinha se a chamada falhar) e Stack Overflow (corpo real da pergunta via `filter=withbody`, quota 300/dia sem chave). PyPI descartado — achado importante: o endpoint documentado (`/{package}/json`) é lookup por nome exato, **não existe busca por palavra-chave** com resposta JSON na API pública da PyPI (só a página HTML `/search/?q=`). Hugging Face Datasets, OpenML, UCI ML Repository também descartados — sem descrição narrativa real no retorno de busca. Kaggle e Common Crawl exigem cadastro/não cabem no padrão.

**Leitor de página web avulsa (trafilatura), 28/jul/2026** — não é fonte por área, é capability nova no Repositório (`POST /neural/url`, ao lado de "colar texto"). Motivado por pergunta recorrente do Augusto sobre usar o Anakin-Inc (scraper com anti-detect/evasão de bot) pra esse fim — reavaliado três vezes na mesma conversa, veredito final: Anakin continua descartado (AGPL-3.0 + evasão de bot deliberada, ver entrada anterior), mas a necessidade real ("trazer conteúdo de página avulsa pra base") é legítima e foi implementada com **trafilatura** (Apache-2.0, 6.355 estrelas, ativo — confirmado ao vivo via `gh api`). Comparado também com Crawl4AI (Apache-2.0, 75k estrelas, mais robusto pra JS via Playwright, mas exige browser headless — candidato futuro se páginas dinâmicas virarem necessidade real). Respeita `robots.txt` sempre (`urllib.robotparser`, biblioteca padrão) — testado ao vivo contra `en.wikipedia.org`, que de fato bloqueia esse user-agent, confirmando que o respeito à regra funciona na prática, não só em teoria.

**Área 3 (Economia, finanças e ciências sociais), 28/jul/2026 — a mais pobre das 9 em fontes viáveis.** Confirma o problema estrutural identificado no mapeamento inicial: quase toda fonte de dado econômico é indicador+país (lookup), não busca por tema livre. World Bank Open Data tem ~29.500 indicadores mas **nenhum endpoint de busca por palavra-chave** — só listagem paginada; buscar por tema exigiria baixar o catálogo inteiro e filtrar localmente, arquitetura diferente da busca ao vivo usada aqui. IBGE/Ipeadata expõem série por código, não por tema (erro de sintaxe OData no Ipeadata, sem investir mais tempo). UN Data (handlers legados) devolveu erro interno de servidor. `dados.gov.br` retornou 401 no endpoint de busca documentado (pode ter mudado desde a "verificação" original). **Único candidato real: Banco Central do Brasil** (`dadosabertos.bcb.gov.br`, portal CKAN) — busca real por palavra-chave, descrição narrativa real (campo `notes`), sem chave. Testado ao vivo: busca por "inflação" trouxe 3 datasets reais e salvos. Área implementada com essa única fonte — mais estreita que 1/2, mas honesta.

**Área 4 (Direito, normas, legislação e governo), 28/jul/2026.** Senado Federal tem dois endpoints de "matéria/processo": o documentado (`materia/pesquisa/lista`) está oficialmente depreciado desde 18/mar/2025; o substituto oficial (`/dadosabertos/processo`) **não filtra por palavra-chave de verdade** — testado ao vivo com termo comum ("inteligência artificial") e termo raro ("xenotransplante"), ambos retornaram o mesmo total de 10.702 registros, confirmando que o parâmetro é ignorado. **Câmara dos Deputados** confirmada — achado importante: diferente do Datajud (rejeitado antes por só ter metadado processual, sem texto integral), a Câmara expõe `urlInteiroTeor` — PDF real com o texto completo da proposição. Testado ao vivo: um PL sobre regulação de IA virou 7 páginas de texto extraído via `pdfplumber` (mesmo padrão de `arxiv.py`). Busca em 3 chamadas por item (busca → detalhe → PDF), best-effort com fallback pra ementa. Confirma que a rejeição do Datajud foi específica ao Datajud, não generalizável a "toda fonte jurídica brasileira".

**LexML — confirmado bloqueado por anti-bot ao vivo (28/jul/2026), não só "sem REST".** Augusto pediu especificamente por "leis brasileiras publicadas" (não projetos em tramitação) e perguntou sobre LexML/JusBrasil como não-governamentais. Testado ao vivo: `www.lexml.gov.br/busca/SRU` devolve status 200, mas o conteúdo real é uma página de "Verificação de segurança — Senado Federal" (challenge anti-bot tipo Cloudflare) — reproduzido em dois termos de busca diferentes, não é falha pontual. Isso é bloqueio automatizado real, mesmo padrão já rejeitado no Datajud e no Anakin — não contornado, por princípio já estabelecido. JusBrasil: `api.jusbrasil.com.br` retorna 403, `/developers` redireciona — sem API pública documentada, plataforma comercial paga (já registrado como território não testado na avaliação da proposta de APIs jurídicas). Nenhum dos dois vira fonte.

**Achado que resolveu o pedido — Senado Federal, endpoint de Legislação (diferente do de Matéria/Processo).** `/dadosabertos/legislacao/lista?tipo=LEI` é um serviço **diferente** do `/processo` testado antes — retorna leis já **publicadas/sancionadas**, não propostas em tramitação. Testado ao vivo: leis reais recentes (nº 15.476/2026, 23/jul/2026) com ementa oficial real. Sem parâmetro de busca por palavra-chave no servidor (`ementa=`, `assunto=`, `palavraChave=`, `dataInicio`/`dataFim` — todos testados ao vivo, nenhum filtra), mas o dataset completo (`tipo=LEI` sem filtro) veio numa chamada só, ~8,5MB, 16.834 leis — bem menor que os ~29,5mil indicadores do World Bank (que exigiriam paginação). Implementado com filtro client-side por palavra na ementa (AND entre termos). Texto integral não disponível — o link de detalhe aponta pra `normas.leg.br`, uma SPA em Angular que não renderiza sem JS (trafilatura não resolve; Diário Oficial exige credencial INLABS, como já mapeado). Testado ao vivo: busca por "idoso" salvou 3 leis reais. Área 4 fecha com 2 fontes: Câmara (proposições, inteiro teor) + Senado/Legislação (leis publicadas, ementa).

**Área 5 (Saúde, biologia e genética), 28/jul/2026 — reabre e resolve a decisão do Tusab Saúde.** Antes de implementar, checado explicitamente com Augusto se essa área deveria entrar no registro do Pesquisador (já que reabre a mesma discussão de ClinicalTrials.gov reservado pro vertical Tusab Saúde). Resposta: **implementar normalmente**, mesmo princípio já usado pro arXiv — a mesma base técnica atende os dois, sem exclusividade. Implementado com 3 fontes testadas ao vivo: **PubMed** (esearch→efetch em lote — um único efetch pra todos os PMIDs, não um por item; abstract concatenado de múltiplas seções Background/Methods/Results/Conclusion). **ClinicalTrials.gov** (já avaliado extensivamente acima; usa `query.term`, não `query.cond` — mais abrangente, confirmado ao vivo com termo não-clínico "machine learning" trazendo resultados reais). **UniProt** (achado: diferente da maioria dos bancos de bioinformática, que são estruturados/numéricos, tem um campo narrativo real — comentário `FUNCTION`, texto corrido sobre o papel biológico da proteína; confirmado ao vivo com a função real da insulina). Busca real por "hiv stigma" salvou documentos reais nas 3 fontes simultaneamente. MIMIC-III/IV, Ensembl, ChEMBL, GenBank, RCSB ficaram de fora — dado estruturado/numérico ou acesso credenciado a dado sensível, mesmo critério das áreas anteriores.

**Área 6 (Ciências da Terra, clima e espaço), 28/jul/2026 — área com 1 fonte só, mesmo padrão da Área 3.** A maioria dos candidatos é dado numérico/geoespacial puro: Open-Meteo (previsão, série temporal), USGS Earthquake (catálogo geojson estruturado), INMET (estações meteorológicas), Copernicus/USGS EarthExplorer (catálogo de imagem, não documento). NOAA (Climate Data Online) exige token cadastrado — testado ao vivo, `400 Token parameter is required`. **NASA Earthdata (CMR)** confirmado como único candidato com busca real por tema e resumo narrativo — cada coleção tem campo `summary` real (~1,3KB, descreve o dataset e a metodologia), diferente da maioria dos bancos geoespaciais. Testado ao vivo: busca por "deforestation" salvou 2 datasets reais sobre desmatamento na Amazônia e costa da África Ocidental.

**Área 7 (Física, química e materiais), 28/jul/2026 — outra área com 1 fonte só.** PubChem só faz lookup por nome exato de composto (`/compound/name/{nome}/cids/JSON`) — testado ao vivo com "caffeine", devolveu o CID certo, mas não existe busca por tema/palavra-chave livre, mesmo problema já visto na PyPI (Área 2). NOMAD (repositório de cálculo computacional de materiais) tem 817.929 registros pesquisáveis por campo estruturado (`results.material.elements`), mas os campos retornados são puramente numéricos/de cálculo — sem nenhum texto narrativo, confirmado ao vivo inspecionando um registro completo. The Materials Project exige chave; NIST Chemistry WebBook não tem API, só HTML. **CERN Open Data** confirmado como único candidato viável — busca real por tema, abstract real em HTML (limpo no parser, mesmo padrão de zenodo.py). Testado ao vivo: busca por "higgs" trouxe 2 datasets reais sobre candidatos de bóson de Higgs.

**Área 8 (Patrimônio cultural, história e arquivos), 28/jul/2026 — 2 fontes com qualidade de conteúdo bem diferente entre si, ambas aceitas.** **Art Institute of Chicago** tem descrição curatorial narrativa real (~2.700 caracteres, HTML — limpo no parser), sobre artista/contexto/história da obra — melhor qualidade textual encontrada nesta área. **The Metropolitan Museum of Art (The Met)**, ao contrário, **não tem nenhum campo de texto livre** — confirmado ao vivo listando as ~50 chaves de um objeto completo, todas estruturadas (cultura, período, meio, dimensões, crédito, classificação). Implementado por concatenação de campos, mesmo padrão usado em `github.py` antes do enriquecimento com README — conteúdo real mas mais raso, aceito porque ainda é substantivo o bastante (múltiplos campos descritivos, não um único número). Busca em 2 chamadas por item (lista de `objectIDs` → detalhe por objeto). Testado ao vivo: busca por "samurai" salvou 1 obra real de cada fonte simultaneamente.

**Área 9 (Antropologia, linguística e conhecimento estruturado), 28/jul/2026 — fecha o rollout das 9 áreas. 1 fonte, mas a mais surpreendente da rodada.** O candidato óbvio pra "conhecimento estruturado" seria Wikidata — testado ao vivo e descartado: a busca (`wbsearchentities`) retorna um rótulo curtíssimo (`"species of big cat native to the Americas"` pra "jaguar"), sem narrativa real; Wikidata é fatos estruturados (claims/statements), não prosa. DBpedia foi testado em seguida (SPARQL + DBpedia Lookup) e também descartado: abstract em pt frequentemente vazio (`FILTER(lang(?abstract)='pt')` voltou vazio pro recurso testado), e quando existe é o mesmo texto da Wikipédia, só que atrás de um pipeline SPARQL mais frágil. GeoNames exige conta cadastrada (confirmado ao vivo, conta demo bloqueada por limite). Getty Vocabularies e Glottolog são vocabulário/gazetteer estruturado — Glottolog confirmado ao vivo com campo `description` vazio no idioma testado, sem endpoint de busca por termo funcional (406/404 nas rotas tentadas). **A fonte real acabou sendo a própria Wikipédia (MediaWiki Action API)** — descartada implicitamente até então por parecer "óbvia demais", mas é exatamente o único candidato que passa nos 2 critérios: busca full-text real (`list=search`, confirmado ao vivo — "xenotransplante" retorna por relevância, não só título exato) + resumo real em prosa (`prop=extracts&explaintext=1`, testado ao vivo com o artigo "Onça-pintada", ~800 caracteres de texto corrido). Implementado com 2 chamadas totais (não por item): 1 busca + 1 extração batelada de todos os títulos de uma vez, mesmo padrão de pubmed.py. Testado ao vivo: busca por "xenotransplante" salvou 2 artigos reais com URL de origem rastreável (`pt.wikipedia.org/wiki/...`).

**arXiv: dentro ou fora do Pesquisador — decisão final.** Durante a implementação, Augusto pediu pra excluir arXiv do registro ativo (voltando à posição de reservá-lo pro Tusab Saúde) e, na sequência, pediu pra incluí-lo de novo ("pode entrar também como seletor da modal, não?"). Decisão final, explícita: **arXiv fica no registro ativo, compartilhado entre o Pesquisador B2C e o futuro Tusab Saúde — não é exclusivo de nenhum dos dois.** A mesma base técnica (`arxiv_adapter.py`) atende ambos. Flag renomeada de `regras.arxiv` pra `regras.fontes_publicas` em `usePerfil.js` (mais precisa — controla visibilidade de 6 fontes, não só arXiv) e religada (`true`).

**Frontend:** `ExtractionModal.jsx` trocou o step fixo "busca arXiv" por um seletor genérico Área → Fonte (cards com nome + descrição, populados via `GET /fontes`) → tema/palavras-chave → filtros condicionais (autor/data, só se a fonte declarar suporte via `FONTE_META.suporta_autor`/`suporta_data`) → quantidade de resultados. `ExtractionTab.jsx`, `HomeScreen.jsx` e `Onboarding.jsx` generalizados do mesmo jeito (nenhum menciona mais só "arXiv" isoladamente). `sourceTypeInicial`/`fontePreSelecionada` viraram `'youtube' | 'fonte-publica'` (a fonte específica é escolhida dentro do modal, não na tela principal).

**Áreas 2–9 ficam para as próximas iterações** — mesma arquitetura, "vamos começar por área" foi a instrução explícita. Escopo mínimo por área: testar candidatos ao vivo, escolher só fontes sem cadastro/chave com texto narrativo real, implementar como novo módulo em `fontes/`.

**Decisão de processo (Augusto, 07/jul/2026):** toda vez que um checklist de QA rodar, acionar em paralelo `/backend` e `/frontend`, cobrindo tanto a visão B2C (instalador padrão) quanto B2B/Enterprise (build Beta com stack semântica + TTS) — e aproveitar o mesmo ciclo para checar/atualizar dependências desatualizadas (`pip list --outdated`, `npm outdated`). Registrado como protocolo obrigatório em `agents/qa.md`.

### Primeira execução do protocolo de update de stacks (jul/2026)

Primeira aplicação real do protocolo acima, executada de ponta a ponta em 07/jul/2026 — não só "rodar `pip install -U`", mas testar cada grupo com uma chamada funcional real antes de avançar para o próximo:

- **yt-dlp** 2026.6.9→2026.7.4 — validado com mapeamento real de canal do YouTube (`--flat-playlist`), não só mock.
- **SDKs de LLM** (`anthropic` 0.109→0.116, `openai` 2.41→2.44, `google-genai` 2.6→2.10) — `anthropic` testado com chamada real de API (erro de autenticação esperado confirma que o transporte/schema do SDK não quebrou, só a chave de teste era inválida).
- **transformers 5.12→5.13** — CrossEncoder (`ms-marco-MiniLM-L-6-v2`) testado com um par de frases relevante vs. irrelevante; confirmado que o ranking de score continua correto após o update.
- **Frontend** — 12 pacotes (react, vite, framer-motion, axios, posthog-js, etc.), `npm audit fix` zerou 2 vulnerabilidades transitivas, build de produção validado.
- **Conflitos descobertos e resolvidos:** update em lote de dependências de baixo risco quebrou 4 travas transitivas — `protobuf` (google-ai-generativelanguage/google-api-core/grpcio-status exigem `<6.0dev`), `typer` (huggingface-hub exige `<0.26.0`), `mpmath` (sympy exige `<1.4`), `setuptools` (torch exige `<82`). Fix: pin explícito de volta às versões compatíveis. **Lição:** update em lote de dependências de baixo risco pode quebrar travas transitivas de pacotes não tocados diretamente — sempre rodar `pip check` depois, nunca assumir que "patch/minor" é seguro só pelo semver do pacote-alvo.
- **`requirements-lock.txt`** estava defasado desde antes da v1.0.30 (yt-dlp preso em 2026.3.17) — regenerado preservando exatamente o mesmo conjunto de pacotes (nenhuma adição/remoção, só bump de versão), para não misturar a rodada de update com mudança de escopo do lock file.
- **Tailwind 3→4 identificado mas propositalmente não aplicado** — major bump muda o modelo de config inteiro (JS `tailwind.config.js` → CSS-first `@theme`), alto risco sobre as classes `dark:` usadas extensivamente. Decisão: tratar como projeto isolado futuro (branch dedicada + revisão visual completa), nunca dentro de uma rodada de manutenção de rotina.
- Suite (`pytest tests/`) verde (46/46) em cada etapa, nunca só no final — permite isolar rapidamente qual update quebrou o quê, se algo quebrasse.

### Segunda rodada — esteira Dependabot + CI (28-29/jul/2026)

Entre a primeira rodada e agora, a P1-c do roadmap ("esteira de CI/CD pra update de stacks", que estava "sem desenho definido" em 07/jul) foi implementada: `.github/workflows/ci.yml` (pytest + vite build em cada push/PR) e `.github/dependabot.yml` (1 PR por atualização, nunca em lote — a própria lição da primeira rodada virou regra do config, ver comentário no arquivo). Achado no processo desta sessão: **CI roda duplicado hoje**, em `tusab` e `tusab-public` (mesmos commits, mesmo workflow, 2x o tempo de execução) — vira relevante se/quando os repos forem consolidados (ver entrada "Repositório fechado → revisado para source-available").

Triagem de 14 PRs acumulados (abertos desde 24/jul, parados 5 dias — motivo de priorizar isso antes de qualquer esforço de visibilidade do projeto): merge um a um, na ordem GitHub Actions → frontend patch → frontend minor → backend baixo risco → SDKs de LLM → electron-builder (major, mais arriscado, por último). Alguns PRs tiveram conflito de lock file após merges anteriores — resolvido via comentário `@dependabot rebase`, não merge manual de lockfile.

- **electron-builder 25.1.8→26.15.3 (major)** — changelog cobre dezenas de releases intermediárias, incluindo mudança de arquitetura real ("fully replace Go binary app-builder-bin with TS implementation") e mudanças específicas de Windows (invocação de package manager via PowerShell). Verificado com **build real do instalador** (`npx electron-builder --win --dir` num worktree isolado) — pipeline completo rodou (config carregada, native rebuild, download do Electron, empacotamento, assinatura tentada), `Tusab.exe` de 190MB gerado, exit code 0. `python_env`/`bin` ausentes no worktree geraram só warning ("file source doesn't exist"), não erro — são recursos providos separadamente no pipeline de release real, não fazem parte do código-fonte.
- **anthropic 0.116.0→0.119.0 e google-genai 2.10.0→2.14.0** — verificados via changelog (só features/deprecations aditivas, sem breaking change) + teste estrutural (import + instanciação de client com chave dummy). **Sem chamada de rede real** — nenhuma chave de API configurada neste ambiente de dev (`provider: ollama` em `agent_config.json`). Diferente da primeira rodada (que teve chave real disponível para testar `anthropic`) — registrar essa diferença explicitamente em vez de fingir paridade de rigor.
- **sentence-transformers, grpcio-status, tqdm** — patch/minor, sem breaking change nos changelogs, suite completa (166/166) verde após merge combinado de todos os 14.
- **9 pacotes frontend** (posthog-js, react-i18next, postcss, lucide-react, autoprefixer + 3 GitHub Actions + electron-builder) — build de produção (`npx vite build`) limpo após o merge de todos, sem warning novo além do já conhecido (chunk size).

**Lição desta rodada, diferente da primeira:** com CI configurado por PR (achado novo desde a primeira rodada), grande parte da verificação já vem pronta antes de eu tocar em qualquer coisa — o trabalho extra que ainda vale a pena fazer manualmente é o que CI não cobre: build real de instalador pra bumps major de ferramental de empacotamento, e verificação estrutural de SDK quando não há chave real disponível pra teste de rede.

### Anakin (Anakin-Inc/anakin) — não adotado (jul/2026)

**O que é:** API de web scraping open-source em Go — "anti-detect browser" + rotação de proxy + self-hosted, transforma qualquer site em markdown/JSON limpo mesmo com proteção anti-bot. Licença AGPL-3.0, 801 stars.

**Veredito: não adotar.** Dois motivos independentes:
1. **Contradiz postura já testada com Datajud/LexML.** Quando essas fontes jurídicas bloquearam acesso automatizado (timeout/WAF), a decisão do projeto foi desistir da fonte, não contornar o bloqueio — ver seção "Geração de documento estruturado...". O Anakin existe especificamente para contornar esse tipo de proteção; adotá-lo inverteria um princípio já estabelecido, não estenderia um padrão.
2. **Licença AGPL-3.0 incompatível com a edição Enterprise paga já no roadmap** (`Plano B2B — Tusab Enterprise.md`) — cláusula de uso em rede da AGPL pode obrigar a abrir código de qualquer serviço que a utilize. Achado novo, sem precedente de rejeição por licença antes deste caso — mas paralelo direto ao RAGFlow (Apache 2.0, rejeitado por arquitetura pesada: Docker Compose + Elasticsearch/MySQL/MinIO/Redis, ≥16GB RAM, "contradiz 1 clique, offline, CPU-only").

**Se a necessidade real for "extrair conteúdo de páginas web soltas pra base de conhecimento":** parcialmente resolvido hoje via "colar texto" manual. Uma extensão legítima seria um scraper leve que respeita `robots.txt` e não tenta burlar proteção nenhuma — não o Anakin.

### Proposta de "APIs Jurídicas no Ecossistema Tusab" v2 (Datajud/Escavador/Jusbrasil/STF-STJ) — avaliada, não implementada (jul/2026)

**Contexto:** proposta formal recebida de terceiro, sugerindo extração de andamentos processuais/jurisprudência via APIs jurídicas pro RAG local, com motores novos em `tusab_engine/motor/` (`datajud.py`, `escavador.py`), roteamento de IA forçado pra Ollama em conteúdo sensível.

**Avaliação:**
- **Datajud/CNJ e (implicitamente) STF/STJ via portais públicos:** já testados de verdade e descartados na avaliação anterior (iteração 1, seção "Geração de documento estruturado...") — timeout/IP-fencing e ausência de texto integral. Não retestar sem evidência de mudança do lado do provedor.
- **Escavador e Jusbrasil:** território novo — são APIs **comerciais pagas** de terceiros (diferente de Datajud/LexML, que são públicas e gratuitas). Nunca avaliadas antes. Risco de ToS (permissão de redistribuir/reprocessar conteúdo dentro de produto de terceiros), não risco técnico — precisa checagem jurídica antes de qualquer código.
- **Proposta citava `dados/cerebro/` como estrutura atual** — desatualizado; `CEREBRO_DIR` é alias legado de `NEURAL_DIR` (`data/neural/{projeto}/`) desde a renomeação de nomenclatura em jul/2026. Sinal de que a proposta foi escrita sem consultar o estado real do repositório — mesma lição já registrada no Roadmap.md sobre verificar o repo antes de afirmar o que existe ou não.
- **Segurança:** `safeStorage` do Electron (já usado hoje para chaves de API de LLM, `electron/main.js`) protege a credencial em disco, não o conteúdo jurídico extraído — que ficaria em texto plano em `data/neural/`, igual a qualquer outro documento hoje (consistente com o modelo de ameaça aceito do Tusab, não é vulnerabilidade nova). "Roteamento forçado pra Ollama por sensibilidade" é ideia genuinamente nova (nada parecido existe hoje em `agent/config.py`/`chat.py`) — tecnicamente viável, mas incompleta se só cobrir conteúdo vindo da API jurídica: um upload manual de documento sigiloso (já suportado hoje via reconhecimento automático de petição/contrato/parecer) ficaria sem a mesma proteção, criando falsa sensação de segurança.

**Veredito:** não avançar como está. Fonte pública repete terreno já testado e rejeitado; a parte genuinamente nova (Escavador/Jusbrasil, roteamento por sensibilidade) precisa de validação de ToS e desenho mais consistente (flag de sensibilidade por projeto/documento, não por fonte de origem) antes de virar código.

---

## As três camadas de mercado (visão de longo prazo)

**Camada 1 — B2C ("Um RAG pra chamar de meu"):**
Estudante, pesquisador, especialista, profissional liberal. Curadoria pessoal de fontes. Modelo: Ollama gratuito ou APIs pagas.

**Camada 2 — B2B Creator ("O assistente do criador"):**
Criadores educacionais, professores, coaches. Oferecem assistente com a própria voz para a audiência. Modelo: mensalidade por base indexada. Case de referência: AUVP (Raul Sena).

**Camada 3 — B2B Enterprise ("O arquivo institucional vivo"):**
Cursinhos, universidades, conselhos, hospitais, empresas. Acervo institucional (YouTube + PDFs + atas) consultável internamente. Modelo: licença por instituição + onboarding assistido. Pré-requisito: OAuth Drive público (P3) + landing page (P4).

**O flywheel:** aluno B2C que usa Tusab com conteúdo da FGV → vira case para a FGV contratar Camada 3. Criador que vê audiência usando sua base → tem argumento para contratar Camada 2.
