// Servidor local da extensão: segurança + rotas no formato do FastAPI do desktop.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tusab } from '../src/nucleo/tusab.js';
import { Painel, abrirNoNavegador } from '../src/painel.js';

process.env.TUSAB_YTDLP = fileURLToPath(new URL('./ytdlp-falso.mjs', import.meta.url));

let raiz;
let interfaceDir;
let painel;

before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-painel-'));
  // Interface mínima (o build real fica em interface/, gerado a partir de web_interface/).
  interfaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-interface-'));
  fs.mkdirSync(path.join(interfaceDir, 'assets'));
  fs.writeFileSync(path.join(interfaceDir, 'index.html'), '<!doctype html><title>Tusab</title><div id="root"></div>');
  fs.writeFileSync(path.join(interfaceDir, 'assets', 'app-123.js'), 'console.log(1)');
  painel = new Painel(await Tusab.abrir(raiz), { versao: 'teste', pastaInterface: interfaceDir });
  await painel.iniciar();
});

after(() => {
  painel.fechar();
  painel.tusab.fechar();
  fs.rmSync(raiz, { recursive: true, force: true });
  fs.rmSync(interfaceDir, { recursive: true, force: true });
});

/** http.request em vez de fetch: permite forjar Host/Origin como um atacante faria. */
function pedir(caminho, { metodo = 'GET', cabecalhos = {}, corpo } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: painel.porta, path: caminho, method: metodo,
      headers: { Host: `127.0.0.1:${painel.porta}`, ...cabecalhos },
    }, (res) => {
      const partes = [];
      res.on('data', (p) => partes.push(p));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let json = null;
        try { json = JSON.parse(texto); } catch { /* html/js */ }
        resolve({ status: res.statusCode, cabecalhos: res.headers, texto, json });
      });
    });
    req.on('error', reject);
    if (corpo !== undefined) req.write(corpo);
    req.end();
  });
}

const comChave = (extra = {}) => ({ 'X-Tusab-Chave': painel.chave, ...extra });
const api = (caminho, opcoes = {}) => pedir(`/api${caminho}`, { ...opcoes, cabecalhos: comChave(opcoes.cabecalhos) });
const postJson = (caminho, dados) => api(caminho, { metodo: 'POST', cabecalhos: { 'Content-Type': 'application/json' }, corpo: JSON.stringify(dados) });

test('escuta só em 127.0.0.1 e o link leva a chave', () => {
  assert.equal(painel.servidor.address().address, '127.0.0.1');
  assert.match(painel.url, /^http:\/\/127\.0\.0\.1:\d+\/\?chave=[\w-]{43}$/);
});

test('serve a interface com CSP restrita, sem CORS, e cache só para assets', async () => {
  const r = await pedir('/?chave=qualquer');
  assert.equal(r.status, 200);
  assert.match(r.texto, /<title>Tusab<\/title>/);
  assert.match(r.cabecalhos['content-security-policy'], /default-src 'none'; script-src 'self'/);
  assert.equal(r.cabecalhos['access-control-allow-origin'], undefined);
  assert.equal(r.cabecalhos['cache-control'], 'no-store');
  const js = await pedir('/assets/app-123.js');
  assert.equal(js.status, 200);
  assert.match(js.cabecalhos['content-type'], /javascript/);
  assert.match(js.cabecalhos['cache-control'], /immutable/);
});

test('nada fora da pasta da interface é servido', async () => {
  for (const c of ['/../package.json', '/%2e%2e/package.json', '/assets/../../package.json', '/naoexiste.js', '/%E0%A4%A']) {
    assert.ok([400, 404].includes((await pedir(c)).status), c);
  }
});

test('API exige a chave', async () => {
  assert.equal((await pedir('/api/status')).status, 401);
  assert.equal((await pedir('/api/status', { cabecalhos: { 'X-Tusab-Chave': 'errada' } })).status, 401);
  assert.equal((await api('/status')).status, 200);
});

test('recusa Host de outro nome (DNS rebinding)', async () => {
  assert.equal((await api('/status', { cabecalhos: { Host: `atacante.exemplo:${painel.porta}` } })).status, 421);
  assert.equal((await pedir('/', { cabecalhos: { Host: `localhost:${painel.porta}` } })).status, 421);
});

