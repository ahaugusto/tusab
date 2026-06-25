# Decisões de Produto — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

Registro das decisões estratégicas e técnicas que moldaram o produto. Cada decisão tem contexto, alternativas consideradas e o raciocínio que levou à escolha feita.

---

## Por que quatro perfis (e não um produto genérico)

**Contexto:** o produto atendia um público amplo e indefinido. A tela inicial, as funcionalidades e o onboarding eram iguais para todos.

**Decisão tomada em junho 2026:** implementar sistema de perfis com quatro personas distintas — Estudante, Professor, Pesquisador, Especialista.

**Por que essa decisão muda a visão do produto:**

O Tusab não é uma ferramenta genérica de PKM. É uma plataforma com diferentes camadas de poder, e cada camada tem um usuário natural:

- O **Estudante** não precisa saber que existe BM25, Ollama ou qualquer configuração. Ele precisa de um mentor que responde com a fonte certa.
- O **Professor** é o curador — quem decide o que entra na base. A feature mais importante para ele não é o chat; é o export `.tusab` que permite transferir uma base pronta para os alunos.
- O **Pesquisador** precisa de controle total sobre o que entra no corpus e busca semântica robusta para análise aprofundada.
- O **Especialista** usa o Tusab como infraestrutura de conhecimento organizacional — quer monitoramento, administração e reset quando necessário.

**O que não muda entre perfis:** qualidade do RAG, privacidade local-first, citação de fonte obrigatória, custo zero com Ollama. Esses são invariantes de produto.

**Implementação técnica:** `usePerfil.js` com 14 feature flags por perfil. Slug interno sempre em inglês técnico (`profissional` para Especialista — ver decisão abaixo). Label exibido via chave i18n, alterável sem mudar a lógica.

**Impacto estratégico:** o fluxo professor→aluno via `.tusab` cria rede de valor. Um professor adotando traz N alunos. É o mecanismo de crescimento orgânico mais natural para o produto.

---

## Por que o slug "profissional" permanece (label "Especialista")

**Contexto:** o perfil mais avançado foi renomeado de "Profissional" para "Especialista" em junho 2026, após a decisão de que o termo "Especialista" é mais preciso para o público-alvo (analistas, gestores, usuários corporativos avançados).

**Decisão:** manter o slug interno `profissional` e alterar apenas o label exibido.

**Por que não renomear o slug:**
- localStorage já gravado em instalações existentes com o valor `profissional`
- Fallbacks em `App.jsx`, `Onboarding.jsx` e `HomeScreen.jsx` que verificam o slug por string
- Filtros de feature flag em `HomeScreen.jsx` que usam o slug como chave de array

Renomear o slug sem migração de localStorage quebraria silenciosamente o perfil de qualquer usuário que já havia feito o onboarding.

**Como alterar no futuro (se necessário):** implementar uma migração de localStorage no startup do app — ler o valor antigo, gravar o novo, deletar o antigo. Só então renomear o slug no código.

**Referência:** comentário em `usePerfil.js → PERFIS_META.profissional` e entrada na tabela de decisões técnicas do `CLAUDE.md`.

---

## Por que Brazil First

**Decisão:** o Tusab abre em português. PT é o idioma primário. EN e ES são suportados via i18n, mas não são o foco da experiência padrão.

**Motivos:**

1. **Mercado educacional brasileiro:** o Brasil tem o maior mercado de educação da América Latina. Professores e criadores educacionais brasileiros produzem conteúdo em escala — e têm exatamente o problema que o Tusab resolve.

2. **Groq como alternativa real:** para o público brasileiro, cartão internacional é barreira real de acesso a APIs de IA. O Groq oferece `llama-3.1-8b-instant` e `llama-3.1-70b-versatile` gratuitamente, sem cartão de crédito. O Tusab destaca o Groq explicitamente como melhor alternativa gratuita para quem não tem acesso a OpenAI ou Anthropic.

3. **Vantagem competitiva local:** ferramentas como NotebookLM são projetadas para o mercado americano e suportam português como cidadão de segunda classe. O Tusab é construído para o contexto brasileiro desde o início.

4. **Autor e empresa:** Augusto Brasil / CriAugu — CNPJ 65.131.075/0001-57. O produto é intrinsecamente brasileiro.

**O que isso não significa:** o produto não é exclusivo para o Brasil. i18n PT/EN/ES está implementado com 100% de consistência. Significa que a experiência padrão, a documentação primária e o go-to-market são direcionados ao Brasil primeiro.

---

## Por que freemium foi descartado

