// Behaviour checks for the Adventure engine's pure logic (src/adv-world.js, src/adv-battle.js, src/adv-wild.js): autotiling, cliffs, stairs, ledges, bridges, props, draw order, the fight box, the wild spawner and its behaviours.
// Run: node tools/adv-check.mjs
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// the engine files are classic browser scripts: run them in this context with window = globalThis
const load = (f, tail = '') => vm.runInThisContext(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8') + tail, { filename: f });
globalThis.window = globalThis;
load('data/adv/tileset-placeholder.js');
const ADV = load('src/adv-world.js', '\n;ADV');
const ADVB = load('src/adv-battle.js', '\n;ADVB');
globalThis.ADV = ADV; // adv-wild.js reads the globals the browser build has
globalThis.dirFromVec = (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
globalThis.DIR_VEC = [[0, 1], [0.707, 0.707], [1, 0], [0.707, -0.707], [0, -1], [-0.707, -0.707], [-1, 0], [-0.707, 0.707]];
for (const f of ['zones', 'encounters', 'temperament', 'pokedata']) load(`data/adv/${f}.js`);
const REAL_ZONES = window.ADV_ZONES;
const ADVW = load('src/adv-wild.js', '\n;ADVW');
const TS = window.ADV_TILESET_PLACEHOLDER, S = ADV.OUT, T = ADV.T, DT = 32, TR = 32, N = 1024;   // S = outdoor scale (2), T = the outdoor tile in world px, DT = a tile of authored data px (props, doors), TR = a room's tile
const GRASS = 1, SAND = 3, WATER = 4;
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n++; };
const deepEq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const loadWorld = (W = window.ADV_WORLD) => { for (let r = 0; r < W.chunksH; r++) for (let c = 0; c < W.chunksW; c++) { const f = new URL(`../data/adv/chunks/${c}_${r}.js`, import.meta.url); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8')); else ADV.fillChunk(c, r); } };   // plan B: the 0.8x island is small enough to load whole
const bld = id => window.ADV_WORLD.buildings.find(b => b.id === id), bnpcs = id => bld(id).interior.npcs;   // S2: what a building holds, from the world data

// fn(x, y) -> { h, m, o, k, d } overrides for that cell
function chunk(cx, cy, fn = () => ({}), props = []) {
  const d = { h: Array(N).fill(0), mat: Array(N).fill(GRASS), over: Array(N).fill(0), kind: Array(N).fill(0), deck: Array(N).fill(-1), props };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const o = fn(x, y) || {}, i = y * 32 + x;
    if (o.h !== undefined) d.h[i] = o.h; if (o.m !== undefined) d.mat[i] = o.m; if (o.o !== undefined) d.over[i] = o.o;
    if (o.k !== undefined) d.kind[i] = o.k; if (o.d !== undefined) d.deck[i] = o.d;
  }
  ADV.chunk(cx, cy, d);
}
const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const sandId = role => { const v = TS.mats.sand[role]; return Array.isArray(v) ? v[0] : v; };
const ent = (cx, cy, lv = 0) => ADV.entity((cx + 0.5) * T, (cy + 0.5) * T, lv);
function walk(e, vx, vy, secs, each) {
  for (let t = 0; t < secs * 60 * S; t++) { ADV.update(e, 1 / 60); ADV.move(e, vx * 96 / 60, vy * 96 / 60); if (each) each(e); }   // secs are in tile-time: a tile is S times further than it was at 32 px
}

// ---------- 1. autotile roles ----------
ADV.reset();
const plus = (x, y) => { const px = x - 5, py = y - 5; return px >= 0 && px < 7 && py >= 0 && py < 7 && ((px >= 2 && px <= 4) || (py >= 2 && py <= 4)); };
const ell = (x, y) => { const px = x - 20, py = y - 5; return px >= 0 && px < 5 && py >= 0 && py < 5 && (px < 2 || py >= 3); };
chunk(0, 0, (x, y) => (plus(x, y) || ell(x, y) ? { m: SAND } : {}));
for (const [px, py, role] of [[3, 3, 'C'], [3, 2, 'C'], [2, 2, 'iNW'], [4, 2, 'iNE'], [2, 4, 'iSW'], [4, 4, 'iSE'], [3, 0, 'N'], [2, 0, 'NW'], [4, 0, 'NE'],
  [0, 3, 'W'], [0, 2, 'NW'], [0, 4, 'SW'], [6, 3, 'E'], [6, 2, 'NE'], [6, 4, 'SE'], [3, 6, 'S'], [2, 6, 'SW'], [4, 6, 'SE']]) {
  eq(ADV.roleName(5 + px, 5 + py, 0), role, `plus (${px},${py})`);
  eq(ADV.tileId(5 + px, 5 + py, 0), sandId(role), `plus tile id (${px},${py})`);
}
for (const [px, py, role] of [[1, 3, 'iNE'], [1, 2, 'E'], [1, 1, 'E'], [0, 0, 'NW'], [1, 0, 'NE'], [0, 2, 'W'], [2, 3, 'N'], [4, 3, 'NE'], [4, 4, 'SE'], [0, 4, 'SW'], [2, 4, 'S'], [3, 4, 'S']])
  eq(ADV.roleName(20 + px, 5 + py, 0), role, `L (${px},${py})`);
eq(ADV.roleName(10, 20, 0), 'C', 'plain grass is C');
// a neighbour chunk arriving re-resolves the border cells
ADV.reset();
chunk(0, 0, (x, y) => (x >= 30 && y >= 10 && y <= 12 ? { m: SAND } : {}));
eq(ADV.roleName(31, 11, 0), 'C', 'unloaded neighbour counts as same');
chunk(1, 0, () => ({}));
eq(ADV.roleName(31, 11, 0), 'E', 'border re-autotiled after neighbour arrives');
eq(ADV.roleName(31, 10, 0), 'NE', 'border corner after neighbour arrives');

// ---------- test map: plateau, stairs, ledges, gully with bridge, prop ----------
ADV.reset();
chunk(0, 0, (x, y) => {
  if (rect(x, y, 12, 13, 12, 13)) return { k: 1 };                         // stairs N, lower 0
  if (rect(x, y, 9, 12, 9, 12)) return { h: 1, k: 5 };                     // ledge S on the plateau front
  if (rect(x, y, 8, 8, 14, 12)) return { h: 1 };                           // plateau P1
  if (rect(x, y, 15, 7, 15, 7)) return { k: 3 };                           // stairs E, lower 0
  if (rect(x, y, 19, 6, 19, 6)) return { h: 1, k: 6 };                     // ledge E into the gully
  if (rect(x, y, 20, 9, 23, 10)) return { m: x === 21 || x === 22 ? WATER : SAND, k: 8, d: 1 };   // bridge deck over the gully
  if (rect(x, y, 20, 5, 23, 15)) return { m: x === 21 || x === 22 ? WATER : SAND };
  if (rect(x, y, 16, 5, 19, 15) || rect(x, y, 24, 5, 27, 15)) return { h: 1 };
  return {};
}, [['pineTree', 200, 200]]);

// ---------- 2. cliffs, stairs, ledges ----------
let e = ent(10, 13);
walk(e, 0, -1, 1);
ok(e.y >= 13 * T + 6 - 0.01 && e.z === 0 && e.lv === 0, `walking north into the cliff is blocked (y=${e.y})`);
e = ent(10, 11, 1);
walk(e, 0, 1, 1);
ok(e.y <= 13 * T - 6 + 0.01 && e.z === T && !e.hop, `a plain plateau edge does not let you walk off (y=${e.y})`);

e = ent(12, 15);
const zs = [];
walk(e, 0, -1, 2, p => zs.push(p.z));
eq(e.z, T, 'up the stairs ends at z = one level');
eq(e.lv, 1, 'level 1 after the stairs');
ok(e.y < 12 * T, 'actually on the plateau');
ok(zs.some(z => z > T / 8 && z < T - T / 8), 'z passes through the middle of the stairs');
ok(zs.every((z, i) => i === 0 || z >= zs[i - 1]), 'z rises monotonically going up');
walk(e, 0, 1, 2);
eq(e.z, 0, 'and back down the stairs to z = 0');
ok(e.y > 13 * T, 'back on the ground');

e = ent(14, 7);                                                         // stairs E at (15, 7)
walk(e, 1, 0, 1.2);
ok(e.z === T && e.x > 16 * T, 'stairs E climb onto the plateau');
e = ent(14, 6);                                                         // beside the stairs: plateau wall
walk(e, 1, 0, 1);
ok(e.x <= 16 * T - 6 + 0.01 && e.x > 15 * T && e.z === 0, 'walking into the plateau wall beside the stairs is blocked');

e = ent(9, 11, 1);
let hopped = false;
for (let t = 0; t < 90 * S; t++) { ADV.update(e, 1 / 60); ADV.move(e, 0, 96 / 60); if (e.hop) hopped = true; }
ok(hopped, 'south ledge triggers a hop');
eq(e.z, 0, 'hop lands at ground level');
ok(e.y > 13 * T && !e.hop, 'landed south of the ledge');
walk(e, 0, -1, 1);
ok(e.y >= 13 * T + 6 - 0.01 && e.z === 0, `cannot climb back up the ledge (y=${e.y})`);
e = ent(9, 11, 1);
for (let t = 0; t < 60 * S && !e.hop; t++) { ADV.update(e, 1 / 60); ADV.move(e, 0, 96 / 60); }
const y0 = e.y, x0 = e.x;
ADV.move(e, 50, 50);
ok(e.hop && e.x === x0 && e.y === y0, 'input is locked while hopping');
ADV.update(e, 0.15);
ok(e.z > 0 && e.z < T, 'z is mid-arc halfway through the hop');
ADV.update(e, 0.2);
ok(!e.hop && e.z === 0, 'hop finishes after 0.3 s');

e = ent(19, 6, 1);                                                      // ledge E into the gully
walk(e, 1, 0, 1);
ok(e.z === 0 && e.x > 20 * T, 'east ledge drops into the gully');

// ---------- 3. bridge ----------
e = ent(20, 14);                                                        // ground level on the sand bank, walk north under the deck
const zUnder = new Set(), ys = [];
walk(e, 0, -1, 3, p => { zUnder.add(p.z); ys.push(p.y); });
ok(Math.min(...ys) < 9 * T, `ground-level entity passes under the bridge (min y ${Math.min(...ys)})`);
ok(zUnder.size === 1 && zUnder.has(0), 'and stays at ground z the whole way');

e = ent(19, 9, 1);                                                      // on the plateau, walk east across the deck
const zDeck = new Set();
walk(e, 1, 0, 2.5, p => zDeck.add(p.z));
ok(e.x > 24 * T + 10, `deck entity crosses the whole bridge (x=${e.x})`);
ok(zDeck.size === 1 && zDeck.has(T), 'and stays at deck z');
e = ent(20, 10, 1);
walk(e, 0, 1, 1);
ok(e.y <= 11 * T - 6 + 0.01 && e.z === T, 'cannot step off the south edge of the deck');
e = ent(20, 14);
walk(e, 1, 0, 1);
ok(e.x <= 21 * T - 6 + 0.01, 'ground level cannot enter water');
e = ent(21, 9, 1);
walk(e, 0, -1, 0.3);
ok(e.z === T, 'deck over water holds you up');

// ---------- 4. props, queries ----------
e = ADV.entity(150 * S, 200 * S, 0);
walk(e, 1, 0, 1);
ok(e.x <= (200 - 8) * S - 6 + 0.01 && e.x > 170 * S, `prop solid rect (S times bigger) blocks the foot circle (x=${e.x})`);
e = ADV.entity(200 * S, 160 * S, 0);
walk(e, 0, 1, 1);
ok(e.y <= (200 - 6) * S - 6 + 0.01, 'prop blocks from the north too');
eq(ADV.heightAt(12 * T + T / 2, 13 * T + T / 2), T / 2, 'height mid-stairs is half a level');
eq(ADV.heightAt(10 * T, 10 * T), T, 'plateau height: a level is a tile (64 px outdoors)');
eq(ADV.heightAt(21 * T, 9 * T + 8, 1), T, 'deck height for an entity on the deck');
eq(ADV.heightAt(20 * T + T / 2, 9 * T + 8, 0), 0, 'ground height under the deck for a ground-level entity');
eq(ADV.cellAt(10 * T, 10 * T).h, 1, 'cellAt');
eq(ADV.cellAt(-50, 50), null, 'void has no cell');
ok(ADV.blocked(10 * T + T / 2, 12 * T + T / 2, 0, 6), 'blocked: plateau cell at ground level');
ok(!ADV.blocked(10 * T + T / 2, 10 * T + T / 2, T, 6), 'open: plateau cell at plateau level');
ok(ADV.blocked(21 * T + T / 2, 13 * T, 0, 6), 'blocked: water at ground level');
ok(!ADV.blocked(21 * T + T / 2, 9 * T + T / 2, T, 6), 'open: deck over water at deck level');
ok(ADV.blocked(-30, 50, 0, 6), 'blocked: void');

// ---------- 5. draw order ----------
const R = 12, strip = { type: 0, key: R * T, row: R, z: 0 };
const behind = { type: 2, key: R * T - 5, row: R - 1, z: 0, x: 100 };
const onTop = { type: 2, key: R * T + 5, row: R, z: T, x: 100 };
ok(ADV.order(behind, strip) < 0 && ADV.order(strip, behind) > 0, 'entity behind a cliff draws before that row\'s strip');
ok(ADV.order(onTop, strip) > 0 && ADV.order(strip, onTop) < 0, 'entity on top draws after the strip');
const deck = { type: 1, key: R * T, row: R, z: T, x0: 64, x1: 192 };
const under = { type: 2, key: R * T + 20, row: R, z: 0, x: 100 }, above = { type: 2, key: R * T + 2, row: R, z: T, x: 100 };
const sorted = ADV.depthSort([onTop, deck, behind, strip, under, above]);
ok(sorted.indexOf(under) < sorted.indexOf(deck), 'ground entity under a deck draws before it');
ok(sorted.indexOf(above) > sorted.indexOf(deck) && above.key < under.key, 'deck entity draws after the deck even though its y is smaller');
ok(sorted.indexOf(behind) < sorted.indexOf(strip) && sorted.indexOf(strip) < sorted.indexOf(under) && sorted.indexOf(under) < sorted.indexOf(deck) && sorted.indexOf(deck) < sorted.indexOf(above), 'full sort: behind, strip, under, deck, on deck');

// ---------- 6. battles in the world: fight box, walls, shots ----------
ADV.reset();
chunk(0, 0, (x, y) => (rect(x, y, 20, 8, 24, 12) ? { h: 1 } : rect(x, y, 8, 8, 10, 12) ? { m: WATER } : {}), [['pineTree', 15 * DT + 16, 5 * DT + 24]]);
chunk(1, 1, () => ({}));   // the loaded area is chunks (0,0) and (1,1): (1,0) and (0,1) are void inside its bounding box
const A = { x: 14 * T, y: 10 * T }, Bm = { x: 16 * T, y: 10 * T }, ar = ADVB.box(A, Bm, 0), cell = (c, r) => ar.mask[(r - ar.row) * ar.cols + (c - ar.col)];
const lx = x => x - ar.ox, ly = y => y - ar.oy;   // the sim works in box-local px
eq(ar.w, 40 * DT, 'box is 1280 world px wide, whatever the tile'); eq(ar.h, 30 * DT, 'and 960 tall'); eq(ar.cols, 40 / S, 'outdoors that is 20 tiles wide'); eq(ar.rows, 30 / S, 'and 15 tall'); eq(ar.T, T, 'the box knows its tile'); ok(ar.world && ar.wall === 0, 'world arena flags');
eq(ADVB.box({ x: 2 * T, y: 2 * T }, { x: 3 * T, y: 2 * T }, 0).ox, 0, 'box is clamped to the loaded chunks'); eq(ar.ox, ar.col * T, 'its origin is a whole tile'); ok(ar.col <= 8 && ar.col + ar.cols > 24 && ar.row <= 8 && ar.row + ar.rows > 12, 'and this one holds the water and the plateau');
eq(cell(12, 10), 0, 'level ground is open'); eq(cell(9, 10), 1, 'water is solid'); eq(cell(22, 10), 2, 'higher ground is solid and blocks shots');
{ const vb = ADVB.box({ x: 31 * T, y: 10 * T }, { x: 33 * T, y: 10 * T }, 0); eq(vb.mask[(10 - vb.row) * vb.cols + (36 - vb.col)], 1, 'void is solid'); }
ok(ar.obstacles.length === 1 && ar.obstacles[0].world && ar.obstacles[0].hp === Infinity, 'a solid prop becomes an unbreakable world rock'); ok(ar.obstacles[0].r > 0 && ar.obstacles[0].r <= 8 * S, 'drawn S times bigger, so is its rock');
ok(ar.spawns.every(([x, y]) => !ADVB.solidAt(ar, x, y, 6)), 'both spawns stand on open ground');
// walking diagonally into the plateau: stopped at its face, slides along it
const we = { x: lx(20 * T - 40), y: ly(8 * T + 4) }; we.px = we.x; we.py = we.y; const wx0 = we.x, wy0 = we.y;
for (let i = 0; i < 40; i++) { we.px = we.x; we.py = we.y; we.x += 3; we.y += 1; [we.x, we.y] = ADVB.clamp(ar, we.x, we.y, 10, we); }
ok(we.x <= lx(20 * T) - 10 + 0.01 && we.x > lx(20 * T) - 14, `world clamp blocks the higher cell (x=${we.x})`);
ok(we.y > wy0 + 30, `and slides along it (y=${we.y})`);
const wj = { x: lx(9.5 * T), y: ly(10 * T), px: lx(12 * T), py: ly(10 * T) };
[wj.x, wj.y] = ADVB.clamp(ar, wj.x, wj.y, 10, wj);
ok(!ADVB.solidAt(ar, wj.x, wj.y, 10), 'a jump into water is pushed back out');
const [qx, qy] = ADVB.clamp(ar, lx(9.5 * T), ly(10.5 * T), 6);
ok(!ADVB.solidAt(ar, qx, qy, 6), 'a bare point inside water goes to an open cell');
// shots cross water and die entering the plateau
let hit = -1; for (let x = ar.ox + 2 * T; x < 30 * T; x += 6) if (ADVB.shotHit(ar, lx(x), ly(10.5 * T))) { hit = x; break; }
ok(hit >= 20 * T && hit < 20 * T + 6, `projectile crosses water and dies entering the higher cell (x=${hit})`);
ok(!ADVB.shotHit(ar, lx(9.5 * T), ly(10.5 * T)), 'shots fly over water');
ok(ADVB.shotHit(ar, -1, 100) && ADVB.shotHit(ar, 100, ar.h + 1), 'shots die at the box edge');
// fighting on the plateau: lower ground is a wall for walking but shots pass over it
const up = ADVB.box({ x: 22 * T, y: 10 * T }, { x: 23 * T, y: 10 * T }, 1), upc = (c, r) => up.mask[(r - up.row) * up.cols + (c - up.col)];
eq(upc(22, 10), 0, 'plateau is open at its own level'); eq(upc(18, 10), 1, 'lower ground is a wall when fighting up'); ok(!ADVB.shotHit(up, 18.5 * T - up.ox, 10.5 * T - up.oy), 'shots fly over lower ground');

// ---------- 7. RLE chunk arrays decode like plain arrays; world groups merge autotile seams; water list drives collision
ADV.reset();
ADV.chunk(0, 0, { h: '0x1000,2x24', mat: '1x500,2x524', over: '0x1024', kind: '0x1023,8', deck: '-1x1023,3', props: [] });
eq(ADV.h(5, 0), 0, 'RLE h'); eq(ADV.h(31, 31), 2, 'RLE h tail'); eq(ADV.mat(0, 15), 1, 'RLE mat'); eq(ADV.mat(0, 16), 2, 'RLE mat run end'); eq(ADV.deck(31, 31), 3, 'RLE deck'); eq(ADV.kind(31, 31), 8, 'RLE kind');
ADV.setWorld({ palette: ['void', 'grass', 'sand', 'sandB', 'water', 'deepB'], groups: [['sand', 'sandB']], water: ['water', 'deepB'], chunksW: 1, chunksH: 1 });
chunk(0, 0, (x, y) => (x < 2 ? {} : x < 4 ? { m: 2 } : x < 8 ? { m: 3 } : x < 12 ? { m: 4 } : x < 16 ? { m: 5 } : {}));
eq(ADV.roleName(3, 5, 0), 'C', 'grouped materials have no seam'); eq(ADV.roleName(2, 5, 0), 'W', 'group edge still shows against grass');
ok(ADV.isWater(9, 5) && ADV.isWater(13, 5) && !ADV.isWater(5, 5), 'world.water decides isWater');
ADV.setWorld(null);

// ---------- 8. living wild Pokemon: zones, clock, levels, evolutions, spawner, behaviours, pile-on queue, tall grass ----------
const seeded = seed => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
ADVW.rnd = seeded(7);
eq(ADVW.zone(7440 * S, 22416 * S), 'goldacre', 'the Kenora spawn is in the Goldacre zone'); eq(ADVW.zone(-5, -5), '', 'outside the grid is no zone');
eq(ADV.rle('3x2,7').join(), '3,3,7', 'RLE helper is exported');
// day / night tables by the clock
ADVW.hourSet = 12; ok(!ADVW.night() && ADVW.table('route5').some(e => e[0] === 'bunnelby') && !ADVW.table('route5').some(e => e[0] === 'nickit'), 'noon uses the day table');
ADVW.hourSet = 23; ok(ADVW.night() && ADVW.table('route7').some(e => e[0] === 'houndour'), 'midnight uses the night table');
ADVW.hourSet = 5.9; ok(ADVW.night(), '05:54 is still night'); ADVW.hourSet = 6; ok(!ADVW.night(), '06:00 is day'); ADVW.hourSet = 19.9; ok(!ADVW.night(), '19:54 is still day'); ADVW.hourSet = 20; ok(ADVW.night(), '20:00 is night');
ADVW.hourSet = null; ok(ADVW.hour() >= 0 && ADVW.hour() < 24, 'the local clock maps an hour onto a game day');
eq(ADVW.table('wild'), null, 'a zone without a table has no wild mons');
ADVW.hourSet = 12; const tally = {}; for (let i = 0; i < 4000; i++) { const b = ADVW.roll(ADVW.table('route5'))[1]; tally[b] = (tally[b] || 0) + 1; }
for (const [b, pct] of Object.entries({ common: 45, uncommon: 30, rare: 20, nat20: 5 })) ok(Math.abs(tally[b] / 40 - pct) < 3, `band ${b} rolls about ${pct}% (${tally[b] / 40})`);
// badge-band levels, rare +1, nat20 +2
const CAPS_EXPECT = [15, 19, 24, 29, 34, 38, 42, 46, 52], BANDS = CAPS_EXPECT.map(c => [c - 8, c - 4]);   // Appendix A caps; wild levels cap-8..cap-4
for (let b = 0; b <= 8; b++) for (const [band, plus] of [['common', 0], ['uncommon', 0], ['rare', 1], ['nat20', 2]]) {
  let lo = 99, hi = 0; for (let i = 0; i < 300; i++) { const l = ADVW.level(band, b); lo = Math.min(lo, l); hi = Math.max(hi, l); }
  ok(lo >= BANDS[b][0] + plus && hi <= BANDS[b][1] + plus, `badges ${b} ${band}: ${lo}-${hi} inside ${BANDS[b][0] + plus}-${BANDS[b][1] + plus}`);
}
ok(ADVW.level('common') <= 11, 'no ADV.player means badge band 0'); ADV.player = { badges: 3 }; ok(ADVW.level('common') >= 21, 'ADV.player.badges picks the band'); delete ADV.player;
// evolution matching: only plain level evolutions, as many steps as the level allows
eq(ADVW.evolve('wooloo', 30), 'dubwool', 'a Wooloo at 30 is a Dubwool'); eq(ADVW.evolve('wooloo', 23), 'wooloo', 'a Wooloo at 23 is not'); eq(ADVW.evolve('wooloo', 24), 'dubwool', 'at the evolution level it has evolved');
eq(ADVW.evolve('charmander', 20), 'charmeleon', 'one step'); eq(ADVW.evolve('charmander', 36), 'charizard', 'two steps'); eq(ADVW.evolve('slowpoke', 50), 'slowbro', 'a trade evolution is never chosen');
eq(ADVW.evolve('eevee', 90), 'eevee', 'item / friendship evolutions are skipped'); eq(ADVW.evolve('nosuchmon', 50), 'nosuchmon', 'unknown species are left alone');

// a flat world of three by three chunks with tall grass patches, all in one fake zone with the Route 5 table
ADV.reset(); ADV.setWorld({ palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'], chunksW: 3, chunksH: 3 });
for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) chunk(cx, cy, (x, y) => (((x >> 2) + (y >> 2)) % 5 === 0 ? { o: 5 } : {}));
window.ADV_ZONES = { cell: 8, ids: ['wild', 'route5'], cells: Array(12).fill('1x12') };
const view = P => ({ x0: P.x - 320, x1: P.x + 320, y0: P.y - 200, y1: P.y + 200 });
const P = ADV.entity(48 * T, 48 * T, 0); P.face = 0;
const kin = id => { const s = new Set(), go = i => { s.add(i); for (const e of ADV_DEX[i]?.evos || []) go(e.to); }; go(id); return s; };
const allowed = new Set(ADVW.table('route5').flatMap(e => [...kin(e[0])]));
ADVW.reset(); ADVW.fill(P, view(P));
ok(ADVW.groups.length >= 10 && ADVW.groups.length <= 16, `about 10-16 groups alive (${ADVW.groups.length})`);
for (const g of ADVW.groups) {
  ok(allowed.has(g.id), `spawned ${g.id} comes from the zone table`);
  ok(g.m.length >= ADV_TEMPER[g.id].group[0] - 0 && g.m.length <= ADV_TEMPER[g.id].group[1], `${g.id} group size ${g.m.length} inside ${ADV_TEMPER[g.id].group}`);
  for (const w of g.m) { ok(Math.hypot(w.e.x - P.x, w.e.y - P.y) >= 12 * T, 'never closer than 12 tiles'); ok(!ADVW.seen(w.e.x, w.e.y, view(P)), 'never on screen at spawn'); }
}
// spawning while the player roams: every member of every new group is off screen and 12+ tiles away at the moment it appears
const mkGroup = ADVW.group; let made = 0, bad = 0, V = view(P);
ADVW.group = function (id, lv, home, pts) { for (const p of pts) { made++; if (ADVW.seen(p.x, p.y, V) || Math.hypot(p.x - P.x, p.y - P.y) < 12 * T) bad++; } return mkGroup.call(this, id, lv, home, pts); };
ADVW.reset();
for (let i = 0; i < 300; i++) { P.x = (48 + Math.sin(i / 17) * 25) * T; P.y = (48 + Math.cos(i / 23) * 25) * T; V = view(P); ADVW.tick(0.25, P, V); }
ADVW.group = mkGroup; const nearN = () => ADVW.groups.filter(g => Math.hypot(g.m[0].e.x - P.x, g.m[0].e.y - P.y) < 40 * T).length;
ok(made > 40 && bad === 0, `roaming spawns never appear on screen (${made} spawned, ${bad} bad)`); ok(nearN() >= 10 && nearN() <= 16, `and 10-16 groups live within 40 tiles (${nearN()})`);
// despawn beyond 60 tiles, but never a group in a fight
P.x = 10 * T; P.y = 10 * T; ADVW.reset();
const far = ADVW.group('wooloo', 5, { x: 75 * T, y: 10 * T }, [{ x: 75 * T, y: 10 * T }]), mid = ADVW.group('wooloo', 5, { x: 65 * T, y: 10 * T }, [{ x: 65 * T, y: 10 * T }]), busy = ADVW.group('wooloo', 5, { x: 80 * T, y: 12 * T }, [{ x: 80 * T, y: 12 * T }]);
busy.m[0].st = 'fight'; ADVW.tick(0.3, P, view(P));
ok(!ADVW.groups.includes(far), 'a group 65 tiles away despawns'); ok(ADVW.groups.includes(mid), 'a group 55 tiles away stays'); ok(ADVW.groups.includes(busy), 'a group in a fight never despawns');
// only entities within 50 tiles think
const sleeper = mid.m[0]; sleeper.wait = 0; sleeper.go = { x: 65 * T + 80, y: 10 * T, t: 3 }; const sx = sleeper.e.x; ADVW.update(1, P, 'walk'); eq(sleeper.e.x, sx, 'a mon 50+ tiles away is not simulated');
// the badge band drives evolutions of spawned groups
ADV.player = { badges: 8 }; ADVW.reset(); P.x = P.y = 48 * T; ADVW.fill(P, view(P)); delete ADV.player;
ok(ADVW.groups.length > 5 && ADVW.groups.every(g => !['wooloo', 'bunnelby'].includes(g.id)), 'at 8 badges the Route 5 herds have evolved');
ok(ADVW.groups.every(g => g.m.every(w => w.level >= 44 && w.level <= 50)), 'and every member sits inside the band (44-48, +2 for the 5 % band)'); ADVW.hourSet = 12;

// temperament behaviours on open ground
const mk = (id, pts) => ADVW.group(id, 5, pts[0], pts), at = (dx, dy = 0) => ({ x: P.x + dx * T, y: P.y + dy * T });
const run = (secs, mode = 'walk') => { for (let i = 0; i < secs * 60; i++) ADVW.update(1 / 60, P, mode); };
const dist = w => Math.hypot(w.e.x - P.x, w.e.y - P.y);
eq(ADV_TEMPER.wooloo.t, 'skittish', 'wooloo is skittish'); eq(ADV_TEMPER.houndour.t, 'aggressive', 'houndour is aggressive'); eq(ADV_TEMPER.bouffalant.t, 'territorial', 'bouffalant is territorial'); eq(ADV_TEMPER.bidoof.t, 'passive', 'bidoof is passive');
P.x = 48 * T; P.y = 48 * T; P.lv = 0;
ADVW.reset(); let g = mk('wooloo', [at(4.5, 0), at(5, 1), at(5.5, -1)]);
run(0.1); ok(g.m.every(w => w.st === 'flee'), 'a skittish herd flees when the player comes within 5 tiles'); run(2); ok(g.m.every(w => dist(w) > 7 * T), 'and keeps running away'); run(6); ok(g.m.every(w => w.st === 'wander'), 'then calms down and wanders again');
ADVW.reset(); g = mk('wooloo', [at(7, 0), at(7.5, 1)]); run(3); ok(g.m.every(w => w.st === 'wander'), 'a herd 7 tiles away just wanders');
ADVW.reset(); g = mk('bidoof', [at(2, 0), at(2, 1)]); run(3); ok(g.m.every(w => w.st === 'wander') && g.m.every(w => dist(w) > 20), 'passive mons ignore the player');
ADVW.reset(); g = mk('houndour', [at(5.5, 0), at(5.5, 1), at(6, -1)]); g.m.forEach(w => { w.face = 6; });                      // looking at the player (west)
ADVW.fx = []; run(0.1); ok(g.m.every(w => w.st === 'alert') && ADVW.fx.filter(f => f.k === '!').length === g.m.length, 'an aggressive pack notices the player in its facing cone: "!" for each');
run(0.8); ok(g.m.every(w => w.st === 'charge'), 'then charges'); const d0 = Math.min(...g.m.map(dist)); run(2 * S); ok(Math.min(...g.m.map(dist)) < d0 - 3 * T && Math.min(...g.m.map(dist)) < 40, 'and closes in for contact');
ADVW.reset(); g = mk('houndour', [at(5.5, 0), at(5.5, 1)]); g.m.forEach(w => { w.face = 2; });                                  // looking away
run(0.3); ok(g.m.every(w => w.st === 'wander'), 'an aggressive pack facing away does not notice');
ADVW.reset(); g = mk('houndour', [at(5.5, 0), at(5.5, 1)]); g.m.forEach(w => { w.face = 6; }); ADVW.update(1 / 60, { ...P, lv: 1 }, 'walk'); ok(g.m.every(w => w.st === 'wander'), 'nobody notices a player on another level');
ADVW.reset(); g = mk('houndour', [at(5.5, 0), at(5.5, 1)]); g.m.forEach(w => { w.face = 6; }); run(0.1, 'battle'); ok(g.m.every(w => w.st === 'wander'), 'nothing notices during a fight');
ADVW.reset(); g = mk('bouffalant', [at(8, 0), at(8, 1)]); g.m.forEach(w => { w.face = 6; }); run(0.5); ok(g.m.every(w => w.st === 'wander'), 'territorial mons ignore a player outside 3 tiles of home');
P.x += 6 * T; run(0.1); ok(g.m.every(w => w.st === 'alert'), 'and charge once the player is within 3 tiles of home'); P.x -= 6 * T;

// pile-on queue: same species within 10 legacy tiles (320 world px: the fight box keeps its size), nearest first, target first
ADVW.reset(); g = mk('houndour', [{ x: 20 * T, y: 20 * T }, { x: 20 * T + 3 * DT, y: 20 * T }, { x: 20 * T, y: 20 * T + 2 * DT }, { x: 20 * T + 8 * DT, y: 20 * T }, { x: 20 * T, y: 20 * T + 11 * DT }, { x: 20 * T + DT, y: 20 * T + DT }, { x: 20 * T - DT, y: 20 * T }]);
const [tg, m3, m2, m8, m11, m1, m1b] = g.m; m1b.id = 'rockruff'; m1.st = 'fight';
const q = ADVW.queue(tg);
ok(q.length === 4 && q[0] === tg && q[1] === m2 && q[2] === m3 && q[3] === m8, 'queue = target, then group mates nearest first');
ok(!q.includes(m11) && !q.includes(m1) && !q.includes(m1b), 'mates 11 legacy tiles away, mates already fighting and other species stay out');
const cx = 20 * T + 1.5 * DT, cy = 20 * T, es = q.slice(1).map(w => ADVW.edge(w, cx, cy));
ok(es.every(s => Math.hypot(s.x - cx, s.y - cy) >= 7 * DT - 0.01 && Math.hypot(s.x - cx, s.y - cy) <= 8 * DT + 0.01), 'queued mons wait 7-8 legacy tiles (224-256 px) from the fight centre');
q.slice(1).forEach((w, i) => Object.assign(w, { st: 'wait', spot: es[i], watch: { x: cx, y: cy } })); P.x = cx; P.y = cy; run(8, 'battle');
ok(q.slice(1).every((w, i) => Math.hypot(w.e.x - es[i].x, w.e.y - es[i].y) < 5), 'waiting mons walk out to their spots'); ok(q.slice(1).every(w => !w.moving && Math.hypot(w.e.x - cx, w.e.y - cy) >= 6.5 * DT), 'and stand there');
ok(DIR_VEC[m3.face][0] * (cx - m3.e.x) + DIR_VEC[m3.face][1] * (cy - m3.e.y) > 0, 'watching the fight');
ADVW.kill(tg); ok(!g.m.includes(tg) && ADVW.groups.includes(g), 'a beaten mon leaves its group'); g.m.slice().forEach(w => ADVW.kill(w)); ok(!ADVW.groups.includes(g), 'an empty group is dropped');

// tall grass ambush: 3 % per 32 px, one aggressive mon 1.5 tiles ahead
ADVW.reset(); ADVW.fx = []; ADVW.hourSet = 12; P.x = 33.5 * T; P.y = 33.5 * T; P.z = 0; P.face = 2; ADVW.gd = 0;
ADVW.rnd = () => 0.01; eq(ADVW.grass(P, 31), null, 'less than 32 px in the grass pops nothing'); let pop = ADVW.grass(P, 1);
ok(pop && pop.st === 'pop' && pop.tm.t === 'aggressive', 'every 32 px has a chance to pop an aggressive mon'); ok(Math.abs(pop.e.x - (P.x + 1.5 * T)) < 0.5 && Math.abs(pop.e.y - P.y) < 0.5, 'it appears 1.5 tiles ahead');
ok(ADVW.fx.some(f => f.k === '!' && f.w === pop) && ADVW.fx.some(f => f.k === 'rustle'), 'with a rustle and a "!"');
ADVW.rnd = () => 0.5; ADVW.gd = 0; eq(ADVW.grass(P, 320), null, 'a roll over 3 % pops nothing');
ADVW.rnd = () => 0.01; ADVW.gd = 0; ADVW.reset(); pop = ADVW.grass(P, 96); ok(pop && ADVW.groups.length === 1, 'several steps at once pop at most one mon');
ADVW.reset(); P.z = 32; eq(ADVW.grass(P, 64), null, 'not at ground level: no ambush'); P.z = 0; P.x = 5.5 * T; P.y = 1.5 * T; eq(ADVW.grass(P, 64), null, 'plain grass: no ambush');
ADVW.rnd = seeded(7);
window.ADV_ZONES = REAL_ZONES; ADVW.hourSet = null; ADVW.reset(); ADV.setWorld(null);

// ---------- W1c: party, catching, growth, saves (src/adv-party.js, src/adv-save.js) ----------
// the sim's makeMon / legalMoves give the real max HP and move legality, so battle.js and the dex load here too
Object.assign(globalThis, { clamp: (v, a, b) => v < a ? a : v > b ? b : v, lerp: (a, b, t) => a + (b - a) * t, rand: (a, b) => a + Math.random() * (b - a), pick: a => a[0] });
for (const f of ['data/dex.js', 'data/adv/world.js', 'data/adv/tileset-region.js']) load(f);   // tileset-region registers the map-lab mats (rgGrass, rgPath, rgWater) with the world palette, as the browser does
load('src/battle.js');
load('data/adv/outfits.js'); const ADVO = load('src/adv-outfit.js', '\n;ADVO');
const ADVP = load('src/adv-party.js', '\n;ADVP'), ADVS = load('src/adv-save.js', '\n;ADVS');   // scales world.js's px and the towns' door offsets on load
load('data/adv/follower-moods.js'); load('data/portraits.js'); const ADVF = globalThis.ADVF = load('src/adv-follower.js', '\n;ADVF');   // the lead mon (the scene code under test reads it as a global)

// catch formula: a = (3 maxHP - 2 HP) * rate * ball / (3 maxHP) * status, shake check b = 1048560 / (16711680 / a)^(1/4)
eq(ADVP.catchA(100, 100, 255, 1), 85, 'full HP, rate 255, Poke Ball: a = 85');
eq(ADVP.shakeB(85), 49931, 'a = 85: shake value 49931'); ok(Math.abs(ADVP.catchProb(85) - 0.337) < 0.002, 'about 33.7 % for a wooloo at full HP');
eq(ADVP.catchA(100, 100, 45, 1), 15, 'starter rate 45 at full HP: a = 15'); eq(ADVP.shakeB(15), 32767, 'a = 15: shake value 32767'); ok(Math.abs(ADVP.catchProb(15) - 0.0625) < 0.001, 'a = 15 catches 6.25 % of the time');
eq(ADVP.catchA(100, 1, 45, 1), 44, 'rate 45 at 1 HP: a = 44'); eq(ADVP.catchA(100, 1, 45, 1, 'slp'), 88, 'sleep doubles a'); eq(ADVP.catchA(100, 1, 45, 1, 'par'), 66, 'paralysis x1.5');
eq(ADVP.catchA(100, 100, 45, 2), 30, 'Ultra Ball doubles a'); eq(ADVP.catchA(100, 50, 255, 1.5), 255, 'Great Ball at half HP, rate 255: a caps at 255'); ok(ADVP.catchProb(255) === 1, 'a of 255 always catches');
eq(ADVP.catchA(100, 100, 3, 255), 255, 'Master Ball always catches'); ok(ADVP.catchProb(2) < 0.01, 'a = 2 (a legendary at full HP) is under 1 %');
ADVP.rnd = () => 0; ok(ADVP.throwBall(85).caught && ADVP.throwBall(85).shakes === 3, 'four passed checks: caught after 3 shakes');
ADVP.rnd = () => 0.99; let tb = ADVP.throwBall(85); ok(!tb.caught && tb.shakes === 0, 'first check fails: no shake, not caught');
{ const seq = [0, 0, 0.99]; ADVP.rnd = () => seq.shift(); tb = ADVP.throwBall(85); ok(!tb.caught && tb.shakes === 2, 'third check fails: 2 shakes, it breaks free'); }
{ ADVP.rnd = seeded(11); let c = 0; for (let i = 0; i < 20000; i++) if (ADVP.throwBall(85).caught) c++; ok(Math.abs(c / 20000 - 0.337) < 0.012, 'simulated catch rate matches the formula (' + (c / 200).toFixed(1) + ' %)'); }
ADVP.rnd = Math.random;

// EXP curves for all six growth rates
for (const [rate, at] of Object.entries({ fast: [800, 100000, 800000], mediumfast: [1000, 125000, 1000000], mediumslow: [560, 117360, 1059860], slow: [1250, 156250, 1250000], erratic: [1800, 125000, 600000], fluctuating: [540, 142500, 1640000] }))
  [10, 50, 100].forEach((lv, i) => eq(ADVP.expFor(rate, lv), at[i], `${rate} needs ${at[i]} EXP at level ${lv}`));
eq(ADVP.expFor('mediumslow', 1), 0, 'level 1 needs nothing even where the formula goes negative'); eq(ADVP.expFor('mediumslow', 2), 9, 'medium slow level 2 = 9');
for (const rate of Object.keys(ADVP.CURVE)) { let up = true; for (let l = 2; l <= 100; l++) { if (ADVP.expFor(rate, l) <= ADVP.expFor(rate, l - 1)) up = false; if (ADVP.levelFor(rate, ADVP.expFor(rate, l)) !== l || ADVP.levelFor(rate, ADVP.expFor(rate, l) - 1) !== l - 1) up = false; } ok(up, rate + ' curve rises and levelFor inverts it at every level'); }
eq(ADVP.expGain(64, 5, 5, 1), 65, 'EXP: base 64, level 5 foe, level 5 mon = 65'); eq(ADVP.expGain(64, 5, 5, 2), 33, 'split between two'); eq(ADVP.expGain(64, 5, 5, 1, true), 97, 'trainer fights pay 1.5x');
ok(ADVP.expGain(64, 20, 40, 1) < ADVP.expGain(64, 20, 20, 1) && ADVP.expGain(64, 40, 20, 1) > ADVP.expGain(64, 20, 20, 1), 'a bigger level gap shrinks the gain, a stronger foe raises it');
eq(ADVP.rate('bulbasaur'), 'mediumslow', 'rates come from ADV_DEX'); eq(ADVP.info('wooloo').catchRate, 255, 'catch rate comes from ADV_DEX'); ok(Object.keys(ADV_DEX).filter(k => k !== 'substitutedoll').every(k => ADV_DEX[k].catchRate > 0 && ADV_DEX[k].baseExp > 0 && ADVP.CURVE[ADV_DEX[k].growthRate]), 'every species has catch rate, base EXP and a known growth rate');

// new mons: level-up moves, hp, EXP
const bulb = ADVP.mon('bulbasaur', 5);
eq(bulb.moves.join(), 'growl,tackle,vinewhip', 'a level 5 Bulbasaur knows its level-up moves up to level 5'); eq(bulb.hp, ADVP.max(bulb), 'new mons are at full HP'); eq(bulb.exp, 135, "and sit at their level's EXP (medium slow level 5)");
eq(ADVP.mon('charmander', 30).moves.length, 4, 'a level 30 mon has 4 moves'); ok(ADVP.mon('charmander', 30).moves.includes('flamethrower') && !ADVP.mon('charmander', 30).moves.includes('growl'), 'the 4 latest ones');
ok(ADVP.mon('magikarp', 5).moves.length > 0, "a species without level-up data still gets the sim's default moves");

// level up: stats recalculated keeping the HP fraction, moves learned or asked about
{
  const s = ADVP.mon('bulbasaur', 5), m0 = ADVP.max(s); s.hp = Math.round(m0 / 2);
  let ev = ADVP.gain(s, ADVP.expFor('mediumslow', 6) - s.exp);
  eq(s.level, 6, 'enough EXP raises the level'); ok(ev[0].t === 'lv' && ev[0].after.hp > ev[0].before.hp, 'the level-up page shows the stat gains'); ok(Math.abs(s.hp / ADVP.max(s) - 0.5) < 0.04, 'HP fraction is kept (' + s.hp + ' / ' + ADVP.max(s) + ')');
  ok(ev.some(e => e.t === 'learn' && e.mv === 'growth') && s.moves.length === 4, 'a free slot learns the level 6 move at once');
  ev = ADVP.gain(s, ADVP.expFor('mediumslow', 9) - s.exp);
  eq(s.level, 9, 'three levels at once'); const fg = ev.find(e => e.t === 'forget'); ok(fg && fg.mv === 'leechseed' && !s.moves.includes('leechseed'), 'with 4 moves known the new one is offered, not forced');
  ADVP.replace(s, 0, fg.mv); ok(s.moves.includes('leechseed') && !s.moves.includes('growl'), 'replacing a move swaps it in');
  ev = ADVP.gain(s, 0); eq(ev.length, 0, 'no new level: nothing happens'); ADVP.gain(s, 1e9); eq(s.level, 100, 'the level caps at 100'); eq(s.exp, 1059860, 'EXP caps at the level 100 total');
  const f = ADVP.mon('bulbasaur', 5); f.hp = 0; ADVP.gain(f, 1000); eq(f.hp, 0, 'a fainted mon stays fainted when it levels');
}

// evolution: level, friendship + time of day, items; trade and conditions we cannot check never fire
{
  let s = ADVP.mon('bulbasaur', 15), ev = ADVP.gain(s, ADVP.expFor('mediumslow', 16) - s.exp);
  ok(ev.some(e => e.t === 'evo' && e.to === 'ivysaur'), 'Bulbasaur evolves into Ivysaur at 16'); eq(s.species, 'bulbasaur', 'the page only offers it');
  s.hp = Math.round(ADVP.max(s) / 2); const f = s.hp / ADVP.max(s); ADVP.evolve(s, 'ivysaur'); eq(s.species, 'ivysaur', 'evolve() changes the species'); eq(s.ability, 'Overgrow', 'ability slot carries over'); ok(Math.abs(s.hp / ADVP.max(s) - f) < 0.04, 'HP fraction kept through evolution');
  s = ADVP.mon('bulbasaur', 17); ok(!ADVP.gain(s, 1).some(e => e.t === 'evo'), 'no level up, no evolution page (a declined one comes back at the next level)'); ok(ADVP.gain(s, ADVP.expFor('mediumslow', 18) - s.exp).some(e => e.to === 'ivysaur'), 'an Ivysaur-ready Bulbasaur is offered it again at the next level');
  s = ADVP.mon('wooloo', 23); ok(ADVP.gain(s, ADVP.expFor('mediumfast', 24) - s.exp).some(e => e.to === 'dubwool'), 'Wooloo evolves at 24');
  s = ADVP.mon('wooloo', 20); ok(!ADVP.gain(s, ADVP.expFor('mediumfast', 21) - s.exp).some(e => e.t === 'evo'), 'but not before');
  s = ADVP.mon('eevee', 20); s.friend = 219; eq(ADVP.evoFor(s, { time: 'day' }), null, 'Eevee below 220 friendship stays Eevee'); s.friend = 220; eq(ADVP.evoFor(s, { time: 'day' }), 'espeon', 'friendship by day: Espeon'); eq(ADVP.evoFor(s, { time: 'night' }), 'umbreon', 'by night: Umbreon');
  eq(ADVP.evoFor(s, {}), null, 'no time of day given: nothing'); eq(ADVP.evoItem(s, 'waterstone'), 'vaporeon', 'Water Stone: Vaporeon'); eq(ADVP.evoItem(ADVP.mon('pikachu', 20), 'thunderstone'), 'raichu', 'Thunder Stone: Raichu'); eq(ADVP.evoItem(s, 'thunderstone'), 'jolteon', 'Thunder Stone: Jolteon');
  s = ADVP.mon('haunter', 40); s.friend = 255; eq(ADVP.evoFor(s, { time: 'day' }), null, 'trade evolutions do not fire'); eq(ADVP.evoFor(ADVP.mon('rockruff', 25), { time: 'night' }), 'lycanrocmidnight', 'level + night: midnight Lycanroc'); eq(ADVP.evoFor(ADVP.mon('rockruff', 25), { time: 'day' }), 'lycanroc', 'level + day: Lycanroc');
  s = ADVP.mon('togepi', 20); s.friend = 220; eq(ADVP.evoFor(s, {}), 'togetic', 'friendship-only evolution (Togepi)');
}

// bag items
{
  const bag = ADVP.startBag(); ok(ADVP.take(bag, 'pokeball') && bag.pokeball === 19 && !ADVP.take(bag, 'masterball'), 'take() uses one and refuses what you lack'); bag.antidote = 1; ADVP.take(bag, 'antidote'); ok(!('antidote' in bag), 'an empty stack leaves the bag');
  const u = { hp: 10, status: 'psn' }; eq(ADVP.useOn(u, 'potion', 200, 40), 'healed', 'Potion heals'); eq(u.hp, 110, 'a Potion is 20 real HP: 100 battle units at 5 per HP'); eq(ADVP.useOn(u, 'antidote', 200, 40), 'cured', 'Antidote cures poison'); eq(u.status, '', 'status cleared'); eq(ADVP.useOn(u, 'antidote', 200, 40), '', 'and does nothing twice');
  const d = { hp: 0, status: '' }; eq(ADVP.useOn(d, 'potion', 100, 20), '', 'Potion does nothing on a fainted mon'); eq(ADVP.useOn(d, 'revive', 100, 20), 'revived', 'Revive'); eq(d.hp, 50, 'at half HP');
  const w = { hp: 30, status: 'par' }; eq(ADVP.useOn(w, 'fullrestore', 100, 20), 'healed', 'Full Restore heals'); ok(w.hp === 100 && w.status === '', 'and cures');
}

// the save: model, encryption round trip, tamper rejection
{
  const st = ADVP.mon('bulbasaur', 5, { ot: 'Ash' }), sv = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: st });
  ok(sv.party.length === 1 && sv.money === 3000 && sv.badges === 0 && sv.home === 'G7' && sv.last === 'G7' && Array.isArray(sv.box) && sv.bag.pokeball > 0, 'a new save has the party, box, bag, money, badges, hometown, name and avatar');
  ADVS.check(sv); ADV.player = sv; ok(ADVW.level('common') <= 11, 'ADV.player = the save: badge band 0'); sv.badges = 3; ok(ADVW.level('common') >= 21, 'its badges pick the wild level band'); sv.badges = 0; delete ADV.player;
  const txt = await ADVS.seal(sv); ok(txt.startsWith('KENORA-SAV1\n') && !txt.includes('Ash') && !txt.includes('bulbasaur'), 'the file is a magic line plus base64, no plain text');
  const back = await ADVS.open(txt); assert.deepEqual(back, sv); n++; ok(true, 'decrypts to the same save');
  ok((await ADVS.seal(sv)) !== txt, 'a random salt and iv make every file different');
  // no crypto.subtle (a phone on plain http): the pure-JS path writes and reads the very same files
  const soft = await ADVS.seal(sv, true), hard = await ADVS.seal(sv, false);
  ok(soft.startsWith('KENORA-SAV1') && !soft.includes('Ash'), 'the pure-JS path writes the same kind of file');
  assert.deepEqual(await ADVS.open(soft, false), sv); n++; ok(true, 'pure-JS encrypt, Web Crypto decrypt');
  assert.deepEqual(await ADVS.open(hard, true), sv); n++; ok(true, 'Web Crypto encrypt, pure-JS decrypt');
  assert.deepEqual(await ADVS.open(soft, true), sv); n++; ok(true, 'pure-JS round trip');
  for (const [name, f] of [['pure-JS', soft], ['Web Crypto', hard]]) for (const soft2 of [true, false]) for (const i of [3, 24, 60, f.split('\n')[1].length - 6]) {
    const bd = f.split('\n')[1]; let msg = ''; try { await ADVS.open('KENORA-SAV1\n' + bd.slice(0, i) + (bd[i] === 'A' ? 'B' : 'A') + bd.slice(i + 1), soft2); } catch (e) { msg = e.message; }
    ok(/edited or damaged/.test(msg), name + ' file with byte ' + i + ' changed is rejected by the ' + (soft2 ? 'pure-JS' : 'Web Crypto') + ' reader');
  }
  const body = txt.split('\n')[1], flip = (s, i) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
  for (const [name, i] of [['salt', 3], ['iv', 24], ['ciphertext', 60], ['last byte (tag)', body.length - 6]]) {
    let msg = ''; try { await ADVS.open('KENORA-SAV1\n' + flip(body, i)); } catch (e) { msg = e.message; }
    ok(/edited or damaged/.test(msg), `a changed ${name} byte is rejected with a clear message`);
  }
  let m1 = ''; try { await ADVS.open('hello'); } catch (e) { m1 = e.message; } ok(/not a Kenora save/.test(m1), 'a foreign file is rejected'); m1 = ''; try { await ADVS.open('KENORA-SAV1\nAAAA'); } catch (e) { m1 = e.message; } ok(/damaged/.test(m1), 'a truncated file is rejected');
  const bad = JSON.parse(JSON.stringify(sv)); bad.party[0].species = 'notamon'; let m2 = ''; try { ADVS.check(bad); } catch (e) { m2 = e.message; } ok(/not valid/.test(m2), 'a well-encrypted but nonsense save fails the shape check');
  eq(ADVS.fileName(sv, new Date('2026-10-14T12:00:00Z')), 'kenora-ash-2026-10-14.sav', 'file name: kenora-<name>-<date>.sav');
  // the outfit customiser (docs/OUTFITS.md): a save carries save.outfit; it survives the .sav round trip; old saves get the default; hostile values are cleaned
  const OD = window.ADV_OUTFIT, on = ADVO.n(); ok(OD.body.length >= 2 && on.hair >= 5 && on.hat >= 4 && on.top >= 4 && on.bot >= 3 && on.bag >= 1 && OD.ramps.length === 16 && OD.skins.length >= 6 && OD.skins.every(s => s.length === 4), 'the part library meets the P2 counts (2+ bodies, 5+ hairs, 3+ hats, 4+ tops, 3+ bottoms), 16 ramps, 4-step skins');
  const fo = { body: 2, hair: 5, hairC: 9, hat: 3, hatC: 4, top: 1, topC: 12, bot: 2, botC: 7, bag: 0, bagC: 3, skin: 4 }, sv3 = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: st, outfit: fo });
  assert.deepEqual(sv3.outfit, fo); n++; ok(JSON.stringify(ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: st }).outfit) === JSON.stringify(ADVO.def()), 'no outfit given: the default');
  assert.deepEqual((await ADVS.open(await ADVS.seal(sv3))).outfit, fo); n++; ok(true, 'the outfit survives the .sav round trip');
  const oldSave = JSON.parse(JSON.stringify(sv)); delete oldSave.outfit; assert.deepEqual(ADVS.check(oldSave).outfit, ADVO.def()); n++; ok(true, 'an old save without an outfit loads with the default');
  const junk = JSON.parse(JSON.stringify(sv)); junk.outfit = { body: 99, hair: -1, hat: 'x', top: 1.5, skin: 3, extra: 1 }; const cj = ADVS.check(junk).outfit;
  ok(cj.body === 0 && cj.hair === 0 && cj.hat === 0 && cj.top === 0 && cj.skin === 3 && !('extra' in cj) && Object.keys(cj).length === 12, 'out of range, negative, non-integer and unknown values are cleaned');
  for (let i = 0; i < 50; i++) { const r = ADVO.rand(), cr = ADVO.clean(r); ok(ADVO.KEYS.every(k => r[k] === cr[k] && r[k] < on[k]), 'a random outfit is always valid'); }
  assert.deepEqual(ADVO.obj(ADVO.arr(fo)), fo); n++; ok(ADVO.obj([1, 2]).skin === 0 && ADVO.obj(null).body === 0, 'the wire array round trips; short or missing arrays take defaults');
  // every part's planes point at real atlas rows and take a known colour (source 'x', skin 's' or a category's ramp: a body's base and a donor's ring keep their clothes' roles) at a step in range;
  // head parts carry a per-frame face offset; a body carries a Ranger-style sheet layout (anims {row, n, fps} matching its cells, frames < nf)
  const plane = pl => Array.isArray(pl) && pl.every(([key, stp, row]) => Number.isInteger(row) && row >= 0 && (key === 'x' || ['s', 'hair', 'hat', 'top', 'bot', 'bag'].includes(key) && stp >= 0 && stp < 4));
  const FIELDS = { body: ['b', 'p'], hair: ['p', 'u', 'r'], hat: ['p', 'r'], top: ['p'], bot: ['p'], bag: ['p'] };
  for (const cat in FIELDS) for (const r of OD[cat]) ok(typeof r.n === 'string' && FIELDS[cat].every(f => plane(r[f])) && (cat !== 'hat' || r.cv >= 0) && (!['body', 'hair', 'hat'].includes(cat) || r.d.length === OD.nf) && (!r.src || r.src.every(f => f >= 0 && f < OD.nf)), cat + ' ' + r.n + ': planes and offsets in range');
  for (const B of OD.body) ok(B.fw > 0 && B.fh > 0 && B.footY < B.fh && Object.values(B.anims).every(a => B.cells[a.row] && B.cells[a.row].length === a.n && a.fps > 0) && B.cells.flat().every(([f]) => f >= 0 && f < OD.nf) && ADVO.ROWS.every(d => B.anims['walk.' + d] && B.anims['idle.' + d]), B.n + ': walk and idle rows for all 8 directions');
}
// Pokemon Center doors and towns
{
  const g7 = ADVS.town('G7'), d = ADVS.door(g7); eq(ADVS.towns().length, 16, '16 towns have a Pokemon Center (8 gym cities, 8 towns)'); ok(ADVS.towns().every(t => /^[GT]/.test(t.id)), 'landmarks are not hometowns');
  eq(ADVS.atDoor(d.x, d.y + 10), 'G7', 'pushing against the door from the front counts'); eq(ADVS.atDoor(d.x + 14 * S + 2, d.y + 10), '', 'beside the door does not'); eq(ADVS.atDoor(d.x, d.y + 40), '', 'neither does standing well in front'); eq(ADVS.inTown(g7.center.x + 100, g7.center.y), 'G7', 'inside a town disc'); eq(ADVS.inTown(0, 0), '', 'wilderness');
  const f = ADVS.front(g7); ok(Math.hypot(f.x - g7.center.x, f.y - g7.center.y) < 40 * S && ADVS.atDoor(f.x, f.y) === '', 'the spot you wake up on is in front of the door, not in the trigger');
}

