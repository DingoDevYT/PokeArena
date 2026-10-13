// Builds a custom PMD-style Mega Meowstic (0678-1) from the base (male) Meowstic sheets.
// Output: assets/sprite-custom/0678-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0678-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Meowstic is half male, half female: its own left half (screen right when it faces us) is
// white with blue limbs, its right half stays the male's blue with white limbs. Per frame: find the
// head midline, swap blue <-> white on the left half, close the eyes (light-blue line on the blue
// side, yellow line on the white side), unfurl the ears (stretched up with the eye-like organ showing
// at the tip) and grow long spiky tufts out of the sides of the head.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const KEY = '0678-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const SRC = 'sprite/0678/', PORTRAIT = 'portrait/0678/0001/Normal.png';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base/0678');

// Frame grows 6px wide (3 each side, centre unchanged) and 4px tall on top only (taller ears), so footY += 4.
const PAD_X = 3, PAD_T = 4;
const EAR_UP = 3;   // rows the ears grow

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
// Male palette: blue light/mid/dark, white light/mid/dark/darkest; eye pupil and eye whites.
const SWAP = new Map([
  ['6080a8', 'f8f8f8'], ['485890', 'd0d8d8'], ['303888', 'a8b0b8'],
  ['f8f8f8', '6080a8'], ['d0d8d8', '485890'], ['a8b0b8', '303888'], ['788890', '303888'],
].map(([a, b]) => [K(a), hex(b)]));
const EYE = new Set(['208000', '5fbfdf', '9fffff', '77dff7'].map(K));
const SKIN = { blue: hex('485890'), white: hex('d0d8d8') };
const LID = { blue: hex('77c7d7'), white: hex('d6a861') };      // closed-eye lines (portrait colours)
const ORGAN = { blue: [hex('a6dfcd'), hex('efffc8')], white: [hex('d6a861'), hex('f1dc66')] }; // ear eye organ
// Base -> Mega portrait palette.
const REMAP = new Map([
  ['6080a8', '43719e'], ['485890', '34477c'], ['303888', '2f3551'],
  ['f8f8f8', 'fafafa'], ['d0d8d8', 'ccdcdf'], ['a8b0b8', '89aab9'],
].map(([a, b]) => [K(a), hex(b)]));
// Which screen side of the midline is the white (left) half, per facing (Down, DR, R, UR, Up, UL, L, DL).
// +1 = right of the midline, -1 = left, 'all'/'none' for the pure side views; off = midline shift toward the face.
const HALF = [{ s: 1, off: 0 }, { s: 1, off: 1 }, { s: 0 }, { s: -1, off: 0 }, { s: -1, off: 0 }, { s: -1, off: 0 }, { s: 2 }, { s: 1, off: -1 }];
// Lying, tumbling and fainting poses: the top of the sprite is not the ears.
const NO_EARS = new Set(['Sleep', 'EventSleep', 'Laying', 'Faint', 'Tumble', 'TumbleBack', 'Trip', 'Sink', 'LostBalance', 'HitGround', 'Head']);
// Side tuft (screen-right version; mirrored for the left side). '.' = keep, letters = palette.
const TUFT = ['#w#...', '#ww##.', '.#www#', '..###.'];
let clipped = 0;

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + PAD_X * 2, H = fh + PAD_T;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD_T) * W + x + PAD_X] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function components(W, H, test) {
  const seen = new Uint8Array(W * H), out = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !test(i)) continue;
    const blob = [], st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, n = yy * W + xx;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && !seen[n] && test(n)) { seen[n] = 1; st.push(n); }
      }
    }
    out.push(blob);
  }
  return out;
}

