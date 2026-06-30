# Tusab Concurso — Proposta Estratégica
**Segmento:** Cursinhos para concursos públicos
**Status:** Rascunho estratégico — campo das ideias
**Data:** Junho 2026
**Referência técnica:** Ver [B2B — Estratégia de Monetização e Segmentos.md](B2B — Estratégia de Monetização e Segmentos.md)

---

## Por que concurso público é o segundo segmento B2B

**O mercado:** o Brasil tem ~8 milhões de pessoas prestando concursos por ano. Cursinhos especializados (Gran Cursos, Estratégia, Direção) movimentam bilhões. O aluno de concurso tem perfil distinto: adulto, autodidata, disposto a pagar por material de qualidade, estuda por meses ou anos.

**O problema que o Tusab resolve:**
- Cursinhos produzem centenas de videoaulas e PDFs — o aluno se perde no volume
- Dúvidas surgem fora do horário das aulas e dos fóruns
- ChatGPT responde sobre concurso, mas não sobre *o material específico daquele cursinho*
- O aluno quer saber "o que o professor João falou sobre licitação no módulo 3" — não a resposta genérica da internet

**Por que é o segundo segmento (após escola):**
- Ticket médio maior: aluno de concurso paga mais
- Base de alunos maior: cursinhos de concurso têm 10x mais alunos que escolas médias
- Corpus mais rico: anos de videoaulas, PDFs, provas comentadas — BM25 brilha aqui
- Decisor mais rápido: dono do cursinho decide sozinho, sem processo de compra institucional

---

## Personas e Jobs to be Done

### Criador de Conteúdo (Professor/Especialista)
**Job:** "Quero que meu conteúdo esteja disponível para o aluno a qualquer hora, sem eu precisar responder as mesmas dúvidas repetidas."

- Indexa canal do YouTube do cursinho
- Faz upload de PDFs de aulas, esquemas, resumos, legislação comentada
- Submete para revisão editorial antes de disponibilizar
- Usa relatório de queries para saber quais tópicos geram mais dúvidas → pauta de novos conteúdos

### Editor / Coordenador de Conteúdo
**Job:** "Preciso garantir que o assistente não responde algo errado sobre legislação ou jurisprudência desatualizada."

- Aprova bases antes de publicar (compliance de conteúdo)
- Rejeita bases com material desatualizado (ex: lei revogada)
- Monitora queries que o assistente não respondeu bem

### Aluno de Concurso
**Job:** "Quero tirar dúvidas do material do cursinho às 23h, sem depender de fórum ou professor."

- Acessa chat via browser (desktop ou mobile — v2)
- Faz perguntas sobre o material indexado
- Recebe respostas com citação da aula de origem e timestamp clicável
- Modo especialista por padrão (respostas técnicas, sem didatismo excessivo)

---

## Diferencial vs. concorrentes no contexto de concurso

| | Tusab Concurso | ChatGPT/Gemini | Fórum do cursinho | Assistente genérico do cursinho |
|--|:--:|:--:|:--:|:--:|
| Responde sobre o material específico do cursinho | ✅ | ❌ | ✅ (humano) | Parcial |
| Disponível 24/7 sem demora | ✅ | ✅ | ❌ | ✅ |
| Cita a aula de origem com timestamp | ✅ | ❌ | ❌ | ❌ |
| Conteúdo validado pelo editorial | ✅ | ❌ | Parcial | Parcial |
| Dados dentro do cursinho (sem cloud) | ✅ | ❌ | N/A | ❌ |
| Mapa de dúvidas dos alunos para o professor | ✅ (v2) | ❌ | ❌ | Raramente |

**Posicionamento:**
> "O assistente de IA que conhece *o seu curso* — não a internet."

---

## Diferenciais específicos para concurso

1. **Timestamp clicável** — aluno pergunta sobre o tema, recebe a resposta e o link direto para o minuto exato da videoaula onde o professor explicou. Diferencial único, nenhum concorrente tem.

2. **Multi-base por disciplina** — Direito Administrativo, Contabilidade, Português: cada professor indexa sua disciplina. Aluno pode ativar múltiplas bases simultaneamente no chat (já existe no produto atual).

3. **Modo estudo** — flashcards gerados automaticamente do conteúdo indexado (já existe). Para concurso, é killer feature: aluno revisa com cards criados do próprio material do curso.

4. **Relatório de gaps** (v2) — quais tópicos geram mais dúvidas que o assistente não responde bem → professor sabe exatamente o que gravar na próxima aula.

---

## MVP para cursinho de concurso

**Diferença do Tusab School:**
- Sem fluxo de aprovação obrigatório (editor pode aprovar rapidamente, não é processo pedagógico formal)
- Aluno pode ter acesso mobile (cursinho tem alunos adultos, não menores) — v1.5
- Múltiplas disciplinas/bases desde o MVP (o produto atual já suporta)
- Modo especialista como padrão (não didático como na escola)

**O que entra no MVP:**
- Deploy headless em servidor do cursinho
- 2 papéis: Criador de Conteúdo / Aluno (coordenador pode ser o próprio dono do cursinho no início)
- Autenticação JWT local
- Múltiplas bases por disciplina
- Interface do aluno: chat + histórico + modo estudo (flashcards)

**O que fica para v2:**
- Painel de analytics de queries (relatório de gaps)
- Mobile
- Fluxo de aprovação editorial completo
- Integração com plataforma do cursinho (LMS, área de membros)

---

## Modelo de negócio

| Tier | Preço estimado | O que inclui |
|------|---------------|--------------|
| **Piloto** | Gratuito / 3 meses | 1 disciplina, até 100 alunos |
| **Básico** | R$ 7.200/ano | Até 5 disciplinas, 500 alunos, suporte email |
| **Completo** | R$ 18.000/ano | Disciplinas ilimitadas, alunos ilimitados, analytics, suporte prioritário |
| **White-label** | Negociação | Cursinho quer o produto com a própria marca |

**Por que o ticket é maior que escola:**
- Cursinho tem receita recorrente por aluno (mensalidade)
- O assistente de IA é argumento de venda do cursinho para novos alunos
- ROI claro: professor gasta menos tempo respondendo dúvidas repetidas

---

## Riscos específicos do segmento

| Risco | Mitigação |
|-------|-----------|
| Conteúdo desatualizado (lei revogada, jurisprudência antiga) | Fluxo de aprovação + data de indexação visível + alerta de "base com mais de X meses" |
| Cursinho grande já tem solução interna | Focar em cursinhos médios (100–2.000 alunos) — sem TI própria |
| Plataforma do cursinho (Hotmart, Kiwify) pode lançar feature similar | Timestamp clicável + multi-base + local-first são diferenciais não triviais |

---

## Premissas a validar

1. Professor de concurso tem disposição para indexar o próprio conteúdo
2. Aluno de concurso prefere assistente do cursinho a ChatGPT — precisa de evidência (diferencial de qualidade de resposta sobre o material específico)
3. Dono do cursinho enxerga o assistente como diferencial de aquisição de alunos, não só de suporte

---

*Próximo passo: identificar 1 cursinho para piloto de 3 meses.*
