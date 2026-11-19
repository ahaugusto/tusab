// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Atualização automática de canais — porte de tusab_engine/motor/auto_update.py e das
// rotas /auto-update/* de router_extraction.py.
//
// Configuração por canal: igual ao desktop, em
//   data/neural/{projeto}/management/{canal}_summary.json → "auto_update": { enabled, frequencia, fontes }
// (o desktop e a extensão leem e gravam o mesmo arquivo, então a escolha vale nos dois).
// Quando foi a última verificação: data/config/auto_update.json (no desktop, agent_config.json):
//   { "auto_update_ultima_verificacao": <s>, "ultima_verificacao": { "{projeto}/{canal}": <s> } }
//
// Verificar = listar os vídeos das abas do canal com o yt-dlp (--flat-playlist, só metadados)
// e comparar com o CSV de gestão. Havendo vídeo novo, o canal vai para o motor que já existe:
// começa agora se ele estiver livre, senão entra na fila.

import fs from 'node:fs';
import path from 'node:path';
import { caminhos, lerJson, salvarJson, sanitizarNome } from './caminhos.js';
import { lerCsv } from './gestao.js';
import { gerarFontes } from './motor.js';
import { URL_CANAL } from './ytdlp.js';
import { t } from './idioma.js';

export const FREQ_SEGUNDOS = {
  ao_abrir: 0, // sempre que o plugin abre
  diario: 86400,
  semanal: 604800,
  mensal: 2592000,
};
const CHAVE_GERAL = 'auto_update_ultima_verificacao';
const PREFIXOS_NAO_VIDEO = ['PL', 'UU', 'FL', 'RD', 'OL'];
const TITULOS_IGNORADOS = new Set(['[Private video]', '[Deleted video]']); // o motor também os pula
const URL_AVULSA = /^https:\/\/(www\.)?youtube\.com\/(playlist\?list=[A-Za-z0-9_-]{10,64}|watch\?v=[A-Za-z0-9_-]{11})$/;
const URL_INVALIDA = 'URL inválida. Use o formato: https://www.youtube.com/@canal';

export const urlAceita = (u) => URL_CANAL.test(u) || URL_AVULSA.test(u);

/** O que se pode usar como nome de pasta (o desktop não confere: aqui não sai de data/neural/). */
function nomePasta(nome) {
  return sanitizarNome(String(nome ?? '').trim().slice(0, 120), '');
}

function freqValida(f) {
  return Object.hasOwn(FREQ_SEGUNDOS, f) ? f : 'semanal';
}

export class Atualizacao {
  /**
   * @param raiz pasta que contém data/
   * @param motor instância de Motor (src/nucleo/motor.js)
   * @param opcoes.agora relógio em ms (testes)
   */
  constructor(raiz, motor, { agora = () => Date.now() } = {}) {
    this.raiz = raiz;
    this.motor = motor;
    this.agora = agora;
    this.c = caminhos(raiz);
    this.arquivoEstado = path.join(this.c.config, 'auto_update.json');
    this.verificando = false;
    this.execucao = Promise.resolve([]);
    this._verificadosNaSessao = new Set(); // 'ao_abrir': uma vez por abertura do plugin
    this._primeira = true;
    this._relogioInicial = null;
    this._relogio = null;
  }

  // ── Caminhos e estado ─────────────────────────────────────────────────────

  _sumario(projeto, canal) {
    return path.join(this.c.neural, projeto, 'management', `${canal}_summary.json`);
  }

  _estado() {
    const e = lerJson(this.arquivoEstado, {});
    const estado = e && typeof e === 'object' && !Array.isArray(e) ? e : {};
    if (!estado.ultima_verificacao || typeof estado.ultima_verificacao !== 'object') estado.ultima_verificacao = {};
    return estado;
  }

  _registrar(chaves) {
    const estado = this._estado();
    const agora = this.agora() / 1000;
    for (const k of chaves) estado.ultima_verificacao[k] = agora;
    estado[CHAVE_GERAL] = agora;
    salvarJson(this.arquivoEstado, estado, 2);
  }

