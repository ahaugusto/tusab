---
id: changelog
title: Changelog
sidebar_label: Changelog
slug: /changelog
---

# Changelog

Resumo técnico das versões. A partir da 2.0.0 o Tusab é só a extensão de IA; a numeração continua a do produto (o app desktop parou na 1.0.64). O histórico completo do desktop, no formato [Keep a Changelog](https://keepachangelog.com), está em [`CHANGELOG.md`](https://github.com/criaugu/tusab/blob/main/CHANGELOG.md).

## Extensão (`tusab-mcp/`)

**v2.0.0 (2026-11-19)** — O Tusab passa a ser só a extensão de IA; o app desktop é descontinuado.

- Primeira versão da extensão publicada nas [releases](https://github.com/criaugu/tusab/releases) como `tusab-2.0.0.mcpb`, com soma SHA-256 ao lado. A release é gerada pelo GitHub Actions a partir da etiqueta: testes, tela compilada, avisos de licença e pacote.
- Ícone quadrado no pacote (versões para tema claro e escuro), feito a partir do logo.
- Aba **Materiais**: o que a IA guarda no Tusab abre numa janela da tela (flashcards com revisão espaçada, resumos, post-its e documentos). Novo tipo `documento` em `tusab_salvar_estudo` (Markdown, até 60.000 caracteres), e os prompts que produzem documentos (quiz, mapa mental, plano de aula, prova, nota técnica…) pedem para guardá-los.
- Conexão com a IA: todo prompt começa com uma checagem (sem as ferramentas do Tusab, a IA avisa em vez de responder de memória), e o aviso de "copiado" mostra se o Tusab está conectado e confirma quando a IA consultou a base (`GET /api/conexao`).
- Correções na tela: no tema escuro, a lista aberta dos selects era branca com texto branco (agora os controles nativos seguem o tema); seta dos selects com espaço fixo da borda.
- Uma só fonte para o número da versão: `tusab-mcp/package.json`. O servidor e a tela leem dali; um teste confere que o `manifest.json` bate.
- Descrições da extensão (pt, en, es) sem referência ao app desktop.
- App desktop descontinuado: o código (Electron, motor Python, testes e automações do instalador) saiu do repositório e está preservado na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final). As releases 1.0.x continuam publicadas como histórico, sem novas correções.
- CI testa a extensão no Windows, no macOS e no Linux e audita a acessibilidade da tela servida pelo plugin (pa11y-ci, tema claro e escuro).

**v0.6.0 (2026-11-18)** — Primeira versão da extensão no repositório (não publicada como pacote).

- Servidor MCP por stdio com 15 ferramentas: busca com citação (`tusab_buscar`), leitura de fonte e de original, extração do YouTube, arquivos de texto, fontes públicas, memória de estudo e revisão espaçada, novidades da semana, economia de tokens, status e abertura da tela.
- Tela do Tusab servida em `127.0.0.1` com chave por sessão, `Host` e `Origin` conferidos, sem CORS e com CSP `'self'`: a interface do app desktop compilada em modo extensão.
- Motor de extração do YouTube em Node, com o mesmo formato em disco do app desktop; yt-dlp oficial baixado com conferência SHA-256; atualização automática de canais a cada hora.
- Documentos (PDF com marca de página, DOCX, XLSX, CSV, TXT/MD, FHIR, página web), originais guardados com conferência de tipo pela assinatura, imagens enviadas à IA sem EXIF/GPS.
- Exportações (zip, XLSX, PDF) e `.tusab` compatível com o desktop nos dois sentidos, com originais opcionais.
- 70 fontes públicas em 11 áreas, o mesmo registro do desktop.
- Biblioteca de Prompts: 21 prompts em 6 categorias, regras fixas de busca e citação, "Meus prompts" com pastas.
- Três idiomas (pt, en, es) na tela, nas mensagens do plugin, nos títulos das ferramentas e nos atalhos do "+".
- Economia de tokens estimada localmente, com teste por linha de comando (`medir-tokens`).
- Pacote `.mcpb` com `LICENSE`, `TRADEMARK.md` e `THIRD_PARTY_NOTICES.txt`.

## App desktop (descontinuado em 19/11/2026)

**v1.0.64 (2026-10-27)** — Telemetria opcional volta a ser gravada: o ID do Clarity apontava para um projeto do tipo aplicativo móvel; agora usa um projeto do tipo Site, com mascaramento rígido.

**v1.0.63 (2026-10-27)** — Telemetria opcional passa do PostHog para o Microsoft Clarity. Continua opt-in, com o conteúdo da tela mascarado no computador; quem tinha aceitado é consultado de novo.

**v1.0.62 (2026-10-27)** — Correção de rolagem no chat expandido; Electron 44.9.3 e dependências atualizadas.

**v1.0.61 (2026-10-21)** — De 26 para 70 fontes públicas, em 11 áreas: jurisprudência (STF, TCU, TST), Senado e Câmara, saúde (OPAS, OMS, Fiocruz, ANVISA), Banco Mundial, NASA, Hugging Face e outras. Novas áreas **Educação** (teses e material didático) e **Dados abertos** (cerca de 40 portais de governo do Brasil e do exterior). Professor e Especialista passam a buscar em fontes públicas. A busca aceita várias fontes de uma vez, com filtros por região, tipo de conteúdo e instituição. Tabelas no chat ficam mais legíveis e podem ser baixadas como planilha (.xlsx) ou copiadas como CSV.

**v1.0.60 (2026-10-20)** — Instalador e app mais leves: cerca de 240 MB a menos no disco e instalador do Windows cerca de 50 MB menor. Gemini passa a usar o SDK oficial atual do Google, com a mesma chave. No Windows, o instalador passa a limitar o comprimento do caminho da pasta escolhida, porque caminhos longos travavam a atualização automática.

**v1.0.59 (2026-10-20)** — Base do aplicativo atualizada para o Electron 44, com as correções de segurança acumuladas do Chromium e do Node.js. Nada muda no uso: bases, conversas e chaves de API continuam onde estavam.

**v1.0.58 (2026-10-18)** — O instalador para Windows volta a incluir o motor do app: as versões 1.0.42 a 1.0.57 saíram sem o Python embutido, e o app não funcionava no Windows. O instalador do macOS fica menor, sem a stack de reordenação semântica, que já não fazia parte da versão padrão no Windows. Correções de segurança em componentes da atualização automática e da telemetria opcional.

**v1.0.57 (2026-09-28)** — Proteção contra instruções escondidas em documentos indexados (prompt injection indireto): conteúdo malicioso num vídeo, PDF ou texto não é mais obedecido como comando pelo assistente; quando a resposta parece ter sido influenciada mesmo assim, um aviso aparece no chat. Dependências atualizadas, incluindo React e axios (com correção de segurança).

**v1.0.56 (2026-09-02)** — Correção da auditoria automatizada de acessibilidade no CI, que estava falhando desde a v1.0.55.

**v1.0.55 (2026-08-30)** — OpenRouter como novo provedor de chat gratuito; armazenamento do índice de busca migrado para LanceDB (ranqueamento continua BM25, sem mudança perceptível na qualidade das respostas); Especialista pode ocultar o card de Estudo na tela inicial; tabelas e listas do assistente não aparecem mais coladas na tela; melhorias de contraste e foco de teclado.

**v1.0.54 (2026-08-22)** — 👎 no chat agora tem efeito real: acumula um contador por projeto que amplia a busca em vez de só descartar a resposta.

**v1.0.53 (2026-08-14)** — Atalhos de teclado com `⌘` (Cmd) no macOS; modal de flashcard salvo abre a experiência de revisão completa (virar carta, avaliar); fix de busca do chat que ignorava o termo real da pergunta em bases com muito texto formal; barra de progresso de indexação granular por arquivo com cancelamento funcional; correções de chat expandido, checkbox e i18n.

**v1.0.52 (2026-08-14)** — Roteamento de intenção no chat: perguntas sobre a própria base ("quantos vídeos tem essa base?", "quando foi indexada?") respondem com dado real do disco, sem chamada de LLM; perguntas de cálculo puro ("quanto é 15+27?") são resolvidas por um avaliador aritmético seguro, sem LLM nem busca; retry automático em Busca Ampla antes de mostrar "não encontrei". Atalhos de teclado para macOS documentados na Ajuda.

**v1.0.51 (2026-08-12)** — Capítulos de vídeo do YouTube maiores que 3000 caracteres eram truncados no índice de busca e na citação do chat; agora são divididos em múltiplas partes, com continuidade preservada.

**v1.0.50 (2026-08-10)** — Fábrica única de cliente LLM no chat (corrige um drift real na lista de fallback do Gemini); reset total disponível para todos os perfis, não só Especialista.

**v1.0.49 (2026-08-10)** — Busca vetorial (embeddings via Ollama `nomic-embed-text`) como complemento ao BM25+FTS5+CrossEncoder no chat, ativa em Busca Ampla com download opcional de 1 clique.

**v1.0.46–47 (2026-08-07/09)** — Correções de release (corrida entre os builds Windows e macOS) e tradução completa da Visão Geral.

**v1.0.44–45 (2026-08-07)** — Player de áudio real e persistido para resumos do Modo Estudo, correções de scroll horizontal indevido no menu lateral.

**v1.0.42–43 (2026-08-06/07)** — Modo Estudo completo (flashcards com SM-2, resumos, post-its), seleção de playlists e filtro de data na extração, suporte a modelos Ollama com raciocínio nativo (thinking), renomeação de "Agente" para "Assistente" em toda a interface.

**v1.0.41 (2026-07-31)** — Instalador para macOS (Apple Silicon), busca em fontes públicas por área de conhecimento (arXiv, OpenAlex, FHIR e outras), leitor de página web avulsa, código publicado sob a Elastic License 2.0.

**v1.0.38–40 (2026-07-24/27)** — Reconhecimento automático de documentos jurídicos, confiança graduada por sentença no chat, exposição do MCP Server na interface.

Para o detalhe completo, incluindo correções internas de CI e infraestrutura, consulte o [CHANGELOG.md](https://github.com/criaugu/tusab/blob/main/CHANGELOG.md).