// ---------- S1a: level bands, rosters, NPCs, line of sight, trainer teams, saves ----------
{
  const ADVN = load('src/adv-npc.js', '\n;ADVN'); globalThis.ADVN = ADVN;
  // band table: Appendix A caps; wild cap-8..cap-4, route trainers cap-5..cap-2, gym trainers cap-3..cap-1
  eq(ADVW.CAPS.join(), '15,19,24,29,34,38,42,46,52', 'level caps per badge count: 15 19 24 29 34 38 42 46, True Team 52');
  CAPS_EXPECT.forEach((c, b) => {
    eq(ADVN.range('wild', b).join(), [c - 8, c - 4].join(), `badges ${b}: wild ${c - 8}-${c - 4}`); eq(ADVN.range('route', b).join(), [c - 5, c - 2].join(), `badges ${b}: route trainers ${c - 5}-${c - 2}`); eq(ADVN.range('gym', b).join(), [c - 3, c - 1].join(), `badges ${b}: gym trainers ${c - 3}-${c - 1}`);
  });
  eq(ADVN.range('route', 99).join(), '47,50', 'badges clamp at 8'); eq(ADVN.bandKey(0), 'b1', 'arriving with 0 badges = Badge 1 band'); eq(ADVN.bandKey(7), 'b8', '7 badges = Badge 8'); eq(ADVN.bandKey(8), 'true', '8 badges = True Team');
  ok(ADVN.SIZE.every(([a, z], b) => a <= z && (b < 2 ? z <= 2 : b < 4 ? a >= 2 && z <= 3 : b < 6 ? a >= 3 && z <= 4 : a === 4 && z === 6)), 'trainer team size by badges: 1-2, 2-3, 3-4, 4-6');

  // rosters: every leader with b1..b8 and true, sizes 3 3 4 5 5 6 6 6 6, ids resolve, levels under the cap
  load('data/adv/rosters.js'); const RO = window.ADV_ROSTERS, SZ = [3, 3, 4, 5, 5, 6, 6, 6, 6], KEYS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'true'];
  const WHO = ['vesper', 'bjorn', 'thorn', 'silas', 'sterling', 'aspen', 'whitney', 'rue', 'chadwick', 'jet', 'inkwell', 'soot', 'wash', 'ethan'];
  eq(Object.keys(RO).sort().join(), [...WHO].sort().join(), '8 leaders, the Champion, 4 lieutenants and Ethan have rosters');
  let mons = 0;
  for (const w of WHO) KEYS.forEach((k, i) => {
    const t = RO[w][k]; ok(Array.isArray(t) && t.length === SZ[i], `${w} ${k}: ${SZ[i]} mons`);
    ok(t.every(m => DEX.species[m.species] && m.moves.length >= 1 && m.moves.length <= 4 && m.moves.every(x => DEX.moves[x]) && m.level <= CAPS_EXPECT[i] && m.level >= CAPS_EXPECT[i] - 3), `${w} ${k}: every species and move id resolves, levels within 3 of the cap ${CAPS_EXPECT[i]}`);
    mons += t.length;
  });
  eq(mons, 616, '616 roster mons parsed (14 characters x 44)'); ok(RO.ethan.shadow.length === 1 && RO.ethan.shadow[0].species === 'tyranitar' && RO.ethan.shadow[0].level === 60, "Ethan's shadow card");
  eq(RO.whitney.b1.map(m => m.species + m.level).join(), 'miltank15,cleffa14,wooloo14', "Whitney's Badge 1 team is the appendix's"); eq(RO.whitney.b1[0].moves.join(), 'growl,rollout,defensecurl,stomp', 'with its exact moves'); eq(RO.whitney.true.map(m => m.species).join(), 'miltank,clefable,dubwool,copperajah,bouffalant,arboliva', 'Whitney True Team');
  ok(WHO.every(w => w === 'chadwick' || KEYS.every(k => RO[w][k].some(m => m.ace))), 'every roster marks its ace'); eq(RO.chadwick.b1[0].species, 'meowthalola', 'regional forms: Alolan Meowth'); eq(RO.sterling.b1[0].species, 'gimmighoul', 'and plain ones');

  // line of sight on a flat test field: a wall and a cliff block it, range, facing and level matter
  ADV.reset(); ADV.setWorld({ palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'], chunksW: 2, chunksH: 1 });
  chunk(0, 0, (x, y) => (x === 14 && y === 5 ? { h: 1 } : {}), [['pineTree', 7 * DT + 16, 12 * DT + 20]]);
  chunk(1, 0, () => ({}));
  const mkn = (cx, cy, face, sight = 5) => ({ id: 't', face, def: { trainer: { sight } }, e: ent(cx, cy) });
  const at = (cx, cy) => [(cx + 0.5) * T, (cy + 0.5) * T];
  let tn = mkn(2, 2, 2);                                                                  // faces east
  ok(ADVN.sees(tn, ...at(5, 2), 0), 'sees a player 3 tiles ahead'); ok(ADVN.sees(tn, ...at(7, 2), 0), 'and 5 tiles ahead (the sight range)'); ok(!ADVN.sees(tn, ...at(8, 2), 0), 'but not 6');
  ok(!ADVN.sees(tn, ...at(0, 2), 0), 'behind is not ahead'); ok(!ADVN.sees(tn, ...at(5, 4), 0) && !ADVN.sees(tn, ...at(5, 3), 0), 'a player off the line (1 or 2 tiles to the side) is not seen');
  ok(ADVN.sees(tn, (5 + 0.5) * T, (2 + 0.5) * T + 10, 0), 'a few px off the line still counts'); ok(!ADVN.sees(tn, (5 + 0.5) * T, (2 + 0.5) * T + 20, 0), 'but 20 px off does not');
  ok(!ADVN.sees(mkn(5, 2, 6), ...at(8, 2), 0), 'facing away: not seen'); ok(ADVN.sees(mkn(5, 2, 6), ...at(2, 2), 0), 'facing west sees west');
  ok(ADVN.sees(mkn(3, 2, 0), ...at(3, 5), 0) && ADVN.sees(mkn(3, 5, 4), ...at(3, 2), 0), 'facing south and north work'); ok(!ADVN.sees(mkn(3, 2, 0), ...at(3, 1), 0), 'facing south does not see north');
  ok(!ADVN.sees(tn, ...at(5, 2), 1), 'a player on another level is never seen');
  ok(!ADVN.sees(mkn(5, 12, 2), ...at(9, 12), 0), 'a tree between you and the trainer blocks the view'); ok(ADVN.sees(mkn(5, 13, 2), ...at(9, 13), 0), 'the tree only blocks its own row'); ok(ADVN.sees(mkn(8, 12, 2), ...at(9, 12), 0), 'and a player standing in front of the tree is seen');
  ok(!ADVN.sees(mkn(12, 5, 2), ...at(16, 5), 0), 'a raised cell (cliff) in the line blocks it'); ok(ADVN.sees(mkn(12, 6, 2), ...at(16, 6), 0), 'the same line a row down is clear');
  ok(!ADVN.sees({ id: 'v', face: 2, def: {}, e: ent(2, 2) }, ...at(4, 2), 0), 'a villager (no trainer data) never spots');
  // spot(): first undefeated trainer that sees the player; defeated ones and busy ones do not
  const P = ent(5, 2); P.lv = 0; ADVN.list = [{ id: 'a', face: 2, def: { trainer: { sight: 5 } }, e: ent(2, 2), busy: false }]; ADV.player = { beat: {} };
  eq(ADVN.spot(P)?.id, 'a', 'spot() finds the trainer that sees you'); ADV.player.beat.a = 1; eq(ADVN.spot(P), null, 'a defeated trainer never spots you again'); ADV.player.beat = {}; ADVN.list[0].busy = true; eq(ADVN.spot(P), null, 'nor one that is busy'); ADVN.list[0].busy = false; P.x += 400; eq(ADVN.spot(P), null, 'nor one that is too far');

  // trainer teams: first N of the list, N by band and fixed per trainer, levels from the route band, species evolved, deterministic
  const hasOrig = ADVW.has; ADVW.has = () => true;   // no sprite data in node: every species counts as drawable
  const t6 = { team: [['wooloo', 0], ['bunnelby', 1], ['wooloo', 1], ['bunnelby', 2], ['wooloo', 3], ['bunnelby', 3]], sight: 5, money: 16 };
  for (let b = 0; b <= 8; b++) {
    const [lo, hi] = ADVN.SIZE[b], tm = ADVN.team(t6, 'x1', b), [a, z] = ADVN.range('route', b);
    ok(tm.length >= lo && tm.length <= hi && tm.length === ADVN.team(t6, 'x1', b).length, `badges ${b}: team of ${tm.length} (${lo}-${hi}), the same every time`);
    ok(tm.every(m => m.level >= a && m.level <= z), `badges ${b}: levels inside ${a}-${z}`);
  }
  ok(ADVN.team(t6, 'x1', 8).some(m => m.species === 'dubwool') && ADVN.team(t6, 'x1', 0).every(m => m.species === 'wooloo' || m.species === 'bunnelby'), 'at 8 badges a Wooloo is a Dubwool, at 0 it is not');
  eq(ADVN.pay({ money: 16 }, [{ level: 10 }, { level: 12 }]), 192, 'payout = money x the strongest level'); eq(ADVN.team({ team: [['wooloo', 0]], gym: true }, 'g', 0)[0].level, 12, 'gym trainers use cap-3 (12 at badge 0)');
  eq(ADVN.avatar({ cls: 'Hiker' }), 'hiker', 'class picks its portrait');

  // placements on the real world: every NPC stands on free ground in the right zone, trainers see the road along their face
  load('data/trainer-ow8.js'); load('data/trainer-ow-ranger.js'); load('data/adv/npcs.js'); const D = window.ADV_NPCS, O8 = window.TRAINER_OW8;
  ADV.reset(); ADV.setWorld(window.ADV_WORLD); ADV.fallback = false;
  const cs = new Set(); for (const d of D) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cs.add((d.x >> 5) + dx + ',' + ((d.y >> 5) + dy));
  for (const k of cs) { const f = new URL(`../data/adv/chunks/${k.replace(',', '_')}.js`, import.meta.url); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8')); }
  eq(new Set(D.map(d => d.id)).size, D.length, 'NPC ids are unique');
  ADVN.load(D); ADV.player = { badges: 0, beat: {} };
  const villagers = D.filter(d => !d.trainer), trainers = D.filter(d => d.trainer), where = id => ({ r5: 'route5', r7: 'route7', r8: 'route8', r9: 'route9', r10: 'route10', g7: 'goldacre', s5: 'saltbay', r6: 'route6', t7: 'longshore', t4: 'tradeway', g6: 'pinegrove', t6: 'spindlewood', g8: 'sporehaven', t8: 'duskmoss', l4: 'quietplain', r1: 'route1', r103: 'route103', r3: 'route3', r111: 'route111', r21: 'route21', r22: 'route22', r2: 'route2', r101: 'route101', t2: 'sailsport', g5: 'aldermerecity', g4: 'claystone', g2: 'sprucevale', t1: 'frostfall', g1: 'dunereach' })[id.split('-')[0]];
  const vil = p => villagers.filter(d => d.id.startsWith(p + '-'));
  ok(vil('g7').length >= 8 && vil('g7').length <= 12, `${vil('g7').length} Goldacre villagers (8-12)`); ok(vil('s5').length >= 8 && vil('s5').length <= 14, `${vil('s5').length} Salt Bay villagers outdoors (8-14, more inside the houses)`);
  ok(vil('t7').length >= 8 && vil('t7').length <= 14, `${vil('t7').length} Longshore villagers outdoors (8-14, more inside the houses)`); ok(vil('t4').length >= 8 && vil('t4').length <= 14, `${vil('t4').length} Tradeway villagers outdoors (8-14, more inside the houses and the cave)`); ok(vil('g6').length >= 8 && vil('g6').length <= 14, `${vil('g6').length} Pinegrove villagers outdoors (8-14, more inside the houses)`); ok(vil('t6').length >= 8 && vil('t6').length <= 14, `${vil('t6').length} Spindlewood villagers outdoors (8-14, more inside the houses)`); ok(vil('g8').length >= 8 && vil('g8').length <= 14, `${vil('g8').length} Sporehaven villagers outdoors (8-14, more inside the houses)`); ok(vil('t8').length >= 8 && vil('t8').length <= 14, `${vil('t8').length} Duskmoss villagers outdoors (8-14, more inside the houses)`); ok(villagers.every(d => /^(g7|s5|t7|t4|g6|t6|g8|t8|l4|r1|r6|r9|r10|r21|r22|t2|g5|g4|g2|t1|g1)-/.test(d.id)) && trainers.every(d => /^(r1|r2|r3|r5|r6|r7|r8|r9|r10|r21|r101|r103|r111)-/.test(d.id)), 'every NPC id names its place');
  for (const r of ['r1', 'r2', 'r3', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r101', 'r103', 'r111']) ok(trainers.filter(d => d.id.startsWith(r + '-')).length >= 3 && trainers.filter(d => d.id.startsWith(r + '-')).length <= 5, `${r}: 3-5 route trainers`);
  const enc = z => new Set([...ADV_ENC[z].day, ...ADV_ENC[z].night, ...(ADV_ENC[z].fish || [])].map(e => e[0]));
  const kin = (id, s = new Set()) => { s.add(id); for (const e of ADV_DEX[id]?.evos || []) kin(e.to, s); return s; };
  for (const n of ADVN.list) {
    const d = n.def; ok(ADVN.place(n), d.id + ': its chunk is loaded'); const e = n.e;
    ok(!ADV.blocked(e.x, e.y, e.z, 9) && e.lv >= 0, d.id + ': stands on free flat ground'); eq(ADVW.zone(e.x, e.y), where(d.id), d.id + ': in the right zone');
    ok(d.sprite === null || ((O8[d.sprite]?.rows.length === 8 || !!(window.TRAINER_OW_RANGER || {})[d.sprite]) && fs.existsSync(new URL('../' + (O8[d.sprite] || window.TRAINER_OW_RANGER[d.sprite]).file, import.meta.url))), d.id + ': has an 8-direction sprite (' + d.sprite + ') or is an unseen sign');
    ok(Array.isArray(d.lines) && d.lines.length >= 1 && d.lines.length <= 2 && [...d.lines, ...(d.known || []), d.trainer?.say, d.trainer?.lose].filter(Boolean).every(s => s.length <= 100 && !/[\u2014\u2013]/.test(s) && !/\s{2}/.test(s)), d.id + ': 1-2 short lines, no dashes');
    ok(d.face % 2 === 0 || !d.trainer, d.id + ': trainers face a cardinal direction');
    if (!d.trainer) continue;
    const t = d.trainer, z = where(d.id), allowed = new Set([...enc(z)].flatMap(s => [...kin(s)]));
    ok(t.team.length === 6 && t.team.every(([s, rel]) => DEX.species[s] && enc(z).has(s) && rel >= 0 && rel <= 3), d.id + ': six species from the ' + z + ' tables');
    ok(t.team.every(([, rel], i) => !i || rel >= t.team[i - 1][1]), d.id + ': team ordered weakest first'); ok(t.sight >= 3 && t.sight <= 6 && t.money > 0 && t.cls && t.name && t.say && t.lose, d.id + ': sight, money, class and lines');
    ADVN.team(t, d.id, 4).forEach(m => ok(allowed.has(m.species) && m.level >= 29 && m.level <= 32, d.id + ': badge 4 team member ' + m.species + ' ' + m.level));
    const v = DIR_VEC[n.face], T0 = (d.x + 0.5) * T, T1 = (d.y + 0.5) * T; let road = -1;
    for (let k = 1; k <= t.sight; k++) { const pn = ADV.palette[ADV.mat(Math.floor((T0 + v[0] * k * T) / T), Math.floor((T1 + v[1] * k * T) / T))]; if (pn === 'path' || pn === 'rgPath' || pn === 'pavingStone') { road = k; break; } }   // rgPath: the map-lab road (tools/adv-region-export.py)
    ok(road >= 1 && ADVN.sees(n, T0 + v[0] * road * T, T1 + v[1] * road * T, 0), d.id + ': sees the road ' + road + ' tiles ahead'); ok(!ADVN.sees(n, T0 - v[0] * 2 * T, T1 - v[1] * 2 * T, 0), d.id + ': not behind it');
  }
  // saves: defeated trainers persist by NPC id; a save from before S1 (no beat) still loads
  const st1 = ADVP.mon('bulbasaur', 5), sv1 = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: st1 }); assert.deepEqual(sv1.beat, {}); n++;
  const old = JSON.parse(JSON.stringify(sv1)); delete old.beat; eq(JSON.stringify(ADVS.check(old).beat), '{}', 'an old save without beat loads with an empty list');
  const bad2 = JSON.parse(JSON.stringify(sv1)); bad2.beat = [1]; eq(JSON.stringify(ADVS.check(bad2).beat), '{}', 'a malformed beat list is reset');
  sv1.beat['r5-cal'] = 1; const back1 = await ADVS.open(await ADVS.seal(sv1)); eq(back1.beat['r5-cal'], 1, 'a defeated trainer survives the .sav round trip');
  ADVW.has = hasOrig; delete ADV.player; ADVN.reset(); ADV.reset(); ADV.setWorld(null);
}


// ---------- S1b: rooms and door warps, the Mart, Whitney by band, the badge ----------
{
  load('data/adv/tileset.js'); load('data/adv/tileset-derived.js'); load('data/adv/tileset-int.js'); for (const f of fs.readdirSync(new URL('../data/adv/rooms/', import.meta.url))) load('data/adv/rooms/' + f);
  load('data/trainer-ow8.js'); const W = window.ADV_WORLD, ex = window.ADV_TILESET.props, O8 = window.TRAINER_OW8;
  ADV.reset(); ADV.setWorld(W); ADV.fallback = false;
  const live = Object.entries(ADV.rooms).filter(([, d]) => d.live).map(([id]) => id), lab = Object.keys(ADV.rooms).filter(id => !live.includes(id));
  eq(live.length, 1, 'one live room map: the Route 4 cave; every town is buildings (S2 below)'); eq(W.doors.filter(d => d.room === live[0]).length, 2, 'it has two door warps, one at each mouth');
  for (const id of lab) ok((ADV.rooms[id].bake || ADV.rooms[id].bakes) && W.doors.some(d => d.room === id), id + ': a map-lab cave (baked, not live) with a mouth in the world');   // tools/adv-region-export.py ROOMS
  eq(W.doors.filter(d => !ADV.rooms[d.room]).length, 0, 'every door leads to a room that exists');
  eq(W.buildings.filter(b => b.town === 'T5').length, 8, 'Salt Bay has 8 buildings: a Center, the family store and 6 houses'); ok(W.buildings.some(b => b.id === 't5-center') && W.buildings.some(b => b.id === 't5-mart'), 'Salt Bay has its Center and its general store');
  for (const b of W.buildings) {   // every person and every piece of furniture inside a building (the cave is checked in the T4 block below)
    for (const [pn] of b.interior.props) ok(ADV.propDef(pn), b.id + ': prop ' + pn + ' exists in a sheet');
    for (const m of b.interior.npcs) {
      ok(m.id.startsWith(b.id.split('-')[0] + '-') && (m.script === 'pc' || (O8[m.sprite]?.rows.length === 8 || !!(window.TRAINER_OW_RANGER || {})[m.sprite])), m.id + ': in its town with an 8 direction sprite'); const t = m.trainer || {};
      ok([...(m.lines || []), ...[].concat(t.say || [], t.lose || [], t.say2 || [], t.wait || [], t.sorry || [])].every(s => s.length <= 100 && !/[—–]/.test(s) && !/\s{2}/.test(s)), m.id + ': lines short, no dashes');
      if (t.team) ok(t.team.length === 6 && t.team.every(([s]) => DEX.species[s]), m.id + ': six valid species');
    }
  }
  const bl = W.buildings.filter(b => b.town === 'G7'), gb = bl.find(b => b.id === 'g7-gym'); eq(bl.length, 11, 'Goldacre has 11 buildings you can walk into'); ok(!W.doors.some(d => d.town === 'G7'), 'and no door warp'); const sz = b => b.w * b.d;
  const big = Math.max(...bl.filter(b => b !== gb).map(sz)); ok(sz(gb) > big * 1.3, 'the gym is clearly the biggest building in town (' + sz(gb) + ' vs ' + big + ')');
  const gym = gb.interior.npcs; eq(gym.filter(m => m.trainer && !m.trainer.leader).length, 2, 'two gym trainers'); eq(gym.find(m => m.trainer?.leader).trainer.after.length, 2, 'Whitney waits on both');

  // the Mart: stock grows with badges, buying and selling move money and bag exactly
  eq(ADVP.stock(0).includes('greatball'), false, 'no Great Balls at 0 badges'); ok(ADVP.stock(1).includes('greatball') && ADVP.stock(7).includes('fullrestore') && ADVP.stock(8).length === ADVP.stock(7).length, 'stock grows with badges up to 7 tiers');
  ok(ADVP.stock(3).length > ADVP.stock(2).length && ADVP.stock(2).length > ADVP.stock(1).length, 'every badge adds stock'); ok(ADVP.stock(7).every(i => ADVP.PRICE[i] > 0), 'everything in stock has a price');
  const sv = { money: 1500, badges: 0, bag: { pokeball: 20 } }; let r1 = ADVP.buy(sv, 'pokeball', 5);
  ok(r1.ok && sv.money === 500 && sv.bag.pokeball === 25, 'buying 5 Poke Balls costs 1000 and adds 5'); ok(!ADVP.buy(sv, 'pokeball', 3).ok && sv.money === 500 && sv.bag.pokeball === 25, 'too poor: refused, nothing changes');
  ok(!ADVP.buy(sv, 'greatball', 1).ok && !sv.bag.greatball, 'locked stock is refused'); ok(!ADVP.buy(sv, 'pokeball', 0).ok && !ADVP.buy(sv, 'nope', 1).ok, 'zero and unknown items refused');
  r1 = ADVP.sell(sv, 'pokeball', 25); ok(r1.ok && sv.money === 500 + 25 * 100 && !('pokeball' in sv.bag), 'selling pays half, and an empty slot is removed'); ok(!ADVP.sell(sv, 'pokeball', 1).ok && sv.money === 3000, 'selling what you lack is refused');
  eq(ADVP.sellPrice('pokeball') * 2, ADVP.PRICE.pokeball, 'sell price is half of buy');

  // Whitney by band: the Appendix A roster for the challenger's badge count, the ace last
  const ro = window.ADV_ROSTERS.whitney; ADV.player = { badges: 0, beat: {} };
  for (let b = 0; b <= 8; b++) {
    const k = ADVN.bandKey(b), t = ADVN.leaderTeam('whitney', b), src = ro[k];
    ok(src && t.length === src.length, 'band ' + k + ': ' + t.length + ' mons for ' + b + ' badges'); ok(t[t.length - 1].species === src.find(m => m.ace).species && t.filter(m => m.ace).length === 1, 'band ' + k + ': the ace goes out last'); ok(t.every(m => m.level >= 1 && m.level <= 100 && DEX.species[m.species]), 'band ' + k + ': valid levels and species');
  }
  eq(ADVN.bandKey(0), 'b1', '0 badges is band b1'); eq(ADVN.bandKey(7), 'b8', '7 badges is band b8'); eq(ADVN.bandKey(8), 'true', '8 badges is the true team'); eq(ADVN.leaderTeam('whitney', 0)[2].species, 'miltank', 'at 0 badges Miltank closes the team');
  ok(ADVN.leaderTeam('whitney', 5).length > ADVN.leaderTeam('whitney', 0).length, 'later bands are bigger'); eq(ADVN.team({ leader: 'whitney' }, 'g7-whitney', 3).length, ADVN.leaderTeam('whitney', 3).length, 'ADVN.team on a leader uses the roster');

  // the badge is awarded once
  const s2 = { money: 0, badges: 0, medals: [], beat: {}, bag: {} }, wh = { id: 'g7-whitney', def: gym.find(m => m.trainer?.leader) }, tm = ADVN.leaderTeam('whitney', 0);
  const a1 = ADVN.win(s2, wh, tm), a2 = ADVN.win(s2, wh, tm);
  ok(a1.badge === 'Goldacre Badge' && a1.tm === 'tm_attract' && s2.badges === 1 && s2.medals.length === 1 && s2.bag.tm_attract === 1, 'first win: one badge, one medal, one TM'); ok(!a2.badge && !a2.tm && s2.badges === 1 && s2.medals.length === 1 && s2.bag.tm_attract === 1, 'a rematch gives neither again');
  eq(s2.money, a1.pay * 2, 'but a rematch still pays'); eq(a1.pay, 80 * Math.max(...tm.map(m => m.level)), 'Whitney pays 80 x her top level');
  ADV.player = null; ADVN.reset(); ADV.reset(); ADV.setWorld(null);
}

// ---------- T5 Salt Bay: Skills (surf, fishing), the piers and docks, the working shore ----------
{
  // save: skills default to none, old saves load, teaching is once, the rod comes with fishing
  const s0 = ADVS.fresh({ name: 'Kai', avatar: 'red', home: 'G7', starter: ADVP.mon('bulbasaur', 5) });
  assert.deepEqual(s0.skills, {}); n++;
  const old0 = JSON.parse(JSON.stringify(s0)); delete old0.skills; eq(JSON.stringify(ADVS.check(old0).skills), '{}', 'an old save without skills loads with none');
  const bad0 = JSON.parse(JSON.stringify(s0)); bad0.skills = [1]; eq(JSON.stringify(ADVS.check(bad0).skills), '{}', 'a malformed skills list is reset');
  eq(ADVP.teach(s0, 'surf').length, 1, 'learning Surf is one page'); ok(s0.skills.surf === 1 && !s0.bag.fishingrod, 'Surf is saved and brings no rod');
  const fp = ADVP.teach(s0, 'fishing'); eq(fp.length, 2, 'learning Fishing is two pages (the skill, the rod)'); ok(s0.skills.fishing === 1 && s0.bag.fishingrod === 1, 'Fishing is saved and the rod is in the bag');
  eq(ADVP.teach(s0, 'fishing').length, 0, 'a known skill teaches nothing'); eq(s0.bag.fishingrod, 1, 'and never hands out a second rod'); eq(ADVP.teach(s0, 'nope').length, 0, 'an unknown skill is refused');
  eq(ADVP.item('fishingrod').cat, 'key', 'the rod is a key item'); eq((await ADVS.open(await ADVS.seal(s0))).skills.fishing, 1, 'skills survive the .sav round trip');
  ok(ADVP.rides({ species: 'lapras' }) && !ADVP.rides({ species: 'wooloo' }) && !ADVP.rides(undefined), 'a lead that can learn Surf is the ride (Lapras); others use the raft');

  // surfing: water at ground level is open only to an entity with e.surf; the fight box follows ADV.swim
  ADV.reset(); ADV.setWorld({ palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'], chunksW: 2, chunksH: 1 });
  chunk(0, 0, (x, y) => (x >= 10 && x <= 14 ? { m: WATER } : {})); chunk(1, 0, () => ({}));
  let sw0 = ent(8, 5); walk(sw0, 1, 0, 4);
  ok(sw0.x < 10 * T, 'without Surf the shore stops you'); let sw1 = ent(8, 5); sw1.surf = true; walk(sw1, 1, 0, 4);
  ok(sw1.x > 15 * T && !ADV.isWater(Math.floor(sw1.x / T), 5), 'with Surf you cross the water and step out on the far bank'); walk(sw1, -1, 0, 4); ok(sw1.x < 10 * T, 'and back again');
  let sw2 = ent(12, 5); sw2.surf = true; walk(sw2, 0, 1, 6); ok(ADV.isWater(12, Math.floor(sw2.y / T)) && sw2.y < 32 * T - 5, 'a surfer stays on the water, bounded by the world edge');
  ok(ADV.blocked(12 * T + T / 2, 5 * T + T / 2, 0, 6), 'the static query still calls water blocked (only the entity decides)');
  eq(ADV.swim, false, 'swim is off by default'); let bx = ADVB.box({ x: 8 * T, y: 5 * T }, { x: 9 * T, y: 5 * T }, 0); eq(bx.mask[(5 - bx.row) * bx.cols + (12 - bx.col)], 1, 'on land the water is a wall of the fight box');
  ADV.swim = true; bx = ADVB.box({ x: 12 * T, y: 5 * T }, { x: 13 * T, y: 5 * T }, 0); eq(bx.mask[(5 - bx.row) * bx.cols + (12 - bx.col)], 0, 'while surfing the water is open floor'); ADV.swim = false; ADV.reset(); eq(ADV.swim, false, 'reset clears it');

  // fishing tables: the bible's, per zone; only zones with a table can be fished
  const hasOrig = ADVW.has; ADVW.has = () => true; const E = window.ADV_ENC, tabOf = z => E[z].fish.map(([s, b]) => s + ':' + b).join();
  eq(tabOf('route9'), 'magikarp:common,chinchou:uncommon,krabby:rare,mudkip:nat20', 'Route 9 fishing: Magikarp, Chinchou, Krabby, Mudkip (bible)'); eq(tabOf('route10'), 'magikarp:common,lotad:uncommon,marill:rare,piplup:nat20', 'Route 10 fishing: Magikarp, Lotad, Marill, Piplup (bible)');
  eq(tabOf('saltbay'), 'magikarp:common,arrokuda:common,barboach:uncommon,skrelp:uncommon,remoraid:rare', 'Salt Bay fishing: Magikarp, Arrokuda, Barboach, Skrelp, Remoraid (bible)');
  ok(!E.route9.fish.some(e => e[0] === 'feebas') && !E.route10.fish.some(e => e[0] === 'feebas') && !E.saltbay.fish.some(e => e[0] === 'feebas'), 'Feebas is in no fishing table'); eq(ADVW.fishRoll('route5'), null, 'a zone without a fishing table gives nothing'); eq(ADVW.fishRoll('goldacre'), null, 'Goldacre has none either');
  const kin2 = (id, s = new Set()) => { s.add(id); for (const e of ADV_DEX[id]?.evos || []) kin2(e.to, s); return s; };
  for (const z of ['route9', 'route10', 'saltbay']) {
    const allow = new Set(E[z].fish.flatMap(e => [...kin2(e[0])])), seen = new Set(); let lvOk = true;
    for (let i = 0; i < 300; i++) { const r = ADVW.fishRoll(z, 0); seen.add(r.id); if (!allow.has(r.id) || r.lv < 7 || r.lv > 13 || r.lv > r.top) lvOk = false; }
    ok(lvOk && seen.size >= 2, z + ': 300 casts only bring the fishing table (evolved to the level), levels 7-13 at 0 badges, ' + seen.size + ' species seen');
    ok(ADVW.fishRoll(z, 4).lv >= 21 && ADVW.fishRoll(z, 8).lv >= 44, z + ': levels follow the badge band');
  }
  ADVW.has = hasOrig;

  // the real world: piers and the dock are walkable, the sea is Surf's, a cast finds dry ground, the shore is dressed
  const W5 = window.ADV_WORLD, tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T]; ADV.reset(); ADV.setWorld(W5); ADV.fallback = false;
  const loadAround = (c0, c1, r0, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const f = new URL(`../data/adv/chunks/${c}_${r}.js`, import.meta.url); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8')); else ADV.fillChunk(c, r); } };
  const T5c = W5.towns.T5, cx5 = Math.floor(T5c.x / T), cy5 = Math.floor(T5c.y / T);
  loadAround(Math.floor((cx5 - 60) / 32), Math.floor((cx5 + 30) / 32), Math.floor((cy5 - 20) / 32), Math.floor((cy5 + 30) / 32));
  ok(W5.palette.includes('boardwalk') && !W5.water.includes('boardwalk'), 'the boardwalk mat is walkable ground');
  let pe = ADV.entity(...tile(cx5 - 13, cy5 + 2), 0); walk(pe, -1, 0, 7);
  ok(pe.x < (cx5 - 28) * T && pe.x > (cx5 - 35) * T, 'on foot, Lane A runs out along the pier to its head (' + Math.floor(pe.x / T - cx5) + ' tiles west of the centre)'); const pcell = [Math.floor(pe.x / T), Math.floor(pe.y / T)];
  ok(ADV.isWater(pcell[0] - 3, pcell[1]) && !ADV.isWater(...pcell), 'and open water starts just past the head');
  const P5 = Object.assign(pe, { lv: 0, face: 6 }); eq(ADVW.zone(P5.x, P5.y), 'saltbay', 'the pier head is in the Salt Bay zone');
  const sp = ADVW.fishSpot(P5, P5.x - 40, P5.y); ok(sp && Math.hypot(sp.x - P5.x, sp.y - P5.y) >= 2 * T - 1 && !ADV.isWater(Math.floor(sp.x / T), Math.floor(sp.y / T)) && !ADV.blocked(sp.x, sp.y, 0, 9), 'a hooked fish stands on dry ground 2-4 tiles from the pier head');
  const fw = ADVW.fishMake(P5, { id: 'magikarp', lv: 8, top: 11 }, P5.x - 40, P5.y); ok(fw && fw.g.local && fw.st === 'pop' && ADVW.groups.includes(fw.g), 'the bite is a lone local wild mon'); ADVW.kill(fw); ok(!ADVW.groups.includes(fw.g), 'and it is gone once the fight ends');
  let se = ADV.entity(...tile(cx5 - 13, cy5 + 2), 0); se.surf = true; walk(se, -1, 0, 8); ok(se.x < (cx5 - 36) * T, 'with Surf you pass the pier head into the bay (' + Math.floor(se.x / T - cx5) + ' tiles west)');
  walk(se, 1, 0, 8); ok(se.x > (cx5 - 28) * T, 'and come back to the boards');
  loadAround(4, 7, 17, 20); const cnt = (c0, c1, r0, r1, names, x0, x1, y0, y1) => { let k = 0; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) for (const p of ADV.chunks.get(ADV.key(c, r))?.props || []) if (names.includes(p.n) && p.x >= x0 * T && p.x <= x1 * T && p.y >= y0 * T && p.y <= y1 * T) k++; return k; };
  ok(cnt(4, 6, 19, 20, ['maRowboat'], 138, 192, 636, 648) >= 1, 'Route 9 bank: a rowboat on the inlet (drying racks, nets and crab pots are missing art)');
  const camp = ADV.chunks.get(ADV.key(6, 17)); ok(camp && camp.props.filter(p => p.n === 'tentPair').length === 3 && camp.props.some(p => p.n === 'noticeBoard' && Math.abs(p.x - 210.5 * T) < 40 * S), 'Route 10 campsite: three tents and the register board');
  let de = ADV.entity(...tile(213, 568), 0); walk(de, 1, 0, 5); ok(de.x > 223 * T && ADV.isWater(Math.floor(de.x / T) + 3, 568), 'the campsite dock runs out into the lake on foot');
  // teachers, music and the people
  const ND = window.ADV_NPCS, tch = ND.filter(d => d.script === 'teach');
  eq(tch.map(d => d.id + ':' + d.skill).sort().join(), 'l4-speaker:sense,r9-teacher:fishing,s5-fish:fishing,s5-surf:surf', 'four teachers: fishing on Route 9 (before the town) and in Salt Bay, surfing in Salt Bay, Sensing Shadow Pokemon at Quiet Plain');
  ok(tch.every(d => ADVP.SKILLS[d.skill] && d.lines.length >= 1 && d.known.length >= 1), 'every teacher has an offer and a known line');
  ok(ND.some(d => d.id === 'r10-register' && d.sprite === null) && ND.filter(d => d.id.startsWith('s5-')).length === 8, 'the register and 8 Salt Bay villagers'); load('data/adv/music.js'); const MZ = window.ADV_MUSIC;
  ok(['T5', 'saltbay', 'route9', 'route10'].every(k => MZ.tracks[MZ.zones[k]]), 'Salt Bay and its routes have music that exists'); ok(['t5-center', 't5-mart'].every(r => window.ADV_WORLD.buildings.some(b => b.id === r)) && MZ.rooms.center && MZ.rooms.mart, 'its Center and store use the room tracks');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- T7 Longshore: the beach resort, its shallow bay, and Route 6's seafront strip (dock, castles, the resort spilling up the road) ----------
{
  const W7 = window.ADV_WORLD, tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T]; ADV.reset(); ADV.setWorld(W7); ADV.fallback = false;
  const T7c = W7.towns.T7, cx7 = Math.floor(T7c.x / T), cy7 = Math.floor(T7c.y / T), pal = (c, r) => ADV.palette[ADV.mat(c, r)], zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T);
  for (let r = Math.max(0, (cy7 - 100) >> 5); r <= (cy7 + 60) >> 5; r++) for (let c = 0; c <= (cx7 + 180) >> 5; c++) { const f = new URL(`../data/adv/chunks/${c}_${r}.js`, import.meta.url); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8')); else ADV.fillChunk(c, r); }
  eq(W7.buildings.filter(b => b.town === 'T7').length, 7, 'Longshore has 7 buildings: a Center, the beach store and 5 houses'); ok(['t7-center', 't7-mart'].every(r => W7.buildings.some(b => b.id === r)), 'Longshore has its Center and its beach store');
  ok(!window.ADV_NPCS.some(d => d.script === 'teach' && /^(t7|r6)-/.test(d.id)), 'no Skill is taught in Longshore or on Route 6 (rented surf gear is only flavour; Salt Bay teaches)');
  // the sea never gets deep: the whole bay stays shallow out to 50 tiles, a sand beach runs along it
  for (const k of [4, 15, 30, 50, 70]) ok(['sandWater', 'water'].includes(pal(cx7 - 7 - k, cy7 - 8)), 'the bay is still shallow ' + (7 + k) + ' tiles out (' + pal(cx7 - 7 - k, cy7 - 8) + ')');
  ok(pal(cx7 - 3, cy7 - 15) === 'sand' && pal(cx7 - 4, cy7 - 52) === 'sand' && ADV.isWater(cx7 - 12, cy7 - 15), 'a sand beach, the water beyond it');
  // props over every loaded chunk
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) all.push(p);
  const of = (...n) => all.filter(p => n.includes(p.n)), tl = p => [p.x / T, p.y / T];
  const chairs = of('maLounger'), umbr = of('maUmbrellaPink', 'maUmbrellaBlue'), stalls7 = of('pxStallBlue');
  ok(chairs.length >= 15 && umbr.length >= 6 && stalls7.length >= 1, `${chairs.length} loungers, ${umbr.length} umbrellas, ${stalls7.length} beach stalls`);
  ok(chairs.every(p => !ADV.isWater(Math.floor(p.x / T), Math.floor(p.y / T))), 'every lounger stands on dry ground');




  // Route 6 spill: stalls, kiosks, umbrellas and chairs along the road, thinning out with distance from the town
  const spill = of('marketAwning', 'pxStallBlue', 'maUmbrellaPink', 'maUmbrellaBlue', 'maLounger').filter(p => p.x / T > cx7 + 28 && p.x / T < cx7 + 112 && Math.abs(p.y / T - cy7) < 20);
  ok(spill.length >= 8 && spill.filter(p => p.x / T < cx7 + 70).length > spill.filter(p => p.x / T >= cx7 + 70).length, `${spill.length} resort props along Route 6, denser near the town`);
  // fishing: the dock is Route 6 (shore and dock only): walk out the boardwalk and the pier, find the water, the Route 6 table, a dry spot for the hooked mon
  const E7 = window.ADV_ENC, tab7 = E7.route6.fish.map(([sp, b]) => sp + ':' + b).join(); eq(tab7, 'magikarp:common,chinchou:uncommon,krabby:rare,squirtle:nat20', 'Route 6 fishing: Magikarp, Chinchou, Krabby, Squirtle (bible)');
  let de7 = ADV.entity(...tile(cx7 + 8, cy7 - 37), 0); walk(de7, -1, 0, 12);
  const pc7 = [Math.floor(de7.x / T), Math.floor(de7.y / T)]; ok(de7.x < (cx7 - 15) * T && ADV.isWater(pc7[0] - 3, pc7[1]) && !ADV.isWater(...pc7), 'the dock runs out into the bay on foot (head ' + (pc7[0] - cx7) + ' tiles west, water beyond)');
  const P7 = Object.assign(de7, { lv: 0, face: 6 }); eq(ADVW.zone(P7.x, P7.y), 'route6', 'the dock head is in the Route 6 zone'); eq(zoneAt(cx7, cy7), 'longshore', 'the town centre is Longshore');
  const sp7 = ADVW.fishSpot(P7, P7.x - 40, P7.y); ok(sp7 && !ADV.isWater(Math.floor(sp7.x / T), Math.floor(sp7.y / T)) && !ADV.blocked(sp7.x, sp7.y, 0, 9), 'a hooked mon finds dry ground by the dock');
  const hasO7 = ADVW.has; ADVW.has = () => true; const r7 = ADVW.fishRoll('route6', 0); ADVW.has = hasO7; ok(r7 && r7.lv >= 7 && r7.lv <= 13, 'a cast at the dock brings a Route 6 fish at the 0 badge level');
  // the boardwalk spine links the town to the dock; the two piers reach the shallows
  let sw7 = ADV.entity(...tile(cx7 + 8, cy7 + 15), 0); walk(sw7, 0, -1, 22); ok(sw7.y < (cy7 - 36) * T, 'the boardwalk runs the whole length of the seafront on foot (reached ' + Math.floor(sw7.y / T - cy7) + ')');
  let pa = ADV.entity(...tile(cx7 + 6, cy7 - 6), 0); walk(pa, -1, 0, 8); ok(pa.x < (cx7 - 10) * T, 'the swim pier runs out over the beach and into the shallows');
  const idx = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'); ok(fs.readdirSync(new URL('../data/adv/rooms/', import.meta.url)).every(f => idx.includes(`data/adv/rooms/${f}`)), 'index.html loads every room file (a missing one only fails in the browser)');
  load('data/adv/music.js'); const MZ7 = window.ADV_MUSIC; ok(['T7', 'longshore', 'route6'].every(k => MZ7.tracks[MZ7.zones[k]]), 'Longshore and Route 6 have music that exists'); ok(['t7-center', 't7-mart'].every(r => !!bld(r)), 'its Center and beach store use the room tracks');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- T4 Tradeway: the crossroads market, its Market Hall, and Route 4, the cave under the basin (one live room, a mouth at each end) ----------
{
  const W4 = window.ADV_WORLD, O8 = window.TRAINER_OW8, cave = ADV.rooms['t4-cave'], E4 = window.ADV_ENC.route4, t4 = new Set([...E4.day, ...E4.night].map(e => e[0]));
  const kin = (id, s = new Set()) => { s.add(id); for (const e of ADV_DEX[id]?.evos || []) kin(e.to, s); return s; }, allowed = new Set([...t4].flatMap(s => [...kin(s)]));
  ADV.reset(); ADV.setWorld(W4); ADV.fallback = false; const OX = cave.cx * 32, wall = nm => /_(dark|wallT|wallB)$/.test(nm), pal = (c, r) => ADV.palette[ADV.mat(c, r)];
  eq(W4.doors.filter(d => d.town === 'T4').length, 2, 'Tradeway has the two cave mouths as door warps'); eq(W4.buildings.filter(b => b.town === 'T4').length, 7, 'and 7 buildings: a Center, the Market Hall and 5 houses'); ok(['t4-center', 't4-market'].every(r => W4.buildings.some(b => b.id === r)), 'Tradeway has its Center and its Market Hall');
  ok(!window.ADV_NPCS.some(d => d.script === 'teach' && /^(t4|r4)-/.test(d.id)), 'no Skill is taught in Tradeway or on Route 4');
  const mk = bnpcs('t4-market'); ok(mk.some(m => m.script === 'clerk' && m.market) && mk.some(m => m.script === 'barter'), 'the Market Hall has the day-stock trader and the barterer'); ok(cave.npcs.some(m => m.script === 'clerk' && m.market) && cave.npcs.some(m => m.script === 'barter'), 'the cave stalls have a trader and a barterer too');
  // the market: six of twelve rare items a day, another six on other days, never a Mart's stock, prices 45 to 85 percent of the usual, barter swaps move the bag exactly
  const D0 = 20000, L0 = ADVP.marketList(D0), msv = { money: 100000, badges: 0, bag: {} };
  eq(L0.length, 6, 'six items on the market today'); eq(L0.join(), ADVP.marketList(D0).join(), 'the same six all day'); ok(new Set(Array.from({ length: 30 }, (_, i) => ADVP.marketList(D0 + i).join())).size > 10, 'the stock changes by the day');
  ok(L0.every(id => ADVP.item(id) && !ADVP.stock(8).includes(id) && ADVP.marketPrice(id, D0) >= ADVP.MARKET[id] * 0.44 && ADVP.marketPrice(id, D0) <= ADVP.MARKET[id] * 0.86), 'market items exist, no Mart sells them, prices 45 to 85 percent of the usual');
  const mp = ADVP.marketPrice(L0[0], D0), mb = ADVP.buy(msv, L0[0], 2, D0); ok(mb.ok && msv.money === 100000 - 2 * mp && msv.bag[L0[0]] === 2, 'buying from the market charges the market price'); ok(!ADVP.buy(msv, Object.keys(ADVP.MARKET).find(id => !L0.includes(id)), 1, D0).ok && msv.money === 100000 - 2 * mp, 'an item not in today\'s stock cannot be bought');
  const of3 = ADVP.barterOffers(D0); eq(of3.length, 3, 'three barter offers today'); msv.bag = {}; ok(!ADVP.swap(msv, 0, D0).ok && Object.keys(msv.bag).length === 0, 'a swap without the goods changes nothing');
  msv.bag = { [of3[0].give[0]]: of3[0].give[1] + 1 }; ok(ADVP.swap(msv, 0, D0).ok && msv.bag[of3[0].give[0]] === 1 && msv.bag[of3[0].get[0]] === of3[0].get[1], 'a swap trades goods for goods exactly');
  // one live room: five chunks across, two down, its own zone, dim, loaded with the world and kept when you leave
  ok(cave.live && cave.cw === 5 && cave.ch === 2 && cave.zone === 'route4' && cave.dark > 0 && cave.dark < 1 && cave.lamps.length >= 10, 'the cave is one live 5 x 2 chunk room in the Route 4 zone, dim, with its torches and crystals');
  eq(ADV.live.length, 1, 'the world has one live room'); eq(ADV.live[0].id, 't4-cave', 'and it is the cave'); eq(ADVW.zone(OX * TR + 200, 32 * TR), 'route4', 'standing in the cave is the Route 4 zone (wild mons use its table)'); ok(ADVW.zone(OX * TR + 200, 32 * TR) !== ADVW.zone(W4.towns.T4.x, W4.towns.T4.y), 'not the town zone around the mouth');
  const floorAt = (x, y) => !wall(pal(x >> 5, y >> 5)) && !ADV.blocked(x, y, 0, 9);
  for (const end of ['w', 'e']) {
    const d = ADV.doorFor('t4-cave', end), ex = cave.exits.find(e => e.end === end), sp = cave.spawns[end], cxd = Math.floor(d.x / (T * 32)), cyd = Math.floor(d.y / (T * 32));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const f = new URL(`../data/adv/chunks/${cxd + dx}_${cyd + dy}.js`, import.meta.url); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8')); }
    ok(d.town === 'T4' && ex, end + ': the mouth has a world door and a cave exit'); eq(ADV.doorAt(d.x, d.y + 10), d, end + ': pushing up at the cave mouth finds its door'); ok(!ADV.doorAt(d.x, d.y + 30), end + ': the exit spot is not a door');
    const back = { x: d.x, y: d.y + 30 }; ok(ADV.h(Math.floor(back.x / T), Math.floor(back.y / T)) >= 0 && !ADV.blocked(back.x, back.y, 0, 9), end + ': leaving lands on free ground below the same mouth');
    ADV.openRoom('t4-cave'); eq(ADV.roomAt, 't4-cave', end + ': the cave opens'); ok(floorAt(sp.x, sp.y), end + ': you arrive on free floor');
    ok((sp.x >> 5) < ex.c0 - 2 || (sp.x >> 5) > ex.c1 + 2, end + ': the arrival spot is clear of the exit it came in by');
    for (let c = ex.c0; c <= ex.c1; c++) for (let r = ex.r0; r <= ex.r1; r++) ok(!wall(pal(c, r)) && !ADV.blocked((c + 0.5) * TR, (r + 0.5) * TR, 0, 9), end + ': exit tile ' + c + ',' + r + ' is walkable floor');
    ADV.closeRoom(); eq(ADV.roomAt, null, end + ': leaving the cave closes it'); ok(!wall(pal(sp.x >> 5, sp.y >> 5)), end + ': a live room stays loaded when you leave');
  }
  ok(cave.exits[0].c0 < cave.exits[1].c0 && cave.spawns.w.x < cave.spawns.e.x, 'west exit and spawn lie west of the east ones (a round trip from either mouth puts you back at that mouth)');
  // the whole passage walks from mouth to mouth, every person is reachable, the shut side passage is not
  const R = 8, X0 = OX * TR, seen = new Set(), key = (x, y) => x + ',' + y, q = [[Math.floor((cave.spawns.w.x - X0) / R), Math.floor(cave.spawns.w.y / R)]]; seen.add(key(...q[0]));
  for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = q[i][0] + dx, y = q[i][1] + dy, k = key(x, y); if (!seen.has(k) && x >= 0 && y >= 0 && x < 640 && y < 256 && !ADV.blocked(X0 + x * R + R / 2, y * R + R / 2, 0, 9)) { seen.add(k); q.push([x, y]); } }
  const reach = (x, y) => seen.has(key(Math.floor((x - X0) / R), Math.floor(y / R)));
  ok(reach(cave.spawns.e.x, cave.spawns.e.y), 'you can walk from the west mouth to the east mouth'); for (const e of cave.exits) ok(reach((e.c0 + 0.5) * TR, (e.r0 + 2.5) * TR), 'the ' + e.end + ' exit is reachable');
  for (const m of cave.npcs) ok(reach((m.x + 0.5) * TR, (m.y + 0.5) * TR), m.id + ': can be reached');
  const rocks = cave.props.filter(p => p[0] === 'caveRock2x'); eq(rocks.length, 3, 'three boulders shut the side passage'); ok(reach(rocks[1][1], rocks[1][2] - 40) && !reach(rocks[1][1], rocks[1][2] + 3 * TR), 'the passage is open up to the boulders and nothing behind them can be reached');
  eq(cave.props.filter(p => ['pxStallPink2x', 'pxStallBlue2x'].includes(p[0])).length, 7, 'seven stalls in the cave');
  // stalls crept in from the Tradeway end and thin out: gaps grow, none past the first third
  const sx = cave.props.filter(p => /^(pxStall|maStall)/.test(p[0])).map(p => Math.floor(p[1] / TR) - OX).sort((a, b) => a - b); ok(sx[0] <= 15 && sx[sx.length - 1] <= 55, 'the stalls stand in the first third of the cave (' + sx.join(',') + ')');
  const gaps = sx.slice(1).map((x, i) => x - sx[i]); ok(gaps.slice(-2).reduce((a, b) => a + b) > gaps.slice(0, 2).reduce((a, b) => a + b), 'the gaps between the stalls grow (' + gaps.join(',') + ')');
  ok(cave.props.every(p => ADV.propDef(p[0])), 'every cave prop exists in a sheet'); ok(cave.props.filter(p => (Math.floor(p[1] / TR) - OX) > 60 && /^(pxStall|maStall)/.test(p[0])).length === 0 && cave.props.filter(p => /^(pxStall|maStall)/.test(p[0])).length === 7, 'past the last stall the road carries on with no stalls, and the cave has no further art than rocks, torches, crystals and mounds');
  ok(cave.props.filter(p => (Math.floor(p[1] / TR) - OX) > 100).every(p => /^(crystal|rock|pebbles|dirtMound)/.test(p[0])), 'the far half is bare: only rocks, crystals and mounds');
  // people: sprites, short lines, no dashes; four themed trainers from the Route 4 table
  const trn = cave.npcs.filter(m => m.trainer); eq(trn.length, 4, 'four Route 4 trainers'); ok(trn.every(m => /^r4-/.test(m.id)) && cave.npcs.filter(m => !m.trainer).every(m => /^t4-cv-/.test(m.id)), 'the ids name their place');
  const hasO = ADVW.has; ADVW.has = () => true;
  for (const m of cave.npcs) {
    ok(m.room === 't4-cave' && (O8[m.sprite]?.rows.length === 8 || !!(window.TRAINER_OW_RANGER || {})[m.sprite]), m.id + ': in the cave with an 8 direction sprite'); const t = m.trainer || {};
    ok(m.lines.length >= 1 && m.lines.length <= 2 && [...m.lines, t.say, t.lose].filter(Boolean).every(s => s.length <= 100 && !/[—–]/.test(s) && !/\s{2}/.test(s)), m.id + ': 1-2 short lines, no dashes');
    if (!t.team) continue;
    ok(t.team.length === 6 && t.team.every(([s, rel]) => DEX.species[s] && t4.has(s) && rel >= 0 && rel <= 3) && t.team.every(([, rel], i) => !i || rel >= t.team[i - 1][1]), m.id + ': six species from the Route 4 table, weakest first'); ok(t.sight >= 3 && t.sight <= 6 && t.money > 0 && t.cls && t.name && t.say && t.lose && m.face % 2 === 0, m.id + ': sight, money, class, lines, faces a cardinal direction');
    ADVN.team(t, m.id, 4).forEach(x => ok(allowed.has(x.species) && x.level >= 29 && x.level <= 32, m.id + ': badge 4 team member ' + x.species + ' ' + x.level));
  }
  ADVW.has = hasO;
  ADVN.load([...cave.npcs]); ADV.player = { badges: 0, beat: {} };
  for (const nn of ADVN.list.filter(x => x.def.trainer)) {
    ok(ADVN.place(nn), nn.id + ': placed on the cave floor'); const v = DIR_VEC[nn.face], x0 = (nn.def.x + 0.5) * TR, y0 = (nn.def.y + 0.5) * TR;
    ok(ADVN.sees(nn, x0 + v[0] * 3 * TR, y0 + v[1] * 3 * TR, 0), nn.id + ': sees the passage 3 tiles ahead'); ok(!ADVN.sees(nn, x0 - v[0] * 2 * TR, y0 - v[1] * 2 * TR, 0), nn.id + ': not behind it');
  }
  ADVN.reset(); delete ADV.player;
  // music: the town, the route and the cave all have tracks that exist
  load('data/adv/music.js'); const M4 = window.ADV_MUSIC; ok(['T4', 'tradeway', 'route4'].every(k => M4.tracks[M4.zones[k]]), 'Tradeway and Route 4 have music that exists'); ok(M4.tracks[M4.rooms.cave], 'the cave has a room track');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- G6 Pinegrove: the logging town, Aspen's sawmill gym (the Goldacre leader code path, reused), Route 3 (the numbered stands) and Route 111 (the timber haul) ----------
{
  const W6 = window.ADV_WORLD, G6c = W6.towns.G6, cx6 = Math.floor(G6c.x / T), cy6 = Math.floor(G6c.y / T), O8 = window.TRAINER_OW8, ex = window.ADV_TILESET.props;
  ADV.reset(); ADV.setWorld(W6); ADV.fallback = false;
  loadWorld();
  const zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T), tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T];
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) if (p.x >= (cx6 + -85) * T && p.x < (cx6 + 203) * T && p.y >= (cy6 + -162) * T && p.y < (cy6 + 158) * T) all.push(p);   // the props round the town (the box the old chunk range covered)
  const of = (...m) => all.filter(p => m.includes(p.n)), inz = (ps, z) => ps.every(p => zoneAt(Math.floor(p.x / T), Math.floor(p.y / T)) === z);
  // doors and rooms
  eq(W6.buildings.filter(b => b.town === 'G6').length, 9, 'Pinegrove has 9 buildings: a Center, the Outfitters, the forestry office, 5 houses and the sawmill gym'); ok(['g6-center', 'g6-mart', 'g6-gym'].every(r => W6.buildings.some(b => b.id === r)), 'Pinegrove has its Center, its Outfitters and its gym');
  ok(Object.values(ADV.rooms).filter(r => !r.live).every(r => r.cx < ADV.rooms['t4-cave'].cx || r.cx >= ADV.rooms['t4-cave'].cx + ADV.rooms['t4-cave'].cw), 'no room chunk lies inside the Route 4 cave');
  ok(!window.ADV_NPCS.some(d => d.script === 'teach' && /^(g6|r3|r111)-/.test(d.id)), 'no Skill is taught in Pinegrove or on Routes 3 and 111');
  // the gym: Aspen goes through the same leader code as Whitney (same trainer fields, the shared ADVN.leaderTeam / ADVN.win), with a crew to beat first
  const gym6 = bnpcs('g6-gym'), asp = gym6.find(m => m.trainer?.leader), whit = window.ADV_WORLD.buildings.find(b => b.id === 'g7-gym').interior.npcs.find(m => m.trainer?.leader);
  eq(gym6.filter(m => m.trainer && !m.trainer.leader).length, 3, 'three gym trainers'); eq(asp.trainer.leader, 'aspen', 'the leader is Aspen'); eq(asp.trainer.after.length, 3, 'Aspen waits on all three'); ok(asp.trainer.after.every(id => gym6.some(m => m.id === id && m.trainer && m.trainer.gym)), 'and they are her gym trainers');
  eq(Object.keys(asp.trainer).filter(k => !(k in whit.trainer)).join(), '', 'her trainer def uses only the fields the Whitney def does (one code path, no fork)');
  const ro6 = window.ADV_ROSTERS.aspen; ADV.player = { badges: 0, beat: {} };
  for (let b = 0; b <= 8; b++) {
    const k = ADVN.bandKey(b), t = ADVN.leaderTeam('aspen', b), src = ro6[k];
    ok(src && t.length === src.length, 'Aspen band ' + k + ': ' + t.length + ' mons for ' + b + ' badges'); ok(t[t.length - 1].species === src.find(m => m.ace).species && t.filter(m => m.ace).length === 1, 'Aspen band ' + k + ': the ace goes out last'); ok(t.every(m => m.level >= 1 && m.level <= 100 && DEX.species[m.species]), 'Aspen band ' + k + ': valid levels and species');
  }
  eq(ADVN.leaderTeam('aspen', 0).at(-1).species, 'scyther', 'at 0 badges the ace slot is Scyther (Appendix A)'); eq(ADVN.leaderTeam('aspen', 2).at(-1).species, 'kleavor', 'from 2 badges the ace is Kleavor'); eq(ADVN.leaderTeam('aspen', 8).at(-1).species, 'kleavor', 'and the true team ends on Kleavor too');
  eq(ADVN.team({ leader: 'aspen' }, 'g6-aspen', 3).length, ADVN.leaderTeam('aspen', 3).length, 'ADVN.team on a leader uses the roster');
  const s6 = { money: 0, badges: 0, medals: [], beat: {}, bag: {} }, as6 = { id: 'g6-aspen', def: asp }, tm6 = ADVN.leaderTeam('aspen', 0), w1 = ADVN.win(s6, as6, tm6), w2 = ADVN.win(s6, as6, tm6);
  ok(w1.badge === 'Pinegrove Badge' && w1.tm === asp.trainer.tm && s6.badges === 1 && s6.medals.length === 1 && s6.bag[asp.trainer.tm] === 1, 'first win: one badge, one medal, one TM'); ok(!w2.badge && !w2.tm && s6.badges === 1 && s6.bag[asp.trainer.tm] === 1, 'a rematch gives neither again'); eq(w1.pay, 80 * Math.max(...tm6.map(m => m.level)), 'Aspen pays 80 x her top level');
  ADV.player = null;
  // the crew cannot be walked past: each one sees a player going straight up the middle of the floor from the exit mat
  ADVN.load(ADV.bldNpcs().filter(m => m.room === 'g6-gym')); ADV.player = { badges: 0, beat: {} }; ADV.cutTick(9, { x: ADV.bldById.get('g6-gym').x0 + 90, y: ADV.bldById.get('g6-gym').y1 - 50 });
  for (const nn of ADVN.list.filter(x => x.def.trainer && !x.def.trainer.leader)) { ok(ADVN.place(nn), nn.id + ': placed on the gym floor'); const g6 = ADV.bldById.get('g6-gym'); ok(ADVN.sees(nn, (g6.gaps[0][0] + g6.gaps[0][1]) / 2, nn.e.y, 0), nn.id + ': sees the middle of the floor along its row'); }
  ADVN.reset(); ADV.cutTick(9, null); delete ADV.player;
  // the gym building: the inn stands over the gym door and is the biggest building in town
  const g6b = bld('g6-gym'), sm = of(g6b.n).filter(p => p.b?.id === g6b.id); ok(sm.length === 1, 'the gym hall stands over the gym footprint'); const sz6 = b => b.w * b.d, o6 = W6.buildings.filter(b => b.town === 'G6' && b !== g6b); ok(sz6(g6b) >= Math.max(...o6.map(sz6)) * 1.2, 'the gym is clearly the biggest building in town (' + sz6(g6b) + ' vs ' + Math.max(...o6.map(sz6)) + ')');
  const mill = bld('g6-gym').interior; ok(mill.floor === 'i_barn_floor' && mill.walls === 'i_barn' && mill.props.some(p => p[0] === 'fallenLog2x') && mill.props.some(p => p[0] === 'crateWide2x'), 'the gym interior is the barn theme: logs and crates');
  // the town: zone, clearing, yard, nursery and signs
  eq(zoneAt(cx6, cy6), 'pinegrove', 'the town centre is Pinegrove'); ok(of('pineSapling', 'pineSaplingTeal', 'saplingTree', 'miniTree').length >= 12 && of('vanGrey').length >= 2 && of(bld('g6-gym').n).some(p => p.b?.id === 'g6-gym'), 'the town has its sapling nursery, vans and the gym hall');
  // Route 3: numbered stands (all three kinds), timber stacked at intervals, stumps and saplings, all in the Route 3 zone


  const r3p = all.filter(p => zoneAt(Math.floor(p.x / T), Math.floor(p.y / T)) === 'route3'); ok(r3p.filter(p => /^(logShort|fallenLog)$/.test(p.n)).length >= 1, 'timber stacked on Route 3'); const st3 = r3p.filter(p => /^(stump|fallenLog|logShort)/.test(p.n)).length, sa3 = r3p.filter(p => /^(pineSapling|saplingTree|miniTree|poplar)/.test(p.n) && !/Bush/.test(p.n)).length; ok(st3 >= 4 && sa3 >= 4, 'felled stands show stumps, replanted stands show saplings (' + st3 + ', ' + sa3 + ')');

  // Route 111: landings with trucks, stacks, barrels, crates and a loader
  const r111p = all.filter(p => zoneAt(Math.floor(p.x / T), Math.floor(p.y / T)) === 'route111'); const c111 = nm => r111p.filter(p => nm.test(p.n)).length; ok(c111(/^vanGrey$/) >= 1 && c111(/^(logShort|fallenLog)$/) >= 3 && c111(/^(barrelOrange|crateWide)$/) >= 1, 'Route 111 has its timber landings (plan B: about 20 tiles between Pinegrove and Spindlewood now, room for one; ' + c111(/^vanGrey$/) + ' trucks, ' + c111(/^(logShort|fallenLog)$/) + ' stacks, ' + c111(/^(barrelOrange|crateWide)$/) + ' barrels and crates, ' + c111(/^bulldozer$/) + ' loaders)');
  eq(zoneAt(cx6 + 9, cy6 - 60), 'route3', 'north of the town is Route 3'); eq(zoneAt(cx6 + 40, cy6 + 4), 'route111', 'east of the town is Route 111');
  // both roads walk on foot from the town to the end of the road
  let n3 = ADV.entity(...tile(cx6 + 10, cy6 + 4), 0); walk(n3, 0, -1, 28); ok(n3.y < (cy6 - 75) * T, 'Route 3 walks on foot from the town to its far end (reached ' + Math.floor(n3.y / T - cy6) + ')');
  let e111 = ADV.entity(...tile(cx6 + 13, cy6 + 4), 0); walk(e111, 1, 0, 40); ok(e111.x > (cx6 + 100) * T, 'Route 111 walks on foot from the town to its far end (reached ' + Math.floor(e111.x / T - cx6) + ')');
  // wild: the town rolls Route 3's table (no nat20), never on its own streets
  const E6 = window.ADV_ENC, nn = tb => tb.filter(e => e[1] !== 'nat20'); eq(JSON.stringify(E6.pinegrove), JSON.stringify({ day: nn(E6.route3.day), night: nn(E6.route3.night) }), 'Pinegrove\'s table is Route 3\'s, without the nat20 slot');
  const bon = ADVW.tm('bonsly'), p6 = [(cx6 + 8) * T + 16, (cy6 - 12) * T + 16]; eq(ADV.palette[ADV.mat(cx6 + 8, cy6 - 12)], 'path', 'the town street north of the plaza is a dirt lane'); ok(!ADVW.ok(p6[0], p6[1], bon, 0), 'no wild Pokemon stands on Pinegrove\'s streets'); ok(ADVW.ok(...tile(cx6 + 12, cy6 - 25), bon, 0) || ADVW.ok(...tile(cx6 + 14, cy6 - 25), bon, 0), 'but they do stand in the clearing around it');
  // music: the town, both routes and their rooms have tracks that exist
  load('data/adv/music.js'); const M6 = window.ADV_MUSIC; ok(['G6', 'pinegrove', 'route3', 'route111'].every(k => M6.tracks[M6.zones[k]]), 'Pinegrove and Routes 3 and 111 have music that exists'); ok(M6.zones.G6 === M6.zones.pinegrove && M6.zones.route3 !== M6.zones.pinegrove, 'the town and its routes do not share a track');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- T6 Spindlewood: the timber dock, its cove with a wharf and three piers, the quay crane and the log yards; no gym, no Skill; Route 111's dock fishing; nothing story-gated ----------
{
  const W6 = window.ADV_WORLD, S6 = W6.towns.T6, cx = Math.floor(S6.x / T), cy = Math.floor(S6.y / T), O8 = window.TRAINER_OW8, ex = window.ADV_TILESET.props;
  ADV.reset(); ADV.setWorld(W6); ADV.fallback = false;
  loadWorld();
  const pal = (c, r) => ADV.palette[ADV.mat(c, r)], zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T), tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T];
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) if (p.x >= (cx + -69) * T && p.x < (cx + 91) * T && p.y >= (cy + -66) * T && p.y < (cy + 94) * T) all.push(p);   // the props round the town (the box the old chunk range covered)
  const of = (...m) => all.filter(p => m.includes(p.n)), cell = p => [Math.floor(p.x / T), Math.floor(p.y / T)];
  // doors and rooms: a Center, the dock store and five houses; no gym, nobody teaches a Skill
  eq(W6.buildings.filter(b => b.town === 'T6').length, 7, 'Spindlewood has 7 buildings: a Center, the dock store and 5 houses'); ok(['t6-center', 't6-mart'].every(r => W6.buildings.some(b => b.id === r)), 'Spindlewood has its Center and its dock store');
  ok(!W6.buildings.some(d => d.town === 'T6' && /gym/.test(d.id)) && !window.ADV_NPCS.some(d => d.script === 'teach' && /^t6-/.test(d.id)), 'no gym and no Skill teacher in Spindlewood');
  ok(bnpcs('t6-mart').some(m => m.script === 'clerk') && bnpcs('t6-center').some(m => m.script === 'nurse') && bnpcs('t6-center').some(m => m.script === 'pc'), 'the store has a clerk, the Center a nurse and a PC');
  // the cove: water cut into the shore, a quay on its west side and three piers across it (two slips of open water between them), the open sea to the east
  ok([[18, 12], [26, 13], [18, 17], [24, 18], [20, 22]].every(([a, b]) => ADV.isWater(cx + a, cy + b)), 'the cove water lies between the piers (two slips) and past the last one');
  ok([[10, 15], [10, 9], [20, 10], [33, 15], [20, 19], [10, 26]].every(([a, b]) => pal(cx + a, cy + b) === 'boardwalk' && !ADV.isWater(cx + a, cy + b)), 'the quay and the three piers are boardwalk (dry, walkable)');
  const reach = (tx, ty) => {   // 8 px grid flood from the Center door front over everything a foot circle (r 9) fits through
    const R = 8 * S, X0 = (cx - 32) * T, Y0 = (cy - 12) * T, GW = 76 * 4, GH = 48 * 4, seen = new Uint8Array(GW * GH), q = [], s = tile(cx - 8, cy + 7), at = (x, y) => (Math.floor((y - Y0) / R)) * GW + Math.floor((x - X0) / R);
    q.push(s); seen[at(...s)] = 1;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x < X0 || y < Y0 || x >= X0 + GW * R || y >= Y0 + GH * R || seen[at(x, y)] || ADV.blocked(x, y, 0, 9)) continue; seen[at(x, y)] = 1; q.push([x, y]); }
    return seen[at(tx, ty)] === 1;
  };
  for (const [a, b, what] of [[33, 15, 'the end of the long wharf'], [27, 10.5, 'the end of the north pier'], [25, 19.5, 'the end of the south pier'], [10, 25, 'the south crane'], [5, 7, 'the dock store door']]) ok(reach(...tile(cx + a, cy + Math.floor(b))), 'on foot from the Center: ' + what);
  // dock furniture
  const bo = of('wBollard'), tp = of('crateWide', 'crateWideB', 'crateBox'), st = of('logShort', 'fallenLog'), cr = [], sw = [], sr = [];
  ok(bo.length >= 14 && tp.length >= 5 && st.length >= 10, `${bo.length} bollards, ${tp.length} crates, ${st.length} logs (cranes, tarps and sawdust are missing art)`);
  ok(!!ADV.propDef('wBollard').solid, 'bollards are solid');
  const craft = of('maRowboat', 'pxYacht').filter(p => ADV.isWater(...cell(p))); ok(craft.length >= 3, craft.length + ' small craft moored on the water of the cove');
  ok(of('pokeCenterGrand').length === 1 && of('warehouse').length === 1, 'the Center and the dock store (a warehouse) stand in town');
  // zones: town and wharf are Spindlewood, the Route 111 sign is not an NPC but the road outside is Route 111
  eq(zoneAt(cx, cy), 'spindlewood', 'the town centre is Spindlewood'); eq(zoneAt(cx + 33, cy + 15), 'spindlewood', 'the end of the long wharf is Spindlewood too'); eq(zoneAt(cx - 60, cy + 38), 'route111', 'the road out is Route 111');
  // fishing from the dock uses Route 111's table (shore and dock only); the bible's town file has none
  const E6 = window.ADV_ENC; eq(JSON.stringify(E6.spindlewood.fish), JSON.stringify(E6.route111.fish), 'Spindlewood fishes the Route 111 table'); eq(E6.spindlewood.fish.map(([sp, b]) => sp + ':' + b).join(), 'magikarp:common,chinchou:uncommon,krabby:rare,squirtle:nat20', '(Magikarp, Chinchou, Krabby, Squirtle: bible)');
  const P6 = Object.assign(ADV.entity(...tile(cx + 31, cy + 15), 0), { lv: 0, face: 0 }), hasO6 = ADVW.has; ADVW.has = () => true;
  const r6 = ADVW.fishRoll(ADVW.zone(P6.x, P6.y), 0); ok(r6 && r6.lv >= 7 && r6.lv <= 13, 'a cast from the wharf end brings a Route 111 fish at the 0 badge level'); const sp6 = ADVW.fishSpot(P6, P6.x, P6.y + 3 * T); ADVW.has = hasO6;
  ok(sp6 && !ADV.isWater(Math.floor(sp6.x / T), Math.floor(sp6.y / T)) && !ADV.blocked(sp6.x, sp6.y, 0, 9), 'a hooked mon finds dry boards beside the angler');
  // wild: none on the streets or the boards, plenty on the grass and in the timber yards
  const wim = ADVW.tm('wimpod'); ok(!ADVW.ok(...tile(cx - 12, cy + 6), wim, 0) && !ADVW.ok(...tile(cx + 20, cy + 15), wim, 0) && !ADVW.ok(...tile(cx + 10, cy + 20), wim, 0), 'no wild Pokemon on the dirt lanes, the long wharf or the quay'); ok(ADVW.ok(...tile(cx - 10, cy - 4), wim, 0) || ADVW.ok(...tile(cx - 8, cy - 4), wim, 0), 'but they do stand on the grass outside the lanes');
  // people: outdoors on free ground (checked above), their lines are plain dock talk
  const ids = window.ADV_NPCS.filter(d => /^t6-/.test(d.id)); ok(ids.length >= 8 && ids.every(d => !d.trainer), `${ids.length} outdoor villagers, no trainers (the routes are covered)`);
  const lines = [...ids.flatMap(d => d.lines)];
  for (const id of ['t6-center', 't6-mart', 't6-h1', 't6-h2', 't6-h3', 't6-h4', 't6-h5']) lines.push(...bnpcs(id).flatMap(m => m.lines || []));
  ok(lines.length >= 20 && lines.every(s => !/umbra|\bink\b|\bship\b|\bjet\b|lieutenant|\bteam\b|smuggl|secret/i.test(s)), `${lines.length} lines and none of them touches the story (Umbra, the ship, Jet, ink): that is left for the story pass`);
  // music: the town has its own track, Route 111 keeps its own
  load('data/adv/music.js'); const M6 = window.ADV_MUSIC; ok(['T6', 'spindlewood', 'route111'].every(k => M6.tracks[M6.zones[k]]), 'Spindlewood and Route 111 have music that exists'); ok(M6.zones.T6 === M6.zones.spindlewood && M6.zones.T6 !== M6.zones.route111, 'the town and its road do not share a track');
  const idx6 = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'); ok(!idx6.includes('data/adv/rooms/t6-'), 'index.html loads no Spindlewood room: its seven buildings carry their interiors');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- G8 Sporehaven: the fungal gym town, Rue's glowing gym (the Goldacre leader code path, reused), Route 2 (mushroom road) and Route 101 (the quarantine line); the glow is prop metadata; nothing story-gated ----------
{
  const W8 = window.ADV_WORLD, G8c = W8.towns.G8, cx = Math.floor(G8c.x / T), cy = Math.floor(G8c.y / T), ex = window.ADV_TILESET.props, TI = window.ADV_TILESET_INT.props;
  ADV.reset(); ADV.setWorld(W8); ADV.fallback = false;
  loadWorld();
  const zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T), tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T];
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) if (p.x >= (cx + -115) * T && p.x < (cx + 173) * T && p.y >= (cy + -130) * T && p.y < (cy + 94) * T) all.push(p);   // the props round the town (the box the old chunk range covered)
  const of = (...m) => all.filter(p => m.includes(p.n)), inz = (ps, z) => ps.filter(p => zoneAt(Math.floor(p.x / T), Math.floor(p.y / T)) === z);
  // doors and rooms: a Center, the general store, the wardens' lodge, five houses, the gym; no Skill taught
  eq(W8.buildings.filter(b => b.town === 'G8').length, 9, 'Sporehaven has 9 buildings: a Center, the store, the lodge, 5 houses and the gym'); ok(['g8-center', 'g8-mart', 'g8-lodge', 'g8-gym'].every(r => W8.buildings.some(b => b.id === r)), 'Sporehaven has its Center, store, lodge and gym');
  ok(bnpcs('g8-mart').some(m => m.script === 'clerk') && bnpcs('g8-center').some(m => m.script === 'nurse') && bnpcs('g8-center').some(m => m.script === 'pc'), 'the store has a clerk, the Center a nurse and a PC');
  ok(!window.ADV_NPCS.some(d => d.script === 'teach' && /^(g8|r2|r101)-/.test(d.id)), 'no Skill is taught in Sporehaven or on Routes 2 and 101');
  // the gym: Rue goes through the same leader code as Whitney and Aspen (same trainer fields, the shared ADVN.leaderTeam / ADVN.win), with a crew to beat first
  const gym8 = bnpcs('g8-gym'), rue = gym8.find(m => m.trainer?.leader), whit8 = window.ADV_WORLD.buildings.find(b => b.id === 'g7-gym').interior.npcs.find(m => m.trainer?.leader);
  eq(gym8.filter(m => m.trainer && !m.trainer.leader).length, 3, 'three gym trainers'); eq(rue.trainer.leader, 'rue', 'the leader is Rue'); eq(rue.trainer.after.length, 3, 'Rue waits on all three'); ok(rue.trainer.after.every(id => gym8.some(m => m.id === id && m.trainer && m.trainer.gym)), 'and they are her gym trainers');
  eq(Object.keys(rue.trainer).filter(k => !(k in whit8.trainer)).join(), '', 'her trainer def uses only the fields the Whitney def does (one code path, no fork)');
  const ro8 = window.ADV_ROSTERS.rue; ADV.player = { badges: 0, beat: {} };
  for (let b = 0; b <= 8; b++) {
    const k = ADVN.bandKey(b), t = ADVN.leaderTeam('rue', b), src = ro8[k];
    ok(src && t.length === src.length, 'Rue band ' + k + ': ' + t.length + ' mons for ' + b + ' badges'); ok(t[t.length - 1].species === src.find(m => m.ace).species && t.filter(m => m.ace).length === 1, 'Rue band ' + k + ': the ace goes out last'); ok(t.every(m => m.level >= 1 && m.level <= 100 && DEX.species[m.species]), 'Rue band ' + k + ': valid levels and species');
  }
  eq(ADVN.leaderTeam('rue', 0).at(-1).species, 'shroomish', 'at 0 badges the ace slot is Shroomish (Appendix A)'); eq(ADVN.leaderTeam('rue', 2).at(-1).species, 'breloom', 'from 2 badges the ace is Breloom'); eq(ADVN.leaderTeam('rue', 8).at(-1).species, 'breloom', 'and the true team ends on Breloom too');
  eq(ADVN.team({ leader: 'rue' }, 'g8-rue', 3).length, ADVN.leaderTeam('rue', 3).length, 'ADVN.team on a leader uses the roster');
  const s8 = { money: 0, badges: 0, medals: [], beat: {}, bag: {} }, ru8 = { id: 'g8-rue', def: rue }, tm8 = ADVN.leaderTeam('rue', 0), v1 = ADVN.win(s8, ru8, tm8), v2 = ADVN.win(s8, ru8, tm8);
  ok(v1.badge === 'Sporehaven Badge' && v1.tm === 'tm_gigadrain' && s8.badges === 1 && s8.medals.length === 1 && s8.bag.tm_gigadrain === 1, 'first win: the Sporehaven Badge, one medal, TM Giga Drain'); ok(!v2.badge && !v2.tm && s8.badges === 1 && s8.bag.tm_gigadrain === 1, 'a rematch gives neither again'); eq(v1.pay, 80 * Math.max(...tm8.map(m => m.level)), 'Rue pays 80 x her top level');
  ADV.player = null;
  // the crew cannot be walked past: each one sees a player going straight up the middle of the floor from the exit mat
  ADVN.load(ADV.bldNpcs().filter(m => m.room === 'g8-gym')); ADV.player = { badges: 0, beat: {} }; ADV.cutTick(9, { x: ADV.bldById.get('g8-gym').x0 + 90, y: ADV.bldById.get('g8-gym').y1 - 50 });
  for (const nn of ADVN.list.filter(x => x.def.trainer && !x.def.trainer.leader)) { ok(ADVN.place(nn), nn.id + ': placed on the gym floor'); const g8 = ADV.bldById.get('g8-gym'); ok(ADVN.sees(nn, (g8.gaps[0][0] + g8.gaps[0][1]) / 2, nn.e.y, 0), nn.id + ': sees the middle of the floor along its row'); }
  ADVN.reset(); ADV.cutTick(9, null); delete ADV.player;
  // the gym building: the tree house stands over the gym door and is the biggest building in town
  const g8b = bld('g8-gym'), gc = of(g8b.n).filter(p => p.b?.id === g8b.id); ok(gc.length === 1, 'the gym hall stands over the gym footprint'); const sz8 = b => b.w * b.d, o8 = W8.buildings.filter(b => b.town === 'G8' && b !== g8b); ok(sz8(g8b) >= Math.max(...o8.map(sz8)) * 1.2, 'the gym is clearly the biggest building in town (' + sz8(g8b) + ' vs ' + Math.max(...o8.map(sz8)) + ')');




  const g8r = bld('g8-gym').interior, rsrc = fs.readFileSync(new URL('../src/adv-render.js', import.meta.url), 'utf8'), g8d = W8.buildings.filter(b => b.town === 'G8' && b.id !== 'g8-gym').map(b => b.id);
  ok(!/Gradient\(/.test(rsrc) && /RINGS:/.test(rsrc) && /steps\(/.test(rsrc), 'all adventure light is pixel art: stepped rings, no canvas gradients in the renderer'); ok(g8r.floor === 'i_farm_floor' && g8r.walls === 'i_farm' && g8r.props.some(p => /^mushroom/.test(p[0])), 'the gym interior is the farm theme, with mushrooms'); ok(g8d.length === 8 && g8d.every(k => !bld(k).interior.dark && !bld(k).interior.glow), 'the other eight Sporehaven buildings are lit normally (the canopy gloom fades out with the cutaway, adv-scene.js lights)');
  // the town: zone, mushrooms, signs
  eq(zoneAt(cx, cy), 'sporehaven', 'the town centre is Sporehaven'); const gt = inz(of('mushroomStump', 'mushroomsPale', 'mushroomsRed', 'mushroomsOrange', 'mushroomsOrangeB'), 'sporehaven'); ok(gt.length >= 40, gt.length + ' mushroom props in the Sporehaven zone');
  ok(of('torchPost').length >= 10 && of('streetSign', 'signGreenWide').length >= 3, 'torch posts and signs stand in place'); ok(of('mPlanterEmpty', 'mPlanterPot').length >= 6 && of('crateWide').length >= 2, 'the planters and crates are laid out');
  // Route 2 and Route 101: zones, walking the road, trainers
  const T2 = window.ADV_NPCS.filter(d => /^r2-/.test(d.id) && d.trainer), T101 = window.ADV_NPCS.filter(d => /^r101-/.test(d.id) && d.trainer); ok(T2.length >= 3 && T101.length >= 3, T2.length + ' Route 2 and ' + T101.length + ' Route 101 trainers');
  eq(zoneAt(...[T2[T2.length - 1].x, T2[T2.length - 1].y]), 'route2', 'the far end of Route 2 is Route 2'); eq(zoneAt(T101[T101.length - 1].x, T101[T101.length - 1].y), 'route101', 'the far end of Route 101 is Route 101');
  const reach = (tx, ty) => {   // 16 px grid flood from the Center door front over everything a foot circle (r 9) fits through
    const R = 16 * S, X0 = (cx - 70) * T, Y0 = (cy - 90) * T, GW = 210 * 2, GH = 110 * 2, seen = new Uint8Array(GW * GH), q = [], s = tile(cx - 10, cy + 2), at = (x, y) => (Math.floor((y - Y0) / R)) * GW + Math.floor((x - X0) / R);
    q.push(s); seen[at(...s)] = 1;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x < X0 || y < Y0 || x >= X0 + GW * R || y >= Y0 + GH * R || seen[at(x, y)] || ADV.blocked(x, y, 0, 9)) continue; seen[at(x, y)] = 1; q.push([x, y]); }
    return seen[at(tx, ty)] === 1;
  };
  for (const [id, what] of [['r2-pip', 'the far end of Route 2'], ['r101-ivo', 'the far end of Route 101'], ['r2-wynne', 'the first Route 2 trainer']]) { const d = window.ADV_NPCS.find(x => x.id === id); ok(reach(...tile(d.x, d.y + 1)) || reach(...tile(d.x, d.y - 1)) || reach(...tile(d.x + 1, d.y)), 'on foot from the Center: ' + what); }
  // wild: the town rolls Route 2's table (no nat20) and never on its own streets
  const E8 = window.ADV_ENC, nn = tb => tb.filter(e => e[1] !== 'nat20'); eq(JSON.stringify(E8.sporehaven), JSON.stringify({ day: nn(E8.route2.day), night: nn(E8.route2.night) }), "Sporehaven's table is Route 2's, without the nat20 slot"); ok(E8.sporehaven.night.some(e => e[0] === 'shiinotic') && E8.sporehaven.day.some(e => e[0] === 'foongus'), 'Foongus by day, Shiinotic at night');
  const foo = ADVW.tm('foongus'); ok(!ADVW.ok(...tile(cx + 5, cy + 2), foo, 0), 'no wild Pokemon stands on Sporehaven\'s streets');
  // people: outdoors on free ground (checked above); plain flavour, nothing from the story pass (Umbra, the curse, shadow Pokemon)
  const ids = window.ADV_NPCS.filter(d => /^g8-/.test(d.id)); ok(ids.length >= 8 && ids.length <= 14 && ids.every(d => !d.trainer), `${ids.length} outdoor villagers, no trainers`);
  const lines = [...ids.flatMap(d => d.lines), ...window.ADV_NPCS.filter(d => /^(r2|r101)-/.test(d.id)).flatMap(d => [...d.lines, d.trainer?.say, d.trainer?.lose].filter(Boolean))];
  for (const id of g8d.concat('g8-gym')) lines.push(...bnpcs(id).flatMap(m => [...(m.lines || []), m.trainer?.say, m.trainer?.lose, ...[].concat(m.trainer?.say2 || [], m.trainer?.wait || [])].filter(Boolean)));
  ok(lines.length >= 40 && lines.every(s => !/umbra|\bcurse|shadow|\bink\b|\bship\b|\bjet\b|lieutenant|smuggl|secret/i.test(s)), `${lines.length} lines and none of them touches the story (Umbra, the curse, shadow Pokemon): that is left for the story pass`);
  // music: the town and both routes have tracks that exist
  load('data/adv/music.js'); const M8 = window.ADV_MUSIC; ok(['G8', 'sporehaven', 'route2', 'route101'].every(k => M8.tracks[M8.zones[k]]), 'Sporehaven and Routes 2 and 101 have music that exists');
  const idx8 = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'); ok(!idx8.includes('data/adv/rooms/g8-'), 'index.html loads no Sporehaven room: its nine buildings carry their interiors');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- T8 Duskmoss: the end-of-the-road town on the quarantine line (no gym, no Skill), the cut line and treeline north-west of it, and Route 103, the black shore (the map draws no road for it: the generator lays it, with dark sand and sea cliffs); nothing story-gated ----------
{
  const W9 = window.ADV_WORLD, T8c = W9.towns.T8, cx = Math.floor(T8c.x / T), cy = Math.floor(T8c.y / T);
  ADV.reset(); ADV.setWorld(W9); ADV.fallback = false;
  loadWorld();
  const zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T), tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T];
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) if (p.x >= (cx + -226) * T && p.x < (cx + 62) * T && p.y >= (cy + -83) * T && p.y < (cy + 141) * T) all.push(p);   // the props round the town (the box the old chunk range covered)
  const of = (...m) => all.filter(p => m.includes(p.n)), inz = (ps, z) => ps.filter(p => zoneAt(Math.floor(p.x / T), Math.floor(p.y / T)) === z);
  // buildings: a Center, the general store, the watch house, five houses; no gym, no Skill taught, every building a walk-in interior
  eq(W9.buildings.filter(b => b.town === 'T8').length, 8, 'Duskmoss has 8 buildings: a Center, the store, the watch house and 5 houses'); ok(['t8-center', 't8-mart', 't8-lodge'].every(r => W9.buildings.some(b => b.id === r)), 'Duskmoss has its Center, store and watch house');
  ok(!W9.buildings.some(b => b.town === 'T8' && /gym/.test(b.id)) && !window.ADV_NPCS.some(d => d.script === 'teach' && /^(t8|r103)-/.test(d.id)), 'no gym and no Skill teacher in Duskmoss or on Route 103');
  ok(bnpcs('t8-mart').some(m => m.script === 'clerk') && bnpcs('t8-center').some(m => m.script === 'nurse') && bnpcs('t8-center').some(m => m.script === 'pc'), 'the store has a clerk, the Center a nurse and a PC');
  ok(!fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes('data/adv/rooms/t8-'), 'index.html loads no Duskmoss room: its eight buildings carry their interiors');
  // zones: the town, the road west, the dock fishes Route 103's table; the town rolls its own table and never on its own streets
  eq(zoneAt(cx, cy), 'duskmoss', 'the town centre is Duskmoss'); const E9 = window.ADV_ENC; ok(E9.route103.fish.length === 4 && JSON.stringify(E9.duskmoss.fish) === JSON.stringify(E9.route103.fish), "Duskmoss's shore and jetty fish Route 103's table (the bible gives the town none of its own)");
  { const hasO9 = ADVW.has; ADVW.has = () => true; ok(ADVW.fishRoll('duskmoss', 0) && ADVW.fishRoll('route103', 0), 'a rod gets a bite in Duskmoss and on Route 103'); ADVW.has = hasO9; } ok(E9.duskmoss.night.some(e => e[0] === 'duskull') && E9.duskmoss.day.some(e => e[0] === 'morelull'), 'Morelull at the boundary by day, Duskull at night');
  const mor = ADVW.tm('morelull'); ok(!ADVW.ok(...tile(cx - 6, cy + 2), mor, 0), "no wild Pokemon stands on Duskmoss's lanes");
  // the cut line and the treeline: stakes and crew stations on the north-west arc, a dark wood beyond it on swamp ground
  const stakes = inz(of('fencePole'), 'duskmoss'), wood = of('darkConeTree', 'pineTreeDark', 'spruceTreeDark', 'canopyTreeDark', 'roundTreeDark', 'layerTreeDark').filter(p => p.x < T8c.x && p.y < T8c.y);
  ok(stakes.length >= 14, stakes.length + ' stakes on the cut line and the square'); ok(wood.length >= 60, wood.length + ' dark trees in the treeline north-west of town'); ok(ADV.palette[ADV.mat(cx - 36, cy - 12)] === 'swamp', 'swamp ground under the wood');
  ok(of('maRowboat', 'boatWhite').length >= 3 && of('torchPost').length >= 6 && of('frostMushroomTree').length >= 1, 'boats on the shore, a few low torches, the mushroom in the square');
  ok(ADV.palette[ADV.mat(cx + 10, cy + 8)] === 'boardwalk' && ADV.isWater(cx + 8, cy + 14) && ADV.palette[ADV.mat(cx + 10, cy + 14)] === 'boardwalk', 'the jetty runs out over the water');
  // on foot: Center door front to the far end of Route 103 and every Route 103 trainer (a 32 px grid over everything a foot circle fits through)
  const reach = (tx, ty) => {
    const R = 16 * S, X0 = (cx - 190) * T, Y0 = (cy - 30) * T, GW = 420, GH = 280, seen = new Uint8Array(GW * GH), q = [], s = tile(cx - 18, cy + 2), at = (x, y) => (Math.floor((y - Y0) / R)) * GW + Math.floor((x - X0) / R);
    q.push(s); seen[at(...s)] = 1;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x < X0 || y < Y0 || x >= X0 + GW * R || y >= Y0 + GH * R || seen[at(x, y)] || ADV.blocked(x, y, 0, 9)) continue; seen[at(x, y)] = 1; q.push([x, y]); }
    return seen[at(tx, ty)] === 1;
  };
  const T103 = window.ADV_NPCS.filter(d => /^r103-/.test(d.id) && d.trainer); ok(T103.length >= 3 && T103.length <= 5, T103.length + ' Route 103 trainers');
  for (const d of T103) ok(reach(...tile(d.x, d.y + 1)) || reach(...tile(d.x, d.y - 1)) || reach(...tile(d.x + 1, d.y)) || reach(...tile(d.x - 1, d.y)), 'on foot from the Center: ' + d.id);
  { const fy = [...Array(60)].map((_, k) => 880 + k).find(y => ADV.palette[ADV.mat(485, y)] === 'path'); ok(fy && reach(...tile(485, fy)), 'on foot from the Center: the far (west) end of Route 103 at tile 485, ' + fy); eq(zoneAt(485, fy), 'route103', 'and it is Route 103'); }
  // the road: 3 wide dirt, the dark beach beside it, sea cliffs (a raised ledge with a rock face) inland of the beach
  { const col = x => [...Array(60)].map((_, k) => 880 + k).filter(y => ADV.palette[ADV.mat(x, y)] === 'path'); ok([485, 501, 517, 533].every(x => col(x).length >= 2 && col(x).length <= 4), 'Route 103 is 2 to 4 tiles wide on the south leg'); }
  const dark = (() => { let k = 0; for (let y = 855; y < 920; y++) for (let x = 465; x < 615; x++) if (ADV.palette[ADV.mat(x, y)] === 'ashGround') k++; return k; })(); ok(dark >= 600, dark + ' tiles of dark sand along the shore');
  const ledges = (() => { let k = 0; for (let y = 855; y < 920; y++) for (let x = 465; x < 615; x++) if (ADV.h(x, y) === 1) k++; return k; })(); ok(ledges >= 400, ledges + ' tiles of cliff ledge on the black shore (1 level, with stairs: the generator flood fill proves they are reachable)');
  // people: outdoors on free ground (checked above); plain flavour, nothing from the story pass
  const ids9 = window.ADV_NPCS.filter(d => /^t8-/.test(d.id)); ok(ids9.length >= 8 && ids9.length <= 14 && ids9.every(d => !d.trainer), `${ids9.length} outdoor villagers, no trainers`);
  const lines9 = [...ids9.flatMap(d => d.lines), ...T103.flatMap(d => [...d.lines, d.trainer.say, d.trainer.lose])];
  for (const id of W9.buildings.filter(b => b.town === 'T8').map(b => b.id)) lines9.push(...bnpcs(id).flatMap(m => [...(m.lines || [])]));
  ok(lines9.length >= 30 && lines9.every(s => s.length <= 100 && !/[—–]/.test(s) && !/umbra|\bcurse|shadow|\bink\b|\bship\b|\bjet\b|lieutenant|smuggl|secret/i.test(s)), `${lines9.length} lines, short, no dashes, none of them touches the story`);
  ok(['t8-lodge'].every(id => bnpcs(id).some(m => /crews/.test((m.lines || []).join(' ')))) && ids9.some(d => /Sporehaven/.test(d.lines.join(' '))), 'Sporehaven keeps the line and the town says so');
  load('data/adv/music.js'); const M9 = window.ADV_MUSIC; ok(['T8', 'duskmoss', 'route103'].every(k => M9.tracks[M9.zones[k]]), 'Duskmoss and Route 103 have music that exists'); ok(M9.zones.T8 === M9.zones.duskmoss && M9.zones.T8 !== M9.zones.route103, 'the town and its coast road do not share a track');
  ADV.reset(); ADV.setWorld(null);
}

