# Tusab Vestibular — Proposta Estratégica
**Segmento:** Pré-vestibulares
**Status:** Rascunho estratégico — campo das ideias
**Data:** Junho 2026
**Referência técnica:** Ver [B2B — Estratégia de Monetização e Segmentos.md](B2B — Estratégia de Monetização e Segmentos.md)

---

## Por que pré-vestibular é segmento natural

**Sobreposição com escola:** o pré-vestibular é escola com foco de resultado. A estrutura é a mesma (professor, coordenador, aluno), mas a urgência é maior — o aluno tem data marcada e pressão de performance.

**O mercado:** cerca de 4 milhões de candidatos por ENEM anual. Cursinhos pré-vestibular movimentam ~R$ 4 bilhões/ano no Brasil. Coritiba, Anglo, Poliedro, Etapa, Objetivo — todos produzem conteúdo em escala.

**Diferença do segmento escola:**
- Aluno é mais velho (17–20 anos) e mais autônomo → aceita mais self-service
- Foco em ENEM/vestibulares específicos → corpus bem delimitado (provas anteriores + conteúdo do cursinho)
- Resultado mensurável: aprovação → argumento de venda e renovação claros
- Período letivo definido (fev–nov) → licença anual alinha perfeitamente

---

## Personas e Jobs to be Done

### Professor / Especialista de Área
**Job:** "Quero que meu resumo de Redação ENEM esteja acessível para o aluno revisar sozinho antes da prova."

- Indexa videoaulas do canal do cursinho por disciplina/área
- Faz upload de apostilas, resumos, provas comentadas dos últimos 10 anos
- Quer saber quais tópicos do ENEM os alunos mais erram (relatório de queries)

### Coordenador Pedagógico
**Job:** "Preciso que o conteúdo disponível para o aluno seja exclusivamente o que nosso método ensina — sem misturar com outras abordagens."

- Aprova bases por disciplina antes de liberar
- Identidade pedagógica do cursinho é o ativo principal — não pode ser diluída por respostas genéricas

### Aluno Pré-vestibulando
**Job:** "Quero revisar Biologia às 2h da manhã sem depender de ninguém."

- Chat com o material do cursinho
- Modo estudo com flashcards (gerados do conteúdo indexado) — diferencial crítico para vestibular
- Quiz SM-2 (repetição espaçada) para memorização — alinha com necessidade de revisão periódica
- Timestamp clicável: "o professor falou sobre mitose no minuto 12:34 dessa aula"

---

## Diferenciais específicos para pré-vestibular

1. **Corpus de provas anteriores** — upload de PDFs das últimas 10 edições do ENEM + vestibulares específicos (FUVEST, UNICAMP, etc.). O assistente responde sobre questões reais com o material do cursinho como referência.

2. **Modo estudo + Quiz SM-2** — o aluno de vestibular precisa memorizar fórmulas, datas, conceitos. Flashcards gerados automaticamente + repetição espaçada é o produto mais adequado ao perfil.

3. **Multi-base por área do conhecimento** — Linguagens, Matemática, Ciências da Natureza, Ciências Humanas. Aluno ativa a área que vai estudar.

4. **Personalização por vestibular** — Tusab indexa o edital e provas do FUVEST. O assistente sabe o que *aquele* vestibular cobra, não o ENEM genérico.

---

## MVP para pré-vestibular

**Diferença do Tusab School:**
- Modo estudo e Quiz SM-2 são MVP (não v2) — são o principal argumento de venda
- Multi-base por área do conhecimento desde o início
- Coordenador pode aprovar por disciplina, não só por projeto inteiro
- Perfil do aluno: modo "especialista" mas com suporte didático quando necessário

**O que entra no MVP:**
- Tudo do Tusab School MVP +
- Modo estudo com flashcards no painel do aluno
- Multi-base por área ativa no chat

**O que fica para v2:**
- Quiz SM-2 (repetição espaçada)
- Simulado gerado a partir do corpus indexado
- Relatório de gaps por disciplina para o coordenador
- Personalização por vestibular específico (FUVEST, UNICAMP)

---

## Modelo de negócio

| Tier | Preço estimado | O que inclui |
|------|---------------|--------------|
| **Piloto** | Gratuito / 1 semestre | 1 área, até 50 alunos |
| **Básico** | R$ 5.400/ano | Até 4 áreas, 300 alunos, suporte email |
| **Completo** | R$ 12.000/ano | Todas as áreas, alunos ilimitados, analytics, suporte prioritário |
| **Franquia** | Negociação | Cursinho com múltiplas unidades |

**Argumento de renovação:** taxa de aprovação dos alunos que usaram o assistente vs. os que não usaram. É o relatório que o cursinho precisa para vender o serviço para novos alunos.

---

## Riscos específicos do segmento

| Risco | Mitigação |
|-------|-----------|
| Aluno usa ChatGPT e percebe qualidade superior de resposta genérica | Focar no diferencial: "resposta baseada no material do seu cursinho" + timestamp clicável |
| Coordenador não aprova bases a tempo (véspera de prova) | SLA de aprovação + aprovação parcial por tópico |
| Cursinhos grandes já têm equipe de tecnologia | Focar em cursinhos médios (200–1.000 alunos) sem TI própria |

---

## Premissas a validar

1. Aluno de vestibular usa o assistente com frequência suficiente para impactar resultado
2. Cursinho vê o assistente como diferencial de marketing para captação de novos alunos
3. Coordenador tem tempo para aprovar bases no início de cada semestre

---

*Próximo passo: mapear 2–3 cursinhos médios para piloto no 2º semestre 2026.*
