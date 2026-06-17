# Gaps e To-Dos — Tusab v1.0
© 2026 CriAugu — Atualizado: Junho 2026

Documento vivo. Cada item tem status, pilar e classificação:
- **[IMPL]** — implementável agora, decisão técnica clara
- **[DEF]** — requer decisão de produto/negócio antes de implementar
- **[DISC]** — tema aberto, precisa de alinhamento

---

## PILAR 1 — Confiabilidade & Recuperação

> SRE score atual: 4,5/10. O maior risco de NPS negativo.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| C1 | **Recovery de índice corrompido** — detectar `.pkl` inválido no load do BM25, deletar e reconstruir automaticamente com toast de aviso ao usuário | [IMPL] | P0 |
| C2 | **Watchdog do backend no Electron** — se o processo Python não responder em 10s, exibir mensagem de erro com botão "Reiniciar backend" em vez de loading infinito | [IMPL] | P0 |
| C3 | **Export/Import da base completa** — exportar `cerebro/` como `.zip` e reimportar em outra máquina. Desbloqueia troca de máquina e backup manual | [DEF] | P1 |
| C4 | **Backup automático incremental** — cópia agendada da base no Drive (já autenticado) sem intervenção do usuário | [DEF] | P2 |

**Discussão C3:** o documento de próximos passos descartou "Exportar base" como redundante ao Drive sync. Rever: o Drive sync é opt-in e exige OAuth em produção (ainda não publicado). Para um PKM local, export de ZIP é a única garantia de portabilidade que funciona hoje. Vale revisar a decisão.

---

## PILAR 2 — Ativação & Primeira Experiência

> O onboarding guia até indexar, mas não fecha o loop de "primeira resposta útil".

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| A1 | **Perguntas sugeridas pós-indexação** — ao terminar de indexar um canal, gerar 3 perguntas automáticas com base nos títulos dos vídeos indexados e exibi-las no chat como chips clicáveis | [IMPL] | P1 |
| A2 | **Evento "primeira_resposta_util"** — registrar no PostHog quando o usuário recebe uma resposta com fontes (não erro, não "não encontrei"). Esse é o KPI de ativação real | [IMPL] | P1 |
| A3 | **Medir tempo até primeiro valor** — evento `chat_resposta_com_fontes` com campo `minutos_desde_install` calculado a partir do timestamp de primeiro uso gravado em `config.json` | [IMPL] | P1 |
| A4 | **Empty state do chat com canal não indexado** — quando o usuário abre o chat com canal configurado mas não indexado, mostrar diretamente o botão de indexar (já implementado para base vazia) | [IMPL] | P0 |

---

## PILAR 3 — Telemetria & Funil

> 7 de 11 eventos nunca disparam. Funil de ativação completamente cego.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| T1 | **Auditar os 7 eventos mortos** — mapear quais são, por que não disparam (condição nunca atingida vs. código nunca chamado) e corrigir os que são bugs | [IMPL] | P0 |
| T2 | **Evento de retenção Day 7 / Day 30** — gravar `primeiro_uso` em `config.json` e disparar evento `retencao_dia_N` quando o usuário abre o app N dias depois | [IMPL] | P1 |
| T3 | **Funil de ativação no PostHog** — configurar no dashboard: install → primeira extração → indexação → primeira pergunta → primeira resposta com fonte. Sem isso os dados existem mas não são legíveis | [DEF] | P1 |
| T4 | **Evento de abandono de canal** — registrar quando o usuário configura um canal mas nunca inicia extração (indica fricção no fluxo) | [IMPL] | P2 |

---

## PILAR 4 — Modelo de Negócio & Freemium Wall

> O free não tem parede que motive upgrade. O Pro não pode ser vendido sem sistema de licença.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| M1 | **Definir a parede do free** — qual ação o usuário free vai querer fazer e não conseguir? Candidatos: (a) máximo de 2 canais indexados simultâneos, (b) sem exportação de histórico de chat, (c) sem busca multi-canal no Pro | [DEF] | P1 |
| M2 | **Sistema de licença (Lemon Squeezy)** — tela de ativação no Electron, validação HTTP, hardware fingerprint. Pré-requisito: decisão sobre parede do free (M1) | [DEF] | P1 |
| M3 | **Proteção do código Python** — backend distribuído como `.py` puro hoje, qualquer usuário lê e copia. Compilar com Nuitka ou PyArmor antes de lançar versão paga | [IMPL] | P1 |
| M4 | **Spec do tier Pro** — detalhar exatamente quais features são Pro vs. Free em nível de código (flags, verificação de licença por endpoint) | [DEF] | P1 |

**Discussão M1:** a decisão mais importante do modelo. Sem ela, M2, M3 e M4 não têm direção. Sugestão de pauta: definir em qual sprint atacamos isso.

---

## PILAR 5 — Distribuição & Aquisição

