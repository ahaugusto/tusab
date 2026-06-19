# Evolução do Produto — De Raspador a Plataforma de IA

**Autor:** Augusto Brasil  
**Início:** Fevereiro 2025 · **Última atualização:** Junho 2026  
**© 2026 CriAugu — CNPJ 65.131.075/0001-57**

---

> Este documento conta a história do Tusab como ela aconteceu — as decisões, os nomes que não ficaram, os pivots, os saltos. Não é um relatório técnico. É um registro de evolução para que qualquer pessoa que entre no projeto entenda de onde veio, o que é hoje, e por que cada camada existe.

---

## Capítulo 1 — A dor original: um aluno que não conseguia acompanhar

O Tusab não nasceu de uma oportunidade de mercado.  
Nasceu de frustração pessoal — e virou produto porque a frustração não era só minha.

Em 2025, eu estava fazendo um curso de investimentos na AUVP, do Raul Sena (canal Investidor Sardinha). O Raul publicava vídeos todos os dias — shorts, podcasts, aulas, ao vivo. Volume enorme. Conteúdo valioso. Mas inacessível na prática, porque vídeo não permite consulta. Eu precisava da resposta específica. Não do vídeo inteiro de 40 minutos para encontrá-la.

O problema não era falta de conteúdo. Era que o formato vídeo não foi feito para consulta.

A resposta mais direta foi técnica: extrair as transcrições do YouTube via `yt-dlp` e armazenar localmente. Esse foi o primeiro experimento — literalmente um script. Sem nome. Sem interface. Sem IA. Só arquivos `.txt` numa pasta chamada `cerebro_txt/`.

Mas o experimento funcionou bem o suficiente para uma pergunta surgir: *e se eu mostrasse isso ao Raul Sena?*

Quando mostrei, a AUVP comprou a ideia. Esse foi o primeiro sinal de *willingness-to-pay* — e definiu a direção dos próximos meses.

---

## Capítulo 2 — SardinhIA: o primeiro produto com nome

Com a validação da AUVP em mãos, o script virou um produto com nome: **SardinhIA**.

O nome era intencional — referência direta ao Investidor Sardinha, sinalizando que o produto tinha um dono, uma audiência, um propósito específico. Não era uma ferramenta genérica de IA. Era o motor de conhecimento do canal do Raul Sena.

### O que era o SardinhIA V1 (Fevereiro 2025)

A primeira versão funcionava assim:

1. Extraía transcrições de **seis abas** do canal `@InvestidorSardinha`: Shorts, Ao Vivo, Podcasts, Cursos, Playlists e Vídeos
2. Quebrava o conteúdo em chunks de até 40.000 palavras
3. Salvava localmente em `cerebro_txt/` como arquivos `.txt`
4. Enviava para o **Google Drive** na pasta `AUVP - Base de Conhecimento`
5. Rastreava tudo num CSV (`base_conhecimento_auvp.csv`) com ID, título, aba, data, views e status

A interface era desktop — **CustomTkinter**, dark theme, sidebar com logo da AUVP, cards de stats, abas de navegação. Controles simples: "Ligar Motor", "Pausar", "Cancelar".

O produto era mono-canal por design. `FONTES_AUVP` estava hardcoded no `motor_sardinha.py`. A arquitetura inteira pressupunha que o canal era sempre `@InvestidorSardinha`. Isso era uma característica, não uma limitação — o produto existia para um propósito específico.

### SardinhIA Integrated V2 (Maio 2025)

A segunda versão tentou algo mais ambicioso: adicionar Instagram como segunda fonte. Um `motor_instagram.py` foi escrito, uma pasta `cerebro_insta_txt/` foi criada, CSVs separados foram estruturados.

Não foi pra frente. O Instagram mudou o acesso via API, a extração ficou frágil, e o esforço de manutenção não compensava. Esse pivot foi descartado em poucas semanas — mas deixou um aprendizado importante: **multi-fonte vale a pena, Instagram não era o caminho certo**.

### sardinh-ia: o motor estabilizado (Março–Maio 2025)

Em paralelo às iterações de UI, um repositório Git separado chamado `sardinh-ia` foi criado para isolar e estabilizar o motor de extração. Aqui a arquitetura migrou de **CustomTkinter para FastAPI** — a interface passaria a ser web, e o motor seria uma API REST.

Trinta commits documentam esse período. A branch `feature/engine-resiliencia-auditoria` adicionou relatórios de checkup, auditoria de erros, e mecanismos de resiliência que sobreviveram até o Tusab atual.

