// Headless CPU-vs-CPU battles: proves the sim runs without throwing and reports average time per KO.
// Usage: node tools/sim-check.mjs [battles=20] [tier=hard]
import fs from 'fs';
import vm from 'vm';

const N = +(process.argv[2] || 20), tier = process.argv[3] || 'hard', fuzz = process.argv[4] === 'fuzz';
const ctx = {
  window: {}, console, Math, performance, setTimeout,
  clamp: (v, a, b) => v < a ? a : v > b ? b : v, lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a), pick: a => a[Math.floor(Math.random() * a.length)],
  dirFromVec: (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8],
  AUDIO: { play() {}, sfx() {}, cry() {}, move() { return true; }, gen() { return true; }, vol: { sfx: 0 } }, INPUT: { hit() { return false; }, held() { return false; }, mouseAim: false },
  MOUSE: {}, KEYS: {}, screenToWorld: () => ({ x: 0, y: 0 }), TYPE_COLOR: new Proxy({}, { get: () => '#fff' }),
};
vm.createContext(ctx);
for (const f of ['data/dex.js', 'data/move-behaviour.js', 'data/vfx.js', 'data/sprites.js', 'data/sprites-custom.js', 'data/world.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
for (const k of ['DEX', 'VFX', 'SPRITES', 'ARENAS', 'TRAINERS', 'MOVE_BEHAVIOUR']) ctx[k] = ctx.window[k];
vm.runInContext(fs.readFileSync('src/battle.js', 'utf8') + '\n;this.startBattle=startBattle;this.updateBattle=updateBattle;this.getB=()=>B;this.confirmChoose=confirmChoose;this.LASERS=LASERS;', ctx);

const D = ctx.DEX, ids = Object.keys(D.species).filter(id => !D.species[id].isMega);
// every learnable move needs a behaviour entry; lasers need LASERS numbers; trap sheets must exist
const MB = ctx.MOVE_BEHAVIOUR, learnable = new Set(ids.flatMap(id => D.species[id].learnset.filter(m => D.moves[m] && !D.moves[m].banned)));
// ALLOW_MISSING_BEHAVIOUR=1 turns missing entries into a warning (new gens before their moves are classified);
// the list always goes to tools/missing-behaviour.txt
const noMB = [...learnable].filter(m => !MB[m]).sort(), allowMissing = process.env.ALLOW_MISSING_BEHAVIOUR === '1';
fs.writeFileSync('tools/missing-behaviour.txt', noMB.map(m => m + '\n').join(''));
if (allowMissing && noMB.length) console.log(`WARNING: ${noMB.length} learnable moves have no behaviour entry (listed in tools/missing-behaviour.txt)`);
const bad = (allowMissing ? [] : noMB).map(m => 'no behaviour: ' + m)
  .concat(Object.keys(MB).filter(m => MB[m].arch === 'laser' && !ctx.LASERS[m]).map(m => 'laser without LASERS: ' + m))
  .concat(Object.keys(MB).flatMap(m => [...(MB[m].fx || []), MB[m].big].filter(s => s && !ctx.VFX.particles[s]).map(s => `missing sheet ${s} (${m})`)));
if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
const used = new Set();
const GEN_OF = num => [151, 251, 386, 493, 649, 721, 809, 905, Infinity].findIndex(m => num <= m) + 1;
function randomTeam() {
  return Array.from({ length: 6 }, () => {
    // pick a generation first so every gen gets exercised, not just the big ones
    const g = 1 + Math.floor(Math.random() * 9), inGen = ids.filter(id => GEN_OF(D.species[id].num) === g);
    const sp = D.species[inGen[Math.floor(Math.random() * inGen.length)]];
    const legal = sp.learnset.filter(m => D.moves[m] && !D.moves[m].banned);
    const moves = legal.sort(() => Math.random() - 0.5).slice(0, 4); moves.forEach(m => used.add(m));
    const abil = Object.values(sp.abilities), items = Object.keys(D.items);
    return { species: sp.id, level: 30 + Math.floor(Math.random() * 70), moves, ability: abil[Math.floor(Math.random() * abil.length)], item: items[Math.floor(Math.random() * items.length)], nature: 'Hardy' };
  });
}
const T = fuzz ? Array.from({ length: N }, (_, i) => ({ name: 'Fuzz' + i, team: randomTeam() })) : ctx.TRAINERS;
let kos = 0, time = 0, timeouts = 0, errors = 0;
for (let i = 0; i < N; i++) {
  const a = T[i % T.length], b = T[(i * 7 + 3) % T.length];
  try {
    ctx.startBattle({ arena: ctx.ARENAS[i % ctx.ARENAS.length], player: { name: a.name, cpu: true, tier, team: a.team }, cpu: { name: b.name, cpu: true, tier, team: b.team } });
    const B = ctx.getB(); B.sides[0].cpu = true;
    let t = 0;
    while (!B.over && t < 1800) { ctx.updateBattle(1 / 60); for (const sd of B.sides) for (const m of sd.team) if (!Number.isFinite(m.hp)) throw new Error(`hp ${m.hp} on ${m.sp.id}; moves ${B.sides.map(x => x.team.map(q => q.vol.lastMove).join(',')).join(' / ')}`); if (B.choose) ctx.confirmChoose(); t += 1 / 60; }
    const k = 12 - B.sides.reduce((n, s) => n + s.team.filter(m => !m.fainted).length, 0);
    if (!B.over) timeouts++;
    kos += k; time += B.time;
    console.log(`${a.name.padEnd(10)} vs ${b.name.padEnd(10)} ${B.over ? 'winner ' + B.sides[B.winner].name : 'TIMEOUT'}  ${B.time.toFixed(0)}s  ${k} KOs`);
  } catch (e) { errors++; console.log('ERROR', a.name, 'vs', b.name, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
console.log(`\n${N} battles, ${errors} errors, ${timeouts} timeouts, avg ${(time / Math.max(1, kos)).toFixed(1)} s per KO (target 45-60 for players; CPU-vs-CPU runs faster/slower than humans)`);
if (fuzz) console.log('distinct moves exercised:', used.size);
if (errors) process.exit(1);
