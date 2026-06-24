# Jornada do Usuário — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

## Quatro personas, quatro jornadas

O Tusab tem sistema de perfis com funcionalidades distintas por papel. A jornada não é universal — ela começa diferente dependendo de quem é o usuário. O onboarding pergunta o perfil logo na primeira abertura e adapta a experiência a partir daí.

---

## Persona A — Mariana, estudante de medicina, 22 anos

Usa o Tusab para estudar com a base que o professor compartilhou. Não sabe o que é BM25, não quer configurar nada, não tem Ollama instalado. Quer perguntar e receber a resposta com a fonte.

### Passo 1 — Recebe o arquivo `.tusab` do professor

O professor exportou a base do curso (aulas em vídeo + apostilas + transcrições) e mandou o arquivo via e-mail ou Drive.

### Passo 2 — Instala o Tusab

Baixa o instalador `.exe` em tusab.solutions. NSIS configura tudo. Python embeddable e yt-dlp já vêm bundled — Mariana não instala nada manualmente.

### Passo 3 — Onboarding: escolhe o perfil Estudante

Na primeira abertura, o Tusab exibe a tela de landing (logo + tagline + botão Entrar). Depois: consentimento de telemetria (aceitar ou recusar, sem pressão) e seleção de perfil.

Mariana escolhe **Estudante**. O app simplifica: mostra apenas o Repositório e o chat. Sem abas de extração, sem configuração de API, sem painel administrativo.

### Passo 4 — Importa a base

Na tela inicial, o card principal é **"Importar Base"** — em destaque, é a ação primária para o perfil Estudante. Mariana clica, seleciona o arquivo `.tusab` recebido. O projeto aparece disponível imediatamente — sem precisar indexar nada. O índice BM25 já vem dentro do arquivo.

### Passo 5 — Conversa com o mentor

Abre o chat. Pergunta: *"Quais são os critérios de diagnóstico de sepse?"* A resposta aparece em streaming. Ao final: citação da aula 14, minuto 32 — com link para o vídeo original.

**Momento "aha!":** a resposta usa a linguagem e os exemplos do professor — não de um ChatGPT genérico. Mariana reconhece. "É como se o professor tivesse respondendo."

---

## Persona B — Carlos, professor universitário de economia, 41 anos

Tem um canal no YouTube com 6 anos de aulas, PDFs de artigos que indica aos alunos e atas de reuniões de departamento. Quer que os alunos possam consultar tudo isso — mas sem mandar dados para o Google.

### Passo 1 — Instalação e onboarding

Mesmo fluxo da Mariana. Ao selecionar **Professor**, o app abre com as abas: Extração, Repositório, Relatório, Agente. Sem painel admin, sem Monitor — não precisa.

### Passo 2 — Extrair o canal

Carlos cola a URL do canal YouTube → seleciona as fontes que quer incluir (Vídeos, Podcasts — desmarca Shorts) → clica Iniciar. A extração começa: barra de progresso, log em tempo real, contador de vídeos processados.

A extração roda no IP de Carlos — sem passar por servidor intermediário. Cada vídeo tem sua legenda em português extraída e salva localmente.

**Extração incremental:** na semana seguinte, quando Carlos postar um vídeo novo, o Tusab processa apenas o novo. Os anteriores são pulados.

### Passo 3 — Adicionar os PDFs

Vai para a aba **Repositório** → cria o projeto "Economia 2026" → clica no botão 📎 no header do projeto → arrasta 12 PDFs de uma vez. O sistema processa em sequência.

### Passo 4 — Indexar a base

Clica em **Indexar base** → modal com checkbox do projeto "Economia 2026" marcado → clica Indexar. Progresso na aba Agente. Resultado: *"4.312 chunks indexados"*.

### Passo 5 — Exportar para os alunos

No Repositório, no projeto "Economia 2026" → menu de exportação → **Exportar base**. Recebe o arquivo `Economia_2026.tusab`. Manda para os alunos pelo sistema da universidade.

**Momento "aha!":** Carlos descobre que pode atualizar a base ao longo do semestre e mandar arquivos atualizados. Os alunos importam a versão nova sem precisar fazer nada além de clicar em "Importar".

### Passo 6 — Persona do agente

O perfil Professor usa a persona **Didático** por padrão — terminologia acessível, exemplos concretos. A persona é configurável na aba Admin. Configuração de provedor de API externo (Groq, OpenAI) não está disponível para o perfil Professor — o chat usa Ollama local ou o provedor configurado pelo administrador da máquina.

---

## Persona C — Débora, doutoranda em saúde pública, 28 anos

