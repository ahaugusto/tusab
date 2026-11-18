// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Operações do Repositório — porte de router_repositorio.py:
//   /neural/upload · /neural/url · DELETE /neural/arquivo · /neural/limpar ·
//   /historico/limpar · /reset-total · /neural/buscar · /neural/ler-arquivo
// Mesmo formato em disco: neural/{projeto}/documents|texts/{id}_{nome}.txt com
// cabeçalho TITULO/FONTE/DATA + 70 '-' e entrada em _manifest.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { caminhos, dataBr, dentroDe, escreverAtomico, lerJson, salvarJson, sanitizarNome } from './caminhos.js';
import { extrairPagina, extrairTextoDeArquivo, LIMITE_DOC } from './documentos.js';
import { apagarOriginal, gravarOriginal, sha256, verificarArquivo } from './originais.js';
import { t } from './idioma.js';

const nomeLimpo = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
const subpastas = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };

function acrescentarManifesto(dir, entrada) {
  const p = path.join(dir, '_manifest.json');
  const atual = lerJson(p, []);
  const lista = Array.isArray(atual) ? atual : [];
  lista.push(entrada);
  salvarJson(p, lista, 2);
}

/** POST /neural/upload — o arquivo vira .txt em neural/{projeto}/documents/. */
export async function salvarDocumento(raiz, { nome, bytes, projeto }) {
  const prefixo = sanitizarNome(String(projeto || '').slice(0, 120), '');
  if (!prefixo) return { error: true, message: t('Selecione um projeto antes de enviar arquivos.') };
  if (bytes.length > LIMITE_DOC) return { error: true, message: t('Arquivo excede o limite de {v} MB', { v: LIMITE_DOC / 1048576 }) };
  // Tipo conferido pela extensão E pela assinatura do arquivo (parecer de segurança).
  let ext;
  try {
    ({ ext } = verificarArquivo(nome, bytes));
  } catch (e) {
    return { error: true, message: e.message };
  }
  const dir = path.join(caminhos(raiz).neural, prefixo, 'documents');
  const hash = sha256(bytes);
  const manifestoAtual = lerJson(path.join(dir, '_manifest.json'), []);
  const repetido = Array.isArray(manifestoAtual) && manifestoAtual.find((e) => e.sha256 === hash);
  if (repetido) return { error: true, message: t('Este arquivo já está no projeto ("{nome_original}").', { nome_original: repetido.nome_original }) };
  let r;
  try {
    r = await extrairTextoDeArquivo(bytes, nome);
  } catch (e) {
    return { error: true, message: e.message.includes('FHIR') ? e.message : t('Erro ao processar arquivo: {message}', { message: e.message }) };
  }
  if (!r.texto.trim()) return { error: true, message: t('Arquivo sem conteúdo extraível') };

  fs.mkdirSync(dir, { recursive: true });
  const fid = crypto.randomUUID().slice(0, 8);
  const nomeTxt = `${fid}_${nomeLimpo(nome.replace(/\.[^.]+$/, ''))}.txt`;
  // O original fica guardado como veio (o texto é o índice); o caminho é sempre por convenção.
  gravarOriginal(dir, { id: fid, nome_original: nome }, bytes);
  let cab = `TITULO: ${nome}\nFONTE: documento\nDATA: ${dataBr()}\n`;
  if (ext === '.pdf') cab += `QUALIDADE_PDF: ${r.qualidadePdf}\n`;
  escreverAtomico(path.join(dir, nomeTxt), `${cab}${'-'.repeat(70)}\n${r.texto}`);
  const entrada = {
    id: fid, nome_original: nome, nome_txt: nomeTxt, tipo: ext.replace('.', ''),
    tamanho: bytes.length, data: dataBr(), chars: r.texto.length, original: true, sha256: hash,
  };
  if (r.formato) entrada.formato_detectado = r.formato;
  acrescentarManifesto(dir, entrada);
  return { ok: true, id: fid, nome, chars: r.texto.length, ...(r.aviso ? { aviso: r.aviso } : {}) };
}

