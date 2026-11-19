// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Exportações e base compartilhável — porte de tusab_engine/api/router_exports.py
// (só o que não depende de chat). Mesmos arquivos, nomes e JSON de erro do desktop.
//
//   POST /export/base                      → ZIP de data/neural/ (tusab_base_AAAAMMDD_HHMM.zip)
//   POST /export/tabela-videos             → XLSX do CSV de gestão (tusab_videos_{projeto}_{ts}.xlsx)
//   POST /export/relatorio-pdf             → PDF com pares pergunta/resposta (tusab_relatorio_{projeto}_{ts}.pdf)
//   GET  /export/base-compartilhavel/{p}   → {p}.tusab (zip: neural/{p}/…, agent_index/{p}.lancedb/…, manifest.json)
//   POST /import/base-compartilhavel       → descompacta um .tusab (do desktop ou da extensão)
//   GET  /export/readonly-status           → { projeto: bool }
//
// Downloads devolvem { corpo: Buffer, tipo, nomeArquivo, cabecalhos }; erros devolvem
// { corpo: { error: true, message }, tipo: 'application/json', nomeArquivo: null } —
// o desktop responde esses erros com HTTP 200 e JSON, e a interface confere o Content-Type.

import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { caminhos, dentroDe, escreverAtomico, salvarJson } from './caminhos.js';
import { lerCsv } from './gestao.js';
import { verificarArquivo } from './originais.js';
import { t } from './idioma.js';

export const FORMATO_TUSAB = 'tusab-base';
export const VERSAO_TUSAB = 1;
const SUBPASTAS_TUSAB = ['youtube', 'documents', 'texts', 'management'];

// Limites da importação (o desktop não tem nenhum: aqui são a proteção contra zip-bomba).
export const TAMANHO_MAX_TUSAB = 512 * 1024 * 1024; //       arquivo enviado (compactado)
export const MAX_ENTRADAS_TUSAB = 50_000;
export const MAX_TOTAL_DESCOMPACTADO = 1024 * 1024 * 1024; // soma declarada de tudo que será gravado
export const MAX_POR_ARQUIVO = 512 * 1024 * 1024;
const MAX_MANIFESTO = 1024 * 1024;
const RAZAO_MAX = 200; // descompactado ÷ compactado, para arquivos acima de 10 MB
const RAZAO_A_PARTIR_DE = 10 * 1024 * 1024;

const MIME_ZIP = 'application/zip';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_PDF = 'application/pdf';

// ── Utilidades ───────────────────────────────────────────────────────────────

const p2 = (n) => String(n).padStart(2, '0');

/** datetime.now().strftime('%Y%m%d_%H%M') */
function carimbo(d = new Date()) {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
}