A versão `v1.1` do `sardinh-ia` era funcional, testada, e podia ser distribuída. Mas tinha um problema de identidade: o nome "SardinhIA" amarrava o produto ao canal do Raul Sena. Se a ideia era generalizar — e a AUVP já tinha comprado, mas outros criadores também poderiam querer — o nome precisava mudar.

---

## Capítulo 3 — A primeira troca de nome: de SardinhIA para Sebayt

O primeiro rebranding não foi para Tusab diretamente.

O nome intermediário foi **Sebayt** — palavra egípcia antiga para "ensinamento" ou "sabedoria transmitida de geração em geração". A escolha foi deliberada: referência a Thoth, o deus egípcio do conhecimento e da escrita, que seria uma influência estética e conceitual recorrente no produto.

Sebayt sinalizava que o produto não era mais "o motor do canal do Investidor Sardinha". Era uma ferramenta de gestão de conhecimento com identidade própria.

Esse período marcou também a migração definitiva de CustomTkinter para React — a interface web que existe hoje começou a ser construída aqui.

---

## Capítulo 4 — O segundo rebranding: Sebayt vira Tusab

O commit `6472517` registra: *"feat: renomear produto de Sebayt para Tusab"*.

**Tusab** — outro termo do antigo Egito, associado à preservação e gestão de conhecimento. O nome ficou. Era ao mesmo tempo mais curto, mais fácil de pronunciar, e mantinha a conexão com a identidade egípcia/Thoth que o produto estava construindo.

Com o nome definido, veio a refatoração de arquitetura que separou o motor do agent:

```
motor_tusab.py     ← extração YouTube + Drive
agent_tusab.py     ← RAG + chat + indexação
```

Dois shims na raiz que permanecem até hoje para compatibilidade com o Electron e código legado.

---

## Capítulo 5 — O primeiro salto técnico: de arquivos para base consultável

Com o rebranding feito, o foco voltou para o produto. E o produto tinha um problema que o SardinhIA original nunca resolveu: **arquivos `.txt` numa pasta são inúteis sem busca**.

A segunda iteração adicionou indexação **BM25** — um algoritmo de ranking textual dos anos 80 que, contrariando o senso comum sobre IA moderna, ainda supera redes neurais em buscas lexicais diretas.

A escolha do BM25 foi deliberada e permanece até hoje:

- **Zero dependência de GPU.** ChromaDB e embeddings requerem modelos de 400 MB e aceleração de hardware. BM25 roda em qualquer máquina com 4 GB de RAM.
- **Transparência total.** Você pode inspecionar o score de cada chunk. Não é caixa preta.
- **Velocidade.** Indexar um canal de 500 vídeos leva segundos, não minutos.
- **Offline por design.** Sem embeddings, sem chamada externa, sem API.

Uma tentativa anterior de usar ChromaDB foi feita — e descartada. O overhead de 400 MB de modelo de embedding para uma busca que BM25 resolve em 3–8 segundos não fazia sentido no contexto local-first.

Com o BM25, o Tusab ganhou um motor de busca. Mas ainda faltava o componente de linguagem — algo que transformasse os chunks encontrados em resposta legível.

---

## Capítulo 6 — O segundo salto: RAG e o nascimento do chat

A adição do pipeline RAG (*Retrieval-Augmented Generation*) foi o momento em que o Tusab deixou de ser uma ferramenta de busca e se tornou um assistente de conhecimento.

O pipeline ficou assim:

```
Pergunta → BM25 (recupera chunks relevantes) → LLM (gera resposta com base nos chunks)
```

A decisão arquitetural mais importante aqui foi **Ollama como padrão**. LLMs locais significavam:

1. **Custo zero** — sem API paga para o usuário casual.
2. **Privacidade por design** — nenhum dado sai da máquina.
3. **Funcionamento offline** — independência total de conectividade.

Provedores externos (Groq, OpenAI, Anthropic, Gemini) foram adicionados como opção para quem prioriza velocidade ou qualidade de resposta, mas nunca como padrão obrigatório.

O chat foi lançado como um drawer lateral simples — uma caixa de pergunta e uma caixa de resposta. Streaming foi adicionado logo depois para eliminar a percepção de lentidão. Cada resposta chegava palavra por palavra, como uma conversa real.

O changelog `v0.3.0` registra: *"ChromaDB e embeddings substituídos por BM25 local"*. Não foi uma substituição menor — foi uma decisão de arquitetura que definiu o posicionamento do produto para sempre.

---

## Capítulo 7 — O terceiro salto: da ferramenta para o produto

Ter extração + índice + chat não faz um produto. Faz uma prova de conceito.