**Contexto:** o produto chegou a ter uma especificação completa de modelo freemium (Free / Pro / Studio / Enterprise com Lemon Squeezy), com feature flags, ProSnackbar e limite de 2 canais indexados no tier free.

**Decisão tomada em junho 2026:** remover o paywall. Todas as features ficam disponíveis.

**Motivo:** o Tusab serve como vitrine técnica de Augusto Brasil / CriAugu no mercado. O objetivo principal não é receita direta — é demonstrar competência em produto, arquitetura, segurança e UX para abrir conversas B2B com criadores e instituições.

Um freemium com paywall nessa fase:
- Gera atrito no momento em que o produto precisa ser testado e recomendado
- Exige implementar sistema de licença antes de validar se há tração
- Cria risco de imagem negativa se o paywall frustrar exatamente o perfil técnico que o produto quer impressionar

**O que permanece:** o ProSnackbar existe no código (informativo), o limite de 2 canais está codificado em `indexar()` mas desabilitado (`config.get('pro', False)` sempre retorna `False`). A infraestrutura está pronta para ativar quando o momento for certo.

---

## Por que repositório fechado

**Alternativas consideradas:** código aberto (MIT), source-available (BUSL), fechado (proprietário).

**Decisão:** repositório fechado.

**Motivo:** o diferencial do Tusab não é o código — é a curadoria técnica, a integração entre as partes e o produto final. Código aberto exigiria suportar contribuições externas, gerenciar PRs e manter documentação pública de API interna — overhead que não faz sentido nesta fase.

Proteção intelectual via:
- Lei nº 9.609/1998 (Lei do Software)
- Lei nº 9.610/1998 (Direitos Autorais)
- CNPJ 65.131.075/0001-57 como titular
- Registro INPI pendente (Programa de Computador "Tusab")

---

## Por que local-first

**Alternativa considerada:** SaaS com processamento em servidor central.

**Decisão:** local-first. Todos os dados ficam na máquina do usuário.

**Motivos:**

1. **Diferencial competitivo real:** o NotebookLM e praticamente todos os concorrentes são SaaS. O nicho local/privado está estruturalmente aberto.

2. **Proteção contra bloqueios do YouTube:** a extração via yt-dlp roda no IP residencial do usuário. Com distribuição por IP de usuário, não há superfície centralizada para bloquear.

3. **Mercado institucional:** para hospitais, conselhos, empresas e universidades, mandar documentos internos para um servidor externo é bloqueador. Local-first elimina esse bloqueador.

4. **Sem custo de infraestrutura:** zero servidor para manter, escalar ou proteger. Custo marginal de cada usuário adicional é zero.

5. **LGPD simplificada:** dados que nunca saem da máquina não precisam de política de transferência, DPA ou adequação internacional.

**Desvantagem aceita:** o usuário precisa de uma máquina com recursos suficientes (8GB RAM para Ollama). Não há versão web. Colaboração em tempo real não existe.

---

## Por que BM25 em vez de embeddings — e o que vem depois

**Alternativa considerada:** embeddings vetoriais (OpenAI `text-embedding-3-small`, sentence-transformers local, ChromaDB).

**Decisão atual:** BM25Okapi via `rank_bm25`.

**Motivos:**
1. **Latência:** BM25 retorna resultados em milissegundos. Embeddings adicionam 1–3s por query.
2. **Custo zero:** BM25 roda em CPU puro sem dependência de API externa.
3. **Sem dependência de GPU:** a maioria dos usuários-alvo não tem GPU.
4. **Suficiência para o caso de uso atual:** corpus rico e específico (canais curados pelo próprio usuário) com enriquecimento (tags × 3, keywords TF-IDF × 2, query expansion via LLM).
5. **Auditabilidade:** BM25 é determinístico e depurável. Embeddings são caixa-preta.

**Evolução mapeada:**

| Etapa | O que é | Quando |
|-------|---------|--------|
| ~~**Re-rankeamento CrossEncoder**~~ | ✅ **IMPLEMENTADO (junho 2026)** — BM25 recupera top-12 candidatos; CrossEncoder (`ms-marco-MiniLM-L-6-v2`, ~80MB, CPU) reordena por relevância semântica; ativado na Busca Ampla para todos os perfis. Latência medida: +236ms (modelo em memória). Degradação graciosa se `sentence-transformers` ausente. | — |
| **Embedding local opcional** | Busca vetorial como complemento quando Ollama + `nomic-embed-text` disponíveis. Degradação graciosa para BM25 puro quando não disponível. Latência estimada: +400–800ms — só viável quando provedor for Ollama; para Groq/OpenAI o retrieval superaria o LLM. | Após validação de uso real |
| **GraphRAG** | Grafo de conhecimento entre documentos; entende relações entre conceitos | Futuro — apenas quando Pesquisador e Especialista tiverem corpora com alta densidade relacional (artigos que se citam, normas com referências cruzadas). Corpus atual é predominantemente paralelo. |

