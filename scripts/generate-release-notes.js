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

// Cabeçalho de instalação — nome exato dos assets que o electron-builder gera
// (ver build.win.artifactName/build.mac.target no electron/package.json).
// Sem isso o usuário chega na página de release e só vê uma lista de arquivos
// sem saber qual baixar (.exe vs .dmg vs .zip vs .blockmap/.yml, que são
// internos do auto-updater, não pra baixar manualmente).
const cabecalho = `## Download

| Plataforma | Requisito | Arquivo |
|---|---|---|
| Windows 10/11 x64 | — | [Tusab-Setup-${version}.exe](https://github.com/ahaugusto/tusab-public/releases/download/v${version}/Tusab-Setup-${version}.exe) |
| macOS (Apple Silicon — M1 ou superior) | macOS 14 (Sonoma)+ | [Tusab-${version}-arm64.dmg](https://github.com/ahaugusto/tusab-public/releases/download/v${version}/Tusab-${version}-arm64.dmg) |

macOS Intel não é suportado. Ignore os arquivos \`.blockmap\` e \`.yml\` — são usados pelo auto-updater, não para instalação manual.

---
`;

const rodape = '\n\n---\n\nVer [CHANGELOG.md](https://github.com/ahaugusto/tusab-public/blob/main/CHANGELOG.md) para o historico completo.';

// Seção "### Interno (...)" é conteúdo de desenvolvimento (CI, infra,
// processo) sem valor pra quem baixa o app -- fica documentada no
// CHANGELOG.md do repo, mas nunca vai pro corpo da release publicada.
// Só removida aqui, na extração; a fonte de verdade (CHANGELOG.md) fica intacta.
function removerSecaoInterna(corpo) {
  return corpo.replace(/### Interno\b[^\n]*\n[\s\S]*?(?=\n### |\n---|$)/, '').trim();
}

let notas;
if (!headerMatch) {
  notas = cabecalho + `_Notas de versao nao encontradas no CHANGELOG.md para ${version}._${rodape}`;
} else {
  const start = headerMatch.index + headerMatch[0].length;
  const resto = changelog.slice(start);
  const proximoMatch = /\n## \[|\n---/.exec(resto);
  const corpo = proximoMatch ? resto.slice(0, proximoMatch.index) : resto;
  notas = cabecalho + removerSecaoInterna(corpo.trim()) + rodape;
}

const outPath = path.join(repoRoot, 'release_notes.md');
fs.writeFileSync(outPath, notas + '\n');
console.log(`Notas de release geradas em ${outPath} para versao ${version}:\n\n${notas}`);
