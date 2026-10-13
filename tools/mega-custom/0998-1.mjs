// Custom PMD-style Mega Baxcalibur (0998-1). Recolour to the mega portrait (bluer body, icy white), red
// eyes, a big ice-sword sail rising behind the back (leaning away from the head, found from the eye position
// in every frame) and an icy hilt crystal on the belly in front views.
// Usage: node tools/mega-custom/0998-1.mjs
import { run, keepEffects, hex, key, K, spike, stamp, closeOutline } from './0801-2.mjs';

const MAP = new Map([['12334a', '37374f'], ['24475f', '314c82'], ['3e5b70', '476f8f'], ['5b869a', '537798'], ['aebfc6', '8ea6bd'],
  ['c9efef', 'd5f6ff'], ['e9f9f9', 'ffffff'], ['ffe000', 'bd4232'], ['827c37', '9a2d2d']].map(([a, b]) => [K(a), hex(b)]));
const EYE = new Set(['ffe000', '827c37'].map(K)), BELLY = K('e9f9f9');
const BLADE = [hex('d5f6ff'), hex('37374f'), hex('979fd7')];
const HILT = ['..#..', '.#L#.', '#LcL#', '.#L#.', '..#..'];
const LEAN = [0, 0.35, 0.6, 0.45, 0, 0.45, 0.6, 0.35];

function megaBax(f, { dir }) {
  const { W, H, px, box, centroid } = f;
  const kk = px.map(key), out = px.slice();
  const all = []; for (let i = 0; i < W * H; i++) if (kk[i] > 0) all.push(i);
  if (all.length < 20) return out;
  for (const i of all) out[i] = MAP.get(kk[i]) || px[i];
  const bb = box(all), [bx] = centroid(all), eyes = all.filter(i => EYE.has(kk[i]));
  const side = eyes.length ? Math.sign(centroid(eyes)[0] - bx) || 1 : 1;       // head side
  const lean = LEAN[dir] * -side;
  const B = new Array(W * H).fill(null);
  const cx = Math.round(bx - side * (dir === 0 || dir === 4 ? 0 : 5)), top = bb.y0 + Math.round(bb.h * 0.35);
  spike(B, W, H, cx, top, [lean, -1], 18, 10, BLADE);
  for (let i = 0; i < W * H; i++) if (B[i] && !out[i]) out[i] = B[i];
  const belly = all.filter(i => kk[i] === BELLY);
  if ((dir === 0 || dir === 1 || dir === 7) && belly.length > 6) {
    const [hx, hy] = centroid(belly);
    stamp(out, W, H, HILT, Math.round(hx), Math.round(hy), { '#': [0, 0, 0], L: hex('d5f6ff'), c: hex('a7bfff') }, { at: [2, 2] });
  }
  return closeOutline(out, W, H);
}
await run({ key: '0998-1', base: '0998', portrait: '0998/0001', mega: keepEffects(megaBax), work: 24 });
