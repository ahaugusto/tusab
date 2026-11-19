// Fase B — exportações e base compartilhável (.tusab), no formato do desktop.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import readExcelFile from 'read-excel-file/node';
import { COLUNAS_BASE, salvarCsv } from '../src/nucleo/gestao.js';
import { extrairTextoDeArquivo } from '../src/nucleo/documentos.js';
import {
  exportarBase, exportarBaseCompartilhavel, exportarRelatorioPdf, exportarTabelaVideos,
  importarBaseCompartilhavel, segmentoSeguro, statusSomenteLeitura,
} from '../src/nucleo/exportar.js';

const raizes = [];
function novaRaiz() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-exportar-'));
  raizes.push(r);
  return r;
}
after(() => { for (const r of raizes) fs.rmSync(r, { recursive: true, force: true }); });

const escrever = (p, conteudo) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, conteudo); };
const neural = (raiz) => path.join(raiz, 'data', 'neural');

/** Uma base como o motor grava: projeto "Bio" com o canal "canalteste" (nomes diferentes). */
function montarBase(raiz, projeto = 'Bio') {
  const p = path.join(neural(raiz), projeto);
  escrever(path.join(p, 'youtube', 'canalteste', 'canalteste_Parte_1.txt'),
    '\uFEFF# Tusab — Base de Conhecimento\n\nTITULO: Fotossíntese explicada\nLINK: https://www.youtube.com/watch?v=AAAAAAAAAA1\nCONTEUDO:\nA clorofila absorve a luz.\n');
  escrever(path.join(p, 'youtube', 'canalteste', 'canalteste_meta.json'), JSON.stringify({ canal_nome: 'Canal Teste' }));
  fs.mkdirSync(path.join(p, 'management'), { recursive: true });
  salvarCsv(path.join(p, 'management', 'canalteste_base.csv'), COLUNAS_BASE, [
    { ID: 'AAAAAAAAAA1', Data_Pub: '10/01/2026', Link: 'https://www.youtube.com/watch?v=AAAAAAAAAA1', Titulo: 'Fotossíntese, parte "1"', Aba: 'Videos', Views: '1500', Local: 'canalteste_Parte_1', Status: 'Sucesso', Data_Extracao: '2026-11-17' },
    { ID: 'AAAAAAAAAA3', Data_Pub: '01/03/2026', Link: 'https://www.youtube.com/watch?v=AAAAAAAAAA3', Titulo: 'Vídeo sem legenda', Aba: 'Videos', Views: '40', Local: 'N/A', Status: 'Sem Legenda', Data_Extracao: '2026-11-17' },
  ]);
  escrever(path.join(p, 'management', 'canalteste_summary.json'), JSON.stringify({ total_mapeado: 2 }));
  escrever(path.join(p, 'texts', 'ab12cd34_nota.txt'), 'TITULO: nota\nFONTE: texto\nDATA: 17/11/2026\n----\nConteúdo da nota.');
  escrever(path.join(p, 'texts', '_manifest.json'), JSON.stringify([{ id: 'ab12cd34', titulo: 'nota', nome_txt: 'ab12cd34_nota.txt' }], null, 2));
  escrever(path.join(p, 'documents', 'original.bin'), Buffer.from([0, 1, 2, 3, 255]));
  return p;
}

function arquivosRelativos(dir) {
  const r = [];
  const visitar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) visitar(p);
      else r.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(dir)) visitar(dir);
  return r.sort();
}

let raizA;
before(() => {
  raizA = novaRaiz();
  montarBase(raizA);
});

test('segmentoSeguro recusa nomes perigosos em Windows e macOS', () => {
  for (const ok of ['Bio', 'Biologia_Geral', 'canal.lancedb', 'Filosofia e Ética', 'a.txt']) assert.ok(segmentoSeguro(ok), ok);
  for (const ruim of ['', '.', '..', 'a/b', 'a\\b', 'CON', 'nul.txt', 'COM1.log', 'x:y', 'fim.', 'fim ', 'a\u0000b', 'a?b']) {
    assert.ok(!segmentoSeguro(ruim), JSON.stringify(ruim));
  }
});

