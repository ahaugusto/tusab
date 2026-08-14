---
id: changelog
title: Changelog
sidebar_label: Changelog
slug: /changelog
---

# Changelog

O histórico completo de todas as versões — formato [Keep a Changelog](https://keepachangelog.com), versionamento [semântico](https://semver.org) — vive em [`CHANGELOG.md`](https://github.com/ahaugusto/tusab/blob/main/CHANGELOG.md) no repositório principal. Esta página resume os marcos mais recentes.

## Destaques recentes

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
