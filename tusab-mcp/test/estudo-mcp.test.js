// Fase D pela IA: um cliente MCP real grava flashcards, revisa no chat e a tela enxerga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ENTRADA = fileURLToPath(new URL('../src/index.js', import.meta.url));
const textoDe = (r) => r.content[0].text;

test('Estudo pela IA: grava flashcards, revisa no chat e a tela enxerga', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-mcp-estudo-'));
  fs.mkdirSync(path.join(raiz, 'data', 'neural', 'Bio', 'texts'), { recursive: true });
  const cliente = new Client({ name: 'teste', version: '0' });
  await cliente.connect(new StdioClientTransport({
    command: process.execPath,
    args: [ENTRADA],
    env: { ...process.env, TUSAB_REPOSITORIO: raiz, TUSAB_SEM_BOAS_VINDAS: '1' },
    stderr: 'ignore',
  }));
  try {
    const invalido = await cliente.callTool({ name: 'tusab_salvar_estudo', arguments: { projeto: 'Bio', tipo: 'flashcards', conteudo: [] } });
    assert.equal(invalido.isError, true);

    const r = await cliente.callTool({ name: 'tusab_salvar_estudo', arguments: {
      projeto: 'Bio', tipo: 'flashcards', tema: 'célula',
      conteudo: [
        { pergunta: 'O que produz ATP?', resposta: 'A mitocôndria.' },
        { pergunta: 'Onde ocorre a fotossíntese?', resposta: 'No cloroplasto.' },
      ],
    } });
    assert.match(textoDe(r), /2 item\(ns\) de flashcards guardado/);

    const fila = textoDe(await cliente.callTool({ name: 'tusab_revisao_hoje', arguments: { projeto: 'Bio' } }));
    assert.match(fila, /2 card\(s\) para revisar hoje/);
    const cardId = fila.match(/card_id (\w+)/)[1];
    const rev = textoDe(await cliente.callTool({ name: 'tusab_registrar_revisao', arguments: { projeto: 'Bio', card_id: cardId, qualidade: 5 } }));
    assert.match(rev, /Próxima revisão: \d{4}-\d{2}-\d{2} \(intervalo de 1 dia/);
    assert.match(textoDe(await cliente.callTool({ name: 'tusab_revisao_hoje', arguments: { projeto: 'Bio' } })), /1 card\(s\) para revisar hoje/);

    const p = await cliente.callTool({ name: 'tusab_abrir_painel', arguments: { abrir_navegador: false } });
    const [, porta, chave] = textoDe(p).match(/127\.0\.0\.1:(\d+)\/\?chave=([\w-]+)/);
    const api = (c, opcoes = {}) => fetch(`http://127.0.0.1:${porta}/api${c}`, { ...opcoes, headers: { 'X-Tusab-Chave': chave, ...(opcoes.headers || {}) } });

    const estudo = await (await api('/agent/study/Bio')).json();
    assert.equal(estudo.flashcards.length, 2);
    const artefatos = await (await api('/agent/study/artefatos/Bio')).json();
    assert.equal(artefatos.artefatos[0].tipo, 'flashcards');

    const anki = await api('/export/flashcards/Bio');
    assert.match(anki.headers.get('content-disposition'), /attachment; filename="tusab_Bio_flashcards\.csv"/);
    assert.match(await anki.text(), /mitocôndria/);

    const pedido = await (await api('/agent/study', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projeto_nome: 'Bio', tipo: 'flashcards', tema: 'célula' }),
    })).json();
    assert.equal(pedido.gerar_pela_ia, true);
    assert.match(pedido.pedido, /célula do projeto Bio/);

    const revisarErrado = await api('/agent/study/revisar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projeto_nome: 'Bio', card_id: cardId, qualidade: 9 }),
    });
    assert.equal(revisarErrado.status, 422);
  } finally {
    await cliente.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});
