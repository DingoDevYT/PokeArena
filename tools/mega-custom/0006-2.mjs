// Builds a custom PMD-style Mega Charizard Y (0006-2) from the base Charizard sheets.
// Output: assets/sprite-custom/0006-2/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0006-2.mjs [Walk Idle ...]   (no args = every sheet)
// Same approach as tools/build-mega-custom.mjs (Mega Venusaur): every frame is edited from its own pixels.
//  1. The head is tracked by template matching (heads of the standard poses), and three swept-back horns
//     (middle one longest) are drawn as pixel spikes anchored to it.
//  2. Wing tips are found by shape (narrow outlined spikes above the head line); each gets longer and the
//     wing's outer edge below it grows sawtooth points, so the wings read bigger and more ragged.
//  3. Palette remap to the Mega Charizard Y portrait (belly to cream, membrane to slate blue).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0006', OUT = path.join(ROOT, 'assets/sprite-custom/0006-2');
const PAD = 8;            // working margin on every side; trimmed back to what the new shape needs
const MATCH_MIN = 0.62;   // head template score needed before horns are drawn
const WING_EXT = 3;
// Rows below a wing tip where the outer edge grows a point, and the point's shape
// (pixels out from the edge, per row; top row longest = swept-up point).
const SERRATE = [[4, [3, 2, 1]], [8, [2, 1]]];

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0, T = -1;
// Base palette letters used by the patches (remapped afterwards like the original pixels).
const L = { o: K('d73f00'), d: K('9f0000'), l: K('ff875f'), b: K('373f8f') };
const SKIN = new Set([L.o, L.d, L.l]);
const YEL = new Set(['fff700', 'dfb700', 'a76f00'].map(K));
const FLAMEC = new Set([...YEL, L.l]);
// Base Charizard palette -> Mega Charizard Y portrait (assets/sprite/0006-2/portrait.png).
const REMAP = new Map([
  // Skin: a third of the way from the sprite orange to the portrait orange. Mega Y keeps Charizard's colours, and the
  // portrait is softer than the sprite exactly as the base portrait is, so a full swap turned the sprite brown.
  ['9f0000', 'a41f12'], ['d73f00', 'd4511a'], ['ff875f', 'fb8d64'],
  ['373f8f', '355466'],                                                    // wing membrane
].map(([a, b]) => [K(a), K(b)]));
const BELLY = new Map([['fff700', 'ecdea7'], ['dfb700', 'cebc8e'], ['a76f00', 'a8956a']].map(([a, b]) => [K(a), K(b)]));