**O que é densidade relacional:** o quanto os documentos de uma base se referem uns aos outros de forma explícita ou implícita. Transcrições de YouTube e PDFs avulsos têm baixa densidade (cada documento é independente). Artigos acadêmicos que se citam, código com imports, wikis com links — têm alta densidade. GraphRAG só vale para o segundo caso.

---

## Por que yt-dlp local (não servidor)

**Decisão:** yt-dlp roda 100% local, no IP do usuário. É o princípio intocável do produto.

**Por quê:**
- O YouTube aplica rate limiting por IP. Com extração centralizada, poucos IPs servem todos os usuários — bloqueio é questão de tempo.
- Cada usuário extraindo pelo próprio IP distribui a carga naturalmente.
- Dados do usuário nunca saem da máquina antes de serem processados.

---

## Por que Groq como alternativa gratuita de destaque (contexto Brazil First)

**Motivo:** Groq oferece `llama-3.1-8b-instant` e `llama-3.1-70b-versatile` no tier gratuito, sem cartão de crédito. Para o público brasileiro, cartão internacional é barreira real. Groq é listado explicitamente como provedor na UI e na documentação — não apenas como mais uma opção, mas como a recomendação para quem não quer ou não pode pagar por APIs.

---

## Por que não há servidor central

**Motivo técnico:** zero custo de infraestrutura. Sem servidor para manter, escalar, proteger ou pagar.

**Motivo de produto:** a ausência de servidor central é o argumento de confiança para o mercado institucional. "Seus dados nunca saem da rede de vocês" é verificável — não é política de privacidade, é design.

**Motivo de segurança:** sem servidor central, não há superfície única para atacar.

**Desvantagem aceita:** sem sync automático entre máquinas, sem colaboração em tempo real, sem backup automático na nuvem (Drive é opt-in).

---

## Modelo de negócio atual

**Estágio:** vitrine técnica → cases → B2B eventual.

**Caminho:**
1. Produto completo e gratuito → facilita testes e recomendações
2. Cases documentados (criadores, instituições que adotam) → prova social
3. Conversas B2B com criadores educacionais (50k–500k inscritos no Brasil) → demos com o canal deles
4. Contratos de implementação, onboarding e suporte quando houver demanda

**Por que não vender licença agora:**
- Sem sistema de licença implementado
- Sem landing page com proposta de valor para visitante frio
- Sem case público documentado

A ordem correta é: case → landing page → sistema de licença → venda. Não o inverso.

---

## Feature: Base Compartilhável (`.tusab`)

**Contexto:** o mecanismo central do fluxo professor→aluno. Um curador (professor, pesquisador, especialista) exporta uma base indexada. O consumidor (aluno, colega) importa e já conversa — sem extrair, sem indexar.

### Conteúdo do `.tusab`

| Caminho no arquivo | Descrição |
|--------------------|-----------|
| `manifest.json` | Nome do projeto, versão do formato (`1`), data de exportação, contagem de chunks, flag `somente_leitura: true` |
| `neural/{projeto}/youtube/` | Transcrições processadas do YouTube |
| `neural/{projeto}/documents/` | Textos extraídos de PDFs e DOCX |
| `neural/{projeto}/texts/` | Textos colados pelo usuário |
| `neural/{projeto}/management/` | CSVs de gestão, summary.json, README |
| `indexes/{projeto}.pkl` | Índice BM25 serializado |

**Decisão de escopo:** exportar apenas textos processados e o índice BM25 — não os arquivos originais (PDFs, áudios). Razão: tamanho gerenciável; o caso de uso do importador é chat, não acesso aos originais.

**Proteção readonly:** bases importadas recebem `_readonly.json` — flag UX que desabilita botões de modificação. É proteção de interface, não criptografia — o usuário avançado pode contornar acessando os arquivos diretamente, e isso é aceito.

---

## Por que Electron (e não alternativas mais leves)

**Contexto:** em junho 2026 avaliamos se o Electron poderia ser substituído por algo mais leve — PyInstaller standalone abrindo no browser do sistema, webapp SaaS, self-hosted via Docker, ou app mobile.

**Decisão:** Electron é a escolha certa e definitiva para desktop. Não por falta de alternativas, mas porque é o único que resolve o problema central sem comprometer o local-first.

**Alternativas avaliadas e descartadas:**

