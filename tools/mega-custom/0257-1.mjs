// Mega Blaziken (0257-1) from SpriteCollab sprite/0257: portrait palette (sand fur, deeper red), grey claws
// turn to bright steel and a flame plume is added above every claw blob.
// Usage: node tools/mega-custom/0257-1.mjs [Sheet ...]
import { run, hx, BLACK, comps, stats, get, set, closeOutline, remap } from '../.cache/mega-base/_lib.mjs';
const REMAP = new Map([['ffe79f', 'f8e8a0'], ['d7a700', 'c8b070'], ['9f0000', 'a04838'], ['ff570f', 'd04820'], ['df771f', 'f88868'], ['a75f1f', 'a04838'], ['9f9f9f', 'd7e7df'], ['6f6f6f', 'a8d0b0']].map(([a, b]) => [hx(a), hx(b)]));
const FL = [hx('f8d800'), hx('f88868'), hx('d04820')];
const FLAME = ['..y..', '.yoy.', '.yoRy', 'yooRR', 'yoRR.'];
function mega(f, dir) {
  const W = f.W, claws = comps(f, c => c === hx('9f9f9f') || c === hx('6f6f6f')).map(b => stats(f, b)).filter(b => b.n >= 3 && b.n <= 40);
  for (const c of claws) {
    const ox = Math.round(c.cx) - 2, oy = c.y0 - 5;
    FLAME.forEach((row, py) => [...row].forEach((ch, px) => { if (ch === '.') return; const x = ox + px, y = oy + py; if (get(f, x, y) < 0) set(f, x, y, ch === 'y' ? FL[0] : ch === 'o' ? FL[1] : FL[2]); }));
  }
  remap(f, REMAP); closeOutline(f);
}
const SPIN = new Set(['Rotate', 'Swing']);
await run({ key: '0257-1', dex: '0257', megaForm: '0001', mega, facing: (n, r, c, rows) => SPIN.has(n) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r });
