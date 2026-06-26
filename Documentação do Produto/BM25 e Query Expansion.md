Tusab — BM25 E QUERY EXPANSION
© 2026 CriAugu — Atualizado: Junho 2026

─────────────────────────────────────────
O QUE É O BM25
─────────────────────────────────────────

BM25 significa Best Match 25 — é literalmente a 25ª iteração de
uma família de funções de ranqueamento desenvolvida nos anos 90
por pesquisadores de Robertson, Jones et al. (Universidade de
Okla / City University London).

É o algoritmo que o Tusab usa para decidir quais trechos da
base de conhecimento são mais relevantes para uma pergunta.

─────────────────────────────────────────
O PROBLEMA QUE ELE RESOLVE
─────────────────────────────────────────

Você tem 500 arquivos de texto. O usuário pergunta:
"como calcular juros compostos"

Qual arquivo é mais relevante?

A resposta ingênua: conta quantas vezes as palavras aparecem.
Mas isso tem dois problemas:

  1. Um arquivo de 10.000 palavras que menciona "juros" 5 vezes
     não é necessariamente mais relevante que um de 500 palavras
     que menciona "juros" 3 vezes.

  2. A palavra "como" aparece em todos os arquivos — ela não
     diz nada sobre relevância.

O BM25 resolve os dois.

─────────────────────────────────────────
OS TRÊS FATORES DO BM25
─────────────────────────────────────────

Para cada par (pergunta, documento), o BM25 calcula um score
combinando três fatores:

1. TF saturado (Term Frequency com teto)
   ──────────────────────────────────────
   Mede quantas vezes o termo aparece no documento — mas com um
   teto. Não cresce linearmente para sempre: a partir de certo
   ponto, mencionar "juros" 20 vezes não é muito mais relevante
   que 5 vezes.

   O parâmetro k1 (padrão: 1.5) controla essa saturação.
   k1 baixo = satura rápido. k1 alto = cresce mais linearmente.

2. IDF — Inverse Document Frequency (raridade do termo)
   ──────────────────────────────────────────────────────
   Mede o quanto o termo discrimina documentos.

   "como" aparece em todos os 500 arquivos → score próximo de zero
   "amortização" aparece em 3 arquivos → score alto

   Quanto mais raro o termo na coleção, mais ele pesa no score.
   Isso é o que faz perguntas específicas funcionarem melhor que
   perguntas genéricas.

3. Normalização por tamanho do documento
   ──────────────────────────────────────
   Documentos longos têm mais chance de mencionar qualquer palavra
   só pelo volume. O BM25 desconta isso proporcionalmente ao
   tamanho médio de todos os documentos na base.

   O parâmetro b (padrão: 0.75) controla o quanto.
   b = 0: sem normalização. b = 1: normalização total.

O score final combina os três e retorna um número.
Mais alto = mais relevante.

─────────────────────────────────────────
POR QUE O BM25 É O MELHOR QUE TEMOS
─────────────────────────────────────────

No Tusab, o BM25 roda 100% local, sem GPU, em milissegundos,
sobre toda a base indexada.

A alternativa mais sofisticada são os embeddings vetoriais
(o que o NotebookLM usa internamente): o texto é convertido em
vetores numéricos por um modelo de linguagem, e a busca encontra
documentos com significado próximo mesmo sem palavras em comum.

Embeddings são mais poderosos semanticamente, mas:
  · Requerem modelo de embedding rodando localmente (~400 MB+)
  · São ordens de magnitude mais lentos sem GPU
  · Adicionam dependência pesada e complexidade de configuração

Para a maioria das perguntas reais sobre um canal do YouTube
ou um documento, o BM25 é competitivo — especialmente com o
enriquecimento que o Tusab aplica:

  · Tags do YouTube amplificadas 3x no corpus
  · Keywords TF-IDF do texto amplificadas 2x
  · Descrição do vídeo incluída no corpus

Isso compensa boa parte da limitação léxica do BM25.

─────────────────────────────────────────
A LIMITAÇÃO REAL DO BM25
─────────────────────────────────────────

O BM25 é puramente léxico — compara tokens (palavras).

Se o documento diz "rendimento" e o usuário pergunta "retorno",
o BM25 não conecta os dois, mesmo que o significado seja idêntico.
Esse é o problema dos sinônimos e paráfrases.

Exemplos práticos onde o BM25 falha:
  · "retorno"    vs  "rendimento", "ganho", "rentabilidade"
  · "comprar"    vs  "adquirir", "investir em"
  · "explica"    vs  "como funciona", "o que é"
  · "barato"     vs  "custo-benefício", "acessível"

É aí que embeddings ganham. Mas para a maioria dos casos
de uso do Tusab — perguntas sobre conteúdo técnico e educacional
com vocabulário específico — o BM25 funciona muito bem.

