---
id: intro
title: O que é o Tusab
sidebar_label: Introdução
slug: /intro
---

# O que é o Tusab

O Tusab é uma **extensão para ferramentas de IA** (como o Claude Desktop) que mantém a base de conhecimento do usuário **no computador dele** e entrega à IA só os trechos certos, **com citação**: o vídeo e o minuto exato, ou a página do PDF.

Tecnicamente, é um servidor [MCP](https://modelcontextprotocol.io) local (`tusab-mcp/`, Node.js, versão 2.0.0). A ferramenta de IA inicia o processo no próprio computador; ele:

- **guarda e indexa** transcrições de vídeos do YouTube, documentos (PDF, Word, Excel, CSV, Markdown), textos e resultados de fontes públicas (artigos, teses, legislação, dados abertos) numa pasta local;
- **responde à IA** por [15 ferramentas MCP](/ferramentas-mcp): buscar, ler uma fonte em ordem, abrir o original de um documento, adicionar conteúdo, guardar material de estudo;
- **oferece pedidos prontos** na [Biblioteca de Prompts](/biblioteca-de-prompts) (41 prompts, 20 deles baseados em técnicas com evidência, no menu "+" do Claude e na tela);
- **serve uma tela** no navegador, em `http://127.0.0.1:<porta>`, para extrair canais, organizar o repositório e ver relatórios ([a tela do Tusab](/tela)).

Quem conversa, resume, monta quizzes e gera flashcards é **a IA do usuário**. O Tusab cuida da base: extrai, indexa, encontra o trecho, cita a fonte e guarda o que precisa de memória entre conversas (por exemplo, a revisão espaçada de flashcards).

## Princípio técnico: os dados ficam no computador

- A extração do YouTube roda no computador e no IP do usuário, com o [yt-dlp](https://github.com/yt-dlp/yt-dlp).
- Arquivos, transcrições e índice ficam numa pasta local escolhida na instalação.
- Só os **trechos consultados** vão para a IA que o usuário escolheu (a ferramenta de IA onde a extensão está instalada).
- **Nada passa por servidor da CriAugu.** Não há conta, login, telemetria nem sincronização em nuvem.

Quais conexões saem do computador, e para onde, está em [Privacidade](/privacidade) e [Segurança](/seguranca).

## App desktop

Antes da extensão, o Tusab era distribuído como app desktop (Electron + backend FastAPI), com chat próprio. O app foi **descontinuado em 19/11/2026**: o código está preservado na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), e as [releases 1.0.x](https://github.com/criaugu/tusab/releases) continuam publicadas como histórico, sem novas correções nem atualizações.

A extensão usa **a mesma estrutura de pastas** das bases criadas pelo app desktop: quem usava o desktop pode apontar a extensão para a pasta de dados dele, e um arquivo `.tusab` exportado pelo desktop é importado na extensão. A documentação do app fica na seção [App desktop](/desktop/visao-geral), como registro.

## Por onde seguir

- [Instalação](/instalacao): pacote `.mcpb` no Claude Desktop ou configuração MCP em outras ferramentas.
- [Ferramentas MCP](/ferramentas-mcp), [Biblioteca de Prompts](/biblioteca-de-prompts) e [Tela do Tusab](/tela): como a IA e o usuário usam a extensão.
- [Funcionalidades](/funcionalidades/extracao-youtube): extração, repositório, fontes públicas, estudo, originais, idiomas, economia de tokens.
- [Arquitetura técnica](/arquitetura/visao-geral) e [Desenvolvimento](/desenvolvimento/setup): para quem vai ler, rodar ou alterar o código.
