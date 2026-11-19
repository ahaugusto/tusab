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

## CI

O CI do GitHub (`.github/workflows/ci.yml`) roda a cada push e pull request na `main`, em dois jobs:

| Job | O que faz |
|---|---|
| Extensão | Em `tusab-mcp/`, no Windows, no macOS e no Linux (Node.js 22): `npm ci`, `npm test` e `npx @anthropic-ai/mcpb@2.1.2 validate manifest.json` |
| Tela | No Linux: testes de unidade da interface (`npm run test:unit` em `web_interface/`), build da tela em modo extensão (`npm run build:interface`) e auditoria de acessibilidade com pa11y-ci na tela servida pelo próprio plugin, nos temas claro e escuro (ver [Acessibilidade](/acessibilidade#escopo-do-pa11y-ci)) |

Não há testes em Python nem build do app desktop: esse código está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final).

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

O número da versão tem uma só fonte: `tusab-mcp/package.json`. O servidor (constante `VERSAO` em `src/servidor.js`) e a tela leem dali. O `manifest.json` repete o número, e um teste confere que os dois batem.

## Release

A release é gerada pelo workflow `.github/workflows/release.yml` quando uma etiqueta `vX.Y.Z` é enviada ao GitHub. Ele:

1. confere que a etiqueta, `tusab-mcp/package.json` e `tusab-mcp/manifest.json` têm a mesma versão, que `docs-site/docs/changelog.md` tem a entrada `**vX.Y.Z (...)**` e que as duas páginas de instalação (pt e en) apontam para `releases/download/vX.Y.Z/tusab-X.Y.Z.mcpb`;
2. roda `npm test` e `npm run pack` e renomeia o pacote para `tusab-X.Y.Z.mcpb`;
3. assina o pacote quando o certificado está configurado nos segredos do repositório (sem ele, o pacote sai sem assinatura);
4. gera a soma `tusab-X.Y.Z.mcpb.sha256`;
5. publica a release com os dois arquivos e as notas tiradas da entrada do changelog, **sem marcá-la como a mais recente**. Por isso o link de download nas páginas de instalação leva o número da versão, e nunca `/releases/latest`.

### Como publicar uma versão

1. Subir a versão em `tusab-mcp/package.json` e `tusab-mcp/manifest.json`.
2. Escrever a entrada da versão no changelog (`docs-site/docs/changelog.md` e a versão em inglês).
3. Trocar o link de download nas duas páginas de instalação: `docs-site/docs/instalacao.md` e `docs-site/i18n/en/docusaurus-plugin-content-docs/current/instalacao.md`.
4. Juntar o PR na `main`.
5. Criar e enviar a etiqueta:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

O build e os testes do app desktop descontinuado ficam registrados em [App desktop — desenvolvimento](/desktop/desenvolvimento); o código está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final).
