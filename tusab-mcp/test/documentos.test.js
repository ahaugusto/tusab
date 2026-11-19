// Fase B — documentos e operações do Repositório (formato e respostas do desktop).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import writeXlsxFile from 'write-excel-file/node';
import { zipSync, strToU8 } from 'fflate';
import {
  detectarFormatoEspecial, extrairConteudoHtml, extrairTextoDeArquivo, permitidoPorRobots, processarFormatoEspecial,
} from '../src/nucleo/documentos.js';
import { Tusab } from '../src/nucleo/tusab.js';
import { Painel } from '../src/painel.js';

function pdf(paginas) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    paginas.forEach((linhas, i) => {
      if (i) doc.addPage();
      for (const l of linhas) doc.text(l);
    });
    doc.end();
  });
}

function docx(paragrafos) {
  const corpo = paragrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('');
  return Buffer.from(zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}</w:body></w:document>`),
  }));
}

test('PDF: texto por página, hifenização desfeita e contrato detectado', async () => {
  const r = await extrairTextoDeArquivo(await pdf([
    ['CLÁUSULA PRIMEIRA - DO OBJETO', 'Contratante: Maria, CPF nº 123.456.789-00.'],
    ['Segunda página com acentuação: ação, coração.'],
  ]), 'contrato.pdf');
  assert.equal(r.qualidadePdf, 'texto_nativo');
  assert.equal(r.formato, 'contrato');
  assert.match(r.texto, /^Tipo de documento: Contrato\nCláusulas identificadas \(1\): Cláusula PRIMEIRA — - DO OBJETO|^Tipo de documento: Contrato/);
  assert.match(r.texto, /CPF\(s\) identificado\(s\): 123\.456\.789-00/);
  assert.match(r.texto, /Segunda página com acentuação: ação, coração\./);
});

test('PDF sem texto vira registro com aviso (não é recusado)', async () => {
  const vazio = await pdf([[]]);
  const r = await extrairTextoDeArquivo(vazio, 'escaneado.pdf');
  assert.equal(r.qualidadePdf, 'escaneado_sem_ocr');
  assert.match(r.aviso, /PDF sem camada de texto/);
});

test('DOCX, XLSX e CSV', async () => {
  const d = await extrairTextoDeArquivo(docx(['Ata da reunião', '', 'Decisão: aprovar o orçamento']), 'ata.docx');
  assert.equal(d.texto, 'Ata da reunião\nDecisão: aprovar o orçamento');

  const xlsx = await writeXlsxFile([[{ value: 'Nome' }, { value: 'Nota' }], [{ value: 'Ana' }, { value: 9 }], [null, null]]).toBuffer();
  const x = await extrairTextoDeArquivo(xlsx, 'notas.xlsx');
  assert.match(x.texto, /^\[Planilha: Sheet1\]\nNome: Ana \| Nota: 9$/);

  const c = await extrairTextoDeArquivo(Buffer.from('﻿cidade,uf\n"São Paulo, capital",SP\n,\n'), 'c.csv');
  assert.equal(c.texto, 'cidade: São Paulo, capital | uf: SP');
});

test('formatos especiais do desktop: WhatsApp, reunião, petição, FHIR', async () => {
  const zap = '[12/03/2026, 10:01:22] - Ana: Bom dia\ncontinuação\n[12/03/2026, 10:02:00] - Beto: Oi';
  assert.equal(detectarFormatoEspecial(zap, 'conversa.txt'), 'whatsapp_android');
  const r = processarFormatoEspecial(zap, 'conversa.txt');
  assert.match(r.texto, /^Conversa do WhatsApp\nParticipantes: Ana, Beto\nTotal de mensagens: 2/);
  assert.match(r.texto, /\[10:01:22\] Ana: Bom dia continuação/);

  const zoom = await extrairTextoDeArquivo(Buffer.from('Zoom Meeting\n00:00:05 Carla Dias: abrindo a reunião\n'), 'reuniao.txt');
  assert.equal(zoom.formato, 'zoom');
  assert.match(zoom.texto, /\[00:00:05\] Carla Dias: abrindo a reunião/);
  assert.match(zoom.aviso, /Formato detectado: Zoom/);

  assert.equal(detectarFormatoEspecial('EXCELENTÍSSIMO SENHOR DOUTOR JUIZ', 'x.txt'), 'peticao');
  assert.equal(detectarFormatoEspecial('Texto comum sobre biologia.', 'x.txt'), null);

  const fhir = await extrairTextoDeArquivo(Buffer.from(JSON.stringify({
    resourceType: 'Bundle', entry: [{ resource: { resourceType: 'ResearchStudy', id: '1', title: 'Estudo A', status: 'active', condition: [{ text: 'Diabetes' }] } }],
  })), 'estudos.json');
  assert.equal(fhir.texto, '## Estudo A\n\nStatus: active\n\nCondição estudada: Diabetes');
  await assert.rejects(extrairTextoDeArquivo(Buffer.from('{"a":1}'), 'x.json'), /Bundle FHIR/);
});

test('imagem e áudio são guardados (sem leitura); formato desconhecido tem mensagem clara', async () => {
  const img = await extrairTextoDeArquivo(Buffer.from('x'), 'foto.png');
  assert.match(img.aviso, /Imagem guardada/);
  assert.match(img.texto, /tusab_ler_original/);
  assert.match((await extrairTextoDeArquivo(Buffer.from('x'), 'aula.mp3')).aviso, /Áudio guardado/);
  await assert.rejects(extrairTextoDeArquivo(Buffer.from('x'), 'a.exe'), /Formato não suportado: \.exe/);
});

test('robots.txt e extração de HTML', () => {
  const robots = 'User-agent: *\nDisallow: /privado\nAllow: /privado/aberto\n\nUser-agent: TusabBot\nDisallow: /so-tusab';
  assert.equal(permitidoPorRobots(robots, 'TusabBot/1.0', '/so-tusab/x'), false);
  assert.equal(permitidoPorRobots(robots, 'TusabBot/1.0', '/privado'), true, 'grupo específico substitui o *');
  assert.equal(permitidoPorRobots(robots, 'Outro', '/privado/x'), false);
  assert.equal(permitidoPorRobots(robots, 'Outro', '/privado/aberto/1'), true);
  const { titulo, texto } = extrairConteudoHtml('<html><head><title>Notícia &amp; Ciência</title><script>x()</script></head><body><nav>Menu Home Sobre Contato</nav><article><h1>Título da matéria</h1><p>Primeiro parágrafo com várias palavras aqui.</p><p>Segundo&nbsp;parágrafo do texto principal.</p></article><footer>Rodapé com links do site</footer></body></html>');
  assert.equal(titulo, 'Notícia & Ciência');
  assert.equal(texto, 'Título da matéria\nPrimeiro parágrafo com várias palavras aqui.\nSegundo parágrafo do texto principal.');
});

// ── Pela API do painel, como a interface do desktop chama ────────────────────

let raiz;
let painel;
let site;
before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-docs-'));
  const interfaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-iface-'));
  fs.writeFileSync(path.join(interfaceDir, 'index.html'), '<!doctype html><title>Tusab</title>');
  painel = new Painel(await Tusab.abrir(raiz), { pastaInterface: interfaceDir });
  await painel.iniciar();
  site = http.createServer((req, res) => {
    if (req.url === '/robots.txt') { res.end('User-agent: *\nDisallow: /bloqueado'); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<html><head><title>Página de teste</title></head><body><main><p>A fotossíntese acontece nos cloroplastos das folhas.</p></main></body></html>');
  });
  await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
});
after(() => {
  painel.fechar();
  painel.tusab.fechar();
  site.close();
  fs.rmSync(raiz, { recursive: true, force: true });
});

const base = () => `http://127.0.0.1:${painel.porta}/api`;
const cab = () => ({ 'X-Tusab-Chave': painel.chave });
const api = async (metodo, caminho, corpo) => {
  const opcoes = { method: metodo, headers: cab() };
  if (corpo instanceof FormData) opcoes.body = corpo;
  else if (corpo) { opcoes.body = JSON.stringify(corpo); opcoes.headers['Content-Type'] = 'application/json'; }
  return (await fetch(base() + caminho, opcoes)).json();
};

test('upload pela API: grava em documents/ com manifesto e entra na busca', async () => {
  await api('POST', '/neural/projeto', { nome: 'Pesquisa' });
  const form = new FormData();
  form.append('arquivo', new Blob([await pdf([['Relatório sobre mitocôndrias e respiração celular.']])]), 'relatório final.pdf');
  form.append('canal', 'Pesquisa');
  const r = await api('POST', '/neural/upload', form);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.nome, 'relatório final.pdf');
  const dir = path.join(raiz, 'data', 'neural', 'Pesquisa', 'documents');
  const [item] = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(item).sort(), ['chars', 'data', 'id', 'nome_original', 'nome_txt', 'original', 'sha256', 'tamanho', 'tipo']);
  assert.ok(fs.existsSync(path.join(dir, 'originais', `${item.id}_relat_rio_final.pdf`)), 'o original fica guardado');
  assert.equal(item.tipo, 'pdf');
  assert.match(item.nome_txt, /^[0-9a-f]{8}_relat_rio_final\.txt$/);
  const txt = fs.readFileSync(path.join(dir, item.nome_txt), 'utf8');
  assert.match(txt, /^TITULO: relatório final\.pdf\nFONTE: documento\nDATA: \d\d\/\d\d\/\d{4}\nQUALIDADE_PDF: texto_nativo\n-{70}\n/);
  const [achado] = painel.tusab.indice.buscar('mitocondrias');
  assert.equal(achado.titulo, 'relatório final.pdf');
  assert.equal(achado.tipo, 'documento');
  const repo = await api('GET', '/repositorio');
  assert.equal(repo.documentos[0].nome_original, 'relatório final.pdf');
  // Envio sem projeto é recusado como no desktop
  const sem = new FormData();
  sem.append('arquivo', new Blob(['x']), 'a.txt');
  assert.equal((await api('POST', '/neural/upload', sem)).error, true);
});

