// Custom PMD-style Mega Magearna (0801-2) from the base Magearna sheets, plus the shared helpers used by
// the other Gen 7-9 mega scripts in this batch (0870-1, 0952-1, 0970-1, 0978-4, 0978-5, 0998-1 import it).
// Output: assets/sprite-custom/0801-2/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0801-2.mjs [Walk Idle ...]   (no args = every sheet)
// Base sheets + portraits are downloaded once from SpriteCollab into tools/.cache/mega-base/.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base');

// ---------- download (cached, one request at a time, backoff on errors) ----------
async function dl(url, file) {
  if (fs.existsSync(file)) return file;
  if (fs.existsSync(file + '.404')) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) { fs.writeFileSync(file + '.404', ''); return null; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      await new Promise(r => setTimeout(r, 150));
      return file;
    } catch (e) {
      if (i >= 4) throw new Error(url + ': ' + e.message);
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}
const tag = (xml, n) => xml.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1];
export const readPng = f => PNG.sync.read(fs.readFileSync(f));
// Same rule as tools/fetch-sprites.mjs: footY = mean row of the first shadow frame.
function footY(png, fw, fh) {
  let s = 0, n = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (png.data[(y * png.width + x) * 4 + 3]) { s += y; n++; }
  return n ? Math.round(s / n) : Math.round(fh * 0.75);
}
// dir = '0801' or '0978/0001'. Returns { sheetName: { file, fw, fh, footY } } (one entry per real sheet file).
export async function loadBase(dir) {
  const local = path.join(CACHE, dir.replace('/', '-'));
  const xml = fs.readFileSync(await dl(`${RAW}sprite/${dir}/AnimData.xml`, path.join(local, 'AnimData.xml')), 'utf8');
  const out = {};
  for (const [, b] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    if (tag(b, 'CopyOf')) continue;
    const name = tag(b, 'Name'), fw = +tag(b, 'FrameWidth'), fh = +tag(b, 'FrameHeight');
    const file = await dl(`${RAW}sprite/${dir}/${name}-Anim.png`, path.join(local, `${name}-Anim.png`));
    const sh = await dl(`${RAW}sprite/${dir}/${name}-Shadow.png`, path.join(local, `${name}-Shadow.png`));
    const durations = [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m => +m[1]);
    if (file) out[name] = { file, fw, fh, durations, footY: sh ? footY(readPng(sh), fw, fh) : Math.round(fh * 0.75) };
  }
  return out;
}
export const loadPortrait = async dir => dl(`${RAW}portrait/${dir}/Normal.png`, path.join(CACHE, dir.replace('/', '-'), 'portrait.png'));

// ---------- pixel helpers (frames are flat arrays of [r,g,b] or null, width W) ----------
export const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
export const key = p => (p ? (p[0] << 16) | (p[1] << 8) | p[2] : -1);
export const K = s => key(hex(s));
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const BLACK = 0;

// Frame helper bound to one frame: W, H, px, plus queries used by every mega.
export function frameTools(W, H, px) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inside(x, y) ? px[y * W + x] : null);
  const comps = test => {
    const id = new Int32Array(W * H).fill(-1), list = [];
    for (let i = 0; i < W * H; i++) {
      if (id[i] >= 0 || !test(i)) continue;
      const blob = [], st = [i]; id[i] = list.length;
      while (st.length) {
        const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of N4) {
          const n = (y + dy) * W + x + dx;
          if (inside(x + dx, y + dy) && id[n] < 0 && test(n)) { id[n] = list.length; st.push(n); }
        }
      }
      list.push(blob);
    }
    return list;
  };
  const xy = i => [i % W, (i / W) | 0];
  const box = idx => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const i of idx) { const [x, y] = xy(i); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  const centroid = idx => [idx.reduce((s, i) => s + (i % W), 0) / idx.length, idx.reduce((s, i) => s + ((i / W) | 0), 0) / idx.length];
  // Effect sprites (sparkles, sweat, Zs) are separate islands: body = 8-connected islands >= 25% of the biggest.
  const bodyMask = () => {
    const seen = new Int32Array(W * H).fill(-1), isl = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] >= 0 || !px[i]) continue;
      const st = [i], b = []; seen[i] = isl.length;
      while (st.length) {
        const j = st.pop(); b.push(j); const x = j % W, y = (j / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const n = (y + dy) * W + x + dx;
          if (inside(x + dx, y + dy) && seen[n] < 0 && px[n]) { seen[n] = isl.length; st.push(n); }
        }
      }
      isl.push(b);
    }
    const big = Math.max(0, ...isl.map(b => b.length)), m = new Uint8Array(W * H);
    for (const b of isl) if (b.length >= big * 0.25) for (const j of b) m[j] = 1;
    // Unoutlined effects can touch the body diagonally: a colour blob that mostly borders transparency is an effect.
    const open = j => N4.some(([dx, dy]) => { const x = j % W + dx, y = ((j / W) | 0) + dy; return !inside(x, y) || !px[y * W + x]; });
    for (const b of comps(j => px[j] && key(px[j]) !== BLACK)) if (b.filter(open).length > b.length * 0.3) for (const j of b) m[j] = 0;
    return m;
  };
  return { W, H, px, inside, get, comps, xy, box, centroid, bodyMask };
}

