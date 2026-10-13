// Builds a custom PMD-style Mega Mewtwo X (0150-1) from the base Mewtwo sheets.
// Output: assets/sprite-custom/0150-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0150-1.mjs [Walk Idle ...]   (no args = every sheet)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const require = createRequire(import.meta.url);
global.window = {};
require(path.join(ROOT, 'data/sprites.js'));
const BASE = '0150', OUT = path.join(ROOT, 'assets/sprite-custom/0150-1');
const PAD = 8;          // working margin; trimmed back to what the new shape actually needs
const HORN = 2;         // rows the horns grow upward
const MATCH = 0.65;     // head template score needed to place the head/collar patches...
const SURE = 0.8;       // ...above this it is trusted outright,
const SUPPORT = 0.85;   // below it, this share of the collar must land on the body (and eyes must line up)

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const BLACK = 0;
const GREY = new Set(['ffffff', 'd7dfdf', '979fa7', '47676f'].map(K));
const PURP = new Set(['d797df', 'af6fb7', '873f87'].map(K));
const MEW = new Set([BLACK, ...GREY, ...PURP]);
const classOf = c => c === BLACK ? 1 : GREY.has(c) ? 2 : PURP.has(c) ? 3 : 4;
const EYE_SRC = K('873f87');
const EYE = hex('79bdc6');  // Mega X blue eye (portrait)

// Base Mewtwo palette -> Mega Mewtwo X portrait palette (assets/sprite/0150-1/portrait.png).
const REMAP = new Map([
  ['ffffff', 'f7efff'], ['d7dfdf', 'c7bfd7'], ['979fa7', '7f8797'], ['47676f', '4f575f'], // skin
  ['d797df', 'd3a6bc'], ['af6fb7', 'b886a0'], ['873f87', '906576'], // mauve (light = portrait b886a0 lifted a step)
].map(([a, b]) => [K(a), hex(b)]));
// Patch colours, in the BASE palette so the remap handles them.
const C = { '#': [0, 0, 0], L: hex('d797df'), M: hex('af6fb7'), D: hex('873f87'), W: hex('ffffff'), l: hex('d7dfdf'), m: hex('979fa7'), d: hex('47676f') };

// Head templates: the skull (ear tips down to above the eyes) in Idle frame 0, per facing 0..4
// (Down, DownRight, Right, UpRight, Up). 5..7 are mirrors. Rect = [x, y, w, h] in the 32x64 Idle frame.
const IDLE_W = 32;
const RECT = [[9, 10, 13, 8], [9, 8, 13, 9], [9, 9, 13, 8], [11, 9, 11, 10], [9, 10, 13, 8]];
// Hand-drawn patches in Idle frame-0 coordinates, per facing 0..4. '.' keeps the pixel.
const PATCH = [
  [ // Down: the mauve tube rides over both shoulders beside the jaw
    { x: 6, y: 18, rows: ['.####.', '#LLLM#', '#LLMD#', '#MMDD#', '.#MD#.', '..##..'] },
    { x: 20, y: 18, rows: ['.####.', '#MLLL#', '#DMLL#', '#DDMM#', '.#DM#.', '..##..'] },
  ],
  [ // DownRight
    { x: 8, y: 19, rows: ['.####.', '#LLLM#', '#LLMD#', '#MMDD#', '.#MD#.', '..##..'] },
    { x: 20, y: 20, rows: ['.###.', '#MLL#', '#DML#', '.#D#.', '..#..'] },
  ],
  [ // Right: one thick band from behind the neck, over the shoulder, to the chest
    { x: 8, y: 19, rows: ['.##.....', '#LL#....', '#LMM###.', '#MLLLMM#', '.#DMMMD#', '..##DD#.', '....##..'] },
  ],
  [ // UpRight: hump across the upper back
    { x: 9, y: 19, rows: ['.......####..', '...####LLLL#.', '.##LLLLMMMMD#', '#LLMMMMDDDD#.', '#LMMD#####...', '#MMD#........', '.#D#.........', '..#..........'] },
  ],
  [ // Up: hump across the upper back, dipping over the shoulders
    { x: 7, y: 19, rows: ['....##########....', '..##LLLLLLLLLL##..', '.#LLLMMMMMMMMLLL#.', '#LLMMMDDDDDDMMMLL#', '#LMMD########DMML#', '#MMD#........#DMM#', '.#D#..........#D#.', '..#............#..'] },
  ],
];
const mirrorPatch = ps => ps.map(p => ({ ...p, x: IDLE_W - p.x - p.rows[0].length, rows: p.rows.map(r => [...r].reverse().join('')) }));
const mirrorRect = r => [IDLE_W - r[0] - r[2], r[1], r[2], r[3]];
for (const [a, b] of [[3, 5], [2, 6], [1, 7]]) { PATCH[b] = mirrorPatch(PATCH[a]); RECT[b] = mirrorRect(RECT[a]); }

