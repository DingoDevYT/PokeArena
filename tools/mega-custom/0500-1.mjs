// Builds a custom PMD-style Mega Emboar (0500-1, Legends Z-A) from the base Emboar sheets.
// Design (Pokepedia + SpriteCollab portrait/0500/0001): taller flames rising off the shoulders and collar,
// black brows sweeping up into a crown, red loincloth hanging from the belt, red tail (back views), and a
// flame spear held in its left hand.
// Usage: node tools/mega-custom/0500-1.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const C = {
  k0: hex('231f1d'), k1: hex('443331'), k2: hex('554846'), k3: hex('776f67'),
  r0: hex('a8352c'), r1: hex('e44c4b'), r2: hex('f16f57'), o1: hex('dc7135'), o2: hex('f29452'), o3: hex('f28d52'),
  y: hex('ffdd60'), w: hex('f6f5ec'), w2: hex('d0d3b5'),
};
const MAP = new Map([
  [K('5b5756'), C.k2], [K('444140'), C.k1], [K('d13500'), C.r1], [K('990000'), C.r0], [K('f8912b'), C.o2],
  [K('d97111'), C.o1], [K('f08157'), C.o3], [K('f8f000'), C.y], [K('d9b200'), C.o1], [K('b2811a'), C.r0],
  [K('f0f0f0'), C.w], [K('d0d8d8'), C.w2], [K('a8b0b8'), C.k3],
]);
const DARK = ['5b5756', '444140'].map(K), FLAME = ['d13500', 'f8912b', 'f8f000', 'd97111', 'd9b200'].map(K);
const WHITE = ['f0f0f0', 'd0d8d8', 'a8b0b8'].map(K), RED = ['d13500', '990000'].map(K);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.some(j => DARK.includes(kk[j]))).flat();
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  if (!body.length) return out;
  const yOf = j => (j / W) | 0;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  if (hgt < 14) return T.outline(out);
  const face = FACE[dir];
  const upper = j => yOf(j) <= bb.y0 + hgt * 0.45;

  // Belt: lowest wide band of red. Used for the loincloth and to find the tail.
  const belts = T.comps(i => RED.includes(kk[i]) && yOf(i) > bb.y0 + hgt * 0.5).filter(b => b.length >= 4).sort((a, b) => b.length - a.length);
  const belt = belts[0] && T.bbox(belts[0]);
  // Red tail in back views: dark pixels hanging below the belt near the middle.
  if (belt && dir >= 3 && dir <= 5) {
    const cx = (belt.x0 + belt.x1) / 2;
    for (const j of body) if (DARK.includes(kk[j]) && yOf(j) > belt.y1 + 2 && Math.abs(j % W - cx - face * 2) <= 4) out[j] = kk[j] === K('444140') ? C.r0 : C.r1;
  }
  // Loincloth flap in front views.
  if (belt && (dir <= 2 || dir >= 6)) {
    const cx = Math.round((belt.x0 + belt.x1) / 2 + face * 2), y0 = belt.y1 + 1;
    T.poly(out, [[cx - 2, y0], [cx + 3, y0], [cx + 2.5, y0 + 5], [cx + 0.5, y0 + 4], [cx - 1.5, y0 + 5]], (x, y, e) => (e ? C.r0 : C.r1), 'front');
  }
  // Taller flames: tongues rising from the outer ends of the shoulder collar, plus one ring of flame.
  const flame = body.filter(j => FLAME.includes(kk[j]) && upper(j));
  if (flame.length > 6) {
    for (const i of T.ring(flame, n => !out[n] || T.isOuter(out, n % W, yOf(n)))) if (yOf(i) < bb.y0 + hgt * 0.4) out[i] = C.r1;
    for (const s of [-1, 1]) {
      const [x, y] = T.extreme(flame, [s, -1]);
      T.stroke(out, x, y, [s * 0.3, -1], 6, 3, (t, o, ww) => (o === 0 || o === ww - 1 ? C.r1 : t > 3 ? C.o2 : C.y), 'behind');
    }
  }
  // Crown: the dark brow sweeps up into two back-swept points.
  const brow = body.filter(j => DARK.includes(kk[j]) && yOf(j) <= bb.y0 + hgt * 0.3);
  if (brow.length > 3) {
    const bx = T.bbox(brow);
    for (const s of face ? [-face] : [-1, 1]) {
      const [x, y] = T.extreme(brow.filter(j => yOf(j) <= bx.y0 + 2), [s, -0.5]);
      T.stroke(out, x, y, [s * 0.6, -1], 4, 2, [C.k0, C.k2], 'behind');
    }
  }
  // Flame spear in the left hand (viewer's right from the front, left from the back, near side facing left).
  const hands = T.comps(i => WHITE.includes(kk[i]) && yOf(i) > bb.y0 + hgt * 0.3 && yOf(i) < bb.y1 - 3).filter(b => b.length >= 2);
  const want = dir <= 1 || dir === 7 ? 1 : dir >= 3 && dir <= 5 ? -1 : dir === 6 ? -1 : 0;
  if (hands.length && want) {
    const hand = hands.sort((a, b) => T.centroid(b)[0] * want - T.centroid(a)[0] * want)[0];
    const [hx, hy] = T.centroid(hand);
    const top = hy - Math.round(hgt * 0.75), bot = hy + 5;
    const mode = dir >= 3 && dir <= 5 ? 'behind' : 'front';
    for (let y = top + 4; y <= bot; y++) for (const [dx, c] of [[0, C.r0], [1, C.o1]]) {
      const x = hx + dx; if (!T.inside(x, y)) continue;
      if (mode === 'behind' && out[y * W + x] && !T.isOuter(out, x, y)) continue;
      if (Math.abs(y - hy) <= 1 && mode === 'front') continue; // fist wraps the shaft
      out[y * W + x] = c;
    }
    T.patch(out, ['..r..', '.ryr.', '.ryr.', 'ryyyr', 'ryYyr', '.rrr.'], { r: C.r1, y: C.o2, Y: C.y }, hx - 2, top - 2, mode);
  }
  return T.outline(out);
}

await buildMega({ key: '0500-1', dex: '0500', form: '0001', megaFrame });
