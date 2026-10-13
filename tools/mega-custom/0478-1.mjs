// Builds a custom PMD-style Mega Froslass (0478-1, Legends Z-A) from the base Froslass sheets.
// Design (Pokepedia/Bulbapedia + SpriteCollab portrait/0478/0001): taller body ending in a flared kimono hem
// with a light blue/violet lining and ice shards; arms hang into long loose sleeves; the head rocks become
// tall ice horns; a long white mane falls from the back of the skull. Obi stays red (unspecified for the
// mega; not in the portrait).
// Usage: node tools/mega-custom/0478-1.mjs [Walk Idle ...]   (no args = every sheet)
import { buildMega, tools, hex, K, BLACK } from './0445-1.mjs';

const C = {
  w: hex('fefefe'), w1: hex('ecebf2'), l1: hex('cecdd8'), l2: hex('9e9bb4'), v1: hex('886593'), v2: hex('6e5176'),
  c0: hex('4895ba'), c1: hex('77c7d7'), c2: hex('b9f0ff'), d: hex('505e64'), y: hex('e7dd00'),
};
const BLUE = ['4777ff', '67a7ff', '67cfff'].map(K);
const MAP = new Map([
  [K('ffffff'), C.w], [K('bfcff7'), C.l1], [K('4777ff'), C.c0], [K('67a7ff'), C.c1], [K('67cfff'), C.c2],
  [K('572f9f'), C.v2], [K('8f67bf'), C.v1], [K('dfb700'), C.y],
]);
const FACE = [0, 1, 1, 1, 0, -1, -1, -1];

function megaFrame(f, dir) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const body = T.comps(i => kk[i] >= 0).filter(b => b.length > 30).flat();
  const out = f.px.map((p, i) => (p && MAP.get(kk[i])) || p);
  if (!body.length) return out;
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  if (hgt < 14) return T.outline(out);
  const face = FACE[dir];
  const solid = body.filter(j => kk[j] !== BLACK);
  const yOf = j => (j / W) | 0;

  // Head = top 40%; its centre column from the top rows.
  const headBand = solid.filter(j => yOf(j) <= bb.y0 + hgt * 0.4);
  const topRows = solid.filter(j => yOf(j) <= bb.y0 + 3);
  const hx = Math.round(topRows.reduce((s, j) => s + j % W, 0) / Math.max(1, topRows.length));

  // Long mane from the back of the skull (behind; over the back in back views).
  const back = dir >= 3 && dir <= 5;
  for (const s of face ? [-face] : [-1, 1]) {
    const side = headBand.filter(j => yOf(j) >= bb.y0 + 3);
    if (!side.length) break;
    const [x, y] = T.extreme(side, [s, 0.2]);
    T.stroke(out, x - s, y - 1, [s * (face ? 0.22 : 0.3), 1], Math.round(hgt * (face ? 0.6 : 0.7)), face ? 4 : 3,
      (t, o, ww) => (o === 0 ? C.l1 : o === ww - 1 ? C.l2 : C.w), 'behind', false);
  }
  if (back) { // mane covers the back of the head and falls down the back
    const x0 = hx - 2, y0 = bb.y0 + Math.round(hgt * 0.25), L = Math.round(hgt * 0.45);
    const mane = [];
    for (let y = y0; y < y0 + L; y++) for (let x = x0; x <= x0 + 4; x++) if (T.inside(x, y) && out[y * W + x]) { out[y * W + x] = (x === x0 || x === x0 + 4) ? C.l2 : (x - x0 + y) % 4 === 0 ? C.l1 : C.w; mane.push(y * W + x); }
  }
  // Ice horns: grow up from the blue rocks on top of the head.
  const rocks = T.comps(i => BLUE.includes(kk[i]) && yOf(i) <= bb.y0 + hgt * 0.3).filter(b => b.length >= 2);
  for (const r of rocks) {
    const [rx, ry] = T.extreme(r, [0, -1]);
    const s = rx < hx ? -1 : rx > hx ? 1 : (face || 1);
    T.stroke(out, rx, ry, [s * 0.45, -1], 6, 3, (t, o, ww) => (o === 0 ? C.c2 : t > 3 ? C.c1 : C.c0), 'behind');
  }
  // Long sleeves: a flap hangs below each arm tip.
  const mid = solid.filter(j => yOf(j) > bb.y0 + hgt * 0.3 && yOf(j) < bb.y0 + hgt * 0.7);
  if (mid.length) for (const s of [-1, 1]) {
    const [ax, ay] = T.extreme(mid, [s, 0]);
    if (Math.abs(ax - hx) < 6) continue; // arm tucked in: no sleeve
    const pts = [[ax - s * 5, ay], [ax + s * 0.5, ay], [ax + s * 0.5, ay + 6], [ax - s * 1, ay + 8], [ax - s * 4, ay + 4]];
    if (s > 0) pts.forEach(p => (p[0] += 0.5)); else pts.forEach(p => (p[0] += 0.5));
    T.poly(out, pts, (x, y, edge) => (y >= ay + 6 ? C.c1 : edge ? C.l1 : (x + y) % 5 === 0 ? C.c2 : C.w), 'behind');
  }
  // Taller body: flared kimono hem below the lowest row, lining showing, ice shards under it.
  const by = Math.max(...solid.map(yOf));
  const row = solid.filter(j => yOf(j) === by), rx0 = Math.min(...row.map(j => j % W)), rx1 = Math.max(...row.map(j => j % W));
  const cx = (rx0 + rx1) / 2, hw = Math.max(2, (rx1 - rx0) / 2);
  for (let t = 1; t <= 5; t++) {
    const w = hw + Math.floor(t * 0.7), y = by + t;
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      if (!T.inside(x, y) || out[y * W + x] && !T.isOuter(out, x, y)) continue;
      const edge = Math.abs(x - cx) >= w - 0.5;
      out[y * W + x] = t >= 4 ? (Math.abs(x - cx) < w - 2 ? C.v1 : C.c1) : edge ? C.l1 : C.w;
    }
  }
  for (const dx of [-hw, 0, hw]) T.stroke(out, Math.round(cx + dx), by + 6, [dx < 0 ? -0.4 : dx > 0 ? 0.4 : 0, 1], 3, 2, [C.c1, C.c2], 'behind');
  return T.outline(out);
}

await buildMega({ key: '0478-1', dex: '0478', form: '0001', megaFrame });
