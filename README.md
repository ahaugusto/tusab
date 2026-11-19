# Tusab

Extensão para ferramentas de IA (como o Claude Desktop) que mantém a base de conhecimento do usuário **no computador dele** e entrega à IA só os trechos certos, **com citação**: o vídeo e o minuto, ou a página do PDF.

Tecnicamente, é um servidor [MCP](https://modelcontextprotocol.io) local em Node.js (`tusab-mcp/`, versão 0.6.0). A ferramenta de IA inicia o processo no próprio computador; ele extrai transcrições do YouTube, lê documentos e busca em fontes públicas, indexa tudo numa pasta local (SQLite FTS5), responde à IA por 15 ferramentas MCP e serve uma tela no navegador em `http://127.0.0.1:<porta>`. Nada passa por servidor da CriAugu: só os trechos consultados vão para a IA que o usuário escolheu.

**Documentação:** https://criaugu.github.io/tusab/

## O que faz

- **Busca com citação** (`tusab_buscar`): trechos com título, minuto `▶ MM:SS` e link `&t=Ns`; leitura de uma fonte em ordem e do arquivo original (imagem sem EXIF/GPS, PDF por páginas).
- **Extração do YouTube** no IP do usuário (canal, playlist ou vídeo), com fila, pausa e atualização automática de canais, usando o yt-dlp oficial (baixado com conferência SHA-256 se não houver).
- **Documentos:** PDF, Word, Excel, CSV, TXT/Markdown, FHIR e páginas web (respeitando `robots.txt`), com os originais guardados.
- **70 fontes públicas** em 11 áreas (artigos, teses, legislação, jurisprudência, dados abertos), sem cadastro nem chave de API.
- **Biblioteca de Prompts:** 21 prompts prontos no menu "+" do Claude e na tela, com regras fixas de busca e citação, e prompts próprios do usuário.
- **Memória de estudo:** a IA gera flashcards e resumos; o Tusab guarda e faz a revisão espaçada (SM-2).
- **Exportar/importar** `.tusab`, zip da base, tabela de vídeos (XLSX) e relatório em PDF.
- **Três idiomas** (pt, en, es) e estimativa local de economia de tokens.

## Instalação

### Claude Desktop (`.mcpb`)

O pacote `tusab.mcpb` ainda não é publicado nas releases; gere a partir do código (Node.js 18.17+):

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab/web_interface
npm install
cd ../tusab-mcp
npm install
npm run pack          # gera ../tusab.mcpb
```

Abra o `tusab.mcpb` no Claude Desktop e escolha a pasta do repositório (o Tusab cria `data/` dentro dela).

### Outras ferramentas MCP (Claude Code, VS Code, Cursor…)

Depois de `npm install` e `npm run build:interface` em `tusab-mcp/`:

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

Detalhes em [Instalação](https://criaugu.github.io/tusab/instalacao).

## Estrutura do repositório

```
tusab/
  tusab-mcp/          a extensão: servidor MCP em Node.js
    src/                servidor.js (MCP), painel.js (tela local), api.js, cli.js
    src/nucleo/         motor de extração, índice, documentos, originais, prompts, idiomas, estudo
    src/fontes/         as 70 fontes públicas
    test/               testes (node --test)
    scripts/            avisos de licença e textos do manifesto em en/es
    manifest.json       manifesto do pacote .mcpb
  web_interface/      interface React (tela da extensão e do app desktop)
  tusab_engine/       backend Python do app desktop (FastAPI)
  electron/           casca do app desktop (Electron)
  tests/              testes do backend do app desktop (pytest)
  docs-site/          site de documentação (Docusaurus)
  docs/design-system/ design system da interface
```

## Desenvolvimento e testes (extensão)

```powershell
cd tusab-mcp
npm install
npm test                         # testes sem rede (yt-dlp simulado)
npm run build:interface          # compila a tela (vite build --mode extensao)

$env:TUSAB_REPOSITORIO = "C:\caminho\teste"
npm run painel                   # abre a tela sem ferramenta de IA (Ctrl+C fecha)
node src/cli.js youtube https://www.youtube.com/@canal Projeto 5
node src/cli.js buscar "consulta" Projeto
node src/cli.js medir-tokens perguntas.txt Projeto

npm run pack                     # pacote ../tusab.mcpb
node scripts/gerar-licencas.mjs              # THIRD_PARTY_NOTICES.txt do pacote
node scripts/gerar-recursos-manifesto.mjs    # mcpb-resources/en-US.json e es-ES.json
```

`TUSAB_YTDLP=test/ytdlp-falso.mjs` troca o yt-dlp por um simulado. Mais em [Desenvolvimento](https://criaugu.github.io/tusab/desenvolvimento/setup).

## App desktop (versão anterior)

Antes da extensão, o Tusab era um app desktop (Electron + FastAPI + React) com chat próprio (RAG com Ollama ou provedor externo). Ele continua disponível para Windows 10/11 x64 e macOS 14+ (Apple Silicon) nas [releases](https://github.com/criaugu/tusab/releases/latest) e grava a mesma estrutura de pastas da extensão.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd web_interface; npm install; cd ..
cd electron; npm install; cd ..

.venv\Scripts\python.exe api_tusab.py           # backend em localhost:8001
cd web_interface; npm run dev                    # interface com recarga automática
.venv\Scripts\python.exe -m pytest tests/ -v     # testes
```

Documentação: [App desktop](https://criaugu.github.io/tusab/desktop/visao-geral). Histórico de versões: [CHANGELOG.md](CHANGELOG.md).

## Licença

Copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57.

Código source-available sob a [Elastic License 2.0](LICENSE): pode ser lido, auditado, executado e modificado para uso próprio; não pode ser oferecido como serviço hospedado a terceiros. O nome e a marca "Tusab" não estão cobertos pela licença de código ([TRADEMARK.md](TRADEMARK.md)). Bibliotecas de terceiros: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (repositório e app desktop) e `tusab-mcp/THIRD_PARTY_NOTICES.txt` (extensão). Pull Requests externos não são aceitos no momento ([CONTRIBUTING.md](CONTRIBUTING.md)).