─────────────────────────────────────────
QUERY EXPANSION — A SOLUÇÃO IMPLEMENTADA
─────────────────────────────────────────

A query expansion resolve o problema dos sinônimos sem precisar
de embeddings: antes de chamar o BM25, pedimos ao LLM configurado
para gerar variações da pergunta original.

Exemplo:
  Pergunta original: "qual o retorno do investimento?"

  LLM gera variações:
    · "qual a rentabilidade do investimento?"
    · "como calcular o rendimento de um ativo?"

O BM25 é executado para cada variação. Os scores são combinados
por média aritmética. O resultado final cobre muito mais sinônimos
sem comprometer a precisão.

─────────────────────────────────────────
QUANDO A QUERY EXPANSION É ATIVADA
─────────────────────────────────────────

A expansão é habilitada apenas para provedores rápidos:

  ✅ Groq       — latência ~0.3–0.8s (llama-3.1-8b-instant)
  ✅ OpenAI     — latência ~0.5–1s (gpt-4o-mini)
  ✅ Anthropic  — latência ~0.5–1s (claude-haiku)
  ✅ Gemini     — latência ~0.5–1s (gemini-1.5-flash)

  ❌ Ollama     — desabilitado

Por que Ollama está desabilitado:
  · Modelos pequenos (llama3.2:1b) geram expansões de baixa
    qualidade — muitas vezes repetem a pergunta com variações
    mínimas ou adicionam termos irrelevantes.
  · A latência extra é de 10–15s para um modelo de 1B parâmetros,
    tornando o chat muito lento.
  · A relação custo/benefício é desfavorável: o ganho de qualidade
    não justifica o tempo de espera.

Para Ollama, o BM25 roda com a pergunta original — que já é
suficiente para a maioria dos casos com o corpus enriquecido.

─────────────────────────────────────────
COMPORTAMENTO EM CASO DE FALHA
─────────────────────────────────────────

A expansão é best-effort:
  · Timeout → retorna pergunta original, chat continua normalmente
  · API error → mesmo comportamento
  · Variações de má qualidade → incluídas mesmo assim; o BM25
    com scores baixos simplesmente não altera o ranking final

O chat nunca é bloqueado por falha na expansão.

─────────────────────────────────────────
COMO ESTÁ IMPLEMENTADO
─────────────────────────────────────────

Arquivo: tusab_engine/agent/chat.py

Constante de controle:
  PROVEDORES_COM_EXPANSION = {'groq', 'openai', 'anthropic', 'gemini', 'google'}

Função principal:
  _expandir_query(pergunta, config) → [pergunta, var1, var2]
  Retorna sempre ao menos [pergunta]. Nunca lança exceção.

Uso em _recuperar_contexto():
  queries = _expandir_query(pergunta, config) if config else [pergunta]

  def _scores_para_queries(bm25_obj, qs):
      all_s = [bm25_obj.get_scores(q.lower().split()) for q in qs]
      return np.mean(all_s, axis=0) if len(all_s) > 1 else all_s[0]

  scores = _scores_para_queries(cached['bm25'], queries)

A mesma lista de queries expandidas é usada para canais extras
na busca multi-canal — antes disso, os canais extras usavam
apenas a pergunta original, perdendo o benefício da expansão.

─────────────────────────────────────────
IMPACTO ESPERADO
─────────────────────────────────────────

Para usuários com Groq, OpenAI, Anthropic ou Gemini:
  · Cobertura de sinônimos e paráfrases aumenta significativamente
  · Perguntas vagas ("me fala sobre rentabilidade") encontram mais
    conteúdo relevante do que antes
  · Latência extra: ~0.3–1s (imperceptível na prática)
  · Multi-canal se beneficia igualmente — a expansão propaga

Para usuários com Ollama:
  · Sem mudança — comportamento idêntico ao anterior
  · BM25 com corpus enriquecido (tags × 3, keywords × 2) já cobre
    a maioria dos casos de uso com vocabulário consistente

─────────────────────────────────────────
PRÓXIMO PASSO NATURAL: RERANKING
─────────────────────────────────────────

A query expansion resolve sinônimos na entrada da busca.
O reranking resolveria o problema na saída:

  BM25 retorna top 10 chunks
  → LLM lê cada um e decide: "isso realmente responde a pergunta?"
  → Reordena ou descarta com base em compreensão semântica

Isso é mais poderoso que a query expansion porque o modelo lê
o conteúdo, não apenas compara tokens. A limitação é latência
adicional (~2–5s para avaliar 10 chunks) e custo de tokens.

Status: não implementado. Candidato para P3 após validação
de mercado com a query expansion ativa.