function megaFrame(f, dir, name) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  let out = px.slice();
  let y0 = H, y1 = 0;
  for (let i = 0; i < W * H; i++) if (px[i]) { y0 = Math.min(y0, (i / W) | 0); y1 = Math.max(y1, (i / W) | 0); }
  if (y0 >= H) return out;
  // 1. Midline = centre of the head rows (below the ears).
  let n = 0, sx = 0;
  for (let y = y0 + 4; y <= Math.min(y1, y0 + 9); y++) for (let x = 0; x < W; x++) if (px[y * W + x]) { n++; sx += x; }
  const h = HALF[dir], mid = sx / Math.max(n, 1) + (h.off || 0);
  const white = x => h.s === 2 || (h.s === 1 && x > mid) || (h.s === -1 && x < mid);
  // 2. Closed eyes: each eye blob becomes a 1px lid line on its bottom row, skin above.
  for (const blob of components(W, H, i => EYE.has(k(px[i])))) {
    const bot = Math.max(...blob.map(i => (i / W) | 0));
    for (const i of blob) {
      const side = white(i % W) ? 'white' : 'blue';
      out[i] = ((i / W) | 0) === bot ? LID[side] : (side === 'white' ? SKIN.blue : SKIN.white); // pre-swap colour
    }
  }
  // 3. Blue <-> white on the left half (eye lids excluded: they are already final colours).
  for (let i = 0; i < W * H; i++) if (out[i] && white(i % W) && !EYE.has(k(px[i]))) out[i] = SWAP.get(k(out[i])) || out[i];
  for (const blob of components(W, H, i => EYE.has(k(px[i])))) for (const i of blob) {
    const side = white(i % W) ? 'white' : 'blue';
    if (out[i] !== LID[side]) out[i] = SKIN[side];
  }
  // 4. Ears = narrow peaks of the silhouette top (column tops within 2 rows of the peak tip, at most
  //    6 columns). Each is stretched up EAR_UP rows by repeating its row tip+2, and in the facing-us
  //    views the organ shows just under the tip.
  if (!NO_EARS.has(name)) {
    const top = [...Array(W)].map((_, x) => { for (let y = 0; y < H; y++) if (out[y * W + x]) return y; return H; });
    const next = out.slice(), used = new Uint8Array(W);
    const order = [...Array(W).keys()].filter(x => top[x] <= y0 + 5).sort((a, b) => top[a] - top[b]);
    for (const tx of order) {
      if (used[tx]) continue;
      const tip = top[tx], cut = tip + 2;
      let l = tx, r = tx;
      while (l > 0 && top[l - 1] <= cut && !used[l - 1]) l--;
      while (r < W - 1 && top[r + 1] <= cut && !used[r + 1]) r++;
      for (let x = Math.max(0, l - 1); x <= Math.min(W - 1, r + 1); x++) used[x] = 1;
      if (r - l > 5) continue;
      for (let x = l; x <= r; x++) {
        for (let y = top[x]; y <= cut; y++) if (y - EAR_UP >= 0) next[(y - EAR_UP) * W + x] = out[y * W + x]; else clipped++;
        for (let y = Math.max(top[x], cut - EAR_UP + 1); y <= cut; y++) next[y * W + x] = out[cut * W + x];
      }
      if (dir <= 2 || dir >= 6) {
        const side = white((l + r) / 2) ? 'white' : 'blue';
        for (let y = tip - EAR_UP + 1; y <= tip - EAR_UP + 2; y++) for (let x = l; x <= r; x++) {
          const i = y * W + x; if (y >= 0 && next[i] && k(next[i]) !== BLACK) next[i] = ORGAN[side][y - tip + EAR_UP - 1];
        }
      }
    }
    out = next;
    // 5. Spiky tufts sweeping out of both sides of the head, just below the ears, drawn behind.
    let l = W, r = -1; const ty = y0 + 6;
    for (let x = 0; x < W; x++) if (out[ty * W + x]) { l = Math.min(l, x); r = Math.max(r, x); }
    if (r - l >= 5 && r - l <= 14) for (const [ex, mir] of [[r - 1, false], [l + 1, true]]) {
      const wc = white(mir ? l : r) ? hex('f8f8f8') : hex('6080a8');
      TUFT.forEach((row, py) => [...row].forEach((c, pxi) => {
        if (c === '.') return; const x = ex + (mir ? -pxi : pxi), y = ty - 1 + py;
        if (x < 0 || y < 0 || x >= W || y >= H) { clipped++; return; }
        if (!out[y * W + x]) out[y * W + x] = c === '#' ? [0, 0, 0] : wc;
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
      if (p && k(p) !== BLACK) { fin[y * W + x] = [0, 0, 0]; break; }
    }
  }
  return fin;
}

// ---- Base sheets: cached from SpriteCollab (downloaded once, politely, if missing).
async function cached(rel, file) {
  if (fs.existsSync(file) && fs.statSync(file).size) return file;
  for (let i = 1; ; i++) {
    const res = await fetch(RAW + rel);
    if (res.status === 404) return null;
    if (res.ok) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file; }
    if (i >= 3) throw new Error(`${rel}: HTTP ${res.status}`);
    await new Promise(r => setTimeout(r, 1000 * 2 ** i));
  }
}
const tag = (s, n) => s.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1];
const xml = fs.readFileSync(await cached(SRC + 'AnimData.xml', path.join(CACHE, 'AnimData.xml')), 'utf8');
const anims = {};
for (const [, b] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) if (!tag(b, 'CopyOf')) anims[tag(b, 'Name')] = { fw: +tag(b, 'FrameWidth'), fh: +tag(b, 'FrameHeight') };
const footYFromShadow = (png, fw, fh) => {
  let sum = 0, n = 0;
  for (let y = 0; y < fh && y < png.height; y++) for (let x = 0; x < fw && x < png.width; x++)
    if (png.data[(y * png.width + x) * 4 + 3] > 0) { sum += y; n++; }
  return n ? Math.round(sum / n) : Math.round(fh / 2 + fh / 4);
};
const portraitFile = await cached(PORTRAIT, path.join(CACHE, 'mega-portrait.png'));

const want = process.argv.slice(2);
const SPIN = new Set(['Rotate', 'Swing']);
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const [name, a] of Object.entries(anims)) {
  if (want.length && !want.includes(name)) continue;
  const file = `${name}-Anim.png`;
  const srcFile = await cached(SRC + file, path.join(CACHE, file));
  if (!srcFile) { console.warn('missing', file); continue; }
  const shadow = await cached(SRC + `${name}-Shadow.png`, path.join(CACHE, `${name}-Shadow.png`));
  a.footY = shadow ? footYFromShadow(PNG.sync.read(fs.readFileSync(shadow)), a.fw, a.fh) : Math.round(a.fh * 0.75);
  const src = PNG.sync.read(fs.readFileSync(srcFile));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    // Rotate and Swing spin through every facing: column c of row r faces (r - c) mod 8.
    const facing = SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r;
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), facing, name, c);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = px[y * W + x]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  }
  if (clipped) console.warn(name, 'clipped', clipped); clipped = 0;
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + PAD_T };
  made.push(file);
}

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band. Written before _anims.json (finished marker).
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(portraitFile);
  const done = Object.entries(anims).filter(([n]) => fs.existsSync(path.join(OUT, n + '-Anim.png'))).map(([name, a]) => {
    const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
    const base = read(path.join(CACHE, name + '-Anim.png')), mega = read(path.join(OUT, name + '-Anim.png'));
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
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
if (!process.env.DRAFT) fs.writeFileSync(metaFile, JSON.stringify({ ...old, ...meta }, null, 1)); // DRAFT=1: no finished marker
console.log('built', made.join(', '));
