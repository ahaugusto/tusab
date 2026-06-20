# Jornada do Usuário — Tusab
## Roteiro de Vídeo: Funcionalidades Completas

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Versão:** v1.1 · Junho 2026

---

## Persona de referência para o roteiro

**João, 34 anos, analista de investimentos.**
Segue 3 canais de finanças no YouTube, tem PDFs de relatórios anuais e anotações de reuniões em DOCX.
Perde tempo toda semana procurando informação que já assistiu ou leu.
Não quer mandar dados para a nuvem. Não quer pagar mensalidade de IA.

---

## Estrutura do roteiro

Cada bloco tem:
- **Caminho Feliz** — o que acontece quando tudo funciona
- **Caminho Triste** — o que acontece quando o usuário erra ou falta algo
- **Exceções** — comportamentos de sistema a documentar

---

## BLOCO 1 — Primeira abertura e onboarding

### Contexto
João abre o Tusab pela primeira vez. Não configurou nada.

### Caminho Feliz
1. Abre o app → tela de boas-vindas com logo e tagline *"INDEX · AUGMENT · CONVERSE"*
2. Modal de consentimento de telemetria aparece — João pode aceitar ou recusar
3. Onboarding contextual inicia: cards guiam pelas 3 grandes ações (Extrair → Indexar → Conversar)
4. João clica em cada card, entende o fluxo antes de fazer qualquer coisa

### Caminho Triste
- João fecha a janela de onboarding sem ler → app funciona normalmente, onboarding não volta
- João quer rever o onboarding → botão **Ajuda** no sidebar reabre o guia

### Exceções
- Backend não está rodando → mensagem de erro silenciosa, UI carrega mas polling falha; o usuário não vê erro na tela de onboarding — só ao tentar usar
- Se `localStorage` estiver limpo (nova instalação ou reset manual), o onboarding é exibido automaticamente

---

## BLOCO 2 — Configurar um canal do YouTube

### Contexto
João quer adicionar o canal da FGV como primeira fonte.

### Caminho Feliz
1. Campo de URL visível na tela principal → João cola `https://www.youtube.com/@FGV`
2. Clica no ícone de confirmar (ou Enter) → sistema valida a URL, retorna `@FGV`
3. Card "Canal configurado" aparece com o handle e a data

### Caminho Triste
- João digita uma URL inválida (ex: link de vídeo avulso) → erro inline: *"URL inválida. Use o link do canal (@canal, /channel/, /c/)"*
- João deixa o campo vazio e tenta extrair → erro: *"Configure um canal antes de iniciar"*
- João cola a URL mas esquece o `@` → validação rejeita, pede formato correto

### Exceções
- URL válida mas canal sem legendas → a extração começa, conta os vídeos, mas gera 0 arquivos; sistema informa ao final: *"Nenhuma transcrição disponível"*
- Canal privado ou inexistente → yt-dlp retorna erro; sistema exibe mensagem descritiva

---

## BLOCO 3 — Iniciar extração do canal

### Contexto
Canal configurado. João clica em **Iniciar Extração**.

### Caminho Feliz (mesmo canal, primeira extração)
1. Clica "Iniciar Extração" → abre modal **direto na seleção de fontes** (sem pedir URL de novo, sem pedir projeto)
2. Modal mostra 6 tipos: Vídeos, Shorts, Ao Vivo, Podcasts, Cursos, Playlists — todos marcados por padrão
3. João desmarca o que não quer (ex: só Vídeos e Cursos) → clica **Iniciar**
4. Extração começa: barra de progresso, contador de vídeos processados, log em tempo real
5. Cards de estatísticas atualizam: *"32 de 6035 vídeos · 1%"*
6. Ao concluir → modal pós-extração com opções: Indexar agora, Abrir pasta, Enviar para Drive

