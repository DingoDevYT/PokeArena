// Builds a custom PMD-style Mega Feraligatr (0160-1) from the base Feraligatr sheets (SpriteCollab sprite/0160).
// Output: assets/sprite-custom/0160-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0160-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Feraligatr (Legends Z-A): the back spines fan out into a huge crimson hood-like fin that rises
// behind the head; red cuffs with spikes on the forearms; muted blues and crimson reds from the portrait.
// Per frame: the anchor is the top of the red spines (tracked by colour); the hood is a spiky fan
// shape drawn per facing (behind the body when it faces us, over the back when it faces away), and
// the cuffs are painted just above the hand claws (small white blobs above the feet).
import { run, hx, BLACK, N4, comps, stats, get, set, inside, closeOutline, remap, outer } from '../.cache/mega-base/_lib.mjs';

const RED = new Set(['9f0000', 'd73f00'].map(hx));
const BLUE = new Set(['0067b7', '1f9fe7', '8fdfff'].map(hx));
const CLAW = hx('ffffff');
const C = { M: hx('c24359'), D: hx('89273d'), R: hx('ad3040'), L: hx('ef579f') };
const REMAP = new Map([
  ['8fdfff', '78c9e2'], ['1f9fe7', '5ba4d1'], ['0067b7', '4c8bb0'],   // blues
  ['d73f00', 'c24359'], ['9f0000', '89273d'],                         // spines
  ['ffe79f', 'e1f0b8'], ['dfaf67', 'b0a060'], ['ff87bf', 'ef579f'],                         // belly / jaw
].map(([a, b]) => [hx(a), hx(b)]));

// Hood per facing 0..4 (5..7 mirror 3..1): centre offset from the spine anchor, radii, tilt (radians,
// positive leans the top toward +x), front = drawn over the body (facing away).
const HOOD = [
  { dx: 0, dy: 3, rx: 12, ry: 12, tilt: 0, front: false },
  { dx: -4, dy: 4, rx: 11, ry: 12, tilt: -0.25, front: false },
  { dx: -6, dy: 5, rx: 9, ry: 13, tilt: -0.45, front: false },
  { dx: -4, dy: 4, rx: 11, ry: 12, tilt: -0.3, front: false },
  { dx: 0, dy: 5, rx: 12, ry: 12, tilt: 0, front: true },
];
const SPIKES = 7;

function hoodShape(cx, cy, h, mirror) {
  const pts = new Map(), tilt = mirror ? -h.tilt : h.tilt, ca = Math.cos(tilt), sa = Math.sin(tilt);
  const R = Math.max(h.rx, h.ry) + 3;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const X = x + 0.5 - cx, Y = y + 0.5 - cy;
    const u = (X * ca + Y * sa) / h.rx, v = (-X * sa + Y * ca) / h.ry;   // fan frame: v < 0 is up
    if (v > 0.25) continue;                                                // cut flat at the base
    const a = Math.atan2(u, -v), t = ((a / Math.PI + 1) / 2 * SPIKES) % 1;  // 0..1 across a spike
    const edge = 1 - 0.3 * Math.abs(t - 0.5) * 2, r = Math.hypot(u, v);
    if (r > edge) continue;
    let c = C.M;
    if (r < 0.62) c = C.D;                                                 // darker inner panel
    if (Math.abs(t - 0.5) < 0.1 && r > 0.3) c = r < 0.62 ? C.M : C.R;               // spine ridges
    if (r > edge - 0.16 && (u < -0.2 || v < -0.8)) c = C.L;               // lit rim, upper left
    pts.set(x + ',' + y, c);
  }
  return pts;
}

