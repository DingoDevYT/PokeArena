// Builds custom PMD-style Mega Raichu X (0026-2) and Mega Raichu Y (0026-3) from the base Raichu sheets.
// Output: assets/sprite-custom/<key>/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0026-2.mjs [Walk Idle ...]   (no args = every sheet)
//        node tools/mega-custom/0026-3.mjs ...                (same code, Y variant)
// Same approach as tools/build-mega-custom.mjs: recolour by pixel role, then hand-tuned pixel patches
// anchored to features found by colour in every frame (ears, cheeks, tail bolt), so motion stays consistent.
//  X: Pikachu-yellow body, red cheeks, bigger solid-black ears with gold tips, the bolt tail split into
//     two Pikachu-like tails with black zigzag bases.
//  Y: lighter orange, orange ears with black tips, yellow lightning-bolt "horns" jutting out of the ears,
//     a bigger bolt tail, no brown paw tips.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const KEY = path.basename(process.argv[1] || '', '.mjs') === '0026-3' ? '0026-3' : '0026-2';
const Y = KEY === '0026-3';
const BASE = '0026', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const WORK = 16; // working margin around each frame; trimmed back to the smallest pad that fits

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;

// Base Raichu colours by role.
const B = { lt: K('ffaf47'), md: K('df871f'), dk: K('a75f1f'), br: K('773f00'), y: K('fff700'), yd: K('dfb700') };
const BODY = new Set([B.lt, B.md, B.dk]);
const BROWN = new Set([B.dk, B.br]);
const YEL = new Set([B.y, B.yd]);

