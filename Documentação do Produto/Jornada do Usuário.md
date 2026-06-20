# Jornada do Usuário — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

---

## Persona de referência

**João, 34 anos, analista de investimentos.**
Segue 3 canais de finanças no YouTube, tem PDFs de relatórios anuais e anotações de reuniões em DOCX. Perde tempo toda semana procurando informação que já assistiu ou leu. Não quer mandar dados para a nuvem. Não quer pagar mensalidade de IA.

---

## Passo 1 — Download e instalação

João acessa tusab.solutions, baixa o instalador `.exe` para Windows.

O instalador NSIS configura o app e, na primeira execução, o Electron detecta se o Ollama já está instalado na máquina. Se não estiver, oferece o download guiado. Python embeddable e yt-dlp já vêm bundled — João não precisa instalar nada manualmente.

**O que João vê:** progresso de instalação, depois a tela inicial do app.

**Ponto de valor:** zero dependências externas visíveis. "Funciona e pronto."

---

## Passo 2 — Primeira abertura e onboarding

Ao abrir, dois eventos acontecem em sequência:

1. **Modal de consentimento de telemetria** — João pode aceitar ou recusar. Decisão sem pressão. Se recusar, nada muda no funcionamento do app.

2. **Onboarding contextual** — cards guiam pelas 3 grandes ações: Extrair → Indexar → Conversar. João entende o fluxo antes de fazer qualquer coisa. O guia pode ser revisto a qualquer momento pelo botão Ajuda no sidebar.

**O que João vê:** tela inicial com cards de navegação, badges com dados reais (zerados por enquanto).

**O que João sente:** "Entendi o que preciso fazer. Não é complicado."

---

## Passo 3 — Configurar o primeiro canal do YouTube

João copia a URL `https://www.youtube.com/@FGV` e cola no campo de URL da tela principal.

O sistema valida o formato (regex whitelist: `@handle`, `/channel/`, `/c/`). Se a URL for válida, exibe o handle `@FGV` confirmado. Se for inválida (ex: link de vídeo avulso), erro inline claro: *"URL inválida. Use o link do canal (@canal, /channel/, /c/)"*.

**O que João vê:** card "Canal configurado" com o handle e a data.

**Ponto de valor:** validação instantânea — João sabe que está certo antes de começar a extração.

---

## Passo 4 — Extração do canal

João clica em **Iniciar Extração**. O modal abre direto na seleção de fontes (sem pedir a URL de novo — já está configurada).

João vê 6 categorias: Vídeos, Shorts, Ao Vivo, Podcasts, Cursos, Playlists — todas marcadas por padrão. Desmarca o que não quer e clica **Iniciar**.

A extração começa: barra de progresso, contador de vídeos processados, log em tempo real. Os cards de estatísticas atualizam ao vivo: *"32 de 6.035 vídeos · 1%"*.

O yt-dlp roda localmente no IP de João — sem passar por servidor intermediário. Cada vídeo tem sua legenda em português extraída e salva como `.txt` em `data/neural/@FGV/youtube/`.

**Extração incremental:** na segunda vez que João extrair o mesmo canal, apenas os vídeos novos são processados. Os já extraídos são pulados automaticamente.

**Fila de extração:** se João quiser extrair 3 canais de uma vez, adiciona os outros enquanto o primeiro roda. A fila aparece na sidebar com status de cada canal. Um erro num canal não interrompe os seguintes.

**Ao concluir:** modal pós-extração com opções claras — Indexar agora, Abrir pasta local, Enviar para Drive.

**Momento "aha!":** João vê "6.035 vídeos mapeados, 32 com legenda" e percebe o volume de conhecimento que acabou de entrar na sua base.

---

## Passo 5 — Repositório: adicionar documentos e textos

João vai para a aba **Repositório**.

Arrasta 3 PDFs de relatórios anuais para a área de drop. A drop zone reconhece os arquivos automaticamente — sem precisar clicar em "Upload" primeiro. Cada arquivo é processado em sequência com ícone de status.

João também cola uma ata de reunião diretamente: clica em **+ Adicionar** → Texto → cola o conteúdo → dá um título → Salvar.

**Parser automático:** se João exportar uma conversa do WhatsApp como `.txt` e fizer upload, o sistema detecta o formato e exibe *"✅ Formato detectado: WhatsApp Android"*. O texto é estruturado por dia e participante antes de ser indexado — o que melhora significativamente o recall no chat posterior.

**Busca full-text no repositório:** João pode buscar qualquer termo nos arquivos da base e ver trechos contextuais. O botão **"+ Usar no chat"** injeta o trecho diretamente no campo de texto do chat — como um "Adicionar contexto" do VS Code.

**O que João sente:** "Minha base está crescendo. Tudo o que eu já produzi ou coletei está aqui."

---

## Passo 6 — Indexar a base de conhecimento

João clica em **Indexar base** no header do Repositório.

Um modal abre com checkboxes: lista todos os projetos disponíveis, todos pré-marcados. João pode desmarcar projetos que não quer reindexar agora. Clica **Indexar**.

Progresso aparece na aba Agente. Ao concluir: *"39 chunks indexados"*.

**Ponto de valor:** a indexação é uma decisão consciente — João escolhe o que entra na base do mentor. Não é automático sem controle.

**Vindo do chat:** se João perguntar algo e receber *"Não encontrei conteúdo relevante"*, aparece o botão **Indexar base agora**. Um clique leva direto ao modal de indexação — sem precisar trocar de aba manualmente.

---

## Passo 7 — Configurar o agente (provedor de IA)

