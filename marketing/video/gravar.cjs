// Grava o vídeo de divulgação do Tusab: cartões de marca + o app REAL em uso.
// Uso (backend já rodando em 127.0.0.1:8001 com TUSAB_DATA_DIR temporário):
//   node gravar.cjs                 grava tudo
//   ONLY=cartoes node gravar.cjs    só os cartões
//   ONLY=app     node gravar.cjs    só as cenas do app
//   SONDAR=1     node gravar.cjs    lista botões/campos visíveis (para depurar seletores)
// Saída: saida/clips/<nome>.mp4 (um por cena). A ordem final é definida em montar.cjs.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const puppeteer = require('D:/Tusab/web_interface/node_modules/puppeteer');

const API = 'http://127.0.0.1:8001';
const OUT = path.join(__dirname, 'saida', 'clips');
fs.mkdirSync(OUT, { recursive: true });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ─── Gravação: frames do CDP (resolução real do dpr) → mp4 ───────────────────
async function gravar(page, nome, { speed = 1, w = 1920, h = 1080 } = {}) {
  const cdp = await page.createCDPSession();
  const dir = path.join(OUT, `${nome}_frames`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  cdp.on('Page.screencastFrame', async (ev) => {
    const f = path.join(dir, String(frames.length).padStart(6, '0') + '.jpg');
    fs.writeFileSync(f, Buffer.from(ev.data, 'base64'));
    frames.push({ f, ts: ev.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  return {
    async parar() {
      const fim = Date.now() / 1000;
      await cdp.send('Page.stopScreencast'); await dorme(300); await cdp.detach().catch(() => {});
      if (!frames.length) throw new Error(`clip ${nome}: nenhum frame gravado`);
      const linhas = ['ffconcat version 1.0'];
      frames.forEach((fr, i) => {
        const prox = i + 1 < frames.length ? frames[i + 1].ts : Math.max(fim, fr.ts + 0.04);
        linhas.push(`file '${fr.f.replace(/\\/g, '/')}'`, `duration ${Math.max(0.01, prox - fr.ts).toFixed(4)}`);
      });
      linhas.push(`file '${frames[frames.length - 1].f.replace(/\\/g, '/')}'`);
      const lista = path.join(dir, 'lista.txt');
      fs.writeFileSync(lista, linhas.join('\n'));
      const saida = path.join(OUT, `${nome}.mp4`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
        '-vf', `setpts=PTS/${speed},fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-movflags', '+faststart', saida]);
      const n = frames.length;
      fs.rmSync(dir, { recursive: true, force: true });
      log(`  ✔ ${nome}.mp4 (${n} frames${speed !== 1 ? `, ${speed}x` : ''})`);
    },
  };
}

// ─── Overlay: cursor animado, ondulação de clique e legenda ──────────────────
const OVERLAY = `(() => {
  if (document.getElementById('fc-wrap')) return;
  const w = document.createElement('div'); w.id = 'fc-wrap';
  w.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  w.innerHTML = \`<style>
    #fc{position:fixed;left:0;top:0;width:34px;height:34px;transform:translate(780px,460px);
        transition:transform .7s cubic-bezier(.25,.8,.25,1);filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));opacity:0}
    #fr{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #4B9FE8;
        background:rgba(75,159,232,.25);opacity:0;pointer-events:none}
    #fr.on{animation:rip .55s ease-out}
    @keyframes rip{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(3.2)}}
    #fl{position:fixed;left:50%;bottom:34px;transform:translate(-50%,16px);max-width:1180px;text-align:center;
        background:rgba(11,18,32,.9);border:1.5px solid rgba(75,159,232,.55);border-radius:16px;padding:12px 26px;
        font:700 29px/1.25 'Segoe UI',Arial,sans-serif;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.45);
        opacity:0;transition:opacity .35s,transform .35s}
    #fl.on{opacity:1;transform:translate(-50%,0)}
    #fl b{color:#4B9FE8} #fl i{color:#10B981;font-style:normal}
  </style>
  <svg id="fc" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.7-7.6L21 10.7z" fill="#fff" stroke="#0B1220" stroke-width="1.6" stroke-linejoin="round"/></svg>
  <div id="fr"></div><div id="fl"></div>\`;
  document.documentElement.appendChild(w);
  // Esconde o aviso de memória: reflete a carga da máquina de gravação, não o produto.
  // Estrutura exata (ChatDrawer.jsx, resource_overload_hint): <div><svg/><span>texto</span></div>.
  // Esconde SÓ essa caixa — nunca um ancestral, que pode ser o balão da resposta.
  const esconderAviso = () => {
    document.querySelectorAll('span').forEach((sp) => {
      if (sp.children.length || !/Sua mem[óo]ria est[áa] em/.test(sp.textContent)) return;
      const caixa = sp.parentElement;
      if (caixa && caixa.children.length === 2 && caixa.firstElementChild.tagName.toLowerCase() === 'svg') caixa.style.display = 'none';
    });
  };
  new MutationObserver(esconderAviso).observe(document.body, { childList: true, subtree: true, characterData: true });
})()`;

async function legenda(page, html) {
  await page.evaluate((h) => {
    const l = document.getElementById('fl'); if (!l) return;
    if (!h) { l.classList.remove('on'); return; }
    l.innerHTML = h; l.classList.add('on');
  }, html);
}

async function cursorPara(page, x, y) {
  await page.evaluate((x, y) => {
    const c = document.getElementById('fc'); c.style.opacity = 1; c.style.transform = `translate(${x - 4}px,${y - 3}px)`;
  }, x, y);
  await dorme(780);
  await page.mouse.move(x, y, { steps: 4 });
}

async function ondulacao(page, x, y) {
  await page.evaluate((x, y) => {
    const r = document.getElementById('fr'); r.style.left = x + 'px'; r.style.top = y + 'px';
    r.classList.remove('on'); void r.offsetWidth; r.classList.add('on');
  }, x, y);
}

async function achar(page, re, { escopo = null, sel = 'button, a, [role="tab"], [role="button"], label, summary', ms = 20000 } = {}) {
  const h = await page.waitForFunction((src, esc, sel) => {
    const r = new RegExp(src, 'i');
    const raiz = esc ? document.querySelector(esc) : document;
    if (!raiz) return false;
    const el = [...raiz.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && e.offsetParent !== null
        && r.test(((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || '')).trim());
    });
    return el || false;
  }, { timeout: ms }, re.source, escopo, sel);
  return h.asElement();
}

async function clicar(page, re, opts = {}) {
  const el = await achar(page, re, opts);
  if (!el) throw new Error('alvo ausente: ' + re);
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await dorme(250);
  const b = await el.boundingBox();
  const x = b.x + Math.min(b.width / 2, opts.xmax ?? 150), y = b.y + b.height / 2;
  await cursorPara(page, x, y);
  await ondulacao(page, x, y);
  await dorme(140);
  await page.mouse.click(x, y);
  await dorme(opts.depois ?? 700);
}

async function digitar(page, seletor, texto, { atraso = 62, depois = 500, limpar = false } = {}) {
  const el = await page.waitForSelector(seletor, { visible: true, timeout: 15000 });
  const b = await el.boundingBox();
  const x = b.x + Math.min(b.width / 2, 120), y = b.y + b.height / 2;
  await cursorPara(page, x, y); await ondulacao(page, x, y); await dorme(120);
  await page.mouse.click(x, y);
  if (limpar) { await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await dorme(150); }
  await page.keyboard.type(texto, { delay: atraso });
  await dorme(depois);
}

async function abrir(page, hash = '') {
  await page.goto(API + '/' + hash, { waitUntil: 'networkidle2', timeout: 60000 });
  await dorme(1200);
  await page.evaluate(OVERLAY);
}

async function novaPagina(browser, { tema = 'dark', perfil = 'professor' } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1.25 });
  await page.evaluateOnNewDocument((tema, perfil) => {
    localStorage.setItem('tusab_onboarded', '1');
    localStorage.setItem('tusab_perfil', perfil);
    localStorage.setItem('tusab_analytics_consent', 'no');
    localStorage.setItem('tusab_theme', tema);
  }, tema, perfil);
  await page.setBypassCSP?.(true);
  return page;
}

async function esperarFim(page, condicao, { ms = 240000, passo = 1500 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(condicao)) return true;
    await dorme(passo);
  }
  return false;
}

// Espera a resposta do chat terminar: o texto da página para de crescer por `estavel` ms
// (e, se informado, `exige` precisa estar presente).
async function esperarEstavel(page, { exige = null, estavel = 6000, ms = 300000 } = {}) {
  const t0 = Date.now(); let ultimo = -1, desde = Date.now();
  while (Date.now() - t0 < ms) {
    const [len, ok] = await page.evaluate((ex) => [document.body.innerText.length, ex ? !!document.querySelector(ex) : true], exige);
    if (len !== ultimo) { ultimo = len; desde = Date.now(); }
    else if (ok && Date.now() - desde >= estavel) return true;
    await dorme(1000);
  }
  return false;
}

// Espera a n-ésima resposta COMPLETA do assistente: "Esta resposta foi útil?" só aparece depois que o
// streaming termina (texto estável não serve: fica parado enquanto o modelo ainda lê a base).
async function esperarResposta(page, n, exige = null, ms = 360000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await page.evaluate((n, ex) => (document.body.innerText.match(/Esta resposta foi [úu]til/g) || []).length >= n && (!ex || !!document.querySelector(ex)), n, exige);
    if (ok) { await dorme(2500); return true; }
    await dorme(1500);
  }
  return false;
}

const get = async (p) => (await fetch(API + p)).json();
const post = async (p, corpo) => (await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })).json();

async function esperarIndexacao(projeto, ms = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await get(`/agent/status?canal=${encodeURIComponent(projeto)}`);
    if (!s.indexing && (s.canais_indexados || []).some((c) => c.nome === projeto)) return true;
    await dorme(2500);
  }
  return false;
}

// ─── Cartões de marca ────────────────────────────────────────────────────────
async function cartoes(browser) {
  const lista = { abertura: 6.2, virada: 4.2, logo: 5.2, numeros: 4.6, privacidade: 5.4, perfis: 5.6, cta: 6.4 };
  for (const [nome, seg] of Object.entries(lista)) {
    if (process.env.CARDS && !process.env.CARDS.split(',').includes(nome)) continue;
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto('file:///D:/Tusab/marketing/video/cartoes.html#' + nome, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    const rec = await gravar(page, `card_${nome}`);
    await dorme(seg * 1000);
    await rec.parar();
    await page.close();
  }
}

// ─── Cenas do app ────────────────────────────────────────────────────────────
async function sondar(browser) {
  const page = await novaPagina(browser);
  await abrir(page);
  const listar = () => page.evaluate(() => ({
    botoes: [...document.querySelectorAll('button,[role=button],a,label')].filter((e) => e.offsetParent !== null)
      .map((e) => ((e.getAttribute('aria-label') || '') + ' | ' + (e.innerText || '')).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
    campos: [...document.querySelectorAll('input,textarea')].filter((e) => e.offsetParent !== null)
      .map((e) => `${e.tagName} type=${e.type} ph="${e.placeholder}"`).slice(0, 12),
  }));
  log('HOME:', JSON.stringify(await listar(), null, 1));
  await clicar(page, /Canal YouTube/);
  log('APOS CANAL YOUTUBE:', JSON.stringify(await listar(), null, 1));
  await page.close();
}

const PROJ = 'Alfabetização';

// Cenas do chat: painel EXPANDIDO (tela cheia), para o texto ficar legível no vídeo.
async function chat(page) {
  let rec;
  // 7) Chat — pergunta 1
  rec = await gravar(page, 'app_07_chat_pergunta');
  await legenda(page, null);
  await clicar(page, /Abrir chat com o assistente/, { depois: 1400 });
  // Com mais de um projeto o chat pede a base antes de conversar.
  const painelBase = () => page.evaluate(() => /Selecione as bases para a conversa/.test(document.body.innerText));
  if (await painelBase()) {
    await clicar(page, new RegExp('^@' + PROJ.slice(0, 6)), { sel: 'div, span, p', depois: 700 });
    if (await painelBase()) {   // plano B: o quadradinho de marcar, à direita da linha
      const alvo = await achar(page, new RegExp('^@' + PROJ.slice(0, 6)), { sel: 'div, span, p' });
      const b = await alvo.boundingBox();
      await page.mouse.click(1433, b.y + b.height / 2); await dorme(700);
    }
    await clicar(page, /^\s*Confirmar\s*$/, { depois: 1500 });
    log('  base selecionada, painel ainda aberto?', await painelBase());
  }
  await clicar(page, /Expandir chat/, { depois: 1300 }).catch((e) => log('  aviso: expandir chat:', e.message));
  if (process.env.DRY) { await page.screenshot({ path: path.join(__dirname, 'saida', 'dry.png') }); await rec.parar(); return; }
  await legenda(page, 'Pergunte em <b>linguagem natural</b>');
  await digitar(page, 'textarea', 'Quais abordagens de alfabetização aparecem nas teses e artigos da base?', { atraso: 38, depois: 600 });
  await page.keyboard.press('Enter');
  await dorme(1200);
  await rec.parar();

  rec = await gravar(page, 'app_08_chat_espera', { speed: 5 });
  await legenda(page, 'O assistente lê <b>a sua base</b>…');
  const fim1 = await esperarResposta(page, 1);
  log('  resposta 1:', fim1);
  await rec.parar();

  rec = await gravar(page, 'app_09_chat_resposta');
  await legenda(page, 'Cada resposta traz a <b>fonte</b>');
  await dorme(3800);
  await rec.parar();

  // 8) Chat — pergunta 2 (tabela)
  rec = await gravar(page, 'app_10_chat_tabela_pergunta');
  await legenda(page, 'Peça uma <b>tabela</b>');
  await digitar(page, 'textarea', 'Monte numa tabela as abordagens de alfabetização da base: abordagem e ideia central.', { atraso: 38, depois: 500 });
  await page.keyboard.press('Enter');
  await dorme(1000);
  await rec.parar();

  rec = await gravar(page, 'app_11_chat_tabela_espera', { speed: 5 });
  await legenda(page, 'Organizando <b>em tabela</b>…');
  await esperarResposta(page, 2, 'table');
  await rec.parar();

  rec = await gravar(page, 'app_12_chat_planilha');
  await legenda(page, 'Tabela pronta — baixe como <b>planilha .xlsx</b>');
  await page.evaluate(() => [...document.querySelectorAll('table')].pop()?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await dorme(1800);
  await clicar(page, /Baixar planilha/, { depois: 1800 }).catch((e) => log('  aviso: botão de planilha:', e.message));
  await legenda(page, '<i>✔</i> Cabeçalho, filtros e números <b>prontos para usar</b>');
  await dorme(2200);
  await rec.parar();
}

async function cenasApp(browser) {
  await post('/agent/config', { provider: 'ollama', api_key: '', ollama_model: 'gemma3:4b' });
  const page = await novaPagina(browser);

  // 1) Home
  await abrir(page);
  let rec = await gravar(page, 'app_01_home');
  await legenda(page, 'Escolha como <b>começar</b>');
  await dorme(900);
  for (const re of [/Canal YouTube/, /Reposit[oó]rio/]) {
    const el = await achar(page, re); const b = await el.boundingBox();
    await cursorPara(page, b.x + b.width / 2, b.y + b.height / 2); await dorme(500);
  }
  await dorme(700);
  await rec.parar();

  // 2) YouTube
  rec = await gravar(page, 'app_02_youtube');
  await legenda(page, null);
  await clicar(page, /Canal YouTube/, { depois: 1200 });
  await legenda(page, 'Cole o link de um <b>canal do YouTube</b>');
  await digitar(page, 'input[placeholder*="youtube.com" i]', 'https://www.youtube.com/@canal-de-aulas', { atraso: 55, depois: 1300 });
  await legenda(page, 'As transcrições viram uma <b>base pesquisável</b>');
  await dorme(2300);
  await rec.parar();

  // 3) Base pública + áreas
  rec = await gravar(page, 'app_03_publica');
  await legenda(page, null);
  await clicar(page, /^\s*Base p[uú]blica/, { depois: 1000 });
  await legenda(page, 'Ou busque em <b>fontes públicas</b> — sem cadastro, sem chave');
  for (const re of [/Sa[uú]de, biologia/, /Direito, normas/, /Dados abertos e portais/]) {
    const el = await achar(page, re); const b = await el.boundingBox();
    await cursorPara(page, b.x + b.width / 2, b.y + b.height / 2); await dorme(650);
  }
  await dorme(500);
  await rec.parar();

  // 4) Educação: modal com filtros e várias fontes
  rec = await gravar(page, 'app_04_educacao');
  await legenda(page, 'Nova área: <b>Educação</b>');
  await clicar(page, /Educa[cç][aã]o, ensino/, { depois: 900 });
  await clicar(page, /Iniciar Extra/, { depois: 1200 });
  await legenda(page, 'Marque <b>várias fontes</b>. Filtre por país, tipo e instituição.');
  await clicar(page, /^\s*Brasil\s*$/, { depois: 700 });
  await clicar(page, /^\s*IBICT/, { escopo: '[aria-labelledby="fontes-legenda"]', depois: 600 });
  await clicar(page, /^\s*CAPES/, { escopo: '[aria-labelledby="fontes-legenda"]', depois: 900 });
  await legenda(page, 'Teses, artigos e material didático — <b>tudo de uma vez</b>');
  await digitar(page, 'input[placeholder^="Ex: transformer"]', 'alfabetização', { atraso: 75, depois: 900 });
  await clicar(page, /^\s*Pr[oó]ximo/, { depois: 900 });
  await digitar(page, 'input[placeholder^="Ex: FGV"]', PROJ, { atraso: 75, depois: 700, limpar: true });
  await clicar(page, /^\s*Pr[oó]ximo/, { depois: 900 });
  await page.evaluate(() => { const n = document.querySelector('input[type="number"]'); if (n) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(n, '3'); n.dispatchEvent(new Event('input', { bubbles: true })); } });
  await dorme(900);
  await rec.parar();

  // 5) Busca real (acelerada)
  rec = await gravar(page, 'app_05_busca', { speed: 5 });
  await legenda(page, 'Busca, baixa e <b>indexa</b> — automático');
  await clicar(page, /Buscar e indexar/, { depois: 1500 });
  const ok = await esperarFim(page, () => !!document.getElementById('summary-busca-heading'), { ms: 240000 });
  log('  busca educação concluída:', ok);
  await rec.parar();

  // 6) Resultado
  rec = await gravar(page, 'app_06_resultado');
  await legenda(page, 'Pronto: sua base está <b>indexada</b>');
  await page.evaluate(() => document.getElementById('summary-busca-heading')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await dorme(3200);
  await rec.parar();
  log('  aguardando reindexação…', await esperarIndexacao(PROJ));

  await chat(page);
  await page.close();
}

async function soChat(browser) {
  await post('/agent/config', { provider: 'ollama', api_key: '', ollama_model: 'gemma3:4b' });
  const page = await novaPagina(browser);
  await abrir(page);
  await clicar(page, /Canal YouTube/, { depois: 1000 });
  await post('/agent/chat/clear', { projeto_nome: PROJ }).catch(() => {});
  await chat(page);
  await page.close();
}

async function cenasDados(browser) {
  const page = await novaPagina(browser);
  await abrir(page);
  await clicar(page, /Canal YouTube/, { depois: 1000 });
  await clicar(page, /^\s*Base p[uú]blica/, { depois: 800 });

  // Dados abertos
  let rec = await gravar(page, 'app_13_dados_modal');
  await legenda(page, 'E mais de <b>40 portais de dados abertos</b> do governo');
  await clicar(page, /Dados abertos e portais/, { depois: 900 });
  await clicar(page, /Iniciar Extra/, { depois: 1200 });
  await clicar(page, /^\s*Estados/, { escopo: '[aria-labelledby="fontes-legenda"]', depois: 900 });
  await legenda(page, 'Escolha <b>quais estados</b>, órgãos ou países consultar');
  for (const re of [/^Rio Grande do Sul$/, /^Minas Gerais$/]) {
    await clicar(page, re, { escopo: '[aria-label="Estados"]', depois: 500 }).catch(() => {});
  }
  await digitar(page, 'input[placeholder^="Ex: transformer"]', 'saneamento', { atraso: 75, depois: 800 });
  await clicar(page, /^\s*Pr[oó]ximo/, { depois: 800 });
  await digitar(page, 'input[placeholder^="Ex: FGV"]', 'Saneamento', { atraso: 75, depois: 600, limpar: true });
  await clicar(page, /^\s*Pr[oó]ximo/, { depois: 800 });
  await page.evaluate(() => { const n = document.querySelector('input[type="number"]'); if (n) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(n, '3'); n.dispatchEvent(new Event('input', { bubbles: true })); } });
  await dorme(700);
  await rec.parar();

  rec = await gravar(page, 'app_14_dados_busca', { speed: 5 });
  await legenda(page, 'Cada resultado traz a <b>lista de arquivos</b>: CSV, XLSX, ZIP…');
  await clicar(page, /Buscar e indexar/, { depois: 1500 });
  log('  busca dados abertos:', await esperarFim(page, () => !!document.getElementById('summary-busca-heading'), { ms: 240000 }));
  await rec.parar();

  rec = await gravar(page, 'app_15_dados_resultado');
  await page.evaluate(() => document.getElementById('summary-busca-heading')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await legenda(page, 'Base de <b>dados abertos</b> pronta');
  await dorme(2800);
  await rec.parar();

  // Jurisprudência
  rec = await gravar(page, 'app_16_juris');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await legenda(page, null);
  await clicar(page, /Direito, normas/, { depois: 900 });
  await clicar(page, /Iniciar Extra/, { depois: 1200 });
  await legenda(page, 'Jurisprudência do <b>STF, TCU e TST</b> — sem dados das partes');
  const el = await achar(page, /Tribunais e controle/, { escopo: '[aria-labelledby="fontes-legenda"]' });
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await dorme(3600);
  await rec.parar();
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  try {
    if (process.env.SONDAR) { await sondar(browser); return; }
    const so = process.env.ONLY || '';
    if (!so || so === 'cartoes') { log('# cartões'); await cartoes(browser); }
    if (!so || so === 'app') { log('# app'); await cenasApp(browser); }
    if (so === 'chat') { log('# chat'); await soChat(browser); }
    if (!so || so === 'dados') { log('# dados abertos'); await cenasDados(browser); }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
