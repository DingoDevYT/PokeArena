// Builds data/world.js (ARENAS, TRAINERS, MUSIC, PLAYER_SPRITES) plus assets/arena, assets/trainer, assets/music.
// Run from project root: node tools/build-world.mjs
import { Dex, toID } from '@pkmn/dex';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import zlib from 'zlib';

const CACHE = 'tools/.cache/world';
const RAW_ASSET = 'https://raw.githubusercontent.com/PMDCollab/RawAsset/master';
const RAW_DUMP = 'https://raw.githubusercontent.com/audinowho/DumpAsset/master';
const SD = 'https://play.pokemonshowdown.com';
for (const d of [CACHE, 'data', 'assets/arena', 'assets/trainer', 'assets/music']) fs.mkdirSync(d, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, file) {
  if (file && fs.existsSync(file)) return fs.readFileSync(file);
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'pokearena-build' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const body = Buffer.from(await r.arrayBuffer());
      if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); }
      return body;
    } catch (e) {
      if (i >= 4) throw e;
      await sleep(500 * 2 ** i);
    }
  }
}
async function pool(items, fn, n = 4) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// ---------- arenas ----------
// DTEF sheets: 3 sections (Wall, Secondary, Floor) of 6x8 tiles; cell order maps to PMDO neighbour masks.
// Mask bits: 1 S, 2 W, 4 N, 8 E, 16 SW, 32 NW, 64 NE, 128 SE (diagonals only count when both sides match).
const DTEF_MAP = [
  0x89, 0x9B, 0x13, 0x09, 0x0A, 0x03, 0xCD, 0xFF, 0x37, 0x05, 0x00, 0x06,
  0x4C, 0x6E, 0x26, 0x0C, 0x01, -1, 0x3F, 0xCF, 0x0B, 0x08, 0x0F, 0x02,
  0x9F, 0x6F, 0x0E, 0x0D, 0x04, 0x07, 0x7F, 0xEF, 0x4D, 0x27, 0x1B, 0x8B,
  0xBF, 0xDF, 0x8D, 0x17, 0x2E, 0x4E, 0x8F, 0x1F, 0x4F, 0x2F, 0x5F, 0xAF,
];
const T = 24, WALL = 0, SEC = 1, FLOOR = 2;
// Arena art is authored at 1x and pixel-doubled, so one art pixel = PX world px, the same as the mons' 2x sprites.
// Every arena has the same fighting area: FIGHT_W x FIGHT_H world px inside a `wall`-wide decorated border.
const PX = 2, FIGHT_W = 864, FIGHT_H = 576;
// PMD arenas: 24px DTEF tiles (48 world px). Playable rectangle PC x PR tiles inside a PAD-tile border.
const PC = FIGHT_W / PX / T, PR = FIGHT_H / PX / T, PAD = 3, COLS = PC + PAD * 2, ROWS = PR + PAD * 2;
const W1 = COLS * T, H1 = ROWS * T;

let seed = 1;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth value noise over the tile grid, cell size `sc` tiles, returns 0..1.
function noise(sc) {
  const gw = Math.ceil(COLS / sc) + 2, g = Array.from({ length: gw * (Math.ceil(ROWS / sc) + 2) }, rand), s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = s(fx - ix), ty = s(fy - iy), i = iy * gw + ix;
    return lerp(lerp(g[i], g[i + 1], tx), lerp(g[i + gw], g[i + gw + 1], tx), ty);
  };
}
function doubled(src) {
  const o = new PNG({ width: src.width * PX, height: src.height * PX });
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
    const i = (Math.floor(y / PX) * src.width + Math.floor(x / PX)) * 4;
    o.data.set(src.data.subarray(i, i + 4), (y * o.width + x) * 4);
  }
  return o;
}

async function loadTileset(name) {
  const out = [];
  for (const v of ['tileset_0', 'tileset_1', 'tileset_2']) {
    const buf = await get(`${RAW_ASSET}/TileDtef/${name}/${v}.png`, `${CACHE}/tile/${name}/${v}.png`);
    if (buf) out.push(PNG.sync.read(buf));
  }
  return out;
}
const tileXY = (section, mask) => { const i = DTEF_MAP.indexOf(mask); return [(section * 6 + (i % 6)) * T, Math.floor(i / 6) * T]; };
function blank(png, sx, sy) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (png.data[((sy + y) * png.width + sx + x) * 4 + 3]) return false;
  return true;
}
function pickTile(sheets, section, mask, p = 0.35) {
  const [sx, sy] = tileXY(section, mask);
  const c = sheets.filter((s, i) => i === 0 || !blank(s, sx, sy));
  const v = c.length > 1 && rand() < p ? c[1 + Math.floor(rand() * (c.length - 1))] : c[0];
  return [v, sx, sy];
}
function normMask(m) {
  if ((m & 3) !== 3) m &= ~0x10;
  if ((m & 6) !== 6) m &= ~0x20;
  if ((m & 12) !== 12) m &= ~0x40;
  if ((m & 9) !== 9) m &= ~0x80;
  return m;
}
const NB = [[0, 1, 1], [-1, 0, 2], [0, -1, 4], [1, 0, 8], [-1, 1, 16], [-1, -1, 32], [1, -1, 64], [1, 1, 128]];
function maskAt(isSame, x, y) {
  let m = 0;
  for (const [dx, dy, b] of NB) if (isSame(x + dx, y + dy)) m |= b;
  return normMask(m);
}

// Autotiled patch of `section` tiles in the given shape (corners/edges from the autotile set).
const PATCH = ['##', '##'];
function blob(sheets, section, shape = PATCH) {
  const w = shape[0].length, h = shape.length, out = new PNG({ width: w * T, height: h * T });
  const inside = (x, y) => shape[y]?.[x] === '#';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const [s, sx, sy] = pickTile(sheets, section, maskAt(inside, x, y));
    PNG.bitblt(s, out, sx, sy, T, T, x * T, y * T);
  }
  return out;
}
// Boulder: one isolated wall tile (mask 0) with the floor around it cleared.
function boulder(sheets) {
  const [s, sx, sy] = pickTile(sheets, WALL, 0x00);
  const t = new PNG({ width: T, height: T });
  PNG.bitblt(s, t, sx, sy, T, T, 0, 0);
  return clearOutside(t, floorPalette(sheets));
}
const edgeClear = (img) => {
  const pal = new Set(), { width: w, height: h, data } = img;
  for (let x = 0; x < w; x++) pal.add(rgb(data, x * 4)).add(rgb(data, ((h - 1) * w + x) * 4));
  for (let y = 0; y < h; y++) pal.add(rgb(data, y * w * 4)).add(rgb(data, (y * w + w - 1) * 4));
  return clearOutside(img, pal);
};
const rgb = (d, o) => (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
function floorPalette(sheets) {
  const pal = new Set(), [fx, fy] = tileXY(FLOOR, 0xFF);
  for (const s of sheets) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const o = ((fy + y) * s.width + fx + x) * 4;
    if (s.data[o + 3]) pal.add(rgb(s.data, o));
  }
  return pal;
}
// Flood-fills palette-coloured pixels inward from the image border and makes them transparent.
function clearOutside(img, pal) {
  const { width: w, height: h, data } = img, seen = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const i = st.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    if (!data[i * 4 + 3] || pal.has(rgb(data, i * 4))) {
      data[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1);
      if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
    }
  }
  return img;
}

