import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dividirCuesPorTamanho, formatarTempo, lerCues, porCapitulo, porJanelaTemporal, textoCompleto, tsParaSegundos,
} from '../src/nucleo/legendas.js';
import { extrairNomeCanal, sanitizarNome } from '../src/nucleo/caminhos.js';
import { lerBlocosYoutube, montarConsultaFts, trechosDeTexto } from '../src/nucleo/indice.js';
import { URL_CANAL, nomeBinario, normalizarLinkAvulso } from '../src/nucleo/ytdlp.js';

function vtt(cues) {
  return ['WEBVTT', '', ...cues.flatMap(([s, t]) => [`00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000 --> 00:59:59.000`, t, ''])].join('\n');
}
const frase = (i) => `Frase número ${i} com conteúdo suficiente para formar um trecho útil de leitura.`;

test('tempo e limpeza como o desktop', () => {
  assert.equal(tsParaSegundos('01:02:03.500'), 3723);
  assert.equal(tsParaSegundos('02:03.000'), 123);
  assert.equal(formatarTempo(754), '12:34');
  assert.equal(formatarTempo(3723), '1:02:03');
  const conteudo = 'WEBVTT\n\n1\n00:00:05.000 --> 00:00:07.000\n<c>Olá</c> mundo\n\n00:00:07.000 --> 00:00:09.000\nOlá mundo\noutra linha\n';
  assert.deepEqual(lerCues(conteudo), [[5, 'Olá mundo'], [7, 'Olá mundo'], [7, 'outra linha']]);
  assert.deepEqual(textoCompleto(conteudo), { texto: 'Olá mundo outra linha', inicio: 5 });
});

test('vídeo curto vira um trecho; longo, janelas de 2 min com 15 s de sobreposição', () => {
  const curto = porJanelaTemporal(vtt([[0, frase(1)], [30, frase(2)]]));
  assert.equal(curto.length, 1);
  const longo = porJanelaTemporal(vtt(Array.from({ length: 40 }, (_, i) => [i * 10, frase(i)])));
  assert.deepEqual(longo.map((s) => s.timestamp_inicio), [0, 105, 210, 315]);
  assert.equal(longo[0].capitulo, '0:00 – 2:00');
});

test('capítulos viram fronteiras; capítulo grande é dividido em partes', () => {
  const cues = Array.from({ length: 60 }, (_, i) => [i * 10, frase(i)]);
  const segs = porCapitulo(vtt(cues), [{ start_time: 0, title: 'Começo' }, { start_time: 100, title: 'Meio' }]);
  assert.equal(segs[0].capitulo, 'Começo');
  assert.equal(segs[0].timestamp_inicio, 0);
  const meio = segs.filter((s) => s.capitulo === 'Meio');
  assert.ok(meio.length > 1, 'capítulo acima de 3000 caracteres é dividido');
  assert.deepEqual(meio.map((s) => s.parte), meio.map((_, i) => i + 1));
  assert.ok(meio.every((s) => s.texto.length <= 3000));
  assert.deepEqual(dividirCuesPorTamanho([[0, 'a'.repeat(10)], [5, 'b'.repeat(10)]], 15), [
    { texto: 'a'.repeat(10), timestamp_inicio: 0 }, { texto: 'b'.repeat(10), timestamp_inicio: 5 },
  ]);
});

test('nomes de pasta seguem a regra do desktop e não escapam da pasta', () => {
  assert.equal(sanitizarNome('Canal do João: aula/1'), 'Canal_do_João__aula_1');
  assert.equal(sanitizarNome('../..'), 'Canal');
  assert.equal(sanitizarNome(''), 'Canal');
  assert.equal(extrairNomeCanal('https://www.youtube.com/@FGV/videos'), 'FGV');
  assert.equal(extrairNomeCanal('https://www.youtube.com/channel/UC123'), 'UC123');
});

test('URLs de canal e links avulsos', () => {
  assert.ok(URL_CANAL.test('https://www.youtube.com/@canal'));
  assert.ok(URL_CANAL.test('https://youtube.com/channel/UCabc_-1'));
  assert.ok(!URL_CANAL.test('https://www.youtube.com/@canal/videos'));
  assert.ok(!URL_CANAL.test('https://youtube.com.evil.com/@canal'));
  assert.equal(normalizarLinkAvulso('http://youtu.be/abc'), 'https://youtu.be/abc');
  assert.throws(() => normalizarLinkAvulso('https://exemplo.com/v'), /Só links do YouTube/);
  assert.throws(() => normalizarLinkAvulso('--exec calc'), /inválido/);
  assert.equal(nomeBinario('win32'), 'yt-dlp.exe');
  assert.equal(nomeBinario('darwin'), 'yt-dlp_macos');
});

test('leitor de TXT do desktop e consulta FTS segura', () => {
  const txt = `﻿# Tusab — Base de Conhecimento\n# Canal: FGV (@FGV)\n${'='.repeat(70)}\n\n\n${'='.repeat(70)}\n`
    + `TITULO: Vídeo — Cap\nABA: Videos\nDATA: 01/01/2026\nLINK: https://www.youtube.com/watch?v=AAAAAAAAAA1\nVIDEO_ID: AAAAAAAAAA1\n`
    + `VIEWS: 3\nTIMESTAMP_INICIO: 95\nTAGS: \nDESCRICAO: \n${'-'.repeat(70)}\nCONTEUDO:\nTexto do trecho.\n${'='.repeat(70)}\n`;
  assert.deepEqual(lerBlocosYoutube(txt), [{
    video_id: 'AAAAAAAAAA1', titulo: 'Vídeo — Cap', link: 'https://www.youtube.com/watch?v=AAAAAAAAAA1',
    data: '01/01/2026', inicio: 95, canal: 'FGV', texto: 'Texto do trecho.',
  }]);
  assert.equal(montarConsultaFts('O que é "fotossíntese" OR NEAR(x)?'), '"fotossíntese" OR "near"');
  assert.equal(montarConsultaFts('de a o'), null);
  assert.equal(trechosDeTexto('a\n\nb').length, 1);
});
