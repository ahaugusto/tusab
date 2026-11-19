---
id: estudo
title: Estudo e revisão espaçada
sidebar_label: Estudo e revisão espaçada
slug: /funcionalidades/estudo
---

# Estudo e revisão espaçada

Quem gera flashcards, post-its, resumos, quizzes e mapas mentais é **a IA do usuário**, a partir dos trechos da base e dos [prompts prontos](/biblioteca-de-prompts). O Tusab guarda o que precisa de memória entre conversas, porque a IA não lembra de uma conversa para outra: os flashcards e o estado da revisão espaçada. Código: `tusab-mcp/src/nucleo/estudo.js`.

## Fluxo

1. O usuário escolhe um prompt de estudo (por exemplo, **Flashcards** ou **Resumo de estudo**) no "+" do Claude ou copia da Biblioteca de Prompts.
2. A IA busca na base (`tusab_buscar`), gera o material citando as fontes e o guarda com `tusab_salvar_estudo`.
3. Em outra conversa, o prompt **Revisar hoje** faz a IA chamar `tusab_revisao_hoje`, mostrar uma pergunta por vez, comparar a resposta do usuário com a do card, dar uma nota de 0 a 5 e registrar com `tusab_registrar_revisao`, que devolve a próxima data.
4. O material guardado aparece na aba **Materiais** da tela, por projeto (a lista atualiza a cada 10 s e quando a janela volta ao foco). Cada item abre numa janela: flashcards com virar carta e avaliação da revisão espaçada, resumo e documento em Markdown (com tabelas), post-its. Dá para renomear, excluir, copiar e exportar em PDF.

## O que pode ser guardado

| Tipo | Conteúdo aceito por `tusab_salvar_estudo` |
|---|---|
| `flashcards` | 1 a 30 itens `{pergunta, resposta}`; pergunta até 500 caracteres, resposta até 2.000; perguntas repetidas no mesmo lote são recusadas |
| `postits` | 1 a 30 frases de até 400 caracteres |
| `resumo` | Texto em Markdown (até 30.000 caracteres) |
| `documento` | Texto em Markdown (até 60.000 caracteres): o que não é resumo, como quiz, mapa mental (bloco `mermaid`, mostrado como código), plano de aula, prova, nota técnica, roteiro. Fica só como material; não altera os arquivos de `management/` |

Opcionais: `tema` (até 200 caracteres), `titulo` (até 150) e `fontes` (até 50 títulos). O projeto precisa existir. Se a entrada for recusada, nada é gravado e a ferramenta devolve uma mensagem que a IA pode usar para corrigir e tentar de novo.

## Revisão espaçada

- Algoritmo **SM-2**, com o mesmo cálculo (inclusive o arredondamento) do app desktop.
- O ID de cada flashcard são os 12 primeiros caracteres hexadecimais do SHA-1 da pergunta.
- Cada card guarda repetições, intervalo em dias, fator de facilidade, última e próxima revisão.

## Digest da semana

O prompt **Digest da semana** pede à IA que veja o que entrou no projeto nos últimos 7 dias (`tusab_novidades_semana`), leia com `tusab_buscar`/`tusab_ler_fonte` e escreva de 3 a 5 tópicos com a fonte de cada um.

## Arquivos

```
data/neural/{projeto}/management/
  flashcards.json             último lote de flashcards
  postits.json                último lote de post-its
  resumo_estudo.md            último resumo
  flashcards_progresso.json   estado da revisão espaçada por card
data/neural/{projeto}/estudo/
  _manifest.json              lista dos artefatos (mais recente primeiro)
  estudo_{tipo}_{data}.txt    texto do artefato
  estudo_{tipo}_{data}.json   dados estruturados
```

O formato é o mesmo do [Modo Estudo do app desktop](/funcionalidades/modo-estudo): um projeto estudado num abre no outro.