// Obstacle x/y are world px from the fighting area's top-left; each is mirrored left/right unless centred (x = 432).
// PMD arenas (tileset = PMDO DTEF set): style 'cave' = organic walls with alcoves, 'geo' = symmetric architecture;
//   sec = where the secondary terrain (water / lava / crystal floor) goes; pillars = lone boulders in the border;
//   deco = PMDO ground objects (big ones in the border only, flowers on border floor and the play edge).
// FRLG arenas (frlg = layout id from pret/pokefirered): rooms stretched to arena size, see frlgArena().
const ARENA_DEFS = [
  { id: 'cave', name: 'Mt. Steel Cave', tileset: 'MtSteel1', grass: 'TallGrassDark', music: 'hgss-kanto-trainer',
    style: 'cave', sec: 'pools', secT: 0.6, pillars: 4,
    obstacles: [['rock', 282, 162], ['rock', 282, 414], ['grass', 152, 70], ['puddle', 432, 288]] },
  { id: 'field', name: 'Lush Prairie', tileset: 'LushPrairie', grass: 'TallGrass', rock: 'Trunk_Large.None', music: 'xy-trainer',
    style: 'cave', sec: 'pools', secT: 0.7, open: 2,
    deco: { big: [['Tree_Town.Flip', 4]], small: [['Flowers_Town_3.Flip', 12], ['Flowers_Tropical_1.Flip', 7]] },
    obstacles: [['grass', 262, 142], ['grass', 262, 434], ['rock', 432, 288], ['puddle', 432, 80]] },
  { id: 'gym', name: 'Temporal Tower', tileset: 'TemporalTower', grass: 'TallGrass', music: 'oras-trainer',
    style: 'geo', sec: 'corners', fvar: 0,
    obstacles: [['rock', 312, 142], ['rock', 312, 434], ['rock', 182, 72], ['puddle', 432, 288]] },
  { id: 'beach', name: 'Beach Cave', tileset: 'BeachCave', grass: 'TallGrassYellow', music: 'sm-trainer',
    style: 'cave', sec: 'shore', secT: 0.72, pillars: 3, fvar: 0.25,
    obstacles: [['puddle', 282, 152], ['puddle', 282, 424], ['rock', 432, 202], ['rock', 432, 374], ['grass', 142, 70]] },
  { id: 'forest', name: 'Apple Woods', tileset: 'AppleWoods', grass: 'TallGrass', rock: 'Trunk_Large.None', music: 'hgss-johto-trainer',
    style: 'cave', sec: 'pools', secT: 0.68, open: 1.9, fvar: 0.25,
    deco: { big: [['Tree_Town.Flip', 4], ['Logs_Large.Flip', 1], ['Trunk_Small.None', 2]], small: [['Flowers_Tropical_1.Flip', 9], ['Flowers_Town_3.Flip', 5]] },
    obstacles: [['grass', 260, 140], ['grass', 260, 436], ['rock', 432, 288], ['puddle', 150, 476], ['grass', 432, 84]] },
  { id: 'volcano', name: 'Magma Cavern', tileset: 'MagmaCavern3', grass: 'TallGrassYellow', music: 'dpp-trainer',
    style: 'cave', sec: 'rivers', secT: 0.74, pillars: 3, light: 0.1, fvar: 0.2,
    obstacles: [['rock', 290, 170], ['rock', 290, 406], ['rock', 432, 288], ['grass', 160, 70], ['grass', 432, 500]] },
  { id: 'lorelei', name: "Lorelei's Room", frlg: 'LAYOUT_POKEMON_LEAGUE_LORELEIS_ROOM', room: 'league', music: 'xy-rival',
    obstacles: [['rock', 300, 170], ['rock', 300, 420], ['rock', 170, 100], ['rock', 170, 490]] },
  { id: 'bruno', name: "Bruno's Room", frlg: 'LAYOUT_POKEMON_LEAGUE_BRUNOS_ROOM', room: 'league', music: 'oras-rival',
    obstacles: [['rock', 300, 170], ['rock', 300, 420], ['rock', 432, 96], ['rock', 432, 496]] },
  { id: 'agatha', name: "Agatha's Room", frlg: 'LAYOUT_POKEMON_LEAGUE_AGATHAS_ROOM', room: 'league', music: 'sm-rival',
    obstacles: [['rock', 250, 140], ['rock', 250, 450], ['rock', 340, 288]] },
  { id: 'pewter', name: 'Pewter Gym', frlg: 'LAYOUT_PEWTER_CITY_GYM', room: 'pewter', music: 'bw2-kanto-gym-leader',
    obstacles: [['rock', 280, 150], ['rock', 280, 430], ['rock', 432, 220], ['rock', 432, 360], ['rock', 150, 80]] },
  { id: 'viridian', name: 'Viridian Forest', frlg: 'LAYOUT_VIRIDIAN_FOREST', room: 'forest', music: 'hgss-kanto-trainer',
    obstacles: [['grass', 270, 140], ['grass', 270, 436], ['rock', 432, 300], ['grass', 140, 80], ['grass', 432, 90]] },
];

const outX = (x) => Math.max(PAD - x, x - (PAD + PC - 1), 0), outY = (y) => Math.max(PAD - y, y - (PAD + PR - 1), 0);
const outD = (x, y) => Math.hypot(outX(x), outY(y)); // tiles outside the playable rectangle (0 = inside)
const eachCell = (f) => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) f(x, y); };
const BAND = PAD - 1; // deepest border ring that can open up; the outermost ring stays wall

