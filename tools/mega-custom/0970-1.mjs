// Custom PMD-style Mega Glimmora (0970-1). Recolour to the mega portrait (purple petal body, teal inner
// petals, red eyes), stretch the cone head along its own axis, and orbit two detached leaf petals around the
// body (anchored to the body centre of every frame). Usage: node tools/mega-custom/0970-1.mjs
import { run, keepEffects, hex, key, K, spike, closeOutline } from './0801-2.mjs';

const MAP = new Map([['005fff', '6e65cf'], ['0f3fcf', '5757a7'], ['002787', '2e2856'], ['17c7e7', '9effd8'], ['17a7bf', '57cfbf'],
  ['478fa7', '59b2b6'], ['5767b7', '3f4f87'], ['6f87d7', '868bf8'], ['87b7bf', '97cfcf'], ['476777', '5581a1'],
  ['ffff00', 'ff98a5'], ['d7a700', 'cb7b8f']].map(([a, b]) => [K(a), hex(b)]));
const CONE = new Set(['476777', '87b7bf'].map(K));
const LEAF = [hex('2e2856'), hex('3f4f87'), hex('5757a7'), hex('5581a1')];
const STRETCH = 7;
// Leaf petal, 11x5 ellipse-ish, tilted by sign. Drawn as filled ellipse with a light vein.
function petal(out, W, H, cx, cy, rx, ry, ang) {
  const c = Math.cos(ang), n = Math.sin(ang), cells = new Map();
  for (let y = -rx; y <= rx; y++) for (let x = -rx; x <= rx; x++) {
    const u = (x * c + y * n) / rx, v = (-x * n + y * c) / ry;
    if (Math.abs(u) <= 1 && Math.abs(v) <= (1 - Math.abs(u)) ** 0.7) cells.set((cy + y) * W + cx + x, Math.abs(v) < 0.12 ? 3 : v < 0 ? 2 : 1);
  }
  for (const [i, s] of cells) if (i >= 0 && i < W * H) out[i] = LEAF[s];
  for (const [i] of cells) for (const d of [1, -1, W, -W]) if (!cells.has(i + d) && i + d >= 0 && i + d < W * H) out[i + d] = [0, 0, 0];
}

function megaGlimmora(f) {
  const { W, H, px, box, centroid, comps } = f;
  const kk = px.map(key), out = px.slice();
  const all = []; for (let i = 0; i < W * H; i++) if (kk[i] > 0) all.push(i);
  if (!all.length) return out;
  const [bx, by] = centroid(all), bb = box(all);
  for (const i of all) out[i] = MAP.get(kk[i]) || px[i];
  // Cone: tip = cone-coloured pixel furthest from the centre; stretch along that axis.
  const cone = all.filter(i => CONE.has(kk[i]));
  if (cone.length > 3) {
    let tip = cone[0], best = -1;
    for (const i of cone) { const d = Math.hypot(i % W - bx, ((i / W) | 0) - by); if (d > best) { best = d; tip = i; } }
    const tx = tip % W, ty = (tip / W) | 0, e = [tx - bx, ty - by];
    spike(out, W, H, tx, ty, e, STRETCH, 3, [hex('97cfcf'), hex('5581a1'), hex('5581a1')]);
  }
  // Orbiting petals, behind the body.
  const behind = out.slice();
  const R = Math.max(bb.w, bb.h) / 2;
  const P = new Array(W * H).fill(null);
  petal(P, W, H, Math.round(bx - R - 6), Math.round(by - R * 0.6), 8, 4, -0.5);
  petal(P, W, H, Math.round(bx + R + 6), Math.round(by + R * 0.5), 8, 4, 0.5);
  for (let i = 0; i < W * H; i++) if (P[i] && !behind[i]) behind[i] = P[i];
  return closeOutline(behind, W, H);
}
await run({ key: '0970-1', base: '0970', portrait: '0970/0001', mega: keepEffects(megaGlimmora), work: 20 });