### Caminho Feliz (enfileirar segundo canal)
1. Extração do primeiro canal ainda rodando → João cola nova URL de outro canal
2. Clica **Iniciar Extração** → modal abre em **3 etapas**: URL → Projeto → Fontes
3. Na etapa de projeto: pode usar projeto existente ou criar novo com nome pré-preenchido do canal
4. Canal é adicionado à fila → badge de fila aparece com contagem

### Caminho Triste
- João tenta iniciar sem canal configurado → botão bloqueado, erro inline
- João pausa a extração e fecha o app → ao reabrir, extração não retoma automaticamente (é necessário iniciar de novo)
- Canal já foi 100% extraído anteriormente → a extração reprocessa apenas vídeos novos (incremental)

### Exceções
- Rate limit do YouTube (429) → sistema retenta automaticamente com backoff; usuário não precisa intervir
- Vídeo sem legenda em PT → pulado silenciosamente; contador *"vídeos sem legenda"* cresce
- Conexão cai durante extração → extração falha no vídeo corrente; os já processados ficam salvos; usuário pode reiniciar e o sistema pula os já extraídos

---

## BLOCO 4 — Gerenciar a fila de extração

### Contexto
João quer extrair 3 canais de uma vez.

### Caminho Feliz
1. Adiciona canais à fila enquanto o primeiro extrai
2. Fila aparece na interface: lista os canais com status (aguardando, extraindo, concluído)
3. Pode remover um da fila antes de ele iniciar
4. Pode limpar toda a fila de uma vez

### Caminho Triste
- João tenta adicionar URL inválida à fila → rejeitada com erro
- João limpa a fila mas o canal em extração continua → a limpeza só afeta os canais *aguardando*, não o que está rodando

### Exceções
- App fechado com fila pendente → fila não persiste entre sessões; ao reabrir, a fila está vazia

---

## BLOCO 5 — Repositório: adicionar documentos e textos

### Contexto
João quer adicionar PDFs de relatórios e uma anotação de reunião.

### Caminho Feliz — Upload de arquivos
1. Vai para aba **Repositório** → clica **+ Adicionar**
2. Escolhe "Arquivo" → abre o painel de upload
3. Arrasta múltiplos arquivos de uma vez (PDF, DOCX, XLSX) para a área de drop
4. Fila de upload aparece com nome e ícone de status de cada arquivo
5. Clica **Confirmar upload** → cada arquivo é processado em sequência
6. Ícone ✅ por arquivo ao concluir; ao final, base é **reindexada automaticamente**
7. Toast aparece: *"Indexando base…"* → some ao concluir

### Caminho Feliz — Texto colado
1. Clica **+ Adicionar** → escolhe "Texto"
2. Cola o conteúdo de uma ata de reunião, dá um título
3. Clica **Salvar** → texto salvo e reindexação automática disparada

### Caminho Feliz — WhatsApp / Transcrições
1. Exporta conversa do WhatsApp como `.txt` e faz upload
2. Sistema detecta o formato automaticamente → aviso verde: *"✅ Formato detectado: WhatsApp Android"*
3. Texto é estruturado por dia e participante antes de ser indexado → melhora o recall no chat

### Caminho Triste
- Arquivo com extensão não suportada (ex: `.mp4`, `.zip`) → rejeitado com aviso, outros arquivos da fila continuam
- Arquivo muito grande → backend processa mas pode demorar; toast informa
- Título do texto vazio → botão Salvar bloqueado
- Upload sem canal selecionado → aviso: *"Selecione um projeto antes de adicionar"*

### Exceções
- PDF protegido por senha → extração de texto falha; arquivo salvo mas sem conteúdo indexável
- DOCX com conteúdo majoritariamente em imagem → extração retorna pouco texto; indexação funciona com o que encontrar
- Arquivo de imagem (PNG, JPG) → OCR não implementado; arquivo salvo como referência mas sem texto extraído

---

## BLOCO 6 — Indexar a base de conhecimento

### Contexto
João adicionou conteúdo e quer preparar o chat.

