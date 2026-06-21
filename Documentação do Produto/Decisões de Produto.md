# Decisões de Produto — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

Registro das decisões estratégicas e técnicas que moldaram o produto. Cada decisão tem contexto, alternativas consideradas e o raciocínio que levou à escolha feita.

---

## Por que freemium foi descartado

**Contexto:** o produto chegou a ter uma especificação completa de modelo freemium (Free / Pro / Studio / Enterprise com Lemon Squeezy), com feature flags, ProSnackbar e limite de 2 canais indexados no tier free.

**Decisão tomada em junho 2026:** remover o paywall. Todas as features ficam disponíveis.

**Motivo:** o Tusab serve como vitrine técnica de Augusto Brasil / CriAugu no mercado. O objetivo principal não é receita direta — é demonstrar competência em produto, arquitetura, segurança e UX para abrir conversas B2B com criadores e instituições.

Um freemium com paywall nessa fase:
- Gera atrito no momento em que o produto precisa ser testado e recomendado
- Exige implementar sistema de licença (Lemon Squeezy + hardware fingerprint + proteção do código Python) antes de validar se há tração
- Cria risco de imagem negativa se o paywall frustrar exatamente o perfil técnico que o produto quer impressionar

O modelo correto agora: produto completo e gratuito → cases documentados → contratos B2B diretos quando houver tração suficiente.

**O que permanece:** o ProSnackbar existe no código (informativo), o limite de 2 canais está codificado em `indexar()` mas desabilitado (`config.get('pro', False)` sempre retorna `False`). A infraestrutura está pronta para ativar quando o momento for certo — sem reescrever nada.

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

**O que isso não impede:** demos públicos, vídeos técnicos, apresentações de arquitetura. O código não precisa estar público para o produto ser vitrine técnica.

---

## Por que local-first

**Alternativa considerada:** SaaS com processamento em servidor central.

**Decisão:** local-first. Todos os dados ficam na máquina do usuário.

**Motivos:**

1. **Diferencial competitivo real:** o NotebookLM (Google) e praticamente todos os concorrentes são SaaS. O nicho local/privado está estruturalmente aberto. O Tusab ocupa.

2. **Proteção contra bloqueios do YouTube:** a extração via yt-dlp roda no IP residencial do usuário. Se o Tusab fosse SaaS, as extrações viriam de poucos IPs de servidor — alvo óbvio para rate limiting. Com distribuição por IP de usuário, não há superfície centralizada para bloquear.

3. **Mercado institucional:** para hospitais, conselhos, empresas e universidades, mandar documentos internos para um servidor externo é um bloqueador — jurídico, de compliance ou de política interna. Local-first elimina esse bloqueador.

4. **Sem custo de infraestrutura:** zero servidor para manter, escalar ou proteger. O custo marginal de cada usuário adicional é zero.

5. **LGPD simplificada:** dados que nunca saem da máquina não precisam de política de transferência, DPA ou adequação internacional.

**Desvantagem aceita:** o usuário precisa de uma máquina com recursos suficientes (8GB RAM para Ollama). Não há versão web. Colaboração em tempo real não existe.

---

## Por que BM25 em vez de embeddings

**Alternativa considerada:** embeddings vetoriais (OpenAI `text-embedding-3-small`, sentence-transformers local, ChromaDB, pgvector).

**Decisão:** BM25Okapi via `rank_bm25`.

**Motivos:**

1. **Latência:** BM25 retorna resultados em milissegundos. Embeddings exigem encoder — mesmo local (sentence-transformers), adiciona 1–3s por query. Com query expansion, esse custo se multiplica.

2. **Custo zero:** BM25 roda em CPU puro sem dependência de API externa. Embeddings via OpenAI custam por token. Embeddings locais exigem download e carregamento de modelo (~90MB–1GB).

3. **Sem dependência de GPU:** a maioria dos usuários-alvo não tem GPU. sentence-transformers em CPU é lento para bases grandes.

4. **Suficiência para o caso de uso:** o corpus do Tusab é texto rico e específico (transcrições de canais curados pelo próprio usuário). BM25 com enriquecimento (tags × 3, keywords TF-IDF × 2, query expansion via LLM para provedores rápidos) entrega recall adequado.