// ---------- L4 Quiet Plain + Route 1 (docs/TOWNPASS.md): a landmark with no building, fence or gate (a fan of standing-stone markers in open grass with no trees), Route 1 as an old paved road with the grass coming up through it and nine waymarker stones counting down, the ghost-speaker who teaches Sensing Shadow Pokemon to anyone who walks down; nothing gated ----------
{
  const W4 = window.ADV_WORLD, L4c = W4.towns.L4, cx = Math.floor(L4c.x / T), cy = Math.floor(L4c.y / T);
  ADV.reset(); ADV.setWorld(W4); ADV.fallback = false;
  loadWorld();
  const zoneAt = (c, r) => ADVW.zone((c + 0.5) * T, (r + 0.5) * T), tile = (c, r) => [(c + 0.5) * T, (r + 0.5) * T], pal = (c, r) => ADV.palette[ADV.mat(c, r)];
  const all = []; for (const [, ch] of ADV.chunks) for (const p of ch.props || []) if (p.x >= (cx + -70) * T && p.x < (cx + 122) * T && p.y >= (cy + -185) * T && p.y < (cy + 71) * T) all.push(p);   // the props round the town (the box the old chunk range covered)
  const around = (ps, x, y, r) => ps.filter(p => Math.hypot(p.x / T - x, p.y / T - y) <= r), of = (...m) => all.filter(p => m.includes(p.n));
  // the landmark: nothing built, nothing fenced, no trees, markers in the grass, wind
  ok(!W4.buildings.some(b => b.town === 'L4') && !W4.doors.some(d => d.town === 'L4'), 'Quiet Plain has no building, no room and no door');
  eq(around(all, cx, cy, 40).filter(p => /fence|gate|palisade|hedge|stoneTerrace|stoneCourt|stoneTower|wall/i.test(p.n)).length, 0, 'no fence, no gate, no wall within 40 tiles of the markers (v2: the three stoneRing wreath beds are the focal points, not walls)');
  eq(around(all, cx, cy, 40).filter(p => /tree|oak|pine|spruce|palm|bush|sapling/i.test(p.n)).length, 0, 'open grassland: no tree or bush within 40 tiles of the markers');
  const marks = around(of('standingStoneMintTall', 'standingStoneMint', 'rockGreyB'), cx, cy, 26); ok(marks.length >= 60, marks.length + ' markers stand in circles, rows and an avenue round the end of the road (v2: fewer, grouped)'); ok(of('standingStoneMintTall').length >= 25, 'many tall standing stones');
  ok(around(of('grassBlades', 'dryTuft', 'leafPlantGrey'), cx, cy, 40).length >= 30, 'wind in the grass round the markers'); ok(around(of('flowersWhite'), cx, cy, 24).length >= 4, 'a few flowers left at markers');
  ok(zoneAt(cx, cy) === 'quietplain' && zoneAt(cx + 10, cy + 14) === 'quietplain', 'the whole plain is Quiet Plain'); const E4 = window.ADV_ENC;
  ok(E4.quietplain.day.some(e => e[0] === 'greavard') && E4.quietplain.night.some(e => e[0] === 'duskull'), 'Greavard on the plain by day, Duskull by night'); ok(![...E4.route1.day, ...E4.route1.night].some(e => ['pidgey', 'starly', 'spearow', 'wingull', 'taillow', 'hoppip'].includes(e[0])), 'no birds on Route 1');
  // Route 1: an old paved road, 2 to 4 wide on the straights, cracked (grass holes and weeds in the seams), nothing solid on it
  const corr = []; for (let y = 787; y < 884; y++) for (let x = 382; x < 447; x++) if (pal(x, y) === 'pavingStone') corr.push([x, y]);
  ok(corr.length >= 380, corr.length + ' tiles of old paving on Route 1');
  for (const y of [808, 812, 826, 830, 844, 856, 872]) { const w = [...Array(65)].filter((_, i) => pal(382 + i, y) === 'pavingStone').length; ok(w >= 2 && w <= 4, `Route 1 is 2 to 4 tiles wide at row ${y} (${w})`); }
  const weeds = all.filter(p => ['grassBlades', 'dryTuft', 'leafPlantGrey'].includes(p.n) && pal(Math.floor(p.x / T), Math.floor((p.y - 3) / T)) === 'pavingStone'); ok(weeds.length >= 40, weeds.length + ' weeds forced up through the seams');
  ok(all.filter(p => ADV.propDef(p.n)?.solid && p.x / T >= 382 && p.x / T < 447 && p.y / T >= 787 && p.y / T < 884 && pal(Math.floor(p.x / T), Math.floor((p.y - 3) / T)) === 'pavingStone').length === 0, 'nothing solid stands on the paving');
  const holes = (() => { let k = 0; for (const [x, y] of corr) for (const [dx, dy] of [[1, 0], [-1, 0]]) if (pal(x + dx, y + dy) === 'grass' && pal(x + 2 * dx, y + 2 * dy) === 'pavingStone') k++; return k; })(); ok(holes >= 6, holes + ' grass holes inside the paving');
  // nine waymarker stones counting down toward the memorial, each with a reader's line
  const WM = [...Array(9)].map((_, i) => window.ADV_NPCS.find(d => d.id === 'r1-stone' + (i + 1))); ok(WM.every(Boolean) && WM.every(d => d.sprite === null && !d.trainer && !d.script), 'nine waymarker stones as unseen readers');
  const stones = of('standingStoneMint').filter(p => p.x / T >= 382 && p.x / T < 447 && p.y / T >= 787 && p.y / T < 878); eq(stones.length, 9, 'nine waymarker stones stand beside Route 1');
  ok(WM.every(d => stones.some(p => Math.hypot(p.x / T - d.x - 0.5, p.y / T - d.y - 0.5) <= 3.2)), 'each reader stands by a stone (within 3 tiles, the generator\'s rule: the first stone stands just inside Quiet Plain, its reader on the Route 1 side)');
  ok(WM.every((d, i) => new RegExp('\\b' + (i + 1) + '\\b').test(d.lines.join(' '))) && WM.every((d, i) => !i || d.y < WM[i - 1].y), 'the numbers count down toward the memorial: stone 1 is nearest, stone 9 farthest (the road runs south to it; on the 0.8x island its jogs make straight-line distance a poor measure)');
  // the ghost-speaker: free, for anyone, no badge, no lesson; the name stays open
  const sp = window.ADV_NPCS.find(d => d.id === 'l4-speaker'); ok(sp && sp.script === 'teach' && sp.skill === 'sense' && sp.sprite === 'npc1-robed-woman' && !sp.trainer && !sp.fee, 'the ghost-speaker teaches Sensing Shadow Pokemon for nothing');
  { const sv = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: ADVP.mon('bulbasaur', 5) }); eq(sv.badges, 0, 'a fresh save with no badges and nothing done'); ok(ADVP.teach(sv, 'sense').length >= 1 && sv.skills.sense === 1, 'walks away knowing Sensing Shadow Pokemon'); eq(ADVP.teach(sv, 'sense').length, 0, 'and it is taught once'); }
  ok(/Sensing Shadow/.test(ADVP.SKILLS.sense.name), 'the skill is named for what the bible calls it'); ok(sp.name === 'Ghost-speaker', 'the speaker has the bible role as a placeholder name (the real name is OPEN)');
  ok(window.ADV_NPCS.filter(d => /^l4-/.test(d.id)).length === 5 && window.ADV_NPCS.filter(d => /^l4-/.test(d.id)).every(d => !d.trainer), 'five people at Quiet Plain, no trainers'); ok(window.ADV_NPCS.filter(d => /^r1-/.test(d.id) && d.trainer).length >= 3, 'Route 1 trainers');
  ok(window.ADV_NPCS.filter(d => /^(l4|r1)-/.test(d.id)).every(d => [...d.lines, ...(d.known || []), ...(d.trainer ? [d.trainer.say, d.trainer.lose] : [])].every(s => !/umbra|statue|vesper|dunereach|\bship\b|sanctuary/i.test(s))), 'nobody here connects the two monuments or names the story');
  // on foot: from the Route 2 junction down the road to its end, and to the speaker and the far visitors
  const reach = (tx, ty) => {
    const R = 16 * S, X0 = 374 * T, Y0 = 782 * T, GW = 190, GH = 330, seen = new Uint8Array(GW * GH), q = [], s0 = tile(426, 790), at = (x, y) => (Math.floor((y - Y0) / R)) * GW + Math.floor((x - X0) / R);
    q.push(s0); seen[at(...s0)] = 1;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x < X0 || y < Y0 || x >= X0 + GW * R || y >= Y0 + GH * R || seen[at(x, y)] || ADV.blocked(x, y, 0, 9)) continue; seen[at(x, y)] = 1; q.push([x, y]); }
    return seen[at(tx, ty)] === 1;
  };
  ok(reach(...tile(cx, cy - 6)), 'on foot from the Route 2 junction to the end of the road'); ok(reach(...tile(sp.x - 1, sp.y)) || reach(...tile(sp.x, sp.y + 1)) || reach(...tile(sp.x, sp.y - 1)), 'and to the ghost-speaker');
  for (const id of ['l4-flowers', 'l4-count', 'l4-wind']) { const d = window.ADV_NPCS.find(m => m.id === id); ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach(...tile(d.x + dx, d.y + dy))), 'and to ' + id); }
  ok(reach(...tile(cx, cy + 18)), 'and the whole fan of markers is open ground, down to its far edge');
  load('data/adv/music.js'); const M4 = window.ADV_MUSIC; ok(['L4', 'quietplain', 'route1'].every(k => M4.tracks[M4.zones[k]]) && M4.zones.L4 === M4.zones.quietplain && M4.zones.L4 !== M4.zones.route1, "the memorial has its own track, and it is not Route 1's");
  ADV.reset(); ADV.setWorld(null);
}

