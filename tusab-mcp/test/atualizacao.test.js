// Fase B — atualização automática de canais (auto_update.py + rotas /auto-update/*), sem rede.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Atualizacao } from '../src/nucleo/atualizacao.js';
import { COLUNAS_BASE, lerCsv, salvarCsv } from '../src/nucleo/gestao.js';
import { Tusab } from '../src/nucleo/tusab.js';

process.env.TUSAB_YTDLP = fileURLToPath(new URL('./ytdlp-falso.mjs', import.meta.url));
const CANAL = 'https://www.youtube.com/@canalteste';
const DIA = 86_400_000;

const raizes = [];
function novaRaiz() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-atualizacao-'));
  raizes.push(r);
  return r;
}

let raiz;
let tusab;
before(async () => {
  raiz = novaRaiz();
  tusab = await Tusab.abrir(raiz);
  // Base inicial: só a aba Vídeos do canal falso (3 vídeos; o short fica de fora).
  tusab.motor.definirCanal({ canal_url: CANAL, projeto_nome: 'Bio' });
  tusab.motor.iniciar({ fontes: ['Videos'] });
  await tusab.motor.execucao;
});
after(() => {
  tusab.fechar();
  for (const r of raizes) fs.rmSync(r, { recursive: true, force: true });
});

const gestao = (r, projeto) => path.join(r, 'data', 'neural', projeto, 'management');

test('config: grava no {canal}_summary.json do desktop e lê de volta', () => {
  const a = new Atualizacao(raiz, tusab.motor);
  assert.deepEqual(a.salvarConfig({
    canal_prefixo: 'canalteste', projeto_prefixo: 'Bio', enabled: true, frequencia: 'semanal', fontes: [], canal_url: CANAL,
  }), { ok: true });
  const sumario = JSON.parse(fs.readFileSync(path.join(gestao(raiz, 'Bio'), 'canalteste_summary.json'), 'utf8'));
  assert.deepEqual(sumario.auto_update, { enabled: true, frequencia: 'semanal', fontes: [] });
  assert.equal(sumario.total_mapeado, 3, 'o resto do summary (gravado pelo motor) é preservado');
  assert.equal(sumario.canal_url, CANAL);

  assert.deepEqual(a.lerConfig('canalteste', 'Bio'), { auto_update: { enabled: true, frequencia: 'semanal', fontes: [] } });
  assert.deepEqual(a.lerConfig('canalteste'), { auto_update: { enabled: true, frequencia: 'semanal', fontes: [] } }, 'busca legada em todos os projetos');
  assert.deepEqual(a.lerConfig('outro', 'Bio'), { auto_update: { enabled: false } });

  assert.equal(a.salvarConfig({ canal_prefixo: 'canalteste', projeto_prefixo: 'Bio' }).error, true, 'enabled é obrigatório');
  assert.equal(a.salvarConfig({ canal_prefixo: 'c', projeto_prefixo: 'Bio', enabled: true, canal_url: 'https://exemplo.com/@x' }).error, true);
  // Frequência desconhecida vira 'semanal' (é como o agendador do desktop a trata).
  const r2 = novaRaiz();
  const a2 = new Atualizacao(r2, tusab.motor);
  a2.salvarConfig({ canal_prefixo: 'c', projeto_prefixo: 'P', enabled: true, frequencia: 'toda hora' });
  assert.equal(a2.lerConfig('c', 'P').auto_update.frequencia, 'semanal');
  // Nomes com ".." não saem de data/neural/
  a2.salvarConfig({ canal_prefixo: '../../fora', projeto_prefixo: '../..', enabled: true });
  assert.ok(!fs.existsSync(path.join(r2, 'fora_summary.json')) && !fs.existsSync(path.join(path.dirname(r2), 'fora_summary.json')));
  assert.ok(fs.existsSync(path.join(gestao(r2, 'fora'), 'fora_summary.json')));
});