// Tile grid of WALL / SEC / FLOOR. The playable rectangle is always FLOOR.
function layout(def) {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(WALL));
  const n1 = noise(2), n2 = noise(2.5), n3 = noise(2), open = def.open ?? 1.6;
  const disc = (cx, cy, r, t) => eachCell((x, y) => { if (Math.hypot(x - cx, y - cy) <= r && outD(x, y) <= BAND) g[y][x] = t; });
  if (def.style === 'geo') {
    // tower hall: 1-tile walkway round the arena, 2-wide bays between wall buttresses, symmetric both ways
    eachCell((x, y) => {
      const d = Math.max(outX(x), outY(y)), along = outX(x) ? Math.min(y, ROWS - 1 - y) : Math.min(x, COLS - 1 - x);
      if (d <= 1 || (d === 2 && !(outX(x) && outY(y)) && (along % 4) >= 2)) g[y][x] = FLOOR;
    });
  } else {
    eachCell((x, y) => { const d = outD(x, y); if (d === 0 || (d <= BAND && d < 0.5 + open * n1(x, y))) g[y][x] = FLOOR; });
    for (let i = 0; i < 4; i++) { // deeper alcoves
      const side = Math.floor(rand() * 4), a = rand();
      const [cx, cy] = side < 2 ? [PAD + a * PC, side ? PAD + PR + 0.6 : PAD - 1.6] : [side === 2 ? PAD - 1.6 : PAD + PC + 0.6, PAD + a * PR];
      disc(cx, cy, 0.9 + rand() * 0.6, FLOOR);
    }
    // nooks behind the sideline trainers (render.js stands them at wall + 18, mid height)
    disc(PAD - 1.4, ROWS / 2 - 0.5, 1.5, FLOOR); disc(PAD + PC + 0.4, ROWS / 2 - 0.5, 1.5, FLOOR);
    for (let it = 0; it < 2; it++) { // smooth the outline
      const c = g.map((r) => r.slice());
      eachCell((x, y) => {
        const d = outD(x, y); if (d === 0 || d > BAND) return;
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && (c[y + dy]?.[x + dx] ?? WALL) === WALL) n++;
        if (n >= 6) g[y][x] = WALL; else if (n <= 2) g[y][x] = FLOOR;
      });
    }
  }
  // secondary terrain, never inside the playable rectangle
  const secT = def.secT ?? 0.7;
  if (def.sec === 'pools' || def.sec === 'shore' || def.sec === 'rivers')
    eachCell((x, y) => { const d = outD(x, y); if (d >= 1 && d <= PAD && n2(x, y) > secT) g[y][x] = SEC; });
  if (def.sec === 'shore') { // the sea along the bottom edge, shoreline wobbling just below the arena
    for (let x = 0; x < COLS; x++) for (let y = PAD + PR + Math.round(n3(x, 0) * 1.4); y < ROWS; y++) if (outD(x, y) >= 1) g[y][x] = SEC;
  }
  if (def.sec === 'rivers') { // lava streams across the top and bottom border
    for (let x = 0; x < COLS; x++) for (const yc of [PAD - 1.8 + (n1(x, 3) - 0.5) * 1.2, PAD + PR + 0.8 + (n1(x, 14) - 0.5) * 1.2])
      for (let y = 0; y < ROWS; y++) if (Math.abs(y - yc) <= 0.9 && outD(x, y) >= 1) g[y][x] = SEC;
  }
  if (def.sec === 'corners') for (const [cx, cy] of [[0, 0], [COLS - 2, 0], [0, ROWS - 2], [COLS - 2, ROWS - 2]])
    for (let y = cy; y < cy + 2; y++) for (let x = cx; x < cx + 2; x++) g[y][x] = SEC;
  const at = (x, y) => g[clamp(y, 0, ROWS - 1)][clamp(x, 0, COLS - 1)];
  for (let it = 0; it < 3; it++) eachCell((x, y) => { // drop secondary specks and 1-wide strands
    if (g[y][x] !== SEC) return;
    const h = (at(x - 1, y) === SEC) + (at(x + 1, y) === SEC), v = (at(x, y - 1) === SEC) + (at(x, y + 1) === SEC);
    if (!h || !v) g[y][x] = outD(x, y) <= 1.5 ? FLOOR : WALL;
  });
  for (let i = 0, tries = 0; i < (def.pillars || 0) && tries < 2000; tries++) { // lone boulders on border floor
    const x = Math.floor(rand() * COLS), y = Math.floor(rand() * ROWS);
    if (outD(x, y) < 1 || Math.abs(y - ROWS / 2) < 2) continue;
    let ok = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === SEC) ok = false;
    if (ok && g[y][x] === FLOOR && at(x, y + 1) === FLOOR && at(x - 1, y) !== WALL && at(x + 1, y) !== WALL) { g[y][x] = WALL; i++; }
  }
  eachCell((x, y) => { if (outD(x, y) === 0) g[y][x] = FLOOR; });
  return g;
}

function paint(g, sheets, fvar = 0.45) {
  const bg = new PNG({ width: W1, height: H1 }), fv = noise(2);
  const at = (x, y) => g[clamp(y, 0, ROWS - 1)][clamp(x, 0, COLS - 1)];
  eachCell((x, y) => {
    const t = g[y][x], p = t === FLOOR ? (fv(x, y) > 0.66 ? fvar : fvar / 15) : 0.3; // floor variants come in patches
    const [s, sx, sy] = pickTile(sheets, t, maskAt((a, b) => at(a, b) === t, x, y), p);
    PNG.bitblt(s, bg, sx, sy, T, T, x * T, y * T);
  });
  return bg;
}

// Pixel distance to the nearest set pixel (two-pass chamfer).
function chamfer(mask, w, h) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : 1e6;
  const R2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (x) v = Math.min(v, d[i - 1] + 1);
    if (y) { v = Math.min(v, d[i - w] + 1); if (x) v = Math.min(v, d[i - w - 1] + R2); if (x < w - 1) v = Math.min(v, d[i - w + 1] + R2); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + R2); if (x) v = Math.min(v, d[i + w - 1] + R2); }
    d[i] = v;
  }
  return d;
}
// Baked light (1x art px): walls fade into darkness away from the floor, soft contact shadow where floor meets wall,
// a gentle lift on the centre of the fight and a slight falloff on the border floor.
function shade(bg, g, def) {
  const w = bg.width, h = bg.height, isW = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) isW[i] = g[Math.floor(i / w / T)][Math.floor((i % w) / T)] === WALL ? 1 : 0;
  const toWall = chamfer(isW, w, h), toOpen = chamfer(isW.map((v) => 1 - v), w, h), lift = def.light ?? 0.08;
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w);
    let k = isW[i] ? 1 - 0.5 * clamp((toOpen[i] - 4) / 40, 0, 1) : 1 - 0.22 * (1 - clamp(toWall[i] / 9, 0, 1)) ** 2;
    k *= vignette(x, y, w, h, lift);
    for (let c = 0; c < 3; c++) bg.data[i * 4 + c] = clamp(Math.round(bg.data[i * 4 + c] * k), 0, 255);
  }
}
const vignette = (x, y, w, h, lift) => {
  const e = ((x - w / 2) / (FIGHT_W / PX * 0.62)) ** 2 + ((y - h / 2) / (FIGHT_H / PX * 0.62)) ** 2;
  return (1 + lift * Math.max(0, 1 - e)) * (1 - 0.1 * clamp(e - 1.3, 0, 1));
};

async function objImg(name) {
  const im = PNG.sync.read(await get(`${RAW_ASSET}/Object/${name}.png`, `${CACHE}/obj/${name}.png`));
  if (im.width <= im.height) return im;
  const f = new PNG({ width: im.height, height: im.height }); // animation strip: first square frame
  PNG.bitblt(im, f, 0, 0, im.height, im.height, 0, 0);
  return f;
}
async function decorate(bg, g, def) {
  if (!def.deco) return;
  const p = PAD * T + 10; // big scenery may overlap the fight's outer 10 art px at most
  const keep = [[p, p, PC * T - 20, PR * T - 20]];
  const free = (x, y, w, h) => keep.every(([a, b, c, d]) => x + w <= a || x >= a + c || y + h <= b || y >= b + d);
  for (const [name, n] of def.deco.big || []) {
    const im = await objImg(name);
    for (let placed = 0, tries = 0; placed < n && tries < 4000; tries++) {
      const x = Math.floor(rand() * (W1 - im.width + 40)) - 20, y = Math.floor(rand() * (H1 - im.height + 44)) - 28; // may poke off the map edge
      const cx = Math.floor((x + im.width / 2) / T), cy = Math.floor((y + im.height - 4) / T);
      if (g[cy]?.[cx] === SEC || g[cy]?.[cx] === undefined || !free(x - 3, y - 3, im.width + 6, im.height + 6)) continue;
      over(im, bg, x, y); keep.push([x, y, im.width, im.height]); placed++;
    }
  }
  for (const [name, n] of def.deco.small || []) {
    const im = await objImg(name);
    for (let placed = 0, tries = 0; placed < n && tries < 3000; tries++) {
      const cx = Math.floor(rand() * COLS), cy = Math.floor(rand() * ROWS), d = outD(cx, cy);
      if (g[cy][cx] !== FLOOR) continue;
      if (d === 0 && Math.min(cx - PAD, PAD + PC - 1 - cx, cy - PAD, PAD + PR - 1 - cy) > 0) continue; // only the play edge
      const x = cx * T + Math.floor(rand() * 6) - 3 + (T - im.width) / 2, y = cy * T + Math.floor(rand() * 6) - 3 + (T - im.height) / 2;
      if (!free(x, y, im.width, im.height) && d > 0) continue;
      over(im, bg, Math.round(x), Math.round(y)); placed++;
    }
  }
}