function mega(f, dir) {
  const W = f.W;
  const red = [];
  for (let i = 0; i < f.px.length; i++) if (RED.has(f.px[i])) red.push(i);
  let blue = 0; for (const c of f.px) if (BLUE.has(c)) blue++;
  if (blue >= 30) {
    // Anchor: topmost red row, x = mean of the red pixels in the upper part of the spines.
    // Spines hidden (head thrown back): top of the blue body instead.
    const bl = []; for (let i = 0; i < f.px.length; i++) if (BLUE.has(f.px[i])) bl.push(i);
    const src = red.length >= 4 ? red : bl;
    const s = stats(f, src), top = src.filter(i => ((i / W) | 0) <= s.y0 + Math.max(4, (s.y1 - s.y0) * 0.35));
    const t = stats(f, top);
    const mir = dir > 4, h = HOOD[mir ? 8 - dir : dir];
    const ax = t.cx + (mir ? -h.dx : h.dx), ay = s.y0 + h.dy;
    const pts = hoodShape(ax, ay, h, mir);
    const ring = new Set();
    for (const p of pts.keys()) { const [x, y] = p.split(',').map(Number); for (const [dx, dy] of N4) if (!pts.has((x + dx) + ',' + (y + dy))) ring.add((x + dx) + ',' + (y + dy)); }
    if (h.front) {
      for (const p of ring) { const [x, y] = p.split(',').map(Number); set(f, x, y, BLACK); }
      for (const [p, c] of pts) { const [x, y] = p.split(',').map(Number); set(f, x, y, c); }
    } else {
      const old = f.px.slice(), was = (x, y) => (inside(f, x, y) ? old[y * W + x] : -1);
      for (const [p, c] of pts) {
        const [x, y] = p.split(',').map(Number); if (!inside(f, x, y)) continue;
        if (was(x, y) < 0 || (was(x, y) === BLACK && N4.some(([dx, dy]) => was(x + dx, y + dy) < 0))) set(f, x, y, c);
      }
      for (const p of ring) { const [x, y] = p.split(',').map(Number); if (get(f, x, y) < 0) set(f, x, y, BLACK); }
    }
    // Cuffs: a 2-row crimson band 2-3 px above each hand's claws, with one spike pointing outward.
    let bottom = 0; for (let i = 0; i < f.px.length; i++) if (f.px[i] >= 0) bottom = Math.max(bottom, (i / W) | 0);
    const bs = stats(f, (() => { const l = []; for (let i = 0; i < f.px.length; i++) if (BLUE.has(f.px[i])) l.push(i); return l; })());
    const cand = comps(f, c => c === CLAW).map(b => stats(f, b))
      .filter(b => b.n <= 6 && b.y1 < bottom - 4 && Math.abs(b.cx - bs.cx) > (bs.x1 - bs.x0) * 0.22); // teeth sit near the middle
    const hands = [-1, 1].map(sd => cand.filter(b => Math.sign(b.cx - bs.cx) === sd).sort((a, b) => sd * (b.cx - a.cx))[0]).filter(Boolean);
    for (const hd of hands) {
      const side = hd.cx < bs.cx ? -1 : 1, hx0 = Math.round(hd.cx), hy = Math.round(hd.cy) - 3;
      const band = [];
      for (let y = hy - 1; y <= hy; y++) for (let x = hx0 - 2; x <= hx0 + 2; x++) if (BLUE.has(get(f, x, y))) { set(f, x, y, y === hy - 1 ? C.M : C.D); band.push([x, y]); }
      if (!band.length) continue;
      const [ex, ey] = band.reduce((m, p) => (side * p[0] > side * m[0] || (p[0] === m[0] && p[1] < m[1]) ? p : m));
      // Spike out of the cuff's outer end, pointing up and out (only over empty space / outline).
      for (const [x, y, c] of [[ex + side, ey - 1, C.M], [ex + side * 2, ey - 2, C.L], [ex + side, ey, C.D]])
        if (get(f, x, y) < 0 || outer(f, x, y)) set(f, x, y, c);
    }
  }
  remap(f, REMAP);
  closeOutline(f);
}

const SPIN = new Set(['Rotate', 'Swing']);
await run({
  key: '0160-1', dex: '0160', megaForm: '0001', mega,
  facing: (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r,
});
