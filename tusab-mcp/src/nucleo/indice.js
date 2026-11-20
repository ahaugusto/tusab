// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Índice de busca (data/tusab.sqlite) construído a partir dos arquivos do desktop:
//   neural/{projeto}/youtube/**/{canal}_Parte_N.txt  → um trecho por bloco (com minuto)
//   neural/{projeto}/texts|documents/*.txt          → trechos por parágrafo
// Os .txt são a fonte da verdade; o SQLite é reconstruível e sincroniza por
// arquivo (data de modificação + tamanho). Motor: SQLite oficial em WebAssembly,
// banco em memória com gravação atômica sob arquivo de trava (várias ferramentas
// de IA podem abrir o mesmo repositório).

import fs from 'node:fs';
import path from 'node:path';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { caminhos, escreverAtomico, garantirEstrutura } from './caminhos.js';
import { txtsRecursivos } from './gestao.js';
import { formatarTempo } from './legendas.js';
import { t } from './idioma.js';

export const VERSAO_ESQUEMA = 2;

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS arquivos (
  caminho TEXT PRIMARY KEY,
  mtime   REAL NOT NULL,
  tamanho INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS fontes (
  id            INTEGER PRIMARY KEY,
  projeto       TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('youtube', 'documento', 'texto')),
  chave_externa TEXT NOT NULL,
  titulo        TEXT NOT NULL,
  autor         TEXT,
  url           TEXT,
  publicado_em  TEXT,
  arquivo       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fontes_arquivo ON fontes (arquivo);
CREATE INDEX IF NOT EXISTS idx_fontes_projeto ON fontes (projeto);
CREATE TABLE IF NOT EXISTS trechos (
  id       INTEGER PRIMARY KEY,
  fonte_id INTEGER NOT NULL REFERENCES fontes(id) ON DELETE CASCADE,
  ordem    INTEGER NOT NULL,
  inicio_s INTEGER,
  fim_s    INTEGER,
  titulo   TEXT,
  texto    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trechos_fonte ON trechos (fonte_id, ordem);
CREATE VIRTUAL TABLE IF NOT EXISTS trechos_fts USING fts5 (
  texto, titulo,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;

const PALAVRAS_VAZIAS = new Set((
  'a o as os um uma uns umas de do da dos das no na nos nas em por para pra com sem ' +
  'e ou que se como mais menos muito ja já foi ser é são era sobre entre ao aos à às ' +
  'isso isto esse essa este esta qual quais quem onde quando porque porquê ' +
  'the of and or to in on for with is are was were be by an at from as it this that what which who how'
).split(' '));

let _sqlite3 = null;
async function motorSqlite() {
  if (!_sqlite3) _sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  return _sqlite3;
}

/** Pergunta em linguagem natural → expressão FTS5 segura (só termos entre aspas, OR). */
export function montarConsultaFts(consulta) {
  const termos = (String(consulta).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((t) => t.length > 1 && !PALAVRAS_VAZIAS.has(t));
  const unicos = [...new Set(termos)].slice(0, 24);
  return unicos.length ? unicos.map((t) => `"${t}"`).join(' OR ') : null;
}

export function linkCitacao(fonte, inicio) {
  if (fonte.tipo === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(fonte.chave_externa || '')) {
    const t = Number.isFinite(inicio) && inicio > 0 ? `&t=${Math.floor(inicio)}s` : '';
    return `https://www.youtube.com/watch?v=${fonte.chave_externa}${t}`;
  }
  return fonte.url || null;
}

// ── Leitura dos .txt do desktop ──────────────────────────────────────────────

/** Blocos TITULO/LINK/…/CONTEUDO de um {canal}_Parte_N.txt (tolerante a versões antigas). */
export function lerBlocosYoutube(conteudo) {
  const texto = String(conteudo).replace(/^﻿/, '');
  const canal = texto.match(/^# Canal: (.+?)(?: \(@[^)]*\))?$/m)?.[1]?.trim() || null;
  const blocos = [];
  const linhas = texto.split(/\r?\n/);
  let atual = null;
  let lendoConteudo = false;
  const fechar = () => {
    if (atual && atual.conteudo.length) {
      atual.texto = atual.conteudo.join('\n').trim();
      if (atual.texto) blocos.push(atual);
    }
    atual = null;
    lendoConteudo = false;
  };
  for (const linha of linhas) {
    if (/^={20,}$/.test(linha)) { if (lendoConteudo) fechar(); continue; }
    if (lendoConteudo) { atual.conteudo.push(linha); continue; }
    const m = linha.match(/^(TITULO|ABA|DATA|LINK|VIDEO_ID|VIEWS|TIMESTAMP_INICIO|PARTE|TOTAL_PARTES|TAGS|DESCRICAO): ?(.*)$/);
    if (m) {
      if (m[1] === 'TITULO') { fechar(); atual = { conteudo: [] }; }
      if (atual) atual[m[1]] = m[2].trim();
      continue;
    }
    if (atual && linha.trim() === 'CONTEUDO:') lendoConteudo = true;
  }
  fechar();
  return blocos.map((b) => {
    const id = b.VIDEO_ID || b.LINK?.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] || '';
    return {
      video_id: id,
      titulo: b.TITULO || id,
      link: b.LINK || '',
      data: b.DATA || '',
      inicio: /^\d+$/.test(b.TIMESTAMP_INICIO || '') ? Number(b.TIMESTAMP_INICIO) : null,
      canal,
      texto: b.texto,
    };
  });
}

/** Título comum dos blocos de um vídeo ("Título — Capítulo" → "Título"). */
function tituloDaFonte(titulos) {
  if (titulos.length === 1 || titulos.every((t) => t === titulos[0])) return titulos[0].replace(/ \(parte \d+\/\d+\)$/, '');
  const primeiro = titulos[0];
  const corte = primeiro.indexOf(' — ');
  if (corte > 0) {
    const base = primeiro.slice(0, corte);
    if (titulos.every((t) => t.startsWith(base))) return base;
  }
  return primeiro;
}

export function trechosDeTexto(texto, alvo = 1200) {
  const paragrafos = String(texto).replace(/^﻿/, '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const trechos = [];
  let atual = '';
  for (const p of paragrafos) {
    if (atual && atual.length + p.length + 1 > alvo) { trechos.push(atual); atual = ''; }
    atual = atual ? `${atual}\n${p}` : p;
    while (atual.length > alvo * 2) { trechos.push(atual.slice(0, alvo * 2)); atual = atual.slice(alvo * 2); }
  }
  if (atual) trechos.push(atual);
  return trechos;
}

function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export class Indice {
  constructor(raiz, sqlite3) {
    this.raiz = raiz;
    this.c = caminhos(raiz);
    this.caminhoBanco = this.c.banco;
    this.caminhoTrava = `${this.caminhoBanco}.trava`;
    this.sqlite3 = sqlite3;
    this.db = null;
    this.mtimeCarregado = 0;
  }

  static async abrir(raiz) {
    garantirEstrutura(raiz);
    const indice = new Indice(raiz, await motorSqlite());
    indice._carregar();
    return indice;
  }

  _carregar() {
    const { sqlite3 } = this;
    if (this.db) this.db.close();
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    if (fs.existsSync(this.caminhoBanco)) {
      const bytes = fs.readFileSync(this.caminhoBanco);
      if (bytes.length) {
        const p = sqlite3.wasm.allocFromTypedArray(new Uint8Array(bytes));
        const rc = sqlite3.capi.sqlite3_deserialize(
          db.pointer, 'main', p, bytes.length, bytes.length,
          sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
        );
        if (rc !== 0) { db.close(); throw new Error(t('Não foi possível abrir {caminhoBanco} (código SQLite {rc}).', { caminhoBanco: this.caminhoBanco, rc })); }
      }
      this.mtimeCarregado = fs.statSync(this.caminhoBanco).mtimeMs;
    } else {
      this.mtimeCarregado = 0;
    }
    db.exec('PRAGMA foreign_keys = ON;');
    const versao = db.selectValue('PRAGMA user_version') || 0;
    if (versao > VERSAO_ESQUEMA) {
      db.close();
      throw new Error(t('Este índice foi criado por uma versão mais nova do Tusab (esquema {versao}). Atualize o plugin.', { versao }));
    }
    if (versao < VERSAO_ESQUEMA && versao > 0) {
      // Índice é reconstruível: esquema antigo é descartado e refeito a partir dos .txt.
      db.exec('DROP TABLE IF EXISTS trechos_fts; DROP TABLE IF EXISTS trechos; DROP TABLE IF EXISTS fontes; DROP TABLE IF EXISTS arquivos; DROP TABLE IF EXISTS meta;');
    }
    db.exec(ESQUEMA);
    db.exec(`PRAGMA user_version = ${VERSAO_ESQUEMA};`);
    this.db = db;
  }

  atualizarSeMudou() {
    if (!fs.existsSync(this.caminhoBanco)) return;
    const mtime = fs.statSync(this.caminhoBanco).mtimeMs;
    if (mtime !== this.mtimeCarregado) this._carregar();
  }

  _travar() {
    const limite = Date.now() + 15_000;
    for (;;) {
      try {
        const fd = fs.openSync(this.caminhoTrava, 'wx');
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
        return;
      } catch (erro) {
        if (erro.code !== 'EEXIST') throw erro;
        try {
          if (Date.now() - fs.statSync(this.caminhoTrava).mtimeMs > 120_000) {
            fs.rmSync(this.caminhoTrava, { force: true });
            continue;
          }
        } catch { /* a trava sumiu entre as chamadas */ }
        if (Date.now() > limite) throw new Error(t('O índice está ocupado por outra ferramenta. Tente de novo em instantes.'));
        dormir(100);
      }
    }
  }

  _gravar() {
    escreverAtomico(this.caminhoBanco, this.sqlite3.capi.sqlite3_js_db_export(this.db));
    this.mtimeCarregado = fs.statSync(this.caminhoBanco).mtimeMs;
  }

  alterar(funcao) {
    this._travar();
    try {
      this.atualizarSeMudou();
      let resultado;
      this.db.transaction(() => { resultado = funcao(this.db); });
      this._gravar();
      return resultado;
    } finally {
      fs.rmSync(this.caminhoTrava, { force: true });
    }
  }

  fechar() {
    if (this.db) this.db.close();
    this.db = null;
  }

  /** Depois de apagar o arquivo do índice (reset total): começa vazio. */
  recriar() {
    this._carregar();
  }

  // ── Sincronização com os .txt ─────────────────────────────────────────────

  _arquivosNoDisco() {
    const neural = this.c.neural;
    const lista = [];
    let projetos = [];
    try { projetos = fs.readdirSync(neural, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* vazio */ }
    for (const projeto of projetos) {
      if (projeto === 'youtube') continue;
      const base = path.join(neural, projeto);
      for (const p of txtsRecursivos(path.join(base, 'youtube'))) {
        if (/_Parte_\d+\.txt$/.test(p)) lista.push({ projeto, tipo: 'youtube', p });
      }
      for (const [sub, tipo] of [['documents', 'documento'], ['texts', 'texto']]) {
        let nomes = [];
        try { nomes = fs.readdirSync(path.join(base, sub)).filter((n) => n.endsWith('.txt') && !n.startsWith('_')); } catch { /* sem pasta */ }
        for (const n of nomes) lista.push({ projeto, tipo, p: path.join(base, sub, n) });
      }
    }
    return lista;
  }

  /** Reindexa só o que mudou no disco. Devolve { lidos, removidos }. */
  sincronizar() {
    this.atualizarSeMudou();
    const noDisco = this._arquivosNoDisco().map((a) => {
      const st = fs.statSync(a.p);
      return { ...a, rel: path.relative(this.raiz, a.p).split(path.sep).join('/'), mtime: st.mtimeMs, tamanho: st.size };
    });
    const conhecidos = new Map(this.db.selectObjects('SELECT caminho, mtime, tamanho FROM arquivos').map((r) => [r.caminho, r]));
    const mudaram = noDisco.filter((a) => {
      const k = conhecidos.get(a.rel);
      return !k || k.mtime !== a.mtime || k.tamanho !== a.tamanho;
    });
    const atuais = new Set(noDisco.map((a) => a.rel));
    const sumiram = [...conhecidos.keys()].filter((k) => !atuais.has(k));
    if (!mudaram.length && !sumiram.length) return { lidos: 0, removidos: 0 };

    return this.alterar((db) => {
      for (const rel of [...sumiram, ...mudaram.map((a) => a.rel)]) this._removerArquivo(db, rel);
      for (const a of mudaram) {
        this._indexarArquivo(db, a);
        db.exec({ sql: 'INSERT OR REPLACE INTO arquivos (caminho, mtime, tamanho) VALUES (?, ?, ?)', bind: [a.rel, a.mtime, a.tamanho] });
      }
      return { lidos: mudaram.length, removidos: sumiram.length };
    });
  }

  _removerArquivo(db, rel) {
    db.exec({ sql: 'DELETE FROM trechos_fts WHERE rowid IN (SELECT t.id FROM trechos t JOIN fontes f ON f.id = t.fonte_id WHERE f.arquivo = ?)', bind: [rel] });
    db.exec({ sql: 'DELETE FROM trechos WHERE fonte_id IN (SELECT id FROM fontes WHERE arquivo = ?)', bind: [rel] });
    db.exec({ sql: 'DELETE FROM fontes WHERE arquivo = ?', bind: [rel] });
    db.exec({ sql: 'DELETE FROM arquivos WHERE caminho = ?', bind: [rel] });
  }

  _inserirFonte(db, fonte, trechos) {
    db.exec({
      sql: `INSERT INTO fontes (projeto, tipo, chave_externa, titulo, autor, url, publicado_em, arquivo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [fonte.projeto, fonte.tipo, fonte.chave_externa, fonte.titulo || 'Sem título', fonte.autor ?? null,
        fonte.url ?? null, fonte.publicado_em ?? null, fonte.arquivo],
    });
    const fonteId = db.selectValue('SELECT last_insert_rowid()');
    const insT = db.prepare('INSERT INTO trechos (fonte_id, ordem, inicio_s, fim_s, titulo, texto) VALUES (?, ?, ?, ?, ?, ?)');
    const insF = db.prepare('INSERT INTO trechos_fts (rowid, texto, titulo) VALUES (?, ?, ?)');
    try {
      trechos.forEach((t, ordem) => {
        insT.bind([fonteId, ordem, t.inicio ?? null, t.fim ?? null, t.titulo ?? null, t.texto]).stepReset();
        insF.bind([db.selectValue('SELECT last_insert_rowid()'), t.texto, t.titulo || fonte.titulo || '']).stepReset();
      });
    } finally {
      insT.finalize();
      insF.finalize();
    }
  }

  _indexarArquivo(db, a) {
    const conteudo = fs.readFileSync(a.p, 'utf8');
    if (a.tipo === 'youtube') {
      const porVideo = new Map();
      for (const b of lerBlocosYoutube(conteudo)) {
        const k = b.video_id || b.link || b.titulo;
        if (!porVideo.has(k)) porVideo.set(k, []);
        porVideo.get(k).push(b);
      }
      for (const [chave, blocos] of porVideo) {
        blocos.sort((x, y) => (x.inicio ?? 0) - (y.inicio ?? 0));
        const trechos = blocos.map((b, i) => ({
          inicio: b.inicio, fim: blocos[i + 1]?.inicio ?? null, titulo: b.titulo, texto: b.texto,
        }));
        this._inserirFonte(db, {
          projeto: a.projeto, tipo: 'youtube', chave_externa: chave,
          titulo: tituloDaFonte(blocos.map((b) => b.titulo)), autor: blocos[0].canal,
          url: blocos[0].link || null, publicado_em: blocos[0].data || null, arquivo: a.rel,
        }, trechos);
      }
      return;
    }
    // Cabeçalho do desktop (/neural/texto e /neural/upload): TITULO: …\n…\n----
    let corpo = conteudo.replace(/^﻿/, '');
    let titulo = path.basename(a.p, '.txt').replace(/^[0-9a-f]{8}_/, '').replace(/_/g, ' ');
    const cab = corpo.match(/^TITULO: (.*)\r?\n(?:[A-Z_]+: .*\r?\n)*-{70}\r?\n/);
    if (cab) {
      titulo = cab[1].trim() || titulo;
      corpo = corpo.slice(cab[0].length);
    }
    const trechos = trechosDeTexto(corpo).map((texto) => ({ texto }));
    if (!trechos.length) return;
    this._inserirFonte(db, {
      projeto: a.projeto, tipo: a.tipo, chave_externa: path.basename(a.p), titulo, arquivo: a.rel,
    }, trechos);
  }

  // ── Leitura ───────────────────────────────────────────────────────────────

  listarProjetos() {
    this.atualizarSeMudou();
    return this.db.selectObjects(`
      SELECT f.projeto,
             COUNT(DISTINCT f.id)                                AS fontes,
             SUM(CASE WHEN f.tipo = 'youtube' THEN 1 ELSE 0 END) AS videos,
             (SELECT COUNT(*) FROM trechos t JOIN fontes g ON g.id = t.fonte_id WHERE g.projeto = f.projeto) AS trechos
        FROM fontes f GROUP BY f.projeto ORDER BY f.projeto COLLATE NOCASE`);
  }

  /** Por projeto: trechos indexados, arquivos-fonte e data da última indexação (GET /agent/status). */
  resumoPorProjeto() {
    this.atualizarSeMudou();
    const quando = fs.existsSync(this.caminhoBanco) ? new Date(this.mtimeCarregado).toISOString() : null;
    return this.db.selectObjects(`
      SELECT f.projeto AS nome,
             (SELECT COUNT(*) FROM trechos t JOIN fontes g ON g.id = t.fonte_id WHERE g.projeto = f.projeto) AS chunks,
             COUNT(DISTINCT f.arquivo) AS n_arquivos_fonte
        FROM fontes f GROUP BY f.projeto ORDER BY f.projeto COLLATE NOCASE`)
      .map((r) => ({ ...r, arquivo: 'tusab.sqlite', indexed_at: quando, embeddings_disponivel: false }));
  }

  /** Tamanho (caracteres) do texto inteiro das fontes — base da medição de tokens. */
  caracteresDasFontes(ids) {
    const lista = [...new Set(ids)].filter(Number.isInteger);
    if (!lista.length) return 0;
    this.atualizarSeMudou();
    return this.db.selectValue(
      `SELECT COALESCE(SUM(LENGTH(texto)), 0) FROM trechos WHERE fonte_id IN (${lista.map(() => '?').join(',')})`, lista,
    ) || 0;
  }

  caracteresDoProjeto(projeto) {
    this.atualizarSeMudou();
    return this.db.selectValue(
      'SELECT COALESCE(SUM(LENGTH(t.texto)), 0) FROM trechos t JOIN fontes f ON f.id = t.fonte_id WHERE f.projeto = ?', [String(projeto)],
    ) || 0;
  }

  buscar(consulta, { projeto = null, limite = 8 } = {}) {
    this.atualizarSeMudou();
    const expressao = montarConsultaFts(consulta);
    if (!expressao) return [];
    const lim = Math.min(Math.max(Number(limite) || 8, 1), 20);
    const params = [expressao];
    let filtro = '';
    if (projeto) { filtro = 'AND f.projeto = ?'; params.push(String(projeto)); }
    params.push(lim);
    return this.db.selectObjects(`
      SELECT t.id AS trecho_id, t.fonte_id, t.inicio_s, t.fim_s, t.texto, COALESCE(t.titulo, f.titulo) AS titulo_trecho,
             f.projeto, f.tipo, f.chave_externa, f.titulo, f.autor, f.url, f.publicado_em,
             bm25(trechos_fts, 1.0, 2.0) AS pontuacao
        FROM trechos_fts
        JOIN trechos t ON t.id = trechos_fts.rowid
        JOIN fontes  f ON f.id = t.fonte_id
       WHERE trechos_fts MATCH ? ${filtro}
       ORDER BY pontuacao LIMIT ?`, params).map((l) => ({
      ...l,
      minuto: l.inicio_s === null ? null : formatarTempo(l.inicio_s),
      link: linkCitacao(l, l.inicio_s),
    }));
  }

  /**
   * Panorama do projeto sem consulta: os primeiros trechos de cada fonte, alternando entre as
   * fontes (1º de cada, depois o 2º de cada...). Usado quando o pedido não tem tema.
   * Mesmo formato de buscar().
   */
  panorama(projeto, { limite = 12 } = {}) {
    this.atualizarSeMudou();
    const lim = Math.min(Math.max(Number(limite) || 12, 1), 30);
    return this.db.selectObjects(`
      SELECT * FROM (
        SELECT t.id AS trecho_id, t.fonte_id, t.inicio_s, t.fim_s, t.texto, COALESCE(t.titulo, f.titulo) AS titulo_trecho,
               f.projeto, f.tipo, f.chave_externa, f.titulo, f.autor, f.url, f.publicado_em,
               ROW_NUMBER() OVER (PARTITION BY t.fonte_id ORDER BY t.ordem) AS posicao
          FROM trechos t JOIN fontes f ON f.id = t.fonte_id
         WHERE f.projeto = ?)
       ORDER BY posicao, fonte_id LIMIT ?`, [String(projeto), lim]).map((l) => ({
      ...l,
      minuto: l.inicio_s === null ? null : formatarTempo(l.inicio_s),
      link: linkCitacao(l, l.inicio_s),
    }));
  }

  lerFonte(fonteId, { aPartirDeSegundos = 0, maxTrechos = 20 } = {}) {
    this.atualizarSeMudou();
    const fonte = this.db.selectObject('SELECT * FROM fontes WHERE id = ?', [fonteId]);
    if (!fonte) return null;
    const lim = Math.min(Math.max(Number(maxTrechos) || 20, 1), 60);
    const trechos = this.db.selectObjects(`
      SELECT ordem, inicio_s, fim_s, titulo, texto FROM trechos
       WHERE fonte_id = ? AND (inicio_s IS NULL OR fim_s IS NULL OR fim_s > ?)
       ORDER BY ordem LIMIT ?`, [fonteId, aPartirDeSegundos, lim]);
    const total = this.db.selectValue('SELECT COUNT(*) FROM trechos WHERE fonte_id = ?', [fonteId]);
    return {
      fonte,
      total_trechos: total,
      trechos: trechos.map((t) => ({ ...t, minuto: t.inicio_s === null ? null : formatarTempo(t.inicio_s), link: linkCitacao(fonte, t.inicio_s) })),
    };
  }
}