// ---------- map scale: outdoors S times bigger than its data, rooms and the cave at 1; sheet density ----------
{
  eq(S, 2, 'outdoors is drawn 2x'); eq(T, 64, 'so a tile is 64 world px'); eq(ADV.Tp(1000), 64, 'a position in the open world has the outdoor tile'); eq(ADV.Tp(ADV.EDGE + 5), 32, 'a position out in the room area has the room tile'); eq(ADV.Tc(100), 64, 'cell columns follow the same split'); eq(ADV.Tc(200 * 32), 32, 'rooms start at chunk 200');
  ok(Math.max(...Object.values(ADV.rooms).filter(r => !r.live).map(r => 0), ADV_WORLD.chunksW) * 32 * T < ADV.EDGE, 'the whole world lies below the edge, every room beyond it'); ok(Object.values(ADV.rooms).every(r => r.cx * 32 * TR >= ADV.EDGE), 'every room lies beyond the edge');
  eq(ADV_WORLD.px, S, 'world.js px fields were multiplied once'); const sp0 = { ...ADV_WORLD.spawn }; ADV.scaleWorld(ADV_WORLD); ok(ADV_WORLD.spawn.x === sp0.x && ADV_WORLD.spawn.y === sp0.y, 'and never twice');
  ADV.reset(); chunk(0, 0, () => ({}), [['pineTree', 100, 120, 6]]); const pt = ADV.chunks.get(ADV.key(0, 0)).props[0];
  ok(pt.x === 100 * S && pt.y === 120 * S && pt.z === 6 * S, 'chunk props are multiplied on load'); const pd = ADV.propDef('pineTree');
  eq(ADV.dk(pd, pt.x), S, 'HD art is drawn S times bigger'); pd.density = 0.5; eq(ADV.dk(pd, pt.x), S / 2, 'clean 2x art (density 0.5) is drawn 1:1'); eq(ADV.dk(pd, ADV.EDGE + 5), 1, 'and everything is 1:1 in rooms'); 
  { const o = ADV.entity(pt.x - 60 * S, pt.y, 0); walk(o, 1, 0, 2); const x2 = o.x; pd.density = 1; const o2 = ADV.entity(pt.x - 60 * S, pt.y, 0); walk(o2, 1, 0, 2); ok(x2 > o2.x && o2.x < pt.x + pd.solid[0] * S, 'a prop solid follows the density of its art (' + x2.toFixed(0) + ' vs ' + o2.x.toFixed(0) + ')'); }
  delete pd.density; ADV.reset();
  const cv = ADV.rooms['t4-cave']; ADV.reset(); ADV.setWorld(ADV_WORLD); const cp = [...ADV.chunks.values()].flatMap(c => c.props).find(p => p.n === cv.props[0][0] && p.x === cv.props[0][1]); ok(cp && cp.y === cv.props[0][2], 'cave props keep their data px (scale 1)'); ADV.reset(); ADV.setWorld(null);
  ok(ADVS.fresh({ name: 'A', avatar: 'red', home: 'G7', starter: ADVP.mon('bulbasaur', 5) }).sc === S, 'a new save is stamped with the scale its px positions are in');
}

