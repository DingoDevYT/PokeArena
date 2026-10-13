// Builds a custom PMD-style Mega Malamar (0687-1) from the base Malamar sheets.
// Output: assets/sprite-custom/0687-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0687-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Per frame: the head tentacles get the Mega's bright blue glow, the body's spots and centre stripe
// turn into the shifting rainbow (banded top to bottom), and the two long arms grow on past their
// tips into curled hooks that glow teal-green (its right arm) and pink (its left arm). Arm tips are
// found as the white tip blobs furthest from the body centre, so the hooks follow every motion.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const KEY = '0687-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const SRC = 'sprite/0687/', PORTRAIT = 'portrait/0687/0001/Normal.png';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base/0687');

// Frame grows 8px wide (4 each side, centre unchanged) and 0px on top; the hooks hang below the
// old tips inside the existing frame (footY unchanged).
const PAD_X = 4, PAD_T = 0;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const TIP = K('fafafa'), ARM = hex('c4cae1');
const SPOTS = new Set(['f6efb7', 'c5ae67'].map(K));
const STRIPE = K('746081');
const BODY = new Set(['55375e', '746081', 'f6efb7', 'c5ae67', '333e4f'].map(K));
// Rainbow bands from the Mega portrait's palette, top to bottom of the body.
const RAINBOW = ['ce478a', 'd57ba1', 'fbe948', 'e8f6bc', 'c7e0c0', '77c7d7', 'a88fbe'].map(hex);
const GLOW = { right: [hex('54a2b0'), hex('77c7d7')], left: [hex('ce478a'), hex('eb72ad')] };
// Base -> Mega portrait palette: head tentacles glow blue, body/collar to the portrait's purples.
const REMAP = new Map([
  ['a5bfdb', '77c7d7'], ['769dc8', '54a2b0'], ['8686b7', '777aa5'], ['5c638f', '5b495f'],
  ['55375e', '383041'], ['db3f8a', 'ce478a'], ['eb72ad', 'd57ba1'], ['c4cae1', 'c1bedb'],
].map(([a, b]) => [K(a), hex(b)]));
// Arm hook below a tip, right-side version (mirrored on the left). 'a' = arm, 'G'/'g' = glow, column 1 = tip column.
const HOOK = ['#a#...', '#a#...', '#a#...', '#a#.#.', '#aa#G#', '.#agg#', '..###.'];
// Its right arm is on screen-left when facing us (Down, DR, DL) and screen-right when facing away.
const RIGHT_ON_LEFT = [true, true, true, false, false, false, false, true];
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
  // 1. Body extent (for the rainbow bands and the centre line).
  let n = 0, sx = 0, b0 = H, b1 = -1;
  for (let i = 0; i < W * H; i++) if (BODY.has(k(px[i]))) { n++; sx += i % W; b0 = Math.min(b0, (i / W) | 0); b1 = Math.max(b1, (i / W) | 0); }
  if (!n) return finish(out, W, H);
  const cx = sx / n;
  const band = y => RAINBOW[Math.min(RAINBOW.length - 1, Math.max(0, Math.floor((y - b0) / (b1 - b0 + 1) * RAINBOW.length)))];
  for (let i = 0; i < W * H; i++) {
    const c = k(px[i]), y = (i / W) | 0;
    if (SPOTS.has(c) || c === STRIPE) out[i] = band(y);
  }
  // 2. Arm tips: white blobs, the furthest left and right of the body centre (at least 5px out).
  const tips = components(W, H, i => k(px[i]) === TIP).map(b => ({
    b, x: b.reduce((s, i) => s + (i % W), 0) / b.length, bot: Math.max(...b.map(i => (i / W) | 0)),
  })).filter(t => Math.abs(t.x - cx) >= 5);
  const sides = [tips.filter(t => t.x < cx).sort((a, b) => a.x - b.x)[0], tips.filter(t => t.x > cx).sort((a, b) => b.x - a.x)[0]];
  sides.forEach((t, si) => {
    if (!t) return;
    const onLeft = si === 0, arm = (onLeft === RIGHT_ON_LEFT[dir]) ? 'right' : 'left';
    for (const i of t.b) out[i] = GLOW[arm][1];
    const tx = Math.round(t.b.filter(i => ((i / W) | 0) === t.bot).reduce((s, i) => s + (i % W), 0) / t.b.filter(i => ((i / W) | 0) === t.bot).length);
    const side = dir === 2 || dir === 6 ? 0 : onLeft ? -1 : 1; // side views: straight drop, no curl
    const rows = side ? HOOK : ['#a#', '#a#', '#a#', '#G#', '#g#', '.#.'];
    rows.forEach((row, py) => [...row].forEach((c, pxi) => {
      if (c === '.') return;
      const x = tx + (side < 0 ? -(pxi - 1) : pxi - 1), y = t.bot + 1 + py;
      if (x < 0 || y < 0 || x >= W || y >= H) { clipped++; return; }
      if (out[y * W + x] && k(out[y * W + x]) !== BLACK) return; // never paint over the sprite
      out[y * W + x] = c === '#' ? [0, 0, 0] : c === 'a' ? ARM : c === 'G' ? GLOW[arm][1] : GLOW[arm][0];
    }));
  });
  return finish(out, W, H);
}

// Palette remap, then close any open edge with a black outline.
function finish(out, W, H) {
  const k = p => p && key(...p);
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
