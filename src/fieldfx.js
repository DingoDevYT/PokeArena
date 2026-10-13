// Field trap and wave visuals (B.traps / B.waves from src/battle.js). Pixel art only: hard-edged ellipses and lines on the
// world canvas plus PMDO particle sheets looping inside the patch. Called once per frame from drawWorld in src/render.js.
'use strict';

function drawFieldFx() {
  if (B.soakT > 0) drawSoak();
  for (const t of B.traps) drawTrap(t);
  for (const w of B.waves) drawWave(w);
  for (const w of B.sweeps || []) drawSweep(w);
}

// ---------- arena sweeps ----------
// Each kind is a cached procedural pixel strip (front at the right edge, tail dithering away to the left), tiled along
// the whole arena and flipped/transposed into the travel direction. Only 90-degree transforms, so pixels stay square.
const SWEEP_PAL = {
  water: { body: ['#163574', '#1f4fa8', '#2b68cc', '#4688ea', '#78b0ff'], foam: ['#ffffff', '#cfe8ff'], edge: '#0b1838', amp: 5 },
  mud: { body: ['#3a2210', '#53331a', '#6c4524', '#8a5c30', '#a97a48'], foam: ['#e2c79a', '#c9a874'], edge: '#1c1006', amp: 4 },
  sludge: { body: ['#2a0e3a', '#3f1958', '#5a297c', '#7a3ea2', '#9c62c6'], foam: ['#e6c2ff', '#b6ff5a'], edge: '#130519', amp: 5 },
  heat: { body: ['#5a1606', '#9a2a0a', '#d8480e', '#ff7a1a', '#ffb02e'], foam: ['#fff6b0', '#ffe066'], edge: '#2a0a02', amp: 10 },
  quake: { body: ['#3e3020', '#5c4a32', '#7e6646'], foam: ['#e8d6b0', '#c9b08a'], edge: '#140d06', amp: 3 },
};
const SWEEP_TEX = new Map(), STH = 48;
function sweepTex(kind, D, frame) {
  const key = kind + '|' + D + '|' + frame; let c = SWEEP_TEX.get(key); if (c) return c;
  const P = SWEEP_PAL[kind] || SWEEP_PAL.water, rnd = seeded(frame * 977 + kind.length * 131 + 7), n = P.body.length;
  c = document.createElement('canvas'); c.width = D; c.height = STH;
  const g = c.getContext('2d'), id = g.createImageData(D, STH), rgb = {}, put = (x, y, col) => id.data.set(rgb[col] ||= rgbaOf(col), (y * D + x) * 4);
  for (let y = 0; y < STH; y++) {
    // crest profile: two swells per tile (so it tiles), plus licking tongues for fire
    const off = Math.round(P.amp * (0.5 + 0.5 * Math.sin(y / STH * Math.PI * 4 + frame * 2.1)) + (kind === 'heat' ? rnd() * 5 : rnd() * 1.5));
    const front = D - 1 - off, foam = (kind === 'quake' ? 3 : 5) + Math.floor(rnd() * 4), streak = kind !== 'quake' && y % 7 === frame % 7;
    // spray flung just ahead of the crest
    if (kind !== 'quake') for (let x = front + 1; x < D; x++) if (rnd() < 0.14) put(x, y, P.foam[0]);
    for (let x = 0; x <= front; x++) {
      const d = front - x;
      let col;
      if (d === 0) col = P.edge;
      else if (d <= foam) col = P.foam[rnd() < 0.75 ? 0 : 1];
      else if (kind === 'quake') {
        // a heaved-up ridge of rubble, a jagged crack behind it, then a hanging dust cloud
        const ck = 25 + Math.round(2 * Math.sin(y * 0.8 + frame * 1.7));
        if (d === ck || d === ck + 1) col = P.edge;
        else if (d < 22) col = rnd() < 0.15 ? P.edge : P.body[Math.min(n - 1, Math.floor((22 - d) / 8))];
        else if (d > ck + 1 && (x + y) % 2 === 0 && rnd() < 0.55) col = P.foam[rnd() < 0.5 ? 0 : 1]; else continue;
      } else {
        // tail dissolves in a hard dither (longer shimmer for heat)
        const tail = kind === 'heat' ? 34 : 16;
        if (x < tail && ((x + y + frame) % (x < tail / 2 ? 3 : 2))) continue;
        const band = clamp(Math.floor((d - foam) / ((D - foam) / n) + (rnd() - 0.5) * 0.7), 0, n - 1);
        // lighter streak rows read as the mass rushing forward
        col = rnd() < 0.015 ? P.foam[1] : P.body[Math.min(n - 1, n - 1 - band + (streak && rnd() < 0.8 ? 1 : 0))];
      }
      put(x, y, col);
    }
  }
  g.putImageData(id, 0, 0); SWEEP_TEX.set(key, c); return c;
}
// local x = depth into the wave (front at x = D), local y = position across the arena
function sweepFrame(w, front) {
  const D = w.depth, f = Math.round(front);
  if (w.horiz) ctx.transform(w.dir, 0, 0, 1, f - w.dir * D, 0); else ctx.transform(0, w.dir, 1, 0, 0, f - w.dir * D);
}
function drawSweep(w) {
  const ar = B.arena, span = w.horiz ? ar.h : ar.w, D = w.depth, P = SWEEP_PAL[w.kind] || SWEEP_PAL.water;
  const segs = []; let s0 = 0;
  for (const [a, b] of [...w.gaps].sort((x, y) => x[0] - y[0])) { segs.push([s0, a]); s0 = b; }
  segs.push([s0, span]);
  ctx.save();
  if (w.t < w.warn) {
    // telegraph: a flashing band just inside the entry edge, chevrons pointing the way it will travel, gaps left open
    // pulled in to the visible edge when the real entry edge is off camera, so the warning is always seen
    const vlo = w.horiz ? view.x : view.y, vhi = vlo + (w.horiz ? view.w : view.h);
    sweepFrame(w, (w.dir > 0 ? Math.max(w.entry, vlo + 2) : Math.min(w.entry, vhi - 4)) + w.dir * 22);
    ctx.globalAlpha = Math.floor(w.t * 10) % 2 ? 0.9 : 0.45;
    for (const [a, b] of segs) {
      ctx.fillStyle = P.body[P.body.length - 2]; ctx.fillRect(D - 22, Math.round(a), 22, Math.round(b - a));
      ctx.fillStyle = P.edge; ctx.fillRect(D - 2, Math.round(a), 2, Math.round(b - a));
      for (let v = Math.ceil(a / 40) * 40 + 20; v < b - 8; v += 40) { pline(D - 17, v - 6, D - 9, v, '#fff', 2); pline(D - 9, v, D - 17, v + 6, '#fff', 2); }
    }
    for (const [a, b] of w.gaps) for (const v of [a, b]) { ctx.fillStyle = '#fff'; ctx.fillRect(D - 40, Math.round(v) - 1, 40, 2); }
  } else {
    sweepFrame(w, w.u);
    const tex = sweepTex(w.kind, D, Math.floor(B.time * 8) % 3);
    for (const [a, b] of segs) {
      if (b - a < 1) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(0, Math.round(a), D, Math.round(b - a)); ctx.clip();
      for (let v = Math.floor(a / STH) * STH; v < b; v += STH) ctx.drawImage(tex, 0, v);
      ctx.restore();
    }
    // gap posts: dark-edged white bars so the openings read at a glance
    for (const [a, b] of w.gaps) for (const v of [a, b]) { ctx.fillStyle = P.edge; ctx.fillRect(0, Math.round(v) - 2, D, 4); ctx.fillStyle = '#fff'; ctx.fillRect(D - 36, Math.round(v) - 1, 36, 2); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
// Soaked floor after a water sweep: a hard 4x4 dither of wet blues over the fighting area, fading out.
let WET_PAT = null, WET_CTX = null;
function drawSoak() {
  if (WET_CTX !== ctx) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = 4;
    g.fillStyle = '#2f62b8'; g.fillRect(0, 0, 1, 1); g.fillRect(2, 2, 1, 1); g.fillStyle = '#9cc8ff'; g.fillRect(2, 0, 1, 1);
    WET_PAT = ctx.createPattern(c, 'repeat'); WET_CTX = ctx;
  }
  const ar = B.arena;
  ctx.globalAlpha = 0.6 * clamp(B.soakT / 1.5, 0, 1); ctx.fillStyle = WET_PAT;
  ctx.fillRect(ar.wall, ar.wall, ar.w - ar.wall * 2, ar.h - ar.wall * 2);
  ctx.globalAlpha = 1;
}

// A trap reads at a glance: tinted ground, a ring that pulses out from the middle, the move's sheets swirling inside,
// and a thick breathing outline in the status colour (sleep blue, paralysis yellow, poison purple, ...). Blinks before it ends.
function drawTrap(t) {
  const rx = t.r, ry = t.r * 0.62, col = t.col;
  const fade = clamp(Math.min(t.t / 0.2, (t.dur - t.t) / 0.35), 0, 1) * (t.dur - t.t < 1 && Math.floor(B.time * 12) % 2 ? 0.45 : 1);
  ctx.globalAlpha = fade * 0.55;
  const dz = ditherEll(rx, ry, col); ctx.drawImage(dz, Math.round(t.x) - (dz.width >> 1), Math.round(t.y) - (dz.height >> 1));
  ctx.globalAlpha = fade;
  ell(t.x, t.y, rx, ry, col + '30');
  const q = (t.t * 0.9) % 1;
  ctx.globalAlpha = fade * (1 - q);
  if (q > 0.08) ell(t.x, t.y, rx * q, ry * q, null, col, 2);
  ctx.globalAlpha = fade;
  // one big looping sheet in the middle (fire / sand / water vortex)
  const big = t.big && VFX.particles[t.big];
  if (big) particle(t.big, t.x, t.y - big.fh * 0.25, t.t, { ft: 2, scale: Math.max(1, Math.round(rx * 2 / big.fw)), alpha: fade });
  // small sheets scattered through the patch, slowly swirling (faster for vortexes that pull)
  const rnd = seeded(Math.floor(t.seed)), n = Math.round(clamp(rx / 6, 8, 16)), spin = t.t * (t.pull ? 2.2 : 0.35);
  for (let i = 0; i < n; i++) {
    const name = t.fx[i % t.fx.length], p = VFX.particles[name]; if (!p) continue;
    const a = rnd() * Math.PI * 2 + spin, d = (0.25 + rnd() * 0.7) * rx;
    particle(name, t.x + Math.cos(a) * d, t.y + Math.sin(a) * d * 0.62 - 6, t.t + rnd() * 3, { ft: 4, scale: p.fw <= 20 ? SS : 1, alpha: fade });
  }
  // outline: 1px dark rim, then a 2px status-colour ring that breathes by a pixel or two
  const b = Math.round(Math.sin(B.time * 6) * 1.5);
  ctx.globalAlpha = fade;
  ell(t.x, t.y, rx + b + 1, ry + b + 1, null, '#0c0a14', 5);
  ell(t.x, t.y, rx + b, ry + b, null, col, 3);
  ctx.globalAlpha = 1;
}

// Checkerboard-dithered ellipse in one colour (cached): reads as a tinted patch while staying hard-pixel.
const DITHER = new Map();
function ditherEll(rx, ry, col) {
  rx = Math.round(rx); ry = Math.round(ry);
  const key = rx + '|' + ry + '|' + col; let c = DITHER.get(key); if (c) return c;
  if (DITHER.size > 60) DITHER.clear();
  c = document.createElement('canvas'); c.width = rx * 2 + 1; c.height = ry * 2 + 1;
  const g = c.getContext('2d'), id = g.createImageData(c.width, c.height), rgb = rgbaOf(col);
  for (let y = 0; y < c.height; y++) for (let x = (y & 1); x < c.width; x += 2) if (((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2 <= 1) id.data.set(rgb, (y * c.width + x) * 4);
  g.putImageData(id, 0, 0); DITHER.set(key, c); return c;
}

// A wave is an arc of the move's own particles: the middle leads, the flanks trail (waveBow), with two fainter arcs behind it.
// The same arc is the hitbox (updateWaves), so what you see is what hits.
function drawWave(w) {
  const c = Math.cos(w.ang), s = Math.sin(w.ang), go = w.spd * w.t, front = Math.min(w.len, go);
  const fade = 1 - clamp((go - w.len) / 40, 0, 1), hw = w.w / 2, name = waveSheet(w.move), step = Math.max(7, Math.round(hw / 10));
  for (let row = 2; row >= 0; row--) for (let k = -hw; k <= hw; k += step) {
    const f = front + waveBow(w, k) - row * 16;
    if (f < 0) continue;
    particle(name, w.x + c * f - s * k, w.y + s * f + c * k - 6 * SS, w.t + k * 0.013 + row * 0.07, { ft: 3, scale: sheetScale(name), alpha: fade * (1 - row * 0.35) });
  }
}