> O produto não tem canal de aquisição além do contato direto. Sem isso, não há crescimento.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| D1 | **Landing page mínima** — proposta de valor, demo em GIF/vídeo (30s), botão de download. Sem isso não há pipeline | [DEF] | P2 |
| D2 | **Definir os 2 canais de aquisição do primeiro ano** — candidatos: (a) Product Hunt no lançamento, (b) comunidades PKM (Reddit r/PKM, Obsidian Forum, Second Brain), (c) criadores com canal próprio como casos de uso públicos | [DISC] | P2 |
| D3 | **Estratégia de SEO para "Tusab"** — nome novo, zero volume de busca. Definir se SEO é canal ou se a aposta é comunidade/boca-a-boca no primeiro ano | [DISC] | P2 |
| D4 | **Case público da AUVP** — documentar e publicar como estudo de caso (com autorização). É o único social proof existente hoje | [DEF] | P2 |

---

## PILAR 6 — Segurança & Proteção

> 12 fixes aplicados. Dois itens críticos ainda abertos.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| S1 | **Chaves de API no keychain** — hoje salvas em `agent_config.json` em plaintext. Migrar para `keytar` (integração nativa com Windows Credential Store / macOS Keychain) | [IMPL] | P1 |
| S2 | **`requirements.txt` com versões pinned** — dependências sem versão expõem o build a breaking changes silenciosos. Gerar `pip freeze > requirements-lock.txt` e usar no build | [IMPL] | P0 |
| S3 | **Pydantic sem `max_length`** — campos de texto nos modelos de request sem validação de tamanho máximo (mapeado na Avaliação Estratégica, ainda aberto) | [IMPL] | P1 |
| S4 | **Publicar OAuth no Google Cloud** — de Testing para Production. Pré-requisito: política de privacidade publicada (já existe como `.md`, precisa de URL pública) | [DEF] | P2 |

---

## PILAR 7 — Acessibilidade & i18n

> UI construída em português. Traduções existem mas não foram testadas.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| I1 | **QA completo do fluxo em inglês** — percorrer todas as telas em `en` e verificar strings quebradas, overflow de texto, contexto perdido na tradução | [IMPL] | P1 |
| I2 | **QA completo do fluxo em espanhol** — mesmo que I1 para `es` | [IMPL] | P1 |
| I3 | **Auditoria de navegação por teclado** — ChatDrawer, modais, accordions do repositório. Garantir Tab order lógico e Escape fecha modais | [IMPL] | P1 |
| I4 | **Versão do produto no footer/about** — hoje pode estar desatualizada. Ler de `package.json` dinamicamente em vez de hardcoded | [IMPL] | P0 |

---

## PILAR 8 — Export & Portabilidade de Dados

> Ausência de export é bloqueador para contratos B2B enterprise.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| E1 | **Export do histórico de chat** — salvar conversa como `.txt` ou `.md` com fontes. Candidato para tier Pro | [DEF] | P1 |
| E2 | **Export da base de conhecimento** — ZIP de `cerebro/` com estrutura preservada, reimportável em outra instalação | [DEF] | P1 |
| E3 | **Política de portabilidade de dados documentada** — para contratos B2B: "seus dados ficam em X, você pode exportar fazendo Y, deletar fazendo Z" | [DEF] | P2 |

---

## RESUMO EXECUTIVO — Ordem de Ataque

### P0 — Antes de qualquer distribuição
- C1 · Recovery de índice corrompido
- C2 · Watchdog do backend no Electron
- A4 · Empty state do chat (canal não indexado)
- T1 · Auditar e corrigir eventos mortos
- S2 · `requirements.txt` com versões pinned
- I4 · Versão do produto lida do `package.json`

### P1 — Próximo sprint (implementáveis agora)
- A1 · Perguntas sugeridas pós-indexação
- A2/A3 · Eventos de ativação e tempo até primeiro valor
- T2 · Retenção Day 7 / Day 30
- S1 · Chaves de API no keychain
- S3 · Pydantic com `max_length`
- M3 · Proteção do código Python (Nuitka/PyArmor)
- I1/I2 · QA de fluxo em inglês e espanhol
- I3 · Auditoria de navegação por teclado

### P1 — Próximo sprint (requerem decisão primeiro)
- M1 · **Definir parede do free** ← discussão prioritária
- M2 · Sistema de licença (depende de M1)
- M4 · Spec do tier Pro (depende de M1)
- E1/E2 · Export de histórico e base

### P2 — Go-to-market
- C4 · Backup automático no Drive
- T3 · Funil de ativação no PostHog
- D1 · Landing page mínima
- D2 · Definir canais de aquisição
- D3 · Estratégia de SEO
- D4 · Case público da AUVP
- S4 · OAuth em produção
- E3 · Política de portabilidade

---

*Itens [IMPL] podem ser atacados diretamente. Itens [DEF] e [DISC] precisam de alinhamento antes de codar.*
