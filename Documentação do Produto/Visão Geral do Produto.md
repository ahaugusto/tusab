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

## Diferenciais reais

| Diferencial | Detalhe |
|-------------|---------|
| **Extração de canais YouTube em escala** | Canais inteiros — centenas de vídeos — extraídos automaticamente via yt-dlp local |
| **Multi-fonte** | YouTube + PDF + DOCX + Markdown + texto livre + imagens + áudio |
| **100% local** | Dados nunca saem da máquina; roda offline com Ollama |
| **Citação de fonte obrigatória** | Toda resposta cita título, data e link de origem — auditável por design |
| **BYOK** | Groq (grátis), OpenAI, Anthropic, Gemini como provedores opcionais |
| **Zero custo básico** | Ollama + llama3.2:1b funciona sem API key, sem assinatura, sem conta |
| **Parser de formatos especiais** | WhatsApp, Zoom, Otter, Teams — estruturados automaticamente antes da indexação |
| **Anti-alucinação** | Threshold BM25 + verificação pós-geração por keyword overlap |

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

**Onde o Tusab se diferencia de verdade:**

1. **Escala de extração do YouTube** — o NotebookLM aceita vídeos individuais; o Tusab extrai canais inteiros. Não é uma feature diferente. É uma magnitude diferente.

2. **Local-first** — o NotebookLM processa nos servidores do Google. Para uso institucional (documentos internos, atas, dados sensíveis), isso é bloqueador. Para o Tusab, é o design padrão.

3. **Sem dependência de conta Google** — funciona offline com Ollama. Sem risco de descontinuação ou mudança de política de privacidade.

**Conclusão:** o NotebookLM valida o mercado. O Tusab ocupa o nicho que o NotebookLM deliberadamente não quer: local, privado, sem Google.

### Obsidian AI / Notion AI

Ferramentas de organização de notas com IA adicionada. Não extraem YouTube nativamente, não rodam o modelo localmente como padrão, exigem assinatura para as features de IA.

### SummarizeYT / Glasp

Ferramentas de resumo de vídeos individuais. Não indexam canais, não têm chat, não são PKM.

---

## Público-alvo

### Aluno
Combina o canal do professor com apostilas e anotações pessoais. Pergunta sobre qualquer tema e recebe a resposta na linguagem e didática de quem já confia. É como ter o professor disponível a qualquer hora.

### Profissional
Relatórios, apresentações e artigos de referência em um único lugar consultável. Sem buscar em pastas, sem reler tudo — só perguntar ao mentor que conhece o contexto.

### Criador
Canal tem anos de conhecimento acumulado que os inscritos não conseguem acessar. Adiciona roteiros, materiais e pesquisas. Transforma tudo isso em um mentor com a própria voz.

### Instituição
Lives, webinars, documentos internos, atas de reunião. Tudo que foi produzido, agora consultável como um mentor vivo. Sem depender de servidor externo. Dados ficam na rede interna.

---

## O que o Tusab NÃO é

- Não é uma IA generativa (ChatGPT, Gemini, Copilot, Perplexity) — não responde perguntas sobre o mundo, apenas sobre o que foi indexado
- Não cria conteúdo novo — organiza e torna consultável o que existe
- Não substitui o criador — amplifica o alcance do que ele já produziu
- Não depende de servidor externo — roda local, dados do cliente são dele
- Não é SaaS — não há servidor central, não há assinatura obrigatória, não há plano Pro com paywall

---

## Modelo atual

O Tusab é **gratuito e completo**. Todas as features estão disponíveis sem paywall. O produto serve como vitrine técnica de Augusto Brasil / CriAugu no mercado, demonstrando competência em Electron, FastAPI, RAG local, segurança de aplicação e UX de produto.

O caminho de negócio é: vitrine técnica → cases documentados → contratos B2B com criadores e instituições.

Repositório: fechado. Proteção intelectual via Lei nº 9.609/1998 + Lei nº 9.610/1998 + CNPJ 65.131.075/0001-57. Registro INPI pendente.

Site: tusab.solutions

---

## Pitch de um parágrafo

Tusab é o seu mentor digital. Você extrai canais do YouTube, adiciona seus PDFs, documentos e anotações — tudo vira um mentor que responde suas perguntas citando a fonte exata de onde veio. Roda na sua máquina, funciona offline, zero custo com Ollama. Para criadores, vira um mentor com a própria voz. Para instituições, transforma qualquer acervo em infraestrutura consultável — sem servidor externo, sem assinatura obrigatória.
