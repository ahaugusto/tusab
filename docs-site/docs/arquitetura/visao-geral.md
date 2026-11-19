---
id: visao-geral
title: Visão geral da arquitetura
sidebar_label: Visão geral
slug: /arquitetura/visao-geral
---

# Visão geral da arquitetura

O Tusab (`tusab-mcp/`, versão 2.0.0) é um servidor [MCP](https://modelcontextprotocol.io) escrito em Node.js (ESM, Node 18.17 ou mais novo). A ferramenta de IA do usuário inicia o processo no próprio computador e conversa com ele pela entrada e saída padrão (**stdio**). O mesmo processo:

- responde à IA pelas [ferramentas MCP](/ferramentas-mcp) e pelos [prompts](/biblioteca-de-prompts);
- serve a [tela do Tusab](/tela) em `http://127.0.0.1:<porta aleatória>`;
- roda o motor de extração do YouTube, a leitura de documentos, as fontes públicas e o índice de busca.

Como IA e tela usam a **mesma instância**, uma extração pedida pela IA aparece na tela, e o que o usuário faz na tela fica disponível para a IA.

```
Ferramenta de IA (Claude Desktop, Claude Code, VS Code, Cursor...)
        │  stdio (JSON-RPC do MCP)
        ▼
tusab-mcp  (processo Node no computador do usuário)
  ├── servidor MCP ........ 15 ferramentas + 22 prompts
  ├── painel HTTP ......... 127.0.0.1:<porta>, chave por sessão  ◄── navegador do usuário
  ├── motor ............... yt-dlp, documentos, fontes públicas, exportações
  └── índice .............. SQLite FTS5 (WebAssembly) em data/tusab.sqlite
        │
        ▼
<pasta do repositório>/data/
```

## Ciclo de vida do processo

- **Início:** a ferramenta de IA executa `node src/index.js`. Antes de carregar qualquer módulo, `console.log`, `console.info` e `console.debug` passam a escrever no stderr, porque o stdout é exclusivo do protocolo MCP.
- **Tela:** o servidor HTTP só sobe quando é pedido (ferramenta `tusab_abrir_painel`, prompt `abrir_tusab` ou a abertura automática da primeira vez numa pasta).
- **Fim:** quando a ferramenta de IA fecha, o stdin do processo termina; o plugin fecha o painel e encerra. A tela deixa de funcionar junto.
- **Atualização automática de canais:** com o plugin aberto, a verificação de vídeos novos roda alguns segundos depois do início e depois a cada hora (só para canais com a opção ligada).

## Índice de busca

- Motor: SQLite oficial compilado para WebAssembly (`@sqlite.org/sqlite-wasm`), tabela virtual **FTS5** com `tokenize = 'unicode61 remove_diacritics 2'` (busca sem acento) e ordenação por `bm25()`.
- A pergunta em linguagem natural vira uma expressão FTS5 segura: só termos entre aspas, ligados por `OR`.
- **Fonte da verdade são os `.txt`**; o `data/tusab.sqlite` é reconstruível. A sincronização é por arquivo (data de modificação e tamanho):
  - `neural/{projeto}/youtube/**/{canal}_Parte_N.txt`: um trecho por bloco, com minuto;
  - `neural/{projeto}/texts/*.txt` e `documents/*.txt`: trechos por parágrafo.
- O banco fica em memória e é gravado de forma atômica sob um arquivo de trava, porque mais de uma ferramenta de IA pode abrir o mesmo repositório.

## Estrutura de pastas

A raiz é a pasta escolhida na instalação (variável `TUSAB_REPOSITORIO`; equivale ao `TUSAB_DATA_DIR` do app desktop):

```
<pasta>/data/
  neural/{projeto}/
    youtube/{canal}/{canal}_Parte_N.txt    transcrições em blocos com minuto
    youtube/{canal}/{canal}_meta.json      metadados do canal
    documents/                             texto extraído dos documentos + _manifest.json
    documents/originais/                   arquivos originais enviados
    texts/                                 textos + _manifest.json
    management/{canal}_base.csv            planilha de gestão (status por vídeo)
    management/{canal}_summary.json        resumo do canal, filtro usado, atualização automática
    management/flashcards*.json, ...       memória de estudo (mesmo formato do desktop)
    estudo/                                material de estudo guardado
  config/
    extraction_queue.json                  fila de extração
    prompts_usuario.json                   "Meus prompts"
    idioma.json                            idioma escolhido na tela
    economia_tokens.json                   contador agregado de tokens
    auto_update.json                       última verificação de canais
    boas_vindas.json                       marca da primeira abertura
  temp/                                    legendas temporárias
  bin/                                     yt-dlp baixado pelo plugin
  tusab.sqlite                             índice de busca
```

O formato dos arquivos (blocos dos `.txt`, colunas e status do CSV, manifestos, flashcards e revisão espaçada SM-2) é o mesmo do desktop. Nomes de projeto passam pela mesma regra de limpeza (`[<>:"/\|?*\s]` vira `_`), com uma proteção a mais: pontos no início são removidos.

## Módulos principais

| Arquivo | Papel |
|---|---|
| `src/index.js` | Ponto de entrada; protege o stdout e inicia o servidor |
| `src/servidor.js` | Servidor MCP por stdio: ferramentas, prompts, instruções para a IA |
| `src/painel.js` | Servidor HTTP local da tela, com as proteções de segurança |
| `src/api.js` | Rotas `/api/*` com os mesmos contratos da API do desktop; recursos que não existem na extensão respondem de forma neutra |
| `src/cli.js` | Linha de comando com o mesmo motor (sem a IA) |
| `src/nucleo/motor.js`, `ytdlp.js`, `legendas.js` | Extração do YouTube (porte do motor Python) |
| `src/nucleo/indice.js` | Índice SQLite FTS5 |
| `src/nucleo/documentos.js`, `repositorio.js`, `originais.js` | Documentos, repositório e originais |
| `src/nucleo/exportar.js` | Exportações e arquivo `.tusab` |
| `src/nucleo/atualizacao.js` | Atualização automática de canais |
| `src/nucleo/estudo.js` | Memória de estudo e revisão espaçada |
| `src/nucleo/prompts.js` | Biblioteca de Prompts |
| `src/nucleo/idioma.js`, `textos/` | Idiomas (pt, en, es) |
| `src/nucleo/tokens.js` | Economia de tokens |
| `src/fontes/` | As 70 fontes públicas |

## Dependências

`@modelcontextprotocol/sdk` (servidor MCP), `@sqlite.org/sqlite-wasm` (índice), `pdfjs-dist` (PDF), `mammoth` (DOCX), `read-excel-file` e `write-excel-file` (XLSX), `pdfkit` (relatório em PDF), `fflate` (zip e `.tusab`), `fast-xml-parser` (fontes que respondem em XML) e `zod` (validação dos parâmetros das ferramentas). Versões fixas em `tusab-mcp/package.json`. Não há binário nativo: o SQLite roda em WebAssembly e o yt-dlp é o binário oficial, baixado com conferência SHA-256 quando o computador não tem.

## A tela (`web_interface/`)

A tela é a interface React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React + react-i18next de `web_interface/`, compilada em modo extensão:

| Item | Detalhe |
|---|---|
| Comando | `npm run build:interface` em `tusab-mcp/` (roda `vite build --mode extensao` em `web_interface/`) |
| Saída | `tusab-mcp/interface/`, servida pelo painel |
| O que o modo muda | `VITE_TUSAB_MODO=extensao` (`web_interface/.env.extensao`) liga `MODO_EXTENSAO` em `src/constants/index.js`: `API_BASE='/api'`, chave da sessão nas chamadas, sem fontes do Google nem sourcemaps (CSP `'self'`), sem telemetria, sem chat |

O [app desktop](/desktop/visao-geral), descontinuado, compilava o mesmo código com `npx vite build`.

## O que fica com a IA do usuário

Conversar, resumir, montar quizzes e gerar flashcards. O Tusab não tem chat próprio, LLM, Ollama, busca vetorial, Google Drive, transcrição de áudio, OCR nem telemetria: entrega os trechos, guarda o que precisa de memória entre conversas e cuida da base. Esses recursos existiam no [app desktop](/desktop/visao-geral), descontinuado.

## Padrões

- **Escrita atômica:** arquivos são gravados num temporário e renomeados de uma vez (`escreverAtomico` em `src/nucleo/caminhos.js`).
- **Mesmo formato do app desktop:** os módulos de `src/nucleo/` são portes do motor Python e gravam os mesmos `.txt`, CSV, manifestos e JSON de estudo.
- **Windows e macOS:** código que toca caminhos, subprocessos ou o navegador usa ramificação por plataforma (`process.platform`) no mesmo arquivo.

Mais detalhes em [Dados e armazenamento](/arquitetura/dados-e-armazenamento) e [Decisões técnicas](/arquitetura/decisoes-tecnicas).
