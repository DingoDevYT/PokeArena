// Builds a custom PMD-style Mega Pidgeot (0018-1) from the base Pidgeot sheets.
// Output: assets/sprite-custom/0018-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0018-1.mjs [Walk Idle ...]   (no args = every sheet)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0018', OUT = path.join(ROOT, 'assets/sprite-custom/0018-1');

// Frame grows 20px wide (10 each side, centre unchanged) and 8px tall on top only, so footY += 8.
const PAD_X = 10, PAD_T = 8;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;

// Base Pidgeot palette -> Mega Pidgeot portrait palette (assets/sprite/0018-1/portrait.png).
const REMAP = new Map([
  ['fff700', 'f7e070'], ['dfb700', 'd7b040'], ['a76f00', 'a76727'],   // gold mane (portrait ecce6a/c2a953 lifted: they read beige at sprite size)
  ['e73f67', 'cf4f57'], ['ff8faf', 'e07373'], ['ffc7d7', 'ef9f9f'],  // red crest / tail
  ['fff79f', 'f3f3f3'], ['d7bf67', 'd7d3a7'],                         // cream -> white (shade is f7f7b7 dulled a step)
].map(([a, b]) => [K(a), hex(b)]));
const CREST = new Set(['fff700', 'dfb700', 'a76f00', 'e73f67', 'ff8faf'].map(K));
const GOLD = new Set(['fff700', 'dfb700'].map(K));
const PINK = new Set(['e73f67', 'ff8faf'].map(K));
const CREAM = new Set(['fff79f', 'd7bf67'].map(K));
const C = {
  black: [0, 0, 0],
  R: hex('cf4f57'), RL: hex('e07373'), RD: hex('9e3941'),
  G: hex('d7b040'), GL: hex('f7e070'), GD: hex('a76727'),
  U: hex('77c7d7'), UD: hex('3f8fa7'), UL: hex('c7eff7'), // cyan tips (portrait 77c7d7 plus a shade and a light step)
};

// Per direction (Down, DR, R, UR, Up; UL/L/DL mirror UR/R/DR):
//  back: the crest pixel furthest along this vector anchors the plume.
//  plume: streamers as polylines of offsets from that anchor, w = width at root, g = gold mane feather, front = drawn over the body.
//  wing: cream pixels furthest along these vectors become cyan wingtips.
const DIRS = [
  { back: [0, -1], wing: [[-1, 0.6], [1, 0.6]], plume: [
    { w: 3, p: [[0, 0], [3, -3], [7, -4], [10, -2], [12, 2], [13, 6]] },
    { w: 4, p: [[1, 0], [4, -2], [8, -1], [11, 3], [12, 8], [12, 13]] },
  ] },
  { back: [-1, -0.3], wing: [[-1, 0.8]], plume: [
    { w: 4, p: [[0, 1], [-4, 2], [-8, 3], [-11, 5], [-13, 8]] },
    { w: 3, g: 1, p: [[0, 0], [-3, 0], [-6, 0]] },
    { w: 4, p: [[0, 0], [-4, -2], [-9, -3], [-13, -3], [-16, -5]] },
  ] },
  { back: [-1, 0.5], wing: [[-1, 1]], plume: [
    { w: 4, p: [[0, 0], [-4, 0], [-8, 0], [-12, 1], [-15, 0]] },
    { w: 3, g: 1, p: [[0, -1], [-3, -2], [-6, -2]] },
    { w: 4, p: [[0, -1], [-4, -3], [-8, -4], [-12, -4], [-15, -6]] },
  ] },
  { back: [-0.6, 1], wing: [[-1, 0.6]], plume: [
    { w: 4, p: [[0, 0], [-4, 0], [-8, 1], [-12, 3], [-14, 6]] },
    { w: 4, p: [[1, 0], [0, 4], [-2, 8], [-4, 11], [-5, 14]], front: true },
  ] },
  { back: [0, 1], wing: [[-1, 0.6], [1, 0.6]], plume: [
    { w: 4, p: [[0, -1], [0, 4], [-1, 8], [0, 12], [1, 15]], front: true },
  ] },
];
const mirror = d => ({ back: [-d.back[0], d.back[1]], wing: d.wing.map(([x, y]) => [-x, y]), plume: d.plume.map(s => ({ ...s, p: s.p.map(([x, y]) => [-x, y]) })) });
const CFG = [DIRS[0], DIRS[1], DIRS[2], DIRS[3], DIRS[4], mirror(DIRS[3]), mirror(DIRS[2]), mirror(DIRS[1])];

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + PAD_X * 2, H = fh + PAD_T;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD_T) * W + x + PAD_X] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 4-connected components of pixels whose colour is in `set`.
function blobs(px, W, H, set) {
  const k = p => p && key(...p), seen = new Uint8Array(W * H), out = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !set.has(k(px[i]))) continue;
    const blob = [], st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy, n = yy * W + xx;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && !seen[n] && set.has(k(px[n]))) { seen[n] = 1; st.push(n); }
      }
    }
    out.push(blob);
  }
  return out.sort((a, b) => b.length - a.length);
}

// Pixels of `list` furthest along vector v (within `slack`), and their rounded centroid.
function extreme(list, W, v, slack) {
  const d = i => (i % W) * v[0] + ((i / W) | 0) * v[1];
  const m = Math.max(...list.map(d));
  const top = list.filter(i => d(i) >= m - slack);
  return { top, x: Math.round(top.reduce((s, i) => s + (i % W), 0) / top.length), y: Math.round(top.reduce((s, i) => s + ((i / W) | 0), 0) / top.length) };
}

