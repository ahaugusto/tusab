---
id: originais-e-imagens
title: Originais e imagens
sidebar_label: Originais e imagens
slug: /funcionalidades/originais-e-imagens
---

# Originais e imagens

Todo arquivo enviado pela tela fica guardado **como veio**, ao lado do texto extraído. O texto é o que entra no índice (barato em tokens); o original fica no computador e a IA só o abre quando o texto não basta, com `tusab_ler_original`.

## Onde ficam

```
data/neural/{projeto}/documents/originais/{id}_{nome}{ext}
```

- `id` tem 8 caracteres hexadecimais; `nome` é o nome do arquivo limpo (só letras, números, `_` e `-`, até 40 caracteres).
- O caminho do original **nunca é lido do manifesto**: é sempre recalculado por essa convenção e conferido para ficar dentro da pasta do projeto.
- O mesmo arquivo enviado duas vezes é recusado (comparação por SHA-256).
- Excluir um documento ou limpar os documentos de um projeto apaga também os originais.
- O Tusab nunca abre o original com o programa padrão do sistema.
- O Repositório mostra o espaço ocupado por projeto (originais × texto) e marca como **Só texto** os documentos sem original (por exemplo, documentos criados pelo app desktop, importados de um `.tusab` sem originais ou vindos de fontes públicas).

## Tipos aceitos

Lista fechada, conferida pela **extensão do nome e pela assinatura do arquivo** (primeiros bytes):

| Categoria | Extensões |
|---|---|
| Documento | `.pdf`, `.docx`, `.xlsx` |
| Texto | `.csv`, `.txt`, `.md`, `.json` (FHIR) |
| Imagem | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |
| Áudio | `.mp3`, `.wav`, `.ogg`, `.opus`, `.flac`, `.m4a`, `.aac` |

SVG, HTML e executáveis são recusados. Imagens e áudios são **guardados sem leitura**: o Tusab não faz OCR nem transcrição (o [app desktop](/desktop/visao-geral), descontinuado, fazia, com modelos locais). Limite de envio: 50 MB por arquivo.

## `tusab_ler_original`

Recebe o `fonte_id` de um documento (devolvido por `tusab_buscar`).

| Tipo do original | O que volta para a IA |
|---|---|
| Imagem (PNG, JPEG, GIF, WebP) até 3 MB | A imagem, **sem metadados** (abaixo) |
| Imagem acima de 3 MB | Aviso para o usuário anexar a imagem na conversa |
| PDF | O texto das páginas pedidas (`paginas`: `"3"` ou `"2-4"`; padrão página 1; no máximo 10 páginas por chamada). Se as páginas não tiverem texto selecionável (PDF digitalizado), um aviso para o usuário anexar o PDF |
| Áudio e demais tipos | Não são enviados inteiros; a ferramenta indica `tusab_ler_fonte` para o texto |

Vídeos do YouTube e documentos vindos de fontes públicas não têm original guardado; para eles, `tusab_ler_original` devolve um erro que aponta `tusab_ler_fonte`. O cabeçalho da resposta mostra o caminho **relativo** ao repositório, sem expor a pasta do usuário.

## Imagens sem metadados (EXIF/GPS)

Antes de uma imagem ir para a IA, a função `semMetadados` (`src/nucleo/originais.js`) remove EXIF, XMP, comentários e textos embutidos, inclusive a localização (GPS):

- JPEG, PNG e WebP: os blocos de metadados são retirados;
- GIF: enviado como está.

**Falha fechada:** se a estrutura do arquivo não for reconhecida e a limpeza não puder ser garantida, a imagem **não é enviada**, e a IA recebe um aviso para pedir ao usuário que anexe a imagem na conversa, se quiser. O arquivo guardado no computador não é alterado.

## Exportar e importar `.tusab`

- Os originais só vão no `.tusab` por escolha explícita: ao exportar um projeto que tem originais, a tela pergunta se devem ir junto (com aviso sobre dados pessoais, autoria e localização em fotos). Sem marcar, vai só o texto.
- Ao importar, originais de tipo proibido ou com assinatura que não confere são descartados.
