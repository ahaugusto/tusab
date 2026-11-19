// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// yt-dlp local: roda no computador e no IP do usuário (invariante do Tusab).
// Mesmos comandos do desktop (motor/extraction.py e router_extraction.py), com:
//   - o binário oficial baixado com conferência SHA-256 se o computador não tiver;
//   - --encoding utf-8 (Windows) e o próprio Node do plugin como runtime JavaScript;
//   - metadados + capítulos + legenda numa única chamada por vídeo (o desktop faz
//     três; menos chamadas = menos risco de bloqueio 429).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { t } from './idioma.js';

export const IDIOMAS_PRIMARIOS = 'pt,pt-BR';
export const IDIOMAS_RESERVA = 'en,es';
const BASE_RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';

/** Mesmo filtro do desktop (_YT_URL_RE): canal por @handle, /channel/ID ou /c/nome. */
export const URL_CANAL = /^https:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_.\-]{1,100}|channel\/[a-zA-Z0-9_\-]{1,64}|c\/[a-zA-Z0-9_.\-]{1,100})\/?$/;

const HOSTS_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

/** Link de vídeo ou playlist (para a IA adicionar algo que não é um canal inteiro). */
export function normalizarLinkAvulso(entrada) {
  let url;
  try { url = new URL(String(entrada).trim()); } catch { throw new Error(t('Endereço inválido. Envie um link do YouTube.')); }
  if (!['https:', 'http:'].includes(url.protocol) || !HOSTS_YOUTUBE.has(url.hostname.toLowerCase())) {
    throw new Error(t('Só links do YouTube são aceitos (youtube.com ou youtu.be).'));
  }
  url.protocol = 'https:';
  return url.toString();
}

export function nomeBinario(plataforma = process.platform, arquitetura = process.arch) {
  if (plataforma === 'win32') return 'yt-dlp.exe';
  if (plataforma === 'darwin') return 'yt-dlp_macos';
  if (plataforma === 'linux') return arquitetura === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  throw new Error(t('Sistema não suportado para extração do YouTube: {plataforma}', { plataforma }));
}

/** Script .mjs/.js no lugar do binário (testes): roda com o próprio Node. */
function comandoDe(caminho) {
  return /\.m?js$/i.test(caminho) ? [process.execPath, [caminho]] : [caminho, []];
}