test('POST /export/base: zip de data/neural com nomes "neural/…" e cabeçalho do desktop', async () => {
  const r = await exportarBase(raizA);
  assert.equal(r.tipo, 'application/zip');
  assert.match(r.nomeArquivo, /^tusab_base_\d{8}_\d{4}\.zip$/);
  assert.equal(r.cabecalhos['Content-Disposition'], `attachment; filename=${r.nomeArquivo}`);
  assert.equal(r.cabecalhos['Content-Type'], 'application/zip');
  const zip = unzipSync(new Uint8Array(r.corpo));
  const esperados = arquivosRelativos(neural(raizA)).map((n) => `neural/${n}`);
  assert.deepEqual(Object.keys(zip).sort(), esperados);
  const txt = 'neural/Bio/youtube/canalteste/canalteste_Parte_1.txt';
  assert.deepEqual(Buffer.from(zip[txt]), fs.readFileSync(path.join(neural(raizA), 'Bio', 'youtube', 'canalteste', 'canalteste_Parte_1.txt')));
});

test('.tusab ida e volta: exportar → importar em outra raiz → arquivos e manifestos iguais', async () => {
  const r = await exportarBaseCompartilhavel(raizA, 'Bio');
  assert.equal(r.tipo, 'application/zip');
  assert.equal(r.nomeArquivo, 'Bio.tusab');
  assert.equal(r.cabecalhos['Content-Disposition'], 'attachment; filename="Bio.tusab"');

  const zip = unzipSync(new Uint8Array(r.corpo));
  const nomes = Object.keys(zip);
  assert.ok(nomes.every((n) => n === 'manifest.json' || n.startsWith('neural/Bio/')), nomes.join(', '));
  const manifesto = JSON.parse(Buffer.from(zip['manifest.json']).toString('utf8'));
  assert.deepEqual(Object.keys(manifesto), ['format', 'version', 'projeto', 'exportado_em', 'chunks', 'tem_indice', 'somente_leitura']);
  assert.equal(manifesto.format, 'tusab-base');
  assert.equal(manifesto.version, 1);
  assert.equal(manifesto.projeto, 'Bio');
  assert.equal(manifesto.chunks, 2); // os .txt (transcrição + nota)
  assert.equal(manifesto.tem_indice, false);
  assert.equal(manifesto.somente_leitura, true);
  assert.match(manifesto.exportado_em, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/);

  const raizB = novaRaiz();
  const imp = importarBaseCompartilhavel(raizB, { nome: 'Bio.tusab', bytes: r.corpo });
  assert.deepEqual(imp, {
    ok: true, projeto: 'Bio', chunks: 2, tem_indice: false, somente_leitura: true, message: "Base 'Bio' importada com sucesso.",
  });
  const origem = arquivosRelativos(path.join(neural(raizA), 'Bio'));
  const destino = arquivosRelativos(path.join(neural(raizB), 'Bio')).filter((n) => n !== '_readonly.json');
  assert.deepEqual(destino, origem);
  for (const n of origem) {
    assert.deepEqual(fs.readFileSync(path.join(neural(raizB), 'Bio', n)), fs.readFileSync(path.join(neural(raizA), 'Bio', n)), n);
  }
  const ro = JSON.parse(fs.readFileSync(path.join(neural(raizB), 'Bio', '_readonly.json'), 'utf8'));
  assert.equal(ro.somente_leitura, true);
  assert.match(ro.importado_em, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(statusSomenteLeitura(raizB), { Bio: true });
  assert.deepEqual(statusSomenteLeitura(raizA), { Bio: false });

  // Reexportar da raiz B gera o mesmo conteúdo e o mesmo manifesto (fora a data).
  const r2 = await exportarBaseCompartilhavel(raizB, 'Bio');
  const zip2 = unzipSync(new Uint8Array(r2.corpo));
  assert.deepEqual(Object.keys(zip2).sort(), nomes.sort());
  const m2 = JSON.parse(Buffer.from(zip2['manifest.json']).toString('utf8'));
  assert.deepEqual({ ...m2, exportado_em: '' }, { ...manifesto, exportado_em: '' });

  // Base recebida (somente leitura) pode ser atualizada importando de novo.
  assert.equal(importarBaseCompartilhavel(raizB, { nome: 'Bio.tusab', bytes: r.corpo }).ok, true);
});

/** .tusab como o desktop (zipfile do Python) grava: nomes com "/", índice LanceDB, manifesto indentado. */
function tusabDoDesktop({ projeto = 'Filosofia', extras = {}, manifesto = {} } = {}) {
  const m = {
    format: 'tusab-base', version: 1, projeto, exportado_em: '2026-11-01T10:00:00.123456',
    chunks: 1, tem_indice: true, somente_leitura: true, ...manifesto,
  };
  return Buffer.from(zipSync({
    [`neural/${projeto}/youtube/Cortella/Cortella_Parte_1.txt`]: strToU8('\uFEFF# Tusab — Base de Conhecimento\nTITULO: Ética\nCONTEUDO:\nO que é ética?\n'),
    [`neural/${projeto}/management/Cortella_base.csv`]: strToU8('\uFEFFID,Data_Pub,Link,Titulo,Aba,Views,Local,Status,Data_Extracao\nCCCCCCCCCC1,01/01/2026,https://www.youtube.com/watch?v=CCCCCCCCCC1,Ética,Videos,10,Cortella_Parte_1,Sucesso,2026-11-01\n'),
    [`neural/${projeto}/texts/_manifest.json`]: strToU8('[]'),
    [`agent_index/${projeto}.lancedb/_versions/1.manifest`]: new Uint8Array([1, 2, 3]),
    [`agent_index/${projeto}.lancedb/data/abc.lance`]: new Uint8Array(2048).fill(7),
    ...extras,
    'manifest.json': strToU8(JSON.stringify(m, null, 2)),
  }));
}

test('.tusab gerado pelo desktop importa na extensão (e volta com o índice)', async () => {
  const raiz = novaRaiz();
  const bytes = tusabDoDesktop({ extras: { 'outros/leia-me.txt': strToU8('fora do formato') } });
  const imp = importarBaseCompartilhavel(raiz, { nome: 'Filosofia.tusab', bytes });
  assert.deepEqual(imp, {
    ok: true, projeto: 'Filosofia', chunks: 1, tem_indice: true, somente_leitura: true, message: "Base 'Filosofia' importada com sucesso.",
  });
  const data = path.join(raiz, 'data');
  assert.match(fs.readFileSync(path.join(data, 'neural', 'Filosofia', 'youtube', 'Cortella', 'Cortella_Parte_1.txt'), 'utf8'), /O que é ética\?/);
  assert.ok(fs.existsSync(path.join(data, 'neural', 'Filosofia', 'management', 'Cortella_base.csv')));
  assert.deepEqual([...fs.readFileSync(path.join(data, 'agent_index', 'Filosofia.lancedb', '_versions', '1.manifest'))], [1, 2, 3]);
  assert.equal(fs.statSync(path.join(data, 'agent_index', 'Filosofia.lancedb', 'data', 'abc.lance')).size, 2048);
  assert.ok(!fs.existsSync(path.join(data, 'outros')), 'o que não é neural/ nem agent_index/ fica de fora');
  assert.ok(fs.existsSync(path.join(data, 'neural', 'Filosofia', '_readonly.json')));

  // Vice-versa: o .tusab da extensão leva o índice do desktop junto, com os mesmos nomes.
  const r = await exportarBaseCompartilhavel(raiz, 'Filosofia');
  const zip = unzipSync(new Uint8Array(r.corpo));
  assert.ok(zip['agent_index/Filosofia.lancedb/data/abc.lance']);
  assert.equal(JSON.parse(Buffer.from(zip['manifest.json']).toString()).tem_indice, true);

  // Nomes com "\" (zip montado à mão no Windows) caem no lugar certo, como no zipfile do Python.
  const raiz2 = novaRaiz();
  const comBarra = Buffer.from(zipSync({
    'neural\\Mat\\texts\\a.txt': strToU8('conteúdo'),
    'manifest.json': strToU8(JSON.stringify({ format: 'tusab-base', version: 1, projeto: 'Mat', chunks: 1 })),
  }));
  const r2 = importarBaseCompartilhavel(raiz2, { nome: 'Mat.tusab', bytes: comBarra });
  assert.equal(r2.ok, true);
  assert.equal(r2.somente_leitura, false);
  assert.equal(fs.readFileSync(path.join(raiz2, 'data', 'neural', 'Mat', 'texts', 'a.txt'), 'utf8'), 'conteúdo');
  assert.ok(!fs.existsSync(path.join(raiz2, 'data', 'neural', 'Mat', '_readonly.json')));
});

test('zip-slip e caminhos perigosos recusam o .tusab inteiro, sem gravar nada', () => {
  const perigosos = [
    'neural/Bio/texts/../../../../fora.txt',
    'neural/Bio/texts/..\\..\\..\\..\\fora.txt',
    '../fora.txt',
    '/tmp/fora.txt',
    'C:/fora.txt',
    'neural/Outro/texts/a.txt', // arquivo de outro projeto
    'agent_index/Outro.lancedb/x',
    'neural/Bio/texts/CON.txt',
    'neural/Bio/config/x.txt', // subpasta fora do formato
    'neural/Bio/_readonly.json',
  ];
  for (const nome of perigosos) {
    const raiz = novaRaiz();
    const bytes = Buffer.from(zipSync({
      'neural/Bio/texts/ok.txt': strToU8('ok'),
      [nome]: strToU8('mal'),
      'manifest.json': strToU8(JSON.stringify({ format: 'tusab-base', version: 1, projeto: 'Bio' })),
    }));
    const r = importarBaseCompartilhavel(raiz, { nome: 'Bio.tusab', bytes });
    assert.equal(r.error, true, nome);
    assert.match(r.message, /caminho não permitido/, nome);
    assert.ok(!fs.existsSync(path.join(raiz, 'data', 'neural', 'Bio')), `nada gravado (${nome})`);
    assert.ok(!fs.existsSync(path.join(raiz, 'fora.txt')) && !fs.existsSync(path.join(path.dirname(raiz), 'fora.txt')));
  }
  // Nome de projeto perigoso no manifesto
  const raiz = novaRaiz();
  const bytes = Buffer.from(zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'tusab-base', projeto: '..' })) }));
  assert.match(importarBaseCompartilhavel(raiz, { nome: 'x.tusab', bytes }).message, /nome de projeto não permitido/);
});