// Returns 1x art: { art, wall (art px), props: { rock, puddle?, grass? } }.
async function pmdArena(def) {
  const sheets = await loadTileset(def.tileset);
  const g = layout(def), art = paint(g, sheets, def.fvar);
  await decorate(art, g, def);
  shade(art, g, def);
  const props = {
    rock: def.rock ? PNG.sync.read(await get(`${RAW_ASSET}/Object/${def.rock}.png`, `${CACHE}/obj/${def.rock}.png`)) : boulder(sheets),
    puddle: edgeClear(blob(sheets, SEC)),
    grass: blob(await loadTileset(def.grass), 0),
  };
  return { art, wall: PAD * T, props };
}

// ---------- FRLG (pret/pokefirered) ----------
// Gen 3 maps: 16px metatiles of 8x8 4bpp tiles; tiles.png is indexed and recoloured by JASC .pal files.
const FRLG = 'https://raw.githubusercontent.com/pret/pokefirered/master';
const frlgGet = async (p) => { const b = await get(`${FRLG}/${p}`, `${CACHE}/frlg/${p}`); if (!b) throw new Error(`missing ${p}`); return b; };
// Minimal indexed-PNG decoder (pngjs only hands back RGBA, and the game palettes live in separate files).
function readIndexed(buf) {
  let o = 8, w, h, bd; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; }
    if (type === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = Math.ceil(w * bd / 8), px = new Uint8Array(w * h);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i ? line[i - 1] : 0, b = prev[i], c = i ? prev[i - 1] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
    for (let x = 0; x < w; x++) px[y * w + x] = bd === 8 ? line[x] : (line[x >> 1] >> (x & 1 ? 0 : 4)) & 15;
    prev = line;
  }
  return { w, h, px };
}
const readPal = (txt) => txt.toString().trim().split(/\r?\n/).slice(3).map((l) => l.trim().split(/\s+/).map(Number));
async function frlgTileset(name, primary) {
  const d = `data/tilesets/${primary ? 'primary' : 'secondary'}/${name.replace(/^gTileset_/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`;
  const pals = [];
  for (let i = 0; i < 16; i++) pals.push(readPal(await frlgGet(`${d}/palettes/${String(i).padStart(2, '0')}.pal`)));
  return { tiles: readIndexed(await frlgGet(`${d}/tiles.png`)), mt: await frlgGet(`${d}/metatiles.bin`), pals };
}
const FRLG_PRIMARY = 640, FRLG_PRIMARY_PALS = 7;
// Draws metatile `id` (both layers) at (dx, dy) into an RGBA PNG.
function drawMetatile(P, S, id, out, dx, dy) {
  const ts = id < FRLG_PRIMARY ? P : S, base = (id % FRLG_PRIMARY) * 16;
  for (let L = 0; L < 2; L++) for (let k = 0; k < 4; k++) {
    const e = ts.mt.readUInt16LE(base + L * 8 + k * 2), ti = e & 1023, hf = e & 1024, vf = e & 2048, p = e >> 12;
    const tl = ti < FRLG_PRIMARY ? P.tiles : S.tiles, tj = ti % FRLG_PRIMARY, cols = tl.w / 8;
    if (tj >= cols * (tl.h / 8)) continue;
    const colors = (p < FRLG_PRIMARY_PALS ? P : S).pals[p], tx = (tj % cols) * 8, ty = Math.floor(tj / cols) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const ci = tl.px[(ty + (vf ? 7 - y : y)) * tl.w + tx + (hf ? 7 - x : x)];
      if (!ci && L) continue;
      const c = ci ? colors[ci] : P.pals[0][0];
      out.data.set([c[0], c[1], c[2], 255], ((dy + (k >> 1) * 8 + y) * out.width + dx + (k & 1) * 8 + x) * 4);
    }
  }
}
async function frlgLayout(id) {
  const L = JSON.parse(await frlgGet('data/layouts/layouts.json')).layouts.find((l) => l.id === id);
  const mb = await frlgGet(L.blockdata_filepath), P = await frlgTileset(L.primary_tileset, true), S = await frlgTileset(L.secondary_tileset, false);
  return { L, P, S, at: (x, y) => mb.readUInt16LE((y * L.width + x) * 2) & 1023 };
}
const M = 16, GX = FIGHT_W / PX / M, GY = FIGHT_H / PX / M, GPAD = 3; // FRLG: 27 x 18 metatile fight + 3-metatile border

