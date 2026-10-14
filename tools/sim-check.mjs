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
for (const f of ['data/dex.js', 'data/move-behaviour.js', 'data/vfx.js', 'data/sprites.js', 'data/sprites-custom.js', 'data/custom-species.js', 'data/world.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
for (const k of ['DEX', 'VFX', 'SPRITES', 'ARENAS', 'TRAINERS', 'MOVE_BEHAVIOUR']) ctx[k] = ctx.window[k];
vm.runInContext(fs.readFileSync('src/battle.js', 'utf8') + '\n;this.startBattle=startBattle;this.updateBattle=updateBattle;this.getB=()=>B;this.confirmChoose=confirmChoose;this.LASERS=LASERS;this.TUNE=TUNE;this.fireMove=fireMove;this.activeMon=activeMon;', ctx);

// bench: how often does each melee-style move actually land on a walking (and a dodging) target? usage: node tools/sim-check.mjs bench [walk|kite|dodge|cpu] [filterArch]
if (process.argv[2] === 'bench') {
  const mode = process.argv[3] || 'kite', dodgy = mode === 'dodge', only = process.argv[4], M = ctx.DEX.moves, SP = ctx.DEX.species;
  const AT = ['pikachu', 'machamp', 'snorlax'], DF = ['pikachu', 'charizard', 'onix'], res = {};
  const mk = (sp, moves) => ({ species: sp, level: 50, moves, ability: Object.values(SP[sp].abilities)[0], item: '', nature: 'Hardy' });
  // BENCH_OLD=1: switch every MELEE tuning knob back to its pre-buff value, for before/after numbers
  if (process.env.BENCH_OLD) Object.assign(ctx.TUNE.MELEE, { REACH: 0, CONE: 1.1, SNAP_CONE: 0, ACTIVE: 0, TICKS: 0, DASH_REACH: 0, LUNGE_REACH: 0, HOME: 0, ARMOR: 0.12, CHARGE_SIZE: 1, FAST_WIND: 1 });
  const origUse = ctx.useMove, origFire = ctx.fireMove, origHit = ctx.hitFoe; let cur = null;
  ctx.useMove = (side, slot) => { const ok = origUse(side, slot); if (ok && side.idx === 0 && cur) cur.uses++; return ok; };
  ctx.fireMove = side => { if (side.idx === 0 && cur) { cur.fired++; cur.win = true; cur.got = false; } return origFire(side); };
  ctx.hitFoe = (side, mv, at, o) => { const ok = ctx.canHit(ctx.getB().sides[1]); const r = origHit(side, mv, at, o); if (ok && side.idx === 0 && cur && cur.win && !cur.got) { cur.got = true; cur.hits++; } return r; };
  const ids2 = Object.keys(M).filter(id => !M[id].banned && M[id].category !== 'Status' && ['melee', 'dash', 'lunge', 'leap'].includes(ctx.MOVE_BEHAVIOUR[id]?.arch) && (!only || ctx.MOVE_BEHAVIOUR[id].arch === only));
  for (const id of ids2) {
    const r = res[id] = { uses: 0, fired: 0, hits: 0, arch: ctx.MOVE_BEHAVIOUR[id].arch, charge: !!(M[id].flags?.charge || id === 'focuspunch') };
    for (const a of AT) for (const d of DF) {
      ctx.startBattle({ arena: ctx.ARENAS[0], player: { name: 'A', cpu: true, tier: 'hard', team: [mk(a, [])] }, cpu: { name: 'D', cpu: true, tier: process.env.BENCH_TIER || 'hard', team: [mk(d, mode === 'cpu' ? ['ember', 'swift'] : ['splash'])] } });
      const B = ctx.getB(), [sa, sd] = B.sides, ea = sa.ent, ed = sd.ent, mv = M[id]; sa.team[0].moves = [mv]; sd.team[0].moves = (mode === 'cpu' ? ['ember', 'swift'] : ['splash']).map(x => M[x]); cur = r; // makeMon only keeps legal moves, so put the move under test in by hand r.win = false;
      let wt = 0, wx = 1, wy = 0, rolled = null; const hist = [];
      sa.script = (s, dt) => { const I = s.intent, dx = ed.x - ea.x, dy = ed.y - ea.y, dd = Math.hypot(dx, dy) || 1, want = ctx.effRange(mv) * 0.75, k = Math.max(-1, Math.min(1, (dd - want) / 60));
        I.use = -1; I.dodge = false; I.mega = false; I.hold = -1; I.mx = dx / dd * k; I.my = dy / dd * k; hist.push([ed.x, ed.y]); const lag = hist[Math.max(0, hist.length - 9)], ax = lag[0] - ea.x, ay = lag[1] - ea.y, al = Math.hypot(ax, ay) || 1; ea.aimX = ax / al; ea.aimY = ay / al; ea.aimIdle = 0; // aims at where the target was ~0.13s ago, no lead
        if (ctx.canUse(s, 0) && dd < ctx.effRange(mv) + 10) I.use = 0; };
      if (mode !== 'cpu') sd.script = (s, dt) => { const I = s.intent; I.use = -1; I.dodge = false; I.mega = false; I.hold = -1; s.team[s.cur].hp = s.team[s.cur].maxHp;
        if ((wt -= dt) <= 0) { wt = 0.5 + Math.random() * 0.8; const an = Math.random() * 6.283; wx = Math.cos(an); wy = Math.sin(an); }
        I.mx = wx; I.my = wy; if (mode !== 'walk') { const fx = ed.x - ea.x, fy = ed.y - ea.y, fl = Math.hypot(fx, fy) || 1, sg = wx > 0 ? 1 : -1; I.mx = fx / fl * 0.8 - fy / fl * 0.6 * sg; I.my = fy / fl * 0.8 + fx / fl * 0.6 * sg; } // kite: back away while strafing
        const ac = ea.act; if (dodgy && ac && !ac.fired && ac.wind - ac.t < 0.25 && rolled !== ac) { rolled = ac; if (Math.random() < 0.5) { I.dodge = true; I.mx = -(ea.y - ed.y); I.my = ea.x - ed.x; const l = Math.hypot(I.mx, I.my) || 1; I.mx /= l; I.my /= l; } } };
      for (let t = 0; t < 22 * 60 && !B.over; t++) { ctx.updateBattle(1 / 60); sa.team[sa.cur].hp = sa.team[sa.cur].maxHp; sd.team[sd.cur].hp = sd.team[sd.cur].maxHp; if (B.choose) ctx.confirmChoose(); if (process.env.BENCH_DBG) { const a = ea.act; if (ea._p && !ea._p.fired && ea.act !== ea._p) r.lost = (r.lost || 0) + 1, r.why = (r.why || '') + (ed.act ? 'F' : '') + (ea.dodge ? 'D' : '') + (ea.hurtT > 0 ? 'H' : '') + ' '; ea._p = a; } }
    }
  }
  const grp = {};
  for (const r of Object.values(res)) for (const key of [r.arch, r.charge ? 'charge(' + r.arch + ')' : '']) if (key) { const g = grp[key] ??= { n: 0, uses: 0, fired: 0, hits: 0 }; g.n++; g.uses += r.uses; g.fired += r.fired; g.hits += r.hits; }
  for (const [k, g] of Object.entries(grp)) console.log(k.padEnd(14), String(g.n).padStart(3) + ' moves', String(g.uses).padStart(6) + ' used', String(g.fired).padStart(6) + ' fired', 'land/use ' + (100 * g.hits / g.uses).toFixed(1) + '%', ' land/fired ' + (100 * g.hits / g.fired).toFixed(1) + '%');
  if (process.env.BENCH_DBG) { let l = 0, w = {}; for (const r of Object.values(res)) { l += r.lost || 0; for (const x of (r.why || '').split(' ')) w[x] = (w[x] || 0) + 1; } console.log('lost windups', l, JSON.stringify(w)); }
  if (process.env.BENCH_LIST) for (const [id, r] of Object.entries(res)) console.log(id.padEnd(16), r.arch.padEnd(6), r.uses, r.fired, (100 * r.hits / Math.max(1, r.uses)).toFixed(0) + '%');
  process.exit(0);
}
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
// 'flowery' mode: every trainer's lead is Flowery with his four moves, and fired moves are counted so each one is proven to run
const flo = process.argv[4] === 'flowery', fired = {};
if (flo) { const of = ctx.fireMove; ctx.fireMove = side => { const id = ctx.activeMon(side).moves[side.ent.act.slot]?.id; if (side.team[side.cur].sp.id === 'flowery') fired[id] = (fired[id] || 0) + 1; return of(side); }; }
const T = flo ? ctx.TRAINERS.map(t => ({ name: t.name, team: [{ species: 'flowery', level: 50, moves: D.species.flowery.learnset, ability: 'Levitate', item: '', nature: 'Hardy' }, ...t.team.slice(1)] })) : fuzz ? Array.from({ length: N }, (_, i) => ({ name: 'Fuzz' + i, team: randomTeam() })) : ctx.TRAINERS;
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
if (flo) { console.log('Flowery moves fired:', JSON.stringify(fired)); if (D.species.flowery.learnset.some(m => !fired[m])) { console.log('a Flowery move never fired'); process.exit(1); } }
if (errors) process.exit(1);
