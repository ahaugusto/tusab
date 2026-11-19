---
id: instalacao
title: Instalação
sidebar_label: Instalação
slug: /instalacao
---

# Instalação

O Tusab é instalado como extensão (servidor MCP local) na ferramenta de IA. Sistemas declarados no manifesto: Windows (`win32`) e macOS (`darwin`).

:::note App desktop descontinuado
O app desktop (instaladores `.exe` e `.dmg`) foi descontinuado em 19/11/2026. A documentação dele fica na seção [App desktop](/desktop/visao-geral), como registro.
:::

## Claude Desktop: pacote `.mcpb`

<a className="button button--primary button--lg" href="https://github.com/criaugu/tusab/releases/download/v2.0.0/tusab-2.0.0.mcpb">Baixar o Tusab 2.0.0 (.mcpb)</a>

Soma SHA-256: o arquivo `tusab-2.0.0.mcpb.sha256`, na mesma [release](https://github.com/criaugu/tusab/releases/tag/v2.0.0), traz a soma do pacote. Para conferir, compare-a com a saída de `Get-FileHash .\tusab-2.0.0.mcpb -Algorithm SHA256` (Windows, PowerShell) ou de `shasum -a 256 tusab-2.0.0.mcpb` (macOS).

A extensão é distribuída como um pacote [MCP Bundle](https://github.com/modelcontextprotocol/mcpb) (`.mcpb`). O pacote leva o código do servidor, as dependências, a tela já compilada e os textos de licença. O Node.js vem do próprio Claude Desktop, então não há nada mais para instalar.

1. Abra o arquivo `tusab-2.0.0.mcpb` com o Claude Desktop instalado; ele mostra a tela de instalação da extensão.
2. Quando o Claude Desktop pedir a **Pasta do repositório**, escolha uma pasta. O Tusab cria `data/` dentro dela. Para abrir uma base criada pelo app desktop, escolha a pasta de dados dele (veja [Dados e armazenamento](/arquitetura/dados-e-armazenamento#onde-os-dados-ficam)).
3. Na primeira execução numa pasta, o plugin abre a tela do Tusab no navegador uma vez (marca em `data/config/boas_vindas.json`).

A pasta escolhida é passada ao servidor pela variável de ambiente `TUSAB_REPOSITORIO` (campo `user_config.repositorio` do `manifest.json`). Sem essa variável, o servidor usa `~/Tusab`.

## Gerar o `.mcpb` a partir do código

Alternativa ao download acima. O pacote gerado se chama `tusab.mcpb` e é instalado da mesma forma.

Pré-requisito: Node.js 18.17 ou mais novo.

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab/web_interface
npm install          # a tela da extensão é compilada a partir daqui
cd ../tusab-mcp
npm install
npm run pack         # compila a tela, gera os avisos de licença e cria ../tusab.mcpb
```

O arquivo sai na raiz do repositório (`tusab.mcpb`). O `npm run pack` usa `@anthropic-ai/mcpb@2.1.2` via `npx`.

## Outras ferramentas compatíveis com MCP (Claude Code, VS Code, Cursor…)

Qualquer cliente MCP que inicie servidores por **stdio** pode rodar o plugin direto do código, depois de `npm install` em `tusab-mcp/` e `npm run build:interface` (para a tela funcionar):

```json
{
  "mcpServers": {
    "tusab": {
      "command": "node",
      "args": ["<caminho>/tusab/tusab-mcp/src/index.js"],
      "env": { "TUSAB_REPOSITORIO": "<pasta do repositório>" }
    }
  }
}
```

O formato exato do arquivo de configuração depende de cada ferramenta; o que importa é o comando (`node`), o argumento (`src/index.js`) e a variável `TUSAB_REPOSITORIO`.

## yt-dlp

O plugin procura o yt-dlp nesta ordem: variável `TUSAB_YTDLP`, cópia em `data/bin/`, `yt-dlp` no `PATH`. Se não achar, baixa o binário oficial de `github.com/yt-dlp/yt-dlp/releases/latest` e confere a soma SHA-256 publicada (`SHA2-256SUMS`); se não conferir, o download é descartado.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `TUSAB_REPOSITORIO` | Pasta do repositório (a raiz que contém `data/`). Padrão: `~/Tusab` |
| `TUSAB_YTDLP` | Caminho de um yt-dlp a usar no lugar do baixado |
| `TUSAB_IDIOMA` | Idioma inicial (`pt`, `en` ou `es`) antes de a tela definir um |
| `TUSAB_SEM_BOAS_VINDAS` | `1` desliga a abertura automática da tela na primeira execução |

## Primeiros passos

1. Peça à IA para abrir o Tusab (ou use o atalho **Abrir o Tusab** no "+" do Claude Desktop).
2. Na tela, escolha idioma, tema e perfil e adicione um canal do YouTube, documentos ou uma busca em fonte pública. A IA também pode adicionar um canal com `tusab_adicionar_youtube`.
3. Pergunte na conversa: a IA busca na base com `tusab_buscar` e cita vídeo e minuto, ou documento e página.
