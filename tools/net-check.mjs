// Headless online check: a host sim streams snapshots into a guest battle; they must agree and the traffic must stay small.
// Usage: node tools/net-check.mjs [battles=4]
import fs from 'fs';
import vm from 'vm';

const N = +(process.argv[2] || 4);
const mk = () => {
  const ctx = {
    window: {}, console, Math, performance, setTimeout, JSON,
    clamp: (v, a, b) => v < a ? a : v > b ? b : v, lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a), pick: a => a[Math.floor(Math.random() * a.length)],
    dirFromVec: (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8],
    AUDIO: { play() {}, sfx() {}, cry() {}, move() { return true; }, gen() { return true; }, vol: { sfx: 0 } },
    INPUT: { hit: () => false, held: () => false, mouseAim: false, mx: 0, my: 0 }, MOUSE: {}, KEYS: {}, screenToWorld: () => ({ x: 0, y: 0 }), SS: 2,
    TYPE_COLOR: new Proxy({}, { get: () => '#fff' }),
  };
  vm.createContext(ctx);
  for (const f of ['data/dex.js', 'data/move-behaviour.js', 'data/vfx.js', 'data/sprites.js', 'data/sprites-custom.js', 'data/world.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
  for (const k of ['DEX', 'VFX', 'SPRITES', 'ARENAS', 'TRAINERS', 'MOVE_BEHAVIOUR']) ctx[k] = ctx.window[k];
  vm.runInContext(fs.readFileSync('src/battle.js', 'utf8') + '\n' + fs.readFileSync('src/netsync.js', 'utf8') + '\n;this.X={startBattle,updateBattle,updateFxOnly,getB:()=>B,confirmChoose,NETSYNC,playerIntent};', ctx);
  return ctx;
};
const H = mk(), G = mk();
let errors = 0, maxBytes = 0, total = 0, snaps = 0;
for (let i = 0; i < N; i++) {
  try {
    const T = H.TRAINERS, a = T[i % T.length], b = T[(i * 5 + 2) % T.length], arena = H.ARENAS[i % H.ARENAS.length];
    H.X.startBattle({ arena, player: { name: 'H', team: a.team }, cpu: { name: 'G', remote: true, team: b.team } });
    G.X.startBattle({ arena: G.ARENAS[i % G.ARENAS.length], player: { name: 'H', team: a.team }, cpu: { name: 'G', team: b.team }, me: 1, guest: true });
    const hb = H.X.getB(), gb = G.X.getB();
    hb.sides[0].cpu = true; // CPU drives the host side so something happens
    H.X.NETSYNC.begin();
    let t = 0, acc = 0;
    while (!hb.over && t < 120) {
      H.X.NETSYNC.rin.use = Math.random() < 0.05 ? (Math.random() * 4 | 0) : -1; H.X.NETSYNC.rin.mx = Math.cos(t); H.X.NETSYNC.rin.my = Math.sin(t * 0.7);
      H.X.updateBattle(1 / 60); H.X.NETSYNC.harvest();
      if (hb.choose) H.X.confirmChoose();
      acc += 1 / 60;
      if (acc >= 0.05) { acc = 0; const s = H.X.NETSYNC.snap(); maxBytes = Math.max(maxBytes, s.length); total += s.length; snaps++; G.X.NETSYNC.apply(s); }
      G.X.NETSYNC.step(1 / 60);
      t += 1 / 60;
    }
    H.X.NETSYNC.tick = 0; G.X.NETSYNC.apply(H.X.NETSYNC.snap());
    for (const idx of [0, 1]) {
      const hm = hb.sides[idx].team.map(m => Math.round(m.hp)).join(), gm = gb.sides[idx].team.map(m => Math.round(m.hp)).join();
      if (hm !== gm) throw new Error(`side ${idx} hp mismatch host ${hm} guest ${gm}`);
    }
    if (gb.over !== hb.over || gb.winner !== hb.winner) throw new Error('result mismatch');
    console.log(`${a.name} vs ${b.name}: ${hb.time.toFixed(0)}s over=${hb.over} in sync`);
  } catch (e) { errors++; console.log('ERROR', e.stack.split('\n').slice(0, 4).join(' | ')); }
}
console.log(`${N} battles, ${errors} errors, avg snapshot ${(total / Math.max(1, snaps)).toFixed(0)} B, max ${maxBytes} B (at 20/s = ${(total / Math.max(1, snaps) * 20 / 1024).toFixed(0)} KB/s)`);
if (errors) process.exit(1);