// ---------- travel (docs/TRAVEL.md): nothing teleports. Shoes from the start, the Bike, per-kind ride skills, free flight, lessons and teachers, the paid supply mount ----------
{
  globalThis.location = { hash: '', search: '' }; globalThis.uiBlip = () => {}; globalThis.ADVW ||= ADVW;
  globalThis.ADVUI = { ask: (sc, line, yes, no) => ({ line, yes, no }), choose: (sc, line, opts) => ({ line, opts }), lesson: (sc, level, name, done) => ({ level, name, done }), money: v => '$' + v };
  globalThis.ADVMT ||= load('src/adv-mount.js', '\n;ADVMT');   // mounts and flight (mountKey starts one)
  const SC = load('src/adv-scene.js', '\n;AdventureScene'), npc = id => window.ADV_NPCS.find(d => d.id === id), K = ADVP.SKILLS;
  const mk = (lead = 'bulbasaur') => ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: ADVP.mon(lead, 20) });
  const scene = (sv, env = {}) => Object.assign(Object.create(SC), { save: sv, p: { x: 0, y: 0, z: 0, lv: 0, face: 0 }, said: [], warped: null, mount: '', lent: null, alt: 0, landing: false, msg: null, room: null, persist() {}, skillSync() {}, wet: () => false, dialog(pages, n, done) { this.said.push(pages); if (done) done(); }, open(ui) { this.ui = ui; }, close() {}, warp(w) { this.warped = w; }, mountEnv: () => ({ room: false, grass: false, wet: false, lead: sv.party[0], ...env }) });
  const dead = (sc, p) => { sc.ui = null; sc.script({ def: npc(p) }); return sc.ui; };
  // running shoes: from the start, no gate, no giver
  ok(!npc('g7-shoes') && !window.ADV_NPCS.some(d => d.give === 'shoes'), 'nobody hands out the shoes any more'); eq(ADVP.pace(true, 0), ADVP.PACE.run, 'a new save runs at 160 when run is held'); eq(ADVP.pace(false, 0), ADVP.PACE.walk, 'and walks when it is not');
  // the Bike: bought at any Mart from the start, mounted by key or from the bag, faster than running, never indoors / in tall grass / on water
  let sv = mk(), sc = scene(sv);
  ok(ADVP.stock(0).includes('bike') && ADVP.PRICE.bike > 3000 && ADVP.item('bike').cat === 'key', 'every Mart sells the Bike with no badges, for more than the starting money');
  eq(ADVP.buy(sv, 'bike').ok, false, 'a new save cannot afford it'); sv.money = 5000; ok(ADVP.buy(sv, 'bike').ok && sv.bag.bike === 1 && sv.money === 5000 - ADVP.PRICE.bike, 'buying it takes the money and puts it in the bag'); ok(!ADVP.buy(sv, 'bike').ok && sv.bag.bike === 1, 'a second one is refused'); eq(ADVP.sellPrice('bike'), 0, 'and it cannot be sold');
  eq(scene(mk()).mountKey('bike'), 'You do not have a Bike.', 'no Bike, no mount');
  eq(sc.mountKey('bike'), '', 'with the Bike in the bag V gets on'); eq(sc.mount, 'bike', 'and the scene is mounted'); ok(sc.mountSpeed() === ADVP.PACE.bike && ADVP.PACE.bike > ADVP.PACE.run, 'the Bike is faster than running');
  eq(sc.mountKey('bike'), '', 'pressing again gets off'); eq(sc.mount, '', 'and the scene is on foot again');
  for (const [env, why] of [[{ room: true }, 'indoors'], [{ grass: true }, 'tall grass'], [{ wet: true }, 'water']]) { const s2 = scene(sv, env); ok(/^You cannot ride/.test(s2.mountKey('bike')) && s2.mount === '', 'no Bike ' + why); }
  { ADV.reset(); const tg = ADV.palette.indexOf('tallgrass'); chunk(0, 0, (x, y) => (x === 3 && y === 3 ? { o: tg } : {}));
    const p = { x: 3.5 * T, y: 3.5 * T, lv: 0, z: 0, surf: false }, real = Object.assign(Object.create(SC), { save: sv, p, room: null });
    ok(real.mountEnv().grass && !Object.assign(real, { p: { ...p, x: 5.5 * T } }).mountEnv().grass && Object.assign(real, { room: { id: 'x' } }).mountEnv().room, 'mountEnv reads tall grass and rooms off the world'); ADV.reset(); }
  // the per-kind ride skills: the table in docs/TRAVEL.md, one skill each (the old single ride skill is gone)
  ok(!K.ride && ['rough', 'canter', 'boulder', 'snow', 'dune', 'fly', 'surf', 'fishing'].every(k => K[k]), 'the skills are Rough, Cantering, Bouldering, Snow, Dune, Fly, Surf and Fishing');
  const kinds = { rough: ['tauros', 'mudsdale', 'rhyhorn', 'donphan', 'bouffalant'], canter: ['rapidash', 'ponyta', 'zebstrika', 'blitzle', 'arcanine', 'wyrdeer', 'stantler'], boulder: ['gogoat', 'skiddo', 'rhydon', 'golem', 'sawsbuck'], snow: ['mamoswine', 'piloswine', 'arcaninehisui', 'avalugg'], dune: ['hippowdon', 'sandaconda', 'camerupt'] };
  for (const [k, ids] of Object.entries(kinds)) ok(ids.every(id => window.DEX.species[id] && ADVP.RIDERS[id]?.includes(k)), k + ': every listed species rides it'); ok(Object.values(ADVP.RIDERS).flat().every(k => ADVP.RIDE[k] && K[k]), 'every rider kind is a real skill'); ok(!ADVP.rideable({ species: 'bulbasaur' }) && !ADVP.rideable(null), 'Bulbasaur does not ride');
  deepEq(ADVP.RIDERS.rhydon, ['rough', 'boulder'], 'a species can carry several skills'); deepEq(ADVP.RIDERS.rapidash.slice().sort(), ['canter', 'rough', 'snow'], 'Rapidash canters, rides rough ground and snow');
  const sv2 = mk('rapidash'), s3 = scene(sv2); ok(/Cantering Riding/.test(s3.mountKey('ride')) && s3.mount === '', 'a rideable lead is not enough without its skill, and the message names it');
  sv2.skills.boulder = 1; ok(/Cantering Riding/.test(s3.mountKey('ride')), 'a ride skill it cannot use does not unlock it'); sv2.skills.rough = 1; eq(ADVP.rideBest(sv2, sv2.party[0]), 'rough', 'Rough Riding alone lets a Rapidash ride, at the rough pace'); s3.mountKey('ride'); s3.mountKey('ride'); sv2.skills.canter = 1; eq(s3.mountKey('ride'), '', 'with Cantering and a Rapidash R gets on'); eq(s3.mount, 'ride', 'mounted');
  { const v = s3.mountSpeed(), c = ADVP.RIDE.canter.speed; ok(v >= c * 0.82 && v <= c * 1.15, 'at about the canter speed, scaled by its stats and level (' + v + ')'); } { const t = mk('rapidash'); t.skills.canter = 1; const lo = ADVP.mon('rapidash', 10, { nature: 'Brave' }), hi = ADVP.mon('rapidash', 60, { nature: 'Timid' }), slow = ADVP.mon('mamoswine', 60, { nature: 'Timid' }); t.skills.snow = 1; ok(ADVP.rideSpeed(t, hi) > ADVP.rideSpeed(t, lo), 'a raised, speedy Rapidash outruns a young slow one'); ok(ADVP.rideSpeed(t, hi) > ADVP.rideSpeed(t, slow), 'and a Mamoswine on snow skill is slower than a Rapidash'); ok(ADVP.rideSpeed(t, lo) >= ADVP.RIDE.canter.speed * 0.82, 'the spread stays small'); } ok(ADVP.RIDE.canter.speed > ADVP.PACE.bike && ADVP.PACE.bike > ADVP.PACE.run, 'cantering is the fastest on land'); eq(s3.mountKey('ride'), '', 'again gets off'); ok(/^You cannot ride indoors/.test(scene(sv2, { room: true }).mountKey('ride')), 'not indoors');
  const sv3 = mk(); sv3.skills.canter = 1; const s4 = scene(sv3); ok(/not built for riding/.test(s4.mountKey('ride')) && s4.mount === '', 'a skill with a Bulbasaur lead: no'); sv3.party.unshift(ADVP.mon('mudsdale', 30)); ok(/Rough Riding/.test(s4.mountKey('')), 'a Mudsdale needs Rough Riding'); sv3.skills.rough = 1; eq(s4.mountKey(''), '', 'with it, a Mudsdale works (no key named picks what is possible)'); eq(s4.mount, 'ride', 'as a ride');
  { const a = mk('arcaninehisui'); a.skills.snow = 1; eq(ADVP.rideBest(a, a.party[0]), 'snow', 'a Hisuian Arcanine with only Snow rides as snow'); a.skills.canter = 1; eq(ADVP.rideBest(a, a.party[0]), 'canter', 'and with both the faster one applies'); deepEq(ADVP.rideKnown(a, a.party[0]).sort(), ['canter', 'snow'], 'both are known'); }
  // terrain: deep snow, sand and rough ground slow everyone but a mount trained for it
  const can = ks => ks.filter(Boolean); eq(ADVP.ground('grass', []), 1, 'grass never slows'); for (const [mat, k] of [['ashGround', 'rough'], ['snow', 'snow'], ['duneSand', 'dune']]) { eq(ADVP.ground(mat, []), 0.6, mat + ' slows to 0.6 on foot'); eq(ADVP.ground(mat, [k]), 1, 'and not for ' + k + ' riding'); eq(ADVP.ground(mat, can(['canter'])), 0.6, 'cantering does not help on ' + mat); }
  // Fly: free flight (no list of towns, no teleport), a lead that can learn Fly, a skill, never indoors
  ok(!ADVS.flyList && !ADVS.flyDest && !SC.fly && !ADVS.fresh({ name: 'A', avatar: 'red', home: 'G7', starter: ADVP.mon('pidgeot', 20) }).visited, 'there is no list of towns to fly to and no fly call');
  const sv5 = mk('pidgeot'), s5 = scene(sv5); eq(s5.mountKey('fly'), 'You have not learned to fly yet.', 'no Fly skill, no flight'); sv5.skills.fly = 1; ok(/cannot fly/.test(scene(Object.assign(mk(), { skills: { fly: 1 } })).mountKey('fly')), 'the skill with a Bulbasaur lead: no'); eq(s5.mountKey('fly'), '', 'with the skill and a Pidgeot G takes off'); eq(s5.mount, 'fly', 'the scene is flying');
  ADVMT.flyStep(s5, ADVMT.PERIOD, 0, 0, 0, true); ok(s5.alt > 0, 'a flap on the beat climbs (flight is flapped, docs/TRAVEL.md)');
  { ADV.reset(); ADV.setWorld({ palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'], water: ['water'], chunksW: 1, chunksH: 1 });
    chunk(0, 0, (x, y) => (y === 5 && x === 6 ? { h: 3 } : y === 5 && x === 7 ? { m: WATER } : y === 5 && x === 9 ? { k: 1 } : {}));
    s5.alt = ADVMT.MAXA; for (let i = 0; i < 40; i++) { s5.p = { x: 16 * T, y: 16 * T, z: 0, lv: 0, face: 2 }; ADVMT.flyStep(s5, 0.1, 0, 0, 0, false); }   // held mid-chunk so the world's edge never brakes it
    ok(s5.fly.v > Math.max(...Object.values(ADVP.RIDE).map(r => r.speed)), 'high up, flying is faster than any ride');
    s5.p = { x: 5.5 * T, y: 5.5 * T, z: 0, lv: 0, face: 2 }; s5.flyMove(2 * T, 0); ok(s5.p.x === 7.5 * T, 'flight passes over a cliff face (6,5) and onto water (7,5): the ground does not stop it'); eq(s5.landOK(), 'There is no clear ground to land on.', 'it cannot land on water');
    s5.flyMove(2 * T, 0); eq(s5.landOK(), 'There is no clear ground to land on.', 'nor on a stair / bridge tile'); s5.flyMove(-4 * T, 0); eq(s5.p.x, 5.5 * T, 'flying back'); eq(s5.landOK(), '', 'clear outdoor ground takes a landing');
    s5.flyMove(-40 * T, 0); ok(s5.p.x > 0, 'the edge of the world stops it (no chunk, no flight)'); s5.p.x = 5.5 * T;
    eq(s5.mountKey('fly'), '', 'G again lands'); ok(s5.landing, 'the landing starts'); s5.fly.up = true; s5.alt = Math.max(s5.alt, 20); for (let i = 0; i < 60 && s5.mount; i++) { s5.p.x = s5.p.y = 5.5 * T; ADVMT.flyStep(s5, 0.1, 0, 0, 0, false); }   // held over the clear tile while it comes down eq(s5.mount, '', 'and ends on foot'); eq(s5.alt, 0, 'at ground level');
    s5.mountKey('fly'); s5.mountStep(1); s5.p.x = 7.5 * T; ok(/no clear ground/.test(s5.mountKey('fly')) && s5.mount === 'fly' && !s5.landing, 'G over water: refused, still flying'); ADV.reset(); }
  { const s15 = scene(sv5, { room: true }); s15.mount = 'fly'; s15.mountStep(0.1); eq(s15.mount, '', 'a room ends the flight'); } ok(/indoors/.test(scene(sv5, { room: true }).mountKey('fly')), 'no taking off indoors');
  // the lesson: a bar with a moving marker, N hits in the zone; easy is wide and 3 hits, hard is narrow and 6
  { const E = ADVP.lesson('easy', () => 0.5), H = ADVP.lesson('hard', () => 0.5);
    ok(ADVP.LESSON.easy.zone > ADVP.LESSON.hard.zone && E.need === 3 && H.need === 6, 'easy: a wide zone and 3 hits, hard: a narrow zone and 6'); ok(E.zone === ADVP.LESSON.easy.zone && H.zone === ADVP.LESSON.hard.zone, 'the state carries the zone width');
    eq(ADVP.marker(0, 1), 0, 'the marker starts at one end'); eq(ADVP.marker(1, 1), 1, 'reaches the other'); eq(ADVP.marker(2, 1), 0, 'and comes back'); eq(ADVP.marker(0.25, 2), 0.5, 'speed scales it');
    eq(E.press(0.5), 'hit', 'inside the zone is a hit'); eq(E.press(0.5 + E.zone / 2 + 0.01), 'miss', 'just outside is a miss'); eq(E.press(0.5), 'hit', 'a second hit'); eq(E.press(0.5), 'won', 'the third hit wins'); eq(E.press(0.9), 'won', 'and nothing changes afterwards');
    const L2 = ADVP.lesson('easy', () => 0.5); eq(L2.press(0), 'miss', 'miss 1'); eq(L2.press(0), 'miss', 'miss 2'); eq(L2.press(0), 'lost', 'three misses end it'); eq(L2.press(0.5), 'lost', 'and a hit afterwards does not revive it');
    const R = ADVP.lesson('hard', () => 0); ok(R.c - R.zone / 2 >= 0 && ADVP.lesson('hard', () => 1).c + R.zone / 2 <= 1, 'the zone always sits on the bar'); }
  // classes: a town teacher, money plus the easy lesson, the fee only when it is passed
  { const sv6 = mk(), s6 = scene(sv6), d = npc('t2-rough'); const ui = dead(s6, 't2-rough'); ok(ui && /Rough Riding/.test(ui.line) && /1500/.test(ui.line), 'the class asks, naming the skill and the fee'); eq(d.script, 'class', 'it is a class');
    ui.no(); ok(!sv6.skills.rough && sv6.money === 3000, 'declining costs nothing'); ui.yes(); ok(s6.ui.level === 'easy' && /Rough/.test(s6.ui.name), 'accepting opens the easy lesson');
    s6.ui.done(false); ok(!sv6.skills.rough && sv6.money === 3000, 'failing it costs nothing and teaches nothing'); s6.ui.done(true); ok(sv6.skills.rough === 1 && sv6.money === 3000 - ADVP.FEE.class, 'passing it teaches the skill and takes the fee');
    s6.said = []; s6.script({ def: d }); eq(s6.said[0], d.known, 'afterwards the teacher only chats');
    const poor = mk(); poor.money = 100; const s7 = scene(poor); dead(s7, 't2-rough').yes(); ok(!s7.ui?.level && !poor.skills.rough && /1500/.test(s7.msg.s), 'too poor: refused with the fee shown'); }
  { const sv6 = mk(); sv6.money = 5000; const s6 = scene(sv6); dead(s6, 't1-fly').yes(); s6.ui.done(true); ok(sv6.skills.fly && sv6.money === 5000 - npc('t1-fly').fee, 'a class can carry its own fee (the Flight Hub)'); }
  // impromptu teachers: a route trainer, once beaten, offers a lot more money, the hard lesson, or a timed course ride
  { const sv6 = mk(), s6 = scene(sv6), g = npc('r7-gus'); sv6.money = 10000; ok(g.trainer && g.script === 'coach' && g.skill === 'rough' && g.course.length >= 3 && g.time > 0, 'Gus is a trainer who coaches Rough Riding with a course');
    const ui = dead(s6, 'r7-gus'); deepEq(ui.opts.map(o => o.label.replace(/\$\d+/, '$')), ['Pay $', 'Hard lesson, $', 'Timed course ride, free', 'Not now'], 'four choices');
    ok(ADVP.FEE.coachPay > 3 * ADVP.FEE.class && ADVP.FEE.coachHard < ADVP.FEE.class, 'the pay is a lot more than a class, the hard lesson less');
    ui.opts[1].act(); eq(s6.ui.level, 'hard', 'the hard lesson opens the narrow bar'); s6.ui.done(false); ok(!sv6.skills.rough && sv6.money === 10000, 'failing costs nothing'); s6.ui.done(true); ok(sv6.skills.rough && sv6.money === 10000 - ADVP.FEE.coachHard, 'passing takes the small fee');
    const s8 = scene(mk()), sv8 = s8.save; sv8.money = 7000; dead(s8, 'r7-gus').opts[0].act(); ok(sv8.skills.rough && sv8.money === 1000, 'paying teaches it straight away'); const s9 = scene(mk()); s9.save.money = 100; dead(s9, 'r7-gus').opts[0].act(); ok(!s9.save.skills.rough, 'paying with too little: refused'); }
  { const sv6 = mk(), s6 = scene(sv6), g = npc('r7-dolly'); s6.p = { x: 0, y: 0 }; dead(s6, 'r7-dolly').opts[2].act(); ok(s6.mount === 'lent' && s6.lent.kind === 'course' && s6.lent.skill === 'canter' && s6.lent.sp === ADVP.LENT.canter, 'the course puts you on a lent Rapidash');
    ok(g.course.every(q => q.length === 2 && q.every(Number.isInteger)) && g.course.every((q, i) => !i || Math.hypot(q[0] - g.course[i - 1][0], q[1] - g.course[i - 1][1]) <= 14), 'markers are tiles, at most 14 tiles apart');
    let len = Math.hypot(g.course[0][0] - g.x, g.course[0][1] - g.y); for (let i = 1; i < g.course.length; i++) len += Math.hypot(g.course[i][0] - g.course[i - 1][0], g.course[i][1] - g.course[i - 1][1]); ok(g.time >= len / (ADVP.PACE.lent / T) * 1.4, `the time (${g.time} s) allows the ${len.toFixed(0)} tile course at the lent speed plus slack`);
    s6.lentStep(0.1); ok(s6.mount === 'lent' && s6.lent.i === 0, 'away from the first marker nothing counts'); for (const [i, q] of g.course.entries()) { s6.p.x = (q[0] + 0.5) * T; s6.p.y = (q[1] + 0.5) * T; s6.lentStep(0.1); eq(s6.lent?.i ?? g.course.length, i + 1, 'marker ' + (i + 1) + ' counted'); }
    ok(s6.mount === '' && sv6.skills.canter === 1, 'the last marker teaches the skill and the mount goes home');
    const s10 = scene(mk()); s10.p = { x: 0, y: 0 }; dead(s10, 'r7-dolly').opts[2].act(); s10.lent.t = 0.05; s10.lentStep(0.1); ok(s10.mount === '' && !s10.save.skills.canter && /Time is up/.test(s10.msg.s), 'running out of time sends the mount home with no skill');
    const s11 = scene(mk()); s11.p = { x: 0, y: 0 }; dead(s11, 'r7-dolly').opts[2].act(); eq(s11.mountKey(''), '', 'the key gives a lent mount back'); eq(s11.mount, '', 'and the course ends'); }
  // the supply path between Sailsport and Aldermere City: a paid rental, works on the path only
  { const W = window.ADV_WORLD, S2 = W.supply, F = ADVP.SUPPLY_FEE, mid = S2.pts[Math.floor(S2.pts.length / 2)];
    ok(S2.pts.length >= 8 && S2.w >= 2 && S2.w <= 3 && S2.ends.length === 2, 'the world carries a supply path (a 2 to 3 tile worn path)'); ok(ADVP.supplyAt(S2, mid[0], mid[1]) === 'path' && ADVP.supplyAt(S2, mid[0] + 12, mid[1] + 12) === '' && ADVP.supplyAt(S2, S2.ends[0].x, S2.ends[0].y) === 'town', 'on the path, off it, and at an end town');
    for (const id of ['t2-ride', 'g5-ride']) { const d = npc(id); ok(d.script === 'rent' && !d.to, id + ' rents a supply mount (no ferry)'); }
    ok(ADVS.inTown((npc('t2-ride').x + 0.5) * T, (npc('t2-ride').y + 0.5) * T) === 'T2' && ADVS.inTown((npc('g5-ride').x + 0.5) * T, (npc('g5-ride').y + 0.5) * T) === 'G5', 'one handler stands in each end town');
    const sv6 = mk(), s6 = scene(sv6); s6.p = { x: mid[0] * T, y: mid[1] * T }; let ui = dead(s6, 't2-ride'); ok(/200/.test(ui.line) && F === 200, 'it asks for the fee'); ui.no(); ok(sv6.money === 3000 && !s6.mount, 'declining costs nothing');
    ui.yes(); ok(s6.mount === 'lent' && s6.lent.kind === 'supply' && sv6.money === 3000 - F, 'renting takes the fee and mounts you'); eq(s6.mountSpeed(), ADVP.PACE.lent, 'at the lent speed');
    s6.lentStep(0.1); eq(s6.mount, 'lent', 'on the path it stays yours'); s6.p.x += 12 * T; s6.p.y += 12 * T; s6.lentStep(0.1); eq(s6.mount, '', 'leaving the path sends it home'); ok(/left the path/.test(s6.msg.s), 'with a message');
    const s12 = scene(mk()); s12.save.money = F - 1; s12.p = { x: mid[0] * T, y: mid[1] * T }; dead(s12, 'g5-ride').yes(); ok(s12.mount === '' && s12.save.money === F - 1 && /200/.test(s12.msg.s), 'too poor: refused, nothing charged');
    const s13 = scene(mk()); s13.p = { x: mid[0] * T, y: mid[1] * T }; dead(s13, 'g5-ride').yes(); s13.lentStep(0.1); const e = S2.ends[1]; s13.p.x = (e.x + 0.5) * T; s13.p.y = (e.y + 0.5) * T; s13.lentStep(0.1); ok(s13.mount === '' && /arrived/.test(s13.msg.s), 'arriving sends it home');
    const s14 = scene(mk()); s14.p = { x: (S2.ends[0].x + 0.5) * T, y: (S2.ends[0].y + 0.5) * T }; dead(s14, 't2-ride').yes(); s14.lentStep(0.1); eq(s14.mount, 'lent', 'renting inside the town does not end the trip at once'); }
  // teachers: every skill is taught in at least two places, each in the right town or on the right route, with sane lines and fees
  { const all = window.ADV_NPCS.filter(d => ['class', 'coach', 'teach'].includes(d.script)), by = k => all.filter(d => d.skill === k);
    for (const k of ['rough', 'canter', 'boulder', 'snow', 'dune', 'fly', 'surf', 'fishing']) ok(by(k).length >= 2 && new Set(by(k).map(d => d.id.split('-')[0])).size >= 2, `${k}: taught in ${by(k).length} places (${by(k).map(d => d.id).join(', ')})`);
    for (const d of all) { ok(K[d.skill] && Array.isArray(d.known) && d.known.length >= 1 && (d.script === 'coach' ? d.coach.length >= 1 && !!d.trainer : !d.trainer), d.id + ': a ' + d.script + ' for ' + d.skill); ok([...(d.coach || []), ...d.known].every(s => s.length <= 100 && !/[—–]/.test(s)), d.id + ': short lines, no dashes'); if (d.script === 'class') ok((d.fee ?? ADVP.FEE.class) >= 500 && (d.fee ?? ADVP.FEE.class) <= 3000, d.id + ': a sane class fee'); if (d.script === 'coach' && d.course) ok(ADVP.LENT[d.skill], d.id + ': a lent species exists for its course'); }
    const town = (id, t) => ok(ADVS.inTown((npc(id).x + 0.5) * T, (npc(id).y + 0.5) * T) === t, `${id} stands in ${t}`);
    town('t2-rough', 'T2'); town('t2-dune', 'T2'); town('g5-canter', 'G5'); town('g4-boulder', 'G4'); town('g1-dune', 'G1'); town('g2-snow', 'G2'); town('t1-snow', 'T1'); town('t1-fly', 'T1'); town('t7-hire', 'T7');
    ok(['s5-surf', 'r9-teacher', 's5-fish'].every(id => npc(id)), 'Salt Bay keeps surf and fishing'); eq(npc('r6-brine').course, undefined, 'the flight lesson has no course'); }
  // ---------- S2: Goldacre's buildings are walked into at true size (docs/INTERIORS.md): footprint, walls and exits, the cutaway, scripts in place, the gym fight ----------
  {
    const W = window.ADV_WORLD; ADV.reset(); ADV.setWorld(W); ADV.fallback = false; ADVN.reset(); const bl = ADV.blds, GR = 8, loaded = new Set();
    for (const b of bl) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = `${(b.fx >> 5) + dx}_${(b.fy >> 5) + dy}`, f = new URL(`../data/adv/chunks/${k}.js`, import.meta.url); if (!loaded.has(k) && fs.existsSync(f)) { loaded.add(k); vm.runInThisContext(fs.readFileSync(f, 'utf8')); } }
    eq(bl.length, 66, 'S2: 66 buildings to walk into (Goldacre 11, Salt Bay 8, Longshore 7, Tradeway 7, Pinegrove 9, Spindlewood 7, Sporehaven 9, Duskmoss 8)'); eq(ADV.bldNpcs().length, 158, 'with 158 people in them');
    const flood = b => {   // cells a foot can reach, starting on the step outside the exit
      const w = Math.ceil((b.x1 - b.x0) / GR) + 20, h = Math.ceil((b.y1 - b.y0) / GR) + 20, ox = b.x0 - 80, oy = b.y0 - 40, seen = new Uint8Array(w * h), q = [[Math.floor(((b.gaps[0][0] + b.gaps[0][1]) / 2 - ox) / GR), Math.floor((b.y1 + 20 - oy) / GR)]];
      seen[q[0][1] * w + q[0][0]] = 1;
      for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x] || ADV.blocked(ox + (x + .5) * GR, oy + (y + .5) * GR, 0, 9)) continue; seen[y * w + x] = 1; q.push([x, y]); }
      return (px, py) => !!seen[Math.floor((py - oy) / GR) * w + Math.floor((px - ox) / GR)];
    };
    const stand = (b, n, want) => {   // a free reachable spot in talking range of n, facing it
      const reach = flood(b), e = n.e, rr = n.def.reach || ADVN.TALK;
      for (const k of [.9, .7, .5]) for (let a = 0; a < 32; a++) { const x = e.x + Math.cos(a * Math.PI / 16) * rr * k, y = e.y + Math.sin(a * Math.PI / 16) * rr * k; if (reach(x, y) && !ADV.blocked(x, y, 0, 9)) { const p = ADV.entity(x, y, e.lv); p.face = dirFromVec(e.x - x, e.y - y); if (!want || ADVN.target(p) === n) return p; } }
      return null;
    };
    for (const b of bl) {
      const gx = (b.gaps[0][0] + b.gaps[0][1]) / 2, reach = flood(b), mid = (b.y0 + b.y1) / 2;
      for (const p of ADV.bldItems(b)) ok(!p.s || (p.s[0] >= b.x0 + 31 && p.s[2] <= b.x1 - 31 && p.s[3] <= b.y1 - 31 && p.s[1] >= b.y0 - 40), `${b.id}: ${p.n} fits the footprint`);
      ok(ADV.blocked(b.x0 + 16, mid, 0, 9) && ADV.blocked(b.x1 - 16, mid, 0, 9) && ADV.blocked((b.x0 + b.x1) / 2, b.y0 + 4, 0, 9), `${b.id}: the sides and the back are wall`);
      ok(!ADV.blocked(gx, b.y1 - 16, 0, 9) && ADV.blocked(b.gaps[0][0] - 20, b.y1 - 16, 0, 9) && ADV.blocked(b.gaps[0][1] + 20, b.y1 - 16, 0, 9), `${b.id}: the exit is a gap in the front wall`);
      ok(reach(gx, b.y1 - 16) && reach(gx, b.y1 - 48), `${b.id}: the exit is reachable from the door step and leads in`);
      for (const d of b.interior.npcs) { const n = ADVN.list.find(m => m.id === d.id) || (ADVN.load(), ADVN.list.find(m => m.id === d.id)); ADVN.place(n); ADV.cutTick(9, { x: b.x0 + 40, y: b.y1 - 48 }); ok(!!stand(b, n, 1), `${n.id}: can be reached and talked to`); ADV.cutTick(9, null); }
      let free = 0; for (let y = b.y0 + 10; y < b.y1 - 32; y += 16) for (let x = b.x0 + 40; x < b.x1 - 40; x += 16) if (!ADV.blocked(x, y, 0, 9) && reach(x, y)) free++;
      ok(free >= 20, `${b.id}: ${free} walkable cells inside, so the exterior solid is off`);
    }
    // the cutaway: 3 hard steps in 0.2 s going in, the same coming out
    { const b = ADV.bldById.get('g7-center'), seen = [], p = { x: (b.x0 + b.x1) / 2, y: b.y1 - 48 }, out = { x: b.x0 - 200, y: b.y0 - 200 };
      for (let i = 0; i < 15; i++) { ADV.cutTick(1 / 60, p); seen.push(b.k); } ok(seen[0] === 0 && seen.at(-1) === 3 && new Set(seen).size === 4 && seen.every((k, i) => !i || k >= seen[i - 1]), 'walking in: the exterior fades in 3 hard steps ' + seen.join(''));
      const back = []; for (let i = 0; i < 15; i++) { ADV.cutTick(1 / 60, out); back.push(b.k); } ok(back.at(-1) === 0 && back.includes(2) && back.includes(1) && back.every((k, i) => !i || k <= back[i - 1]), 'walking out reverses it ' + back.join('')); }
    // scripts fire in place, with the player on the floor facing the NPC
    globalThis.ADVUI.shop = (sc, mk) => ({ shop: mk }); globalThis.ADVUI.box = () => ({ box: 1 });
    const inFront = (id, f) => {
      const n = ADVN.list.find(m => m.id === id), b = ADV.bldById.get(n.def.room); ADV.cutTick(9, null); ok(!ADVN.vis(n), id + ': hidden from outside');
      ADV.cutTick(9, { x: b.x0 + 40, y: b.y1 - 48 }); const sv = mk(), sc = scene(sv), p = stand(b, n, 1); ADV.cutTick(9, null); ADV.player = sv; sc.p = p; sc.inside(0.3);
      eq(sc.room?.id, b.id, id + ': stepping in makes the building the room'); ok(ADVN.vis(n) && ADVN.target(p) === n, id + ': seen and in talking range'); f(sc, sv, n);
    };
    for (const c of bl.filter(b => /-center$/.test(b.id))) { const pre = c.id.split('-')[0];
    inFront(pre + '-nurse', (sc, sv, n) => { sv.party[0].hp = 1; sc.script(n); eq(sc.mode, 'heal', 'the nurse starts healing in place'); ok(sc.room.d.mach && ADV.bldAt(sc.room.d.mach.x, sc.room.d.mach.y - 4), 'on the machine that stands in the Center'); sc.healStep(4); ok(sv.party[0].hp > 1 && sv.last === c.town, 'the party is healed and the Center remembered'); });
    inFront(pre + '-clerk', (sc, sv, n) => { sc.script(n); eq(sc.ui?.shop, !!n.def.market, 'the clerk opens the shop (the market trader the day stock)'); });
    inFront(pre + '-pc', (sc, sv, n) => { sc.script(n); eq(sc.ui?.box, 1, 'the PC opens the box'); }); }
    // the gym fight: Whitney's band roster in the world battle box, the walls rocks, the box free to run out through the door
    { let cap = null; globalThis.startBattleA = o => { cap = o; B = { sides: [{ team: o.player.team.map(() => ({ maxHp: 99 })) }, { team: o.cpu.team.map(() => ({})) }], cam: {} }; }; globalThis.callout = () => {}; globalThis.ADVR ||= {}; ADVR.zoomFor ||= () => 1; ADVR.battleZoom ||= () => 1;
      for (const [id, who] of [['g7-whitney', 'whitney'], ['g6-aspen', 'aspen'], ['g8-rue', 'rue']]) inFront(id, (sc, sv, n) => { sc.f = { x: sc.p.x, y: sc.p.y, z: sc.p.z }; sc.cam = { x: sc.p.x, y: sc.p.y }; sc.startTrainer(n);
        const ar = cap?.arena, b = ADV.bldById.get(id.split('-')[0] + '-gym'); ok(ar && ar.world && sc.mode === 'battle', id + ': the gym fight starts'); eq(cap.cpu.team.length, ADVN.leaderTeam(who, 0).length, who + "'s roster for no badges");
        ok(ar.obstacles.filter(o => o.kind === 'rock').length >= 20 && ar.oy + ar.h > b.y1 && ar.oy < b.y0, 'its walls and furniture are rocks, and the box runs out past the door'); });
      B = null; }
    ADV.player = null; ADVN.reset(); ADV.reset(); ADV.setWorld(null);
  }
}

