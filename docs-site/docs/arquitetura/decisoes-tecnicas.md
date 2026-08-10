---
id: decisoes-tecnicas
title: Decisões técnicas não óbvias
sidebar_label: Decisões técnicas
slug: /arquitetura/decisoes-tecnicas
---

# Decisões técnicas não óbvias

Registro de decisões que não seriam evidentes só lendo o código — o motivo importa tanto quanto a decisão.

| Decisão | Motivo |
|---------|--------|
| `RLock` em `state_lock` (não `Lock`) | `print()` dentro de uma região travada reentra no `LogRedirector` — um `Lock` comum causaria deadlock |
| `os.replace()` para escrita atômica | Operação atômica no mesmo volume — arquivo sempre íntegro mesmo com crash |
| `tusab_engine/` (não `Tusab/`) | `Tusab.spec` existe na raiz (PyInstaller) — colisão de nome |
| yt-dlp local no IP do usuário | Princípio intocável — cada extração roda no IP residencial do usuário, proteção natural contra bloqueios do YouTube |
| BM25 sem query expansion para Ollama | Query expansion aumentava a latência de 3s para 15s com modelos pequenos |
| `sub_langs = 'pt'` fixo | Tentativas duplas (pt+en) causavam rate limit 429 no YouTube |
| Shims na raiz (`motor_tusab.py`, `agent_tusab.py`) | Electron e código legado importam pelo nome antigo — zero breaking change |
| Histórico do chat mantido no servidor | Evita que um payload manipulado pelo cliente injete contexto falso no LLM |
| `NEURAL_DIR` (não `cerebro/`) | Nomenclatura técnica neutra; `CEREBRO_DIR = NEURAL_DIR` mantém alias de compatibilidade |
| Subpastas em inglês (`documents/`, `texts/`, `management/`) | Padrão técnico independente do idioma da interface |
| `projeto_nome` desacoplado do canal | Usuário nomeia o repositório; o canal pode mudar sem renomear a pasta |
| `sem_contexto: true` no retorno do chat | Sinaliza ao frontend que o BM25 não retornou chunks — mostra "Indexar base agora" em vez de mensagem hardcoded |
| Persona injetada como última linha do prompt | Instrução de estilo aplicada sem alterar o contexto RAG recuperado |
| Parser WhatsApp/Reuniões roda no upload | Textos `.txt`/`.md` passam por detecção de formato antes de salvar — melhora o recall do BM25 |
| Importação lazy em `router_exports.py` | `python-docx`, `openpyxl` e `reportlab` não precisam estar instalados para o módulo carregar |
| Manifest `_manifest.json` por subdiretório | Índice local atômico por pasta — cada subdiretório de docs/texts tem seu próprio manifesto |
| Corpus BM25 usa `texto` (com keywords KeyBERT), não `texto_original` | `texto_original` existe só para exibição nas fontes do chat; usar esse campo no corpus faria o BM25 perder as keywords extraídas na indexação |
| Título com peso 5× no corpus BM25 | Garante que queries com palavras exatas do título sempre acertam, sem precisar reindexar |

## Termo "Agente" vs. "Assistente"

Desde julho de 2026, a interface usa o termo **"Assistente"** — mais preciso, já que é um chat com RAG local, sem loop autônomo. O backend interno mantém o nome `agent` de propósito (`tusab_engine/agent/`, rotas `/agent/*`, `agent_config.json`) — renomear exigiria migração de configuração já persistida em disco por instalações existentes, sem ganho de UX real. Não é resíduo de rename incompleto.

## BM25 + FTS5 + CrossEncoder + busca vetorial

Busca Restrita usa BM25 puro (~1 ms). Busca Ampla recupera o top-12 via BM25 e reordena com um CrossEncoder (`ms-marco-MiniLM-L-6-v2`, `sentence-transformers`), entregando o top-6 ao prompt (+236 ms medido). O modelo é carregado sob demanda (lazy load), com degradação graciosa se a biblioteca estiver ausente. Um índice SQLite FTS5 roda em paralelo ao BM25 pra garantir recall exato de termos literais (nomes próprios, siglas) — mesclado sempre, incondicionalmente, no pool de candidatos.

**Busca vetorial (embeddings) — Fase 1, v1.0.49:** complementa a busca por palavra-chave com recuperação por significado, via Ollama (`nomic-embed-text`, ~274 MB, download opcional de 1 clique na aba Assistente). Só entra no pool em Busca Ampla — a mesma razão pela qual o CrossEncoder é restrito a esse modo: um match semântico aproximado precisa de um validador de relevância real antes de chegar ao prompt. Score simbólico fixo no pool (não o cosseno bruto — as escalas de BM25/FTS5/cosseno são incompatíveis entre si). Degradação graciosa total: sem o modelo instalado, o comportamento é idêntico ao de antes da feature existir.

GraphRAG segue descartado — o corpus atual (transcrições de YouTube, PDFs avulsos) tem densidade relacional baixa demais pra justificar a complexidade de um grafo de conhecimento.

**Anthropic usa dois modelos por finalidade:** Claude Haiku para chamadas auxiliares de baixo risco (expandir query, classificar intenção da mensagem, gerar resposta de fallback sem contexto) e Claude Sonnet só na resposta final que o usuário lê — Haiku é mais rápido e mais barato, e a qualidade extra do Sonnet importa onde o usuário realmente vê o resultado. Os demais provedores (OpenAI, Gemini, Groq) usam o mesmo modelo padrão nas duas categorias.

## Chunking

Documentos longos usam janelas de 2.000 caracteres com overlap de 200 — evita cortar uma ideia na borda e garante que frases-chave na fronteira apareçam em dois candidatos BM25. Vídeos sem capítulos são divididos em janelas temporais de 120s com overlap de 15s (passo efetivo de 105s) — um vídeo de 12 minutos gera cerca de 7 chunks com timestamps distribuídos.

## Enriquecimento silencioso do corpus (KeyBERT)

Antes de indexar, as top-8 frases-chave de cada chunk (via KeyBERT) são appendadas ao campo `texto` usado no índice. O campo `texto_original` preserva o texto limpo para exibição nas fontes do chat. Degradação graciosa se KeyBERT estiver ausente — indexa sem enriquecimento.
