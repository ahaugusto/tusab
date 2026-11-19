---
id: perfis-e-jornadas
title: Perfis
sidebar_label: Perfis
slug: /perfis-e-jornadas
---

# Perfis

A [tela do Tusab](/tela) tem quatro perfis: **Estudante**, **Professor**, **Pesquisador** e **Especialista**. O perfil é escolhido no onboarding e pode ser trocado a qualquer momento no cabeçalho. Ele define quais abas aparecem; não muda o índice, o formato dos dados nem a privacidade.

As [ferramentas MCP](/ferramentas-mcp) **não dependem de perfil**: a IA tem acesso às mesmas 15 ferramentas em qualquer caso.

A configuração fica em `web_interface/src/hooks/usePerfil.js` (`PERFIS_CONFIG`, com os ajustes do modo extensão no mesmo arquivo).

## O que cada perfil mostra na tela

| Recurso | Estudante | Professor | Pesquisador | Especialista |
|---|:---:|:---:|:---:|:---:|
| Repositório (ver, enviar, excluir, limpar) | ✅ | ✅ | ✅ | ✅ |
| Importar / exportar `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Relatório por canal | ✅ | ✅ | ✅ | ✅ |
| Biblioteca de Prompts | ✅ | ✅ | ✅ | ✅ |
| Admin e reset total | ✅ | ✅ | ✅ | ✅ |
| Extração do YouTube e fila | — | ✅ | ✅ | ✅ |
| [Fontes públicas](/funcionalidades/fontes-publicas) | — | ✅ | ✅ | ✅ |
| Visão Geral | — | ✅ | ✅ | ✅ |
| Monitor do sistema | — | — | — | ✅ |

A permissão de excluir ou limpar arquivos não depende do perfil: ela é controlada por projeto (marca de somente leitura, consultada em `GET /export/readonly-status`).

Na Biblioteca de Prompts, cada prompt pronto indica os perfis a que se destina (por exemplo, Prova e Plano de aula para Professor; Revisão do material e Lacunas para Pesquisador).

## No app desktop

O app desktop, descontinuado, usava os mesmos perfis, com abas a mais que não existem na extensão: **Assistente** (chat), **Histórico** de conversas e a aba **Estudo** (no lugar da Biblioteca de Prompts), além de configuração de provedor de IA, Busca Ampla e Google Drive para todos os perfis. Cada perfil tem uma persona padrão no Assistente: Didático (Estudante e Professor), Técnico (Pesquisador) e Objetivo (Especialista). No desktop, o Especialista também podia ocultar o cartão de Modo Estudo da tela inicial.

:::info Slug interno do Especialista
Internamente o slug do perfil Especialista é `profissional`, mantido por compatibilidade com dados já gravados (`localStorage`). O rótulo na interface é "Especialista".
:::
