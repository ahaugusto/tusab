// Teste de ponta a ponta: um cliente MCP real inicia o plugin por stdio, como
// faria o Claude Desktop, e usa as ferramentas (com o yt-dlp falso, sem rede).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ENTRADA = fileURLToPath(new URL('../src/index.js', import.meta.url));
const YTDLP_FALSO = fileURLToPath(new URL('./ytdlp-falso.mjs', import.meta.url));

test('versão única: o servidor usa a do package.json, e o manifest.json bate com ela', async () => {
  const { VERSAO } = await import('../src/servidor.js');
  const lerJson = (arq) => JSON.parse(fs.readFileSync(new URL(arq, import.meta.url), 'utf8'));
  assert.equal(VERSAO, lerJson('../package.json').version);
  assert.equal(lerJson('../manifest.json').version, VERSAO);
});

async function conectar(raiz) {
  const transporte = new StdioClientTransport({
    command: process.execPath,
    args: [ENTRADA],
    env: { ...process.env, TUSAB_REPOSITORIO: raiz, TUSAB_YTDLP: YTDLP_FALSO, TUSAB_SEM_BOAS_VINDAS: "1" },
    stderr: 'ignore',
  });
  const cliente = new Client({ name: 'teste', version: '0' });
  await cliente.connect(transporte);
  return cliente;
}

const textoDe = (r) => r.content[0].text;

test('IA extrai um canal, acompanha, busca com citação e lê a fonte', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-mcp-'));
  const cliente = await conectar(raiz);
  try {
    const { tools } = await cliente.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'tusab_abrir_painel', 'tusab_adicionar_arquivo', 'tusab_adicionar_youtube', 'tusab_buscar', 'tusab_buscar_fonte_publica', 'tusab_economia',
      'tusab_fontes_publicas', 'tusab_ler_fonte', 'tusab_ler_original', 'tusab_listar_projetos', 'tusab_novidades_semana',
      'tusab_registrar_revisao', 'tusab_revisao_hoje', 'tusab_salvar_estudo', 'tusab_status',
    ]);

    const { prompts } = await cliente.listPrompts();
    const nomes = prompts.map((p) => p.name);
    for (const n of ['abrir_tusab', 'flashcards', 'revisar-hoje', 'quiz', 'prova', 'resposta-verificavel', 'digest']) assert.ok(nomes.includes(n), n);
    const cards = await cliente.getPrompt({ name: 'flashcards', arguments: { projeto: 'Bio', tema: 'célula' } });
    assert.match(cards.messages[0].content.text, /Crie 10 flashcards sobre "célula"[\s\S]*tusab_salvar_estudo \(projeto "Bio", tipo flashcards\)/);
    const atalho = await cliente.getPrompt({ name: 'abrir_tusab' });
    assert.equal(atalho.messages[0].content.text, 'Abra o painel do Tusab.');
    assert.ok(!fs.existsSync(path.join(raiz, 'data', 'config', 'boas_vindas.json')), 'boas-vindas desligada nos testes');

    const vazio = await cliente.callTool({ name: 'tusab_listar_projetos', arguments: {} });
    assert.match(textoDe(vazio), /ainda está vazio/);

    const inicio = await cliente.callTool({
      name: 'tusab_adicionar_youtube',
      arguments: { url: 'https://www.youtube.com/@canalteste/videos', projeto: 'Biologia' },
    });
    assert.match(textoDe(inicio), /A extração começou/);
    assert.match(textoDe(inicio), /@canalteste ·/);

    let status = '';
    for (let i = 0; i < 150; i++) {
      status = textoDe(await cliente.callTool({ name: 'tusab_status', arguments: {} }));
      if (/Extração: (Finalizado|Erro|Interrompido)/.test(status)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.match(status, /Extração: Finalizado ✓/);

    const projetos = textoDe(await cliente.callTool({ name: 'tusab_listar_projetos', arguments: {} }));
    assert.match(projetos, /- Biologia: 3 fontes \(3 vídeos\)/);
    assert.match(projetos, /canalteste 3\/4 \(75%\)/);

    const busca = await cliente.callTool({ name: 'tusab_buscar', arguments: { consulta: 'clorofila', projeto: 'Biologia' } });
    const achado = textoDe(busca);
    assert.match(achado, /\(▶ \d\d:\d\d\) · projeto Biologia · fonte_id \d+/);
    assert.match(achado, /Link: https:\/\/www\.youtube\.com\/watch\?v=\w{11}/);

    const fonteId = Number(achado.match(/fonte_id (\d+)/)[1]);
    const leitura = textoDe(await cliente.callTool({ name: 'tusab_ler_fonte', arguments: { fonte_id: fonteId, a_partir_do_minuto: 2 } }));
    assert.match(leitura, /Projeto: Biologia/);
    assert.ok(!leitura.includes('[00:00]'), 'a leitura começa a partir do minuto pedido');

    const md = path.join(raiz, 'nota.md');
    fs.writeFileSync(md, '# Nota\n\nMitocôndria é a usina da célula.');
    const arq = textoDe(await cliente.callTool({ name: 'tusab_adicionar_arquivo', arguments: { caminho: md, projeto: 'Biologia' } }));
    assert.match(arq, /"nota" adicionado no projeto Biologia/);
    const buscaNota = textoDe(await cliente.callTool({ name: 'tusab_buscar', arguments: { consulta: 'mitocondria' } }));
    assert.match(buscaNota, /nota .*\(texto\)/);

    const pdf = await cliente.callTool({ name: 'tusab_adicionar_arquivo', arguments: { caminho: path.join(raiz, 'a.pdf'), projeto: 'Biologia' } });
    assert.equal(pdf.isError, true);
  } finally {
    await cliente.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('tusab_abrir_painel sobe o painel local e ele morre junto com a ferramenta de IA', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-mcp-painel-'));
  const cliente = await conectar(raiz);
  try {
    const r = await cliente.callTool({ name: 'tusab_abrir_painel', arguments: { abrir_navegador: false } });
    const [, porta, chave] = textoDe(r).match(/http:\/\/127\.0\.0\.1:(\d+)\/\?chave=([\w-]+)/);
    const estado = await fetch(`http://127.0.0.1:${porta}/api/status`, { headers: { 'X-Tusab-Chave': chave } });
    assert.equal(estado.status, 200);
    assert.equal((await estado.json()).is_running, false);

    const deNovo = textoDe(await cliente.callTool({ name: 'tusab_abrir_painel', arguments: { abrir_navegador: false } }));
    assert.ok(deNovo.includes(`127.0.0.1:${porta}/?chave=${chave}`), 'um painel por processo');

    await cliente.close();
    let fechou = false;
    for (let i = 0; i < 40 && !fechou; i++) {
      await new Promise((ok) => setTimeout(ok, 100));
      fechou = await fetch(`http://127.0.0.1:${porta}/`).then(() => false, () => true);
    }
    assert.ok(fechou, 'o painel continuou aberto depois que a ferramenta de IA fechou');
  } finally {
    await cliente.close().catch(() => {});
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

