---
id: modo-estudo
title: Modo Estudo
sidebar_label: Modo Estudo
slug: /funcionalidades/modo-estudo
---

# Modo Estudo

Gera material de estudo a partir da sua própria base indexada — nada é inventado fora do que já foi ensinado ao Tusab.

## Artefatos disponíveis

| Artefato | O que gera |
|----------|-----------|
| **Flashcards** | Cartões de pergunta/resposta com repetição espaçada (algoritmo SM-2) |
| **Resumo** | Síntese estruturada do tema, com player de áudio (texto-to-speech local, cacheado após a primeira geração) |
| **Post-its** | Pontos-chave gerados por IA em formato curto |

Quiz e Tópicos foram avaliados e removidos do produto após testes de ponta a ponta — timeout em geração de Quiz e um bug de extração de PDF pré-existente (perda de espaçamento em texto com notação matemática) poluíam os resultados de Tópicos. Removidos de frontend e backend, não só ocultos da interface.

## Geração escopada por tema

A geração usa BM25 para restringir o material a um tema específico, combinável com seleção de itens específicos — vídeos ou documentos já indexados no projeto, com busca e marcação múltipla — em vez de sempre amostrar do projeto inteiro.

## Kanban de artefatos

Os artefatos gerados ficam persistidos e pesquisáveis num kanban por projeto. Como entram no índice BM25, também ficam disponíveis via [MCP Server](/funcionalidades/mcp-server). A listagem valida a existência real dos arquivos em disco antes de exibir — artefatos apagados por fora do app não aparecem como cards fantasmas.

## Onde fica

`neural/{projeto}/estudo/` — inclui os artefatos e o áudio cacheado dos resumos.
