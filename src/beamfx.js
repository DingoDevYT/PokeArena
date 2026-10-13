// Laser beams drawn as one continuous, animated pixel-art body per move: Hydro Pump is a churning torrent,
// Flamethrower a flickering tongue, Thunderbolt a forked bolt that re-rolls, Solar Beam a huge pulsing column.
// Each style bakes small tileable textures once (hard palette colours, no gradients). Every frame the beam is
// composed axis-aligned on a scratch canvas at texel scale (1 texel = BFX_PX world px, the same size as the mons'
// 2x pixels), then blitted once, rotated, with nearest-neighbour sampling, so the whole beam sits on one hard grid.
'use strict';

const BFX_PX = 2;     // world px per texel
const BFX_VIS = 1.6;  // visual width / hitbox width (b.w); the solid body is ~1.25x, the rest is spray and fringe
const BFX_P = 48;     // texture period along the beam, texels
const BFX_M = 40;     // scratch margin around the beam for muzzle and impact effects, texels
const TAU = Math.PI * 2;

const bfxH = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const BFX_RGBA = new Map();
function bfxRGBA(c) { let v = BFX_RGBA.get(c); if (!v) BFX_RGBA.set(c, v = Array.from(rgbaOf(c))); return v; }
const sq = (x, y, s, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
function bfxStar(x, y, arm, c) { x = Math.round(x); y = Math.round(y); ctx.fillStyle = c; ctx.fillRect(x - arm, y, arm * 2 + 1, 1); ctx.fillRect(x, y - arm, 1, arm * 2 + 1); }
function bfxDiamond(x, y, r, c) { x = Math.round(x); y = Math.round(y); r = Math.round(r); ctx.fillStyle = c; for (let dy = -r; dy <= r; dy++) { const w = r - Math.abs(dy); ctx.fillRect(x - w, y + dy, w * 2 + 1, 1); } }
function bfxOrb(x, y, r, pal) { ell(x, y, r, r * 0.92, pal[4]); ell(x, y, r * 0.78, r * 0.72, pal[2]); ell(x, y, r * 0.52, r * 0.48, pal[1]); ell(x, y, r * 0.28, r * 0.26, pal[0]); }
// Hard-edged rings flying out from a point; alpha steps instead of fading smoothly.
function bfxRings(x, y, r, cols, t, n = 3) {
  for (let i = 0; i < n; i++) { const q = (t * 2.4 + i / n) % 1; ctx.globalAlpha = q < 0.5 ? 1 : 0.5; ell(x, y, r * (0.6 + q * 1.1), r * (0.6 + q * 1.1) * 0.85, null, cols[i % cols.length], 1); }
  ctx.globalAlpha = 1;
}
// Particles thrown out in a fan from (x, y): base angle a, spread, reach r; they loop so the spray never stops.
function bfxSpray(x, y, a, spread, r, n, cols, t, seed, rate = 2.6) {
  for (let i = 0; i < n; i++) {
    const p = (t * rate * (0.8 + bfxH(i, seed + 2) * 0.4) + bfxH(i, seed)) % 1, an = a + (bfxH(i, seed + 1) - 0.5) * spread, d = r * (0.25 + p);
    sq(x + Math.cos(an) * d, y + Math.sin(an) * d, p < 0.45 ? 2 : 1, cols[i % cols.length]);
  }
}

// ---------- texture baking (once per style) ----------
// Smooth periodic noise along the beam: whole sine cycles per period, and whole cycles across the frames, so it tiles both ways.
function bfxNoise(seed, F, oct) {
  const w = Array.from({ length: oct }, (_, k) => [1 + Math.floor(bfxH(k, seed) * (2 + k * 2)), bfxH(k + 9, seed) * TAU, Math.floor(bfxH(k + 19, seed) * 3) - 1, 1 / (k + 1)]);
  const n = w.reduce((s, q) => s + q[3], 0);
  return (u, f) => w.reduce((s, [k, ph, m, a]) => s + a * Math.sin(TAU * (k * u / BFX_P + m * f / F) + ph), 0) / n;
}
// F frames of a period-wide texture, H texels across; px(u, y, f, v) returns a colour or null. Two extra columns repeat
// the start so a 2-texel slice never has to wrap.
function bfxBake(H, F, px) {
  return Array.from({ length: F }, (_, f) => {
    const c = document.createElement('canvas'); c.width = BFX_P + 2; c.height = H;
    const g = c.getContext('2d'), id = g.createImageData(c.width, H);
    for (let u = 0; u < c.width; u++) for (let y = 0; y < H; y++) { const col = px(u % BFX_P, y, f, (y + 0.5) / H * 2 - 1); if (col) id.data.set(bfxRGBA(col), (y * c.width + u) * 4); }
    g.putImageData(id, 0, 0); return c;
  });
}
// Layered bands, core first: pal[i] fills out to radius r[i] (0..1 of the half width). The outer two bands wobble with
// the edge noise, the inner ones also snake side to side. deco(u, y, v, f, col, band) can repaint any texel.
function bfxBands(H, F, pal, o = {}) {
  const r = o.r || [0.22, 0.44, 0.68, 0.86, 1], ne = bfxNoise(o.seed || 1, F, o.oct || 3), ns = bfxNoise((o.seed || 1) + 7, F, 2);
  return bfxBake(H, F, (u, y, f, v) => {
    const e = o.edge ? o.edge(u, f) : 1 - (o.wob || 0) * (0.5 + 0.5 * ne(u, f)), c = (o.snake || 0) * ns(u, f);
    let i = 0; for (; i < pal.length; i++) if ((i < pal.length - 2 ? Math.abs(v - c) : Math.abs(v)) / e <= r[i]) break;
    const col = i < pal.length ? pal[i] : null;
    return o.deco ? o.deco(u, y, v, f, col, i) : col;
  });
}
// Sparse streaks (foam, embers, energy dashes) on their own layer so they can scroll faster than the body.
function bfxDashes(H, n, cols, maxLen, spread, seed) {
  const q = Array.from({ length: n }, (_, i) => [Math.floor(bfxH(i, seed) * BFX_P), Math.floor(H / 2 + (bfxH(i + 50, seed) * 2 - 1) * spread * H / 2), 1 + Math.floor(bfxH(i + 99, seed) * maxLen), cols[i % cols.length]]);
  return bfxBake(H, 1, (u, y) => { for (const [u0, y0, l, c] of q) if (y === y0 && (u - u0 + BFX_P) % BFX_P < l) return c; return null; });
}
// Lays a texture along the beam (0..s.len texels) in 2-texel slices, wf(d) = width there in texels.
// scroll is in world px and grows with time, so the content flows toward the target.
function bfxStrip(tex, s, wf, scroll, fps) {
  const c = tex[Math.floor(s.t * fps) % tex.length], H = c.height, s0 = Math.floor(scroll / BFX_PX);
  for (let d = 0; d < s.len; d += 2) {
    const w = Math.round(wf(d)); if (w < 1) continue;
    const seg = Math.min(2, s.len - d);
    ctx.drawImage(c, ((d - s0) % BFX_P + BFX_P) % BFX_P, 0, seg, H, d, -(w >> 1), seg, w);
  }
}
// Forked bolt from the muzzle to the head; same seed = same shape, so callers re-roll it by changing the seed.
function bfxBolt(len, amp, seed, w, step) {
  const pts = [[0, 0]], cols = ['#e07a00', '#fff27a', '#ffffff'];
  for (let d = step; d < len - 2; d += step * (0.6 + bfxH(d, seed) * 0.8)) pts.push([d, (bfxH(d * 3.1, seed) - 0.5) * 2 * amp]);
  pts.push([len, 0]);
  for (let k = 0; k < 3; k++) if (w[k]) for (let i = 1; i < pts.length; i++) pline(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], cols[k], w[k]);
  for (let j = 0; j < 3 && pts.length > 2; j++) {
    let [x, y] = pts[1 + Math.floor(bfxH(j, seed + 7) * (pts.length - 2))]; const dir = y > 0 ? 1 : -1;
    for (let n = 0; n < 2; n++) { const nx = x + step * (0.4 + bfxH(j * 5 + n, seed)), ny = y + dir * amp * (0.3 + bfxH(j * 7 + n, seed + 1) * 0.5); pline(x, y, nx, ny, cols[1], 2); pline(x, y, nx, ny, cols[2], 1); x = nx; y = ny; }
  }
}

