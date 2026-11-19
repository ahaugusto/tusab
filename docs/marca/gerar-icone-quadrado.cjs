// Gera o ícone quadrado do Tusab a partir do logo redondo (logo_*_compact.svg):
// separa o desenho (Thoth + circuito + TUSAB) do fundo redondo e o recoloca num
// quadrado de cantos arredondados com o mesmo degradê.
// Os ícones da extensão (tusab-mcp/icon.png = escuro, icon-claro.png = claro) saíram daqui:
//   node docs/marca/gerar-icone-quadrado.cjs escuro tusab-mcp/icon.png 512
//   node docs/marca/gerar-icone-quadrado.cjs claro tusab-mcp/icon-claro.png 512
// Usa o puppeteer instalado em web_interface/ (dependência do pa11y-ci).
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '../../web_interface/node_modules/puppeteer'));

const [tema = 'escuro', saida, tam = '512'] = process.argv.slice(2);
const N = Number(tam);
const svg = fs.readFileSync(path.join(__dirname, '../../web_interface/public', `logo_${tema === 'escuro' ? 'dark' : 'light'}_compact.svg`), 'utf8');
const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const html = `<html><body style="margin:0;background:transparent">
<canvas id="c" width="${N}" height="${N}"></canvas>
<script>
const TEMA = ${JSON.stringify(tema)};
const N = ${N};
const img = new Image();
img.onload = () => {
  const G = 2048;                      // render grande do logo redondo
  const a = document.createElement('canvas'); a.width = a.height = G;
  const ax = a.getContext('2d');
  ax.drawImage(img, 0, 0, G, G);
  const d = ax.getImageData(0, 0, G, G);
  const p = d.data;
  // amostras do degradê do fundo (topo e base do círculo, fora do desenho)
  const cor = (x, y) => { const i = (y * G + x) * 4; return [p[i], p[i+1], p[i+2]]; };
  const topo = cor(G * 0.5 | 0, G * 0.03 | 0), base = cor(G * 0.5 | 0, G * 0.965 | 0);
  // desenho = pixels muito mais claros (tema escuro) ou muito mais escuros (tema claro) que o fundo
  const lum = (i) => 0.2126 * p[i] + 0.7152 * p[i+1] + 0.0722 * p[i+2];
  let x0 = G, y0 = G, x1 = 0, y1 = 0;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const i = (y * G + x) * 4;
    const l = lum(i);
    let al = TEMA === 'escuro' ? (l - 150) / 80 : (110 - l) / 80;
    al = Math.max(0, Math.min(1, al)) * (p[i+3] / 255);
    const v = TEMA === 'escuro' ? 255 : 0;
    p[i] = p[i+1] = p[i+2] = v; p[i+3] = Math.round(al * 255);
    if (al > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  ax.putImageData(d, 0, 0);
  // quadrado de cantos arredondados com o degradê original
  const c = document.getElementById('c'); const cx = c.getContext('2d');
  const r = N * 0.22;
  cx.beginPath(); cx.roundRect(0, 0, N, N, r); cx.closePath();
  const g = cx.createLinearGradient(0, 0, 0, N);
  g.addColorStop(0, 'rgb(' + topo.join(',') + ')'); g.addColorStop(1, 'rgb(' + base.join(',') + ')');
  cx.fillStyle = g; cx.fill();
  // desenho centralizado, ocupando 78% do lado
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const esc = (N * 0.78) / Math.max(w, h);
  const dw = w * esc, dh = h * esc;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(a, x0, y0, w, h, (N - dw) / 2, (N - dh) / 2, dw, dh);
  document.title = 'pronto';
};
img.src = ${JSON.stringify(src)};
</script></body></html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: N, height: N });
  await page.setContent(html);
  await page.waitForFunction(() => document.title === 'pronto', { timeout: 60000 });
  const el = await page.$('#c');
  await el.screenshot({ path: saida, omitBackground: true });
  await browser.close();
  console.log('ok', saida);
})().catch((e) => { console.error(e.message); process.exit(1); });
