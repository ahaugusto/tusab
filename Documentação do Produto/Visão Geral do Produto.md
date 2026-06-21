# Visão Geral do Produto — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

## O nome: Tusab

Tusab (egípcio antigo: *s-bȝ-yt*) é o nome de um gênero literário surgido no Egito há mais de 4.000 anos. A palavra significa literalmente "instrução" ou "ensinamento" — do verbo egípcio *sba*, ensinar, transmitir sabedoria.

Os textos do gênero seguiam uma estrutura invariável: um ancião de grande experiência — um visir, um faraó, um escriba — reunia por escrito tudo que havia aprendido ao longo de décadas e endereçava ao filho ou sucessor. Não eram tratados filosóficos abstratos. Eram instruções práticas e verificáveis. O conhecimento já estava lá — vivido e observado. O Tusab o tornava consultável para quem viesse depois.

O exemplo mais antigo e mais célebre: as Máximas de Ptahhotep (c. 2400 a.C.), onde um visir de 110 anos registra 37 máximas de sabedoria prática para o filho. Não é vaidade intelectual — é transferência deliberada de conhecimento acumulado.

O produto faz o que o gênero fez por milênios: você acumula conhecimento — vídeos, documentos, anotações. O Tusab absorve esse conhecimento, organiza e indexa. Quando você tem uma pergunta, o Tusab não inventa — ele instrui de volta a partir do que você escolheu aprender, sempre citando a fonte de onde veio.

---

## Posicionamento

**Tusab é o seu mentor digital.**

Não é uma busca. Não é um chatbot genérico. É um mentor que conhece exatamente o que você escolheu aprender — e só esse. Responde com a voz, a didática e a fonte de quem você já confia.

**Mercado primário:** Brasil. O produto abre em português, é projetado para a realidade brasileira de acesso a internet, infraestrutura de hardware e mercado educacional.

**Categoria de mercado:** PKM — Personal Knowledge Management (Gestão de Conhecimento Pessoal).

**Conceito filosófico:** Intelligence Augmentation, na definição de Douglas Engelbart (1962). Em seu paper "Augmenting Human Intellect: A Conceptual Framework", Engelbart distinguiu:

- **AI** (Artificial Intelligence) — máquina que substitui o humano em uma tarefa cognitiva
- **IA** (Intelligence Augmentation) — ferramenta que amplifica a capacidade cognitiva humana

O Tusab é um produto de IA no sentido de Engelbart: o usuário decide o que aprender, o que questionar, o que concluir. O produto amplifica o acesso ao conhecimento que o próprio usuário escolheu acumular.

**Pipeline central — IAC:**

| Etapa | O que faz |
|-------|-----------|
| **I — Index** | Extrai e indexa qualquer fonte: YouTube, PDFs, DOCX, Markdown, texto colado |
| **A — Augment** | RAG: recupera trechos relevantes da base e os entrega ao modelo como contexto |
| **C — Converse** | Chat em linguagem natural com resposta citando a fonte exata de origem |

---

## Proposta de valor central

O problema central do PKM: você salva muito, mas não acessa quando precisa. A busca é ruim. Você não lembra onde está. Acaba relendo tudo do zero.

O Tusab resolve isso: em vez de procurar, você consulta um mentor que conhece exatamente o conteúdo que você escolheu — e só esse. Resposta sempre com citação verificável da fonte original.

O mentor do Tusab só sabe o que você ensinou a ele. Isso não é limitação — é a garantia de que ele não inventa.

---

## Quem usa o Tusab — os quatro perfis

O Tusab é construído em torno de quatro perfis de usuário com necessidades distintas. O sistema de perfis não é apenas marketing — está implementado na aplicação: cada perfil ativa um conjunto diferente de funcionalidades, simplificando a interface para quem precisa de menos e abrindo poder para quem precisa de mais.

### 🎓 Estudante
**O que faz no Tusab:** importa bases prontas compartilhadas por professores ou colegas. Faz perguntas ao mentor e recebe respostas com citação de fonte. Não precisa configurar provedores de IA, gerenciar extração ou administrar o sistema.

**Funcionalidades disponíveis:** Repositório (apenas consulta), Chat RAG.

**Frase que define:** *"Tenho o canal do meu professor mais as apostilas do curso. Antes ficava procurando no YouTube e nas pastas. Agora pergunto e o mentor cita exatamente de onde veio."*

**Por que é o público mais importante:** é o maior volume. Cada professor que adota o Tusab chega com dezenas de alunos. A experiência do estudante tem que ser zero-fricção.

---

### 📚 Professor
**O que faz no Tusab:** extrai canais do YouTube, indexa materiais didáticos, exporta bases prontas como arquivos `.tusab` para compartilhar com alunos. É o curador — quem decide o que entra na base de conhecimento dos outros.

