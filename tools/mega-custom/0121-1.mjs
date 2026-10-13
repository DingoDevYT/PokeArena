// Builds a custom PMD-style Mega Starmie (0121-1) from the base Starmie sheets.
// Output: assets/sprite-custom/0121-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0121-1.mjs [Walk Idle ...]   (no args = every sheet)
// Recolour to the brighter, glossier mega purple and gold, then grow the star: every purple arm tip found
// by radial search around the core is extended outward (the two lowest arms become long legs ending in
// flat stumpy feet) and the gold spokes of the core are lengthened into a bigger X.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const KEY = '0121-1', BASE = '0121', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const WORK = 24;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const PUR = new Set(['b797df', '8f67bf', '572f9f'].map(K));
const GOLD = new Set(['fff700', 'dfb700', 'a76f00'].map(K));
const CORE = new Set(['d73f00', '9f0000', 'ff875f', 'ffffff'].map(K));
// Portrait (portrait/0121/0001/Normal.png) colours.
const REMAP = new Map([
  ['b797df', 'bea4d3'], ['8f67bf', '9070ac'], ['572f9f', '7d5e9c'],
  ['fff700', 'ffff61'], ['dfb700', 'e2c02b'], ['a76f00', 'b57c40'],
  ['d73f00', 'df545a'], ['9f0000', '9c202d'], ['ff875f', 'fe8c8c'],
].map(([a, b]) => [K(a), hex(b)]));
const C = { black: [0, 0, 0], L: hex('e7f7bf'), a: hex('bea4d3'), b: hex('9070ac'), c: hex('7d5e9c'), d: hex('553f64'), gold: hex('e2c02b'), goldL: hex('ffff61') };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ARM = 3, LEG = 8, SPOKE = 2;

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function megaFrame(f) {
  const { W, H, px } = f;
  const k = p => (p ? key(...p) : -1);
  const kk = px.map(k);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const X = i => i % W, Yc = i => (i / W) | 0;
  const comps = test => {
    const seen = new Uint8Array(W * H), list = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !test(i)) continue;
      const blob = [], st = [i]; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); blob.push(j);
        for (const [dx, dy] of N4) { const x = X(j) + dx, y = Yc(j) + dy, n = y * W + x; if (inside(x, y) && !seen[n] && test(n)) { seen[n] = 1; st.push(n); } }
      }
      list.push(blob);
    }
    return list;
  };
  const cen = b => [b.reduce((s, i) => s + X(i), 0) / b.length, b.reduce((s, i) => s + Yc(i), 0) / b.length];
  const out = px.slice();
  for (let i = 0; i < W * H; i++) if (out[i] && REMAP.has(kk[i])) out[i] = REMAP.get(kk[i]);
  const core = comps(i => CORE.has(kk[i]) || GOLD.has(kk[i])).sort((a, b) => b.length - a.length)[0];
  const body = []; for (let i = 0; i < W * H; i++) if (PUR.has(kk[i])) body.push(i);
  if (body.length < 40) return out;
  const hasCore = core && core.length >= 14;
  const [cx, cy] = cen(hasCore ? core : body);
  // Radial tips of a pixel set: per angle bin the farthest pixel, keep clear local maxima.
  const BINS = 36;
  const tips = (set, minFrac) => {
    const best = new Array(BINS).fill(null);
    for (const i of set) {
      const dx = X(i) - cx, dy = Yc(i) - cy, r = Math.hypot(dx, dy); if (r < 2) continue;
      const b = Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * BINS) % BINS;
      if (!best[b] || r > best[b].r) best[b] = { i, r, dx, dy };
    }
    const rmax = Math.max(...best.map(b => (b ? b.r : 0)));
    const res = [];
    for (let b = 0; b < BINS; b++) {
      const v = best[b]; if (!v || v.r < rmax * minFrac) continue;
      let ok = true;
      for (let o = -3; o <= 3; o++) { const n = best[(b + o + BINS) % BINS]; if (n && n.r > v.r || (n && n.r === v.r && o < 0)) ok = false; }
      if (ok) res.push(v);
    }
    return res;
  };
  const behind = i => !out[i] || k(out[i]) === BLACK;
  // 1. Arms and legs: extend each purple tip along its radial direction.
  const ptips = tips(body, 0.55);
  for (const t of ptips) {
    const L = Math.hypot(t.dx, t.dy), ux = t.dx / L, uy = t.dy / L, vx = -uy, vy = ux;
    const leg = uy > 0.35, len = leg ? LEG : ARM, mask = new Map();
    const x0 = X(t.i), y0 = Yc(t.i);
    for (let s = 1; s <= len; s++) {
      const half = leg ? (s > len - 2 ? 2.6 : 2.0) : Math.max(0.6, 1.8 - s * 0.35);
      for (let o = -half; o <= half; o += 0.5) {
        const x = Math.round(x0 + ux * s + vx * o), y = Math.round(y0 + uy * s + vy * o);
        if (!inside(x, y)) continue;
        const f = o / half;
        mask.set(y * W + x, leg && s > len - 2 ? (f < -0.2 ? C.b : C.c) : f < -0.45 ? C.a : f < 0.45 ? C.b : C.c);
      }
    }
    for (const [i, c] of mask) {
      const edge = N4.some(([ex, ey]) => !mask.has(i + ey * W + ex)) && !N4.every(([ex, ey]) => mask.has(i + ey * W + ex) || out[i + ey * W + ex]);
      if (behind(i)) out[i] = edge ? C.black : c;
    }
  }
  // 2. Gold spokes: lengthen the longest ones into an X.
  const gold = []; if (hasCore) for (const i of core) if (GOLD.has(kk[i])) gold.push(i);
  for (const t of tips(gold, 0.6)) {
    const L = Math.hypot(t.dx, t.dy), ux = t.dx / L, uy = t.dy / L;
    for (let s = 1; s <= SPOKE; s++) {
      const x = Math.round(X(t.i) + ux * s), y = Math.round(Yc(t.i) + uy * s), i = y * W + x;
      if (inside(x, y) && behind(i)) out[i] = s === 1 ? C.gold : C.goldL;
    }
  }
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) { const p = inside(x + dx, y + dy) ? out[(y + dy) * W + x + dx] : null; if (p && k(p) !== BLACK) { fin[y * W + x] = C.black; break; } }
  }
  return fin;
}

