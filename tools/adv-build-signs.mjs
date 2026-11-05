// Signposts at every town exit: which route starts there and where it leads (the 2026-11-05 world review found 6 signs for about 30 routes), and one by every gym door.
// Also one beside each cave mouth (world.doors), saying where the far end comes out.
// Run: node tools/adv-build-signs.mjs   (reads tools/adv-towns/<code>.json exits, data/adv/world.js towns and data/adv/zones.js; writes data/adv/signs.js)
// The route is the zone just outside the exit; where it leads is the other place that route's zone reaches, the one furthest along the way out. The game adds each sign to its chunk as it loads (adv-world.js) and reads it out when you press A in front of it (adv-scene.js).
import fs from 'node:fs'; import vm from 'node:vm';
const ROOT = new URL('..', import.meta.url).pathname, T = 32;
globalThis.window = globalThis;
for (const f of ['data/adv/world.js', 'data/adv/zones.js', 'data/adv/rosters.js', 'data/dex.js']) vm.runInThisContext(fs.readFileSync(ROOT + f, 'utf8'));
const W = window.ADV_WORLD, Z = window.ADV_ZONES;
const rle = s => s.split(',').flatMap(t => { const [v, n] = t.split('x'); return Array(n ? +n : 1).fill(+v); });
const rows = Z.cells.map(rle), C = Z.cell, zoneAt = (tx, ty) => Z.ids[rows[Math.floor(ty / C)]?.[Math.floor(tx / C)]] || '';
const R = { G: 28, T: 28, L: 18 }, places = Object.entries(W.towns).map(([code, t]) => ({ code, name: code[0] === 'L' && !/^the /i.test(t.name) ? 'the ' + t.name : t.name, tx: Math.floor(t.x / T), ty: Math.floor(t.y / T) }));   // landmarks read 'the Statue of Umbra', 'the Pokemon League'
const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }, WORD = { N: 'north', S: 'south', E: 'east', W: 'west' };
const label = z => z.replace(/^route(\d+)$/, 'Route $1');
// the road map: every tile whose ground is a road, from the chunk files (the map-lab region mats rgGrass, rgPath, rgWater come after the world palette)
const pal = [...W.palette, 'rgGrass', 'rgPath', 'rgWater'], ROAD = new Set(['path', 'pavingStone', 'boardwalk', 'pavingTan', 'soilCobble', 'ford', 'rgPath', 'pavingGrey', 'cobble'].map(n => pal.indexOf(n)).filter(i => i >= 0));
const CW = W.chunksW * 32, CHH = W.chunksH * 32, road = new Uint8Array(CW * CHH);
globalThis.ADV = { chunk(cx, cy, d) { const m = rle(d.mat), k = rle(d.kind); for (let i = 0; i < 1024; i++) if (ROAD.has(m[i]) || k[i] === 8) road[(cy * 32 + (i >> 5)) * CW + cx * 32 + (i & 31)] = 1; } };
for (const f of fs.readdirSync(ROOT + 'data/adv/chunks')) vm.runInThisContext(fs.readFileSync(ROOT + 'data/adv/chunks/' + f, 'utf8'));
const inside = (o, x, y) => Math.hypot(x - o.tx, y - o.ty) <= (R[o.code[0]] || 20);
// breadth first along road tiles from (x, y), never back into `self`, up to 900 tiles of road: the other places it reaches, nearest first
function roads([x0, y0], self) {
  const seen = new Uint8Array(CW * CHH), q = [[x0, y0, 0]], got = new Map();
  for (let i = 0; i < q.length && q.length < 400000; i++) {
    const [x, y, n] = q[i]; if (n > 900) break;
    for (const o of places) if (o !== self && !got.has(o) && inside(o, x, y)) got.set(o, n);
    if ([...got.keys()].length) continue;   // stop following past a place: what lies beyond is that place's own sign
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * CW + nx; if (nx < 0 || ny < 0 || nx >= CW || ny >= CHH || seen[k] || !road[k] || inside(self, nx, ny)) continue; seen[k] = 1; q.push([nx, ny, n + 1]); }
  }
  return [...got.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
}
const out = [];
for (const P of places) {
  const f = ROOT + 'tools/adv-towns/' + P.code + '.json'; if (!fs.existsSync(f)) continue;
  for (const [ex, ey, d, w = 2] of JSON.parse(fs.readFileSync(f, 'utf8')).exits || []) {
    const v = DIR[d]; if (!v) continue;
    // the route: the first route zone a few tiles out past the exit
    let route = '', at = null; for (let k = 2; k <= 16 && !route; k++) { const x = P.tx + ex + v[0] * k, y = P.ty + ey + v[1] * k, z = zoneAt(x, y); if (/^route/.test(z)) { route = z; at = [x, y]; } }
    // where it leads: walk the road out from the gate (path, paving, boardwalk, ford, bridge decks) to the first other places it reaches
    let dest = '';
    {
      const self = P, start = [P.tx + ex + v[0] * 2 + (d === 'N' || d === 'S' ? Math.floor(w / 2) : 0), P.ty + ey + v[1] * 2 + (d === 'E' || d === 'W' ? Math.floor(w / 2) : 0)];
      dest = roads(start, self).slice(0, 2).map(o => o.name).join(' and ');
      if (!dest && route) {   // no road to follow (a track across open ground): the other place the route's zone reaches furthest along the way out
        const id = Z.ids.indexOf(route), cells = []; rows.forEach((r, cy) => r.forEach((val, cx) => { if (val === id) cells.push([cx, cy]); }));
        const near = places.filter(o => o !== P && cells.some(([cx, cy]) => Math.hypot((cx + 0.5) * C - o.tx, (cy + 0.5) * C - o.ty) <= (R[o.code[0]] || 20) + 36));
        near.sort((a, b) => ((b.tx - P.tx) * v[0] + (b.ty - P.ty) * v[1]) - ((a.tx - P.tx) * v[0] + (a.ty - P.ty) * v[1])); dest = near[0]?.name || '';
      }
    }
    // the sign: three tiles inside the gate, beside the road (left of a north or south road, above an east or west one)
    const sx = d === 'N' || d === 'S' ? P.tx + ex - 1 : P.tx + ex - v[0] * 3, sy = d === 'E' || d === 'W' ? P.ty + ey - 1 : P.ty + ey - v[1] * 3;
    const lines = [`${P.name[0].toUpperCase() + P.name.slice(1)}, ${WORD[d]} road.`, route ? `${label(route)}${dest ? ' leads on to ' + dest : ' starts here'}.` : dest ? `This road leads on to ${dest}.` : 'The road leads out of town.'];
    out.push({ n: 'signGreen', x: (sx + 0.5) * T, y: (sy + 1) * T - 1, town: P.code, lines });
  }
}
// a sign at each cave mouth (world.doors): the cave and where its far end comes out, beside the mouth on its open side
for (const d of W.doors || []) {
  const other = (W.doors || []).find(o => o !== d && o.room === d.room); if (!other) continue;
  const ox = Math.floor(other.x / T), oy = Math.floor(other.y / T) + 2, near = roads([ox, oy], { tx: -999, ty: -999, code: 'X' }).slice(0, 1).map(o => o.name)[0];
  const tx = Math.floor(d.x / T) + (d.end === 'w' ? -3 : 3), ty = Math.floor(d.y / T) + 1, z = label([zoneAt(tx, ty), zoneAt(ox, oy - 4), zoneAt(Math.floor(d.x / T), Math.floor(d.y / T) - 4)].find(v => /^route/.test(v)) || ''), home = places.find(o => o.code === other.town), inTown = home && near === home.name;
  out.push({ n: 'signGreen', x: (tx + 0.5) * T, y: (ty + 1) * T - 1, town: d.town, cave: d.room, lines: [`${/^Route/.test(z) ? z : 'The'} cave, through the mountain.`, inTown ? `It comes out in ${home.name}.` : near ? `It comes out on the road to ${near}.` : 'It comes out on the far side.'] });
}
// hand-placed notices where the review found players stuck (data tiles: the sign's tile, the place it belongs to)
const NOTES = [
  { n: 'rg_sign_board', px: 2896, py: 23615, town: 'T7', lines: ['Longshore Pier. Open all hours. Mind the Wingull.', 'Cast a line off the far end. Chinchou bite out there.'] },
  { x: 590, y: 888, town: 'T8', lines: ['Route 103 ends at the stony shore.', 'Chinchou bite off the end of the jetty.'] },
  { x: 363, y: 501, town: 'G4', lines: ['Claystone Landing. Fine fishing off the jetty.', 'No ferry here. Route 133 runs west, Route 132 east.'] },
];
for (const o of NOTES) out.push({ n: o.n || 'signGreen', x: o.px ?? (o.x + 0.5) * T, y: o.py ?? (o.y + 1) * T - 1, town: o.town, note: 1, lines: o.lines });   // px, py: an exact spot (a board the chunk used to carry)
// a sign by every gym's door: the gym and its leader (two tiles to the right of the door, on the front step row)
for (const b of W.buildings) {
  const L = b.interior.npcs.find(n => n.trainer?.leader); if (!L) continue;
  const town = W.towns[b.town]?.name || '', ex = b.interior.exits[0][0], dx = b.fx + ex + 2, dy = b.fy + b.d;
  const ace = (window.ADV_ROSTERS?.[L.trainer.leader]?.b1 || []).find(m => m.ace)?.species, aceType = ace ? window.DEX?.species?.[ace]?.types?.[0] || '' : '';   // the ace's type (its line keeps it as it evolves), a hint of what to bring
  out.push({ n: 'signGreen', x: (dx + 0.5) * T, y: (dy + 1) * T - 1, town: b.town, gym: b.id, lines: [`${town} Pokemon Gym.`, `Gym Leader: ${L.trainer.name}.${aceType ? ' Ace: a ' + aceType + ' type.' : ' Bring your best!'}`] });
}
fs.writeFileSync(ROOT + 'data/adv/signs.js', '// Generated by tools/adv-build-signs.mjs: a signpost at every town exit, what route starts there and where it leads.\nwindow.ADV_SIGNS = ' + JSON.stringify(out) + ';\n');
console.log(out.length, 'signs'); for (const s of out) console.log(' ', s.town, s.lines.join(' | '));
