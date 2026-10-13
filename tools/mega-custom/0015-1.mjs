// Builds a custom PMD-style Mega Beedrill (0015-1) from the base Beedrill sheets.
// Output: assets/sprite-custom/0015-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0015-1.mjs [Walk Hover ...]   (no args = every sheet)
// Same method as tools/build-mega-custom.mjs (Mega Venusaur): every feature is found by colour in each
// frame and redrawn from there, so the patches follow the base animation.
//  1. Forearm stingers (light, elongated blobs on the front side) -> big banded drills along the same axis.
//  2. Abdomen tip (lowest yellow) -> cut, pushed out along its own axis, gap filled with extra stripes,
//     then a long silver stinger.
//  3. Antennae tips (dark pixels above the head) -> extended and swept back.
//  4. Palette remap to the mega portrait (assets/sprite/0015-1/portrait.png), black outline closed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0015', KEY = '0015-1', OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const PAD = 20;           // working margin; each sheet is cropped back to what it needs

const DRILL_GROW = 1.55;  // drill length vs. the original stinger
const DRILL_EXTRA = 3;
const DRILL_HALF = 2.6;   // half-width at the drill base
const ABD_CUT = 4;        // px of abdomen tip that get pushed out
const ABD_PUSH = 5;       // how far it is pushed (= extra abdomen length)
const NEEDLE = 7;         // abdomen stinger length
const ANT = 4;            // antenna extension

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const LIGHT = new Set(['ffffff', 'bfcff7', '6787af'].map(K));
const DARK = new Set(['4f5f97', '373f8f'].map(K));
const YEL = new Set(['fff700', 'dfb700', 'a76f00'].map(K));
const EYE = new Set(['d73f00', 'ff875f'].map(K));
// Base Beedrill palette -> Mega Beedrill portrait palette.
const REMAP = new Map([
  ['fff700', 'facf3a'], ['dfb700', 'd6ac22'], ['a76f00', 'b79116'],  // yellow
  ['373f8f', '34303f'], ['4f5f97', '4c475b'],                       // legs/antennae: blue-black -> portrait greys
  ['d73f00', 'c45255'], ['ff875f', 'cf7b75'],                       // eyes
  // Wings keep the base pale blue: the portrait does not show them, and it keeps them apart from the silver drills.
].map(([a, b]) => [K(a), hex(b)]));
const C = {
  black: [0, 0, 0], W: hex('e8eaef'), S: hex('bdbfc1'), G: hex('4c475b'), D: hex('34303f'),
  y: hex('dfb700'), Y: hex('fff700'), o: hex('a76f00'), N: hex('373f8f'), n: hex('4f5f97'),
};
// Per direction (Down, DR, R, UR, Up, UL, L, DL): a light blob is a forearm stinger when its centroid lies
// on this side of the eyes (dot(c - eyes, N) > 0). Wings sit on the other side. Up = back view, no stingers.
// Abdomen hangs this way (screen space) per direction; blended with the measured axis near the tip.
// Side views hide the abdomen behind the wing, so there a new striped abdomen is drawn instead of stretching.
const ABD_DIR = [[0, 1], [0.2, 1], [-0.8, 1], [-1.2, 1], [0, 1], [1.2, 1], [0.8, 1], [-0.2, 1]];
const ABD_TUBE = [false, false, true, true, false, true, true, false];
const STING_SIDE = [[0, 1, 2], [1, 0.3, 0], [1, 0, 0], [1, 0.6, 0], null, [-1, 0.6, 0], [-1, 0, 0], [-1, 0.3, 0]];

// Sleep lies on its side with the wings folded down; they are bigger than the stingers, so cap blob size there.
const MAX_STING = { Sleep: 30 };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + PAD * 2, H = fh + PAD * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + PAD) * W + x + PAD] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

function blobs(px, W, H, set) {
  const seen = new Uint8Array(W * H), all = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !px[i] || !set.has(key(...px[i]))) continue;
    const b = [], st = [i]; seen[i] = 1;
    while (st.length) {
      const j = st.pop(); b.push(j); const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy, n = yy * W + xx;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && !seen[n] && px[n] && set.has(key(...px[n]))) { seen[n] = 1; st.push(n); }
      }
    }
    all.push(b);
  }
  return all;
}

