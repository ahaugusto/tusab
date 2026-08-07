# Changelog — Tusab
© 2026 CriAugu — CNPJ 65.131.075/0001-57

Todas as mudanças relevantes do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com).
Versionamento via [Semantic Versioning](https://semver.org).

---

## [Não lançado]

---

## [1.0.42] — 2026-08-06

### Adicionado
- **Modo Estudo completo (Fases 3-6)** — lista de tópicos/nuvem de palavras (KeyBERT), geração escopada por tema via BM25 com kanban de artefatos persistentes e pesquisáveis (entram no índice, ficam disponíveis via MCP), Post-its (pontos-chave gerados por IA) e repetição espaçada nos flashcards (algoritmo SM-2).
- **Seleção de itens específicos no Modo Estudo** — Flashcards/Resumo/Quiz/Post-its podem ser restringidos a vídeos ou documentos específicos já indexados no projeto (com busca e marcar/desmarcar todos), em vez de sempre amostrar do projeto inteiro; combina com o Tema (BM25) já existente.
- **Seleção de playlists específicas + filtro por data de publicação** na extração do YouTube — novo endpoint `GET /playlists-canal`; a extração pode ser restringida a playlists escolhidas e/ou a um intervalo de datas em vez do canal inteiro. Seletor de playlists integrado ao botão "Playlists" (antes uma linha separada), com busca e marcar/desmarcar todas. Filtro ativo agora aparece no log em tempo real e fica persistido — visível como aviso no Relatório e ícone na Visão Geral, para não confundir um recorte do canal com o canal inteiro.
- **Suporte a modelos Ollama com thinking nativo** (qwen3, deepseek-r1) — lista de modelos sugeridos ampliada sem filtro por tamanho (a decisão de baixar é do usuário). Raciocínio visível opcional ("Mostrar raciocínio do modelo"), com toggle direto no card de cada modelo que suporta a feature.
- **Exclusão de modelo Ollama baixado** direto da lista de modelos — libera espaço em disco sem precisar do terminal.
- **Janela flutuante arrastável do chat** — a bolinha e a janela do chat podem ser reposicionadas na tela (antes fixas no canto), com dica de descoberta na primeira vez que aparecem.
- **Alerta de sobrecarga de RAM durante geração local (Ollama)** — aviso inline no chat quando a memória do sistema está muito alta durante a resposta.
- **Cache incremental de indexação por arquivo** — reindexar não reprocessa mais o corpus inteiro a cada vez; só arquivos novos ou alterados pagam o custo do enriquecimento semântico (KeyBERT). Reindexação automática em background após qualquer ingestão de conteúdo (extração, upload, texto colado, URL avulsa, busca em fonte pública) — não depende mais só do clique manual em "Indexar base".
- **Indicadores de status na navegação** — bolinha pulsante em "Repositório" durante indexação em background (mesmo padrão já existente em "Extração"), agora com tooltip explicando cada indicador ao passar o mouse ou focar com o teclado.

### Corrigido
- **Raciocínio do modelo sem resposta final** — um modelo com thinking podia esgotar o orçamento de geração só pensando, ou parar naturalmente sem nunca escrever a resposta em si; orçamento maior quando o raciocínio está ativo + nova tentativa automática sem thinking garantem uma resposta real em vez de deixar o usuário só com o bloco de raciocínio.
- **Fontes irrelevantes citadas no chat mesmo sem uso real** — BM25/CrossEncoder sempre completavam a cota de resultados, mesmo quando só o primeiro candidato era de fato relevante para a pergunta; novo filtro de lacuna de relevância descarta o resto.
- **Modal de indexação bloqueava o usuário** até terminar — fechar não cancela mais (a indexação já roda como tarefa em background no backend); toast de conclusão agora avisa também para indexação de um único projeto (antes só para lote).
- **Exclusão de projeto falhava para pastas com nome legado** (espaço/acento no nome real em disco, criadas antes de uma convenção de sanitização) — corrigido em `cerebro_limpar()`.
- **Contador "N selecionado(s)" na modal de indexação** incluía seleções fantasma de projetos que perderam conteúdo depois de marcados.
- **Acentos quebrados em playlists e informações de canal** (mojibake) — variável de ambiente `PYTHONUTF8` ausente em chamadas ao yt-dlp no Windows.
- **Filtro de data na extração não extraía nenhum vídeo** — `--flat-playlist` (usado no mapeamento rápido do canal) nunca preenche a data real de publicação; qualquer filtro de data ativo descartava 100% dos vídeos mapeados. Agora busca a data real só dos vídeos já mapeados, em lotes, e só quando o filtro está de fato ativo.
- **Modal de histórico do chat aparecia quebrada** na nova janela flutuante — dimensionamento pensado para a drawer antiga (quase a altura da tela) não cabia no painel flutuante, menor.
- Onboarding: removido o botão "Pular" da etapa de seleção de perfil — levava a um beco sem saída, descartando a seleção já feita sem nunca concluir o onboarding.
- Teste da área de Antropologia desatualizado desde a adição do módulo Wiktionary — causava falha em 100% das execuções de CI (todo push + todo rebase automático de PR do Dependabot) desde 01/ago, sem relação com nenhum bug real.
- **Nome de pasta/arquivo "aleatório" para canais do YouTube extraídos por URL sem `@handle`** (ex: `youtube.com/channel/UC...`) — o fallback de resolução de nome usava o último segmento da URL, que nesse formato é o ID interno do canal (hash de 24 caracteres), não um nome amigável. Agora resolve o handle/nome real via yt-dlp antes de decidir o prefixo, só quando a URL não traz `@handle` explícito.
- **Modal pós-extração não refletia a indexação incremental automática** já disparada em background — o card do Agente ainda instruía "indexe a base" como passo manual pendente; agora mostra o estado de indexação em andamento em tempo real.
- **Job `tests` do pipeline de release estava preso a um runner self-hosted macOS que não existe mais funcional** — `runs-on` pedia label `ARM64`, mas o único Mac físico disponível (MacBookPro11,1) é Intel; ajustar só o label não bastava, porque o PyTorch não publica wheel para macOS Intel desde a versão 2.2.2 (`requirements.txt` exige `torch>=2.12.1`) — esse job nunca teria hardware self-hosted elegível. Investigado o motivo original de ter saído do `ubuntu-latest` (bloqueio de billing reportado em meados de 2026) e confirmado que não reproduz mais — job voltou pro `ubuntu-latest` hospedado, mais barato e sem depender de nenhum Mac. Os jobs que de fato exigem Apple Silicon (`build-macos`, `electron-notarize` — geram o instalador assinado) permanecem `ARM64`, mantendo a decisão já registrada de publicar instalador macOS só para Apple Silicon.
- **README declarava requisito mínimo errado para o instalador macOS** ("macOS 12+"), descoberto ao investigar a limitação acima — `torch>=2.12.1` só publica wheel arm64 a partir da tag `macosx_14_0`, então o mínimo real é **macOS 14 (Sonoma)**. A v1.0.41 publicada (única release macOS até então) já foi construída com essa mesma versão do torch, então provavelmente já não abre em macOS 12/13 apesar do que o README dizia — sem relato de usuário afetado até o momento desta correção. `sentence-transformers` (motivo do pin) só exige `torch>=1.11.0`; o piso de `2.12.1` foi escolha própria do projeto, não uma dependência real — dá pra rebaixar se algum dia precisar suportar macOS mais antigo, mas ao custo de abrir mão de versões mais recentes de torch/onnxruntime.

### Alterado
- **Lista de modelos Ollama redesenhada** — de linhas compridas em largura total para cards menores organizados em colunas (3 na aba Configurações, 2 no onboarding).
- **Triagem completa dos 11 PRs do Dependabot** acumulados (backend, frontend e GitHub Actions) — cada um verificado isoladamente antes do merge.
- **Enriquecimento KeyBERT em lote na indexação** — extração de palavras-chave passou de uma chamada ao modelo por chunk para uma única chamada em lote por arquivo, amortizando o custo do forward pass do modelo de embeddings em reindexações grandes.

---

## [1.0.41] — 2026-07-31
### Adicionado
- **Instalador para macOS (Apple Silicon/arm64)** — Tusab agora publica `.dmg`/`.zip` assinado (Developer ID) e notarizado pela Apple ao lado do instalador Windows, mesmo pipeline de release (`electron-builder --mac`, notarização automatizada via `@electron/notarize` no GitHub Actions `macos-latest`). Só Apple Silicon (M1 ou superior) — Intel/x86_64 fora do escopo por ora. **Nota:** o README e as notas desta release não documentavam isso até a correção retroativa em 2026-08-01 — ver `agents/_historia.md`.
- **Busca em fontes públicas por área de conhecimento (perfil Pesquisador)** — registro genérico de fontes cobrindo as 9 áreas do catálogo de dados abertos mapeado (Produção científica, Tecnologia, Economia, Direito, Saúde, Ciências da Terra, Física/Química, Patrimônio cultural, Antropologia/linguística), com filtros de autor/data quando a fonte suportar.
- **Nova área "Buscadores gerais e multidisciplinares"** — arXiv, OpenAlex, DataCite, DOAJ, Zenodo, Crossref, data.europa.eu, data.gov.uk e Open Library, todos sem cadastro/chave, agrupados separado das áreas de domínio porque cobrem qualquer campo, não só um nicho. Mais 2 fontes novas por área: Hacker News (Tecnologia — só posts Ask HN/Show HN, que têm corpo de texto real) e openFDA (Saúde — bulários de medicamentos).
- **Leitor de página web avulsa no Repositório** — cole uma URL e o Tusab extrai o conteúdo principal e indexa, ao lado de "colar texto". Usa a biblioteca open-source [trafilatura](https://github.com/adbar/trafilatura) (Apache-2.0) para extração de conteúdo; respeita `robots.txt` antes de buscar, sem tentar contornar bloqueio de nenhum site. Limitado a páginas estáticas (sem renderização de JavaScript).
- **Tusab formalizado como source-available** — código sob [Elastic License 2.0](LICENSE): auditável, modificável e redistribuível, com a única restrição relevante sendo não oferecer como serviço hospedado/gerenciado a terceiros. Marca "Tusab" protegida separadamente ([TRADEMARK.md](TRADEMARK.md)). Pull Requests externos não aceitos por enquanto ([CONTRIBUTING.md](CONTRIBUTING.md)). Ver `agents/_historia.md`, entrada "Repositório fechado → revisado para source-available", para o histórico completo da decisão.
- **Lista de itens consultados após busca em base pública** — o resumo pós-busca (perfil Pesquisador) agora mostra os títulos dos resultados salvos (recolhida além de 5 itens) e um botão "Abrir base no Repositório" que já pré-seleciona o projeto certo.

### Corrigido
- **OCR de imagem exigia instalação manual de um binário externo (Tesseract)** — `pytesseract` dependia do Tesseract instalado à parte no sistema, gerando erro técnico pro usuário não-técnico quando ausente, e contradizendo o instalador de 1 clique. Substituído por [RapidOCR](https://github.com/RapidAI/RapidOCR) (Apache-2.0) — Python + ONNX puro, sem instalação externa, modelos baixados e cacheados automaticamente no primeiro uso (mesmo padrão do CrossEncoder/KeyBERT).
- **Chat perdia números e datas ao parafrasear contexto denso** — modelo local pequeno (`llama3.2:1b`) podia apagar dígitos de citações legais densas (ex: "Decreto-Lei nº 1.001, de 21 de outubro de 1969" virava "Decreto-Lei nº., de de outubro de"). Detecção do padrão de omissão + retry com instrução reforçada.
- **Chat misturava conteúdo de documentos diferentes com vocabulário parecido** — pergunta sobre uma lei específica podia trazer, na resposta, conteúdo real de outra lei retornada pelo BM25 na mesma busca (não invenção — conflação entre fontes). Filtro por identificador literal no retrieval quando a pergunta cita um número específico. Achado no processo: indexação de `documents/`/`texts/` nunca lia o título real do documento (usava nome de arquivo) — corrigido, com efeito colateral positivo na citação exibida no chat para qualquer documento não-YouTube.
- **Nomenclatura "canal" → "projeto" (Fase 1 — UI)** — o Tusab nasceu focado só em canais do YouTube; hoje um projeto é multi-fonte (YouTube + PDFs + fontes públicas + texto + web). Strings visíveis ao usuário (`pt`/`en`/`es`) atualizadas onde o termo era genérico — mantido "canal" onde é genuinamente específico do YouTube (config do canal, auto-update por canal, cobertura de legenda). Primeira de 5 fases planejadas; ver `agents/_historia.md`.
- **Header do chat espremido em telas menores** — itens da barra superior do drawer redistribuídos em duas linhas em vez de forçados numa só.
- **Configuração do agente podia reverter silenciosamente para Ollama** — corrigida condição de corrida em `useAgentConfig.js` que descartava a chave de provedor pago já salva; e validação que rejeitava salvar apenas idioma/persona sem re-enviar a chave.

### Alterado
- **Triagem completa dos 14 PRs do Dependabot** (backend + frontend + GitHub Actions) — cada um verificado isoladamente (changelog de breaking changes + suite de testes) antes do merge, seguindo o protocolo já registrado. Destaque: `electron-builder` 25.1.8→26.15.3 (major) verificado com build real do instalador (`electron-builder --win --dir`, gerou `Tusab.exe` com sucesso) antes do merge, não só leitura de changelog. `anthropic` 0.116.0→0.120.2 e `google-genai` 2.10.0→2.14.0 verificados via changelog (sem breaking changes) e teste estrutural de import/instanciação de cliente — sem chamada de rede real por não haver chave de API configurada neste ambiente de desenvolvimento.

---

## [1.0.40] — 2026-07-27
### Adicionado
- **Feedback de atualização mais visível** — verificação manual de update (Admin) agora dispara também um `ProgressToast` (canto inferior), além do texto pequeno ao lado do botão. "Você está na versão mais recente" passava despercebido.
- **Badge persistente de formato detectado no Repositório** — WhatsApp, reuniões (Zoom/Teams/Otter) e documentos jurídicos (petição/contrato/parecer) agora ficam marcados com um badge (⚖️/💬/🎥) na listagem de arquivos, sempre visível — antes só aparecia como aviso transiente no momento do upload. Persistido em `formato_detectado` no `_manifest.json`.

### Corrigido
- **Aba Admin liberada para o perfil Pesquisador** — era o único perfil sem acesso (MCP Server, notificações, verificação de atualização, privacidade/analytics, suporte). Não havia razão de segurança para a restrição — operações destrutivas (`reset_total`) continuam gated à parte, independente da aba estar visível. Avaliado com o agente `/produto` antes da correção.
- **arXiv/FHIR inacessíveis sem canal do YouTube configurado (perfil Pesquisador)** — o botão "Iniciar" na aba Extração ficava desabilitado até haver um canal configurado, mesmo para buscas que não dependem de canal nenhum. Corrigido; aviso contextual (🔬) explica a opção quando não há canal configurado.
- **Chip de perfil inacessível com Google Drive autenticado (WARN-25)** — chip de perfil e chip do Drive se excluíam mutuamente no header; impedia trocar de perfil sem antes desconectar o Drive. Agora coexistem lado a lado.
- **Formatação das respostas do chat** — o pipeline de renderização (ReactMarkdown + remark-gfm) sempre suportou negrito, tabelas, listas e parágrafos, mas o prompt só instruía parágrafos e listas — sem pedir negrito em termos-chave, tabelas para dados estruturados ou emojis contextuais. Além disso, os prompts de follow-up (`_montar_prompt_contexto`, usado em "resuma isso"/"traduza"/"explique melhor") e de trecho injetado (`_montar_prompt_trecho`) não tinham *nenhuma* instrução de formato. Unificado num único `_FMT_INSTR` compartilhado pelos três prompt builders.
- **Instrução de notificações não fazia sentido no app instalado (Electron)** — o texto dizia para "clicar no ícone de cadeado na barra de endereço do navegador", mas o Electron não tem barra de endereço. Detecta ambiente (`window.tusab?.checkForUpdates`) e mostra instrução correta (Configurações do Windows → Sistema → Notificações) quando empacotado.

---

## [1.0.39] — 2026-07-24
### Adicionado
- **Orientação sobre o MCP Server no produto** — feature já existente (endpoint `GET /agent/mcp/config`) ganhou exposição de verdade: botão "Copiar configuração MCP" na aba Admin, entrada de FAQ trilíngue (PT/EN/ES) explicando o que é e como conectar a Claude Code/Cursor/qualquer cliente MCP, e menção no onboarding do perfil Especialista. Antes, essa capacidade só era descoberta por quem lesse o código-fonte.
- **Descoberta das buscas FHIR/arXiv e do reconhecimento jurídico** — as três features já implementadas (v1.0.37/v1.0.38) não tinham nenhuma superfície de descoberta no produto além do próprio fluxo de uso. Adicionado: duas novas entradas de FAQ trilíngue (PT/EN/ES) em `help.html` — "Como busco estudos clínicos via FHIR?" e "O Tusab reconhece petições, contratos e pareceres?" — e um aviso permanente ("⚖️ Petições, contratos e pareceres jurídicos são reconhecidos automaticamente...") na zona de upload do Repositório, visível para qualquer perfil já que o parser jurídico não é restrito ao perfil Especialista.

---

## [1.0.38] — 2026-07-24
### Adicionado
- **Reconhecimento de documentos jurídicos (perfil Especialista)** — upload de petição, contrato ou parecer (`.txt`, `.md`, `.pdf`, `.docx`) agora é detectado automaticamente por estrutura textual (vocativo ao juízo, cláusulas numeradas, cabeçalho de ementa), mesmo padrão já usado para WhatsApp/Zoom/Teams/Otter. O texto é reformatado com um cabeçalho de campos extraídos (tipo de documento, cláusulas identificadas, CPF/CNPJ das partes, ementa) antes do conteúdo integral — melhora chunking e indexação sem depender de nenhuma API externa ou biblioteca jurídica. Avaliado em `agents/_historia.md` — testadas e descartadas fontes externas (Datajud/CNJ, LexML) por bloqueio de acesso automatizado e ausência de texto integral; a solução final opera só sobre documentos que o usuário já possui.
- **Confiança graduada por sentença no chat (P1-e)** — complementa a checagem de alucinação binária existente com um sinal visual discreto: quando parte de uma resposta tem baixo apoio direto nas fontes recuperadas, um indicador âmbar aparece sob a mensagem ("Parte desta resposta tem pouco apoio direto nas fontes — vale conferir"). Não substitui `_verificar_alucinacao()` (que continua podendo trocar a resposta inteira por "não encontrei") — adiciona granularidade por sentença sem suprimir nada. Funciona no chat streaming e não-streaming. Indicador agregado, não highlight por trecho dentro do markdown renderizado — mapear offsets de caractere para a árvore do ReactMarkdown seria frágil.
- **Calibragem dinâmica de RAG por corpus (P0-c, perfil Especialista)** — ao final de toda indexação, o backend calcula um `corpus_profile.json` com estatísticas reais (tamanho, tipo dominante, densidade) e ajusta `n_candidatos_bm25` — quantos candidatos o CrossEncoder recebe na Busca Ampla — ao tamanho real da base. Corpus grande (IDF menor por termo) recebe mais candidatos automaticamente, sem configuração manual. Exibido como badge "Perfil do corpus" no painel de bases. **Nunca inclui `score_minimo`** — invariante já removido em v1.0.26 (threshold arbitrário cortava resultados válidos em corpus grande); a rede de segurança continua sendo `score > 0 + FTS5`.
- **Progresso granular na indexação** — a barra de progresso do chat, antes indeterminada, agora mostra "X de Y fontes processadas" durante a indexação, reaproveitando a infraestrutura de `GET /agent/status` já existente. Granularidade por pasta de canal do YouTube e arquivo de documento/texto — sem alterar o parsing interno de vídeos (risco de schema já documentado). Degradação graciosa: sem o campo `index_progress`, volta ao comportamento indeterminado anterior.

### Corrigido
- **[CRÍTICO] Pipeline de release automático quebrado desde a v1.0.22** — descoberto que `release.yml` falhava silenciosamente há 15 versões (erro de permissão ao publicar em repositório diferente de onde o CI roda). Corrigido com Personal Access Token dedicado; releases automáticas via tag voltam a funcionar.

### Alterado
- **Dependabot configurado** — atualização automática de dependências (backend, frontend, Electron, GitHub Actions), um PR por dependência, testado isoladamente pelo CI antes de qualquer merge.

---

## [1.0.37] — 2026-07-17
### Adicionado
- **Busca de estudos clínicos via FHIR (perfil Pesquisador)** — no modal de extração, o perfil Pesquisador ganha uma terceira fonte além de YouTube/arXiv: "FHIR", buscando estudos de pesquisa (`ResearchStudy`) no servidor público de referência HAPI FHIR (`hapi.fhir.org`, padrão HL7, sem autenticação). Escopo deliberadamente restrito a `ResearchStudy` — nunca `Patient` ou qualquer outro recurso que modele dados de indivíduo, mesmo sintético/teste, para preservar "privacidade absoluta" do perfil Pesquisador B2C (dados de saúde individual via FHIR ficam reservados ao futuro vertical Tusab Saúde/B2B Enterprise). O parser extrai o campo padronizado `text.div` (Narrative, HTML legível por humanos) quando presente, com fallback gracioso para campos estruturados (`status`, `description`, `condition`) quando o narrative está ausente ou é um placeholder vazio — situação comum em servidores de sandbox público. Novo módulo `tusab_engine/motor/fhir.py` + endpoints `POST /fhir/search`, `POST /fhir/cancel`, `GET /fhir/status`, seguindo exatamente o mesmo contrato de `_manifest.json`/cabeçalho `TITULO/FONTE/DATA` da busca arXiv.

---

## [1.0.36] — 2026-07-07
### Alterado
- **Atualização completa de stacks (backend + frontend), com teste funcional real por grupo** — não apenas `pip install -U` cego: cada grupo foi validado com uma chamada real, não só suite mockada.
  - **Backend Python:** `yt-dlp` 2026.6.9→2026.7.4 (testado com mapeamento real de canal do YouTube), `anthropic` 0.109→0.116, `openai` 2.41→2.44, `google-genai` 2.6→2.10 (SDK Anthropic testado com chamada real de API), `transformers` 5.12→5.13 (CrossEncoder testado com ranking real de relevância), `fastapi`/`uvicorn`/`pydantic`/`pdfplumber`/`pypdfium2` e demais dependências de baixo risco atualizadas. `requirements-lock.txt` regenerado com as versões finais.
  - **Frontend:** `react`/`react-dom` 19.2.6→19.2.7, `vite` 8.0.14→8.1.3, `framer-motion`, `i18next`, `lucide-react`, `axios`, `posthog-js`, `autoprefixer`, `postcss` — 12 pacotes no total. `npm audit fix` resolveu 2 vulnerabilidades transitivas (`dompurify`, `form-data`). Build de produção (`npx vite build`) validado sem erros.
  - **Conflitos de dependência resolvidos:** o update em lote quebrou temporariamente `google-ai-generativelanguage`/`google-api-core`/`grpcio-status` (exigem `protobuf<6.0dev`), `huggingface-hub` (exige `typer<0.26.0`), `sympy` (exige `mpmath<1.4`) e `torch` (exige `setuptools<82`) — travados de volta às versões compatíveis; `pip check` confirma zero conflitos.
  - **Pendente de decisão humana, não aplicado:** `tailwindcss` 3→4 é major bump com mudança de modelo de config (JS→CSS-first `@theme`) — risco real de quebrar as classes `dark:` usadas em todo o Design System; registrado como item de roadmap separado, não incluído nesta rodada.
  - Suite de testes: 46/46 verde em todas as etapas.

### Adicionado
- **Busca acadêmica no arXiv (perfil Pesquisador)** — no modal de extração, o perfil Pesquisador pode alternar entre "Canal do YouTube" e "Buscar no arXiv": digite um tema ou palavras-chave, escolha quantos artigos baixar (até 50), e o Tusab baixa os PDFs e indexa como qualquer outro documento do Repositório. Feature inspirada no projeto open-source [OpenScience](https://github.com/synthetic-sciences/openscience) (synthetic-sciences) — avaliado em `agents/_historia.md` (seção "Benchmark — ferramentas open-source avaliadas"). Novo módulo `tusab_engine/motor/arxiv.py` + endpoints `POST /arxiv/search`, `POST /arxiv/cancel`, `GET /arxiv/status`.
- **TTS local no Modo Estudo (build Beta/Enterprise)** — botão "🔊 Ouvir resumo" que sintetiza o resumo estruturado em áudio localmente, sem chamada de rede após o primeiro download dos pesos. Usa [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) (Kyutai Labs) — modelo de 100M parâmetros, CPU-only, streaming, multi-idioma incluindo PT. **Reservado à edição Beta/Enterprise**: `torch`+`pocket-tts` medem ~530MB em disco (maior que a stack CrossEncoder/KeyBERT já vetada do B2C) — nunca entram no instalador padrão, ficam em `requirements-enterprise.txt`. Novo módulo `tusab_engine/agent/tts.py` + endpoints `POST /agent/tts`, `GET /agent/tts/status`. Frontend oculta o botão automaticamente quando a stack não está instalada (build B2C).

---

## [1.0.35] — 2026-07-06
### Corrigido
- **Banner de atualização invisível na HomeScreen (WARN-21)** — o banner `fixed` de nova versão disponível não aparecia enquanto o usuário estava na tela inicial (`!showHome`). Removida a condição; o banner agora aparece em qualquer tela, inclusive a HomeScreen.
- **Fechar painel do Drive não cancelava OAuth em andamento (WARN-23)** — o toggle switch do Drive permitia fechar o painel expansível durante `driveStatus === 'em_progresso'` sem encerrar o fluxo de autenticação, que continuava rodando em segundo plano sem feedback. Agora fechar o painel nesse estado chama `handleDriveCancel()` automaticamente, igual ao botão explícito "Cancelar autenticação".
- **[CRÍTICO] Auto-update silenciosamente quebrado desde v1.0.28** — o asset do instalador era publicado manualmente com pontos no nome (`Tusab.Setup.X.exe`), mas o `latest.yml` (e o `electron-updater`) sempre esperam hífens (`Tusab-Setup-X.exe`). A URL que o app tentava baixar automaticamente retornava 404 — só quem baixava manualmente pelo link do README recebia a versão nova. Confirmado por teste direto nas releases v1.0.30, v1.0.33 e v1.0.35. Fix: asset da v1.0.35 reenviado com o nome correto (hífens), mantendo o nome antigo como alias para não quebrar links já compartilhados.

---

## [1.0.34] — 2026-07-06
### Adicionado
- **Botão "Verificar atualização" na aba Admin** — seção permanente com versão atual e checagem manual forçada; funciona mesmo com auto-update desativado nas preferências. Achar versão nova dispara download automático + banner "Instalar e reiniciar". Handler IPC `check-for-updates` + `window.tusab.checkForUpdates()` + refactor do updater para init lazy/idempotente.
- **Design System oficial do Tusab** — `Documentação do Produto/Design System — Tusab.md`: tokens de cor (semânticos + superfícies dark por white/N), escala tipográfica de 6 degraus medida por grep no código real, radius por papel, espaçamentos canônicos, variantes de botão, componentes padrão (Card, ModalWrapper, toggle, badge, feedback), motion e a11y normativa. Inclui inventário completo de moléculas e organismos (`Design System — Inventário de Componentes.md`): shell, sistema de modais, chat completo, feedback global, estados transversais, formulários, dados e superfícies especiais.
- **Agente `/design-system`** — guardião dos tokens e da biblioteca de componentes; fronteiras claras com `/ui`, `/ux` e `/frontend`; medição real obrigatória antes de token novo.

### Corrigido
- **Fallback de versão hardcoded `'1.0.0'` no preload** — `resolveVersion()` agora cai para string vazia quando o `package.json` não resolve, em vez de exibir uma versão errada (AdminTab e help.html já ocultam o badge quando vazio).
- **Dívidas de consistência do Design System** — `StatCard`: classes `bg-${color}/15` interpoladas viravam alvo do purge do Tailwind JIT; substituídas por mapa estático `COLOR_CLASSES` com fallback para primary. `ConsentModal`: passa a usar `createPortal(document.body)` para que nenhum stacking context pai anule seu `zIndex` (mesma classe do bug de v1.0.13), preservando o design deliberado de bottom-sheet sem backdrop.

---

## [1.0.33] — 2026-07-02
### Corrigido
- **[CRÍTICO] Aba Monitor zerada no app instalado** — `psutil` estava no requirements.txt mas nunca entrou no `python_env` empacotado; o `/metrics` devolvia zeros silenciosamente. Instalado no python_env + `/metrics` retorna `available: false` quando psutil ausente + MonitorTab mostra aviso explícito em vez de zeros
- **Export XLSX quebrado no app instalado** — `openpyxl` ausente do python_env pelo mesmo motivo; instalado
- **Tags multi-palavra do YouTube eram peso morto no BM25** — "renda fixa" virava token único `renda_fixa` que nunca dava match; agora cada palavra entra individualmente no corpus (peso 3x preservado, stopwords filtradas)

### Alterado
- Chave de telemetria PostHog atualizada para o projeto novo (dados de v1.0.30–32 permanecem no projeto anterior, inacessível)
- Texto do aviso de métricas indisponíveis orienta atualizar o app antes de suspeitar de EDR/GPO

---

## [1.0.32] — 2026-07-02
### Adicionado
- **Funil D1 do Drive (analytics)** — eventos `drive_auth_iniciada`, `drive_auth_concluida`, `drive_desconectado` para medir uso do Drive vs chat antes de decidir o reposicionamento da feature
- **Lista de modelos Ollama ampliada de 8 para 12** — gemma3:1b (ultra leve), mistral-nemo:12b (128k ctx), qwen2.5:14b e phi4:14b; modelos thinking (qwen3, deepseek-r1) ficam de fora até o backend tratar o campo `thinking`

### Corrigido
- **Drive `sem_credenciais` deixou de ser falha silenciosa** — sidebar mostra "reinstale o Tusab" em vez de link de developer; painel do Repositório não chama mais `/drive-auth` fadado a falhar; backend retorna erro claro e imediato no `POST /drive-auth` sem credencial

---

## [1.0.31] — 2026-07-01
### Corrigido
- **[CRÍTICO] Preload falha no app empacotado** — `require('path')` lançava `Error: module not found: path` em `preload.js` ao rodar o instalador no Windows. Causa: Electron 20+ ativa sandbox por padrão nos preloads, bloqueando `require()` de Node built-ins. Fix: `sandbox: false` em `webPreferences` das duas janelas (main + help). Com preload falhando, `window.tusab` ficava `undefined`, `API_BASE` caía para `localhost`, e todas as requisições ao backend (`127.0.0.1:8001`) eram bloqueadas por CORS — tornando indexação e chat inoperantes.

---

## [1.0.30] — 2026-07-01
### Adicionado
- **`@@` injeta trecho diretamente no LLM** — trechos selecionados via `@@busca` no chat são enviados como contexto fixo, sem re-processar pelo BM25. O LLM vê exatamente o trecho que o usuário selecionou no dropdown. Campo `trechos_fixados` adicionado ao contrato do endpoint `/agent/chat/stream`.

### Corrigido
- **Banner de atualização do app** — ao detectar nova versão disponível, mostra "Baixando automaticamente…" + link "Baixar manualmente" (GitHub Releases) como fallback. Quando o download termina, botão muda para "Instalar e reiniciar" com instrução clara. Removida mensagem contraditória "Feche o app para instalar automaticamente" quando o botão já executa a instalação.

---

## [1.0.28] — 2026-07-01
### Corrigido
- **`+ Arquivo` no Repositório vira chip no chat** — botão agora adiciona o arquivo como chip âmbar de contexto fixado (mesmo comportamento do `@` no chat), em vez de injetar o conteúdo completo no input. Suporta YouTube, documentos e textos. Chat abre automaticamente com o chip visível.

---

## [1.0.27] — 2026-07-01
### Adicionado
- **Menção `@arquivo` no chat** — digitar `@` abre dropdown com todos os arquivos do projeto ativo (YouTube, documentos, textos); selecionar fixa o arquivo como filtro BM25 — o LLM lê apenas chunks daquele arquivo
- **Menção `@@busca` no chat** — digitar `@@termo` (mín. 2 chars) executa busca BM25 real na base, igual à busca do Repositório; resultados aparecem no dropdown com o termo destacado em âmbar; selecionar injeta o trecho como contexto fixo
- **Chips de arquivo na bolha da mensagem** — arquivos/trechos fixados via `@`/`@@` aparecem como chips coloridos acima do texto na bolha do usuário (âmbar para `@`, ciano para `@@`), tornando o contexto referenciado visível
- **Highlight de termo nos resultados de busca do Repositório** — o termo buscado aparece destacado com fundo âmbar e negrito dentro de cada trecho encontrado

### Corrigido
- **Fila de chat: resposta aparecia na mensagem errada** — `setChatMessages` usava posição `msgs.length-1` e atingia a mensagem enfileirada. Fix: `streamId` único por envio; todas as atualizações usam identidade (`_streamId === streamId`) em vez de posição
- **Saudações traziam fontes irrelevantes** — `_SAUDACOES` expandido para PT-BR/EN/ES; verificação pós-classificador força `CONVERSA` mesmo quando o LLM retorna `BUSCA` para inputs curtos
- **Fontes exibidas mesmo sem contexto** — frontend agora suprime o bloco de fontes quando `sem_contexto: true`, independente de o array `fontes` estar preenchido
- **`/agent/arquivos` retornava vazio** — endpoint não percorria subdiretórios de `youtube/` (estrutura real: `youtube/NomeCanal/*.txt`); corrigido para percorrer um nível de subpastas
- **`NameError` no fallback multi-projeto** — `cached` não era definido no caminho merged (`len(todos_projetos) > 1`); corrigido com `'cached' in locals()` antes de acessar
- **`AttributeError` em `_meta.json` malformado** — validação de schema (`isinstance(data, dict)`) antes de usar como mapa de títulos

---

## [1.0.26] — 2026-06-30
### Adicionado
- **FTS5 (SQLite) como camada de busca exata** — em paralelo ao BM25, agora existe um índice SQLite FTS5 por canal com tokenizador `unicode61 remove_diacritics 2`; garante recall de termos literalmente presentes mesmo quando o BM25 perde por IDF diluído (ex.: nomes próprios, siglas, termos técnicos raros)
- **Botão flutuante de chat redesenhado** — glow pulsante a cada 60s, badge de status verde (base + LLM prontos) ou âmbar (base sem LLM), sem os "círculos estranhos" anteriores; posicionado acima do botão de lixeira no Repositório para não sobrepor ações
- **Renderização Markdown no chat** — `react-markdown` + `remark-gfm` + `remark-breaks`; listas, negrito, tabelas e quebras de linha agora renderizam corretamente
- **Snack de convite ao chat** — reaparece após cada indexação ou extração concluída (não só uma vez por sessão); frase aleatória das LOADING_PHRASES em vez de texto fixo
- **Toast de citação desloca com o chat** — `offsetRight` prop em ProgressToast: se o chat está aberto, o toast aparece ao lado (440px da borda) e não sobre o drawer

### Corrigido
- **4 fixes de recall BM25** — `texto_original` (não enriquecido pelo KeyBERT) usado para scoring; `np.max` em vez de `np.mean` na agregação multi-query; threshold adaptativo substituído por `score > 0`; deduplicação FTS5 com fallback `chunk_{rid}` para docs sem metadados
- **`canalChat` desacoplado do modal de bases** — `canalAtualAtivo` usa `canalConfigurado || ''` sem fallback para `agentStatus.canal_indexado`; evita trocar a base silenciosamente ao abrir o modal
- **Modal de bases: desmarcar todas exibe aviso âmbar** — ao desmarcar todos os checkboxes, botão "Confirmar" fica desabilitado e aparece mensagem "Selecione ao menos uma base"
- **Toasts info suprimidos com chat aberto** — notificações informativas não aparecem sobre o drawer do chat
- **[Segurança] Path traversal em `fts.py`** — `_sanitizar_prefixo()` remove caracteres fora de `\w-` antes de montar o caminho do banco; defesa em profundidade independente do caller

### Técnico
- `_normalizar_markdown()` no pipeline de chat (não-streaming): remove pontuação duplicada (`.!?` repetidos), `: .` e converte sequências `**Texto**:` sem quebra de linha em itens de lista
- Prompt do agente fortalecido: instrução explícita para usar listas Markdown e evitar pontuação dupla
- `LOADING_PHRASES` exportada como named export de `ChatDrawer.jsx` para uso em App.jsx

---

## [1.0.25] — 2026-06-30
### Adicionado
- **Classificador de intenção no chat** — antes de buscar na base, o LLM classifica a mensagem em BUSCA / CONTEXTO / CONVERSA. Para instruções sobre a resposta anterior ("traduza para inglês", "resume em tópicos", "explica de novo") o BM25 é ignorado e o modelo opera direto sobre o contexto da conversa. Para saudações, responde sem busca. Roda em paralelo com o BM25 — sem latência extra no caso normal. Fallback para BUSCA em qualquer falha.
- **Dicas de uso nas frases de loading** — 12 novas frases ensinam como perguntar melhor enquanto o modelo processa: perguntas específicas, comparativas, pedindo citação de fonte, pedindo exemplos concretos, usando @fonte para fixar documento.
- **Placeholder agnóstico no chat** — "Me diga o que você precisa..." em vez de "Pergunte sobre o canal..." — induz o usuário a usar comandos mais diretos e explícitos.

### Corrigido
- **[CRÍTICO] Stream de chat nunca atualizava contexto** — o `_gen()` do SSE tinha `except: pass` descartando todos os chunks de texto puro; `resposta_acumulada` ficava vazia e o classificador CONTEXTO era completamente inativo. Corrigido para acumular chunks no `except`.
- **Fallback seguro CONTEXTO→BUSCA** — quando a primeira mensagem da sessão é classificada como CONTEXTO (sem resposta anterior), o sistema faz fallback limpo para BUSCA sem passar `prompt=None` ao LLM.
- **Stop token `'.'` removido do Ollama** — podia truncar a classificação em `B` antes de completar `BUSCA`; fallback cobre mas era risco desnecessário.

---

## [1.0.24] — 2026-06-30
### Corrigido
- **Aba Ferramentas ocultada temporariamente** — Modo Estudo (flashcards, resumo) removido da navegação enquanto backend assíncrono não está pronto; evita timeout de 300s e perda de geração ao trocar de aba. Ferramentas serão reintroduzidas com notificação desktop ao concluir
- **initialSubTab inválido corrigido** — ao navegar para a aba Agente pela Home, o app tentava abrir a sub-aba 'funcionalidades' (removida); corrigido para abrir 'configuracoes'

---

## [1.0.23] — 2026-06-30
### Adicionado
- **Chunking temporal por janela para vídeos sem capítulos** — vídeos sem marcadores de capítulo agora geram múltiplos chunks de 2 minutos com overlap de 15s; um vídeo de 12 min passa de 1 chunk (timestamp fixo no segundo 5) para ~7 chunks com timestamps distribuídos ao longo do vídeo, permitindo que o chat aponte para o trecho exato relevante
- **Enriquecimento silencioso do corpus BM25** — frases-chave e sinônimos são extraídos automaticamente de cada chunk durante a indexação e adicionados ao corpus invisível; o usuário pergunta "metodologia ágil" e o sistema encontra vídeos que falam "sprint, kanban, iteração" sem correspondência literal
- **Aprofundar base — sumarização LLM por vídeo** — após configurar um modelo de IA, o Tusab oferece o processo "Aprofundar base": gera um resumo estruturado (tema, subtemas, entidades, conclusão) para cada vídeo ainda não analisado; o resumo é injetado no prompt do chat antes dos chunks, dando ao LLM visão macro do conteúdo antes dos trechos pontuais
- **Modal "Aprofundar base"** — abre automaticamente após salvar configuração de LLM quando há vídeos sem resumo; mostra quais projetos têm pendências e progresso em tempo real; roda em paralelo à indexação sem conflito
- **Onboarding interativo para IA** — step 5 do onboarding agora detecta o Ollama, lista os 3 modelos recomendados e permite baixar o modelo desejado sem sair do fluxo de boas-vindas; usuário termina o onboarding com a IA já configurada
- **Aba "Agente" renomeada** — menu lateral "Configurar Agente" → "Agente"; sub-aba interna "Funcionalidades" → "Ferramentas"; card da Home agora abre diretamente em Configurações

### Corrigido
- **Chunk de 8.000 para 3.000 chars** — chunks menores aumentam precisão do ranqueamento BM25 e distribuem melhor os timestamps no contexto do chat
- **[CRÍTICO] "Aprofundar base" nunca disparava** — validação do backend usava chave `'total'` mas `pending_por_canal()` retorna `'pendentes'`; corrigido em router_agent.py e AprofundarModal.jsx
- **[CRÍTICO] Troca de modelo no onboarding apagava chave de API externa** — `saveAgentConfig` com `api_key: ''` sobrescrevia chaves Gemini/OpenAI/Anthropic configuradas; substituído por sentinel `'__keep__'`

---

## [1.0.22] — 2026-06-29
### Corrigido
- **Chat: base ativa agora pode ser desmarcada** — ao clicar na base principal no modal de seleção, ela é desmarcada (antes o clique era bloqueado); botão × ao lado do chip de base no toolbar também limpa a seleção
- **"Tom" abre sub-aba Configurações** — clicar no botão de Tom/Persona no chat agora navega corretamente para a sub-aba Configurações do Agente (antes abria Funcionalidades/Modo Estudo)
- **Relatório em geração tem feedback visual** — ao abrir a aba Relatório enquanto a extração ainda está rodando, exibe banner animado com Loader indicando que o relatório será disponibilizado ao fim da extração; tela atualiza automaticamente a cada 8s
- **Toggle do Drive volta ao estado neutro ao cancelar aviso** — se o usuário abre o modal de aviso do Drive e cancela, o toggle volta para desligado (antes ficava ligado sem ter autenticado, exigindo dois cliques extras)
- **Versão no help.html sempre via IPC** — removido valor hardcoded de versão do arquivo de ajuda; a versão exibida é sempre a do executável instalado

---

## [1.0.21] — 2026-06-29
### Corrigido
- **Crash ao clicar "Indexar base" no Repositório**: modal de indexação não abria e gerava erro React #299 (`createPortal` sem container DOM). Corrigido

---

## [1.0.20] — 2026-06-29
### Corrigido
- **[CRÍTICO] Limpar base apagava todos os projetos**: clicar "Limpar" no Repositório para um projeto específico apagava os arquivos de todos os projetos. Backend agora filtra estritamente pelo canal informado; frontend envia o parâmetro obrigatoriamente
- **[CRÍTICO] Troca de idioma zerando chave de API**: ao trocar o idioma do app, a chave de API externa (OpenAI, Anthropic, Gemini, Groq) era apagada silenciosamente. Corrigido com sentinel interno — a troca de idioma nunca altera a chave configurada
- **Extração sem canal configurado**: ao abrir o modal de extração sem canal pré-configurado, o step de URL era pulado e a extração podia ser disparada sem destino. Fluxo corrigido — modal inicia pelo step de URL nesses casos
- **Mensagem de chat perdida silenciosamente**: ao enviar mensagens rapidamente com uma resposta em andamento e a fila cheia, a mensagem era descartada sem aviso e o input era limpo. Agora o input permanece preenchido — o usuário vê que o envio não aconteceu e pode reenviar
- **Falha de export sem feedback**: ao exportar conversa em DOCX, PDF ou planilha, erros do backend (ex: "sem histórico") geravam apenas log no console. Agora exibe snackbar de erro em vermelho com mensagem explicativa
- **Aba inválida para perfil Estudante**: no primeiro acesso com perfil Estudante, a aba inicial poderia ser "Extração" (não disponível nesse perfil). A aba inicial é agora determinada pelo perfil gravado, garantindo estado consistente desde o primeiro render

### Interno
- Auditoria completa de 17 jornadas de usuário com mapeamento de todos os endpoints; resultados incorporados ao agente de QA
- `_historia.md` atualizado com tabela de bugs da auditoria e decisões de priorização P0/P1/P2

---

## [1.0.19] — 2026-06-29
### Corrigido
- Atalho `Shift+C` para abrir o chat agora chama `handleOpenChat()` corretamente — o snack de hint "Pergunte à sua base" desaparecia apenas ao clicar no botão, não ao usar o atalho

### Interno
- QA expandido com mapeamento de atalhos de teclado, notificações, Drive, agente, repositório e chat RAG

---

## [1.0.18] — 2026-06-29
### Corrigido
- **Menu Electron incompleto**: opções Reload, DevTools, Zoom e Tela Cheia estavam ausentes — restauradas no menu Visualizar
- **Estabilidade do fluxo de primeiro acesso**: resolução definitiva do conflito de foco/`aria-hidden` que impedia o onboarding em determinados cenários de inicialização

### Interno
- Protocolos de QA atualizados com verificação obrigatória de Console do browser durante testes de first-run

---

## [1.0.17] — 2026-06-29
### Adicionado
- **Notificações do sistema (aba Admin)**: controle funcional com status em tempo real, botão de ativação e instruções contextuais para habilitar/desabilitar
- **Help / Ajuda (F1) — FAQ de notificações**: como são disparadas, como ativar e como revogar (PT/EN/ES)

### Corrigido
- CORS no dev server: `API_BASE` detecta o ambiente automaticamente (URL relativa no dev, URL direta no Electron)
- `UpdateSuccessModal`: não abre mais com versão vazia; link "Ver novidades" aponta para a release correta no GitHub

---

## [1.0.16] — 2026-06-28
### Adicionado
- **Janela de ajuda nativa (F1)**: FAQ trilíngue PT/EN/ES, atalhos de teclado, contato e versão dinâmica
- **Confirmação pós-atualização**: após instalação silenciosa, o app reabre automaticamente exibindo a nova versão e link para as novidades

### Corrigido
- App reabre automaticamente após instalar uma atualização (`quitAndInstall(false, true)`)
- `latest.yml` gerado com nome de arquivo correto para o `electron-updater` localizar o instalador

---

## [1.0.15] — 2026-06-28
### Adicionado
- Notificação de atualização disponível exibida na tela de entrada com badge de versão e botão de instalação direta

---

## [1.0.14] — 2026-06-28
### Adicionado
- Termos de licença do instalador NSIS traduzidos para PT-BR, EN e ES

---

## [1.0.13] — 2026-06-27
### Adicionado
- Instalador NSIS multilíngue com detecção automática do idioma do sistema operacional

---

## [1.0.12] — 2026-06-27
### Adicionado
- **Sistema de agentes especialistas** internos: QA, Frontend, Backend, Produto, UX, Inovação — com base de memória institucional (`agents/_historia.md`)
- **Mapa de cobertura pré-extração** (`GET /canal-info`): visualizar quais vídeos do canal já foram extraídos antes de iniciar
- Capítulos de vídeo como fronteiras de chunk BM25 para melhor granularidade de recuperação

### Corrigido
- Modal de onboarding renderizando com z-index correto sobre a tela de entrada

---

## [1.0.11] — 2026-06-26
### Adicionado
- **RAG denso**: chunking adaptativo por tipo de documento, score mínimo adaptativo por tamanho de corpus, CrossEncoder com janela de 768 chars
- Histórico de chat indexado como fonte adicional no RAG
- Sub-abas com underline `border-b-2` unificado em toda a interface

### Corrigido
- Acessibilidade completa de modais: `role="dialog"`, `aria-modal`, focus trap e restauração de foco via `ModalWrapper`
- Flashcards: amostragem aleatória do corpus (`random.sample()`) em vez de primeiros N chunks

---

## [1.0.10] — 2026-06-26

### New (Sprint 2 — Sprints 1.2, 2.1, 2.2, 2.3)
- **MCP Server** — `tusab_engine/mcp_server.py`: servidor stdio JSON-RPC 2.0 com tools `search_knowledge` e `list_projects`. Conecta o Tusab ao Claude Code, Cursor ou qualquer agente MCP. Config em `GET /agent/mcp/config` (agora em `router_status.py`).
- **Modo Estudo** — `router_estudo.py`: `POST /agent/study` gera flashcards e resumo estruturado; `GET /agent/study/{canal}` recupera sessão salva. Frontend: `EstudoTab.jsx` com flip 3D CSS, progress bar frente/verso, export Anki CSV.
- **Digest Semanal** — `router_digest.py` + `scheduler.py`: `POST /agent/digest/{projeto}` gera síntese dos conteúdos adicionados na semana (APScheduler, segunda-feira 8h). Digest salvo em `management/digest_YYYY-MM-DD.md`.
- **Onboarding inteligente do Ollama** (S1.2) — `OllamaSetup.jsx`: quando Ollama já está rodando com modelo instalado (`jaConfigurado = running && hasModel`), o bloco "O que é o Ollama?" e a lista de modelos sugeridos ficam ocultos. Aparecem ao clicar "Trocar modelo".
- **Modularização** — `router_estudo.py` e `router_digest.py` extraídos de `router_agent.py`; endpoint `/agent/mcp/config` movido para `router_status.py`. `router_agent.py` reduzido de 1.089 para 842 linhas.
- **Notificação desktop quando o chat responde** — ao receber resposta do LLM com o drawer fechado/minimizado, o Tusab envia notificação nativa do OS. Configurado no novo step de onboarding que solicita permissão de forma contextual.
- **Notificação nativa de update com ação de clique** — ao concluir download de nova versão, Electron exibe notificação do sistema com título e corpo; clique instala e reinicia imediatamente sem abrir o Admin.
- **Step de notificações no onboarding** — novo passo "Fique por dentro em tempo real" entre Indexar e Relatório. Exibe botão "Ativar notificações do sistema" com feedback visual de concedida/bloqueada. Fallback: usuários já onboardados recebem solicitação silenciosa na inicialização.
- **Accordion "Redes Corporativas" na aba Admin** — checklist de diagnóstico com 6 itens classificados por severidade (crítico/moderado/baixo): porta 8001, porta 11434, YouTube, GitHub, antivírus/EDR, GPO. Seção "O que pedir ao TI" com 3 itens de liberação. Traduzido em PT/EN/ES.
- **Aviso de métricas indisponíveis no Monitor** — quando `psutil` retorna zeros (ambiente EDR/GPO restritivo), exibe banner âmbar com link "Ver diagnóstico de redes corporativas →" que navega direto para o accordion do Admin.

### New (Sprint 3 — S3.1, S3.2, S3.3)
- **Timestamp clicável** (S3.1) — fontes de vídeo YouTube no chat exibem link ▶ MM:SS que abre o YouTube no minuto exato. `extraction.py` grava `VIDEO_ID`, `VIEWS` e `TIMESTAMP_INICIO` (segundos do primeiro cue VTT) em cada bloco do `.txt`; `index.py` parseia os novos campos; `chat.py` inclui `video_id` e `timestamp_inicio` nas fontes; `ChatDrawer.jsx` renderiza `<a>` clicável.
- **Date-aware retrieval** (S3.2) — perguntas com termos temporais ("recente", "último", "em 2024") filtram chunks pelo campo `data` antes do CrossEncoder. Só aplica quando há candidatos suficientes (≥ n/2).
- **Views boost logarítmico** (S3.3) — score BM25 multiplicado por `1 + 0.2 × log1p(views)/log1p(views_max)`. Boost máximo 1.2×; neutro quando views = 0. Aplicado pós-BM25, pré-CrossEncoder.

### Fixed (Sprint 2)
- **WhatsApp multilinha** — `_parsear_whatsapp()` migrado de `re.findall()` para iteração linha a linha. Mensagens com `\n` interno não são mais truncadas na primeira linha.

---

## [1.0.9] — 2026-06-25

### Fixed (UX)
- **Tela de loading com logo do ibis** — substituído o texto "Tusab" pelo logo completo (ibis + wordmark + INDEX ASCEND CONVERSE) na tela de inicialização do app instalado.

---

## [1.0.8] — 2026-06-25

### Fixed (P0 — Estabilidade)
- **Fila de extração perdida ao fechar o app** — `extraction_queue` agora persiste em `data/config/extraction_queue.json` a cada mutação e é restaurada no próximo startup. Jobs pendentes sobrevivem a crashes e reinicializações.
- **Race condition no histórico de chat** — leitura do histórico movida para dentro do `agent_chat_lock`, garantindo que leitura + LLM + escrita sejam atômicas. Chats concorrentes no mesmo canal não sobrescrevem mais o histórico um do outro.
- **`google-generativeai` legado removido** — SDK depreciado (`google-generativeai`) removido do `requirements.txt`; `google-genai` já era o SDK ativo e continua sendo o único.

### New
- **API de eventos estruturados no AppState** — `dispatch_event(event, **kwargs)` substitui o contrato implícito de emojis no `LogRedirector`. O motor pode chamar diretamente sem depender de padrões de string frágeis.
- **Toast de carregamento do CrossEncoder** — primeira busca ampla exibe toast informativo ("Carregando modelo de relevância semântica... ~30s") via campo `cross_encoder_loading` em `GET /agent/status`.
- **Persistência e restauração de fila** — métodos `salvar_fila()` / `restaurar_fila()` no `AppState`; chamados em todas as mutações da fila (add, clear, remove, move, pop).

### Improved (P1 — Qualidade RAG)
- **Chunking dinâmico por tipo de documento** — documentos PDF/DOCX usam janelas de 1.500 chars com overlap de 300; textos colados/WhatsApp usam 500 chars com overlap de 100. YouTube continua com chunks naturais por vídeo. Melhora o recall BM25 para documentos densos e conversas fragmentadas.

### Fixed (UX)
- **Botão "Voltar ao topo" disponível em todas as abas** — anteriormente só aparecia na aba Agente. Todas as abas com rolagem longa (Extração, Repositório, Histórico, Visão Geral, Monitor, Agente, Admin) agora compartilham um único ref de scroll e disparam o botão corretamente.

---

## [1.0.7] — 2026-06-25

### Fixed
- **Export de PDF não funcionava no app instalado** — `reportlab` declarado no `requirements.txt` mas nunca incluído no `python_env/` bundled. Instalado e reempacotado; export de PDF agora funciona offline sem dependências externas.
- **PDFs com layout complexo geravam texto corrompido** — tolerâncias explícitas no `pdfplumber.extract_text()` (`x_tolerance=3, y_tolerance=3`) melhoram extração de colunas e tabelas. Hifenização automática de linha (`palavra-\npalavra`) desfeita por regex. Espaços múltiplos colapsados.
- **PDFs escaneados eram rejeitados silenciosamente** — agora são aceitos no repositório com texto placeholder e aviso ao usuário, em vez de retornar "Arquivo sem conteúdo extraível". Campo `QUALIDADE_PDF` gravado no cabeçalho do `.txt` para diagnóstico futuro.
- **Mensagem de erro de export PDF inútil no .exe** — substituída sugestão de `pip install` por mensagem orientando o usuário a reinstalar ou contatar suporte.

---

## [1.0.6] — 2026-06-25

### Fixed
- **Chip "✓ ativo" no seletor de modelos Ollama aparecia sem modelo instalado** — `modelName` agora exige `hasModel` (lista não vazia) antes de resolver; sem modelo, chip não aparece.
- **E-mail de suporte com typo na aba Admin** — `tusab@tusab.sollutions` corrigido para `tusab@tusab.solutions`.
- **`electron-updater` apontava para repositório privado** — usuários sem acesso ao repo privado não recebiam atualizações automáticas. `build.publish.repo` corrigido para `tusab-public`.
- **Versão exibida no nav lateral não refletia a versão de publicação** — estava hardcoded `v1.0.0`; agora usa `__APP_VERSION__` injetado via Vite em build-time.

### New
- **Instalador NSIS multilíngue** — Português (padrão), Inglês e Espanhol. O idioma é detectado automaticamente pelo Windows via locale ID; sem seleção manual necessária.
- **Aviso no chat quando Ollama está ativo mas sem modelo** — estado `ollamaSemModelo` bloqueia o chat e exibe banner orientando o usuário a baixar um modelo na aba Agente.
- **Versão, ano, e-mail e CNPJ injetados em build-time** — constantes `__APP_VERSION__`, `__APP_YEAR__`, `__SUPPORT_EMAIL__`, `__CNPJ__` definidas em `vite.config.js` a partir do `electron/package.json`; nunca desincronizam com a release.

---

## [1.0.4] — 2026-06-25

### New
- Tela de loading em preto e branco (identidade da marca).
- Instalador oferece instalar o Ollama automaticamente durante o setup via script NSIS customizado.
- Botão de download direto do Ollama no app (sempre versão mais recente via redirect oficial).
- Estimativa de tempo restante durante download de modelos Ollama.

### Fixed
- Alerta visual claro quando Ollama não está instalado (âmbar, não verde).
- Chip "ativo" corrigido — não aparecia quando Ollama estava rodando mas sem modelo selecionado.

---

## [1.0.3] — 2026-06-24

### Fixed
- **Crash imediato do backend em instalações novas** — `ModuleNotFoundError: motor_tusab` ao importar via shim no Electron packaged. Corrigido path de import no `main.js`.
- Tela de loading com animação de pulsos e glow azul/violeta alinhada ao design da landing.

---

## [1.0.2] — 2026-06-24

### Fixed
- Timeout do backend aumentado para 90 segundos — resolve "Timeout aguardando backend" em máquinas novas (carregamento inicial dos modelos sentence-transformers demora mais).
- Feedback progressivo na tela de loading durante inicialização dos modelos de IA.
- Log do Python exibido no diálogo de erro para facilitar diagnóstico.

---

## [1.0.1] — 2026-06-24

### Fixed
- **Índices BM25 apagados após indexação bem-sucedida** — `get_agent_status()` chamava `get_canal_youtube_dir(prefixo)` com um argumento (assinatura exige dois); o `TypeError` era capturado pelo `except Exception` que deletava o arquivo como "corrompido". Separados os handlers: `json.JSONDecodeError`/`ValueError` apagam o índice; demais exceções apenas ignoram o `n_arquivos_fonte`.
- **Fontes erradas no chat multi-base** — `useChatEngine.js` enviava `agentStatus.canal_indexado` (último canal indexado globalmente) em vez de `canalConfigurado` (escolha do usuário). Invertida a precedência: `canalConfigurado || agentStatus.canal_indexado`.
- **Seletor de base ocupando o corpo do chat** — com 2+ bases indexadas, os cards de seleção apareciam no corpo da área de mensagens. Removidos; a modal `showBaseModal` (botão "Base" na barra inferior) abre automaticamente ao entrar no chat com múltiplas bases disponíveis.
- **Backend crashando ao servir JS grande no Windows** — `print()` do banner ASCII usava caracteres Unicode (`█`, `©`, `—`) incompatíveis com `cp1252` (encoding padrão do Windows), causando `UnicodeEncodeError` antes do servidor subir. Adicionado `-X utf8` ao spawn do Python no Electron e `sys.stdout.reconfigure(encoding='utf-8')` no `api_tusab.py`.
- **Electron em dev apontando para `AppData` em vez do projeto** — `TUSAB_DATA_DIR` era sempre `app.getPath('userData')` independente do ambiente; em dev os dados ficavam em `AppData\Roaming\Tusab` enquanto os índices estavam em `Desktop\Tusab\data`. Corrigido: em dev usa a raiz do projeto; em produção empacotada mantém `userData`.
- **Electron em dev usando Python do sistema** — adicionada detecção do `.venv\Scripts\python.exe` local antes de tentar `python_env` ou `python` do sistema.
- **Voltar para seleção de projeto no modal de upload** — ao abrir upload pelo card da home com projeto pré-selecionado, não havia como trocar. Adicionado botão `←` no chip do projeto que força o step de seleção/criação via `forceSelecionarProjeto`.
- **`useEffect` com referência antes de inicialização** — `precisaSelecionarBase` era usado no `useEffect` antes de ser declarado no componente, causando `ReferenceError` em runtime. Movido para após as declarações das constantes derivadas.

### Changed
- Botão "Selecionar base" no header do chat destacado em âmbar quando seleção é obrigatória.

---

## [0.5.2] — 2026-06-24

### Fixed
- **Indexação sequencial de múltiplas bases** — o loop anterior disparava todos os POSTs simultaneamente; o backend rejeitava a partir do segundo ("indexação já em andamento"). Agora `handleIndexarDoChat` processa a lista sequencialmente, aguardando o backend terminar cada item via polling (`_aguardarIndexacao`) antes de iniciar o próximo.
- **Modal de indexação (Repositório) com feedback imediato** — ao clicar "Indexar", o bloco de progresso aparece no topo da modal antes do primeiro poll (via `setIndexando(true)` síncrono); lista de projetos fica opaca/desabilitada durante o processo.
- **Toast de lote inteligente** — ao indexar múltiplas bases: se todas ok → "X bases indexadas com sucesso"; se erros parciais → "X de Y bases indexadas (outras sem conteúdo)". Toasts intermediários suprimidos durante lote.
- **Botão "Confirmar" da Base de Conhecimento sempre visível** — rodapé do painel estava condicionado a `canalAtivo`; agora aparece sempre que há bases listadas.
- **"Indexar agora" em mensagens sem contexto** — antes abria o modal de indexação do Repositório (comportamento errado); agora abre o painel Base de Conhecimento no chat diretamente.
- **Card click no painel Base de Conhecimento** — clique no card não troca mais a base principal imediatamente; apenas adiciona/remove das extras. Confirmação exclusiva pelo botão "Confirmar".
- **Tag "YouTube" redundante removida** do modal de indexação — ícone 🎬 já comunica a fonte; a tag textual gerava confusão.
- **`package-lock.json` sincronizado** — `@emnapi` deps transitivas faltando causavam falha no `npm ci` do CI.

### Changed
- `handleIndexarDoChat` (App.jsx) agora aceita string ou array de nomes de canal, consolidando a lógica de indexação de ambos os fluxos (ChatDrawer e RepositorioTab).
- `RepositorioTab.handleIndexarConfirmar` delega toda a fila ao `handleIndexarDoChat` em vez de fazer loop próprio.

---

## [Unreleased]
### Planned
- Fila de extração com retry e backoff exponencial
- Whisper como fallback para vídeos sem legenda (Gemma 4 12B pode substituir)
- Sistema de licença via Lemon Squeezy
- Imagens na base de conhecimento (Gemma 4 multimodal / OCR fallback)
- Busca web via Brave Search API
- Entrada por voz (AI Edge Eloquent como referência)
- LiteRT-LM CLI como provider adicional (aguardar API pública)
- Embeddings Ollama + ChromaDB (próxima versão pós-feedback CrossEncoder)

---

## [0.5.1] — 2026-06-24

### Changed
- **Perfis unificados** — estudante, professor e pesquisador agora têm acesso a todas as funcionalidades exceto Monitor (exclusivo do Especialista). Restrições anteriores por perfil eram arbitrárias e criavam fricção desnecessária.
  - Todos os perfis: aba Agente com config de provider/API key, Busca Ampla + CrossEncoder, Google Drive, Relatório, exportar base `.tusab`
  - Estudante: sem aba Extração (perfil de consumo) e sem Visão Geral (painel de gestão de corpus não relevante)
  - Professor e acima: acesso à Extração e Visão Geral
  - Monitor: exclusivo do Especialista
- **Onboarding s5 reescrito** — texto deixa claro que Ollama é pré-requisito do chat; instrução de instalação e alternativa de provedor externo explicitadas
- **Aviso de Ollama no chat** — painel âmbar quando `provider=ollama` e Ollama não detectado; link direto para `ollama.com/download`; válido para todos os perfis
- **Placeholder do modal "Criar Projeto"** — trocado de "Nome do projeto" para "Canal do Youtube" (pt) / "YouTube channel" (en) / "Canal de YouTube" (es)
- **Botão "Criar projeto" no header** — removido "+" duplicado da string de tradução (já havia ícone SVG no botão)

### Docs
- `Jornada do Usuário.md` — mapa de perfis reescrito, narrativas atualizadas, tabela de funcionalidades reflete v0.5.1
- `Jornada do Usuário — Roteiro de Vídeo.md` — bloco 7 atualizado com aviso de Ollama; bloco 3 com modoFila; tabela final atualizada

---

## [0.5.0] — 2026-06-24

### Added
- **Fila de extração com UI completa** — adicionar canais à fila antes ou durante uma extração;
  gerenciador inline com remoção individual e limpeza total; card de extração atualiza automaticamente
  para o canal que assume a posição quando o atual termina ou é cancelado.
- **Sistema de projetos desacoplado do canal** — usuário nomeia o repositório independentemente do canal.
  Pasta `data/neural/{projeto}/` agrupa YouTube + documents + texts sob um nome escolhido.
  Um canal pode ser importado para qualquer projeto sem renomear pasta.
- **Modal "Criar Projeto" standalone** no header do Repositório — cria projeto antes de qualquer upload.
  Contrato documentado em código (`[CONTRATO CRÍTICO]`) e na documentação de dependências.
- **ExtractionModal refatorado para steps por string** (`'url' | 'projeto' | 'fontes'`).
  Modo fila: URL → Projeto (handle sugerido em tempo real ao digitar) → Fontes.
  Modo canal já configurado: começa em Projeto → Fontes (URL omitida).
- **CrossEncoder na Busca Ampla** — BM25 recupera top-12 → `ms-marco-MiniLM-L-6-v2` reordena
  semanticamente → top-6 vão ao prompt (+236ms medido vs. BM25 puro). Lazy load; degradação graciosa.
- **Sistema de perfis de usuário** com HomeScreen personalizada por perfil (Pesquisador, Estudante, Especialista).
  LandingScreen animada com seletor de idioma + tema antes do onboarding.
  `CircuitBackground` interativo (glow do mouse na HomeScreen) e passivo (landing).
- **i18n completo** em pt/en/es — todos os componentes, modais, toasts, personas, relatório e chat drawer.
- **Base Compartilhável** (`.tusab`) — exportar e importar base de conhecimento entre máquinas; readonly mode.
- **Histórico de conversas persistente** — salvar, listar e restaurar conversas anteriores.
- **Parser WhatsApp / Reuniões** — detecta e estrutura automaticamente exportações Android/iOS e
  transcrições Zoom/Otter/Teams antes de indexar (melhora recall BM25).
- **Personas de tom de voz** — Objetivo, Técnico, Didático, Descontraído, Socrático; injetadas no prompt.
- **Seletor multi-canal no chat** — chips de bases, busca ampla/restrita com toggle; `@mention` de canal.
- **Download de modelos Ollama via backend** com controle de acesso por perfil.
- **Auto-Update por canal** — aba com configuração de periodicidade real por canal.
- **Fila de mensagens no chat** (máx. 5 balões simultâneos) com export de arquivos pelo chat.
- **Anexo de arquivo direto no chat** com indexação automática.
- **Busca inline no Repositório** por projeto e arquivo.
- **Monitor de sistema** com ETA de extração e relatório de observabilidade.
- **PostHog analytics opt-in** — ConsentModal na primeira abertura; zero coleta sem consentimento.
- **Onboarding contextual** — dicas por feature em localStorage; ProgressToast após indexação.

### Changed
- **Upload de arquivo exige projeto existente** — botão bloqueado até `POST /neural/projeto` confirmar.
  Alias `"documentos"`/`"textos"` → `"documents"`/`"texts"` no DELETE mantido para backward-compat.
- **Indexação usa canal explícito do modal** — `req.canal_nome` tem prioridade sobre `state.stats.canal_nome`;
  fix de regressão onde a última extração sobrescrevia a seleção do usuário no modal de indexação.
- **Repositório carrega ao abrir a aba** (não só no mount) — `useEffect` em `activeTab`.
- **App.jsx modularizado** — extraídos 7+ componentes e 4 custom hooks; de ~2.500 → ~1.600 linhas.
- **Chunking de docs com overlap** — janelas de 2.000 chars com overlap de 200 chars; evita corte de ideias na borda.
- **Ollama com parâmetros de performance** — `num_ctx`/`num_predict`/`num_thread`; contexto reduzido para modelos locais.
- **Timeout Ollama** aumentado de 120s → 300s.
- Pastas internas renomeadas para inglês (`documents/`, `texts/`, `management/`); aliases de backward-compat mantidos.
- Subpastas por projeto sob `data/neural/{projeto}/` em vez de pasta plana.
- Branding definitivo: Brain'IAC → Sebayt → **Tusab** (nome final; slug `profissional` preservado para backward-compat localStorage).

### Fixed
- `canalConfigurado` não atualizava quando canal da fila assumia a extração.
- Repositório mostrava vazio mesmo com projetos no backend (estado inicial sem `canais: []`; sem refresh ao abrir aba).
- modoFila step Projeto herdava nome do canal em extração em vez do handle da URL digitada.
- `ExtractionModal` pulava step de URL em reloads — agora só pula se canal configurado na *sessão atual*.
- `createPortal` para modais standalone (fix `ReactDOM` default import quebra React 19).
- Drive: `credentials.json` e `token.json` movidos para `data/config/` (fora do bundle PyInstaller).
- Path traversal → fallback seguro para `index.html` (SPA routing).
- XSS via `dangerouslySetInnerHTML` removido.
- `RLock` no `state_lock` — `print()` dentro de região bloqueada reentrava no `LogRedirector` causando deadlock.
- Scroll interno em `ExtractionModal`, `AlterarPerfilModal` e `Onboarding`.
- Query expansion desativada para Ollama local (latência 15-25s → 3-8s).
- `sub_langs = 'pt'` fixo — tentativas duplas causavam rate limit 429 no YouTube.
- `skip=translated_subs` + sleep entre requests para eliminar 429 adicionais.

### Docs
- **Mapa de Impacto de Dependências** — documento formal com contratos críticos, regras de dependência
  e histórico de decisões técnicas não óbvias.
- **Blueprint de Modularização** — guia de referência da arquitetura do frontend.
- **CLAUDE.md** expandido — semântica de módulos, onde encontrar o quê, decisões técnicas não óbvias.
- Smoke tests expandidos (15 checks) com hook pre-commit obrigatório.
- Workflow de release GitHub Actions (`.github/workflows/release.yml`) — CI + build Windows + publicação.

---

## [0.4.3] — 2026-06-05
### Added
- **Seletor de modelos Ollama** em "Configurações Avançadas" na aba Configurar Agente
  Painel colapsável (ícone engrenagem) lista todos os modelos instalados via Ollama.
  Seleção persiste em agent_config.json e é aplicada imediatamente no chat.
  Compatível com qualquer modelo Ollama — incluindo Gemma 4 12B (gemma3:12b).
  Padrão mantido: llama3.2:1b (funciona com 4GB RAM).

### Docs
- Posicionamento: PKM como categoria de mercado, Mentor Digital como conceito
- Análise competitiva frente ao NotebookLM documentada na Proposta de valor
- Análise de convergência com Gemma 4 12B (Google) na Avaliação Estratégica
- Botão "Exportar base" descartado — Drive já cobre backup e compartilhamento
- Roadmap: AI Edge Eloquent (Fase 3) e LiteRT-LM CLI (Fase 4) mapeados

---

## [0.4.2] — 2026-06-06
### Added
- **Posthog analytics opt-in** — ConsentModal na primeira abertura
  Aceitar/Recusar persiste em localStorage. Zero coleta sem consentimento.
  services/analytics.js com 10 eventos nomeados (appOpened, canalConfigurado,
  baseIndexada, chatPergunta, repositorioAcessado, etc.)
- **Onboarding contextual** — dicas no momento certo, não em modal de entrada
  hooks/useOnboarding.js gerencia flags por feature em localStorage
  ProgressToast após indexação: "N chunks prontos! → Abrir chat"
  Hint na primeira visita à aba Repositório
- **Toggle busca ampla/restrita** no chat com tooltip descritivo ao hover
  Restrita: só base indexada | Ampla: base + conhecimento do modelo
- **Badge "N novos"** no header da Base de Conhecimento quando desatualizada
  Detecta .txt mais novos que o índice via mtime, pisca em âmbar
- **Base de conhecimento embutida** (scripts/create_help_base.py)
  13.671 chars cobrindo: o que é, como usar, capacidades, limitações,
  teoria (RAG, BM25, Ollama, Groq, yt-dlp), FAQ, glossário técnico
  Criada automaticamente na primeira execução se não existir

### Fixed
- Query expansion desabilitada para Ollama local — latência 15-25s → 3-8s
- Chunks reduzidos de 6→4 para Ollama (contexto menor = resposta mais rápida)
- Brain'IAC_crash.log adicionado ao .gitignore (segurança)
- IndentationError no chat_stream após refactor do n_chunks

### Docs
- Avaliação Estratégica.txt criada com análise sob 6 perspectivas
  (Arquiteto, PM, UX, Segurança, Negócio, SRE) + matriz de prioridades
- Posthog, busca web e onboarding contextual documentados em Próximos passos
- Clareza de posicionamento: Brain'IAC não compete com IA generativa,
  são produtos complementares com jobs to be done distintos
- Arquitetura narrativa em 3 camadas documentada na Proposta de valor

---

## [0.4.1] — 2026-06-06
### Changed
- **Modularização completa do frontend** — App.jsx de 2.495 → 1.279 linhas
  - `constants/index.js` — API_BASE, LANGS, BTN_FOCUS centralizados
  - `services/api.js` — 24 funções de API nomeadas (axios/fetch)
  - `hooks/useStatus.js` — polling /status isolado em custom hook
  - `hooks/useAgentStatus.js` — polling /agent/status isolado
  - `components/shared/` — GuideModal, Onboarding, StatCard, LogLine
  - `components/extraction/` — ExtractionModal, PostExtractionModal
  - `components/agent/` — OllamaSetup, RepositorioTab, RelatorioTab
  - `components/home/` — HomeScreen
  - `components/chat/` — ChatDrawer
  - `components/sidebar/` — SidebarContent

### Added
- Padrão de comentários DevOps em todos os arquivos:
  - `@file`, `@description`, `@module`, `@author`, `@copyright`
  - `@param`, `@returns` em componentes e hooks
  - Seções marcadas com `// ─── Nome ───`
  - Handlers documentados com JSDoc inline
- Home screen com layout de duas colunas (logo esquerda, cards direita)
- Sidebar recolhível com toggle `‹ / ›`
- Sidebar oculta na home screen
- Seletor de idioma e tema na home screen
- Logo clicável retorna à home em qualquer aba

---

## [0.4.0] — 2026-06-05
### Added
- **Home screen** com 4 cards interativos (Extrair / Repositório / Relatório / Configurar Agente) — mostrada a cada entrada, com badges de contagem real
- **Aba Repositório** — browser de arquivos da base: YouTube extraídos, documentos e textos do usuário; botão "Adicionar" para upload (PDF/DOCX/TXT/MD) ou colar texto; botão deletar por item
- **Aba Relatório** — select de canal, cards de stats (total, extraídos, cobertura %), tabela de vídeos filtrável por status
- **Base de conhecimento expandida** — nova estrutura `data/cerebro/youtube/`, `data/cerebro/documentos/`, `data/cerebro/textos/`; BM25 lê de todas as fontes na indexação
- **Endpoints novos**: `GET /repositorio`, `GET /relatorio/{canal}`, `POST /cerebro/upload`, `POST /cerebro/texto`, `DELETE /cerebro/arquivo/{tipo}/{id}`
- **Groq como provedor** — modelos llama-3.1-8b e llama-3.1-70b gratuitos; seletor simplificado (Rápido / Máxima qualidade)
- **Chat flutuante** — drawer lateral (420px desktop, full-screen mobile) acessível de qualquer aba
- Guia "Como usar" atualizado com 6 passos refletindo o novo fluxo
- Canal do relatório com feedback visual ao selecionar

### Changed
- 4 abas: Extração · Repositório · Relatório · Configurar Agente (era Extração · Agente IA)
- `cerebro_txt/` migrado automaticamente para `cerebro/youtube/` na inicialização
- Chat removido da aba Configurar Agente — acessível via botão flutuante
- Chat vinculado ao canal configurado no sidebar (não mais ao último indexado)

### Fixed
- `NaN` do pandas causando 500 no endpoint `/relatorio/{canal}`
- `python-multipart` ausente bloqueando upload de arquivos
- Duplicate `function App()` causando build quebrado
- Fontes do chat aparecem após a resposta (não antes)
- Select com ícone muito próximo da borda (adicionado `pr-8`)

### Packages
- `pdfplumber` — extração de texto de PDFs
- `python-docx` — extração de texto de DOCX
- `python-multipart` — upload de arquivos via FastAPI

---

## [0.3.2] — 2026-06-05
### Fixed
- **Causa raiz do bloqueio de indexação**: verificação de chave de API estava no endpoint `/agent/index` em `api_Brain'IAC.py`, não só em `agent_Brain'IAC.py`. Indexação BM25 é 100% local e nunca requer chave.
- Ollama status polling movido para o componente pai — antes dependia do accordion estar aberto; se fechado, `ollamaStatus` ficava `{running: false}` e warnings apareciam incorretamente
- Bug de build: useEffect de polling inserido com URL quebrada (`` `/agent/ollama/status` `` sem `${API_BASE}`), causando falha silenciosa de build e dist desatualizado
- "canalis" → "canais" (pluralização incorreta em português)
- Botão "Usar" no histórico agora confirma o canal automaticamente via API, sem precisar clicar no sidebar

### Added
- Auto-update do yt-dlp via GitHub API no startup do Electron (feature branch mergeada)
- Versionamento semântico formal com tags git retroativas (v0.1.0 → v0.3.1)
- Branch `develop` para integração contínua
- `CHANGELOG.md` com histórico completo

### Changed
- Contraste WCAG melhorado: textos secundários de `slate-400/500` para `slate-500/600` (light) e `slate-300` (dark), atingindo requisito AA 4.5:1

### Docs
- Pasta renomeada de "Objetivos e Estrutura" para "Documentação do Produto"
- Novo arquivo: `Proposta de valor.txt` com pitch de um parágrafo
- Novo arquivo: `Modelo de negócio.txt` — ISV Freemium + Perpetual Seat License
- `O meu porquê.txt` reescrito com origin story real (AUVP/Raul Sena)
- `Os meus alvos.txt` reorganizado em 3 camadas (B2C / B2B Creator / Enterprise)
- `Próximos passos.txt` atualizado com análise estratégica e decisões tomadas
- Sistema de licença via Lemon Squeezy

---

## [0.3.1] — 2026-06-02
### Fixed
- Status "Interrompido" agora auto-reseta para "Ocioso" após 15s
- Indexação BM25 não exige mais chave de API (era local desde sempre)
- `configured: true` retornado quando Ollama disponível sem config salvo
- Chave de API não pré-carregada no campo ao abrir o app

### Added
- Notificação nativa do OS ao concluir extração
- Histórico de canais extraídos na aba Extração (lê CSVs de gestão)
- Endpoint `GET /history` com resumo por canal
- Ollama como provedor padrão sem necessidade de configuração
- Toggle "Usar minha chave de API" para provedores externos
- Botão "Limpar" para remover chave salva do disco

### Docs
- Porquê, alvos e proposta de valor refinados com origin story real (AUVP)
- Análise estratégica de gargalos: usuário, PO, CEO, investidor
- Próximos passos atualizados com decisões tomadas

---

## [0.3.0] — 2026-05-29
### Added
- Agente RAG local com BM25 (rank_bm25) — sem embeddings, sem API externa
- Indexação instantânea em JSON local, cache em memória
- Query expansion: LLM gera variações da pergunta, scores combinados
- Streaming de respostas via ReadableStream com cursor piscante
- Histórico de conversa (últimas 6 trocas no contexto do LLM)
- Multi-canal: indexar e buscar em N canais simultaneamente
- Ollama (llama3.2:1b) como provedor padrão gratuito e offline
- Provedores externos opcionais: Gemini, OpenAI, Anthropic (BYOK)
- Electron 34 com Python embeddable bundled
- Auto-update via electron-updater + GitHub Releases
- Ollama baixado automaticamente na primeira execução (Win/macOS/Linux)
- Detecção de OS para download correto do instalador Ollama
- Loading screen com status em tempo real durante setup
- Coleta de hashtags e descrições dos vídeos via yt-dlp
- Metadados do canal (nome, handle, inscritos) salvos em JSON
- Cabeçalho de atribuição ao criador em cada arquivo .txt
- Internacionalização PT/EN/ES com react-i18next
- Tema automático via prefers-color-scheme com persistência
- Accordions animados na aba Agente
- Card de canal com metadados na aba Agente
- NSIS installer com license.txt informando downloads adicionais
- Copyright © 2026 CriAugu em todos os arquivos principais

### Changed
- ChromaDB e embeddings substituídos por BM25 local
- Sub-langs fixo 'pt' (elimina 429 por detecção dinâmica)
- yt-dlp: dois subprocessos separados (fix bug simulação 2026)
- Dados em `%AppData%\Brain'IAC\data\` (separado do diretório do app)

### Fixed
- 429 rate limit por --list-subs retornando 60+ idiomas
- google-genai SDK incompatível com text-embedding-004
- Botão "Configurado" aparecia antes de chave ser inserida

---

## [0.2.0] — 2026-05-01
### Added
- Interface web React 19 + Vite + Tailwind CSS 3
- FastAPI backend (localhost:8001)
- Google Drive sync opcional (OAuth2, escopo drive)
- Seletor de tipos de conteúdo (vídeos/shorts/lives/podcasts/cursos/playlists)
- Delta inteligente — não reextrai vídeos já processados
- Log em tempo real
- Barra de progresso com percentual
- Internacionalização básica

---

## [0.1.0] — 2025-12-01
### Added
- Extração básica de legendas via yt-dlp
- Interface CustomTkinter (desktop GUI)
- Upload para Google Drive
- Chunking em partes (MAX_WORDS_PER_FILE)
- CSV de gestão de metadados
- Suporte inicial ao canal @InvestidorSardinha (AUVP)
