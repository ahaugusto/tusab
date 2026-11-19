# Tusab — extensão para ferramentas de IA (plugin MCP)

> "Desktop", neste arquivo, é o antigo app Tusab (Electron + Python), descontinuado em 19/11/2026; o código dele está na etiqueta `desktop-final`. A extensão manteve o formato em disco dele, por isso as bases antigas abrem aqui.

O Tusab dentro da IA que o usuário já usa (Claude Desktop, Claude Code, VS Code, Cursor…). O plugin:

- **serve a interface do Tusab desktop** no navegador, em `http://127.0.0.1:<porta>`, com o mesmo design,
  extração, repositório, relatórios e visão geral. O build vem de `../web_interface` em modo extensão;
- **roda o motor de extração** neste computador, no IP do usuário. O yt-dlp é o oficial, baixado com
  conferência SHA-256 quando o computador não tem;
- **grava na mesma estrutura de pastas do desktop**, então abre bases que já existem;
- **deixa a IA consultar a base** por MCP, com citação no minuto exato.

```
<pasta escolhida>/data/                       (= TUSAB_DATA_DIR do desktop)
  neural/{projeto}/youtube/{canal}/{canal}_Parte_N.txt   transcrições (blocos com minuto)
  neural/{projeto}/management/{canal}_base.csv           planilha de gestão (status por vídeo)
  neural/{projeto}/texts/ · documents/                   textos e documentos
  config/extraction_queue.json · temp/ · bin/            fila, temporários, yt-dlp
  tusab.sqlite                                           índice de busca (reconstruível a partir dos .txt)
```

## Ferramentas MCP

| Ferramenta | O que faz |
|---|---|
| `tusab_buscar` | Busca por relevância (FTS5/BM25, sem acento); devolve trecho, fonte, minuto e link `&t=Ns` |
| `tusab_listar_projetos` | Projetos com fontes, vídeos, trechos e cobertura de cada canal |
| `tusab_ler_fonte` | Lê uma fonte em ordem, a partir de um minuto |
| `tusab_adicionar_youtube` | Canal, playlist ou vídeo → o mesmo motor da tela; entra na fila se já houver extração |
| `tusab_adicionar_arquivo` | Copia um `.txt`/`.md` para os textos do projeto (formato do desktop) |
| `tusab_status` | Extração em andamento, fila e últimas mensagens do motor |
| `tusab_abrir_painel` | Abre a interface no navegador e devolve o link |
| `tusab_ler_original` | Abre o original de um documento quando o texto não basta: imagem (até 3 MB) ou PDF por páginas |
| `tusab_fontes_publicas` / `tusab_buscar_fonte_publica` | Lista as 70 fontes / busca um tema e guarda no projeto |
| `tusab_salvar_estudo` | Guarda flashcards, post-its ou resumo gerados pela IA (memória entre conversas) |
| `tusab_revisao_hoje` / `tusab_registrar_revisao` | Revisão espaçada no chat |
| `tusab_novidades_semana` | O que entrou no projeto nos últimos 7 dias (usado pelo prompt de digest) |
| `tusab_economia` | Tokens enviados à IA (só trechos) × o que custaria anexar as fontes inteiras; estimativa local |

**Prompts prontos** (`src/nucleo/prompts.js`): 21 pedidos em 6 categorias (Estudar, Ensinar, Pesquisar, Decidir,
Criar conteúdo, Acompanhar), no menu "+" do Claude e na aba "Prompts prontos" da tela, para copiar em qualquer IA.
O Tusab não gera cards ou quizzes; entrega o pedido certo e guarda o que precisa de memória.
**Meus prompts:** o usuário cria os seus na tela (do zero ou duplicando um pronto); ficam em
`data/config/prompts_usuario.json` e entram no "+" do Claude na hora, sem reiniciar. As regras de busca e citação
são acrescentadas pelo plugin em todo prompt.

## Arquitetura

| Arquivo | Papel |
|---|---|
| `src/nucleo/motor.js` | Porte de `motor/extraction.py` + `router_extraction.py`: mapear, extrair, pausar, cancelar, fila |
| `src/nucleo/legendas.js` | Divide o VTT por capítulo ou em janelas de 2 min com 15 s de sobreposição, como o desktop |
| `src/nucleo/ytdlp.js` | Comandos do yt-dlp (busca de canal, prévia, playlists, mapeamento, legenda e metadados numa única chamada) |
| `src/nucleo/gestao.js` | CSV de gestão, `/history`, `/relatorio`, `/repositorio`, `/neural/projetos` |
| `src/nucleo/indice.js` | SQLite (WebAssembly, FTS5) sincronizado a partir dos `.txt` |
| `src/api.js` | Rotas do FastAPI do desktop em `/api/*`; recursos fora da extensão respondem de forma neutra |
| `src/painel.js` | Servidor local: interface + API, com chave por sessão, `Host` conferido, sem CORS, CSP |
| `src/servidor.js` | Servidor MCP por stdio; a mesma instância atende a IA e a tela |

