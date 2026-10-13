// Builds a custom PMD-style Mega Pyroar (0668-1) from the base Pyroar sheets.
// Base = female Pyroar (the only Pyroar with PMD body art; Mega Pyroar keeps her long back crest).
// Output: assets/sprite-custom/0668-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0668-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Per frame: find the head (eyes, or the crest when facing away), grow a huge flaring mane of
// red flame tufts with yellow stripes around it (a small 2D flame model per facing, drawn behind
// the head so the face stays clear), then remap the mane to the Mega portrait palette.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const KEY = '0668-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const SRC = 'sprite/0668/0000/0000/0002/', PORTRAIT = 'portrait/0668/0001/Normal.png';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base/0668');

// Frame grows 16px wide (8 each side, centre unchanged) and 10px tall on top only, so footY += 10.
const PAD_X = 8, PAD_T = 10;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const EYE = new Set(['10c0e0', '008090'].map(K));
const MANE = new Set(['e05050', '982828', 'ffe55a', 'f1b30c'].map(K));
// Tuft colours in the BASE palette (remapped below with everything else).
const T = { Y: hex('ffe55a'), y: hex('f1b30c'), R: hex('e05050'), D: hex('982828') };
// Base -> Mega portrait palette: hotter red, paler lemon yellow, warmer browns.
const REMAP = new Map([
  ['e05050', 'fc4447'], ['982828', 'c83131'], ['ffe55a', 'fbef63'], ['f1b30c', 'ddaf48'],
  ['634242', '55433b'], ['503030', '342a2c'],
].map(([a, b]) => [K(a), hex(b)]));

// Mane tufts per facing (right-facing set; facings 5-7 mirror 3-1). Head point = eyes + eye offset
// (or crest centroid + crest offset when the eyes are hidden). Tuft: [angle deg (0 right, -90 up),
// root distance, length, half-width at root, curl (tip bends up by curl px), front (drawn over the
// body instead of behind it)], in list order.
const MANE_SET = [
  { eye: [0, 0], tufts: [[-58, 3, 15, 4, 2], [-122, 3, 15, 4, 2], [-22, 4, 14, 3.8, 4], [-158, 4, 14, 3.8, 4],
    [18, 4, 12, 3.6, 5], [162, 4, 12, 3.6, 5], [62, 4, 10, 3.4, 3, 1], [118, 4, 10, 3.4, 3, 1]] },
  { eye: [-3, -1], tufts: [[-75, 3, 15, 4, 1], [-125, 3, 16, 4, 2], [-165, 4, 15, 3.8, 4], [160, 4, 13, 3.6, 5],
    [-30, 4, 12, 3.6, 4], [120, 4, 11, 3.4, 3, 1], [75, 4, 10, 3.4, 2, 1]] },
  { eye: [-4, 0], tufts: [[-82, 3, 15, 4, 0], [-122, 3, 16, 4, 2], [-160, 4, 15, 3.8, 4], [165, 4, 13, 3.6, 5],
    [-45, 4, 11, 3.4, 3], [135, 4, 11, 3.4, 3, 1], [100, 4, 10, 3.4, 2, 1]] },
  { crest: [4, 3], tufts: [[-70, 1, 15, 4, 0], [-112, 1, 15, 4, 1], [-150, 2, 15, 3.8, 4], [-25, 2, 14, 3.8, 4],
    [175, 2, 13, 3.6, 5], [15, 2, 12, 3.6, 5], [140, 2, 11, 3.4, 3], [45, 2, 10, 3.4, 3]] },
  { crest: [0, 2], tufts: [[-60, 1, 15, 4, 1], [-120, 1, 15, 4, 1], [-20, 2, 14, 3.8, 4], [-160, 2, 14, 3.8, 4],
    [20, 2, 12, 3.6, 5], [160, 2, 12, 3.6, 5], [60, 2, 10, 3.4, 3], [120, 2, 10, 3.4, 3]] },
];

// Rasterise one tuft into {x, y, c} relative to the head point. The axis curves up toward the tip;
// width tapers to a point. Bands across the axis: yellow stripe, gold, red, dark red edge.
function tuftPixels([ang, r0, len, w0, curl, front], mirror) {
  const a = (mirror ? 180 - ang : ang) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const best = new Map();
  for (let t = r0; t <= len; t += 0.25) {
    const u = (t - r0) / (len - r0), w = w0 * (1 - u ** 1.6) + 0.35;
    const ax = dx * t, ay = dy * t - curl * u * u;
    for (let y = Math.floor(ay - w - 1); y <= ay + w + 1; y++) for (let x = Math.floor(ax - w - 1); x <= ax + w + 1; x++) {
      const r = Math.hypot(x - ax, y - ay) / w;
      if (r > 1) continue;
      const k = y * 1000 + x, o = best.get(k);
      if (!o || r < o.r) best.set(k, { x, y, r, u });
    }
  }
  return [...best.values()].map(p => ({ x: p.x, y: p.y, front, c: p.r > 0.8 || p.u > 0.92 ? T.D : p.r < 0.3 ? T.Y : p.r < 0.55 ? T.y : T.R }));
}
const MANES = [0, 1, 2, 3, 4, 3, 2, 1].map((d, i) => MANE_SET[d].tufts.map(t => tuftPixels(t, i > 4)));
let clipped = 0;
const FACE_R = 4.5; // front tufts never cover pixels this close to the head point

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
  const k = p => p && key(...p);
  const out = px.slice();
  const mean = test => {
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < W * H; i++) if (test(k(px[i]))) { n++; sx += i % W; sy += (i / W) | 0; }
    return n ? { n, x: sx / n, y: sy / n } : null;
  };
  const mir = dir > 4, set = MANE_SET[mir ? 8 - dir : dir];
  // 1. Head point.
  let head = null;
  if (set.eye) { const e = mean(c => EYE.has(c)); if (e) head = [e.x + (mir ? -set.eye[0] : set.eye[0]), e.y + set.eye[1]]; }
  if (!head) {
    const m = mean(c => MANE.has(c)), off = set.crest || [0, 2];
    if (m && m.n >= 12) head = [m.x + (mir ? -off[0] : off[0]), m.y + off[1]];
  }
  // 2. Mane tufts, behind the sprite: only into transparent pixels (the old outline stays as the seam).
  if (head) {
    const hx = Math.round(head[0]), hy = Math.round(head[1]);
    for (const tuft of MANES[dir]) for (const p of tuft) {
      const x = hx + p.x, y = hy + p.y;
      if (x < 0 || y < 0 || x >= W || y >= H) { clipped++; continue; }
      const face = Math.hypot(x - hx, y - hy - 1) < FACE_R;
      if (!px[y * W + x] || (p.front && !face && !EYE.has(k(px[y * W + x])) && !MANE.has(k(px[y * W + x])))) out[y * W + x] = p.c;
    }
  }
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
