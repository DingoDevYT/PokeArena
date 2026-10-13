// Builds a custom PMD-style Mega Gyarados (0130-1) from the base Gyarados sheets.
// Output: assets/sprite-custom/0130-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0130-1.mjs [Walk Idle ...]   (no args = every sheet)
// Same approach as tools/build-mega-custom.mjs (Mega Venusaur): recolour by pixel role, then
// hand-tuned pixel patches anchored to points tracked by colour in every frame.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0130', OUT = path.join(ROOT, 'assets/sprite-custom/0130-1');
const WORK = 16;      // working margin around each frame; trimmed back to the smallest pad that fits

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));

// Base sprite colours by role.
const TAN = { l: K('f7e79f'), Y: K('dfb767'), y: K('a77f27') };
const WHITE = new Set(['ffffff', 'cfd7d7', '9fafa7'].map(K));
const CREST = new Set(['678777', '375f4f'].map(K));
const MOUTH = new Set(['9f0000', 'ff875f'].map(K));
const TANS = new Set(Object.values(TAN));
const BLUE = new Set(['0067b7', '1f9fe7', '7fcfff'].map(K));
const BLACK = 0;
// Mega colours, all from assets/sprite/0130-1/portrait.png. Blue body stays (same blues in both portraits).
const P = {
  black: [0, 0, 0],
  finL: hex('fbe972'), finM: hex('debb53'), finD: hex('857951'),          // cheek/back/tail fins turn yellow
  belM: hex('42435d'), belD: hex('272540'), red: hex('d85a69'), redD: hex('9b3b3d'), // black underside, red rim + scales
  crL: hex('8fa99f'), crM: hex('687d8b'), crD: hex('42435d'),           // darker, bigger crest
  tooth: hex('e3e7f9'),
};
const FIN = new Map([['ffffff', P.finL], ['cfd7d7', P.finM], ['9fafa7', P.finD]].map(([a, b]) => [K(a), b]));
const CRESTMAP = new Map([['678777', P.crM], ['375f4f', P.crD], ['ffffff', P.crL], ['cfd7d7', P.crL], ['9fafa7', P.crL]].map(([a, b]) => [K(a), b]));
const BELLY = new Map([[TAN.l, P.red], [TAN.Y, P.belM], [TAN.y, P.belD]]);
const RIM = new Map([[TAN.l, P.finL], [TAN.Y, P.finM], [TAN.y, P.finD]]);
const SPOT = new Map([[TAN.l, P.red], [TAN.Y, P.red], [TAN.y, P.redD]]);