5. **Zero mágica:** BM25 é determinístico, auditável e depurável. Embeddings são uma caixa-preta de float32 — difíceis de diagnosticar quando o retrieval falha.

**Quando embeddings fariam sentido:** bases muito grandes (100k+ documentos) com terminologia especializada onde BM25 falha por problemas de vocabulário. Para o perfil de usuário atual do Tusab, BM25 é a escolha correta.

---

## Por que yt-dlp local (não servidor)

**Alternativa considerada:** processar extração em servidor próprio, receber transcrições via API.

**Decisão:** yt-dlp roda 100% local, no IP do usuário.

**Motivo principal:** é o princípio intocável do produto.

Tudo mais pode evoluir — providers, UI, arquitetura. A extração local não.

**Por quê:**
- O YouTube aplica rate limiting por IP. Com extração centralizada em servidor, poucos IPs servem todos os usuários — bloqueio é questão de tempo e escala.
- Cada usuário extraindo pelo próprio IP distribui a carga de forma natural. O YouTube não tem como identificar padrão anômalo em requisições individuais.
- Dados do usuário nunca saem da máquina antes de serem processados. A transcrição de um vídeo vai direto para `data/neural/` — sem passar por nenhum servidor intermediário.

---

## Por que Ollama como padrão (não Groq, não OpenAI)

**Motivo:** a proposta de valor central inclui "zero custo com Ollama". Se o padrão fosse um provedor com API key, o usuário estaria a um passo de custo de uso — o que contradiz o posicionamento.

Ollama com llama3.2:1b (~1.3 GB) funciona em qualquer máquina com 4GB+ de RAM. É lento para modelos maiores, mas entrega o loop completo (indexar → perguntar → receber resposta com fonte) sem nenhuma dependência externa.

**Groq como melhor alternativa gratuita:** Groq oferece `llama-3.1-8b-instant` e `llama-3.1-70b-versatile` no tier gratuito — sem cartão de crédito. Especialmente relevante para o público brasileiro, onde cartão internacional é barreira real. Groq é listado explicitamente como provedor na UI.

---

## Comparação com NotebookLM — onde perdemos, onde ganhamos

### Onde o NotebookLM é melhor
- Motor de IA superior (Gemini 1.5 Pro vs. llama3.2:1b padrão)
- UI mais polida — produto Google com time dedicado
- Audio Overview — resumo em formato podcast, feature única
- Gratuito sem nenhuma configuração
- Disponível no browser, sem instalação

### Onde o Tusab ganha
- **Escala de YouTube:** o NotebookLM aceita vídeos individuais. O Tusab extrai canais inteiros. Para um canal com 800 vídeos, a diferença é de magnitude, não de feature.
- **Local-first:** o NotebookLM processa nos servidores do Google. Para qualquer uso com dados sensíveis, isso é bloqueador.
- **Sem conta Google:** funciona offline com Ollama. Sem risco de mudança de política.
- **Multi-fonte com controle total:** o usuário decide exatamente o que entra — YouTube + documentos próprios + textos colados, por projeto separado.
- **BYOK:** o usuário pode usar GPT-4o, Claude, Gemini ou Groq — sem ser forçado a usar o motor do NotebookLM.

**Conclusão de posicionamento:** o NotebookLM valida o mercado — prova que usuários querem chat com documentos. O Tusab ocupa o nicho que o NotebookLM deliberadamente não quer: local, privado, sem Google, com extração de canais em escala.

---

## Por que não há servidor central

**Motivo técnico:** zero custo de infraestrutura. Sem servidor para manter, escalar, proteger ou pagar.

**Motivo de produto:** a ausência de servidor central é o argumento de confiança para o mercado institucional. "Seus dados nunca saem da rede de vocês" é verificável — não é política de privacidade, é design.

**Motivo de segurança:** sem servidor central, não há superfície única para atacar. Um ataque bem-sucedido ao servidor de um SaaS expõe dados de todos os usuários. Com arquitetura local, cada usuário é um ilha isolada.

**Desvantagem aceita:** sem servidor, não há sync automático entre máquinas, não há colaboração em tempo real, não há backup automático na nuvem (Drive é opt-in). São trade-offs conscientes.

---