/** POST /neural/url — página estática (respeitando robots.txt). */
export async function salvarPagina(raiz, { url, projeto }) {
  const prefixo = sanitizarNome(String(projeto || '').slice(0, 120), '');
  if (!prefixo) return { error: true, message: t('Selecione um projeto antes de trazer uma página.') };
  const u = String(url || '').trim();
  if (!/^https?:\/\//.test(u)) return { error: true, message: t('Informe uma URL válida (começando com http:// ou https://).') };
  let pagina;
  try {
    pagina = await extrairPagina(u);
  } catch (e) {
    if (e.esperado) return { error: true, message: e.message };
    let host = t('a página');
    try { host = new URL(u).host; } catch { /* mantém genérico */ }
    const tempo = e.name === 'TimeoutError' || e.name === 'AbortError';
    return { error: true, message: tempo ? t('{host} demorou demais para responder. Tente de novo em instantes.', { host }) : t('Não foi possível acessar {host}: {message}', { host, message: e.message }) };
  }
  const dir = path.join(caminhos(raiz).neural, prefixo, 'documents');
  fs.mkdirSync(dir, { recursive: true });
  const fid = crypto.randomUUID().slice(0, 8);
  const nomeTxt = `${fid}_${nomeLimpo(pagina.titulo)}.txt`;
  escreverAtomico(path.join(dir, nomeTxt),
    `TITULO: ${pagina.titulo}\nFONTE: web\nDATA: ${dataBr()}\nURL_ORIGEM: ${pagina.url}\n${'-'.repeat(70)}\n${pagina.texto}`);
  acrescentarManifesto(dir, {
    id: fid, nome_original: pagina.titulo, nome_txt: nomeTxt, tipo: 'web',
    tamanho: Buffer.byteLength(pagina.texto), data: dataBr(), chars: pagina.texto.length, fonte_externa: 'web',
  });
  return { ok: true, id: fid, titulo: pagina.titulo, chars: pagina.texto.length };
}

/** DELETE /neural/arquivo/{tipo}/{fid}. */
export function excluirArquivo(raiz, tipo, fid) {
  const sub = { documentos: 'documents', textos: 'texts' }[tipo] || tipo;
  if (!['documents', 'texts'].includes(sub)) return { error: true, message: t('Tipo inválido') };
  const neural = caminhos(raiz).neural;
  const dirs = [...subpastas(neural).map((p) => path.join(neural, p, sub)), path.join(neural, sub)];
  for (const dir of dirs) {
    const mp = path.join(dir, '_manifest.json');
    const manifesto = lerJson(mp, null);
    if (!Array.isArray(manifesto)) continue;
    const item = manifesto.find((e) => e.id === fid);
    if (!item) continue;
    const alvo = path.join(dir, String(item.nome_txt || ''));
    if (!dentroDe(dir, alvo)) return { error: true, message: t('Caminho inválido') };
    fs.rmSync(alvo, { force: true });
    if (sub === 'documents') apagarOriginal(dir, item); // caminho por convenção, nunca do manifesto
    salvarJson(mp, manifesto.filter((e) => e.id !== fid), 2);
    return { ok: true };
  }
  return { error: true, message: t('Arquivo não encontrado') };
}

/** DELETE /historico/limpar — CSV de gestão e resumo dos canais escolhidos (ou todos). */
export function limparHistorico(raiz, prefixos = []) {
  const neural = caminhos(raiz).neural;
  let removidos = 0;
  for (const projeto of subpastas(neural)) {
    const gestao = path.join(neural, projeto, 'management');
    let nomes = [];
    try { nomes = fs.readdirSync(gestao).filter((n) => n.endsWith('_base.csv')); } catch { continue; }
    for (const n of nomes) {
      const canal = n.replace(/_base\.csv$/, '');
      if (prefixos.length && !prefixos.includes(canal)) continue;
      for (const arq of [`${canal}_base.csv`, `${canal}_summary.json`]) {
        const p = path.join(gestao, arq);
        if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); removidos++; }
      }
    }
  }
  return { ok: true, removidos };
}

function limparPasta(dir) {
  let n = 0;
  let nomes = [];
  try { nomes = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of nomes) {
    if (!e.isFile()) continue;
    try { fs.rmSync(path.join(dir, e.name)); n++; } catch { /* segue */ }
  }
  return n;
}