  // ── POST /auto-update/config ──────────────────────────────────────────────

  /**
   * Corpo: { canal_prefixo, projeto_prefixo, enabled, frequencia='semanal', fontes=[], canal_url='' }.
   * @returns {{ok:true}} | {{error:true, message}}
   */
  salvarConfig(corpo = {}) {
    const canal = nomePasta(corpo.canal_prefixo);
    let projeto = nomePasta(corpo.projeto_prefixo);
    if (!canal || typeof corpo.enabled !== 'boolean') {
      return { error: true, message: 'Informe canal_prefixo, projeto_prefixo e enabled.' };
    }
    if (!projeto) projeto = this._localizarProjeto(canal) || canal;
    const canalUrl = String(corpo.canal_url || '').trim();
    if (canalUrl && !urlAceita(canalUrl)) return { error: true, message: URL_INVALIDA };

    const destino = this._sumario(projeto, canal);
    const atual = lerJson(destino, {});
    const sumario = atual && typeof atual === 'object' && !Array.isArray(atual) ? atual : {};
    if (canalUrl) sumario.canal_url = canalUrl;
    sumario.auto_update = {
      enabled: corpo.enabled,
      frequencia: freqValida(corpo.frequencia ?? 'semanal'),
      fontes: Array.isArray(corpo.fontes) ? corpo.fontes.map(String).slice(0, 20) : [],
    };
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    salvarJson(destino, sumario, 2);
    return { ok: true };
  }

  // ── GET /auto-update/config/{canal_prefixo}?projeto_prefixo= ──────────────

  lerConfig(canalPrefixo, projetoPrefixo = '') {
    const canal = nomePasta(canalPrefixo);
    const projeto = nomePasta(projetoPrefixo);
    const ler = (p) => {
      const s = lerJson(p, null);
      return s && typeof s === 'object' && s.auto_update != null ? s.auto_update : null;
    };
    if (!canal) return { auto_update: { enabled: false } };
    if (projeto) return { auto_update: ler(this._sumario(projeto, canal)) ?? { enabled: false } };
    for (const p of this._projetos()) {
      const cfg = ler(this._sumario(p, canal));
      if (cfg) return { auto_update: cfg };
    }
    return { auto_update: { enabled: false } };
  }

