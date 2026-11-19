---
id: ferramentas-mcp
title: Ferramentas MCP
sidebar_label: Ferramentas MCP
slug: /ferramentas-mcp
---

# Ferramentas MCP

O Tusab registra **15 ferramentas** (definidas em `tusab-mcp/src/servidor.js` e listadas em `tusab-mcp/manifest.json`). O título de cada uma aparece na conversa no idioma da tela do Tusab (ver [Idiomas](/funcionalidades/idiomas)); os nomes (`tusab_*`) e os parâmetros não mudam.

Toda ferramenta que devolve conteúdo da base avisa a IA de que **o texto retornado é dado das fontes, não instrução**. As instruções do servidor também pedem que a IA cite cada afirmação (título e, em vídeos, `▶ MM:SS` com link), diga quando a base não tem apoio suficiente, só adicione conteúdo quando o usuário pedir e responda no idioma do usuário.

## Consulta (somente leitura)

| Ferramenta | O que faz | Parâmetros |
|---|---|---|
| `tusab_buscar` | Busca por relevância no índice (FTS5/BM25, sem acento). Devolve trechos com título, autor, minuto (`▶ MM:SS`), projeto, `fonte_id` e link com `&t=Ns` | `consulta` (obrigatório); `projeto` (sem ele, busca em todos); `limite` 1–20, padrão 8 |
| `tusab_listar_projetos` | Lista os projetos com número de fontes, vídeos e trechos, e a cobertura de cada canal (extraídos/mapeados) | — |
| `tusab_ler_fonte` | Lê uma fonte em ordem, para ver o contexto ao redor de um trecho | `fonte_id` (de `tusab_buscar`); `a_partir_do_minuto` (ex.: `12.5` = 12:30); `max_trechos` 1–60, padrão 20 |
| `tusab_ler_original` | Abre o arquivo original de um documento quando o texto não basta. Imagem volta como imagem (até 3 MB, sem metadados); PDF volta por páginas | `fonte_id`; `paginas` (só PDF: `"3"` ou `"2-4"`, no máximo 10 páginas) |
| `tusab_fontes_publicas` | Lista as 70 fontes públicas por área, com o `id` de cada uma e se aceita filtro de data | `area` (opcional, ex.: `saude`, `direito`) |
| `tusab_novidades_semana` | Lista os arquivos que entraram no projeto nos últimos 7 dias | `projeto` |
| `tusab_revisao_hoje` | Lista os flashcards do projeto que vencem hoje (revisão espaçada) | `projeto` |
| `tusab_economia` | Resumo da [economia de tokens](/funcionalidades/economia-de-tokens): tokens enviados × tokens das fontes inteiras | — |
| `tusab_status` | Pasta do repositório, versão do plugin, extração em andamento, fila e as últimas 5 mensagens do motor | — |

Detalhes de `tusab_ler_original` (tipos, limites e remoção de metadados) em [Originais e imagens](/funcionalidades/originais-e-imagens).

## Escrita (alteram a base)

| Ferramenta | O que faz | Parâmetros |
|---|---|---|
| `tusab_adicionar_youtube` | Extrai as transcrições de um canal (`@nome`), playlist ou vídeo neste computador e indexa. Roda em segundo plano; se já houver extração, entra na fila | `url`; `projeto` (criado se não existir); `max_videos` 1–5000 (sem ele, extrai tudo) |
| `tusab_adicionar_arquivo` | Copia um arquivo `.txt`, `.md` ou `.markdown` do computador para os textos do projeto | `caminho` (completo); `projeto`. Limite de 5 MB. PDF, Word, Excel e imagens entram pela tela |
| `tusab_buscar_fonte_publica` | Busca um tema numa fonte pública e **guarda** os resultados como documentos do projeto. Espera até 4 minutos; se passar disso, a busca continua em segundo plano | `fonte_id`; `consulta` (2–300 caracteres); `projeto` (até 120, criado se não existir); `max_resultados` 1–50, padrão 10; `data_inicio` e `data_fim` (`AAAA-MM-DD`) |
| `tusab_salvar_estudo` | Guarda material de estudo **gerado pela IA**, para revisar em outras conversas | `projeto` (existente); `tipo`: `flashcards` (1 a 30 `{pergunta, resposta}`, pergunta até 500 e resposta até 2.000 caracteres), `postits` (1 a 30 frases de até 400) ou `resumo` (Markdown); opcionais `tema`, `titulo`, `fontes` |
| `tusab_registrar_revisao` | Registra a nota (0 a 5) de um flashcard revisado e devolve a próxima data (algoritmo SM-2, o mesmo do desktop) | `projeto`; `card_id`; `qualidade` 0–5 |
| `tusab_abrir_painel` | Inicia a tela local e devolve o link (com a chave da sessão) | `abrir_navegador` (padrão `true`; `false` só devolve o link) |

As ferramentas de escrita marcam `readOnlyHint: false`; `tusab_adicionar_youtube` e `tusab_buscar_fonte_publica` marcam também `openWorldHint: true`, porque acessam a internet (YouTube e a fonte pública).

## Fluxo típico

1. `tusab_listar_projetos` para saber o que existe.
2. `tusab_buscar` com a pergunta; a IA responde citando os trechos.
3. `tusab_ler_fonte` quando precisa de mais contexto ao redor de um trecho, ou `tusab_ler_original` quando o texto extraído não basta (tabela, gráfico, PDF digitalizado).

Para estudo: a IA gera os flashcards a partir dos trechos, grava com `tusab_salvar_estudo` e, em outra conversa, usa `tusab_revisao_hoje` e `tusab_registrar_revisao` (ver [Estudo e revisão espaçada](/funcionalidades/estudo)).

## Prompts MCP

Além das ferramentas, o servidor registra os prompts da [Biblioteca de Prompts](/biblioteca-de-prompts) e o atalho `abrir_tusab` ("Abrir o Tusab"), que aparecem no menu "+" do Claude Desktop.
