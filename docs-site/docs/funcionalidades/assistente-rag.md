---
id: assistente-rag
title: Assistente — chat RAG
sidebar_label: Assistente (chat RAG)
slug: /funcionalidades/assistente-rag
---

# Assistente — chat RAG

O chat é o ponto de entrega de valor do Tusab: você pergunta em linguagem natural, recebe resposta em streaming, sempre com citação da fonte.

:::info Nome no produto vs. no código
Na interface o recurso se chama **"Assistente"** — termo mais preciso, já que é um chat com RAG local, sem loop autônomo nem chamada de ferramenta por iniciativa própria. Internamente o backend continua usando o nome `agent` (`tusab_engine/agent/`, rotas `/agent/*`, `agent_config.json`) — mudar isso exigiria migrar configuração já salva em disco de instalações existentes, sem ganho de UX. É intencional, não resíduo de renomeação.
:::

## Pipeline RAG

1. **Roteamento de intenção** — antes de qualquer busca, o chat verifica se a pergunta pode ser respondida sem recuperação (ver "Roteamento de intenção" abaixo). Se não, segue para a busca normalmente.
2. **Expansão de query** — o LLM gera variações da pergunta para cobrir sinônimos e paráfrases (desabilitada para Ollama: adiciona 10–15s de latência em modelos pequenos)
3. **Recuperação de contexto** — BM25Okapi no índice do(s) projeto(s) selecionado(s), sempre mesclado com FTS5 (exact-match, garante recall de termos literais como nomes próprios e siglas) e, em Busca Ampla com o modelo de embeddings instalado, também com busca vetorial por significado (ver "Busca vetorial" abaixo)
4. **Montagem do prompt** — cada fonte recuperada é envolvida em tags XML semânticas (`<source id="N">`) para mitigar prompt injection
5. **Geração** — modelo local (Ollama) ou provedor externo configurado
6. **Verificação pós-geração** — checagem por sobreposição de palavras-chave contra as fontes recuperadas

## Roteamento de intenção

Nem toda pergunta precisa buscar na base. Antes do pipeline completo, o chat reconhece dois tipos de pergunta e responde diretamente:

| Tipo | Exemplo | Como responde |
|------|---------|----------------|
| **Metadados da base** | "quantos vídeos tem essa base?", "qual o mais recente?", "quando essa base foi indexada?" | Lê o dado real direto do disco (resumo da extração, manifests) — nunca pede ao modelo para "adivinhar" um número. Zero chamada de LLM. |
| **Cálculo** | "quanto é 15+27?", "calcule (100-25)*2" | Resolvido por um avaliador aritmético seguro (nunca `eval`/`exec`, só os operadores +, -, *, /, %, `**`), usando exclusivamente os números digitados na própria pergunta — nunca números vindos de documentos recuperados, para não abrir uma superfície de prompt injection via conteúdo de terceiros. |

Saudações ("oi", "obrigado") e trechos referenciados (`[arquivo]`) também respondem de forma imediata, sem esperar a classificação de intenção do modelo. Qualquer outra pergunta segue para o pipeline de busca normalmente — o roteamento nunca inventa uma resposta: se não reconhece o padrão com segurança, degrada para a busca.

## Busca Restrita vs. Busca Ampla

| Modo | Como funciona | Latência |
|------|---------------|----------|
| **Restrita** | BM25 puro | ~1 ms |
| **Ampla** | BM25 recupera top-12 → CrossEncoder (`ms-marco-MiniLM-L-6-v2`) reordena semanticamente → top-6 vão ao prompt | +236 ms medido |

## Anti-alucinação

- Threshold de relevância calibrado dinamicamente por corpus (não um valor fixo — um corpus pequeno e um corpus com milhares de chunks têm distribuições de score muito diferentes) determina se há contexto suficiente para responder
- Quando a Busca Restrita não encontra nada, o chat tenta automaticamente a Busca Ampla (BM25+CrossEncoder) antes de desistir — só depois disso, se ainda não houver contexto, retorna `sem_contexto: true` e a interface mostra o botão **"Indexar agora"** em vez de uma mensagem genérica
- Confiança graduada por sentença: quando parte da resposta tem baixo apoio direto nas fontes, um indicador âmbar aparece sob a mensagem — sem suprimir a resposta inteira

## Busca vetorial (embeddings)

Complemento opcional à busca por palavra-chave, ativo só em Busca Ampla: recupera trechos por **significado**, não só por termo compartilhado — útil quando a pergunta usa vocabulário diferente do conteúdo original. Roda 100% local via Ollama (`nomic-embed-text`, ~274 MB). Baixe o modelo com 1 clique no card "Busca vetorial" da aba Assistente e reindexe a base — a partir daí toda Busca Ampla passa a combinar os dois métodos automaticamente. Sem o modelo instalado, o comportamento é idêntico ao de antes da feature existir (degradação graciosa).

## Multi-base

Uma conversa pode consultar múltiplos projetos simultaneamente. O painel "Base de Conhecimento" (ícone de banco de dados no cabeçalho do chat) permite selecionar quais bases participam e reindexar as que ainda não têm índice.

## Citação e fontes

Toda resposta cita título, data e link de origem. Clicar na fonte abre o vídeo original no YouTube ou o documento local correspondente.

## Feedback (RLHF local)

👍 numa resposta salva o par pergunta/resposta em `neural/{projeto}/texts/feedback_{timestamp}.txt` — na próxima indexação, esse conteúdo entra no corpus BM25 e passa a ser recuperável para perguntas parecidas. 👎 não descarta mais silenciosamente: acumula um contador por projeto que amplia o número de candidatos considerados na Busca Ampla (nunca reduz, nunca descarta um resultado — só dá mais chance de achar o trecho certo). Nenhum dos dois é treino de modelo — melhoram a recuperação, não os pesos do LLM.

## Referenciar trechos

O botão 🔍 na toolbar do chat (ou "Referenciar trecho" em mensagens sem contexto) abre uma busca federada: BM25 + expansão de query + CrossEncoder em uma ou mais bases, com resultados agrupados por projeto e seleção múltipla. Trechos escolhidos são injetados no campo de mensagem como contexto fixado.

## Persona e tom

Cinco personas disponíveis: didático, técnico, objetivo, descontraído, socrático. A persona padrão varia por perfil (didático para Estudante/Professor, técnico para Pesquisador, objetivo para Especialista) e pode ser trocada a qualquer momento na aba Assistente ou no painel Admin.

## Histórico server-side

O histórico de conversa é mantido no servidor (`state.chat_histories`), limitado a 12 mensagens (6 trocas). O payload enviado pelo cliente é ignorado — isso impede que um cliente malicioso injete um histórico falso para manipular o comportamento do modelo.

## Provedores de IA

| Provedor | Modelo padrão | Custo | Chave necessária |
|----------|--------------|-------|-------------------|
| Ollama (padrão) | llama3.2:1b | Grátis | Não |
| Groq | llama-3.1-8b-instant | Camada gratuita | Sim |
| OpenRouter | meta-llama/llama-3.3-70b-instruct:free (configurável) | Camada gratuita | Sim |
| OpenAI | gpt-4o-mini | Pago | Sim |
| Anthropic | claude-haiku-4-5 (auxiliar) / claude-sonnet-4-6 (resposta principal) | Pago | Sim |
| Google Gemini | gemini-1.5-flash | Pago | Sim |
| Endpoint customizado | qualquer servidor compatível com OpenAI | Depende | Opcional |

Modelos Ollama com raciocínio nativo (qwen3, deepseek-r1) são suportados, com opção de exibir o raciocínio do modelo.