// Paint a pattern. rows: strings; pal: char -> [r,g,b]; '.' skips. at = pattern cell placed on (x, y).
// mode 'over' paints always; 'behind' only paints empty pixels and the body's outer outline.
export function stamp(out, W, H, rows, x, y, pal, { at = [0, 0], flip = false, mode = 'over' } = {}) {
  rows.forEach((row, py) => [...row].forEach((c, pxi) => {
    if (c === '.' || c === ' ') return;
    const xx = x + (flip ? row.length - 1 - pxi : pxi) - (flip ? row.length - 1 - at[0] : at[0]), yy = y + py - at[1];
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
    const i = yy * W + xx;
    if (mode === 'behind' && out[i] && !isOuterLine(out, W, H, xx, yy)) return;
    out[i] = pal[c];
  }));
}
export function isOuterLine(out, W, H, x, y) {
  const p = out[y * W + x];
  return p && key(p) === BLACK && N4.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= W || yy >= H || !out[yy * W + xx]; });
}
// Close open edges with a black outline (4-neighbour), like every PMD sprite.
export function closeOutline(out, W, H) {
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy;
      const p = xx < 0 || yy < 0 || xx >= W || yy >= H ? null : out[yy * W + xx];
      if (p && key(p) !== BLACK) { fin[y * W + x] = [0, 0, 0]; break; }
    }
  }
  return fin;
}

// Pixels of frame (r, c) of a sheet as a flat [r,g,b]|null array of fw*fh.
export function sheetFrame(png, fw, fh, r, c) {
  const px = new Array(fw * fh).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((r * fh + y) * png.width + c * fw + x) * 4;
    if (i < png.data.length && png.data[i + 3]) px[y * fw + x] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return px;
}
// Column of `dst` durations that is showing when column c of `src` starts (keeps two sheets in step).
export function sameMoment(src, c, dst) {
  const T = src.reduce((a, b) => a + b, 0), U = dst.reduce((a, b) => a + b, 0);
  const t = src.slice(0, c).reduce((a, b) => a + b, 0) / T * U;
  let acc = 0;
  for (let j = 0; j < dst.length; j++) { acc += dst[j]; if (t < acc) return j; }
  return dst.length - 1;
}
// Tapered stroke from (x0, y0) along e: width w at the base to 1 at the tip. cols = [edge, fill, shade].
export function spike(out, W, H, x0, y0, e, L, w, cols) {
  const m = Math.max(Math.abs(e[0]), Math.abs(e[1])), ex = e[0] / m, ey = e[1] / m;
  const perp = Math.abs(ey) >= Math.abs(ex) ? [1, 0] : [0, 1];
  const cells = [];
  for (let t = 0; t <= L; t++) {
    const cx = Math.round(x0 + ex * t), cy = Math.round(y0 + ey * t), ww = Math.max(1, Math.round(w * (1 - t / (L + 1))));
    for (let o = 0; o < ww; o++) cells.push([cx + perp[0] * (o - ((ww - 1) >> 1)), cy + perp[1] * (o - ((ww - 1) >> 1)), o === 0 ? 0 : o === ww - 1 ? 2 : 1]);
  }
  const mask = new Map(cells.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y, s]) => [y * W + x, s]));
  for (const [i, s] of mask) out[i] = cols[s];
  // Black rim around the stroke.
  for (const [i] of mask) for (const [dx, dy] of N4) {
    const x = i % W + dx, y = ((i / W) | 0) + dy, n = y * W + x;
    if (x >= 0 && y >= 0 && x < W && y < H && !mask.has(n)) out[n] = [0, 0, 0];
  }
}

// Wraps a mega function so it only sees the body; effect islands are pasted back untouched on top of empty space.
export const keepEffects = fn => (f, info) => {
  const m = f.bodyMask();
  const body = f.px.map((p, i) => (m[i] ? p : null));
  const out = fn(frameTools(f.W, f.H, body), info);
  f.px.forEach((p, i) => { if (p && !m[i] && !out[i]) out[i] = p; });
  return out;
};

