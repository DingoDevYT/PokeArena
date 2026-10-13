// Builds a custom PMD-style Mega Clefable (0036-1) from the base Clefable sheets.
// Output: assets/sprite-custom/0036-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0036-1.mjs [Walk Idle ...]   (no args = every sheet)
// Same approach as tools/build-mega-custom.mjs: recolour by pixel role, then pixel patches anchored to
// features found by colour in every frame:
//  - the small orange back wings anchor two big butterfly wings (pink upper lobes, yellow lower lobes),
//    modelled flat in 3D and projected with the PMD camera for each facing, so they turn with the body;
//  - the pointed brown-tipped ears are shaved off and replaced by drooping dark tube ears with light-blue openings;
//  - the head curl becomes a round pink-and-white hat with a curled tip.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const KEY = '0036-1', BASE = '0036', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const WORK = 24; // working margin around each frame; trimmed back to the smallest pad that fits

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;

// Base Clefable colours by role.
const PINK = new Set(['ffc7cf', 'ef979f', 'af5f37'].map(K));
const WING = new Set(['ff875f', 'd73f00', '9f0000', 'df771f'].map(K));
const TIP = new Set(['773f00', 'a75f1f'].map(K));
// Mega colours from the official portrait (portrait/0036/0001/Normal.png); the wing yellow shade is
// the portrait's f7ba6a one step darker (the portrait only shows a sliver of the lower wing).
const REMAP = new Map([
  ['ffc7cf', 'ffd7df'], ['ef979f', 'e9afaf'], ['af5f37', 'af877f'],
  ['ff875f', 'fa9caa'], ['d73f00', 'e95983'], ['9f0000', 'b23b5d'], ['df771f', 'e95983'],
  ['a75f1f', 'e95983'], ['773f00', 'b23b5d'],
].map(([a, b]) => [K(a), hex(b)]));
const C = {
  black: [0, 0, 0], wL: hex('fa9caa'), wM: hex('e95983'), wD: hex('b23b5d'), yL: hex('f7ba6a'), yD: hex('d99a52'), wP: hex('ffedf0'),
  tube: hex('4f372f'), tubeL: hex('87675f'), blue: hex('7fc7d7'), blueD: hex('5f8f97'),
  W: hex('ffffff'), w: hex('ffedf0'), P: hex('ffd7df'), p: hex('e9afaf'),
};
// Round hat (white top, pink band, curled tip). Bottom row sits HAT_SINK rows into the head.
const HAT = [
  '.....##....',
  '....#Ww#...',
  '.....#W#...',
  '..##WWWw##.',
  '.#WWWWWWww#',
  '#WWWWWWWWw#',
  '#PPPPPPPPp#',
  '#PPPPPPPpp#',
  '.#PPPPPpp#.',
];
const HAT_SINK = 5;

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// PMD camera: facing d (0 Down, 1 DownRight, 2 Right ... 7 DownLeft). Ground vectors are (x, z) with
// z toward the viewer; screen = (x, z * 0.5 - up).
const fwd = d => [Math.sin(d * Math.PI / 4), Math.cos(d * Math.PI / 4)];
const rgt = d => [-Math.cos(d * Math.PI / 4), Math.sin(d * Math.PI / 4)];

