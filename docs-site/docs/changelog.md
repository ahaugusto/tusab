---
id: changelog
title: Changelog
sidebar_label: Changelog
slug: /changelog
---

# Changelog

O histórico completo de todas as versões — formato [Keep a Changelog](https://keepachangelog.com), versionamento [semântico](https://semver.org) — vive em [`CHANGELOG.md`](https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md) no repositório principal. Esta página resume os marcos mais recentes.

## Destaques recentes

**v1.0.61 (2026-10-21)** — De 26 para 70 fontes públicas, em 11 áreas: jurisprudência (STF, TCU, TST), Senado e Câmara, saúde (OPAS, OMS, Fiocruz, ANVISA), Banco Mundial, NASA, Hugging Face e outras. Novas áreas **Educação** (teses e material didático) e **Dados abertos** (cerca de 40 portais de governo do Brasil e do exterior). Professor e Especialista passam a buscar em fontes públicas. A busca aceita várias fontes de uma vez, com filtros por região, tipo de conteúdo e instituição. Tabelas no chat ficam mais legíveis e podem ser baixadas como planilha (.xlsx) ou copiadas como CSV.

**v1.0.60 (2026-10-20)** — Instalador e app mais leves: cerca de 240 MB a menos no disco e instalador do Windows cerca de 50 MB menor. Gemini passa a usar o SDK oficial atual do Google, com a mesma chave. No Windows, o instalador limita a pasta escolhida a 75 caracteres, porque caminhos mais longos travavam a atualização automática.

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

**v1.0.48 (2026-08-09)** — Tagline unificada para "Augment" em toda a arte do logo e textos, referenciando deliberadamente o conceito de Intelligence Augmentation de Douglas Engelbart.

**v1.0.46–47 (2026-08-07/09)** — Correções de release (corrida entre builders Windows/macOS), tradução completa da Visão Geral, logo e README renovados.

**v1.0.44–45 (2026-08-07)** — Player de áudio real e persistido para resumos do Modo Estudo, correções de scroll horizontal indevido no menu lateral.

**v1.0.42–43 (2026-08-06/07)** — Modo Estudo completo (flashcards com SM-2, resumos, post-its), seleção de playlists e filtro de data na extração, suporte a modelos Ollama com raciocínio nativo (thinking), renomeação de "Agente" para "Assistente" em toda a interface.

**v1.0.41 (2026-07-31)** — Instalador para macOS (Apple Silicon), busca em fontes públicas por área de conhecimento (arXiv, OpenAlex, FHIR e outras), leitor de página web avulsa, formalização como source-available (Elastic License 2.0).

**v1.0.38–40 (2026-07-24/27)** — Reconhecimento automático de documentos jurídicos, confiança graduada por sentença no chat, exposição do MCP Server na interface.

Para o detalhe completo — incluindo correções internas de CI/infra — consulte o [CHANGELOG.md completo](https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md).