  _projetos() {
    try {
      return fs.readdirSync(this.c.neural, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      return [];
    }
  }

  _localizarProjeto(canal) {
    return this._projetos().find((p) => fs.existsSync(this._sumario(p, canal))) || '';
  }

  // ── POST /auto-update/run ─────────────────────────────────────────────────

  /** Verificação imediata de todos os canais ativos, em segundo plano (ignora a frequência, como o desktop). */
  executar() {
    if (this.motor.is_running) {
      return { error: true, message: t('Extração em andamento. Aguarde para verificar atualizações.') };
    }
    if (this.verificando) return { ok: true, message: t('Verificação já em andamento') };
    this.execucao = this.verificar({ manual: true }).then((novos) => {
      if (novos.length) this.motor.log(t('🔄 Auto-update manual: {length} canal(is) com novos vídeos enfileirado(s)', { length: novos.length }));
      else this.motor.log(t('✅ Auto-update manual: todos os canais estão atualizados'));
      return novos;
    }, (e) => {
      this.motor.log(t('⚠️  Auto-update manual: erro — {message}', { message: e.message }));
      return [];
    });
    return { ok: true, message: t('Verificação iniciada em background') };
  }

  // ── Verificação ───────────────────────────────────────────────────────────

  /** Canais com auto_update ligado: { projeto, canal, canal_urls, fontes, frequencia, chave }. */
  canaisAtivos() {
    const resultado = [];
    for (const projeto of this._projetos()) {
      const gestao = path.join(this.c.neural, projeto, 'management');
      let nomes = [];
      try { nomes = fs.readdirSync(gestao).filter((n) => n.endsWith('_summary.json')).sort(); } catch { continue; }
      for (const n of nomes) {
        const canal = n.replace(/_summary\.json$/, '');
        const sumario = lerJson(path.join(gestao, n), null);
        const au = sumario?.auto_update;
        if (!au?.enabled) continue;
        const urls = Array.isArray(sumario.canal_urls) && sumario.canal_urls.length ? sumario.canal_urls : [sumario.canal_url];
        resultado.push({
          projeto,
          canal,
          canal_urls: [...new Set(urls.filter((u) => typeof u === 'string' && urlAceita(u.trim())).map((u) => u.trim()))],
          fontes: Array.isArray(au.fontes) ? au.fontes.map(String) : [],
          frequencia: freqValida(au.frequencia ?? 'semanal'),
          chave: `${projeto}/${canal}`,
        });
      }
    }
    return resultado;
  }

  /** Se o canal deve ser verificado agora (verificação agendada). */
  _naHora(item, estado) {
    const intervalo = FREQ_SEGUNDOS[item.frequencia];
    if (intervalo === 0) return !this._verificadosNaSessao.has(item.chave);
    const ultima = Number(estado.ultima_verificacao[item.chave]) || 0;
    return this.agora() / 1000 - ultima >= intervalo;
  }

  /** IDs que já estão no CSV de gestão (coluna Link, como o desktop, e coluna ID). */
  _idsLocais(projeto, canal) {
    const { linhas } = lerCsv(path.join(this.c.neural, projeto, 'management', `${canal}_base.csv`));
    const ids = new Set();
    for (const l of linhas) {
      const m = String(l.Link || '').match(/[?&]v=([A-Za-z0-9_-]{11})/);
      if (m) ids.add(m[1]);
      if (/^[A-Za-z0-9_-]{11}$/.test(l.ID || '')) ids.add(l.ID);
    }
    return ids;
  }

  /** IDs dos vídeos publicados (só metadados). null = não deu para acessar. */
  async _idsRemotos(url, fontes) {
    let alvos;
    if (URL_CANAL.test(url)) {
      const abas = gerarFontes(url).filter((f) => !f.is_playlist);
      alvos = fontes.length ? abas.filter((f) => fontes.includes(f.aba)) : abas;
      if (!alvos.length) alvos = abas.filter((f) => f.aba === 'Videos');
    } else {
      alvos = [{ url }];
    }
    const ids = new Set();
    let acessou = false;
    for (const alvo of alvos) {
      // Mesmo comando de Motor.extrair → YtDlp.mapear, com tempo-limite.
      const r = await this.motor.ytdlp.rodar([
        '--flat-playlist', '--ignore-errors', '--extractor-args', 'youtube:lang=pt',
        '--print', '%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s', alvo.url,
      ], { tempoLimite: 300_000 });
      if (r.codigo === 0) acessou = true;
      for (const linha of r.saida.split(/\r?\n/)) {
        const p = linha.split('|||');
        if (p.length < 4) continue;
        const vid = p[0].trim();
        const titulo = p.slice(3).join('|||').trim();
        if (vid.length !== 11 || PREFIXOS_NAO_VIDEO.includes(vid.slice(0, 2)) || TITULOS_IGNORADOS.has(titulo)) continue;
        ids.add(vid);
        acessou = true;
      }
    }
    return acessou ? ids : null;
  }

  _jaPedido(url, projeto) {
    const m = this.motor;
    if (m.is_running && m.canal_url === url && (m.projeto_nome || '') === projeto) return true;
    return m.fila.some((i) => i.url === url && sanitizarNome(String(i.projeto_nome || '').slice(0, 120), '') === projeto);
  }

  /**
   * Verifica os canais e manda os que têm vídeo novo para o motor.
   * @param manual true = todos os canais ativos; false = só os que estão na hora pela frequência
   * @returns lista "{projeto}/{canal}" dos que tinham vídeo novo
   */
  async verificar({ manual = false } = {}) {
    if (this.verificando) return [];
    this.verificando = true;
    try {
      const estado = this._estado();
      const ativos = this.canaisAtivos();
      const canais = manual ? ativos : ativos.filter((i) => this._naHora(i, estado));
      if (!manual && this._primeira && ativos.length && !canais.length) {
        this.motor.log(t('ℹ️  Auto-update: próxima verificação ainda não é a hora (frequência: {v})', { v: ativos[0].frequencia }));
      }
      this._primeira = false;
      const comNovos = [];
      const verificados = [];
      for (const item of canais) {
        const locais = this._idsLocais(item.projeto, item.canal);
        let temNovos = false;
        let acessou = false;
        for (const url of item.canal_urls) {
          this.motor.log(t('🔄 Auto-update: verificando {url} → projeto \'{projeto}\' / canal \'{canal}\'…', { url, projeto: item.projeto, canal: item.canal }));
          const remotos = await this._idsRemotos(url, item.fontes);
          if (!remotos) {
            this.motor.log(t('⚠️  Auto-update: não foi possível acessar {url} (sem conexão ou canal inválido)', { url }));
            continue;
          }
          acessou = true;
          const novos = [...remotos].filter((v) => !locais.has(v));
          if (!novos.length) {
            this.motor.log(t('✅ Auto-update: {url} já está atualizado ({size} vídeos)', { url, size: remotos.size }));
            continue;
          }
          temNovos = true;
          if (this._jaPedido(url, item.projeto)) {
            this.motor.log(t('ℹ️  Auto-update: {url} tem {length} vídeo(s) novo(s) e já está na fila de extração', { url, length: novos.length }));
            continue;
          }
          this.motor.log(t('🆕 Auto-update: {url} tem {length} vídeo(s) novo(s) — enfileirando extração', { url, length: novos.length }));
          // Livre: começa agora; ocupado: entra na fila do motor.
          this.motor.extrairOuEnfileirar({ url, projeto_nome: item.projeto, fontes: item.fontes });
        }
        if (acessou || !item.canal_urls.length) {
          verificados.push(item.chave);
          this._verificadosNaSessao.add(item.chave);
        }
        if (temNovos) comNovos.push(item.chave);
      }
      if (canais.length || manual) this._registrar(verificados);
      if (!manual && canais.length) {
        if (comNovos.length) this.motor.log(t('🔄 Auto-update: {length} canal(is) com novos vídeos enfileirado(s): {v}', { length: comNovos.length, v: comNovos.join(', ') }));
        else this.motor.log(t('✅ Auto-update: todos os canais estão atualizados'));
      }
      return comNovos;
    } finally {
      this.verificando = false;
    }
  }

  // ── Agendamento ───────────────────────────────────────────────────────────

  /** Uma rodada agendada: só com o motor livre (como o desktop); senão tenta na próxima. */
  async _rodada() {
    if (this.motor.is_running || this.verificando) return [];
    try {
      return await (this.execucao = this.verificar());
    } catch (e) {
      this.motor.log(t('⚠️  Auto-update: erro durante verificação — {message}', { message: e.message }));
      return [];
    }
  }

  /**
   * Verifica ao abrir (depois de `atrasoInicialMs`, como os 3 s do desktop) e de novo a cada
   * `intervaloMs` enquanto o plugin estiver aberto. Os timers não seguram o processo (unref).
   */
  iniciarAgendamento({ atrasoInicialMs = 3000, intervaloMs = 60 * 60 * 1000 } = {}) {
    this.pararAgendamento();
    this._relogioInicial = setTimeout(() => { this._rodada(); }, atrasoInicialMs);
    this._relogioInicial.unref?.();
    this._relogio = setInterval(() => { this._rodada(); }, intervaloMs);
    this._relogio.unref?.();
  }

  pararAgendamento() {
    clearTimeout(this._relogioInicial);
    clearInterval(this._relogio);
    this._relogioInicial = null;
    this._relogio = null;
  }
}
