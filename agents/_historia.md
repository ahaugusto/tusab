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

### Repositório fechado
Proteção via Lei nº 9.609/1998 + Lei nº 9.610/1998 + CNPJ + INPI pendente. Código aberto exigiria suporte a contribuições externas — overhead inviável nesta fase.

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
13. **`_intent_executor` nunca recriar por request** — `ThreadPoolExecutor` é module-level em `chat.py`; recriá-lo por chamada causaria vazamento de threads e overhead no hot path do chat.
14. **Chat stream acumula `resposta_acumulada` no `except`** — o stream SSE emite texto puro (não JSON) na maioria dos chunks; `json.loads()` lança, e o `except` deve fazer `resposta_acumulada.append(chunk)` — nunca `pass`. Romper isso torna `last_chat_response` vazio e o classificador CONTEXTO completamente inativo.
15. **`api_key: '__keep__'` ao salvar config parcial** — ao mudar só `ollama_model` ou `persona`, usar o sentinel `'__keep__'` para não zerar chaves de providers externos. Backend interpreta `'__keep__'` mantendo o valor atual em `agent_config.json`.
16. **`canalAtualAtivo` no modal de base usa só `canalConfigurado`, sem fallback para `agentStatus.canal_indexado`** — `agentStatus` é estado do servidor e não muda com cliques no modal. Fallback para `agentStatus` impede que desmarcar reflita no visual. Seleção do modal = escolha explícita do usuário, nunca inferida do backend.
17. **`fts.py/_fts_path` sanitiza `canal_prefixo` localmente** — não depender da sanitização do chamador. `re.sub(r'[^\w\-]', '_', prefixo)` antes de compor o path. Defesa em profundidade contra path traversal mesmo que o router já sanitize.

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
| WARN-25 | App.jsx:1501 | BAIXO | Chip de perfil some quando Drive autenticado | Não é bug — comportamento intencional: chip de Drive substitui o chip de perfil no mesmo espaço quando conectado |
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

## As três camadas de mercado (visão de longo prazo)

**Camada 1 — B2C ("Um RAG pra chamar de meu"):**
Estudante, pesquisador, especialista, profissional liberal. Curadoria pessoal de fontes. Modelo: Ollama gratuito ou APIs pagas.

**Camada 2 — B2B Creator ("O assistente do criador"):**
Criadores educacionais, professores, coaches. Oferecem assistente com a própria voz para a audiência. Modelo: mensalidade por base indexada. Case de referência: AUVP (Raul Sena).

**Camada 3 — B2B Enterprise ("O arquivo institucional vivo"):**
Cursinhos, universidades, conselhos, hospitais, empresas. Acervo institucional (YouTube + PDFs + atas) consultável internamente. Modelo: licença por instituição + onboarding assistido. Pré-requisito: OAuth Drive público (P3) + landing page (P4).

**O flywheel:** aluno B2C que usa Tusab com conteúdo da FGV → vira case para a FGV contratar Camada 3. Criador que vê audiência usando sua base → tem argumento para contratar Camada 2.
