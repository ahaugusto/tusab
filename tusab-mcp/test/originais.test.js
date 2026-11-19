// Originais guardados: tipos e assinaturas, caminho só por convenção, duplicata,
// exclusão, .tusab (sem originais por padrão) e a leitura pela IA (tusab_ler_original).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { caminhoOriginal, verificarArquivo } from '../src/nucleo/originais.js';
import { excluirArquivo, salvarDocumento } from '../src/nucleo/repositorio.js';
import { exportarBaseCompartilhavel, importarBaseCompartilhavel } from '../src/nucleo/exportar.js';
import { criarProjeto } from '../src/nucleo/gestao.js';
import { garantirEstrutura } from '../src/nucleo/caminhos.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const ENTRADA = fileURLToPath(new URL('../src/index.js', import.meta.url));

function pdf(paginas) {
  return new Promise((ok) => {
    const d = new PDFDocument(); const b = [];
    d.on('data', (x) => b.push(x)); d.on('end', () => ok(Buffer.concat(b)));
    paginas.forEach((t, i) => { if (i) d.addPage(); d.text(t); });
    d.end();
  });
}

function novaRaiz(nome) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), `tusab-orig-${nome}-`));
  garantirEstrutura(raiz);
  criarProjeto(raiz, 'Acervo');
  return raiz;
}
const docsDir = (raiz) => path.join(raiz, 'data', 'neural', 'Acervo', 'documents');
const manifesto = (raiz) => JSON.parse(fs.readFileSync(path.join(docsDir(raiz), '_manifest.json'), 'utf8'));

test('tipo conferido pela assinatura: extensão trocada, SVG, HTML e executável são recusados', async () => {
  assert.equal(verificarArquivo('foto.png', PNG).mime, 'image/png');
  assert.equal(verificarArquivo('a.pdf', await pdf(['x'])).categoria, 'documento');
  assert.throws(() => verificarArquivo('foto.png', await_pdf_bytes()), /não corresponde a um arquivo PNG/);
  for (const nome of ['a.svg', 'a.html', 'a.exe', 'a.hta', 'a.lnk', 'semextensao']) {
    assert.throws(() => verificarArquivo(nome, Buffer.from('MZ')), /Formato não suportado/, nome);
  }
});
function await_pdf_bytes() { return Buffer.from('%PDF-1.4 falso'); }

test('caminho do original só por convenção: manifesto adulterado não aponta para fora', () => {
  const dir = path.join(os.tmpdir(), 'x', 'documents');
  assert.equal(caminhoOriginal(dir, { id: '../../..', nome_original: 'a.pdf' }), null);
  assert.equal(caminhoOriginal(dir, { id: 'abcd1234', nome_original: 'C:\\Users\\x\\.ssh\\id_rsa' }), null);
  assert.equal(caminhoOriginal(dir, { id: 'abcd1234', nome_original: '../../segredo.pdf' }),
    path.join(dir, 'originais', 'abcd1234_______segredo.pdf'));
});