test('zip-bomba é recusada pela taxa de compressão', () => {
  const raiz = novaRaiz();
  const bytes = Buffer.from(zipSync({
    'neural/Bio/texts/grande.txt': new Uint8Array(20 * 1024 * 1024), // 20 MB de zeros ≈ 20 KB compactado
    'manifest.json': strToU8(JSON.stringify({ format: 'tusab-base', version: 1, projeto: 'Bio' })),
  }));
  const r = importarBaseCompartilhavel(raiz, { nome: 'Bio.tusab', bytes });
  assert.equal(r.error, true);
  assert.match(r.message, /zip-bomba/);
  assert.ok(!fs.existsSync(path.join(raiz, 'data', 'neural', 'Bio')));
});

test('importação: mensagens de erro do desktop e projeto próprio protegido', () => {
  const raiz = novaRaiz();
  const imp = (nome, bytes) => importarBaseCompartilhavel(raiz, { nome, bytes });
  assert.deepEqual(imp('base.zip', tusabDoDesktop()), { error: true, message: 'Arquivo deve ter extensão .tusab' });
  assert.deepEqual(imp('x.tusab', Buffer.from('isto não é um zip')), { error: true, message: 'Arquivo corrompido ou não é um .tusab válido.' });
  assert.deepEqual(imp('x.tusab', Buffer.from(zipSync({ 'neural/X/texts/a.txt': strToU8('a') }))),
    { error: true, message: 'Arquivo .tusab inválido: manifest.json ausente.' });
  assert.deepEqual(imp('x.tusab', Buffer.from(zipSync({ 'manifest.json': strToU8('{"format":"outro","projeto":"X"}') }))),
    { error: true, message: 'Formato de arquivo não reconhecido.' });
  assert.deepEqual(imp('x.tusab', Buffer.from(zipSync({ 'manifest.json': strToU8('{"format":"tusab-base","projeto":"  "}') }))),
    { error: true, message: 'Manifest sem nome de projeto.' });

  // Projeto do próprio usuário com o mesmo nome não é sobrescrito.
  montarBase(raiz, 'Filosofia');
  const r = imp('Filosofia.tusab', tusabDoDesktop());
  assert.equal(r.error, true);
  assert.match(r.message, /Já existe um projeto 'Filosofia'/);
  assert.ok(!fs.existsSync(path.join(raiz, 'data', 'neural', 'Filosofia', 'youtube', 'Cortella')));
});