const GW = GX + GPAD * 2, GH = GY + GPAD * 2, CX = (GW - 1) / 2;
const gridOf = (f) => Array.from({ length: GH }, (_, Y) => Array.from({ length: GW }, (_, X) => f(X, Y)));
// Metatiles drawn standalone with the given floor metatile's colours cleared from the outside in (for props).
function frlgSprite({ P, S }, rows, floorId) {
  const img = new PNG({ width: rows[0].length * M, height: rows.length * M }), fl = new PNG({ width: M, height: M }), pal = new Set();
  rows.forEach((r, y) => r.forEach((id, x) => drawMetatile(P, S, id, img, x * M, y * M)));
  drawMetatile(P, S, floorId, fl, 0, 0);
  for (let i = 0; i < fl.data.length; i += 4) pal.add(rgb(fl.data, i));
  return clearOutside(img, pal);
}
const FRLG_ROOMS = {
  // Indigo League rooms (Lorelei / Bruno / Agatha share one 13x13 plan): wall + door on top, exit at the bottom,
  // pillar columns in the side borders, and the room's battle court stretched over the middle of the fight.
  league(lay) {
    const { at, P, S } = lay, plain = at(1, 5), plainTop = at(4, 3);
    const side = (X, y) => X <= 3 ? at(X, y) : X >= GW - 4 ? at(X - (GW - 13), y) : null;
    const wallRow = (X, y) => side(X, y) ?? (Math.abs(X - CX) <= 1 ? at(X - CX + 6, y) : X < CX ? at(X % 2 ? 3 : 4, y) : at((X - CX - 2) % 2 ? 9 : 8, y));
    const grid = gridOf((X, Y) => Y < 3 ? wallRow(X, Y)
      : Y === 3 ? side(X, 3) ?? (Math.abs(X - CX) <= 1 ? at(X - CX + 6, 3) : plainTop)
      : Y < GH - 2 ? side(X, 4 + ((Y - 4) % 6)) ?? plain
      : Y === GH - 2 ? at(X === 0 ? 0 : X === GW - 1 ? 12 : 1, 10) : wallRow(X, 11));
    const after = (art) => { // battle court: 5x6 metatiles at (4,4) in the room, stretched to 19x12
      const room = new PNG({ width: 13 * M, height: 13 * M }), floor = new PNG({ width: M, height: M });
      for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) drawMetatile(P, S, at(x, y), room, x * M, y * M);
      drawMetatile(P, S, plain, floor, 0, 0);
      stretchCourt(room, floor, art, { sx: 4 * M, sy: 4 * M, cw: 19, ch: 12, ox: (CX - 9) * M, oy: (GPAD + 3) * M });
    };
    return { grid, after, props: { rock: frlgSprite(lay, [[at(2, 4)], [at(2, 5)], [at(2, 6)]], plain) }, rockR: 0.5 };
  },
  // Pewter Gym: windowed back wall with the gym banner, sand floor, boulders along the sides,
  // the plank floor, statues and exit along the bottom.
  pewter(lay) {
    const { at } = lay, sand = at(2, 6), boulders = [at(4, 5), at(5, 7)];
    const grid = gridOf((X, Y) => {
      if (X === 0 || X === GW - 1) { const sx = X ? 12 : 0; return Y <= 2 ? at(sx, Y) : Y < GH - 3 ? at(sx, 4) : at(sx, Y - (GH - 15)); }
      if (Y <= 2) { const d = Math.abs(X - CX); return d === 0 ? at(6, Y) : X === 1 ? at(1, Y) : X === GW - 2 ? at(11, Y) : Y === 1 && d % 6 >= 1 && d % 6 <= 2 ? at(4, 1) : at(2, Y); }
      if (Y === 3) return X === 1 ? at(1, 3) : X === 2 ? at(2, 3) : X === GW - 3 ? at(10, 3) : X === GW - 2 ? at(11, 3) : at(3, 3);
      if (Y < GH - 3) {
        if (X === 1) return at(1, 6);
        const edge = X === 2 || X === GW - 3 || X === GW - 2;
        return edge && rand() < 0.3 ? boulders[Math.floor(rand() * 2)] : sand;
      }
      const sy = Y - (GH - 15);
      return X === 1 ? at(1, sy) : sy === 14 && Math.abs(X - CX) <= 1 ? at(X - CX + 6, 14) : at(2, sy);
    });
    for (const x of [CX - 4, CX + 3]) { grid[GH - 3][x] = at(4, 12); grid[GH - 3][x + 1] = at(5, 12); grid[GH - 2][x] = at(4, 13); grid[GH - 2][x + 1] = at(5, 13); }
    return { grid, props: { rock: frlgSprite(lay, [[boulders[0]]], sand) }, rockR: 0.5 };
  },
  // Viridian Forest: a clearing ringed by the forest's 3-metatile tree stands (trunks facing in at the top),
  // flowers along the edges, tall grass patches as the grass obstacle and a lone stand as the rock.
  forest(lay) {
    const { at } = lay, tree = (r, X) => at(35 + X % 3, r), ground = at(42, 5), flowers = [at(39, 5), at(33, 7)];
    const grid = gridOf((X, Y) => {
      if (X < 3 || X >= GW - 3) return tree(Y % 2 ? 9 : 10, X);
      if (Y <= 2) return tree([10, 13, 14][Y], X);
      if (Y >= GH - 3) return tree([8, 9, 10][Y - (GH - 3)], X);
      const edge = Math.min(X - 3, GW - 4 - X, Y - 3, GH - 4 - Y) < 2;
      return rand() < (edge ? 0.3 : 0.04) ? flowers[Math.floor(rand() * 2)] : ground;
    });
    const tall = at(31, 13);
    return { grid, props: {
      grass: frlgSprite(lay, [[tall, tall], [tall, tall]], ground),
      rock: frlgSprite(lay, [[tree(8, 0), tree(8, 1), tree(8, 2)], [tree(13, 0), tree(13, 1), tree(13, 2)], [tree(14, 0), tree(14, 1), tree(14, 2)]], ground),
    }, rockR: 0.3 };
  },
};
async function frlgArena(def) {
  const lay = await frlgLayout(def.frlg), room = FRLG_ROOMS[def.room](lay);
  const art = new PNG({ width: GW * M, height: GH * M });
  room.grid.forEach((r, Y) => r.forEach((id, X) => drawMetatile(lay.P, lay.S, id, art, X * M, Y * M)));
  room.after?.(art);
  return { art, wall: GPAD * M, props: room.props, rockR: room.rockR };
}
// Stretches a 5x6-metatile court (corner/edge columns, 3x4 centre emblem) to cw x ch metatiles. Inserted strips
// keep the floor texture at its own 16px phase and copy only the court-line pixels from a representative column/row.
function stretchCourt(room, floor, out, { sx, sy, cw, ch, ox, oy }) {
  const axis = (n, ends) => Array.from({ length: n * M }, (_, o) => {
    const e = (n - 3) / 2 * M; // centre emblem starts here
    if (o < M) return { s: o };
    if (o >= (n - 1) * M) return { s: o - (n - 1) * M + ends };
    if (o >= e && o < e + 3 * M) return { s: o - e + M };
    return { s: o < e ? 12 : ends + 4, rep: true };
  });
  const xs = axis(cw, 4 * M), ys = (() => { // rows: top edge, 4-row emblem, bottom edge
    const e = (ch - 4) / 2 * M;
    return Array.from({ length: ch * M }, (_, o) => o < M ? { s: o } : o >= (ch - 1) * M ? { s: o - (ch - 1) * M + 5 * M }
      : o >= e && o < e + 4 * M ? { s: o - e + M } : { s: o < e ? 12 : 5 * M + 4, rep: true });
  })();
  const px = (img, x, y) => { const i = (y * img.width + x) * 4; return img.data.subarray(i, i + 4); };
  for (let y = 0; y < ys.length; y++) for (let x = 0; x < xs.length; x++) {
    const s = px(room, sx + xs[x].s, sy + ys[y].s);
    let c = s;
    if (xs[x].rep || ys[y].rep) {
      const fs_ = px(floor, xs[x].s % M, ys[y].s % M);
      if (fs_[0] === s[0] && fs_[1] === s[1] && fs_[2] === s[2]) c = px(floor, x % M, y % M);
    }
    out.data.set(c, ((oy + y) * out.width + ox + x) * 4);
  }
}

async function buildArenas() {
  const arenas = [], previews = [];
  for (const def of ARENA_DEFS) {
    seed = 7 + def.id.length * 131;
    const a = def.frlg ? await frlgArena(def) : await pmdArena(def);
    if (def.frlg) { // same baked vignette as the PMD arenas, no wall shading (the rooms bring their own)
      const { art } = a;
      for (let i = 0; i < art.width * art.height; i++) {
        const k = vignette(i % art.width, Math.floor(i / art.width), art.width, art.height, 0.06);
        for (let c = 0; c < 3; c++) art.data[i * 4 + c] = clamp(Math.round(art.data[i * 4 + c] * k), 0, 255);
      }
    }
    const bg = doubled(a.art), W = bg.width, H = bg.height, wall = a.wall * PX;
    if (W - wall * 2 !== FIGHT_W || H - wall * 2 !== FIGHT_H) throw new Error(`${def.id}: fight area ${W - wall * 2}x${H - wall * 2}`);
    fs.writeFileSync(`assets/arena/${def.id}.png`, PNG.sync.write(bg));
    const props = {}, propImg = {};
    for (const [kind, im] of Object.entries(a.props)) {
      const file = `assets/arena/${def.id}-${kind}.png`;
      propImg[kind] = doubled(im); fs.writeFileSync(file, PNG.sync.write(propImg[kind])); props[kind] = file;
    }
    const obstacles = [];
    for (const [kind, rx, ry] of def.obstacles) {
      const r = Math.round(propImg[kind].width * (kind === 'rock' ? a.rockR ?? 0.45 : 0.42)), x = wall + rx, y = wall + ry;
      obstacles.push({ kind, x, y, r });
      if (x !== W / 2) obstacles.push({ kind, x: W - x, y, r });
    }
    const spawns = [[wall + 120, H / 2], [W - wall - 120, H / 2]];
    arenas.push({ id: def.id, name: def.name, bg: `assets/arena/${def.id}.png`, w: W, h: H, wall,
      spawns, obstacles, props, weather: '', music: `assets/music/${def.music}.mp3`, tileset: def.tileset || def.frlg });

    const pv = new PNG({ width: W, height: H });
    bg.data.copy(pv.data);
    for (const o of obstacles) {
      const im = propImg[o.kind];
      over(im, pv, Math.round(o.x - im.width / 2), o.kind === 'rock' ? Math.round(o.y - im.height + o.r * 0.5) : Math.round(o.y - im.height / 2));
    }
    for (const [x, y] of spawns) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const o = ((y + dy) * W + x + dx) * 4; pv.data.set([255, 40, 40, 255], o);
    }
    previews.push(pv);
  }
  // contact sheet: every arena at half size, 3 per row
  const cw = Math.max(...previews.map((p) => p.width)) / 2, chh = Math.max(...previews.map((p) => p.height)) / 2;
  const sheet = new PNG({ width: cw * 3, height: chh * Math.ceil(previews.length / 3) });
  previews.forEach((p, i) => {
    const ox = (i % 3) * cw, oy = Math.floor(i / 3) * chh;
    for (let y = 0; y < p.height / 2; y++) for (let x = 0; x < p.width / 2; x++) for (let c = 0; c < 4; c++) {
      let s = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += p.data[((y * 2 + dy) * p.width + x * 2 + dx) * 4 + c];
      sheet.data[((oy + y) * sheet.width + ox + x) * 4 + c] = s >> 2;
    }
  });
  fs.writeFileSync('assets/arena/_preview.png', PNG.sync.write(sheet));
  return arenas;
}
function over(src, dst, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4, a = src.data[s + 3] / 255;
    const dx = ox + x, dy = oy + y;
    if (!a || dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
    const d = (dy * dst.width + dx) * 4;
    const da = dst.data[d + 3] / 255, oa = a + da * (1 - a);
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round((src.data[s + c] * a + dst.data[d + c] * da * (1 - a)) / oa);
    dst.data[d + 3] = Math.round(oa * 255);
  }
}

