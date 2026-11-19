// Prepara os textos de licença que vão dentro do pacote .mcpb:
//  - LICENSE e TRADEMARK.md do Tusab (cópia dos da raiz do repositório; o pacote não leva a raiz);
//  - THIRD_PARTY_NOTICES.txt: cada biblioteca embutida (plugin e tela) com a licença por inteiro.
//    MIT, ISC, BSD e Apache exigem que o aviso acompanhe as cópias; a tela compilada perde os
//    comentários de licença, então os avisos ficam neste arquivo.
// Roda sozinho no `npm run pack`. Uso manual: node scripts/gerar-licencas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = fileURLToPath(new URL('../', import.meta.url));
const repo = path.resolve(plugin, '..');
const tela = path.join(repo, 'web_interface');

for (const nome of ['LICENSE', 'TRADEMARK.md']) {
  fs.copyFileSync(path.join(repo, nome), path.join(plugin, nome));
}

/** Pacotes de produção a partir do package.json (dependências e opcionais, recursivo). */
function arvore(raiz) {
  const vistos = new Map();
  const achar = (nome, de) => {
    for (let d = de; ; d = path.dirname(d)) {
      const p = path.join(d, 'node_modules', nome);
      if (fs.existsSync(path.join(p, 'package.json'))) return p;
      if (path.dirname(d) === d) return null;
    }
  };
  const visitar = (nome, de) => {
    const dir = achar(nome, de);
    if (!dir || vistos.has(dir)) return;
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    vistos.set(dir, pkg);
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) visitar(dep, dir);
  };
  const raizPkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  for (const dep of Object.keys(raizPkg.dependencies || {})) visitar(dep, raiz);
  return vistos;
}

const licencaDe = (pkg) => (typeof pkg.license === 'string' ? pkg.license
  : pkg.license?.type || (pkg.licenses || []).map((l) => l.type || l).join(' OR ') || 'ver o repositório do pacote');
const autorDe = (pkg) => (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '');
const repoDe = (pkg) => {
  const r = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  return (r || pkg.homepage || '').replace(/^git\+/, '').replace(/\.git$/, '');
};

// Textos usados quando o pacote não traz o próprio arquivo de licença.
const textoApache = fs.readFileSync(path.join(plugin, 'node_modules', 'pdfjs-dist', 'LICENSE'), 'utf8');
const textoMit = (autor) => `MIT License\n\nCopyright (c) ${autor || 'the authors'}\n\n`
  + 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated '
  + 'documentation files (the "Software"), to deal in the Software without restriction, including without limitation '
  + 'the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to '
  + 'permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\n'
  + 'The above copyright notice and this permission notice shall be included in all copies or substantial portions of '
  + 'the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT '
  + 'NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT '
  + 'SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF '
  + 'CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS '
  + 'IN THE SOFTWARE.\n';

function textoDaLicenca(dir, pkg) {
  const arquivos = fs.readdirSync(dir).filter((f) => /^(licen[sc]e|copying|notice)/i.test(f)).sort();
  if (arquivos.length) return arquivos.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim()).join('\n\n');
  const lic = licencaDe(pkg);
  if (/Apache-2\.0/.test(lic)) return textoApache.trim();
  if (/^MIT/.test(lic)) return textoMit(autorDe(pkg)).trim();
  return `Licença declarada: ${lic}. O pacote não traz arquivo de licença; ver ${repoDe(pkg) || 'o registro npm'}.`;
}

const secoes = [['Plugin (servidor local do Tusab)', arvore(plugin)], ['Tela do Tusab (interface)', arvore(tela)]];
const linhas = [
  'AVISOS DE TERCEIROS — Tusab (extensão)',
  '',
  'O Tusab é distribuído sob a Elastic License 2.0 (ver LICENSE). Ele usa as bibliotecas abaixo, sem',
  'modificação, nos termos das licenças de cada uma, reproduzidas aqui por inteiro. Também usa o yt-dlp',
  '(Unlicense), baixado do GitHub oficial no computador do usuário na primeira extração.',
  '',
];
const resumo = [];
for (const [titulo, pacotes] of secoes) {
  const lista = [...pacotes.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  linhas.push('='.repeat(78), `${titulo}: ${lista.length} pacotes`, '='.repeat(78), '');
  for (const [dir, pkg] of lista) {
    linhas.push('-'.repeat(78), `${pkg.name}@${pkg.version} — ${licencaDe(pkg)}`);
    if (repoDe(pkg)) linhas.push(repoDe(pkg));
    linhas.push('-'.repeat(78), textoDaLicenca(dir, pkg), '');
  }
  resumo.push(`${titulo}: ${lista.length}`);
}
fs.writeFileSync(path.join(plugin, 'THIRD_PARTY_NOTICES.txt'), `${linhas.join('\n')}\n`);
console.log(`LICENSE, TRADEMARK.md e THIRD_PARTY_NOTICES.txt prontos (${resumo.join(' · ')}).`);