function funciona(comando) {
  try {
    const [cmd, pre] = comandoDe(comando);
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function baixarYtDlp(destinoDir, aviso) {
  const nome = nomeBinario();
  aviso?.(t('⬇️ Baixando o yt-dlp oficial ({nome}) do GitHub, uma única vez…', { nome }));
  const [resBin, resSomas] = await Promise.all([
    fetch(`${BASE_RELEASE}/${nome}`),
    fetch(`${BASE_RELEASE}/SHA2-256SUMS`),
  ]);
  if (!resBin.ok || !resSomas.ok) {
    throw new Error(t('Não foi possível baixar o yt-dlp (HTTP {status}/{status2}).', { status: resBin.status, status2: resSomas.status }));
  }
  const binario = Buffer.from(await resBin.arrayBuffer());
  const esperado = (await resSomas.text()).split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .find(([, arquivo]) => arquivo === nome)?.[0];
  const obtido = crypto.createHash('sha256').update(binario).digest('hex');
  if (!esperado || esperado.toLowerCase() !== obtido) {
    throw new Error(t('O yt-dlp baixado não confere com a soma SHA-256 publicada. Download descartado.'));
  }
  fs.mkdirSync(destinoDir, { recursive: true });
  const destino = path.join(destinoDir, nome);
  fs.writeFileSync(`${destino}.tmp`, binario, { mode: 0o755 });
  fs.renameSync(`${destino}.tmp`, destino);
  if (process.platform !== 'win32') fs.chmodSync(destino, 0o755);
  return destino;
}

/** Ordem: TUSAB_YTDLP → cópia em data/bin → yt-dlp no PATH → download oficial (SHA-256). */
export class YtDlp {
  constructor(binDir) {
    this.binDir = binDir;
    this.binario = null;
    this._localizando = null;
  }

  async preparar(aviso) {
    if (this.binario) return this.binario;
    this._localizando ??= (async () => {
      const definido = (process.env.TUSAB_YTDLP || '').trim();
      if (definido) {
        if (funciona(definido)) return definido;
        throw new Error(t('TUSAB_YTDLP aponta para um yt-dlp que não executa: {definido}', { definido }));
      }
      const local = path.join(this.binDir, nomeBinario());
      if (fs.existsSync(local) && funciona(local)) return local;
      if (funciona('yt-dlp')) return 'yt-dlp';
      return baixarYtDlp(this.binDir, aviso);
    })().finally(() => { this._localizando = null; });
    this.binario = await this._localizando;
    return this.binario;
  }

  /** Roda o yt-dlp; nunca lança (como _ytdlp_run): devolve { codigo, saida, erro }. */
  async rodar(args, { tempoLimite = 60_000, aoLinha } = {}) {
    const bin = await this.preparar();
    const comuns = ['--ignore-config', '--no-warnings', '--encoding', 'utf-8', '--js-runtimes', `node:${process.execPath}`];
    return new Promise((resolve) => {
      let filho;
      try {
        const [cmd, pre] = comandoDe(bin);
        filho = spawn(cmd, [...pre, ...comuns, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        resolve({ codigo: -1, saida: '', erro: String(e) });
        return;
      }
      let saida = '';
      let erro = '';
      let resto = '';
      const relogio = tempoLimite ? setTimeout(() => filho.kill(), tempoLimite) : null;
      filho.stdout.on('data', (d) => {
        const t = d.toString('utf8');
        saida += t;
        if (aoLinha) {
          const linhas = (resto + t).split(/\r?\n/);
          resto = linhas.pop();
          linhas.forEach(aoLinha);
        }
      });
      filho.stderr.on('data', (d) => { erro += d.toString('utf8'); });
      filho.on('error', (e) => { clearTimeout(relogio); resolve({ codigo: -1, saida, erro: String(e) }); });
      filho.on('close', (codigo) => {
        clearTimeout(relogio);
        if (aoLinha && resto) aoLinha(resto);
        resolve({ codigo, saida, erro });
      });
    });
  }

  // ── Consultas usadas pela tela de extração ────────────────────────────────

  /** GET /canal-search — busca canais por nome, sem chave de API (filtro sp=EgIQAg). */
  async buscarCanais(consulta, max = 10) {
    const q = String(consulta || '').trim();
    if (!q) return [];
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D`;
    const { saida } = await this.rodar([
      '--flat-playlist', '--playlist-items', `1-${max}`,
      '--print', '%(channel)s|||%(uploader_id)s|||%(channel_follower_count)s|||%(channel_url)s|||%(thumbnails.-1.url)s',
      url,
    ], { tempoLimite: 20_000 });
    const canais = [];
    const vistos = new Set();
    for (const linha of saida.trim().split(/\r?\n/)) {
      const partes = linha.split('|||');
      if (partes.length < 5) continue;
      let [nome, handle, seguidores, canalUrl, thumb] = partes.map((p) => p.trim());
      if (!nome || !canalUrl || vistos.has(canalUrl)) continue;
      vistos.add(canalUrl);
      if (handle && handle !== 'NA' && !handle.startsWith('@')) handle = `@${handle}`;
      canais.push({
        nome,
        handle: handle && handle !== 'NA' ? handle : '',
        seguidores: /^\d+$/.test(seguidores) ? Number(seguidores) : null,
        url: canalUrl,
        thumbnail: thumb.startsWith('//') ? `https:${thumb}` : (thumb && thumb !== 'NA' ? thumb : ''),
      });
    }
    return canais;
  }

  /** GET /canal-info — mapa de cobertura antes de extrair (títulos e tópicos). */
  async infoCanal(url) {
    const { saida, codigo } = await this.rodar([
      '--flat-playlist', '--ignore-errors', '--print', '%(title)s|||%(view_count)s', '--playlist-end', '500', url,
    ]);
    if (codigo === -1) return { error: true, message: t('Erro ao consultar canal.') };
    const titulos = [];
    let viewsTotal = 0;
    for (const linha of saida.trim().split(/\r?\n/)) {
      const [titulo = '', views = ''] = linha.split('|||');
      const t = titulo.trim();
      if (t && !['[Private video]', '[Deleted video]'].includes(t)) {
        titulos.push(t);
        viewsTotal += /^\d+$/.test(views.trim()) ? Number(views.trim()) : 0;
      }
    }
    if (!titulos.length) return { error: true, message: t('Nenhum vídeo encontrado. Verifique a URL do canal.') };
    const freq = new Map();
    for (const t of titulos) {
      for (const p of t.toLowerCase().match(/[a-záéíóúàâêôãõç]{4,}/g) || []) {
        if (!PALAVRAS_TOPICO_VAZIAS.has(p)) freq.set(p, (freq.get(p) || 0) + 1);
      }
    }
    const topicos = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
      .filter(([, n]) => n >= 2).map(([termo, frequencia]) => ({ termo, frequencia }));
    return { ok: true, total_videos: titulos.length, views_total: viewsTotal, topicos, amostra_titulos: titulos.slice(0, 10) };
  }

  /** GET /playlists-canal — índice da aba Playlists (sem expandir os vídeos). */
  async playlistsCanal(url) {
    const { saida } = await this.rodar([
      '--flat-playlist', '--ignore-errors', '--get-id', '--get-title', `${url.replace(/\/+$/, '')}/playlists`,
    ], { tempoLimite: 30_000 });
    const linhas = saida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const playlists = [];
    for (let i = 0; i + 1 < linhas.length; i += 2) {
      const [titulo, id] = [linhas[i], linhas[i + 1]];
      if (/^[A-Za-z0-9_-]{10,50}$/.test(id) && titulo) playlists.push({ id, titulo });
    }
    return { ok: true, playlists };
  }

  /** Nome/handle real para URLs sem @handle (/channel/UC…, /c/…). */
  async resolverNomeCanal(url) {
    const { saida } = await this.rodar([
      '--flat-playlist', '--playlist-items', '1', '--print', '%(uploader_id)s|||%(channel)s', url,
    ], { tempoLimite: 30_000 });
    const [id = '', canal = ''] = (saida.trim().split(/\r?\n/)[0] || '').split('|||').map((s) => s.trim());
    if (id && !['NA', 'None'].includes(id)) return id.replace(/^@/, '');
    if (canal && !['NA', 'None'].includes(canal)) return canal;
    return '';
  }

  /** Metadados do canal (nome, @handle, inscritos) para o cabeçalho do .txt. */
  async metaCanal(url) {
    const { saida } = await this.rodar([
      '--flat-playlist', '--playlist-items', '1', '--print', '%(channel)s|||%(uploader_id)s|||%(channel_follower_count)s', url,
    ], { tempoLimite: 30_000 });
    const [nome = '', handle = '', seg = ''] = (saida.trim().split(/\r?\n/)[0] || '').split('|||').map((s) => s.trim());
    return { nome, handle, seguidores: seg };
  }

  /**
   * Lista vídeos de uma aba do canal, de uma playlist ou de um link avulso.
   * Cada linha: id|||upload_date|||view_count|||title (formato do desktop).
   */
  async mapear(url, aoLinha) {
    return this.rodar([
      '--flat-playlist', '--ignore-errors', '--extractor-args', 'youtube:lang=pt',
      '--print', '%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s', url,
    ], { tempoLimite: 0, aoLinha });
  }

  /** Datas reais de um lote de vídeos (o --flat-playlist não traz upload_date). */
  async datasReais(ids) {
    const { saida } = await this.rodar([
      '--ignore-errors', '--extractor-args', 'youtube:lang=pt', '--print', '%(id)s|||%(upload_date)s',
      ...ids.map((id) => `https://www.youtube.com/watch?v=${id}`),
    ], { tempoLimite: 0 });
    return saida.split(/\r?\n/).map((l) => l.split('|||')).filter((p) => p.length >= 2);
  }

  /**
   * Legenda + metadados de um vídeo numa chamada. Duas passagens de idioma
   * (pt,pt-BR → en,es) e skip=translated_subs, como o desktop.
   * Devolve { meta, vtt, idioma } — vtt null se não houver legenda.
   */
  async legendaEMetadados(videoId, tempDir) {
    const link = `https://www.youtube.com/watch?v=${videoId}`;
    const prefixo = `temp_${videoId}`;
    const base = [
      '--skip-download', '--no-simulate', '--write-auto-subs', '--write-subs', '--sub-format', 'vtt',
      '--extractor-args', 'youtube:skip=translated_subs', '--sleep-requests', '1',
      '-P', tempDir, '-o', `${prefixo}.%(ext)s`,
      '--print', '%(.{upload_date,tags,description,chapters,title,channel,duration})j',
    ];
    let meta = null;
    let avisos = [];
    for (const idiomas of [IDIOMAS_PRIMARIOS, IDIOMAS_RESERVA]) {
      const { saida, erro } = await this.rodar([...base, '--sub-langs', idiomas, link], { tempoLimite: 120_000 });
      const linhaJson = saida.split(/\r?\n/).find((l) => l.trim().startsWith('{'));
      if (linhaJson && !meta) { try { meta = JSON.parse(linhaJson); } catch { /* segue sem meta */ } }
      avisos = erro.split(/\r?\n/).filter((l) => l.includes('ERROR') && !l.includes('429'));
      if (escolherVtt(tempDir, prefixo)) break;
    }
    const achado = escolherVtt(tempDir, prefixo);
    let vtt = null;
    if (achado) vtt = fs.readFileSync(achado.arquivo, 'utf8');
    for (const f of fs.readdirSync(tempDir)) {
      if (f.startsWith(`${prefixo}.`)) fs.rmSync(path.join(tempDir, f), { force: true });
    }
    return { meta: meta || {}, vtt, idioma: achado?.idioma || '', aviso: avisos.at(-1) || '' };
  }
}

function escolherVtt(dir, prefixo) {
  const ordem = [...IDIOMAS_PRIMARIOS.split(','), ...IDIOMAS_RESERVA.split(',')];
  let arquivos = [];
  try { arquivos = fs.readdirSync(dir).filter((f) => f.startsWith(`${prefixo}.`) && f.endsWith('.vtt')); } catch { return null; }
  for (const idioma of ordem) {
    const f = arquivos.find((a) => a === `${prefixo}.${idioma}.vtt` || a.startsWith(`${prefixo}.${idioma}-`));
    if (f) return { arquivo: path.join(dir, f), idioma };
  }
  return arquivos.length ? { arquivo: path.join(dir, arquivos[0]), idioma: arquivos[0].split('.').at(-2) } : null;
}

const PALAVRAS_TOPICO_VAZIAS = new Set((
  'de a o que e do da em um para com uma os no se na por mais as dos como mas ao ele das seu sua ou ser quando ' +
  'muito nos já também só pelo pela até isso ela entre era depois sem mesmo aos ter seus quem nas me esse eles ' +
  'vocé você essa nem suas meu the an and or but in on at to for of with by from is are was were be have has do ' +
  'does did will would could should this that not what how all ep ft part parte vol vs feat'
).split(' '));