João vai para a aba **Agente**.

**Ollama (padrão, gratuito):** se o Ollama estiver rodando, aparece como opção padrão com o modelo instalado. João seleciona `llama3.2:1b` e salva. Status verde: *"Ollama conectado"*.

**Provedor externo (Groq, OpenAI, Gemini, Anthropic):** João ativa "Usar provedor externo", escolhe Groq (gratuito, sem cartão de crédito), cola a API key e clica **Testar chave**. Feedback imediato: válida ou inválida. Se válida, salva — chave criptografada via Windows DPAPI e armazenada no keystore local. Nunca em texto claro.

**Persona / tom de resposta:** João seleciona **Técnico** — terminologia precisa, dados exatos. A configuração persiste entre sessões e aparece como badge na barra inferior do chat.

---

## Passo 8 — Chat com a base de conhecimento

João abre o chat (drawer lateral, acessível de qualquer aba).

Digita: *"Qual o impacto da Selic nos fundos de renda fixa?"*

A resposta aparece em streaming — caractere por caractere, cursor piscante. Ao concluir: a resposta cita título do vídeo, data e link para o YouTube. João clica na fonte — abre o vídeo original.

**Busca Restrita (padrão):** mentor responde apenas com o que está indexado. Se não encontrar, informa claramente.

**Busca Ampla:** toggle no chat. Mentor usa a base como referência principal, mas complementa com conhecimento geral do modelo. Fontes aparecem para o que veio da base; conteúdo complementar não tem fonte.

**Multi-base:** João clica em **Base** na barra inferior → modal com todos os projetos indexados → seleciona FGV + documentos próprios → ambos alimentam a mesma conversa.

**Histórico de conversa:** as últimas 6 trocas ficam no contexto do LLM — o mentor lembra o que foi dito antes. João pode continuar uma linha de raciocínio sem repetir o contexto.

**Momento "aha!":** a primeira resposta com citação de fonte. João clica no link — é exatamente aquele vídeo. "É isso. O mentor sabe o que eu estudei."

---

## Passo 9 — Fluxo de uso recorrente

Após a configuração inicial, o fluxo de João é simples:

1. **Novo canal descoberto?** Cola a URL → inicia extração → aguarda → reindexar.
2. **Novo documento?** Arrasta para o Repositório → indexação automática.
3. **Dúvida?** Abre o chat → pergunta → recebe resposta com fonte → clica na fonte se precisar aprofundar.
4. **Relatório de cobertura?** Aba Relatório → tabela com todos os vídeos, status (extraído / sem legenda), views, data. Filtra por tipo ou busca por título.

O custo de troca aumenta a cada arquivo adicionado. A base é de João — não está em nenhum servidor.

---

## Casos de uso por perfil

### Aluno
"Tenho o canal do meu professor mais as apostilas do curso. Antes ficava procurando no YouTube e nas pastas. Agora pergunto e o mentor cita exatamente de onde veio — vídeo da aula 7, slide 3, apostila semana 4."

### Profissional
"Tenho 3 anos de relatórios setoriais em PDF e vídeos de conferências. Antes de uma reunião, pergunto ao mentor tudo o que já li sobre o tema. Em 2 minutos tenho o contexto — o que levaria 40 minutos de busca manual."

### Criador (canal educacional)
"Meu canal tem 800 vídeos. A audiência não consegue acessar o arquivo. Com o Tusab, indexei tudo mais meus roteiros e materiais. O mentor responde com a minha voz — cita meus vídeos, meus termos, minha didática. É literalmente eu, disponível 24h."

### Instituição (cursinho, empresa)
"Temos lives mensais, atas de reunião e manuais em PDF espalhados em pastas. Instalamos o Tusab na rede interna. Qualquer colaborador pergunta sobre procedimentos e o mentor responde citando o documento exato. Dados nunca saem da rede."

---

## Mapa de funcionalidades implementadas (junho 2026)

| Funcionalidade | Status |
|---------------|--------|
| Onboarding contextual + consentimento de telemetria | Implementado |
| Configurar canal YouTube (validação de URL) | Implementado |
| Extração de canal (fila sequencial, incremental) | Implementado |
| Repositório: upload multi-arquivo, texto, WhatsApp/Reuniões | Implementado |
| Drag and drop na área de upload | Implementado |
| Busca full-text no repositório com injeção de contexto no chat | Implementado |
| Indexação BM25 com seleção de projetos | Implementado |
| Chat RAG com streaming, fontes, busca ampla/restrita | Implementado |
| Chat com Ollama, Groq, OpenAI, Gemini, Anthropic | Implementado |
| Persona / tom do agente (5 modos) | Implementado |
| Histórico de conversa server-side (6 trocas) | Implementado |
| Perguntas sugeridas pós-indexação | Implementado |
| Renderização Markdown nas respostas | Implementado |
| Chat expandido (overlay sobre abas) | Implementado |
| Relatório de cobertura (filtros por tipo/status/aba + busca por título) | Implementado |
| Export: ZIP da base, Markdown do histórico, DOCX, XLSX, PDF | Implementado |
| Integração Google Drive (OAuth + upload) | Implementado |
| Desconectar Drive pela UI | Implementado |
| Limpar canal específico / Reset total | Implementado |
| Chaves de API criptografadas no keychain do OS | Implementado |
| Watchdog do backend no Electron | Implementado |
| Recovery de índice corrompido | Implementado |
| Telemetria PostHog opt-in com retenção Day 7/Day 30 | Implementado |
| i18n PT/EN/ES (216 chaves, 100% consistentes) | Implementado |