test('GET /export/base-compartilhavel: erros do desktop e nomes fora da pasta', async () => {
  assert.deepEqual((await exportarBaseCompartilhavel(raizA, '  ')).corpo, { error: true, message: 'Nome do projeto não informado.' });
  assert.deepEqual((await exportarBaseCompartilhavel(raizA, 'Nada')).corpo, { error: true, message: "Projeto 'Nada' não encontrado." });
  for (const ruim of ['..', '../data', 'Bio/../..']) {
    const r = await exportarBaseCompartilhavel(raizA, ruim);
    assert.equal(r.tipo, 'application/json');
    assert.equal(r.corpo.error, true, ruim);
  }
});

test('POST /export/relatorio-pdf gera um PDF com as perguntas e respostas', async () => {
  const mensagens = [
    { role: 'user', content: 'O que é fotossíntese?' },
    { role: 'assistant', content: 'É o processo em que a planta → transforma luz em energia química. 😀', fontes: [{ titulo: 'Aula 1', link: 'https://www.youtube.com/watch?v=AAAAAAAAAA1&t=30s' }] },
  ];
  const r = await exportarRelatorioPdf({ projeto_nome: 'Bio', mensagens });
  assert.equal(r.tipo, 'application/pdf');
  assert.match(r.nomeArquivo, /^tusab_relatorio_Bio_\d{8}_\d{4}\.pdf$/);
  assert.equal(r.cabecalhos['Content-Disposition'], `attachment; filename=${r.nomeArquivo}`);
  assert.equal(r.corpo.subarray(0, 4).toString('latin1'), '%PDF');
  const { texto } = await extrairTextoDeArquivo(r.corpo, 'relatorio.pdf');
  for (const trecho of ['Relatório de Pesquisa', '@Bio', 'Gerado pelo Tusab', 'Pergunta:', 'O que é fotossíntese?', 'Tusab:', 'Aula 1']) {
    assert.ok(texto.includes(trecho), `${trecho} em: ${texto.slice(0, 300)}`);
  }
  assert.deepEqual((await exportarRelatorioPdf({ projeto_nome: 'Bio' })).corpo, { error: true, message: 'Sem histórico para exportar' });
});

