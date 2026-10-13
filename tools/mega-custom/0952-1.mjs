// Custom PMD-style Mega Scovillain (0952-1) from the base Scovillain sheets.
// Output: assets/sprite-custom/0952-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0952-1.mjs
// Parts are the 4-connected non-black blobs: blobs with red are the red head, blobs with the two lightest
// greens are the green head, the rest is the body. Per frame:
//  - the body above the lower-body green (necks, arms, upper torso) becomes the black suit;
//  - a jagged orange chilli necktie hangs from the collar (front-facing rows only);
//  - white spikes: a row of three along the red head's crown, a pair of brow spikes on the green head;
//  - both heads take the darker mega portrait colours.
import { run, keepEffects, hex, key, K, stamp, spike, closeOutline } from './0801-2.mjs';

const REDS = new Set(['a51115', 'd93a22', 'ff6339', 'ff9659'].map(K));
const GHEAD = new Set(['6ae76a', 'b1ff8b'].map(K));
const LOWER = K('1b5940');
const P = {
  sp: hex('fff8e4'), spM: hex('f7fac4'), spD: hex('e6e29d'),
  tie: hex('f27711'), tieL: hex('f5aa46'), tieD: hex('9c3e29'), black: [0, 0, 0],
};
// Mega Scovillain portrait (portrait/0952/0001): orange-red head, darker green head, charcoal suit.
const RED = new Map([['a51115', '9c3e29'], ['d93a22', 'd4492c'], ['ff6339', 'ef5834'], ['ff9659', 'f5aa46']].map(([a, b]) => [K(a), hex(b)]));
const GREEN = new Map([['1c6323', '2c5a31'], ['40b155', '348c3c'], ['6ae76a', '69c168'], ['b1ff8b', 'b2ddb2'], ['258a4e', '2c5a31']].map(([a, b]) => [K(a), hex(b)]));
const SUIT = new Map([['0b3729', '252c2b'], ['1c6323', '303b34'], ['258a4e', '303b34'], ['40b155', '464746'], ['6ae76a', '464746']].map(([a, b]) => [K(a), hex(b)]));
const TIE = ['.##.', '#OO#', '#Oo#', '.#oO#', '.#oO#', '#Oo#.', '#od#', '.##.'];
// Facing rows: 0 Down .. 4 Up .. 7 DownLeft. Spike spread across the head (front/back views see the crest end-on).
const SPREAD = [0.18, 0.3, 0.42, 0.3, 0.18, 0.3, 0.42, 0.3];
const TIE_ROWS = new Set([0, 1, 7]);

function megaScovillain(f, { dir }) {
  const { W, H, px, comps, box, centroid } = f;
  const kk = px.map(key);
  const out = px.slice();
  const blobs = comps(i => kk[i] > 0);
  const red = [], green = [], body = [];
  for (const b of blobs) {
    if (b.some(i => REDS.has(kk[i]))) red.push(...b);
    else if (b.some(i => GHEAD.has(kk[i]))) green.push(...b);
    else body.push(...b);
  }
  for (const i of red) out[i] = RED.get(kk[i]) || px[i];
  for (const i of green) out[i] = GREEN.get(kk[i]) || px[i];
  // Suit: body above the lower-body green.
  const low = body.filter(i => kk[i] === LOWER);
  const bb = body.length ? box(body) : null;
  const cut = low.length ? box(low).y0 : bb ? bb.y0 + bb.h / 2 : 0;
  const suit = body.filter(i => ((i / W) | 0) < cut);
  for (const i of suit) out[i] = SUIT.get(kk[i]) || px[i];
  const spikeCols = [P.spD, P.spM, P.spD];
  // Crown spikes: three on the red head, two brow spikes on the green head.
  const crest = (part, fr, len, wid, lean) => {
    if (part.length < 12) return;
    const hb = box(part), [hcx] = centroid(part);
    for (const [k, t] of fr.entries()) {
      const x = Math.round(hcx + t * hb.w);
      const col = part.filter(i => i % W === x);
      if (!col.length) continue;
      const top = Math.min(...col.map(i => (i / W) | 0));
      spike(out, W, H, x, top + 1, [lean * Math.sign(t), -1], len[k], wid, spikeCols);
    }
  };
  const s = SPREAD[dir] ?? 0.3;
  crest(red, [-s, 0, s], [3, 4, 3], 3, 0.35);
  crest(green, [-s * 0.9, s * 0.9], [3, 3], 2, 0.6);
  // Necktie hanging from the collar.
  if (TIE_ROWS.has(dir) && suit.length > 10) {
    const sb = box(suit), topRow = suit.filter(i => ((i / W) | 0) <= sb.y0 + 1);
    const tx = Math.round(centroid(topRow)[0]);
    stamp(out, W, H, TIE, tx, sb.y0 + 1, { O: P.tieL, o: P.tie, d: P.tieD, '#': P.black }, { at: [1, 0], flip: dir === 7 });
  }
  return closeOutline(out, W, H);
}

await run({ key: '0952-1', base: '0952', portrait: '0952/0001', mega: keepEffects(megaScovillain) });
