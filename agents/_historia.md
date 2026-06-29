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

---

## Bugs mapeados pela auditoria de jornadas v1.0.19 — status e prioridade

Auditoria completa de 17 jornadas realizada em jun/2026 identificou os seguintes itens abertos:

| ID | Arquivo | Severidade | Descrição | Status |
|----|---------|-----------|-----------|--------|
| FAIL-01 | App.jsx:91, usePerfil.js:8 | MÉDIO | `activeTab='extracao'` default incompatível com perfil `estudante` — useEffect corrige em seguida mas há frame de aba inválida | Aberto |
| FAIL-02 | ExtractionModal.jsx:44, App.jsx:723 | ALTO | Fluxo normal sem canal nunca passa pelo step de URL — `POST /start` com canal vazio possível quando usuário abre modal sem canal configurado | Aberto |
| FAIL-03 | web_interface/src/services/api.js:203 | CRÍTICO | `limparCanal()` chama `DELETE /neural/limpar` sem parâmetro `canal` — apaga arquivos de **todos** os projetos. Backend aceita `canal` como parâmetro opcional mas frontend não envia | Aberto |
| WARN-13 | useChatEngine.js:286 | MÉDIO | Fila de chat cheia (6ª msg): mensagem descartada silenciosamente sem feedback ao usuário | Aberto |
| WARN-15 | ChatDrawer.jsx:293 | MÉDIO | Falha de export (docx/pdf/xlsx): apenas `console.warn`, sem toast ou mensagem de erro na UI | Aberto |
| WARN-19 | useAgentConfig.js:97 | ALTO | Sync de idioma envia `api_key: ''` ao backend — pode zerar chave externa se backend não tiver proteção para campo vazio | Aberto |
| WARN-21 | App.jsx:944 | BAIXO | Banner de update invisível na HomeScreen (`!showHome` condition) — usuário na home não vê notificação de atualização | Aberto |
| WARN-23 | App.jsx:1484 | BAIXO | Fechar painel Drive durante OAuth não cancela o fluxo — OAuth continua em background sem feedback | Aberto |
| WARN-25 | App.jsx:1356 | BAIXO | Chip de perfil some quando Drive autenticado — usuário não pode trocar perfil sem desconectar Drive (sem explicação visual) | Aberto |
| WARN-31 | App.jsx:357 | MÉDIO | `Shift+R` com perfil estudante muda `activeTab='extracao'` mas aba não aparece no nav (filtrada por regras.abas) — estado inválido silencioso | Aberto |

**Bugs já corrigidos nesta sprint (não reabrir):**
- FAIL-05: `Shift+C` usava `setChatOpen(true)` direto — snack não era removido. Fix: `handleOpenChat()` + `useCallback`
- FAIL-SR: `Shift+R` não chamava `setShowHome(false)` — HomeScreen bloqueava UI

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