/** DELETE /neural/limpar — por projeto (ou todos); tudo marcado = apaga a pasta do projeto. */
export function limparProjeto(raiz, { youtube = false, documentos = false, textos = false, canal = '' } = {}) {
  const neural = caminhos(raiz).neural;
  const deletados = { youtube: 0, documentos: 0, textos: 0 };
  let pastas = [];
  if (canal) {
    for (const cand of [canal, sanitizarNome(canal, '')]) {
      const p = path.join(neural, cand);
      if (cand && dentroDe(neural, p) && fs.existsSync(p) && fs.statSync(p).isDirectory()) { pastas = [p]; break; }
    }
  } else pastas = subpastas(neural).map((p) => path.join(neural, p));
  const tudo = Boolean(canal && youtube && documentos && textos);
  for (const p of pastas) {
    if (youtube) {
      const base = path.join(p, 'youtube');
      for (const sub of subpastas(base)) deletados.youtube += limparPasta(path.join(base, sub));
      try {
        for (const n of fs.readdirSync(base)) {
          if (n.endsWith('.txt') && !n.startsWith('_')) { fs.rmSync(path.join(base, n), { force: true }); deletados.youtube++; }
        }
      } catch { /* sem pasta */ }
    }
    if (documentos) {
      deletados.documentos += limparPasta(path.join(p, 'documents'));
      // Os originais saem junto: "limpar documentos" não pode deixar cópia esquecida no disco.
      deletados.documentos += limparPasta(path.join(p, 'documents', 'originais'));
      fs.rmSync(path.join(p, 'documents', 'originais'), { recursive: true, force: true });
    }
    if (textos) deletados.textos += limparPasta(path.join(p, 'texts'));
    if (tudo) fs.rmSync(p, { recursive: true, force: true });
  }
  return { ok: true, deletados };
}

/** DELETE /reset-total — apaga a base inteira (neural/, índice e fila). Mantém data/bin (yt-dlp). */
export function resetTotal(raiz) {
  const c = caminhos(raiz);
  const removidos = { cerebro: 0, indices: 0 };
  for (const e of (() => { try { return fs.readdirSync(c.neural, { withFileTypes: true }); } catch { return []; } })()) {
    try { fs.rmSync(path.join(c.neural, e.name), { recursive: true, force: true }); removidos.cerebro++; } catch { /* segue */ }
  }
  for (const p of [c.banco, `${c.banco}.trava`]) {
    if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); removidos.indices++; }
  }
  salvarJson(c.fila, []);
  return { ok: true, removidos };
}

/** POST /neural/buscar — busca literal nos .txt, até 20 resultados com trecho. */
export function buscarTexto(raiz, { query = '', canal = '' } = {}) {
  const neural = caminhos(raiz).neural;
  const q = String(query).trim();
  if (!q) return { resultados: [], total: 0, query: q };
  const raizBusca = canal ? path.join(neural, sanitizarNome(canal, '')) : neural;
  if (!dentroDe(neural, raizBusca) && raizBusca !== neural) return { resultados: [], total: 0, query: q };
  if (!fs.existsSync(raizBusca)) return { resultados: [], total: 0, query: q };
  const ql = q.toLowerCase();
  const resultados = [];
  const tipoDe = (partes) => (partes.includes('documents') || partes.includes('documentos') ? 'documento'
    : partes.includes('texts') || partes.includes('textos') ? 'texto' : 'youtube');
  const canalDe = (partes) => (partes.length >= 3 ? partes[0] : partes.length >= 2 && !['youtube', 'documents', 'texts'].includes(partes[0]) ? partes[0] : '');
  const visitar = (dir) => {
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return; }
    for (const e of entradas) {
      if (resultados.length >= 20) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'originais') visitar(p); continue; }
      if (!e.name.endsWith('.txt') || e.name.startsWith('_')) continue;
      const conteudo = fs.readFileSync(p, 'utf8');
      const pos = conteudo.toLowerCase().indexOf(ql);
      if (pos < 0) continue;
      const ini = Math.max(0, pos - 80);
      const fim = Math.min(conteudo.length, pos + 120);
      const rel = path.relative(neural, p).split(path.sep).join('/');
      const partes = rel.split('/');
      resultados.push({
        arquivo: e.name, caminho: rel,
        trecho: `${ini > 0 ? '...' : ''}${conteudo.slice(ini, fim).replace(/[\r\n]/g, ' ')}${fim < conteudo.length ? '...' : ''}`,
        canal: canalDe(partes), tipo: tipoDe(partes),
      });
    }
  };
  visitar(raizBusca);
  return { resultados, total: resultados.length, query: q };
}

/** POST /neural/ler-arquivo — conteúdo de um .txt dentro de neural/. */
export function lerArquivo(raiz, caminho) {
  const neural = caminhos(raiz).neural;
  const alvo = path.resolve(neural, String(caminho || '').replace(/\\/g, '/').replace(/^\/+/, ''));
  if (!dentroDe(neural, alvo)) return { error: true, message: 'Acesso negado' };
  if (!alvo.endsWith('.txt')) return { error: true, message: t('Apenas arquivos .txt são suportados') };
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) return { error: true, message: t('Arquivo não encontrado') };
  return { ok: true, conteudo: fs.readFileSync(alvo, 'utf8'), arquivo: path.basename(alvo) };
}
