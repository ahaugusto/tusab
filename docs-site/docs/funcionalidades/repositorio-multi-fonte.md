---
id: repositorio-multi-fonte
title: Repositório multi-fonte
sidebar_label: Repositório multi-fonte
slug: /funcionalidades/repositorio-multi-fonte
---

# Repositório multi-fonte

O Repositório é onde toda base de conhecimento vive — organizada por **projeto**, não por canal. Um canal do YouTube pode ser importado para qualquer projeto; a pasta não fica atrelada à origem.

## Fontes suportadas

| Tipo | Formatos | Observação |
|------|----------|------------|
| Vídeo | Transcrições do YouTube | Via extração (ver [Extração YouTube](/funcionalidades/extracao-youtube)) |
| Documentos | PDF, DOCX, XLSX, CSV, TXT | Upload direto, limite de 50 MB por arquivo |
| Imagens | PNG, JPG, WEBP etc. | Descrição via Ollama multimodal (llava/gemma3) ou OCR (RapidOCR) como fallback |
| Áudio | MP3, WAV, M4A etc. | Transcrição local via faster-whisper (modelo `base`, CPU, ~150 MB) |
| Texto colado | — | Direto pela interface |
| Página web | URL avulsa | Extração via trafilatura, respeitando `robots.txt` |

## Parsers de formato especial

Textos `.txt`/`.md` passam por detecção automática de estrutura antes de salvar:

- **WhatsApp** (Android/iOS) — estruturado por dia/participante
- **Reuniões** (Zoom, Teams, Otter) — estruturado por palestrante/timestamp
- **Documentos jurídicos** (petição, contrato, parecer) — detectados por estrutura textual (vocativo ao juízo, cláusulas numeradas, cabeçalho de ementa); reformatados com um cabeçalho de campos extraídos antes do conteúdo integral

Esse pré-processamento melhora o recall do BM25 na hora da busca — sem depender de nenhuma API externa.

## Organização por projeto

```
data/neural/{projeto}/
  youtube/       transcrições .txt extraídas do YouTube
  documents/     PDFs, DOCX e outros docs + _manifest.json
  texts/         textos colados/parseados + _manifest.json
  estudo/        artefatos do Modo Estudo (flashcards/resumo/post-its + áudio)
  management/    CSVs de gestão, summary.json, README, relatório
```

Cada subdiretório de `documents/` e `texts/` mantém um `_manifest.json` como índice local, com escrita atômica (`write-to-tmp` + `os.replace()`).

## Indexação

O botão **Indexar base** (no Repositório, ou "Indexar agora" direto de uma mensagem do chat sem contexto suficiente) constrói o índice BM25 do projeto. Desde a v1.0.42, a indexação também roda automaticamente em background após qualquer ingestão de conteúdo — extração, upload, texto colado, ou busca em fonte pública — com cache incremental por arquivo: só o que é novo ou mudou paga o custo do enriquecimento semântico.

## Compartilhamento — exportar/importar `.tusab`

Qualquer projeto pode ser exportado como um arquivo único `.tusab`, portável entre máquinas. Quem recebe importa e já conversa — o índice BM25 já vem dentro do arquivo, sem precisar indexar nada.

## Limites e segurança

- Upload limitado a 50 MB por arquivo
- Nomes de arquivo sanitizados antes de salvar em disco
- Delete de arquivos protegido contra path traversal (`os.path.realpath()` valida que o caminho final está dentro do subdiretório permitido)
