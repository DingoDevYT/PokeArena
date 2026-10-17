// Writes a procedural 4x4-chunk test world into data/adv-test/ (world.js + chunks/<cx>_<cy>.js); the real world is data/adv/ (tools/adv-gen-region.py).
// To play it, point index.html's world.js script tag at data/adv-test/world.js.
// Exercises: grass/path/sand/water/tallgrass, 1- and 2-level plateaus with faces and rims, stairs N/E/W, S/E/W ledges,
// an E-W bridge over a stream with walkable sand under it, and props with solid rects.
// Run: node tools/adv-build-testworld.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'data', 'adv-test');
const CH = 32, CW = 4, W = CH * CW, SZ = W * W, T = 32;
const GRASS = 1, PATH = 2, SAND = 3, WATER = 4, TALL = 5;
const h = new Int8Array(SZ), mat = new Uint8Array(SZ).fill(GRASS), over = new Uint8Array(SZ), kind = new Uint8Array(SZ), deck = new Int8Array(SZ).fill(-1);
const I = (x, y) => y * W + x;
const each = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(I(x, y), x, y); };
const ell = (cx, cy, rx, ry, f) => each(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(cx + rx), Math.ceil(cy + ry), (i, x, y) => { if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) f(i, x, y); });
let seed = 20261014; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// paths: E-W trunk (rows 63-65) and N-S trunk (cols 66-68), crossing at the spawn
each(12, 63, 110, 65, i => { mat[i] = PATH; });
each(66, 30, 68, 100, i => { mat[i] = PATH; });

// pond east of the spawn with a sand beach
ell(96, 84, 10.5, 7.5, i => { if (mat[i] === GRASS) mat[i] = SAND; });
ell(96, 84, 8, 5, i => { mat[i] = WATER; });

// gully: plateaus left and right, a sandy floor with a stream, open at both ends
each(30, 52, 46, 76, i => { h[i] = 1; });
each(53, 52, 62, 76, i => { h[i] = 1; });
each(47, 52, 52, 76, (i, x) => { mat[i] = x === 49 || x === 50 ? WATER : SAND; });
each(48, 44, 51, 88, (i, x, y) => { if (y < 52 || y > 76) mat[i] = x === 49 || x === 50 ? WATER : SAND; });
ell(49.5, 92, 5.5, 3.5, i => { mat[i] = SAND; }); ell(49.5, 92, 3.5, 2, i => { mat[i] = WATER; });
// E-W bridge, deck level 1, flush with both plateaus; the sand banks below stay walkable
each(47, 63, 52, 64, i => { kind[i] = 8; deck[i] = 1; });

// stairs onto the plateaus from the trunk path: E-facing on the west end, W-facing on the east end
each(29, 63, 29, 65, i => { kind[i] = 3; mat[i] = PATH; });
each(63, 63, 63, 65, i => { kind[i] = 4; mat[i] = PATH; });
// stairs N up the south front of the right plateau
each(57, 77, 58, 77, i => { kind[i] = 1; });
// ledges: south on the left plateau, east into the gully from the left, west into the gully from the right
each(34, 76, 39, 76, i => { kind[i] = 5; });
each(46, 70, 46, 71, i => { kind[i] = 6; });
each(53, 70, 53, 71, i => { kind[i] = 7; });

// mesa: 1-level skirt, a 1-level step up to a 2-level top (1-tile face), and a 2-level block whose south face is 2 tiles tall
each(72, 34, 90, 46, i => { h[i] = 1; });
each(76, 34, 84, 40, i => { h[i] = 2; });
each(86, 40, 92, 46, i => { h[i] = 2; });
each(79, 41, 80, 41, i => { kind[i] = 1; });          // stairs N, 1 -> 2
each(80, 47, 81, 47, i => { kind[i] = 1; });          // stairs N, 0 -> 1
each(71, 40, 71, 41, i => { kind[i] = 3; });          // stairs E, 0 -> 1

// tall grass
const grassy = i => mat[i] === GRASS && h[i] === 0 && kind[i] === 0;
ell(76, 58, 7, 5, i => { if (grassy(i)) over[i] = TALL; });
ell(30, 86, 8, 5, i => { if (grassy(i)) over[i] = TALL; });
each(96, 70, 104, 74, i => { if (grassy(i)) over[i] = TALL; });
each(58, 82, 63, 87, i => { if (grassy(i)) over[i] = TALL; });

