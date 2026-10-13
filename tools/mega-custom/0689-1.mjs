// Builds a custom PMD-style Mega Barbaracle (0689-1) from the base Barbaracle sheets.
// Output: assets/sprite-custom/0689-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0689-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Barbaracle has eight arms instead of four. Per frame: every arm (limb colours well out from
// the body centre, as connected blobs with their outline) is copied, shaded one step darker and
// pasted behind the sprite fanned out (upper arms copied out and down, lower arms out and up), so the
// extra arms move with the real ones. Then black spikes are added along the top of the body rock and
// the palette goes to the Mega portrait: hands and head turn black, rock blue-white, orange kept.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const KEY = '0689-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const SRC = 'sprite/0689/', PORTRAIT = 'portrait/0689/0001/Normal.png';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base/0689');

// Frame grows 12px wide (6 each side, centre unchanged), nothing on top, so footY is unchanged.
const PAD_X = 6, PAD_T = 0;
const ARM_OUT = 5, ARM_Y = 4, ARM_MIN_DX = 7;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
// Limb colours: brown hand shades, orange stalks, white claws.
const LIMB = new Set(['554b2a', '72693a', '433e25', '2b281d', 'f0a662', 'c26e49', 'f5f5f5', '8c322e'].map(K));
const ROCK = new Set(['c9cbda', '9093b4', 'f1f2f5', '686b91', '50536e'].map(K));
// Copies sit further back: one shade darker.
const DARKER = new Map([
  ['f5f5f5', 'c9cbda'], ['f0a662', 'c26e49'], ['72693a', '554b2a'], ['554b2a', '433e25'], ['433e25', '2b281d'],
].map(([a, b]) => [K(a), hex(b)]));
// Base -> Mega portrait palette.
const REMAP = new Map([
  ['72693a', '656769'], ['554b2a', '535455'], ['433e25', '494a4b'], ['2b281d', '373f3b'],
  ['f0a662', 'f79767'], ['c26e49', 'be683f'], ['8c322e', 'be683f'],
  ['f1f2f5', 'ffffff'], ['f5f5f5', 'ddeef3'], ['c9cbda', 'b2c4d3'], ['9093b4', '87a7c7'], ['686b91', '547394'], ['50536e', '3f5470'],
].map(([a, b]) => [K(a), hex(b)]));
const SPIKE = ['.#.', '###'];   // a small black spike, base row on the rock's top edge
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

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  const out = px.slice();
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < W * H; i++) if (px[i]) { n++; sx += i % W; sy += (i / W) | 0; }
  if (!n) return out;
  const cx = sx / n, cy = sy / n;
  // 1. Arms: limb blobs whose centre is well out from the body centre.
  const arms = components(W, H, i => LIMB.has(k(px[i])) && Math.abs(i % W - cx) >= ARM_MIN_DX).filter(b => b.length >= 6);
  for (const b of arms) {
    const bx = b.reduce((s, i) => s + (i % W), 0) / b.length, by = b.reduce((s, i) => s + ((i / W) | 0), 0) / b.length;
    const side = bx < cx ? -1 : 1, ox = side * ARM_OUT, oy = by < cy ? ARM_Y : -ARM_Y;
    const set = new Set(b);
    for (const i of b) {  // blob outline too
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && k(px[yy * W + xx]) === BLACK) set.add(yy * W + xx);
      }
    }
    for (const i of set) {
      const x = i % W + ox, y = ((i / W) | 0) + oy;
      if (x < 0 || y < 0 || x >= W || y >= H) { clipped++; continue; }
      if (!out[y * W + x]) out[y * W + x] = DARKER.get(k(px[i])) || px[i];
    }
  }
  // 2. Black spikes along the top edge of the body rock (rock pixels with nothing above them).
  const rockTop = [];
  for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
    if (!ROCK.has(k(px[y * W + x]))) continue;
    if (!out[(y - 1) * W + x] || k(out[(y - 1) * W + x]) === BLACK && !out[(y - 2) * W + x]) rockTop.push([x, y]);
    break;
  }
  rockTop.filter(([x]) => Math.round(x - cx) % 4 === 0).forEach(([x, y]) => SPIKE.forEach((row, py) => [...row].forEach((c, pxi) => {
    const xx = x - 1 + pxi, yy = y - 2 + py;
    if (c === '#' && xx >= 0 && yy >= 0 && xx < W && yy < H && (!out[yy * W + xx] || k(out[yy * W + xx]) === BLACK)) out[yy * W + xx] = [0, 0, 0];
  })));
  // 3. Palette remap, then close any open edge with a black outline.
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
