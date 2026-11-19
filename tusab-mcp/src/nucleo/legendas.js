// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Legenda WebVTT → segmentos com tempo. Porte fiel de motor/extraction.py
// (_limpar_vtt_interno, _vtt_por_janela_temporal, _dividir_cues_por_tamanho,
// _vtt_por_capitulo): os mesmos cortes geram os mesmos .txt do desktop.

export const LIMITE_CHUNK_CHARS = 3000;
const MINIMO_SEGMENTO = 80;

/** 'HH:MM:SS.mmm' ou 'MM:SS.mmm' → segundos inteiros. */
export function tsParaSegundos(ts) {
  const partes = String(ts).trim().split('.')[0].split(':').map((n) => parseInt(n, 10));
  if (partes.some(Number.isNaN)) return 0;
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  return 0;
}

/** Linhas de texto da legenda com o tempo do cue em que aparecem. */
export function lerCues(conteudo) {
  const cues = [];
  let tsAtual = 0;
  for (const bruta of String(conteudo).split(/\r?\n/)) {
    if (bruta.includes('-->')) {
      tsAtual = tsParaSegundos(bruta.split('-->')[0]);
      continue;
    }
    const t = bruta.trim();
    if (/^\d+$/.test(t) || bruta.includes('WEBVTT')) continue;
    const linha = bruta.replace(/<[^>]*>/g, '').trim();
    if (linha) cues.push([tsAtual, linha]);
  }
  return cues;
}

function semRepeticao(cues) {
  const saida = [];
  for (const [ts, t] of cues) {
    if (!saida.length || saida.at(-1)[1] !== t) saida.push([ts, t]);
  }
  return saida;
}

const juntar = (cues) => cues.map(([, t]) => t).join(' ').trim();

/** Texto inteiro + tempo do primeiro cue (_limpar_vtt_interno). */
export function textoCompleto(conteudo) {
  const linhas = String(conteudo).split(/\r?\n/);
  let inicio = 0;
  let achouTempo = false;
  const textos = [];
  for (const bruta of linhas) {
    if (bruta.includes('-->')) {
      if (!achouTempo) { inicio = tsParaSegundos(bruta.split('-->')[0]); achouTempo = true; }
      continue;
    }
    if (/^\d+$/.test(bruta.trim()) || bruta.includes('WEBVTT')) continue;
    const l = bruta.replace(/<[^>]*>/g, '').trim();
    if (l) textos.push(l);
  }
  const resultado = textos.filter((t, i) => i === 0 || t !== textos[i - 1]);
  return { texto: resultado.join(' ').trim(), inicio };
}

export function dividirCuesPorTamanho(cuesDedup, limite = LIMITE_CHUNK_CHARS) {
  if (!cuesDedup.length) return [];
  const segmentos = [];
  let textos = [];
  let tamanho = 0;
  let ts = cuesDedup[0][0];
  for (const [t, texto] of cuesDedup) {
    if (textos.length && tamanho + texto.length + 1 > limite) {
      segmentos.push({ texto: textos.join(' ').trim(), timestamp_inicio: ts });
      textos = []; tamanho = 0; ts = t;
    }
    textos.push(texto);
    tamanho += texto.length + 1;
  }
  if (textos.length) segmentos.push({ texto: textos.join(' ').trim(), timestamp_inicio: ts });
  return segmentos;
}

function partes(subSegs, capitulo) {
  const total = subSegs.length;
  return subSegs
    .map((s, i) => ({ ...s, capitulo, parte: i + 1, total_partes: total }))
    .filter((s) => s.texto.length >= MINIMO_SEGMENTO);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function porJanelaTemporal(conteudo, janela = 120, sobreposicao = 15) {
  const cues = lerCues(conteudo);
  if (!cues.length) return [{ texto: '', timestamp_inicio: 0, capitulo: '' }];
  const duracao = cues.at(-1)[0];

  if (duracao <= janela) {
    const dedup = semRepeticao(cues);
    const total = juntar(dedup);
    if (total.length <= LIMITE_CHUNK_CHARS) return [{ texto: total, timestamp_inicio: cues[0][0], capitulo: '' }];
    const r = partes(dividirCuesPorTamanho(dedup), '');
    return r.length ? r : [{ texto: total, timestamp_inicio: cues[0][0], capitulo: '' }];
  }

  const segmentos = [];
  const passo = janela - sobreposicao;
  for (let inicio = 0; inicio <= duracao; inicio += passo) {
    const fim = inicio + janela;
    const dedup = semRepeticao(cues.filter(([ts]) => ts >= inicio && ts < fim));
    const texto = juntar(dedup);
    if (texto.length < MINIMO_SEGMENTO) continue;
    const rotulo = `${mmss(inicio)} – ${mmss(Math.min(fim, duracao + 1))}`;
    if (texto.length <= LIMITE_CHUNK_CHARS) segmentos.push({ texto, timestamp_inicio: inicio, capitulo: rotulo });
    else segmentos.push(...partes(dividirCuesPorTamanho(dedup), rotulo));
  }
  if (segmentos.length) return segmentos;
  return [{ texto: juntar(semRepeticao(cues)), timestamp_inicio: cues[0][0], capitulo: '' }];
}

/**
 * Segmenta por capítulos do YouTube; sem capítulos, janela temporal (2 min, 15 s);
 * vídeo curto demais, texto inteiro.
 */
export function porCapitulo(conteudo, capitulos = []) {
  if (!capitulos?.length) {
    const seg = porJanelaTemporal(conteudo);
    if (seg.length > 1) return seg;
    const { texto, inicio } = textoCompleto(conteudo);
    return [{ texto, timestamp_inicio: inicio, capitulo: '' }];
  }
  const cues = lerCues(conteudo);
  if (!cues.length) return [{ texto: '', timestamp_inicio: 0, capitulo: '' }];
  const ordenados = [...capitulos].sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
  const fronteiras = [...ordenados.map((c) => c.start_time || 0), Infinity];
  const segmentos = [];
  ordenados.forEach((cap, i) => {
    const dedup = semRepeticao(cues.filter(([ts]) => ts >= (cap.start_time || 0) && ts < fronteiras[i + 1]));
    const texto = juntar(dedup);
    if (texto.length < MINIMO_SEGMENTO) return;
    if (texto.length <= LIMITE_CHUNK_CHARS) {
      segmentos.push({ texto, timestamp_inicio: Math.trunc(cap.start_time || 0), capitulo: cap.title || '' });
    } else {
      segmentos.push(...partes(dividirCuesPorTamanho(dedup), cap.title || ''));
    }
  });
  if (segmentos.length) return segmentos;
  const { texto, inicio } = textoCompleto(conteudo);
  return [{ texto, timestamp_inicio: inicio, capitulo: '' }];
}

/** Segundos → MM:SS ou H:MM:SS (para citação). */
export function formatarTempo(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}
