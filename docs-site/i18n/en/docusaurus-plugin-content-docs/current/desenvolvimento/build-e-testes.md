---
id: build-e-testes
title: Build and tests
sidebar_label: Build and tests
slug: /desenvolvimento/build-e-testes
---

# Build and tests

Commands in `tusab-mcp/`.

## Tests

```powershell
npm test
```

Runs `node --test` on `test/*.test.js` with `test/_ambiente.js` loaded first (it forces `TUSAB_IDIOMA=pt`, so tests run in Portuguese on any system). Tests use no network: yt-dlp is replaced by `test/ytdlp-falso.mjs`.

| File | Covers |
|---|---|
| `servidor.test.js`, `estudo-mcp.test.js` | MCP server with a real MCP client: tools, prompts, study memory |
| `painel.test.js` | Local server security (key, `Host`, `Origin`, CORS, CSP) and API routes |
| `motor.test.js`, `legendas.test.js`, `atualizacao.test.js` | Extraction, splitting into excerpts, queue, automatic updates |
| `documentos.test.js`, `originais.test.js`, `exportar.test.js` | Document reading, originals, `.tusab` and exports |
| `fontes.test.js`, `fontes-api.test.js` | Public sources with simulated responses; the `/fontes` route checks the 11 areas and 70 sources |
| `estudo.test.js` | Study format and SM-2 spaced repetition |
| `idioma.test.js` | `en`/`es` dictionaries complete and with the same variables; prompts and tools changing language |
| `extras.test.js` | "My prompts" and folders, image metadata removal, token savings, repository space used |

GitHub CI (`.github/workflows/ci.yml`) currently runs the desktop app's tests and the interface build; the plugin's tests run locally with `npm test`.

## Building the `.mcpb` package

```powershell
npm run pack
```

In sequence:

1. `npm run build:interface`: builds `web_interface/` in extension mode into `tusab-mcp/interface/`;
2. `node scripts/gerar-licencas.mjs`: copies `LICENSE` and `TRADEMARK.md` from the root and generates `THIRD_PARTY_NOTICES.txt` with the full license of every bundled library (plugin and screen), because the built screen loses the license comments;
3. `npx --yes @anthropic-ai/mcpb@2.1.2 pack . ../tusab.mcpb`: packs it.

The file is written to `tusab.mcpb`, at the repository root. `.mcpbignore` leaves out tests, scripts, `README.md`, source maps and parts of `pdfjs-dist` and `pdfkit` the plugin doesn't use (browser builds, viewer, optional native rendering component).

## Manifest texts in other languages

```powershell
node scripts/gerar-recursos-manifesto.mjs
```

Generates `mcpb-resources/en-US.json` and `es-ES.json` (name, description, tools and shortcuts that Claude Desktop shows on its extensions screen), from the texts in `src/nucleo/prompts.js` and the dictionaries. `manifest.json` stays in pt-BR (`default_locale`). Run it after changing tools or prompts.

## License notices

`node scripts/gerar-licencas.mjs` can also be run on its own. The plugin's and the screen's libraries use permissive licenses (MIT, ISC, BSD, Apache-2.0, BlueOak); each one's text goes into `THIRD_PARTY_NOTICES.txt` inside the package.

## Version

The version appears in three places that must move together: `tusab-mcp/package.json`, `tusab-mcp/manifest.json` and the `VERSAO` constant in `src/servidor.js`.

The desktop app has its own build and tests: see [Desktop app — development](/desktop/desenvolvimento).
