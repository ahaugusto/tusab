#!/usr/bin/env node
// Hook "pre" dos scripts de build do electron/package.json. A partir do
// electron-builder 26.17, build.releaseInfo.releaseNotesFile apontando pra um
// arquivo inexistente derruba o build inteiro ("cannot find specified resource
// ../release_notes.md") — antes era ignorado em silêncio. O release.yml gera o
// arquivo com as notas reais (CHANGELOG + PRs) antes de buildar; builds locais
// e o macos-smoke.yml não geravam e passaram a quebrar.
//
// Só gera quando o arquivo NÃO existe: nunca sobrescreve o release_notes.md
// mais completo que o release.yml já montou (com auto_notes.md anexado).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const destino = path.join(repoRoot, 'release_notes.md');

if (fs.existsSync(destino)) {
  console.log(`release_notes.md já existe — mantido (${destino})`);
  process.exit(0);
}

const versao = require(path.join(repoRoot, 'electron', 'package.json')).version;
execFileSync(process.execPath, [path.join(__dirname, 'generate-release-notes.js'), versao], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
console.log(`release_notes.md gerado para a versão ${versao}`);