// Head templates: box (x0,y0,x1,y1) in a source frame + horn spikes in the same coordinates.
// A spike is [colour, [x,y] base, [x,y] tip]; core pixels go only where the frame is empty, flame, or silhouette outline.
const anims = window.SPRITES[BASE].anims;
const SRC = { W: ['Walk', 0], C: ['Charge', 0] };
// Directions 5-7 are drawn as mirrors of 3-1 (the base sheets mirror the same way, x' = fw - 1 - x).
const HEADS = [
  // Walk frame 0, per direction (Down, DownRight, Right, UpRight, Up)
  { src: 'W', dir: 0, box: [15, 5, 23, 19], horns: [['l', [16, 6], [14, 3]], ['l', [22, 6], [24, 3]], ['l', [19, 9], [19, 1]], ['o', [20, 8], [20, 6]]] },
  { src: 'W', dir: 1, box: [19, 2, 29, 19], horns: [['l', [18, 7], [16, 3]], ['l', [22, 8], [19, 1]], ['o', [23, 8], [22, 6]]] },
  { src: 'W', dir: 2, box: [19, 2, 33, 15], horns: [['l', [21, 4], [18, 0]], ['l', [20, 7], [19, 6]], ['l', [25, 5], [23, 2]]] },
  { src: 'W', dir: 3, box: [18, 2, 31, 16], horns: [['l', [19, 3], [17, 0]], ['l', [23, 3], [20, -2]], ['l', [26, 4], [24, 1]]] },
  { src: 'W', dir: 4, box: [15, 3, 24, 12], horns: [['l', [17, 4], [16, 1]], ['l', [19, 3], [19, -1]], ['o', [20, 3], [20, 0]], ['l', [21, 4], [22, 1]]] },
  // Charge frame 0 (flying pose, also used by Double/Shoot/Hop). Down/Right/Left heads match the Walk ones.
  { src: 'C', dir: 1, box: [26, 13, 37, 27], horns: [['l', [28, 14], [26, 11]], ['l', [31, 15], [31, 12]], ['l', [33, 13], [33, 9]]] },
  { src: 'C', dir: 3, box: [22, 6, 35, 14], horns: [['l', [24, 8], [22, 5]], ['l', [27, 7], [24, 3]], ['l', [30, 7], [28, 4]]] },
  { src: 'C', dir: 4, box: [20, 5, 28, 12], horns: [['l', [21, 7], [20, 4]], ['l', [24, 7], [24, 3]], ['l', [27, 7], [28, 4]]] },
];
for (const [src, from, to] of [['W', 3, 5], ['W', 2, 6], ['W', 1, 7], ['C', 3, 5], ['C', 1, 7]]) {
  const h = HEADS.find(v => v.src === src && v.dir === from), fw = anims[SRC[h.src][0]].fw, m = x => fw - 1 - x;
  HEADS.push({ src: h.src, dir: to, box: [m(h.box[2]), h.box[1], m(h.box[0]), h.box[3]],
    horns: h.horns.map(([c, b, t]) => [c, [m(b[0]), b[1]], [m(t[0]), t[1]]]) });
}

const animOf = file => Object.values(anims).find(v => v.file.endsWith('/' + file));
const readPng = p => PNG.sync.read(fs.readFileSync(p));
const srcPng = {};
const sheetPng = name => (srcPng[name] ||= readPng(path.join(ROOT, anims[name].file)));

// Frame -> Int32Array of colour keys on a padded canvas (T = transparent).
function frameOf(png, fx, fy, fw, fh) {
  const W = fw + PAD * 2, H = fh + PAD * 2, px = new Int32Array(W * H).fill(T);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD) * W + x + PAD] = key(png.data[i], png.data[i + 1], png.data[i + 2]);
  }
  return { W, H, px };
}

// Template pixel lists (padded coordinates), built once.
for (const h of HEADS) {
  const [name, col] = SRC[h.src], a = anims[name], f = frameOf(sheetPng(name), col * a.fw, h.dir * a.fh, a.fw, a.fh);
  const flame = flameMask(f);
  const [x0, y0, x1, y1] = h.box; h.pix = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y + PAD) * f.W + x + PAD;
    if (f.px[i] !== T && !flame[i]) h.pix.push([x - x0, y - y0, f.px[i]]);
  }
}

// Tail flame = 4-connected blobs of yellow/light orange that touch transparency (the body is always outlined).
function flameMask({ W, H, px }) {
  const m = new Uint8Array(W * H), seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !FLAMEC.has(px[s])) continue;
    const blob = [s], st = [s]; seen[s] = 1; let open = false;
    while (st.length) {
      const j = st.pop(), x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (px[n] === T) open = true;
        else if (!seen[n] && FLAMEC.has(px[n])) { seen[n] = 1; st.push(n); blob.push(n); }
      }
    }
    if (open) for (const j of blob) if (YEL.has(px[j]) || blob.length < 40) m[j] = 1;
  }
  // A blob that leaked into body highlights still only marks its yellow pixels; small blobs are pure flame.
  return m;
}