test('detecta vídeo novo e manda para o motor existente (que começa, porque estava livre)', async () => {
  const m = tusab.motor;
  const a = new Atualizacao(raiz, m);
  const antes = lerCsv(path.join(gestao(raiz, 'Bio'), 'canalteste_base.csv')).linhas.map((l) => l.ID);
  assert.ok(!antes.includes('BBBBBBBBBB1'));

  const novos = await a.verificar({ manual: true });
  assert.deepEqual(novos, ['Bio/canalteste']);
  assert.equal(m.is_running, true, 'motor ocioso: a extração começa na hora');
  assert.equal(m.canal_url, CANAL);
  assert.equal(m.projeto_nome, 'Bio');
  await m.execucao;
  const depois = lerCsv(path.join(gestao(raiz, 'Bio'), 'canalteste_base.csv')).linhas;
  assert.ok(depois.some((l) => l.ID === 'BBBBBBBBBB1' && l.Status === 'Sucesso'), 'o short novo foi extraído');
  assert.equal(depois.length, 4, 'os vídeos antigos não foram extraídos de novo');

  const estado = JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'config', 'auto_update.json'), 'utf8'));
  assert.equal(typeof estado.ultima_verificacao['Bio/canalteste'], 'number');
  assert.equal(typeof estado.auto_update_ultima_verificacao, 'number');

  // Nada novo agora
  assert.deepEqual(await a.verificar({ manual: true }), []);
  assert.equal(m.is_running, false);
});

test('motor ocupado: o canal entra na fila uma vez só, e /auto-update/run espera', async () => {
  const m = tusab.motor;
  const a = new Atualizacao(raiz, m);
  // Outro projeto com o mesmo canal e nenhum vídeo extraído: tudo é novo.
  a.salvarConfig({ canal_prefixo: 'canalteste', projeto_prefixo: 'Bio2', enabled: true, frequencia: 'diario', fontes: ['Videos'], canal_url: CANAL });
  a.salvarConfig({ canal_prefixo: 'canalteste', projeto_prefixo: 'Bio', enabled: false, frequencia: 'semanal', fontes: [] });
  m.filaLimpar();
  m.is_running = true; // finge uma extração em andamento
  try {
    assert.deepEqual(a.executar(), { error: true, message: 'Extração em andamento. Aguarde para verificar atualizações.' });
    assert.deepEqual(await a.verificar({ manual: true }), ['Bio2/canalteste']);
    assert.equal(m.fila.length, 1);
    assert.equal(m.fila[0].url, CANAL);
    assert.equal(m.fila[0].projeto_nome, 'Bio2');
    assert.deepEqual(m.fila[0].fontes, ['Videos']);
    await a.verificar({ manual: true });
    assert.equal(m.fila.length, 1, 'não duplica o pedido');
    assert.ok(m.logs.some((l) => l.message.includes('já está na fila')));
  } finally {
    m.is_running = false;
    m.filaLimpar();
    a.salvarConfig({ canal_prefixo: 'canalteste', projeto_prefixo: 'Bio2', enabled: false });
  }

  // Livre: /auto-update/run responde na hora e verifica em segundo plano.
  assert.deepEqual(a.executar(), { ok: true, message: 'Verificação iniciada em background' });
  assert.deepEqual(await a.execucao, []);
  assert.ok(m.logs.some((l) => l.message.includes('Auto-update manual: todos os canais estão atualizados')));
});

// ── Frequência e agendamento (motor simulado: conta as consultas ao yt-dlp) ──

function motorSimulado() {
  const m = {
    is_running: false, fila: [], logs: [], chamadas: [], pedidos: [], falhar: new Set(),
    log(msg) { this.logs.push(msg); },
    extrairOuEnfileirar(item) { this.pedidos.push(item); return { enfileirado: false }; },
  };
  m.ytdlp = {
    rodar: async (args) => {
      const url = args.at(-1);
      const canal = url.match(/@([^/]+)/)[1];
      m.chamadas.push(canal);
      if (m.falhar.has(canal)) return { codigo: 1, saida: '', erro: 'sem conexão' };
      return { codigo: 0, saida: `${canal.padEnd(11, 'x').slice(0, 11)}|||NA|||1|||Vídeo de ${canal}\n`, erro: '' };
    },
  };
  return m;
}

function raizComCanais(canais) {
  const r = novaRaiz();
  for (const [canal, frequencia, enabled = true] of canais) {
    const g = gestao(r, 'P');
    fs.mkdirSync(g, { recursive: true });
    fs.writeFileSync(path.join(g, `${canal}_summary.json`), JSON.stringify({
      canal_url: `https://www.youtube.com/@${canal}`, auto_update: { enabled, frequencia, fontes: ['Videos'] },
    }));
    const id = canal.padEnd(11, 'x').slice(0, 11);
    salvarCsv(path.join(g, `${canal}_base.csv`), COLUNAS_BASE, [{ ID: id, Link: `https://www.youtube.com/watch?v=${id}`, Status: 'Sucesso' }]);
  }
  return r;
}

