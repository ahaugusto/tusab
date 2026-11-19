// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Documentos do Repositório — porte de router_repositorio.py (/neural/upload,
// /neural/url) e motor/fhir.py, motor/web_scraper.py.
//   PDF (pdfjs-dist) · DOCX (mammoth) · XLSX (read-excel-file) · CSV · TXT/MD · JSON FHIR
//   Formatos especiais: WhatsApp, Zoom/Otter/Teams, petição/contrato/parecer.
// Imagens (OCR) e áudio (transcrição) ainda não: no desktop dependem de modelos locais.

import { t } from './idioma.js';

// ── Formatos especiais (mesmas regras do desktop) ────────────────────────────

const LABEL_FORMATO = {
  whatsapp_android: 'WhatsApp (Android)', whatsapp_ios: 'WhatsApp (iOS)', zoom: 'Zoom', otter: 'Otter.ai',
  teams: 'Microsoft Teams', peticao: 'Petição jurídica', contrato: 'Contrato', parecer: 'Parecer jurídico',
};

export function detectarFormatoEspecial(texto, nomeArquivo = '') {
  const linhas = String(texto).trim().split(/\r?\n/);
  if (!linhas.length || !linhas[0]) return null;
  const cabecalho = linhas.slice(0, 5).join('\n').toLowerCase();
  const nome = String(nomeArquivo).toLowerCase();

  if (/excelent[íi]ssimo\s+senhor\s+doutor\s+juiz/i.test(texto) || /^\s*ao\s+ju[íi]zo\s+da/im.test(texto)) return 'peticao';
  if (/cl[áa]usula\s+(primeira|1ª|1a|1º|1o|i)(?![\p{L}\p{N}_])/iu.test(texto)) return 'contrato';
  if (/^\s*parecer\s+jur[íi]dico(?![\p{L}\p{N}_])/imu.test(texto) || /^\s*ementa\s*:/im.test(texto)) return 'parecer';
  if (cabecalho.includes('meeting id:') || cabecalho.includes('zoom meeting')) return 'zoom';
  if ((nome.includes('zoom_') || nome.startsWith('gmt')) && /\d{2}:\d{2}:\d{2}/.test(linhas[0] || '')) return 'zoom';
  if (cabecalho.includes('otter.ai') || nome.includes('otter')) return 'otter';
  if (cabecalho.includes('microsoft teams') || cabecalho.includes('teams meeting')) return 'teams';
  const vinte = linhas.slice(0, 20).join('\n');
  if (/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]\s*.+?:/m.test(vinte)) return 'whatsapp_android';
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*[-–]\s*.+?:/m.test(vinte)) return 'whatsapp_ios';
  return null;
}

function parsearWhatsapp(texto, formato) {
  const padrao = formato === 'whatsapp_android'
    ? /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]\s*([^:]+):\s*(.+)/
    : /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2})\s*[-–]\s*([^:]+):\s*(.+)/;
  let msgs = [];
  for (const linha of String(texto).split(/\r?\n/)) {
    const m = linha.match(padrao);
    if (m) {
      const [, data, hora, remetente, primeira] = m;
      msgs.push([data, hora, remetente.trim(), primeira.trim().startsWith('‎') ? [] : [primeira.trim()]]);
    } else if (msgs.length && linha.trim()) {
      msgs.at(-1)[3].push(linha.trim());
    }
  }
  msgs = msgs.filter((m) => m[3].length);
  if (!msgs.length) return texto;
  const porDia = new Map();
  const participantes = new Set();
  for (const [data, hora, remetente, linhas] of msgs) {
    participantes.add(remetente);
    if (!porDia.has(data)) porDia.set(data, []);
    porDia.get(data).push(`[${hora}] ${remetente}: ${linhas.join(' ')}`);
  }
  const blocos = ['Conversa do WhatsApp', `Participantes: ${[...participantes].sort().join(', ')}`,
    `Total de mensagens: ${msgs.length}`, '-'.repeat(60)];
  for (const [data, lista] of porDia) blocos.push(`\n--- ${data} ---`, ...lista);
  return blocos.join('\n');
}

