// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de tusab_engine/motor/fontes/_base.py: helpers compartilhados por todos
// os adaptadores de fonte pública.
//
// Cada adaptador (openalex.js, europepmc.js, ...) só implementa a parte
// específica da API (montar a query, extrair {titulo, texto, url_origem} de um
// item bruto) — a parte comum (salvar .txt com cabeçalho padrão, atualizar
// manifest, throttle, cancelamento, progresso) vive aqui uma única vez.
//
// Mesmo contrato de arquivo/manifest do desktop: data/neural/{projeto}/documents/
// {id}_{nome}.txt com cabeçalho TITULO/FONTE/DATA/URL_ORIGEM + linha de 70 "-",
// e uma entrada por documento em _manifest.json.
//
// Contrato de um adaptador (equivale a {FONTE_META, buscar()} do Python):
//   export const FONTE_META = { id, nome, area, descricao, requer_auth, suporta_data, suporta_autor, ... }
//   export async function buscar({ query, max_resultados, projeto_nome, data_inicio, data_fim, autor,
//                                  evento_cancelar, dispatch_event, subfontes, raiz }) -> resultado
// `raiz` é a pasta que contém data/ (o NEURAL_DIR do Python sai de caminhos(raiz).neural).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { caminhos, dataBr, escreverAtomico, salvarJson } from '../nucleo/caminhos.js';
import { t } from '../nucleo/idioma.js';

export const MAX_RESULTADOS_PERMITIDO = 50;

// User-Agent identificado, o mesmo do desktop (testado ao vivo em 20/out/2026).
// Algumas instituições bloqueiam o UA genérico E o de navegador, mas aceitam um
// robô que se identifica — ex.: WHO IRIS e PAHO IRIS. A URL de contato precisa
// vir com https://: sem ela, a Wikimedia passa a responder 429 depois de ~10
// chamadas. Não leva nenhum dado do usuário (só o endereço público do projeto).
export const HEADERS_TUSABBOT = { 'User-Agent': 'TusabBot/1.0 (+https://github.com/criaugu/tusab; local personal knowledge tool)' };

// Para as poucas fontes cujo firewall só aceita UA de navegador (ex.: TCU).
export const HEADERS_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

// Onde o Python não mandava cabeçalho (o requests usava "python-requests/x"),
// a extensão se identifica de forma genérica — nunca com dado do usuário.
export const USER_AGENT_PADRAO = 'Tusab/0.2 (+https://criaugu.github.io/tusab/)';

/** max(1, min(int(n), MAX_RESULTADOS_PERMITIDO)) */
export function limitarMax(n) {
  const v = Math.trunc(Number(n));
  return Math.max(1, Math.min(Number.isFinite(v) ? v : 1, MAX_RESULTADOS_PERMITIDO));
}

// ── Esperas (throttle) ───────────────────────────────────────────────────────
// Os testes zeram as esperas com configurarEsperas(0); em uso real o fator é 1.
const opcoes = { fatorEspera: 1 };

export function configurarEsperas(fator) {
  opcoes.fatorEspera = Number(fator) >= 0 ? Number(fator) : 1;
}

