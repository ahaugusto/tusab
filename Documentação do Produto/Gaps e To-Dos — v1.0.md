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
| C1 | ~~**Recovery de índice corrompido**~~ — **✅ IMPLEMENTADO** (Junho 2026): `get_agent_status()` detecta JSON inválido, deleta o arquivo, invalida cache e retorna `indices_corrompidos[]`; frontend exibe toast com nome do canal e botão Reindexar | — | — |
| C2 | ~~**Watchdog do backend no Electron**~~ — **✅ IMPLEMENTADO** (Junho 2026): poll de 5s pós-inicialização via `pingBackend()`; IPC `backend-dead`/`backend-alive`; preload expõe `onBackendDead`, `onBackendAlive`, `restartBackend`; banner vermelho no topo com botão "Reiniciar backend" | — | — |
| C3 | **Export/Import da base completa** — exportar `cerebro/` como `.zip` e reimportar em outra máquina. Desbloqueia troca de máquina e backup manual | [DEF] | P1 |
| C4 | **Backup automático incremental** — cópia agendada da base no Drive (já autenticado) sem intervenção do usuário | [DEF] | P2 |

**Discussão C3:** o documento de próximos passos descartou "Exportar base" como redundante ao Drive sync. Rever: o Drive sync é opt-in e exige OAuth em produção (ainda não publicado). Para um PKM local, export de ZIP é a única garantia de portabilidade que funciona hoje. Vale revisar a decisão.

---

## PILAR 2 — Ativação & Primeira Experiência

> O onboarding guia até indexar, mas não fecha o loop de "primeira resposta útil".

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| A1 | ~~**Perguntas sugeridas pós-indexação**~~ — **✅ IMPLEMENTADO** (Junho 2026): `_gerar_perguntas_sugeridas()` gera 3 perguntas dos títulos indexados, armazenadas em `state.perguntas_sugeridas` e expostas em `/agent/status`; ChatDrawer exibe chips clicáveis no empty state após indexação | — | — |
| A2 | ~~**Evento "primeira_resposta_util"**~~ — **✅ IMPLEMENTADO** (Junho 2026): `Analytics.primeiraRespostaUtil()` disparado no stream handler de App.jsx quando `fontes.length > 0` (resposta com fontes reais) | — | — |
| A3 | ~~**Medir tempo até primeiro valor**~~ — **✅ IMPLEMENTADO** (Junho 2026): `registrar_primeiro_uso()` em `config.py` grava timestamp de primeiro uso; `/agent/status` retorna `dias_desde_install`; `primeiraRespostaUtil` recebe `minutos_desde_install` calculado a partir do timestamp | — | — |
| A4 | ~~**Empty state do chat com canal não indexado**~~ — **✅ JÁ ESTAVA IMPLEMENTADO** — ChatDrawer cobre 3 cenários: sem índice algum, base existe mas canal não selecionado, tudo pronto | — | — |

---

## PILAR 3 — Telemetria & Funil

> 7 de 11 eventos nunca disparam. Funil de ativação completamente cego.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| T1 | ~~**Auditar os 7 eventos mortos**~~ — **✅ JÁ ESTAVA CORRETO** — auditoria de Junho 2026 confirmou: todos os 11 eventos Analytics estão ativos no código. O doc estava desatualizado | — | — |
| T2 | ~~**Evento de retenção Day 7 / Day 30**~~ — **✅ IMPLEMENTADO** (Junho 2026): `registrar_primeiro_uso()` grava `primeiro_uso` e marca `retencao_diaX_registrado` em `config.json` (idempotente); `/agent/status` retorna `retencao_dia`; App.jsx dispara `Analytics.retencaoDia()` ao detectar nova marca | — | — |
| T3 | **Funil de ativação no PostHog** — configurar no dashboard: install → primeira extração → indexação → primeira pergunta → primeira resposta com fonte. Sem isso os dados existem mas não são legíveis | [DEF] | P1 |
| T4 | **Evento de abandono de canal** — registrar quando o usuário configura um canal mas nunca inicia extração (indica fricção no fluxo) | [IMPL] | P2 |