// One butterfly wing in its own plane: a along the span (0 root .. 1 tip), b up. Returns colour or null.
const FORE = [[0, 0.05], [0.18, 0.75], [0.55, 1.2], [0.85, 1.25], [1.0, 1.0], [0.95, 0.55], [0.55, 0.12], [0.2, -0.05]];
const HIND = [[0.1, 0.05], [0.7, -0.02], [1.0, -0.3], [0.92, -0.72], [0.6, -0.88], [0.3, -0.6], [0.05, -0.1]];
const VEINS = [[0.2, 0.85], [0.62, 1.15], [0.95, 0.8]]; // the three-pronged frame from the back
function inPoly(poly, a, b) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > b) !== (yj > b) && a < (xj - xi) * (b - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const segDist = (a, b, [x1, y1], [x2, y2]) => {
  const t = Math.max(0, Math.min(1, ((a - x1) * (x2 - x1) + (b - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
  return Math.hypot(a - x1 - t * (x2 - x1), b - y1 - t * (y2 - y1));
};
function wingPx(a, b) {
  if (inPoly(FORE, a, b)) {
    if (Math.hypot(a, b - 0.1) < 0.22) return C.wM;                       // root
    if (VEINS.some(v => segDist(a, b, [0.05, 0.1], v) < 0.035)) return C.wM; // veins
    return C.wL;
  }
  if (inPoly(HIND, a, b)) {
    if (Math.hypot(a, b) < 0.3) return C.wL;
    return b < -0.6 || a > 0.72 ? C.yD : C.yL;
  }
  return null;
}
// Wings per facing (Down, DR, R, UR, Up; UL/L/DL mirror), far wing first. root: offset from the old wing
// pixels' centre; span: screen vector from root to wing tip; h: px per unit of wing height; front: drawn over
// the body (we see its back).
const WINGS = [
  [{ root: [-2, 1], span: [-17, -2], h: 10 }, { root: [2, 1], span: [17, -2], h: 10 }],
  [{ root: [2, -1], span: [11, -5], h: 9 }, { root: [-2, 1], span: [-16, -3], h: 10 }],
  [{ root: [-1, -2], span: [-12, -6], h: 9 }, { root: [0, 1], span: [-16, -1], h: 10 }],
  [{ root: [2, -1], span: [12, -4], h: 9, front: true }, { root: [-2, 1], span: [-16, -2], h: 10, front: true }],
  [{ root: [-2, 0], span: [-17, -2], h: 10, front: true }, { root: [2, 0], span: [17, -2], h: 10, front: true }],
];
for (const d of [3, 2, 1]) WINGS.push(WINGS[d].map(w => ({ ...w, root: [-w.root[0], w.root[1]], span: [-w.span[0], w.span[1]] })));

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const k = p => (p ? key(...p) : -1);
  const kk = px.map(k);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const X = i => i % W, Yc = i => (i / W) | 0;
  const comps = test => {
    const seen = new Uint8Array(W * H), list = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !test(i)) continue;
      const blob = [], st = [i]; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); blob.push(j);
        for (const [dx, dy] of N4) {
          const x = X(j) + dx, y = Yc(j) + dy, n = y * W + x;
          if (inside(x, y) && !seen[n] && test(n)) { seen[n] = 1; st.push(n); }
        }
      }
      list.push(blob);
    }
    return list;
  };
  const nb = (j, fn) => N4.some(([dx, dy]) => { const x = X(j) + dx, y = Yc(j) + dy; return inside(x, y) && fn(y * W + x); });
  const cen = b => [b.reduce((s, i) => s + X(i), 0) / b.length, b.reduce((s, i) => s + Yc(i), 0) / b.length];

  // 0. Effect sprites (sparkles, sweat, Zs) are blobs with no body pink: leave them untouched.
  for (const b of comps(i => kk[i] >= 0)) if (!b.some(j => PINK.has(kk[j]))) for (const j of b) kk[j] = -2;
  const body = []; for (let i = 0; i < W * H; i++) if (kk[i] >= 0) body.push(i);
  let out = px.slice();
  if (body.length < 20) return out;
  const top = Math.min(...body.map(Yc)), bot = Math.max(...body.map(Yc)), hgt = bot - top + 1;
  const [bcx, bcy] = cen(body);

  // 1. Shave the ears: brown tip blobs up top, plus everything within EAR_R of the tip that is above the
  //    tip's base. The cut gets re-outlined at the end.
  const cut = new Uint8Array(W * H);
  const tips = comps(i => TIP.has(kk[i])).filter(b => cen(b)[1] < top + hgt * 0.35 && b.length >= 2);
  for (const b of tips) {
    const [tx, ty] = cen(b);
    // Ear axis points from the body centre to the tip; shave along it.
    let dx = tx - bcx, dy = ty - bcy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    for (const i of body) {
      const ox = X(i) - tx, oy = Yc(i) - ty, along = ox * dx + oy * dy, across = Math.abs(-ox * dy + oy * dx);
      if (along > -3.2 && across <= 2.6 + Math.max(0, -along) * 0.5) cut[i] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) if (cut[i]) { out[i] = null; kk[i] = -1; }
  // Drop black outline pixels left floating by the cut (no non-black neighbour any more).
  for (let i = 0; i < W * H; i++) if (kk[i] === BLACK && !nb(i, n => kk[n] > 0)) { out[i] = null; kk[i] = -1; }

  // 2. Recolour.
  for (let i = 0; i < W * H; i++) if (kk[i] >= 0 && REMAP.has(kk[i])) out[i] = REMAP.get(kk[i]);

  const behind = i => !out[i] || (k(out[i]) === BLACK && nb(i, n => !out[n]));
  // Paint a {pixel: colour} mask with its own black edge. front = over the sprite, else only behind it.
  const paint = (mask, front) => {
    for (const [i, c] of mask) {
      const edge = N4.some(([dx, dy]) => !mask.has(i + dy * W + dx));
      if (front || behind(i)) out[i] = edge ? C.black : c;
    }
  };

  // 3. Butterfly wings, rooted at the old wing pixels.
  const wpx = body.filter(i => WING.has(kk[i]));
  const [ax, ay] = wpx.length >= 4 ? cen(wpx) : [bcx, top + hgt * 0.45];
  const F = fwd(dir), R = rgt(dir);
  for (const w of WINGS[dir]) {
    const mask = new Map();
    for (let a = 0; a <= 1.0001; a += 0.01) for (let b = -0.9; b <= 1.3; b += 0.01) {
      const c = wingPx(a, b); if (!c) continue;
      const x = Math.round(ax + w.root[0] + w.span[0] * a), y = Math.round(ay + w.root[1] + w.span[1] * a - b * w.h);
      if (inside(x, y)) mask.set(y * W + x, c);
    }
    paint(mask, !!w.front);
  }

  // 4. Hat over the head curl: centred on the head, sitting on its top.
  const head = []; for (let i = 0; i < W * H; i++) if (kk[i] > 0 && PINK.has(kk[i]) && Yc(i) < top + hgt * 0.5) head.push(i);
  if (head.length >= 10) {
    const hx = Math.round(cen(head)[0]);
    let ht = H; for (let i = 0; i < W * H; i++) if (out[i] && kk[i] >= 0 && Math.abs(X(i) - hx) <= 2) ht = Math.min(ht, Yc(i));
    // Ears: dark tubes drooping from the sides of the head, light-blue openings at the ends.
    const headW = Math.max(...head.map(X)) - Math.min(...head.map(X));
    const ey = top + hgt * 0.32;
    const ears = [-1, 1].map(s => {
      const half = headW * 0.42;
      const root = [hx + s * R[0] * half - F[0] * half * 0.6, ey + (s * R[1] * half - F[1] * half * 0.6) * 0.5];
      const d = [s * R[0] * 0.75 - F[0] * 0.5, (s * R[1] * 0.75 - F[1] * 0.5) * 0.5 + 0.4]; const dl = Math.hypot(...d); d[0] /= dl; d[1] /= dl;
      const mask = new Map(), Lt = 8, TR = 1.6;
      for (let t = 0; t <= Lt; t += 0.25) for (let oy = -TR; oy <= TR; oy += 0.25) for (let ox = -TR; ox <= TR; ox += 0.25) {
        if (ox * ox + oy * oy > TR * TR) continue;
        const x = Math.round(root[0] + d[0] * t + ox), y = Math.round(root[1] + d[1] * t + oy), i = y * W + x;
        if (!inside(x, y)) continue;
        const across = -ox * d[1] + oy * d[0]; // which side of the tube axis: negative = upper side
        let c = across < -1 ? C.tubeL : C.tube;
        if (t > Lt - 1) c = Math.hypot(ox, oy) < 0.8 ? C.blueD : C.blue;
        if (!mask.has(i) || t > Lt - 1) mask.set(i, c);
      }
      return { mask, z: s * R[1] };
    }).sort((p, q) => p.z - q.z);
    for (const e of ears) paint(e.mask, e.z > -0.4);
    HAT.forEach((row, py) => [...row].forEach((c, pxi) => {
      if (c === '.') return;
      const x = hx - 5 + pxi, y = ht + HAT_SINK - (HAT.length - 1) + py;
      if (inside(x, y)) out[y * W + x] = c === '#' ? C.black : C[c];
    }));
  }

  // 5. Close any open edge with a black outline.
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = inside(x + dx, y + dy) ? out[(y + dy) * W + x + dx] : null;
      if (p && k(p) !== BLACK) { fin[y * W + x] = C.black; break; }
    }
  }
  return fin;
}

