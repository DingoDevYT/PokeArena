// Maps every move in data/dex.js to a game SFX from the BellBlitzKing pack and copies it into assets/sfx-move/.
// Usage: node tools/build-sfx.mjs ["<pack folder>"]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const PACK = process.argv[2] || 'C:/Users/lando/Downloads/Pokemon SFX Attack Moves & Sound Effects Collection (2)';
const OUT = path.join(ROOT, 'assets/sfx-move');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/dex.js'), 'utf8'), ctx);
const DEX = ctx.window.DEX;

// Newest clean recordings first; Gen 5 names are the tidiest.
const gens = fs.readdirSync(PACK).filter(d => /^GEN \d/.test(d)).sort((a, b) => {
  const order = ['GEN 5', 'GEN 4', 'GEN 6', 'GEN 7', 'GEN 3', 'GEN 2', 'GEN 1'];
  return order.findIndex(o => a.startsWith(o)) - order.findIndex(o => b.startsWith(o));
});
const norm = s => s.toLowerCase().replace(/\.(mp3|wav)$/, '').replace(/[^a-z0-9]/g, '');
const index = gens.map(g => {
  const m = new Map();
  for (const f of fs.readdirSync(path.join(PACK, g))) {
    if (!/\.(mp3|wav)$/i.test(f) || /part \d/i.test(f)) continue;
    let k = norm(f).replace(/^10milvolt/, '').replace(/1hit$/, '');
    if (/2hits$/.test(k)) continue;
    if (!m.has(k)) m.set(k, f);
  }
  return [g, m];
});
// Pack spellings that differ from the dex.
const ALIAS = { visegrip: 'vicegrip' };

function find(key) {
  for (const [g, m] of index) {
    for (const k of [key, ALIAS[key]].filter(Boolean)) if (m.has(k)) return path.join(g, m.get(k));
  }
  return null;
}

fs.mkdirSync(OUT, { recursive: true });
const out = { moves: {}, generic: {} };
const missing = [];
for (const [id, mv] of Object.entries(DEX.moves)) {
  const src = find(norm(mv.name)) || find(id);
  if (!src) { missing.push(mv.name); continue; }
  const file = id + path.extname(src).toLowerCase();
  fs.copyFileSync(path.join(PACK, src), path.join(OUT, file));
  out.moves[id] = 'assets/sfx-move/' + file;
}
// Gen 8-9 moves aren't in the pack: borrow a same-type, same-category move's sound.
for (const name of missing.slice()) {
  const [id, mv] = Object.entries(DEX.moves).find(([, m]) => m.name === name);
  const twin = Object.entries(DEX.moves).find(([k, m]) => out.moves[k] && m.type === mv.type && m.category === mv.category);
  if (twin) { out.moves[id] = out.moves[twin[0]]; missing.splice(missing.indexOf(name), 1); }
}
const GENERIC = { hit: 'Hit Normal Damage', hitSuper: 'Hit Super Effective', hitWeak: 'Hit Weak Not Very Effective', faint: 'In-Battle Faint No Health', recall: 'In-Battle Recall Switch Pokeball', heal: 'In-Battle Heal Status Refresh', statUp: 'Stat Rise Up', statDown: 'Stat Fall', brn: 'Status Burned', frz: 'Status Frozen', par: 'Status Paralyzed', psn: 'Status Poisoned' };
for (const [k, name] of Object.entries(GENERIC)) {
  const src = find(norm(name));
  if (!src) { missing.push('generic:' + name); continue; }
  fs.copyFileSync(path.join(PACK, src), path.join(OUT, '_' + k + '.mp3'));
  out.generic[k] = 'assets/sfx-move/_' + k + '.mp3';
}
fs.writeFileSync(path.join(ROOT, 'data/sfx.js'), 'window.MOVE_SFX = ' + JSON.stringify(out) + ';\n');
const n = Object.keys(DEX.moves).length;
console.log(`moves with sfx: ${Object.keys(out.moves).length}/${n}, generic: ${Object.keys(out.generic).length}/${Object.keys(GENERIC).length}`);
if (missing.length) console.log('missing:', missing.join(', '));
console.assert(out.generic.hit && out.moves.tackle, 'core sounds missing');