// ---------- styles ----------
// Each style: pal [core, light, mid, edge, fringe], build() -> textures, body(s), mouth(s), hit(s, d), optional acc =
// PMDO particle accents drawn in world space at the muzzle / impact. s = { b, t, W (visual width, texels), len (texels), X }.
function bfxTorrent(o = {}) {
  const pal = ['#e8f8ff', '#8cc8ff', '#4a8ef0', '#2858c8', '#3f7fe0bb'];
  return {
    pal, acc: { hit: ['Aqua_Tail_Splash', 1.5] },
    build: () => ({
      body: bfxBands(36, 6, pal, { r: [0.1, 0.3, 0.6, 0.84, 1], wob: 0.24, snake: 0.16, seed: 3, oct: 4, deco: (u, y, v, f, col, i) => i === 2 && bfxH(u * 31 + y, f) < 0.07 ? '#3a78e6' : i === 1 && bfxH(u * 17 + y, f + 3) < 0.05 ? '#ffffff' : col }),
      foam: bfxDashes(36, 24, ['#ffffff', '#ffffff', '#d4f0ff'], 10, 0.78, 7),
    }),
    body(s) {
      const { t, W, len } = s, pf = d => W * Math.min(1, 0.5 + d / 18 * 0.5) * (1 + 0.08 * Math.sin(d * 0.16 - t * 26)) * (1 + 0.15 * d / Math.max(1, len));
      bfxStrip(s.X.body, s, pf, t * 460, 14);
      bfxStrip(s.X.foam, s, d => pf(d) * 0.92, t * 760, 1);
      for (let i = 0; i < 28; i++) { const q = (bfxH(i, 11) + t * (1.4 + bfxH(i, 12))) % 1, d = q * len, sd = bfxH(i, 13) < 0.5 ? -1 : 1; sq(d, sd * pf(d) * (0.4 + q * 0.3 + bfxH(i, 14) * 0.15), bfxH(i, 15) < 0.3 ? 2 : 1, bfxH(i, 16) < 0.5 ? '#ffffff' : '#a8dcff'); }
      if (o.bubbles) for (let i = 0; i < 9; i++) { const q = (bfxH(i, 17) + t * 0.9) % 1, r = 1 + Math.floor(bfxH(i, 18) * 3); ell(q * len, (bfxH(i, 19) - 0.5) * pf(q * len) * 0.9, r + 1, r + 1, '#d4f0ff66', '#ffffff', 1); }
    },
    mouth(s) {
      const { t, W } = s, r = W * 0.36 * (1 + 0.1 * Math.sin(t * 50));
      bfxSpray(0, 0, 0, 2.6, W * 0.75, 12, ['#ffffff', '#a8dcff'], t, 3, 3.2);
      ell(0, 0, r, r * 1.15, pal[3]); ell(0, 0, r * 0.72, r * 0.82, pal[2]); ell(1, 0, r * 0.42, r * 0.5, pal[1]); ell(1, 0, r * 0.18, r * 0.22, '#ffffff');
    },
    hit(s, d) {
      const { t, W } = s, r = W * 0.5 * (1 + 0.12 * Math.sin(t * 40));
      bfxSpray(d, 0, Math.PI, 3.6, W * 1.1, 18, ['#ffffff', '#a8dcff', '#4f95f2'], t, 21);
      ell(d, 0, r * 0.9, r * 1.1, pal[4]); ell(d, 0, r * 0.7, r * 0.86, '#a8dcff'); ell(d - r * 0.1, 0, r * 0.48, r * 0.6, '#d4f0ff'); ell(d - r * 0.15, 0, r * 0.24, r * 0.3, '#ffffff');
      bfxRings(d, 0, r, ['#d4f0ff', '#ffffff'], t);
    },
  };
}
function bfxFlame(pal, embers, acc) {
  return {
    pal, acc,
    build: () => ({ body: bfxBands(32, 8, pal, { wob: 0.3, snake: 0.2, seed: 5, oct: 5, r: [0.22, 0.46, 0.68, 0.86, 1] }), emb: bfxDashes(32, 22, embers, 3, 0.9, 9) }),
    body(s) {
      const { t, W, len } = s;
      const pf = d => W * Math.min(1, 0.42 + d / Math.max(10, len * 0.3) * 0.58) * (1 + 0.1 * Math.sin(d * 0.22 - t * 34)) * (d > len * 0.75 ? 1 + (d - len * 0.75) / len * 0.6 : 1);
      bfxStrip(s.X.body, s, pf, t * 380, 18);
      bfxStrip(s.X.emb, s, d => pf(d) * 1.05, t * 600, 1);
      for (let i = 0; i < 22; i++) { const q = (bfxH(i, 31) + t * (1.1 + bfxH(i, 32))) % 1, d = q * len, sd = bfxH(i, 33) < 0.5 ? -1 : 1; sq(d, sd * pf(d) * (0.45 + q * 0.4), bfxH(i, 34) < 0.25 ? 2 : 1, embers[i % embers.length]); }
    },
    mouth(s) { const r = s.W * 0.28 * (1 + 0.2 * Math.sin(s.t * 60)); ell(0, 0, r * 1.2, r, pal[3]); ell(0, 0, r * 0.8, r * 0.7, pal[1]); ell(0, 0, r * 0.4, r * 0.35, pal[0]); },
    hit(s, d) {
      const { t, W } = s, r = W * 0.55 * (1 + 0.15 * Math.sin(t * 45));
      bfxSpray(d, 0, Math.PI, 4, W * 0.9, 14, embers, t, 35, 1.8);
      ell(d, 0, r, r * 1.05, pal[4]); ell(d, 0, r * 0.8, r * 0.85, pal[3]); ell(d - r * 0.1, 0, r * 0.56, r * 0.6, pal[2]); ell(d - r * 0.16, 0, r * 0.32, r * 0.34, pal[1]); ell(d - r * 0.2, 0, r * 0.14, r * 0.15, pal[0]);
    },
  };
}
function bfxElec(big) {
  const pal = ['#ffffff', '#fff27a', '#f7d02c', '#e07a00', '#f7d02c66'];
  return {
    pal, acc: { hit: big ? ['Discharge_Hit', 0.5] : ['Spark', 0.5] },
    build: () => ({ aura: bfxBands(28, 6, ['#fff6b0cc', '#f7d02c88', '#f7d02c44'], { r: [0.3, 0.7, 1], wob: 0.4, oct: 5, seed: 13, deco: (u, y, v, f, col) => col && bfxH(u * 13 + y * 7, f + 1) < 0.04 ? '#ffffff' : col }) }),
    body(s) {
      const { t, W, len, b } = s, seed = Math.floor(t * 20) + b.side * 977, w = [Math.max(3, Math.round(W * 0.2)), Math.max(2, Math.round(W * 0.12)), Math.max(1, Math.round(W * 0.05))];
      bfxStrip(s.X.aura, s, d => W * (0.6 + 0.4 * Math.min(1, d / 12)), t * 300, 20);
      bfxBolt(len, W * 0.36, seed, w, 9);
      bfxBolt(len, W * 0.5, seed + 50, [0, 2, 1], 7);
      bfxBolt(len, W * 0.44, seed + 90, [0, 0, 1], 6);
    },
    mouth(s) { const r = s.W * (big ? 0.42 : 0.32) * (1 + 0.15 * Math.sin(s.t * 70)); bfxOrb(0, 0, r, pal); bfxSpray(0, 0, 0, TAU, r * 1.6, 8, ['#ffffff', '#fff27a'], s.t, 41, 4); },
    hit(s, d) {
      const { t, W, b } = s, r = W * (big ? 0.75 : 0.45) * (1 + 0.15 * Math.sin(t * 60)), seed = Math.floor(t * 20) + b.side * 31;
      bfxOrb(d, 0, r, pal);
      for (let i = 0; i < 5; i++) { const a = bfxH(i, seed) * TAU, l = r * (1.2 + bfxH(i + 9, seed)), mx = d + Math.cos(a + 0.4) * l * 0.5, my = Math.sin(a + 0.4) * l * 0.5; pline(d, 0, mx, my, '#fff27a', 2); pline(mx, my, d + Math.cos(a) * l, Math.sin(a) * l, '#fff27a', 1); }
    },
  };
}
const BFX_RAINBOW = ['#ff6b9a', '#ffb36b', '#ffef6b', '#8dff8a', '#6bd8ff', '#b58cff'];
function bfxCrystal(pal, deco, acc) {
  return {
    pal, acc,
    build: () => ({ body: bfxBands(30, deco ? 6 : 2, pal, { r: [0.18, 0.42, 0.7, 0.88, 1], seed: 17, edge: (u, f) => 1 - 0.2 * Math.abs(((u + f * 3) % 8) / 4 - 1),
      deco: deco || ((u, y, v, f, col, i) => { if (i < 1 || i > 3) return col; const k = (u + Math.round(Math.abs(v) * 15)) % 12; return k < 2 ? '#ffffff' : k === 2 ? '#6fbfe0' : col; }) }) }),
    body(s) {
      const { t, W, len } = s, pf = d => W * Math.min(1, 0.55 + d / 14 * 0.45);
      bfxStrip(s.X.body, s, pf, t * 240, 8);
      for (let i = 0; i < 20; i++) { const q = (bfxH(i, 41) + t * 0.5) % 1, d = q * len; if (Math.floor(t * 14 + bfxH(i, 43) * 10) % 3 === 0) bfxStar(d, (bfxH(i, 42) - 0.5) * pf(d) * 1.15, bfxH(i, 44) < 0.35 ? 2 : 1, '#ffffff'); }
    },
    mouth(s) { const r = s.W * 0.4 * (1 + 0.1 * Math.sin(s.t * 40)); bfxDiamond(0, 0, r, pal[3]); bfxDiamond(0, 0, r * 0.65, pal[1]); bfxDiamond(0, 0, r * 0.3, '#ffffff'); },
    hit(s, d) {
      const { t, W } = s, r = W * 0.6 * (1 + 0.1 * Math.sin(t * 30));
      for (let i = 0; i < 7; i++) { const p = (t * 1.8 + bfxH(i, 51)) % 1, a = Math.PI + (bfxH(i, 52) - 0.5) * 4, dd = r * (0.5 + p * 1.2); bfxDiamond(d + Math.cos(a) * dd, Math.sin(a) * dd, 1 + (1 - p) * 2, i % 2 ? pal[2] : pal[1]); }
      bfxDiamond(d, 0, r, pal[3]); bfxDiamond(d, 0, r * 0.72, pal[2]); bfxDiamond(d, 0, r * 0.45, pal[1]); bfxDiamond(d, 0, r * 0.2, '#ffffff');
      if (Math.floor(t * 12) % 2) bfxStar(d, 0, Math.round(r * 1.3), '#ffffff');
    },
  };
}
function bfxBig(pal, o = {}) {
  return {
    pal, acc: o.acc,
    build: () => ({ body: bfxBands(44, 6, pal, { r: [0.3, 0.5, 0.7, 0.86, 1], wob: 0.1, snake: 0.04, seed: o.seed || 21, deco: o.deco }), dash: bfxDashes(44, 26, [pal[0], pal[1]], 14, 0.6, 23) }),
    body(s) {
      const { t, W, len } = s, pf = d => W * Math.min(1, 0.62 + d / 16 * 0.38) * (1 + 0.05 * Math.sin(t * 38) + 0.07 * Math.sin(d * 0.09 - t * 16));
      bfxStrip(s.X.body, s, pf, t * 520, 12);
      bfxStrip(s.X.dash, s, pf, t * 900, 1);
      for (let i = 0; i < 18; i++) { const q = (bfxH(i, 71) + t * (0.8 + bfxH(i, 72))) % 1, d = q * len, sd = bfxH(i, 73) < 0.5 ? -1 : 1; sq(d, sd * pf(d) * (0.55 + q * 0.25), bfxH(i, 74) < 0.3 ? 2 : 1, i % 2 ? pal[1] : pal[0]); }
    },
    mouth(s) { const r = s.W * 0.55 * (1 + 0.08 * Math.sin(s.t * 40)); bfxOrb(0, 0, r, pal); bfxSpray(0, 0, Math.PI, 3, r * 1.4, 10, [pal[0], pal[1]], s.t, 75, 3); },
    hit(s, d) { const { t, W } = s, r = W * 0.62 * (1 + 0.1 * Math.sin(t * 36)); bfxSpray(d, 0, Math.PI, 4.4, W * 1.1, 16, [pal[0], pal[1], pal[2]], t, 77); bfxOrb(d, 0, r, pal); bfxRings(d, 0, r, [pal[1], pal[0]], t); },
  };
}
function bfxRinged(pal, rings, acc) {
  return {
    pal, acc,
    build: () => ({
      body: bfxBands(30, 4, pal, { r: [0.26, 0.48, 0.68, 0.82, 0.9], wob: 0.06, seed: 27 }),
      // rings seen from the side: 2-texel arcs bowed toward the target, cycling colours
      ring: bfxBake(30, rings.length, (u, y, f, v) => { const k = (u - Math.round(3 * (1 - Math.sqrt(Math.max(0, 1 - v * v)))) + BFX_P) % 12; return Math.abs(v) <= 0.98 && k < 2 ? rings[(Math.floor(u / 12) + f) % rings.length] : null; }),
    }),
    body(s) {
      const { t, W } = s, pf = d => W * Math.min(1, 0.5 + d / 12 * 0.5) * (1 + 0.06 * Math.sin(t * 30));
      bfxStrip(s.X.body, s, pf, t * 300, 10);
      bfxStrip(s.X.ring, s, d => pf(d) * (1 + 0.12 * Math.sin(d * 0.3 - t * 20)), t * 620, 10);
    },
    mouth(s) { bfxOrb(0, 0, s.W * 0.4 * (1 + 0.12 * Math.sin(s.t * 50)), pal); },
    hit(s, d) { const r = s.W * 0.5 * (1 + 0.1 * Math.sin(s.t * 40)); bfxOrb(d, 0, r, pal); bfxRings(d, 0, r, rings, s.t, 4); },
  };
}
const BFX = {
  water: bfxTorrent(),
  bubble: bfxTorrent({ bubbles: true }),
  fire: bfxFlame(['#fffbe0', '#ffe25a', '#ffa21f', '#f0541a', '#c8281ecc'], ['#fff2a0', '#ffcf3a', '#ff8a1f'], { hit: ['Flamethrower', 1] }),
  dragon: bfxFlame(['#f2fcff', '#9fe0ff', '#7a6cff', '#5230d0', '#3a1a8acc'], ['#d8f6ff', '#9fe0ff', '#b58cff'], { hit: ['Puff_Purple', 1.5] }),
  elec: bfxElec(false),
  zap: bfxElec(true),
  ice: bfxCrystal(['#ffffff', '#dcfbff', '#9ad8f0', '#3f9fcf', '#c8f4ff99'], null, { hit: ['Ice_Pieces', 2] }),
  aurora: bfxCrystal(['#ffffff', '#ffd6f0', '#8dffb0', '#6bb8ff', '#ffffff66'], (u, y, v, f, col, i) => i >= 1 && i <= 3 ? BFX_RAINBOW[(Math.floor(y / 2) + f + Math.floor(u / 12)) % 6] : col, { hit: ['Ice_Pieces', 1.5] }),
  solar: bfxBig(['#ffffff', '#faffc8', '#c4f05a', '#5fb83a', '#d8ff8a88'], { acc: { hit: ['Sparkle_RSE', 1.5] } }),
  hyper: bfxBig(['#ffffff', '#fff3c0', '#ffc46b', '#f0702e', '#ffb08a88'], { acc: { hit: ['Hit_Neutral', 1] } }),
  meteor: bfxBig(['#ffffff', '#fff0c8', '#e0c070', '#8a6432', '#f0d89a88'], { seed: 33, acc: { hit: ['Hit_Neutral', 1] } }),
  frenzy: bfxBig(['#f0ffc0', '#9fe060', '#4fae3a', '#2a6e26', '#7fcf5a88'], { seed: 29, acc: { hit: ['Leaf_Storm_Hit', 1] },
    deco: (u, y, v, f, col, i) => { if (i > 3) return col; const a = Math.sin(TAU * u * 2 / BFX_P + f * TAU / 6) * 0.62; return Math.abs(v - a) < 0.1 ? '#1f5a1f' : Math.abs(v + a) < 0.1 ? '#3f8f2f' : col; } }),
  psy: bfxRinged(['#ffffff', '#ffd0ee', '#f95587', '#b0306a', '#f9558766'], ['#ff7ad0', '#b46cff', '#6bd8ff', '#ffe36b']),
  signal: bfxRinged(['#ffffff', '#f0ffb0', '#a6b91a', '#5f6e0e', '#a6b91a66'], ['#d8ff5a', '#ff6a6a', '#ffffff', '#6bd8ff']),
  steel: bfxRinged(['#ffffff', '#eef4ff', '#b7b7ce', '#6e6e8a', '#cfd8ff66'], ['#ffffff', '#cfe6ff', '#9fb0d0'], { hit: ['Flash_Cannon_Release', 0.5] }),
};
const BFX_MOVES = { hydropump: 'water', hydrocannon: 'water', watergun: 'water', bubblebeam: 'bubble', flamethrower: 'fire', blastburn: 'fire', dragonbreath: 'dragon', thunderbolt: 'elec', discharge: 'elec', chargebeam: 'elec', zapcannon: 'zap', icebeam: 'ice', aurorabeam: 'aurora', solarbeam: 'solar', hyperbeam: 'hyper', frenzyplant: 'frenzy', psybeam: 'psy', signalbeam: 'signal', flashcannon: 'steel', steelbeam: 'steel', meteorbeam: 'meteor' };
const BFX_TYPES = { Water: 'water', Fire: 'fire', Dragon: 'dragon', Electric: 'elec', Ice: 'ice', Grass: 'solar', Psychic: 'psy', Bug: 'signal', Steel: 'steel', Rock: 'meteor' };
const bfxStyle = mv => BFX[BFX_MOVES[mv.id] || BFX_TYPES[mv.type] || 'hyper'];