function bestHead(f, dir) {
  const { W, H, px } = f; let best = null;
  for (const h of HEADS) {
    const n = h.pix.length, bias = h.dir === dir ? 0.03 : 0;
    for (let oy = 0; oy < H; oy++) for (let ox = 0; ox < W; ox++) {
      // Stop early once this spot can no longer pass the threshold or beat the best (normalised) score.
      let m = 0, miss = 0, cap = n * (1 - Math.max(MATCH_MIN, best ? best.s - bias : 0));
      for (const [x, y, c] of h.pix) {
        const xx = ox + x, yy = oy + y;
        if (xx < W && yy < H && px[yy * W + xx] === c) m++; else if (++miss > cap) break;
      }
      const s = m / n + bias;
      if (miss <= cap && (!best || s > best.s)) best = { h, ox, oy, m, s };
    }
  }
  return best && best.m >= best.h.pix.length * MATCH_MIN ? best : null;
}

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const out = px.slice(), added = new Uint8Array(W * H);
  const flame = flameMask(f);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const free = i => out[i] === T || (flame[i] && !added[i]);
  const edgeBlack = (x, y) => out[y * W + x] === BLACK && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && free((y + dy) * W + x + dx));
  // Bresenham core line from base to tip, skipping pixels that already belong to the body.
  const spike = (c, [bx, by], [tx, ty]) => {
    let x = bx, y = by; const dx = Math.abs(tx - bx), dy = -Math.abs(ty - by), sx = bx < tx ? 1 : -1, sy = by < ty ? 1 : -1; let e = dx + dy;
    for (;;) {
      if (inside(x, y)) { const i = y * W + x; if (free(i) || edgeBlack(x, y)) { out[i] = c; added[i] = 1; } }
      if (x === tx && y === ty) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x += sx; } if (e2 <= dx) { e += dx; y += sy; }
    }
  };

  // 1. Head horns.
  const head = bestHead(f, dir);
  STATS.push(head ? head.h.src + head.h.dir : '-');
  let hb = null;
  if (head) {
    const { h, ox, oy } = head, sx = ox - h.box[0], sy = oy - h.box[1]; // source coords -> padded canvas
    const P = ([x, y]) => [x + sx, y + sy];
    hb = [ox, oy, ox + h.box[2] - h.box[0], oy + h.box[3] - h.box[1]];
    for (const [c, b, t] of h.horns) spike(L[c], P(b), P(t));
  }

  // 2. Wing tips: an outlined 1-2px spike whose black cap has nothing above it, narrow for 3+ rows, above the head line.
  let cx = 0, cn = 0, top = H, bot = 0;
  for (let i = 0; i < W * H; i++) if (px[i] !== T && !flame[i]) { cx += i % W; cn++; top = Math.min(top, (i / W) | 0); bot = Math.max(bot, (i / W) | 0); }
  if (cn) {
    cx = hb ? (hb[0] + hb[2]) / 2 : cx / cn;
    const lineY = hb ? hb[3] : top + (bot - top) * 0.4;
    const body = i => px[i] !== T && px[i] !== BLACK && !flame[i];
    const run = (x, y) => { let l = x, r = x; while (body(y * W + l - 1)) l--; while (body(y * W + r + 1)) r++; return [l, r]; };
    const tips = [];
    for (let y = 2; y < H - 4; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (!body(i) || px[i - W] !== BLACK || px[i - 2 * W] !== T) continue;
      if (body(i - W - 1) || body(i - W + 1)) continue;
      if (y > lineY) continue;
      if (hb && x >= hb[0] - 1 && x <= hb[2] + 1 && y >= hb[1] - 1 && y <= hb[3]) continue;
      let [l, r] = run(x, y); if (r - l > 1 || px[y * W + l - 1] !== BLACK || px[y * W + r + 1] !== BLACK) continue;
      // Follow the spike down 3 rows to get its lean.
      let ok = true, c0 = (l + r) / 2, c = c0;
      for (let k = 1; k <= 3 && ok; k++) {
        let nx = -1; for (const d of [0, -1, 1]) if (body((y + k) * W + Math.round(c) + d)) { nx = Math.round(c) + d; break; }
        if (nx < 0) { ok = false; break; }
        const [l2, r2] = run(nx, y + k); if (r2 - l2 > 3) ok = false; c = (l2 + r2) / 2;
      }
      if (ok) tips.push({ x, y, lean: (c0 - c) / 3 });
    }
    for (const t of tips) {
      const s = t.x < cx ? -1 : 1;
      const lean = Math.max(-1, Math.min(1, t.lean));
      const c = px[t.y * W + t.x];
      spike(c, [t.x, t.y - 1], [t.x + Math.round(lean * WING_EXT), t.y - WING_EXT]);
      // Ragged outer edge: sawtooth points sticking out of the wing's outer silhouette below the tip.
      for (const [dy, SAW] of SERRATE) {
        const y = t.y + dy; let x = t.x, n = 0;
        while (n < 8 && inside(x + s, y) && px[y * W + x + s] !== T && !flame[y * W + x + s]) { x += s; n++; }
        if (n >= 8 || px[y * W + x] !== BLACK) continue;
        const inner = px[y * W + x - s], fill = SKIN.has(inner) ? inner : c;
        SAW.forEach((len, k) => { for (let j = 0; j <= len; j++) { const xx = x + s * j, yy = y + k; if (!inside(xx, yy)) continue;
          const i = yy * W + xx; if (free(i) || edgeBlack(xx, yy)) { out[i] = fill; added[i] = 1; } } });
      }
    }
  }

  // 3. Palette remap (belly cream, flame keeps its yellow), then outline what was added.
  for (let i = 0; i < W * H; i++) {
    const p = out[i]; if (p === T) continue;
    if (YEL.has(p)) { if (!flame[i] || added[i]) out[i] = BELLY.get(p); continue; }
    out[i] = REMAP.get(p) ?? p;
  }
  const fin = out.slice();
  for (let i = 0; i < W * H; i++) {
    if (!added[i]) continue; const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inside(x + dx, y + dy)) continue; const n = (y + dy) * W + x + dx;
      if (!added[n] && (out[n] === T || flame[n])) fin[n] = BLACK;
    }
  }
  return fin;
}

