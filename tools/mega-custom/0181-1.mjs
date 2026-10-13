// Builds a custom PMD-style Mega Ampharos (0181-1) from the base Ampharos sheets (SpriteCollab sprite/0181).
// Output: assets/sprite-custom/0181-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0181-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Ampharos: a long white mane flows from the top of the head down its back, and the tail tip
// becomes a big white fluffy cloud dotted with red orbs. Per frame: the head is the top of the body
// (tracked as the topmost body rows); the mane is drawn per facing as strands hanging from it (behind
// the body when it faces us, over the back when it faces away). The tail orb is the red blob furthest
// from the head; the cloud and extra orbs are built around it. Colours from the mega portrait.
import { run, hx, BLACK, N4, comps, stats, get, set, inside, closeOutline, remap, outer } from '../.cache/mega-base/_lib.mjs';

const RED = new Set(['d73f00', '9f0000', 'ff875f'].map(hx));
const BODY = new Set(['fff700', 'dfb700', 'a76f00', 'ffffff', 'bfcff7', '6787af'].map(hx));
const C = { M: hx('e3e1dc'), L: hx('ffefef'), S: hx('bdb9ae'), D: hx('979180'), r: hx('d73f00'), rl: hx('ff875f'), rd: hx('9f0000') };
const REMAP = new Map([['fff700', 'ffef2f'], ['dfb700', 'dfbf37']].map(([a, b]) => [hx(a), hx(b)]));

// Mane per facing 0..4 (5..7 mirror 3..1), as a function of t = rows below the head top:
// centre x offset (negative = toward the back for right-facing), half width, t range, and from which t it
// is drawn over the body (Infinity = always behind).
const MANE = [
  { c: t => t * 0.15, w: t => 4.5 + 0.45 * t, t0: 1, t1: 16, front: Infinity },
  { c: t => -2 - 0.35 * t, w: t => 3.5 + 0.22 * t, t0: 1, t1: 14, front: Infinity },
  { c: t => -3 - 0.55 * t, w: t => 3 + 0.18 * t, t0: 1, t1: 13, front: Infinity },
  { c: t => -2 - 0.4 * t, w: t => 4 + 0.22 * t, t0: 1, t1: 14, front: 8 },
  { c: t => 0, w: t => 5 + 0.25 * t, t0: 1, t1: 15, front: 5 },
];