---

## PILAR 4 — Modelo de Negócio & Freemium Wall

> Decisão tomada em Junho 2026: free generoso. O loop completo funciona no free.
> A parede separa casual de power user sem frustrar quem está descobrindo.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| M1 | ~~**Definir a parede do free**~~ — **✅ DECIDIDO** (Junho 2026) | — | — |
| M2 | **Sistema de licença (Lemon Squeezy)** — tela de ativação no Electron, validação HTTP, hardware fingerprint | [IMPL] | P1 |
| M3 | **Proteção do código Python** — backend em `.py` puro, compilar com Nuitka ou PyArmor antes de lançar versão paga | [IMPL] | P1 |
| M4 | ~~**Feature flags Free vs. Pro no código**~~ — **✅ IMPLEMENTADO** (Junho 2026): limite de 2 canais no indexar(), ProSnackbar informativo em fila/multi-canal/exports, endpoints /export/base, /export/historico, /export/resumo-canal (.docx), /export/tabela-videos (.xlsx), /export/relatorio-pdf (.pdf) | — | — |

**FREE inclui:** extração de até 2 canais, chat ilimitado, Ollama + providers externos,
upload de docs/imagens/áudio, Drive sync, busca BM25 básica, relatório resumido.

**PRO adiciona:** canais ilimitados, fila de extração, busca multi-canal, query expansion,
configuração avançada do agente, export da base (ZIP), export do histórico de chat (MD),
resumo de canal em Word (.docx), tabela de vídeos em Excel (.xlsx), relatório em PDF,
relatório detalhado, suporte por email, acesso antecipado.

**Princípio:** o free entrega valor real e gera boca-a-boca. A parede existe onde
o usuário já é dependente do produto — não na descoberta.

Ver spec completa: `Documentação do Produto/Modelo de negócio.txt`

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
| S1 | ~~**Chaves de API no keychain**~~ — **✅ IMPLEMENTADO** (Junho 2026): `safeStorage` do Electron (Windows DPAPI / macOS Keychain) via IPC `get/set/delete-api-key`; `keystore.json` guarda blobs criptografados; `agent_config.json` grava sentinel `__encrypted__`; boot reinforma o backend com a chave real; chat.py rejeita sentinel como chave inválida | — | — |
| S2 | ~~**`requirements.txt` com versões pinned**~~ — **✅ JÁ ESTAVA FEITO** — `requirements-lock.txt` com todas as deps pinned em versão exata (`==`) já existia na raiz | — | — |
| S3 | ~~**Pydantic sem `max_length`**~~ — **✅ IMPLEMENTADO** (Junho 2026): `Field(max_length=...)` aplicado em todos os modelos de request de `router_repositorio.py`, `router_extraction.py` e `router_exports.py` | — | — |
| S4 | **Publicar OAuth no Google Cloud** — de Testing para Production. Pré-requisito: política de privacidade publicada (já existe como `.md`, precisa de URL pública) | [DEF] | P2 |

---

## PILAR 7 — Acessibilidade & i18n

