// Coleta as frases que o plugin traduz: chaves literais de t('...') e tn(n, '...', '...') no código,
// os rótulos de formato de documento, os status do motor e os textos do catálogo de fontes.
// Usado pelo teste de traduções (idioma.test.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textosDoCatalogo } from '../src/fontes/index.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Literal JS ('...' ou "...") → texto. */
function desescapar(lit) {
  const corpo = lit.slice(1, -1);
  return corpo.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c.startsWith('u{')) return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
    if (c.startsWith('u') && c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    return c;
  });
}

const LIT = String.raw`('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")`;
const RE_T = new RegExp(String.raw`(?<![\w.$])t\(\s*` + LIT, 'g');
const RE_TN = new RegExp(String.raw`(?<![\w.$])tn\([^,]+,\s*` + LIT + String.raw`\s*,\s*` + LIT, 'g');
// Títulos das ferramentas MCP: registrar('nome', { title: '...' }) passa o título por t() ao registrar.
const RE_TITULO = new RegExp(String.raw`registrar\(\s*'[^']+',\s*\{\s*title:\s*` + LIT, 'g');

function arquivosJs(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'textos') saida.push(...arquivosJs(p)); } else if (e.name.endsWith('.js')) saida.push(p);
  }
  return saida;
}

/** Status do motor e das buscas: são códigos de estado (comparados no código), traduzidos só na exibição. */
export const STATUS = ['Ocioso', 'Iniciando', 'Mapeando YouTube', 'Extraindo legendas', 'Minerando YouTube', 'Em Pausa',
  'Cancelando...', 'Interrompido', 'Finalizado ✓', 'Erro', 'Na fila'];

export function chavesDoCodigo() {
  const chaves = new Map(); // chave → primeiro arquivo onde aparece
  for (const arq of arquivosJs(SRC)) {
    const codigo = fs.readFileSync(arq, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/gm, '$1');
    const rel = path.relative(SRC, arq);
    for (const m of [...codigo.matchAll(RE_T), ...codigo.matchAll(RE_TITULO)]) {
      if (!chaves.has(desescapar(m[1]))) chaves.set(desescapar(m[1]), rel);
    }
    for (const m of codigo.matchAll(RE_TN)) {
      for (const lit of [m[1], m[2]]) if (!chaves.has(desescapar(lit))) chaves.set(desescapar(lit), rel);
    }
  }
  return chaves;
}

export const ROTULOS_FORMATO = ['WhatsApp (Android)', 'WhatsApp (iOS)', 'Zoom', 'Otter.ai', 'Microsoft Teams', 'Petição jurídica', 'Contrato', 'Parecer jurídico'];

export function todasAsChaves() {
  return [...new Set([...chavesDoCodigo().keys(), ...STATUS, ...ROTULOS_FORMATO, ...textosDoCatalogo()])];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const destino = process.argv[2];
  const lista = todasAsChaves();
  if (destino) fs.writeFileSync(destino, JSON.stringify(lista, null, 1));
  console.log(`${lista.length} frases`);
}