// ---------- trainers ----------
// 'species level ability|item|nature|move,move,move,move'
const TRAINER_DEFS = [
  { id: 'brock', name: 'Brock', title: 'Pewter Gym Leader', sprite: 'brock', music: 'bw2-kanto-gym-leader', difficulty: 'easy', team: [
    'aerodactyl 38 Rock Head|Life Orb|Jolly|rockslide,earthquake,crunch,aerialace',
    'golem 39 Sturdy|Soft Sand|Adamant|earthquake,stoneedge,suckerpunch,rockpolish',
    'omastar 39 Shell Armor|Focus Sash|Modest|shellsmash,hydropump,icebeam,earthpower',
    'kabutops 40 Battle Armor|Life Orb|Adamant|swordsdance,waterfall,stoneedge,aquajet',
    'rhydon 40 Rock Head|Hard Stone|Adamant|earthquake,rockslide,megahorn,swordsdance',
    'onix 42 Sturdy|Leftovers|Impish|stealthrock,rockslide,earthquake,irontail'] },
  { id: 'misty', name: 'Misty', title: 'Cerulean Gym Leader', sprite: 'misty', music: 'bw2-kanto-gym-leader', difficulty: 'easy', team: [
    'seaking 41 Swift Swim|Life Orb|Adamant|waterfall,megahorn,poisonjab,agility',
    'dewgong 42 Thick Fat|Leftovers|Calm|icebeam,surf,iceshard,toxic',
    'golduck 42 Cloud Nine|Mystic Water|Modest|surf,icebeam,psychic,calmmind',
    'cloyster 43 Skill Link|Focus Sash|Jolly|shellsmash,iciclespear,rockblast,iceshard',
    'lapras 44 Water Absorb|Leftovers|Modest|surf,freezedry,thunderbolt,iceshard',
    'starmie 45 Natural Cure|Life Orb|Timid|surf,psychic,thunderbolt,icebeam'] },
  { id: 'ltsurge', name: 'Lt. Surge', title: 'Vermilion Gym Leader', sprite: 'ltsurge', music: 'bw2-kanto-gym-leader', difficulty: 'normal', team: [
    'pikachu 44 Static|Light Ball|Hasty|thunderbolt,grassknot,quickattack,thunderwave',
    'electrode 45 Static|Magnet|Timid|thunderbolt,electroball,foulplay,thunderwave',
    'magneton 46 Sturdy|Leftovers|Modest|thunderbolt,flashcannon,triattack,thunderwave',
    'jolteon 46 Volt Absorb|Expert Belt|Timid|thunderbolt,shadowball,hypervoice,agility',
    'electabuzz 47 Static|Eviolite|Hasty|thunderpunch,crosschop,icepunch,quickattack',
    'raichu 49 Lightning Rod|Life Orb|Timid|thunderbolt,focusblast,grassknot,nastyplot'] },
  { id: 'erika', name: 'Erika', title: 'Celadon Gym Leader', sprite: 'erika', music: 'bw2-kanto-gym-leader', difficulty: 'normal', team: [
    'parasect 48 Dry Skin|Life Orb|Adamant|spore,seedbomb,xscissor,leechlife',
    'tangela 48 Regenerator|Eviolite|Bold|gigadrain,leechseed,knockoff,sludgebomb',
    'exeggutor 49 Harvest|Sitrus Berry|Modest|leafstorm,psychic,stunspore,eggbomb',
    'victreebel 50 Chlorophyll|Life Orb|Adamant|leafblade,poisonjab,suckerpunch,swordsdance',
    'vileplume 50 Chlorophyll|Black Sludge|Calm|gigadrain,sludgebomb,moonblast,sleeppowder',
    'venusaur 52 Chlorophyll|Venusaurite|Bold|gigadrain,sludgebomb,leechseed,synthesis'] },
  { id: 'koga', name: 'Koga', title: 'Fuchsia Gym Leader', sprite: 'koga', music: 'bw2-homika-dogars', difficulty: 'normal', team: [
    'arbok 50 Intimidate|Life Orb|Adamant|gunkshot,earthquake,suckerpunch,coil',
    'venomoth 51 Tinted Lens|Focus Sash|Timid|quiverdance,bugbuzz,sludgebomb,sleeppowder',
    'tentacruel 51 Clear Body|Black Sludge|Calm|toxicspikes,scald,sludgebomb,icebeam',
    'muk 52 Poison Touch|Leftovers|Adamant|gunkshot,shadowsneak,icepunch,drainpunch',
    'beedrill 52 Sniper|Beedrillite|Jolly|poisonjab,xscissor,drillrun,swordsdance',
    'weezing 54 Levitate|Black Sludge|Bold|sludgebomb,flamethrower,willowisp,thunderbolt'] },
  { id: 'sabrina', name: 'Sabrina', title: 'Saffron Gym Leader', sprite: 'sabrina', music: 'bw2-kanto-gym-leader', difficulty: 'normal', team: [
    'venomoth 52 Tinted Lens|Life Orb|Modest|bugbuzz,psychic,sleeppowder,quiverdance',
    'hypno 53 Insomnia|Leftovers|Calm|psychic,shadowball,nastyplot,thunderwave',
    'jynx 53 Dry Skin|Life Orb|Timid|icebeam,psychic,lovelykiss,focusblast',
    'slowbro 54 Regenerator|Leftovers|Bold|scald,psyshock,icebeam,slackoff',
    'mrmime 54 Filter|Wise Glasses|Timid|psychic,dazzlinggleam,focusblast,nastyplot',
    'alakazam 56 Magic Guard|Alakazite|Timid|psychic,shadowball,focusblast,calmmind'] },
  { id: 'blaine', name: 'Blaine', title: 'Cinnabar Gym Leader', sprite: 'blaine', music: 'bw2-kanto-gym-leader', difficulty: 'normal', team: [
    'rapidash 54 Flash Fire|Life Orb|Jolly|flareblitz,wildcharge,megahorn,drillrun',
    'ninetales 55 Drought|Heat Rock|Timid|flamethrower,solarbeam,nastyplot,willowisp',
    'flareon 55 Flash Fire|Choice Band|Adamant|flareblitz,superpower,quickattack,facade',
    'magmar 56 Flame Body|Expert Belt|Modest|flamethrower,scorchingsands,focusblast,psychic',
    'charizard 56 Solar Power|Charcoal|Timid|flamethrower,airslash,dragonpulse,focusblast',
    'arcanine 58 Intimidate|Leftovers|Adamant|flareblitz,extremespeed,wildcharge,closecombat'] },
  { id: 'giovanni', name: 'Giovanni', title: 'Viridian Gym Leader', sprite: 'giovanni', music: 'bw-subway-trainer', difficulty: 'normal', team: [
    'persian 56 Technician|Life Orb|Jolly|fakeout,knockoff,playrough,irontail',
    'dugtrio 57 Arena Trap|Focus Sash|Jolly|earthquake,stoneedge,suckerpunch,swordsdance',
    'nidoqueen 58 Sheer Force|Life Orb|Modest|earthpower,sludgebomb,icebeam,stealthrock',
    'nidoking 58 Sheer Force|Life Orb|Timid|earthpower,sludgewave,flamethrower,thunderbolt',
    'kangaskhan 59 Scrappy|Kangaskhanite|Adamant|doubleedge,crunch,poweruppunch,earthquake',
    'rhydon 60 Lightning Rod|Eviolite|Adamant|earthquake,stoneedge,megahorn,swordsdance'] },
  { id: 'lorelei', name: 'Lorelei', title: 'Elite Four', sprite: 'lorelei-gen3', music: 'xy-rival', difficulty: 'hard', team: [
    'dewgong 60 Thick Fat|Leftovers|Calm|icebeam,surf,aquajet,toxic',
    "cloyster 61 Skill Link|King's Rock|Jolly|shellsmash,iciclespear,rockblast,iceshard",
    'vaporeon 61 Water Absorb|Leftovers|Bold|scald,icebeam,shadowball,haze',
    'slowbro 62 Own Tempo|Slowbronite|Bold|scald,psychic,icebeam,slackoff',
    'jynx 62 Dry Skin|Never-Melt Ice|Timid|icebeam,psyshock,lovelykiss,nastyplot',
    'lapras 64 Water Absorb|Leftovers|Modest|hydropump,freezedry,psychic,thunderbolt'] },
  { id: 'bruno', name: 'Bruno', title: 'Elite Four', sprite: 'bruno', music: 'oras-rival', difficulty: 'hard', team: [
    'onix 62 Sturdy|Eviolite|Impish|stealthrock,stoneedge,earthquake,rockslide',
    'primeape 63 Defiant|Life Orb|Jolly|closecombat,ragefist,stoneedge,bulkup',
    'poliwrath 63 Water Absorb|Leftovers|Adamant|bulkup,waterfall,drainpunch,icepunch',
    'hitmonchan 64 Iron Fist|Expert Belt|Adamant|drainpunch,machpunch,icepunch,thunderpunch',
    'hitmonlee 64 Reckless|Life Orb|Jolly|highjumpkick,knockoff,machpunch,blazekick',
    'machamp 66 No Guard|Black Belt|Adamant|dynamicpunch,stoneedge,knockoff,bulletpunch'] },
  { id: 'agatha', name: 'Agatha', title: 'Elite Four', sprite: 'agatha-gen3', music: 'sm-rival', difficulty: 'hard', team: [
    'golbat 64 Infiltrator|Eviolite|Jolly|bravebird,poisonfang,roost,taunt',
    'arbok 65 Intimidate|Black Sludge|Adamant|gunkshot,crunch,glare,earthquake',
    'muk 65 Sticky Hold|Leftovers|Adamant|poisonjab,knockoff,shadowsneak,firepunch',
    'haunter 66 Levitate|Life Orb|Timid|shadowball,sludgebomb,willowisp,thunderbolt',
    'marowak 66 Rock Head|Thick Club|Adamant|bonemerang,rockslide,firepunch,swordsdance',
    'gengar 68 Cursed Body|Gengarite|Timid|shadowball,sludgebomb,focusblast,nastyplot'] },
  { id: 'lance', name: 'Lance', title: 'Elite Four', sprite: 'lance', music: 'bw2-rival', difficulty: 'hard', team: [
    'seadra 66 Sniper|Eviolite|Modest|hydropump,dragonpulse,icebeam,agility',
    'dragonair 66 Marvel Scale|Eviolite|Adamant|dragondance,dragonrush,extremespeed,irontail',
    'aerodactyl 67 Unnerve|Life Orb|Jolly|stoneedge,earthquake,crunch,aquatail',
    'charizard 67 Blaze|Dragon Fang|Jolly|flareblitz,dragonclaw,earthquake,swordsdance',
    'gyarados 68 Moxie|Gyaradosite|Jolly|waterfall,crunch,earthquake,dragondance',
    'dragonite 70 Multiscale|Lum Berry|Adamant|dragondance,outrage,extremespeed,earthquake'] },
  { id: 'blue', name: 'Blue', title: 'Champion', sprite: 'blue', music: 'bw-rival', difficulty: 'champion', team: [
    'exeggutor 70 Harvest|Sitrus Berry|Modest|energyball,psychic,sleeppowder,ancientpower',
    'gyarados 71 Intimidate|Leftovers|Adamant|waterfall,icefang,earthquake,dragondance',
    'rhydon 72 Lightning Rod|Eviolite|Adamant|earthquake,stoneedge,megahorn,stealthrock',
    'arcanine 72 Intimidate|Life Orb|Adamant|flareblitz,extremespeed,wildcharge,closecombat',
    'alakazam 73 Magic Guard|Life Orb|Timid|psychic,shadowball,focusblast,energyball',
    'pidgeot 75 Keen Eye|Pidgeotite|Timid|hurricane,heatwave,roost,quickattack'] },
  { id: 'red', name: 'Red', title: 'Pokemon Trainer', sprite: 'red', music: 'spl-elite4', difficulty: 'champion', team: [
    'lapras 80 Water Absorb|Leftovers|Modest|hydropump,icebeam,thunderbolt,psychic',
    'snorlax 82 Thick Fat|Leftovers|Careful|bodyslam,crunch,earthquake,bellydrum',
    'venusaur 84 Overgrow|Life Orb|Modest|gigadrain,sludgebomb,earthpower,sleeppowder',
    'charizard 84 Blaze|Charizardite X|Timid|flamethrower,solarbeam,airslash,focusblast',
    'blastoise 84 Torrent|Expert Belt|Modest|hydropump,icebeam,darkpulse,flashcannon',
    'pikachu 88 Lightning Rod|Light Ball|Hasty|volttackle,thunderbolt,irontail,quickattack'] },
  { id: 'oak', name: 'Prof. Oak', title: 'Pokemon Professor', sprite: 'oak', music: 'hgss-kanto-trainer', difficulty: 'hard', team: [
    'tauros 72 Sheer Force|Life Orb|Jolly|bodyslam,earthquake,closecombat,rockslide',
    'exeggutor 72 Chlorophyll|Sitrus Berry|Modest|leafstorm,psyshock,hypnosis,ancientpower',
    'kangaskhan 73 Early Bird|Silk Scarf|Adamant|bodyslam,earthquake,suckerpunch,fakeout',
    'arcanine 74 Intimidate|Leftovers|Adamant|flareblitz,extremespeed,crunch,morningsun',
    'gyarados 74 Intimidate|Leftovers|Adamant|waterfall,bounce,earthquake,dragondance',
    'blastoise 76 Torrent|Blastoisinite|Modest|hydropump,darkpulse,icebeam,aurasphere'] },
];
const PLAYER_DEFS = [['red-gen3', 'Red'], ['leaf-gen3', 'Leaf'], ['ethan', 'Ethan'], ['lyra', 'Lyra'], ['kris', 'Kris'], ['chase', 'Chase'], ['elaine', 'Elaine']];

