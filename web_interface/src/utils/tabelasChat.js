/**
 * @file tabelasChat.js
 * @description Tabelas Markdown (GFM) nas respostas do assistente: saneamento
 *   determinístico do que o modelo gera, anotação de colunas numéricas para o
 *   renderer e serialização (CSV / payload de planilha).
 * @module utils/tabelasChat
 * @author CriAugu <tusab@tusab.solutions>
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 *
 * Por que no frontend (e não só em agent/chat.py::_normalizar_tabelas):
 * a normalização do backend só roda em chat() síncrono e no caminho Ollama
 * bufferizado — Groq/OpenAI/Anthropic/Gemini (e Ollama com "Mostrar
 * raciocínio") emitem tokens crus direto pro stream, e conversas antigas
 * reabertas do histórico nunca passaram por ela. Normalizar na renderização
 * cobre todos os provedores e o histórico, e não altera o texto persistido.
 * Funções puras — testadas com `node --test` (tabelasChat.test.js), sem
 * dependência nova.
 */

// ─── Parsing de linhas de tabela ─────────────────────────────────────────────

const RE_FENCE = /^\s*(```|~~~)/;

/** Divide uma linha de tabela em células, respeitando pipes escapados (\|). */
export function dividirCelulas(linha) {
  let t = linha.trim();
  const celulas = [];
  let atual = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '\\' && t[i + 1] === '|') {
      atual += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      celulas.push(atual);
      atual = '';
      continue;
    }
    atual += ch;
  }
  celulas.push(atual);
  // "| a | b |" → ['', ' a ', ' b ', ''] — pipes das pontas não criam célula
  if (t.startsWith('|')) celulas.shift();
  if (t.endsWith('|') && !t.endsWith('\\|') && celulas.length > 0) celulas.pop();
  return celulas.map(c => c.trim());
}

/** Quantidade de pipes não escapados na linha. */
function contarPipes(linha) {
  let n = 0;
  for (let i = 0; i < linha.length; i++) {
    if (linha[i] === '\\' && linha[i + 1] === '|') { i++; continue; }
    if (linha[i] === '|') n++;
  }
  return n;
}

/**
 * Linha separadora GFM ("|---|:---:|"). `minTracos` = 1 é o mínimo do GFM
 * (usado logo abaixo do cabeçalho); 3 é usado no meio da tabela, onde uma
 * linha "| - | - |" pode ser dado legítimo (valor ausente), não separador.
 */
export function ehSeparador(linha, minTracos = 1) {
  const t = linha.trim();
  if (!t.includes('-')) return false;
  if (!/^\|?[\s:|-]+\|?$/.test(t)) return false;
  const celulas = dividirCelulas(t);
  if (celulas.length === 0) return false;
  const re = new RegExp(`^:?-{${minTracos},}:?$`);
  return celulas.every(c => re.test(c));
}

function alinhamentoDe(celulaSep) {
  const c = celulaSep.trim();
  if (c.startsWith(':') && c.endsWith(':')) return ':---:';
  if (c.endsWith(':')) return '---:';
  if (c.startsWith(':')) return ':---';
  return '---';
}

// ─── Pré-processamento: tabelas coladas numa linha só ────────────────────────

/**
 * Modelos pequenos às vezes geram a tabela inteira numa linha
 * ("Dados: | A | B || --- | --- || 1 | 2 |") ou colam a tabela no fim de uma
 * frase ("Veja a comparação: | A | B |"). Só age quando a evidência é
 * inequívoca: separador colado ("||---") ou texto terminado em pontuação
 * antes do primeiro pipe, seguido de uma linha de tabela/separador.
 */
function descolarLinhas(linhas) {
  const saida = [];
  let emCodigo = false;
  for (let idx = 0; idx < linhas.length; idx++) {
    const linha = linhas[idx];
    if (RE_FENCE.test(linha)) { emCodigo = !emCodigo; saida.push(linha); continue; }
    if (emCodigo || !linha.includes('|')) { saida.push(linha); continue; }

    let resto = linha;
    // 1) Texto + tabela colados: "Veja: | A | B |" — só separa quando o texto
    //    antes do pipe termina em pontuação de frase (um cabeçalho sem pipe
    //    inicial, "A | B", é GFM válido e não pode ser quebrado).
    const iPipe = resto.indexOf('|');
    const prefixo = resto.slice(0, iPipe);
    const proxima = (linhas[idx + 1] || '').trim();
    const linhaTemSeparadorColado = /\|\s*\|\s*:?-{3,}/.test(resto);
    if (iPipe > 0 && /[:.!?]\s*$/.test(prefixo) && prefixo.trim().length > 0 &&
        (linhaTemSeparadorColado || ehSeparador(proxima) || proxima.startsWith('|'))) {
      saida.push(prefixo.trimEnd());
      saida.push('');
      resto = resto.slice(iPipe);
    }

    // 2) Linhas coladas com separador: "| A | B || --- | --- || 1 | 2 |"
    if (linhaTemSeparadorColado) {
      const partes = resto.split(/\|\|/);
      const linhasTabela = partes.map((p, i) => {
        let s = p.trim();
        if (i > 0) s = '|' + s;
        if (i < partes.length - 1) s = s + '|';
        return s;
      });
      // Texto colado depois da última linha: "| 1 | 2 |Os resultados..."
      const ultima = linhasTabela[linhasTabela.length - 1];
      const m = ultima.match(/^(\|.*\|)\s*([^|]*[A-Za-zÀ-ú][^|]*)$/);
      if (m && m[2].trim().split(/\s+/).length >= 2) {
        linhasTabela[linhasTabela.length - 1] = m[1];
        saida.push(...linhasTabela, '', m[2].trim());
      } else {
        saida.push(...linhasTabela);
      }
      continue;
    }
    saida.push(resto);
  }
  return saida;
}

// ─── Normalizador principal ──────────────────────────────────────────────────

function linhaCandidata(linhas, i) {
  const t = linhas[i].trim();
  if (!t || contarPipes(t) === 0) return false;
  if (ehSeparador(t)) return true;
  if (t.startsWith('|') || (t.endsWith('|') && !t.endsWith('\\|'))) return true;
  // Cabeçalho/linha sem pipes nas pontas ("A | B") só conta se vizinho de separador
  const vizinhos = [linhas[i - 1], linhas[i + 1]].filter(v => v !== undefined);
  return vizinhos.some(v => ehSeparador(v));
}

function moda(numeros) {
  const cont = new Map();
  for (const n of numeros) cont.set(n, (cont.get(n) || 0) + 1);
  let melhor = null, freq = 0;
  for (const [n, f] of cont) if (f > freq || (f === freq && n > melhor)) { melhor = n; freq = f; }
  return melhor;
}

/** Reconstrói um bloco de linhas de tabela em GFM bem formado. */
function reconstruirBloco(blocoLinhas) {
  // Separador "oficial" = o primeiro, desde que venha logo após a 1ª linha
  // de conteúdo; separadores no meio (≥3 traços) são erro do modelo e saem.
  let alinhamentos = null;
  const linhasConteudo = [];
  blocoLinhas.forEach((l, i) => {
    const sepAqui = linhasConteudo.length <= 1 && alinhamentos === null
      ? ehSeparador(l, 1)
      : ehSeparador(l, 3);
    if (sepAqui) {
      if (alinhamentos === null) alinhamentos = dividirCelulas(l).map(alinhamentoDe);
      return;
    }
    linhasConteudo.push(dividirCelulas(l));
  });
  // Linha só com vazios/traços ("| | --- | --- |", "|  |  |  |") não é dado:
  // achado real (llama3.2:1b, 20/out/2026) — o modelo pôs um "cabeçalho" de
  // traços, o separador, e só então o cabeçalho de verdade; e fechou a tabela
  // com uma linha toda vazia. Descartadas antes de escolher o cabeçalho.
  const ehLixo = (cels) => cels.every(c => c === '' || /^:?-{3,}:?$/.test(c));
  const uteis = linhasConteudo.filter(r => !ehLixo(r));
  if (uteis.length === 0) return blocoLinhas;

  const cabecalho = uteis[0];
  const corpo = uteis.slice(1);
  const nCab = cabecalho.length;
  // Pipe sobrando no fim ("| 4 | 5 | 6 | |") gera célula vazia que não conta
  // como coluna real na hora de decidir a largura da tabela.
  const largEfetiva = (r) => { let k = r.length; while (k > 1 && r[k - 1] === '') k--; return k; };
  const modaCorpo = corpo.length ? moda(corpo.map(largEfetiva)) : nCab;
  const n = Math.max(nCab, modaCorpo || 0, 1);

  const ajustar = (cels) => {
    let r = cels.slice();
    if (r.length > n) {
      const extras = r.slice(n);
      r = r.slice(0, n);
      // Excedente vazio é só pipe sobrando; excedente com conteúdo é anexado
      // à última célula pra não perder dado.
      const comConteudo = extras.filter(c => c !== '');
      if (comConteudo.length) r[n - 1] = [r[n - 1], ...comConteudo].filter(Boolean).join('; ');
    }
    while (r.length < n) r.push('');
    return r;
  };

  const linhaMd = (cels) => '| ' + cels.join(' | ') + ' |';
  const alin = Array.from({ length: n }, (_, i) =>
    (alinhamentos && alinhamentos.length === n && alinhamentos[i]) || '---');

  return [linhaMd(ajustar(cabecalho)), '| ' + alin.join(' | ') + ' |', ...corpo.map(r => linhaMd(ajustar(r)))];
}

/**
 * Saneia tabelas Markdown geradas pelo modelo, sem tocar no texto que não é
 * tabela: separador ausente, nº de colunas divergente (completa com vazio /
 * corta excedente vazio), pipes das pontas ausentes, separadores repetidos no
 * meio, tabela colada no parágrafo anterior/seguinte e linhas coladas numa só.
 * Idempotente — aplicar duas vezes dá o mesmo resultado.
 */
/**
 * Separador partido por linha em branco — achado real (gemma3:4b, 21/out/2026):
 * "|---------------\n\n|-----------|------|". Junta o pedaço sem pipe final
 * com o próximo pedaço de separador, pulando as linhas em branco do meio.
 */
function juntarSeparadorPartido(linhas) {
  const saida = [];
  for (let i = 0; i < linhas.length; i++) {
    const t = linhas[i].trim();
    if (/^\|[\s:|-]*-[\s:|-]*$/.test(t) && !t.endsWith('|')) {
      let j = i + 1;
      while (j < linhas.length && linhas[j].trim() === '') j++;
      const prox = (linhas[j] || '').trim();
      if (j > i + 1 && /^[\s:|-]*-[\s:|-]*$/.test(prox)) {
        saida.push(t + prox);
        i = j;
        continue;
      }
    }
    saida.push(linhas[i]);
  }
  return saida;
}

export function normalizarTabelasMarkdown(texto) {
  if (!texto || !texto.includes('|')) return texto;
  const linhas = descolarLinhas(juntarSeparadorPartido(texto.split('\n')));
  const saida = [];
  let emCodigo = false;
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (RE_FENCE.test(l)) { emCodigo = !emCodigo; saida.push(l); i++; continue; }
    if (emCodigo || !linhaCandidata(linhas, i)) { saida.push(l); i++; continue; }

    let j = i;
    let blocoTemSeparador = false;
    while (j < linhas.length && !RE_FENCE.test(linhas[j])) {
      const lj = linhas[j];
      // Depois do separador, qualquer linha com pipe continua a tabela
      // ("Café | 12,90" sem pipes nas pontas) — mesmo comportamento do GFM.
      const continua = linhaCandidata(linhas, j) ||
        (blocoTemSeparador && lj.trim() !== '' && contarPipes(lj) > 0);
      if (!continua) break;
      if (ehSeparador(lj)) blocoTemSeparador = true;
      j++;
    }
    const bloco = linhas.slice(i, j);
    const temSeparador = bloco.some(b => ehSeparador(b));
    // Uma linha solta com pipes (sem separador) não é tabela — deixa como está.
    if (bloco.length < 2 && !temSeparador) { saida.push(...bloco); i = j; continue; }
    if (bloco.length < 2) { saida.push(...bloco); i = j; continue; }

    const tabela = reconstruirBloco(bloco);
    // Linha em branco antes e depois: no GFM uma linha de texto logo após a
    // tabela vira mais uma linha da tabela, e texto logo antes impede o parse.
    if (saida.length && saida[saida.length - 1].trim() !== '') saida.push('');
    saida.push(...tabela);
    if (j < linhas.length && linhas[j].trim() !== '') saida.push('');
    i = j;
  }
  return saida.join('\n');
}

/** true se o texto (já normalizado ou não) contém ao menos uma tabela GFM. */
export function contemTabela(texto) {
  if (!texto || !texto.includes('|')) return false;
  const linhas = normalizarTabelasMarkdown(texto).split('\n');
  for (let i = 1; i < linhas.length; i++) {
    if (ehSeparador(linhas[i]) && contarPipes(linhas[i - 1]) > 0) return true;
  }
  return false;
}

// ─── Números ─────────────────────────────────────────────────────────────────

const RE_MOEDA = /^(R\$|US\$|U\$|\$|€|£|¥)\s*/i;
const PLACEHOLDERS = new Set(['', '-', '—', '–', 'n/d', 'n/a', 'nd', 'na', 's/d', '?']);

/** Heurística de exibição: a célula é um número (com moeda/%/separadores)? */
export function pareceNumero(texto) {
  let s = String(texto || '').trim().replace(/\*\*/g, '');
  if (!s) return false;
  s = s.replace(/^[(]/, '').replace(/[)]$/, '');
  s = s.replace(/^[-−+]\s*/, '');
  s = s.replace(RE_MOEDA, '');
  s = s.replace(/^[-−]\s*/, '');
  s = s.replace(/\s*%$/, '');
  return /^(\d{1,3}([.,\s ]\d{3})+|\d+)([.,]\d+)?$/.test(s);
}

export function ehPlaceholder(texto) {
  return PLACEHOLDERS.has(String(texto || '').trim().toLowerCase());
}

// ─── Plugin rehype: anota colunas numéricas e índice das tabelas ─────────────

function textoHast(no) {
  if (!no) return '';
  if (no.type === 'text') return no.value || '';
  return (no.children || []).map(textoHast).join('');
}

function filhosElemento(no, tag) {
  return (no.children || []).filter(c => c.type === 'element' && (!tag || c.tagName === tag));
}

/**
 * Plugin rehype (sem dependência): para cada <table>, marca as células de
 * colunas numéricas com `dataNumerico` (o renderer alinha à direita com
 * tabular-nums) e grava `dataTabelaIndice` / `dataTabelaTotal` na tabela.
 * Coluna é numérica se todas as células não-vazias do corpo são números
 * (placeholders como "-" e "n/d" são ignorados) e há ao menos um número.
 */
export function rehypeTabelasChat() {
  return (arvore) => {
    const tabelas = [];
    const visitar = (no) => {
      if (no.type === 'element' && no.tagName === 'table') tabelas.push(no);
      (no.children || []).forEach(visitar);
    };
    visitar(arvore);
    tabelas.forEach((tabela, idx) => {
      tabela.properties = { ...(tabela.properties || {}), dataTabelaIndice: idx, dataTabelaTotal: tabelas.length };
      const linhasCabecalho = [];
      const linhasCorpo = [];
      for (const secao of filhosElemento(tabela)) {
        const trs = secao.tagName === 'tr' ? [secao] : filhosElemento(secao, 'tr');
        (secao.tagName === 'thead' ? linhasCabecalho : linhasCorpo).push(...trs);
      }
      const nCols = Math.max(0, ...[...linhasCabecalho, ...linhasCorpo].map(tr => filhosElemento(tr).length));
      for (let c = 0; c < nCols; c++) {
        let numeros = 0, outros = 0;
        for (const tr of linhasCorpo) {
          const cel = filhosElemento(tr)[c];
          const txt = textoHast(cel).trim();
          if (ehPlaceholder(txt)) continue;
          if (pareceNumero(txt)) numeros++; else outros++;
        }
        // Coluna numérica = só números E números em pelo menos metade das
        // linhas — uma célula "34%" numa coluna quase toda vazia (rótulo que o
        // modelo esqueceu de preencher) não pode alinhar a coluna à direita.
        if (numeros === 0 || outros > 0 || numeros * 2 < linhasCorpo.length) continue;
        for (const tr of [...linhasCabecalho, ...linhasCorpo]) {
          const cel = filhosElemento(tr)[c];
          if (cel) cel.properties = { ...(cel.properties || {}), dataNumerico: 'true' };
        }
      }
    });
  };
}

// ─── Extração / serialização ─────────────────────────────────────────────────

/** Lê um <table> do DOM → { cabecalho: string[], linhas: string[][] }. */
export function lerTabelaDom(tabelaEl) {
  const trs = Array.from(tabelaEl?.rows || []);
  const textos = trs.map(tr => Array.from(tr.cells).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()));
  if (textos.length === 0) return { cabecalho: [], linhas: [] };
  return { cabecalho: textos[0], linhas: textos.slice(1) };
}

function escaparCsv(valor) {
  let v = String(valor ?? '');
  // Neutraliza injeção de fórmula ao colar no Excel/Sheets ("=HYPERLINK(...)").
  // "-12" e "+5" continuam números; só prefixa quando não é número.
  if (/^[=@]/.test(v) || (/^[+-]/.test(v) && !pareceNumero(v))) v = "'" + v;
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Serializa { cabecalho, linhas } como CSV (RFC 4180, separador vírgula). */
export function tabelaParaCsv({ cabecalho = [], linhas = [] }) {
  return [cabecalho, ...linhas].map(r => r.map(escaparCsv).join(',')).join('\r\n');
}

/** "Compare os preços de 2024!" → "compare-os-precos-de-2024" (máx. 40 chars). */
export function slugAssunto(texto, max = 40) {
  const s = String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/g, '');
}

/** Nome do arquivo da planilha: tusab_<assunto>_<AAAA-MM-DD>.xlsx */
export function nomeArquivoPlanilha(assunto, data = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const dia = `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
  const slug = slugAssunto(assunto) || 'tabela';
  return `tusab_${slug}_${dia}.xlsx`;
}
