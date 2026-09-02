---
id: dados-e-armazenamento
title: Dados e armazenamento
sidebar_label: Dados e armazenamento
slug: /arquitetura/dados-e-armazenamento
---

# Dados e armazenamento

## Onde os dados ficam

| Contexto | Local |
|----------|-------|
| Produção (Electron empacotado) | `%AppData%\Tusab\data\` (Windows) |
| Desenvolvimento | `./data/` |
| Configurável via | variável de ambiente `TUSAB_DATA_DIR` |

## Estrutura em disco

```
data/neural/{projeto}/
  youtube/       transcrições .txt extraídas do YouTube
  documents/     PDFs, DOCX e outros docs do repositório + _manifest.json
  texts/         textos colados/parseados + _manifest.json
  estudo/        artefatos do Modo Estudo + áudio cacheado
  management/    CSVs de gestão, summary.json, README, relatório

data/agent_index/  chunks indexados por projeto ({prefixo}.lancedb/) — armazenamento colunar
data/config/       agent_config.json, credentials.json, token.json, keystore.json
data/temp/         VTTs temporários (removidos automaticamente)
```

:::info Armazenamento e ranqueamento são coisas diferentes
Desde a v1.0.55, os chunks indexados são armazenados em formato colunar (LanceDB) em vez de um arquivo `.json` único por projeto — ganho de ~12x em indexação incremental, sem precisar recarregar o índice inteiro na memória a cada atualização. O algoritmo que decide qual trecho responde sua pergunta continua sendo BM25 em memória (ver [Decisões técnicas](/arquitetura/decisoes-tecnicas)): a mudança foi deliberadamente só de armazenamento, não de ranqueamento — testado formalmente e mantido assim depois de um benchmark real mostrar que a alternativa nativa do LanceDB perdia precisão exatamente onde o Tusab é mais forte hoje.
:::

## Naming de projetos

`projeto_nome` é definido pelo usuário no modal de extração. Se omitido, deriva do nome do canal do YouTube. O nome é sanitizado (`re.sub(r'[<>:"/\\|?*\s]', '_', ...)`) antes de virar nome de pasta. Um canal pode ser importado para qualquer projeto — a pasta não fica atrelada à origem.

Subpastas (`documents/`, `texts/`, `management/`) usam nomes em inglês como padrão técnico, independente do idioma da interface.

## Escrita atômica

Todo arquivo passa por `write-to-tmp` + `os.replace()` — operação atômica no mesmo volume, garantida pelo sistema operacional. O arquivo nunca fica corrompido, mesmo se o processo travar no meio da escrita.

## Migração de estrutura legada

Funções de migração idempotentes rodam no startup e só têm efeito se houver estrutura antiga em disco: `migrar_cerebro_para_neural()`, `migrar_gestao_para_cerebro()`, `migrar_pastas_para_ingles()`.

## Compartilhamento — arquivo `.tusab`

Um projeto completo (conteúdo + índice BM25) pode ser exportado como um único arquivo `.tusab`, portável entre máquinas — quem importa não precisa reindexar nada.

## O que é seguro sincronizar/compartilhar

| Pasta | Pode compartilhar? |
|-------|---------------------|
| `neural/` | ✅ Sim — conteúdo indexado, sem segredos |
| `indexes/` | ✅ Sim |
| `config/` | ⚠️ **Não** — pode conter chaves de API em texto claro (`agent_config.json`) e tokens OAuth (`token.json`, `credentials.json`) |

Um `LEIA-ME-SEGURANCA.txt` é criado automaticamente na pasta de dados explicando essa distinção. Recomendamos não incluir `config/` em backups automáticos em nuvem sem criptografia adicional.
