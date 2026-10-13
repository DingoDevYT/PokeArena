// Builds a custom PMD-style Mega Lucario Z (0448-2, Legends Z-A: Mega Dimension) from the base Lucario sheets.
// Design (Pokepedia + SpriteCollab portrait/0448/0002): dark grey body, grey ears and head marking, cyan limb
// tips behind a grey band, thick cream fur on chest/shoulders/hips, two long hair appendages at the back of
// the head shading grey to cyan, a cyan tuft between the ears, light blue eyes.
// Usage: node tools/mega-custom/0448-2.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const Z = {
  d0: hex('383b3e'), d1: hex('494c50'), d2: hex('565959'), d3: hex('606a6e'),
  g1: hex('818882'), g2: hex('8e9faf'), g3: hex('a9b8c2'),
  c1: hex('5e9bbf'), c2: hex('77c7d7'), c3: hex('b2ddc9'),
  f1: hex('bec054'), f2: hex('dbda9e'), f3: hex('f5fdba'),
};
const BLUE = ['0067b7', '1fa7e7', '7fcfff'].map(K), GREY = ['47676f', '7f8f97', 'afb7bf'].map(K), FUR = ['c78f4f', 'ffd787', 'fff7af'].map(K);
const BODY = [Z.d1, Z.d3, Z.g1], EAR = [Z.d3, Z.g1, Z.g3], MASK = [Z.d2, Z.g2, Z.g3], TIP = [Z.c1, Z.c2, Z.c3];
const OTHER = new Map([[K('d73f00'), Z.c2], ...FUR.map((k, n) => [k, [Z.f1, Z.f2, Z.f3][n]])]);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.some(j => BLUE.includes(kk[j]) || GREY.includes(kk[j]))).flat();
  const out = f.px.slice();
  if (!body.length) return out;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  const top = bb.y0;
  const topRow = body.filter(j => ((j / W) | 0) <= top + 3);
  const hx = Math.round(topRow.reduce((s, j) => s + j % W, 0) / topRow.length);
  const headY = top + Math.max(9, Math.round(hgt * 0.36)); // ears + head; below this grey parts are hands/feet
  const earY = top + 5;
  for (const j of body) {
    const y = (j / W) | 0, b = BLUE.indexOf(kk[j]), g = GREY.indexOf(kk[j]);
    if (b >= 0) out[j] = (y <= earY ? EAR : BODY)[b];
    else if (g >= 0) {
      // Limb tips go cyan, with a grey band where they meet the dark body.
      const band = y > headY && T.ring([j], n => BLUE.includes(kk[n])).length;
      out[j] = y <= headY ? MASK[g] : band ? Z.g1 : TIP[g];
    } else if (OTHER.has(kk[j])) out[j] = OTHER.get(kk[j]);
  }
  // Thick fur: one ring of cream grows over the dark body around the chest fur.
  const fur = body.filter(j => FUR.includes(kk[j]));
  if (fur.length >= 4) for (const i of T.ring(fur, n => BLUE.includes(kk[n]) && ((n / W) | 0) > headY - 2)) out[i] = Z.f2;
  // Hair appendages: from the sides of the head (back side only in profile), long, grey fading to cyan.
  const face = FACE[dir];
  const band = body.filter(j => { const x = j % W, y = (j / W) | 0; return y >= top + 7 && y <= top + 12 && Math.abs(x - hx) <= 8 && kk[j] !== BLACK; });
  if (band.length >= 6 && hgt >= 20 && hgt > (bb.x1 - bb.x0) * 0.7) for (const s of [-1, 1]) { // upright poses only
    if (face === s) continue;
    const [ax, ay] = T.extreme(band, [s, 0.3]);
    const e = face ? [s * 0.5, 1] : [s * 0.8, 1];
    const L = 10;
    T.stroke(out, ax, ay - 2, e, L, 3,
      (t, o) => (t > L - 4 ? (o === 0 ? Z.c1 : Z.c2) : t > L / 2 - 1 ? (o === 0 ? Z.g2 : Z.c3) : (o === 0 ? Z.d3 : Z.g3)), 'behind', false);
    // wavy, tapering end
    const m = Math.max(Math.abs(e[0]), Math.abs(e[1])), ex = Math.round(ax + e[0] / m * L), ey = Math.round(ay - 2 + e[1] / m * L);
    for (const [dx, dy] of [[0, 0], [s, 1]]) if (T.inside(ex + dx, ey + dy) && !out[(ey + dy) * W + ex + dx]) out[(ey + dy) * W + ex + dx] = Z.c2;
  }
  // Cyan tuft between the ears, falling over the face (front views).
  if (dir <= 2 || dir >= 6) {
    const tuft = body.filter(j => { const x = j % W, y = (j / W) | 0; return Math.abs(x - hx) <= 0 && y > top + 2 && y <= top + 6 && BLUE.includes(kk[j]); });
    for (const j of tuft) out[j] = Z.c2;
  }
  return T.outline(out);
}

await buildMega({ key: '0448-2', dex: '0448', form: '0002', megaFrame });
