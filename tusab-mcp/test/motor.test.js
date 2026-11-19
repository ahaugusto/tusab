// Motor de extração + gestão + índice, ponta a ponta, com o yt-dlp falso (sem rede).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Tusab } from '../src/nucleo/tusab.js';
import {
  lerCsv, listarProjetos, listarRepositorio, relatorio, resumirProjetosYoutube,
} from '../src/nucleo/gestao.js';
import { videoNoPeriodo, formatarData } from '../src/nucleo/motor.js';

process.env.TUSAB_YTDLP = fileURLToPath(new URL('./ytdlp-falso.mjs', import.meta.url));
const CANAL = 'https://www.youtube.com/@canalteste';

let raiz;
let tusab;
before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-motor-'));
  tusab = await Tusab.abrir(raiz);
});
after(() => {
  tusab.fechar();
  fs.rmSync(raiz, { recursive: true, force: true });
});

const neural = () => path.join(raiz, 'data', 'neural');

test('datas e período como o desktop', () => {
  assert.equal(formatarData('20260110'), '10/01/2026');
  assert.equal(formatarData('NA'), '');
  assert.ok(videoNoPeriodo('20260215', '2026-02-01', '2026-02-28'));
  assert.ok(!videoNoPeriodo('20260301', '2026-02-01', '2026-02-28'));
  assert.ok(!videoNoPeriodo('NA', '2026-01-01', ''));
  assert.ok(videoNoPeriodo('NA', '', ''));
});

test('set-channel valida a URL e define o projeto', () => {
  const m = tusab.motor;
  assert.equal(m.definirCanal({ canal_url: 'https://exemplo.com/@x' }).error, true);
  const r = m.definirCanal({ canal_url: CANAL, projeto_nome: 'Biologia Geral' });
  assert.deepEqual(r, { message: 'Canal configurado', canal_nome: 'Biologia Geral' });
  assert.equal(m.projeto_nome, 'Biologia_Geral');
});

test('extração grava TXT, CSV, resumo e meta no formato do desktop', async () => {
  const m = tusab.motor;
  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Biologia Geral' });
  assert.equal(m.iniciar({ fontes: ['Videos'] }).message, 'Motor iniciado');
  assert.equal(m.status().is_running, true);
  assert.equal(m.iniciar().message, 'Motor já está rodando');
  await m.execucao;

  const st = m.status();
  assert.equal(st.is_running, false);
  assert.equal(st.stats.status, 'Finalizado ✓');
  assert.equal(st.stats.progress, 100);
  assert.equal(st.stats.videos_total, 3);
  assert.equal(st.stats.videos_processed, 2);
  assert.equal(st.stats.videos_sem_legenda, 1);
  assert.ok(st.logs.some((l) => l.message.includes('✅ OK!') && l.timestamp && l.canal === 'Biologia Geral'));

  const dirCanal = path.join(neural(), 'Biologia_Geral', 'youtube', 'canalteste');
  const txt = fs.readFileSync(path.join(dirCanal, 'canalteste_Parte_1.txt'), 'utf8');
  assert.ok(txt.startsWith('﻿# Tusab — Base de Conhecimento\n# Canal: Canal Teste (@canalteste)'));
  assert.match(txt, /TITULO: Fotossíntese explicada — 0:00 – 2:00\nABA: Videos\nDATA: 10\/01\/2026\nLINK: https:\/\/www\.youtube\.com\/watch\?v=AAAAAAAAAA1\nVIDEO_ID: AAAAAAAAAA1\nVIEWS: 1500\nTIMESTAMP_INICIO: 0\nTAGS: biologia,ciência\nDESCRICAO: Descrição de Fotossíntese explicada\n-{70}\nCONTEUDO:\n/);
  // Capítulos do vídeo 2 viram blocos com o nome do capítulo e o tempo dele
  assert.match(txt, /TITULO: Respiração celular — Desenvolvimento\n[\s\S]*?TIMESTAMP_INICIO: 180\n/);
  assert.ok(fs.existsSync(path.join(dirCanal, 'canalteste_meta.json')));

  const { colunas, linhas } = lerCsv(path.join(neural(), 'Biologia_Geral', 'management', 'canalteste_base.csv'));
  assert.deepEqual(colunas, ['ID', 'Data_Pub', 'Link', 'Titulo', 'Aba', 'Views', 'Local', 'Status', 'Data_Extracao']);
  assert.deepEqual(linhas.map((l) => [l.ID, l.Status, l.Local]), [
    ['AAAAAAAAAA1', 'Sucesso', 'canalteste_Parte_1'],
    ['AAAAAAAAAA2', 'Sucesso', 'canalteste_Parte_1'],
    ['AAAAAAAAAA3', 'Sem Legenda', 'N/A'],
  ]);
  const sumario = JSON.parse(fs.readFileSync(path.join(neural(), 'Biologia_Geral', 'management', 'canalteste_summary.json'), 'utf8'));
  assert.equal(sumario.total_mapeado, 3);
  assert.deepEqual(sumario.canal_urls, [CANAL]);
});