// ---------- per-frame drawing ----------
const bfxCv = document.createElement('canvas'), bfxG = bfxCv.getContext('2d');
bfxCv.width = 560; bfxCv.height = 200;
function drawBeamFx(b) {
  const st = bfxStyle(b.move), X = st.tex || (st.tex = st.build()), t = b.t, left = b.dur - t;
  let k = t < 0.1 ? 0.45 + t / 0.1 * 0.85 : t < 0.24 ? 1.3 - (t - 0.1) / 0.14 * 0.3 : 1; // start-up surge
  if (left < 0.2) k *= 0.3 + 0.7 * Math.max(0, left) / 0.2;                                 // end fade
  const s = { b, t, X, W: b.w * BFX_VIS * k / BFX_PX, len: Math.min(bfxCv.width - BFX_M * 2, b.len / BFX_PX) }, OY = bfxCv.height >> 1;
  // where the beam meets the foe's body: the torrent visibly slams into them
  let contact = -1;
  const foe = foeOf(B.sides[b.side]), fe = foe.ent, ca = Math.cos(b.ang), sa = Math.sin(b.ang), fx = fe.x - b.x, fy = fe.y - 10 * SS - fe.z - b.y;
  const along = fx * ca + fy * sa, hr = hurtRadius(foe);
  if (b.laser.flow) { const d = b.clash || !canHit(foe) ? -1 : flowHit(b, fe.x, fe.y - 10 * SS - fe.z, b.w / 2 + hr); if (d >= 0) contact = Math.max(4, d - hr * 0.7) / BFX_PX; }
  else if (!b.clash && canHit(foe) && along > 0 && along < b.len && Math.abs(fy * ca - fx * sa) < b.w / 2 + hr) contact = Math.max(4, along - hr * 0.7) / BFX_PX;
  const prev = ctx; ctx = bfxG;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bfxCv.width, bfxCv.height); ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, BFX_M, OY);
  st.body(s);
  // full splash where the beam is stopped by a wall or rock, a smaller one where it just runs out, smaller still on the foe
  if (s.len > 6 && !b.clash && (contact < 0 || s.len - contact > s.W * 0.6)) st.hit(b.len < b.laser.len - 2 ? s : { ...s, W: s.W * 0.75 }, s.len);
  if (contact >= 0) st.hit({ ...s, W: s.W * 0.6 }, contact);
  st.mouth({ ...s, W: Math.min(s.W, 20) });
  ctx = prev;
  ctx.save(); ctx.globalAlpha = left < 0.12 ? Math.ceil(Math.max(0, left / 0.12) * 4) / 4 : 1;
  if (b.laser.flow) {
    // bent stream: the straight texture is cut into 8-texel slices, each laid along the lagged path at its own angle
    const { pts, ang } = flowPts(b), SL = 8, H = bfxCv.height;
    for (let u0 = -BFX_M; u0 < s.len + BFX_M; u0 += SL) {
      const i = clamp(Math.floor(u0 * BFX_PX / FLOW_SEG), 0, ang.length - 1), p = pts[i] || pts[0], a = ang[i] ?? b.ang, off = u0 * BFX_PX - i * FLOW_SEG;
      ctx.save(); ctx.translate(Math.round(p.x + Math.cos(a) * off), Math.round(p.y + Math.sin(a) * off)); ctx.rotate(a); ctx.scale(BFX_PX, BFX_PX);
      ctx.drawImage(bfxCv, BFX_M + u0, 0, SL + 1, H, 0, -OY, SL + 1, H);
      ctx.restore();
    }
    ctx.restore();
  } else {
  ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.ang); ctx.scale(BFX_PX, BFX_PX);
  ctx.drawImage(bfxCv, -BFX_M, -OY);
  ctx.restore();
  }
  const acc = st.acc?.hit, a = left < 0.12 ? 0.5 : 1;
  if (acc && (contact >= 0 || (!b.clash && s.len > 6))) { const d = (contact >= 0 ? contact : s.len) * BFX_PX, F = b.laser.flow ? flowPts(b) : null, k = F ? clamp(Math.floor(d / FLOW_SEG), 0, F.ang.length - 1) : 0, hx = F ? F.pts[k].x + Math.cos(F.ang[k]) * (d - k * FLOW_SEG) : b.x + ca * d, hy = F ? F.pts[k].y + Math.sin(F.ang[k]) * (d - k * FLOW_SEG) : b.y + sa * d; particle(acc[0], hx, hy, t, { scale: SS * acc[1], ft: 2, alpha: a }); }
  if (b.clash) { const kk = b.clash, o = B.beams.find(q => q !== b && q.clash === kk); if (o && kk.bfx === B.time) bfxClash(kk, b, o); else kk.bfx = B.time; }
}

