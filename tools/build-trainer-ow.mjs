// Builds assets/trainer-ow/<id>.png + data/trainer-ow.js from HGSS overworld textures.
// Source: pret/pokeheartgold files/data/mmodel/mmodel/mmodel_XXXXXXXX.NSBTX (cached in tools/.cache/ow/nsbtx).
// Each NSBTX holds 16 walk frames of 32x32 4bpp: tex 1-4 up, 5-8 down, 9-12 left, 13-16 right; per dir: stand, step, stand, step.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools/.cache/ow/nsbtx');
const OUT = path.join(ROOT, 'assets/trainer-ow');
const SRC = 'https://raw.githubusercontent.com/pret/pokeheartgold/master/files/data/mmodel/mmodel/';

// id -> HGSS MMODEL index (include/constants/mmodel.h). Substitutes marked.
const CHARS = {
  red: 170, blue: 169, brock: 167, misty: 164, ltsurge: 162, erika: 165, koga: 155, sabrina: 163,
  blaine: 168, giovanni: 225, bruno: 156, lance: 158, oak: 160, ethan: 69, lyra: 70,
  lorelei: 124, // sub: GSWOMAN2 (long-haired woman); Lorelei has no Gen 4 overworld
  agatha: 19,   // sub: OLDWOMAN1 (grey bun); Agatha has no Gen 4 overworld
  leaf: 70,     // sub: Lyra; Leaf has no Gen 4/5 overworld
  kris: 125,    // sub: GSWOMAN3 (dark hair buns); Kris has no Gen 4/5 overworld
};
// S1: every overworld NPC and trainer-class sheet the Goldacre/route/interior work needs (same index space; a sheet that does not decode is skipped with a warning)
const NPCS = {
  babyboy: 0, babygirl: 1, boy1: 2, boy2: 3, boy3: 4, girl1: 5, girl2: 6, girl3: 7, man1: 8, man2: 9, man3: 10, man5: 11, woman1: 12, woman2: 13, woman3: 14, woman5: 15,
  middleman: 16, middlewoman: 17, oldman: 18, oldwoman: 19, shopm: 23, shopw: 24, assistantm: 25, assistantw: 26, bigman: 34, mount: 35, badman: 36, policeman: 37, gentleman: 39, lady: 40,
  workman: 41, farmer: 42, cowgirl: 43, artist: 45, sportsman: 46, explore: 47, fighter: 48, campboy: 49, picnicgirl: 50, fishing: 51, seaman: 53, doctor: 54, maid: 55, delivery: 56,
  gsboy1: 67, gsboy2: 115, gsboy3: 116, gsgirl1: 117, gsgirl2: 118, gsgirl3: 119, gsman1: 120, gsman2: 121, gsman3: 122, gswoman1: 123, gsmiddleman: 126, gsoldman: 128, gsoldwoman: 129, gsbigman: 130,
  mount2: 131, shopm2: 132, nurse: 133, gsgentleman: 137, gsfighter: 140, campboy2: 141, picnicgirl2: 142, fishing2: 143, seaman2: 144, whitney: 148, gsmama: 159,
};
const ROWS = ['down', 'up', 'left', 'right'];
const SRC_GROUP = { up: 0, down: 1, left: 2, right: 3 };
const FW = 32, FH = 32, FRAMES = 4;

function dict(b, o) {
  const n = b[o + 1];
  let p = o + 12 + 4 * n;
  const esz = b.readUInt16LE(p); p += 4;
  const names = [];
  for (let i = 0; i < n; i++) names.push(b.toString('latin1', p + n * esz + i * 16, p + n * esz + i * 16 + 16).replace(/\0.*$/, ''));
  return names.map((name, i) => ({ name, e: p + i * esz }));
}