const parseMon = (line) => {
  const [head, item, nature, moves] = line.split('|');
  const [species, level, ...ab] = head.split(' ');
  return { species, level: +level, moves: moves.split(','), ability: ab.join(' '), item, nature };
};
const trainers = TRAINER_DEFS.map((t) => ({ id: t.id, name: t.name, title: t.title, sprite: `assets/trainer/${t.id}.png`,
  music: `assets/music/${t.music}.mp3`, difficulty: t.difficulty, team: t.team.map(parseMon) }));
const playerId = (f) => f.split('-')[0];
const PLAYER_SPRITES = PLAYER_DEFS.map(([f, name]) => ({ id: playerId(f), name, sprite: `assets/trainer/player-${playerId(f)}.png` }));

// ---------- legality ----------
const dex = Dex.forGen(9);
const learnCache = {};
async function learnable(id) {
  if (learnCache[id]) return learnCache[id];
  const out = new Set();
  for (let s = dex.species.get(id); s; s = s.prevo ? dex.species.get(s.prevo) : null) {
    for (const m in (await dex.learnsets.get(s.id))?.learnset || {}) out.add(m);
  }
  return (learnCache[id] = out);
}
const gameDex = {};
if (fs.existsSync('data/dex.js')) vm.runInNewContext(fs.readFileSync('data/dex.js', 'utf8'), { window: gameDex });
const AVOID = new Set(['counter', 'mirrorcoat', 'metronome', 'transform', 'substitute', 'batonpass', 'encore', 'disable',
  'perishsong', 'fissure', 'horndrill', 'guillotine', 'sheercold', 'bide', 'mimic']);
