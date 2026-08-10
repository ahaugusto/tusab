---
id: mcp-server
title: MCP Server
sidebar_label: MCP Server
slug: /funcionalidades/mcp-server
---

# MCP Server

O Tusab expõe sua base de conhecimento indexada para qualquer cliente compatível com [Model Context Protocol](https://modelcontextprotocol.io) — Claude Code, Cursor, ou qualquer editor/agente que suporte MCP.

Na prática: você consulta suas próprias fontes (vídeos, documentos, anotações) sem sair da ferramenta onde já está trabalhando.

## Como conectar

1. Abra a aba **Admin** no Tusab
2. Clique em **"Copiar configuração MCP"**
3. Cole a configuração no cliente MCP de sua escolha (Claude Code, Cursor etc.)

O endpoint correspondente no backend é `GET /agent/mcp/config`.

## O que fica disponível ao cliente MCP

Qualquer conteúdo indexado no projeto — incluindo transcrições do YouTube, documentos, textos e os artefatos gerados pelo [Modo Estudo](/funcionalidades/modo-estudo), já que eles também entram no índice BM25.
