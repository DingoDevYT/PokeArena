// Builds a custom PMD-style Mega Blastoise (0009-1) from the base Blastoise sheets.
// Output: assets/sprite-custom/0009-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0009-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Per frame: find the shell top (anchor), turn the shoulder cannons into shell shoulder pads,
// mount one big cannon on the shell (a small 3D cylinder model projected with the PMD camera for
// each of the 8 facings, quantised to the sprite palette, then outlined) and add a small cannon
// on each forearm. Everything is anchored to points tracked by colour, so motion stays consistent.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0009', OUT = path.join(ROOT, 'assets/sprite-custom/0009-1');

// Frame grows 8px wide (4 each side, centre unchanged) and 12px tall on top only (room for the cannon), so footY += 12.
const PAD_X = 4, PAD_T = 12;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
// Base Blastoise sprite palette, by letter.
const P = {
  '#': hex('000000'), b: hex('373f8f'), m: hex('4f5f97'), l: hex('6787af'),
  D: hex('773f00'), B: hex('af671f'), g: hex('b7bfc7'), W: hex('ffffff'), Y: hex('ffe79f'), y: hex('dfaf67'),
};
const BLACK = 0, WHITE = K('ffffff'), GREY = K('b7bfc7');
const SKIN = new Set(['373f8f', '4f5f97', '6787af'].map(K));
const BROWN = new Set(['773f00', 'af671f'].map(K));
const BELLY = new Set(['ffe79f', 'dfaf67'].map(K));
// Base -> Mega portrait (assets/sprite/0009-1/portrait.png): the mega skin is a lighter, cleaner blue.
const REMAP = new Map([['6787af', '6f97d7'], ['4f5f97', '576fa7']].map(([a, b]) => [K(a), hex(b)]));

// ---- Big cannon: per facing, a stack of 2D parts in screen pixels relative to the shell-top anchor,
// painted far to near. Each part is outlined on its own, so overlaps get a black seam.
//  seg:  cylinder seen side-on, axis a->b, half-width r, rounded ends (end = depth of the rounding).
//        Shaded in bands across the axis: upper-left edge white, then grey, blue-grey, dark.
//  face: an end seen face-on, ellipse (c, rx, ry). hole = bore (rx, ry) for the muzzle, boss = rear cap ring.
const CANNON = [
  // Down: muzzle points at the viewer, just above the head; barrel recedes upward behind it.
  [{ seg: [[0, -9], [0, -3]], r: 4.6, end: 1.5, seam: 0.4 },
   { face: [0, -1], rx: 6, ry: 5, hole: [3.4, 2.5] }],
  // DownRight: barrel runs right and a little down, muzzle opening turned toward the viewer.
  [{ seg: [[-7, -8], [-3, -7]], r: 6, end: 2 },
   { seg: [[-4, -7.5], [9, -4.5]], r: 4.6, seam: 0.45 },
   { seg: [[8, -4.7], [10, -4.2]], r: 5.2, end: 1 },
   { face: [10.6, -4], rx: 3.2, ry: 5.2, hole: [1.7, 3.3] }],
  // Right: barrel level above the head, opening seen edge-on at the tip.
  [{ seg: [[-7, -7.5], [-3, -7.5]], r: 6, end: 2 },
   { seg: [[-4, -7.5], [13, -7.5]], r: 4.6, seam: 0.45 },
   { seg: [[13, -7.5], [15, -7.5]], r: 5.2, end: 1 },
   { face: [15.6, -7.5], rx: 1.6, ry: 5.2, hole: [0.7, 3.4] }],
  // UpRight: barrel runs away up-right; the rounded rear housing is nearest the viewer.
  [{ seg: [[12, -16], [10, -15]], r: 5.2, end: 1 },
   { seg: [[11, -15.5], [0, -9]], r: 4.6, seam: 0.5 },
   { seg: [[2, -9.5], [-2, -7]], r: 6, end: 2 }],
  // Up: barrel runs away over the head; we see the round rear cap.
  [{ seg: [[0, -11], [0, -9]], r: 5.2, end: 1 },
   { seg: [[0, -10], [0, -3]], r: 4.8, seam: 0.5 },
   { seg: [[0, -5], [0, -1]], r: 6.5, end: 1 },
   { face: [0, 0], rx: 6.5, ry: 4.5, tone: 0.45, boss: true }],
];
// Shade letter for a position across a part: t in [-1, 1], -1 = lit upper-left edge.
const band = t => t < -0.55 ? 'W' : t < 0.2 ? 'g' : t < 0.65 ? 'l' : 'm';
const darker = { W: 'g', g: 'l', l: 'm', m: 'm' };