Constrói corpus de pesquisa sobre vigilância epidemiológica. Tem fontes de YouTube, PDFs de artigos e documentos do ministério. Quer busca semântica robusta e controle total sobre o que entra na base.

### Diferenças chave em relação ao Professor

**Perfil Pesquisador** adiciona:
- **Visão Geral** — painel com analytics do projeto: tamanho do corpus, cobertura, distribuição de fontes
- **Busca Ampla** no chat — o modelo complementa com conhecimento geral quando o corpus não cobre
- **Configuração de API key** — Débora usa Anthropic claude-sonnet para análise mais aprofundada
- **Multi-canal** — busca simultânea em múltiplos projetos de pesquisa

**Fluxo típico de Débora:**
1. Cria projetos por eixo temático (ex: "Vigilância_Dengue", "Políticas_2024")
2. Extrai canais específicos para cada projeto
3. Indexa separadamente — preserva rastreabilidade por fonte
4. No chat, seleciona múltiplos projetos para busca cruzada
5. Exporta o histórico de chat como Markdown para documentar o raciocínio analítico

**Busca Ampla com CrossEncoder:** quando Débora ativa a busca ampla, o BM25 recupera os top-12 chunks candidatos e o CrossEncoder (`ms-marco-MiniLM-L-6-v2`) os reordena semanticamente — os top-6 mais relevantes vão ao prompt. Latência adicional de ~236ms, mas com recall significativamente superior em corpora densos.

---

## Persona D — Rafael, analista de inteligência de negócios, 35 anos

Usa o Tusab em contexto corporativo. Relatórios setoriais, atas de reunião, vídeos de conferências do setor. Precisa de todas as funcionalidades, incluindo monitoramento e administração.

### Diferenças chave em relação ao Pesquisador

**Perfil Especialista** adiciona:
- **Monitor** — painel de status do sistema em tempo real
- **Admin** — configurações avançadas
- **Reset total** — limpar toda a base quando necessário (hard-reset, diferente do "Limpar base" por projeto)

**Fluxo típico de Rafael:**
1. Configura projetos por cliente ou tema de análise
2. Antes de reunião estratégica: abre o chat, seleciona os projetos relevantes, pergunta ao mentor
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
| Mudar persona/tom do agente | Admin | Admin | Aba Agente | Aba Agente ou Admin |
| Compartilhar base | — | Exportar `.tusab` | Exportar `.tusab` | Exportar `.tusab` |
| Ver cobertura | — | Aba Relatório | Aba Relatório + Visão Geral | Tudo |

---

## Mapa de funcionalidades por perfil (junho 2026)

> Fonte canônica: `web_interface/src/hooks/usePerfil.js:PERFIS_CONFIG`

| Funcionalidade | Estudante | Professor | Pesquisador | Especialista |
|---------------|-----------|-----------|-------------|--------------|
| Chat RAG com streaming e fontes | ✅ | ✅ | ✅ | ✅ |
| Repositório (visualizar + upload) | ✅ | ✅ | ✅ | ✅ |
| Importar base `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Histórico de conversas | ✅ | ✅ | ✅ | ✅ |
| Painel Admin (persona, config geral) | ✅ | ✅ | — | ✅ |
| Deletar arquivos do repositório | — | ✅ | ✅ | ✅ |
| Limpar canal (apagar base de um projeto) | — | ✅ | ✅ | ✅ |
| Extrair canal YouTube | — | ✅ | ✅ | ✅ |
| Fila de extração múltipla | — | ✅ | ✅ | ✅ |
| Google Drive (sync) | — | ✅ | ✅ | ✅ |
| Relatório de cobertura | — | ✅ | ✅ | ✅ |
| Exportar base `.tusab` | — | ✅ | ✅ | ✅ |
| Aba Agente (config provider/API key) | — | — | ✅ | ✅ |
| Configurar API key (Groq/OpenAI/etc.) | — | — | ✅ | ✅ |
| Busca Ampla + CrossEncoder no chat | — | — | ✅ | ✅ |
| Visão Geral (analytics do projeto) | — | — | ✅ | ✅ |
| Monitor de sistema | — | — | — | ✅ |
| Reset total | — | — | — | ✅ |
| Persona padrão do agente | Didático | Didático | Técnico | Objetivo |

**Nota sobre Admin:** O perfil Pesquisador não tem a aba Admin — acessa configurações de agente diretamente pela aba Agente. Estudante e Professor têm aba Admin (persona e configurações básicas) mas não têm aba Agente (sem acesso a API key ou provider externo).