> UI construída em português. Traduções existem mas não foram testadas.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| I1 | ~~**QA completo do fluxo em inglês**~~ — **✅ IMPLEMENTADO** (Junho 2026): auditoria estática confirmou 216 chaves 100% consistentes entre PT/EN/ES; zero chaves faltando; interpolações `{{count}}`, `{{canal}}`, `{{total}}` corretas nos três idiomas | — | — |
| I2 | ~~**QA completo do fluxo em espanhol**~~ — **✅ IMPLEMENTADO** (Junho 2026): mesmo resultado que I1 — sem divergências; `footer.version` atualizado de v0.4.3 para v1.0.0 nos três JSONs | — | — |
| I3 | ~~**Auditoria de navegação por teclado**~~ — **✅ IMPLEMENTADO** (Junho 2026): ConsentModal recebe `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler e autofocus; ChatDrawer recebe `role="dialog"`, `aria-modal` e Escape hierárquico (fecha modal interno primeiro, depois o drawer); PostExtractionModal corrige link desabilitado com `tabIndex={-1}`; tab buttons ganham `role="tab"`, `aria-selected`, `id` e `aria-controls` apontando para painéis corretos; SidebarContent migra `t('footer.version')` para `__APP_VERSION__` dinâmico | — | — |
| I4 | ~~**Versão do produto no footer/about**~~ — **✅ JÁ ESTAVA IMPLEMENTADO** — App.jsx usa `__APP_VERSION__` dinâmico; SidebarContent corrigido nesta sessão para usar a mesma variável | — | — |

---

## PILAR 8 — Export & Portabilidade de Dados

> Ausência de export é bloqueador para contratos B2B enterprise.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| E1 | ~~**Export do histórico de chat**~~ — **✅ IMPLEMENTADO** (Junho 2026): `POST /export/historico` + botão na UI | — | — |
| E2 | ~~**Export da base de conhecimento**~~ — **✅ IMPLEMENTADO** (Junho 2026): `POST /export/base` + botão na UI | — | — |
| E3 | **Política de portabilidade de dados documentada** — para contratos B2B: "seus dados ficam em X, você pode exportar fazendo Y, deletar fazendo Z" | [DEF] | P2 |
| E4 | **Hard Reset completo** — limpar todos os dados do usuário (repositórios, relatórios, histórico, chaves de API, sessão Drive) | [IMPL] | P1 |

---

## PILAR 9 — Experiência do Chat

> Chat funcional mas sem formatação rica nas respostas.

| # | To-Do | Tipo | Prioridade |
|---|---|---|---|
| X1 | ~~**Renderização Markdown nas respostas**~~ — **✅ IMPLEMENTADO** (Junho 2026): `react-markdown` + `remark-gfm`; suporte a negrito, itálico, tachado, links, listas, títulos, código inline/bloco, blockquote, `<hr>`; mensagens do usuário mantidas como texto plano; cursor de streaming preservado | — | — |
| X2 | ~~**Chat expandido (overlay sobre abas)**~~ — **✅ IMPLEMENTADO** (Junho 2026): botão Maximize2/Minimize2 no header do chat; modo expandido usa `absolute inset-0 z-30` sobre o tabbed shell; abas ficam montadas atrás; Escape fecha o overlay | — | — |
| X3 | ~~**Perguntas sugeridas pós-indexação**~~ — **✅ IMPLEMENTADO** (ver A1) | — | — |

---

## RESUMO EXECUTIVO — Ordem de Ataque

### P0 — Antes de qualquer distribuição
- ~~C1 · Recovery de índice corrompido~~ ✅
- ~~C2 · Watchdog do backend no Electron~~ ✅
- ~~A4 · Empty state do chat (canal não indexado)~~ ✅ já estava
- ~~T1 · Auditar e corrigir eventos mortos~~ ✅ já estava
- ~~S2 · `requirements.txt` com versões pinned~~ ✅ já estava
- ~~I4 · Versão do produto lida do `package.json`~~ ✅

**Todos os P0 estão fechados. O produto está defensável para distribuição.**

### P1 — Próximo sprint (implementáveis agora)
- ~~A1 · Perguntas sugeridas pós-indexação~~ ✅
- ~~A2/A3 · Eventos de ativação e tempo até primeiro valor~~ ✅
- ~~T2 · Retenção Day 7 / Day 30~~ ✅
- ~~S3 · Pydantic com `max_length`~~ ✅
- ~~S1 · Chaves de API no keychain~~ ✅
- ~~I1/I2 · QA de fluxo em inglês e espanhol~~ ✅
- ~~I3 · Auditoria de navegação por teclado~~ ✅
- ~~X1 · Markdown nas respostas do chat~~ ✅
- ~~X2 · Chat expandido (overlay)~~ ✅
- E4 · Hard Reset completo
- M3 · Proteção do código Python (Nuitka/PyArmor)

### P1 — Próximo sprint (requerem decisão primeiro)
- M1 · **Definir parede do free** ← discussão prioritária
- M2 · Sistema de licença (depende de M1)
- M4 · Spec do tier Pro (depende de M1)
- ~~E1/E2 · Export de histórico e base~~ ✅

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
