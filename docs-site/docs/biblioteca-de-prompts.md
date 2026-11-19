---
id: biblioteca-de-prompts
title: Biblioteca de Prompts
sidebar_label: Biblioteca de Prompts
slug: /biblioteca-de-prompts
---

# Biblioteca de Prompts

O Tusab não gera flashcards, quizzes ou resumos: quem gera é a IA do usuário. O Tusab entrega o **pedido pronto**, já amarrado à base (buscar no projeto, citar a fonte, não inventar), e **guarda** o que precisa de memória entre conversas (flashcards e revisão espaçada).

Uma única lista (`tusab-mcp/src/nucleo/prompts.js`) alimenta dois lugares:

- o **menu "+" do Claude Desktop** (prompts MCP), onde o usuário escolhe o prompt, informa projeto e, quando houver, tema e quantidade;
- a aba **Biblioteca de Prompts** da [tela do Tusab](/tela) (`GET /api/prompts`), para copiar e colar em qualquer IA.

## Os 21 prompts prontos

| Categoria | Prompts | Campos |
|---|---|---|
| **Estudar** | Flashcards · Revisar hoje · Quiz de múltipla escolha · Resumo de estudo · Mapa mental (Mermaid) · Explicar de forma simples · Plano de estudo | projeto; tema e quantidade conforme o prompt |
| **Ensinar** | Prova com gabarito · Plano de aula · Lista de exercícios por nível | projeto, tema; quantidade na prova e nos exercícios |
| **Pesquisar** | Revisão do material · Comparar fontes e contradições · Lacunas da base · Ficha de leitura por fonte · Linha do tempo · Citações-chave | projeto, tema; quantidade nas citações |
| **Decidir** | Resposta verificável · Nota técnica | projeto, tema |
| **Criar conteúdo** | Roteiro de vídeo · Post para LinkedIn | projeto, tema |
| **Acompanhar** | Digest da semana | projeto |

Quantidades padrão: 8 no quiz, 7 dias no plano de estudo, 10 na prova e nas citações, 9 nos exercícios. O valor informado fica entre 1 e 50. O tema é cortado em 200 caracteres e o nome do projeto em 120.

Além deles, o atalho `abrir_tusab` ("Abrir o Tusab") abre a tela. No "+" do Claude aparecem, portanto, **22 atalhos**.

## Regras fixas acrescentadas pelo plugin

Ao montar o texto final, o plugin acrescenta ao pedido as regras de busca e citação, no idioma da tela:

> Pesquise a base do Tusab no projeto "\{projeto\}" com tusab_buscar (e tusab_ler_fonte quando precisar de contexto). Use só o que estiver nos trechos; se faltar informação, diga o que faltou. Cite cada afirmação com o título da fonte e, em vídeo, o minuto com o link (▶ MM:SS); em PDF, a página indicada no trecho ([Página N]) — se o trecho não indicar a página, não invente.

- As regras **não são editáveis** e valem também para os prompts criados pelo usuário.
- Duas exceções: **Revisar hoje** e **Digest da semana** já dizem no próprio pedido quais ferramentas usar (`tusab_revisao_hoje`/`tusab_registrar_revisao` e `tusab_novidades_semana`), então não recebem as regras.
- Flashcards e Resumo terminam pedindo que a IA grave o resultado com `tusab_salvar_estudo`.

## Meus prompts

O usuário cria prompts próprios na tela, do zero ou com "Duplicar e editar" a partir de um pronto.

- Guardados em `data/config/prompts_usuario.json`; limite de 50 prompts, título até 80 caracteres, descrição até 200, pedido até 4.000.
- Marcadores no texto do pedido:
  - `{tema_frase}` vira ` sobre "<tema>"` (ou nada, se o tema ficar vazio) e faz o campo **tema** aparecer;
  - `{quantidade}` vira o número informado (padrão 10) e faz o campo **quantidade** aparecer.
- **Pastas:** cada prompt pode ter uma pasta (até 40 caracteres). A pasta pode ser renomeada ou desfeita (os prompts continuam). No "+" do Claude, o título aparece como `Pasta › Título`.
- Criar, alterar ou excluir um prompt na tela atualiza o "+" do Claude **na hora, sem reiniciar** (o servidor avisa a ferramenta de IA que a lista de prompts mudou).

## Na tela

- Busca por nome, descrição, texto ou pasta, sem diferença de acento.
- Cada cartão tem **Copiar** e **Ajustar** (prévia editável). Se o navegador negar a cópia automática, a prévia abre para copiar à mão.
- **Aviso de copiado:** depois de copiar, um aviso oferece abrir o app do Claude (endereço `claude://`) ou uma IA no navegador (Claude.ai, ChatGPT ou Gemini; a escolha fica lembrada no navegador). O aviso lembra que, no navegador, a IA não acessa o Tusab deste computador: o pedido copiado funciona como texto, mas as ferramentas MCP só existem na ferramenta de IA onde a extensão está instalada.
- No Repositório, o botão **Pedir à IA** de cada projeto copia pedidos frequentes já preenchidos com o projeto, ou abre a Biblioteca nesse projeto.
- O botão **Economia de tokens** da Biblioteca abre a janela descrita em [Economia de tokens](/funcionalidades/economia-de-tokens).
