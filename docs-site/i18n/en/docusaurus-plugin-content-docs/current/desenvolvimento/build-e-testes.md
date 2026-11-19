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

## CI

GitHub CI (`.github/workflows/ci.yml`) runs on every push and pull request to `main`, in two jobs:

| Job | What it does |
|---|---|
| Extension | In `tusab-mcp/`, on Windows, macOS and Linux (Node.js 22): `npm ci`, `npm test` and `npx @anthropic-ai/mcpb@2.1.2 validate manifest.json` |
| Screen | On Linux: interface unit tests (`npm run test:unit` in `web_interface/`), build of the screen in extension mode (`npm run build:interface`) and an accessibility audit with pa11y-ci on the screen served by the plugin itself, in light and dark themes (see [Accessibility](/acessibilidade#pa11y-ci-scope)) |

There are no Python tests or desktop app builds: that code is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag.

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

The version number has a single source: `tusab-mcp/package.json`. The server (the `VERSAO` constant in `src/servidor.js`) and the screen read it from there. `manifest.json` repeats the number, and a test checks that both match.

## Release

The release is built by the `.github/workflows/release.yml` workflow when a `vX.Y.Z` tag is pushed to GitHub. It:

1. checks that the tag, `tusab-mcp/package.json` and `tusab-mcp/manifest.json` have the same version, that `docs-site/docs/changelog.md` has the `**vX.Y.Z (...)**` entry and that both installation pages (pt and en) point to `releases/download/vX.Y.Z/tusab-X.Y.Z.mcpb`;
2. runs `npm test` and `npm run pack` and renames the package to `tusab-X.Y.Z.mcpb`;
3. signs the package when the certificate is configured in the repository secrets (without it, the package is unsigned);
4. generates the `tusab-X.Y.Z.mcpb.sha256` checksum;
5. publishes the release with both files and notes taken from the changelog entry, **without marking it as the latest**. That is why the download link on the installation pages carries the version number, never `/releases/latest`.

### How to publish a version

1. Bump the version in `tusab-mcp/package.json` and `tusab-mcp/manifest.json`.
2. Write the version's changelog entry (`docs-site/docs/changelog.md` and its English version).
3. Change the download link on both installation pages: `docs-site/docs/instalacao.md` and `docs-site/i18n/en/docusaurus-plugin-content-docs/current/instalacao.md`.
4. Merge the PR into `main`.
5. Create and push the tag:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

The discontinued desktop app's build and tests are recorded in [Desktop app — development](/desktop/desenvolvimento); its code is in the [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final) tag.