// ---- Shared driver: build every sheet, trim pads, write _anims.json and _preview.png last. ----
const portraitFile = path.join(ROOT, 'tools/.cache/mega-base/portrait', KEY + '.png');
if (!fs.existsSync(portraitFile)) {
  const [d, f] = KEY.split('-');
  const r = await fetch(`https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${d}/${f.padStart(4, '0')}/Normal.png`);
  fs.mkdirSync(path.dirname(portraitFile), { recursive: true });
  fs.writeFileSync(portraitFile, Buffer.from(await r.arrayBuffer()));
}
// Rotate and Swing spin through every facing: column c of row r faces (r - c) mod 8. Single-row sheets
// (Sleep...) lie facing down-left.
const SPIN = new Set(['Rotate', 'Swing']);
const facing = (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r;
const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const anims = window.SPRITES[BASE].anims;
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
for (const file of sheets) {
  const name = file.replace('-Anim.png', '');
  if (want.length && !want.includes(name)) continue;
  const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
  if (!a) { console.warn('no frame size for', file); continue; }
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets/sprite', BASE, file)));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const frames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) frames.push(megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), facing(name, r, c, rows)));
  // Smallest pad (multiple of 4, symmetric in x so the centre holds, top-only in y) that fits every frame.
  const WW = a.fw + WORK * 2;
  let px = 0, pt = 0, pb = 0;
  for (const fr of frames) fr.forEach((p, i) => {
    if (!p) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
    px = Math.max(px, -x, x - a.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - a.fh + 1);
  });
  if (pb > 0) console.warn(file, 'spills', pb, 'px below the frame (clipped)');
  const PX = Math.ceil(px / 4) * 4, PT = Math.ceil(pt / 4) * 4;
  const W = a.fw + PX * 2, H = a.fh + PT;
  const dst = new PNG({ width: cols * W, height: rows * H });
  frames.forEach((fr, n) => {
    const r = (n / cols) | 0, c = n % cols;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = fr[(y - PT + WORK) * WW + x - PX + WORK]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  });
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + PT };
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(portraitFile);
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const { fw: W, fh: H } = all[file.replace('-Anim.png', '')];
    const padX = (W - a.fw) / 2, padT = H - a.fh;
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, padX, padT), get(mega, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
  const bandW = d => d.cells.length * (d.w + GAP);
  const bands = [];
  for (let i = 0; i < done.length; i += PER) bands.push(done.slice(i, i + PER));
  const width = Math.max(portrait.width, ...bands.map(b => b.reduce((s, d) => s + bandW(d) + GAP * 3, 0))) + GAP;
  const height = portrait.height + GAP + bands.reduce((s, b) => s + Math.max(...b.map(d => d.h * 2 + GAP * 2)) + GAP * 2, 0);
  const pv = new PNG({ width: width * S, height: height * S });
  for (let i = 0; i < pv.data.length; i += 4) { pv.data[i] = pv.data[i + 1] = pv.data[i + 2] = 48; pv.data[i + 3] = 255; }
  const put = (x, y, p) => { for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = ((y * S + yy) * pv.width + x * S + xx) * 4; pv.data[o] = p[0]; pv.data[o + 1] = p[1]; pv.data[o + 2] = p[2]; } };
  const tile = (dx, dy, w, h, g, ox, oy) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = g(x + ox, y + oy) || (((x >> 2) + (y >> 2)) & 1 ? [62, 62, 62] : [56, 56, 56]); put(dx + x, dy + y, p); }
  };
  for (let y = 0; y < portrait.height; y++) for (let x = 0; x < portrait.width; x++) { const i = (y * portrait.width + x) * 4; put(x, y, [portrait.data[i], portrait.data[i + 1], portrait.data[i + 2]]); }
  let by = portrait.height + GAP;
  for (const b of bands) {
    let bx = GAP;
    for (const d of b) {
      d.cells.forEach(([gb, gm], r) => {
        tile(bx + r * (d.w + GAP), by, d.w, d.h, gb, d.x0, d.y0);
        tile(bx + r * (d.w + GAP), by + d.h + GAP, d.w, d.h, gm, d.x0, d.y0);
      });
      bx += bandW(d) + GAP * 3;
    }
    by += Math.max(...b.map(d => d.h * 2 + GAP * 2)) + GAP * 2;
  }
  fs.writeFileSync(path.join(OUT, '_preview.png'), PNG.sync.write(pv));
}
fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));
console.log(KEY, 'built', Object.keys(meta).join(', '));