/** time.sleep(segundos) — respeita o fator de espera. */
export function dormir(segundos) {
  const ms = Math.max(0, Number(segundos) || 0) * 1000 * opcoes.fatorEspera;
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** Equivale ao threading.Event usado para cancelar a busca. */
export class EventoCancelar {
  constructor() {
    this._ativo = false;
    this._esperas = new Set();
  }

  set() {
    this._ativo = true;
    for (const r of this._esperas) r(true);
    this._esperas.clear();
  }

  clear() {
    this._ativo = false;
  }

  is_set() {
    return this._ativo;
  }

  /** Event.wait(segundos): resolve true se foi sinalizado antes de acabar a espera. */
  wait(segundos) {
    if (this._ativo) return Promise.resolve(true);
    const ms = Math.max(0, Number(segundos) || 0) * 1000 * opcoes.fatorEspera;
    return new Promise((resolve) => {
      let timer = null;
      const fim = (v) => { clearTimeout(timer); this._esperas.delete(fim); resolve(v); };
      this._esperas.add(fim);
      timer = setTimeout(() => fim(this._ativo), ms);
    });
  }
}

// ── HTTP (o "requests" da extensão: fetch + AbortSignal.timeout) ─────────────

const MOTIVOS = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  408: 'Request Timeout', 410: 'Gone', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

/** requests.exceptions.HTTPError */
export class ErroHTTP extends Error {
  constructor(resposta) {
    const motivo = resposta.motivo || MOTIVOS[resposta.status] || '';
    const tipo = resposta.status >= 500 ? 'Server' : 'Client';
    super(`${resposta.status} ${tipo} Error: ${motivo} for url: ${resposta.url}`);
    this.name = 'HTTPError';
    this.response = resposta;
  }
}

/** requests.exceptions.Timeout */
export class ErroTimeout extends Error {
  constructor(url) {
    super(t('Tempo de resposta esgotado: {url}', { url }));
    this.name = 'ReadTimeout';
  }
}

/** requests.exceptions.ConnectionError (e demais falhas de rede) */
export class ErroConexao extends Error {
  constructor(url, causa) {
    super(t('Falha de conexão com {url}', { url }) + (causa?.message ? `: ${causa.message}` : ''));
    this.name = 'ConnectionError';
    this.cause = causa;
  }
}

/** Qualquer erro de requisição (requests.RequestException). */
export function ehErroRequisicao(e) {
  return e instanceof ErroHTTP || e instanceof ErroTimeout || e instanceof ErroConexao;
}

class Resposta {
  constructor(r, bytes) {
    this.status = r.status;
    this.motivo = r.statusText;
    this.url = r.url;
    this.headers = r.headers;
    this.conteudo = bytes;
    this.ok = r.status < 400;
    this._texto = null;
  }

  get status_code() {
    return this.status;
  }

  /** Texto decodificado pelo charset do cabeçalho (UTF-8 quando não vier). */
  get texto() {
    if (this._texto === null) {
      const m = /charset=["']?([^;"'\s]+)/i.exec(this.headers.get('content-type') || '');
      let rotulo = (m?.[1] || 'utf-8').toLowerCase();
      if (rotulo === 'iso-8859-1' || rotulo === 'latin1' || rotulo === 'latin-1') rotulo = 'windows-1252';
      let dec;
      try { dec = new TextDecoder(rotulo); } catch { dec = new TextDecoder('utf-8'); }
      this._texto = dec.decode(this.conteudo);
    }
    return this._texto;
  }

  /** Texto forçando UTF-8 (equivale a resp.encoding = "utf-8"). */
  get textoUtf8() {
    return new TextDecoder('utf-8').decode(this.conteudo);
  }

  json() {
    try {
      return JSON.parse(this.texto.replace(/^﻿/, ''));
    } catch (e) {
      const erro = new Error(t('Resposta não é JSON válido: {message}', { message: e.message }));
      erro.name = 'JSONDecodeError';
      throw erro;
    }
  }

  raise_for_status() {
    if (this.status >= 400) throw new ErroHTTP(this);
  }
}

/** Monta a URL com params como o requests: objeto ou lista de pares; null/undefined são omitidos. */
export function montarUrl(url, params) {
  if (!params) return url;
  const pares = Array.isArray(params) ? params : Object.entries(params);
  const busca = new URLSearchParams();
  for (const [k, v] of pares) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) for (const x of v) busca.append(k, valorParam(x));
    else busca.append(k, valorParam(v));
  }
  const qs = busca.toString();
  if (!qs) return url;
  return url + (url.includes('?') ? (url.endsWith('?') || url.endsWith('&') ? '' : '&') : '?') + qs;
}

function valorParam(v) {
  if (v === true) return 'True';
  if (v === false) return 'False';
  return String(v);
}

function timeoutMs(timeout) {
  if (Array.isArray(timeout)) return (Number(timeout[0]) + Number(timeout[1])) * 1000;
  return Number(timeout || 30) * 1000;
}

/**
 * requests.get/post. `timeout` aceita (connect, read) como no Python — aqui vira
 * um teto total de connect+read segundos para a requisição inteira.
 */