test('histórico, relatório, repositório e projetos leem o que o motor gravou', () => {
  const [h] = resumirProjetosYoutube(raiz);
  assert.equal(h.canal, 'canalteste');
  assert.equal(h.projeto, 'Biologia_Geral');
  assert.equal(h.extraidos, 2);
  assert.equal(h.sem_legenda, 1);
  assert.equal(h.cobertura, 67);
  assert.equal(h.canal_url, 'https://www.youtube.com/@canalteste');

  const r = relatorio(raiz, 'canalteste');
  assert.equal(r.stats.total, 3);
  assert.equal(r.stats.cobertura, 66.7);
  assert.equal(r.videos.length, 3);
  assert.equal(relatorio(raiz, 'naoexiste').error, true);

  const repo = listarRepositorio(raiz);
  assert.equal(repo.canais[0].nome, 'Biologia_Geral');
  assert.equal(repo.youtube[0].nome, 'canalteste_Parte_1.txt');
  assert.deepEqual(listarProjetos(raiz).projetos, [{ nome: 'Biologia_Geral', tipo: 'youtube', n_arquivos: 1, canais: ['canalteste'] }]);
});

test('o índice é atualizado ao fim da extração e cita o minuto', () => {
  const achados = tusab.indice.buscar('clorofila energia', { projeto: 'Biologia_Geral' });
  assert.ok(achados.length > 0);
  const capitulo = tusab.indice.buscar('glicose cadeia alimentar respiração');
  assert.ok(capitulo.some((a) => a.link.startsWith('https://www.youtube.com/watch?v=AAAAAAAAAA')));
  const comMinuto = achados.find((a) => a.inicio_s > 0);
  assert.equal(comMinuto.link, `https://www.youtube.com/watch?v=${comMinuto.chave_externa}&t=${comMinuto.inicio_s}s`);
  assert.equal(tusab.indice.listarProjetos()[0].videos, 2);
});

test('nova extração do mesmo canal não repete vídeos já minerados', async () => {
  const m = tusab.motor;
  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Biologia Geral' });
  m.iniciar({ fontes: ['Videos', 'Shorts'] });
  await m.execucao;
  const { linhas } = lerCsv(path.join(neural(), 'Biologia_Geral', 'management', 'canalteste_base.csv'));
  assert.deepEqual(linhas.map((l) => l.ID), ['AAAAAAAAAA1', 'AAAAAAAAAA2', 'AAAAAAAAAA3', 'BBBBBBBBBB1']);
  assert.ok(m.status().logs.some((l) => l.message.includes('1 vídeos inéditos')));
});

test('filtro de playlist e de data', async () => {
  const m = tusab.motor;
  m.definirCanal({ canal_url: CANAL, projeto_nome: 'So Playlist' });
  m.iniciar({ fontes: ['Playlists'], playlists: ['PLtestePlaylist01'] });
  await m.execucao;
  let { linhas } = lerCsv(path.join(neural(), 'So_Playlist', 'management', 'canalteste_base.csv'));
  assert.deepEqual(linhas.map((l) => [l.ID, l.Aba]), [['AAAAAAAAAA1', 'Playlist: Biologia básica']]);

  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Fevereiro' });
  m.iniciar({ fontes: ['Videos'], data_inicio: '2026-02-01', data_fim: '2026-02-28' });
  await m.execucao;
  ({ linhas } = lerCsv(path.join(neural(), 'Fevereiro', 'management', 'canalteste_base.csv')));
  assert.deepEqual(linhas.map((l) => l.ID), ['AAAAAAAAAA2']);
  const uf = resumirProjetosYoutube(raiz).find((h) => h.projeto === 'Fevereiro').ultimo_filtro;
  assert.equal(uf.data_inicio, '2026-02-01');
});