// camera zoom: every tier is a whole number of device px per art px (an art px is ART world px) at any DPR, and the old advZoom2 picks migrate
{ const store = {}, mk = dpr => vm.runInNewContext(fs.readFileSync(new URL('../src/adv-render.js', import.meta.url), 'utf8') + ';ADVR', { document: { createElement: () => ({}) }, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), DPR: dpr, STORE: { get: (k, d) => store[k] ?? d, set: (k, v) => { store[k] = v; } } });
  for (const dpr of [1, 1.25, 1.5, 2]) { const R = mk(dpr); for (let t = 1; t <= 4; t++) ok(R.sc(t) * R.ART === t, 'tier ' + t + ' is exactly ' + t + ' device px per art px at DPR ' + dpr); ok(R.zoomFor() === R.sc() / dpr && R.battleZoom() === R.zoomFor(), 'the fight and the camera share one scale at DPR ' + dpr); }
  store.advZoom3 = 3; ok(mk(1).zm === 3, 'a saved tier wins'); delete store.advZoom3; ok(mk(1).zm === 4, 'no save is Normal (tier 4)');
  const R = mk(1); R.zoomBy(9); ok(R.zm === 6 && store.advZoom3 === 6, 'zoomBy clamps at Closest and saves'); R.zoomBy(-9); ok(R.zm === 1, 'zoomBy clamps at Farthest');
  // sun shadows: a north sun throws shadows down-screen, west in the morning, east in the afternoon; down at night; the angle only steps every 10 game minutes
  const s8 = R.sunOf(8), s12 = R.sunOf(12.75), s16 = R.sunOf(16.5);
  ok(s8.dx < 0 && s8.dy > 0 && s16.dx > 0 && s16.dy > 0 && Math.abs(s12.dx) < 0.05 && s12.dy > 0, 'shadows point west at 8:00, south at noon, east at 16:30');
  ok(Math.hypot(s8.dx, s8.dy) > Math.hypot(s12.dx, s12.dy) && s12.face > 0 && s8.by >= 0.3, 'noon shadows are the shortest and south walls are shaded then');
  ok(R.sunOf(3) === null && R.sunOf(21) === null && R.sunOf(12.01).key === R.sunOf(12.15).key && R.sunOf(12.01).key !== R.sunOf(12.2).key, 'no sun at night; it steps every 10 minutes');
  const px = new Set(), k = { fillRect: (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px.add(i + ',' + j); } };
  R.sweep(k, 0, 0, 4, 4, 6, 3); ok(px.has('0,0') && px.has('9,6') && !px.has('9,0') && !px.has('0,6') && px.has('5,3'), 'a swept block covers the block, its moved copy and the band between, nothing beyond'); }