function decode(b) {
  if (b.toString('latin1', 0, 4) !== 'BTX0') throw new Error('not BTX0');
  const T = b.readUInt32LE(16);
  const texData = T + b.readUInt32LE(T + 0x14), palData = T + b.readUInt32LE(T + 0x38);
  const po = palData + (b.readUInt16LE(dict(b, T + b.readUInt32LE(T + 0x34))[0].e) << 3);
  const pal = [];
  for (let i = 0; i < 16; i++) { const c = b.readUInt16LE(po + i * 2); pal.push([(c & 31) * 255 / 31 | 0, (c >> 5 & 31) * 255 / 31 | 0, (c >> 10 & 31) * 255 / 31 | 0]); }
  const texs = dict(b, T + b.readUInt16LE(T + 0x0E)).map(({ name, e }) => {
    const off = texData + (b.readUInt16LE(e) << 3), prm = b.readUInt16LE(e + 2);
    if ((8 << (prm >> 4 & 7)) !== FW || (8 << (prm >> 7 & 7)) !== FH || (prm >> 10 & 7) !== 3) throw new Error('unexpected tex ' + name);
    const px = new Uint8Array(FW * FH);
    for (let k = 0; k < px.length; k++) px[k] = (b[off + (k >> 1)] >> ((k & 1) * 4)) & 15;
    return { n: +name.split('.').pop(), px };
  }).sort((a, c) => a.n - c.n);
  return { pal, texs };
}

async function load(idx) {
  const f = path.join(CACHE, `mmodel_${String(idx).padStart(8, '0')}.NSBTX`);
  if (!fs.existsSync(f)) {
    const r = await fetch(SRC + path.basename(f));
    if (!r.ok) throw new Error(`${r.status} ${f}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await new Promise(res => setTimeout(res, 200));
  }
  return decode(fs.readFileSync(f));
}

function blit(dst, dw, dx, dy, { px }, pal, s = 1) {
  for (let k = 0; k < px.length; k++) {
    if (!px[k]) continue;
    const [r, g, b] = pal[px[k]];
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
      const o = ((dy + (k >> 5) * s + yy) * dw + dx + (k & 31) * s + xx) * 4;
      dst.data[o] = r; dst.data[o + 1] = g; dst.data[o + 2] = b; dst.data[o + 3] = 255;
    }
  }
}


fs.mkdirSync(OUT, { recursive: true });
const meta = {}, downs = [], skipped = [], all = { ...CHARS, ...NPCS }, ids = [];
for (const id of Object.keys(all)) {
  let L; try { L = await load(all[id]); if (L.texs.length < 16) throw new Error('only ' + L.texs.length + ' frames'); } catch (e) { if (CHARS[id]) throw new Error(id + ': ' + e.message); skipped.push(id + ' (' + e.message + ')'); continue; }
  const { pal, texs } = L;
  const png = new PNG({ width: FW * FRAMES, height: FH * ROWS.length });
  ROWS.forEach((dir, r) => { for (let f = 0; f < FRAMES; f++) blit(png, png.width, f * FW, r * FH, texs[SRC_GROUP[dir] * 4 + f], pal); });
  fs.writeFileSync(path.join(OUT, `${id}.png`), PNG.sync.write(png));
  const down0 = texs[SRC_GROUP.down * 4];
  let footY = 0;
  for (let k = 0; k < down0.px.length; k++) if (down0.px[k]) footY = k >> 5;
  meta[id] = { file: `assets/trainer-ow/${id}.png`, fw: FW, fh: FH, frames: FRAMES, rows: ROWS, footY };
  downs.push([down0, pal]); ids.push(id);
}
fs.writeFileSync(path.join(ROOT, 'data/trainer-ow.js'),
  '// Generated by tools/build-trainer-ow.mjs (HGSS overworld sprites, pret/pokeheartgold).\nwindow.TRAINER_OW = ' + JSON.stringify(meta, null, 1) + ';\n');

// Contact sheet: down frame 0 of each id at 4x on grey, in build order (wrapped to 24 per row).
const S = 4, CW = FW * S + 8, PER = 24, RH = FH * S + 8;
const sheet = new PNG({ width: CW * Math.min(PER, ids.length), height: RH * Math.ceil(ids.length / PER) });
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = sheet.data[i + 1] = sheet.data[i + 2] = 96; sheet.data[i + 3] = 255; }
downs.forEach(([t, pal], i) => blit(sheet, sheet.width, (i % PER) * CW + 4, Math.floor(i / PER) * RH + 4, t, pal, S));
fs.writeFileSync(path.join(OUT, '_preview.png'), PNG.sync.write(sheet));

const js = fs.readFileSync(path.join(ROOT, 'data/trainer-ow.js'), 'utf8');
const win = {}; new Function('window', js)(win);
for (const id of ids) {
  const m = win.TRAINER_OW[id];
  if (!m || m.footY < 20 || m.footY > 31 || !fs.existsSync(path.join(ROOT, m.file))) throw new Error('bad meta ' + id);
}
console.log(`trainer-ow OK: ${ids.length} sheets`, skipped.length ? 'skipped: ' + skipped.join(', ') : '');