// Centroid + principal axis of a pixel list.
function pca(b, W) {
  const n = b.length;
  const mx = b.reduce((s, i) => s + (i % W), 0) / n, my = b.reduce((s, i) => s + ((i / W) | 0), 0) / n;
  let xx = 0, yy = 0, xy = 0;
  for (const i of b) { const dx = (i % W) - mx, dy = ((i / W) | 0) - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  xx /= n; yy /= n; xy /= n;
  const tr = xx + yy, det = xx * yy - xy * xy, d = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + d, l2 = tr / 2 - d;
  const ang = 0.5 * Math.atan2(2 * xy, xx - yy);
  return { mx, my, ax: Math.cos(ang), ay: Math.sin(ang), el: l1 / Math.max(l2, 0.05), l1 };
}

function megaFrame(f, dir, maxSting = 60) {
  const { W, H, px } = f;
  const k = p => p && key(...p);
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const out = px.slice();
  const put = (x, y, c) => { if (inb(x, y)) out[y * W + x] = c; };

  const eyes = []; for (let i = 0; i < W * H; i++) if (EYE.has(k(px[i]))) eyes.push(i);
  const yel = []; for (let i = 0; i < W * H; i++) if (YEL.has(k(px[i]))) yel.push(i);
  if (yel.length < 6) return finish(out, W, H);
  const head = eyes.length ? eyes : yel;
  const ex = head.reduce((s, i) => s + (i % W), 0) / head.length, ey = head.reduce((s, i) => s + ((i / W) | 0), 0) / head.length;

  // 2. Abdomen: lowest yellow = tip; axis from the yellow pixels near it.
  {
    const [pdx, pdy] = ABD_DIR[dir] || [0, 1];
    const score = i => (i % W - ex) * pdx + (((i / W) | 0) - ey) * pdy - Math.abs(i % W - ex) * 0.01;
    let tip = yel[0];
    for (const i of yel) if (score(i) > score(tip)) tip = i;
    const tx = tip % W, ty = (tip / W) | 0;
    const near = yel.filter(i => Math.hypot(i % W - tx, ((i / W) | 0) - ty) <= 6);
    const p = pca(near, W);
    let ax = p.ax, ay = p.ay;
    if (ax * (tx - p.mx) + ay * (ty - p.my) < 0) { ax = -ax; ay = -ay; }
    { const pl = Math.hypot(pdx, pdy); ax += pdx / pl; ay += pdy / pl; }
    const nl = Math.hypot(ax, ay); ax /= nl; ay /= nl;
    const dist = Math.hypot(tx - ex, ty - ey);
    if (dist >= 6 && ABD_TUBE[dir]) {
      const [qx, qy] = [pdx / Math.hypot(pdx, pdy), pdy / Math.hypot(pdx, pdy)];
      const bx = tx - qx * 2, by = ty - qy * 2, L = ABD_CUT + ABD_PUSH + 1;
      cone(out, W, H, bx, by, qx, qy, L, 2.0, 1.0, (u, v, w, lit) =>
        Math.floor(u) % 3 === 2 ? C.black : v * lit > w * 0.3 ? C.Y : v * lit < -w * 0.3 ? C.o : C.y, true);
      needle(out, W, H, bx + qx * (L + 0.5), by + qy * (L + 0.5), qx, qy);
    } else if (dist >= 6) {
      const cx = tx - ax * ABD_CUT, cy = ty - ay * ABD_CUT; // cut point
      const along = (x, y) => (x - cx) * ax + (y - cy) * ay, perp = (x, y) => (x - cx) * -ay + (y - cy) * ax;
      // Abdomen pixels beyond the cut: yellow, or black touching yellow.
      const isAbd = (x, y) => {
        if (!inb(x, y)) return false; const c = k(px[y * W + x]);
        if (YEL.has(c)) return true;
        if (c !== BLACK) return false;
        return N4.some(([dx, dy]) => inb(x + dx, y + dy) && YEL.has(k(px[(y + dy) * W + x + dx])));
      };
      const R = 3.6;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (along(x, y) >= 0 && Math.abs(perp(x, y)) <= R && isAbd(x, y)) out[y * W + x] = null;
      const sx = Math.round(ax * ABD_PUSH), sy = Math.round(ay * ABD_PUSH);
      const push = Math.hypot(sx, sy);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = along(x, y); if (t < 0 || Math.abs(perp(x, y)) > R + 0.5 || out[y * W + x]) continue;
        let qx, qy, band = false;
        if (t >= push) { qx = x - sx; qy = y - sy; }
        else { qx = Math.round(x - ax * t); qy = Math.round(y - ay * t); band = true; }
        if (!isAbd(qx, qy) || along(qx, qy) < -0.5) continue;
        let c = px[qy * W + qx];
        // In the new segments only the side edges stay black; inner blacks (Up view's dark thorax) become stripes.
        const px1 = Math.round(-ay), py1 = Math.round(ax);
        const edge = !isAbd(qx + px1, qy + py1) || !isAbd(qx - px1, qy - py1);
        if (band && (k(c) !== BLACK || !edge)) c = (Math.floor(t) % 3 === 2) ? C.black : (perp(x, y) * (ax > 0 ? 1 : -1) < -0.5 ? C.Y : Math.floor(t) % 3 === 0 ? C.o : C.y);
        out[y * W + x] = c;
      }
      // Long stinger from the new tip.
      needle(out, W, H, tx + sx + ax * 0.5, ty + sy + ay * 0.5, ax, ay);
    }
  }

  // 1. Drills.
  const side = STING_SIDE[dir];
  if (side) {
    for (const b of blobs(px, W, H, LIGHT)) {
      if (b.length < 10 || b.length > maxSting) continue;
      const p = pca(b, W);
      if ((p.mx - ex) * side[0] + (p.my - ey) * side[1] <= side[2]) continue;
      if (4 * Math.sqrt(p.l1) < 5) continue;
      let ax = p.ax, ay = p.ay;
      let lo = Infinity, hi = -Infinity;
      for (const i of b) { const u = (i % W - p.mx) * ax + (((i / W) | 0) - p.my) * ay; lo = Math.min(lo, u); hi = Math.max(hi, u); }
      // Base = the end nearer the eyes.
      const e0 = Math.hypot(p.mx + ax * lo - ex, p.my + ay * lo - ey), e1 = Math.hypot(p.mx + ax * hi - ex, p.my + ay * hi - ey);
      if (e1 < e0) { ax = -ax; ay = -ay; [lo, hi] = [-hi, -lo]; }
      const bx = p.mx + ax * (lo - 1), by = p.my + ay * (lo - 1);
      const L = (hi - lo + 1) * DRILL_GROW + DRILL_EXTRA;
      for (const i of b) out[i] = null;
      cone(out, W, H, bx, by, ax, ay, L, DRILL_HALF, 0, drillShade, false);
    }
  }

  // 3. Antennae: dark blobs whose far end sits above the head.
  for (const b of blobs(px, W, H, DARK)) {
    let tip = -1, best = 0;
    for (const i of b) { const x = i % W, y = (i / W) | 0; const d = Math.hypot(x - ex, y - ey); if (y < ey - 3 && d > best) { best = d; tip = i; } }
    if (tip < 0 || best < 5) continue;
    const tx = tip % W, ty = (tip / W) | 0;
    const near = b.filter(i => Math.hypot(i % W - tx, ((i / W) | 0) - ty) <= 3 && i !== tip);
    if (!near.length) continue;
    let dx = tx - near.reduce((s, i) => s + (i % W), 0) / near.length, dy = ty - near.reduce((s, i) => s + ((i / W) | 0), 0) / near.length;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const sweep = Math.sign(tx - ex) || 1; // curl outward/back
    let x = tx, y = ty;
    for (let s = 1; s <= ANT; s++) {
      dx += sweep * 0.25; dy += 0.12; const m = Math.hypot(dx, dy); dx /= m; dy /= m;
      const nx = Math.round(tx + dx * s), ny = Math.round(ty + dy * s);
      if (nx === x && ny === y) continue;
      if (Math.abs(nx - x) + Math.abs(ny - y) === 2 && !out[y * W + nx]) put(nx, y, C.N); // keep the line 4-connected
      x = nx; y = ny; if (!out[y * W + x] || k(out[y * W + x]) === BLACK) put(x, y, s === ANT ? C.n : C.N);
    }
  }
  return finish(out, W, H);
}