test('POST /export/tabela-videos gera XLSX legível com o CSV de gestão', async () => {
  // Projeto com nome diferente do canal: a extensão acha {canal}_base.csv.
  const r = await exportarTabelaVideos(raizA, { projeto_nome: 'Bio' });
  assert.equal(r.tipo, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(r.nomeArquivo, /^tusab_videos_Bio_\d{8}_\d{4}\.xlsx$/);
  const [aba] = await readExcelFile(r.corpo);
  assert.equal(aba.sheet, '@Bio');
  assert.deepEqual(aba.data[0], COLUNAS_BASE);
  assert.deepEqual(aba.data[1].slice(0, 4), ['AAAAAAAAAA1', '10/01/2026', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', 'Fotossíntese, parte "1"']);
  assert.equal(aba.data[2][7], 'Sem Legenda');
  assert.equal(aba.data.length, 3);

  // Caso do desktop: neural/{p}/management/{p}_base.csv; campo legado "canal" e projeto ativo.
  const raiz = novaRaiz();
  fs.mkdirSync(path.join(neural(raiz), 'canal', 'management'), { recursive: true });
  salvarCsv(path.join(neural(raiz), 'canal', 'management', 'canal_base.csv'), COLUNAS_BASE, [{ ID: 'X1', Status: 'Sucesso' }]);
  const [abaLegada] = await readExcelFile((await exportarTabelaVideos(raiz, { canal: 'canal' })).corpo);
  assert.equal(abaLegada.sheet, '@canal');
  assert.equal(abaLegada.data[1][0], 'X1');
  assert.equal((await exportarTabelaVideos(raiz, {}, 'canal')).tipo.includes('spreadsheetml'), true);

  assert.deepEqual((await exportarTabelaVideos(raiz, {})).corpo, { error: true, message: 'Nome do projeto não informado.' });
  assert.deepEqual((await exportarTabelaVideos(raiz, { projeto_nome: 'Nada' })).corpo, { error: true, message: "CSV não encontrado para o canal 'Nada'." });
  assert.equal((await exportarTabelaVideos(raiz, { projeto_nome: '..' })).corpo.error, true);
});