// Lone dark-purple pixels (not touching the tail or belly purple) are the eyes.
function loneEyes({ W, H, px }) {
  const k = p => p && key(...p), res = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (k(px[y * W + x]) !== EYE_SRC) continue;
    if (!N4.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && PURP.has(k(px[yy * W + xx])); })) res.push(y * W + x);
  }
  return res;
}
const read = p => PNG.sync.read(fs.readFileSync(p));
function frameOf(png, fx, fy, fw, fh, pad) {
  const W = fw + pad * 2, H = fh + pad * 2;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + pad) * W + x + pad] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

// Templates cut from the base Idle sheet, frame 0 of each row.
const TEMPL = (() => {
  const a = window.SPRITES[BASE].anims.Idle, png = read(path.join(ROOT, a.file));
  return RECT.map(([rx, ry, w, h], f) => {
    const cls = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((f * a.fh + ry + y) * png.width + rx + x) * 4;
      cls.push(png.data[i + 3] ? classOf(key(png.data[i], png.data[i + 1], png.data[i + 2])) : 0);
    }
    // Eyes (lone dark-purple pixels) below the skull, relative to the rect.
    const fr = frameOf(png, 0, f * a.fh, a.fw, a.fh, 0);
    const eyes = loneEyes(fr).map(i => [i % fr.W - rx, ((i / fr.W) | 0) - ry]).filter(([x, y]) => y >= 0 && y < h + 6);
    const collar = PATCH[f].flatMap(p => p.rows.flatMap((row, py) => [...row].flatMap((c, pxi) => 'LMD'.includes(c) ? [[p.x + pxi - rx, p.y + py - ry]] : [])));
    return { cls, n: cls.filter(Boolean).length, rx, ry, w, h, top: Math.floor(cls.findIndex(Boolean) / w), eyes, collar };
  });
})();

// Shape match, tolerant of PMD's frame-to-frame shading changes: compares colour classes
// (empty / outline / skin / mauve), scored as overlap over union of the opaque pixels.
function findHead(f, dir) {
  const { W, H, px } = f;
  const cl = px.map(p => p ? classOf(key(...p)) : 0);
  const eye = new Uint8Array(W * H); loneEyes(f).forEach(i => (eye[i] = 1));
  const eyeNear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && eye[yy * W + xx]) return true; } return false; };
  let best = null;
  for (let t = 0; t < 8; t++) {
    const T = TEMPL[t];
    for (let oy = -2; oy < H - T.h + 2; oy++) for (let ox = -2; ox < W - T.w + 2; ox++) {
      let hit = 0, extra = 0;
      for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
        const xx = ox + x, yy = oy + y, c = (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : cl[yy * W + xx], tc = T.cls[y * T.w + x];
        if (tc) { if (c === tc) hit++; } else if (c) extra++;
      }
      const s = hit / (T.n + extra) + (t === dir ? 0.03 : 0);
      if (s < MATCH || (best && s <= best.s)) continue;
      // Weaker matches must be confirmed: the collar has to land on the body (not beside a lying or
      // bent-over Mewtwo), and an eye has to sit where the template has one.
      if (s < SURE) {
        const on = T.collar.filter(([x, y]) => { const xx = ox + x, yy = oy + y; return xx >= 0 && yy >= 0 && xx < W && yy < H && cl[yy * W + xx] && cl[yy * W + xx] < 4; }).length;
        if (on < SUPPORT * T.collar.length) continue;
        if (T.eyes.length && !T.eyes.some(([x, y]) => eyeNear(ox + x, oy + y))) continue;
      }
      best = { s, t, ox, oy };
    }
  }
  return best; // template t's rect top-left sits at (ox, oy)
}