test('página web pela API respeita robots.txt', async () => {
  const ok = await api('POST', '/neural/url', { url: `http://127.0.0.1:${site.address().port}/artigo`, canal: 'Pesquisa' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.titulo, 'Página de teste');
  const bloqueado = await api('POST', '/neural/url', { url: `http://127.0.0.1:${site.address().port}/bloqueado/x`, canal: 'Pesquisa' });
  assert.match(bloqueado.message, /robots\.txt de 127\.0\.0\.1:\d+ não permite/);
  assert.match((await api('POST', '/neural/url', { url: 'ftp://x', canal: 'Pesquisa' })).message, /URL válida/);
});

test('buscar texto, ler arquivo, excluir e limpar pela API', async () => {
  const busca = await api('POST', '/neural/buscar', { query: 'cloroplastos', canal: 'Pesquisa' });
  assert.equal(busca.total, 1);
  assert.equal(busca.resultados[0].tipo, 'documento');
  assert.equal(busca.resultados[0].canal, 'Pesquisa');
  const leitura = await api('POST', '/neural/ler-arquivo', { caminho: busca.resultados[0].caminho });
  assert.match(leitura.conteudo, /FONTE: web\n/);
  assert.equal((await api('POST', '/neural/ler-arquivo', { caminho: '../../../package.json' })).message, 'Acesso negado');

  const dir = path.join(raiz, 'data', 'neural', 'Pesquisa', 'documents');
  const pagina = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')).find((e) => e.tipo === 'web');
  assert.deepEqual(await api('DELETE', `/neural/arquivo/documentos/${pagina.id}`), { ok: true });
  assert.equal(painel.tusab.indice.buscar('cloroplastos').length, 0, 'excluir tira do índice');
  assert.equal((await api('DELETE', '/neural/arquivo/outro/x')).message, 'Tipo inválido');

  const limpo = await api('DELETE', '/neural/limpar', { documentos: true, canal: 'Pesquisa' });
  assert.equal(limpo.deletados.documentos, 3, 'o .txt restante, o _manifest.json e o original do PDF');
  assert.ok(!fs.existsSync(path.join(dir, 'originais')), 'limpar documentos não deixa original esquecido');
});

test('reset total apaga a base e o índice, e o Tusab continua funcionando', async () => {
  await api('POST', '/neural/texto', { titulo: 'Nota', conteudo: 'conteúdo qualquer', canal: 'Outro' });
  const r = await api('DELETE', '/reset-total');
  assert.equal(r.ok, true);
  assert.deepEqual(fs.readdirSync(path.join(raiz, 'data', 'neural')), []);
  assert.equal(painel.tusab.indice.listarProjetos().length, 0);
  assert.equal((await api('POST', '/neural/texto', { titulo: 'Depois', conteudo: 'segue funcionando', canal: 'Novo' })).ok, true);
  assert.equal(painel.tusab.indice.buscar('funcionando').length, 1);
});