// Two beams meeting: a big jagged starburst in both moves' colours, shock rings, a flickering white core and sparks.
const bfxCl = document.createElement('canvas'), bfxClG = bfxCl.getContext('2d');
bfxCl.width = bfxCl.height = 128;
function bfxClash(k, a, c) {
  const pa = bfxStyle(a.move).pal, pc = bfxStyle(c.move).pal, t = B.time, seed = Math.floor(t * 30);
  const R = Math.min(32, (a.w + c.w) * 0.95 / BFX_PX) * (1 + 0.12 * Math.sin(t * 50));
  const prev = ctx; ctx = bfxClG;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 128, 128); ctx.setTransform(1, 0, 0, 1, 64, 64);
  ell(-3, 0, R * 1.2, R, pa[4]); ell(3, 0, R * 1.2, R, pc[4]);
  for (let i = 0; i < 14; i++) {
    const p = i % 2 ? pa : pc, an = i / 14 * TAU + bfxH(i, seed) * 0.3, l = R * (1 + bfxH(i + 20, seed) * 1.1), cx = Math.cos(an), cy = Math.sin(an) * 0.8;
    pline(0, 0, cx * l, cy * l, p[3], 4); pline(0, 0, cx * l * 0.85, cy * l * 0.85, p[1], 2); pline(0, 0, cx * l * 0.5, cy * l * 0.5, '#ffffff', 1);
  }
  bfxRings(0, 0, R * 0.9, [pa[1], pc[1], '#ffffff'], t);
  ell(-R * 0.14, 0, R * 0.5, R * 0.44, pa[2]); ell(R * 0.14, 0, R * 0.5, R * 0.44, pc[2]);
  ell(0, 0, R * 0.42, R * 0.36, Math.floor(t * 30) % 2 ? '#ffffff' : pc[0]); ell(0, 0, R * 0.24, R * 0.2, '#ffffff');
  for (let i = 0; i < 20; i++) { const q = (t * 2 + bfxH(i, 61)) % 1, an = bfxH(i, 62) * TAU, d = R * (0.5 + q * 1.5); sq(Math.cos(an) * d, Math.sin(an) * d * 0.8, q < 0.5 ? 2 : 1, (i % 2 ? pa : pc)[i % 3]); }
  ctx = prev;
  ctx.save(); ctx.translate(Math.round(k.x), Math.round(k.y)); ctx.scale(BFX_PX, BFX_PX); ctx.drawImage(bfxCl, -64, -64); ctx.restore();
  // anime speed lines blasting out of the contact point, in both beams' colours
  for (let i = 0; i < 22; i++) { const an = bfxH(i, seed) * TAU, d0 = 40 + bfxH(i, seed + 7) * 50, d1 = d0 + 70 + bfxH(i, seed + 3) * 190, cx = Math.cos(an), cy = Math.sin(an) * 0.8; pline(k.x + cx * d0, k.y + cy * d0, k.x + cx * d1, k.y + cy * d1, i % 3 === 0 ? '#ffffff' : (i % 2 ? pa : pc)[1], i % 4 === 0 ? 3 : 2); }
}
