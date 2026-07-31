# Fontes Customizadas — Proposta B2B

**Status:** proposta, não implementada. Documentado em 30/jul/2026 a partir de uma ideia levantada por Augusto durante o trabalho de implementação das fontes públicas curadas.

## Job to be done

Uma empresa cliente (Camada 3 — "arquivo institucional vivo", ver `Documentação do Produto/Plano B2B — Tusab Enterprise.md`) tem um sistema próprio — um CRM interno, uma base de conhecimento, um ERP, qualquer API institucional — e quer que esse sistema vire uma fonte pesquisável dentro da instância Tusab do time, ao lado das 24 fontes públicas curadas e do conteúdo já indexado (YouTube, PDFs, atas).

Hoje isso é impossível sem uma nova release do Tusab — cada fonte exige um módulo Python escrito à mão (`FONTE_META` + `buscar()`, ver `agents/backend.md` ou qualquer arquivo em `tusab_engine/motor/fontes/`), mantido pelo time do Tusab, não pelo cliente.

## Por que é B2B, não B2C

O caso de uso original que gerou a ideia já era institucional por natureza: "minha empresa tem um sistema e esse tem uma base que quero tornar pública e consultável via API". Isso não é uma fonte pública de conhecimento geral (como arXiv ou PubMed) — é dado **proprietário de uma organização**, que só faz sentido dentro do contexto de uma instância Tusab daquela mesma organização. Encaixa diretamente na Camada 3 do modelo B2B já mapeado (`agents/_historia.md` — "arquivo institucional vivo": acervo institucional consultável internamente, modelo de licença por instituição).

**Diferencial competitivo real:** a proposta de venda institucional do Tusab hoje é local-first + LGPD + curadoria (ver `/comercial-b2b`). "Conecte o sistema da sua empresa como fonte pesquisável, sem o dado sair da rede da empresa" reforça exatamente esse argumento — nenhum concorrente cloud (NotebookLM Enterprise) consegue prometer isso com a mesma credibilidade, porque eles não são local-first por design.

**Existe precedente técnico, não de audiência:** o endpoint customizado de LLM (provedor tipo 9router) já validou o PADRÃO técnico de "usuário informa uma URL e o Tusab passa a falar com ela" — mas foi construído pro caso B2C (usuário aponta pro próprio servidor local). Aqui o padrão técnico é o mesmo; o contexto de uso e os requisitos de segurança/governança é que mudam por ser dado institucional, não pessoal.

## A diferença técnica que separa isso do caso do LLM

LLM providers já falam um protocolo **padronizado** (chat completions, OpenAI-compatible) — por isso o endpoint customizado de LLM foi quase plug-and-play. APIs de busca/dados **não têm protocolo universal**: cada uma tem seu próprio formato de resposta JSON — nome de campo do título, do texto, da URL, e o caminho até a lista de resultados varia de fonte pra fonte (confirmado nos 24 módulos já escritos: `item.get('notes')` no BCB, `item.get('abstractText')` no Europe PMC, `item.get('indications_and_usage')[0]` no openFDA — todos diferentes).

Isso significa que "fonte customizada" precisa de um passo que "LLM customizado" não precisava: **mapear os campos**. Num contexto B2B isso provavelmente é feito uma vez por um admin técnico da empresa cliente (não por cada usuário final), o que reduz a pressão por uma UX totalmente sem fricção — mas ainda vale simplificar.

## Dois caminhos de design pro mapeamento de campos

### A. Manual (formulário técnico)
Admin da empresa preenche: URL base, autenticação (header/token — provavelmente obrigatório num sistema institucional, diferente da maioria das fontes públicas hoje), nome do parâmetro de busca, e o caminho JSON até cada campo (lista de resultados, título, texto, URL). Mais robusto e auditável — faz sentido como responsabilidade de um admin técnico, não do usuário final da equipe.

### B. Assistido por IA (recomendado, a validar)
Admin cola a URL + credencial + um termo de teste; o Tusab faz uma chamada real, pega a resposta bruta, e usa o LLM já configurado pra **inferir automaticamente** o mapeamento de campos — perguntando confirmação antes de salvar. Reduz o esforço de setup mesmo em contexto institucional, onde o tempo do time de TI do cliente é caro.

## Riscos a resolver antes de implementar (mais críticos em contexto institucional do que seriam em B2C)

- **SSRF:** URL arbitrária controlada pelo usuário, chamada pelo backend do Tusab. Mesma mitigação já avaliada por `/seguranca` pro caso do LLM customizado — mas aqui a superfície é maior, porque a fonte customizada provavelmente aponta pra dentro da rede interna da empresa (não pra um serviço público), então o risco de SSRF contra outros sistemas internos é mais real, não hipotético.
- **Autenticação e armazenamento de credencial:** diferente da maioria das fontes públicas (sem chave), uma API institucional quase sempre exige token/header de auth — precisa do mesmo cuidado já usado pra chaves de LLM (`safeStorage`, nunca em claro).
- **Governança/permissão:** quem na empresa cliente pode adicionar ou editar uma fonte customizada? Isso é dado institucional sensível — provavelmente não deveria ser self-service pra qualquer usuário da equipe, e sim restrito a um papel de admin (conecta com o item já mapeado em `/dev-b2b`: "permissões por base").
- **Taxonomia:** onde essa fonte customizada vive na estrutura de área de conhecimento? Provavelmente uma área própria por instância/empresa, separada das 9 áreas curadas — cada cliente B2B só vê as próprias fontes customizadas, nunca a de outro cliente.
- **Falha de mapeamento:** o que acontece quando a IA erra a inferência de campo, ou a API do cliente muda de formato depois? Precisa de um caminho claro de "editar mapeamento" sem perder a fonte já configurada — e provavelmente um alerta pro admin quando a fonte para de retornar resultados esperados.

## Não implementar agora

Fica registrado como proposta estruturada — decisão de quando entrar no roadmap B2B é do Augusto. Ver também `Documentação do Produto/Brainstorming Durante o Desenvolvimento.md` pra o contexto de onde essa ideia surgiu na mesma sessão, e `Documentação do Produto/Plano B2B — Tusab Enterprise.md` pra onde isso se encaixaria na Camada 3.