### Caminho Feliz
1. Na aba **Repositório** → clica **Indexar base** (botão no header, fora do accordeon)
2. Modal abre com checkboxes: lista todos os projetos disponíveis, todos pré-marcados
3. Pode desmarcar projetos que não quer reindexar agora
4. Clica **Indexar** → progresso aparece na aba Agente
5. Ao concluir: contador de chunks atualiza (ex: *"39 chunks indexados"*)

### Caminho Feliz — Vindo do chat
1. João pergunta algo no chat e recebe resposta: *"Não encontrei conteúdo relevante..."*
2. Aparece botão **Indexar base agora** → clica → chat fecha, Repositório abre com modal de indexação já aberta

### Caminho Triste
- João tenta conversar sem indexar → mensagem clara informando que não há índice + botão de indexação
- João cancela a indexação no meio → índice fica parcial; pode reiniciar depois
- Base vazia (nenhum arquivo) → indexação retorna 0 chunks; chat avisa que não há conteúdo

### Exceções
- Dois pedidos de indexação simultâneos → segundo é enfileirado e espera o primeiro concluir
- Arquivo corrompido no corpus → ignorado; demais arquivos são indexados normalmente

---

## BLOCO 7 — Configurar o agente (provedor de IA)

### Contexto
João quer escolher qual IA vai responder no chat.

### Caminho Feliz — Ollama (local, gratuito)
1. Vai para aba **Agente** → seção de configuração
2. Ollama aparece como padrão se detectado rodando
3. Seleciona o modelo (ex: `llama3.2:1b`) → salva
4. Verde: *"Ollama conectado"*

### Caminho Feliz — Provedor externo (Groq, OpenAI, Gemini, Anthropic)
1. Ativa "Usar provedor externo" → escolhe Groq
2. Cola a API key → clica **Testar chave** → feedback imediato: válida ou inválida
3. Clica **Salvar** → configuração persiste entre sessões (chave criptografada no keychain do OS)

### Caminho Triste
- Ollama não está rodando → status vermelho, aviso com link para download
- API key inválida → erro inline ao testar; não deixa salvar
- João salva sem testar → chat falhará na primeira pergunta com erro descritivo

### Exceções
- Chave expirada após salvar → chat retorna erro de autenticação; usuário atualiza a chave
- Ollama instalado mas sem modelo baixado → status "rodando" mas sem modelos listados; usuário precisa baixar um modelo via Ollama

---

## BLOCO 8 — Configurar o tom do agente (Persona)

### Contexto
João quer que o mentor responda de forma mais técnica e direta.

### Caminho Feliz
1. Na aba **Agente** → seção *"Tom de resposta"* (âncora `#agent-persona-section`)
2. Seis opções com emoji e descrição:
   - **Padrão** — sem instrução de tom
   - **Objetivo** ⚡ — direto, sem floreios
   - **Técnico** 🔬 — terminologia precisa, dados exatos
   - **Didático** 📚 — exemplos e analogias
   - **Descontraído** 😄 — tom leve, conversacional
   - **Socrático** 🤔 — pergunta ao final de cada resposta
3. João seleciona **Técnico** → salvo imediatamente, sem precisar de botão extra
4. No chat: botão **Tom** na barra inferior mostra *"Técnico"* em destaque

### Caminho Triste
- João muda de Técnico para Padrão → próximas respostas voltam ao tom neutro; respostas antigas não mudam
- João clica no botão **Tom** no chat → navega para a aba Agente e rola até a seção de persona automaticamente

### Exceções
- Configuração não persiste se o `agent_config.json` for deletado manualmente → volta para Padrão

---

## BLOCO 9 — Chat com a base de conhecimento

### Contexto
João quer perguntar sobre juros e Selic para o mentor que sabe o que ele já estudou.

### Caminho Feliz — Busca Restrita (padrão)
1. Abre o chat → agente já está indexado com base da FGV
2. João digita: *"Qual o impacto da Selic nos fundos de renda fixa?"*
3. Resposta aparece em streaming com citação de fontes (título do vídeo, data, link)
4. João clica na fonte → abre o vídeo original no YouTube

