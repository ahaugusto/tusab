// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Servidor local da extensão: entrega a interface do Tusab desktop (build em
// modo extensão, pasta interface/) e responde às mesmas rotas do motor em /api/*.
//
// Por que assim: Firefox e Safari não deixam um site da internet gravar numa
// pasta do computador. Aqui o navegador só mostra a tela; quem grava a pasta,
// extrai do YouTube e indexa é o plugin. Funciona igual em qualquer navegador.
//
// Proteções (um servidor local é alvo de outros sites abertos no mesmo navegador):
// - escuta só em 127.0.0.1, porta aleatória, só enquanto o plugin está aberto;
// - toda chamada /api exige a chave da sessão no cabeçalho X-Tusab-Chave
//   (cabeçalho próprio obriga verificação prévia em pedidos de outros sites, e
//   este servidor não libera nenhum: não há CORS);
// - cabeçalho Host precisa ser 127.0.0.1:<porta> (contra DNS rebinding);
// - Origin e Sec-Fetch-Site, quando presentes, precisam ser do próprio painel;
// - corpo de POST só em JSON, com limite de tamanho;
// - só arquivos de dentro de interface/; CSP sem scripts de fora.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ErroHttp, atenderApi } from './api.js';
import { dentroDe } from './nucleo/caminhos.js';
import { TAMANHO_MAX_TUSAB } from './nucleo/exportar.js';
import { definirIdioma, t } from './nucleo/idioma.js';

export const PASTA_INTERFACE = fileURLToPath(new URL('../interface/', import.meta.url));
const LIMITE_CORPO = 12 * 1024 * 1024;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

const CABECALHOS_SEGURANCA = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; " +
    "img-src 'self' data: blob: https://*.ytimg.com https://*.ggpht.com https://*.googleusercontent.com; " +
    "font-src 'self' data:; media-src 'self' blob:; manifest-src 'self'; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function responder(res, status, corpo, tipo = 'application/json; charset=utf-8', cache = 'no-store', extras = {}) {
  const dados = typeof corpo === 'string' || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo);
  res.writeHead(status, { ...CABECALHOS_SEGURANCA, 'Content-Type': tipo, 'Cache-Control': cache, ...extras });
  res.end(dados);
}

function mesmaChave(recebida, esperada) {
  const a = Buffer.from(String(recebida || ''));
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const LIMITE_ARQUIVO = 52 * 1024 * 1024; // envio de documento (50 MB, como o desktop) e de base .tusab

function lerBruto(req, limite) {
  if (Number(req.headers['content-length'] || 0) > limite) {
    return Promise.reject(new ErroHttp(413, 'Envio grande demais.'));
  }
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho <= limite) partes.push(parte);
    });
    req.on('end', () => (tamanho > limite ? reject(new ErroHttp(413, 'Envio grande demais.')) : resolve(Buffer.concat(partes))));
    req.on('error', reject);
  });
}

/**
 * Corpo do pedido: JSON (objeto) ou, para envio de arquivo, multipart/form-data
 * (FormData do próprio Node, sem dependência). Qualquer outro tipo é recusado.
 */
async function lerCorpo(req, limiteArquivo = LIMITE_ARQUIVO) {
  const tipo = String(req.headers['content-type'] || '');
  if (tipo.startsWith('multipart/form-data')) {
    const bruto = await lerBruto(req, limiteArquivo);
    try {
      return await new Request('http://127.0.0.1/', { method: 'POST', headers: { 'content-type': tipo }, body: bruto }).formData();
    } catch {
      throw new ErroHttp(400, t('Envio de arquivo inválido.'));
    }
  }
  const bruto = (await lerBruto(req, LIMITE_CORPO)).toString('utf8').trim();
  if (!bruto) return {};
  if (!tipo.startsWith('application/json')) throw new ErroHttp(415, 'Envie JSON.');
  try {
    const valor = JSON.parse(bruto);
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
  } catch {
    throw new ErroHttp(400, t('Pedido inválido.'));
  }
}