function falasPorBloco(linhas, padrao) {
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const m = linhas[i].trim().match(padrao);
    if (m && i + 1 < linhas.length) {
      const [, falante, hora] = m;
      const falas = [];
      i++;
      while (i < linhas.length && !padrao.test(linhas[i].trim())) {
        if (linhas[i].trim()) falas.push(linhas[i].trim());
        i++;
      }
      if (falas.length) blocos.push(`[${hora}] ${falante.trim()}: ${falas.join(' ')}`);
    } else {
      if (linhas[i].trim()) blocos.push(linhas[i]);
      i++;
    }
  }
  return blocos;
}

function parsearReuniao(texto, formato) {
  const linhas = String(texto).split(/\r?\n/);
  let blocos = [];
  if (formato === 'zoom') {
    for (const linha of linhas) {
      const m = linha.trim().match(/^(\d{2}:\d{2}:\d{2})\s+(.+?):\s*(.+)/);
      if (m) blocos.push(`[${m[1]}] ${m[2].trim()}: ${m[3].trim()}`);
      else if (linha.trim() && !/^\d{2}:\d{2}:\d{2}\s*-->/.test(linha)) blocos.push(linha);
    }
  } else if (formato === 'otter') {
    blocos = falasPorBloco(linhas, /^(.+?)\s{2,}(\d{1,2}:\d{2})\s*$/);
  } else if (formato === 'teams') {
    blocos = falasPorBloco(linhas, /^(.+?)\s{3,}(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
  } else return texto;
  return blocos.length ? blocos.join('\n') : texto;
}

function parsearDocumentoJuridico(texto, formato) {
  const cpfs = [...texto.matchAll(/CPF\s*(?:n[ºo°]?\.?)?\s*[:\s]*([\d.\-/]{11,18})/gi)].map((m) => m[1]);
  const cnpjs = [...texto.matchAll(/CNPJ\s*(?:n[ºo°]?\.?)?\s*[:\s]*([\d.\-/]{14,20})/gi)].map((m) => m[1]);
  const cab = [];
  if (formato === 'peticao') cab.push('Tipo de documento: Petição');
  else if (formato === 'contrato') {
    cab.push('Tipo de documento: Contrato');
    const clausulas = [...texto.matchAll(/^\s*CL[ÁA]USULA\s+([\p{L}\p{N}_º°ª]+)\s*[-–—:]?\s*(.*)$/gimu)];
    if (clausulas.length) {
      const titulos = clausulas.slice(0, 20).map(([, num, desc]) => `Cláusula ${num.trim()}${desc.trim() ? ` — ${desc.trim().slice(0, 60)}` : ''}`);
      cab.push(`Cláusulas identificadas (${clausulas.length}): ${titulos.join(' | ')}`);
    }
  } else if (formato === 'parecer') {
    cab.push('Tipo de documento: Parecer jurídico');
    const ementa = texto.match(/^\s*ementa\s*:\s*([\s\S]+?)(?:\n\n|$(?![\s\S]))/im);
    if (ementa) cab.push(`Ementa: ${ementa[1].trim().slice(0, 300)}`);
  }
  if (cpfs.length) cab.push(`CPF(s) identificado(s): ${cpfs.slice(0, 10).join(', ')}`);
  if (cnpjs.length) cab.push(`CNPJ(s) identificado(s): ${cnpjs.slice(0, 10).join(', ')}`);
  return cab.length ? `${cab.join('\n')}\n${'-'.repeat(60)}\n\n${texto}` : texto;
}

/** (texto, nome) → { texto, formato } — _processar_formato_especial do desktop. */
export function processarFormatoEspecial(texto, nomeArquivo) {
  const fmt = detectarFormatoEspecial(texto, nomeArquivo);
  if (fmt === 'whatsapp_android' || fmt === 'whatsapp_ios') return { texto: parsearWhatsapp(texto, fmt), formato: fmt };
  if (['zoom', 'otter', 'teams'].includes(fmt)) return { texto: parsearReuniao(texto, fmt), formato: fmt };
  if (['peticao', 'contrato', 'parecer'].includes(fmt)) return { texto: parsearDocumentoJuridico(texto, fmt), formato: fmt };
  return { texto, formato: null };
}

const avisoFormato = (fmt) => t('✅ Formato detectado: {formato} — estrutura aplicada automaticamente.', { formato: LABEL_FORMATO[fmt] ? t(LABEL_FORMATO[fmt]) : fmt });

// ── FHIR (motor/fhir.py) ─────────────────────────────────────────────────────

function decodificarEntidades(s) {
  const nomes = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return nomes[e.toLowerCase()] ?? m;
  });
}