export async function requisitar(url, { metodo = 'GET', params, headers, timeout = [10, 30], dados, json } = {}) {
  const destino = montarUrl(url, params);
  const cab = { 'User-Agent': USER_AGENT_PADRAO, ...(headers || {}) };
  let corpo;
  if (json !== undefined) {
    corpo = JSON.stringify(json);
    if (!Object.keys(cab).some((k) => k.toLowerCase() === 'content-type')) cab['Content-Type'] = 'application/json';
  } else if (dados !== undefined) {
    if (typeof dados === 'string' || dados instanceof Uint8Array) corpo = dados;
    else {
      corpo = new URLSearchParams(Object.entries(dados).map(([k, v]) => [k, String(v)])).toString();
      if (!Object.keys(cab).some((k) => k.toLowerCase() === 'content-type')) cab['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  const sinal = AbortSignal.timeout(timeoutMs(timeout));
  let r;
  let bytes;
  try {
    r = await fetch(destino, { method: metodo, headers: cab, body: corpo, signal: sinal, redirect: 'follow' });
    bytes = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new ErroTimeout(destino);
    if (ehErroRequisicao(e)) throw e;
    throw new ErroConexao(destino, e);
  }
  return new Resposta(r, bytes);
}

export const obter = (url, opcoesReq = {}) => requisitar(url, { ...opcoesReq, metodo: 'GET' });
export const enviar = (url, opcoesReq = {}) => requisitar(url, { ...opcoesReq, metodo: 'POST' });

/**
 * requests.Session: guarda os cookies entre chamadas (inclusive os que chegam
 * em respostas de redirecionamento, por isso segue os redirecionamentos à mão).
 * Pensada para um único site por sessão (AnvisaLegis), sem domínio/caminho por cookie.
 */
export class Sessao {
  constructor(headers = {}) {
    this.headers = { ...headers };
    this.cookies = new Map();
  }

  _guardarCookies(r) {
    const lista = typeof r.headers.getSetCookie === 'function'
      ? r.headers.getSetCookie()
      : String(r.headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/);
    for (const c of lista) {
      const par = String(c).split(';')[0];
      const i = par.indexOf('=');
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }

  async requisitar(url, { metodo = 'GET', params, headers, timeout = [10, 30], dados } = {}) {
    let destino = montarUrl(url, params);
    let m = metodo;
    let corpo = dados;
    const cab = { 'User-Agent': USER_AGENT_PADRAO, ...this.headers, ...(headers || {}) };
    const sinal = AbortSignal.timeout(timeoutMs(timeout));
    try {
      for (let salto = 0; salto < 10; salto++) {
        const comCookie = { ...cab };
        if (this.cookies.size) comCookie.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        const r = await fetch(destino, { method: m, headers: comCookie, body: corpo, signal: sinal, redirect: 'manual' });
        this._guardarCookies(r);
        const local = r.headers.get('location');
        if ([301, 302, 303, 307, 308].includes(r.status) && local) {
          await r.arrayBuffer().catch(() => {});
          destino = new URL(local, destino).toString();
          if (r.status === 303 || ((r.status === 301 || r.status === 302) && m === 'POST')) {
            m = 'GET';
            corpo = undefined;
            delete cab['Content-Type'];
          }
          continue;
        }
        const bytes = Buffer.from(await r.arrayBuffer());
        const resp = new Resposta(r, bytes);
        resp.url = destino;
        return resp;
      }
      throw new ErroConexao(destino, new Error('redirecionamentos demais'));
    } catch (e) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new ErroTimeout(destino);
      if (ehErroRequisicao(e)) throw e;
      throw new ErroConexao(destino, e);
    }
  }

  get(url, opcoesReq = {}) {
    return this.requisitar(url, { ...opcoesReq, metodo: 'GET' });
  }

  post(url, opcoesReq = {}) {
    return this.requisitar(url, { ...opcoesReq, metodo: 'POST' });
  }
}

/** Python urllib.parse.quote_plus com encoding="latin-1" (caracteres fora do Latin-1 já devem ter sido tratados). */
export function quotePlusLatin1(texto) {
  let saida = '';
  for (const c of String(texto ?? '')) {
    if (/^[A-Za-z0-9_.~-]$/.test(c)) saida += c;
    else if (c === ' ') saida += '+';
    else {
      const cod = c.codePointAt(0);
      if (cod > 0xff) continue; // 'ignore' — o chamador já tirou o que não cabe em Latin-1
      saida += `%${cod.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return saida;
}

/** urlencode(pares, encoding="latin-1") */
export function urlencodeLatin1(pares) {
  const lista = Array.isArray(pares) ? pares : Object.entries(pares);
  return lista.map(([k, v]) => `${quotePlusLatin1(k)}=${quotePlusLatin1(v)}`).join('&');
}

/** Texto que cabe em Latin-1: se não couber, tira acentos e descarta o resto (como o desktop). */
export function paraLatin1(valor) {
  const s = String(valor ?? '');
  if ([...s].every((c) => c.codePointAt(0) <= 0xff)) return s;
  return [...s.normalize('NFKD')].filter((c) => c.codePointAt(0) <= 0xff).join('');
}

// ── Datas (só dia, sem fuso: o date do Python) ───────────────────────────────

/** date.today() como Date em UTC 00:00 do dia local. */
export function hoje() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** date.fromisoformat / strptime("%Y-%m-%d"): falha em data inexistente. */
export function deIso(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ''));
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!d || d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new Error(t('Data inválida: \'{texto}\'', { texto }));
  }
  return d;
}

export function somarDias(d, n) {
  return new Date(d.getTime() + n * 86_400_000);
}

const doisDig = (n) => String(n).padStart(2, '0');
export const paraIso = (d) => `${d.getUTCFullYear()}-${doisDig(d.getUTCMonth() + 1)}-${doisDig(d.getUTCDate())}`;
export const paraBr = (d) => `${doisDig(d.getUTCDate())}/${doisDig(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
export const paraCompacta = (d) => paraIso(d).replace(/-/g, '');

// ── Texto ────────────────────────────────────────────────────────────────────

// Entidades nomeadas mais comuns (o html.unescape do Python conhece todas as
// do HTML5; aqui ficam as que aparecem em texto de API: Latin-1 + tipografia).
const LATIN1 = ('nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 '
  + 'acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring '
  + 'AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times '
  + 'Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave '
  + 'eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute '
  + 'ucirc uuml yacute thorn yuml').split(' ');
const ENTIDADES = Object.fromEntries(LATIN1.map((n, i) => [n, String.fromCharCode(160 + i)]));
Object.assign(ENTIDADES, {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', lsquo: '‘',
  rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', hellip: '…',
  bull: '•', euro: '€', trade: '™', dagger: '†', Dagger: '‡', permil: '‰',
  lsaquo: '‹', rsaquo: '›', OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š',
  Yuml: 'Ÿ', fnof: 'ƒ', circ: 'ˆ', tilde: '˜', ensp: ' ', emsp: ' ',
  thinsp: ' ', zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏', prime: '′',
  Prime: '″', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  minus: '−', le: '≤', ge: '≥', ne: '≠', asymp: '≈', infin: '∞',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', mu: 'μ', pi: 'π', sigma: 'σ',
  NewLine: '\n', Tab: '\t', colon: ':', comma: ',', period: '.', lpar: '(', rpar: ')', sol: '/', num: '#',
});
// Números de 0x80–0x9F que o HTML5 (e o html.unescape) trata como Windows-1252.
const CP1252 = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** html.unescape */
export function unescapeHtml(texto) {
  if (!texto || !texto.includes('&')) return texto || '';
  return texto.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);?/g, (todo, ent) => {
    if (ent[0] === '#') {
      let n = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      if (CP1252[n]) n = CP1252[n];
      if (!Number.isFinite(n) || n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '�';
      return String.fromCodePoint(n);
    }
    if (Object.prototype.hasOwnProperty.call(ENTIDADES, ent)) {
      // Sem ";" o Python só aceita as entidades históricas (Latin-1 e amp/lt/gt/quot).
      if (!todo.endsWith(';') && !(LATIN1.includes(ent) || ['amp', 'lt', 'gt', 'quot'].includes(ent))) return todo;
      return ENTIDADES[ent];
    }
    return todo;
  });
}

const RE_SCRIPT_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const RE_QUEBRA_BLOCO = /<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi;
const RE_TAG = /<[^>]+>/g;

/**
 * HTML → texto corrido para o corpus. Remove script/style, troca fim de bloco
 * (</p>, <br>, </li>...) por quebra de linha, tira as tags, decodifica
 * entidades e normaliza espaços sem colar parágrafos.
 */
export function htmlParaTexto(html) {
  if (!html) return '';
  let texto = String(html).replace(RE_SCRIPT_STYLE, ' ');
  texto = texto.replace(RE_QUEBRA_BLOCO, '\n');
  texto = unescapeHtml(texto.replace(RE_TAG, ' ')).replace(/ /g, ' ');
  const linhas = texto.split('\n').map((l) => l.replace(/[ \t\r\f\v]+/g, ' ').trim());
  return linhas.filter((l) => l).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** " ".join(texto.split()) do Python: colapsa qualquer espaço em branco. */
export function colapsarEspacos(texto) {
  return String(texto ?? '').split(/\s+/).filter(Boolean).join(' ');
}

// str.splitlines() do Python: também quebra em \v, \f, \x1c-\x1e, \x85 e nos separadores de linha/parágrafo Unicode.
const RE_LINHAS = new RegExp(`\\r\\n|[\\n\\r\\v\\f\\x1c-\\x1e\\x85${String.fromCharCode(0x2028, 0x2029)}]`);
export function separarLinhas(texto) {
  const s = String(texto ?? '');
  if (!s) return [];
  const partes = s.split(RE_LINHAS);
  if (partes.length > 1 && partes[partes.length - 1] === '') partes.pop();
  return partes;
}

/** Python len(): conta caracteres (code points), não unidades UTF-16. */
export function tamanho(texto) {
  let n = 0;
  for (const _ of String(texto ?? '')) n++; // eslint-disable-line no-unused-vars
  return n;
}

/** Python texto[:n] por code point. */
export function fatiar(texto, inicio, fim) {
  const s = String(texto ?? '');
  // Caminho rápido: sem pares substitutos, índice UTF-16 = code point.
  if (!/[\ud800-\udfff]/.test(s)) return s.slice(inicio, fim);
  return Array.from(s).slice(inicio, fim).join('');
}

/** Python str.strip(chars) */
export function aparar(texto, chars) {
  const s = String(texto ?? '');
  if (chars === undefined) return s.trim();
  let i = 0;
  let j = s.length;
  while (i < j && chars.includes(s[i])) i++;
  while (j > i && chars.includes(s[j - 1])) j--;
  return s.slice(i, j);
}

/** urllib.parse.quote(texto, safe): como o Python, mantém só letras, dígitos, "_.-~" e `safe`. */
export function quote(texto, safe = '/') {
  let s = encodeURIComponent(String(texto ?? '')).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  for (const c of safe) {
    const cod = `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
    s = s.split(cod).join(c);
  }
  return s;
}

/** Lê um caminho aninhado como .get("a", {}).get("b", ...) do Python, tolerante a null. */
export function obterCampo(obj, ...chaves) {
  let atual = obj;
  for (const k of chaves) {
    if (atual === null || atual === undefined || typeof atual !== 'object') return undefined;
    atual = atual[k];
  }
  return atual;
}

/** `x or y` do Python: valores "falsos" incluem "", 0, [], {} e null. */
export function ou(...valores) {
  for (const v of valores.slice(0, -1)) if (verdadeiro(v)) return v;
  return valores[valores.length - 1];
}

export function verdadeiro(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '' || Number.isNaN(v)) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/** Equivale a str(x) do Python para o registro de erros por item. */
export function reprCurto(item) {
  if (typeof item === 'string') return item;
  try { return JSON.stringify(item) ?? String(item); } catch { return String(item); }
}

// ── Respostas ────────────────────────────────────────────────────────────────

/**
 * Devolve resp.json(), mas falha com mensagem clara se a fonte respondeu HTML
 * no lugar de JSON — bloqueio de firewall ou página de manutenção disfarçados
 * de HTTP 200 (TCU, portais gov.br).
 */
export function exigirJson(resp, fonteNome) {
  const tipo = resp.headers.get('content-type') || '';
  if (!tipo.toLowerCase().includes('json')) {
    throw new Error(t('{fonteNome} respondeu {tipo} em vez de JSON (bloqueio ou manutenção no servidor de origem)', { fonteNome, tipo: tipo || t('sem tipo') }));
  }
  return resp.json();
}

export function resultadoVazio() {
  return { ok: true, total_encontrados: 0, total_salvos: 0, erros: [] };
}

/**
 * Traduz erros comuns de API externa em mensagem acionável — o texto cru de
 * HTTPError (URL completa + status) não ajuda o usuário a saber se deve só
 * tentar de novo ou se é um problema real.
 */
export function mensagemErroBuscaExterna(e, fonteNome) {
  if (e instanceof ErroHTTP && e.response?.status === 429) {
    return t('{fonteNome} está limitando o número de buscas no momento — aguarde alguns segundos e tente novamente.', { fonteNome });
  }
  if (e instanceof ErroTimeout) return t('{fonteNome} demorou demais para responder — tente novamente.', { fonteNome });
  return t('Erro ao buscar em {fonteNome}: {v}', { fonteNome, v: e?.message ?? e });
}

// ── Gravação (mesmo formato do desktop) ──────────────────────────────────────

export function sanitizarNomeArquivo(nome) {
  return fatiar(Array.from(String(nome ?? '')).map((c) => (/^[a-zA-Z0-9_-]$/.test(c) ? c : '_')).join(''), 0, 40);
}

/** data/neural/{projeto}/documents */
export function pastaDocumentos(raiz, projetoNome) {
  return path.join(caminhos(raiz).neural, projetoNome, 'documents');
}

/** Lê o _manifest.json (lista). Arquivo corrompido falha, como no desktop — nunca é sobrescrito às cegas. */
export function carregarManifest(docDir) {
  const manifestPath = path.join(docDir, '_manifest.json');
  if (fs.existsSync(manifestPath)) {
    const v = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
    return [Array.isArray(v) ? v : [], manifestPath];
  }
  return [[], manifestPath];
}

export function salvarManifest(manifest, manifestPath) {
  salvarJson(manifestPath, manifest, 2);
}

/** Escreve o .txt no formato do desktop e devolve a entrada do manifest. */
export function salvarDocumento(docDir, fonteId, titulo, texto, urlOrigem, { tipo, tamanhoBytes, cabecalhoExtra = '' } = {}) {
  const fid = crypto.randomUUID().slice(0, 8);
  const nomeTxt = `${fid}_${sanitizarNomeArquivo(titulo)}.txt`;
  const data = dataBr();
  const conteudo = `TITULO: ${titulo}\nFONTE: ${fonteId}\nDATA: ${data}\nURL_ORIGEM: ${urlOrigem ?? ''}\n${'-'.repeat(70)}\n${cabecalhoExtra}${texto}`;
  escreverAtomico(path.join(docDir, nomeTxt), conteudo);
  return {
    id: fid,
    nome_original: titulo,
    nome_txt: nomeTxt,
    tipo: tipo ?? fonteId,
    tamanho: tamanhoBytes ?? Buffer.byteLength(String(texto), 'utf8'),
    data,
    chars: tamanho(texto),
    fonte_externa: fonteId,
  };
}

/**
 * Laço comum de "pra cada item bruto da API: extrai texto, salva, avança".
 *
 * extrairItem(item) -> {titulo, texto, url_origem} ou null (pula o item sem
 * contar como erro — ex: resultado sem abstract, baixo valor pra RAG). Um item
 * que levanta exceção vira entrada em "erros" e não derruba o lote.
 */
export async function executarBuscaGenerica(itens, extrairItem, fonteId, docDir, {
  evento_cancelar: eventoCancelar = null, dispatch_event: dispatchEvent = null, throttle = 1.0,
} = {}) {
  fs.mkdirSync(docDir, { recursive: true });
  const [manifest, manifestPath] = carregarManifest(docDir);

  if (dispatchEvent) dispatchEvent('total', { total: itens.length });

  let totalSalvos = 0;
  const erros = [];

  for (let i = 0; i < itens.length; i++) {
    if (eventoCancelar && eventoCancelar.is_set()) break;
    const item = itens[i];
    try {
      const extraido = await extrairItem(item);
      if (extraido) {
        const entry = salvarDocumento(docDir, fonteId, extraido.titulo, extraido.texto, extraido.url_origem ?? '');
        manifest.push(entry);
        totalSalvos += 1;
        if (dispatchEvent) dispatchEvent('processed', { processed: totalSalvos, total: itens.length, titulo: extraido.titulo });
      }
    } catch (e) {
      erros.push({ titulo: fatiar(reprCurto(item), 0, 80), erro: String(e?.message ?? e) });
    }
    if (throttle && i < itens.length - 1) await dormir(throttle);
  }

  salvarManifest(manifest, manifestPath);

  return { ok: true, total_encontrados: itens.length, total_salvos: totalSalvos, erros };
}
