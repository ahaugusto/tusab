// Monta o vídeo final a partir dos clipes de saida/clips: ordem, transições em fade,
// trilha opcional (musica.mp3 nesta pasta) e uma faixa de áudio silenciosa quando não há música
// (algumas plataformas rejeitam MP4 sem áudio). Uso: node montar.cjs
const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');

const CLIPS = path.join(__dirname, 'saida', 'clips');
const SAIDA = path.join(__dirname, 'saida', 'tusab-divulgacao-1080p.mp4');
const T = 0.4;   // duração da transição

// Ordem narrativa: gancho → virada → logo → coletar → conversar → privacidade → perfis → chamada.
const ORDEM = [
  'card_abertura', 'card_virada', 'card_logo',
  'app_01_home', 'app_02_youtube', 'app_03_publica', 'card_numeros',
  'app_04_educacao', 'app_05_busca', 'app_06_resultado',
  'app_13_dados_modal', 'app_14_dados_busca', 'app_15_dados_resultado', 'app_16_juris',
  'app_07_chat_pergunta', 'app_08_chat_espera', 'app_09_chat_resposta',
  'app_10_chat_tabela_pergunta', 'app_11_chat_tabela_espera', 'app_12_chat_planilha',
  'card_privacidade', 'card_perfis', 'card_cta',
];

// Duração mínima (s): cenas estáticas que a gravação encurta (só há quadros quando a tela muda).
const MINIMO = { app_06_resultado: 3.2, app_09_chat_resposta: 4.5, app_15_dados_resultado: 3.2, app_16_juris: 5.5 };
for (const [n, min] of Object.entries(MINIMO)) {
  const f = path.join(CLIPS, n + '.mp4');
  if (!fs.existsSync(f)) continue;
  const d0 = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  if (d0 >= min) continue;
  const tmp = path.join(CLIPS, n + '_pad.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', f, '-vf', `tpad=stop_mode=clone:stop_duration=${(min - d0 + 0.05).toFixed(2)}`, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', tmp]);
  fs.renameSync(tmp, f);
  console.log(`  ${n}: ${d0.toFixed(1)}s → ${min}s`);
}

const existentes = ORDEM.filter((n) => fs.existsSync(path.join(CLIPS, n + '.mp4')));
const faltando = ORDEM.filter((n) => !existentes.includes(n));
if (faltando.length) console.log('AVISO — clipes ausentes (ficam de fora):', faltando.join(', '));
if (existentes.length < 2) { console.error('clipes insuficientes'); process.exit(1); }

const dur = (n) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(CLIPS, n + '.mp4')]).toString());
// Velocidade por cena (>1 acelera). Esperas e digitação aceleram mais; cenas com legenda para ler, menos.
const VEL = {
  card_virada: 1.2, card_numeros: 1.15, card_privacidade: 1.2, card_perfis: 1.2,
  app_01_home: 1.4, app_02_youtube: 1.4, app_03_publica: 1.3, app_04_educacao: 1.8, app_05_busca: 1.7,
  app_06_resultado: 1.2, app_13_dados_modal: 1.7, app_14_dados_busca: 2, app_15_dados_resultado: 1.2,
  app_16_juris: 1.7, app_07_chat_pergunta: 1.8, app_08_chat_espera: 3.3, app_10_chat_tabela_pergunta: 1.3,
  app_11_chat_tabela_espera: 4, app_12_chat_planilha: 1.2,
};
const vel = (n) => VEL[n] || 1;
const d = existentes.map((n) => dur(n) / vel(n));
const total = d.reduce((a, b) => a + b, 0) - T * (existentes.length - 1);
console.log(`${existentes.length} clipes → ${total.toFixed(1)}s`);

const args = ['-y', '-v', 'error'];
existentes.forEach((n) => args.push('-i', path.join(CLIPS, n + '.mp4')));
const musica = path.join(__dirname, 'musica.mp3');
const temMusica = fs.existsSync(musica);
if (temMusica) args.push('-stream_loop', '-1', '-i', musica);
else args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

let filtro = existentes.map((n, i) => `[${i}:v]setpts=PTS/${vel(n)},fps=30,format=yuv420p[s${i}]`).join(';') + ';', anterior = '[s0]', acumulado = d[0];
for (let i = 1; i < existentes.length; i++) {
  const saida = i === existentes.length - 1 ? '[vx]' : `[v${i}]`;
  filtro += `${anterior}[s${i}]xfade=transition=fade:duration=${T}:offset=${(acumulado - T).toFixed(3)}${saida};`;
  anterior = saida; acumulado += d[i] - T;
}
filtro += `[vx]fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[vf]`;
const idxAudio = existentes.length;
filtro += temMusica
  ? `;[${idxAudio}:a]volume=0.22,afade=t=in:st=0:d=1.5,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[af]`
  : `;[${idxAudio}:a]anull[af]`;

args.push('-filter_complex', filtro, '-map', '[vf]', '-map', '[af]', '-t', total.toFixed(2),
  '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', SAIDA);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) { console.error('ffmpeg falhou'); process.exit(1); }

// miniatura (quadro do cartão do logo)
const iLogo = existentes.indexOf('card_logo');
if (iLogo >= 0) {
  const inicio = d.slice(0, iLogo).reduce((a, b) => a + b, 0) - T * iLogo;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', (inicio + 3.6).toFixed(2), '-i', SAIDA, '-frames:v', '1', path.join(__dirname, 'saida', 'miniatura.png')]);
}
const mb = (fs.statSync(SAIDA).size / 1048576).toFixed(1);
console.log(`OK → ${SAIDA} (${mb} MB, ${total.toFixed(1)}s, ${temMusica ? 'com música' : 'sem música'})`);
