# Jornada do Usuário — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026 · v0.5.2

---

## Quatro personas, quatro jornadas

O Tusab tem sistema de perfis com funcionalidades distintas por papel. A jornada não é universal — ela começa diferente dependendo de quem é o usuário. O onboarding pergunta o perfil logo na primeira abertura e adapta a experiência a partir daí.

---

## Persona A — Mariana, estudante de medicina, 22 anos

Usa o Tusab para estudar com a base que o professor compartilhou. Não sabe o que é BM25, não quer configurar nada complexo. Quer perguntar e receber a resposta com a fonte.

### Passo 1 — Recebe o arquivo `.tusab` do professor

O professor exportou a base do curso (aulas em vídeo + apostilas + transcrições) e mandou o arquivo via e-mail ou Drive.

### Passo 2 — Instala o Tusab

Baixa o instalador `.exe` em tusab.solutions. NSIS configura tudo. Python embeddable e yt-dlp já vêm bundled — Mariana não instala nada manualmente.

### Passo 3 — Onboarding: escolhe o perfil Estudante

Na primeira abertura, o Tusab exibe a tela de landing (logo + tagline + botão Entrar). Depois: seleção de idioma/tema, consentimento de telemetria e seleção de perfil.

Mariana escolhe **Estudante**. O onboarding inclui um passo sobre o motor de IA — **Ollama é apresentado como pré-requisito** para usar o chat localmente, com link de download direto. Alternativa: configurar um provedor externo (Gemini, Groq, etc.) com chave de API na aba Agente.

O app exibe: Repositório, Histórico, Relatório, Agente e Admin. Sem aba de Extração (estudante não produz base) e sem Visão Geral (painel de gestão de corpus não é relevante para consumo).

### Passo 4 — Importa a base

Na tela inicial, o card principal é **"Importar Base"** — em destaque, é a ação primária para o perfil Estudante. Mariana clica, seleciona o arquivo `.tusab` recebido. O projeto aparece disponível imediatamente — sem precisar indexar nada. O índice BM25 já vem dentro do arquivo.

### Passo 5 — Configura o motor de IA (se ainda não fez)

Se Ollama não estiver rodando e nenhum provedor externo estiver configurado, o chat exibe um painel âmbar de aviso com link de download do Ollama e instrução para configurar na aba Agente. Mariana instala o Ollama ou usa a chave Groq que o professor forneceu.

### Passo 6 — Conversa com o mentor

Abre o chat. Pergunta: *"Quais são os critérios de diagnóstico de sepse?"* A resposta aparece em streaming. Ao final: citação da aula 14, minuto 32 — com link para o vídeo original.

**Momento "aha!":** a resposta usa a linguagem e os exemplos do professor — não de um ChatGPT genérico. Mariana reconhece. "É como se o professor tivesse respondendo."

---

## Persona B — Carlos, professor universitário de economia, 41 anos

Tem um canal no YouTube com 6 anos de aulas, PDFs de artigos que indica aos alunos e atas de reuniões de departamento. Quer que os alunos possam consultar tudo isso — mas sem mandar dados para o Google.

### Passo 1 — Instalação e onboarding

Mesmo fluxo da Mariana. Ao selecionar **Professor**, o app abre com as abas: Extração, Repositório, Histórico, Relatório, Agente, Admin. Sem Monitor — painel de sistema não é relevante para o caso de uso.

### Passo 2 — Extrair o canal

Carlos cola a URL do canal YouTube → seleciona as fontes que quer incluir (Vídeos, Podcasts — desmarca Shorts) → clica Iniciar. A extração começa: barra de progresso, log em tempo real, contador de vídeos processados.

A extração roda no IP de Carlos — sem passar por servidor intermediário. Cada vídeo tem sua legenda em português extraída e salva localmente.

**Extração incremental:** na semana seguinte, quando Carlos postar um vídeo novo, o Tusab processa apenas o novo. Os anteriores são pulados.

### Passo 3 — Criar projeto e adicionar PDFs

Vai para a aba **Repositório** → clica **"+ Criar projeto"** no header → nomeia "Economia 2026" → projeto criado. Agora clica no botão 📎 no header do projeto → arrasta 12 PDFs de uma vez. O sistema processa em sequência.

**Contrato importante:** o projeto precisa existir antes do upload. O botão de upload só fica disponível após o projeto ser criado.

### Passo 4 — Indexar a base

