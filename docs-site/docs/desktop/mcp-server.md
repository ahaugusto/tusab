---
id: mcp-server
title: App desktop — servidor MCP
sidebar_label: Servidor MCP do desktop
slug: /funcionalidades/mcp-server
---

# App desktop — servidor MCP

:::warning App desktop descontinuado
O app desktop foi descontinuado em 19/11/2026 e não recebe mais correções nem atualizações. O código citado nesta página está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), não mais no `main`. Esta página é mantida só como registro.
:::

O repositório tem **dois servidores MCP** diferentes. Esta página trata do servidor que acompanha o **app desktop**. O Tusab em si, distribuído como extensão de IA, é o outro: ver [Ferramentas MCP](/ferramentas-mcp) e [Arquitetura](/arquitetura/visao-geral).

| | Servidor do desktop | Extensão de IA |
|---|---|---|
| Código | `tusab_engine/mcp_server.py` (Python) | `tusab-mcp/` (Node.js) |
| Transporte | stdio, JSON-RPC 2.0 linha por linha | stdio, SDK oficial do MCP |
| Ferramentas | 2: `search_knowledge`, `list_projects` | [15](/ferramentas-mcp): busca, leitura, extração, fontes públicas, estudo, originais, economia de tokens… |
| Prompts | — | 21 prompts prontos + `abrir_tusab` |
| Índice | Índice do desktop (`data/agent_index/`), busca BM25 do Assistente | SQLite FTS5 próprio (`data/tusab.sqlite`), sincronizado a partir dos `.txt` |
| Tela | Não serve tela (o app desktop é a tela) | Serve a tela do Tusab em `127.0.0.1` |
| Instalação | Configuração copiada do app (abaixo) | Pacote `.mcpb` ou configuração `node src/index.js` |

Os dois leem a mesma estrutura de pastas, mas cada um usa o seu índice.

## Como conectar

1. No app desktop, abra a aba **Admin**.
2. Clique em **Copiar configuração MCP**.
3. Cole a configuração no cliente MCP (Claude Code, Cursor, Continue.dev…).

A configuração vem de `GET /agent/mcp/config` e aponta para o Python do próprio app e o caminho de `tusab_engine/mcp_server.py`:

```json
{
  "mcpServers": {
    "tusab": {
      "command": "<python do Tusab>",
      "args": ["<...>/tusab_engine/mcp_server.py"]
    }
  }
}
```

## Ferramentas

| Ferramenta | Parâmetros | O que faz |
|---|---|---|
| `search_knowledge` | `query` (obrigatório); `project` (sem ele, usa o projeto indexado na configuração do Assistente ou o primeiro disponível); `top_k` (padrão 6) | Busca BM25 na base indexada pelo desktop e devolve título, texto, link, data, canal e pontuação de cada trecho |
| `list_projects` | — | Lista os projetos que têm arquivo de índice em `data/agent_index/` |

Fica disponível tudo o que está no índice do desktop: transcrições, documentos, textos e os artefatos do [Modo Estudo](/funcionalidades/modo-estudo).
