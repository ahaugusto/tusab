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

O Tusab compete em três frentes distintas: ferramentas locais com privacidade, gigantes da nuvem tipo NotebookLM, e PKMs tradicionais que estão adicionando IA. A análise abaixo é honesta — onde perdemos e onde ganhamos.

---

### 1. Concorrentes diretos — Local e privacidade

#### AnythingLLM

App desktop que permite conectar Ollama ou IA em nuvem, criar workspaces (bases de conhecimento) e subir PDFs e documentos. É o concorrente arquitetônico mais próximo.

| | AnythingLLM | Tusab |
|---|---|---|
| Extração YouTube em escala | ✗ (manual) | ✅ (canal inteiro) |
| Parser WhatsApp / Reuniões | ✗ | ✅ |
| Fluxo professor → aluno | ✗ | ✅ (.tusab) |
| Integrações enterprise (Confluence, Slack, S3) | ✅ | ✗ |
| API exposta para automações | ✅ | ✗ |
| Comunidade e plugins | Grande | Pequena |
| Público-alvo | Devs e empresas | Estudantes, professores, pesquisadores |

**Conclusão:** não compete no segmento enterprise. Vence no nicho de conteúdo audiovisual e compartilhamento educacional.

---

#### GPT4All (Nomic AI)

App desktop focado em rodar modelos locais facilmente, com "LocalDocs" que aponta uma pasta e conversa com os arquivos.

| | GPT4All | Tusab |
|---|---|---|
| Fontes de dados | Texto/PDF | YouTube + PDF + áudio + imagem + WhatsApp |
| Modelo embutido (zero config) | ✅ | ✗ (requer Ollama) |
| UX para não-técnicos | Básica | Mais guiada |
| i18n / Brasil First | ✗ | ✅ |

**Conclusão:** o gap de fontes é real. A fricção do Ollama é o ponto fraco do Tusab aqui.

---

#### Nvidia ChatRTX

Demo da Nvidia de RAG local com arquivos. Exige GPU Nvidia série 3000 ou 4000.

**Onde o Tusab ganha:** roda CPU-only. Funciona em qualquer máquina Windows. Democraticamente mais acessível.

**Mercados distintos** — não é concorrente direto real.

---

### 2. Gigantes da nuvem

#### NotebookLM (Google)

O concorrente mais perigoso. Mesma proposta de valor (chat com citação de fonte sobre suas fontes), produto Google, gratuito, browser-first.

| | NotebookLM | Tusab |
|---|---|---|
| Qualidade do RAG | Alta (Gemini 1.5 Pro + contexto longo) | Boa (BM25 + CrossEncoder) |
| Extração YouTube | Vídeos individuais | Canais inteiros em escala |
| Instalação | Zero (browser) | Executável Windows |
| Privacidade | ✗ (servidores Google) | ✅ (local-first) |
| Audio Overview (podcast gerado) | ✅ | ✗ |
| Citações navegáveis e clicáveis | ✅ | ✗ (gap a fechar) |
| Fluxo professor → aluno | ✗ | ✅ (.tusab) |
| Uso offline | ✗ | ✅ (Ollama) |
| Documentos sensíveis / corporativos | Bloqueador | ✅ |

**O risco estratégico central:** se o Google habilitar extração de canal completo (não apenas vídeo individual), o principal diferencial de captura do Tusab para usuários casuais desaparece. A janela estimada é de 12–18 meses. O Tusab precisa avançar no grafo de conhecimento e no servidor MCP antes disso.

**Conclusão:** o NotebookLM valida o mercado. O Tusab ocupa o nicho que o NotebookLM deliberadamente não quer: local, privado, sem Google, com extração em escala e fluxo professor→aluno.

---

#### Claude Projects (Anthropic) / ChatGPT

Melhor qualidade de RAG em nuvem, UI polida, mobile, colaboração em equipe.

**Onde o Tusab ganha:** privacidade total, sem custo recorrente sobre o corpus, corpus ilimitado em tamanho, sem conta obrigatória.

**Onde o Tusab perde:** qualidade de resposta (margem considerável), facilidade de acesso, mobile.

**Público distinto** — quem precisa de privacidade não usa esses.

---

#### ChatPDF e clones

Ferramentas de arquivo único. Não indexam canais. Não têm chat persistente. Não são PKM real.

---

### 3. PKMs tradicionais com IA

#### Obsidian + plugins (Smart Connections, Copilot)

O rei do PKM local. Cofre de notas com plugins que conectam Ollama ou OpenAI. Comunidade enorme. Altamente flexível.

