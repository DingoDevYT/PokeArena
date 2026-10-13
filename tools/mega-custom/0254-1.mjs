// Mega Sceptile (0254-1) from SpriteCollab sprite/0254. SpriteCollab already has official Mega Walk/Idle/Rotate,
// so only the other sheets are made here: portrait palette (deeper greens, red markings), a longer head blade
// and a red-tipped leaf tail blade grown from the lowest-reaching leaf side of the body.
// Usage: node tools/mega-custom/0254-1.mjs [Sheet ...]
import { run, hx, BLACK, N4, stats, get, set, closeOutline, remap } from '../.cache/mega-base/_lib.mjs';
const REMAP = new Map([['d7efa7', 'e7f6b7'], ['9fcf6f', '83bf73'], ['5fb727', '73a85f'], ['278700', '4e7d44'], ['d73f00', 'cd4b4b'], ['9f0000', '8c3434'], ['ff875f', 'e96c6c']].map(([a, b]) => [hx(a), hx(b)]));
const GREEN = new Set(['d7efa7', '9fcf6f', '5fb727', '278700'].map(hx));
function mega(f, dir) {
  const W = f.W, g = []; for (let i = 0; i < f.px.length; i++) if (GREEN.has(f.px[i])) g.push(i);
  if (g.length > 40) {
    const s = stats(f, g), top = g.filter(i => ((i / W) | 0) <= s.y0 + 1), t = stats(f, top);
    const lean = (dir >= 1 && dir <= 3) ? -0.4 : (dir >= 5) ? 0.4 : 0;
    for (let k = 1; k <= 4; k++) { const x = Math.round(t.cx + lean * k), y = s.y0 - k; set(f, x, y, BLACK); set(f, x + 1, y, k < 4 ? hx('83bf73') : BLACK); set(f, x + 2, y, BLACK); }
    // red tail tip: the lowest-left (or right) green pixel cluster gets a red end pad
    const low = g.filter(i => ((i / W) | 0) >= s.y1 - 5), l = stats(f, low), side = (l.cx < s.cx) ? -1 : 1;
    const ex = side < 0 ? l.x0 : l.x1, ey = Math.round(l.cy);
    for (let k = 1; k <= 3; k++) for (let o = 0; o < 4 - k; o++) set(f, ex + side * k, ey - 1 + o, k === 3 ? BLACK : hx(o === 0 ? 'e96c6c' : 'cd4b4b'));
  }
  remap(f, REMAP); closeOutline(f);
}
const SPIN = new Set(['Rotate', 'Swing']);
await run({ key: '0254-1', dex: '0254', megaForm: '0001', skip: new Set(['Walk', 'Idle', 'Rotate']), mega, facing: (n, r, c, rows) => SPIN.has(n) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r });
