// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Motor de extração — porte de motor/extraction.py::tusab_engine() e de
// api/router_extraction.py (estado, pausa, cancelamento, fila). Grava os mesmos
// arquivos do desktop: {canal}_Parte_N.txt, {canal}_base.csv, _summary.json, _meta.json.

import fs from 'node:fs';
import path from 'node:path';
import {
  caminhos, dataBr, dataIso, extrairNomeCanal, horaCurta, lerJson, salvarJson, sanitizarNome,
} from './caminhos.js';
import { COLUNAS_BASE, contarArquivosYoutube, lerCsv, pastaGestao, pastaYoutubeCanal, salvarCsv } from './gestao.js';
import { porCapitulo } from './legendas.js';
import { URL_CANAL, YtDlp } from './ytdlp.js';
import { t } from './idioma.js';

export const MAX_PALAVRAS_POR_ARQUIVO = 40000;
const SEP = '='.repeat(70);
const PREFIXOS_NAO_VIDEO = ['PL', 'UU', 'FL', 'RD', 'OL'];

function statsIniciais() {
  return {
    videos_processed: 0, videos_total: 0, videos_mapeados: 0, videos_sem_legenda: 0,
    videos_legenda_curta: 0, files_generated: 0, status: 'Ocioso', progress: 0,
    projeto_nome: '', idioma_detectado: '', eta_segundos: 0,
  };
}

/** yt-dlp YYYYMMDD → dd/mm/aaaa (formatar_data do desktop). */
export function formatarData(s) {
  if (!s || s === 'NA') return '';
  return /^\d{8}$/.test(s) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : s;
}

export function videoNoPeriodo(uploadDate, inicio, fim) {
  if (!inicio && !fim) return true;
  const raw = String(uploadDate || '').trim();
  if (!/^\d{8}$/.test(raw)) return false;
  const d = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return !((inicio && d < inicio) || (fim && d > fim));
}

export function gerarFontes(canalUrl) {
  const base = canalUrl.replace(/\/+$/, '');
  return [
    { aba: 'Videos', url: `${base}/videos`, is_playlist: false },
    { aba: 'Shorts', url: `${base}/shorts`, is_playlist: false },
    { aba: 'Ao_Vivo', url: `${base}/streams`, is_playlist: false },
    { aba: 'Podcasts', url: `${base}/podcasts`, is_playlist: false },
    { aba: 'Cursos', url: `${base}/courses`, is_playlist: false },
    { aba: 'Playlists', url: `${base}/playlists`, is_playlist: true },
  ];
}

