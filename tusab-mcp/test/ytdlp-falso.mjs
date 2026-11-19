// yt-dlp falso para testes: responde aos mesmos comandos que o motor usa,
// sem rede. Canal "@canalteste" com 3 vídeos na aba Vídeos (um sem legenda),
// 1 short e 1 playlist. TUSAB_YTDLP=<este arquivo> faz o plugin usá-lo.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const tem = (s) => args.some((a) => a.includes(s));
const valor = (flag) => args[args.indexOf(flag) + 1];
const url = args.at(-1);
const out = (linhas) => process.stdout.write(`${linhas.join('\n')}\n`);

const VIDEOS = [
  { id: 'AAAAAAAAAA1', data: '20260110', views: '1500', titulo: 'Fotossíntese explicada', legenda: true },
  { id: 'AAAAAAAAAA2', data: '20260215', views: '900', titulo: 'Respiração celular', legenda: true, capitulos: true },
  { id: 'AAAAAAAAAA3', data: '20260301', views: '40', titulo: 'Vídeo sem legenda', legenda: false },
];
const SHORTS = [{ id: 'BBBBBBBBBB1', data: 'NA', views: '10', titulo: 'Short rápido', legenda: true }];
const TODOS = [...VIDEOS, ...SHORTS];

function vtt(titulo) {
  const linhas = ['WEBVTT', ''];
  const frases = [
    `${titulo}: introdução ao tema com exemplos do cotidiano e definições importantes para começar.`,
    'A clorofila absorve a luz do sol e transforma essa energia em energia química dentro da célula.',
    'O gás carbônico e a água entram no processo e o oxigênio é liberado para a atmosfera.',
    'Na segunda parte vemos como a glicose produzida alimenta a planta e toda a cadeia alimentar.',
    'Por fim, revisamos os conceitos e respondemos as dúvidas mais comuns dos estudantes.',
  ];
  for (let i = 0; i < 40; i++) {
    const s = i * 9;
    const ts = (x) => `00:${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}.000`;
    linhas.push(`${ts(s)} --> ${ts(s + 9)}`, frases[i % frases.length], '');
  }
  return linhas.join('\n');
}

if (tem('--version')) { out(['2026.10.26']); process.exit(0); }

// Busca de canais por nome
if (tem('results?search_query=')) {
  out(['Canal Teste|||@canalteste|||12345|||https://www.youtube.com/@canalteste|||//yt3.ggpht.com/foto.jpg',
    'Outro Canal|||outro|||NA|||https://www.youtube.com/@outro|||NA']);
  process.exit(0);
}
// Resolver nome / metadados do canal
if (tem('%(uploader_id)s|||%(channel)s')) { out(['@canalteste|||Canal Teste']); process.exit(0); }
if (tem('%(channel)s|||%(uploader_id)s|||%(channel_follower_count)s')) { out(['Canal Teste|||@canalteste|||12345']); process.exit(0); }
// Mapa do canal (canal-info)
if (tem('%(title)s|||%(view_count)s')) { out(TODOS.map((v) => `${v.titulo}|||${v.views}`)); process.exit(0); }
// Playlists do canal
if (tem('--get-id') && url.endsWith('/playlists')) { out(['Biologia básica', 'PLtestePlaylist01']); process.exit(0); }
// Mapeamento de vídeos
if (tem('%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s')) {
  let lista = [];
  if (url.endsWith('/videos')) lista = VIDEOS;
  else if (url.endsWith('/shorts')) lista = SHORTS;
  else if (url.includes('list=PLtestePlaylist01')) lista = [VIDEOS[0]];
  else if (url.includes('watch?v=')) lista = TODOS.filter((v) => url.includes(v.id));
  out(lista.map((v) => `${v.id}|||NA|||${v.views}|||${v.titulo}`));
  process.exit(0);
}
// Datas reais (filtro de data)
if (tem('%(id)s|||%(upload_date)s') && !tem('%(view_count)s')) {
  out(TODOS.filter((v) => args.some((a) => a.includes(v.id))).map((v) => `${v.id}|||${v.data}`));
  process.exit(0);
}
// Legenda + metadados (YTDLP_FALSO_ATRASO=ms simula a demora real, para ver o progresso na tela)
if (tem('--write-subs')) {
  const atraso = Number(process.env.YTDLP_FALSO_ATRASO || 0);
  if (atraso) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, atraso);
  const v = TODOS.find((x) => url.includes(x.id));
  if (!v) { process.stderr.write('ERROR: vídeo indisponível\n'); process.exit(1); }
  const meta = {
    upload_date: v.data === 'NA' ? '20260401' : v.data, tags: ['biologia', 'ciência'], description: `Descrição de ${v.titulo}`,
    chapters: v.capitulos ? [{ start_time: 0, title: 'Abertura' }, { start_time: 180, title: 'Desenvolvimento' }] : null,
    title: v.titulo, channel: 'Canal Teste', duration: 360,
  };
  out([JSON.stringify(meta)]);
  const idiomas = valor('--sub-langs');
  if (v.legenda && idiomas.startsWith('pt')) {
    const prefixo = valor('-o').replace('.%(ext)s', '');
    fs.writeFileSync(path.join(valor('-P'), `${prefixo}.pt.vtt`), vtt(v.titulo));
  }
  process.exit(0);
}
process.stderr.write(`yt-dlp falso: comando não previsto: ${args.join(' ')}\n`);
process.exit(2);
