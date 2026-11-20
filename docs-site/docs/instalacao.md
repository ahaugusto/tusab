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

Vai usar o Tusab também em outra ferramenta de IA? Veja [Outras ferramentas de IA](#outras-ferramentas-de-ia-claude-code-vs-code-cursor-gemini-cli-codex) e, principalmente, os [Cuidados](#cuidados): uma IA por vez na mesma base.

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

## Outras ferramentas de IA (Claude Code, VS Code, Cursor, Gemini CLI, Codex…)

O Tusab funciona em qualquer ferramenta de IA que aceite **servidores MCP locais** (que a ferramenta inicia no próprio computador, por stdio). Nelas, a instalação é feita à mão, em três passos: ter o Node.js, deixar os arquivos do Tusab numa pasta e apontar a ferramenta para eles.

:::info Onde não funciona
IAs no navegador (Claude.ai, ChatGPT, Gemini na web) e o app do ChatGPT só aceitam servidores pela internet: não alcançam o Tusab deste computador. Para usá-las com a sua base, copie o pedido pela [Biblioteca de Prompts](/biblioteca-de-prompts) e use **Abrir no navegador**: o Tusab copia o pedido já com os trechos da base dentro.
:::

### 1. Node.js: conferir e instalar

O Claude Desktop traz o próprio Node.js; as outras ferramentas usam o que está instalado no computador. O Tusab precisa da versão **18.17 ou mais nova**.

**Conferir se já está instalado.** Abra o PowerShell (Windows: menu Iniciar › "PowerShell") ou o Terminal (macOS: Aplicativos › Utilitários › Terminal) e digite:

```bash
node --version
```

- Apareceu um número como `v22.11.0` (18.17 ou maior): pode seguir para o passo 2.
- Apareceu um número menor (por exemplo, `v16.20.0`): atualize pelo instalador abaixo.
- Apareceu "`node` não é reconhecido como um comando" (Windows) ou "`command not found`" (macOS): o Node.js não está instalado.

**Instalar.** Baixe a versão **LTS** em [nodejs.org](https://nodejs.org/) (Windows: instalador `.msi`; macOS: instalador `.pkg`) e siga o instalador com as opções padrão. Quem prefere a linha de comando pode usar `winget install OpenJS.NodeJS.LTS` (Windows) ou `brew install node` (macOS, com Homebrew). Depois, **feche e abra de novo** o PowerShell ou o Terminal (e a ferramenta de IA) e confira com `node --version`.

### 2. Deixar o Tusab numa pasta

O jeito mais simples é abrir o próprio pacote `.mcpb` (o mesmo do Claude Desktop) numa pasta: ele já traz o servidor, as dependências e a tela compilada, sem nada mais para instalar.

1. Baixe o pacote da [release](https://github.com/criaugu/tusab/releases) (`tusab-X.Y.Z.mcpb`) e confira a soma SHA-256, como no Claude Desktop.
2. No PowerShell ou no Terminal, abra o pacote numa pasta (troque pelo nome do arquivo e pela pasta que quiser):

```powershell
# Windows
npx --yes @anthropic-ai/mcpb@2.1.2 unpack "$HOME\Downloads\tusab-2.0.0.mcpb" "$HOME\tusab-servidor"
```

```bash
# macOS
npx --yes @anthropic-ai/mcpb@2.1.2 unpack ~/Downloads/tusab-2.0.0.mcpb ~/tusab-servidor
```

O arquivo que a ferramenta vai rodar é `tusab-servidor/src/index.js` dentro dessa pasta. Para **atualizar**, baixe o pacote novo e abra na mesma pasta (os dados da sua base ficam em outro lugar e não são tocados). Quem prefere o código-fonte pode usar o clone do repositório, depois de `npm install` em `web_interface/` e `tusab-mcp/` e de `npm run build:interface` em `tusab-mcp/`.

### 3. Configurar a ferramenta

Todas pedem os mesmos três dados:

| Dado | Valor |
|---|---|
| Comando | `node` |
| Argumento | o caminho completo de `src/index.js` na pasta do passo 2 |
| Variável `TUSAB_REPOSITORIO` | a pasta da sua base (a mesma que você escolheu no Claude Desktop, para usar a mesma base) |

Nos exemplos abaixo, troque `augusto` pelo seu usuário e as pastas pelas suas. Em arquivos JSON, no Windows, a barra invertida vai dobrada (`\\`).

**Claude Code** (no terminal; `-s user` vale para todos os projetos):

```powershell
claude mcp add tusab -s user -e TUSAB_REPOSITORIO="C:\Users\augusto\Tusab" -- node "C:\Users\augusto\tusab-servidor\src\index.js"
```

**Cursor** (`~/.cursor/mcp.json`), **Gemini CLI** (`~/.gemini/settings.json`) e outras ferramentas que usam a chave `mcpServers`:

```json
{
  "mcpServers": {
    "tusab": {
      "command": "node",
      "args": ["C:\\Users\\augusto\\tusab-servidor\\src\\index.js"],
      "env": { "TUSAB_REPOSITORIO": "C:\\Users\\augusto\\Tusab" }
    }
  }
}
```

No macOS, os caminhos ficam como `/Users/augusto/tusab-servidor/src/index.js` e `/Users/augusto/Tusab`.

**VS Code com o GitHub Copilot** (`.vscode/mcp.json` no projeto, ou o comando "MCP: Add Server"): o mesmo bloco, com a chave `servers` no lugar de `mcpServers` e `"type": "stdio"` dentro de `tusab`.

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.tusab]
command = "node"
args = ['C:\Users\augusto\tusab-servidor\src\index.js']
env = { TUSAB_REPOSITORIO = 'C:\Users\augusto\Tusab' }
```

Depois de configurar, reinicie a ferramenta e peça "abra o Tusab" ou "liste os projetos do Tusab". Se a ferramenta disser que o servidor não iniciou, confira o passo 1 (`node --version` no mesmo terminal) e se o caminho de `src/index.js` está certo.

### O que funciona em cada ferramenta

| Recurso | Claude Desktop | Outras ferramentas |
|---|---|---|
| As 15 ferramentas (busca com citação, YouTube, documentos, fontes públicas, guardar material, revisão espaçada, economia de tokens) | Sim | Sim |
| Tela do Tusab no navegador (abre sozinha na primeira vez; depois, peça "abra o Tusab") | Sim | Sim |
| Link **Abrir no Tusab** depois de guardar um material | Sim | Sim |
| Aviso de conexão no "copiado" | Sim, como "Claude Desktop" | Sim, com o nome que a ferramenta informa |
| Atalhos prontos no **+** | Sim | Depende da ferramenta (no Claude Code, viram comandos `/`). Onde não aparecem, copie o pedido pela Biblioteca |
| Botão **Abrir o Claude (app)** no aviso de "copiado" | Sim | Não se aplica: cole o pedido na ferramenta |
| Imagens dos originais (`tusab_ler_original`) | Sim | Na maioria; depende de a ferramenta aceitar imagem vinda do servidor |
| Instalação | Abrir o `.mcpb` | Passos 1 a 3 |
| Node.js | Vem com o Claude Desktop | Precisa estar instalado (18.17+) |

## Cuidados

- **Uma IA por vez na mesma base.** Cada ferramenta de IA liga o seu próprio Tusab. Duas abertas ao mesmo tempo apontando para a mesma pasta (por exemplo, Claude Desktop e Claude Code) gravariam o mesmo índice e os mesmos arquivos ao mesmo tempo, o que pode corromper a base. Feche uma antes de abrir a outra, ou use uma pasta de base diferente para cada uma.
- **A tela vive enquanto a IA está aberta.** O Tusab é iniciado pela ferramenta de IA e fecha junto com ela; a tela no navegador para de responder quando a IA fecha.
- **O link "Abrir no Tusab" vale só nessa sessão.** A porta e a chave da tela mudam a cada vez que a IA inicia o Tusab; um link antigo não abre. Para ver um material depois, peça "abra o Tusab" e use a aba Materiais.
- **Instale só do repositório oficial.** O Tusab roda com as permissões do seu usuário (o Claude Desktop avisa isso na instalação). Baixe o pacote das [releases](https://github.com/criaugu/tusab/releases) e confira a soma SHA-256.
- **Node.js atualizado.** Nas outras ferramentas, uma versão do Node.js abaixo de 18.17 impede o Tusab de iniciar.

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