**Funcionalidades disponíveis:** Extração YouTube (com fila), Repositório (gestão completa), Relatório de cobertura, Agente (configuração de tom/persona), Google Drive (sync e compartilhamento), Export de base `.tusab`.

**Frase que define:** *"Meu canal tem 8 anos de aulas. Indexei tudo. Agora o mentor responde com a minha voz — cita meus vídeos, meus termos, minha didática. É literalmente eu, disponível 24h para os alunos."*

**Por que é o ativador de rede:** o professor multiplica o impacto. Um professor adotando → N alunos usando → N oportunidades de boca a boca.

---

### 🔬 Pesquisador
**O que faz no Tusab:** constrói corpora de múltiplas fontes para análise aprofundada. Configura provedores de IA com modelos mais potentes, usa busca ampla, exporta e importa bases entre projetos de pesquisa.

**Funcionalidades disponíveis:** todas as do Professor + Visão Geral do projeto (analytics), configuração de API key (Groq, OpenAI, Anthropic, Gemini), Busca Ampla no chat.

**Frase que define:** *"Construo corpora de múltiplas fontes para análise aprofundada. A base é minha — nenhum dado sai da minha máquina."*

**Evolução RAG prevista:** perfil de maior benefício com re-rankeamento semântico (CrossEncoder) e, no futuro, busca vetorial híbrida — quando corpus denso e especializado justificar o custo adicional de embeddings.

---

### 🧑‍💻 Especialista
**O que faz no Tusab:** usa o Tusab para inteligência de negócios e gestão de conhecimento organizacional. Acessa todas as funcionalidades, incluindo monitoramento do sistema, administração, reset total e ferramentas avançadas.

**Funcionalidades disponíveis:** todas — incluindo Monitor de sistema, painel Admin, Reset total, todas as configurações de agente e export.

**Frase que define:** *"Tenho 3 anos de relatórios setoriais, atas de reunião e vídeos de conferências. Antes de qualquer reunião, pergunto ao mentor tudo que já analisei sobre o tema. Em 2 minutos tenho o contexto — o que levaria 40 minutos de busca manual."*

**Nota técnica:** internamente o slug deste perfil é `profissional` — mantido por compatibilidade com dados já gravados. O label visual é "Especialista" desde junho 2026. Ver `usePerfil.js` e `CLAUDE.md`.

---

## O sistema de perfis na prática

O perfil é escolhido no onboarding — a primeira tela após a instalação. Pode ser alterado a qualquer momento via menu de perfil no cabeçalho da aplicação.

**O que muda entre perfis:**
- Abas visíveis na navegação principal
- Persona padrão do agente (didático para estudante e professor, técnico para pesquisador, objetivo para especialista)
- Acesso a Busca Ampla no chat
- Acesso a configuração de provedores de IA (API keys)
- Acesso a fila de extração de múltiplos canais
- Acesso a integração com Google Drive
- Acesso a export de base `.tusab`
- Acesso a ferramentas administrativas (Monitor, Reset total)

**O que não muda:** a qualidade do RAG, a privacidade local-first, o princípio de citação de fonte, e o custo zero com Ollama. Esses são invariantes para todos os perfis.

---

## Diferenciais reais

| Diferencial | Detalhe |
|-------------|---------|
| **Extração de canais YouTube em escala** | Canais inteiros — centenas de vídeos — extraídos automaticamente via yt-dlp local |
| **Multi-fonte** | YouTube + PDF + DOCX + Markdown + texto livre + imagens + áudio |
| **100% local** | Dados nunca saem da máquina; roda offline com Ollama |
| **Brazil First** | Interface em português como idioma primário; Groq destacado como melhor alternativa gratuita para quem não tem cartão internacional |
| **Citação de fonte obrigatória** | Toda resposta cita título, data e link de origem — auditável por design |
| **Base Compartilhável** | Professor exporta uma base pronta `.tusab`; aluno importa e já conversa sem extrair nada |
| **BYOK** | Groq (grátis), OpenAI, Anthropic, Gemini como provedores opcionais |
| **Zero custo básico** | Ollama + llama3.2:1b funciona sem API key, sem assinatura, sem conta |
| **Parser de formatos especiais** | WhatsApp, Zoom, Otter, Teams — estruturados automaticamente antes da indexação |
| **Anti-alucinação** | Threshold BM25 + verificação pós-geração por keyword overlap |
| **Sistema de perfis** | Interface adaptada por perfil — zero fricção para o estudante, poder total para o especialista |

---

## Comparação com concorrentes

### NotebookLM (Google)

