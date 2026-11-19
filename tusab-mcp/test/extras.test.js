// Meus prompts, metadados de imagem (GPS), economia de tokens e espaço ocupado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { excluirPromptUsuario, listarPrompts, montarPrompt, salvarPromptUsuario } from '../src/nucleo/prompts.js';
import { semMetadados } from '../src/nucleo/originais.js';
import { medirPerguntas, registrarConsulta, resumoEconomia } from '../src/nucleo/tokens.js';
import { listarRepositorio } from '../src/nucleo/gestao.js';
import { garantirEstrutura } from '../src/nucleo/caminhos.js';
import { Tusab } from '../src/nucleo/tusab.js';
import { salvarDocumento } from '../src/nucleo/repositorio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarServidor } from '../src/servidor.js';
import { Painel } from '../src/painel.js';
import { atenderApi } from '../src/api.js';

const ENTRADA = fileURLToPath(new URL('../src/index.js', import.meta.url));
const temp = (n) => { const r = fs.mkdtempSync(path.join(os.tmpdir(), `tusab-extras-${n}-`)); garantirEstrutura(r); return r; };

test('Meus prompts: criar, montar com as regras fixas, alterar, excluir', () => {
  const raiz = temp('prompts');
  try {
    assert.match(salvarPromptUsuario(raiz, { titulo: '', pedido: 'x' }).message, /título/);
    const r = salvarPromptUsuario(raiz, { titulo: 'Caso clínico', descricao: 'Para residentes', pedido: 'Monte um caso clínico{tema_frase} com 3 perguntas.', base: 'quiz' });
    assert.equal(r.ok, true);
    const id = r.prompt.id;
    assert.match(id, /^u-[0-9a-f]{8}$/);
    assert.deepEqual(r.prompt.campos, ['projeto', 'tema']);
    const { prompts, categorias } = listarPrompts(raiz);
    assert.ok(categorias.includes('Meus prompts'));
    assert.equal(prompts.find((p) => p.id === id).base, 'quiz');
    const texto = montarPrompt(id, { projeto: 'Medicina', tema: 'sepse' }, raiz);
    assert.match(texto, /^Antes de começar: se as ferramentas do Tusab \(tusab_buscar\) não estiverem disponíveis/);
    assert.match(texto, /\n\nMonte um caso clínico sobre "sepse" com 3 perguntas\. Pesquise a base do Tusab no projeto "Medicina"/);
    assert.match(texto, /não invente\.$/, 'as regras fixas entram sempre');
    assert.equal(salvarPromptUsuario(raiz, { id, titulo: 'Caso clínico v2', pedido: 'Outro pedido.' }).prompt.titulo, 'Caso clínico v2');
    assert.deepEqual(excluirPromptUsuario(raiz, id), { ok: true });
    assert.throws(() => montarPrompt(id, { projeto: 'Medicina' }, raiz), /desconhecido/);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('Meus prompts aparecem no "+" do Claude sem reiniciar o plugin', async () => {
  const raiz = temp('mcp');
  const cliente = new Client({ name: 't', version: '0' });
  await cliente.connect(new StdioClientTransport({
    command: process.execPath, args: [ENTRADA], stderr: 'ignore',
    env: { ...process.env, TUSAB_REPOSITORIO: raiz, TUSAB_SEM_BOAS_VINDAS: '1' },
  }));
  try {
    const antes = (await cliente.listPrompts()).prompts.length;
    const p = await cliente.callTool({ name: 'tusab_abrir_painel', arguments: { abrir_navegador: false } });
    const [, porta, chave] = p.content[0].text.match(/127\.0\.0\.1:(\d+)\/\?chave=([\w-]+)/);
    const criado = await (await fetch(`http://127.0.0.1:${porta}/api/prompts/usuario`, {
      method: 'POST', headers: { 'X-Tusab-Chave': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Meu resumo', pedido: 'Resuma{tema_frase} em 5 linhas.' }),
    })).json();
    const depois = (await cliente.listPrompts()).prompts;
    assert.equal(depois.length, antes + 1);
    const meu = await cliente.getPrompt({ name: criado.prompt.id, arguments: { projeto: 'X', tema: 'y' } });
    assert.match(meu.messages[0].content.text, /\n\nResuma sobre "y" em 5 linhas\./);
    await fetch(`http://127.0.0.1:${porta}/api/prompts/usuario/${criado.prompt.id}`, { method: 'DELETE', headers: { 'X-Tusab-Chave': chave } });
    assert.equal((await cliente.listPrompts()).prompts.length, antes);
  } finally {
    await cliente.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

// JPEG mínimo: SOI + APP0 + APP1(Exif com "GPS") + COM + SOS(dados) + EOI
function jpegComGps() {
  const seg = (m, conteudo) => { const b = Buffer.alloc(4 + conteudo.length); b[0] = 0xff; b[1] = m; b.writeUInt16BE(conteudo.length + 2, 2); conteudo.copy(b, 4); return b; };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    seg(0xe1, Buffer.from('Exif\0\0GPSLatitude=-23.55;GPSLongitude=-46.63', 'latin1')),
    seg(0xfe, Buffer.from('comentario com nome do autor', 'latin1')),
    Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0xde, 0xad, 0xbe, 0xef, 0xff, 0xd9]),
  ]);
}

test('GPS e metadados saem da imagem enviada à IA (JPEG, PNG, WebP); estrutura estranha não passa', () => {
  const jpg = jpegComGps();
  const limpo = semMetadados(jpg, '.jpg');
  assert.ok(!limpo.includes(Buffer.from('GPS')), 'sem GPS');
  assert.ok(!limpo.includes(Buffer.from('comentario')), 'sem comentário');
  assert.ok(limpo.includes(Buffer.from('JFIF')), 'APP0 fica');
  assert.ok(limpo.subarray(-6).equals(Buffer.from([0xde, 0xad, 0xbe, 0xef, 0xff, 0xd9])), 'dados da imagem intactos');

  const chunk = (tipo, dados) => { const b = Buffer.alloc(12 + dados.length); b.writeUInt32BE(dados.length, 0); b.write(tipo, 4, 'latin1'); dados.copy(b, 8); return b; };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('eXIf', Buffer.from('GPS')), chunk('tEXt', Buffer.from('Author\0Fulano')), chunk('IDAT', Buffer.from('x')), chunk('IEND', Buffer.alloc(0))]);
  const pngLimpo = semMetadados(png, '.png');
  assert.ok(!pngLimpo.includes(Buffer.from('GPS')) && !pngLimpo.includes(Buffer.from('Fulano')));
  assert.ok(pngLimpo.includes(Buffer.from('IDAT')) && pngLimpo.includes(Buffer.from('IEND')));

  const riff = (tipo, dados) => { const b = Buffer.alloc(8 + dados.length + (dados.length % 2)); b.write(tipo, 0, 'latin1'); b.writeUInt32LE(dados.length, 4); dados.copy(b, 8); return b; };
  const vp8x = Buffer.alloc(10); vp8x[0] = 0x08 | 0x04;
  const corpo = Buffer.concat([riff('VP8X', vp8x), riff('VP8 ', Buffer.from('imagem')), riff('EXIF', Buffer.from('GPS-dados')), riff('XMP ', Buffer.from('<xmp/>'))]);
  const cab = Buffer.alloc(12); cab.write('RIFF', 0, 'latin1'); cab.writeUInt32LE(corpo.length + 4, 4); cab.write('WEBP', 8, 'latin1');
  const webpLimpo = semMetadados(Buffer.concat([cab, corpo]), '.webp');
  assert.ok(!webpLimpo.includes(Buffer.from('GPS')) && !webpLimpo.includes(Buffer.from('<xmp')));
  assert.equal(webpLimpo[20] & 0x0c, 0, 'marcas de EXIF/XMP desligadas no VP8X');
  assert.equal(webpLimpo.readUInt32LE(4), webpLimpo.length - 8, 'tamanho do RIFF corrigido');

  assert.equal(semMetadados(Buffer.from([0xff, 0xd8, 0x00, 0x01]), '.jpg'), null, 'não dá para garantir: não envia');
});

test('economia de tokens: contador local e teste de perguntas', async () => {
  const raiz = temp('tokens');
  const t = await Tusab.abrir(raiz);
  try {
    registrarConsulta(raiz, { ferramenta: 'tusab_buscar', enviados: 100, semTusab: 1000 });
    registrarConsulta(raiz, { ferramenta: 'tusab_ler_fonte', enviados: 50, semTusab: 500 });
    const r = resumoEconomia(raiz);
    assert.equal(r.consultas, 2);
    assert.equal(r.economia_percentual, 90);
    assert.equal(r.tokens_economizados, 1350);
    assert.equal(r.por_ferramenta.tusab_buscar.consultas, 1);
    t.salvarTexto({ titulo: 'Aula', conteudo: `${'A mitocôndria produz energia na célula. '.repeat(200)}\n\n${'Outro assunto sem relação. '.repeat(200)}`, projeto: 'Bio' });
    const m = medirPerguntas(t.indice, 'Bio', ['mitocôndria energia', 'quasar galáxia nebulosa']);
    assert.equal(m.perguntas.length, 2);
    assert.ok(m.perguntas[0].tokens_tusab < m.perguntas[0].tokens_projeto_inteiro);
    assert.equal(m.total.sem_resposta, 1);
  } finally {
    t.fechar();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('repositório informa o espaço ocupado (originais × texto)', async () => {
  const raiz = temp('espaco');
  try {
    fs.mkdirSync(path.join(raiz, 'data', 'neural', 'P', 'documents'), { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await salvarDocumento(raiz, { nome: 'f.png', bytes: png, projeto: 'P' });
    const [canal] = listarRepositorio(raiz).canais;
    assert.equal(canal.espaco.originais, png.length);
    assert.ok(canal.espaco.texto > 0);
    assert.equal(canal.espaco.total, canal.espaco.originais + canal.espaco.texto);
    assert.equal(canal.documentos[0].original, true);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('Meus prompts em pastas: guardar, renomear e desfazer a pasta (os prompts ficam)', async () => {
  const { renomearPasta } = await import('../src/nucleo/prompts.js');
  const raiz = temp('pastas');
  try {
    const a = salvarPromptUsuario(raiz, { titulo: 'A', pedido: 'x', pasta: '  Aulas   de\tbio ' }).prompt;
    salvarPromptUsuario(raiz, { titulo: 'B', pedido: 'y', pasta: 'Aulas de bio' });
    salvarPromptUsuario(raiz, { titulo: 'C', pedido: 'z' });
    assert.equal(a.pasta, 'Aulas de bio', 'espaços e tabulação normalizados');
    const pastas = (r) => listarPrompts(r).prompts.filter((p) => p.usuario).map((p) => p.pasta);
    assert.deepEqual(pastas(raiz), ['Aulas de bio', 'Aulas de bio', '']);
    assert.deepEqual(renomearPasta(raiz, 'Aulas de bio', 'Biologia'), { ok: true, alterados: 2 });
    assert.deepEqual(pastas(raiz), ['Biologia', 'Biologia', '']);
    assert.equal(renomearPasta(raiz, 'Não existe', 'x').error, true);
    renomearPasta(raiz, 'Biologia', '');
    assert.deepEqual(pastas(raiz), ['', '', '']);
    assert.equal(listarPrompts(raiz).prompts.filter((p) => p.usuario).length, 3, 'desfazer a pasta não apaga prompts');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('Stack Overflow: o documento guarda autor, link e a licença CC BY-SA da época', async () => {
  const { extrairItem, licencaStackOverflow } = await import('../src/fontes/stackexchange.js');
  assert.equal(licencaStackOverflow(Date.UTC(2010, 0, 1) / 1000), 'CC BY-SA 2.5');
  assert.equal(licencaStackOverflow(Date.UTC(2015, 0, 1) / 1000), 'CC BY-SA 3.0');
  assert.equal(licencaStackOverflow(Date.UTC(2020, 0, 1) / 1000), 'CC BY-SA 4.0');
  const doc = extrairItem({
    title: 'Como usar &quot;async&quot;?', body: '<p>Pergunta</p>', link: 'https://stackoverflow.com/q/1',
    creation_date: Date.UTC(2020, 5, 1) / 1000, owner: { display_name: 'Ana &amp; Bia', link: 'https://stackoverflow.com/users/9' },
  });
  assert.equal(doc.titulo, 'Como usar "async"?');
  assert.match(doc.texto, /Autor: Ana & Bia \(https:\/\/stackoverflow\.com\/users\/9\) · Stack Overflow · Licença: CC BY-SA 4\.0$/);
  assert.equal(doc.url_origem, 'https://stackoverflow.com/q/1');
});

test('conexão MCP: a tela sabe se a IA está conectada e quando ela consultou o Tusab', async () => {
  const raiz = temp('conexao');
  const tusab = await Tusab.abrir(raiz);
  assert.deepEqual(tusab.estadoConexao(), { mcp: false, cliente: null, desde: null, ultima_ferramenta: null });

  const painel = new Painel(tusab);
  const servidor = criarServidor(tusab, { painel });
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(ladoServidor);
  const cliente = new Client({ name: 'claude-ai', version: '1.2.3' });
  await cliente.connect(ladoCliente);
  try {
    // O "initialized" do cliente chega de forma assíncrona
    for (let i = 0; i < 50 && !tusab.estadoConexao().mcp; i++) await new Promise((r) => setTimeout(r, 10));
    const conectado = tusab.estadoConexao();
    assert.equal(conectado.mcp, true);
    assert.deepEqual(conectado.cliente, { nome: 'claude-ai', versao: '1.2.3' });
    assert.equal(conectado.ultima_ferramenta, null);

    const antes = Date.now();
    await cliente.callTool({ name: 'tusab_buscar', arguments: { consulta: 'qualquer coisa' } });
    const { ultima_ferramenta: uf } = tusab.estadoConexao();
    assert.equal(uf.nome, 'tusab_buscar');
    assert.ok(uf.em >= antes);

    // Guardar material devolve o link direto para ele na tela do Tusab
    fs.mkdirSync(path.join(raiz, 'data', 'neural', 'Bio'), { recursive: true });
    const salvo = await cliente.callTool({ name: 'tusab_salvar_estudo', arguments: { projeto: 'Bio', tipo: 'documento', conteudo: '# Quiz', titulo: 'Quiz' } });
    const texto = salvo.content[0].text;
    assert.match(texto, /\[Abrir no Tusab\]\(http:\/\/127\.0\.0\.1:\d+\/\?chave=[\w-]+#material\/Bio\/\d{8}_\d{6}_documento\)/);

    // A tela lê o mesmo estado por GET /api/conexao
    const api = await atenderApi(tusab, 'GET', '/conexao', new URLSearchParams(), async () => '');
    assert.equal(api.status, 200);
    assert.equal(api.corpo.mcp, true);
    assert.equal(api.corpo.ultima_ferramenta.nome, 'tusab_salvar_estudo');
  } finally {
    await cliente.close();
    painel.fechar();
  }
  for (let i = 0; i < 50 && tusab.estadoConexao().mcp; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(tusab.estadoConexao().mcp, false);
});

test('IA no navegador: o pedido vai com os trechos da base dentro (do tema ou um panorama do projeto)', async () => {
  const raiz = temp('navegador');
  const tusab = await Tusab.abrir(raiz);
  tusab.salvarTexto({ titulo: 'Fotossíntese', conteudo: 'A clorofila absorve luz azul e vermelha e converte em energia química.', projeto: 'Bio' });
  tusab.salvarTexto({ titulo: 'Respiração', conteudo: 'A respiração celular libera energia da glicose nas mitocôndrias.', projeto: 'Bio' });
  tusab.sincronizar();
  const pedir = async (corpo) => (await atenderApi(tusab, 'POST', '/prompts/montar', new URLSearchParams(), async () => corpo)).corpo;

  // Com tema: a busca vem primeiro; completa com o panorama até ter trechos suficientes
  const r = await pedir({ id: 'flashcards', projeto: 'Bio', tema: 'clorofila', navegador: true });
  assert.equal(r.ok, true, r.message);
  assert.ok(r.trechos >= 2);
  assert.match(r.texto, /Use só os trechos da minha base do Tusab que estão abaixo \(projeto "Bio"\)/);
  assert.match(r.texto, /\[1\] Fotossíntese\nA clorofila absorve/);
  assert.match(r.texto, /Respiração/);
  // Sem ferramentas (a IA do navegador não alcança o Tusab): nada de tusab_buscar nem de guardar
  assert.doesNotMatch(r.texto, /tusab_buscar|tusab_salvar_estudo|Antes de começar/);

  // Sem tema: panorama do projeto
  const p = await pedir({ id: 'resumo', projeto: 'Bio', navegador: true });
  assert.equal(p.trechos, 2);
  // Prompts que dependem das ferramentas não têm versão para o navegador
  assert.match((await pedir({ id: 'revisar-hoje', projeto: 'Bio', navegador: true })).message, /Claude Desktop/);
  // Projeto sem trechos
  assert.match((await pedir({ id: 'resumo', projeto: 'Vazio', navegador: true })).message, /não tem trechos/);
  // Sem navegador, continua o pedido com as ferramentas
  assert.match((await pedir({ id: 'resumo', projeto: 'Bio' })).texto, /tusab_buscar/);
});