| Alternativa | Por que não |
|-------------|-------------|
| PyInstaller standalone (sem Electron) | Continua local-first — o executável roda 100% local. A perda é de experiência: sem auto-update nativo, sem ícone na barra de tarefas, sem startup automático. O usuário abre um terminal ou clica num `.exe` que levanta o FastAPI e então abre o browser manualmente. Viável tecnicamente (`Tusab.spec` já existe na raiz), mas a experiência é de ferramenta de desenvolvedor, não de produto. |
| Webapp SaaS | yt-dlp em servidor cloud é bloqueado pelo YouTube (IPs de AWS/GCP/Render são banidos). Requer auth, billing, infra. Dado que sai da máquina. Produto completamente diferente. |
| Self-hosted (Docker) | Válido para usuários técnicos, mas não é o público principal. Mantém o local-first pois o yt-dlp roda no IP do próprio usuário — roadmap futuro possível, não prioridade. |
| App mobile (iOS/Android) | Python não roda em iOS. Android possível mas corpus e fluxo de extração são inerentemente desktop. Ferramenta de gestão de conhecimento é desktop por natureza. |

**Por que o peso de ~210 MB é o custo justo:**
O usuário instala uma vez e tem privacidade total, funcionamento offline e custo zero recorrente. Quem usa ChatGPT no browser não instala nada — mas os dados vão para a OpenAI e o YouTube pode bloquear a extração a qualquer momento. O Tusab troca 210 MB por independência permanente.

**O que o Electron resolve que nenhuma alternativa resolve gratuitamente:**
- Empacota Python + yt-dlp + dependências em um instalador que o usuário clica e funciona
- Auto-update via GitHub Releases sem servidor próprio
- Startup automático e ícone nativo na barra de tarefas
- Extração YouTube no IP residencial do usuário — nunca banida

---

## Plataformas planejadas

**Windows (atual):** Electron + NSIS + python_env embarcado. Maduro, auto-update funcionando, instalador multilíngue PT/EN/ES.

**macOS (próxima):** mesma arquitetura Electron. Troca NSIS por DMG, python_env por python-build-standalone (Astral), yt-dlp.exe por yt-dlp_macos. Requer Mac para build. Detalhes técnicos documentados separadamente.

**Webapp / mobile:** descartado como produto independente. O local-first exige o backend no device — sem isso, o YouTube não funciona e o Ollama não faz sentido. Self-hosted Docker é possível no futuro para usuários técnicos (o yt-dlp continua no IP deles), mas não é prioridade.

**A arquitetura de infra atual — python_env embarcado, auto-update, TUSAB_DATA_DIR, storage atômico, instalador multilíngue — não é complexidade acidental. É a implementação direta do princípio local-first, e justifica cada decisão tomada até aqui.**

---

## Assinatura de código — decisão por fase

**Contexto:** instaladores Windows não assinados exibem aviso do SmartScreen ("Windows protegeu seu PC"). Para usuário individual é contornável; para B2B com TI gerenciada pode ser bloqueador.

**Opções avaliadas:**

| Opção | Custo | Reputação |
|-------|-------|-----------|
| IDLK (Microsoft SmartScreen orgânico) | $0 | Acumula com o histórico de downloads — desaparece após centenas de instalações |
| OV (Sectigo/DigiCert) | ~$80–200/ano | Remove o aviso após semanas de histórico acumulado |
| EV (Extended Validation) | ~$300–500/ano | Remove o aviso imediatamente, desde a emissão |

**Decisão atual (junho 2026):** IDLK — reputação orgânica, custo zero. O volume atual de distribuição não justifica certificado pago.

**Gatilho para migrar para OV:** primeiro contrato B2B com TI corporativa gerenciada que exigir instalador assinado, ou volume de downloads suficiente para tornar o aviso um problema recorrente de suporte.

**Como implementar OV quando chegar a hora:** `electron-builder` suporta assinatura automática via variáveis de ambiente no CI/build pipeline — `WIN_CSC_LINK` (path do `.pfx`) e `WIN_CSC_KEY_PASSWORD`. Nenhuma mudança no código, só no pipeline de build.

---

## Decisão sobre App.jsx (débito técnico aceito)

O `App.jsx` tem ~1.590 linhas orquestrando ~40 estados. É um "God Component" reconhecido.

**Por que não foi refatorado ainda:** a refatoração para Context API ou Zustand é trabalho de semanas sem nenhum valor visível para o usuário. Na fase atual, o gargalo não é a manutenibilidade — é chegar ao primeiro case.

**Quando refatorar:** quando adicionar uma nova feature exigir mais de 1h para entender o fluxo de estado existente. Esse é o gatilho.
