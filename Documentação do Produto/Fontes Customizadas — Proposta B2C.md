# Fontes Customizadas — Proposta B2C

**Status:** proposta, não implementada. Documentado em 30/jul/2026 a partir de uma ideia levantada por Augusto durante o trabalho de implementação das fontes públicas curadas.

## Job to be done

O Pesquisador (perfil que já usa a busca por área de conhecimento) quer indexar uma fonte de dados que **não está** no catálogo curado do Tusab (24 fontes em 9 áreas, ver `tusab_engine/motor/fontes/`). Pode ser:
- Uma API pública nova que ainda não foi avaliada/implementada pelo time do Tusab
- Uma base pessoal exposta via API (Notion, Airtable, um endpoint próprio)
- A API de um sistema da própria organização do usuário

Hoje isso é impossível sem uma nova release do Tusab — cada fonte exige um módulo Python escrito à mão (`FONTE_META` + `buscar()`, ver `agents/backend.md` ou qualquer arquivo em `tusab_engine/motor/fontes/`).

## Por que é B2C, não Enterprise

O precedente direto já existe e já é B2C: o **provedor de LLM customizado** (endpoint OpenAI-compatible tipo 9router) foi construído explicitamente como opção pro usuário final, não pra instalação institucional — "usá-lo como se fosse o Ollama". A mesma lógica de autoatendimento se aplica aqui, só que pra fontes de busca em vez de modelo de linguagem.

**Diferencial competitivo real:** nenhum concorrente direto (NotebookLM, AnythingLLM) permite ao usuário apontar pra qualquer API e ela virar uma fonte pesquisável dentro do produto. Isso transforma o Tusab de "catálogo curado de 24 fontes" em "fontes ilimitadas, limitadas só pela criatividade do usuário" — e encaixa no perfil que já é o mais técnico/exigente dos 4 (Pesquisador).

## A diferença técnica que separa isso do caso do LLM

LLM providers já falam um protocolo **padronizado** (chat completions, OpenAI-compatible) — por isso o endpoint customizado de LLM foi quase plug-and-play. APIs de busca/dados **não têm protocolo universal**: cada uma tem seu próprio formato de resposta JSON — nome de campo do título, do texto, da URL, e o caminho até a lista de resultados varia de fonte pra fonte (confirmado nos 24 módulos já escritos: `item.get('notes')` no BCB, `item.get('abstractText')` no Europe PMC, `item.get('indications_and_usage')[0]` no openFDA — todos diferentes).

Isso significa que "fonte customizada" precisa de um passo que "LLM customizado" não precisava: **mapear os campos**.

## Dois caminhos de design pro mapeamento de campos

### A. Manual (formulário técnico)
Usuário preenche: URL base, nome do parâmetro de busca, e o caminho JSON até cada campo (lista de resultados, título, texto, URL). Mais robusto e previsível, mas exige que o usuário entenda estrutura JSON aninhada — foge do padrão "sem fricção técnica" que o Tusab busca pra maioria dos perfis. Talvez aceitável justamente porque é uma feature de perfil avançado (Pesquisador), não pra todo mundo.

### B. Assistido por IA (recomendado, a validar)
Usuário cola a URL e um termo de teste; o Tusab faz uma chamada real contra a API, pega a resposta bruta, e usa o LLM já configurado do usuário (Ollama/Groq/etc.) pra **inferir automaticamente** o mapeamento de campos — perguntando confirmação antes de salvar ("Encontrei estes campos: título = `data.name`, texto = `data.summary`. Confere?"). Muito mais alinhado à UX não-técnica do produto. Levanta uma dependência de ordem (precisa de LLM configurado pra configurar uma fonte customizada) que provavelmente é aceitável, já que configurar LLM já é passo zero do onboarding.

## Riscos a resolver antes de implementar (não novos — mesmo princípio já usado no LLM customizado)

- **SSRF:** URL arbitrária controlada pelo usuário, chamada pelo backend do Tusab. Mesma mitigação já avaliada por `/seguranca` pro caso do LLM customizado (validar formato, considerar bloquear IPs de metadata de nuvem tipo `169.254.169.254`) — reaplicar aqui, não redesenhar do zero.
- **Taxonomia:** onde essa fonte customizada vive na estrutura de área de conhecimento? As 9 áreas atuais são curadas e fixas — provavelmente precisa de uma área nova tipo "Minhas fontes" ou "Customizadas", separada do catálogo oficial, pra não misturar fonte vetada pelo time com fonte que o próprio usuário configurou (nível de confiança diferente).
- **Falha de mapeamento:** o que acontece quando a IA erra a inferência de campo, ou a API muda de formato depois? Precisa de um caminho claro de "editar mapeamento" sem perder a fonte já configurada.

## Não implementar agora

Fica registrado como proposta estruturada — decisão de quando entrar no roadmap é do Augusto. Ver também `Documentação do Produto/Brainstorming Durante o Desenvolvimento.md` pra o contexto de onde essa ideia surgiu na mesma sessão.
