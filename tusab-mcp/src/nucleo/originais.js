// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Arquivos originais guardados no repositório. O texto extraído é o índice (barato em
// tokens); o original fica no computador do usuário e a IA o lê só quando precisa.
//
// Regras de segurança (parecer de /seguranca, 17/11/2026):
//   - o caminho do original NUNCA vem do manifesto: é sempre derivado por convenção
//     documents/originais/{id}_{nomeLimpo}{ext}, com id ^[0-9a-f]{8}$ e ext da lista;
//   - só tipos da lista, conferidos pela assinatura (primeiros bytes), não só pela extensão;
//     SVG, HTML e executáveis são recusados;
//   - o arquivo é guardado inerte: nunca é aberto com o programa padrão pelo Tusab.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dentroDe, escreverAtomico } from './caminhos.js';
import { t } from './idioma.js';

const ini = (b, ...bytes) => bytes.every((v, i) => b[i] === v);
const ascii = (b, pos, s) => b.length >= pos + s.length && b.subarray(pos, pos + s.length).toString('latin1') === s;
const semNulo = (b) => !b.subarray(0, 8192).includes(0);

/** ext → { categoria, mime, confere(bytes) } */
export const TIPOS = {
  '.pdf': { categoria: 'documento', mime: 'application/pdf', confere: (b) => ascii(b, 0, '%PDF-') },
  '.docx': { categoria: 'documento', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', confere: (b) => ini(b, 0x50, 0x4b, 0x03, 0x04) },
  '.xlsx': { categoria: 'documento', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', confere: (b) => ini(b, 0x50, 0x4b, 0x03, 0x04) },
  '.csv': { categoria: 'texto', mime: 'text/csv', confere: semNulo },
  '.txt': { categoria: 'texto', mime: 'text/plain', confere: semNulo },
  '.md': { categoria: 'texto', mime: 'text/markdown', confere: semNulo },
  '.json': { categoria: 'texto', mime: 'application/json', confere: semNulo },
  '.png': { categoria: 'imagem', mime: 'image/png', confere: (b) => ini(b, 0x89, 0x50, 0x4e, 0x47) },
  '.jpg': { categoria: 'imagem', mime: 'image/jpeg', confere: (b) => ini(b, 0xff, 0xd8, 0xff) },
  '.jpeg': { categoria: 'imagem', mime: 'image/jpeg', confere: (b) => ini(b, 0xff, 0xd8, 0xff) },
  '.gif': { categoria: 'imagem', mime: 'image/gif', confere: (b) => ascii(b, 0, 'GIF8') },
  '.webp': { categoria: 'imagem', mime: 'image/webp', confere: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  '.mp3': { categoria: 'audio', mime: 'audio/mpeg', confere: (b) => ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  '.wav': { categoria: 'audio', mime: 'audio/wav', confere: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE') },
  '.ogg': { categoria: 'audio', mime: 'audio/ogg', confere: (b) => ascii(b, 0, 'OggS') },
  '.opus': { categoria: 'audio', mime: 'audio/ogg', confere: (b) => ascii(b, 0, 'OggS') },
  '.flac': { categoria: 'audio', mime: 'audio/flac', confere: (b) => ascii(b, 0, 'fLaC') },
  '.m4a': { categoria: 'audio', mime: 'audio/mp4', confere: (b) => ascii(b, 4, 'ftyp') },
  '.aac': { categoria: 'audio', mime: 'audio/aac', confere: (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0 },
};

export const IMAGENS_PARA_IA = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const LIMITE_IMAGEM_IA = 3 * 1024 * 1024; // base64 ~4 MB: dentro do que ferramentas de IA aceitam
export const extensaoDe = (nome) => (String(nome).match(/\.[^.\\/]+$/)?.[0] || '').toLowerCase();
export const nomeLimpo = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'arquivo';
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Confere tipo pela extensão E pela assinatura. Lança Error com mensagem ao usuário. */
export function verificarArquivo(nome, bytes) {
  const ext = extensaoDe(nome);
  const tipo = TIPOS[ext];
  if (!tipo) {
    throw new Error(t('Formato não suportado: {ext}. Aceitos: PDF, Word, Excel, CSV, TXT, Markdown, JSON (FHIR), imagens (PNG, JPG, GIF, WebP) e áudio (MP3, WAV, M4A, OGG, FLAC).', { ext: ext || t('sem extensão') }));
  }
  if (!bytes.length || !tipo.confere(bytes)) {
    throw new Error(t('O conteúdo de "{nome}" não corresponde a um arquivo {tipo} válido.', { nome, tipo: ext.slice(1).toUpperCase() }));
  }
  return { ext, ...tipo };
}

/** Caminho do original por convenção — nunca a partir de um caminho do manifesto. */
export function caminhoOriginal(dirDocumentos, { id, nome_original: nome } = {}) {
  if (!/^[0-9a-f]{8}$/.test(String(id || ''))) return null;
  const ext = extensaoDe(nome);
  if (!TIPOS[ext]) return null;
  const dir = path.join(dirDocumentos, 'originais');
  const alvo = path.join(dir, `${id}_${nomeLimpo(String(nome).slice(0, -ext.length))}${ext}`);
  return dentroDe(dir, alvo) ? alvo : null;
}

export function gravarOriginal(dirDocumentos, entrada, bytes) {
  const alvo = caminhoOriginal(dirDocumentos, entrada);
  if (!alvo) throw new Error(t('Não foi possível guardar o original.'));
  escreverAtomico(alvo, bytes);
  return alvo;
}

/** Caminho do original se ele existir de verdade (e não for link para fora). */
export function localizarOriginal(dirDocumentos, entrada) {
  const alvo = caminhoOriginal(dirDocumentos, entrada);
  if (!alvo || !fs.existsSync(alvo)) return null;
  try {
    const real = fs.realpathSync(alvo);
    const base = fs.realpathSync(path.join(dirDocumentos, 'originais'));
    if (!dentroDe(base, real) || !fs.statSync(real).isFile()) return null;
    return real;
  } catch {
    return null;
  }
}

export function apagarOriginal(dirDocumentos, entrada) {
  const alvo = caminhoOriginal(dirDocumentos, entrada);
  if (alvo) fs.rmSync(alvo, { force: true });
}

/**
 * A partir de uma fonte do índice (tipo documento), acha a entrada do manifesto e o original.
 * O índice aponta o .txt; o id vem do nome desse .txt e o original sai por convenção.
 * → { dirDocumentos, entrada, caminho|null, relativo|null } ou null se não for um documento do Tusab.
 */
export function originalDaFonte(raiz, fonte) {
  if (!fonte || fonte.tipo !== 'documento' || typeof fonte.arquivo !== 'string') return null;
  const txt = path.resolve(raiz, fonte.arquivo);
  const dirDocumentos = path.dirname(txt);
  if (!dentroDe(path.join(raiz, 'data', 'neural'), txt) || path.basename(dirDocumentos) !== 'documents') return null;
  const id = path.basename(txt).match(/^([0-9a-f]{8})_/)?.[1];
  if (!id) return null;
  let manifesto = [];
  try { manifesto = JSON.parse(fs.readFileSync(path.join(dirDocumentos, '_manifest.json'), 'utf8')); } catch { return null; }
  const entrada = Array.isArray(manifesto) ? manifesto.find((e) => e && e.id === id) : null;
  if (!entrada) return null;
  const caminho = localizarOriginal(dirDocumentos, entrada);
  return {
    dirDocumentos,
    entrada,
    caminho,
    // Caminho relativo ao repositório (não expõe o nome de usuário do computador).
    relativo: caminho ? path.relative(raiz, caminho).split(path.sep).join('/') : null,
  };
}

// ── Metadados de imagem (EXIF com GPS, XMP, IPTC, comentários) ───────────────
// Removidos só da cópia enviada à IA; o original guardado fica intacto.

function jpegSemMetadados(b) {
  if (!(b[0] === 0xff && b[1] === 0xd8)) return null;
  const partes = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null; // estrutura inesperada: não dá para garantir a limpeza
    const marcador = b[i + 1];
    if (marcador === 0xda) { partes.push(b.subarray(i)); return Buffer.concat(partes); } // SOS: daqui em diante é imagem
    const tamanho = b.readUInt16BE(i + 2);
    const fim = i + 2 + tamanho;
    if (tamanho < 2 || fim > b.length) return null;
    // APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) e COM (comentário) saem; o resto fica (inclusive APP2/ICC).
    if (![0xe1, 0xed, 0xfe].includes(marcador)) partes.push(b.subarray(i, fim));
    i = fim;
  }
  return null;
}

function pngSemMetadados(b) {
  const partes = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const tamanho = b.readUInt32BE(i);
    const tipo = b.subarray(i + 4, i + 8).toString('latin1');
    const fim = i + 12 + tamanho;
    if (fim > b.length) return null;
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(tipo)) partes.push(b.subarray(i, fim));
    i = fim;
    if (tipo === 'IEND') break;
  }
  return Buffer.concat(partes);
}

function webpSemMetadados(b) {
  if (!(ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'))) return null;
  const partes = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const tipo = b.subarray(i, i + 4).toString('latin1');
    const tamanho = b.readUInt32LE(i + 4);
    const fim = i + 8 + tamanho + (tamanho % 2);
    if (fim > b.length + 1) return null;
    if (tipo !== 'EXIF' && tipo !== 'XMP ') {
      const pedaco = Buffer.from(b.subarray(i, Math.min(fim, b.length)));
      if (tipo === 'VP8X') pedaco[8] &= ~(0x08 | 0x04); // desliga as marcas "tem EXIF" e "tem XMP"
      partes.push(pedaco);
    }
    i = fim;
  }
  const corpo = Buffer.concat(partes);
  const cab = Buffer.alloc(12);
  cab.write('RIFF', 0, 'latin1');
  cab.writeUInt32LE(corpo.length + 4, 4);
  cab.write('WEBP', 8, 'latin1');
  return Buffer.concat([cab, corpo]);
}

/**
 * Cópia da imagem sem EXIF/GPS, XMP, IPTC e comentários (JPEG, PNG, WebP; GIF não carrega GPS).
 * Devolve null se não for possível garantir a limpeza — aí a imagem NÃO deve ir para a IA.
 */
export function semMetadados(bytes, ext) {
  try {
    if (ext === '.jpg' || ext === '.jpeg') return jpegSemMetadados(bytes);
    if (ext === '.png') return pngSemMetadados(bytes);
    if (ext === '.webp') return webpSemMetadados(bytes);
    if (ext === '.gif') return bytes;
  } catch { /* cai no null abaixo */ }
  return null;
}
