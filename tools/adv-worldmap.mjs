// Bakes the Adventure world map: node tools/adv-worldmap.mjs  ->  assets/adv/worldmap.png, 1 px per cell (chunk (cx, cy) lands at px (cx * 32, cy * 32)).
// Each cell takes the average colour of its material's tile (def.C, from the sheet that holds it), darker the higher h is, with a darker edge where the ground drops to the south or east.
// Reads data/adv/chunks/*.js the way src/adv-world.js does (RLE strings through ADV.rle, blank chunks are world.fill); the map UI is src/adv-map.js.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { PNG } from 'pngjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const cx = vm.createContext({ console }); cx.window = cx;
const run = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), cx, { filename: f });
for (const f of ['data/adv/tileset-placeholder.js', 'data/adv/tileset.js', 'data/adv/tileset-derived.js', 'data/adv/tileset-int.js', 'data/adv/world.js', 'src/adv-world.js']) run(f);
const get = e => vm.runInContext(e, cx);
const W = cx.ADV_WORLD, CH = 32, PW = W.chunksW * CH, PH = W.chunksH * CH;
get('ADV.world = window.ADV_WORLD'); get('ADV.palette = window.ADV_WORLD.palette');

// ---------- colours ----------
const sheets = new Map(), sheet = f => { if (!sheets.has(f)) sheets.set(f, PNG.sync.read(fs.readFileSync(path.join(root, f)))); return sheets.get(f); };
const memo = new Map();
// { rgb, cov }: average colour of the opaque pixels of the def's tiles, and how much of the tile is opaque
function avg(def) {
  cx.__d = def; const ts = get('ADV.originOf(__d)'), im = sheet(ts.file), ids = [...new Set([].concat(def.C))].filter(i => i >= 0);
  let r = 0, g = 0, b = 0, n = 0, a = 0, all = 0;
  for (const id of ids) {
    const sx = (id % ts.cols) * 32, sy = Math.floor(id / ts.cols) * 32;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = ((sy + y) * im.width + sx + x) * 4, al = im.data[i + 3] / 255; all++; a += al;
      if (al > 0.5) { r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; n++; }
    }
  }
  return n ? { rgb: [r / n, g / n, b / n], cov: a / all } : null;
}
function colour(name) {
  if (memo.has(name)) return memo.get(name);
  const def = get(`ADV.defOf(${JSON.stringify(name)})`), v = def && avg(def);
  let c = [0, 0, 0];
  if (v) {
    c = v.rgb;
    if (def.overlay || v.cov < 0.9) { const base = colour(def.base || 'grass'), k = def.overlay ? 0.6 : v.cov; c = c.map((x, i) => base[i] * (1 - k) + x * k); }   // an overlay layer (tall grass) tints the ground under it
  }
  memo.set(name, c); return c;
}

// ---------- cells ----------
const N = CH * CH, cells = new Map();   // "cx_cy" -> { h, mat, over, kind }
const rle = get('ADV.rle');
get('ADV').chunk = (x, y, d) => cells.set(x + '_' + y, { h: rle(d.h), mat: rle(d.mat), over: rle(d.over), kind: rle(d.kind) });
const dir = path.join(root, 'data/adv/chunks');
for (const f of fs.readdirSync(dir)) if (/^\d+_\d+\.js$/.test(f)) run('data/adv/chunks/' + f);
const fillM = Math.max(0, W.palette.indexOf(W.fill)), zero = new Array(N).fill(0), blank = new Set(W.blank || []);
const chunk = (x, y) => cells.get(x + '_' + y) || (blank.has(y * W.chunksW + x) || x < 0 || y < 0 || x >= W.chunksW || y >= W.chunksH ? { h: zero, mat: new Array(N).fill(fillM), over: zero, kind: zero } : null);
const cell = (c, r) => { const ch = chunk(c >> 5, r >> 5); if (!ch) return null; const i = (r & 31) * 32 + (c & 31); return { h: ch.h[i], mat: ch.mat[i], over: ch.over[i], kind: ch.kind[i] }; };

const png = new PNG({ width: PW, height: PH }), hs = {};
for (let r = 0; r < PH; r++) for (let c = 0; c < PW; c++) {
  const a = cell(c, r), o = (r * PW + c) * 4; let rgb = [8, 12, 24];
  if (a && a.h >= 0) {
    hs[a.h] = (hs[a.h] || 0) + 1;
    rgb = colour(W.palette[a.mat]);
    if (a.over) { const od = colour(W.palette[a.over]); rgb = rgb.map((x, i) => x * 0.4 + od[i] * 0.6); }
    const water = (W.water || ['water']).includes(W.palette[a.mat]);
    let k = water ? 1 : Math.max(0.5, 1 - 0.09 * a.h);   // higher ground is darker, water stays water-coloured
    const s = cell(c, r + 1), e = cell(c + 1, r);
    if (!water && [s, e].some(n => n && n.h >= 0 && n.h < a.h && !n.kind && !a.kind)) k *= 0.55;   // a cliff edge: this cell drops to a lower one (stairs and ledges have a kind and are left plain)
    rgb = rgb.map(x => Math.round(x * k));
  }
  png.data[o] = rgb[0]; png.data[o + 1] = rgb[1]; png.data[o + 2] = rgb[2]; png.data[o + 3] = 255;
}
const out = path.join(root, 'assets/adv/worldmap.png');
fs.writeFileSync(out, PNG.sync.write(png));
console.log('wrote', out, PW + 'x' + PH, 'chunks', cells.size, 'heights', JSON.stringify(hs));
