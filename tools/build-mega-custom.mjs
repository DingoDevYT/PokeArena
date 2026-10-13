// Builds a custom PMD-style Mega Venusaur (0003-1) from the base Venusaur sheets.
// Output: assets/sprite-custom/0003-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/build-mega-custom.mjs [Walk Idle ...]   (no args = every sheet)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0003', OUT = path.join(ROOT, 'assets/sprite-custom/0003-1');

// Frame grows 8px wide (4 each side, centre unchanged) and 8px tall on top only, so footY += 8.
const PAD_X = 4, PAD_T = 8;
const LIFT = 4;     // rows the flower rises on its new trunk
const RIM = 1;      // rings of extra petals grown around the flower
const PETALS = 8;   // petal seams kept black where the old outline meets the new rim
const FROND = 7;    // how far the side fronds reach past the flower edge
const TRUNK_W = 6;
const DESPECKLE = 1;   // interior flower blacks with <= this many black neighbours turn dark pink
// Colours in the BASE palette so the remap below turns them into mega colours.
const PET = { mid: [0xd7, 0x3f, 0x00], dark: [0x9f, 0x00, 0x00] };
const LEAF = { light: [0x9f, 0xcf, 0x6f], mid: [0x5f, 0xb7, 0x27], dark: [0x27, 0x87, 0x00] };

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));

// Base Venusaur palette -> Mega Venusaur portrait palette (assets/sprite/0003-1/portrait.png).
const REMAP = new Map([
  ['87afcf', '84c9d7'], ['67879f', '63a2b5'], ['3f576f', '477682'],   // skin
  ['278700', '006354'], ['5fb727', '3d8e70'], ['9fcf6f', '79ba8f'], ['d7efa7', 'b5dcb0'], // leaves
  ['9f0000', 'af5451'], ['d73f00', 'eb8b93'], ['ff875f', 'f4cdcd'],   // petals (light = portrait e9b0b2 lifted a step; too flat at sprite size)
].map(([a, b]) => [K(a), hex(b)]));
const FLOWER = new Set(['9f0000', 'd73f00', 'ff875f', 'a76f00', 'dfb700', 'ffffff'].map(K));
const YELLOW = new Set(['a76f00', 'dfb700'].map(K));
const BLACK = 0;
const C = {
  black: [0, 0, 0], trunk: hex('846d4e'), trunkD: hex('59473f'),
  P: hex('eb8b93'), L: hex('f4cdcd'), D: hex('af5451'), Y: hex('dfb700'), YD: hex('a76f00'),
  seam: hex('8a3c48'), // af5451 darkened one step: petal lines that used to be black
};