// ---------- the sheet loop + preview, shared by every mega in this batch ----------
// cfg: { key, base: '0801', portrait: '0801/0002', mega(frame, info) -> px, facing?(name, r, c) -> dir, work? }
// mega gets frame = frameTools(...) on a canvas with `work` px margin on every side; info = { dir, name, r, c }.
export async function run(cfg) {
  const OUT = path.join(ROOT, 'assets/sprite-custom', cfg.key);
  const WORK = cfg.work ?? 16;
  const base = await loadBase(cfg.base);
  const portraitFile = await loadPortrait(cfg.portrait);
  const want = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  for (const [name, a] of Object.entries(base)) {
    if (want.length && !want.includes(name)) continue;
    const src = readPng(a.file);
    const cols = src.width / a.fw, rows = src.height / a.fh, WW = a.fw + WORK * 2, HH = a.fh + WORK * 2;
    const frames = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = new Array(WW * HH).fill(null);
      for (let y = 0; y < a.fh; y++) for (let x = 0; x < a.fw; x++) {
        const i = ((r * a.fh + y) * src.width + c * a.fw + x) * 4;
        if (src.data[i + 3]) px[(y + WORK) * WW + x + WORK] = [src.data[i], src.data[i + 1], src.data[i + 2]];
      }
      const dir = cfg.facing ? cfg.facing(name, r, c, rows) : r;
      frames.push(px.some(Boolean) ? cfg.mega(frameTools(WW, HH, px), { dir, name, r, c, work: WORK, a }) : px);
    }
    // Smallest pad (multiple of 4, symmetric in x so the centre holds, top-only in y) that fits every frame.
    let pxx = 0, pt = 0, pb = 0;
    for (const fr of frames) fr.forEach((p, i) => {
      if (!p) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
      pxx = Math.max(pxx, -x, x - a.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - a.fh + 1);
    });
    if (pb > 0) console.warn(name, 'spills', pb, 'px below the frame (clipped)');
    const PX = Math.ceil(pxx / 4) * 4, PT = Math.ceil(pt / 4) * 4;
    const W = a.fw + PX * 2, H = a.fh + PT;
    const dst = new PNG({ width: cols * W, height: rows * H });
    frames.forEach((fr, n) => {
      const r = (n / cols) | 0, c = n % cols;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const xx = x - PX + WORK, yy = y - PT + WORK;
        if (xx < 0 || xx >= WW) continue;
        const p = fr[yy * WW + xx]; if (!p) continue;
        const o = ((r * H + y) * dst.width + c * W + x) * 4;
        dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
      }
    });
    fs.writeFileSync(path.join(OUT, `${name}-Anim.png`), PNG.sync.write(dst));
    meta[name] = { fw: W, fh: H, footY: a.footY + PT };
  }
  if (want.length) { console.log('partial build, _anims.json/_preview.png not written', JSON.stringify(meta)); return; }
  writePreview(OUT, base, meta, readPng(portraitFile));
  fs.writeFileSync(path.join(OUT, '_anims.json'), JSON.stringify(meta, null, 1)); // last: marks the set finished
  console.log('built', cfg.key, JSON.stringify(meta));
}

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band. Same layout as tools/build-mega-custom.mjs.
function writePreview(OUT, base, all, portrait) {
  const S = 4, GAP = 3, PER = 2;
  const done = Object.keys(all).map(name => {
    const a = base[name], { fw: W, fh: H } = all[name];
    const padX = (W - a.fw) / 2, padT = H - a.fh;
    const b = readPng(a.file), m = readPng(path.join(OUT, `${name}-Anim.png`));
    const rows = Math.round(b.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(b, a.fw, a.fh, r, padX, padT), get(m, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { cells, x0, y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };
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

export const isMain = url => process.argv[1] && url === pathToFileURL(path.resolve(process.argv[1])).href;

// ================= Mega Magearna =================
// Every feature is anchored to parts found by colour in each frame, never to a facing, because Twirl,
// Rotate and Swing spin through all facings inside one row. Parts are the 4-connected non-black blobs
// (PMD art separates head, ears, arms and gown with black lines).
//  - neck = top of the blue Soul-Heart; blobs above it are head/ears, blobs well below it are the gown.
//  - head and arms turn gold, eye wiring red, eyes pink with a white cross.
//  - ears (gold blobs high on the head) turn red and grow an upturned outer prong (antler ears).
//  - gown turns red, its gold rings stay gold (the flame trim), its lower third becomes the dark frill.
//  - silver three-spike tiara on top of the head, two dark half-gears orbiting at the gown's sides.
const MG = {
  black: [0, 0, 0],
  gW: hex('effab2'), gL: hex('e5d273'), gM: hex('c9af5a'), gD: hex('b48941'), gX: hex('795822'),   // gold body
  rL: hex('e27a70'), r: hex('c54c4c'), rD: hex('9c3342'), rX: hex('6b2433'),                     // red (rL/rX one step either side of the portrait reds)
  sL: hex('9194a4'), s: hex('575249'), sD: hex('383332'),                                         // dark frill + gears
  pink: hex('f899ea'), white: [255, 255, 255], blue: hex('6ab7c9'),
};
const MAG = { w: K('ffffff'), l: K('d6cbcf'), m: K('ad99a2'), d: K('525252'), g: K('9c9494'), Y: K('fff28b'), y: K('e6d05a'),
  eye: K('d3676d'), pk: K('ffd5d6'), b: K('6ab7c9'), B: K('9dd0e0'), l2: K('d0bfc3') };
const GOLDS = new Set([MAG.Y, MAG.y]);
const BODY = new Map([[MAG.w, MG.gW], [MAG.l, MG.gL], [MAG.l2, MG.gL], [MAG.m, MG.gM], [MAG.g, MG.gD], [MAG.d, MG.gX], [MAG.Y, MG.r], [MAG.y, MG.rD]]);
const EARS = new Map([[MAG.w, MG.rL], [MAG.l, MG.r], [MAG.l2, MG.r], [MAG.Y, MG.rL], [MAG.y, MG.r], [MAG.m, MG.rD], [MAG.g, MG.rD], [MAG.d, MG.rX]]);
const GOWN = new Map([[MAG.w, MG.rL], [MAG.l, MG.r], [MAG.l2, MG.r], [MAG.m, MG.rD], [MAG.g, MG.rD], [MAG.d, MG.rX], [MAG.Y, MG.gL], [MAG.y, MG.gD]]);
const FRILL = new Map([[MAG.w, MG.sL], [MAG.l, MG.sL], [MAG.l2, MG.sL], [MAG.m, MG.s], [MAG.g, MG.s], [MAG.d, MG.sD], [MAG.Y, MG.sL], [MAG.y, MG.s]]);
const TIARA = ['.#.#.#.', '#w#w#w#', '#wswsw#', '.#####.'];
// Half-gear, opening toward the body (this is the LEFT gear; the right one is mirrored): a C with three teeth.
const GEAR = [
  '....#####',
  '...#LLLL#',
  '###LL####',
  '#LLLL#...',
  '###LM#...',
  '..#MM#...',
  '###MM#...',
  '#MMMM#...',
  '###MD#...',
  '..#DD#...',
  '###DD#...',
  '#DDDD####',
  '...#DDDD#',
  '....#####',
];

function megaMagearna(f) {
  const { W, H, px, comps, box, centroid } = f;
  const kk = px.map(key);
  const out = px.slice();
  const solid = [];
  for (let i = 0; i < W * H; i++) if (px[i]) solid.push(i);
  const fig = box(solid);
  // The Soul-Heart is the biggest blue blob (the nose is a lone blue pixel).
  const heart = comps(i => kk[i] === MAG.b || kk[i] === MAG.B).sort((a, b) => b.length - a.length || box(b).y0 - box(a).y0)[0] || [];
  const neckY = heart.length ? box(heart).y0 : Math.round(fig.y0 + (fig.y1 - fig.y0) * 0.6);
  const earLimit = fig.y0 + (neckY - fig.y0) * 0.5;
  const blobs = comps(i => kk[i] > 0);
  const eyes = solid.filter(i => kk[i] === MAG.eye);
  // Folded Poke Ball form (Sleep): no face and no heart. Red top, dark frill bottom.
  if (!eyes.length && !heart.length) {
    const cut = fig.y1 - Math.round(fig.h * 0.4);
    for (const i of solid) if (kk[i] > 0) out[i] = (((i / W) | 0) > cut ? FRILL : GOWN).get(kk[i]) || px[i];
    return closeOutline(out, W, H);
  }
  const ears = [], gown = [];
  for (const b of blobs) {
    const [, cy] = centroid(b);
    const gold = b.filter(i => GOLDS.has(kk[i])).length / b.length;
    if ((cy < earLimit && gold > 0 || cy < neckY - 1 && gold >= 0.25) && !b.some(i => kk[i] === MAG.eye)) { ears.push(b); for (const i of b) out[i] = EARS.get(kk[i]) || px[i]; }
    else if (box(b).y1 > neckY + 5) {
      // Gown (the internal ring lines split it into several blobs); a chest strip above it stays gold.
      const g = b.filter(i => ((i / W) | 0) > neckY + 3); gown.push(g);
      for (const i of b) out[i] = (((i / W) | 0) > neckY + 3 ? GOWN : BODY).get(kk[i]) || px[i];
    } else for (const i of b) out[i] = BODY.get(kk[i]) || px[i];
  }
  // Eyes: pink with a white cross, ringed by red wiring.
  if (eyes.length) {
    const eb = box(eyes);
    for (let y = eb.y0; y <= eb.y1; y++) for (let x = eb.x0; x <= eb.x1; x++) {
      const i = y * W + x, c = kk[i];
      if (c === MAG.eye) out[i] = MG.r;
      else if (c === MAG.pk || c === MAG.w) out[i] = MG.white;
      else if ((c === MAG.l || c === MAG.Y) && eyes.some(j => Math.abs(j % W - x) <= 1 && Math.abs(((j / W) | 0) - y) <= 1)) out[i] = MG.pink;
    }
  }
  // Soul-Heart shield: split blue and pink.
  if (heart.length) { const hc = centroid(heart)[0]; for (const i of heart) if (i % W > hc) out[i] = MG.pink; }
  // Frill: per column, the lower third of the gown.
  const gp = gown.flat();
  if (gp.length) {
    const inG = new Uint8Array(W * H); gp.forEach(i => (inG[i] = 1));
    const gb = box(gp), cut = gb.y1 - Math.max(2, Math.round(gb.h / 3)) + 1;
    for (const i of gp) if (((i / W) | 0) >= cut) out[i] = FRILL.get(kk[i]) || px[i];
    // Dark seam between the red gown and the frill where it was not outlined.
    for (const i of gp) { const y = (i / W) | 0; if (y === cut - 1 && inG[i + W] && ((i % W) + y) % 2 === 0) out[i] = MG.rX; }
  }
  // Antler ears: an upturned prong at each ear's outer end.
  const headPx = blobs.filter(b => !ears.includes(b) && !gown.includes(b) && centroid(b)[1] < neckY).flat();
  const hb = headPx.length ? box(headPx) : fig;
  const hcx = ears.length === 2 ? (centroid(ears[0])[0] + centroid(ears[1])[0]) / 2 : hb.cx;
  const prongs = [];
  for (const e of ears) {
    const eb = box(e), side = centroid(e)[0] < hcx - 1 ? -1 : centroid(e)[0] > hcx + 1 ? 1 : 0;
    if (!side) continue;
    const ox = side < 0 ? eb.x0 + 1 : eb.x1 - 1, top = Math.min(...e.filter(i => Math.abs(i % W - ox) <= 1).map(i => (i / W) | 0));
    // 2 wide, 4 tall, leaning outward at the tip.
    const rows = ['.#..', '#r#.', '#rr#', '#rR#', '.#R#'];
    stamp(out, W, H, rows, ox, top - 4, { r: MG.r, R: MG.rL, '#': MG.black }, { at: [1, 0], flip: side > 0, mode: 'behind' });
    prongs.push(side);
  }
  // Tiara on top of the head, between the ears.
  if (headPx.length) stamp(out, W, H, TIARA, Math.round(hcx), hb.y0 - 2, { '#': MG.black, w: MG.white, s: MG.sL }, { at: [3, 0], mode: 'behind' });
  // Half-gears at the gown's sides, behind the body.
  if (gp.length) {
    const gb = box(gp), cy = Math.round(gb.cy - 1);
    const pal = { L: MG.sL, M: MG.s, D: MG.sD, '#': MG.black };
    const gw = GEAR[0].length, gc = Math.floor(GEAR.length / 2);
    stamp(out, W, H, GEAR, gb.x0 - 1, cy, pal, { at: [gw - 1, gc], mode: 'behind' });
    stamp(out, W, H, GEAR, gb.x1 + 1, cy, pal, { at: [gw - 1, gc], flip: true, mode: 'behind' });
  }
  return closeOutline(out, W, H);
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === '--fetch') {
    for (const d of ['0801', '0870/0002', '0870/0003', '0952', '0970', '0978', '0978/0001', '0978/0002', '0978/0003', '0998']) { await loadBase(d); console.log('fetched', d); }
    for (const d of ['0801', '0801/0002', '0870/0001', '0870/0002', '0870/0003', '0952', '0952/0001', '0970', '0970/0001', '0978', '0978/0001', '0978/0002', '0978/0003', '0978/0004', '0978/0005', '0998', '0998/0001']) await loadPortrait(d);
  } else await run({ key: '0801-2', base: '0801', portrait: '0801/0002', mega: keepEffects(megaMagearna) });
}