async function checkTrainers() {
  const errors = [];
  for (const t of trainers) {
    if (t.team.length !== 6) errors.push(`${t.id}: ${t.team.length} mons`);
    if (t.team.filter((m) => dex.items.get(m.item).megaStone).length > 1) errors.push(`${t.id}: >1 mega stone`);
    for (const m of t.team) {
      const sp = dex.species.get(m.species), tag = `${t.id}/${m.species}`;
      if (!sp.exists || sp.num < 1 || sp.num > 151) { errors.push(`${tag}: not a Gen 1 species`); continue; }
      if (!Object.values(sp.abilities).includes(m.ability)) errors.push(`${tag}: bad ability ${m.ability}`);
      const item = dex.items.get(m.item);
      if (!item.exists) errors.push(`${tag}: unknown item ${m.item}`);
      else if (gameDex.DEX && !gameDex.DEX.items[item.id]) errors.push(`${tag}: item ${m.item} not in DEX.items`);
      if (item.megaStone && !Object.values(item.megaStone).some((v) => toID(v).startsWith(sp.id))) errors.push(`${tag}: ${m.item} is not its stone`);
      if (!dex.natures.get(m.nature).exists) errors.push(`${tag}: bad nature ${m.nature}`);
      if (m.moves.length !== 4 || new Set(m.moves).size !== 4) errors.push(`${tag}: needs 4 distinct moves`);
      const ls = await learnable(sp.id);
      for (const mv of m.moves) {
        if (!dex.moves.get(mv).exists) errors.push(`${tag}: unknown move ${mv}`);
        else if (!ls.has(mv)) errors.push(`${tag}: cannot learn ${mv}`);
        if (AVOID.has(mv)) errors.push(`${tag}: avoided move ${mv}`);
        const gm = gameDex.DEX?.moves[mv];
        if (gameDex.DEX && (!gm || gm.banned)) errors.push(`${tag}: ${mv} banned in game (${gm?.bannedReason || 'missing'})`);
      }
    }
  }
  return errors;
}


// ---------- main ----------
const errs = await checkTrainers();
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`trainers: ${trainers.length}, all moves/abilities/items legal`);

const arenas = await buildArenas();
console.log(`arenas: ${arenas.map((a) => `${a.id}(${a.tileset})`).join(' ')}`);
if (process.argv.includes('--art-only')) process.exit(0); // iterate on arena PNGs without rewriting data/world.js

const PMDO_MUSIC = { menu: 'Base Town', builder: 'Shop' };
const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');
const MUSIC = Object.fromEntries(Object.entries(PMDO_MUSIC).map(([k, n]) => [k, `assets/music/pmdo-${slug(n)}.ogg`]));
const jobs = [
  ...TRAINER_DEFS.map((t) => [`${SD}/sprites/trainers/${t.sprite}.png`, `assets/trainer/${t.id}.png`]),
  ...PLAYER_DEFS.map(([f]) => [`${SD}/sprites/trainers/${f}.png`, `assets/trainer/player-${playerId(f)}.png`]),
  ...[...new Set([...trainers, ...arenas].map((x) => x.music))].map((f) => [`${SD}/audio/${path.basename(f)}`, f]),
  ...Object.entries(PMDO_MUSIC).map(([k, n]) => [`${RAW_DUMP}/Content/Music/${encodeURIComponent(n)}.ogg`, MUSIC[k]]),
];
const missing = [];
await pool(jobs, async ([url, file]) => { if (!(await get(url, file))) missing.push(url); });
if (missing.length) { console.error(`missing:\n${missing.join('\n')}`); process.exit(1); }

const body = [['ARENAS', arenas], ['TRAINERS', trainers], ['MUSIC', MUSIC], ['PLAYER_SPRITES', PLAYER_SPRITES]]
  .map(([k, v]) => `window.${k} = ${JSON.stringify(v, null, 1)};`).join('\n');
fs.writeFileSync('data/world.js', `// Generated by tools/build-world.mjs. Do not edit by hand.\n${body}\n`);

// ---------- verify ----------
const win = {};
vm.runInNewContext(fs.readFileSync('data/world.js', 'utf8'), { window: win });
const MAGIC = { '.png': '89504e47', '.mp3': ['494433', 'fff'], '.ogg': '4f676753' };
const bad = [];
JSON.stringify(win, (k, v) => {
  if (typeof v === 'string' && v.startsWith('assets/')) {
    if (!fs.existsSync(v)) bad.push(`missing ${v}`);
    else {
      const hex = fs.readFileSync(v).subarray(0, 4).toString('hex');
      if (![MAGIC[path.extname(v)]].flat().some((m) => hex.startsWith(m))) bad.push(`bad file ${v} (${hex})`);
    }
  }
  return v;
});
for (const a of win.ARENAS) for (const o of a.obstacles) {
  if (a.spawns.some(([x, y]) => Math.hypot(o.x - x, o.y - y) < o.r + 60)) bad.push(`${a.id}: obstacle near spawn`);
  if (o.x - o.r < a.wall || o.y - o.r < a.wall || o.x + o.r > a.w - a.wall || o.y + o.r > a.h - a.wall) bad.push(`${a.id}: obstacle in wall`);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`world.js OK: ${win.ARENAS.length} arenas, ${win.TRAINERS.length} trainers, ${win.PLAYER_SPRITES.length} player sprites, ${jobs.length} files`);
