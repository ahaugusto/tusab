---
id: economia-de-tokens
title: Economia de tokens
sidebar_label: Economia de tokens
slug: /funcionalidades/economia-de-tokens
---

# Economia de tokens

O Tusab mede quanto a IA recebeu do Tusab (só os trechos) em comparação com o que receberia se as fontes inteiras fossem anexadas na conversa. O código está em `tusab-mcp/src/nucleo/tokens.js`.

## Como a estimativa é feita

- **Estimativa local de ~4 caracteres por token** (`CARACTERES_POR_TOKEN = 4`). A contagem exata exigiria enviar o texto ao serviço da IA, o que o Tusab não faz. O número real varia com o modelo e o idioma.
- A cada chamada de `tusab_buscar`, `tusab_ler_fonte` e `tusab_ler_original` (páginas de PDF), o plugin soma:
  - **enviados:** tokens estimados da resposta que a ferramenta devolveu;
  - **sem o Tusab:** tokens estimados do texto completo das fontes de onde vieram os trechos.

## O que é guardado

Só números agregados, em `data/config/economia_tokens.json`: total de consultas, tokens enviados, tokens "sem o Tusab", subtotais por ferramenta e por dia (a contagem diária mantém os últimos 90 dias). **A pergunta e o texto nunca são gravados.** O contador pode ser zerado na tela.

## Onde ver

- Pela IA: ferramenta `tusab_economia`.
- Na tela: botão **Economia de tokens** na [Biblioteca de Prompts](/biblioteca-de-prompts), com a explicação do cálculo, o uso real acumulado e o teste com perguntas próprias.

## Teste com perguntas próprias

O teste "com e sem o Tusab" roda as perguntas do usuário contra um projeto, sem chamar nenhuma IA. Para cada pergunta, compara:

- tokens dos trechos que a IA receberia (até 8 trechos, como em `tusab_buscar`);
- tokens das fontes inteiras desses trechos (anexar só os arquivos certos);
- tokens do projeto inteiro (anexar tudo).

Na tela, as perguntas são escritas uma por linha (até 50). Pela linha de comando, em `tusab-mcp/`:

```powershell
$env:TUSAB_REPOSITORIO = "C:\caminho\do\repositorio"
node src/cli.js medir-tokens perguntas.txt <projeto> [saida.csv]
```

`perguntas.txt` tem uma pergunta por linha. O comando mostra uma tabela por pergunta, a economia total contra "fontes inteiras" e contra "projeto inteiro" e quantas perguntas ficaram sem resposta na base. Com `saida.csv`, grava as colunas `pergunta, trechos, tokens_tusab, tokens_fontes_inteiras, tokens_projeto_inteiro`.
