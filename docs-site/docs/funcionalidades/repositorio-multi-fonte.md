---
id: repositorio-multi-fonte
title: Repositório e documentos
sidebar_label: Repositório e documentos
slug: /funcionalidades/repositorio-multi-fonte
---

# Repositório e documentos

O Repositório guarda o conteúdo organizado por **projeto**, não por canal: um canal do YouTube pode ir para qualquer projeto, e um projeto pode misturar vídeos, documentos e textos. Código: `tusab-mcp/src/nucleo/documentos.js`, `repositorio.js`, `originais.js` e `exportar.js`.

## Como adicionar conteúdo

| Origem | Pela tela | Pela IA |
|---|---|---|
| Vídeos do YouTube | Aba Extração | `tusab_adicionar_youtube` |
| Documentos (PDF, Word, Excel…) | Repositório → enviar arquivo | — |
| Arquivo `.txt`/`.md` | Repositório | `tusab_adicionar_arquivo` (até 5 MB) |
| Texto colado | Repositório | — |
| Página web (URL) | Repositório | — |
| Fontes públicas | Aba Extração → Base pública | `tusab_buscar_fonte_publica` |

## Formatos aceitos

| Tipo | Como é lido |
|---|---|
| PDF | Texto extraído com pdfjs, com a marca `[Página N]` em cada página para a IA citar a página |
| Word (`.docx`) | mammoth |
| Excel (`.xlsx`) e CSV | read-excel-file / leitura direta |
| TXT e Markdown | Direto |
| JSON FHIR | Bundle FHIR convertido em texto |
| Imagens (PNG, JPG, GIF, WebP) | Guardadas como [original](/funcionalidades/originais-e-imagens), sem leitura; a IA pode abri-las com `tusab_ler_original` |
| Áudio (MP3, WAV, M4A, OGG, FLAC, Opus, AAC) | Guardado como original, sem transcrição |

Limite de envio: **50 MB por arquivo**. Todo arquivo é conferido pela extensão do nome e pela assinatura (primeiros bytes); SVG, HTML e executáveis são recusados; o mesmo arquivo enviado duas vezes é recusado (SHA-256).

## Formatos especiais detectados

Textos passam por detecção de estrutura antes de serem salvos (mesmas regras do app desktop):

- **WhatsApp** (exportação Android/iOS): organizado por dia e participante;
- **Reuniões** (Zoom, Teams, Otter): organizado por quem fala e horário;
- **Documentos jurídicos** (petição, contrato, parecer): detectados pela estrutura do texto e salvos com um cabeçalho de campos extraídos antes do conteúdo integral.

## Organização no disco

```
data/neural/{projeto}/
  youtube/{canal}/      transcrições extraídas do YouTube
  documents/            texto extraído de documentos ({id}_{nome}.txt) + _manifest.json
    originais/          arquivos originais, como vieram
  texts/                textos colados ou enviados + _manifest.json
  estudo/               material de estudo guardado pela IA
  management/           CSV de gestão, resumo por canal, dados de estudo e revisão
```

Cada `.txt` de documento ou texto começa com um cabeçalho `TITULO`/`FONTE`/`DATA` e uma linha de 70 hífens; `_manifest.json` é o índice local da pasta, gravado de forma atômica.

## Indexação

Não há botão de indexar: o índice SQLite FTS5 (`data/tusab.sqlite`) é sincronizado a partir dos `.txt` sempre que uma ferramenta de consulta é chamada ou a tela pede, comparando data de modificação e tamanho de cada arquivo. Pela linha de comando: `node src/cli.js indexar`.

## Exportar e importar

| Exportação | O que gera |
|---|---|
| Base `.tusab` de um projeto | Zip com `neural/{projeto}/…` e um `manifest.json`. Os originais só vão junto por escolha explícita (a tela pergunta, com aviso sobre dados pessoais, autoria e localização em fotos) |
| Zip da base | Todo o conteúdo de `data/neural/` |
| Tabela de vídeos | Planilha XLSX a partir do CSV de gestão |
| Relatório em PDF | Relatório de pesquisa com pares pergunta/resposta e fontes |

O `.tusab` é compatível com o app desktop nos dois sentidos (um `.tusab` do desktop pode trazer também o índice dele, em `agent_index/{projeto}.lancedb/`). Na importação, o arquivo pode ter até 512 MB; cada caminho do zip é conferido (proteção contra *zip slip*), o tamanho descompactado é limitado (proteção contra *zip bomb*) e originais de tipo proibido ou com assinatura que não confere são descartados.

## Exclusão

Excluir um arquivo, limpar documentos/textos de um projeto ou fazer o reset total apaga do disco, inclusive os originais. Toda exclusão confere que o caminho final fica dentro da pasta permitida (proteção contra *path traversal*). Projetos podem ficar marcados como somente leitura (consultado em `GET /export/readonly-status`), e aí a tela não oferece excluir.

## No app desktop

O app desktop, descontinuado, aceitava os mesmos formatos e, além disso, descrevia imagens (Ollama multimodal ou OCR com RapidOCR) e transcrevia áudio localmente (faster-whisper); lá, imagens iam até 20 MB e áudio até 100 MB. Ver [App desktop](/desktop/visao-geral).