function mega(f, dir) {
  const W = f.W;
  const body = []; for (let i = 0; i < f.px.length; i++) if (BODY.has(f.px[i])) body.push(i);
  if (body.length < 30) { remap(f, REMAP); closeOutline(f); return; }
  const bs = stats(f, body);
  const topRows = body.filter(i => ((i / W) | 0) <= bs.y0 + 3);
  const hxc = stats(f, topRows).cx, hy = bs.y0;
  const mir = dir > 4, m = MANE[mir ? 8 - dir : dir], sx = mir ? -1 : 1;
  const old = f.px.slice(), was = (x, y) => (inside(f, x, y) ? old[y * W + x] : -1);
  const canBehind = (x, y) => was(x, y) < 0 || (was(x, y) === BLACK && N4.some(([dx, dy]) => was(x + dx, y + dy) < 0));

  // 1. Mane strands.
  const pts = new Map();
  for (let t = m.t0; t <= m.t1; t++) {
    const cx = hxc + sx * m.c(t), w = m.w(t) + Math.sin(t * 0.9) * 0.7, y = hy + t;
    const taper = t > m.t1 - 3 ? (m.t1 - t + 1) / 4 : 1;     // wispy, scalloped tips
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const u = (x + 0.5 - cx) / w; if (Math.abs(u) > 1) continue;
      if (taper < 1 && ((x + t) % 3 === 0 || Math.abs(u) > taper + 0.1)) continue;
      const strand = ((x - Math.round(cx) + 99) % 3 + 3) % 3;
      let c = strand === 0 ? C.S : C.M;
      if (u < -0.55) c = C.L; else if (u > 0.6) c = C.D;
      if (t > m.t1 - 4 && strand === 0) c = C.D;
      pts.set(x + ',' + y, [c, t]);
    }
  }
  for (const [p, [c, t]] of pts) {
    const [x, y] = p.split(',').map(Number); if (!inside(f, x, y)) continue;
    if (t >= m.front || canBehind(x, y)) set(f, x, y, c);
  }
  for (const p of pts.keys()) {
    const [x, y] = p.split(',').map(Number);
    for (const [dx, dy] of N4) {
      const q = (x + dx) + ',' + (y + dy); if (pts.has(q)) continue;
      const t = pts.get(p)[1];
      if (get(f, x + dx, y + dy) < 0 || (t >= m.front && canBehind(x + dx, y + dy) === false && was(x + dx, y + dy) !== BLACK && BODY.has(get(f, x + dx, y + dy)))) set(f, x + dx, y + dy, BLACK);
    }
  }

  // 2. Tail cloud around the red orb furthest from the head (at least 8 px away).
  const orbs = comps({ W, H: f.H, px: Int32Array.from(old) }, c => RED.has(c)).map(b => stats(f, b))
    .map(o => ({ ...o, d: Math.hypot(o.cx - hxc, o.cy - hy - 4) })).filter(o => o.d >= 8).sort((a, b) => b.d - a.d);
  const orb = orbs[0];
  if (orb) {
    const ox = orb.cx, oy = orb.cy, away = Math.sign(ox - hxc) || -sx;
    const lobes = [[0, 0, 3.6], [away * 3, -2, 3], [away * 3.5, 2, 2.8], [-away * 1, -3.2, 2.6], [away * 6, -0.5, 2.3]];
    const cl = new Map();
    for (const [lx, ly, r] of lobes) for (let y = Math.floor(oy + ly - r); y <= oy + ly + r; y++) for (let x = Math.floor(ox + lx - r); x <= ox + lx + r; x++) {
      const d = Math.hypot(x + 0.5 - ox - lx, y + 0.5 - oy - ly) / r; if (d > 1) continue;
      const k = x + ',' + y, shade = (y + 0.5 - oy - ly) / r + (x + 0.5 - ox - lx) / r * 0.3;
      const c = shade > 0.45 ? C.S : shade < -0.5 ? C.L : C.M;
      if (!cl.has(k) || c === C.S) cl.set(k, c);
    }
    const front = dir >= 3 && dir <= 5;
    for (const [p, c] of cl) { const [x, y] = p.split(',').map(Number); if (inside(f, x, y) && (front || canBehind(x, y))) set(f, x, y, c); }
    for (const p of cl.keys()) { const [x, y] = p.split(',').map(Number); for (const [dx, dy] of N4) if (!cl.has((x + dx) + ',' + (y + dy)) && (get(f, x + dx, y + dy) < 0 || (front && !cl.has((x + dx) + ',' + (y + dy)) && BODY.has(get(f, x + dx, y + dy))))) set(f, x + dx, y + dy, BLACK); }
    // Orbs: the original one back on top, plus small ones on the lobes.
    for (let y = orb.y0 - 1; y <= orb.y1 + 1; y++) for (let x = orb.x0 - 1; x <= orb.x1 + 1; x++) if (inside(f, x, y) && (RED.has(was(x, y)) || (was(x, y) === BLACK && N4.some(([dx, dy]) => RED.has(was(x + dx, y + dy)))))) set(f, x, y, was(x, y));
    for (const [lx, ly] of [[away * 4, -3], [away * 5, 2], [-away * 1, -5]]) {
      const x = Math.round(ox + lx), y = Math.round(oy + ly);
      if (cl.has(x + ',' + y) && cl.has((x + 1) + ',' + (y + 1))) { set(f, x, y, C.rl); set(f, x + 1, y, C.r); set(f, x, y + 1, C.r); set(f, x + 1, y + 1, C.rd); }
    }
  }
  remap(f, REMAP);
  closeOutline(f);
}

const SPIN = new Set(['Rotate', 'Swing']);
await run({
  key: '0181-1', dex: '0181', megaForm: '0001', mega,
  facing: (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r,
});