// Rasterise one facing (right-side set; left facings are mirrored) into a list of {x, y, code}.
function cannonSprite(parts, mirror) {
  const grid = new Map(), R = 20;
  for (const p of parts) {
    const mask = new Map();
    for (let y = -R - 10; y <= R; y++) for (let x = -R; x <= R; x++) {
      let code = null;
      if (p.seg) {
        const [[ax, ay], [bx, by]] = p.seg, L = Math.hypot(bx - ax, by - ay);
        const dx = (bx - ax) / L, dy = (by - ay) / L;
        let nx = -dy, ny = dx; if (nx + ny < 0) { nx = -nx; ny = -ny; } // normal toward lower right
        const t = (x - ax) * dx + (y - ay) * dy, s = ((x - ax) * nx + (y - ay) * ny) / p.r, e = p.end || 1;
        const over = t < 0 ? -t / e : t > L ? (t - L) / e : 0;
        if (over * over + s ** 4 > 1.0001) continue; // flat-ish rounded end
        code = band(s);
        if (p.seam && Math.abs(t - p.seam * L) < 0.5) code = darker[code];
      } else {
        const [cx, cy] = p.face, ca = Math.cos((p.rot || 0) * Math.PI / 180), sa = Math.sin((p.rot || 0) * Math.PI / 180);
        const ux = ((x - cx) * ca + (y - cy) * sa) / p.rx, uy = (-(x - cx) * sa + (y - cy) * ca) / p.ry;
        if (ux * ux + uy * uy > 1.0001) continue;
        code = band((ux + uy) * 0.75 + (p.tone || 0));
        if (p.hole) {
          const hx = ux * p.rx / p.hole[0], hy = uy * p.ry / p.hole[1];
          if (hx * hx + hy * hy <= 1.0001) code = hy > 0.3 && hx * hx + hy * hy > 0.35 ? 'b' : '#';
        }
        if (p.boss) {
          const q = ux * ux + uy * uy;
          if (q > 0.2 && q < 0.42) code = '#';
          else if (q <= 0.2) code = band((ux + uy) * 1.5 + (p.tone || 0));
        }
      }
      mask.set(y * 100 + x, { x: mirror ? -x : x, y, code });
    }
    for (const [k, v] of mask) {
      const edge = [1, -1, 100, -100].some(d => !mask.has(k + d));
      grid.set(v.y * 100 + v.x, { ...v, code: edge ? '#' : v.code });
    }
  }
  return [...grid.values()];
}
// Forearm cannon patches (right-facing set), 'at' = the patch pixel placed on the hand point + off.
// mirrorBySide: front views, where each arm gets the patch mirrored to its own side.
const RING = ['#####', '#Wgl#', '#gml#', '#W#l#', '.###.'];   // a short tube hanging on the arm, muzzle down-front
const TUBE = ['#####.', '#WWgg#', '#gllb#', '#####.'];        // a short tube along the arm, muzzle at the right
const FOREARM = [
  { rows: RING, at: [2, 2], off: [3, -2], mirrorBySide: true },   // Down (off x = outward from the body)
  { rows: RING, at: [2, 2], off: [3, -2], mirrorBySide: true },   // DownRight
  { rows: TUBE, at: [5, 2], off: [-1, -3] },                      // Right
  { rows: TUBE, at: [5, 2], off: [-1, -3] },                      // UpRight
  null,                                                           // Up: hidden behind the shell
];
let clipped = 0;
const SPRITES = [0, 1, 2, 3, 4, 3, 2, 1].map((d, i) => cannonSprite(CANNON[d], i > 4));

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
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : px[y * W + x];
  const out = px.slice();
  let skin = 0, brown = 0;
  for (const p of px) { if (SKIN.has(k(p))) skin++; if (BROWN.has(k(p))) brown++; }
  const shellOnly = skin < 30;

  // 1. Anchor = top of the shell: brown pixels not part of the belly (belly shading also uses af671f).
  const belly = new Uint8Array(W * H);
  for (const blob of components(W, H, i => BELLY.has(k(px[i])) || k(px[i]) === K('af671f')))
    if (blob.some(i => BELLY.has(k(px[i])))) blob.forEach(i => (belly[i] = 1));
  const shell = components(W, H, i => BROWN.has(k(px[i])) && !belly[i]).filter(b => b.length >= 4).flat();
  let anchor = null;
  if (shell.length) {
    const top = Math.min(...shell.map(i => (i / W) | 0));
    const row = shell.filter(i => ((i / W) | 0) <= top + 1);
    anchor = [Math.round(row.reduce((s, i) => s + (i % W), 0) / row.length), top];
  }

  // 2. Raised shoulder cannons (muzzle ring '#W#' over 'W#W' pointing up) -> shell shoulder pads:
  //    the muzzle is shaved flat and the cannon grey below it becomes shell brown (white stays as rim).
  //    Lowered cannons (Idle, Shoot...) sit right on the forearms, so they are kept as the forearm cannons.
  const muzzles = [];
  if (!shellOnly) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const c = (dx, dy) => k(at(x + dx, y + dy));
    if (c(0, 0) === WHITE && c(0, 1) === BLACK && c(-1, 1) === WHITE && c(1, 1) === WHITE && c(-1, 0) === BLACK && c(1, 0) === BLACK) muzzles.push([x, y]);
  }
  // Side views show rim zigzags that match the pattern lower down: a real muzzle has nothing above it.
  const raised = muzzles.filter(([x, y]) => !muzzles.some(([x2, y2]) => Math.abs(x2 - x) <= 3 && y2 < y));
  for (const [mx, my] of raised) {
    for (let y = my + 1; y <= my + 9; y++) for (let x = mx - 3; x <= mx + 3; x++)
      if (k(at(x, y)) === GREY) out[y * W + x] = P.B;
    for (let dx = -1; dx <= 1; dx++) { out[(my - 1) * W + mx + dx] = null; out[my * W + mx + dx] = null; out[(my + 1) * W + mx + dx] = P.B; }
  }

  const stamp = (rows, ox, oy, mirror) => rows.forEach((row, py) => [...row].forEach((c, pxi) => {
    if (c === '.') return; const x = ox + (mirror ? row.length - 1 - pxi : pxi), y = oy + py;
    if (x >= 0 && y >= 0 && x < W && y < H) out[y * W + x] = P[c];
  }));

  // 3. Forearm cannons, anchored to the hand claws (small cream blobs above the feet).
  if (!shellOnly && anchor && raised.length) {
    let bottom = 0; for (let i = 0; i < W * H; i++) if (px[i]) bottom = Math.max(bottom, (i / W) | 0);
    const claws = components(W, H, i => BELLY.has(k(px[i])) || k(px[i]) === K('af671f'))
      .filter(b => b.length <= 4 && b.some(i => BELLY.has(k(px[i]))) && b.every(i => ((i / W) | 0) < bottom - 3));
    // Cluster claw blobs into hands (blobs within 3px belong to the same hand).
    const hands = [];
    for (const b of claws) {
      const cx = b.reduce((s, i) => s + (i % W), 0) / b.length, cy = b.reduce((s, i) => s + ((i / W) | 0), 0) / b.length;
      const h = hands.find(h => Math.abs(h.x - cx) <= 3 && Math.abs(h.y - cy) <= 3);
      if (h) { h.x = (h.x * h.n + cx) / (h.n + 1); h.y = (h.y * h.n + cy) / (h.n + 1); h.n++; } else hands.push({ x: cx, y: cy, n: 1 });
    }
    const mir = dir > 4, f = FOREARM[mir ? 8 - dir : dir];
    if (f) for (const h of hands.slice(0, 2)) {
      const side = h.x < anchor[0] ? -1 : 1;                 // which side of the body this hand is on
      const sx = f.mirrorBySide ? side : (mir ? -1 : 1);     // patch orientation
      const dx = f.mirrorBySide ? side * f.off[0] : (mir ? -f.off[0] : f.off[0]);
      const w = f.rows[0].length;
      stamp(f.rows, Math.round(h.x + dx - (sx < 0 ? w - 1 - f.at[0] : f.at[0])), Math.round(h.y + f.off[1] - f.at[1]), sx < 0);
    }
  }

  // 4. The big cannon.
  if (anchor && !shellOnly) {
    for (const p of SPRITES[dir]) {
      const x = anchor[0] + p.x, y = anchor[1] + p.y;
      if (x < 0 || y < 0 || x >= W || y >= H) { clipped++; continue; }
      out[y * W + x] = P[p.code];
    }
  }

  // 5. Palette remap, then close any open edge with a black outline.
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(k(out[i])) || out[i];
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) ? null : out[(y + dy) * W + x + dx];
      if (p && k(p) !== BLACK) { fin[y * W + x] = P['#']; break; }
    }
  }
  return fin;
}

const sheets = fs.readdirSync(path.join(ROOT, 'assets/sprite', BASE)).filter(f => f.endsWith('-Anim.png'));
const want = process.argv.slice(2);
const SPIN = new Set(['Rotate', 'Swing']);
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
  const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    // Rotate and Swing spin through every facing: column c of row r faces (r - c) mod 8.
    // Sleep has a single row and lies facing down-left.
    const facing = SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : name === 'Sleep' ? 7 : r;
    const px = megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), facing);
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
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
fs.writeFileSync(metaFile, JSON.stringify({ ...old, ...meta }, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = read(path.join(ROOT, 'assets/sprite/0009-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f))).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const W = a.fw + PAD_X * 2, H = a.fh + PAD_T;
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
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
console.log('built', made.join(', '));
if (clipped) console.warn('WARNING: cannon pixels clipped at the frame edge:', clipped);