### Caminho Feliz — Busca Ampla
1. João ativa o toggle **Busca Ampla** (ícone ℹ️ explica a diferença)
2. Pergunta algo que está parcialmente na base → agente complementa com conhecimento geral do modelo
3. Fontes aparecem para o que veio da base; conteúdo complementar não tem fonte

### Caminho Feliz — Múltiplas bases
1. João clica em **Base** na barra inferior → modal abre com todos os projetos indexados
2. Seleciona FGV + documentos próprios → ambos alimentam a mesma conversa
3. Fontes misturadas aparecem na resposta com ícones diferentes (🎬 YouTube, 📄 Documento, 📝 Texto)

### Caminho Feliz — @menção
1. João digita `@` no chat → dropdown autocomplete aparece com documentos e bases disponíveis
2. Seleciona um documento específico → resposta prioriza aquele conteúdo

### Caminho Feliz — Histórico
1. João clica em **Histórico** → lista conversas anteriores salvas
2. Seleciona uma → conversa é restaurada no chat
3. Pode continuar de onde parou

### Caminho Triste
- Base não indexada → resposta: *"Não encontrei conteúdo relevante..."* + botão Indexar base agora
- Pergunta fora do escopo da base (Busca Restrita) → agente informa que não encontrou + sugestões de como reformular
- Pergunta de saudação simples → resposta de boas-vindas sem chamar o LLM (econômico)
- Ollama offline durante o chat → erro descritivo com link para verificar o Ollama

### Exceções
- Streaming interrompido por timeout → mensagem parcial aparece; usuário pode reenviar
- Resposta muito longa → renderizada em markdown com formatação (tabelas, listas, código)
- Pergunta ambígua → agente responde com o que encontrou + pergunta socrática se persona estiver em modo Socrático

---

## BLOCO 10 — Exportar conteúdo (Pro)

### Contexto
João quer um resumo do canal em DOCX para apresentar na reunião.

### Caminho Feliz
1. No chat, João digita: *"Gerar resumo do canal"* ou *"Exportar para Word"*
2. Agente detecta intenção de export → gera o arquivo
3. Card especial aparece no chat com botão de download e nome do arquivo
4. João clica → download inicia (`.docx`, `.xlsx`, `.pdf` ou `.md`)

### Caminho Triste
- Canal sem conteúdo indexado → export falha com mensagem descritiva
- Export solicitado sem estar na aba do canal → agente pede para selecionar uma base primeiro

### Exceções
- Arquivo muito grande → geração pode demorar; toast de loading durante o processo
- Formato não disponível na versão gratuita → ProSnackbar informa sobre upgrade

---

## BLOCO 11 — Visualizar relatório do canal

### Contexto
João quer saber quantos vídeos foram extraídos e qual a cobertura.

### Caminho Feliz
1. Vai para aba **Relatório**
2. Tabela mostra todos os vídeos: título, data, status (extraído / sem legenda)
3. Stats de cobertura: *"32 de 6035 vídeos · 1%"*
4. João filtra por tipo (Vídeos, Shorts, Ao Vivo) ou busca por título
5. Pode clicar em um vídeo para ver o texto extraído ou abrir no YouTube

### Caminho Triste
- Nenhum canal extraído → aba vazia com instrução para iniciar extração
- Filtro sem resultados → mensagem inline: *"Nenhum vídeo encontrado com esse filtro"*

---

## BLOCO 12 — Integração com Google Drive

### Contexto
João quer fazer backup do que extraiu no Drive.

### Caminho Feliz
1. Clica no ícone do Drive no sidebar → fluxo OAuth abre no browser
2. Autoriza com a conta Google → token salvo localmente
3. Pós-extração → opção *"Enviar para Drive"* disponível no modal pós-extração
4. Arquivos enviados como Google Docs (pesquisáveis no Drive)

### Caminho Triste
- João fecha o browser antes de concluir o OAuth → fluxo cancelado; Drive permanece desconectado
- Token expirado → próxima tentativa de upload pede nova autenticação
- Sem espaço no Drive → upload falha com mensagem descritiva

