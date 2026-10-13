// Builds a custom PMD-style Mega Audino (0531-1) from the base Audino sheets.
// Design (SpriteCollab portrait/0531/0001): white-lavender body, pink eyes, cream muzzle, taller ear tips,
// gold swirl ornaments on the ears and flanks. Colours from the portrait.
// Usage: node tools/mega-custom/0531-1.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const C = {
  w: hex('f6f3f9'), w1: hex('e2d7e4'), w2: hex('ccb5c1'), w3: hex('98606b'),
  c: hex('ffeaa8'), c1: hex('eec887'), g1: hex('d0a25c'), g2: hex('b47b37'), e1: hex('e5728f'), e2: hex('e6a4b0'),
};
const MAP = new Map([
  [K('fec2d2'), C.w], [K('fe98b1'), C.w1], [K('e35c7a'), C.w2], [K('9f272a'), C.w3],
  [K('ffeaa8'), C.c], [K('e0b36e'), C.c1], [K('b47b37'), C.g2], [K('e3ba78'), C.g1],
  [K('f8f8f8'), C.w], [K('e1d3e1'), C.w1], [K('a497ae'), C.w2],
  [K('22a9e7'), C.e1], [K('006aac'), C.w3], [K('ffe827'), C.g1],
]);
const PINK = ['fec2d2', 'fe98b1', 'e35c7a', '9f272a'].map(K), TAN = ['ffeaa8', 'e0b36e', 'b47b37'].map(K);
const SWIRL = ['gGg', 'G.G', 'gGg'];
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.some(j => PINK.includes(kk[j]))).flat();
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  if (!body.length) return out;
  const yOf = j => (j / W) | 0;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  if (hgt < 12) return T.outline(out);
  const face = FACE[dir];
  const solid = body.filter(j => kk[j] !== BLACK);
  // Taller ears: extend the two highest pink ear lobes upward in white with a lavender edge.
  const top = solid.filter(j => yOf(j) <= bb.y0 + 4);
  for (const s of face ? [-face, face] : [-1, 1]) {
    const part = top.filter(j => (face ? true : (j % W - (bb.x0 + bb.x1) / 2) * s > 0));
    if (!part.length) continue;
    const [x, y] = T.extreme(part, [s * (face ? 0.4 : 0.6), -1]);
    T.stroke(out, x, y - 1, [s * 0.4, -1], 4, 3, [C.w2, C.w], 'behind');
  }
  // Gold swirls on the tan side tufts (left/right extremes of the cream blobs at ear height).
  const tufts = T.comps(i => TAN.includes(kk[i]) && yOf(i) < bb.y0 + hgt * 0.6).filter(b => b.length >= 5);
  for (const b of tufts) {
    const [x, y] = T.extreme(b, [(T.centroid(b)[0] < (bb.x0 + bb.x1) / 2 ? -1 : 1), 0]);
    const s = x < (bb.x0 + bb.x1) / 2 ? -1 : 1;
    T.patch(out, SWIRL, { g: C.g1, G: C.g2 }, x - (s > 0 ? 2 : 0), y - 1, 'front');
  }
  return T.outline(out);
}

await buildMega({ key: '0531-1', dex: '0531', form: '0001', megaFrame });