// ---- Shared driver: build every sheet, trim pads, write _anims.json and _preview.png last. ----
const portraitFile = path.join(ROOT, 'tools/.cache/mega-base/portrait', KEY + '.png');
if (!fs.existsSync(portraitFile)) {
  const [d, f] = KEY.split('-');
  const r = await fetch(`https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${d}/${f.padStart(4, '0')}/Normal.png`);
  fs.mkdirSync(path.dirname(portraitFile), { recursive: true });
  fs.writeFileSync(portraitFile, Buffer.from(await r.arrayBuffer()));
}
// Rotate and Swing spin through every facing: column c of row r faces (r - c) mod 8. Single-row sheets
// (Sleep...) lie facing down-left.
const SPIN = new Set(['Rotate', 'Swing']);
const facing = (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r;
const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const anims = window.SPRITES[BASE].anims;
const meta = {};
fs.mkdirSync(OUT, { recursive: true });
for (const file of sheets) {
  const name = file.replace('-Anim.png', '');
  if (want.length && !want.includes(name)) continue;
  const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
  if (!a) { console.warn('no frame size for', file); continue; }
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets/sprite', BASE, file)));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const frames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) frames.push(megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), facing(name, r, c, rows)));
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
  meta[name] = { fw: W, fh: H, footY: a.footY + PT };
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(portraitFile);
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const { fw: W, fh: H } = all[file.replace('-Anim.png', '')];
    const padX = (W - a.fw) / 2, padT = H - a.fh;
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
fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));
console.log(KEY, 'built', Object.keys(meta).join(', '));