### Exceções
- `credentials.json` não encontrado → Drive indisponível; feature oculta ou desabilitada na UI
- Rate limit da API do Drive → upload de arquivos grandes retentado automaticamente

---

## BLOCO 13 — Limpar base e reset

### Contexto
João quer começar do zero ou apagar um canal específico.

### Caminho Feliz — Limpar um canal
1. No Repositório → abre o accordeon do canal → botão de lixeira inline
2. Confirma → arquivos do canal removidos; índice invalidado

### Caminho Feliz — Reset total (via sidebar)
1. Clica no ícone 🗑️ **Limpar** no sidebar (acima de Ajuda)
2. Modal de confirmação abre: descreve o que será apagado
3. João digita `RESETAR` para confirmar
4. Tudo apagado: arquivos, índices, histórico de chat
5. App volta ao estado inicial; canal removido do campo de configuração

### Caminho Triste
- João tenta deletar canal que está em extração → botão bloqueado enquanto extração roda
- João digita `resetar` (minúsculas) → não aceita; campo é case-sensitive

### Exceções
- Reset com extração em andamento em background → extração é cancelada antes do reset
- Reset falha parcialmente (ex: arquivo travado pelo OS) → sistema informa quais itens não foram removidos

---

## Mapa de funcionalidades por bloco

| Bloco | Funcionalidade | Status |
|-------|---------------|--------|
| 1 | Onboarding contextual + consentimento | ✅ |
| 2 | Configurar canal do YouTube | ✅ |
| 3 | Extração (canal único e fila) | ✅ |
| 4 | Fila de extração | ✅ |
| 5 | Repositório: upload multi-arquivo, texto, WhatsApp/Reuniões | ✅ |
| 6 | Indexação com seleção de projetos | ✅ |
| 7 | Configurar provedor de IA (Ollama / Groq / OpenAI / Gemini / Anthropic) | ✅ |
| 8 | Persona / tom do agente (5 modos) | ✅ |
| 9 | Chat RAG com streaming, fontes, busca ampla/restrita, @menção, histórico | ✅ |
| 10 | Export Pro (DOCX, XLSX, PDF, Markdown) | ✅ |
| 11 | Relatório de cobertura do canal | ✅ |
| 12 | Integração Google Drive | ✅ |
| 13 | Limpar base (por canal e total) | ✅ |

---

## Fluxo mínimo para o vídeo de demonstração

Se o vídeo precisar ser curto (5–8 min), cobrir nesta ordem:

1. **Abrir o app** → onboarding rápido (30s)
2. **Configurar canal FGV** → colar URL, confirmar (30s)
3. **Iniciar extração** → modal direto nas fontes, selecionar, iniciar, mostrar o progresso (60s)
4. **Adicionar PDF** → arrastar, confirmar, reindexação automática (45s)
5. **Configurar Groq** → colar key, testar, salvar (30s)
6. **Chat com fonte** → perguntar algo, mostrar resposta com citação, clicar na fonte (90s)
7. **Trocar persona** → mudar para Técnico via barra do chat, repetir a pergunta, comparar tom (45s)
8. **Busca Ampla** → ativar toggle, mostrar modal explicativa, fazer pergunta (30s)
9. **Reset total** → mostrar o ícone no sidebar, digitar RESETAR, confirmar (30s)

**Total estimado: ~7 minutos**

---

## Notas para a narração

- **Não chamar de "IA generativa"** — o diferencial é ser um mentor com o *seu* conhecimento
- **Enfatizar a privacidade** — tudo roda na máquina, dados nunca saem
- **Mostrar as fontes** — o clique na citação é o momento de maior diferenciação vs. ChatGPT
- **Comparação implícita com NotebookLM** — canais inteiros vs. vídeos avulsos; local vs. nuvem
- **Persona socrática** como punchline — o mentor que te ensina a pensar, não só a consultar

---

*Documento gerado para uso interno — CriAugu © 2026*
