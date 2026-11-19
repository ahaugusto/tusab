// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Planilha de gestão ({canal}_base.csv) e as leituras que a interface usa:
// histórico, relatório, repositório e projetos. Mesmo formato do desktop
// (pandas to_csv com utf-8-sig) e mesmos nomes de campo das rotas FastAPI.

import fs from 'node:fs';
import path from 'node:path';
import { caminhos, escreverAtomico, lerJson, sanitizarNome } from './caminhos.js';
import { t } from './idioma.js';

export const COLUNAS_BASE = ['ID', 'Data_Pub', 'Link', 'Titulo', 'Aba', 'Views', 'Local', 'Status', 'Data_Extracao'];

// ── CSV (RFC 4180, como o pandas grava e lê) ─────────────────────────────────

export function lerCsv(caminho) {
  if (!fs.existsSync(caminho)) return { colunas: [], linhas: [] };
  const texto = fs.readFileSync(caminho, 'utf8').replace(/^﻿/, '');
  const registros = [];
  let campo = '';
  let registro = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { registro.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      registro.push(campo); campo = '';
      if (registro.length > 1 || registro[0] !== '') registros.push(registro);
      registro = [];
    } else campo += c;
  }
  if (campo !== '' || registro.length) { registro.push(campo); registros.push(registro); }
  const [colunas = [], ...corpo] = registros;
  const linhas = corpo.map((r) => Object.fromEntries(colunas.map((col, j) => [col, r[j] ?? ''])));
  return { colunas, linhas };
}

function celula(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function salvarCsv(caminho, colunas, linhas) {
  const corpo = [colunas.map(celula).join(','), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(','))];
  escreverAtomico(caminho, `﻿${corpo.join('\n')}\n`);
}

// ── Caminhos por projeto/canal ───────────────────────────────────────────────

export function pastaProjeto(raiz, projeto) {
  return path.join(caminhos(raiz).neural, projeto);
}

