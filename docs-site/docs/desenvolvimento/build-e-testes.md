---
id: build-e-testes
title: Build e testes
sidebar_label: Build e testes
slug: /desenvolvimento/build-e-testes
---

# Build e testes

Comandos em `tusab-mcp/`.

## Testes

```powershell
npm test
```

Roda `node --test` em `test/*.test.js` com `test/_ambiente.js` carregado antes (força `TUSAB_IDIOMA=pt`, para os testes rodarem em português em qualquer sistema). Os testes não usam rede: o yt-dlp é substituído por `test/ytdlp-falso.mjs`.

| Arquivo | Cobre |
|---|---|
| `servidor.test.js`, `estudo-mcp.test.js` | Servidor MCP com um cliente MCP real: ferramentas, prompts, memória de estudo |
| `painel.test.js` | Segurança do servidor local (chave, `Host`, `Origin`, CORS, CSP) e rotas da API |
| `motor.test.js`, `legendas.test.js`, `atualizacao.test.js` | Extração, divisão em trechos, fila, atualização automática |
| `documentos.test.js`, `originais.test.js`, `exportar.test.js` | Leitura de documentos, originais, `.tusab` e exportações |
| `fontes.test.js`, `fontes-api.test.js` | Fontes públicas com respostas simuladas; a rota `/fontes` confere as 11 áreas e 70 fontes |
| `estudo.test.js` | Formato de estudo e revisão espaçada SM-2 |
| `idioma.test.js` | Dicionários `en`/`es` completos e com as mesmas variáveis; prompts e ferramentas mudando de idioma |
| `extras.test.js` | "Meus prompts" e pastas, remoção de metadados das imagens, economia de tokens, espaço ocupado no repositório |

O CI do GitHub (`.github/workflows/ci.yml`) hoje roda os testes do app desktop e o build da interface; os testes do plugin rodam localmente com `npm test`.

## Gerar o pacote `.mcpb`

```powershell
npm run pack
```

Em sequência:

1. `npm run build:interface`: compila `web_interface/` em modo extensão para `tusab-mcp/interface/`;
2. `node scripts/gerar-licencas.mjs`: copia `LICENSE` e `TRADEMARK.md` da raiz e gera `THIRD_PARTY_NOTICES.txt` com a licença completa de cada biblioteca embutida (plugin e tela), porque a tela compilada perde os comentários de licença;
3. `npx --yes @anthropic-ai/mcpb@2.1.2 pack . ../tusab.mcpb`: empacota.

O arquivo sai em `tusab.mcpb`, na raiz do repositório. `.mcpbignore` deixa de fora testes, scripts, `README.md`, mapas de código e partes do `pdfjs-dist` e do `pdfkit` que o plugin não usa (versões para navegador, visualizador, componente nativo opcional de desenho).

## Textos do manifesto em outros idiomas

```powershell
node scripts/gerar-recursos-manifesto.mjs
```

Gera `mcpb-resources/en-US.json` e `es-ES.json` (nome, descrição, ferramentas e atalhos que o Claude Desktop mostra na tela de extensões), a partir dos textos de `src/nucleo/prompts.js` e dos dicionários. O `manifest.json` fica em pt-BR (`default_locale`). Rode depois de mudar ferramentas ou prompts.

## Avisos de licença

`node scripts/gerar-licencas.mjs` também pode ser rodado sozinho. As bibliotecas do plugin e da tela têm licenças permissivas (MIT, ISC, BSD, Apache-2.0, BlueOak); o texto de cada uma vai em `THIRD_PARTY_NOTICES.txt` dentro do pacote.

## Versão

A versão aparece em três lugares, que precisam andar juntos: `tusab-mcp/package.json`, `tusab-mcp/manifest.json` e a constante `VERSAO` em `src/servidor.js`.

O app desktop tem build e testes próprios: ver [App desktop — desenvolvimento](/desktop/desenvolvimento).