A transição de PoC para produto envolveu um conjunto de decisões simultâneas:

### 7.1 Multi-fonte: o YouTube virou uma fonte entre muitas

O Tusab parou de ser "o raspador do YouTube" quando adicionou suporte a PDFs, DOCX, planilhas Excel, CSV, Markdown, texto colado, imagens e áudio. O YouTube virou uma fonte entre muitas. A base de conhecimento do usuário passou a ser qualquer coisa que ele escolhesse trazer.

Isso mudou o posicionamento: não é uma ferramenta para YouTube. É uma ferramenta para *seu* conhecimento, independente de onde ele está.

O caso de uso que surgiu naturalmente: um estudante que combina o canal do professor no YouTube com as apostilas em PDF e suas anotações coladas como texto. A base de conhecimento é dele — curada por ele, consultável quando precisar.

### 7.2 Modularização: o código que vai escalar

Em junho de 2026, o código estava em três arquivos monolíticos com mais de 3.000 linhas combinadas:

```
Antes: api_tusab.py (1.189 linhas) · motor_tusab.py (923) · agent_tusab.py (809)
```

Isso não era sustentável. A refatoração para `tusab_engine/` com 9 módulos foi feita sem quebrar nenhuma API, com 23 testes passando antes e depois:

```
Depois: tusab_engine/ com storage, state, motor/, agent/, api/
        — cada módulo com responsabilidade única
```

Isso não foi só organização. Foi a fundação técnica que permite que o produto escale — novos provedores, novos formatos, novos tipos de export — sem tocar em código que não deveria ser tocado.

### 7.3 Segurança: doze vulnerabilidades corrigidas antes da distribuição

Doze vulnerabilidades foram identificadas e corrigidas antes da primeira distribuição pública: CORS aberto, path traversal, prompt injection, histórico de chat manipulável pelo cliente, upload sem limite, entre outras.

A Política de Privacidade foi escrita antes de qualquer venda — não como burocracia, mas porque o posicionamento *local-first* exige que a empresa que o criou também respeite os dados do usuário.

### 7.4 Freemium: Free entrega o loop de valor completo

O modelo Free/Pro foi definido com um princípio claro: **Free entrega o loop de valor completo**. O usuário consegue extrair, indexar e conversar sem pagar nada. Pro adiciona escala e controle — canais ilimitados, exports, multi-canal, personas customizadas — para quem usou e quer mais.

Isso é diferente de freemium que frustra descoberta (paywall antes do valor). O Tusab apostou em generosidade no Free para que o Pro seja uma escolha natural de quem já entendeu o valor.

---

## Capítulo 8 — O quarto salto: inteligência conversacional

Esta é a camada mais recente — adicionada em junho de 2026 — e a que mais claramente separa o Tusab de um "buscador com respostas" para um assistente com personalidade e contexto.

### 8.1 Multi-base e chips de contexto

Antes, o chat era vinculado a um único canal. Agora, o usuário pode selecionar múltiplas bases simultaneamente — e o contexto ativo fica visível como chips acima do input, removíveis com um clique. A busca BM25 é executada em paralelo em todas as bases e os resultados são ranqueados por score unificado.

Isso abriu um caso de uso novo: *cruzamento de conhecimento entre fontes diferentes*.

### 8.2 Tom da conversa e personas

O Tusab ganhou um sistema de personas que permite ao usuário definir como o assistente responde — não o que ele sabe, mas como ele comunica:

| Persona | Instrução injetada no prompt |
|---------|------------------------------|
| **Objetivo** | Linguagem direta, sem floreios |
| **Técnico** | Terminologia precisa, dados e nomenclaturas exatas |
| **Didático** | Exemplos, analogias, passo a passo |
| **Descontraído** | Tom leve, como uma conversa entre amigos |
| **Socrático** | Cada resposta termina com uma pergunta que aprofunda o raciocínio |

A instrução de tom é injetada diretamente no prompt do LLM — uma linha adicional que muda o comportamento sem alterar a lógica de recuperação. Simples e eficaz.

Personas customizadas (criar, nomear, definir instrução livre) são funcionalidade Pro.

### 8.3 Saudações contextuais com temas da base

Quando o usuário envia uma saudação ou mensagem de teste (`oi`, `teste`, `ping`, `funciona?`...), o Tusab não responde com uma mensagem genérica. Ele:

1. Lê o índice da base ativa e extrai os termos mais frequentes nos títulos dos chunks.
2. Usa esses termos como "temas representativos" da base.
3. Passa esses temas ao LLM com instrução de mencioná-los na saudação de volta.