test('pausa, retomada e cancelamento', async () => {
  const m = tusab.motor;
  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Cancelado' });
  m.iniciar({ fontes: ['Videos'] });
  while (!m.logs.some((l) => l.message.includes('Iniciando extração'))) await new Promise((r) => setTimeout(r, 20));
  assert.equal(m.pausar().message, 'Pausado');
  assert.equal(m.status().is_paused, true);
  assert.equal(m.pausar().message, 'Retomado');
  assert.equal(m.cancelarExtracao().message, 'Cancelando');
  await m.execucao;
  assert.equal(m.stats.status, 'Interrompido');
  assert.ok(m.logs.some((l) => l.message.includes('PROCESSO INTERROMPIDO')));
  assert.equal(m.cancelarExtracao().message, 'Motor não está rodando');
});

test('fila: adicionar, mover, remover e consumir em sequência', async () => {
  const m = tusab.motor;
  assert.equal(m.filaAdicionar({ canal_url: 'https://x.com' }).error, true);
  m.filaAdicionar({ canal_url: CANAL, projeto_nome: 'Fila A', fontes: ['Shorts'] });
  m.filaAdicionar({ canal_url: CANAL, projeto_nome: 'Fila B', fontes: ['Shorts'] });
  m.filaAdicionar({ canal_url: CANAL, projeto_nome: 'Fila C', fontes: ['Shorts'] });
  assert.deepEqual(m.filaMover({ from_index: 2, to_index: 0 }), { ok: true });
  assert.deepEqual(m.filaRemover(1), { ok: true });
  assert.deepEqual(m.filaStatus().queue.map((q) => q.projeto_nome), ['Fila C', 'Fila B']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'config', 'extraction_queue.json'), 'utf8')).length, 2);

  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Fila Inicio' });
  m.iniciar({ fontes: ['Shorts'] });
  await m.execucao;
  assert.equal(m.filaStatus().queue.length, 0);
  for (const p of ['Fila_Inicio', 'Fila_C', 'Fila_B']) {
    assert.ok(fs.existsSync(path.join(neural(), p, 'management', 'canalteste_base.csv')), p);
  }
});

test('IA pede vídeo avulso: entra na fila se o motor estiver ocupado', async () => {
  const m = tusab.motor;
  m.definirCanal({ canal_url: CANAL, projeto_nome: 'Ocupado' });
  m.iniciar({ fontes: ['Shorts'] });
  const r = m.extrairOuEnfileirar({ url: 'https://www.youtube.com/watch?v=AAAAAAAAAA1', projeto_nome: 'Avulsos' });
  assert.deepEqual(r, { enfileirado: true, posicao: 1 });
  await m.execucao;
  const { linhas } = lerCsv(path.join(neural(), 'Avulsos', 'management', 'canalteste_base.csv'));
  assert.deepEqual(linhas.map((l) => [l.ID, l.Aba, l.Status]), [['AAAAAAAAAA1', 'Avulsos', 'Sucesso']]);
});

test('índice lê base antiga do desktop (texts/ com cabeçalho e TXT com blocos)', () => {
  const textos = path.join(neural(), 'Legado', 'texts');
  fs.mkdirSync(textos, { recursive: true });
  fs.writeFileSync(path.join(textos, 'a1b2c3d4_Notas.txt'), `TITULO: Notas da aula\nFONTE: texto\nDATA: 01/02/2026\n${'-'.repeat(70)}\nA mitocôndria produz ATP.`);
  const r = tusab.salvarTexto({ titulo: 'Resumo', conteudo: 'Ribossomos sintetizam proteínas.', projeto: 'Legado' });
  assert.equal(r.ok, true);
  const manifesto = JSON.parse(fs.readFileSync(path.join(textos, '_manifest.json'), 'utf8'));
  assert.equal(manifesto[0].titulo, 'Resumo');
  tusab.sincronizar();
  const [achado] = tusab.indice.buscar('mitocondria', { projeto: 'Legado' });
  assert.equal(achado.titulo, 'Notas da aula');
  assert.equal(achado.texto, 'A mitocôndria produz ATP.');
  assert.equal(tusab.indice.buscar('ribossomos')[0].tipo, 'texto');
  // Apagar o arquivo tira do índice
  fs.rmSync(path.join(textos, 'a1b2c3d4_Notas.txt'));
  assert.deepEqual(tusab.sincronizar(), { lidos: 0, removidos: 1 });
  assert.equal(tusab.indice.buscar('mitocondria').length, 0);
});

test('status ocioso conta os TXT no disco e não expõe o projeto', () => {
  const st = tusab.motor.status();
  assert.equal(st.is_running, false);
  assert.equal(st.stats.projeto_nome, '');
  assert.ok(st.stats.files_generated >= 6);
  assert.equal(st.drive_status, 'indisponivel');
});
