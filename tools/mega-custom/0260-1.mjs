// Mega Swampert (0260-1) from SpriteCollab sprite/0260: portrait palette (deeper blue, charcoal fins, salmon
// orange pads) and every orange patch grown by one ring so the arm and cheek pads read bigger.
// Usage: node tools/mega-custom/0260-1.mjs [Sheet ...]
import { run, hx, BLACK, N4, get, set, closeOutline, remap } from '../.cache/mega-base/_lib.mjs';
const REMAP = new Map([['1f9fe7', '479fdf'], ['0067b7', '4680a9'], ['7f8f97', '58595d'], ['afb7bf', '767b7a'], ['47676f', '2c3a41'], ['d73f00', 'dd6953'], ['ff875f', 'e7836b'], ['bf7727', 'a24024'], ['dfaf67', 'e7e7af']].map(([a, b]) => [hx(a), hx(b)]));
const ORANGE = new Set(['d73f00', 'bf7727', 'ff875f'].map(hx));
function mega(f) {
  const add = [];
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const c = get(f, x, y); if (c !== hx('1f9fe7') && c !== hx('0067b7')) continue;
    if (N4.some(([dx, dy]) => ORANGE.has(get(f, x + dx, y + dy))) && (x + y) % 2) add.push([x, y]);
  }
  for (const [x, y] of add) set(f, x, y, hx('d73f00'));
  remap(f, REMAP); closeOutline(f);
}
const SPIN = new Set(['Rotate', 'Swing']);
await run({ key: '0260-1', dex: '0260', megaForm: '0001', mega, facing: (n, r, c, rows) => SPIN.has(n) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r });
