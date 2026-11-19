---
id: dados-e-armazenamento
title: Dados e armazenamento
sidebar_label: Dados e armazenamento
slug: /arquitetura/dados-e-armazenamento
---

# Dados e armazenamento

## Onde os dados ficam

Tudo fica numa **raiz** que contém a pasta `data/`:

- a pasta escolhida na instalação (campo **Pasta do repositório** do Claude Desktop), passada ao servidor pela variável `TUSAB_REPOSITORIO`;
- sem a variável, `~/Tusab`.

Para abrir uma base criada pelo [app desktop](/desktop/visao-geral), escolha como pasta do repositório a pasta de dados dele: `%APPDATA%\Tusab` no Windows, `~/Library/Application Support/Tusab` no macOS (pasta `userData` do Electron), ou o valor de `TUSAB_DATA_DIR`, se definido.

## Estrutura em disco

```
data/
  neural/{projeto}/
    youtube/{canal}/{canal}_Parte_N.txt   transcrições em blocos (com minuto)
    youtube/{canal}/{canal}_meta.json     metadados do canal (cache de 7 dias)
    documents/{id}_{nome}.txt             texto extraído dos documentos + _manifest.json
    documents/originais/                  originais enviados, como vieram
    texts/                                textos colados/enviados + _manifest.json
    estudo/                               artefatos de estudo guardados pela IA
    management/                           {canal}_base.csv, {canal}_summary.json,
                                          flashcards.json, postits.json, resumo_estudo.md,
                                          flashcards_progresso.json, digest_AAAA-MM-DD.md
  config/
    extraction_queue.json                 fila de extração
    prompts_usuario.json                  "Meus prompts"
    idioma.json                           idioma escolhido na tela
    economia_tokens.json                  contador agregado de tokens
    auto_update.json                      última verificação de canais
    boas_vindas.json                      marca da primeira abertura da tela
  temp/                                   legendas VTT temporárias
  bin/                                    yt-dlp baixado pelo plugin
  tusab.sqlite                            índice de busca (reconstruível)
```

## Formato dos arquivos

- **Transcrições:** `{canal}_Parte_N.txt` (até 40 mil palavras por parte, UTF-8 com BOM). Cada bloco tem `TITULO`, `ABA`, `DATA`, `LINK`, `VIDEO_ID`, `VIEWS`, `TIMESTAMP_INICIO`, `[PARTE/TOTAL_PARTES]`, `TAGS`, `DESCRICAO` e `CONTEUDO`, separados por linhas de `=` e `-`.
- **CSV de gestão** (`{canal}_base.csv`): `ID, Data_Pub, Link, Titulo, Aba, Views, Local, Status, Data_Extracao`.
- **Resumo do canal** (`{canal}_summary.json`): total mapeado, URLs, último filtro usado e a configuração de atualização automática.
- **Documentos e textos:** `{id}_{nome}.txt` com cabeçalho `TITULO`/`FONTE`/`DATA` e entrada no `_manifest.json` da pasta.
- **Originais:** `documents/originais/{id}_{nome}{ext}` (ver [Originais e imagens](/funcionalidades/originais-e-imagens)).

Esses formatos são os mesmos do app desktop e ficam em português (rótulos e status), para os dois lerem a mesma pasta.

## Índice

- `data/tusab.sqlite`, com uma tabela virtual FTS5 (`unicode61 remove_diacritics 2`) e ordenação por `bm25()`.
- **Os `.txt` são a fonte da verdade.** O índice é reconstruível e é sincronizado por arquivo (data de modificação e tamanho): um trecho por bloco nas transcrições, por parágrafo nos documentos e textos.
- O banco é mantido em memória e gravado de forma atômica sob um arquivo de trava, porque mais de uma ferramenta de IA pode abrir o mesmo repositório.
- O app desktop tem índice próprio (`data/agent_index/`, LanceDB), que a extensão não usa.

## Nomes de projeto

Escolhidos pelo usuário e limpos antes de virar pasta: `[<>:"/\|?*\s]` vira `_` (mesma regra do desktop), pontos no início são removidos (`..` nunca vira nome de pasta) e o nome é limitado a 120 caracteres. Um canal pode ir para qualquer projeto.

## Escrita atômica

Arquivos são gravados num temporário (`{arquivo}.{pid}.{hora}.tmp`) e renomeados de uma vez. Se o processo parar no meio, o arquivo anterior continua íntegro.

## O que pode ser compartilhado

| Pasta | Compartilhar? |
|---|---|
| `neural/` | Sim, com atenção a dados pessoais nos próprios documentos e originais (fotos podem ter localização) |
| `tusab.sqlite` | Não precisa: é reconstruído a partir de `neural/` |
| `config/` | Não há segredos (a extensão não guarda chaves), mas é configuração local deste computador |

Para compartilhar um projeto, prefira o arquivo `.tusab` (ver [Repositório e documentos](/funcionalidades/repositorio-multi-fonte#exportar-e-importar)).

Diferenças do app desktop (chaves de API cifradas, tokens do Google Drive, migrações de estrutura antiga) estão em [App desktop](/desktop/visao-geral#dados-do-app-desktop).
