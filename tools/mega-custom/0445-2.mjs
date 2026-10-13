// Builds a custom PMD-style Mega Garchomp Z (0445-2, Legends Z-A: Mega Dimension) from the base Garchomp sheets.
// Design (Pokepedia): navy body, red belly; forearm fins grown into red/blue-violet blades with four claws;
// a turbine-like protrusion with a red centre on each side of the head with a small wing; white tail tip
// behind a yellow stripe. Colours from SpriteCollab portrait/0445/0002.
// Usage: node tools/mega-custom/0445-2.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, hex, K, BLACK, garchompParts } from './0445-1.mjs';

const Z = {
  n0: hex('30314a'), n1: hex('535182'), n2: hex('5b6595'), n3: hex('6b77ad'), n4: hex('7a88c6'),
  r0: hex('6e3c35'), r1: hex('ad3d2f'), r2: hex('d25e3a'),
  g1: hex('cd9e21'), g2: hex('f0cc3c'), c1: hex('b2ddc9'), c2: hex('efffc8'),
};
const MAP = new Map([
  [K('37478f'), Z.n1], [K('4f6fb7'), Z.n2], [K('6f9fe7'), Z.n3],
  [K('9f172f'), Z.r0], [K('cf473f'), Z.r1], [K('ff6f57'), Z.r2],
  [K('af7f17'), Z.g1], [K('cfa72f'), Z.g1], [K('ffd700'), Z.g2],
  [K('ffffff'), Z.c2], [K('d7d7d7'), Z.c1], [K('a7afa7'), Z.n4],
]);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const { T, kk, body, bb, claws, top, lobes } = garchompParts(f);
  const { W } = T;
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  const face = FACE[dir], midX = (bb.x0 + bb.x1) / 2;

  // Tail tip: furthest body pixel away from the face (side/back views). Cream tip, gold stripe before it.
  if (dir !== 0 && dir !== 1 && dir !== 7) {
    const v = dir === 4 ? [0, 1] : [-face, 0.6];
    const [tx, ty] = T.extreme(body, v);
    for (const j of body) {
      if (!out[j] || T.k(out[j]) === BLACK) continue;
      const d = Math.hypot(j % W - tx, ((j / W) | 0) - ty);
      if (d <= 2.6) out[j] = Z.c2; else if (d <= 3.8) out[j] = Z.g2;
    }
  }
  // Head turbines: red centre on each side lobe (only the back one in side views), small wing behind.
  lobes.forEach(([lx, ly], n) => {
    const s = n ? 1 : -1;
    if (face && s === face) return; // front extreme is the snout
    const cx = lx - s * 2, cy = ly;
    T.patch(out, ['rr', 'RR'], { r: Z.r2, R: Z.r1 }, cx - (s < 0 ? 0 : 1), cy - 1, 'on');
    T.stroke(out, lx + s, ly - 1, [s, -1.3], 4, 2, [Z.n1, Z.n3], 'behind');
  });
  // Forearm blades: big red sickle, blue-violet back edge, cream claws along the cutting edge.
  const lead = face ? Math.max(...claws.map(c => c.c[0] * face)) : null;
  for (const { c: [cx, cy] } of claws) {
    const s = face || (cx < midX ? -1 : 1);
    const mode = face && cx * face === lead ? 'front' : 'behind';
    const pts = [[cx, cy - 2], [cx + s * 4, cy - 1], [cx + s * 6, cy + 5], [cx + s * 5, cy + 10], [cx + s * 2, cy + 6], [cx - s, cy + 3]];
    if (s < 0) pts.forEach(p => (p[0] += 1));
    const bl = T.poly(out, pts, (x, y, edge) => (edge && (x - cx) * s >= 4 ? Z.n3 : y - cy > 3 ? Z.r1 : Z.r2), mode);
    if (mode === 'front') for (const i of T.ring(bl, n => !!out[n])) out[i] = Z.n0;
    // four claws poking off the inner (cutting) edge
    for (let t = 0; t < 4; t++) {
      const x = cx + s * (5 - t) - (s < 0 ? -1 : 0) - s * 2, y = cy + 9 - t * 2;
      if (T.inside(x - s, y + 1) && (mode === 'front' || !out[(y + 1) * W + x - s])) out[(y + 1) * W + x - s] = Z.c2;
    }
  }
  return T.outline(out);
}

await buildMega({ key: '0445-2', dex: '0445', form: '0002', megaFrame });