function campoTexto(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor)) return valor.filter(Boolean).map(campoTexto).join('; ');
  if (typeof valor === 'object') {
    if (valor.text) return String(valor.text).trim();
    return (valor.coding || []).map((c) => c.display || c.code).filter(Boolean).join('; ');
  }
  return '';
}

export function processarBundleFhir(bytes) {
  const dados = JSON.parse(Buffer.from(bytes).toString('utf8'));
  let recursos;
  if (dados?.resourceType === 'Bundle') recursos = (dados.entry || []).map((e) => e.resource || {});
  else if (dados?.resourceType === 'ResearchStudy') recursos = [dados];
  else throw new Error(t('Arquivo não reconhecido como Bundle FHIR ou ResearchStudy.'));
  const estudos = recursos.filter((r) => r.resourceType === 'ResearchStudy').map((r) => {
    const partes = [];
    const narrativa = decodificarEntidades(String(r.text?.div || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (narrativa && !narrativa.toLowerCase().includes('put rendering here')) partes.push(narrativa);
    if (r.status) partes.push(`Status: ${r.status}`);
    const desc = campoTexto(r.description);
    if (desc) partes.push(`Descrição: ${desc}`);
    const cond = campoTexto(r.condition);
    if (cond) partes.push(`Condição estudada: ${cond}`);
    return { titulo: (r.title || '').trim() || `ResearchStudy ${r.id || ''}`, texto: partes.join('\n\n') };
  });
  if (!estudos.length) throw new Error(t('Nenhum ResearchStudy encontrado no arquivo FHIR.'));
  const blocos = estudos.map((e) => `## ${e.titulo}\n\n${e.texto || '[Sem descrição textual disponível no recurso]'}`);
  return { texto: blocos.join(`\n\n${'-'.repeat(40)}\n\n`), total: estudos.length };
}

// ── Extração por tipo de arquivo ─────────────────────────────────────────────

export const EXTS_IMAGEM = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
export const EXTS_AUDIO = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.opus', '.aac']);
export const LIMITE_DOC = 50 * 1024 * 1024;

/**
 * Texto de um intervalo de páginas do PDF → { paginas: [{ n, texto }], total }.
 * Usado no envio (todas) e quando a IA lê páginas do original (tusab_ler_original).
 */
export async function lerPaginasPdf(bytes, { de = 1, ate = Infinity } = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, isEvalSupported: false, verbosity: 0,
  });
  const doc = await tarefa.promise;
  const paginas = [];
  try {
    for (let n = Math.max(1, de); n <= Math.min(doc.numPages, ate); n++) {
      const pagina = await doc.getPage(n);
      const { items } = await pagina.getTextContent();
      let txt = '';
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        txt += it.str;
        txt += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '');
      }
      txt = txt.replace(/(?<=[a-záàâãéêíóôõúç])-\n(?=[a-záàâãéêíóôõúç])/giu, '')
        .replace(/[ \t]{2,}/g, ' ')
        .split('\n').map((l) => l.trim()).join('\n').trim();
      if (txt) paginas.push({ n, texto: txt });
      pagina.cleanup();
    }
    return { paginas, total: doc.numPages };
  } finally {
    await tarefa.destroy();
  }
}

/** Texto do PDF com marcação de página ([Página N]) para a citação não ser inventada. */
export const comPaginas = (paginas) => paginas.map((p) => `[Página ${p.n}]\n${p.texto}`).join('\n\n');

async function textoDoPdf(bytes) {
  return comPaginas((await lerPaginasPdf(bytes)).paginas);
}

async function textoDoDocx(bytes) {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value.split(/\r?\n/).filter((l) => l.trim()).join('\n');
}

function celulaTexto(c) {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  return String(c);
}