// Forehead flower patch, drawn centred on an anchor. '.' keeps the pixel underneath.
const CROWN = ['Y#Y#Y', 'YYYYY', 'dYdYd'];
const FOREHEAD =['.#.#.', '#LPL#', '#PYP#', '.###.'];
// Anchor offset from the original flower centre, per direction (Down, DR, R, UR, Up, UL, L, DL). null = head hidden.
const HEAD = [[0, 11], [3, 10], [6, 8], null, null, null, [-6, 8], [-3, 10]];

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + PAD_X * 2, H = fh + PAD_T;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD_T) * W + x + PAD_X] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : px[y * W + x];
  const k = p => p && key(...p);

  // 1. Main flower = largest 4-connected blob of flower colours.
  const seen = new Uint8Array(W * H); let comp = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !FLOWER.has(k(px[i]))) continue;
    const blob = [], st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (y + dy) * W + x + dx;
        if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && !seen[n] && FLOWER.has(k(px[n]))) { seen[n] = 1; st.push(n); }
      }
    }
    if (blob.length > comp.length) comp = blob;
  }
  const out = px.slice();
  if (comp.length >= 24) {
    const inComp = new Uint8Array(W * H); comp.forEach(i => (inComp[i] = 1));
    const ys = comp.filter(i => YELLOW.has(k(px[i])));
    const ctr = (ys.length >= 3 ? ys : comp);
    const cx = Math.round(ctr.reduce((s, i) => s + (i % W), 0) / ctr.length);
    const cy = Math.round(ctr.reduce((s, i) => s + ((i / W) | 0), 0) / ctr.length);
    // Flower region = blob + its black outline (8-neighbours).
    const region = new Uint8Array(W * H);
    for (const i of comp) {
      region[i] = 1; const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = at(x + dx, y + dy); if (p && k(p) === BLACK) region[(y + dy) * W + x + dx] = 1;
      }
    }
    // 2. Cut the flower out and lift it, then grow an extra ring of petals behind it.
    const flower = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) if (region[i]) { out[i] = null; }
    for (let i = 0; i < W * H; i++) if (region[i] && i - LIFT * W >= 0) flower[i - LIFT * W] = px[i];
    for (let ring = 0; ring < RIM; ring++) {
      const grow = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (flower[y * W + x]) continue;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && flower[yy * W + xx]) n++;
        }
        if (n) grow.push(y * W + x);
      }
      const isRim = new Uint8Array(W * H); grow.forEach(i => (isRim[i] = 1));
      // The old outline becomes petal colour, except on petal seams, so the flower reads as one bigger bloom.
      const seam = (x, y) => Math.floor((Math.atan2(y - (cy - LIFT), (x - cx) * 0.8) + Math.PI) / (Math.PI * 2) * PETALS * 3) % 3 === 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, p = flower[i]; if (!p || k(p) !== BLACK || seam(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRim[(y + dy) * W + x + dx])) flower[i] = PET.dark;
      }
      for (const i of grow) flower[i] = ((i / W) | 0) < cy - LIFT - 2 ? PET.light : PET.mid;
    }
    // De-speckle: lone interior black pixels (black on red reads fine, black on pastel pink reads as noise).
    const lone = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = flower[y * W + x]; if (!p || k(p) !== BLACK) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => flower[(y + dy) * W + x + dx]);
      if (nb.every(Boolean) && nb.filter(q => k(q) === BLACK).length <= DESPECKLE) lone.push(y * W + x);
    }
    for (const i of lone) flower[i] = C.seam;
    // Yellow crown on top of the trunk.
    CROWN.forEach((row, py) => [...row].forEach((c, pxi) => {
      if (c === '.') return; const x = cx - 2 + pxi, y = cy - LIFT - 2 + py;
      if (x >= 0 && y >= 0 && x < W && y < H) flower[y * W + x] = c === '#' ? C.black : c === 'Y' ? C.Y : C.YD;
    }));
    // 3. Trunk behind everything: from the lifted flower centre down through the hole.
    let bottom = 0; for (let i = 0; i < W * H; i++) if (region[i]) bottom = Math.max(bottom, (i / W) | 0);
    const tx0 = cx - TRUNK_W / 2, tx1 = cx + TRUNK_W / 2 - 1;
    for (let y = cy - LIFT; y <= bottom; y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * W + x; if (out[i] && !region[i]) continue;
      const edge = x === tx0 || x === tx1;
      out[i] = edge ? C.black : ((Math.abs(x - cx + 0.5) + y) % 3 < 1 ? C.trunkD : C.trunk);
    }
    // 4. Rest of the uncovered hole = palm leaflets under the umbrella (diagonal stripes off the trunk).
    for (let i = 0; i < W * H; i++) if (region[i] && !out[i]) {
      const x = i % W, y = (i / W) | 0;
      out[i] = (y + Math.abs(x - cx)) % 3 === 0 ? LEAF.dark : (y + Math.abs(x - cx)) % 3 === 1 ? LEAF.mid : LEAF.light;
    }
    // Big drooping fronds poking out past the body on both sides, behind everything.
    let fl = W, fr = 0;
    for (let i = 0; i < W * H; i++) if (flower[i]) { fl = Math.min(fl, i % W); fr = Math.max(fr, i % W); }
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? fl + 2 : fr - 2, y0 = cy - LIFT + 4;
      for (let t = 0; t <= FROND; t++) {
        const thick = 4 - Math.floor(t / 3) - (t % 2 && t > 3 ? 1 : 0); // taper + serrated underside
        for (let th = 0; th < thick; th++) {
          const x = x0 + s * t, y = y0 + Math.floor(t * t / 9) + th;
          if (x < 0 || y < 0 || x >= W || y >= H || out[y * W + x] || flower[y * W + x]) continue;
          out[y * W + x] = th === 0 ? LEAF.light : th === thick - 1 ? LEAF.dark : LEAF.mid;
        }
      }
    }
    for (let i = 0; i < W * H; i++) if (flower[i]) out[i] = flower[i];
    // 5. Forehead flower.
    const h = HEAD[dir];
    if (h) {
      const ax = cx + h[0] - 2, ay = cy + h[1] - 1;
      FOREHEAD.forEach((row, py) => [...row].forEach((c, pxi) => {
        if (c === '.') return; const x = ax + pxi, y = ay + py;
        if (x < 0 || y < 0 || x >= W || y >= H || !out[y * W + x]) return;
        out[y * W + x] = c === '#' ? C.black : C[c];
      }));
    }
  }
  // 6. Palette remap, then close any open edge with a black outline.
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(k(out[i])) || out[i];
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), r);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = px[y * W + x]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + PAD_T };
  made.push({ file, a, W, H, rows });
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
fs.writeFileSync(metaFile, JSON.stringify({ ...old, ...meta }, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(path.join(ROOT, 'assets/sprite/0003-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f))).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
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
console.log('built', made.map(m => m.file).join(', '));