O resultado é uma resposta que, além de cumprimentar, contextualiza o usuário sobre o que está na sua própria base — convidando-o a explorar com perguntas reais.

```
Usuário: "oi"
Tusab:   "Olá! Sua base TED tem conteúdo sobre Resiliência, Liderança e 
          Criatividade. Quer explorar algum desses temas?"
```

### 8.4 Histórico de conversas como repositório

Conversas salvas via "Nova conversa" não são apenas arquivos de log. São arquivos `.txt` armazenados na pasta de textos do canal, no mesmo formato dos outros documentos da base. Isso significa que, na próxima indexação, o histórico de conversas *entra no índice BM25* — o Tusab passa a ser capaz de recuperar contexto de conversas anteriores como se fossem documentos.

Não foi planejado assim desde o início. Emergiu da arquitetura.

### 8.5 Sumarização progressiva: conversas longas com coerência

O histórico enviado ao LLM tem limite de 12 mensagens (6 trocas). Quando esse limite é atingido, o Tusab não descarta simplesmente as mensagens mais antigas — ele as comprime via LLM em 3–5 frases e mantém esse resumo como contexto. As trocas recentes ficam intactas.

Isso permite conversas de pesquisa longa — onde o usuário explora um tema, muda de ângulo, refina hipóteses — com coerência ao longo de toda a sessão. O fallback é simples: se a sumarização falhar por qualquer motivo, as 4 mensagens mais recentes são mantidas. O chat nunca quebra.

### 8.6 Seleção de escopo por pasta: controle epistêmico antes de perguntar

O quinto salto — em junho de 2026 — foi talvez o menos óbvio e o mais significativo para o posicionamento de longo prazo.

O problema: bases grandes, com múltiplas fontes (YouTube, documentos, transcrições de reuniões, conversas de WhatsApp), geram respostas ruidosas quando o usuário quer perguntar sobre apenas uma dessas camadas. A solução anterior seria criar bases separadas — com toda a fricção de manter e indexar múltiplos repositórios.

A solução implementada foi diferente: antes de indexar, o usuário abre um accordion e seleciona quais pastas quer incluir. O BM25 é construído apenas com o subconjunto selecionado. Na próxima vez, pode indexar com outra seleção.

```
Base do canal: YouTube / Documentos / Transcrições / WhatsApp
Usuário: [✓] YouTube   [ ] Documentos   [✓] Transcrições   [ ] WhatsApp
→ BM25 construído apenas com YouTube + Transcrições
→ Todas as respostas daquela sessão vêm exclusivamente dessas fontes
```

Isso é controle epistêmico em nível de conversa — não só em nível de base. O usuário não apenas escolhe o que entra na base (Nível 1) mas o que a IA pode ver em cada sessão (Nível 2). A curadoria é uma decisão de longo prazo; o escopo é uma decisão de momento.

Para o posicionamento: nenhum assistente de IA comercial permite esse nível de controle sem criar projetos separados com múltiplos uploads. O Tusab faz isso porque a arquitetura é local, o índice é transparente, e o usuário é tratado como alguém que sabe o que está fazendo.

---

## Capítulo 9 — O que o Tusab se tornou

Olhando o caminho percorrido, há uma progressão clara:

```
Script de extração YouTube (sem nome, 2025)
  → SardinhIA V1: motor mono-canal + Google Drive + CustomTkinter (Fev 2025)
    → SardinhIA Integrated V2: tentativa multi-fonte com Instagram (Mai 2025, descontinuado)
      → sardinh-ia: FastAPI + motor estável + 30 commits de refinamento (Mar–Mai 2025)
        → Sebayt: rebranding + React + identidade egípcia (Jun 2025)
          → Tusab: nome definitivo + BM25 + RAG + Electron (Jun 2025)
            → Tusab v2.4: multi-base, personas, saudações contextuais (Jun 2026)
```

Cada camada foi adicionada em resposta a uma limitação da camada anterior. Nenhuma foi adicionada por especulação sobre o que o mercado poderia querer no futuro.

O produto hoje tem:

