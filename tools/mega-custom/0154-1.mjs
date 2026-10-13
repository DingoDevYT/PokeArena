// Builds a custom PMD-style Mega Meganium (0154-1) from the base Meganium sheets (SpriteCollab sprite/0154).
// Output: assets/sprite-custom/0154-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0154-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Meganium (Legends Z-A): the neck flower becomes a stack of four big flowers (red on top, then dark
// pink, light pink, white at the bottom), only the head pokes out; feet get dark green leafy frills.
// Per frame: the neck flower is found by colour, kept as the pink layer, grown by a scalloped light-pink
// and white rim, and a new red flower is drawn on its upper half; the head (found from the yellow
// antennae) is then restored on top. All colours from the mega portrait (light pink lifted one step).
import { run, hx, BLACK, N4, comps, stats, get, set, inside, closeOutline, remap, clone } from '../.cache/mega-base/_lib.mjs';

const PET = { L: hx('ff875f'), M: hx('d73f00'), D: hx('9f0000'), W: hx('ffffff') };
const PETALS = new Set(Object.values(PET));
const YEL = new Set(['fff700', 'dfb700', 'a76f00'].map(hx));
const GREEN = new Set(['d7efa7', '9fcf6f', '5fb727'].map(hx));
const C = {
  red: hx('d65160'), redD: hx('a7484e'), pink: hx('db77a2'), pinkD: hx('b65a7e'), lpink: hx('f2b9d0'),
  white: hx('ffffff'), whiteD: hx('e2d6dc'), frill: hx('3f7f3a'), frillL: hx('5fa04a'),
};
// Stack layers bottom to top: [position from old flower (0) to head (1), x and y radius vs the old flower, colours].
const LAYERS = [
  [-0.08, 1.36, 1.2, { M: C.white, D: C.whiteD, S: C.white }],
  [0.12, 1.24, 1.0, { M: C.lpink, D: C.pink, S: C.lpink }],
  [0.32, 1.12, 0.85, { M: C.pink, D: C.pinkD, S: C.pink }],
  [0.55, 1.0, 0.75, { M: C.red, D: C.redD, S: C.pink }],
];
const FLOWERCOLS = new Set(Object.values(C));
// Body remap toward the portrait greens and golds.
const REMAP = new Map([['d7efa7', 'caff8f'], ['9fcf6f', 'a9e678'], ['5fb727', '85b964'], ['fff700', 'e1d12d'], ['dfb700', 'daa316']].map(([a, b]) => [hx(a), hx(b)]));

// Scalloped flower (6 pointed petals) centred at (cx, cy), radii rx, ry. Returns Map "x,y" -> colour.
function flower(cx, cy, rx, ry, cols, rot = 0) {
  const out = new Map();
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, r = Math.hypot(u, v);
    const a = Math.atan2(v, u) + rot, t = ((a / (Math.PI * 2 / 6)) % 1 + 1) % 1; // 0..1 across a petal
    const edge = 1 - 0.34 * Math.abs(t - 0.5) * 2;                                  // pointed petal tips
    if (r > edge) continue;
    let c = cols.M;
    if (v > 0.25 && r > edge - 0.22) c = cols.D;                                  // shaded lip along the lower scallops
    else if (v < -0.2 && r > edge - 0.2 && Math.abs(t - 0.5) < 0.2) c = cols.S;  // light tips on the upper petals
    out.set(x + ',' + y, c);
  }
  return out;
}
function drawShape(f, m, protect) {
  for (const [p, c] of m) {
    const [x, y] = p.split(',').map(Number);
    if (!inside(f, x, y) || protect(x, y)) continue;
    set(f, x, y, c);
  }
  for (const p of m.keys()) { // own outline
    const [x, y] = p.split(',').map(Number);
    for (const [dx, dy] of N4) if (!m.has((x + dx) + ',' + (y + dy)) && inside(f, x + dx, y + dy) && !protect(x + dx, y + dy)) set(f, x + dx, y + dy, BLACK);
  }
}

