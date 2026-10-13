// Builds a custom PMD-style Mega Pinsir (0127-1) from the base Pinsir sheets.
// Output: assets/sprite-custom/0127-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0127-1.mjs [Walk Idle ...]   (no args = every sheet)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0127', OUT = path.join(ROOT, 'assets/sprite-custom/0127-1');

// Frame grows 16px wide (8 each side, centre unchanged) for the wings and 6px on top for the horns, so footY += 6.
const PAD_X = 8, PAD_T = 6;
const PAD_B = { Sleep: 4 }; // Sleep's base art already sits on the bottom row and its horns point down
const LIFT = 2;    // steps each horn is pushed further out from the body
const HORN_MIN = 15; // smallest blob counted as a horn
const SPIKE = 2;   // how far each horn spike is pushed out
const DEBUG = process.env.DEBUG === '1'; // marks the tracked anchor in magenta

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const BODY = new Set(['ffe79f', 'dfaf67', 'df771f', 'a75f1f', '773f00'].map(K));
const HORN = new Set(['ffffff', 'd7dfdf', 'afb7bf', '7f8f97', '47676f'].map(K));

// Base Pinsir palette -> Mega Pinsir portrait palette (assets/sprite/0127-1/portrait.png).
const REMAP = new Map([
  ['ffe79f', 'dfd0c9'], ['dfaf67', 'dfd0c9'], ['df771f', 'bbaaaa'], ['a75f1f', '928279'], ['773f00', '665447'], // body
  ['ffffff', 'f8f8f8'], ['d7dfdf', 'f8f8f8'], ['afb7bf', 'c2c6c9'], ['7f8f97', '8f9a9d'], ['47676f', '665447'], // horns, claws, teeth
].map(([a, b]) => [K(a), hex(b)]));
const C = {
  '#': [0, 0, 0], Y: hex('ffed6e'), y: hex('d8b954'), O: hex('da7529'), o: hex('b3622a'),
  W: hex('f8f8f8'), w: hex('c2c6c9'),
};

// Wings, drawn for the right side; the left side is the mirror. [x, y] = root pixel that sits on the anchor.
const WING = {
  U: { root: [1, 9], rows: [
    '..........####..',
    '........##YYYY#.',
    '......##YYyyyyO#',
    '.....#YYyyOOOOo#',
    '....#YyyOOOOooo#',
    '...#yyOOOOooo#..',
    '..#yOOOooo###...',
    '.#yOOoo###......',
    '#OOoo##.........',
    '#oo##...........',
    '###.............'] },
  L: { root: [1, 1], rows: [
    '###...........',
    '#oO##.........',
    '#ooOOY###.....',
    '.#ooOOyyY###..',
    '..#ooOOOyyYY#.',
    '...#oooOOOyY#.',
    '....##ooooOO#.',
    '......###ooo#.',
    '.........###..'] },
  F: { root: [0, 3], rows: [ // folded along the back (Sleep)
    '.....######.',
    '...##YYYYyy#',
    '.##yyOOOOOo#',
    '#OOooooo###.',
    '#######.....'] },
};
// Per direction (Down, DR, R, UR, Up, UL, L, DL): wings as [shape, side, dx, dy, inFront] from the body centroid.
// Behind-the-body wings only fill empty pixels, so earlier entries sit in front of later ones.
const WINGS = [
  [['U', 1, 7, -1, 0], ['U', -1, -7, -1, 0], ['L', 1, 7, 1, 0], ['L', -1, -7, 1, 0]],
  [['U', -1, -4, -2, 0], ['L', -1, -5, 0, 0], ['U', 1, 4, -3, 0], ['L', 1, 6, 0, 0]],
  [['U', -1, -2, -2, 0], ['L', -1, -3, 0, 0], ['U', -1, 0, -4, 0], ['L', -1, -1, -1, 0]],
  [['U', -1, -1, -1, 1], ['L', -1, -1, 1, 1], ['U', 1, 3, -2, 0], ['L', 1, 3, 1, 0]],
  [['U', 1, 1, 0, 1], ['U', -1, -1, 0, 1], ['L', 1, 1, 2, 1], ['L', -1, -1, 2, 1]],
  [['U', 1, 1, -1, 1], ['L', 1, 1, 1, 1], ['U', -1, -3, -2, 0], ['L', -1, -3, 1, 0]],
  [['U', 1, 2, -2, 0], ['L', 1, 3, 0, 0], ['U', 1, 0, -4, 0], ['L', 1, 1, -1, 0]],
  [['U', 1, 4, -2, 0], ['L', 1, 5, 0, 0], ['U', -1, -4, -3, 0], ['L', -1, -6, 0, 0]],
];
// Sleep lies flat on its belly: wings folded on its back, pointing to the tail.
const SLEEP_WINGS = [['F', 1, -4, -2, 1], ['F', 1, -3, 1, 1]];

