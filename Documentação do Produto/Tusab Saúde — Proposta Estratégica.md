# Tusab Saúde — Proposta Estratégica
**Segmento:** Hospitais, clínicas, operadoras de saúde
**Status:** Rascunho estratégico — campo das ideias
**Data:** Junho 2026
**Referência técnica:** Ver [B2B — Estratégia de Monetização e Segmentos.md](B2B — Estratégia de Monetização e Segmentos.md)

---

## Por que saúde é o segmento de maior potencial — e maior complexidade

**O mercado:** hospitais brasileiros gastam bilhões em treinamento de equipes, gestão de protocolos clínicos e educação continuada. O corpus é imenso: protocolos da ANVISA, diretrizes do CFM, bulas, literaturas científicas, treinamentos internos.

**O problema que o Tusab resolve:**
- Médico residente precisa consultar protocolo do hospital às 3h da manhã — hoje abre PDF
- Enfermeiro precisa de posologia de medicamento que não usa há meses — hoje liga para farmácia
- Hospital atualiza protocolo de sepse — como garantir que todos os 300 profissionais atualizaram o conhecimento?

**Por que entra depois de escola/cursinho:**
- Ticket médio muito maior (justifica a complexidade)
- Exige compliance regulatório extra (CFM, ANVISA, LGPD saúde — dados sensíveis de paciente são categoria especial)
- Ciclo de venda mais longo (TI hospitalar é mais burocrática)
- Produto precisa estar maduro — erro em contexto clínico tem consequência diferente de erro em prova de vestibular

**A regra de entrada:** só entrar em saúde com pelo menos 2 segmentos educacionais em produção. O produto precisa ser robusto antes de ir para contexto crítico.

---

## Personas e Jobs to be Done

### Gestor de Educação Continuada
**Job:** "Preciso garantir que todos os profissionais do hospital conhecem os protocolos atualizados — e tenho evidência disso."

- Indexa protocolos clínicos do hospital (PDFs internos)
- Indexa diretrizes de sociedades médicas (SBEM, SBC, SBP)
- Submete para aprovação do corpo clínico antes de disponibilizar
- Vê relatório de quais protocolos são mais consultados → sinaliza gaps de treinamento

### Médico / Enfermeiro / Farmacêutico
**Job:** "Quero consultar o protocolo do hospital em 30 segundos, no tablet, na beira do leito."

- Chat com protocolos indexados do hospital
- Resposta cita o protocolo de origem com número de versão e data
- Modo especialista: respostas técnicas, sem simplificação
- Nunca inventa — se não está no corpus, responde "não encontrado nos protocolos indexados"

### Paciente / Familiar (use case futuro, v3)
**Job:** "Quero entender meu diagnóstico e o que esperar do tratamento."

- Chat com material psicoeducativo aprovado pelo hospital
- Linguagem adaptada (não técnica)
- **Nunca substitui consulta médica** — disclaimers obrigatórios em todas as respostas

---

## Diferenciais específicos para saúde

1. **"Não encontrado nos protocolos"** — o assistente nunca alucina em contexto clínico. Quando o BM25 não retorna contexto relevante, a resposta é explicitamente "não encontrado nos protocolos indexados deste hospital" — não uma resposta inventada. O `sem_contexto: True` já existe no produto atual e pode ser mapeado para esse comportamento.

2. **Versionamento de protocolos** — quando o hospital atualiza um protocolo, a base é reindexada e a data de vigência é explicitada em toda resposta. Profissional sabe que está consultando a versão atual.

3. **Auditoria de queries** — logs de quem consultou o quê e quando. Em contexto hospitalar, isso pode ser requisito de compliance (evidência de que o profissional verificou o protocolo antes de um procedimento).

4. **Isolamento absoluto** — dados clínicos internos nunca saem do hospital. Local-first é aqui o requisito mais forte de todos os segmentos.

---

## Compliance e regulatório — o que diferencia saúde

| Requisito | Implicação para o produto |
|-----------|--------------------------|
| LGPD — dados sensíveis de saúde | Logs de acesso com identificação de usuário obrigatórios |
| CFM — responsabilidade médica | Disclaimers em toda resposta: "informação de protocolo, não substitui julgamento clínico" |
| ANVISA — bulas e posologias | Corpus deve ser da ANVISA oficial — não fontes externas não validadas |
| ISO 27001 / HIMSS | Para hospitais de grande porte — certificação de segurança pode ser pré-requisito de venda |
| PACS / prontuário eletrônico | Integração com sistemas HIS/EMR é v3 — não é MVP |

**Regra de ouro para saúde:** o produto nunca toma decisão clínica. Sempre apresenta a informação do protocolo e atribui a responsabilidade ao profissional.

---

## MVP para saúde

**O que é diferente do MVP educacional:**
- Log de auditoria de queries (quem, quando, o quê) — requisito de compliance, não feature
- Disclaimers obrigatórios em toda resposta clínica
- Versionamento de corpus (data de vigência de cada protocolo)
- Processo de aprovação mais rigoroso: aprovação pelo corpo clínico + validação por especialidade

**O que entra no MVP:**
- Tudo do Tusab School MVP +
- Log de auditoria de queries (user_id + timestamp + query + resposta)
- Disclaimer automático em toda resposta
- Campo de data de vigência no manifest de cada documento

**O que fica para v2:**
- Relatório de gaps de treinamento (protocolos menos consultados = gaps de conhecimento)
- Integração com sistema de credenciamento (profissional acessa só protocolos da sua especialidade)
- App mobile para tablet (uso na beira do leito)

**O que é v3:**
- Integração com prontuário eletrônico
- Chat com paciente / familiar (psicoeducação)
- Certificação ISO 27001

---

## Modelo de negócio

| Tier | Preço estimado | O que inclui |
|------|---------------|--------------|
| **Piloto** | Gratuito / 3 meses | 1 especialidade, até 30 profissionais |
| **Clínica** | R$ 12.000/ano | Até 3 especialidades, 100 profissionais, log de auditoria |
| **Hospital Médio** | R$ 36.000/ano | Especialidades ilimitadas, 500 profissionais, analytics, suporte prioritário |
| **Hospital Grande / Rede** | Negociação | Multi-unidade, integração HIS, SLA, certificação |

**Ticket médio 4–10x maior que educação** — justifica o custo de compliance.

---

## Riscos específicos do segmento

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Hospital exige certificação de segurança (ISO 27001) | Alta para grandes redes | Focar em clínicas e hospitais médios no início |
| Profissional usa informação desatualizada por erro de indexação | Alto impacto | Versionamento obrigatório + data de vigência em toda resposta |
| Responsabilidade legal por resposta incorreta | Alto impacto | Disclaimers + logs de auditoria + contrato de uso bem definido |
| TI hospitalar bloqueia instalação de software de terceiros | Média | Exigir homologação pelo CISO — processo mais longo |
| Ciclo de venda de 6–12 meses | Alta | Não é primeiro segmento — entra quando produto já tem casos de escola/cursinho |

---

## Premissas críticas antes de entrar em saúde

1. **Produto maduro em educação** — pelo menos 2 segmentos educacionais em produção com casos documentados
2. **Advogado especializado em saúde digital** — revisar contrato, disclaimers e política de responsabilidade antes da primeira venda
3. **DPO definido** — dados de saúde são categoria especial na LGPD, exigem tratamento diferenciado
4. **Teste de "não alucina"** — validação rigorosa de que o assistente não inventa protocolos em corpus pequeno ou query sem resposta clara

---

*Entrada recomendada: 2027, após consolidação em educação.*
