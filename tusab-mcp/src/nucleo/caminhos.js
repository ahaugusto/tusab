// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Caminhos do repositório — mesma convenção do Tusab desktop (tusab_engine/storage.py).
//
// A "raiz" é a pasta que contém data/ (equivale ao TUSAB_DATA_DIR do desktop;
// no desktop instalado é %APPDATA%\Tusab). Assim a extensão abre bases do desktop.
//
//   data/neural/{projeto}/youtube/{canal}/{canal}_Parte_N.txt
//   data/neural/{projeto}/youtube/{canal}/{canal}_meta.json
//   data/neural/{projeto}/management/{canal}_base.csv | _summary.json
//   data/neural/{projeto}/documents/ · texts/
//   data/config/extraction_queue.json · data/temp/ · data/bin/ · data/tusab.sqlite

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { t } from './idioma.js';

export function pastaRepositorio() {
  const env = process.env.TUSAB_REPOSITORIO;
  if (env && env.trim() && !env.includes('${')) return path.resolve(env.trim());
  return path.join(os.homedir(), 'Tusab');
}

export function caminhos(raiz) {
  const data = path.join(raiz, 'data');
  return {
    raiz,
    data,
    neural: path.join(data, 'neural'),
    temp: path.join(data, 'temp'),
    config: path.join(data, 'config'),
    bin: path.join(data, 'bin'),
    banco: path.join(data, 'tusab.sqlite'),
    fila: path.join(data, 'config', 'extraction_queue.json'),
  };
}

export function garantirEstrutura(raiz) {
  const c = caminhos(raiz);
  for (const d of [c.neural, c.temp, c.config, c.bin]) fs.mkdirSync(d, { recursive: true });
  return c;
}

/**
 * Mesma regra do desktop: re.sub(r'[<>:"/\\|?*\s]', '_', nome).strip('_').
 * A mais: pontos no início saem (".." nunca vira nome de pasta).
 */
export function sanitizarNome(nome, padrao = 'Canal') {
  if (!nome) return padrao;
  const limpo = String(nome).replace(/[<>:"/\\|?*\s]/g, '_').replace(/^[_.]+|_+$/g, '');
  return limpo || padrao;
}

/** Mesmo que sanitizarNome, mas recusa nome vazio (projeto escolhido pelo usuário). */
export function sanitizarProjeto(nome) {
  const limpo = sanitizarNome(String(nome ?? '').trim().slice(0, 120), '');
  if (!limpo) throw new Error(t('Informe um nome de projeto válido.'));
  return limpo;
}

export function extrairNomeCanal(url) {
  const m = String(url).match(/@([^/?\s]+)/);
  if (m) return m[1];
  const partes = String(url).replace(/\/+$/, '').split('/');
  const nome = (partes.at(-1) || 'Canal').replace(/^@/, '');
  return nome.split('?')[0];
}

/** Garante que `alvo` fica dentro de `base` (contra path traversal). */
export function dentroDe(base, alvo) {
  const b = path.resolve(base) + path.sep;
  const a = path.resolve(alvo);
  return a.startsWith(b);
}

export function escreverAtomico(destino, dados) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, dados);
  for (let tentativa = 0; ; tentativa++) {
    try {
      fs.renameSync(tmp, destino);
      return;
    } catch (erro) {
      // Windows: antivírus/indexador pode segurar o arquivo por um instante.
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(erro.code) || tentativa >= 5) {
        fs.rmSync(tmp, { force: true });
        throw erro;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
}

export function salvarJson(destino, objeto, indent) {
  escreverAtomico(destino, JSON.stringify(objeto, null, indent));
}

export function lerJson(caminho, padrao = null) {
  try {
    return JSON.parse(fs.readFileSync(caminho, 'utf8').replace(/^﻿/, ''));
  } catch {
    return padrao;
  }
}

/** dd/mm/aaaa como o datetime.strftime('%d/%m/%Y') do desktop. */
export function dataBr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function dataIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function horaCurta(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
