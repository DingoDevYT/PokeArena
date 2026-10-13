// Builds a custom PMD-style Mega Heatran (0485-1, Legends Z-A: Mega Dimension) from the base Heatran sheets.
// Design (Pokepedia + SpriteCollab portrait/0485/0001): shell turns lava red with yellow-hot spots, the
// underside becomes a glowing magma pocket, magma drips from the legs and mouth, metal growths jut from the
// top of the shell.
// Usage: node tools/mega-custom/0485-1.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const C = {
  r0: hex('9e1b31'), r1: hex('c72227'), r2: hex('ef3f28'), y1: hex('ffc02e'), y2: hex('fff34d'), y3: hex('f5fdba'),
  g0: hex('383735'), g1: hex('555553'), g2: hex('737a77'), g3: hex('a7a7a3'), g4: hex('c6cbc6'), g5: hex('e5eeef'),
};
const MAP = new Map([
  [K('97571f'), C.r1], [K('673f00'), C.r0], [K('e78f27'), C.y1], [K('f7b71f'), C.y2], [K('bf3700'), C.r2],
  [K('afb7bf'), C.g4], [K('7f8f97'), C.g3], [K('67676f'), C.g2], [K('473f3f'), C.g1], [K('d7dfdf'), C.g5],
  [K('ff875f'), C.y1], [K('e74f47'), C.r2],
]);
const SHELL = ['97571f', '673f00', 'e78f27', 'f7b71f'].map(K);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.some(j => SHELL.includes(kk[j]))).flat();
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  if (!body.length) return out;
  const yOf = j => (j / W) | 0;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  // Magma pocket: the dark underside blob(s) sitting under the shell glow yellow, hottest in the middle.
  const DARK = [K('473f3f'), K('67676f')];
  const dark = T.comps(i => DARK.includes(kk[i])).filter(b => b.length >= 6);
  for (const b of dark) {
    const c = T.centroid(b), bx = T.bbox(b);
    if (c[1] < bb.y0 + hgt * 0.35) continue;
    for (const j of b) {
      const d = Math.max(Math.abs(j % W - c[0]) / Math.max(1, (bx.x1 - bx.x0) / 2), Math.abs(yOf(j) - c[1]) / Math.max(1, (bx.y1 - bx.y0) / 2));
      out[j] = d < 0.45 ? C.y2 : d < 0.8 ? C.y1 : C.r2;
    }
  }
  // Metal growths on top of the shell.
  const shell = body.filter(j => SHELL.includes(kk[j]));
  if (shell.length > 20) {
    const sb = T.bbox(shell), top = shell.filter(j => yOf(j) <= sb.y0 + 2);
    const xs = top.map(j => j % W), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const spikes = x1 - x0 >= 8 ? [x0 + 1, Math.round((x0 + x1) / 2), x1 - 1] : [Math.round((x0 + x1) / 2)];
    for (const sx of spikes) {
      const col = top.filter(j => j % W === sx); if (!col.length) continue;
      const sy = Math.min(...col.map(yOf));
      const lean = sx === x0 + 1 && spikes.length > 1 ? -0.5 : sx === x1 - 1 && spikes.length > 1 ? 0.5 : 0;
      T.stroke(out, sx, sy - 1, [lean, -1], 4, 3, (t, o, ww) => (o === 0 ? C.g5 : o === ww - 1 ? C.g2 : C.g4), 'behind');
    }
  }
  // Magma drips under each foot and the mouth: the lowest pixel of every column cluster near the bottom.
  const solid = body.filter(j => kk[j] !== BLACK);
  const feet = T.comps(i => solid.includes(i) && yOf(i) >= bb.y1 - 3).filter(b => b.length >= 2);
  for (const b of feet) {
    const [fx, fy] = T.extreme(b, [0, 1]);
    for (const [dx, dy, c] of [[0, 1, C.y1], [0, 2, C.r2]]) if (T.inside(fx + dx, fy + dy) && (!out[(fy + dy) * W + fx + dx] || dy === 1)) out[(fy + dy) * W + fx + dx] = c;
  }
  return T.outline(out);
}

await buildMega({ key: '0485-1', dex: '0485', form: '0001', megaFrame });