// overworld weather (src/adv-weather.js): deterministic per zone and 6 game hour slot, every zone gets a valid kind, snow zones never rain and the desert never snows, the eased strength stays in 0..1, the light numbers are sane
{
  const WX = load('src/adv-weather.js', '\n;ADVWX'), zones = REAL_ZONES.ids, KS = WX.KINDS, save = { z: ADVW.zone, w: ADVW.weather, h: ADVW.hourSet };
  const seen = id => { const s = new Set(); for (let i = 0; i < 600; i++) s.add(WX.kindFor(id, i, id)); return s; };
  let same = true, valid = true; for (const z of zones) for (let i = 0; i < 200; i++) { const k = WX.kindFor(z, i, z); if (k !== WX.kindFor(z, i, z)) same = false; if (!KS.includes(k)) valid = false; }
  ok(same && valid, 'every zone rolls a valid kind, the same one every time for a slot'); ok(WX.kindFor('wild', 5, 'wild') === WX.kindFor('wild', 5, 'wild') && WX.kindFor('', 7, '') !== undefined, 'an unknown zone falls back to the default table');
  ok(['frostfall', 'sprucevale', 'route17', 'route19', 'pokemonleague'].every(z => { const s = seen(z); return !s.has('rain') && !s.has('storm') && !s.has('sand'); }) && seen('frostfall').has('snow'), 'snow zones snow and never rain');
  ok(['dunereach', 'route15'].every(z => { const s = seen(z); return s.has('sand') && !s.has('rain') && !s.has('storm') && !s.has('snow'); }), 'the desert has sandstorms and never rain or snow');
  ok(seen('goldacre').size >= 4 && !seen('goldacre').has('sand') && !seen('goldacre').has('snow') && seen('saltbay').has('rain') && seen('sporehaven').has('fog'), 'a town has a spread of weather, the coast rains, the fungal zones fog over');
  const fog = z => { const n = [0, 0], f = [0, 0]; for (let i = 0; i < 4000; i++) { const h = (i * WX.SLOT) % 24; if (h < 4) continue; const m = h < 10 ? 0 : 1; n[m]++; if (WX.kindFor(z, i, z) === 'fog') f[m]++; } return (f[0] / n[0]) / (f[1] / n[1]); };   // a slot's hour: slots are WX.SLOT game hours long
  ok(fog('goldacre') > 1.8, 'mornings (slots starting 4 to 10) are foggier than the rest of the day');
  // easing: the strength moves smoothly in 0..1, a change fades the old kind out and the new one in over about 3 s, caves and rooms are always clear
  ADVW.zone = () => 'goldacre'; ADVW.hourSet = 12; ADVW.weather = 'rain'; let t = 0, lo = 9, hi = -9, mono = true, prev = 0;
  const run = (secs, x = 5000) => { const trace = []; for (let i = 0; i < secs * 60; i++) { t += 1 / 60; WX.update(t, x, 5000); lo = Math.min(lo, WX.cur.k); hi = Math.max(hi, WX.cur.k); trace.push(WX.cur.k); } return trace; };
  run(0.1); eq(WX.cur.kind, 'rain', 'a pinned kind shows at once on the first frame'); run(5);
  ADVW.weather = 'snow'; const sw = run(4); ok(sw.some(k => k < 0.05) && sw.at(-1) > 0.99 && WX.cur.kind === 'snow', 'rain to snow fades out and the snow fades in');
  ADVW.weather = ''; const dn = run(4); ok(dn.at(-1) === 0 && WX.cur.kind === '', 'to clear fades to nothing');
  ADVW.weather = 'fog'; const rise = run(3); for (let i = 1; i < rise.length; i++) if (rise[i] < rise[i - 1]) mono = false; ok(mono && rise[0] < 0.1 && rise.at(-1) === 1, 'fading in rises smoothly to 1 and no further');
  ok(lo >= 0 && hi <= 1, 'the eased strength stays in 0..1');
  ADVW.weather = 'storm'; run(3); eq(WX.cur.kind, 'storm', 'storm'); run(4, 300000); eq(WX.cur.kind, '', 'in a cave or room (scale 1) the weather is clear'); ok(WX.cur.k === 0, 'with no strength');
  // automatic: null picks the player's zone and slot (6 game hours); the slot reads the running hour count
  ADVW.weather = null; ADVW.zone = () => 'saltbay'; ADVW.hourSet = 3; const t0 = ADVW.totalHours(), W2 = ADV.world, sp2 = W2 ? ADV.Tp(5000) * ADV.CH : 1, reg2 = W2 ? 'q' + Math.floor(5000 / sp2 / (W2.chunksW / 2)) + Math.floor(5000 / sp2 / (W2.chunksH / 2)) : 'saltbay', want = WX.kindFor('saltbay', Math.floor(t0 / WX.SLOT), reg2);   // one roll per quarter of the world per slot (a front covers many zones) run(5); eq(WX.cur.kind, want, 'automatic weather is the zone and slot roll');
  ADVW.zone = () => 'frostfall'; ADVW.hourSet = 14; run(6); ok(['', 'cloudy', 'fog', 'snow'].includes(WX.cur.kind), 'Frostfall never rains');
  // the clock: a running total that agrees with hour() and keeps the real day count when pinned
  ADVW.hourSet = null; const th = ADVW.totalHours(), hr = ADVW.hour(), dd = Math.abs((th % 24) - hr); ok(Math.min(dd, 24 - dd) < 0.2, 'totalHours mod 24 is hour()'); ADVW.hourSet = 7.5; ok(ADVW.totalHours() % 24 === 7.5 && Math.abs(ADVW.totalHours() - th) < 24, 'a pinned hour keeps the real day count');
  ADVW.clock = () => 5; ADVW.clockTotal = () => 1000.25; ADVW.hourSet = null; eq(ADVW.totalHours(), 1000.25, 'online it is the server total'); ADVW.clock = null; ADVW.clockTotal = null;
  // the light the scene reads
  let sane = true; for (const k of KS) { WX.cur.kind = k; for (const s of [0, 0.3, 1]) { WX.cur.k = k ? s : 0; const L = WX.light(); if (!(L.sun >= 0 && L.sun <= 1 && L.veil >= 0 && L.veil <= 0.4 && L.lamps >= 0 && L.lamps <= 1 && /^\d+,\d+,\d+$/.test(L.tint))) sane = false; } }
  ok(sane, 'light() is always in range'); WX.cur.kind = ''; WX.cur.k = 0; deepEq({ ...WX.light() }, { sun: 1, veil: 0, tint: '14,6,34', lamps: 0 }, 'clear leaves the light alone');
  const at = k => { WX.cur.kind = k; WX.cur.k = 1; return { ...WX.light() }; }; ok(at('cloudy').sun > at('rain').sun && at('rain').sun > at('storm').sun && at('storm').veil > at('rain').veil && at('rain').veil > at('fog').veil && at('rain').lamps > 0.3 && at('storm').lamps > at('rain').lamps, 'cloudy dims the sun a little, rain more, a storm most and darkest, rain and storm light the lamps');
  WX.cur.kind = ''; WX.cur.k = 0; ADVW.zone = save.z; ADVW.weather = save.w; ADVW.hourSet = save.h;
}

