# Brainstorming durante o desenvolvimento

Registro de ideias levantadas no meio do trabalho técnico — não são decisões, não são roadmap. É o lugar pra guardar um pensamento antes que ele se perca, com contexto suficiente pra retomar depois. Cada entrada tem data, o que motivou a ideia, e um veredito honesto (mesmo que o veredito seja "não sei ainda").

---

## Spec-kit + Graphify: framework próprio de "context engineering" para agentes de IA? (30/jul/2026)

**Contexto que gerou a ideia:** na mesma sessão em que adotamos o [GitHub Spec Kit](https://github.com/github/spec-kit) (spec-driven development, `agents/_historia.md`) e avaliamos o [Graphify](https://github.com/Graphify-Labs/graphify) (grafo de conhecimento navegável do código-fonte, testado ao vivo no próprio repo do Tusab — ver `agents/_historia.md`), Augusto levantou a pergunta: o Graphify tem um comando `affected "X"` (travessia reversa: "o que é impactado se eu mexer em X") que serviria como insumo mecânico e preciso *antes* de escrever um plano no spec-kit — em vez do agente confiar só em leitura manual de código pra mapear o raio de impacto de uma mudança. Daí a pergunta seguinte: isso é ideia de **produto novo** — um framework que une as duas coisas visando spec mais preciso + redução de consumo de tokens?

**Avaliação honesta (não testada ainda na prática — ver seção de validação):**

- **Como produto novo, veredito é não apostar.** Tanto o spec-kit (GitHub, MIT) quanto o Graphify (YC S26, Apache 2.0) já são ferramentas de terceiros bem estabelecidas exatamente nesse nicho — "context engineering para agentes de IA" é um espaço ativamente disputado e bem financiado agora (o próprio Graphify já mede "token reduction vs naive full-corpus approach" como benchmark próprio, ou seja, já ataca esse problema). Construir uma camada de integração entre as duas seria colar em cima do trabalho de outras duas empresas, sem moat técnico próprio defensável.
- **Como prática interna de desenvolvimento do Tusab, é genuinamente valiosa.** Redução de tokens e specs mais completos beneficiam qualquer sessão futura de trabalho neste repositório — isso não é o produto Tusab (PKM/RAG pra usuário final), é *como* o Tusab é construído. Cabe como refinamento de processo, documentado aqui e em `agents/_historia.md`, não como iniciativa de produto.
- **Não confundir com GraphRAG do produto.** Essa ideia é sobre o *código-fonte do Tusab* (ferramenta de desenvolvimento). É uma discussão separada de GraphRAG para o *conteúdo do usuário* (transcrições/documentos), que já foi avaliado e descartado por enquanto — baixa densidade relacional do corpus atual (ver `agents/_historia.md`).

**Validação em andamento (mesma sessão):** rodamos `graphify extract` com backend Ollama local (100% offline, sem dado saindo da máquina) contra um projeto real do Tusab (`data/neural/RAG`, 38 arquivos) pra ver se um grafo semântico sobre *conteúdo* (não só código) produz algo útil — isso serve duplo propósito: valida a técnica de integração E gera evidência nova sobre se a decisão de descartar GraphRAG pro conteúdo do usuário ainda se sustenta. Resultado ainda não coletado no momento desta entrada — atualizar aqui quando sair.

**Próximo passo, se a ideia continuar de pé depois da validação:** experimentar `graphify affected "X"` como step manual antes de um `/speckit-plan` real (não simulado) na próxima mudança grande, e registrar se isso de fato mudou a qualidade do plano gerado — sem isso, a hipótese continua sendo raciocínio, não fato.
