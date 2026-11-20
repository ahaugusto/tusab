---
id: setup
title: Setup de desenvolvimento
sidebar_label: Setup de desenvolvimento
slug: /desenvolvimento/setup
---

# Setup de desenvolvimento

## Pré-requisitos

- Node.js 18.17 ou mais novo (o mesmo mínimo declarado no `manifest.json`).
- Git.
- yt-dlp é opcional: sem ele, o plugin baixa o oficial na primeira extração.

## Clonar e instalar

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab

# Interface (a tela é compilada a partir daqui)
cd web_interface
npm install
cd ..

# Plugin
cd tusab-mcp
npm install
npm run build:interface     # gera tusab-mcp/interface/ (vite build --mode extensao)
```

## Rodar sem ferramenta de IA

A linha de comando usa o mesmo motor do plugin. Defina antes a pasta de teste:

```powershell
cd tusab-mcp
$env:TUSAB_REPOSITORIO = "C:\caminho\teste"

npm run painel                                        # abre a tela no navegador (Ctrl+C fecha)
node src/cli.js painel --sem-navegador                # só imprime o link
node src/cli.js projetos                              # lista os projetos
node src/cli.js indexar                               # sincroniza o índice
node src/cli.js buscar "consulta" [projeto]           # busca no índice
node src/cli.js youtube https://www.youtube.com/@canal Projeto 5   # extrai até 5 vídeos
node src/cli.js medir-tokens perguntas.txt Projeto [saida.csv]     # teste de economia de tokens
```

## Rodar como servidor MCP

```powershell
npm start        # = node src/index.js, servidor MCP por stdio
```

Para usar numa ferramenta de IA durante o desenvolvimento, aponte a configuração MCP dela para `node <caminho>/tusab-mcp/src/index.js` com `TUSAB_REPOSITORIO` (ver [Instalação](/instalacao#outras-ferramentas-de-ia-claude-code-vs-code-cursor-gemini-cli-codex)).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `TUSAB_REPOSITORIO` | Pasta do repositório (raiz que contém `data/`). Padrão: `~/Tusab` |
| `TUSAB_YTDLP` | yt-dlp a usar. `test/ytdlp-falso.mjs` troca o yt-dlp por um simulado (3 vídeos, um sem legenda), sem rede |
| `YTDLP_FALSO_ATRASO` | Com o yt-dlp simulado, atraso em milissegundos (ex.: `800`) para ver o progresso na tela |
| `TUSAB_IDIOMA` | Idioma inicial (`pt`, `en`, `es`) |
| `TUSAB_SEM_BOAS_VINDAS` | `1` desliga a abertura automática da tela na primeira execução numa pasta |

## Interface em modo extensão

A tela é `web_interface/` compilada com `vite build --mode extensao`, que lê `web_interface/.env.extensao` (`VITE_TUSAB_MODO=extensao`). Em `web_interface/src/constants/index.js`, `MODO_EXTENSAO` passa a ser verdadeiro e `API_BASE` vira `/api`. Componentes que mudam no modo extensão testam `MODO_EXTENSAO`. Depois de mudar a interface, rode de novo `npm run build:interface` em `tusab-mcp/`.

Sem a interface compilada, o painel responde com uma página que pede para rodar `npm run build:interface`.

## Organização do código

Ver [Visão geral da arquitetura](/arquitetura/visao-geral#módulos-principais). Regras práticas:

- o **stdout** do processo MCP é exclusivo do protocolo: avisos vão para o stderr;
- toda frase que o usuário lê passa por `t()` e precisa de tradução em `src/nucleo/textos/en.js` e `es.js` (o teste de idiomas falha se faltar);
- formatos gravados em disco seguem o app desktop e não são traduzidos.