// ---------- the lead mon: breadcrumb follow, walk / idle hysteresis, the mood model and its lines (src/adv-follower.js, data/adv/follower-moods.js) ----------
{
  // follow distance: a long random walk with stops, U-turns and runs; the mon is never closer than one tile and settles back to its trail length
  const rng = seeded(5), Tt = ADV.T, D = ADVF.FD * Tt, p = { x: 5000, y: 5000, z: 0, sz: 0 }, L = [{ x: 5000, y: 5000 + D, z: 0, sz: 0, s: 0 }, { x: 5000, y: 5000, z: 0, sz: 0, s: D }], f = { x: 5000, y: 5000 + D, z: 0, sz: 0 };
  let ang = 0, spd = 0, until = 0, minD = 1e9, maxMoving = 0;
  for (let i = 0; i < 60 * 240; i++) {
    const t = i / 60; if (t >= until) { until = t + 0.4 + rng() * 2.5; const r = rng(); spd = r < 0.2 ? 0 : r < 0.7 ? 96 : 160; ang = r < 0.3 ? ang + Math.PI : rng() * 6.283; }   // a stop, a U-turn, or a new heading
    p.x += Math.cos(ang) * spd / 60; p.y += Math.sin(ang) * spd / 60;
    ADVF.trailPush(L, p); const g = ADVF.trailGoal(L, D); ADVF.chase(f, g.x, g.y, p, 1 / 60, 420, ADVF.MIN * Tt);
    const d = Math.hypot(f.x - p.x, f.y - p.y); if (t > 1) { minD = Math.min(minD, d); if (spd) maxMoving = Math.max(maxMoving, d); }
  }
  ok(minD >= Tt - 0.01, 'the follower never gets closer than one tile to the player (min ' + (minD / Tt).toFixed(2) + ' tiles)');
  ok(maxMoving < 2.6 * Tt, 'and never lags past 2.6 tiles while walking (max ' + (maxMoving / Tt).toFixed(2) + ')');
  for (let i = 0; i < 240; i++) { ADVF.trailPush(L, p); const g = ADVF.trailGoal(L, D); ADVF.chase(f, g.x, g.y, p, 1 / 60, 420, ADVF.MIN * Tt); }
  ok(f.sp < 1 && Math.hypot(f.x - p.x, f.y - p.y) >= Tt && Math.hypot(f.x - p.x, f.y - p.y) <= 2.2 * Tt, 'once you stop it brakes to a halt within 1.5 to 2.2 tiles');
  // walk vs idle needs 0.15 s of the other state; facing needs a real turn and moves one 45 degree step per 70 ms
  const a = { sp: 0, loco: 'Idle', face: 0, want: 0, vx: 0, vy: 0 };
  for (let i = 0; i < 6; i++) { a.sp = 40; ADVF.loco(a, 1 / 60); } ok(a.loco === 'Idle', '6 frames (0.1 s) of motion do not flip idle to walk');
  for (let i = 0; i < 6; i++) { a.sp = 40; ADVF.loco(a, 1 / 60); } ok(a.loco === 'Walk', '0.2 s of motion does');
  for (let i = 0; i < 100; i++) { a.sp = i % 2 ? 40 : 4; ADVF.loco(a, 1 / 60); } ok(a.loco === 'Walk', 'a speed flickering between 4 and 40 px/s never drops it back to idle');
  const b = { sp: 100, loco: 'Walk', face: 0, want: 0, vx: 0, vy: 100 };
  for (let i = 0; i < 120; i++) { const j = Math.sin(i) * 0.3; b.vx = Math.sin(j) * 100; b.vy = Math.cos(j) * 100; ADVF.aim(b, 1 / 60); } ok(b.face === 0, 'a path wobbling 17 degrees either way never flicks the facing');
  b.vx = 100; b.vy = 0; let steps = 0, last = b.face; for (let i = 0; i < 120; i++) { ADVF.aim(b, 1 / 60); if (b.face !== last) { steps++; last = b.face; } } ok(b.face === 2 && steps === 2, 'a real turn goes down, down-right, right one step at a time');
}
{
  const NOW = 1e12, E = (k, ago = 0, o = {}) => ({ k, t: NOW - ago * 1000, ...o }), base = { hpf: 1, status: '', friend: 100, level: 20, types: ['Normal'] };
  const tone = (m = {}, ev = [], env = {}) => ADVF.mood({ ...base, ...m }, ev, env, NOW).tone;
  eq(tone(), 'calm', 'nothing going on: calm');
  eq(tone({ hpf: 0.1 }), 'hurt', 'under a quarter HP: hurt'); eq(tone({ hpf: 0.4 }), 'worried', 'under half HP: worried'); eq(tone({ status: 'psn' }), 'hurt', 'poisoned: hurt');
  eq(tone({}, [E('win')]), 'proud', 'just won: proud'); eq(tone({}, [E('win', 300)]), 'proud', 'five minutes on it still shows'); eq(tone({}, [E('win', 2400)]), 'calm', 'forty minutes on it is forgotten');
  eq(tone({}, [E('level')]), 'joy', 'levelled up: joy'); eq(tone({}, [E('evolve')]), 'joy', 'evolved: joy'); eq(tone({}, [E('lose')]), 'sad', 'blacked out: sad'); eq(tone({}, [E('faint')]), 'sad', 'a teammate fainted: sad');
  eq(tone({}, [E('town')]), 'curious', 'new town: curious'); eq(tone({}, [E('heal')]), 'happy', 'healed at a Center: happy'); eq(tone({}, [E('catch')]), 'happy', 'caught something: happy'); eq(tone({}, [E('move')]), 'proud', 'learnt a move: proud');
  eq(tone({}, [E('win', 100), E('lose', 5)]), 'sad', 'a loss a moment ago outweighs an older win'); eq(tone({ friend: 30 }, [E('level')]), 'joy', 'a shy mon still celebrates a level up');
  eq(tone({ types: ['Fire'] }, [], { weather: 'rain' }), 'uneasy', 'fire types are uneasy in rain'); eq(tone({ types: ['Water'] }, [], { weather: 'rain' }), 'happy', 'water types like rain');
  eq(tone({ types: ['Ice'] }, [], { weather: 'snow' }), 'happy', 'ice types are glad in snow'); eq(tone({ types: ['Fire'] }, [], { weather: 'snow' }), 'uneasy', 'fire types shiver in snow'); eq(tone({ types: ['Ice'] }, [], { weather: 'sun' }), 'uneasy', 'ice types wilt in sun');
  eq(tone({ types: ['Water'] }, [], { water: true }), 'happy', 'water types are happy near water'); eq(tone({ types: ['Ghost'] }, [], { night: true }), 'playful', 'ghosts perk up at night'); eq(tone({}, [], { night: true }), 'sleepy', 'most mons get sleepy at night');
  eq(tone({}, [], { cave: true, indoors: true }), 'worried', 'a dark cave worries a plain mon'); eq(tone({ types: ['Rock'] }, [], { cave: true, indoors: true }), 'curious', 'but a rock type is at ease');
  eq(tone({ types: ['Fire'], hpf: 0.1 }, [], { weather: 'rain' }), 'hurt', 'low HP outranks the weather'); eq(tone({ types: ['Ice'] }, [E('lose', 10)], { weather: 'snow' }), 'sad', 'a fresh loss outranks the snow');
  eq(tone({}, [], { snow: true }), 'curious', 'a snow zone with no weather set still counts as snow');
  // portrait emotion with fallbacks: the first one the species has, else Normal
  const Pfull = { Joyous: 1, Happy: 1, Normal: 1 }, joy = ADVF.mood(base, [E('level')], {}, NOW);
  eq(ADVF.emotion(joy.emo, Pfull), 'Joyous', 'joy uses Joyous when the species has it'); eq(ADVF.emotion(joy.emo, { Happy: 1, Normal: 1 }), 'Happy', 'and Happy when it does not'); eq(ADVF.emotion(joy.emo, { Normal: 1 }), 'Normal', 'and Normal when it has only that'); eq(ADVF.emotion(joy.emo, undefined), 'Normal', 'no portraits at all: Normal');
  eq(ADVF.emotion(ADVF.mood({ ...base, hpf: 0.1 }, [], {}, NOW).emo, { Pain: 1, Normal: 1 }), 'Pain', 'hurt shows Pain'); eq(ADVF.emotion(ADVF.mood({ ...base }, [E('lose')], {}, NOW).emo, { 'Teary-Eyed': 1, Sad: 1 }), 'Teary-Eyed', 'sad shows a teary face');
  // every portrait list the table names is a real emotion that some species has
  const known = new Set(Object.values(window.PORTRAITS || {}).flatMap(o => Object.keys(o))); if (known.size) for (const [t, v] of Object.entries(window.ADV_FOLLOWER.tones)) ok(v.emo.every(e => e === 'Normal' || known.has(e)), 'tone ' + t + ' names real portrait emotions');
  // words: every line has the nickname, no em or en dashes, no leftover braces, and an event line names the event
  const D = window.ADV_FOLLOWER, all = [...Object.values(D.tones).flatMap(t => t.lines), ...Object.values(D.events).flat(), ...Object.values(D.env).flat(), ...Object.values(D.state).flat(), ...Object.values(D.doing).flat(), ...D.bond.low, ...D.bond.high];
  ok(all.length >= 120, 'a good spread of lines (' + all.length + ')'); ok(all.every(s => s.includes('{n}')), 'every line names the Pokemon'); ok(all.every(s => !/[—–]/.test(s)), 'no em or en dashes in any line');
  ok(Object.values(D.tones).every(t => t.lines.length >= 4) && Object.values(D.events).every(l => l.length >= 3), 'several lines per mood and per event');
  const vars = { n: 'Flowery', sp: 'Bulbasaur', lv: 12, friend: 100 }, evs = { win: { foe: 'Hiker Bob' }, level: { lv: 12 }, evolve: { to: 'Ivysaur' }, move: { mv: 'Vine Whip' }, catch: { nm: 'Wooloo' }, town: { town: 'Goldacre' }, faint: { who: 'Pidgey' }, lose: {}, heal: {} };
  for (const [k, o] of Object.entries(evs)) for (const r of [0, 0.4, 0.99]) { const m = ADVF.mood(base, [E(k, 0, o)], {}, NOW), s = ADVF.line(m, vars, '', () => r); ok(!/[{}]/.test(s) && s.includes('Flowery'), k + ' line is filled in: ' + s); if (o.foe) ok(s.includes('Hiker Bob'), 'a win line names the beaten trainer: ' + s); }
  for (const doing of Object.keys(D.doing)) ok(!/[{}]/.test(ADVF.line(ADVF.mood(base, [], {}, NOW), vars, doing, () => 0.1)), doing + ' doing line is filled in');
  for (const env of [{ weather: 'rain' }, { weather: 'snow' }, { night: true }, { cave: true }, { water: true }, { grass: true }, { indoors: true }]) for (const types of [['Fire'], ['Water'], ['Ice'], ['Ghost'], ['Normal'], ['Rock'], ['Grass']]) ok(!/[{}]/.test(ADVF.line(ADVF.mood({ ...base, types }, [], env, NOW), vars, '', Math.random)), 'env line filled in');
  // the ring buffer on the save and old saves
  const stA = ADVP.mon('bulbasaur', 5), svF = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: stA });
  ok(Array.isArray(svF.f.events) && !svF.f.events.length, 'a new save starts with an empty event ring');
  for (let i = 0; i < 14; i++) ADVF.note(svF, 'win', { foe: 'Foe ' + i }, NOW + i); ok(svF.f.events.length === 10 && svF.f.events[0].foe === 'Foe 4' && svF.f.events[9].foe === 'Foe 13', 'the ring keeps the latest 10');
  const oldF = JSON.parse(JSON.stringify(svF)); delete oldF.f; deepEq(ADVS.check(oldF).f, { events: [] }, 'an old save without save.f loads with the defaults');
  const junkF = JSON.parse(JSON.stringify(svF)); junkF.f = { events: [{ k: 'bogus', t: 1 }, { k: 'win', t: 'x' }, null, { k: 'win', t: 5, foe: 'A' }] }; ADVF.fix(junkF); deepEq(junkF.f.events.map(e => e.foe), ['A'], 'junk events in a hand-edited save are dropped');
  const lv = ADVF.live([E('win', 3000), E('win', 1800), E('win', 600), E('win', 0)], NOW); deepEq(lv.map(x => x.w), [1, 0.5, 0.125], 'an event fades by half every ten minutes (newest first) and is gone after three half-lives');
}

// the test panel (src/adv-debug.js): every action edits the save through the normal functions and leaves it valid
{
  const D = load('src/adv-debug.js', '\n;ADVDBG'); load('data/adv/item-sprites.js');
  const sv = ADVS.fresh({ name: 'Ash', avatar: 'red', home: 'G7', starter: ADVP.mon('bulbasaur', 5) });
  D.money(sv, sv.money + 1000); eq(sv.money, 4000, 'money +1000'); D.money(sv, sv.money + 10000); eq(sv.money, 14000, 'money +10000'); D.money(sv, 777); eq(sv.money, 777, 'set exact money'); D.money(sv, -5); eq(sv.money, 0, 'money never goes negative'); D.money(sv, 1e12); eq(sv.money, 9999999, 'and is capped');
  D.giveMon(sv, 'pikachu', 25); eq(sv.party.length, 2, 'a given Pokemon joins the party'); eq(sv.party[1].level, 25, 'at the chosen level'); ok(sv.party[1].hp === ADVP.max(sv.party[1]) && sv.party[1].moves.length > 0, 'full HP with level-up moves'); eq(sv.party[1].ot, 'Ash', 'with the player as OT');
  for (let i = 0; i < 4; i++) D.giveMon(sv, 'eevee', 10); eq(sv.party.length, 6, 'the party fills to 6'); D.giveMon(sv, 'snorlax', 7); eq(sv.party.length, 6, 'a 7th does not join the party'); eq(sv.box.at(-1).species, 'snorlax', 'it goes to the PC box'); eq(sv.box.at(-1).level, 7, 'at its level');
  D.giveItem(sv, 'masterball', 5); eq(sv.bag.masterball, 5, 'items are added to the bag'); D.giveItem(sv, 'masterball', 99); eq(sv.bag.masterball, 104, 'counts stack'); D.giveItem(sv, 'bike', 1); D.giveItem(sv, 'tm_flamethrower', 1); D.giveItem(sv, 'firestone', 3); ok(sv.bag.bike === 1 && sv.bag.tm_flamethrower === 1 && sv.bag.firestone === 3, 'key items, TMs and stones too');
  sv.party[0].hp = 1; sv.party[0].status = 'par'; D.healAll(sv); ok(sv.party[0].hp === ADVP.max(sv.party[0]) && !sv.party[0].status, 'heal party');
  D.setLevel(sv.party[0], 40); eq(sv.party[0].level, 40, 'lead level up'); eq(sv.party[0].exp, ADVP.expFor(ADVP.rate('bulbasaur'), 40), 'with the matching EXP'); ok(sv.party[0].hp === ADVP.max(sv.party[0]) && sv.party[0].moves.length === 4, 'full HP stays full and the moves fill'); D.setLevel(sv.party[0], 3); eq(sv.party[0].level, 3, 'and down again'); ok(sv.party[0].hp <= ADVP.max(sv.party[0]) && sv.party[0].hp > 0, 'HP stays inside the new maximum');
  D.friendship(sv); ok(sv.party.every(m => m.friend === 255), 'max friendship');
  for (const k of Object.keys(ADVP.SKILLS)) { D.skill(sv, k, true); ok(sv.skills[k] === 1, 'learn ' + k); } ok(sv.bag.fishingrod === 1, 'fishing brings the rod'); for (const k of Object.keys(ADVP.SKILLS)) { D.skill(sv, k, false); ok(!sv.skills[k], 'forget ' + k); }
  D.badges(sv, 8); ok(sv.badges === 8 && sv.medals.length === 8, '8 badges and 8 medals'); D.badges(sv, 2); ok(sv.badges === 2 && sv.medals.length === 2, 'back to 2'); D.badges(sv, 0); ok(sv.badges === 0 && !sv.medals.length, 'and 0');
  ok(ADVS.check(JSON.parse(JSON.stringify(sv))), 'the save is still valid after all of it');
  // the lists: every item has a picker entry and a PokeSprite icon, every move a TM
  for (const c of ADVP.CATS.map(x => x[0])) ok(D.items(c).every(id => ADVP.item(id).cat === c), c + ': the list holds that category only');
  const all = [...D.items('ball'), ...D.items('med'), ...D.items('grow'), ...D.items('key')]; ok(Object.keys(ADVP.ITEMS).every(id => all.includes(id)) && ADVP.STONES.every(id => all.includes(id)), 'every ITEMS id and every stone is offered');
  ok(all.every(id => window.ADV_ITEM_SPRITES.files[id]), 'and each has its icon'); ok(D.items('tm').length > 100 && D.items('tm').includes('tm_flamethrower') && D.items('tm').every(id => ADVP.item(id).tm), 'a TM for every move');
  // no wild encounters: the spawner holds still and the grass is quiet, and switching it off restores both
  const cap = ADVW.CAP, grass = ADVW.grass; D.setNoWild(true); ok(ADVW.CAP === 0 && ADVW.grass() === null && D.noWild, 'no wild encounters on'); D.setNoWild(true); D.setNoWild(false); ok(ADVW.CAP === cap && ADVW.grass === grass && !D.noWild, 'and off again, exactly as it was');
  ok(!D.guest({}) && !D.guest({ net: { N: { role: 'host' } } }) && D.guest({ net: { N: { role: 'guest' } } }), 'a guest is locked out, a host or an offline player is not');
}

console.log(`adv-check: ${n} assertions passed`);