test('frequência respeitada: ao_abrir, diário, semanal, mensal e desligado', async () => {
  const r = raizComCanais([['aoabrir', 'ao_abrir'], ['diario', 'diario'], ['semanal', 'semanal'], ['mensal', 'mensal'], ['desligado', 'diario', false]]);
  const T0 = Date.UTC(2026, 10, 17, 12);
  let agora = T0;
  const m = motorSimulado();
  const nova = () => new Atualizacao(r, m, { agora: () => agora });
  const rodada = async (a, opcoes) => { m.chamadas = []; await a.verificar(opcoes); return [...m.chamadas].sort(); };

  const a = nova();
  assert.deepEqual(await rodada(a), ['aoabrir', 'diario', 'mensal', 'semanal'], 'nunca verificados: todos na hora');
  assert.deepEqual(await rodada(a), [], 'logo depois: nenhum (ao_abrir já foi nesta abertura)');
  assert.deepEqual(m.pedidos, [], 'sem vídeo novo, nada vai para o motor');

  agora = T0 + DIA + 1000;
  assert.deepEqual(await rodada(a), ['diario']);
  agora = T0 + 7 * DIA + 1000;
  assert.deepEqual(await rodada(a), ['diario', 'semanal']);
  agora = T0 + 8 * DIA;
  assert.deepEqual(await rodada(a), [], 'menos de 1 dia depois da última rodada');
  agora = T0 + 29 * DIA;
  assert.deepEqual(await rodada(a), ['diario', 'semanal'], 'mensal ainda não (29 dias)');
  agora = T0 + 30 * DIA + 1000;
  assert.deepEqual(await rodada(a), ['diario', 'mensal'], 'semanal foi verificado ontem');

  // Nova abertura do plugin: o 'ao_abrir' verifica de novo; o manual ignora a frequência.
  assert.deepEqual(await rodada(nova()), ['aoabrir']);
  assert.deepEqual(await rodada(a, { manual: true }), ['aoabrir', 'diario', 'mensal', 'semanal']);

  // Sem conexão: não conta como verificado, tenta de novo na próxima rodada.
  agora += DIA + 1000;
  m.falhar.add('diario');
  assert.deepEqual(await rodada(a), ['diario']);
  assert.ok(m.logs.some((l) => l.includes('não foi possível acessar https://www.youtube.com/@diario')));
  assert.deepEqual(await rodada(a), ['diario']);
  m.falhar.clear();
  assert.deepEqual(await rodada(a), ['diario']);
  assert.deepEqual(await rodada(a), []);
});

test('vídeo novo vai para o motor com o projeto e as abas da configuração', async () => {
  const r = raizComCanais([['semanal', 'semanal']]);
  salvarCsv(path.join(gestao(r, 'P'), 'semanal_base.csv'), COLUNAS_BASE, []); // nada extraído ainda
  const m = motorSimulado();
  const a = new Atualizacao(r, m);
  assert.deepEqual(await a.verificar(), ['P/semanal']);
  assert.deepEqual(m.pedidos, [{ url: 'https://www.youtube.com/@semanal', projeto_nome: 'P', fontes: ['Videos'] }]);
  assert.ok(m.logs.some((l) => l.includes('🆕 Auto-update: https://www.youtube.com/@semanal tem 1 vídeo(s) novo(s) — enfileirando extração')));
});

test('agendamento: verifica ao abrir e periodicamente, com timers que não seguram o processo', async () => {
  const r = raizComCanais([['aoabrir', 'ao_abrir'], ['diario', 'diario']]);
  let agora = Date.now();
  const m = motorSimulado();
  const a = new Atualizacao(r, m, { agora: () => agora });

  m.is_running = true; // ocupado: a rodada agendada fica para depois
  assert.deepEqual(await a._rodada(), []);
  assert.deepEqual(m.chamadas, []);
  m.is_running = false;

  a.iniciarAgendamento({ atrasoInicialMs: 5, intervaloMs: 30 });
  assert.equal(a._relogio.hasRef(), false);
  assert.equal(a._relogioInicial.hasRef(), false);
  const ate = Date.now() + 3000;
  while (m.chamadas.length < 2 && Date.now() < ate) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual([...m.chamadas].sort(), ['aoabrir', 'diario']);

  agora += DIA + 1000; // o timer periódico pega o diário no dia seguinte
  const ate2 = Date.now() + 3000;
  while (m.chamadas.length < 3 && Date.now() < ate2) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual(m.chamadas.slice(2), ['diario']);

  a.pararAgendamento();
  const n = m.chamadas.length;
  agora += 40 * DIA;
  await new Promise((ok) => setTimeout(ok, 80));
  assert.equal(m.chamadas.length, n, 'parado: não verifica mais');
});