Clica em **Indexar base** → modal com checkbox do projeto "Economia 2026" marcado → clica Indexar. Progresso na aba Agente. Resultado: *"4.312 chunks indexados"*.

### Passo 5 — Exportar para os alunos

No Repositório, no projeto "Economia 2026" → menu de exportação → **Exportar base**. Recebe o arquivo `Economia_2026.tusab`. Manda para os alunos pelo sistema da universidade.

**Momento "aha!":** Carlos descobre que pode atualizar a base ao longo do semestre e mandar arquivos atualizados. Os alunos importam a versão nova sem precisar fazer nada além de clicar em "Importar".

### Passo 6 — Configurar motor de IA e persona

Carlos tem acesso à aba Agente — pode configurar Ollama local ou chave de API externa (Groq, Gemini, OpenAI, Anthropic). Configura Groq com sua chave para respostas mais rápidas.

O perfil Professor usa a persona **Didático** por padrão — terminologia acessível, exemplos concretos. A persona é configurável na aba Agente ou Admin.

---

## Persona C — Débora, doutoranda em saúde pública, 28 anos

Constrói corpus de pesquisa sobre vigilância epidemiológica. Tem fontes de YouTube, PDFs de artigos e documentos do ministério. Quer busca semântica robusta e controle total sobre o que entra na base.

### Diferenças chave em relação ao Professor

**Perfil Pesquisador** tem o mesmo acesso que Professor, mais:
- **Visão Geral** — painel com analytics do projeto: tamanho do corpus, cobertura, distribuição de fontes, interações
- **Busca Ampla com CrossEncoder** — BM25 recupera top-12 → `ms-marco-MiniLM-L-6-v2` reordena semanticamente → top-6 vão ao prompt (+236ms medido). Complementa corpus com conhecimento geral quando necessário.
- Sem aba Admin — acessa tudo via aba Agente diretamente

**Fluxo típico de Débora:**
1. Cria projetos por eixo temático (ex: "Vigilância_Dengue", "Políticas_2024") via botão "+ Criar projeto" no Repositório
2. Extrai canais específicos para cada projeto (modoFila: URL → Projeto → Fontes)
3. Indexa separadamente — preserva rastreabilidade por fonte
4. No chat, seleciona múltiplos projetos para busca cruzada com CrossEncoder ativo
5. Exporta o histórico de chat como Markdown para documentar o raciocínio analítico

---

## Persona D — Rafael, analista de inteligência de negócios, 35 anos

Usa o Tusab em contexto corporativo. Relatórios setoriais, atas de reunião, vídeos de conferências do setor. Precisa de todas as funcionalidades, incluindo monitoramento e administração.

### Diferenças chave em relação ao Pesquisador

**Perfil Especialista** adiciona:
- **Monitor** — painel de status do sistema em tempo real (ETA de extração, uso de recursos)
- **Reset total** — limpar toda a base (hard-reset global, não por projeto)

**Fluxo típico de Rafael:**
1. Configura projetos por cliente ou tema de análise
2. Antes de reunião estratégica: abre o chat, seleciona os projetos relevantes, pergunta ao mentor com Busca Ampla
3. Exporta Q&A como PDF para incluir como anexo em relatório
4. Monitora o status do sistema pelo painel Monitor quando percebe lentidão

---

## Fluxo universal: primeira pergunta com fonte

Este momento é comum a todos os perfis. É o momento "aha!" do Tusab:

1. Usuário digita uma pergunta no chat
2. Resposta aparece em streaming — caractere por caractere, cursor piscante
3. Ao concluir: a resposta cita título do documento/vídeo, data e link de origem
4. Usuário clica na fonte — abre o vídeo original no YouTube ou o documento local

**O que o usuário sente:** "Ele não inventou. Ele sabe de onde veio."

---

## Fluxo de uso recorrente (pós-configuração)

Após a configuração inicial, o fluxo é simples para qualquer perfil:

| Ação | Estudante | Professor | Pesquisador | Especialista |
|------|-----------|-----------|-------------|--------------|
| Nova base disponível | Importar `.tusab` | Extrair canal / adicionar docs | Extrair + indexar por projeto | Idem + monitorar sistema |
| Novo documento | — | Repositório → botão 📎 do projeto | Idem | Idem |
| Dúvida pontual | Chat | Chat | Chat (busca ampla + CrossEncoder) | Chat (busca ampla + multi-base) |
| Configurar motor de IA | Aba Agente | Aba Agente | Aba Agente | Aba Agente |
| Mudar persona/tom do agente | Admin ou Agente | Admin ou Agente | Aba Agente | Aba Agente ou Admin |
| Compartilhar base | — | Exportar `.tusab` | Exportar `.tusab` | Exportar `.tusab` |
| Ver cobertura | Aba Relatório | Aba Relatório | Relatório + Visão Geral | Tudo |

