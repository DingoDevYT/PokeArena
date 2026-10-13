// Custom PMD-style Mega Falinks (0870-1). SpriteCollab draws Falinks as single members (0870/0002 Brass,
// 0870/0003 Trooper), so the mega is built the way the official art builds it: the members stack into the
// humanoid "ultimate battle formation". The brass is the head, one trooper is the torso, two troopers are
// the legs, and two are the arms: the right-arm trooper's horn becomes a long red spear, the left-arm
// trooper carries a big gold shield. Every member is an untouched official frame (same facing, same moment
// of the animation, timed by durations), placed by a per-facing layout, then recoloured to the mega portrait.
// Output: assets/sprite-custom/0870-1/*.png (Brass sheet names), _anims.json, _preview.png
// Usage: node tools/mega-custom/0870-1.mjs
import { run, loadBase, readPng, sheetFrame, sameMoment, spike, closeOutline, frameTools, hex, key, K, stamp } from './0801-2.mjs';

const brass = await loadBase('0870/0002'), troop = await loadBase('0870/0003');
const tPng = Object.fromEntries(Object.entries(troop).map(([n, a]) => [n, readPng(a.file)]));
// Base -> Mega Falinks portrait (portrait/0870/0001): warmer gold, grey-black face, red crest.
const REMAP = new Map([
  ['fff700', 'f5d153'], ['deb500', 'd5a733'], ['a56b00', '8f7020'], ['733900', '5f4a17'],
  ['d63900', 'cb3d3f'], ['9c0000', '9a2223'], ['212929', '343238'], ['4a5252', '57575f'],
  ['73ffff', '96e2e3'], ['31bdf7', '3a9bca'], ['d6dede', 'c4c3b0'],
].map(([a, b]) => [K(a), hex(b)]));
const C = { R: hex('cb3d3f'), r: hex('9a2223'), L: hex('efffc8'), G: hex('f5d153'), g: hex('d5a733'), d: hex('8f7020'), W: [255, 255, 255], '#': [0, 0, 0] };

// Layout per facing (Down, DownRight, Right, UpRight, Up; the left facings are mirrors with spear and shield
// swapped, since the spear is always in the creature's right hand). Offsets are member anchor (frame centre,
// footY) relative to the brass anchor. List order = paint order (far to near). Roles: L/R legs, B torso,
// S spear arm, D shield arm, H brass head. spear = direction the spear points; shield = disc radii.
const LAYOUT = [
  { m: [['L', -6, 0], ['R', 6, 0], ['S', -13, -14], ['D', 13, -14], ['B', 0, -10], ['H', 0, -21]], spear: [-1, 0.55], shield: [3, 6] },
  { m: [['R', 5, -2], ['D', 12, -16], ['B', 0, -10], ['L', -5, 0], ['S', -11, -12], ['H', 0, -21]], spear: [-1, 0.7], shield: [4, 6] },
  { m: [['R', -2, -1], ['D', -3, -15], ['B', 0, -10], ['L', 2, 0], ['S', 3, -12], ['H', 0, -21]], spear: [1, 0.45], shield: [5, 5] },
  { m: [['R', -5, -2], ['D', -12, -16], ['B', 0, -10], ['L', 5, 0], ['S', 11, -12], ['H', 0, -21]], spear: [1, 0.6], shield: [4, 6] },
  { m: [['L', -6, 0], ['R', 6, 0], ['B', 0, -10], ['S', 13, -14], ['D', -13, -14], ['H', 0, -21]], spear: [1, 0.55], shield: [3, 6] },
];
const SWAP = { S: 'D', D: 'S', L: 'R', R: 'L' };
for (const d of [3, 2, 1]) {
  const l = LAYOUT[d];
  LAYOUT.push({ m: l.m.map(([k, x, y]) => [SWAP[k] || k, -x, y]), spear: [-l.spear[0], l.spear[1]], shield: l.shield, mirrored: true });
}
// In the mirrored side views the shield arm is the near one, so its disc is drawn in front of the torso.

// Shield disc: gold rim, white ring, red centre (rx, ry), outlined.
function disc(out, W, H, cx, cy, rx, ry) {
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const q = (x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2;
    if (q > 1) continue;
    const X = cx + x, Y = cy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const edge = (((Math.abs(x) + 1) / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2 > 1) || ((x / (rx + 0.5)) ** 2 + ((Math.abs(y) + 1) / (ry + 0.5)) ** 2 > 1);
    out[Y * W + X] = edge ? C['#'] : q < 0.12 ? C.R : q < 0.4 ? (y < 0 ? C.W : C.L) : q < 0.6 ? C.g : (y < 0 ? C.G : C.d);
  }
}

function megaFalinks(f, { name, r, c, work, a }) {
  const { W, H } = f;
  const out = new Array(W * H).fill(null);
  const ax = work + a.fw / 2, ay = work + a.footY;               // brass anchor on the canvas
  const t = troop[name] || troop.Idle, tp = tPng[name] || tPng.Idle;
  const tc = sameMoment(a.durations, c, t.durations), tr = Math.min(r, tp.height / t.fh - 1);
  const tpx = sheetFrame(tp, t.fw, t.fh, tr, tc);
  const tm = frameTools(t.fw, t.fh, tpx).bodyMask();               // members drop their effect sprites
  const paste = (px, fw, fh, fy, dx, dy, mask) => {
    const ox = Math.round(ax - fw / 2 + dx), oy = Math.round(ay - fy + dy);
    px.forEach((p, i) => {
      if (!p || (mask && !mask[i])) return;
      const x = ox + i % fw, y = oy + ((i / fw) | 0);
      if (x >= 0 && y >= 0 && x < W && y < H) out[y * W + x] = p;
    });
  };
  const L = LAYOUT[r] || LAYOUT[0];
  // Spear and shield ride on the arm trooper's actual body in this frame (it lunges inside its frame).
  const tbi = []; tm.forEach((v, i) => v && tbi.push(i));
  const tb = frameTools(t.fw, t.fh, tpx).box(tbi);
  const bx = Math.round(tb.cx - t.fw / 2), by = tb.y0 - t.footY;
  for (const [role, dx, dy] of L.m) {
    if (role === 'H') {
      // Brass (with its own effects), lifted onto the torso.
      paste(f.px, W, H, ay, dx + (W / 2 - ax), dy, null);
      continue;
    }
    if (role === 'S') {
      const side = Math.sign(L.spear[0]);
      spike(out, W, H, Math.round(ax + dx + bx + side * 4), Math.round(ay + dy + by + 6), L.spear, 12, 5, [C.R, C.R, C.r]);
    }
    paste(tpx, t.fw, t.fh, t.footY, dx, dy, tm);
    if (role === 'D') {
      const side = dx ? Math.sign(dx) : (L.mirrored ? -1 : 1) * -Math.sign(L.spear[0]);
      disc(out, W, H, Math.round(ax + dx + bx + side * 6), Math.round(ay + dy + by + 3), L.shield[0], L.shield[1]);
    }
  }
  for (let i = 0; i < W * H; i++) if (out[i]) out[i] = REMAP.get(key(out[i])) || out[i];
  return closeOutline(out, W, H);
}

await run({ key: '0870-1', base: '0870/0002', portrait: '0870/0001', mega: megaFalinks, work: 24 });