/** datetime.now().isoformat() (hora local, microssegundos). */
export function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:`
    + `${p2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}000`;
}

function erro(message) {
  return { corpo: { error: true, message }, tipo: 'application/json', nomeArquivo: null };
}

/**
 * Content-Disposition como o desktop (`attachment; filename=x` ou com aspas). Para nome fora do
 * ASCII soma filename* (RFC 5987): o Node recusa cabeçalho com caractere acima de 0xFF.
 */
export function disposicao(nome, aspas) {
  if (/^[\x20-\x7e]*$/.test(nome) && !nome.includes('"')) {
    return aspas ? `attachment; filename="${nome}"` : `attachment; filename=${nome}`;
  }
  const ascii = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]|"/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

function download(corpo, tipo, nomeArquivo, aspas = false) {
  return {
    corpo, tipo, nomeArquivo,
    cabecalhos: { 'Content-Type': tipo, 'Content-Disposition': disposicao(nomeArquivo, aspas) },
  };
}

const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

/**
 * Um componente de caminho que pode virar nome de arquivo/pasta em Windows e macOS
 * sem surpresa: sem separador, sem "." / "..", sem caractere proibido, sem nome
 * reservado do Windows e sem ponto/espaço no fim (o Windows os descarta e dois nomes
 * diferentes caem no mesmo arquivo).
 */
export function segmentoSeguro(s) {
  return typeof s === 'string'
    && s.length > 0 && s.length <= 255
    && s !== '.' && s !== '..'
    && !/[\x00-\x1f\x7f<>:"/\\|?*]/.test(s)
    && !/[. ]$/.test(s)
    && !RESERVADOS_WINDOWS.test(s);
}

/** Nome de projeto aceito nas rotas (pasta direta de data/neural/). */
function projetoValido(nome) {
  return segmentoSeguro(nome) && nome.length <= 120;
}

/** Arquivos comuns (recursivo, sem seguir links/junções), em ordem. */
function arquivosRecursivos(dir) {
  const achados = [];
  const visitar = (d) => {
    let entradas;
    try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visitar(p);
      else if (e.isFile()) achados.push(p);
    }
  };
  visitar(dir);
  return achados.sort();
}

/** Data aceita pelo formato zip (DOS: 1980–2099). */
function mtimeZip(ms) {
  const d = new Date(ms);
  const ano = d.getFullYear();
  return ano >= 1980 && ano <= 2099 ? d : new Date();
}

/** Entrada do zip: nome com "/" (como o zipfile do Python grava, também no Windows). */
function adicionar(entradas, arquivo, base, prefixo) {
  const rel = path.relative(base, arquivo).split(path.sep).join('/');
  const st = fs.statSync(arquivo);
  entradas[`${prefixo}${rel}`] = [fs.readFileSync(arquivo), { mtime: mtimeZip(st.mtimeMs) }];
}

function zipar(entradas) {
  // Originais (PDF, imagem, áudio) já vêm comprimidos: guardar sem recompressão poupa CPU e memória.
  for (const [nome, valor] of Object.entries(entradas)) {
    if (nome.split('/').includes('originais')) valor[1] = { ...valor[1], level: 0 };
  }
  return Buffer.from(zipSync(entradas, { level: 6 }));
}

// ── POST /export/base ────────────────────────────────────────────────────────

/** ZIP com toda a data/neural/ (gestão incluída), nomes "neural/…" como o desktop. */
export async function exportarBase(raiz) {
  const c = caminhos(raiz);
  const entradas = {};
  for (const arquivo of arquivosRecursivos(c.neural)) adicionar(entradas, arquivo, c.data, '');
  return download(zipar(entradas), MIME_ZIP, `tusab_base_${carimbo()}.zip`);
}

// ── POST /export/tabela-videos ───────────────────────────────────────────────

function nomeAba(nome, usados) {
  let base = nome.replace(/[:\\/?*[\]]/g, '_').slice(0, 31) || 'Planilha';
  let n = 2;
  let atual = base;
  while (usados.has(atual.toLowerCase())) {
    const sufixo = ` (${n++})`;
    atual = `${base.slice(0, 31 - sufixo.length)}${sufixo}`;
  }
  usados.add(atual.toLowerCase());
  return atual;
}

/**
 * Planilha do CSV de gestão. Corpo: { projeto_nome } (ou o legado { canal }).
 * `padrao` = projeto ativo do motor (state.stats.projeto_nome no desktop).
 */
export async function exportarTabelaVideos(raiz, corpo = {}, padrao = '') {
  const canal = String(corpo?.projeto_nome || corpo?.canal || padrao || '').slice(0, 120);
  if (!canal) return erro(t('Nome do projeto não informado.'));
  const naoAchou = erro(t('CSV não encontrado para o canal \'{canal}\'.', { canal }));
  if (!projetoValido(canal)) return naoAchou;

  const gestao = path.join(caminhos(raiz).neural, canal, 'management');
  const direto = path.join(gestao, `${canal}_base.csv`);
  let csvs = [];
  if (fs.existsSync(direto)) csvs = [direto];
  else {
    // A mais que o desktop: projeto com nome diferente do canal ({canal}_base.csv).
    try {
      csvs = fs.readdirSync(gestao, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('_base.csv')).map((e) => path.join(gestao, e.name)).sort();
    } catch { csvs = []; }
  }
  if (!csvs.length) return naoAchou;

  const usados = new Set();
  const folhas = [];
  for (const csv of csvs) {
    const { colunas, linhas } = lerCsv(csv);
    if (!colunas.length) continue;
    const nome = csvs.length === 1 ? canal : path.basename(csv).replace(/_base\.csv$/, '');
    folhas.push({
      sheet: nomeAba(`@${nome}`, usados),
      data: [
        colunas.map((col) => ({ value: col, fontWeight: 'bold' })),
        ...linhas.map((l) => colunas.map((col) => (l[col] === undefined || l[col] === '' ? null : String(l[col])))),
      ],
      columns: colunas.map((col) => ({ width: Math.min(String(col).length * 1.2 + 2, 50) })),
      stickyRowsCount: 1,
    });
  }
  if (!folhas.length) return erro('CSV vazio.');

  const writeExcelFile = (await import('write-excel-file/node')).default;
  const buffer = await writeExcelFile(folhas).toBuffer();
  return download(Buffer.from(buffer), MIME_XLSX, `tusab_videos_${canal}_${carimbo()}.xlsx`);
}

// ── POST /export/relatorio-pdf ───────────────────────────────────────────────

// Caracteres além do Latin-1 que a codificação WinAnsi das fontes-padrão do PDF tem.
const EXTRAS_WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const TROCAS = { '→': '->', '←': '<-', '⇒': '=>', '≥': '>=', '≤': '<=', '≠': '!=', '✓': 'v', '✔': 'v', '✗': 'x', ' ': ' ' };

/** Texto que as fontes-padrão (Helvetica) desenham: o resto vira equivalente ou sai. */
function paraWinAnsi(texto) {
  let saida = '';
  for (const ch of String(texto ?? '').normalize('NFC')) {
    const cp = ch.codePointAt(0);
    if (ch === '\n' || ch === '\t') saida += ch;
    else if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa1 && cp <= 0xff) || EXTRAS_WINANSI.has(ch)) saida += ch;
    else if (TROCAS[ch]) saida += TROCAS[ch];
  }
  return saida.replace(/\r\n?/g, '\n');
}

const MAX_MENSAGENS_PDF = 2000;
const MAX_CHARS_MENSAGEM = 200_000;

/**
 * PDF com os pares pergunta/resposta. Corpo: { projeto_nome, mensagens: [{ role, content, fontes }] }.
 * A extensão não guarda histórico de chat: sem `mensagens`, responde o mesmo erro do desktop.
 */
export async function exportarRelatorioPdf(corpo = {}, padrao = '') {
  const canal = String(corpo?.projeto_nome || corpo?.canal_nome || padrao || 'chat').slice(0, 120);
  const hist = Array.isArray(corpo?.mensagens) ? corpo.mensagens.slice(0, MAX_MENSAGENS_PDF) : [];
  if (!hist.length) return erro(t('Sem histórico para exportar'));

  const PDFDocument = (await import('pdfkit')).default;
  const mm = 72 / 25.4;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 20 * mm, bottom: 20 * mm, left: 20 * mm, right: 20 * mm },
    info: { Title: paraWinAnsi(`Relatório de Pesquisa — @${canal}`), Author: 'Tusab', Creator: 'Tusab', Producer: 'Tusab' },
  });
  const partes = [];
  const pronto = new Promise((resolve, reject) => {
    doc.on('data', (b) => partes.push(b));
    doc.on('end', resolve);
    doc.on('error', reject);
  });
  const espaco = (milimetros) => { doc.y += milimetros * mm; };
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const normal = { width: largura, lineGap: 2 };

  // Título e cabeçalho (estilos Title / Italic / Normal do reportlab)
  doc.font('Helvetica-Bold').fontSize(18).text(paraWinAnsi(`Relatório de Pesquisa — @${canal}`), { ...normal, align: 'center' });
  espaco(4);
  const agora = new Date();
  doc.font('Helvetica-Oblique').fontSize(10).text('Gerado pelo Tusab', normal);
  doc.font('Helvetica').fontSize(10)
    .text(`Data: ${p2(agora.getDate())}/${p2(agora.getMonth() + 1)}/${agora.getFullYear()} ${p2(agora.getHours())}:${p2(agora.getMinutes())}`, normal);
  espaco(8);

  let pergunta = null;
  for (const msg of hist) {
    if (!msg || typeof msg !== 'object') continue;
    const role = String(msg.role || '');
    const conteudo = paraWinAnsi(String(msg.content ?? '').slice(0, MAX_CHARS_MENSAGEM)).trim();
    if (role === 'user') {
      pergunta = conteudo;
    } else if (role === 'assistant') {
      if (pergunta) {
        doc.font('Helvetica-Bold').fontSize(10).text('Pergunta: ', { ...normal, continued: true })
          .font('Helvetica').text(pergunta, normal);
        espaco(2);
        pergunta = null;
      }
      doc.font('Helvetica-Bold').fontSize(10).text('Tusab: ', { ...normal, continued: true })
        .font('Helvetica').text(conteudo || ' ', normal);
      const fontes = Array.isArray(msg.fontes) ? msg.fontes : [];
      if (fontes.length) {
        espaco(2);
        doc.font('Helvetica').fontSize(9);
        for (const fonte of fontes.slice(0, 200)) {
          if (!fonte || typeof fonte !== 'object') continue;
          const titulo = String(fonte.titulo || fonte.arquivo || '');
          const link = String(fonte.link || '');
          doc.text(paraWinAnsi(`    • ${titulo}${link ? ` — ${link}` : ''}`), normal);
        }
        doc.fontSize(10);
      }
      espaco(6);
    }
  }
  doc.end();
  await pronto;
  return download(Buffer.concat(partes), MIME_PDF, `tusab_relatorio_${canal}_${carimbo()}.pdf`);
}

// ── GET /export/base-compartilhavel/{projeto} ────────────────────────────────

/** Pasta do índice LanceDB do desktop: storage.INDEX_DIR + lance_store._sanitizar_prefixo. */
function pastaLance(raiz, projeto) {
  return path.join(caminhos(raiz).data, 'agent_index', `${projeto.replace(/[^\p{L}\p{N}_-]/gu, '_')}.lancedb`);
}

/**
 * Empacota um projeto em .tusab, no formato do desktop:
 *   neural/{projeto}/{youtube,documents,texts,management}/…
 *   agent_index/{projeto}.lancedb/…   (só se o índice do desktop existir nesta pasta)
 *   manifest.json                     { format, version, projeto, exportado_em, chunks, tem_indice, somente_leitura }
 */
const ehOriginal = (arquivo) => arquivo.split(/[\\/]/).includes('originais');

/**
 * comOriginais: os arquivos originais (documents/originais/) só vão junto por escolha
 * explícita — fotos e PDFs podem conter dados pessoais e metadados (parecer de segurança).
 */
export async function exportarBaseCompartilhavel(raiz, projeto, { comOriginais = false } = {}) {
  const nome = String(projeto ?? '').trim();
  if (!nome) return erro(t('Nome do projeto não informado.'));
  const c = caminhos(raiz);
  const pastaProj = path.join(c.neural, nome);
  if (!projetoValido(nome) || !fs.existsSync(pastaProj) || !fs.statSync(pastaProj).isDirectory()) {
    return erro(t('Projeto \'{nome}\' não encontrado.', { nome }));
  }

  const entradas = {};
  let chunks = 0;
  for (const sub of SUBPASTAS_TUSAB) {
    for (const arquivo of arquivosRecursivos(path.join(pastaProj, sub))) {
      if (!comOriginais && ehOriginal(path.relative(pastaProj, arquivo))) continue;
      adicionar(entradas, arquivo, pastaProj, `neural/${nome}/`);
      if (arquivo.endsWith('.txt')) chunks++;
    }
  }
  const lance = pastaLance(raiz, nome);
  const temIndice = fs.existsSync(lance) && fs.statSync(lance).isDirectory();
  if (temIndice) {
    for (const arquivo of arquivosRecursivos(lance)) adicionar(entradas, arquivo, lance, `agent_index/${nome}.lancedb/`);
  }
  const manifesto = {
    format: FORMATO_TUSAB,
    version: VERSAO_TUSAB,
    projeto: nome,
    exportado_em: isoLocal(),
    chunks,
    tem_indice: temIndice,
    somente_leitura: true,
  };
  entradas['manifest.json'] = [Buffer.from(JSON.stringify(manifesto, null, 2), 'utf8'), { mtime: new Date() }];
  return download(zipar(entradas), MIME_ZIP, `${nome.replace(/ /g, '_')}.tusab`, true);
}

// ── POST /import/base-compartilhavel ─────────────────────────────────────────

class ErroImportacao extends Error {}

/** Normaliza e classifica uma entrada do zip. Lança ErroImportacao se o caminho for perigoso. */
function classificarEntrada(nomeBruto) {
  // O zipfile do Python converte "\" em "/" ao ler no Windows: aqui também.
  const nome = String(nomeBruto).replace(/\\/g, '/');
  if (nome === 'manifest.json') return { tipo: 'manifesto', partes: [nome] };
  if (nome.endsWith('/')) return { tipo: 'pasta' };
  if (nome.startsWith('/') || /^[a-zA-Z]:/.test(nome) || nome.includes('\0')) {
    throw new ErroImportacao(t('Arquivo .tusab inválido: contém um caminho não permitido.'));
  }
  const partes = nome.split('/');
  if (partes.some((s) => s === '..' || s === '.' || s === '')) {
    throw new ErroImportacao(t('Arquivo .tusab inválido: contém um caminho não permitido.'));
  }
  if (partes[0] === 'neural' || partes[0] === 'agent_index') return { tipo: partes[0], partes };
  return { tipo: 'ignorado' }; // como o desktop: o que não é neural/ nem agent_index/ fica de fora
}

function temArquivo(dir) {
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  return entradas.some((e) => e.isFile() || e.isSymbolicLink() || (e.isDirectory() && temArquivo(path.join(dir, e.name))));
}

/**
 * Importa um .tusab (gerado pelo desktop ou pela extensão).
 * @param {{ nome: string, bytes: Buffer|Uint8Array }} arquivo  campo `arquivo` do FormData
 * @returns JSON igual ao do desktop ({ ok, projeto, chunks, tem_indice, somente_leitura, message } ou { error, message })
 *
 * Endurecido em relação ao desktop: tudo é conferido antes de gravar qualquer arquivo; caminho
 * absoluto, "..", nome reservado do Windows ou arquivo de outro projeto recusam o .tusab inteiro;
 * limites de tamanho, de quantidade e de taxa de compressão (zip-bomba); pastas que sejam links
 * para fora de data/ são recusadas; e não sobrescreve um projeto próprio (não recebido) do usuário.
 */
export function importarBaseCompartilhavel(raiz, { nome, bytes } = {}) {
  if (!String(nome || '').toLowerCase().endsWith('.tusab')) return { error: true, message: t('Arquivo deve ter extensão .tusab') };
  if (!bytes || !bytes.length) return { error: true, message: t('Arquivo corrompido ou não é um .tusab válido.') };
  if (bytes.length > TAMANHO_MAX_TUSAB) {
    return { error: true, message: t('Arquivo .tusab grande demais (máximo de {v} MB).', { v: Math.round(TAMANHO_MAX_TUSAB / 1048576) }) };
  }
  const dados = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const corrompido = { error: true, message: t('Arquivo corrompido ou não é um .tusab válido.') };

  try {
    // 1ª passada: lista as entradas (sem descompactar nada) e lê só o manifest.json.
    const lista = [];
    const soManifesto = unzipSync(dados, {
      filter: (f) => {
        lista.push(f);
        if (lista.length > MAX_ENTRADAS_TUSAB) throw new ErroImportacao(t('Arquivo .tusab com arquivos demais.'));
        return f.name === 'manifest.json' && f.originalSize <= MAX_MANIFESTO;
      },
    });
    if (!lista.some((f) => f.name === 'manifest.json')) {
      return { error: true, message: t('Arquivo .tusab inválido: manifest.json ausente.') };
    }
    if (!soManifesto['manifest.json']) return corrompido;
    let manifesto;
    try {
      manifesto = JSON.parse(Buffer.from(soManifesto['manifest.json']).toString('utf8').replace(/^﻿/, ''));
    } catch {
      return corrompido;
    }
    if (!manifesto || typeof manifesto !== 'object' || manifesto.format !== FORMATO_TUSAB) {
      return { error: true, message: t('Formato de arquivo não reconhecido.') };
    }
    const projeto = String(manifesto.projeto ?? '').trim();
    if (!projeto) return { error: true, message: t('Manifest sem nome de projeto.') };
    if (!projetoValido(projeto)) return { error: true, message: t('Arquivo .tusab inválido: nome de projeto não permitido.') };

    // Confere cada caminho e os tamanhos declarados antes de descompactar.
    const aceitos = new Map(); // nome no zip → partes do destino (relativas a data/)
    let total = 0;
    for (const f of lista) {
      const { tipo, partes } = classificarEntrada(f.name);
      if (tipo !== 'neural' && tipo !== 'agent_index') continue;
      const doProjeto = tipo === 'neural'
        ? partes.length >= 4 && partes[1] === projeto && SUBPASTAS_TUSAB.includes(partes[2])
        : partes.length >= 3 && partes[1] === `${projeto}.lancedb`;
      if (!doProjeto || !partes.slice(1).every(segmentoSeguro)) {
        throw new ErroImportacao(t('Arquivo .tusab inválido: contém um caminho não permitido.'));
      }
      if (f.compression !== 0 && f.compression !== 8) return corrompido;
      if (f.originalSize > MAX_POR_ARQUIVO) throw new ErroImportacao(t('Arquivo .tusab inválido: arquivo interno grande demais.'));
      if (f.originalSize > RAZAO_A_PARTIR_DE && f.originalSize / Math.max(f.size, 1) > RAZAO_MAX) {
        throw new ErroImportacao(t('Arquivo .tusab inválido: compressão suspeita (possível zip-bomba).'));
      }
      total += f.originalSize;
      if (total > MAX_TOTAL_DESCOMPACTADO) throw new ErroImportacao(t('Arquivo .tusab inválido: conteúdo descompactado grande demais.'));
      aceitos.set(f.name, partes);
    }

    // Não sobrescreve um projeto próprio do usuário (só uma base recebida, marcada como somente leitura).
    const c = caminhos(raiz);
    const pastaProj = path.join(c.neural, projeto);
    if (fs.existsSync(path.join(pastaProj, '_readonly.json')) === false && temArquivo(pastaProj)) {
      return {
        error: true,
        message: t('Já existe um projeto \'{projeto}\' com conteúdo próprio neste computador. Renomeie ou exclua esse projeto antes de importar.', { projeto }),
      };
    }

    // 2ª passada: descompacta só o que foi aceito (a saída nunca passa do tamanho declarado).
    const conteudo = aceitos.size ? unzipSync(dados, { filter: (f) => aceitos.has(f.name) }) : {};
    const lista2 = new Map(lista.map((f) => [f.name, f.originalSize]));
    for (const nomeZip of aceitos.keys()) {
      if (!conteudo[nomeZip] || conteudo[nomeZip].length !== lista2.get(nomeZip)) return corrompido;
    }

    // Grava, conferindo que cada destino (com links resolvidos) fica dentro de data/.
    fs.mkdirSync(c.data, { recursive: true });
    const dataReal = fs.realpathSync(c.data);
    for (const [nomeZip, partes] of aceitos) {
      // Original vindo de terceiros: só tipos permitidos e com assinatura válida (nada de .exe/.lnk/.hta/SVG/HTML).
      if (partes.includes('originais')) {
        try { verificarArquivo(partes.at(-1), Buffer.from(conteudo[nomeZip])); } catch { continue; }
      }
      const destino = path.join(c.data, ...partes);
      if (!dentroDe(c.data, destino)) throw new ErroImportacao(t('Arquivo .tusab inválido: contém um caminho não permitido.'));
      const pasta = path.dirname(destino);
      fs.mkdirSync(pasta, { recursive: true });
      if (!dentroDe(dataReal, path.join(fs.realpathSync(pasta), path.basename(destino)))) {
        throw new ErroImportacao(t('Arquivo .tusab inválido: contém um caminho não permitido.'));
      }
      if (fs.existsSync(destino) && fs.lstatSync(destino).isDirectory()) return corrompido;
      escreverAtomico(destino, conteudo[nomeZip]);
    }

    if (manifesto.somente_leitura) {
      fs.mkdirSync(pastaProj, { recursive: true });
      salvarJson(path.join(pastaProj, '_readonly.json'), { somente_leitura: true, importado_em: isoLocal() });
    }

    return {
      ok: true,
      projeto,
      chunks: manifesto.chunks ?? 0,
      tem_indice: manifesto.tem_indice ?? false,
      somente_leitura: manifesto.somente_leitura ?? false,
      message: t('Base \'{projeto}\' importada com sucesso.', { projeto }),
    };
  } catch (e) {
    if (e instanceof ErroImportacao) return { error: true, message: e.message };
    return corrompido;
  }
}

// ── GET /export/readonly-status ──────────────────────────────────────────────

/** { projeto: bool } — quais projetos são bases recebidas (somente leitura). */
export function statusSomenteLeitura(raiz) {
  const neural = caminhos(raiz).neural;
  const resultado = {};
  let entradas;
  try { entradas = fs.readdirSync(neural, { withFileTypes: true }); } catch { return resultado; }
  for (const e of entradas) {
    if (!e.isDirectory()) continue;
    resultado[e.name] = fs.existsSync(path.join(neural, e.name, '_readonly.json'));
  }
  return resultado;
}
