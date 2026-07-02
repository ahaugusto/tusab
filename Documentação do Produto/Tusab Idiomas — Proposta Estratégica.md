# Tusab Idiomas — Proposta Estratégica
**Segmento:** Escolas de idiomas (inglês, espanhol, etc.)
**Status:** Rascunho estratégico — campo das ideias
**Data:** Junho 2026
**Referência técnica:** Ver [B2B — Estratégia de Monetização e Segmentos.md](B2B — Estratégia de Monetização e Segmentos.md)

---

> **⚠️ Atualização (jul/2026) — reposicionamento sob o Tusab Enterprise:** este vertical é um **pacote de go-to-market do Tusab Enterprise**, a edição institucional definida em [Plano B2B — Tusab Enterprise.md](Plano B2B — Tusab Enterprise.md). Todos os verticais compartilham a mesma base de código e o mesmo instalador enterprise (com a stack semântica completa: CrossEncoder + KeyBERT); a diferenciação entre eles é comercial — empacotamento, curadoria de conteúdo e persona — nunca fork técnico. Gatilho de execução: primeiro lead concreto do segmento (Fase 1 do plano).


## Por que idiomas é segmento diferenciado

**Sobreposição técnica:** o Tusab já tem i18n nativo PT/EN/ES. O motor BM25 funciona em qualquer idioma. O corpus em inglês ou espanhol é indexado da mesma forma que em português. A adaptação é quase zero do lado técnico.

**O mercado:** ~12 milhões de brasileiros estudam inglês em escolas de idiomas. CCAA, Wizard, Fisk, CNA, Cultura Inglesa, Yazigi — todas produzem conteúdo proprietário. Franquias com centenas de unidades são o alvo de rede.

**Diferença dos outros segmentos:**
- Conteúdo é multilíngue por natureza — o assistente responde em inglês para praticar, ou em português para explicar gramática
- O corpus inclui vídeos nativos em inglês (YouTube de canais americanos/britânicos) + material próprio da escola
- Prática de conversação via chat é use case novo — o aluno conversa com o assistente como exercício de fluência

---

## Personas e Jobs to be Done

### Professor / Coordenador de Curso
**Job:** "Quero que o aluno pratique inglês entre as aulas, com material alinhado ao nível e ao método da escola."

- Indexa videoaulas e podcasts em inglês do canal da escola
- Faz upload de livros didáticos, áudios transcritos, exercícios
- Configura o assistente para responder sempre em inglês (ou bilingue para níveis básicos)
- Quer saber quais estruturas gramaticais os alunos mais erram

### Aluno de Idiomas
**Job:** "Quero praticar inglês conversacional fora da aula, sem medo de errar na frente de outros."

- Chat em inglês com o assistente (modo conversação)
- Perguntas sobre gramática com explicação contextualizada no material do livro
- Feedback de vocabulário — o assistente corrige e sugere alternativas
- Progressão por nível (A1–C2) — a base disponível muda conforme o nível do aluno

---

## Diferenciais específicos para idiomas

1. **Prática de conversação 24/7** — o aluno conversa em inglês com o assistente entre as aulas. É o lab de conversação sem professor, sem horário, sem julgamento.

2. **Corpus nativo + material da escola** — o assistente conhece tanto o livro didático do curso quanto canais nativos em inglês indexados (TED Talks, BBC Learning English). Resposta contextualizada no nível do aluno.

3. **Modo bilingue configurável** — nível básico: explicações em português, exemplos em inglês. Nível avançado: 100% em inglês. Professor configura por turma.

4. **Timestamp clicável em vídeos nativos** — aluno pergunta "o que significa 'nevertheless' naquele contexto?" e recebe o trecho exato da videoaula onde a palavra foi usada.

---

## MVP para escola de idiomas

**Diferença dos outros segmentos:**
- Língua de interface do assistente é configurável por turma (não por usuário)
- Corpus inclui vídeos em inglês/espanhol — BM25 funciona, mas CrossEncoder precisaria de modelo multilíngue (ms-marco-MiniLM é em inglês — adequado para inglês nativo)
- Modo conversação é novo: o assistente não só responde perguntas, mas também inicia exercícios ("Vamos praticar Past Perfect? Me conte o que você fez ontem em inglês.")

**O que entra no MVP:**
- Tudo do Tusab School MVP +
- Configuração de idioma de resposta por turma/nível
- Corpus multilíngue (inglês + português no mesmo projeto)

**O que fica para v2:**
- Modo conversação proativo (assistente inicia exercícios)
- Feedback automático de gramática e vocabulário
- Progressão por nível com desbloqueio de bases
- Integração com plataforma de franquia (CCAA, Wizard têm sistemas próprios)

---

## Modelo de negócio

| Tier | Preço estimado | O que inclui |
|------|---------------|--------------|
| **Piloto** | Gratuito / 3 meses | 1 nível, até 30 alunos |
| **Escola** | R$ 4.800/ano | Todos os níveis, 200 alunos, suporte email |
| **Franquia (por unidade)** | R$ 3.600/ano | Desconto volume, painel centralizado |
| **Franquia (rede)** | Negociação | 50+ unidades, API de integração, white-label |

**Argumento de venda para franquia:** uma franquia com 200 unidades pagando R$ 3.600/ano = R$ 720.000/ano em receita recorrente de um único contrato.

---

## Riscos específicos do segmento

| Risco | Mitigação |
|-------|-----------|
| Duolingo / apps de idiomas já fazem isso | Diferencial: material proprietário da escola, não conteúdo genérico. Aluno já é cliente da escola — o assistente é extensão do método |
| Franquia tem sistema próprio incompatível | MVP standalone, integração na v2 via API |
| CrossEncoder em inglês tem desempenho diferente do PT | Testar com corpus nativo antes de vender — pode precisar de modelo multilíngue |

---

*Próximo passo: testar indexação de corpus 100% em inglês e validar qualidade do RAG antes de qualquer proposta comercial.*
