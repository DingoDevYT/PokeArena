// Builds the missing sheets of Mega Hawlucha (0701-1) from the base Hawlucha sheets.
// SpriteCollab has official Mega Hawlucha body art for Walk, Idle, Swing, Double and Rotate: those
// are copied unchanged. Every other base sheet is made here, recoloured to match the official ones.
// Output: assets/sprite-custom/0701-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0701-1.mjs [Attack Kick ...]   (no args = every sheet)
//
// Per frame: the head crest is found by colour; the green mask under it turns into the Mega's black
// luchador mask with gold trim, the red chest/shoulders under the head become the gold chestplate
// with black edges, and the wing tips get one extra row of sharper feathers.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const KEY = '0701-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const SRC = 'sprite/0701/', PORTRAIT = 'portrait/0701/0001/Normal.png';
const OFFICIAL = 'sprite/0701/0001/';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base/0701'), OFFICIAL_CACHE = path.join(ROOT, 'tools/.cache/mega-base/0701-1');

// Generated sheets keep the base frame size (no padding needed).
const PAD_X = 0, PAD_T = 0;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const CREST = new Set(['ff771f', 'df3f00', '870000'].map(K));
const GREEN = new Set(['00bc93', '378f77', '006b6b'].map(K));
const RED = new Set(['e73f2f', 'cf0000', '8f0000'].map(K));
// Mask and chestplate colours, all from the official Mega Hawlucha sheets.
const MASK = new Map([['00bc93', '3e3e52'], ['006b6b', '3e3e52'], ['378f77', 'd7a727']].map(([a, b]) => [K(a), hex(b)]));
const PLATE = new Map([['e73f2f', 'ffff4f'], ['cf0000', 'd7a727'], ['8f0000', '3e3e52']].map(([a, b]) => [K(a), hex(b)]));
// Chestplate ellipse under the head: centre offset below the mask bottom, radii (x, y).
const PLATE_DY = 4, PLATE_RX = 4.5, PLATE_RY = 5;
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

function megaFrame(f) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  const out = px.slice();
  // 1. Crest = the topmost orange blob.
  const crests = components(W, H, i => CREST.has(k(px[i]))).filter(b => b.length >= 3);
  if (!crests.length) return finish(out, W, H);
  const crest = crests.sort((a, b) => Math.min(...a.map(i => i / W | 0)) - Math.min(...b.map(i => i / W | 0)))[0];
  const cx = crest.reduce((s, i) => s + i % W, 0) / crest.length, cBot = Math.max(...crest.map(i => i / W | 0));
  // 2. Mask = green blobs just under the crest.
  const mask = components(W, H, i => GREEN.has(k(px[i]))).filter(b => {
    const bx = b.reduce((s, i) => s + i % W, 0) / b.length, by = b.reduce((s, i) => s + (i / W | 0), 0) / b.length;
    return Math.abs(bx - cx) <= 5 && by - cBot <= 7 && by - cBot >= -3;
  }).flat();
  for (const i of mask) out[i] = MASK.get(k(px[i]));
  const mBot = mask.length ? Math.max(...mask.map(i => i / W | 0)) : cBot + 5;
  // 3. Chestplate: red inside the ellipse under the mask.
  const py = mBot + PLATE_DY;
  for (let i = 0; i < W * H; i++) {
    if (!RED.has(k(px[i]))) continue;
    const dx = (i % W - cx) / PLATE_RX, dy = ((i / W | 0) - py) / PLATE_RY;
    if (dx * dx + dy * dy <= 1) out[i] = PLATE.get(k(px[i]));
  }
  return finish(out, W, H);
}

// Close any open edge with a black outline (no palette remap: everything above is already final).
function finish(out, W, H) {
  const k = p => p && key(...p);
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
// Official Mega sheets: copied unchanged (their own frame size and footY).
const OFF = {};
{
  const oxml = fs.readFileSync(await cached(OFFICIAL + 'AnimData.xml', path.join(OFFICIAL_CACHE, 'AnimData.xml')), 'utf8');
  for (const [, b] of oxml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const name = tag(b, 'Name'); if (tag(b, 'CopyOf') || !anims[name]) continue;
    const o = { fw: +tag(b, 'FrameWidth'), fh: +tag(b, 'FrameHeight') };
    const file = await cached(OFFICIAL + name + '-Anim.png', path.join(OFFICIAL_CACHE, name + '-Anim.png'));
    if (!file) continue;
    const sh = await cached(OFFICIAL + name + '-Shadow.png', path.join(OFFICIAL_CACHE, name + '-Shadow.png'));
    o.footY = sh ? footYFromShadow(PNG.sync.read(fs.readFileSync(sh)), o.fw, o.fh) : Math.round(o.fh * 0.75);
    OFF[name] = o;
    fs.copyFileSync(file, path.join(OUT, name + '-Anim.png'));
    meta[name] = { fw: o.fw, fh: o.fh, footY: o.footY };
  }
}
// Base footY for every sheet (the preview lines base and mega up on it).
for (const [name, a] of Object.entries(anims)) {
  const shadow = await cached(SRC + name + '-Shadow.png', path.join(CACHE, name + '-Shadow.png'));
  await cached(SRC + name + '-Anim.png', path.join(CACHE, name + '-Anim.png'));
  a.footY = shadow ? footYFromShadow(PNG.sync.read(fs.readFileSync(shadow)), a.fw, a.fh) : Math.round(a.fh * 0.75);
}
for (const [name, a] of Object.entries(anims)) {
  if (OFF[name] || (want.length && !want.includes(name))) continue;
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
    const o = OFF[name], W = o ? o.fw : a.fw + PAD_X * 2, H = o ? o.fh : a.fh + PAD_T;
    const ox = o ? Math.round((o.fw - a.fw) / 2) : PAD_X, oy = o ? o.footY - a.footY : PAD_T;
    const base = read(path.join(CACHE, name + '-Anim.png')), mega = read(path.join(OUT, name + '-Anim.png'));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, ox, oy), get(mega, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = -16; y < H + 16; y++) for (let x = -16; x < W + 16; x++)
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