## Modelo de negócio atual

**Estágio:** vitrine técnica → cases → B2B eventual.

O produto é gratuito. O valor imediato é demonstrar competência técnica de Augusto Brasil no mercado.

**Caminho de negócio:**
1. Produto funcional e sem paywall → facilita testes e recomendações
2. Cases documentados (criadores, instituições que adotam) → prova social
3. Conversas B2B com criadores educacionais (50k–500k inscritos) → demos com o canal deles
4. Contratos de implementação, onboarding e suporte quando houver demanda

**Por que não vender licença agora:**
- Sem sistema de licença implementado (Lemon Squeezy + hardware fingerprint + proteção do código Python)
- Sem landing page com proposta de valor clara para visitantes frios
- Sem case público documentado além da AUVP (ideia comprada antes do produto existir)

Esses três precisam existir antes de qualquer esforço de venda. A ordem correta é: case → landing page → sistema de licença → venda. Não o inverso.

---

## Decisão sobre App.jsx (débito técnico aceito)

O `App.jsx` tem ~1.590 linhas orquestrando ~40 estados. É um "God Component" reconhecido.

**Por que não foi refatorado ainda:** a refatoração para Context API ou Zustand é trabalho de semanas sem nenhum valor visível para o usuário. Na fase atual, o gargalo não é a manutenibilidade do código — é chegar ao primeiro case. O débito está mapeado e será atacado quando o produto entrar em fase de crescimento real.

**Quando refatorar:** quando o número de estados gerenciados em `App.jsx` tornar impossível adicionar features sem regressão. O sinal de gatilho é: quando um desenvolvedor novo demorar mais de 1 hora para entender o fluxo de estado de uma feature específica.

---

## Feature: Base Compartilhável (`.tusab`)

**Contexto:** O Tusab permite curadoria de conhecimento local. Um professor (ou qualquer curador) pode extrair canais do YouTube, indexar PDFs e textos, e querer compartilhar essa base pronta com alunos — que abrem o Tusab e já podem chatear sem precisar extrair ou indexar nada.

### Fluxo do exportador (professor)

1. No Repositório, seleciona um projeto já indexado
2. Clica em "Exportar Base"
3. Recebe um arquivo `{nome_projeto}.tusab` (zip renomeado)
4. Compartilha via e-mail, Drive, pen drive etc.

### Fluxo do importador (aluno)

1. Na tela inicial ou Repositório, clica em "Importar Base"
2. Seleciona o arquivo `.tusab`
3. O projeto aparece disponível para chat imediatamente — sem reindexar

### Conteúdo do `.tusab`

| Caminho no arquivo | Descrição |
|--------------------|-----------|
| `manifest.json` | Nome do projeto, versão do formato (`1`), data de exportação, contagem de chunks |
| `neural/{projeto}/youtube/` | Transcrições processadas do YouTube |
| `neural/{projeto}/documents/` | Textos extraídos de PDFs e DOCX |
| `neural/{projeto}/texts/` | Textos colados pelo usuário |
| `neural/{projeto}/management/` | CSVs de gestão, summary.json, README |
| `indexes/{projeto}.pkl` | Índice BM25 serializado |

**Decisão de escopo:** exportar apenas textos processados e o índice BM25 — não os arquivos originais (PDFs, áudios). Razão: tamanho gerenciável; o caso de uso do importador é chat, não acesso aos originais.

### Caso de uso primário

Ambiente escolar — professor como curador, aluno como consumidor. Também útil para times, pesquisadores e comunidades de estudo.

### Arquivos a criar/modificar

| Arquivo | Alteração |
|---------|-----------|
| `tusab_engine/api/router_exports.py` | Rotas `GET /export/base/{projeto}` e `POST /import/base` |
| `tusab_engine/storage.py` | Helper `export_base_path(projeto)` |
| `web_interface/src/components/agent/RepositorioTab.jsx` | Botão "Exportar Base" por projeto + botão "Importar Base" |
| `web_interface/src/components/home/HomeScreen.jsx` | Entrada alternativa para "Importar Base" (opcional) |
| `web_interface/src/locales/{pt,en,es}.json` | Chaves `repo.export_base`, `repo.import_base`, `repo.import_success`, etc. |