// Grow a colour region one pixel outward: its outline pixel takes the neighbour's colour and the
// outline moves out, but only where there is open space beyond (keeps 1-2px gaps between limbs).
function grow(W, H, out, set, minY) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : out[y * W + x];
  const k = p => p && key(...p);
  const res = out.slice();
  for (let y = Math.max(0, minY); y < H; y++) for (let x = 0; x < W; x++) {
    if (k(out[y * W + x]) !== BLACK || !out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const src = at(x - dx, y - dy);
      if (!src || !set.has(k(src))) continue;
      if (at(x + dx, y + dy) || at(x + 2 * dx, y + 2 * dy)) continue;
      res[y * W + x] = src; break;
    }
  }
  return res;
}

function megaFrame(f, dir) {
  const { W, H, px } = f;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : px[y * W + x];
  const k = p => p && key(...p);
  let out = px.slice();
  const head = findHead(f, dir); if (!head) MISSED++;
  // Fallback head line when the skull is not recognised: the top of the body.
  let headBottom;
  if (head) headBottom = head.oy - TEMPL[head.t].ry + 22;  // jaw line is row 22 in the Idle frame
  else { let top = H; for (let i = 0; i < W * H; i++) if (px[i] && MEW.has(k(px[i]))) { top = (i / W) | 0; break; } headBottom = top + 12; }

  // 1. Eyes: lone dark-purple pixels (not part of the tail or belly) turn blue.
  const eyes = loneEyes(f);
  // 2. Thicker tail, bulkier limbs (everything below the head).
  out = grow(W, H, out, PURP, 0);
  out = grow(W, H, out, GREY, headBottom);
  // 3. Horns: the ear tips grow upward.
  if (head) {
    const T = TEMPL[head.t], x0 = Math.max(0, head.ox), x1 = Math.min(W - 1, head.ox + T.w - 1);
    // Actual tip row near where the template puts it; only narrow runs (ears) are stretched,
    // so a flat-topped head (e.g. thrown back in Hurt) is left alone.
    let top = -1;
    for (let y = Math.max(0, head.oy + T.top - 2); y <= head.oy + T.top + 2 && top < 0; y++)
      for (let x = x0; x <= x1; x++) if (out[y * W + x]) { top = y; break; }
    const narrow = new Uint8Array(W);
    if (top >= 0) for (let x = x0; x <= x1;) {
      if (!out[(top + 1) * W + x]) { x++; continue; }
      let e = x; while (e + 1 <= x1 && out[(top + 1) * W + e + 1]) e++;
      if (e - x + 1 <= 5) for (let i = x; i <= e; i++) narrow[i] = 1;
      x = e + 1;
    }
    const res = out.slice();
    for (let x = x0; x <= x1 && top >= 0; x++) {
      const tip0 = out[top * W + x], tip1 = out[(top + 1) * W + x];
      if (!narrow[x] || (!tip0 && !tip1)) continue;
      const put = (y, p) => { if (p && y >= 0 && !res[y * W + x]) res[y * W + x] = p; };
      put(top - HORN, tip0); put(top - HORN + 1, tip1);
      for (let y = top - HORN + 2; y <= top + 1; y++) if (tip1) res[y * W + x] = tip1;
    }
    out = res;
    // 4. Collar / shoulder tube.
    const dx = head.ox - T.rx, dy = head.oy - T.ry;
    for (const p of PATCH[head.t]) p.rows.forEach((row, py) => [...row].forEach((c, pxi) => {
      const x = p.x + pxi + dx, y = p.y + py + dy;
      if (c !== '.' && x >= 0 && y >= 0 && x < W && y < H) out[y * W + x] = C[c];
    }));
  }
  for (const i of eyes) if (k(out[i]) === EYE_SRC) out[i] = EYE;
  // 5. Palette remap, then close any open edge with a black outline.
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(k(out[i])) || out[i];
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x]) continue;
    for (const [dx, dy] of N4) {
      const p = (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) ? null : out[(y + dy) * W + x + dx];
      if (p && k(p) !== BLACK && MEW_OUT.has(k(p))) { fin[y * W + x] = C['#']; break; }
    }
  }
  return fin;
}
// Only Mewtwo's own (remapped) colours get an outline, not effects like the blue psychic orb.
const MEW_OUT = new Set([...REMAP.values()].map(c => key(...c)).concat([key(...EYE)]));