const contarPalavras = (t) => (t.match(/\S+/g) || []).length;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export class Motor {
  /**
   * @param raiz pasta que contém data/
   * @param aoConcluir callback(prefixo) depois de cada canal (reindexação)
   */
  constructor(raiz, { aoConcluir, ytdlp } = {}) {
    this.raiz = raiz;
    this.c = caminhos(raiz);
    this.ytdlp = ytdlp || new YtDlp(this.c.bin);
    this.aoConcluir = aoConcluir;
    this.is_running = false;
    this.is_paused = false;
    this.canal_url = '';
    this.projeto_nome = '';
    this.filtros = { fontes: [], playlists: [], data_inicio: '', data_fim: '' };
    this.stats = statsIniciais();
    this.logs = [];
    this.cancelar = false;
    this._retomar = null;
    this._inicio = 0;
    this._relogioOcioso = null;
    this.fila = lerJson(this.c.fila, []);
    if (!Array.isArray(this.fila)) this.fila = [];
    this.execucao = Promise.resolve();
  }

  // ── Log e eventos (LogRedirector + AppState.dispatch_event) ───────────────

  log(mensagem) {
    const texto = String(mensagem).trim();
    if (!texto) return;
    this.logs.push({ timestamp: horaCurta(), message: texto, canal: this.stats.projeto_nome || '' });
    if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000);
  }

  evento(nome, dados = {}) {
    const s = this.stats;
    if (nome === 'video_processed') {
      s.videos_processed++;
      if (s.videos_total > 0) s.progress = Math.min(Math.floor((s.videos_processed / s.videos_total) * 100), 99);
      const decorrido = (Date.now() - this._inicio) / 1000;
      s.eta_segundos = s.videos_processed > 0 && s.videos_total > 0 && decorrido > 0
        ? Math.floor((s.videos_total - s.videos_processed) / (s.videos_processed / decorrido)) : 0;
    } else if (nome === 'file_generated') s.files_generated++;
    else if (nome === 'video_sem_legenda') s.videos_sem_legenda++;
    else if (nome === 'video_legenda_curta') s.videos_legenda_curta++;
    else if (nome === 'videos_mapeados') { s.videos_mapeados = dados.total || 0; s.status = 'Mapeando YouTube'; }
    else if (nome === 'videos_total') {
      s.videos_total = dados.total || 0; s.videos_mapeados = s.videos_total; s.status = 'Extraindo legendas';
    } else if (nome === 'idioma_detectado') s.idioma_detectado = dados.idioma || '';
  }

  // ── GET /status ───────────────────────────────────────────────────────────

  status() {
    const stats = { ...this.stats };
    if (!this.is_running) {
      stats.files_generated = contarArquivosYoutube(this.raiz);
      stats.projeto_nome = '';
    }
    return {
      is_running: this.is_running,
      is_paused: this.is_paused,
      canal_url: this.canal_url,
      drive_status: 'indisponivel',
      drive_auth_error: null,
      stats,
      logs: this.logs.slice(-50),
    };
  }

  limparLog() {
    this.logs = [];
    return { ok: true };
  }

  // ── Rotas de controle (router_extraction.py) ──────────────────────────────

  definirCanal({ canal_url: url = '', projeto_nome: nome = '' } = {}) {
    if (this.is_running) return { message: t('Não é possível alterar o canal durante a execução'), error: true };
    const u = String(url).trim();
    if (u && !URL_CANAL.test(u)) return { error: true, message: t('URL inválida. Use o formato: https://www.youtube.com/@canal') };
    this.canal_url = u;
    this._aplicarProjeto(u, nome);
    return { message: 'Canal configurado', canal_nome: this.stats.projeto_nome };
  }

  _aplicarProjeto(url, nome) {
    if (nome && String(nome).trim()) {
      this.stats.projeto_nome = String(nome).trim();
      this.projeto_nome = sanitizarNome(String(nome).slice(0, 120), '');
    } else {
      const m = url.match(/@([^/?\s]+)/);
      this.stats.projeto_nome = m ? m[1] : url.replace(/\/+$/, '').split('/').at(-1);
      this.projeto_nome = '';
    }
  }

  iniciar({ fontes = [], playlists = [], data_inicio = '', data_fim = '' } = {}) {
    if (!this.canal_url) return { message: t('Configure a URL do canal antes de iniciar'), error: true };
    if (this.is_running) return { message: t('Motor já está rodando') };
    this.stats.status = 'Iniciando';
    this.filtros = { fontes: arr(fontes), playlists: arr(playlists), data_inicio: dataOk(data_inicio), data_fim: dataOk(data_fim) };
    this.cancelar = false;
    this._liberarPausa();
    this.is_paused = false;
    this.is_running = true; // marca já, para a tela não ver um "ocioso" entre o clique e o início
    this.execucao = this._rodar();
    return { message: 'Motor iniciado' };
  }

  pausar() {
    if (!this.is_running) return { message: t('Motor não está rodando') };
    if (!this.is_paused) {
      this.is_paused = true;
      this.stats.status = 'Em Pausa';
      this._pausa = new Promise((r) => { this._retomar = r; });
      return { message: 'Pausado' };
    }
    this._liberarPausa();
    this.stats.status = 'Minerando YouTube';
    return { message: 'Retomado' };
  }

  _liberarPausa() {
    this.is_paused = false;
    this._retomar?.();
    this._retomar = null;
    this._pausa = null;
  }

  cancelarExtracao() {
    if (!this.is_running) return { message: t('Motor não está rodando') };
    this.cancelar = true;
    this._liberarPausa();
    this.stats.status = 'Cancelando...';
    return { message: 'Cancelando' };
  }

  // ── Fila ──────────────────────────────────────────────────────────────────

  _salvarFila() {
    salvarJson(this.c.fila, this.fila);
  }

  filaStatus() {
    return { queue: [...this.fila] };
  }

  filaAdicionar({ canal_url: url = '', fontes = [], projeto_nome = '', playlists = [], data_inicio = '', data_fim = '' } = {}) {
    const u = String(url).trim();
    if (!u || !URL_CANAL.test(u)) return { error: true, message: t('URL inválida. Use o formato: https://www.youtube.com/@canal') };
    this.fila.push({
      url: u, fontes: arr(fontes), projeto_nome: String(projeto_nome || '').slice(0, 120),
      playlists: arr(playlists), data_inicio: dataOk(data_inicio), data_fim: dataOk(data_fim),
    });
    this._salvarFila();
    return { ok: true, queue_size: this.fila.length };
  }

  filaLimpar() {
    this.fila = [];
    this._salvarFila();
    return { ok: true };
  }

  filaRemover(indice) {
    const i = Number(indice);
    if (!Number.isInteger(i) || i < 0 || i >= this.fila.length) return { error: true, message: t('Índice fora do intervalo') };
    this.fila.splice(i, 1);
    this._salvarFila();
    return { ok: true };
  }

  filaMover({ from_index: de, to_index: para } = {}) {
    const n = this.fila.length;
    if (![de, para].every((x) => Number.isInteger(x) && x >= 0 && x < n)) return { error: true, message: t('Índice fora do intervalo') };
    const [item] = this.fila.splice(de, 1);
    this.fila.splice(para, 0, item);
    this._salvarFila();
    return { ok: true };
  }

  /**
   * Para a IA: começa agora se o motor estiver livre, senão entra na fila.
   * Aceita canal (@handle, /channel/, /c/) e também vídeo ou playlist avulsos.
   */
  extrairOuEnfileirar({ url, projeto_nome = '', fontes = [], maxVideos = null }) {
    const u = String(url).trim();
    const item = { url: u, fontes: arr(fontes), projeto_nome, playlists: [], data_inicio: '', data_fim: '', max_videos: maxVideos };
    if (this.is_running) {
      this.fila.push(item);
      this._salvarFila();
      return { enfileirado: true, posicao: this.fila.length };
    }
    this.canal_url = u;
    this._aplicarProjeto(u, projeto_nome);
    this.filtros = { fontes: item.fontes, playlists: [], data_inicio: '', data_fim: '', max_videos: maxVideos };
    this.cancelar = false;
    this._liberarPausa();
    this.is_running = true;
    this.stats.status = 'Iniciando';
    this.execucao = this._rodar();
    return { enfileirado: false };
  }

  // ── Execução (run_motor) ──────────────────────────────────────────────────

  async _rodar() {
    clearTimeout(this._relogioOcioso);
    for (;;) {
      this.is_running = true;
      this.stats = { ...statsIniciais(), projeto_nome: this.stats.projeto_nome, status: 'Mapeando YouTube' };
      this.logs = [];
      this._inicio = Date.now();
      let prefixo = null;
      try {
        prefixo = await this.extrair({
          canalUrl: this.canal_url, projetoNome: this.projeto_nome, ...this.filtros,
        });
        if (this.cancelar) this.stats.status = 'Interrompido';
        else { this.stats.status = 'Finalizado ✓'; this.stats.progress = 100; }
      } catch (e) {
        this.log(`❌ ERRO NO MOTOR: ${e.message}`);
        this.stats.status = 'Erro';
      } finally {
        this.is_running = false;
        this.is_paused = false;
        if (prefixo && this.aoConcluir) {
          try { await this.aoConcluir(prefixo); } catch (e) { this.log(t('⚠️ Índice de busca não atualizado: {message}', { message: e.message })); }
        }
      }

      const proximo = this.fila.shift();
      this._salvarFila();
      if (!proximo) {
        this._relogioOcioso = setTimeout(() => {
          if (!this.is_running) { this.stats.status = 'Ocioso'; this.stats.progress = 0; }
        }, 15_000);
        this._relogioOcioso.unref?.();
        return;
      }
      this.canal_url = proximo.url;
      this._aplicarProjeto(proximo.url, proximo.projeto_nome);
      this.stats.status = 'Na fila';
      this.filtros = {
        fontes: arr(proximo.fontes), playlists: arr(proximo.playlists),
        data_inicio: proximo.data_inicio || '', data_fim: proximo.data_fim || '', max_videos: proximo.max_videos || null,
      };
      this.cancelar = false;
      this._liberarPausa();
    }
  }

  // ── tusab_engine() ────────────────────────────────────────────────────────

  async extrair({ canalUrl, projetoNome = '', fontes = [], playlists = [], data_inicio = '', data_fim = '', max_videos = null }) {
    const ehCanal = URL_CANAL.test(canalUrl);
    let canalNomeRaw = extrairNomeCanal(canalUrl);
    if (!/@([^/?\s]+)/.test(canalUrl)) {
      const resolvido = await this.ytdlp.resolverNomeCanal(canalUrl);
      if (resolvido) canalNomeRaw = resolvido;
    }
    const canalNome = sanitizarNome(canalNomeRaw);
    const prefixo = projetoNome ? sanitizarNome(projetoNome) : canalNome;
    const canalDir = pastaYoutubeCanal(this.raiz, prefixo, canalNome);
    const dbFile = path.join(pastaGestao(this.raiz, prefixo), `${canalNome}_base.csv`);

    await this.ytdlp.preparar((m) => this.log(m));
    this.log(SEP);
    this.log('🧠 Tusab — Indexe. Aprenda. Consulte.');
    this.log(`   Canal: ${canalUrl}`);
    this.log(`   Prefixo: ${prefixo}`);
    this.log(SEP);
    for (const d of [canalDir, this.c.temp, this.c.config]) fs.mkdirSync(d, { recursive: true });

    this.log(t('📋 Coletando metadados do canal...'));
    const metaCanal = await this._metaCanal(canalUrl, canalNomeRaw, canalNome, canalDir);

    let lista = ehCanal ? gerarFontes(canalUrl) : [{ aba: 'Avulsos', url: canalUrl, is_playlist: false }];
    if (fontes.length) {
      lista = lista.filter((f) => fontes.includes(f.aba));
      this.log(`🎯 Fontes selecionadas: ${JSON.stringify(lista.map((f) => f.aba))}`);
    }
    if (playlists.length) this.log(t('🎯 Playlist(s) específica(s) selecionada(s): {length}', { length: playlists.length }));
    if (data_inicio || data_fim) this.log(t('📅 Filtro de data ativo: de {inicio} até {fim}', { inicio: data_inicio || '...', fim: data_fim || t('hoje') }));

    // 1. Mapeamento
    const todos = [];
    const ids = new Set();
    const titulos = new Set();
    const acrescentar = (linha, aba) => {
      const p = linha.split('|||');
      if (p.length < 4) return false;
      const [vid, data, views] = p;
      const titulo = p.slice(3).join('|||').trim();
      if (!vid || vid.length !== 11 || PREFIXOS_NAO_VIDEO.includes(vid.slice(0, 2))) return false;
      if (ids.has(vid)) return false;
      if (data.trim() === 'NA' && titulo && titulos.has(titulo)) return false;
      todos.push({ id: vid, date: formatarData(data.trim()), views: views.trim(), title: titulo, aba });
      ids.add(vid);
      if (titulo) titulos.add(titulo);
      return true;
    };

    this.log(t('📡 Mapeando conteúdo do canal no YouTube...'));
    for (const fonte of lista) {
      if (this.cancelar) break;
      if (fonte.is_playlist) {
        const { playlists: pls } = await this.ytdlp.playlistsCanal(canalUrl);
        for (const pl of pls) {
          if (this.cancelar) break;
          if (playlists.length && !playlists.includes(pl.id)) continue;
          let novos = 0;
          const r = await this.ytdlp.mapear(`https://www.youtube.com/playlist?list=${pl.id}`);
          for (const l of r.saida.split(/\r?\n/)) if (acrescentar(l, `Playlist: ${pl.titulo}`)) novos++;
          if (novos > 0) {
            this.log(t('   📋 Playlist "{titulo}": {novos} vídeos mapeados ({length} no total)', { titulo: pl.titulo, novos, length: todos.length }));
            this.evento('videos_mapeados', { total: todos.length });
          }
        }
      } else {
        let novos = 0;
        await this.ytdlp.mapear(fonte.url, (l) => {
          if (acrescentar(l, fonte.aba)) {
            novos++;
            if (novos % 50 === 0) this.evento('videos_mapeados', { total: todos.length });
          }
        });
        if (novos > 0) {
          this.log(t('   📋 {aba}: {novos} vídeos mapeados ({length} no total)', { aba: fonte.aba, novos, length: todos.length }));
          this.evento('videos_mapeados', { total: todos.length });
        }
      }
    }

    let videos = todos;
    if ((data_inicio || data_fim) && !this.cancelar) {
      this.log(t('📅 Filtro de data ativo — verificando data real de {length} vídeo(s) mapeado(s)...', { length: videos.length }));
      const aprovados = await this._filtrarPorData(videos.map((v) => v.id), data_inicio, data_fim);
      videos = videos.filter((v) => aprovados.has(v.id));
      this.log(t('📅 {length} vídeo(s) dentro do período pedido.', { length: videos.length }));
    }
    if (max_videos) videos = videos.slice(0, max_videos);
    const total = videos.length;
    this.log(t('✅ {total} vídeos mapeados no canal.', { total }));
    this.evento('videos_total', { total });

    // Resumo (total mapeado, URLs, último filtro)
    const sumarioPath = dbFile.replace(/_base\.csv$/, '_summary.json');
    const sumario = lerJson(sumarioPath, {}) || {};
    sumario.total_mapeado = total;
    sumario.canal_nome_canal = canalNome;
    sumario.canal_urls = [...new Set([...(sumario.canal_urls || []), canalUrl])];
    sumario.canal_url = canalUrl;
    const agora = new Date();
    sumario.ultimo_filtro = {
      playlists: playlists, data_inicio: data_inicio || '', data_fim: data_fim || '',
      em: `${dataBr(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
    };
    salvarJson(sumarioPath, sumario);

    // 2. Banco local: auditoria CSV × TXT
    const prefixoParte = `${canalNome}_Parte_`;
    const partesExistentes = fs.readdirSync(canalDir).filter((f) => f.startsWith(prefixoParte) && f.endsWith('.txt'));
    const idsNosTxts = new Set();
    for (const f of partesExistentes) {
      const texto = fs.readFileSync(path.join(canalDir, f), 'utf8');
      for (const m of texto.matchAll(/LINK: https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g)) idsNosTxts.add(m[1]);
    }
    const csv = lerCsv(dbFile);
    const colunas = csv.colunas.length ? [...csv.colunas] : [...COLUNAS_BASE];
    for (const col of ['Local', 'Status']) if (!colunas.includes(col)) colunas.push(col);
    let linhas = csv.linhas.map((l) => ({ Local: 'Desconhecido', Status: 'Sucesso', ...l }));
    let atualizou = false;
    if (colunas.includes('Playlist')) {
      linhas = linhas.map(({ Playlist, ...l }) => ({ ...l, Aba: l.Aba || `Playlist: ${Playlist}` }));
      colunas.splice(colunas.indexOf('Playlist'), 1);
      atualizou = true;
    }
    const idsNaPlanilha = new Set(linhas.map((l) => l.ID).filter(Boolean));
    const minerados = new Set();
    for (const l of linhas) {
      const st = (l.Status || 'Sucesso').trim() || 'Sucesso';
      if (st === 'Sucesso' && !idsNosTxts.has(l.ID)) {
        this.log(t('      ⚠️ Inconsistência: {v} no CSV mas não no TXT. Rebaixando status.', { v: String(l.ID).slice(0, 8) }));
        l.Status = 'Arquivo Ausente';
        atualizou = true;
      } else minerados.add(l.ID);
    }
    for (const vid of idsNosTxts) {
      if (idsNaPlanilha.has(vid)) continue;
      minerados.add(vid);
      const info = todos.find((v) => v.id === vid);
      if (info) {
        linhas.push({
          ID: vid, Data_Pub: info.date, Link: `https://www.youtube.com/watch?v=${vid}`, Titulo: info.title,
          Aba: info.aba, Views: info.views, Local: 'Recuperado', Status: 'Sucesso', Data_Extracao: dataIso(),
        });
        atualizou = true;
      }
    }
    const gravarCsv = () => salvarCsv(dbFile, colunas, linhas);
    if (atualizou || !fs.existsSync(dbFile)) gravarCsv();

    // Retomar a última parte
    let parte = 1;
    let palavras = 0;
    const numeros = partesExistentes.map((f) => Number(f.match(/Parte_(\d+)/)?.[1])).filter(Boolean);
    if (numeros.length) {
      parte = Math.max(...numeros);
      palavras = contarPalavras(fs.readFileSync(path.join(canalDir, `${prefixoParte}${parte}.txt`), 'utf8'));
    }
    let arquivoTxt = path.join(canalDir, `${prefixoParte}${parte}.txt`);

    const pendentes = videos.filter((v) => !minerados.has(v.id)).length;
    this.log(t('🚜 Iniciando extração — {pendentes} vídeos inéditos na fila...', { pendentes }));

    // 3. Extração local
    for (let i = 0; i < videos.length; i++) {
      if (this.cancelar) { this.log(t('🛑 Cancelamento recebido. Encerrando extração com segurança...')); break; }
      if (this._pausa) {
        this.log('⏸️ Motor em pausa. Aguardando retomada...');
        await this._pausa;
        if (this.cancelar) { this.log('🛑 Cancelamento recebido durante pausa. Abortando...'); break; }
        this.log('▶️ Motor retomado!');
      }
      const video = videos[i];
      const vid = video.id;
      const link = `https://www.youtube.com/watch?v=${vid}`;
      if (['[Private video]', '[Deleted video]'].includes(video.title) || minerados.has(vid)) continue;

      this.log(`[${i + 1}/${total}] 🎬 Extraindo: ${video.title.slice(0, 55)}...`);
      const registrar = (status, local, dataPub) => {
        linhas.push({
          ID: vid, Data_Pub: dataPub, Link: link, Titulo: video.title, Aba: video.aba,
          Views: video.views, Local: local, Status: status, Data_Extracao: dataIso(),
        });
        minerados.add(vid);
        gravarCsv();
      };
      try {
        const { meta, vtt, idioma, aviso } = await this.ytdlp.legendaEMetadados(vid, this.c.temp);
        if (aviso) this.log(`      ⚠️ yt-dlp: ${aviso.slice(0, 120)}`);
        if (idioma && !this.stats.idioma_detectado) this.evento('idioma_detectado', { idioma });
        const dataReal = /^\d{8}$/.test(meta.upload_date || '') ? formatarData(meta.upload_date) : video.date;
        const tags = Array.isArray(meta.tags) ? meta.tags.filter(Boolean).map((t) => String(t).trim()).join(',') : '';
        const desc = typeof meta.description === 'string' && !['NA', 'None'].includes(meta.description)
          ? meta.description.slice(0, 500).replace(/\n/g, ' ').trim() : '';
        const capitulos = Array.isArray(meta.chapters) && meta.chapters.length > 1
          ? meta.chapters.filter((c) => c && typeof c === 'object').map((c) => ({ start_time: c.start_time || 0, title: c.title || '' }))
          : [];

        if (!vtt) {
          registrar('Sem Legenda', 'N/A', dataReal);
          this.log(t('      ⚠️ Ignorado: Sem legenda em português.'));
          this.evento('video_sem_legenda');
        } else {
          const segmentos = porCapitulo(vtt, capitulos);
          const textoTotal = segmentos.map((s) => s.texto).join(' ');
          if (textoTotal.length <= 150) {
            registrar('Legenda Curta', 'N/A', dataReal);
            this.log('      ⚠️ Ignorado: Legenda muito curta.');
            this.evento('video_legenda_curta');
          } else {
            const n = contarPalavras(textoTotal);
            if (palavras + n > MAX_PALAVRAS_POR_ARQUIVO) {
              parte++;
              palavras = 0;
              arquivoTxt = path.join(canalDir, `${prefixoParte}${parte}.txt`);
              this.log(`      📂 NOVO ARQUIVO: Parte ${parte} iniciada.`);
              this.evento('file_generated');
            }
            const novo = !fs.existsSync(arquivoTxt);
            let saida = '';
            if (novo) {
              this.log(`      📂 NOVO ARQUIVO: ${path.basename(arquivoTxt)} criado.`);
              this.evento('file_generated');
              saida += '﻿# Tusab — Base de Conhecimento\n'
                + `# Canal: ${metaCanal.canal_nome} (${metaCanal.canal_handle})\n`
                + `# URL: ${canalUrl}\n`
                + (metaCanal.inscritos ? `# Inscritos: ${metaCanal.inscritos}\n` : '')
                + `# Extraído em: ${metaCanal.extraido_em}\n`
                + '# Todos os direitos do conteúdo pertencem ao criador original.\n'
                + `${SEP}\n\n`;
            }
            const comCapitulos = segmentos.length > 1;
            for (const seg of segmentos) {
              let titulo = comCapitulos && seg.capitulo ? `${video.title} — ${seg.capitulo}` : video.title;
              const totalPartes = seg.total_partes || 1;
              if (totalPartes > 1) titulo += ` (parte ${seg.parte}/${totalPartes})`;
              saida += `\n${SEP}\nTITULO: ${titulo}\nABA: ${video.aba}\nDATA: ${dataReal}\nLINK: ${link}\n`
                + `VIDEO_ID: ${vid}\nVIEWS: ${video.views || 0}\nTIMESTAMP_INICIO: ${seg.timestamp_inicio}\n`
                + (totalPartes > 1 ? `PARTE: ${seg.parte}\nTOTAL_PARTES: ${totalPartes}\n` : '')
                + `TAGS: ${tags}\nDESCRICAO: ${desc}\n${'-'.repeat(70)}\nCONTEUDO:\n${seg.texto}\n${SEP}\n`;
            }
            fs.appendFileSync(arquivoTxt, saida, 'utf8');
            palavras += n;
            registrar('Sucesso', path.basename(arquivoTxt, '.txt'), dataReal);
            this.log(`      ✅ OK! (${dataReal})`);
            this.evento('video_processed');
          }
        }
        await dormir(1000);
      } catch (e) {
        this.log(t('      ❌ Erro: {message}', { message: e.message }));
        registrar('Falha Extração', 'N/A', video.date);
      }
    }

    this.log(t('      📁 Transcrições salvas localmente.'));
    this.log(t('      📊 Banco de dados salvo em: neural/{prefixo}/management/', { prefixo }));
    if (this.cancelar) {
      this.log('⚠️ PROCESSO INTERROMPIDO — Dados parciais salvos localmente.');
      return prefixo;
    }
    this.log(t('✅ EXTRAÇÃO LOCAL CONCLUÍDA COM SUCESSO!'));
    this.log('🚀 PROCESSO Tusab FINALIZADO COM SUCESSO!');
    return prefixo;
  }

  async _metaCanal(canalUrl, canalNomeRaw, canalNome, canalDir) {
    const metaPath = path.join(canalDir, `${canalNome}_meta.json`);
    try {
      const idadeDias = (Date.now() - fs.statSync(metaPath).mtimeMs) / 86_400_000;
      if (idadeDias < 7) {
        const meta = lerJson(metaPath);
        if (meta) {
          this.log(`      📋 Canal: ${meta.canal_nome || canalNomeRaw} ${meta.canal_handle || ''} (cache)`);
          return meta;
        }
      }
    } catch { /* sem cache */ }
    const meta = {
      canal_nome: canalNomeRaw, canal_handle: `@${canalNomeRaw}`, canal_url: canalUrl, inscritos: '', extraido_em: dataBr(),
    };
    const { nome, handle, seguidores } = await this.ytdlp.metaCanal(canalUrl);
    if (nome && !['NA', 'None'].includes(nome)) meta.canal_nome = nome;
    if (handle && handle !== 'NA') meta.canal_handle = handle.startsWith('@') ? handle : `@${handle}`;
    if (/^\d+$/.test(seguidores || '')) {
      const n = Number(seguidores);
      meta.inscritos = n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.floor(n / 1e3)}K` : String(n);
    }
    salvarJson(metaPath, meta, 2);
    this.log(`      📋 Canal: ${meta.canal_nome} ${meta.canal_handle}${meta.inscritos ? ` · ${meta.inscritos} inscritos` : ''}`);
    return meta;
  }

  async _filtrarPorData(ids, inicio, fim) {
    const lotes = [];
    for (let i = 0; i < ids.length; i += 50) lotes.push(ids.slice(i, i + 50));
    const aprovados = new Set();
    let verificados = 0;
    let proximo = 0;
    const trabalhador = async () => {
      while (proximo < lotes.length && !this.cancelar) {
        const lote = lotes[proximo++];
        for (const [id, data] of await this.ytdlp.datasReais(lote)) if (videoNoPeriodo(data, inicio, fim)) aprovados.add(id);
        verificados += lote.length;
        this.log(t('   📅 Datas verificadas: {verificados}/{length} ({size} dentro do período até agora)', { verificados, length: ids.length, size: aprovados.size }));
        this.evento('videos_mapeados', { total: verificados });
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, lotes.length) }, trabalhador));
    return aprovados;
  }
}

function arr(v) {
  return Array.isArray(v) ? v.map(String).slice(0, 500) : [];
}

function dataOk(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
}