// Cone from (bx, by) along unit (ax, ay), length L, half-width h0 -> h1, black outline, lit from top-left.
// shade(u, v, halfWidth, lit) picks each pixel's colour; behind = only paint empty pixels.
function cone(out, W, H, bx, by, ax, ay, L, h0, h1, shade, behind) {
  const inside = (x, y) => {
    const u = (x - bx) * ax + (y - by) * ay, v = (x - bx) * -ay + (y - by) * ax;
    const w = h0 + (h1 - h0) * (u / L) + 0.45;
    return u >= 0 && u <= L && Math.abs(v) <= w ? { u, v, w } : null;
  };
  const x0 = Math.floor(Math.min(bx, bx + ax * L) - h0 - 2), x1 = Math.ceil(Math.max(bx, bx + ax * L) + h0 + 2);
  const y0 = Math.floor(Math.min(by, by + ay * L) - h0 - 2), y1 = Math.ceil(Math.max(by, by + ay * L) + h0 + 2);
  const lit = ay + ax < 0 ? -1 : 1; // sign of v that faces up-left
  const cells = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = inside(x, y); if (r && x >= 0 && y >= 0 && x < W && y < H) cells.push([x, y, r]); }
  const isIn = new Set(cells.map(([x, y]) => y * W + x));
  const free = i => !behind || !out[i];
  const paint = cells.filter(([x, y]) => free(y * W + x));
  for (const [x, y] of paint) for (const [dx, dy] of N4) {
    const xx = x + dx, yy = y + dy, j = yy * W + xx;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && !isIn.has(j) && free(j)) out[j] = [0, 0, 0];
  }
  for (const [x, y, { u, v, w }] of paint) out[y * W + x] = shade(u, v, w, lit, L);
}