const PAGINA_SEM_INTERFACE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Tusab</title>
<body style="font-family:system-ui;padding:2rem"><h1>Tusab</h1>
<p>A interface ainda não foi gerada neste pacote. Rode <code>npm run build:interface</code> em tusab-mcp.</p></body></html>`;

export class Painel {
  constructor(tusab, { versao = '', pastaInterface = PASTA_INTERFACE } = {}) {
    this.tusab = tusab;
    this.versao = versao;
    this.pastaInterface = pastaInterface;
    this.chave = crypto.randomBytes(32).toString('base64url');
    this.servidor = null;
    this.porta = null;
  }

  get origem() {
    return `http://127.0.0.1:${this.porta}`;
  }

  get url() {
    return `${this.origem}/?chave=${this.chave}`;
  }

  async iniciar() {
    if (this.servidor) return this.url;
    const servidor = http.createServer((req, res) => {
      this._atender(req, res).catch((e) => {
        if (!(e instanceof ErroHttp)) process.stderr.write(`[tusab] painel: ${e.stack || e.message}\n`);
        if (res.headersSent) return res.end();
        const status = e instanceof ErroHttp ? e.status : 500;
        responder(res, status, { error: true, message: e.message || t('Erro.') });
      });
    });
    servidor.headersTimeout = 15_000;
    servidor.requestTimeout = 120_000;
    await new Promise((resolve, reject) => {
      servidor.once('error', reject);
      servidor.listen(0, '127.0.0.1', resolve);
    });
    this.servidor = servidor;
    this.porta = servidor.address().port;
    return this.url;
  }

  fechar() {
    if (!this.servidor) return;
    this.servidor.close();
    this.servidor.closeAllConnections?.();
    this.servidor = null;
  }

  async _atender(req, res) {
    if (req.headers.host !== `127.0.0.1:${this.porta}`) throw new ErroHttp(421, t('Endereço não reconhecido.'));
    const url = new URL(req.url, this.origem);

    if (!url.pathname.startsWith('/api/')) return this._estatico(req, res, url.pathname);

    const origemPedido = req.headers.origin;
    if (origemPedido !== undefined && origemPedido !== this.origem) throw new ErroHttp(403, 'Origem recusada.');
    const site = req.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') throw new ErroHttp(403, 'Origem recusada.');
    if (!mesmaChave(req.headers['x-tusab-chave'], this.chave)) throw new ErroHttp(401, t('Chave ausente ou inválida.'));
    // Idioma da tela: só depois da chave conferida (quem não tem a chave não muda nada).
    definirIdioma(req.headers['x-tusab-idioma']);
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) throw new ErroHttp(405, t('Método não permitido.'));

    const caminho = url.pathname.slice(4) || '/';
    const r = await atenderApi(this.tusab, req.method, caminho, url.searchParams,
      // Base .tusab recebida pode ser grande (limite próprio do formato); documento, até 50 MB.
      () => lerCorpo(req, caminho === '/import/base-compartilhavel' ? TAMANHO_MAX_TUSAB : LIMITE_ARQUIVO));
    // Downloads (Anki, exportações): Buffer + tipo + Content-Disposition; o resto é JSON.
    responder(res, r.status, r.corpo, r.tipo, 'no-store', r.cabecalhos);
  }

  _estatico(req, res, caminho) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new ErroHttp(405, t('Método não permitido.'));
    const indice = path.join(this.pastaInterface, 'index.html');
    if (!fs.existsSync(indice)) return responder(res, 200, PAGINA_SEM_INTERFACE, 'text/html; charset=utf-8');
    let relativo;
    try { relativo = decodeURIComponent(caminho); } catch { throw new ErroHttp(400, t('Caminho inválido.')); }
    const alvo = relativo === '/' ? indice : path.join(this.pastaInterface, relativo);
    if (!dentroDe(this.pastaInterface, alvo) || !fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) {
      throw new ErroHttp(404, t('Não encontrado.'));
    }
    const tipo = TIPOS[path.extname(alvo).toLowerCase()];
    if (!tipo) throw new ErroHttp(404, t('Não encontrado.'));
    // Arquivos com hash no nome (assets/) podem ficar em cache; o resto não.
    const cache = relativo.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store';
    responder(res, 200, fs.readFileSync(alvo), tipo, cache);
  }
}

/** Abre o link no navegador padrão, sem shell e sem tocar no stdout do MCP. */
export function abrirNoNavegador(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/\?chave=[\w-]+$/.test(url)) throw new Error('Link do painel inválido.');
  const [comando, args] =
    process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
  const filho = spawn(comando, args, { stdio: 'ignore', detached: true, windowsHide: true });
  filho.on('error', () => {});
  filho.unref();
}