// Mega colours, from the official portraits (portrait/0026/0002 and 0003/Normal.png).
const P = Y ? {
  body: new Map([[B.lt, 'ffb33d'], [B.md, 'f7972f'], [B.dk, 'b97a2c'], [B.br, 'b97a2c']]), // paw/foot tips lose their brown
  tail: hex('472f18'),
  ear: new Map([[B.y, 'f7972f'], [B.yd, 'b97a2c'], [B.dk, 'b97a2c'], [B.br, '866549']]), tip: hex('472f18'), tipL: hex('6b5434'),
  cheek: new Map([[B.y, 'fafa34'], [B.yd, 'dfb700']]),
  bolt: new Map([[B.y, 'fbe50d'], [B.yd, 'dfb700']]),
  horn: [hex('ffe5bd'), hex('fbe50d'), hex('dfb700')],
} : {
  body: new Map([[B.lt, 'ffd74f'], [B.md, 'dfa747'], [B.dk, 'b78f47'], [B.br, 'af7747']]),
  tail: hex('3b353b'),
  ear: new Map([[B.y, '5c515c'], [B.yd, '494149'], [B.dk, '494149'], [B.br, '3b353b']]), tip: hex('ffd74f'), tipL: hex('ffef6f'),
  cheek: new Map([[B.y, 'df5f5f'], [B.yd, 'bf4747']]),
  bolt: new Map([[B.y, 'ffef6f'], [B.yd, 'ffd74f']]),
  boltDark: new Map([[B.y, '5c515c'], [B.yd, '3b353b']]),
};
for (const m of [P.body, P.ear, P.cheek, P.bolt, P.boltDark]) if (m) for (const [k, v] of m) m.set(k, hex(v));

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Y's lightning-bolt horn (right-side version): L light, Y yellow, D shade.
const HORN = [
  '....LYD',
  '...LYD.',
  '..LYD..',
  '.LYYYYD',
  '....LYD',
  '...LYD.',
  '..LYD..',
  '.LYD...',
  'LYD....',
];

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function megaFrame(f) {
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

  // 0. Effect sprites (sparks, sweat, Zs) are blobs with no body orange: leave them untouched.
  for (const b of comps(i => kk[i] >= 0)) if (!b.some(j => BODY.has(kk[j]))) for (const j of b) kk[j] = -2;
  const body = []; for (let i = 0; i < W * H; i++) if (kk[i] >= 0) body.push(i);
  const out = px.slice();
  if (!body.length) return out;
  const top = Math.min(...body.map(Yc)), bot = Math.max(...body.map(Yc)), hgt = bot - top + 1;
  const upper = i => Yc(i) < top + hgt * 0.45;

  // 1. Yellow blobs: cheeks touch the light face orange; ear insides sit high and touch ear brown; the rest is the tail bolt.
  const cheeks = [], earIn = [], bolts = [];
  for (const b of comps(i => YEL.has(kk[i]))) {
    if (b.length <= 12 && b.some(j => nb(j, n => kk[n] === B.lt))) cheeks.push(b);
    else if (upper(b[0]) && cen(b)[1] < top + hgt * 0.45 && b.some(j => nb(j, n => BROWN.has(kk[n])))) earIn.push(b);
    else if (b.length >= 3) bolts.push(b);
  }
  // Whole ears: flood from seeds (ear insides, or brown blobs up top that don't touch the face, i.e. ears seen
  // from behind / the far ear in side views) through ear colours, never into pixels touching the light face
  // orange and never below the seed.
  const isEar = new Uint8Array(W * H), ears = [];
  const EARC = new Set([B.dk, B.br, B.md, B.y, B.yd]);
  const seeds = earIn.map(b => ({ b, inner: true }));
  for (const b of comps(i => BROWN.has(kk[i])))
    if (b.length >= 3 && cen(b)[1] < top + hgt * 0.32 && !b.some(j => nb(j, n => kk[n] === B.lt)) && !b.some(j => earIn.some(e => e.includes(j) || nb(j, n => e.includes(n)))))
      seeds.push({ b, inner: false });
  for (const { b, inner } of seeds) {
    if (b.some(j => isEar[j])) continue;
    const maxY = Math.max(...b.map(Yc)) + 1, ear = b.slice(); b.forEach(j => (isEar[j] = 1));
    const st = b.slice();
    while (st.length) {
      const j = st.pop();
      for (const [dx, dy] of N4) {
        const x = X(j) + dx, y = Yc(j) + dy, n = y * W + x;
        if (inside(x, y) && y <= maxY && !isEar[n] && EARC.has(kk[n]) && !nb(n, m => kk[m] === B.lt)) { isEar[n] = 1; ear.push(n); st.push(n); }
      }
    }
    ears.push({ px: ear, inner });
  }
  // Thin tail line: dark brown runs one pixel wide between black.
  const isTail = new Uint8Array(W * H);
  for (const b of comps(i => kk[i] === B.br && !isEar[i])) {
    const thin = b.filter(j => N4.filter(([dx, dy]) => { const x = X(j) + dx, y = Yc(j) + dy; return !inside(x, y) || kk[y * W + x] <= 0; }).length >= 2).length;
    const xs = b.map(X), ys = b.map(Yc);
    if (b.length >= 5 && thin >= b.length * 0.7 && Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= 4) b.forEach(j => (isTail[j] = 1));
  }

  // 2. Recolour by role.
  const isBolt = new Uint8Array(W * H); bolts.flat().forEach(j => (isBolt[j] = 1));
  const isCheek = new Uint8Array(W * H); cheeks.flat().forEach(j => (isCheek[j] = 1));
  for (let i = 0; i < W * H; i++) {
    if (kk[i] < 0) continue;
    if (isEar[i]) out[i] = P.ear.get(kk[i]) || P.ear.get(B.dk);
    else if (isTail[i]) out[i] = P.tail;
    else if (isCheek[i]) out[i] = P.cheek.get(kk[i]);
    else if (isBolt[i]) out[i] = P.bolt.get(kk[i]);
    else if (P.body.has(kk[i])) out[i] = P.body.get(kk[i]);
  }

  const [bcx, bcy] = cen(body);
  const head = body.filter(upper), [hcx] = head.length ? cen(head) : [bcx];
  // Paint a thick line behind the sprite (fills empty pixels and the outer outline only).
  const behind = i => !out[i] || (k(out[i]) === BLACK && nb(i, n => !out[n]));
  const line = (x0, y0, x1, y1, w, col, test = behind) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let t = 0; t <= n; t++) for (let oy = 0; oy < w; oy++) for (let ox = 0; ox < w; ox++) {
      const x = Math.round(x0 + (x1 - x0) * t / n) + ox, y = Math.round(y0 + (y1 - y0) * t / n) + oy, i = y * W + x;
      if (inside(x, y) && test(i)) out[i] = typeof col === 'function' ? col(t / n, ox, oy) : col;
    }
  };

  // 3. Ears: tip colour on the outermost pixels; X also grows each ear longer.
  // The ear's axis runs from its centroid to the pixel furthest from the body centre (the tip).
  for (const ear of ears) {
    const e = ear.px; if (e.length < 4) continue;
    const [ex, ey] = cen(e);
    let tip = e[0]; for (const j of e) if (Math.hypot(X(j) - bcx, Yc(j) - bcy) > Math.hypot(X(tip) - bcx, Yc(tip) - bcy)) tip = j;
    let dx = X(tip) - ex, dy = Yc(tip) - ey; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    ear.dir = [dx, dy]; ear.tip = tip;
    const proj = j => (X(j) - ex) * dx + (Yc(j) - ey) * dy;
    const max = Math.max(...e.map(proj));
    if (Y) { for (const j of e) if (proj(j) >= max - 1.5) out[j] = P.tip; continue; }
    // X: ears grow 3px longer along their axis (tapered, painted behind), tips gold.
    const tx = X(tip), ty = Yc(tip), perp = Math.abs(dy) >= Math.abs(dx) ? [1, 0] : [0, 1];
    for (let t = 1; t <= 3; t++) for (let o = -1; o <= (t < 3 ? 1 : 0); o++) {
      const x = Math.round(tx + dx * t - dx) + perp[0] * o, y = Math.round(ty + dy * t - dy) + perp[1] * o, i = y * W + x;
      if (inside(x, y) && behind(i)) out[i] = o === -1 ? P.tipL : P.tip;
    }
    for (const j of e) if (proj(j) >= max - 2) out[j] = proj(j) >= max - 1 ? P.tip : P.tipL;
  }

  // 4. Tail bolt.
  for (const b of bolts) {
    if (b.length < 5) continue;
    // Attach point: the bolt pixel nearest the thin tail (or the body centre if no tail line is visible).
    const tl = []; for (let i = 0; i < W * H; i++) if (isTail[i]) tl.push(i);
    const ref = tl.length ? tl : [Math.round(bcy) * W + Math.round(bcx)];
    let att = b[0], best = 1e9;
    for (const j of b) for (const r of ref) { const d = (X(j) - X(r)) ** 2 + (Yc(j) - Yc(r)) ** 2; if (d < best) { best = d; att = j; } }
    const dist = j => Math.hypot(X(j) - X(att), Yc(j) - Yc(att));
    const far = Math.max(...b.map(dist));
    let tipJ = b[0]; for (const j of b) if (dist(j) > dist(tipJ)) tipJ = j;
    if (!Y) {
      // Black zigzag fur at the base of each tail.
      for (const j of b) if (dist(j) < far * 0.42 + ((X(j) + Yc(j)) % 3) - 1) out[j] = P.boltDark.get(kk[j]);
      // Second tail: a copy of the bolt (with its outline) shifted sideways, away from the body, painted behind.
      let ax = X(tipJ) - X(att), ay = Yc(tipJ) - Yc(att); const L = Math.hypot(ax, ay) || 1;
      let nx = -ay / L, ny = ax / L;
      const [tcx, tcy] = cen(b);
      if ((tcx - bcx) * nx + (tcy - bcy) * ny < 0) { nx = -nx; ny = -ny; }
      const sx = Math.round(nx * 3 + ax / L), sy = Math.round(ny * 3 + ay / L);
      const copy = new Map();
      for (const j of b) {
        copy.set((Yc(j) + sy) * W + X(j) + sx, out[j]);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const x = X(j) + ox, y = Yc(j) + oy, n = y * W + x;
          if (inside(x, y) && kk[n] === BLACK) { const m = (y + sy) * W + x + sx; if (!copy.has(m)) copy.set(m, [0, 0, 0]); }
        }
      }
      for (const [m, c] of copy) if (inside(X(m), Yc(m)) && !out[m]) out[m] = c;
    } else {
      // Bigger bolt: one extra ring of yellow around it (outside only), re-outlined below.
      const ring = new Set();
      for (const j of b) for (const [dx, dy] of N4) {
        const x = X(j) + dx, y = Yc(j) + dy, n = y * W + x;
        if (inside(x, y) && behind(n) && !isBolt[n]) ring.add(n);
      }
      for (const n of ring) out[n] = P.bolt.get(B.yd);
    }
  }

  // 5. Y: yellow lightning-bolt horns out of the ears' outer sides.
  // Hand-drawn right-side horn; bottom-left pixel sits on the ear's outer edge. Mirrored for left ears.
  if (Y) for (const ear of ears) {
    const e = ear.px; if (e.length < 4) continue;
    const [ex, ey] = cen(e), side = ex < hcx ? -1 : 1;
    const sx = side < 0 ? Math.min(...e.map(X)) : Math.max(...e.map(X)), sy = Math.round(ey) + 1;
    HORN.forEach((row, py) => [...row].forEach((c, pxi) => {
      if (c === '.') return;
      const x = sx + side * pxi, y = sy - (HORN.length - 1) + py, i = y * W + x;
      if (inside(x, y) && behind(i)) out[i] = c === 'L' ? P.horn[0] : c === 'Y' ? P.horn[1] : P.horn[2];
    }));
  }

  // 6. Close any open edge with a black outline.
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = inside(x + dx, y + dy) ? out[(y + dy) * W + x + dx] : null;
      if (p && k(p) !== BLACK) { fin[y * W + x] = [0, 0, 0]; break; }
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
