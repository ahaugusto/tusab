#!/usr/bin/env node
// Extrai a secao do CHANGELOG.md da versao atual e grava em release_notes.md,
// que o electron-builder usa como corpo da release (build.releaseInfo.releaseNotesFile
// no electron/package.json). Sem isso a release fica com corpo vazio -- foi
// o que aconteceu na v1.0.41 (instalador macOS publicado sem nenhuma nota).
'use strict';

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Uso: node generate-release-notes.js <versao, ex: 1.0.42>');
  process.exit(1);
}

const repoRoot = path.join(__dirname, '..');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');

const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headerRe = new RegExp(`^## \\[${escaped}\\][^\\n]*\\n`, 'm');
const headerMatch = headerRe.exec(changelog);

const rodape = '\n\n---\n\nVer [CHANGELOG.md](https://github.com/ahaugusto/tusab-public/blob/main/CHANGELOG.md) para o historico completo.';

let notas;
if (!headerMatch) {
  notas = `_Notas de versao nao encontradas no CHANGELOG.md para ${version}._${rodape}`;
} else {
  const start = headerMatch.index + headerMatch[0].length;
  const resto = changelog.slice(start);
  const proximoMatch = /\n## \[|\n---/.exec(resto);
  const corpo = proximoMatch ? resto.slice(0, proximoMatch.index) : resto;
  notas = corpo.trim() + rodape;
}

const outPath = path.join(repoRoot, 'release_notes.md');
fs.writeFileSync(outPath, notas + '\n');
console.log(`Notas de release geradas em ${outPath} para versao ${version}:\n\n${notas}`);
