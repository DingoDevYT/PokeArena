// Builds a custom PMD-style Mega Abomasnow (0460-1) from the base Abomasnow sheets.
// Design: buried in snow; green arms/body frosted over (green kept only low on the legs and feet), lavender
// shading and dark teal fur lines as in the mega portrait, bigger head crown, icicles jutting from the
// shoulders. Colours from SpriteCollab portrait/0460/0001.
// Usage: node tools/mega-custom/0460-1.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const C = {
  w: hex('ffffff'), w1: hex('e9f0f6'), l1: hex('d1d1e1'), l2: hex('a2a6bd'), l3: hex('8e8bb0'), l4: hex('6d6d84'),
  t: hex('3a4c53'), g1: hex('267969'), g2: hex('4b9e86'), ice: hex('8fcfc7'), ice2: hex('77c7d7'), pink: hex('e4abfc'),
};
const GREEN = ['176f4f', '2f876f', '579f87'].map(K);
const MAP = new Map([[K('afb7bf'), C.l1], [K('777777'), C.l4], [K('d797df'), C.pink], [K('af6fb7'), C.l3], [K('e7271f'), hex('ff8f87')]]);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.length > 20).flat();
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  if (!body.length) return out;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  // Frost: green turns to snow shading except on the feet.
  for (const j of body) {
    const g = GREEN.indexOf(kk[j]); if (g < 0) continue;
    const low = ((j / W) | 0) > bb.y1 - Math.max(4, hgt * 0.16);
    out[j] = low ? [C.t, C.g1, C.g2][g] : [C.l3, C.l2, C.l1][g];
  }
  const face = FACE[dir];
  const solid = body.filter(j => kk[j] !== BLACK);
  // Bigger crown: extend the two upper corner tips of the head.
  const topBand = solid.filter(j => ((j / W) | 0) <= bb.y0 + Math.max(4, hgt * 0.15));
  if (topBand.length > 4) for (const s of face ? [face] : [-1, 1]) {
    const [x, y] = T.extreme(topBand, [s, -1.2]);
    T.stroke(out, x + s, y - 1, [s * 0.7, -1], 3, 2, [C.l1, C.w], 'behind');
  }
  // Shoulder icicles.
  const sh = solid.filter(j => { const y = (j / W) | 0; return y >= bb.y0 + hgt * 0.28 && y <= bb.y0 + hgt * 0.42; });
  if (sh.length > 4 && hgt >= 14) for (const s of [-1, 1]) {
    const [x, y] = T.extreme(sh, [s, -0.4]);
    const ice = [C.ice, C.w1];
    T.stroke(out, x - s * 2, y, [s * 0.35, -1], 7, 3, ice, 'behind');
    T.stroke(out, x, y + 2, [s, -0.6], 5, 3, [C.ice2, C.w1], 'behind');
  }
  return T.outline(out);
}

await buildMega({ key: '0460-1', dex: '0460', form: '0001', megaFrame });
