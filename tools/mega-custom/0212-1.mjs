// Builds a custom PMD-style Mega Scizor (0212-1) from the base Scizor sheets (SpriteCollab sprite/0212).
// Output: assets/sprite-custom/0212-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0212-1.mjs [Walk Idle ...]   (no args = every sheet)
//
// Mega Scizor: much bigger pincers with jagged white teeth and teal eye spots, a taller pointed head
// crest, darker black joints, cyan eyes and a crimson body. Per frame: each pincer is found from its
// eye spot (a yellow blob next to the grey claw joint); the claw region around it is grown by a rim
// whose outer half becomes a white/black saw edge. Crest tips (local tops in the upper body) are
// lengthened upward. Colours from the mega portrait.
import { run, hx, BLACK, N4, comps, stats, get, set, inside, closeOutline, remap } from '../.cache/mega-base/_lib.mjs';

const REDS = new Set(['d73f00', '9f0000', 'ff875f'].map(hx));
const GREY = new Set(['575757', '2f2f2f'].map(hx));
const YEL = hx('dfb700');
const C = { M: hx('e8434e'), D: hx('a22832'), L: hx('f34e64'), K: hx('662629'), W: hx('ffffff'), T: hx('0093b6') };
const REMAP = new Map([
  ['d73f00', 'e8434e'], ['9f0000', 'a22832'], ['ff875f', 'f34e64'],   // crimson body
  ['575757', '383b3b'], ['2f2f2f', '332526'],                         // darker joints
  ['dfb700', '0093b6'],                                               // teal eye spots / cyan eyes
].map(([a, b]) => [hx(a), hx(b)]));
// Right-hand pincer, jaws open to the right; PT = the eye spot cell.
const PINCER = [
  '..######....',
  '.#LLMMMM##..',
  '#LLMMMMMDD#.',
  '#LMTTMMDDKW#',
  '#MMTTMDK#W#.',
  '#MMMMD##....',
  '#MMMMD##W#..',
  '#DMMMDDKKW#.',
  '.#DDDDDD##..',
  '..######....',
];
const PT = [3, 3];
const CREST = 2; // px added to each crest tip

function mega(f, dir) {
  const W = f.W, old = f.px.slice(), was = (x, y) => (inside(f, x, y) ? old[y * W + x] : -1);
  const red = []; for (let i = 0; i < f.px.length; i++) if (REDS.has(f.px[i])) red.push(i);
  if (red.length < 25) { remap(f, REMAP); closeOutline(f); return; }
  const bs = stats(f, red);
  // 1. Pincers: yellow blobs with a grey joint pixel within 2 px.
  const spots = comps(f, c => c === YEL).filter(b => b.some(i => {
    const x = i % W, y = (i / W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (GREY.has(was(x + dx, y + dy))) return true;
    return false;
  })).map(b => stats(f, b));
  for (const sp of spots) {
    // Big pincer stamped over the old one, jaws opening away from the body, eye spot on the old spot.
    const out = (sp.cx - bs.cx) < -0.5 ? -1 : 1, w = PINCER[0].length;
    const ox = Math.round(sp.cx) - (out > 0 ? PT[0] : w - 1 - PT[0]), oy = Math.round(sp.cy) - PT[1];
    PINCER.forEach((row, py) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const x = ox + (out > 0 ? i : w - 1 - i), y = oy + py;
      if (inside(f, x, y)) set(f, x, y, ch === '#' ? BLACK : C[ch]);
    }));
  }
  // 2. Crest: lengthen red tips in the upper 30% of the body (pixel whose 3 upper neighbours are outline/empty).
  const lim = bs.y0 + (bs.y1 - bs.y0) * 0.3;
  const tips = [];
  for (const i of red) {
    const x = i % W, y = (i / W) | 0; if (y > lim) continue;
    const up = [was(x - 1, y - 1), was(x, y - 1), was(x + 1, y - 1)];
    if (up.every(c => c === BLACK || c < 0) && [was(x - 1, y), was(x + 1, y)].some(c => c === BLACK || c < 0)) tips.push([x, y]);
  }
  for (const [x, y] of tips) {
    const lean = Math.sign(x - bs.cx) * (Math.abs(x - bs.cx) > 3 ? 1 : 0);
    for (let k = 1; k <= CREST; k++) set(f, x + (k === CREST ? lean : 0), y - k, k === CREST ? C.L : C.M);
  }
  remap(f, REMAP);
  closeOutline(f);
}

const SPIN = new Set(['Rotate', 'Swing']);
await run({
  key: '0212-1', dex: '0212', megaForm: '0001', mega,
  facing: (name, r, c, rows) => SPIN.has(name) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r,
});