// Silver drill with dark spiral ridges.
function drillShade(u, v, w, lit, L) {
  const ridge = Math.floor(u - v * lit * 0.7 + 0.5);
  let c = v * lit > w * 0.25 ? C.W : v * lit < -w * 0.35 ? C.G : C.S;
  if (ridge % 4 === 0 && u > 1 && u < L - 1.5) c = c === C.W ? C.S : C.D;
  return c;
}
const needleShade = (u, v, w, lit, L) => (u > L - 1.5 ? C.S : v * lit >= 0 ? C.W : C.S);
// 2 px wide silver needle (base nudged half a pixel sideways so it covers two columns, not three).
const needle = (out, W, H, x, y, ax, ay) => cone(out, W, H, x + ay * 0.5, y - ax * 0.5, ax, ay, NEEDLE, 0.6, 0.15, needleShade, false);

function finish(out, W, H) {
  const k = p => p && key(...p);
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(k(out[i])) || out[i];
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) ? null : out[(y + dy) * W + x + dx];
      if (p && k(p) !== BLACK) { fin[y * W + x] = [0, 0, 0]; break; }
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
  let minX = PAD, maxX = PAD + a.fw - 1, minY = PAD, maxY = PAD + a.fh - 1;
  const bw = a.fw + PAD * 2, bh = a.fh + PAD * 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), r, MAX_STING[name]);
    frames.push({ r, c, px });
    for (let i = 0; i < px.length; i++) if (px[i]) {
      const x = i % bw, y = (i / bw) | 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  // Grow only where needed: sides symmetric (centre unchanged), top raises footY, bottom is free. Multiples of 2.
  const padX = Math.ceil(Math.max(0, PAD - minX, maxX - (PAD + a.fw - 1)) / 2) * 2;
  const padT = Math.ceil(Math.max(0, PAD - minY) / 2) * 2, padB = Math.ceil(Math.max(0, maxY - (PAD + a.fh - 1)) / 2) * 2;
  const W = a.fw + padX * 2, H = a.fh + padT + padB, ox = PAD - padX, oy = PAD - padT;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (const { r, c, px } of frames) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = px[(y + oy) * bw + x + ox]; if (!p) continue;
    const o = ((r * H + y) * dst.width + c * W + x) * 4;
    dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + padT };
  made.push(file);
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };
fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(path.join(ROOT, 'assets/sprite', KEY, 'portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const m = all[file.replace('-Anim.png', '')];
    const W = m.fw, H = m.fh;
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    // Base pixel (x, y) sits at (x + padX, y + padT) in the mega frame.
    const padX = (m.fw - a.fw) / 2, padT = m.footY - a.footY;
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
console.log('built', made.join(', '));
console.log(Object.entries(meta).map(([n, m]) => `${n} ${m.fw}x${m.fh} footY ${m.footY}`).join('\n'));