// props
const props = [];
const taken = new Set();
const put = (name, x, y, z) => { props.push(z === undefined ? [name, Math.round(x), Math.round(y)] : [name, Math.round(x), Math.round(y), z]); };
const near = (cx, cy, d, f) => { for (let y = cy - d; y <= cy + d; y++) for (let x = cx - d; x <= cx + d; x++) if (x >= 0 && y >= 0 && x < W && y < W && f(I(x, y))) return true; return false; };
for (let y = 2; y < W - 2; y++) for (let x = 2; x < W - 2; x++) {
  const i = I(x, y), dd = Math.hypot(x - 65, y - 64);
  if (mat[i] !== GRASS || over[i] || kind[i] || dd < 7 || rnd() > (h[i] ? 0.035 : 0.03)) continue;
  if (near(x, y, 2, j => mat[j] === PATH || mat[j] === SAND || mat[j] === WATER || kind[j] !== 0 || h[j] !== h[i])) continue;
  if (taken.has(i) || near(x, y, 2, j => taken.has(j))) continue;
  taken.add(i); put('pineTree', (x + 0.5) * T + (rnd() - 0.5) * 8, (y + 0.9) * T);
}
// hand-placed: ones that must be seen from the spawn, and clutter around the stairs and the bridge
put('pineTree', 70.5 * T, 67.9 * T); put('pineTree', 71.5 * T, 61.9 * T); put('boulder', 64.5 * T, 68.2 * T); put('sign', 65 * T, 62.2 * T);
put('boulder', 55.5 * T, 78.6 * T); put('boulder', 60.5 * T, 78.4 * T); put('sign', 59.5 * T, 77.4 * T);
put('pineTree', 56.5 * T, 70.9 * T); put('pineTree', 58.5 * T, 56.9 * T); put('pineTree', 37.5 * T, 58.9 * T); put('pineTree', 41.5 * T, 70.9 * T);
put('pineTree', 80.5 * T, 38.9 * T); put('pineTree', 74.5 * T, 38.9 * T); put('boulder', 88.5 * T, 43.4 * T);
for (const [bx, by] of [[73, 56], [79, 60], [30, 83], [34, 89], [99, 72], [61, 85], [67.5, 58]]) put('bush', (bx + 0.5) * T, (by + 0.7) * T);

fs.mkdirSync(path.join(OUT, 'chunks'), { recursive: true });
const hasDeck = deck.some(v => v >= 0);
for (let cy = 0; cy < CW; cy++) for (let cx = 0; cx < CW; cx++) {
  const cut = a => { const o = []; for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) o.push(a[I(cx * CH + x, cy * CH + y)]); return JSON.stringify(o); };
  const ps = props.filter(p => Math.floor(p[1] / (CH * T)) === cx && Math.floor(p[2] / (CH * T)) === cy);
  const d = [`h:${cut(h)}`, `mat:${cut(mat)}`, `over:${cut(over)}`, `kind:${cut(kind)}`];
  if (hasDeck) d.push(`deck:${cut(deck)}`);
  d.push(`props:${JSON.stringify(ps)}`);
  fs.writeFileSync(path.join(OUT, 'chunks', `${cx}_${cy}.js`), `// Generated by tools/adv-build-testworld.mjs\nADV.chunk(${cx}, ${cy}, { ${d.join(', ')} });\n`);
}
fs.writeFileSync(path.join(OUT, 'world.js'), `// Generated by tools/adv-build-testworld.mjs. spawn is in world px.\nwindow.ADV_WORLD = ${JSON.stringify({ name: 'Test Region', dir: 'data/adv-test', chunksW: CW, chunksH: CW, palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'], spawn: { x: 65 * T + 16, y: 64 * T + 16 }, wild: [{ species: 'wooloo', level: 8, x: 74 * T + 16, y: 64 * T + 16 }], towns: {} }, null, 1)};\n`);
console.log(`wrote ${CW * CW} chunks, ${props.length} props`);