export function pastaGestao(raiz, projeto) {
  const d = path.join(pastaProjeto(raiz, projeto), 'management');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function pastaYoutubeCanal(raiz, projeto, canal) {
  return path.join(pastaProjeto(raiz, projeto), 'youtube', canal);
}

function subpastas(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

function arquivos(dir, filtro = () => true) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && filtro(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Todos os .txt (recursivo) sob uma pasta. */
export function txtsRecursivos(dir) {
  const achados = [];
  const visitar = (d) => {
    let entradas;
    try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visitar(p);
      else if (e.isFile() && e.name.endsWith('.txt')) achados.push(p);
    }
  };
  visitar(dir);
  return achados.sort();
}

function dataArquivo(stat) {
  const d = new Date(stat.mtimeMs);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ── GET /history (storage.resumir_projetos_youtube) ──────────────────────────

export function resumirProjetosYoutube(raiz) {
  const neural = caminhos(raiz).neural;
  const csvs = [];
  for (const projeto of subpastas(neural)) {
    const gestao = path.join(neural, projeto, 'management');
    for (const nome of arquivos(gestao, (n) => n.endsWith('_base.csv'))) {
      const p = path.join(gestao, nome);
      csvs.push({ projeto, p, mtime: fs.statSync(p).mtimeMs });
    }
  }
  csvs.sort((a, b) => b.mtime - a.mtime);
  const resumo = [];
  for (const { projeto, p } of csvs) {
    try {
      const { linhas } = lerCsv(p);
      const canalBase = path.basename(p).replace(/_base\.csv$/, '');
      const total = linhas.length;
      const sucesso = linhas.filter((l) => l.Status === 'Sucesso').length;
      const semLeg = linhas.filter((l) => l.Status === 'Sem Legenda').length;
      const datas = linhas.map((l) => l.Data_Extracao).filter(Boolean).sort();
      let canalUrl = `https://www.youtube.com/@${canalBase}`;
      const link = linhas.find((l) => l.Link)?.Link || '';
      const m = link.match(/@([^/?\s]+)/);
      if (m) canalUrl = `https://www.youtube.com/@${m[1]}`;
      const sumario = lerJson(p.replace(/_base\.csv$/, '_summary.json'), null);
      const totalMapeado = sumario?.total_mapeado ?? total;
      const uf = sumario?.ultimo_filtro || {};
      const ultimoFiltro = (uf.playlists?.length || uf.data_inicio || uf.data_fim) ? uf : null;
      resumo.push({
        canal: canalBase,
        projeto,
        canal_url: canalUrl,
        total,
        total_mapeado: totalMapeado,
        extraidos: sucesso,
        sem_legenda: semLeg,
        cobertura: totalMapeado > 0 ? Math.round((sucesso / totalMapeado) * 100) : 0,
        ultima_extracao: datas.at(-1) || '',
        ultimo_filtro: ultimoFiltro,
      });
    } catch { /* CSV corrompido é pulado, como no desktop */ }
  }
  return resumo;
}

// ── GET /relatorio/{canal} ───────────────────────────────────────────────────

function localizarCsvCanal(raiz, canal) {
  const neural = caminhos(raiz).neural;
  const direto = path.join(neural, canal, 'management', `${canal}_base.csv`);
  if (fs.existsSync(direto)) return direto;
  // A extensão também acha o canal quando o projeto tem outro nome.
  for (const projeto of subpastas(neural)) {
    const p = path.join(neural, projeto, 'management', `${canal}_base.csv`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function relatorio(raiz, canal) {
  const canalSafe = sanitizarNome(canal);
  const csv = localizarCsvCanal(raiz, canalSafe);
  if (!csv) return { error: true, message: 'Relatório não encontrado' };
  const { linhas } = lerCsv(csv);
  const contar = (s) => linhas.filter((l) => l.Status === s).length;
  const stats = {
    total: linhas.length,
    sucesso: contar('Sucesso'),
    sem_legenda: contar('Sem Legenda'),
    legenda_curta: contar('Legenda Curta'),
    cobertura: 0,
  };
  if (stats.total > 0) stats.cobertura = Math.round((stats.sucesso / stats.total) * 1000) / 10;
  const uf = lerJson(csv.replace(/_base\.csv$/, '_summary.json'), {})?.ultimo_filtro || {};
  stats.ultimo_filtro = (uf.playlists?.length || uf.data_inicio || uf.data_fim) ? uf : null;
  return { stats, videos: linhas.slice(0, 500) };
}

// ── GET /repositorio ─────────────────────────────────────────────────────────

/** Espaço em disco de um projeto: originais (documents/originais) × o resto (texto, gestão). */
export function espacoOcupado(pastaProjetoAbs) {
  let total = 0;
  let originais = 0;
  const visitar = (d, dentroOriginais) => {
    let entradas;
    try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visitar(p, dentroOriginais || e.name === 'originais');
      else if (e.isFile()) {
        const t = fs.statSync(p).size;
        total += t;
        if (dentroOriginais) originais += t;
      }
    }
  };
  visitar(pastaProjetoAbs, false);
  return { total, originais, texto: total - originais };
}

function lerManifesto(p) {
  const v = lerJson(p, []);
  return Array.isArray(v) ? v : [];
}

export function listarRepositorio(raiz) {
  const neural = caminhos(raiz).neural;
  const resultado = { youtube: [], documentos: [], textos: [], canais: [] };
  const vistos = new Set();
  for (const nome of subpastas(neural)) {
    const base = path.join(neural, nome);
    const yt = txtsRecursivos(path.join(base, 'youtube'))
      .filter((p) => !path.basename(p).startsWith('_'))
      .map((p) => {
        const st = fs.statSync(p);
        return { nome: path.basename(p), canal: nome, tamanho: st.size, data: dataArquivo(st) };
      });
    const docs = lerManifesto(path.join(base, 'documents', '_manifest.json')).map((i) => ({ ...i, canal: nome }));
    const textos = lerManifesto(path.join(base, 'texts', '_manifest.json')).map((i) => ({ ...i, canal: nome }));
    const csv = path.join(base, 'management', `${nome}_base.csv`);
    let mapeados = 0;
    if (fs.existsSync(csv)) mapeados = Math.max(0, lerCsv(csv).linhas.length);
    if (yt.length || docs.length || textos.length || mapeados > 0) {
      resultado.canais.push({ nome, youtube: yt, documentos: docs, textos, videos_mapeados: mapeados, espaco: espacoOcupado(base) });
      for (const f of yt) {
        if (!vistos.has(f.nome)) { vistos.add(f.nome); resultado.youtube.push(f); }
      }
      resultado.documentos.push(...docs);
      resultado.textos.push(...textos);
    }
  }
  return resultado;
}

// ── GET /neural/projetos · POST /neural/projeto ──────────────────────────────

export function listarProjetos(raiz) {
  const neural = caminhos(raiz).neural;
  const projetos = [];
  for (const nome of subpastas(neural)) {
    if (nome === 'youtube') continue; // pasta legada de migração
    const base = path.join(neural, nome);
    const ytDir = path.join(base, 'youtube');
    const yt = txtsRecursivos(ytDir);
    const conta = (sub) => arquivos(path.join(base, sub), (n) => n.endsWith('.txt') && !n.startsWith('_')).length;
    projetos.push({
      nome,
      tipo: yt.length ? 'youtube' : 'projeto',
      n_arquivos: conta('documents') + conta('texts') + yt.length,
      canais: subpastas(ytDir),
    });
  }
  return { projetos };
}

export function criarProjeto(raiz, nome) {
  const bruto = String(nome || '').trim();
  if (!bruto) return { error: true, message: t('Nome não pode ser vazio') };
  const safe = sanitizarNome(bruto, '');
  if (!safe) return { error: true, message: t('Nome inválido') };
  const dir = pastaProjeto(raiz, safe);
  if (fs.existsSync(dir)) return { ok: true, nome: safe, criado: false, message: t('Já existe') };
  fs.mkdirSync(path.join(dir, 'documents'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'texts'), { recursive: true });
  return { ok: true, nome: safe, criado: true };
}

/** Quantos .txt de YouTube existem no disco (o /status mostra isso quando ocioso). */
export function contarArquivosYoutube(raiz) {
  const neural = caminhos(raiz).neural;
  return subpastas(neural).reduce((n, p) => n + txtsRecursivos(path.join(neural, p, 'youtube')).length, 0);
}