| | Obsidian + plugins | Tusab |
|---|---|---|
| Graph view / backlinks | ✅ | ✗ |
| Extração YouTube nativa | ✗ | ✅ |
| Parser WhatsApp / Reuniões | ✗ | ✅ |
| Configuração de IA | Complexa (dezenas de plugins) | 1 clique |
| Busca de texto completo com preview | ✅ | ✗ (só via chat) |
| Público-alvo | Técnicos e entusiastas | Estudantes a especialistas |

**Onde perde:** o Obsidian mostra ao usuário sua rede de conhecimento — ele *vê* o que construiu. O Tusab não tem nenhuma representação visual da base após a ingestão. Gap de percepção de posse.

**Conclusão:** usuários Obsidian são early adopters técnicos — canal válido de aquisição, mas não é o usuário principal do Tusab.

---

#### Notion AI / Mem.ai

Plataformas em nuvem que auto-organizam notas e buscam respostas dentro do workspace.

**Onde o Tusab ganha:** privacidade local, zero custo de assinatura para o corpus, extração de YouTube.

**Públicos distintos** — usuários dessas plataformas já estão comprometidos com a nuvem.

---

### Mapa de posicionamento

```
                        PRIVACIDADE LOCAL
                              ▲
                              │
           Tusab ●────────────┤────── AnythingLLM
                              │         GPT4All
                              │
  CAPTURA SIMPLES ────────────┼──────────────── CAPTURA RICA
  (arquivo único)             │              (múltiplas fontes,
                              │               canais inteiros)
                              │
           ChatPDF ●    NotebookLM ●    Obsidian ●
                              │
                              ▼
                          NUVEM / IA CLOUD
```

**O posicionamento defensável do Tusab:** quadrante superior direito — privacidade local com captura rica de múltiplas fontes. Nenhum concorrente ocupa esse espaço com UX não-técnica.

---

### Diferenciais realmente defensáveis

Genuinamente difíceis de copiar no curto prazo:

1. **Extração YouTube em escala + parser WhatsApp/Zoom em um executável Windows com UX simples** — combinação única: yt-dlp + parsers especializados + RAG em 1 clique
2. **Fluxo professor→aluno via `.tusab`** — sem equivalente no mercado. Potencial de viralidade orgânica em contexto educacional
3. **CPU-only + offline total com UX não-técnica** — AnythingLLM e GPT4All também rodam local, mas a UX do Tusab é mais acessível para o segmento não-desenvolvedor

Diferenciais frágeis (fáceis de copiar por qualquer concorrente):
- Multi-LLM: commodity
- i18n PT/EN/ES: commodity
- Perfis de usuário: cosmético

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

## O pipeline IAC em detalhe

**I — INDEX**
Extração e indexação de qualquer fonte de conhecimento: YouTube, PDFs, Word, Markdown, texto colado, áudio, imagem, WhatsApp, transcrições. O produto ingere, processa e estrutura o que você escolheu aprender.

**A — AUGMENT**
Retrieval-Augmented Generation (RAG): quando você faz uma pergunta, o produto recupera os trechos mais relevantes da sua base e os entrega ao modelo de linguagem como contexto. Não é IA genérica — é sua base amplificando a resposta.

**C — CONVERSE**
A interface de conversa com o agente: você pergunta em linguagem natural, recebe resposta com citação de fonte, pode aprofundar, questionar, pedir exemplos. É o ponto de entrega do valor.

O mentor do Tusab só sabe o que você ensinou a ele. Isso não é limitação — é a garantia de que ele não inventa.

---

## Relação com o ecossistema local

O Google lançar modelos cada vez melhores rodando localmente não é uma ameaça ao Tusab — é validação e combustível.

O Google entrega o motor. O Tusab entrega a camada de conhecimento. São complementares, não concorrentes.

- Motor (Gemma, Llama, Phi, Qwen via Ollama) → processa linguagem
- Tusab → extrai, indexa, cita fontes, entrega interface

Quanto melhor o motor disponível, mais capaz fica o mentor do Tusab. O usuário não precisa saber que existe um Gemma 3 por baixo — ele só sabe que o mentor ficou mais inteligente.

O NotebookLM nunca vai querer o nicho local/privado — é um produto de nuvem por design. Esse espaço fica estruturalmente aberto. O Tusab ocupa.

---

## Arquitetura narrativa (comunicação)

**Linha de frente** — gatilho de atenção:
> "Seu conhecimento, consultável. Sem perder tempo."

Resolve a dor imediata: conteúdo demais, tempo de menos.

**Segunda camada** — construção de confiança:
> "Só responde com o que você escolheu. Cita sempre a fonte. Você verifica."

Diferencia de IA genérica sem precisar atacar ninguém.

**Braço estratégico** — para B2B e perfis avançados:
> "Num mundo de conteúdo sem autoria, Tusab é o assistente que você pode auditar."

Argumento de governança para instituições.

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