test('envio guarda o original, recusa duplicata e excluir apaga o original', async () => {
  const raiz = novaRaiz('envio');
  try {
    const r = await salvarDocumento(raiz, { nome: 'mapa.png', bytes: PNG, projeto: 'Acervo' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.aviso, /Imagem guardada/);
    const [item] = manifesto(raiz);
    const original = path.join(docsDir(raiz), 'originais', `${item.id}_mapa.png`);
    assert.ok(fs.existsSync(original));
    assert.match(item.sha256, /^[0-9a-f]{64}$/);
    const dup = await salvarDocumento(raiz, { nome: 'outro-nome.png', bytes: PNG, projeto: 'Acervo' });
    assert.match(dup.message, /já está no projeto \("mapa\.png"\)/);
    const falso = await salvarDocumento(raiz, { nome: 'falso.pdf', bytes: Buffer.from('MZ executável'), projeto: 'Acervo' });
    assert.match(falso.message, /não corresponde a um arquivo PDF/);
    assert.deepEqual(excluirArquivo(raiz, 'documents', item.id), { ok: true });
    assert.ok(!fs.existsSync(original), 'excluir apaga o original');
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('.tusab: originais só com opção; na importação, original de tipo perigoso é descartado', async () => {
  const raiz = novaRaiz('tusab');
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-orig-destino-'));
  try {
    await salvarDocumento(raiz, { nome: 'mapa.png', bytes: PNG, projeto: 'Acervo' });
    const sem = await exportarBaseCompartilhavel(raiz, 'Acervo');
    assert.ok(!Object.keys(unzipSync(new Uint8Array(sem.corpo))).some((n) => n.includes('/originais/')));
    const com = await exportarBaseCompartilhavel(raiz, 'Acervo', { comOriginais: true });
    const nomes = Object.keys(unzipSync(new Uint8Array(com.corpo)));
    assert.ok(nomes.some((n) => /\/documents\/originais\/[0-9a-f]{8}_mapa\.png$/.test(n)));

    // Base de terceiros com um "original" perigoso: o .exe e o PNG falso não entram; o PNG real entra.
    const arquivos = unzipSync(new Uint8Array(com.corpo));
    arquivos['neural/Acervo/documents/originais/abcd1234_virus.exe'] = strToU8('MZ...');
    arquivos['neural/Acervo/documents/originais/abcd1235_falso.png'] = strToU8('<script>alert(1)</script>');
    const r = importarBaseCompartilhavel(destino, { nome: 'acervo.tusab', bytes: Buffer.from(zipSync(arquivos)) });
    assert.equal(r.ok, true, JSON.stringify(r));
    const pasta = path.join(destino, 'data', 'neural', 'Acervo', 'documents', 'originais');
    const recebidos = fs.readdirSync(pasta);
    assert.ok(recebidos.some((n) => n.endsWith('_mapa.png')));
    assert.ok(!recebidos.some((n) => n.endsWith('.exe') || n.endsWith('_falso.png')));
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
    fs.rmSync(destino, { recursive: true, force: true });
  }
});

test('tusab_ler_original pela IA: imagem volta como imagem; PDF por páginas; fonte inexistente é erro', async () => {
  const raiz = novaRaiz('ia');
  await salvarDocumento(raiz, { nome: 'grafico.png', bytes: PNG, projeto: 'Acervo' });
  await salvarDocumento(raiz, { nome: 'relatorio.pdf', bytes: await pdf(['Introdução sobre mitocôndrias.', 'Resultados: ribossomos produzem proteínas.', 'Conclusão.']), projeto: 'Acervo' });
  const cliente = new Client({ name: 't', version: '0' });
  await cliente.connect(new StdioClientTransport({
    command: process.execPath, args: [ENTRADA], stderr: 'ignore',
    env: { ...process.env, TUSAB_REPOSITORIO: raiz, TUSAB_SEM_BOAS_VINDAS: '1' },
  }));
  try {
    const texto = (r) => r.content.find((c) => c.type === 'text')?.text || '';
    const busca = texto(await cliente.callTool({ name: 'tusab_buscar', arguments: { consulta: 'ribossomos' } }));
    assert.match(busca, /\[Página 2\]/, 'o trecho do PDF traz a página');
    const pdfId = Number(busca.match(/fonte_id (\d+)/)[1]);

    const pag = await cliente.callTool({ name: 'tusab_ler_original', arguments: { fonte_id: pdfId, paginas: '2-3' } });
    assert.match(texto(pag), /Páginas 2-3 de 3\.[\s\S]*\[Página 2\]\nResultados[\s\S]*\[Página 3\]/);
    assert.ok(!texto(pag).includes('Introdução'), 'só as páginas pedidas');
    assert.match(texto(pag), /data\/neural\/Acervo\/documents\/originais\//, 'caminho relativo, sem o nome do usuário');

    const img = texto(await cliente.callTool({ name: 'tusab_buscar', arguments: { consulta: 'grafico' } }));
    const imgId = Number(img.match(/fonte_id (\d+)/)[1]);
    const ver = await cliente.callTool({ name: 'tusab_ler_original', arguments: { fonte_id: imgId } });
    const imagem = ver.content.find((c) => c.type === 'image');
    assert.equal(imagem.mimeType, 'image/png');
    assert.equal(Buffer.from(imagem.data, 'base64').length, PNG.length);

    const inexistente = await cliente.callTool({ name: 'tusab_ler_original', arguments: { fonte_id: 9999 } });
    assert.equal(inexistente.isError, true);
  } finally {
    await cliente.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});
