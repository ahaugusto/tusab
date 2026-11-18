// Fase C pela API da tela: as rotas /fontes respondem como o FastAPI do desktop.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Tusab } from '../src/nucleo/tusab.js';
import { Painel } from '../src/painel.js';

let raiz;
let painel;
before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-fontes-api-'));
  const iface = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-iface-'));
  fs.writeFileSync(path.join(iface, 'index.html'), '<!doctype html><title>Tusab</title>');
  painel = new Painel(await Tusab.abrir(raiz), { pastaInterface: iface });
  await painel.iniciar();
});
after(() => {
  painel.fechar();
  painel.tusab.fechar();
  fs.rmSync(raiz, { recursive: true, force: true });
});

const api = async (metodo, caminho, corpo) => {
  const r = await fetch(`http://127.0.0.1:${painel.porta}/api${caminho}`, {
    method: metodo,
    headers: { 'X-Tusab-Chave': painel.chave, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json() };
};

test('GET /fontes: as 11 áreas e 70 fontes do desktop', async () => {
  const { json } = await api('GET', '/fontes');
  const areas = Object.values(json.areas);
  assert.equal(areas.length, 11);
  assert.equal(areas.reduce((n, a) => n + a.fontes.length, 0), 70);
  assert.ok(areas.flatMap((a) => a.fontes).some((f) => f.id === 'arxiv'));
});

test('busca valida como o pydantic (422) e fonte desconhecida responde erro', async () => {
  const curta = await api('POST', '/fontes/arxiv/search', { query: 'x', projeto_nome: 'P' });
  assert.equal(curta.status, 422);
  assert.equal(curta.json.detail[0].loc.at(-1), 'query');
  const desconhecida = await api('POST', '/fontes/naoexiste/search', { query: 'fotossíntese', projeto_nome: 'P' });
  assert.deepEqual(desconhecida.json, { error: true, message: 'Fonte desconhecida' });
});

test('status e cancelar sem busca em andamento', async () => {
  assert.deepEqual((await api('GET', '/fontes/arxiv/status')).json, { running: false, status: 'Ocioso', total: 0, processed: 0 });
  assert.deepEqual((await api('POST', '/fontes/arxiv/cancel')).json, { message: 'Nenhuma busca em andamento' });
});