// One tapered feather along a polyline. Returns Map(index -> colour) incl. its own black outline.
function feather(W, H, ax, ay, pts, w0, tip, body) {
  const fill = new Map(); // index -> t (0 root .. 1 tip)
  const segs = []; let len = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); len += l; }
  for (let s = 0, acc = 0; s < segs.length; acc += segs[s], s++) {
    const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
    for (let u = 0; u <= segs[s]; u += 0.25) {
      const t = (acc + u) / len, f = u / segs[s];
      const w = Math.max(1, Math.round(w0 * (1 - t) + 0.4 * t));
      const cx = ax + x0 + (x1 - x0) * f, cy = ay + y0 + (y1 - y0) * f;
      const bx = Math.round(cx - (w - 1) / 2), by = Math.round(cy - (w - 1) / 2);
      for (let yy = by; yy < by + w; yy++) for (let xx = bx; xx < bx + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx; fill.set(i, Math.max(fill.get(i) || 0, t));
      }
    }
  }
  const out = new Map();
  for (const i of fill.keys()) {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy, n = yy * W + xx;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && !fill.has(n)) out.set(n, C.black);
    }
  }
  for (const [i, t] of fill) {
    const x = i % W, y = (i / W) | 0;
    const has = (dx, dy) => fill.has(i + dy * W + dx) || (body && body[i + dy * W + dx]);
    const [L, M, D] = tip === 'g' ? [C.GL, C.G, C.GD] : tip && t > tip ? [C.UL, C.U, C.UD] : [C.RL, C.R, C.RD];
    out.set(i, !has(0, 1) || !has(1, 0) ? D : !has(0, -1) || !has(-1, 0) ? L : M); // lit from the top left
  }
  return out;
}

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  const cfg = CFG[dir];
  const out = px.slice();
  const back = new Array(W * H).fill(null), front = new Array(W * H).fill(null);
  const lay = (layer, m) => { for (const [i, c] of m) layer[i] = c; };

  // 1. Crest = largest crest-coloured blob that contains gold. Plume streams from its back end.
  const crest = blobs(px, W, H, CREST).find(b => b.filter(i => GOLD.has(k(px[i]))).length >= 3);
  const inCrest = new Uint8Array(W * H); if (crest) crest.forEach(i => (inCrest[i] = 1));
  if (crest && crest.length >= 12) {
    const a = extreme(crest, W, cfg.back, 0.6);
    for (const s of cfg.plume) lay(s.front ? front : back, feather(W, H, a.x, a.y, s.p, s.w, s.g ? 'g' : 0, s.front ? null : px));
  }

  // 2. Tail = biggest pink blob outside the crest. Its tip goes cyan and three longer feathers fan out past it.
  const tail = blobs(px, W, H, PINK).find(b => b.length >= 4 && !b.some(i => inCrest[i]));
  if (tail) {
    let bx = 0, by = 0, n = 0;
    for (let i = 0; i < W * H; i++) if (px[i]) { bx += i % W; by += (i / W) | 0; n++; }
    const tx = tail.reduce((s, i) => s + (i % W), 0) / tail.length, ty = tail.reduce((s, i) => s + ((i / W) | 0), 0) / tail.length;
    let vx = tx - bx / n, vy = ty - by / n; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const e = extreme(tail, W, [vx, vy], 1.2);
    const L = 8;
    for (const ang of [-0.32, 0.32, 0]) {
      const c = Math.cos(ang), s = Math.sin(ang), dx = vx * c - vy * s, dy = vx * s + vy * c;
      const r = v => Math.round(v);
      // starts 2px inside the old tail so the visible part is the full-width, cyan-tipped end
      lay(back, feather(W, H, e.x, e.y, [[r(-vx * 2), r(-vy * 2)], [r(dx * L * 0.5), r(dy * L * 0.5)], [r(dx * L), r(dy * L)]], 3, 0.6, px));
    }
  }

  // 3. Wingtips: the cream flight-feather pixels furthest out along each wing vector go cyan.
  const cream = [];
  for (let i = 0; i < W * H; i++) if (CREAM.has(k(px[i]))) cream.push(i);
  if (cream.length) for (const v of cfg.wing) for (const i of extreme(cream, W, v, 1.5).top) out[i] = k(px[i]) === K('fff79f') ? C.U : C.UD;

  // 4. Palette remap, then layers: plume/tail behind the body, front streamers over it.
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(k(out[i])) || out[i];
  for (let i = 0; i < W * H; i++) {
    if (!px[i] && back[i]) out[i] = back[i];
    if (front[i]) out[i] = front[i];
  }
  // 5. Close any open edge with a black outline.
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) ? null : out[(y + dy) * W + x + dx];
      if (p && k(p) !== BLACK) { fin[y * W + x] = C.black; break; }
    }
  }
  return fin;
}

const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const anims = window.SPRITES[BASE].anims;
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const file of sheets) {
  const name = file.replace('-Anim.png', '');
  if (want.length && !want.includes(name)) continue;
  const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
  if (!a) { console.warn('no frame size for', file); continue; }
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets/sprite', BASE, file)));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), rows === 1 ? 1 : r); // Sleep has one row, drawn facing down-right
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = px[y * W + x]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + PAD_T };
  made.push(file);
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
fs.writeFileSync(metaFile, JSON.stringify({ ...old, ...meta }, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(path.join(ROOT, 'assets/sprite/0018-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f))).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, PAD_X, PAD_T), get(mega, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
  const bandW = d => 8 * (d.w + GAP);
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
console.log('built', made.join(', '));
