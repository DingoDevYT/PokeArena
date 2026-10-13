// Mega Heracross (0214-1) from SpriteCollab sprite/0214: darker blue shell recoloured from the portrait,
// orange rim trim on the light shell, and a much longer horn (topmost body tip lengthened, orange base band).
// Usage: node tools/mega-custom/0214-1.mjs [Sheet ...]
import { run, hx, BLACK, N4, stats, get, set, closeOutline, remap } from '../.cache/mega-base/_lib.mjs';
const REMAP = new Map([['bfcff7', '73bae7'], ['6787af', '6091c8'], ['4f5f97', '4671ad'], ['373f8f', '283b7c'], ['dfb700', 'ffd234'], ['fff700', 'ffd234'], ['a76f00', 'c39133']].map(([a, b]) => [hx(a), hx(b)]));
const BODY = new Set(['4f5f97', '373f8f', '6787af', 'bfcff7'].map(hx));
const HORN = [hx('2c5c9d'), hx('4671ad'), hx('6091c8')];
function mega(f, dir) {
  const body = []; for (let i = 0; i < f.px.length; i++) if (BODY.has(f.px[i])) body.push(i);
  if (body.length < 40) { remap(f, REMAP); closeOutline(f); return; }
  const W = f.W, s = stats(f, body);
  // horn tip = top rows of the body; extend 7px up, tilted back, with an orange band at its base
  const top = body.filter(i => ((i / W) | 0) <= s.y0 + 1), t = stats(f, top);
  const lean = (dir === 2 || dir === 1 || dir === 3) ? -0.5 : (dir === 7 || dir === 6 || dir === 5) ? 0.5 : 0;
  for (let k = 1; k <= 7; k++) {
    const w = k > 5 ? 1 : 2, cx = Math.round(t.cx + lean * k), y = s.y0 - k;
    for (let o = -1; o < w; o++) {
      const x = cx + o, edge = o === -1 || o === w - 1;
      set(f, x, y, edge || k === 7 ? BLACK : HORN[k < 4 ? 0 : 1]);
    }
    if (k === 7) set(f, cx, y, BLACK);
  }
  for (const i of body) { const x = i % W, y = (i / W) | 0; if (f.px[i] === hx('bfcff7') && (x + y) % 3 === 0) f.px[i] = hx('ef6654'); }
  remap(f, REMAP); closeOutline(f);
}
const SPIN = new Set(['Rotate', 'Swing']);
await run({ key: '0214-1', dex: '0214', megaForm: '0001', mega, facing: (n, r, c, rows) => SPIN.has(n) ? ((r - c) % 8 + 8) % 8 : rows === 1 ? 7 : r });