const STATS = [];
const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const file of sheets) {
  const name = file.replace('-Anim.png', '');
  if (want.length && !want.includes(name)) continue;
  const a = animOf(file);
  if (!a) { console.warn('no frame size for', file); continue; }
  const src = readPng(path.join(ROOT, 'assets/sprite', BASE, file));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const frames = [];
  let padX = 0, padT = 0, padB = 0, hits = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const f = frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), px = megaFrame(f, r);
    frames.push({ r, c, px, W: f.W });
    for (let i = 0; i < px.length; i++) if (px[i] !== T) {
      const x = i % f.W - PAD, y = ((i / f.W) | 0) - PAD;
      padX = Math.max(padX, -x, x - a.fw + 1); padT = Math.max(padT, -y); padB = Math.max(padB, y - a.fh + 1);
    }
  }
  // Grow only as much as the new shape needs: even, symmetric in x (centre unchanged), top only in y.
  padX = Math.ceil(padX / 2) * 2; padT = Math.ceil(padT / 2) * 2;
  if (padB > 0) console.warn(name, 'spills below the frame by', padB);
  const W = a.fw + padX * 2, H = a.fh + padT;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (const { r, c, px, W: FW } of frames) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = px[(y - padT + PAD) * FW + x - padX + PAD]; if (p === T || p === undefined) continue;
    const o = ((r * H + y) * dst.width + c * W + x) * 4;
    dst.data[o] = p >> 16; dst.data[o + 1] = (p >> 8) & 255; dst.data[o + 2] = p & 255; dst.data[o + 3] = 255;
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + padT };
  made.push(name);
  if (process.env.STATS) { for (let r = 0; r < rows; r++) console.log(name, r, STATS.slice(r * cols, r * cols + cols).join(' ')); }
  STATS.length = 0;
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };
fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const portrait = readPng(path.join(ROOT, 'assets/sprite/0006-2/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = animOf(file), m = all[file.replace('-Anim.png', '')];
    const W = m.fw, H = m.fh, ox = (m.fw - a.fw) / 2, oy = m.fh - a.fh;
    const base = readPng(path.join(ROOT, 'assets/sprite', BASE, file)), mega = readPng(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, dx, dy) => (x, y) => {
      x -= dx; y -= dy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, ox, oy), get(mega, W, H, r, 0, 0)]);
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