let MISSED = 0; // frames where the head was not recognised (no horns/collar)
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
  const src = read(path.join(ROOT, 'assets/sprite', BASE, file));
  const cols = src.width / a.fw, rows = src.height / a.fh;
  const frames = [];
  let x0 = PAD, y0 = PAD, x1 = PAD + a.fw - 1, y1 = PAD + a.fh - 1; // union bbox in padded coords
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const f = frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh, PAD);
    const px = megaFrame(f, r);
    for (let i = 0; i < px.length; i++) if (px[i]) {
      const x = i % f.W, y = (i / f.W) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    frames.push({ r, c, px, W: f.W });
  }
  // Grow the frame only as much as needed: x symmetrically (keeps the centre), y on top/bottom; round to even.
  const padX = Math.max(PAD - x0, x1 - (PAD + a.fw - 1), 0), padT = Math.max(PAD - y0, 0);
  const padB = Math.max(y1 - (PAD + a.fh - 1), 0);
  const W = a.fw + padX * 2, H = a.fh + padT + padB;
  const dst = new PNG({ width: cols * W, height: rows * H });
  for (const { r, c, px, W: FW } of frames) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = px[(y + PAD - padT) * FW + x + PAD - padX]; if (!p) continue;
      const o = ((r * H + y) * dst.width + c * W + x) * 4;
      dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(dst));
  meta[name] = { fw: W, fh: H, footY: a.footY + padT };
  made.push(name + (MISSED ? ` (${MISSED}/${rows * cols} frames without head patch)` : '')); MISSED = 0;
}
const metaFile = path.join(OUT, '_anims.json');
const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const all = { ...old, ...meta };
fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in file-name order.
{
  const S = 4, GAP = 3, PER = 2;
  const portrait = read(path.join(ROOT, 'assets/sprite/0150-1/portrait.png'));
  const done = sheets.filter(f => fs.existsSync(path.join(OUT, f)) && all[f.replace('-Anim.png', '')]).map(file => {
    const a = Object.values(anims).find(v => v.file.endsWith('/' + file));
    const m = all[file.replace('-Anim.png', '')], W = m.fw, H = m.fh, padX = (m.fw - a.fw) / 2, padT = m.footY - a.footY;
    const base = read(path.join(ROOT, 'assets/sprite', BASE, file)), mega = read(path.join(OUT, file));
    const rows = Math.round(base.height / a.fh);
    // Both frames in mega coordinates: base pixel (x, y) sits at (x + padX, y + padT).
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
console.log('built\n' + made.join('\n'));