- **31 endpoints FastAPI** organizados em 4 routers por domínio
- **Extração** de YouTube, PDF, DOCX, MD, TXT, imagens, áudio
- **Indexação BM25** com enriquecimento (tags 3×, keywords TF-IDF 2×, descrições)
- **Chat RAG streaming** com 5 provedores LLM + Ollama local gratuito
- **Multi-base** com busca paralela e seleção visual via chips
- **5 personas de tom** injetadas no prompt + personas customizadas (Pro)
- **Sumarização progressiva** de histórico — conversas longas sem perda de coerência
- **Seleção de escopo por pasta** — controle epistêmico em nível de conversa
- **Histórico de conversas** como repositório indexável
- **Importação de WhatsApp** (Android/iOS) com detecção automática de formato e estruturação por dia/participante
- **Saudações contextuais** com temas extraídos do índice via BM25
- **Exports Pro** (ZIP, MD, DOCX, XLSX, PDF)
- **Relatório de extração** com filtros, views, busca full-text
- **Interface trilingue** (PT/EN/ES) com acessibilidade WCAG 2.1 AA
- **Distribuição Electron** com Python embeddable bundled — instalador único `.exe`

---

## Capítulo 10 — Os três alvos que a jornada revelou

O produto nasceu como solução para um problema pessoal. A generalização revelou três camadas de mercado que se alimentam:

**Camada 1 — B2C: "Um RAG pra chamar de meu"**  
O usuário monta a própria base com as fontes que escolhe: canais do YouTube, PDFs, documentos, anotações. O caso de origem foi o próprio Augusto como aluno da AUVP.

**Camada 2 — B2B Creator: "O assistente do criador"**  
O criador oferece à audiência um assistente com a própria voz — não apenas o YouTube, mas roteiros, apostilas, pesquisas. O case de referência é a AUVP: a ideia foi vendida ao Raul Sena antes do produto existir formalmente.

**Camada 3 — B2B Enterprise: "O arquivo institucional vivo"**  
Instituições com acervos imensos (lives, PDFs, atas, regulamentos) ganham uma base consultável, rodando na rede interna, sem depender de servidor externo.

As três camadas se alimentam: o aluno B2C que usa Tusab com conteúdo da FGV é o case study para a FGV contratar a Camada 3.

---

## Capítulo 11 — O que ainda não é

Honestidade sobre as limitações é parte da documentação:

**Não tem reranking semântico.** O BM25 é puramente lexical. Uma pergunta sobre "retorno financeiro" não recupera automaticamente chunks que usam "rendimento" ou "yield". Query expansion mitiga isso para provedores rápidos, mas não resolve completamente.

**Memória de longo prazo parcialmente resolvida.** O limite de 6 trocas (12 mensagens) ainda existe, mas a sumarização progressiva comprime o histórico anterior em vez de descartá-lo. Conversas longas mantêm coerência. A solução ideal — memória vetorial persistente entre sessões — não está implementada.

**Não tem atualização automática da base.** Novos vídeos publicados num canal já indexado não entram automaticamente. O usuário precisa extrair e reindexar manualmente.

**Não tem modo multi-usuário.** Cada instalação é pessoal. O modo institucional (servidor compartilhado, múltiplos usuários, permissões) está no roadmap mas não foi iniciado.

**Não tem primeira venda formal.** O produto está tecnicamente distribuível. O gargalo hoje é go-to-market — landing page, OAuth em produção, contrato de venda B2B.

---

## Capítulo 12 — Princípios que guiaram cada decisão

Olhando o histórico, alguns princípios aparecem repetidamente nas escolhas feitas:

**1. Local-first não é restrição, é diferencial.**  
Cada decisão que manteve dados na máquina do usuário foi também uma decisão de posicionamento. O Tusab não pode ser copiado como SaaS por um player grande sem perder o que o define.

**2. Fazer funcionar antes de fazer bonito.**  
A interface passou por três rewrites completos (CustomTkinter → React básico → React modularizado). Mas o motor de extração e a busca BM25 estavam funcionando antes do primeiro modal com animação.

**3. Nomes importam — e mudar de nome tem custo.**  
SardinhIA → Sebayt → Tusab. Cada mudança de nome teve razão técnica ou estratégica, mas cada uma custou tempo de refatoração e risco de breaking change. Tusab ficou — e vai ficar.

**4. Feito é melhor que perfeito — e documentado é melhor que apenas feito.**  
Mais de vinte documentos foram escritos junto com o código. Não depois. Decisões descartadas têm racional registrado. Bugs corrigidos têm história.

**5. O usuário não deve pagar por descoberta.**  
O Free não é uma isca — é o produto completo para o caso de uso individual. O Pro é escala e controle para quem já entendeu o valor e precisa de mais.

**6. Auditabilidade como valor.**  
Toda resposta cita a fonte. O usuário pode checar. Isso não é um detalhe de UX — é o que separa o Tusab de uma IA que inventa.

---

*Este documento será atualizado a cada salto relevante na evolução do produto. O critério para "salto relevante" é simples: se mudou o que o produto é — não apenas o que ele faz — vale documentar.*