test('recusa pedidos vindos de outros sites', async () => {
  assert.equal((await api('/status', { cabecalhos: { Origin: 'https://site-malicioso.exemplo' } })).status, 403);
  assert.equal((await api('/status', { cabecalhos: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const previa = await pedir('/api/start', {
    metodo: 'OPTIONS', cabecalhos: { Origin: 'https://site-malicioso.exemplo', 'Access-Control-Request-Method': 'POST' },
  });
  assert.notEqual(previa.status, 200);
  assert.equal(previa.cabecalhos['access-control-allow-origin'], undefined);
});

test('corpo de POST só em JSON; POST sem corpo é aceito (como o axios envia)', async () => {
  const r = await api('/neural/projeto', { metodo: 'POST', cabecalhos: { 'Content-Type': 'text/plain' }, corpo: 'nome=x' });
  assert.equal(r.status, 415);
  assert.equal((await api('/pause', { metodo: 'POST' })).json.message, 'Motor não está rodando');
});

test('/status tem o mesmo formato do desktop', async () => {
  const { json } = await api('/status');
  assert.deepEqual(Object.keys(json).sort(), ['canal_url', 'drive_auth_error', 'drive_status', 'is_paused', 'is_running', 'logs', 'stats']);
  assert.deepEqual(Object.keys(json.stats).sort(), [
    'eta_segundos', 'files_generated', 'idioma_detectado', 'progress', 'projeto_nome', 'status', 'videos_legenda_curta',
    'videos_mapeados', 'videos_processed', 'videos_sem_legenda', 'videos_total',
  ]);
});

test('fluxo da tela de extração: buscar canal, prévia, playlists, definir, iniciar, acompanhar', async () => {
  const busca = await api(`/canal-search?q=${encodeURIComponent('canal teste')}`);
  assert.deepEqual(busca.json.canais[0], {
    nome: 'Canal Teste', handle: '@canalteste', seguidores: 12345,
    url: 'https://www.youtube.com/@canalteste', thumbnail: 'https://yt3.ggpht.com/foto.jpg',
  });
  const info = await api(`/canal-info?url=${encodeURIComponent('https://www.youtube.com/@canalteste')}`);
  assert.equal(info.json.ok, true);
  assert.equal(info.json.total_videos, 4);
  assert.equal((await api('/canal-info?url=https://exemplo.com')).json.error, true);
  const pls = await api(`/playlists-canal?url=${encodeURIComponent('https://www.youtube.com/@canalteste')}`);
  assert.deepEqual(pls.json.playlists, [{ id: 'PLtestePlaylist01', titulo: 'Biologia básica' }]);

  assert.equal((await postJson('/set-channel', { canal_url: 'https://www.youtube.com/@canalteste', projeto_nome: 'Ciências' })).json.canal_nome, 'Ciências');
  assert.equal((await postJson('/start', { fontes: ['Videos'], playlists: [], data_inicio: '', data_fim: '' })).json.message, 'Motor iniciado');
  let st;
  for (let i = 0; i < 200; i++) {
    st = (await api('/status')).json;
    if (!st.is_running) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(st.stats.status, 'Finalizado ✓');
  assert.ok(st.logs.length > 5);

  const hist = (await api('/history')).json;
  assert.equal(hist[0].projeto, 'Ciências');
  assert.equal((await api('/relatorio/canalteste')).json.stats.sucesso, 2);
  assert.equal((await api('/repositorio')).json.canais[0].nome, 'Ciências');
  assert.equal((await api('/neural/projetos')).json.projetos[0].tipo, 'youtube');
  const agente = (await api('/agent/status')).json;
  assert.equal(agente.indexed, true);
  assert.equal(agente.canais_indexados[0].nome, 'Ciências');
  assert.ok(agente.canais_indexados[0].chunks > 0);
});

test('fila pela API', async () => {
  assert.equal((await postJson('/queue/add', { canal_url: 'https://www.youtube.com/@canalteste', projeto_nome: 'Depois' })).json.queue_size, 1);
  assert.equal((await api('/queue')).json.queue[0].projeto_nome, 'Depois');
  assert.deepEqual((await api('/queue/item/0', { metodo: 'DELETE' })).json, { ok: true });
  assert.deepEqual((await api('/queue/clear', { metodo: 'DELETE' })).json, { ok: true });
});

test('projetos e textos pela API, no formato do desktop', async () => {
  assert.deepEqual((await postJson('/neural/projeto', { nome: 'Meu Projeto' })).json, { ok: true, nome: 'Meu_Projeto', criado: true });
  assert.equal((await postJson('/neural/projeto', { nome: '../..' })).json.error, true);
  const t = (await postJson('/neural/texto', { titulo: 'Anotações', conteudo: 'Texto com acentuação: ção.', canal: 'Meu Projeto' })).json;
  assert.equal(t.ok, true);
  assert.ok(fs.existsSync(path.join(raiz, 'data', 'neural', 'Meu_Projeto', 'texts', '_manifest.json')));
});

test('rotas do chat respondem de forma neutra; o resto, 404 claro', async () => {
  assert.equal((await postJson('/agent/config', { provider: 'x' })).json.ok, true);
  assert.equal((await api('/agent/qualquer')).json.indisponivel_na_extensao, true);
  const r = await api('/export/historico', { metodo: 'POST' });
  assert.equal(r.status, 404);
  assert.match(r.json.message, /não disponível na extensão/);
});

test('abrir pasta só aceita pastas conhecidas do repositório', async () => {
  assert.equal((await api('/open-folder?name=qualquer')).json.error, true);
});

test('abrirNoNavegador só aceita o link do painel', () => {
  assert.throws(() => abrirNoNavegador('https://site-malicioso.exemplo'), /inválido/);
  assert.throws(() => abrirNoNavegador('http://127.0.0.1:1/?chave=a&x=" & calc'), /inválido/);
});