---

## Mapa de funcionalidades por perfil (v0.5.2)

> Fonte canônica: `web_interface/src/hooks/usePerfil.js:PERFIS_CONFIG`

| Funcionalidade | Estudante | Professor | Pesquisador | Especialista |
|---------------|-----------|-----------|-------------|--------------|
| Chat RAG com streaming e fontes | ✅ | ✅ | ✅ | ✅ |
| Repositório (visualizar + upload) | ✅ | ✅ | ✅ | ✅ |
| Importar base `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Exportar base `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Histórico de conversas | ✅ | ✅ | ✅ | ✅ |
| Relatório de cobertura | ✅ | ✅ | ✅ | ✅ |
| Aba Agente (config provider/API key/persona) | ✅ | ✅ | ✅ | ✅ |
| Configurar API key (Groq/OpenAI/Gemini/Anthropic) | ✅ | ✅ | ✅ | ✅ |
| Busca Ampla + CrossEncoder no chat | ✅ | ✅ | ✅ | ✅ |
| Google Drive (sync) | ✅ | ✅ | ✅ | ✅ |
| Fila de extração múltipla | — | ✅ | ✅ | ✅ |
| Extrair canal YouTube | — | ✅ | ✅ | ✅ |
| Deletar arquivos do repositório | — | ✅ | ✅ | ✅ |
| Limpar canal (apagar base de um projeto) | — | ✅ | ✅ | ✅ |
| Painel Admin | ✅ | ✅ | — | ✅ |
| Visão Geral (analytics do corpus) | — | — | ✅ | ✅ |
| Monitor de sistema | — | — | — | ✅ |
| Reset total | — | — | — | ✅ |
| Persona padrão do agente | Didático | Didático | Técnico | Objetivo |

**Nota sobre Monitor:** exclusivo do Especialista — painel de observabilidade técnica (ETA de extração, status de sistema, threads). Os demais perfis não precisam dessa camada.

**Nota sobre Visão Geral:** exibida para Pesquisador e Especialista — painel de gestão de corpus (projetos, cobertura, indexação, interações). Estudante não vê porque não produz base; Professor tem Relatório que cobre o essencial.

**Nota sobre Ollama:** o chat exibe aviso âmbar quando Ollama não está rodando e nenhum provedor externo está configurado — com link direto para `ollama.com/download` e instrução para configurar na aba Agente. Válido para todos os perfis.

---

## Painel "Base de Conhecimento" no chat (v0.5.2)

O painel é acessado pelo ícone de banco de dados no cabeçalho do chat. Permite selecionar quais bases participam de cada conversa e indexar bases que ainda não têm índice.

### Comportamento de seleção
- **Card click** ou **checkbox** — adiciona/remove a base das "extras" (bases consultadas além da principal)
- A base principal (configurada na sessão) fica sempre marcada e não pode ser desmarcada pelo painel
- A seleção só é confirmada ao clicar **"Confirmar"** no rodapé — o botão aparece sempre que há bases listadas

### Botão "Reindexar" (topo do painel)
Indexa **todas as bases selecionadas** sequencialmente. O backend processa uma por vez — o frontend aguarda cada conclusão antes de disparar a próxima. Bases sem conteúdo (sem extração e sem documentos) geram erro individual mas não travam a fila.

### Toast de resultado
- 1 base indexada → "Base indexada — N chunks prontos!"
- Múltiplas, todas ok → "X bases indexadas com sucesso!"
- Parcial com erro → "X de Y bases indexadas (outras sem conteúdo)"

### "Indexar agora" nas mensagens
Quando o chat responde sem contexto BM25 (`sem_contexto: true`), aparece o botão **"Indexar agora"** na mensagem. Ele abre o painel Base de Conhecimento diretamente no chat — não navega para o Repositório.

### Indexação pelo Repositório
O botão **"Indexar base"** no header do Repositório abre um modal com checkboxes por projeto. Ao confirmar, o modal permanece aberto mostrando o progresso em tempo real (logs do backend) até todas as bases serem processadas. O mesmo `handleIndexarDoChat` do chat é usado — um único fluxo de backend para ambas as entradas.
