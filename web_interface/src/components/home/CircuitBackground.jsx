import React, { useEffect, useRef } from 'react';

// ─── Parâmetros ───────────────────────────────────────────────────────────────
const GRID         = 48;
const LINE_ALPHA   = 0.12;
const NODE_R       = 2.2;
const NUM_PATHS    = 24;
const MIN_SEG      = 3;
const MAX_SEG      = 13;
const TURN_PROB    = 0.32;
const DIAG_PROB    = 0.22;  // chance de usar direção diagonal no próximo passo
const BRANCH_PROB  = 0.20;
const MAX_PULSES   = 14;
const PULSE_SPEED  = 2.4;   // px/frame
const PULSE_LEN    = 80;    // comprimento do rastro em px
const MOUSE_RADIUS = 140;   // raio de influência do mouse em px
const MOUSE_DECAY  = 0.06;  // velocidade de fade quando mouse para

// 8 direções: 4 ortogonais + 4 diagonais a 45°
// Diagonais usam GRID como passo em cada eixo (segmento ≈ GRID*√2)
const ORTHO = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
];
const DIAG = [
  { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
  { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
];
const ALL_DIRS = [...ORTHO, ...DIAG];

const segLen = d => (d.dx !== 0 && d.dy !== 0) ? GRID * Math.SQRT2 : GRID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snap(v) { return Math.round(v / GRID) * GRID; }

function colorWithAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

// ─── Geração de circuitos ─────────────────────────────────────────────────────

function buildCircuits(w, h) {
  const usedSegs = new Set();
  const segKey = (x1, y1, x2, y2) =>
    `${Math.min(x1,x2).toFixed(0)},${Math.min(y1,y2).toFixed(0)},${Math.max(x1,x2).toFixed(0)},${Math.max(y1,y2).toFixed(0)}`;

  const segments = []; // { x1,y1,x2,y2,len }
  const nodes    = new Map();
  const addNode  = (x, y) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (!nodes.has(k)) nodes.set(k, { x, y, count: 0 });
    nodes.get(k).count++;
  };

  // Direções perpendiculares (exclui reversa e a própria)
  const sideOpts = (d) => ALL_DIRS.filter(d2 =>
    !(d2.dx === -d.dx && d2.dy === -d.dy) && d2 !== d
  );

  const makePath = (sx, sy, initDir) => {
    let x = snap(sx), y = snap(sy);
    // escolhe direção inicial: ortogonal ou diagonal conforme DIAG_PROB
    let dir = initDir ?? (Math.random() < DIAG_PROB
      ? DIAG[Math.floor(Math.random() * DIAG.length)]
      : ORTHO[Math.floor(Math.random() * ORTHO.length)]);

    const segs = Math.floor(MIN_SEG + Math.random() * (MAX_SEG - MIN_SEG));
    for (let i = 0; i < segs; i++) {
      // chance de virar
      if (Math.random() < TURN_PROB) {
        const opts = sideOpts(dir);
        // nas viradas, tendência a voltar ao ortogonal após diagonal e vice-versa
        const isDiag = dir.dx !== 0 && dir.dy !== 0;
        const preferred = isDiag
          ? opts.filter(d => d.dx === 0 || d.dy === 0)
          : opts.filter(d => d.dx !== 0 && d.dy !== 0);
        dir = (preferred.length && Math.random() < 0.5)
          ? preferred[Math.floor(Math.random() * preferred.length)]
          : opts[Math.floor(Math.random() * opts.length)];
      }

      const nx = x + dir.dx * GRID;
      const ny = y + dir.dy * GRID;
      if (nx < 4 || ny < 4 || nx > w - 4 || ny > h - 4) break;

      const sk = segKey(x, y, nx, ny);
      if (!usedSegs.has(sk)) {
        usedSegs.add(sk);
        segments.push({ x1: x, y1: y, x2: nx, y2: ny, len: segLen(dir) });
        addNode(x, y);
        addNode(nx, ny);
      }
      x = nx; y = ny;
    }
    return { x, y };
  };

  for (let i = 0; i < NUM_PATHS; i++) {
    const sx = snap(GRID + Math.random() * (w - GRID * 2));
    const sy = snap(GRID + Math.random() * (h - GRID * 2));
    const end = makePath(sx, sy, null);
    if (Math.random() < BRANCH_PROB) makePath(end.x, end.y, null);
  }

  // Adjacência para os pulsos — guarda também o comprimento real do segmento
  const nodeMap = {};
  segments.forEach(s => {
    const ka = `${Math.round(s.x1)},${Math.round(s.y1)}`;
    const kb = `${Math.round(s.x2)},${Math.round(s.y2)}`;
    if (!nodeMap[ka]) nodeMap[ka] = { x: s.x1, y: s.y1, adj: [] };
    if (!nodeMap[kb]) nodeMap[kb] = { x: s.x2, y: s.y2, adj: [] };
    nodeMap[ka].adj.push({ key: kb, len: s.len });
    nodeMap[kb].adj.push({ key: ka, len: s.len });
  });

  return { segments, nodes, nodeMap };
}

// ─── Pulsos ───────────────────────────────────────────────────────────────────

function pickPulse(nodeMap) {
  const keys = Object.keys(nodeMap);
  if (!keys.length) return null;

  const startKey = keys[Math.floor(Math.random() * keys.length)];
  // path = array de { key, node, segLen } onde segLen é o comprimento até o próximo nó
  const path = [{ key: startKey, node: nodeMap[startKey], segLen: 0 }];
  const visited = new Set([startKey]);
  const minLen = 4, maxLen = 12;

  for (let i = 0; i < maxLen; i++) {
    const cur = path[path.length - 1];
    if (!cur.node) break;
    const opts = cur.node.adj.filter(a => !visited.has(a.key));
    if (!opts.length) break;

    // prefere seguir reto
    let chosen;
    if (path.length >= 2) {
      const prev = path[path.length - 2].node;
      const ddx = cur.node.x - prev.x;
      const ddy = cur.node.y - prev.y;
      const straight = opts.find(a => {
        const n = nodeMap[a.key];
        return n && Math.round(n.x - cur.node.x) === Math.round(ddx) &&
               Math.round(n.y - cur.node.y) === Math.round(ddy);
      });
      chosen = (straight && Math.random() < 0.6)
        ? straight
        : opts[Math.floor(Math.random() * opts.length)];
    } else {
      chosen = opts[Math.floor(Math.random() * opts.length)];
    }

    visited.add(chosen.key);
    path.push({ key: chosen.key, node: nodeMap[chosen.key], segLen: chosen.len });
  }

  if (path.length < minLen) return null;

  // totalLen = soma dos comprimentos reais dos segmentos
  const totalLen = path.slice(1).reduce((s, p) => s + p.segLen, 0);

  return {
    path,      // array de { node, segLen }
    dist: 0,
    totalLen,
    alpha: 0.8 + Math.random() * 0.2,
    width: 1 + Math.random() * 0.6,
  };
}

// ─── Renderização ─────────────────────────────────────────────────────────────

// Distância de um ponto (px,py) ao segmento (ax,ay)→(bx,by)
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawFrame(ctx, w, h, circuits, pulses, color, opacity, mouse) {
  ctx.clearRect(0, 0, w, h);

  // Segmentos
  ctx.lineWidth = 1;
  ctx.lineCap = 'square';
  ctx.strokeStyle = colorWithAlpha(color, LINE_ALPHA * opacity);
  circuits.segments.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  });

  // Glow do mouse — segmentos próximos ao cursor acendem
  if (mouse && mouse.glow > 0.01) {
    circuits.segments.forEach(s => {
      const dist = distToSeg(mouse.x, mouse.y, s.x1, s.y1, s.x2, s.y2);
      if (dist > MOUSE_RADIUS) return;
      const proximity = 1 - dist / MOUSE_RADIUS;         // 1=perto, 0=longe
      const gAlpha = proximity * proximity * mouse.glow * 0.55 * opacity;
      ctx.strokeStyle = colorWithAlpha(color, gAlpha);
      ctx.lineWidth = 1 + proximity * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    });
  }

  // Nós
  circuits.nodes.forEach(({ x, y, count }) => {
    const r = count > 2 ? NODE_R * 1.5 : count > 1 ? NODE_R : NODE_R * 0.7;
    ctx.fillStyle = colorWithAlpha(color, LINE_ALPHA * opacity * 2.2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pads nas pontas
  ctx.lineWidth = 1.5;
  circuits.nodes.forEach(({ x, y, count }) => {
    if (count !== 1) return;
    ctx.strokeStyle = colorWithAlpha(color, LINE_ALPHA * opacity * 2);
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
  });

  // Pulsos — percorre segmentos usando comprimento real de cada um
  pulses.forEach(p => {
    if (!p) return;
    const headDist = p.dist;
    const tailDist = Math.max(0, headDist - PULSE_LEN);
    let acc = 0;

    for (let i = 0; i < p.path.length - 1; i++) {
      const sLen    = p.path[i + 1].segLen;
      const segStart = acc;
      const segEnd   = acc + sLen;
      const drawFrom = Math.max(tailDist, segStart);
      const drawTo   = Math.min(headDist, segEnd);

      if (drawFrom < drawTo) {
        const a = p.path[i].node;
        const b = p.path[i + 1].node;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t0 = (drawFrom - segStart) / sLen;
        const t1 = (drawTo   - segStart) / sLen;
        const sx = a.x + dx * t0, sy = a.y + dy * t0;
        const ex = a.x + dx * t1, ey = a.y + dy * t1;

        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, colorWithAlpha(color, 0));
        grad.addColorStop(1, colorWithAlpha(color, p.alpha * opacity));

        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Cabeça brilhante
        if (headDist <= segEnd) {
          const norm = sLen > 0 ? 8 / sLen : 0;
          ctx.globalAlpha = p.alpha * opacity * 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = p.width * 0.4;
          ctx.beginPath();
          ctx.moveTo(ex - dx * norm, ey - dy * norm);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.globalAlpha = p.alpha * opacity;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex, ey, p.width + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      acc += sLen;
    }
  });

  ctx.globalAlpha = 1;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CircuitBackground({ darkMode, interactive = false }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const color   = darkMode ? '#4B9FE8' : '#1558B0';
    const opacity = darkMode ? 1 : 0.7;

    const init = () => {
      const w = canvas.width  = canvas.parentElement?.offsetWidth  || window.innerWidth;
      const h = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
      stateRef.current = { w, h, circuits: buildCircuits(w, h), pulses: [], color, opacity, mouse: { x: -999, y: -999, glow: 0 } };
    };

    const onMouseMove = (e) => {
      const s = stateRef.current;
      if (!s) return;
      s.mouse.x = e.clientX;
      s.mouse.y = e.clientY;
      s.mouse.glow = 1;
    };

    init();
    window.addEventListener('resize', init);
    if (interactive) window.addEventListener('mousemove', onMouseMove);

    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;
      if (!s) return;
      frame++;

      s.pulses.forEach((p, i) => {
        if (!p) return;
        p.dist += PULSE_SPEED;
        if (p.dist - PULSE_LEN > p.totalLen) s.pulses[i] = null;
      });

      if (s.pulses.filter(Boolean).length < MAX_PULSES && frame % 20 === 0) {
        const p = pickPulse(s.circuits.nodeMap);
        if (p) {
          const slot = s.pulses.indexOf(null);
          if (slot !== -1) s.pulses[slot] = p;
          else s.pulses.push(p);
        }
      }

      // Decai o glow quando o mouse para
      if (s.mouse.glow > 0) s.mouse.glow = Math.max(0, s.mouse.glow - MOUSE_DECAY);
      drawFrame(ctx, s.w, s.h, s.circuits, s.pulses, s.color, s.opacity, s.mouse);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', init);
      if (interactive) window.removeEventListener('mousemove', onMouseMove);
    };
  }, [darkMode, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