// Crest spikes per direction (Down, DR, R, UR, Up; UL/L/DL are mirrors).
// tip: find the crest pixel furthest along this vector; off: start offset from it; e: growth direction; L: length; w: width.
const SPIKES = [
  [{ tip: [-1, -1], off: [0, 0], e: [-1, -1], L: 5, w: 3 }, { tip: [1, -1], off: [0, 0], e: [1, -1], L: 5, w: 3 },
   { tip: [-1, -1], off: [3, 3], e: [-1, -0.4], L: 5, w: 3 }, { tip: [1, -1], off: [-3, 3], e: [1, -0.4], L: 5, w: 3 }],
  [{ tip: [0, -1], off: [0, 0], e: [-0.3, -1], L: 5, w: 3 }, { tip: [1, -1], off: [0, 0], e: [1, -1], L: 4, w: 3 }],
  [{ tip: [-1, -1], off: [0, 0], e: [-1, -1], L: 5, w: 3 }, { tip: [1, -2], off: [0, 0], e: [0.3, -1], L: 4, w: 3 }],
  [{ tip: [0, -1], off: [0, 0], e: [0.2, -1], L: 4, w: 3 }, { tip: [1, -1], off: [0, 0], e: [1, -1], L: 3, w: 3 }],
  [{ tip: [0, -1], off: [0, 0], e: [0, -1], L: 4, w: 3 }, { tip: [-1, -0.3], off: [0, 0], e: [-1, -1], L: 3, w: 3 },
   { tip: [1, -0.3], off: [0, 0], e: [1, -1], L: 3, w: 3 }],
];
// Chin spike under the lower jaw: offset from the bottom-centre of the open mouth, growth direction, length.
const CHIN = [{ off: [0, 2], e: [0, 1], L: 6 }, { off: [-1, 2], e: [-0.3, 1], L: 5 }, { off: [-2, 2], e: [-0.5, 1], L: 5 }, null, null];
const mirror = s => s && { ...s, ...(s.tip && { tip: [-s.tip[0], s.tip[1]] }), off: [-s.off[0], s.off[1]], e: [-s.e[0], s.e[1]] };
for (const d of [3, 2, 1]) { SPIKES.push(SPIKES[d].map(mirror)); CHIN.push(mirror(CHIN[d])); }

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const k = p => (p ? key(...p) : -1);
  const kk = px.map(k);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  // 4-connected components of pixels whose key is in `set`.
  const comps = set => {
    const id = new Int32Array(W * H).fill(-1), list = [];
    for (let i = 0; i < W * H; i++) {
      if (id[i] >= 0 || !set.has(kk[i])) continue;
      const blob = [], st = [i]; id[i] = list.length;
      while (st.length) {
        const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of N4) {
          const n = (y + dy) * W + x + dx;
          if (inside(x + dx, y + dy) && id[n] < 0 && set.has(kk[n])) { id[n] = list.length; st.push(n); }
        }
      }
      list.push(blob);
    }
    return list;
  };
  const touches = (blob, set) => blob.some(j => N4.some(([dx, dy]) => {
    const x = j % W + dx, y = ((j / W) | 0) + dy; return inside(x, y) && set.has(kk[y * W + x]);
  }));

  // 0. Effect sprites (sparkles, sweat, Zs) are separate blobs with no body blue: leave them untouched.
  for (const b of comps(new Set(kk.filter(v => v >= 0)))) {
    if (!b.some(j => BLUE.has(kk[j]))) for (const j of b) kk[j] = -2;
  }
  const out = px.slice();
  // 1. Tan. Next to the mouth it is the jaw rim (stays yellow in the mega portrait). Blobs that reach the
  //    silhouette or carry the light tan are belly (goes black with a red rim); the rest are body spots (red scales).
  const nearMouth = i => { const x = i % W, y = (i / W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inside(x + dx, y + dy) && MOUTH.has(kk[(y + dy) * W + x + dx])) return true;
    return false; };
  const outerEdge = j => { const x = j % W, y = (j / W) | 0;
    return N4.some(([dx, dy]) => inside(x + dx, y + dy) && kk[(y + dy) * W + x + dx] === BLACK &&
      N4.some(([ex, ey]) => !inside(x + dx + ex, y + dy + ey) || kk[(y + dy + ey) * W + x + dx + ex] < 0)); };
  for (const b of comps(TANS)) {
    const map = (b.some(j => kk[j] === TAN.l) || b.some(outerEdge)) ? BELLY : SPOT;
    for (const j of b) out[j] = nearMouth(j) ? RIM.get(kk[j]) : map.get(kk[j]);
  }
  // 2. White: teeth/eye glints stay white, crest highlights go grey, everything else is fin -> yellow.
  const crestPx = [];
  for (let i = 0; i < W * H; i++) if (CREST.has(kk[i])) { out[i] = CRESTMAP.get(kk[i]); crestPx.push(i); }
  for (const b of comps(WHITE)) {
    if (b.length <= 6 && touches(b, MOUTH)) for (const j of b) out[j] = kk[j] === K('ffffff') ? P.tooth : px[j];
    else if (b.length <= 8 && touches(b, CREST)) for (const j of b) { out[j] = CRESTMAP.get(kk[j]); crestPx.push(j); }
    else for (const j of b) out[j] = FIN.get(kk[j]);
  }

  // Stroke: a tapered line from (x0, y0) along e. behind = only fills empty space / the outer outline.
  const front = new Uint8Array(W * H);
  const stroke = (x0, y0, e, L, w, behind, cols) => {
    const m = Math.max(Math.abs(e[0]), Math.abs(e[1])), ex = e[0] / m, ey = e[1] / m;
    const perp = Math.abs(ey) >= Math.abs(ex) ? [1, 0] : [0, 1];
    for (let t = 1; t <= L; t++) {
      const cx = Math.round(x0 + ex * t), cy = Math.round(y0 + ey * t);
      const ww = Math.max(1, Math.round(w * (1 - (t - 1) / L))); // taper to a point
      for (let o = 0; o < ww; o++) {
        const x = cx + perp[0] * o, y = cy + perp[1] * o, i = y * W + x;
        if (!inside(x, y)) continue;
        if (behind) {
          const outer = out[i] && k(out[i]) === BLACK && N4.some(([dx, dy]) => inside(x + dx, y + dy) && !out[(y + dy) * W + x + dx]);
          if (out[i] && !outer) continue;
        } else front[i] = 1;
        out[i] = o === 0 ? cols[0] : cols[1];
      }
    }
  };

  // 3. Bigger crest: thicken every crest edge that faces open space by one dark pixel...
  const ring = new Set();
  for (const i of crestPx) for (const [dx, dy] of N4) {
    const x = i % W + dx, y = ((i / W) | 0) + dy, n = y * W + x;
    if (!inside(x, y)) continue;
    const outer = out[n] && k(out[n]) === BLACK && N4.some(([ex, ey]) => inside(x + ex, y + ey) && !out[(y + ey) * W + x + ex]);
    if (!out[n] || outer) ring.add(n);
  }
  for (const n of ring) out[n] = P.crD;
  // ...then extend/add spikes from tracked crest tips, behind the head.
  if (crestPx.length >= 6) for (const s of SPIKES[dir]) {
    let best = -1e9, bi = -1;
    for (const i of crestPx) { const v = (i % W) * s.tip[0] + ((i / W) | 0) * s.tip[1]; if (v > best) { best = v; bi = i; } }
    stroke(bi % W + s.off[0], ((bi / W) | 0) + s.off[1], s.e, s.L, s.w, true, [P.crM, P.crD]);
  }
  // 4. Chin spike in front, anchored to the bottom of the open mouth.
  const mouth = comps(MOUTH).sort((a, b) => b.length - a.length)[0];
  const c = CHIN[dir];
  if (c && mouth && mouth.length >= 10) {
    const by = Math.max(...mouth.map(j => (j / W) | 0));
    const row = mouth.filter(j => ((j / W) | 0) === by), bx = Math.round(row.reduce((s, j) => s + (j % W), 0) / row.length);
    stroke(bx + c.off[0] - 1, by + c.off[1] - 1, c.e, c.L, 3, false, [P.crL, P.crM]);
    // Outline the front patch.
    const ring = [];
    for (let i = 0; i < W * H; i++) if (front[i]) for (const [dx, dy] of N4) {
      const x = i % W + dx, y = ((i / W) | 0) + dy; if (inside(x, y) && !front[y * W + x]) ring.push(y * W + x);
    }
    for (const i of ring) out[i] = P.black;
  }
  // 5. Close any open edge with a black outline.
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = inside(x + dx, y + dy) ? out[(y + dy) * W + x + dx] : null;
      if (p && k(p) !== BLACK) { fin[y * W + x] = P.black; break; }
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
  const frames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) frames.push(megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), r));
  // Smallest pad (multiple of 4, symmetric in x so the centre holds, top-only in y) that fits every frame.
  const WW = a.fw + WORK * 2;
  let px = 0, pt = 0, pb = 0;
  for (const fr of frames) fr.forEach((p, i) => {
    if (!p) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
    px = Math.max(px, -x, x - a.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - a.fh + 1);
  });
  if (pb > 0) console.warn(file, 'spills', pb, 'px below the frame (clipped)');
  const PX = Math.ceil(px / 4) * 4, PT = Math.ceil(pt / 4) * 4;
  const W = a.fw + PX * 2, H = a.fh + PT;
  const dst = new PNG({ width: cols * W, height: rows * H });
  frames.forEach((fr, n) => {
    const r = (n / cols) | 0, c = n % cols;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = fr[(y - PT + WORK) * WW + x - PX + WORK]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  });
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + PT, padX: PX, padT: PT };
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };
fs.writeFileSync(metaFile, JSON.stringify(Object.fromEntries(Object.entries(all).map(([n, m]) => [n, { fw: m.fw, fh: m.fh, footY: m.footY }])), null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(path.join(ROOT, 'assets/sprite/0130-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const { fw: W, fh: H } = all[file.replace('-Anim.png', '')];
    const padX = (W - a.fw) / 2, padT = H - a.fh; // the frame only grows symmetrically in x and on top
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, padX, padT), get(mega, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
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
console.log('built', Object.keys(meta).join(', '), JSON.stringify(meta));