**Segurança do servidor local:**
- escuta só em `127.0.0.1`, numa porta aleatória;
- exige uma chave de 256 bits por sessão no cabeçalho `X-Tusab-Chave`;
- recusa `Host` diferente de `127.0.0.1:<porta>` e `Origin`/`Sec-Fetch-Site` de outros sites;
- não envia cabeçalhos CORS e usa CSP `'self'`;
- fecha junto com a ferramenta de IA.

## Desenvolvimento

```powershell
cd tusab-mcp
npm install
npm test                      # 111 testes (yt-dlp falso, sem rede; inclui cliente MCP real e segurança)
npm run build:interface       # gera interface/ a partir de ../web_interface (modo extensão)
$env:TUSAB_REPOSITORIO="C:\caminho\teste"
npm run painel                # abre a interface no navegador (Ctrl+C fecha)
node src/cli.js youtube https://www.youtube.com/@canal Projeto 5
npm run pack                  # build da interface + ../tusab.mcpb
```

`TUSAB_YTDLP=test/ytdlp-falso.mjs` troca o yt-dlp por um simulado (3 vídeos, um sem legenda).
`YTDLP_FALSO_ATRASO=800` faz o simulado demorar, para ver o progresso na tela.

## Instalar

- **Claude Desktop:** abrir o `tusab-X.Y.Z.mcpb` das [releases](https://github.com/criaugu/tusab/releases). O Node vem
  embutido; o usuário escolhe a pasta (pode ser a de dados do antigo Tusab desktop).
- **Claude Code, VS Code e Cursor (stdio):**
  `{ "command": "node", "args": ["<caminho>/tusab-mcp/src/index.js"], "env": { "TUSAB_REPOSITORIO": "<pasta>" } }`

## O que a extensão tem (v2.0.0)

- **Extração do YouTube:** canal, playlist ou vídeo, com fila, pausa e atualização automática de canais (`src/nucleo/motor.js`, `atualizacao.js`).
- **Documentos:** PDF, Word, Excel, CSV, TXT/Markdown, FHIR e página web (respeita o robots.txt). Também reconhece WhatsApp, reuniões e documentos jurídicos (`documentos.js`, `repositorio.js`).
- **Exportações:** zip da base, tabela de vídeos, relatório em PDF e `.tusab` compatível com o desktop nos dois sentidos (`exportar.js`).
- **Fontes públicas:** 70 fontes em 11 áreas, as mesmas do desktop (`src/fontes/`).
- **Originais:** todo arquivo enviado fica guardado como veio (`documents/originais/`), conferido pela assinatura; o texto extraído é o índice (economiza tokens) e a IA abre o original com `tusab_ler_original` quando precisa. Imagens e áudios são guardados sem leitura (`originais.js`).
- **Economia de tokens:** contador local das consultas (`data/config/economia_tokens.json`, só agregados) e teste com as perguntas do usuário na Visão Geral ou por `node src/cli.js medir-tokens <perguntas.txt> <projeto> [saida.csv]` (`tokens.js`).
- **Imagens à IA sem GPS:** antes de `tusab_ler_original` devolver uma imagem, saem EXIF/XMP/comentários (JPEG, PNG, WebP); se a estrutura não for reconhecida, a imagem não é enviada (`semMetadados` em `originais.js`).
- **Repositório:** espaço ocupado por projeto (originais × texto), marca "Só texto" nos documentos sem original, botão "Pedir à IA" e exportação `.tusab` com a opção de incluir os originais.
- **Três idiomas (pt, en, es):** a tela usa os arquivos de `web_interface/src/locales`; o plugin traduz o que diz por `t()` (`src/nucleo/idioma.js`, dicionários em `src/nucleo/textos/`), com o idioma que a tela manda em cada chamada (`X-Tusab-Idioma`, gravado em `data/config/idioma.json`). Isso vale também para os títulos das ferramentas e os atalhos do "+" no Claude, atualizados na hora. Formatos gravados em disco ficam em português, para manter a compatibilidade com o desktop. O manifesto tem `mcpb-resources/en-US.json` e `es-ES.json` (gerados por `node scripts/gerar-recursos-manifesto.mjs`). O teste `test/idioma.test.js` falha se alguma frase ficar sem tradução.
- **Biblioteca de Prompts:** busca, "Meus prompts" em pastas (renomear ou desfazer pasta), aviso de "copiado" com atalho para o app do Claude ou para a IA no navegador, e a janela "Economia de tokens" com o teste em 3 passos.
- **Memória de estudo:** a IA gera; o Tusab guarda os flashcards e faz a revisão espaçada (SM-2 igual ao desktop) (`estudo.js`).

**Fora da extensão:** chat, geração de cards/quizzes, configuração de LLM, Ollama, Drive e telemetria. A conversa é na IA do usuário.