function mega(f, dir) {
  const orig = clone(f);
  const W = f.W;
  // Flower = biggest blob of petal colours; antennae = yellow blobs not touching it.
  const blobs = comps(f, c => PETALS.has(c)).sort((a, b) => b.length - a.length);
  const fl = blobs[0];
  const yel = comps(f, c => YEL.has(c));
  const touchesFlower = b => b.some(i => N4.some(([dx, dy]) => PETALS.has(get(f, i % W + dx, ((i / W) | 0) + dy))));
  const ant = yel.filter(b => !touchesFlower(b)).flat();
  if (fl && fl.length >= 12) {
    const s = stats(f, fl);
    const inFl = new Uint8Array(f.px.length); fl.forEach(i => (inFl[i] = 1));
    // Head: ellipse below the antenna centroid. Protected from the new flowers.
    let hcx = s.cx, hcy = s.y0 - 6;
    if (ant.length >= 3) { // 5px from the antennae toward the flower
      const a = stats(f, ant), L = Math.hypot(s.cx - a.cx, s.cy - a.cy) || 1;
      hcx = a.cx + (s.cx - a.cx) / L * 5; hcy = a.cy + (s.cy - a.cy) / L * 5;
    }
    const headR = Math.max(4, Math.min(6, (s.x1 - s.x0) * 0.28));
    const isHead = (x, y) => {
      const c = get(orig, x, y);
      if (c < 0 || PETALS.has(c) || inFl[y * W + x]) return false;
      return Math.hypot((x - hcx) / headR, (y - hcy) / (headR * 1.05)) < 1;
    };
    // 1. Old flower -> pink (it ends up mostly covered), stamens -> pink seams.
    for (const i of fl) f.px[i] = { [PET.L]: C.lpink, [PET.M]: C.pink, [PET.D]: C.pinkD, [PET.W]: C.white }[f.px[i]];
    for (const b of yel) if (touchesFlower(b)) for (const i of b) f.px[i] = C.pinkD;
    // 2. Four scalloped flowers stacked from the old flower up the neck to the head, drawn bottom (white) to top (red).
    const hw = (s.x1 - s.x0 + 1) / 2, hh = (s.y1 - s.y0 + 1) / 2;
    LAYERS.forEach(([t, kx, ky, cols], n) => {
      const cx = s.cx + (hcx - s.cx) * t, cy = s.cy + (hcy - s.cy) * t;
      drawShape(f, flower(cx, cy, Math.max(4, hw * kx), Math.max(3, hh * ky), cols, n * 0.5 + dir * 0.3), isHead);
    });
    // 4. Restore the head (and its outline) over everything.
    for (let y = 0; y < f.H; y++) for (let x = 0; x < W; x++) if (isHead(x, y)) set(f, x, y, get(orig, x, y));
    // Black line where the restored head meets the top flower.
    const edge = [];
    for (let y = 0; y < f.H; y++) for (let x = 0; x < W; x++) if (!isHead(x, y) && FLOWERCOLS.has(get(f, x, y)) && N4.some(([dx, dy]) => isHead(x + dx, y + dy) && get(f, x + dx, y + dy) !== BLACK)) edge.push([x, y]);
    for (const [x, y] of edge) set(f, x, y, BLACK);
  }
  // 5. Dark green leafy frills on the bottom of the legs: green pixels in the lowest 3 rows of each foot column.
  let maxY = -1;
  for (let i = 0; i < f.px.length; i++) if (GREEN.has(f.px[i])) maxY = Math.max(maxY, (i / W) | 0);
  if (maxY > 0) for (let y = maxY - 3; y <= maxY; y++) for (let x = 0; x < W; x++) {
    const c = get(f, x, y); if (!GREEN.has(c)) continue;
    if (y === maxY - 3 && x % 2) continue; // jagged top edge
    set(f, x, y, y >= maxY - 1 ? C.frill : C.frillL);
  }
  remap(f, REMAP);
  closeOutline(f);
}

const SPIN = new Set(['Rotate', 'Swing']);
await run({
  key: '0154-1', dex: '0154', megaForm: '0001', mega,
  facing: (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r,
});