O NotebookLM é o concorrente mais próximo em conceito: aceita PDFs, Google Docs, YouTube e texto, responde citando a fonte. É polido, usa Gemini 1.5 Pro, atualmente gratuito.

**O que fazemos igual:**
- Chat sobre documentos com citação de fonte
- Múltiplos tipos de entrada (PDF, texto, YouTube)
- Interface focada em perguntas e respostas

**Onde o NotebookLM é melhor:**
- Motor de IA superior (Gemini 1.5 Pro vs. llama3.2:1b padrão)
- UI mais polida (produto Google)
- Audio Overview — resumo em formato podcast
- Gratuito sem configuração
- Disponível no browser, sem instalação

**Onde o Tusab se diferencia de verdade:**

1. **Escala de extração do YouTube** — o NotebookLM aceita vídeos individuais; o Tusab extrai canais inteiros. Não é uma feature diferente. É uma magnitude diferente.

2. **Local-first** — o NotebookLM processa nos servidores do Google. Para uso institucional (documentos internos, atas, dados sensíveis), isso é bloqueador. Para o Tusab, é o design padrão.

3. **Base Compartilhável** — o NotebookLM não tem mecanismo nativo de professor → aluno. O `.tusab` resolve exatamente isso.

4. **Sem dependência de conta Google** — funciona offline com Ollama. Sem risco de descontinuação ou mudança de política de privacidade.

**Conclusão:** o NotebookLM valida o mercado. O Tusab ocupa o nicho que o NotebookLM deliberadamente não quer: local, privado, sem Google, com extração em escala e fluxo professor→aluno.

### Obsidian AI / Notion AI

Ferramentas de organização de notas com IA adicionada. Não extraem YouTube nativamente, não rodam o modelo localmente como padrão, exigem assinatura para as features de IA.

### SummarizeYT / Glasp

Ferramentas de resumo de vídeos individuais. Não indexam canais, não têm chat, não são PKM.

---

## O que o Tusab NÃO é

- Não é uma IA generativa (ChatGPT, Gemini, Copilot, Perplexity) — não responde perguntas sobre o mundo, apenas sobre o que foi indexado
- Não cria conteúdo novo — organiza e torna consultável o que existe
- Não substitui o criador — amplifica o alcance do que ele já produziu
- Não depende de servidor externo — roda local, dados do cliente são dele
- Não é SaaS — não há servidor central, não há assinatura obrigatória

---

## Modelo atual

O Tusab é **gratuito e completo**. Todas as features estão disponíveis sem paywall. O produto serve como vitrine técnica de Augusto Brasil / CriAugu no mercado, demonstrando competência em Electron, FastAPI, RAG local, segurança de aplicação e UX de produto.

O caminho de negócio é: vitrine técnica → cases documentados → contratos B2B com criadores e instituições.

Repositório: fechado. Proteção intelectual via Lei nº 9.609/1998 + Lei nº 9.610/1998 + CNPJ 65.131.075/0001-57. Registro INPI pendente.

Site: tusab.solutions

---

## Pitch de um parágrafo

Tusab é o seu mentor digital. Você extrai canais do YouTube, adiciona seus PDFs, documentos e anotações — tudo vira um mentor que responde suas perguntas citando a fonte exata de onde veio. Roda na sua máquina, funciona offline, zero custo com Ollama. Para o estudante, é a base do professor disponível 24h. Para o professor, é a própria voz transformada em mentor. Para o pesquisador e o especialista, é infraestrutura de conhecimento privada e auditável — sem servidor externo, sem assinatura obrigatória.

---

## Copy para site (tusab.solutions)

### Headline principal
**Seu mentor digital. Seus dados. Sua máquina.**

### Subheadline
Extrai canais do YouTube, indexa seus PDFs e documentos, e responde suas perguntas citando a fonte exata — tudo rodando localmente, sem nuvem, sem assinatura.

### Seção de perfis

**Para estudantes**
Receba a base de conhecimento do seu professor pronta. Pergunte qualquer coisa — o mentor responde com a fonte exata de onde veio. Sem configurar nada.

**Para professores**
Transforme seus anos de conteúdo em um mentor com a sua voz. Exporte uma base pronta e compartilhe com seus alunos em um clique.

**Para pesquisadores**
Construa corpora de múltiplas fontes. Chat com busca semântica ampla. Seus dados ficam na sua máquina — auditáveis, privados, seus.

**Para especialistas**
Inteligência de negócios sobre seu próprio acervo. Relatórios, atas, vídeos de conferências — tudo consultável como um mentor vivo. Sem servidor externo.

### Diferencial anchor
🇧🇷 Feito no Brasil, em português, para a realidade brasileira.
Funciona offline. Zero custo com Ollama. Dados nunca saem da sua máquina.