function frameOf(png, fx, fy, fw, fh, padB) {
  const W = fw + PAD_X * 2, H = fh + PAD_T + padB;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD_T) * W + x + PAD_X] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function megaFrame(f, dir, wings) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let out = px.slice();

  // 1. Anchor = centroid of the body colours.
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (BODY.has(k(px[i]))) { sx += i % W; sy += (i / W) | 0; n++; }
  if (n < 20) return finish(out);
  const cx = Math.round(sx / n), cy = Math.round(sy / n);

  // 2. Horns = big 8-connected blobs of horn colours touching the body (claws and teeth are small blobs,
  //    hit sparkles in Hurt use the same colours but float free). Works whichever way the horns point.
  const seen = new Uint8Array(W * H), horn = new Uint8Array(W * H), blobs = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !HORN.has(k(px[i]))) continue;
    const blob = [], st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const m = (y + dy) * W + x + dx;
        if (inb(x + dx, y + dy) && !seen[m] && HORN.has(k(px[m]))) { seen[m] = 1; st.push(m); }
      }
    }
    const touchesBody = blob.some(j => { const x = j % W, y = (j / W) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy) && BODY.has(k(px[(y + dy) * W + x + dx]))) return true; return false; });
    if (blob.length >= HORN_MIN && touchesBody) { blob.forEach(j => (horn[j] = 1)); blobs.push(blob); }
  }
  // 3. Bigger, more jagged horns. Each horn is re-stamped LIFT steps further out along the line from the body
  //    centroid to the horn: lower stamps only carry the solid core (pixels with 2+ horn neighbours) so the thorns
  //    don't smear, the top stamp carries the full horn with its outline. Then every original thorn (a horn pixel
  //    with a single horn neighbour) is pushed SPIKE px further out.
  const isH = (x, y) => inb(x, y) && horn[y * W + x];
  const hn = (x, y) => N4.filter(([dx, dy]) => isH(x + dx, y + dy));
  for (const blob of blobs) {
    let bx = 0, by = 0; blob.forEach(j => { bx += j % W; by += (j / W) | 0; }); bx /= blob.length; by /= blob.length;
    const len = Math.hypot(bx - cx, by - cy) || 1, vx = (bx - cx) / len, vy = (by - cy) / len;
    const own = new Set(blob);
    const outline = new Set();
    for (const j of blob) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = j % W + dx, y = ((j / W) | 0) + dy;
      if (inb(x, y) && !horn[y * W + x] && k(px[y * W + x]) === BLACK) outline.add(y * W + x);
    }
    const stamped = new Set(blob);
    for (let t = 1; t <= LIFT; t++) {
      const ox = Math.round(vx * t), oy = Math.round(vy * t), top = t === LIFT;
      for (const j of blob) {
        const x = j % W, y = (j / W) | 0;
        if (!top && hn(x, y).length < 2) continue;
        const X = x + ox, Y = y + oy; if (!inb(X, Y)) continue;
        out[Y * W + X] = px[j]; stamped.add(Y * W + X);
      }
      if (top) for (const j of outline) {
        const X = j % W + ox, Y = ((j / W) | 0) + oy; if (!inb(X, Y)) continue;
        if (!out[Y * W + X] || k(out[Y * W + X]) === BLACK) out[Y * W + X] = C['#'];
        else if (!stamped.has(Y * W + X) && !BODY.has(k(out[Y * W + X]))) out[Y * W + X] = C['#'];
      }
      if (top) for (const j of blob) {
        const x = j % W, y = (j / W) | 0, h = hn(x, y); if (h.length !== 1) continue;
        const dx = -h[0][0], dy = -h[0][1];
        for (let s = 1; s <= SPIKE; s++) {
          const X = x + ox + dx * s, Y = y + oy + dy * s; if (!inb(X, Y)) break;
          const q = out[Y * W + X]; if (q && !stamped.has(Y * W + X) && k(q) !== BLACK) break;
          out[Y * W + X] = C.W; stamped.add(Y * W + X);
        }
      }
    }
  }
  // 4. Wings.
  const draw = (shape, side, dx, dy, front) => {
    const w = WING[shape], ax = cx + dx, ay = cy + dy;
    w.rows.forEach((row, py) => [...row].forEach((c, pxi) => {
      if (c === '.') return;
      const x = ax + side * (pxi - w.root[0]), y = ay + py - w.root[1];
      if (!inb(x, y)) return;
      if (!front && out[y * W + x]) return;
      if (front && c === '#' && out[y * W + x] && k(out[y * W + x]) !== BLACK && !BODY.has(k(out[y * W + x]))) return;
      out[y * W + x] = C[c];
    }));
  };
  for (const w of wings) if (!w[4]) draw(...w);
  for (const w of wings) if (w[4]) draw(...w);
  if (DEBUG) out[cy * W + cx] = [255, 0, 255];
  return finish(out);

  function finish(o) {
    // 5. Palette remap, then close any open edge with a black outline.
    for (let i = 0; i < W * H; i++) if (o[i]) o[i] = REMAP.get(k(o[i])) || o[i];
    const fin = o.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (o[y * W + x]) continue;
      for (const [dx, dy] of N4) {
        const p = inb(x + dx, y + dy) ? o[(y + dy) * W + x + dx] : null;
        if (p && k(p) !== BLACK) { fin[y * W + x] = C['#']; break; }
      }
    }
    return fin;
  }
}

const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const anims = window.SPRITES[BASE].anims;
const sizeOf = file => Object.values(anims).find(v => v.file.endsWith('/' + file));
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const file of sheets) {
  const name = file.replace('-Anim.png', '');
  if (want.length && !want.includes(name)) continue;
  const a = sizeOf(file);
  if (!a) { console.warn('no frame size for', file); continue; }
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets/sprite', BASE, file)));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const padB = PAD_B[name] || 0;
  const W = a.fw + PAD_X * 2, H = a.fh + PAD_T + padB;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh, padB), r, name === 'Sleep' ? SLEEP_WINGS : WINGS[r]);
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
  const portrait = read(path.join(ROOT, 'assets/sprite/0127-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f))).map(file => {
    const a = sizeOf(file), name = file.replace('-Anim.png', '');
    const W = a.fw + PAD_X * 2, H = a.fh + PAD_T + (PAD_B[name] || 0);
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    // Both frames in mega coordinates: base pixel (x, y) sits at (x + PAD_X, y + PAD_T).
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