function linhasComCabecalho(linhas) {
  const [cab = [], ...resto] = linhas;
  const cabecalho = cab.map(celulaTexto);
  return resto
    .map((r) => r.map(celulaTexto))
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => cabecalho.map((h, i) => [h, r[i] ?? '']).filter(([h, v]) => h || v).map(([h, v]) => `${h}: ${v}`).join(' | '));
}

async function textoDoXlsx(bytes) {
  // read-excel-file 9: a função padrão lê todas as abas → [{ sheet, data: linhas[] }]
  const lerTodas = (await import('read-excel-file/node')).default;
  const blocos = [];
  for (const { sheet, data } of await lerTodas(Buffer.from(bytes))) {
    if (!data?.length) continue;
    blocos.push(`[Planilha: ${sheet}]`, ...linhasComCabecalho(data));
  }
  return blocos.join('\n');
}

export function lerLinhasCsv(texto) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/**
 * Converte o arquivo enviado em texto pesquisável.
 * @returns {Promise<{texto:string, aviso?:string, formato?:string, qualidadePdf?:string}>}
 * Lança Error com mensagem ao usuário quando o formato não é suportado.
 */
export async function extrairTextoDeArquivo(bytes, nomeArquivo) {
  const ext = (String(nomeArquivo).match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  const comFormato = (txt) => {
    const r = processarFormatoEspecial(txt, nomeArquivo);
    return r.formato ? { texto: r.texto, aviso: avisoFormato(r.formato), formato: r.formato } : { texto: r.texto };
  };
  if (ext === '.pdf') {
    const txt = await textoDoPdf(bytes);
    if (!txt.trim()) {
      const agora = new Date();
      return {
        texto: `[PDF registrado sem extração de texto — possível documento escaneado]\nArquivo: ${nomeArquivo}\n`
          + `Data: ${agora.toLocaleDateString('pt-BR')} ${agora.toTimeString().slice(0, 5)}\n\n`
          + 'O texto deste PDF não pôde ser extraído (sem camada de texto). O original está guardado no Tusab: '
          + 'a IA pode ler as páginas com tusab_ler_original.',
        aviso: t('⚠️ PDF sem camada de texto (possivelmente escaneado). O original foi guardado e a sua IA pode lê-lo quando precisar; mas o texto não pôde ser extraído.'),
        qualidadePdf: 'escaneado_sem_ocr',
      };
    }
    const r = processarFormatoEspecial(txt, nomeArquivo);
    const juridico = ['peticao', 'contrato', 'parecer'].includes(r.formato);
    return { texto: r.texto, qualidadePdf: 'texto_nativo', ...(juridico ? { aviso: avisoFormato(r.formato), formato: r.formato } : {}) };
  }
  if (ext === '.docx') {
    const r = processarFormatoEspecial(await textoDoDocx(bytes), nomeArquivo);
    return ['peticao', 'contrato', 'parecer'].includes(r.formato) ? { texto: r.texto, aviso: avisoFormato(r.formato), formato: r.formato } : { texto: r.texto };
  }
  if (ext === '.xlsx') return { texto: await textoDoXlsx(bytes) };
  if (ext === '.csv') {
    const bruto = Buffer.from(bytes).toString('utf8').replace(/^﻿/, '');
    const linhas = lerLinhasCsv(bruto);
    return { texto: linhas.length ? linhasComCabecalho(linhas).join('\n') : bruto };
  }
  if (ext === '.json') {
    const { texto, total } = processarBundleFhir(bytes);
    return { texto, aviso: t('✅ Formato detectado: Bundle FHIR ({total} estudo(s) — ResearchStudy) — estrutura aplicada automaticamente.', { total }), formato: 'fhir_bundle' };
  }
  if (ext === '.txt' || ext === '.md') return comFormato(Buffer.from(bytes).toString('utf8'));
  if (EXTS_IMAGEM.has(ext) || EXTS_AUDIO.has(ext)) {
    // O Tusab não lê imagem nem transcreve áudio: guarda o original e registra um texto com
    // os metadados, para aparecer no repositório e na busca pelo nome. A IA lê o original quando precisar.
    const tipo = EXTS_IMAGEM.has(ext) ? 'Imagem' : 'Áudio';
    return {
      texto: `[${tipo === 'Imagem' ? 'Imagem guardada' : 'Áudio guardado'} no Tusab: ${nomeArquivo}]
O conteúdo não foi transcrito pelo Tusab. `
        + (tipo === 'Imagem' ? 'A IA pode ver a imagem com tusab_ler_original.' : 'Para ouvir ou transcrever, anexe o arquivo original na conversa com a IA.'),
      aviso: tipo === 'Imagem' ? t('✅ Imagem guardada. A sua IA pode ver a imagem quando precisar.') : t('✅ Áudio guardado. O Tusab ainda não transcreve áudio.'),
    };
  }
  throw new Error(t('Formato não suportado: {ext}', { ext: ext || t('sem extensão') }));
}

// ── Página web (motor/web_scraper.py) ────────────────────────────────────────

const AGENTE_WEB = 'TusabBot/1.0 (+local personal knowledge tool; respects robots.txt)';

/** robots.txt: grupos por User-agent, Allow/Disallow com a regra mais longa vencendo. */
export function permitidoPorRobots(robots, agente, caminho) {
  const grupos = [];
  let atual = null;
  let ultimaFoiAgente = false;
  for (const bruta of String(robots).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, chave, valor] = m;
    const k = chave.toLowerCase();
    if (k === 'user-agent') {
      if (!ultimaFoiAgente) { atual = { agentes: [], regras: [] }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      ultimaFoiAgente = true;
    } else {
      ultimaFoiAgente = false;
      if (atual && (k === 'allow' || k === 'disallow')) atual.regras.push({ permitir: k === 'allow', caminho: valor });
    }
  }
  const nome = agente.toLowerCase().split('/')[0];
  const grupo = grupos.find((g) => g.agentes.some((a) => a !== '*' && nome.includes(a))) || grupos.find((g) => g.agentes.includes('*'));
  if (!grupo) return true;
  let melhor = null;
  for (const r of grupo.regras) {
    if (!r.caminho) continue;
    const padrao = new RegExp(`^${r.caminho.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
    if (padrao.test(caminho) && (!melhor || r.caminho.length > melhor.caminho.length || (r.caminho.length === melhor.caminho.length && r.permitir))) melhor = r;
  }
  return melhor ? melhor.permitir : true;
}

/** Texto principal de uma página HTML estática (sem JavaScript). */
export function extrairConteudoHtml(html) {
  let h = String(html);
  const titulo = decodificarEntidades(
    (h.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1])
    || (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || '',
  ).replace(/\s+/g, ' ').trim();
  h = h.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const principal = h.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || h.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    || h.match(/<body\b[\s\S]*?<\/body>/i)?.[0] || h;
  const texto = decodificarEntidades(principal
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/blockquote|\/pre)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean)
    .filter((l) => l.split(' ').length >= 3 || l.startsWith('•'))
    .join('\n');
  return { titulo, texto };
}

export async function extrairPagina(url) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error(t('Informe uma URL válida (começando com http:// ou https://).'));
  try {
    const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'User-Agent': AGENTE_WEB }, signal: AbortSignal.timeout(10_000) });
    if (r.ok && !permitidoPorRobots(await r.text(), AGENTE_WEB, `${u.pathname}${u.search}`)) {
      const e = new Error(t('robots.txt de {host} não permite acesso automatizado a esta página.', { host: u.host }));
      e.esperado = true;
      throw e;
    }
  } catch (e) {
    if (e.esperado) throw e; // robots.txt inacessível = permitido (mesmo padrão do RobotFileParser)
  }
  const resp = await fetch(u, { headers: { 'User-Agent': AGENTE_WEB }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(t('A página respondeu com erro HTTP {status}.', { status: resp.status }));
  const { titulo, texto } = extrairConteudoHtml(await resp.text());
  if (!texto.trim()) {
    const e = new Error(t('Não foi possível extrair conteúdo legível desta página — pode exigir JavaScript para renderizar (não suportado nesta versão).'));
    e.esperado = true;
    throw e;
  }
  const final = new URL(resp.url || u);
  return { titulo: titulo || final.host, texto, url: final.toString(), hostname: final.host };
}
